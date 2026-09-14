/**
 * Reception des evenements du fournisseur de telephonie.
 *
 * C'est la seule route publique qui ecrit en base. Elle applique, dans l'ordre :
 *  1. identification de l'entreprise par le jeton present dans l'URL ;
 *  2. verification de la signature AVEC LE SECRET DE CETTE ENTREPRISE ;
 *  3. journalisation durable de l'evenement, avec cle d'idempotence ;
 *  4. mise en file du traitement.
 *
 * Le point 2 est ce qui empeche un evenement d'etre attribue a la mauvaise
 * entreprise : le jeton d'URL designe, il n'authentifie pas. Un attaquant qui
 * connaitrait un jeton ne pourrait toujours pas produire une signature valide.
 *
 * La reponse est 200 des que l'evenement est journalise, meme si le traitement
 * echouera ensuite : sinon le fournisseur rejoue indefiniment un evenement que
 * nous avons deja.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { cleIdempotence, verifierSignatureWebhook } from '@carnet/shared';
import { dechiffrer } from '../secrets.js';
import type { Services } from '../jobs/traitements.js';

export function routesWebhooks(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    /**
     * Zadarma verifie l'URL de webhook en emettant une requete GET dont il
     * attend l'echo du parametre `zd_echo`. Aucun effet de bord.
     */
    app.get<{ Params: { jeton: string }; Querystring: { zd_echo?: string } }>(
      '/webhooks/telephonie/:jeton',
      async (requete, reponse) => {
        const echo = requete.query.zd_echo;
        if (typeof echo !== 'string') {
          return reponse.code(400).send({ erreur: 'Parametre zd_echo attendu.' });
        }
        const entreprise = await services.db.entreprise.findUnique({
          where: { jetonWebhook: requete.params.jeton },
          select: { id: true },
        });
        if (!entreprise) {
          return reponse.code(404).send({ erreur: 'Jeton inconnu.' });
        }
        return reponse.type('text/plain').send(echo);
      },
    );

    app.post<{ Params: { jeton: string }; Body: Record<string, unknown> }>(
      '/webhooks/telephonie/:jeton',
      async (requete, reponse) => {
        const corps = requete.body;
        if (typeof corps !== 'object' || corps === null) {
          return reponse.code(400).send({ erreur: 'Corps invalide.' });
        }

        const entreprise = await services.db.entreprise.findUnique({
          where: { jetonWebhook: requete.params.jeton },
          include: { configTelephonie: true },
        });
        if (!entreprise) {
          // Reponse volontairement identique a une signature invalide : on ne
          // permet pas de tester l'existence d'un jeton.
          return reponse.code(401).send({ erreur: 'Evenement refuse.' });
        }

        const secretChiffre = entreprise.configTelephonie?.secretApiChiffre;
        if (!secretChiffre) {
          requete.log.warn(
            { entrepriseId: entreprise.id },
            'Evenement recu pour une entreprise sans secret fournisseur : refuse.',
          );
          return reponse.code(401).send({ erreur: 'Evenement refuse.' });
        }

        const signature = requete.headers['signature'];
        const verification = verifierSignatureWebhook(
          corps,
          typeof signature === 'string' ? signature : undefined,
          dechiffrer(secretChiffre),
        );
        if (!verification.valide) {
          requete.log.warn(
            { entrepriseId: entreprise.id, raison: verification.raison },
            'Signature de webhook refusee.',
          );
          return reponse.code(401).send({ erreur: 'Evenement refuse.' });
        }

        const cle = cleIdempotence(corps);
        if (!cle) {
          return reponse.code(400).send({ erreur: 'Evenement sans identifiant exploitable.' });
        }

        // `create` protege par la contrainte (entrepriseId, cleIdempotence) :
        // un rejeu tombe sur P2002 et ne cree pas de second evenement.
        let evenementId: string;
        try {
          const evenement = await services.db.evenementTelephonie.create({
            data: {
              entrepriseId: entreprise.id,
              type: verification.evenement,
              cleIdempotence: cle,
              contenu: corps as never,
            },
          });
          evenementId = evenement.id;
        } catch (erreur) {
          if (estViolationUnicite(erreur)) {
            requete.log.info(
              { entrepriseId: entreprise.id, cle },
              'Evenement deja recu : ignore.',
            );
            return reponse.code(200).send({ recu: true, doublon: true });
          }
          throw erreur;
        }

        await services.file.empiler(
          'traiter_evenement_appel',
          { evenementId },
          { entrepriseId: entreprise.id, cleUnicite: `evenement:${evenementId}` },
        );

        return reponse.code(200).send({ recu: true, doublon: false });
      },
    );
  };
}

function estViolationUnicite(erreur: unknown): boolean {
  return (
    typeof erreur === 'object' &&
    erreur !== null &&
    'code' in erreur &&
    (erreur as { code?: unknown }).code === 'P2002'
  );
}
