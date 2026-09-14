/**
 * Parcours metier complet, en mode demonstration :
 * appel -> analyse -> fiche chantier -> prestation proposee -> validation -> PDF.
 *
 * Et les cas qui doivent RATER proprement : devis incomplet non validable,
 * ambiguite de chantier, instruction glissee dans un appel.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  creerEntrepriseDeTest,
  db,
  demarrerServeur,
  entetes,
  nettoyerBase,
  type EntrepriseDeTest,
} from './aide.js';

let app: FastifyInstance;
let artisan: EntrepriseDeTest;

beforeAll(async () => {
  app = await demarrerServeur();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await nettoyerBase();
  artisan = await creerEntrepriseDeTest(app, { nom: 'NC Electricite (test)' });
  await app.inject({ method: 'POST', url: '/demo/preparer', headers: entetes(artisan) });
});

async function rejouer(scenarioId: string) {
  const reponse = await app.inject({
    method: 'POST',
    url: '/demo/rejouer',
    headers: entetes(artisan),
    payload: { scenarioId },
  });
  expect(reponse.statusCode, reponse.body).toBe(201);
  return reponse.json() as { estDemonstration: boolean; appel: { id: string } };
}

describe('mode demonstration', () => {
  it('annonce toujours qu il s agit d une demonstration', async () => {
    const liste = await app.inject({
      method: 'GET',
      url: '/demo/scenarios',
      headers: entetes(artisan),
    });
    const corps = liste.json() as { estDemonstration: boolean; avertissement: string };
    expect(corps.estDemonstration).toBe(true);
    expect(corps.avertissement).toContain('ne demontre pas');
  });

  it('refuse de rejouer un scenario en mode reel', async () => {
    await db.entreprise.update({ where: { id: artisan.entrepriseId }, data: { mode: 'REEL' } });
    const reponse = await app.inject({
      method: 'POST',
      url: '/demo/rejouer',
      headers: entetes(artisan),
      payload: { scenarioId: 'demo-1-nouvelles-prises' },
    });
    expect(reponse.statusCode).toBe(409);
  });

  it('marque les appels de demonstration comme tels', async () => {
    const { appel } = await rejouer('demo-1-nouvelles-prises');
    const enBase = await db.appel.findUniqueOrThrow({ where: { id: appel.id } });
    expect(enBase.estDemonstration).toBe(true);
  });
});

describe('analyse d un appel', () => {
  it('extrait la demande, les informations manquantes et le creneau propose', async () => {
    const { appel } = await rejouer('demo-1-nouvelles-prises');
    const detail = await app.inject({
      method: 'GET',
      url: `/appels/${appel.id}`,
      headers: entetes(artisan),
    });
    const corps = detail.json() as {
      appel: { statutTraitement: string; resume: string; analyse: { contenu: Record<string, unknown> } };
    };
    expect(corps.appel.statutTraitement).toBe('ANALYSE_TERMINEE');
    expect(corps.appel.resume).toContain('quatre prises');
    const analyse = corps.appel.analyse.contenu as {
      informationsManquantes: string[];
      elements: { valeurNumerique: number }[];
    };
    expect(analyse.elements[0]?.valeurNumerique).toBe(4);
    expect(analyse.informationsManquantes.length).toBeGreaterThan(0);
  });

  it('propose un rendez-vous en resolvant la date par le code, jamais par le modele', async () => {
    const { appel } = await rejouer('demo-1-nouvelles-prises');
    const rdv = await db.rendezVous.findFirstOrThrow({ where: { appelId: appel.id } });
    expect(rdv.statut).toBe('PROPOSE');
    expect(rdv.expressionEntendue).toBe('jeudi matin');
    expect(rdv.precision).toBe('creneau');
    // La date est calculee a partir de la date de l appel, pas inventee.
    expect(rdv.debutPropose.getTime()).toBeGreaterThan(Date.now() - 3 * 3600 * 1000);
  });

  it('conserve la correction quand l interlocuteur se reprend sur une date', async () => {
    const { appel } = await rejouer('demo-2-changement-rdv');
    const rdv = await db.rendezVous.findFirstOrThrow({ where: { appelId: appel.id } });
    expect(rdv.expressionEntendue).toBe('lundi apres-midi');
    expect(rdv.expressionAbandonnee).toBe('vendredi');
    expect(rdv.ambigu).toBe(true);
    expect(rdv.statut).toBe('PROPOSE');
    expect(rdv.explication).toContain('repris');
  });

  it('conserve la correction quand le client rectifie une quantite', async () => {
    const { appel } = await rejouer('demo-7-rectification-quantite');
    const analyse = await db.analyse.findFirstOrThrow({ where: { appelId: appel.id } });
    const contenu = analyse.contenu as unknown as {
      elements: { valeurNumerique: number; corrections: { valeurAbandonnee: string }[] }[];
    };
    expect(contenu.elements[0]?.valeurNumerique).toBe(8);
    expect(contenu.elements[0]?.corrections[0]?.valeurAbandonnee).toBe('six');
  });

  it('ne propose aucun budget quand aucun prix n a ete convenu', async () => {
    const { appel } = await rejouer('demo-4-urgence-sans-prix');
    const analyse = await db.analyse.findFirstOrThrow({ where: { appelId: appel.id } });
    const contenu = analyse.contenu as unknown as {
      budgetAnnonce: unknown;
      urgence: { niveau: string };
      informationsManquantes: string[];
    };
    expect(contenu.budgetAnnonce).toBeNull();
    expect(contenu.urgence.niveau).toBe('immediate');
    expect(contenu.informationsManquantes.join(' ')).toContain('aucun montant');
  });

  it('ne cree aucun rendez-vous a partir d une expression non resoluble', async () => {
    const { appel } = await rejouer('demo-3-demande-imprecise');
    expect(await db.rendezVous.count({ where: { appelId: appel.id } })).toBe(0);
  });

  it('remonte une instruction entendue sans jamais l executer', async () => {
    const { appel } = await rejouer('demo-8-numero-masque');
    const analyse = await db.analyse.findFirstOrThrow({ where: { appelId: appel.id } });
    const contenu = analyse.contenu as unknown as {
      instructionsDetecteesDansLAppel: { extraitSource: string }[];
    };
    expect(contenu.instructionsDetecteesDansLAppel).toHaveLength(1);
    // Rien n a ete envoye, rien n a ete valide : aucun devis n existe.
    expect(await db.devis.count({ where: { entrepriseId: artisan.entrepriseId } })).toBe(0);
    expect(analyse.avertissements.join(' ')).toContain('aucune action');

    const enBase = await db.appel.findUniqueOrThrow({ where: { id: appel.id } });
    expect(enBase.numeroMasque).toBe(true);
    expect(enBase.statutAssociation).toBe('AUCUN');
  });

  it('signale une transcription degradee au lieu de produire une fiche complete', async () => {
    const { appel } = await rejouer('demo-6-audio-degrade');
    const analyse = await db.analyse.findFirstOrThrow({ where: { appelId: appel.id } });
    const contenu = analyse.contenu as unknown as {
      qualiteAudio: string;
      natureTravaux: { statut: string };
    };
    expect(contenu.qualiteAudio).toBe('mauvaise');
    expect(contenu.natureTravaux.statut).toBe('a_confirmer');
  });
});

describe('ambiguite de chantier', () => {
  it('demande de choisir quand un client a plusieurs chantiers actifs', async () => {
    const client = await db.client.findFirstOrThrow({
      where: { entrepriseId: artisan.entrepriseId, telephones: { has: '+33639980012' } },
    });
    await db.chantier.create({
      data: {
        entrepriseId: artisan.entrepriseId,
        clientId: client.id,
        libelle: 'Appartement loue',
        adresse: 'rue de Brest, Dinan',
      },
    });

    const { appel } = await rejouer('demo-5-deuxieme-chantier');
    const enBase = await db.appel.findUniqueOrThrow({ where: { id: appel.id } });
    expect(enBase.clientId).toBe(client.id);
    expect(enBase.statutAssociation).toBe('A_CONFIRMER');
    expect(enBase.justificationAssociation).toContain('confirmer');
  });

  it('laisse corriger un rattachement, et ne le reecrase plus ensuite', async () => {
    const client = await db.client.findFirstOrThrow({
      where: { entrepriseId: artisan.entrepriseId, telephones: { has: '+33639980012' } },
    });
    const autre = await db.chantier.create({
      data: { entrepriseId: artisan.entrepriseId, clientId: client.id, libelle: 'Appartement loue' },
    });
    const { appel } = await rejouer('demo-5-deuxieme-chantier');

    const correction = await app.inject({
      method: 'PUT',
      url: `/appels/${appel.id}/association`,
      headers: entetes(artisan),
      payload: { clientId: client.id, chantierId: autre.id },
    });
    expect(correction.statusCode).toBe(200);

    const enBase = await db.appel.findUniqueOrThrow({ where: { id: appel.id } });
    expect(enBase.chantierId).toBe(autre.id);
    expect(enBase.statutAssociation).toBe('CORRIGE_MANUELLEMENT');
  });
});

describe('devis', () => {
  async function chantierDemo(): Promise<string> {
    const chantier = await db.chantier.findFirstOrThrow({
      where: { entrepriseId: artisan.entrepriseId },
    });
    return chantier.id;
  }

  it('chiffre a partir du catalogue et calcule TVA et TTC', async () => {
    const prestation = await db.prestation.findFirstOrThrow({
      where: { entrepriseId: artisan.entrepriseId, reference: 'DEMO-PC16' },
    });
    const reponse = await app.inject({
      method: 'POST',
      url: '/devis',
      headers: entetes(artisan),
      payload: {
        chantierId: await chantierDemo(),
        objet: '4 prises au garage',
        lignes: [
          {
            prestationId: prestation.id,
            libelle: prestation.libelle,
            unite: 'u',
            quantiteMilli: 4000,
            prixUnitaireCents: prestation.prixVenteCents,
            tvaRateBp: prestation.tvaRateBp,
            nature: 'forfait_pose',
            origine: 'catalogue',
          },
        ],
      },
    });
    expect(reponse.statusCode, reponse.body).toBe(201);
    const corps = reponse.json() as {
      devis: { statut: string; numero: string };
      calcul: { totalHtCents: number; totalTvaCents: number; totalTtcCents: number };
    };
    expect(corps.calcul.totalHtCents).toBe(34000);
    expect(corps.calcul.totalTvaCents).toBe(3400);
    expect(corps.calcul.totalTtcCents).toBe(37400);
    expect(corps.devis.statut).toBe('PRET_A_VERIFIER');
    expect(corps.devis.numero).toMatch(/^D\d{4}-\d{4}$/);
  });

  it('refuse de valider un devis dont un prix manque', async () => {
    const creation = await app.inject({
      method: 'POST',
      url: '/devis',
      headers: entetes(artisan),
      payload: {
        chantierId: await chantierDemo(),
        objet: 'Tableau a reprendre',
        lignes: [
          {
            libelle: 'Reprise du tableau electrique',
            unite: 'forfait',
            quantiteMilli: 1000,
            prixUnitaireCents: null,
            tvaRateBp: 1000,
            nature: 'forfait_pose',
            origine: 'proposition_analyse',
          },
        ],
      },
    });
    const { devis } = creation.json() as { devis: { id: string; statut: string } };
    expect(devis.statut).toBe('BROUILLON_INCOMPLET');

    const validation = await app.inject({
      method: 'POST',
      url: `/devis/${devis.id}/valider`,
      headers: entetes(artisan),
    });
    expect(validation.statusCode).toBe(409);
    expect(validation.json()).toMatchObject({ erreur: expect.stringContaining('incomplet') });
  });

  it('signale une main-d oeuvre en doublon d un forfait pose', async () => {
    const [forfait, mainOeuvre] = await Promise.all([
      db.prestation.findFirstOrThrow({ where: { entrepriseId: artisan.entrepriseId, reference: 'DEMO-PC16' } }),
      db.prestation.findFirstOrThrow({ where: { entrepriseId: artisan.entrepriseId, reference: 'DEMO-MO' } }),
    ]);
    const reponse = await app.inject({
      method: 'POST',
      url: '/devis',
      headers: entetes(artisan),
      payload: {
        chantierId: await chantierDemo(),
        objet: 'Prises + main-d oeuvre',
        lignes: [
          {
            prestationId: forfait.id,
            libelle: forfait.libelle,
            unite: 'u',
            quantiteMilli: 4000,
            prixUnitaireCents: forfait.prixVenteCents,
            tvaRateBp: forfait.tvaRateBp,
            nature: 'forfait_pose',
            origine: 'catalogue',
          },
          {
            prestationId: mainOeuvre.id,
            libelle: mainOeuvre.libelle,
            unite: 'h',
            quantiteMilli: 3000,
            prixUnitaireCents: mainOeuvre.prixVenteCents,
            tvaRateBp: mainOeuvre.tvaRateBp,
            nature: 'main_oeuvre',
            origine: 'catalogue',
          },
        ],
      },
    });
    const corps = reponse.json() as { calcul: { avertissements: { code: string }[] } };
    expect(corps.calcul.avertissements.map((a) => a.code)).toContain(
      'MAIN_OEUVRE_POTENTIELLEMENT_DOUBLEE',
    );
  });

  it('exporte un PDF marque brouillon tant que le devis n est pas valide', async () => {
    const prestation = await db.prestation.findFirstOrThrow({
      where: { entrepriseId: artisan.entrepriseId, reference: 'DEMO-SPOT' },
    });
    const creation = await app.inject({
      method: 'POST',
      url: '/devis',
      headers: entetes(artisan),
      payload: {
        chantierId: await chantierDemo(),
        objet: '8 spots au salon',
        lignes: [
          {
            prestationId: prestation.id,
            libelle: prestation.libelle,
            unite: 'u',
            quantiteMilli: 8000,
            prixUnitaireCents: prestation.prixVenteCents,
            tvaRateBp: prestation.tvaRateBp,
            nature: 'forfait_pose',
            origine: 'catalogue',
          },
        ],
      },
    });
    const { devis } = creation.json() as { devis: { id: string } };

    const brouillon = await app.inject({
      method: 'POST',
      url: `/devis/${devis.id}/pdf`,
      headers: entetes(artisan),
    });
    expect(brouillon.statusCode).toBe(200);
    expect(brouillon.headers['content-type']).toContain('application/pdf');
    expect(brouillon.headers['content-disposition']).toContain('brouillon');
    expect(brouillon.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    expect(
      (await db.devis.findUniqueOrThrow({ where: { id: devis.id } })).statut,
    ).toBe('PRET_A_VERIFIER');

    const validation = await app.inject({
      method: 'POST',
      url: `/devis/${devis.id}/valider`,
      headers: entetes(artisan),
    });
    expect(validation.statusCode).toBe(200);

    const definitif = await app.inject({
      method: 'POST',
      url: `/devis/${devis.id}/pdf`,
      headers: entetes(artisan),
    });
    expect(definitif.headers['content-disposition']).not.toContain('brouillon');
    expect((await db.devis.findUniqueOrThrow({ where: { id: devis.id } })).statut).toBe('EXPORTE');
  });
});

describe("ecran Aujourd'hui", () => {
  it('rassemble les demandes, rappels et rendez-vous', async () => {
    await rejouer('demo-1-nouvelles-prises');
    await rejouer('demo-4-urgence-sans-prix');
    const reponse = await app.inject({
      method: 'GET',
      url: '/aujourdhui',
      headers: entetes(artisan),
    });
    const corps = reponse.json() as {
      mode: string;
      telephonie: { etat: string; prochaineAction: string | null };
      nouvellesDemandes: unknown[];
      rappels: unknown[];
    };
    expect(corps.mode).toBe('DEMONSTRATION');
    // Aucun appel reel n a eu lieu : l etat telephonique ne dit jamais "connecte".
    expect(corps.telephonie.etat).not.toBe('TEST_REUSSI');
    expect(corps.telephonie.prochaineAction).not.toBeNull();
    expect(corps.nouvellesDemandes.length).toBeGreaterThan(0);
    expect(corps.rappels.length).toBeGreaterThan(0);
  });
});
