import { describe, expect, it } from 'vitest';
import {
  composantesLocales,
  decalageMinutes,
  formatDateFr,
  formatDateHeureFr,
  heureLocaleVersInstant,
  resoudreDateRelative,
} from '../dates-fr.js';

describe('fuseau Europe/Paris', () => {
  it('donne +1 h en hiver et +2 h en ete', () => {
    expect(decalageMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(60);
    expect(decalageMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(120);
  });

  it('lit les composantes locales, pas UTC', () => {
    // 2026-07-15 23:30 UTC = 16 juillet 01:30 a Paris
    const c = composantesLocales(new Date('2026-07-15T23:30:00Z'));
    expect(c).toMatchObject({ annee: 2026, mois: 7, jour: 16, heure: 1, minute: 30 });
  });
});

describe('changements d heure', () => {
  it('signale une heure qui n existe pas (passage a l heure d ete)', () => {
    // Le 29 mars 2026, 02h00 devient 03h00 : 02h30 n existe pas.
    const r = heureLocaleVersInstant({ annee: 2026, mois: 3, jour: 29, heure: 2, minute: 30 });
    expect(r.anomalie).toBe('heure_inexistante');
  });

  it('signale une heure qui existe deux fois (passage a l heure d hiver)', () => {
    // Le 25 octobre 2026, 03h00 revient a 02h00 : 02h30 existe deux fois.
    const r = heureLocaleVersInstant({ annee: 2026, mois: 10, jour: 25, heure: 2, minute: 30 });
    expect(r.anomalie).toBe('heure_doublee');
  });

  it('ne signale rien pour une heure ordinaire', () => {
    const r = heureLocaleVersInstant({ annee: 2026, mois: 6, jour: 10, heure: 14, minute: 0 });
    expect(r.anomalie).toBe('aucune');
    expect(r.instant.toISOString()).toBe('2026-06-10T12:00:00.000Z');
  });

  it('convertit correctement de part et d autre du changement', () => {
    const hiver = heureLocaleVersInstant({ annee: 2026, mois: 2, jour: 1, heure: 9, minute: 0 });
    expect(hiver.instant.toISOString()).toBe('2026-02-01T08:00:00.000Z');
    const ete = heureLocaleVersInstant({ annee: 2026, mois: 8, jour: 1, heure: 9, minute: 0 });
    expect(ete.instant.toISOString()).toBe('2026-08-01T07:00:00.000Z');
  });
});

describe('resoudreDateRelative', () => {
  // Mercredi 18 mars 2026, 10h00 heure de Paris.
  const appel = new Date('2026-03-18T09:00:00Z');

  it('resout "demain"', () => {
    const r = resoudreDateRelative('il passe demain', appel);
    expect(r).not.toBeNull();
    expect(formatDateFr(r!.instant)).toBe('19/03/2026');
    expect(r!.precision).toBe('jour');
  });

  it('resout "apres-demain"', () => {
    const r = resoudreDateRelative('apres-demain si possible', appel);
    expect(formatDateFr(r!.instant)).toBe('20/03/2026');
  });

  it('resout un jour de la semaine a venir', () => {
    const r = resoudreDateRelative('vendredi', appel);
    expect(formatDateFr(r!.instant)).toBe('20/03/2026');
    expect(r!.ambigu).toBe(false);
  });

  it('marque comme ambigu un jour eloigne dans la semaine', () => {
    const r = resoudreDateRelative('mardi', appel);
    expect(formatDateFr(r!.instant)).toBe('24/03/2026');
    expect(r!.ambigu).toBe(true);
    expect(r!.explication).toContain('cette semaine');
  });

  it('comprend "lundi prochain" comme la semaine suivante', () => {
    const r = resoudreDateRelative('lundi prochain', appel);
    expect(formatDateFr(r!.instant)).toBe('30/03/2026');
    expect(r!.ambigu).toBe(false);
  });

  it('applique le creneau apres-midi', () => {
    const r = resoudreDateRelative('lundi apres-midi', appel);
    expect(r!.creneau).toBe('apres_midi');
    expect(r!.precision).toBe('creneau');
    expect(formatDateHeureFr(r!.instant)).toBe('23/03/2026 14:00');
  });

  it('applique une heure explicite', () => {
    const r = resoudreDateRelative('jeudi a 9h30', appel);
    expect(r!.precision).toBe('heure');
    expect(formatDateHeureFr(r!.instant)).toBe('19/03/2026 09:30');
  });

  it('retourne null plutot que d inventer une date', () => {
    expect(resoudreDateRelative('on verra plus tard', appel)).toBeNull();
    expect(resoudreDateRelative('', appel)).toBeNull();
    expect(resoudreDateRelative('des que possible', appel)).toBeNull();
  });

  it('un jour prononce le meme jour designe la semaine suivante', () => {
    // L appel est un mercredi ; "mercredi" = le mercredi suivant.
    const r = resoudreDateRelative('mercredi', appel);
    expect(formatDateFr(r!.instant)).toBe('25/03/2026');
  });

  it('signale le changement d heure quand la date proposee tombe dessus', () => {
    // Appel le samedi 28 mars 2026 : "demain a 2h30" tombe dans le trou.
    const veille = new Date('2026-03-28T12:00:00Z');
    const r = resoudreDateRelative('demain a 2h30', veille);
    expect(r!.anomalieHeure).toBe('heure_inexistante');
    expect(r!.ambigu).toBe(true);
  });

  it('respecte un fuseau different quand il est fourni', () => {
    const r = resoudreDateRelative('demain matin', appel, { fuseau: 'Indian/Reunion' });
    expect(r).not.toBeNull();
    expect(r!.precision).toBe('creneau');
  });
});
