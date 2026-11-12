import { describe, it, expect } from 'vitest';
import { computeChatbotStats, normalizeQuestion, type StatsMessageRow } from './chatbotStats';

const NOW = new Date('2026-11-12T12:00:00Z');

let seq = 0;
function row(partial: Partial<StatsMessageRow> & Pick<StatsMessageRow, 'role' | 'content'>): StatsMessageRow {
  seq += 1;
  return {
    id: `m${seq}`,
    conversation_id: 'c1',
    no_context: false,
    feedback: null,
    created_at: '2026-11-12T10:00:00Z',
    ...partial,
  };
}

// Un tour = deux lignes écrites dans la même requête, donc le même horodatage.
function turn(
  conversation: string,
  at: string,
  question: string,
  answer: Partial<StatsMessageRow> = {}
): StatsMessageRow[] {
  return [
    row({ role: 'user', content: question, conversation_id: conversation, created_at: at }),
    row({ role: 'assistant', content: '', conversation_id: conversation, created_at: at, ...answer }),
  ];
}

describe('normalizeQuestion', () => {
  it('ignore casse, accents et ponctuation', () => {
    expect(normalizeQuestion('  Quels sont VOS tarifs ?! ')).toBe('quels sont vos tarifs');
    expect(normalizeQuestion('Où êtes-vous situés ?')).toBe('ou etes vous situes');
  });

  it('renvoie une chaîne vide pour du bruit', () => {
    expect(normalizeQuestion('?!...')).toBe('');
  });
});

describe('computeChatbotStats', () => {
  it('compte conversations, questions et retours', () => {
    const rows = [
      ...turn('c1', '2026-11-12T09:00:00Z', 'Bonjour', { feedback: 1 }),
      ...turn('c1', '2026-11-12T09:05:00Z', 'Vos horaires ?', { feedback: -1, content: 'Je ne sais pas.' }),
      ...turn('c2', '2026-11-11T09:00:00Z', 'Un tarif ?'),
    ];
    const stats = computeChatbotStats(rows, { days: 30, now: NOW });
    expect(stats.conversations).toBe(2);
    expect(stats.questions).toBe(3);
    expect(stats.thumbsUp).toBe(1);
    expect(stats.thumbsDown).toBe(1);
  });

  it("n'inclut pas les messages 'Fichier joint' dans les questions", () => {
    const rows = [
      row({ role: 'user', content: 'Fichier joint : devis.pdf', created_at: '2026-11-12T09:00:00Z' }),
      ...turn('c1', '2026-11-12T09:01:00Z', 'Tu as reçu mon document ?'),
    ];
    const stats = computeChatbotStats(rows, { days: 30, now: NOW });
    expect(stats.questions).toBe(1);
  });

  it('liste les questions sans réponse avec leur nombre de répétitions', () => {
    const rows = [
      ...turn('c1', '2026-11-12T09:00:00Z', 'Vendez-vous des licences ?', { no_context: true }),
      ...turn('c2', '2026-11-11T09:00:00Z', 'vendez vous des licences', { no_context: true }),
      ...turn('c3', '2026-11-10T09:00:00Z', 'Quels sont vos tarifs ?'),
    ];
    const stats = computeChatbotStats(rows, { days: 30, now: NOW });
    expect(stats.unansweredQuestions).toBe(2);
    expect(stats.unanswered).toHaveLength(1);
    expect(stats.unanswered[0].count).toBe(2);
    expect(stats.unanswered[0].question).toBe('Vendez-vous des licences ?');
  });

  it('ne compte pas une salutation ou un remerciement comme une question sans réponse', () => {
    const rows = [
      ...turn('c1', '2026-11-12T09:00:00Z', 'Bonjour', { no_context: true }),
      ...turn('c1', '2026-11-12T09:05:00Z', 'ok tres bien merci', { no_context: true }),
      ...turn('c1', '2026-11-12T09:06:00Z', 'tu bug ?', { no_context: true }),
      ...turn('c1', '2026-11-12T09:07:00Z', 'Vendez-vous des licences ?', { no_context: true }),
    ];
    const stats = computeChatbotStats(rows, { days: 30, now: NOW });
    expect(stats.unansweredQuestions).toBe(1);
    expect(stats.unanswered.map((q) => q.question)).toEqual(['Vendez-vous des licences ?']);
  });

  it("associe la réponse mal notée à la question du même tour, pas à celle d'un tour précédent", () => {
    const rows = [
      ...turn('c1', '2026-11-12T08:00:00Z', 'Première question'),
      ...turn('c1', '2026-11-12T09:00:00Z', 'Deuxième question', { feedback: -1, content: 'Réponse peu utile' }),
    ];
    const stats = computeChatbotStats(rows, { days: 30, now: NOW });
    expect(stats.downvoted).toEqual([
      { question: 'Deuxième question', answer: 'Réponse peu utile', createdAt: '2026-11-12T09:00:00Z' },
    ]);
  });

  it("ne garde dans 'les plus posées' que les questions répétées", () => {
    const rows = [
      ...turn('c1', '2026-11-12T09:00:00Z', 'Quels sont vos tarifs ?'),
      ...turn('c2', '2026-11-12T10:00:00Z', 'quels sont vos tarifs'),
      ...turn('c3', '2026-11-12T11:00:00Z', 'Une question unique'),
    ];
    const stats = computeChatbotStats(rows, { days: 30, now: NOW });
    expect(stats.topQuestions).toHaveLength(1);
    expect(stats.topQuestions[0].count).toBe(2);
  });

  it('produit un point par jour, jours vides inclus, du plus ancien au plus récent', () => {
    const rows = [
      ...turn('c1', '2026-11-12T09:00:00Z', 'Aujourd’hui'),
      ...turn('c2', '2026-11-10T09:00:00Z', 'Il y a deux jours'),
    ];
    const stats = computeChatbotStats(rows, { days: 7, now: NOW });
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily[stats.daily.length - 1]).toEqual({ date: '2026-11-12', questions: 1 });
    expect(stats.daily.find((d) => d.date === '2026-11-11')?.questions).toBe(0);
    expect(stats.daily.find((d) => d.date === '2026-11-10')?.questions).toBe(1);
  });

  it('gère une période sans aucun message', () => {
    const stats = computeChatbotStats([], { days: 30, now: NOW });
    expect(stats.questions).toBe(0);
    expect(stats.conversations).toBe(0);
    expect(stats.topQuestions).toEqual([]);
    expect(stats.daily).toHaveLength(30);
  });
});
