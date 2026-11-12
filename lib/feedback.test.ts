import { describe, it, expect } from 'vitest';
import { parseFeedbackValue, isUuid } from './feedback';

describe('isUuid', () => {
  it('accepte un UUID et rejette le reste', () => {
    expect(isUuid('5434af79-091e-420c-a599-45228189c1a2')).toBe(true);
    expect(isUuid('pas-un-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe('parseFeedbackValue', () => {
  it('accepte 1 et -1', () => {
    expect(parseFeedbackValue(1)).toBe(1);
    expect(parseFeedbackValue(-1)).toBe(-1);
  });

  it('traite null et 0 comme "retirer la note"', () => {
    expect(parseFeedbackValue(null)).toBeNull();
    expect(parseFeedbackValue(0)).toBeNull();
  });

  it('rejette tout le reste', () => {
    expect(parseFeedbackValue(2)).toBeUndefined();
    expect(parseFeedbackValue('1')).toBeUndefined();
    expect(parseFeedbackValue(undefined)).toBeUndefined();
    expect(parseFeedbackValue(true)).toBeUndefined();
  });
});
