import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TAUX_TVA_AUTORISES, UNITES, parseAmountToCents } from '@carnet/shared';
import { contexteDe } from '../auth/middleware.js';
import { RessourceIntrouvable } from '../domaine/contexte-entreprise.js';
import { natureVersBase } from '../domaine/conversions.js';
import type { Services } from '../jobs/traitements.js';

const prestation = z.object({
  reference: z.string().min(1).max(50),
  libelle: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  unite: z.enum(UNITES as unknown as [string, ...string[]]),
  prixVenteCents: z.number().int().min(0),
  coutAchatCents: z.number().int().min(0).nullable().optional(),
  tempsMainOeuvreMinutes: z.number().int().min(0).nullable().optional(),
  nature: z.enum(['fourniture_seule', 'forfait_pose', 'main_oeuvre', 'frais']),
  tvaRateBp: z.number().int().min(0).max(10000),
});

export function routesCatalogue(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    app.get<{ Querystring: { archivees?: string } }>('/catalogue', async (requete) => ({
      prestations: await contexteDe(requete).listerPrestations({
        inclureArchivees: requete.query.archivees === '1',
      }),
      tauxTvaAutorises: TAUX_TVA_AUTORISES,
    }));

    app.post('/catalogue', async (requete, reponse) => {
      const parsed = prestation.safeParse(requete.body);
      if (!parsed.success) {
        return reponse.code(400).send({ erreur: 'Prestation incomplete.', details: parsed.error.issues });
      }
      const contexte = contexteDe(requete);
      const d = parsed.data;
      const existante = await services.db.prestation.findUnique({
        where: { entrepriseId_reference: { entrepriseId: contexte.entrepriseId, reference: d.reference } },
      });
      if (existante) {
        return reponse.code(409).send({ erreur: `La reference "${d.reference}" existe deja.` });
      }
      const creee = await services.db.prestation.create({
        data: {
          entrepriseId: contexte.entrepriseId,
          reference: d.reference,
          libelle: d.libelle,
          description: d.description ?? null,
          unite: d.unite,
          prixVenteCents: d.prixVenteCents,
          coutAchatCents: d.coutAchatCents ?? null,
          tempsMainOeuvreMinutes: d.tempsMainOeuvreMinutes ?? null,
          nature: natureVersBase(d.nature),
          tvaRateBp: d.tvaRateBp,
        },
      });
      return reponse.code(201).send({ prestation: creee });
    });

    app.put<{ Params: { id: string }; Body: { archive?: boolean } }>(
      '/catalogue/:id/archivage',
      async (requete, reponse) => {
        const contexte = contexteDe(requete);
        try {
          await contexte.trouverPrestation(requete.params.id);
        } catch (erreur) {
          if (erreur instanceof RessourceIntrouvable) {
            return reponse.code(404).send({ erreur: erreur.message });
          }
          throw erreur;
        }
        const prestationMaj = await services.db.prestation.update({
          where: { id: requete.params.id },
          data: { archive: requete.body?.archive !== false },
        });
        return { prestation: prestationMaj };
      },
    );

    /**
     * Import CSV : rend un APERCU, sans rien enregistrer.
     * L'enregistrement se fait ensuite ligne par ligne via POST /catalogue,
     * apres validation par l'artisan. Une ligne illisible est signalee, jamais
     * devinee.
     */
    app.post<{ Body: { csv?: string } }>('/catalogue/apercu-import', (requete, reponse) => {
      const csv = typeof requete.body?.csv === 'string' ? requete.body.csv : '';
      if (csv.trim() === '') return reponse.code(400).send({ erreur: 'Fichier vide.' });
      return { apercu: analyserCsvCatalogue(csv) };
    });
  };
}

export interface LigneApercu {
  numeroLigne: number;
  valide: boolean;
  erreurs: string[];
  prestation?: {
    reference: string;
    libelle: string;
    unite: string;
    prixVenteCents: number;
    tvaRateBp: number;
    nature: string;
  };
}

const ENTETES_ATTENDUS = ['reference', 'libelle', 'unite', 'prix_vente', 'tva', 'nature'] as const;

export function analyserCsvCatalogue(csv: string): {
  entetes: string[];
  lignes: LigneApercu[];
  entetesManquants: string[];
} {
  const lignesBrutes = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  const premiere = lignesBrutes[0] ?? '';
  const separateur = (premiere.match(/;/g)?.length ?? 0) >= (premiere.match(/,/g)?.length ?? 0) ? ';' : ',';
  const entetes = premiere.split(separateur).map((e) => e.trim().toLowerCase());
  const entetesManquants = ENTETES_ATTENDUS.filter((e) => !entetes.includes(e));

  const lignes: LigneApercu[] = [];
  for (let i = 1; i < lignesBrutes.length; i += 1) {
    const cellules = (lignesBrutes[i] ?? '').split(separateur).map((c) => c.trim());
    const valeur = (nom: string): string => {
      const index = entetes.indexOf(nom);
      return index >= 0 ? (cellules[index] ?? '') : '';
    };
    const erreurs: string[] = [];
    const reference = valeur('reference');
    const libelle = valeur('libelle');
    const unite = valeur('unite') || 'u';
    const prix = parseAmountToCents(valeur('prix_vente'));
    const tvaTexte = valeur('tva').replace('%', '').replace(',', '.');
    const tva = tvaTexte === '' ? null : Math.round(Number(tvaTexte) * 100);
    const nature = valeur('nature') || 'fourniture_seule';

    if (reference === '') erreurs.push('Reference absente.');
    if (libelle === '') erreurs.push('Libelle absent.');
    if (prix === null) erreurs.push(`Prix de vente illisible : "${valeur('prix_vente')}".`);
    if (tva === null || !Number.isFinite(tva)) erreurs.push(`Taux de TVA illisible : "${valeur('tva')}".`);
    if (!(UNITES as readonly string[]).includes(unite)) erreurs.push(`Unite inconnue : "${unite}".`);
    if (!['fourniture_seule', 'forfait_pose', 'main_oeuvre', 'frais'].includes(nature)) {
      erreurs.push(`Nature inconnue : "${nature}".`);
    }

    lignes.push({
      numeroLigne: i + 1,
      valide: erreurs.length === 0,
      erreurs,
      ...(erreurs.length === 0
        ? {
            prestation: {
              reference,
              libelle,
              unite,
              prixVenteCents: prix as number,
              tvaRateBp: tva as number,
              nature,
            },
          }
        : {}),
    });
  }

  return { entetes, lignes, entetesManquants };
}
