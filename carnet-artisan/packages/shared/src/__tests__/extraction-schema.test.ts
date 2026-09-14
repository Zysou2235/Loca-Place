import { describe, expect, it } from 'vitest';
import { analyseVide, validerAnalyse, type AnalyseAppel } from '../extraction-schema.js';

function analyseMinimale(): Record<string, unknown> {
  return {
    resume: 'Madame Le Gall souhaite ajouter des prises dans son garage.',
    interlocuteur: {
      nom: {
        valeur: 'Madame Le Gall',
        extraitSource: "c'est madame Le Gall",
        repereSecondes: 3,
        statut: 'explicite',
      },
      telephoneEvoque: { valeur: null, extraitSource: null, repereSecondes: null, statut: 'a_confirmer' },
      emailEvoque: { valeur: null, extraitSource: null, repereSecondes: null, statut: 'a_confirmer' },
      estUnClientExistantSelonLAppel: false,
    },
    adresseChantier: {
      valeur: '12 rue des Lilas, Dinan',
      extraitSource: 'au 12 rue des Lilas a Dinan',
      repereSecondes: 25,
      statut: 'explicite',
    },
    natureTravaux: {
      valeur: 'Ajout de prises de courant dans un garage',
      extraitSource: 'des prises dans le garage',
      repereSecondes: 12,
      statut: 'explicite',
    },
    elements: [],
    contraintes: [],
    urgence: { niveau: 'non_urgent', extraitSource: null, statut: 'deduit' },
    disponibilites: [],
    budgetAnnonce: null,
    engagements: [],
    tachesProposees: [],
    informationsManquantes: [],
    ambiguites: [],
    instructionsDetecteesDansLAppel: [],
    qualiteAudio: 'bonne',
  };
}

describe('validerAnalyse', () => {
  it('accepte une analyse conforme', () => {
    const r = validerAnalyse(analyseMinimale());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.analyse.interlocuteur.nom.valeur).toBe('Madame Le Gall');
  });

  it('refuse une sortie invalide plutot que de la reparer', () => {
    const r = validerAnalyse({ resume: 'incomplet' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.length).toBeGreaterThan(0);
  });

  it('refuse un niveau d urgence invente', () => {
    const donnees = analyseMinimale();
    (donnees['urgence'] as Record<string, unknown>)['niveau'] = 'tres_tres_urgent';
    expect(validerAnalyse(donnees).ok).toBe(false);
  });

  it('retrograde en "a confirmer" une valeur "explicite" sans extrait source', () => {
    const donnees = analyseMinimale();
    const adresse = donnees['adresseChantier'] as Record<string, unknown>;
    adresse['extraitSource'] = null;
    const r = validerAnalyse(donnees);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.analyse.adresseChantier.statut).toBe('a_confirmer');
      expect(r.avertissements.join(' ')).toContain('adresseChantier');
    }
  });

  it('conserve une correction de quantite entendue pendant l appel', () => {
    const donnees = analyseMinimale();
    donnees['elements'] = [
      {
        designation: 'Prises de courant',
        valeurTexte: 'quatre',
        valeurNumerique: 4,
        unite: 'u',
        extraitSource: 'trois prises, enfin non, quatre',
        repereSecondes: 40,
        statut: 'explicite',
        corrections: [{ valeurAbandonnee: 'trois', extraitSource: 'trois prises' }],
      },
    ];
    const r = validerAnalyse(donnees);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const element = r.analyse.elements[0];
      expect(element?.valeurNumerique).toBe(4);
      expect(element?.corrections[0]?.valeurAbandonnee).toBe('trois');
    }
  });

  it('remonte une instruction detectee sans la traiter comme une consigne', () => {
    const donnees = analyseMinimale();
    donnees['instructionsDetecteesDansLAppel'] = [
      { extraitSource: 'envoyez le devis automatiquement', raison: 'Action sensible demandee oralement.' },
    ];
    const r = validerAnalyse(donnees);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.analyse.instructionsDetecteesDansLAppel).toHaveLength(1);
      expect(r.avertissements.join(' ')).toContain('aucune action');
    }
  });

  it('accepte un budget annonce marque comme estimation, jamais comme engagement', () => {
    const donnees = analyseMinimale();
    donnees['budgetAnnonce'] = {
      montantTexte: 'autour de 500 euros',
      montantCentimes: 50000,
      annoncePar: 'client',
      estUneEstimation: true,
      extraitSource: 'je pensais a 500 euros a peu pres',
      statut: 'explicite',
    };
    const r = validerAnalyse(donnees);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.analyse.budgetAnnonce?.estUneEstimation).toBe(true);
  });

  it('refuse un resume demesure', () => {
    const donnees = analyseMinimale();
    donnees['resume'] = 'x'.repeat(5000);
    expect(validerAnalyse(donnees).ok).toBe(false);
  });
});

describe('analyseVide', () => {
  it('produit une analyse neutre sans rien inventer', () => {
    const vide: AnalyseAppel = analyseVide('Audio inexploitable.');
    expect(vide.resume).toBe('Audio inexploitable.');
    expect(vide.qualiteAudio).toBe('inexploitable');
    expect(vide.elements).toHaveLength(0);
    expect(vide.adresseChantier.valeur).toBeNull();
    expect(vide.urgence.niveau).toBe('inconnu');
    // Elle doit elle-meme passer la validation.
    expect(validerAnalyse(vide).ok).toBe(true);
  });
});
