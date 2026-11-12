import { describe, it, expect } from 'vitest';
import {
  UserFacingError,
  toUserMessage,
  describeFailedResponse,
  describeAuthError,
  describeDbError,
  GENERIC_ERROR_MESSAGE,
  OVERLOADED_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from './userErrors';
import { reportError, reportDbError } from './reportError';

const RAW_DB_ERROR =
  'null value in column "no_context" of relation "messages" violates not-null constraint';

describe('toUserMessage', () => {
  it('affiche tel quel le message d\'une UserFacingError', () => {
    expect(toUserMessage(new UserFacingError("Impossible d'enregistrer le fichier."))).toBe(
      "Impossible d'enregistrer le fichier."
    );
  });

  it("ne laisse jamais passer le texte brut d'une erreur ordinaire", () => {
    expect(toUserMessage(new Error(RAW_DB_ERROR))).toBe(GENERIC_ERROR_MESSAGE);
    expect(toUserMessage(new Error(RAW_DB_ERROR))).not.toContain('no_context');
    expect(toUserMessage('chaîne brute')).toBe(GENERIC_ERROR_MESSAGE);
    expect(toUserMessage(null)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('reconnaît un service saturé (429, quota)', () => {
    expect(toUserMessage(Object.assign(new Error('429 You exceeded your current quota'), { status: 429 }))).toBe(
      OVERLOADED_ERROR_MESSAGE
    );
    expect(toUserMessage(Object.assign(new Error('x'), { code: 'insufficient_quota' }))).toBe(
      OVERLOADED_ERROR_MESSAGE
    );
  });

  it('reconnaît un délai dépassé', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(toUserMessage(abort)).toBe(TIMEOUT_ERROR_MESSAGE);
    expect(toUserMessage(new Error('Request timed out.'))).toBe(TIMEOUT_ERROR_MESSAGE);
  });
});

describe('describeFailedResponse', () => {
  it('garde le court message en français renvoyé par nos routes', () => {
    expect(describeFailedResponse(404, 'Chatbot introuvable.')).toBe('Chatbot introuvable.');
    expect(describeFailedResponse(402, 'Ce chatbot a atteint son quota de messages pour ce mois.')).toContain('quota');
  });

  it("remplace une page HTML d'erreur de plateforme", () => {
    expect(describeFailedResponse(502, '<!DOCTYPE html><html>Bad gateway</html>')).toBe(GENERIC_ERROR_MESSAGE);
    expect(describeFailedResponse(400, '<html>oops</html>')).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('traite un délai de plateforme et un corps vide', () => {
    expect(describeFailedResponse(504, 'An error occurred')).toBe(TIMEOUT_ERROR_MESSAGE);
    expect(describeFailedResponse(429, '')).toBe(OVERLOADED_ERROR_MESSAGE);
    expect(describeFailedResponse(500, '')).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("ne montre jamais un corps trop long, ni un message d'une erreur serveur brute", () => {
    expect(describeFailedResponse(400, 'x'.repeat(400))).toBe(GENERIC_ERROR_MESSAGE);
    expect(describeFailedResponse(500, 'null value in column "x"')).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('describeAuthError', () => {
  it('traduit les erreurs courantes par code', () => {
    expect(describeAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'Email ou mot de passe incorrect.'
    );
    expect(describeAuthError({ code: 'user_already_exists' })).toContain('existe déjà');
    expect(describeAuthError({ code: 'weak_password' })).toContain('trop faible');
    expect(describeAuthError({ code: 'over_email_send_rate_limit' })).toContain('Trop de tentatives');
  });

  it("se rabat sur le texte quand le code est absent", () => {
    expect(describeAuthError({ message: 'Invalid login credentials' })).toBe('Email ou mot de passe incorrect.');
    expect(describeAuthError({ message: 'Email not confirmed' })).toContain('pas encore confirmée');
    expect(describeAuthError({ message: 'User already registered' })).toContain('existe déjà');
    expect(describeAuthError({ message: 'New password should be different from the old password.' })).toContain(
      'différent'
    );
  });

  it("n'affiche jamais un texte anglais inconnu", () => {
    expect(describeAuthError({ message: 'Database error saving new user' })).toBe(GENERIC_ERROR_MESSAGE);
    expect(describeAuthError(null)).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('describeDbError', () => {
  it('explique les causes courantes', () => {
    expect(describeDbError({ code: '23505' })).toBe('Cet élément existe déjà.');
    expect(describeDbError({ code: '42501' })).toContain('droits');
  });

  it('reste générique pour le reste, y compris sans code', () => {
    expect(describeDbError({ code: '99999' })).toBe(GENERIC_ERROR_MESSAGE);
    expect(describeDbError({})).toBe(GENERIC_ERROR_MESSAGE);
    expect(describeDbError(null)).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('reportError / reportDbError', () => {
  it('ne renvoie pas le texte brut, mais une référence', () => {
    const { message, ref } = reportError('test.event', new Error(RAW_DB_ERROR), { chatbotId: 'c1' });
    expect(message).not.toContain('no_context');
    expect(message).toContain(GENERIC_ERROR_MESSAGE);
    expect(message).toContain(`réf. ${ref}`);
    expect(ref).toMatch(/^[0-9a-f]{8}$/);
  });

  it("n'ajoute pas de référence à une UserFacingError", () => {
    const { message } = reportError('test.event', new UserFacingError('Fichier trop gros.'));
    expect(message).toBe('Fichier trop gros.');
  });

  it("une erreur de base reconnue n'a pas besoin de référence, une inconnue en reçoit une", () => {
    expect(reportDbError('test.db', { code: '23505', message: 'duplicate key value' }).message).toBe(
      'Cet élément existe déjà.'
    );
    const unknown = reportDbError('test.db', { code: '99999', message: RAW_DB_ERROR });
    expect(unknown.message).not.toContain('no_context');
    expect(unknown.message).toContain('réf.');
  });
});
