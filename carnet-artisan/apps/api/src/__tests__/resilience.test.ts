/**
 * Reprises apres echec, conservation et suppression des donnees.
 *
 * Fil directeur : un appel n'est jamais perdu. Il peut echouer, il reste
 * visible avec sa raison, et il est relancable.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  construireServicesTest,
  creerEntrepriseDeTest,
  db,
  demarrerServeur,
  entetes,
  nettoyerBase,
  type EntrepriseDeTest,
} from './aide.js';
import { boucleWorker } from '../jobs/worker.js';
import { purgerFichiersExpires, recupererEnregistrement } from '../jobs/traitements.js';
import { ErreurFournisseur } from '../adapters/telephony/types.js';

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
  artisan = await creerEntrepriseDeTest(app);
});

async function creerAppel(surcharges: Record<string, unknown> = {}) {
  return db.appel.create({
    data: {
      entrepriseId: artisan.entrepriseId,
      pbxCallId: `test-${String(Math.random()).slice(2)}`,
      direction: 'ENTRANT',
      numeroDistant: '+33639980012',
      debut: new Date(),
      dureeSecondes: 120,
      estEnregistre: true,
      statutTraitement: 'EN_ATTENTE_ENREGISTREMENT',
      ...surcharges,
    },
  });
}

describe('file de jobs', () => {
  it('empeche deux workers de prendre le meme job', async () => {
    const services = construireServicesTest();
    await services.file.empiler('purger_fichiers_expires', {});
    const premier = await services.file.prendre('worker-a');
    const second = await services.file.prendre('worker-b');
    expect(premier).not.toBeNull();
    expect(second).toBeNull();
  });

  it('n empile pas deux fois le meme travail', async () => {
    const services = construireServicesTest();
    const a = await services.file.empiler('analyser_appel', { appelId: 'x' }, { cleUnicite: 'analyse:x' });
    const b = await services.file.empiler('analyser_appel', { appelId: 'x' }, { cleUnicite: 'analyse:x' });
    expect(b.deja).toBe(true);
    expect(b.id).toBe(a.id);
    expect(await db.job.count({ where: { type: 'analyser_appel' } })).toBe(1);
  });

  it('replanifie avec un recul croissant, puis abandonne', async () => {
    const services = construireServicesTest();
    await services.file.empiler('purger_fichiers_expires', {}, { maxTentatives: 2 });

    const premier = await services.file.prendre('w');
    expect(await services.file.echouer(premier!, new Error('panne 1'))).toBe('replanifie');

    await db.job.updateMany({ data: { prochaineExecution: new Date(0) } });
    const second = await services.file.prendre('w');
    expect(await services.file.echouer(second!, new Error('panne 2'))).toBe('abandonne');

    const job = await db.job.findFirstOrThrow({});
    expect(job.statut).toBe('ECHEC_DEFINITIF');
    expect(job.derniereErreur).toBe('panne 2');
  });

  it('permet de relancer un job abandonne', async () => {
    const services = construireServicesTest();
    const { id } = await services.file.empiler('purger_fichiers_expires', {}, { maxTentatives: 1 });
    const job = await services.file.prendre('w');
    await services.file.echouer(job!, new Error('panne'));
    await services.file.relancer(id);
    const remis = await db.job.findUniqueOrThrow({ where: { id } });
    expect(remis.statut).toBe('EN_ATTENTE');
    expect(remis.tentatives).toBe(0);
  });
});

describe('echec du pipeline', () => {
  it('marque l appel en echec avec un message lisible, sans le supprimer', async () => {
    const appel = await creerAppel();
    const services = construireServicesTest({
      telephonie: {
        nom: 'panne',
        capacites: construireServicesTest().telephonie.capacites,
        creerSousCompte: () => Promise.reject(new ErreurFournisseur('indisponible')),
        recupererIdentifiants: () => Promise.reject(new ErreurFournisseur('indisponible')),
        configurerStandard: () => Promise.reject(new ErreurFournisseur('indisponible')),
        obtenirEnregistrement: () =>
          Promise.reject(new ErreurFournisseur('Zadarma injoignable sur /v1/pbx/record/request/')),
        supprimerEnregistrement: () => Promise.resolve(),
      },
    });
    await services.file.empiler(
      'recuperer_enregistrement',
      { appelId: appel.id },
      { entrepriseId: artisan.entrepriseId, maxTentatives: 1 },
    );

    await boucleWorker(services, { maxTours: 3 });

    const apres = await db.appel.findUniqueOrThrow({ where: { id: appel.id } });
    expect(apres.statutTraitement).toBe('ECHEC');
    expect(apres.erreurMessage).toContain('Recuperation de l enregistrement impossible');
    expect(apres.erreurMessage).toContain('Zadarma injoignable');
  });

  it('expose l appel en echec sur l ecran Aujourd hui', async () => {
    await creerAppel({ statutTraitement: 'ECHEC', erreurMessage: 'Transcription impossible : quota depasse.' });
    const reponse = await app.inject({ method: 'GET', url: '/aujourdhui', headers: entetes(artisan) });
    const corps = reponse.json() as { aRegler: { message: string; relancable: boolean }[] };
    expect(corps.aRegler).toHaveLength(1);
    expect(corps.aRegler[0]?.message).toContain('quota depasse');
    expect(corps.aRegler[0]?.relancable).toBe(true);
  });

  it('permet de relancer un appel en echec depuis l application', async () => {
    const appel = await creerAppel({ statutTraitement: 'ECHEC', erreurMessage: 'panne' });
    const reponse = await app.inject({
      method: 'POST',
      url: `/appels/${appel.id}/relancer`,
      headers: entetes(artisan),
    });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toMatchObject({ relance: true, etape: 'recuperer_enregistrement' });

    const apres = await db.appel.findUniqueOrThrow({ where: { id: appel.id } });
    expect(apres.erreurMessage).toBeNull();
    expect(await db.job.count({ where: { type: 'recuperer_enregistrement' } })).toBe(1);
  });

  it('refuse de relancer un appel sans enregistrement', async () => {
    const appel = await creerAppel({ estEnregistre: false, statutTraitement: 'SANS_ENREGISTREMENT' });
    const reponse = await app.inject({
      method: 'POST',
      url: `/appels/${appel.id}/relancer`,
      headers: entetes(artisan),
    });
    expect(reponse.statusCode).toBe(409);
  });

  it('echoue clairement quand aucun identifiant fournisseur n est enregistre', async () => {
    await db.configTelephonie.update({
      where: { entrepriseId: artisan.entrepriseId },
      data: { cleApiChiffree: null, secretApiChiffre: null, identifiantFournisseur: null },
    });
    const appel = await creerAppel();
    const services = construireServicesTest();
    await expect(recupererEnregistrement(services, { appelId: appel.id })).rejects.toThrow(
      /Aucun identifiant fournisseur/,
    );
  });
});

describe('conservation des fichiers', () => {
  it('supprime les fichiers arrives a echeance et garde la trace de la suppression', async () => {
    const services = construireServicesTest();
    const appel = await creerAppel();
    const fichier = await services.stockage.ecrire(
      artisan.entrepriseId,
      'audio',
      'test.mp3',
      Buffer.from('audio'),
    );
    await db.fichierAudio.create({
      data: {
        entrepriseId: artisan.entrepriseId,
        appelId: appel.id,
        chemin: fichier.chemin,
        tailleOctets: fichier.tailleOctets,
        typeMime: 'audio/mpeg',
        expireA: new Date(Date.now() - 1000),
      },
    });

    const supprimes = await purgerFichiersExpires(services);
    expect(supprimes).toBe(1);

    const enBase = await db.fichierAudio.findFirstOrThrow({ where: { appelId: appel.id } });
    expect(enBase.supprimeA).not.toBeNull();
    await expect(services.stockage.lire(fichier.chemin)).rejects.toThrow();
    // L appel lui-meme reste consultable.
    expect(await db.appel.findUnique({ where: { id: appel.id } })).not.toBeNull();
  });

  it('ne touche pas aux fichiers encore dans leur duree de conservation', async () => {
    const services = construireServicesTest();
    const appel = await creerAppel();
    const fichier = await services.stockage.ecrire(
      artisan.entrepriseId,
      'audio',
      'test.mp3',
      Buffer.from('audio'),
    );
    await db.fichierAudio.create({
      data: {
        entrepriseId: artisan.entrepriseId,
        appelId: appel.id,
        chemin: fichier.chemin,
        tailleOctets: fichier.tailleOctets,
        typeMime: 'audio/mpeg',
        expireA: new Date(Date.now() + 86_400_000),
      },
    });
    expect(await purgerFichiersExpires(services)).toBe(0);
    expect((await services.stockage.lire(fichier.chemin)).toString()).toBe('audio');
  });
});

describe('suppression et export des donnees', () => {
  it('exporte les donnees sans divulguer le jeton de webhook', async () => {
    const reponse = await app.inject({
      method: 'GET',
      url: '/parametres/export',
      headers: entetes(artisan),
    });
    expect(reponse.statusCode).toBe(200);
    const corps = reponse.json() as { entreprise: { jetonWebhook: string } };
    expect(corps.entreprise.jetonWebhook).toBe('[retire de l export]');
  });

  it('exige une confirmation explicite avant de supprimer', async () => {
    const reponse = await app.inject({
      method: 'DELETE',
      url: '/parametres/donnees',
      headers: entetes(artisan),
      payload: {},
    });
    expect(reponse.statusCode).toBe(400);
    expect(await db.entreprise.count({ where: { id: artisan.entrepriseId } })).toBe(1);
  });

  it('supprime les fichiers ET les lignes en base', async () => {
    const services = construireServicesTest();
    const appel = await creerAppel();
    const fichier = await services.stockage.ecrire(
      artisan.entrepriseId,
      'audio',
      'test.mp3',
      Buffer.from('audio'),
    );
    await db.fichierAudio.create({
      data: {
        entrepriseId: artisan.entrepriseId,
        appelId: appel.id,
        chemin: fichier.chemin,
        tailleOctets: fichier.tailleOctets,
        typeMime: 'audio/mpeg',
        expireA: new Date(Date.now() + 86_400_000),
      },
    });

    const reponse = await app.inject({
      method: 'DELETE',
      url: '/parametres/donnees',
      headers: entetes(artisan),
      payload: { confirmation: 'SUPPRIMER' },
    });
    expect(reponse.statusCode).toBe(200);

    expect(await db.entreprise.count({ where: { id: artisan.entrepriseId } })).toBe(0);
    expect(await db.appel.count({ where: { entrepriseId: artisan.entrepriseId } })).toBe(0);
    expect(await db.analyse.count({ where: { entrepriseId: artisan.entrepriseId } })).toBe(0);
    await expect(services.stockage.lire(fichier.chemin)).rejects.toThrow();
  });
});

describe('etat de la telephonie', () => {
  it('n affiche jamais "connecte" sur la seule presence d une cle', async () => {
    const reponse = await app.inject({
      method: 'PUT',
      url: '/parametres/telephonie/identifiants',
      headers: entetes(artisan),
      payload: {
        identifiantFournisseur: '12345',
        cleApi: 'cle-de-test',
        secretApi: 'secret-de-test',
        numeroTechnique: '+33299887766',
        extensionPbx: '100',
      },
    });
    expect(reponse.statusCode).toBe(200);
    const corps = reponse.json() as { telephonie: { etat: string; detail: string } };
    expect(corps.telephonie.etat).toBe('EN_ATTENTE_RENVOI_OPERATEUR');
    expect(corps.telephonie.detail).toContain('ne prouve pas');
  });

  it('refuse un renvoi qui bouclerait sur le numero technique', async () => {
    await app.inject({
      method: 'PUT',
      url: '/parametres/telephonie/identifiants',
      headers: entetes(artisan),
      payload: {
        identifiantFournisseur: '12345',
        cleApi: 'cle',
        secretApi: 'secret',
        numeroTechnique: '+33299887766',
        extensionPbx: '100',
      },
    });
    const reponse = await app.inject({
      method: 'PUT',
      url: '/parametres/telephonie/renvoi',
      headers: entetes(artisan),
      // Meme numero ecrit autrement : la normalisation doit quand meme voir la boucle.
      payload: { numeroPersonnel: '0299887766', confirme: true },
    });
    expect(reponse.statusCode).toBe(400);
    expect((reponse.json() as { erreur: string }).erreur).toContain('boucle');
  });

  it('ne passe a TEST_REUSSI qu apres un appel reel analyse de bout en bout', async () => {
    const avant = await app.inject({
      method: 'GET',
      url: '/parametres/telephonie/verification',
      headers: entetes(artisan),
    });
    expect((avant.json() as { telephonie: { etat: string } }).telephonie.etat).not.toBe('TEST_REUSSI');

    // Un appel de DEMONSTRATION ne compte pas.
    await creerAppel({ statutTraitement: 'ANALYSE_TERMINEE', estDemonstration: true });
    const apresDemo = await app.inject({
      method: 'GET',
      url: '/parametres/telephonie/verification',
      headers: entetes(artisan),
    });
    expect((apresDemo.json() as { telephonie: { etat: string } }).telephonie.etat).not.toBe(
      'TEST_REUSSI',
    );

    // Un appel reel analyse jusqu au bout, si.
    await creerAppel({ statutTraitement: 'ANALYSE_TERMINEE', estDemonstration: false });
    const apresReel = await app.inject({
      method: 'GET',
      url: '/parametres/telephonie/verification',
      headers: entetes(artisan),
    });
    const corps = apresReel.json() as { telephonie: { etat: string }; appelDeTest: unknown };
    expect(corps.telephonie.etat).toBe('TEST_REUSSI');
    expect(corps.appelDeTest).not.toBeNull();
  });

  it('ne renvoie jamais la cle API en clair', async () => {
    await app.inject({
      method: 'PUT',
      url: '/parametres/telephonie/identifiants',
      headers: entetes(artisan),
      payload: {
        identifiantFournisseur: '12345',
        cleApi: 'cle-tres-secrete-123456',
        secretApi: 'secret-tres-secret',
        extensionPbx: '100',
      },
    });
    const reponse = await app.inject({
      method: 'GET',
      url: '/parametres',
      headers: entetes(artisan),
    });
    expect(reponse.body).not.toContain('cle-tres-secrete-123456');
    expect(reponse.body).not.toContain('secret-tres-secret');
    const corps = reponse.json() as { telephonie: { cleApiEnregistree: string } };
    expect(corps.telephonie.cleApiEnregistree).toMatch(/^cle-.*3456$/);
  });
});
