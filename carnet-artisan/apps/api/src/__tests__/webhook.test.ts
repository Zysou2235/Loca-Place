/**
 * Route de webhook : authentification, idempotence, ordre des evenements.
 *
 * C'est la seule porte publique qui ecrit en base. On verifie qu'elle ne
 * s'ouvre que sur une signature valide produite avec le secret de LA BONNE
 * entreprise, et qu'un rejeu ne cree pas de doublon.
 */

import { createHmac } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chaineSigneeWebhook } from '@carnet/shared';
import {
  construireServicesTest,
  creerEntrepriseDeTest,
  db,
  demarrerServeur,
  nettoyerBase,
  type EntrepriseDeTest,
} from './aide.js';
import { executerJob } from '../jobs/traitements.js';

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
  alice = await creerEntrepriseDeTest(app, { secretFournisseur: 'secret-alice' });
  bob = await creerEntrepriseDeTest(app, { secretFournisseur: 'secret-bob' });
});

function signer(corps: Record<string, unknown>, secret: string): string {
  return createHmac('sha1', secret).update(chaineSigneeWebhook(corps) ?? '').digest('base64');
}

function evenementFin(pbxCallId = 'in_test_1'): Record<string, unknown> {
  return {
    event: 'NOTIFY_END',
    pbx_call_id: pbxCallId,
    caller_id: '+33639980012',
    called_did: '+33296001000',
    internal: '100',
    call_start: '2026-03-18 10:00:00',
    duration: '187',
    disposition: 'answered',
    status_code: '200',
    is_recorded: '1',
    call_id_with_rec: 'rec_test_1',
  };
}

async function poster(
  cible: EntrepriseDeTest,
  corps: Record<string, unknown>,
  signature: string | undefined,
) {
  return app.inject({
    method: 'POST',
    url: `/webhooks/telephonie/${cible.jetonWebhook}`,
    headers: signature === undefined ? {} : { signature },
    payload: corps,
  });
}

describe('authentification du webhook', () => {
  it('accepte un evenement correctement signe', async () => {
    const corps = evenementFin();
    const reponse = await poster(alice, corps, signer(corps, 'secret-alice'));
    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual({ recu: true, doublon: false });
    expect(await db.evenementTelephonie.count({ where: { entrepriseId: alice.entrepriseId } })).toBe(1);
  });

  it('REFUSE un evenement sans en-tete Signature', async () => {
    const reponse = await poster(alice, evenementFin(), undefined);
    expect(reponse.statusCode).toBe(401);
    expect(await db.evenementTelephonie.count()).toBe(0);
  });

  it('refuse une signature invalide', async () => {
    const reponse = await poster(alice, evenementFin(), 'c2lnbmF0dXJlLWJpZG9u');
    expect(reponse.statusCode).toBe(401);
    expect(await db.evenementTelephonie.count()).toBe(0);
  });

  it('refuse un evenement signe avec le secret d une AUTRE entreprise', async () => {
    // Le coeur du cloisonnement : connaitre le jeton d URL d Alice ne suffit
    // pas, il faut aussi son secret fournisseur.
    const corps = evenementFin();
    const reponse = await poster(alice, corps, signer(corps, 'secret-bob'));
    expect(reponse.statusCode).toBe(401);
    expect(await db.evenementTelephonie.count()).toBe(0);
  });

  it('refuse un jeton de webhook inconnu, sans reveler qu il n existe pas', async () => {
    const corps = evenementFin();
    const reponse = await app.inject({
      method: 'POST',
      url: '/webhooks/telephonie/00000000-0000-0000-0000-000000000000',
      headers: { signature: signer(corps, 'secret-alice') },
      payload: corps,
    });
    expect(reponse.statusCode).toBe(401);
    expect(reponse.json()).toEqual({ erreur: 'Evenement refuse.' });
  });

  it('refuse un evenement dont un champ signe a ete modifie', async () => {
    const corps = evenementFin();
    const signature = signer(corps, 'secret-alice');
    const reponse = await poster(alice, { ...corps, caller_id: '+33600000000' }, signature);
    expect(reponse.statusCode).toBe(401);
  });

  it('refuse un type d evenement inconnu', async () => {
    const corps = { event: 'NOTIFY_INVENTE', pbx_call_id: 'x' };
    const reponse = await poster(alice, corps, 'peu-importe');
    expect(reponse.statusCode).toBe(401);
  });

  it('repond a la verification d URL par l echo attendu', async () => {
    const reponse = await app.inject({
      method: 'GET',
      url: `/webhooks/telephonie/${alice.jetonWebhook}?zd_echo=abc123`,
    });
    expect(reponse.statusCode).toBe(200);
    expect(reponse.body).toBe('abc123');
  });
});

describe('doublons et rejeu', () => {
  it('ne cree qu un evenement quand le meme est poste deux fois', async () => {
    const corps = evenementFin();
    const signature = signer(corps, 'secret-alice');
    const premiere = await poster(alice, corps, signature);
    const seconde = await poster(alice, corps, signature);
    expect(premiere.json()).toEqual({ recu: true, doublon: false });
    expect(seconde.json()).toEqual({ recu: true, doublon: true });
    expect(await db.evenementTelephonie.count()).toBe(1);
    // Un seul job empile : pas de double traitement.
    expect(await db.job.count({ where: { type: 'traiter_evenement_appel' } })).toBe(1);
  });

  it('distingue deux etapes du meme appel', async () => {
    const debut = {
      event: 'NOTIFY_START',
      pbx_call_id: 'in_test_1',
      caller_id: '+33639980012',
      called_did: '+33296001000',
      call_start: '2026-03-18 10:00:00',
    };
    const fin = evenementFin();
    await poster(alice, debut, signer(debut, 'secret-alice'));
    await poster(alice, fin, signer(fin, 'secret-alice'));
    expect(await db.evenementTelephonie.count()).toBe(2);
  });

  it('accepte le meme identifiant d appel chez deux entreprises differentes', async () => {
    const corps = evenementFin('in_partage');
    expect((await poster(alice, corps, signer(corps, 'secret-alice'))).statusCode).toBe(200);
    expect((await poster(bob, corps, signer(corps, 'secret-bob'))).statusCode).toBe(200);
    expect(await db.evenementTelephonie.count()).toBe(2);
  });
});

describe('traitement des evenements', () => {
  /**
   * Ne traite que l etape "evenement -> appel". Les etapes suivantes
   * (enregistrement, transcription, analyse) ont leurs propres tests : ici
   * le fournisseur de demonstration refuserait de simuler un telechargement,
   * ce qui est le comportement voulu.
   */
  async function traiterEvenements(): Promise<void> {
    const services = construireServicesTest();
    for (;;) {
      const job = await services.file.prendre('test');
      if (!job) break;
      if (job.type === 'traiter_evenement_appel') {
        await executerJob(services, job);
      }
      await services.file.terminer(job.id);
    }
  }

  it('cree un appel a partir d un evenement de fin', async () => {
    const corps = evenementFin();
    await poster(alice, corps, signer(corps, 'secret-alice'));
    await traiterEvenements();

    const appel = await db.appel.findFirstOrThrow({ where: { entrepriseId: alice.entrepriseId } });
    expect(appel.pbxCallId).toBe('in_test_1');
    expect(appel.direction).toBe('ENTRANT');
    expect(appel.numeroDistant).toBe('+33639980012');
    expect(appel.dureeSecondes).toBe(187);
    expect(appel.estEnregistre).toBe(true);
    // Un enregistrement est annonce : l appel attend son fichier.
    expect(appel.statutTraitement).toBe('EN_ATTENTE_ENREGISTREMENT');
  });

  it('gere des evenements arrives dans le desordre sans ecraser la duree', async () => {
    const fin = evenementFin();
    const debut = {
      event: 'NOTIFY_START',
      pbx_call_id: 'in_test_1',
      caller_id: '+33639980012',
      called_did: '+33296001000',
      call_start: '2026-03-18 10:00:00',
    };
    // La fin arrive avant le debut : cas reel quand deux webhooks se croisent.
    await poster(alice, fin, signer(fin, 'secret-alice'));
    await traiterEvenements();
    await poster(alice, debut, signer(debut, 'secret-alice'));
    await traiterEvenements();

    const appel = await db.appel.findFirstOrThrow({ where: { entrepriseId: alice.entrepriseId } });
    expect(appel.dureeSecondes).toBe(187);
    expect(await db.appel.count()).toBe(1);
  });

  it('marque SANS_ENREGISTREMENT un appel termine sans enregistrement', async () => {
    const corps = { ...evenementFin('in_sans_rec'), is_recorded: '0', call_id_with_rec: '' };
    await poster(alice, corps, signer(corps, 'secret-alice'));
    await traiterEvenements();

    const appel = await db.appel.findFirstOrThrow({ where: { pbxCallId: 'in_sans_rec' } });
    expect(appel.statutTraitement).toBe('SANS_ENREGISTREMENT');
    expect(appel.erreurMessage).toContain('Aucun enregistrement');
  });

  it('traite un numero masque sans tenter de rattachement', async () => {
    const corps = { ...evenementFin('in_masque'), caller_id: 'anonymous' };
    await poster(alice, corps, signer(corps, 'secret-alice'));
    await traiterEvenements();

    const appel = await db.appel.findFirstOrThrow({ where: { pbxCallId: 'in_masque' } });
    expect(appel.numeroMasque).toBe(true);
    expect(appel.numeroDistant).toBeNull();
    expect(appel.statutAssociation).toBe('AUCUN');
    expect(appel.justificationAssociation).toContain('Numero masque');
  });

  it('rattache l appel au bon client quand le numero est connu', async () => {
    const client = await db.client.create({
      data: { entrepriseId: alice.entrepriseId, nom: 'Madame Le Gall', telephones: ['0639980012'] },
    });
    await db.chantier.create({
      data: { entrepriseId: alice.entrepriseId, clientId: client.id, libelle: 'Garage' },
    });
    const corps = evenementFin('in_connu');
    await poster(alice, corps, signer(corps, 'secret-alice'));
    await traiterEvenements();

    const appel = await db.appel.findFirstOrThrow({ where: { pbxCallId: 'in_connu' } });
    expect(appel.clientId).toBe(client.id);
    expect(appel.statutAssociation).toBe('CERTAIN');
  });
});
