/**
 * Parametres de l'entreprise, dont la connexion telephonique.
 *
 * Regle centrale de cette route : l'etat affiche decrit ce qui a ete VERIFIE,
 * jamais ce qui a ete saisi. Enregistrer une cle API ne fait pas passer a
 * "connecte" ; seul un appel de test recu, signe, enregistre et analyse fait
 * passer a TEST_REUSSI.
 */

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { EtatTelephonie, StatutTelephonie } from '@carnet/shared';
import { contexteDe, sessionDe } from '../auth/middleware.js';
import { chiffrer, masquer, dechiffrer } from '../secrets.js';
import { normaliserNumero } from '../domaine/association.js';
import type { Services } from '../jobs/traitements.js';

const identifiants = z.object({
  identifiantFournisseur: z.string().min(1).max(60),
  cleApi: z.string().min(1).max(200),
  secretApi: z.string().min(1).max(200),
  numeroTechnique: z.string().max(30).optional(),
  extensionPbx: z.string().regex(/^\d{3}$/).default('100'),
});

const renvoi = z.object({
  numeroPersonnel: z.string().min(6).max(30),
  confirme: z.boolean(),
});

export class BoucleDeRenvoi extends Error {
  override readonly name = 'BoucleDeRenvoi';
}

/**
 * Empeche la configuration qui met un artisan hors service : son numero
 * habituel renvoie vers le numero technique, qui renvoie vers son numero
 * habituel. Les deux appels se rappellent jusqu'a saturation.
 */
export function detecterBoucle(numeroPersonnel: string, numeroTechnique: string | null): boolean {
  if (!numeroTechnique) return false;
  return normaliserNumero(numeroPersonnel) === normaliserNumero(numeroTechnique);
}

export function construireStatut(config: {
  etat: EtatTelephonie;
  detail: string;
  derniereVerification: Date | null;
  dernierTestReussi: Date | null;
}): StatutTelephonie {
  const actions: Record<EtatTelephonie, string | null> = {
    NON_CONFIGURE: 'Lancer la configuration telephonique.',
    EN_ATTENTE_FOURNISSEUR: 'Le fournisseur doit valider le compte ou attribuer un numero.',
    EN_ATTENTE_RENVOI_OPERATEUR:
      'Activer le renvoi d appel chez votre operateur, puis revenir confirmer ici.',
    PRET_A_TESTER: 'Passer un appel de test depuis un autre telephone vers votre numero habituel.',
    TEST_REUSSI: null,
    ERREUR: 'Corriger l erreur ci-dessus, puis relancer un appel de test.',
  };
  return {
    etat: config.etat,
    detail: config.detail,
    derniereVerificationIso: config.derniereVerification?.toISOString() ?? null,
    prochaineAction: actions[config.etat],
  };
}

export function routesParametres(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    app.get('/parametres', async (requete) => {
      const contexte = contexteDe(requete);
      const entreprise = await contexte.entreprise();
      const config = await contexte.configTelephonie();
      const abonnement = await services.db.abonnement.findUnique({
        where: { entrepriseId: contexte.entrepriseId },
      });

      return {
        entreprise: {
          id: entreprise.id,
          nom: entreprise.nom,
          metier: entreprise.metier,
          nomArtisan: entreprise.nomArtisan,
          telephonePro: entreprise.telephonePro,
          emailContact: entreprise.emailContact,
          siret: entreprise.siret,
          adresseLigne1: entreprise.adresseLigne1,
          codePostal: entreprise.codePostal,
          ville: entreprise.ville,
          fuseau: entreprise.fuseau,
          mode: entreprise.mode,
          retentionAudioJours: entreprise.retentionAudioJours,
          retentionTranscriptionJours: entreprise.retentionTranscriptionJours,
        },
        telephonie: config
          ? {
              ...construireStatut({
                etat: config.etat,
                detail: config.detail,
                derniereVerification: config.derniereVerification,
                dernierTestReussi: config.dernierTestReussi,
              }),
              fournisseur: config.fournisseur,
              numeroTechnique: config.numeroTechnique,
              extensionPbx: config.extensionPbx,
              renvoiConfirmeParUtilisateur: config.renvoiConfirmeParUtilisateur,
              // On confirme qu'une cle existe sans jamais la renvoyer.
              cleApiEnregistree: config.cleApiChiffree ? masquer(dechiffrer(config.cleApiChiffree)) : null,
              urlWebhook: `${services.config.URL_PUBLIQUE}/webhooks/telephonie/${entreprise.jetonWebhook}`,
            }
          : null,
        capacitesFournisseur: services.telephonie.capacites,
        abonnement: abonnement
          ? {
              statut: abonnement.statut,
              prixMensuelCentimes: abonnement.prixMensuelCentimes,
              finPeriodeIso: abonnement.finPeriode?.toISOString() ?? null,
              // Aucun paiement reel n'est encaisse dans ce MVP.
              modePaiement: 'test',
            }
          : null,
      };
    });

    /**
     * Enregistre des identifiants fournisseur.
     *
     * Dans le parcours revendeur vise, l'artisan ne saisit jamais de cle : le
     * serveur cree le sous-compte et recupere les identifiants. Cette route
     * existe pour le pilote, ou le compte est cree a la main.
     */
    app.put('/parametres/telephonie/identifiants', async (requete, reponse) => {
      if (sessionDe(requete).role !== 'PROPRIETAIRE') {
        return reponse.code(403).send({ erreur: 'Seul le proprietaire peut modifier la telephonie.' });
      }
      const parsed = identifiants.safeParse(requete.body);
      if (!parsed.success) return reponse.code(400).send({ erreur: 'Identifiants incomplets.' });
      const contexte = contexteDe(requete);
      const d = parsed.data;

      const config = await services.db.configTelephonie.upsert({
        where: { entrepriseId: contexte.entrepriseId },
        create: {
          entrepriseId: contexte.entrepriseId,
          identifiantFournisseur: d.identifiantFournisseur,
          cleApiChiffree: chiffrer(d.cleApi),
          secretApiChiffre: chiffrer(d.secretApi),
          numeroTechnique: d.numeroTechnique ?? null,
          extensionPbx: d.extensionPbx,
          etat: 'EN_ATTENTE_RENVOI_OPERATEUR',
          detail:
            'Identifiants enregistres. Cela ne prouve pas encore que les appels arrivent : activez le renvoi, puis passez un appel de test.',
          derniereVerification: null,
        },
        update: {
          identifiantFournisseur: d.identifiantFournisseur,
          cleApiChiffree: chiffrer(d.cleApi),
          secretApiChiffre: chiffrer(d.secretApi),
          numeroTechnique: d.numeroTechnique ?? null,
          extensionPbx: d.extensionPbx,
          etat: 'EN_ATTENTE_RENVOI_OPERATEUR',
          detail:
            'Identifiants enregistres. Cela ne prouve pas encore que les appels arrivent : activez le renvoi, puis passez un appel de test.',
          // Toute modification invalide le test precedent.
          dernierTestReussi: null,
          derniereVerification: null,
        },
      });

      return {
        telephonie: construireStatut({
          etat: config.etat,
          detail: config.detail,
          derniereVerification: config.derniereVerification,
          dernierTestReussi: config.dernierTestReussi,
        }),
      };
    });

    /**
     * Confirmation, par l'artisan, qu'il a active le renvoi chez son operateur.
     *
     * L'application n'active jamais un renvoi elle-meme : elle n'en a ni le
     * droit ni le moyen, et un renvoi active a l'insu de l'artisan lui ferait
     * perdre ses appels.
     */
    app.put('/parametres/telephonie/renvoi', async (requete, reponse) => {
      const parsed = renvoi.safeParse(requete.body);
      if (!parsed.success) return reponse.code(400).send({ erreur: 'Numero personnel requis.' });
      const contexte = contexteDe(requete);
      const config = await contexte.configTelephonie();
      if (!config) return reponse.code(409).send({ erreur: 'Configurez d abord la telephonie.' });

      if (detecterBoucle(parsed.data.numeroPersonnel, config.numeroTechnique)) {
        return reponse.code(400).send({
          erreur:
            'Configuration refusee : le numero technique et votre numero personnel sont identiques. ' +
            'Le renvoi tournerait en boucle et vos appels seraient perdus.',
        });
      }

      const maj = await services.db.configTelephonie.update({
        where: { entrepriseId: contexte.entrepriseId },
        data: {
          numeroPersonnel: parsed.data.numeroPersonnel,
          renvoiConfirmeParUtilisateur: parsed.data.confirme,
          etat: parsed.data.confirme ? 'PRET_A_TESTER' : 'EN_ATTENTE_RENVOI_OPERATEUR',
          detail: parsed.data.confirme
            ? 'Renvoi declare actif. Passez maintenant un appel de test : tant qu un appel reel n a pas ete recu et analyse, la chaine n est pas verifiee.'
            : 'En attente d activation du renvoi chez votre operateur.',
        },
      });

      return {
        telephonie: construireStatut({
          etat: maj.etat,
          detail: maj.detail,
          derniereVerification: maj.derniereVerification,
          dernierTestReussi: maj.dernierTestReussi,
        }),
      };
    });

    /**
     * Etat reel de la chaine, calcule a partir des faits en base.
     *
     * Aucune affirmation n'est fondee sur la seule presence d'une cle : on
     * regarde s'il existe un appel reel, recu par webhook signe, dont
     * l'analyse est allee au bout.
     */
    app.get('/parametres/telephonie/verification', async (requete, reponse) => {
      const contexte = contexteDe(requete);
      const config = await contexte.configTelephonie();
      if (!config) return reponse.code(404).send({ erreur: 'Telephonie non configuree.' });

      const appelReussi = await services.db.appel.findFirst({
        where: {
          entrepriseId: contexte.entrepriseId,
          estDemonstration: false,
          statutTraitement: 'ANALYSE_TERMINEE',
        },
        orderBy: { debut: 'desc' },
      });

      const etat: EtatTelephonie = appelReussi ? 'TEST_REUSSI' : config.etat;
      const detail = appelReussi
        ? `Chaine verifiee : un appel reel du ${appelReussi.debut.toISOString()} a ete recu, enregistre et analyse.`
        : config.detail;

      const maj = await services.db.configTelephonie.update({
        where: { entrepriseId: contexte.entrepriseId },
        data: {
          etat,
          detail,
          derniereVerification: new Date(),
          ...(appelReussi ? { dernierTestReussi: appelReussi.debut } : {}),
        },
      });

      return {
        telephonie: construireStatut({
          etat: maj.etat,
          detail: maj.detail,
          derniereVerification: maj.derniereVerification,
          dernierTestReussi: maj.dernierTestReussi,
        }),
        appelDeTest: appelReussi ? { id: appelReussi.id, debutIso: appelReussi.debut.toISOString() } : null,
      };
    });

    /** Export complet des donnees de l'entreprise, au format JSON. */
    app.get('/parametres/export', async (requete) => {
      const contexte = contexteDe(requete);
      const entrepriseId = contexte.entrepriseId;
      const [entreprise, clients, chantiers, appels, analyses, devis, prestations] = await Promise.all([
        contexte.entreprise(),
        services.db.client.findMany({ where: { entrepriseId } }),
        services.db.chantier.findMany({ where: { entrepriseId } }),
        services.db.appel.findMany({ where: { entrepriseId } }),
        services.db.analyse.findMany({ where: { entrepriseId } }),
        services.db.devis.findMany({ where: { entrepriseId }, include: { lignes: true } }),
        services.db.prestation.findMany({ where: { entrepriseId } }),
      ]);
      return {
        exporteLe: new Date().toISOString(),
        entreprise: { ...entreprise, jetonWebhook: '[retire de l export]' },
        clients,
        chantiers,
        appels,
        analyses,
        devis,
        prestations,
      };
    });

    /**
     * Suppression definitive.
     *
     * Les fichiers sur disque sont supprimes AVANT les lignes en base :
     * si la suppression des fichiers echoue, la base garde leur trace et
     * l'operation peut etre reprise, au lieu de laisser des fichiers orphelins.
     */
    app.delete('/parametres/donnees', async (requete, reponse) => {
      if (sessionDe(requete).role !== 'PROPRIETAIRE') {
        return reponse.code(403).send({ erreur: 'Seul le proprietaire peut supprimer les donnees.' });
      }
      const confirmation = (requete.body as { confirmation?: string } | undefined)?.confirmation;
      if (confirmation !== 'SUPPRIMER') {
        return reponse.code(400).send({
          erreur: 'Confirmation requise : envoyez { "confirmation": "SUPPRIMER" }.',
        });
      }
      const contexte = contexteDe(requete);
      const chemins = await contexte.cheminsFichiersASupprimer();
      for (const chemin of chemins) await services.stockage.supprimer(chemin);
      await services.stockage.supprimerEntreprise(contexte.entrepriseId);
      await contexte.supprimerToutesLesDonnees();
      return reponse.code(200).send({ supprime: true, fichiersSupprimes: chemins.length });
    });
  };
}
