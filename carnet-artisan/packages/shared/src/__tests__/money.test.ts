import { describe, expect, it } from 'vitest';
import {
  applyBp,
  formatCents,
  formatQuantity,
  multiplyQuantity,
  parseAmountToCents,
  parseQuantityToMilli,
  roundHalfUp,
  sum,
  MoneyError,
  ESPACE_MILLIERS,
} from '../money.js';

describe('roundHalfUp', () => {
  it('arrondit 0,5 en s eloignant de zero, des deux cotes', () => {
    expect(roundHalfUp(5, 10)).toBe(1);
    expect(roundHalfUp(4, 10)).toBe(0);
    expect(roundHalfUp(-5, 10)).toBe(-1);
    expect(roundHalfUp(15, 10)).toBe(2);
    expect(roundHalfUp(25, 10)).toBe(3); // pas d arrondi "banquier"
  });

  it('refuse la division par zero', () => {
    expect(() => roundHalfUp(1, 0)).toThrow(MoneyError);
  });
});

describe('multiplyQuantity', () => {
  it('multiplie une quantite decimale sans derive flottante', () => {
    // 2,5 h a 45,00 EUR = 112,50 EUR
    expect(multiplyQuantity(2500, 4500)).toBe(11250);
    // 0,1 x 0,2 : le piege classique du flottant
    expect(multiplyQuantity(100, 20)).toBe(2);
  });

  it('arrondit au centime le plus proche', () => {
    // 3 x 33,335 EUR -> 100,005 -> 100,01
    expect(multiplyQuantity(3000, 3334)).toBe(10002);
    expect(multiplyQuantity(1, 1)).toBe(0); // 0,001 x 0,01 EUR
    expect(multiplyQuantity(500, 1)).toBe(1); // 0,5 x 0,01 -> 0,005 -> 0,01
  });

  it('refuse une quantite non entiere en milli', () => {
    expect(() => multiplyQuantity(2.5, 100)).toThrow(MoneyError);
  });
});

describe('applyBp', () => {
  it('calcule une TVA a 20, 10 et 5,5 %', () => {
    expect(applyBp(10000, 2000)).toBe(2000);
    expect(applyBp(10000, 1000)).toBe(1000);
    expect(applyBp(10000, 550)).toBe(550);
    // 5,5 % de 1 234,56 EUR = 67,9008 -> 67,90
    expect(applyBp(123456, 550)).toBe(6790);
  });

  it('refuse un taux negatif', () => {
    expect(() => applyBp(100, -1)).toThrow(MoneyError);
  });
});

describe('sum', () => {
  it('additionne sans perte', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
  });
});

describe('parseAmountToCents', () => {
  it('accepte les formats francais courants', () => {
    expect(parseAmountToCents('1 234,56')).toBe(123456);
    expect(parseAmountToCents('1234.56')).toBe(123456);
    expect(parseAmountToCents('12 €')).toBe(1200);
    expect(parseAmountToCents('0,05')).toBe(5);
    expect(parseAmountToCents('-3,50')).toBe(-350);
    expect(parseAmountToCents('7')).toBe(700);
  });

  it('tronque au-dela du centime plutot que d arrondir une saisie ambigue', () => {
    expect(parseAmountToCents('1,999')).toBe(199);
  });

  it('retourne null plutot que de deviner', () => {
    for (const entree of ['', 'environ 100', 'cent euros', 'abc', '1,2,3', '-', '.']) {
      expect(parseAmountToCents(entree)).toBeNull();
    }
  });
});

describe('parseQuantityToMilli', () => {
  it('gere le millieme', () => {
    expect(parseQuantityToMilli('2,5')).toBe(2500);
    expect(parseQuantityToMilli('3')).toBe(3000);
    expect(parseQuantityToMilli('0,125')).toBe(125);
  });

  it('refuse ce qui n est pas un nombre', () => {
    expect(parseQuantityToMilli('quelques')).toBeNull();
  });
});

describe('formatage', () => {
  it('affiche a la francaise', () => {
    expect(formatCents(123456)).toBe(`1${ESPACE_MILLIERS}234,56${ESPACE_MILLIERS}€`);
    expect(formatCents(-50)).toBe(`-0,50${ESPACE_MILLIERS}€`);
    expect(formatCents(1000000, { withSymbol: false })).toBe(`10${ESPACE_MILLIERS}000,00`);
  });

  it('utilise une espace fine insecable comme separateur de milliers', () => {
    // U+202F : pas une espace ordinaire, pour qu'un montant ne soit jamais coupe
    // en fin de ligne. C'est aussi ce que produit Intl.NumberFormat('fr-FR').
    expect(ESPACE_MILLIERS).toBe(String.fromCharCode(0x202f));
    expect(formatCents(123456)).not.toContain(' ');
    expect(formatCents(123456)).toBe('1' + ESPACE_MILLIERS + '234,56' + ESPACE_MILLIERS + '€');
  });

  it('affiche les quantites sans zeros inutiles', () => {
    expect(formatQuantity(2500)).toBe('2,5');
    expect(formatQuantity(3000)).toBe('3');
    expect(formatQuantity(125)).toBe('0,125');
  });
});
