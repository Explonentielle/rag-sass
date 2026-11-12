import { describe, it, expect } from 'vitest';
import { isSmallTalk } from './smallTalk';

describe('isSmallTalk', () => {
  it('reconnaît salutations, remerciements et accusés de réception', () => {
    expect(isSmallTalk('Bonjour')).toBe(true);
    expect(isSmallTalk('ok tres bien merci')).toBe(true);
    expect(isSmallTalk('Merci beaucoup !')).toBe(true);
    expect(isSmallTalk("D'accord, parfait")).toBe(true);
    expect(isSmallTalk('Comment ça va ?')).toBe(true);
    expect(isSmallTalk('Au revoir, bonne journée')).toBe(true);
  });

  it('reconnaît une remarque sur le chat lui-même', () => {
    expect(isSmallTalk('tu bug ?')).toBe(true);
    expect(isSmallTalk('Vous êtes là ?')).toBe(true);
    expect(isSmallTalk('ça bug')).toBe(true);
  });

  it('garde comme vraie question tout ce qui porte un contenu', () => {
    expect(isSmallTalk('Quels sont vos tarifs ?')).toBe(false);
    expect(isSmallTalk('merci pour les tarifs, et pour les horaires ?')).toBe(false);
    expect(isSmallTalk('Bonjour, je voudrais un devis pour une rénovation')).toBe(false);
    expect(isSmallTalk('Où êtes-vous situés')).toBe(false);
  });

  it("ne classe pas un long message de politesse comme une question vide au-delà de la limite", () => {
    expect(isSmallTalk('merci merci merci merci merci merci merci')).toBe(false);
  });
});
