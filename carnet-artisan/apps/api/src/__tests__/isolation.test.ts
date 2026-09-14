/**
 * Isolation entre entreprises.
 *
 * Le scenario est toujours le meme : deux artisans, chacun ses donnees, et on
 * verifie que le second ne peut atteindre aucune ressource du premier, meme en
 * connaissant son identifiant exact.
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
let alice: EntrepriseDeTest;
let bob: EntrepriseDeTest;

beforeAll(async () => {
  app = await demarrerServeur();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await nettoyerBase();
  alice = await creerEntrepriseDeTest(app, { nom: 'Electricite Alice' });
  bob = await creerEntrepriseDeTest(app, { nom: 'Plomberie Bob' });
});

async function creerJeuDeDonnees(proprietaire: EntrepriseDeTest) {
  const client = await db.client.create({
    data: { entrepriseId: proprietaire.entrepriseId, nom: 'Client prive', telephones: ['+33296001122'] },
  });
  const chantier = await db.chantier.create({
    data: {
      entrepriseId: proprietaire.entrepriseId,
      clientId: client.id,
      libelle: 'Chantier prive',
      adresse: '1 rue Secrete',
    },
  });
  const appel = await db.appel.create({
    data: {
      entrepriseId: proprietaire.entrepriseId,
      pbxCallId: `prive-${proprietaire.entrepriseId}`,
      direction: 'ENTRANT',
      numeroDistant: '+33296001122',
      debut: new Date(),
      statutTraitement: 'ANALYSE_TERMINEE',
      clientId: client.id,
      chantierId: chantier.id,
    },
  });
  const prestation = await db.prestation.create({
    data: {
      entrepriseId: proprietaire.entrepriseId,
      reference: 'PRIVE-1',
      libelle: 'Prestation privee',
      unite: 'u',
      prixVenteCents: 10000,
      nature: 'FORFAIT_POSE',
      tvaRateBp: 1000,
    },
  });
  const devis = await db.devis.create({
    data: {
      entrepriseId: proprietaire.entrepriseId,
      chantierId: chantier.id,
      numero: 'D2026-0001',
      objet: 'Devis prive',
    },
  });
  return { client, chantier, appel, prestation, devis };
}

describe('lecture croisee', () => {
  it('ne montre que ses propres clients', async () => {
    await creerJeuDeDonnees(alice);
    const reponse = await app.inject({ method: 'GET', url: '/clients', headers: entetes(bob) });
    expect(reponse.statusCode).toBe(200);
    expect((reponse.json() as { clients: unknown[] }).clients).toHaveLength(0);
  });

  it('ne montre que ses propres appels', async () => {
    await creerJeuDeDonnees(alice);
    const reponse = await app.inject({ method: 'GET', url: '/appels', headers: entetes(bob) });
    expect((reponse.json() as { appels: unknown[] }).appels).toHaveLength(0);
  });

  it('ne montre que son propre catalogue', async () => {
    await creerJeuDeDonnees(alice);
    const reponse = await app.inject({ method: 'GET', url: '/catalogue', headers: entetes(bob) });
    expect((reponse.json() as { prestations: unknown[] }).prestations).toHaveLength(0);
  });

  it('ne montre que ses propres devis', async () => {
    await creerJeuDeDonnees(alice);
    const reponse = await app.inject({ method: 'GET', url: '/devis', headers: entetes(bob) });
    expect((reponse.json() as { devis: unknown[] }).devis).toHaveLength(0);
  });
});

describe('acces direct par identifiant', () => {
  it('renvoie 404 sur un appel d une autre entreprise', async () => {
    const donnees = await creerJeuDeDonnees(alice);
    const reponse = await app.inject({
      method: 'GET',
      url: `/appels/${donnees.appel.id}`,
      headers: entetes(bob),
    });
    expect(reponse.statusCode).toBe(404);
  });

  it('renvoie 404 sur un chantier d une autre entreprise', async () => {
    const donnees = await creerJeuDeDonnees(alice);
    const reponse = await app.inject({
      method: 'GET',
      url: `/chantiers/${donnees.chantier.id}`,
      headers: entetes(bob),
    });
    expect(reponse.statusCode).toBe(404);
  });

  it('renvoie 404 sur un devis d une autre entreprise', async () => {
    const donnees = await creerJeuDeDonnees(alice);
    const reponse = await app.inject({
      method: 'GET',
      url: `/devis/${donnees.devis.id}`,
      headers: entetes(bob),
    });
    expect(reponse.statusCode).toBe(404);
  });

  it('refuse d exporter le PDF d un devis d une autre entreprise', async () => {
    const donnees = await creerJeuDeDonnees(alice);
    const reponse = await app.inject({
      method: 'POST',
      url: `/devis/${donnees.devis.id}/pdf`,
      headers: entetes(bob),
    });
    expect(reponse.statusCode).toBe(404);
  });
});

describe('ecriture croisee', () => {
  it('refuse de rattacher un appel au chantier d une autre entreprise', async () => {
    const chezAlice = await creerJeuDeDonnees(alice);
    const chezBob = await creerJeuDeDonnees(bob);
    const reponse = await app.inject({
      method: 'PUT',
      url: `/appels/${chezBob.appel.id}/association`,
      headers: entetes(bob),
      payload: { clientId: chezAlice.client.id, chantierId: chezAlice.chantier.id },
    });
    expect(reponse.statusCode).toBe(404);

    const appel = await db.appel.findUniqueOrThrow({ where: { id: chezBob.appel.id } });
    expect(appel.chantierId).toBe(chezBob.chantier.id);
  });

  it('refuse de creer un chantier sous le client d une autre entreprise', async () => {
    const chezAlice = await creerJeuDeDonnees(alice);
    const reponse = await app.inject({
      method: 'POST',
      url: '/chantiers',
      headers: entetes(bob),
      payload: { clientId: chezAlice.client.id, libelle: 'Tentative' },
    });
    expect(reponse.statusCode).toBe(404);
    // Rien n a ete cree chez Bob non plus : la tentative n a aucun effet de bord.
    expect(await db.chantier.count({ where: { entrepriseId: bob.entrepriseId } })).toBe(0);
  });

  it('refuse de creer un devis sur le chantier d une autre entreprise', async () => {
    const chezAlice = await creerJeuDeDonnees(alice);
    const reponse = await app.inject({
      method: 'POST',
      url: '/devis',
      headers: entetes(bob),
      payload: { chantierId: chezAlice.chantier.id, objet: 'Tentative', lignes: [] },
    });
    expect(reponse.statusCode).toBe(404);
  });

  it('refuse d archiver une prestation d une autre entreprise', async () => {
    const chezAlice = await creerJeuDeDonnees(alice);
    const reponse = await app.inject({
      method: 'PUT',
      url: `/catalogue/${chezAlice.prestation.id}/archivage`,
      headers: entetes(bob),
      payload: { archive: true },
    });
    expect(reponse.statusCode).toBe(404);
    const prestation = await db.prestation.findUniqueOrThrow({ where: { id: chezAlice.prestation.id } });
    expect(prestation.archive).toBe(false);
  });

  it('refuse de relancer l analyse d un appel d une autre entreprise', async () => {
    const chezAlice = await creerJeuDeDonnees(alice);
    const reponse = await app.inject({
      method: 'POST',
      url: `/appels/${chezAlice.appel.id}/relancer`,
      headers: entetes(bob),
    });
    expect(reponse.statusCode).toBe(404);
  });
});

describe('references uniques par entreprise', () => {
  it('autorise deux entreprises a utiliser la meme reference de catalogue', async () => {
    const creer = (proprietaire: EntrepriseDeTest) =>
      app.inject({
        method: 'POST',
        url: '/catalogue',
        headers: entetes(proprietaire),
        payload: {
          reference: 'PC16',
          libelle: 'Prise 16 A',
          unite: 'u',
          prixVenteCents: 8500,
          nature: 'forfait_pose',
          tvaRateBp: 1000,
        },
      });
    expect((await creer(alice)).statusCode).toBe(201);
    expect((await creer(bob)).statusCode).toBe(201);
    // Mais pas deux fois dans la meme entreprise.
    expect((await creer(alice)).statusCode).toBe(409);
  });
});

describe('authentification', () => {
  it('refuse une requete sans jeton', async () => {
    expect((await app.inject({ method: 'GET', url: '/clients' })).statusCode).toBe(401);
  });

  it('refuse un jeton falsifie', async () => {
    const reponse = await app.inject({
      method: 'GET',
      url: '/clients',
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.signature-bidon' },
    });
    expect(reponse.statusCode).toBe(401);
  });

  it('ne revele pas si un email a un compte', async () => {
    const inconnu = await app.inject({
      method: 'POST',
      url: '/auth/connexion',
      payload: { email: 'personne@exemple.test', motDePasse: 'motdepasse-de-test' },
    });
    const mauvaisMotDePasse = await app.inject({
      method: 'POST',
      url: '/auth/connexion',
      payload: { email: alice.email, motDePasse: 'mauvais-mot-de-passe' },
    });
    expect(inconnu.statusCode).toBe(401);
    expect(mauvaisMotDePasse.statusCode).toBe(401);
    expect(inconnu.json()).toEqual(mauvaisMotDePasse.json());
  });
});
