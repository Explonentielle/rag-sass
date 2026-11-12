import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('@/lib/ssrfGuard', () => {
  class BlockedAddressError extends Error {}
  return {
    BlockedAddressError,
    assertPublicHostname: vi.fn(async (hostname: string) => {
      if (hostname === 'internal.test') throw new BlockedAddressError('Cette URL pointe vers une adresse réseau privée, non autorisée.');
    }),
  };
});

import {
  validateWebhookUrl,
  signWebhookBody,
  generateWebhookSecret,
  deliverWebhook,
  createLeadWebhookNotifier,
} from './leadWebhook';

describe('validateWebhookUrl', () => {
  it('efface avec null ou une chaîne vide', () => {
    expect(validateWebhookUrl(null)).toEqual({ ok: true, value: null });
    expect(validateWebhookUrl('  ')).toEqual({ ok: true, value: null });
  });

  it('accepte une URL https', () => {
    expect(validateWebhookUrl(' https://hooks.zapier.com/hooks/catch/1/abc/ ')).toEqual({
      ok: true,
      value: 'https://hooks.zapier.com/hooks/catch/1/abc/',
    });
  });

  it('refuse http, les identifiants intégrés, une URL invalide ou un mauvais type', () => {
    expect(validateWebhookUrl('http://exemple.com/hook').ok).toBe(false);
    expect(validateWebhookUrl('https://user:pass@exemple.com/hook').ok).toBe(false);
    expect(validateWebhookUrl('pas une url').ok).toBe(false);
    expect(validateWebhookUrl(42).ok).toBe(false);
    expect(validateWebhookUrl(`https://exemple.com/${'a'.repeat(2100)}`).ok).toBe(false);
  });
});

describe('signature', () => {
  it('correspond à un HMAC-SHA256 de "timestamp.corps"', () => {
    const expected = createHmac('sha256', 'whsec_test').update('1700000000.{"a":1}').digest('hex');
    expect(signWebhookBody('whsec_test', '1700000000', '{"a":1}')).toBe(expected);
  });

  it('génère des secrets distincts avec un préfixe reconnaissable', () => {
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a.startsWith('whsec_')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('deliverWebhook', () => {
  const target = { url: 'https://hooks.exemple.com/in', secret: 'whsec_secret' };
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envoie un POST signé que le destinataire peut vérifier', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));

    const result = await deliverWebhook(target, 'lead.qualified', { score: 'chaud' });

    expect(result).toEqual({ ok: true, status: 200 });
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://hooks.exemple.com/in');
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.headers['X-Corpus-Event']).toBe('lead.qualified');

    const payload = JSON.parse(init.body);
    expect(payload.event).toBe('lead.qualified');
    expect(payload.data).toEqual({ score: 'chaud' });
    const expectedSignature = signWebhookBody('whsec_secret', init.headers['X-Corpus-Timestamp'], init.body);
    expect(init.headers['X-Corpus-Signature']).toBe(`sha256=${expectedSignature}`);
  });

  it("signale un échec quand le destinataire répond autre chose que 2xx", async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const result = await deliverWebhook(target, 'lead.qualified', {});
    expect(result).toMatchObject({ ok: false, status: 500 });
  });

  it('ne suit pas une redirection (traitée comme un échec)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/' } }));
    const result = await deliverWebhook(target, 'lead.qualified', {});
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuse une adresse interne sans émettre de requête', async () => {
    const result = await deliverWebhook({ ...target, url: 'https://internal.test/hook' }, 'lead.qualified', {});
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ne lève jamais sur une erreur réseau', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const result = await deliverWebhook(target, 'lead.qualified', {});
    expect(result).toEqual({ ok: false, error: 'Envoi impossible.' });
  });
});

describe('createLeadWebhookNotifier', () => {
  it("renvoie undefined quand aucun webhook n'est configuré", () => {
    expect(createLeadWebhookNotifier(null, { chatbot: { id: 'c', name: 'n' }, conversationId: 'v' }, {})).toBeUndefined();
  });

  it("ajoute le chatbot et la conversation aux champs du lead", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const notify = createLeadWebhookNotifier(
      { url: 'https://hooks.exemple.com/in', secret: 's' },
      { chatbot: { id: 'c1', name: 'Mon bot' }, conversationId: 'conv1' },
      {}
    );
    await notify!('lead.qualified', { score: 'chaud', summary: 'Projet X', contact: 'a@b.fr' });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.data).toEqual({
      chatbot: { id: 'c1', name: 'Mon bot' },
      conversation_id: 'conv1',
      score: 'chaud',
      summary: 'Projet X',
      contact: 'a@b.fr',
    });
    vi.unstubAllGlobals();
  });
});
