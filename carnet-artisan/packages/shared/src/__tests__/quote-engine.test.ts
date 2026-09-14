import { describe, expect, it } from 'vitest';
import {
  calculerDevis,
  ligneDepuisCatalogue,
  margeIndicative,
  type LigneDevisEntree,
  type PrestationCatalogue,
} from '../quote-engine.js';
import { TAUX_TVA } from '../vat.js';

const priseSupplementaire: PrestationCatalogue = {
  id: 'p1',
  reference: 'ELEC-PC-16A',
  libelle: 'Prise de courant 16 A, pose comprise',
  unite: 'u',
  prixVenteCents: 8500,
  coutAchatCents: 1200,
  tempsMainOeuvreMinutes: 45,
  nature: 'forfait_pose',
  tvaRateBp: TAUX_TVA.INTERMEDIAIRE,
  archive: false,
};

const mainOeuvre: PrestationCatalogue = {
  id: 'p2',
  reference: 'MO-H',
  libelle: 'Main-d oeuvre electricien',
  unite: 'h',
  prixVenteCents: 4500,
  coutAchatCents: null,
  tempsMainOeuvreMinutes: 60,
  nature: 'main_oeuvre',
  tvaRateBp: TAUX_TVA.INTERMEDIAIRE,
  archive: false,
};

function ligne(partial: Partial<LigneDevisEntree> & { id: string }): LigneDevisEntree {
  return {
    libelle: 'Ligne',
    unite: 'u',
    quantiteMilli: 1000,
    prixUnitaireCents: 1000,
    tvaRateBp: TAUX_TVA.NORMAL,
    nature: 'fourniture_seule',
    origine: 'saisie_manuelle',
    ...partial,
  };
}

describe('calculerDevis - totaux', () => {
  it('calcule HT, TVA et TTC sur un cas simple', () => {
    const resultat = calculerDevis([
      ligneDepuisCatalogue({ id: 'l1', prestation: priseSupplementaire, quantiteMilli: 4000 }),
    ]);
    // 4 x 85,00 = 340,00 HT ; TVA 10 % = 34,00 ; TTC = 374,00
    expect(resultat.totalHtCents).toBe(34000);
    expect(resultat.totalTvaCents).toBe(3400);
    expect(resultat.totalTtcCents).toBe(37400);
    expect(resultat.etat).toBe('pret_a_verifier');
  });

  it('applique une remise par ligne avant la TVA', () => {
    const resultat = calculerDevis([
      ligne({ id: 'l1', quantiteMilli: 2000, prixUnitaireCents: 10000, remiseBp: 1000 }),
    ]);
    // 200,00 - 10 % = 180,00 HT ; TVA 20 % = 36,00
    expect(resultat.sousTotalBrutHtCents).toBe(20000);
    expect(resultat.totalRemisesCents).toBe(2000);
    expect(resultat.totalHtCents).toBe(18000);
    expect(resultat.totalTvaCents).toBe(3600);
    expect(resultat.totalTtcCents).toBe(21600);
  });

  it('regroupe la TVA par taux et arrondit une seule fois par poste', () => {
    const resultat = calculerDevis([
      ligne({ id: 'a', quantiteMilli: 1000, prixUnitaireCents: 333, tvaRateBp: TAUX_TVA.INTERMEDIAIRE }),
      ligne({ id: 'b', quantiteMilli: 1000, prixUnitaireCents: 333, tvaRateBp: TAUX_TVA.INTERMEDIAIRE }),
      ligne({ id: 'c', quantiteMilli: 1000, prixUnitaireCents: 1000, tvaRateBp: TAUX_TVA.NORMAL }),
    ]);
    // Poste 10 % : base 6,66 -> TVA 0,666 -> 0,67 (et non 0,33+0,33 = 0,66)
    const poste10 = resultat.postesTva.find((p) => p.rateBp === TAUX_TVA.INTERMEDIAIRE);
    expect(poste10).toEqual({ rateBp: 1000, baseHtCents: 666, montantTvaCents: 67 });
    const poste20 = resultat.postesTva.find((p) => p.rateBp === TAUX_TVA.NORMAL);
    expect(poste20).toEqual({ rateBp: 2000, baseHtCents: 1000, montantTvaCents: 200 });
    expect(resultat.totalTvaCents).toBe(267);
    expect(resultat.avertissements.map((a) => a.code)).toContain('TAUX_TVA_HETEROGENE');
  });

  it('gere un devis vide sans planter', () => {
    const resultat = calculerDevis([]);
    expect(resultat.totalTtcCents).toBe(0);
    expect(resultat.etat).toBe('pret_a_verifier');
  });
});

describe('calculerDevis - refus d inventer', () => {
  it('laisse une ligne sans prix incomplete et ne la compte pas', () => {
    const resultat = calculerDevis([
      ligne({ id: 'connue', quantiteMilli: 1000, prixUnitaireCents: 5000 }),
      ligne({ id: 'inconnue', libelle: 'Tableau a reprendre', prixUnitaireCents: null }),
    ]);
    expect(resultat.totalHtCents).toBe(5000);
    expect(resultat.nbLignesIncompletes).toBe(1);
    expect(resultat.etat).toBe('brouillon_incomplet');
    const incomplete = resultat.lignes.find((l) => l.id === 'inconnue');
    expect(incomplete?.montantHtCents).toBeNull();
    expect(incomplete?.champsManquants).toContain('prix');
    expect(resultat.avertissements.map((a) => a.code)).toContain('PRIX_MANQUANT');
  });

  it('ne suppose jamais une quantite de 1', () => {
    const resultat = calculerDevis([ligne({ id: 'x', quantiteMilli: null })]);
    expect(resultat.lignes[0]?.montantHtCents).toBeNull();
    expect(resultat.totalHtCents).toBe(0);
    expect(resultat.etat).toBe('brouillon_incomplet');
  });

  it('ne suppose jamais un taux de TVA a 20 %', () => {
    const resultat = calculerDevis([ligne({ id: 'x', tvaRateBp: null })]);
    expect(resultat.postesTva).toHaveLength(0);
    expect(resultat.avertissements.map((a) => a.code)).toContain('TVA_MANQUANTE');
  });

  it('ignore une remise aberrante et le signale', () => {
    const resultat = calculerDevis([
      ligne({ id: 'x', quantiteMilli: 1000, prixUnitaireCents: 10000, remiseBp: 15000 }),
    ]);
    expect(resultat.totalHtCents).toBe(10000);
    expect(resultat.avertissements.map((a) => a.code)).toContain('REMISE_INVALIDE');
  });
});

describe('calculerDevis - double comptage de main-d oeuvre', () => {
  it('signale une main-d oeuvre ajoutee a cote d un forfait pose', () => {
    const resultat = calculerDevis(
      [
        ligneDepuisCatalogue({ id: 'l1', prestation: priseSupplementaire, quantiteMilli: 4000 }),
        ligneDepuisCatalogue({ id: 'l2', prestation: mainOeuvre, quantiteMilli: 3000 }),
      ],
      { catalogue: [priseSupplementaire, mainOeuvre] },
    );
    const alerte = resultat.avertissements.find(
      (a) => a.code === 'MAIN_OEUVRE_POTENTIELLEMENT_DOUBLEE',
    );
    expect(alerte).toBeDefined();
    expect(alerte?.ligneId).toBe('l2');
    // Le moteur signale mais ne retire rien tout seul.
    expect(resultat.totalHtCents).toBe(34000 + 13500);
  });

  it('ne signale rien quand il n y a pas de forfait pose', () => {
    const resultat = calculerDevis([
      ligneDepuisCatalogue({ id: 'l2', prestation: mainOeuvre, quantiteMilli: 3000 }),
    ]);
    expect(
      resultat.avertissements.some((a) => a.code === 'MAIN_OEUVRE_POTENTIELLEMENT_DOUBLEE'),
    ).toBe(false);
  });

  it('ne signale rien pour un forfait pose seul', () => {
    const resultat = calculerDevis([
      ligneDepuisCatalogue({ id: 'l1', prestation: priseSupplementaire, quantiteMilli: 4000 }),
    ]);
    expect(resultat.avertissements).toHaveLength(0);
  });
});

describe('prestations archivees', () => {
  it('signale une prestation archivee sans bloquer le calcul', () => {
    const archive = { ...priseSupplementaire, archive: true };
    const resultat = calculerDevis(
      [ligneDepuisCatalogue({ id: 'l1', prestation: archive, quantiteMilli: 1000 })],
      { catalogue: [archive] },
    );
    expect(resultat.avertissements.map((a) => a.code)).toContain('PRESTATION_ARCHIVEE');
    expect(resultat.totalHtCents).toBe(8500);
  });
});

describe('margeIndicative', () => {
  it('ne calcule la marge que sur les lignes dont le cout est connu', () => {
    const resultat = calculerDevis([
      ligneDepuisCatalogue({ id: 'l1', prestation: priseSupplementaire, quantiteMilli: 4000 }),
      ligneDepuisCatalogue({ id: 'l2', prestation: mainOeuvre, quantiteMilli: 2000 }),
    ]);
    const liaisons = new Map([
      ['l1', 'p1'],
      ['l2', 'p2'],
    ]);
    const marge = margeIndicative(resultat.lignes, [priseSupplementaire, mainOeuvre], liaisons);
    // Seule l1 a un cout : 340,00 - 4 x 12,00 = 292,00
    expect(marge?.margeCents).toBe(34000 - 4800);
    // Couverture : 340,00 / 430,00 des lignes
    expect(marge?.couvertureBp).toBe(7907);
  });

  it('retourne null quand aucun cout n est renseigne, plutot qu un zero trompeur', () => {
    const resultat = calculerDevis([
      ligneDepuisCatalogue({ id: 'l2', prestation: mainOeuvre, quantiteMilli: 2000 }),
    ]);
    expect(margeIndicative(resultat.lignes, [mainOeuvre], new Map([['l2', 'p2']]))).toBeNull();
  });
});
