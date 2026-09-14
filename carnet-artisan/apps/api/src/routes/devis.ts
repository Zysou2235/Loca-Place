import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { calculerDevis, type LigneDevisEntree } from '@carnet/shared';
import { contexteDe } from '../auth/middleware.js';
import { RessourceIntrouvable } from '../domaine/contexte-entreprise.js';
import { natureVersBase, natureVersDomaine, uniteValide } from '../domaine/conversions.js';
import { genererPdfDevis, reservesLegales } from '../adapters/pdf/devis-pdf.js';
import type { Services } from '../jobs/traitements.js';

const ligneSchema = z.object({
  id: z.string().optional(),
  prestationId: z.string().uuid().nullable().optional(),
  libelle: z.string().min(1).max(200),
  unite: z.string().max(10),
  quantiteMilli: z.number().int().nullable(),
  prixUnitaireCents: z.number().int().nullable(),
  tvaRateBp: z.number().int().min(0).max(10000).nullable(),
  remiseBp: z.number().int().min(0).max(10000).default(0),
  nature: z.enum(['fourniture_seule', 'forfait_pose', 'main_oeuvre', 'frais']),
  origine: z.enum(['catalogue', 'saisie_manuelle', 'proposition_analyse']).default('saisie_manuelle'),
  appelSourceId: z.string().uuid().nullable().optional(),
  extraitSource: z.string().max(500).nullable().optional(),
});

const creation = z.object({
  chantierId: z.string().uuid(),
  objet: z.string().min(1).max(200),
  lignes: z.array(ligneSchema).max(200).default([]),
});

export function routesDevis(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    app.get('/devis', async (requete) => ({ devis: await contexteDe(requete).listerDevis() }));

    app.get<{ Params: { id: string } }>('/devis/:id', async (requete, reponse) => {
      try {
        const devis = await contexteDe(requete).trouverDevis(requete.params.id);
        const calcul = calculerLignes(devis.lignes);
        return { devis, calcul };
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }
    });

    app.post('/devis', async (requete, reponse) => {
      const parsed = creation.safeParse(requete.body);
      if (!parsed.success) {
        return reponse.code(400).send({ erreur: 'Devis incomplet.', details: parsed.error.issues });
      }
      const contexte = contexteDe(requete);
      try {
        await contexte.trouverChantier(parsed.data.chantierId);
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }

      const numero = await prochainNumero(services, contexte.entrepriseId);
      const lignes = parsed.data.lignes.map((l, position) => ({
        ...l,
        position,
        id: l.id ?? `ligne-${String(position)}`,
        prestationId: l.prestationId ?? null,
        appelSourceId: l.appelSourceId ?? null,
        extraitSource: l.extraitSource ?? null,
      }));
      const calcul = calculerLignes(lignes);

      const devis = await services.db.devis.create({
        data: {
          entrepriseId: contexte.entrepriseId,
          chantierId: parsed.data.chantierId,
          numero,
          objet: parsed.data.objet,
          statut: calcul.etat === 'pret_a_verifier' ? 'PRET_A_VERIFIER' : 'BROUILLON_INCOMPLET',
          totalHtCents: calcul.totalHtCents,
          totalTvaCents: calcul.totalTvaCents,
          totalTtcCents: calcul.totalTtcCents,
          postesTva: calcul.postesTva as never,
          avertissements: calcul.avertissements as never,
          lignes: {
            create: lignes.map((l) => ({
              entrepriseId: contexte.entrepriseId,
              position: l.position,
              prestationId: l.prestationId ?? null,
              libelle: l.libelle,
              unite: l.unite,
              quantiteMilli: l.quantiteMilli,
              prixUnitaireCents: l.prixUnitaireCents,
              tvaRateBp: l.tvaRateBp,
              remiseBp: l.remiseBp,
              nature: natureVersBase(l.nature),
              origine: l.origine,
              appelSourceId: l.appelSourceId ?? null,
              extraitSource: l.extraitSource ?? null,
            })),
          },
        },
        include: { lignes: true },
      });
      return reponse.code(201).send({ devis, calcul });
    });

    /**
     * Validation explicite par l'artisan.
     * Un devis incomplet ne peut pas etre valide : c'est le garde-fou qui
     * empeche d'envoyer un document ou un prix manque.
     */
    app.post<{ Params: { id: string } }>('/devis/:id/valider', async (requete, reponse) => {
      const contexte = contexteDe(requete);
      let devis;
      try {
        devis = await contexte.trouverDevis(requete.params.id);
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }
      const calcul = calculerLignes(devis.lignes);
      if (calcul.etat !== 'pret_a_verifier') {
        return reponse.code(409).send({
          erreur: 'Devis incomplet : completez les lignes signalees avant de le valider.',
          champsManquants: calcul.lignes
            .filter((l) => l.incomplete)
            .map((l) => ({ ligne: l.libelle, manque: l.champsManquants })),
        });
      }
      const maj = await services.db.devis.update({
        where: { id: devis.id },
        data: { statut: 'VALIDE', valideA: new Date() },
      });
      return { devis: maj };
    });

    /**
     * Export PDF. Un devis non valide est exporte avec un filigrane
     * "BROUILLON" et reste identifie comme tel.
     */
    app.post<{ Params: { id: string } }>('/devis/:id/pdf', async (requete, reponse) => {
      const contexte = contexteDe(requete);
      let devis;
      try {
        devis = await contexte.trouverDevis(requete.params.id);
      } catch (erreur) {
        if (erreur instanceof RessourceIntrouvable) {
          return reponse.code(404).send({ erreur: erreur.message });
        }
        throw erreur;
      }
      const entreprise = await contexte.entreprise();
      const calcul = calculerLignes(devis.lignes);
      const estBrouillon = devis.statut !== 'VALIDE' && devis.statut !== 'EXPORTE';

      const entete = {
        nom: entreprise.nom,
        nomArtisan: entreprise.nomArtisan,
        adresseLigne1: entreprise.adresseLigne1,
        codePostal: entreprise.codePostal,
        ville: entreprise.ville,
        telephonePro: entreprise.telephonePro,
        emailContact: entreprise.emailContact,
        siret: entreprise.siret,
      };
      const aTvaZero = calcul.postesTva.some((p) => p.rateBp === 0);

      const pdf = await genererPdfDevis(entete, {
        numero: devis.numero,
        objet: devis.objet,
        estBrouillon,
        clientNom: devis.chantier.client.nom,
        chantierLibelle: devis.chantier.libelle,
        chantierAdresse: devis.chantier.adresse,
        lignes: calcul.lignes.map((l) => ({
          libelle: l.libelle,
          unite: l.unite,
          quantiteMilli: l.quantiteMilli,
          prixUnitaireCents: l.prixUnitaireCents,
          remiseBp: l.remiseBp,
          tvaRateBp: l.tvaRateBp,
          montantHtCents: l.montantHtCents,
        })),
        totalHtCents: calcul.totalHtCents,
        postesTva: calcul.postesTva,
        totalTvaCents: calcul.totalTvaCents,
        totalTtcCents: calcul.totalTtcCents,
        reservesLegales: reservesLegales(entete, aTvaZero),
      });

      const fichier = await services.stockage.ecrire(
        contexte.entrepriseId,
        'devis',
        `${devis.numero}${estBrouillon ? '-brouillon' : ''}.pdf`,
        pdf,
      );
      await services.db.devis.update({
        where: { id: devis.id },
        data: {
          cheminPdf: fichier.chemin,
          ...(estBrouillon ? {} : { statut: 'EXPORTE', exporteA: new Date() }),
        },
      });

      return reponse
        .header('content-type', 'application/pdf')
        .header(
          'content-disposition',
          `attachment; filename="devis-${devis.numero}${estBrouillon ? '-brouillon' : ''}.pdf"`,
        )
        .send(pdf);
    });
  };
}

interface LigneBase {
  id: string;
  prestationId: string | null;
  libelle: string;
  unite: string;
  quantiteMilli: number | null;
  prixUnitaireCents: number | null;
  tvaRateBp: number | null;
  remiseBp: number;
  nature: string;
  origine: string;
  appelSourceId: string | null;
  extraitSource: string | null;
}

/** Recalcule systematiquement : les totaux stockes ne font jamais autorite. */
export function calculerLignes(lignes: readonly LigneBase[]) {
  const entrees: LigneDevisEntree[] = lignes.map((l) => ({
    id: l.id,
    prestationId: l.prestationId,
    libelle: l.libelle,
    unite: uniteValide(l.unite),
    quantiteMilli: l.quantiteMilli,
    prixUnitaireCents: l.prixUnitaireCents,
    tvaRateBp: l.tvaRateBp,
    remiseBp: l.remiseBp,
    nature: natureVersDomaine(l.nature),
    origine: l.origine as LigneDevisEntree['origine'],
    appelSourceId: l.appelSourceId,
    extraitSource: l.extraitSource,
  }));
  return calculerDevis(entrees);
}

async function prochainNumero(services: Services, entrepriseId: string): Promise<string> {
  const annee = new Date().getUTCFullYear();
  const compte = await services.db.devis.count({
    where: { entrepriseId, numero: { startsWith: `D${String(annee)}-` } },
  });
  return `D${String(annee)}-${String(compte + 1).padStart(4, '0')}`;
}
