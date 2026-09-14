/**
 * Rattachement client / chantier.
 *
 * Le point sensible : un numero de telephone identifie un client, pas un
 * chantier. Le module doit demander plutot que deviner.
 */

import { describe, expect, it } from 'vitest';
import {
  adressesConcordent,
  normaliserNumero,
  proposerAssociation,
  type ChantierConnu,
  type ClientConnu,
} from '../domaine/association.js';
import { analyserCsvCatalogue } from '../routes/catalogue.js';

const leGall: ClientConnu = {
  id: 'c1',
  nom: 'Madame Le Gall',
  telephones: ['+33639980012'],
};

const garage: ChantierConnu = {
  id: 'ch1',
  clientId: 'c1',
  libelle: 'Garage - atelier',
  adresse: '12 rue des Lilas, Dinan',
  actif: true,
};

const appartement: ChantierConnu = {
  id: 'ch2',
  clientId: 'c1',
  libelle: 'Appartement loue',
  adresse: '4 rue de Brest, Dinan',
  actif: true,
};

function contexte(surcharges: Partial<Parameters<typeof proposerAssociation>[0]> = {}) {
  return proposerAssociation({
    numeroDistant: '+33639980012',
    numeroMasque: false,
    adresseEntendue: null,
    clients: [leGall],
    chantiers: [garage],
    ...surcharges,
  });
}

describe('normaliserNumero', () => {
  it('ramene les formats francais a une ecriture unique', () => {
    const attendu = '0639980012';
    for (const forme of ['+33639980012', '0033639980012', '33639980012', '06 39 98 00 12', '06.39.98.00.12']) {
      expect(normaliserNumero(forme), forme).toBe(attendu);
    }
  });
});

describe('proposerAssociation', () => {
  it('rattache avec certitude un client a chantier unique', () => {
    const p = contexte();
    expect(p).toMatchObject({ clientId: 'c1', chantierId: 'ch1', statut: 'CERTAIN' });
  });

  it('ne rattache rien sur un numero masque', () => {
    const p = contexte({ numeroMasque: true, numeroDistant: null });
    expect(p.statut).toBe('AUCUN');
    expect(p.clientId).toBeNull();
    expect(p.justification).toContain('Numero masque');
  });

  it('ne rattache rien sur un numero inconnu', () => {
    const p = contexte({ numeroDistant: '+33600000000' });
    expect(p.statut).toBe('AUCUN');
    expect(p.justification).toContain('Aucun client connu');
  });

  it('demande de choisir quand un client a plusieurs chantiers actifs', () => {
    const p = contexte({ chantiers: [garage, appartement] });
    expect(p.clientId).toBe('c1');
    expect(p.chantierId).toBeNull();
    expect(p.statut).toBe('A_CONFIRMER');
    expect(p.alternatives).toHaveLength(2);
  });

  it('privilegie le chantier dont l adresse a ete entendue, tout en demandant confirmation', () => {
    const p = contexte({
      chantiers: [garage, appartement],
      adresseEntendue: "c'est pour l appartement rue de Brest",
    });
    expect(p.chantierId).toBe('ch2');
    expect(p.statut).toBe('A_CONFIRMER');
    expect(p.alternatives.map((a) => a.chantierId)).toEqual(['ch1']);
  });

  it('ignore les chantiers archives', () => {
    const p = contexte({ chantiers: [{ ...garage, actif: false }] });
    expect(p.chantierId).toBeNull();
    expect(p.statut).toBe('A_CONFIRMER');
    expect(p.justification).toContain('Aucun chantier actif');
  });

  it('signale deux fiches clients partageant le meme numero', () => {
    const doublon: ClientConnu = { id: 'c2', nom: 'M. Le Gall', telephones: ['0639980012'] };
    const p = contexte({ clients: [leGall, doublon] });
    expect(p.statut).toBe('A_CONFIRMER');
    expect(p.clientId).toBeNull();
    expect(p.alternatives).toHaveLength(2);
  });

  it('reconnait un numero enregistre dans un autre format', () => {
    const p = contexte({ clients: [{ ...leGall, telephones: ['06 39 98 00 12'] }] });
    expect(p.statut).toBe('CERTAIN');
  });
});

describe('adressesConcordent', () => {
  it('reconnait une rue commune', () => {
    expect(adressesConcordent(appartement, 'il faut aller rue de Brest')).toBe(true);
  });

  it('ne fait pas correspondre deux adresses qui n ont que des mots outils en commun', () => {
    // "rue" et "de" ne suffisent pas : sinon toutes les adresses se valent.
    expect(adressesConcordent(appartement, 'la rue de la gare')).toBe(false);
  });

  it('ignore les accents et la casse', () => {
    expect(adressesConcordent({ ...appartement, adresse: '4 rue de Brest' }, 'RUE DE BREST')).toBe(true);
  });

  it('retourne faux sur une adresse vide', () => {
    expect(adressesConcordent({ ...appartement, adresse: null, libelle: '' }, 'rue de Brest')).toBe(false);
  });
});

describe('apercu d import CSV du catalogue', () => {
  it('valide des lignes correctes', () => {
    const csv = [
      'reference;libelle;unite;prix_vente;tva;nature',
      'PC16;Prise 16 A posee;u;85,00;10;forfait_pose',
      'MO;Main-d oeuvre;h;45,00;10;main_oeuvre',
    ].join('\n');
    const apercu = analyserCsvCatalogue(csv);
    expect(apercu.entetesManquants).toHaveLength(0);
    expect(apercu.lignes).toHaveLength(2);
    expect(apercu.lignes.every((l) => l.valide)).toBe(true);
    expect(apercu.lignes[0]?.prestation?.prixVenteCents).toBe(8500);
    expect(apercu.lignes[0]?.prestation?.tvaRateBp).toBe(1000);
  });

  it('accepte aussi la virgule comme separateur de colonnes', () => {
    const csv = 'reference,libelle,unite,prix_vente,tva,nature\nPC16,Prise,u,85.00,20,fourniture_seule';
    const apercu = analyserCsvCatalogue(csv);
    expect(apercu.lignes[0]?.valide).toBe(true);
    expect(apercu.lignes[0]?.prestation?.tvaRateBp).toBe(2000);
  });

  it('signale une ligne illisible sans jamais deviner un prix', () => {
    const csv = [
      'reference;libelle;unite;prix_vente;tva;nature',
      'X1;Prestation;u;a voir;10;forfait_pose',
    ].join('\n');
    const apercu = analyserCsvCatalogue(csv);
    expect(apercu.lignes[0]?.valide).toBe(false);
    expect(apercu.lignes[0]?.erreurs.join(' ')).toContain('Prix de vente illisible');
    expect(apercu.lignes[0]?.prestation).toBeUndefined();
  });

  it('signale les colonnes manquantes', () => {
    const apercu = analyserCsvCatalogue('reference;libelle\nX1;Prestation');
    expect(apercu.entetesManquants).toContain('prix_vente');
  });

  it('signale une unite ou une nature inconnue', () => {
    const csv = [
      'reference;libelle;unite;prix_vente;tva;nature',
      'X1;Prestation;douzaine;10,00;20;bidon',
    ].join('\n');
    const erreurs = analyserCsvCatalogue(csv).lignes[0]?.erreurs.join(' ') ?? '';
    expect(erreurs).toContain('Unite inconnue');
    expect(erreurs).toContain('Nature inconnue');
  });
});
