/**
 * Contrat de sortie de l'analyse d'un appel.
 *
 * Toute sortie du modele est validee par ce schema avant d'entrer en base.
 * Une sortie invalide n'est pas "reparee" : l'appel passe en erreur, reste
 * consultable, et l'artisan peut relancer l'analyse.
 *
 * Principe de tracabilite : chaque information qui compte porte sa provenance
 * (extrait de transcription, repere temporel, statut). Une valeur sans extrait
 * ne peut pas etre marquee "explicite".
 */

import { z } from 'zod';

/** D'ou vient l'information, et a quel point on peut s'y fier. */
export const StatutInfo = z.enum([
  /** Dit mot pour mot par un interlocuteur. */
  'explicite',
  /** Deduit du contexte par le modele. A traiter comme une hypothese. */
  'deduit',
  /** Incertain : l'artisan doit le verifier avec le client. */
  'a_confirmer',
]);
export type StatutInfo = z.infer<typeof StatutInfo>;

const champTrace = <T extends z.ZodTypeAny>(valeur: T) =>
  z.object({
    valeur,
    /** Citation exacte de la transcription. `null` si rien ne la justifie. */
    extraitSource: z.string().max(500).nullable(),
    /** Position approximative dans l'enregistrement, en secondes. */
    repereSecondes: z.number().int().min(0).nullable(),
    statut: StatutInfo,
  });

export const ChampTexte = champTrace(z.string().max(500));
export const ChampTexteOptionnel = champTrace(z.string().max(500).nullable());

/**
 * Une quantite entendue. Volontairement conservee en texte brut *et* en
 * nombre : le texte sert de preuve, le nombre sert au pre-remplissage.
 * Le moteur de devis ne prend jamais `valeurNumerique` pour argent comptant
 * sans que l'artisan l'ait vue.
 */
export const ElementChiffre = z.object({
  designation: z.string().max(200),
  valeurTexte: z.string().max(100),
  valeurNumerique: z.number().nullable(),
  unite: z.string().max(20).nullable(),
  extraitSource: z.string().max(500).nullable(),
  repereSecondes: z.number().int().min(0).nullable(),
  statut: StatutInfo,
  /**
   * Corrections entendues pendant l'appel ("trois prises, enfin non, quatre").
   * La valeur retenue est la derniere annoncee ; les precedentes restent
   * visibles pour que l'artisan puisse trancher.
   */
  corrections: z
    .array(
      z.object({
        valeurAbandonnee: z.string().max(100),
        extraitSource: z.string().max(500).nullable(),
      }),
    )
    .max(10)
    .default([]),
});
export type ElementChiffre = z.infer<typeof ElementChiffre>;

export const NiveauUrgence = z.enum([
  'immediate',
  'sous_48h',
  'cette_semaine',
  'non_urgent',
  'inconnu',
]);
export type NiveauUrgence = z.infer<typeof NiveauUrgence>;

/**
 * Un creneau evoque. Jamais un rendez-vous confirme : meme si le client dit
 * "d'accord pour lundi", l'application propose et l'artisan valide.
 */
export const CreneauEvoque = z.object({
  expressionEntendue: z.string().max(200),
  /** Resolu par du code, pas par le modele (voir dates-fr.ts). */
  dateProposeeIso: z.string().datetime().nullable(),
  precision: z.enum(['heure', 'creneau', 'jour', 'inconnue']),
  /** `true` si le client ou l'artisan s'est repris. */
  corrige: z.boolean().default(false),
  expressionAbandonnee: z.string().max(200).nullable().default(null),
  extraitSource: z.string().max(500).nullable(),
  statut: StatutInfo,
});
export type CreneauEvoque = z.infer<typeof CreneauEvoque>;

/**
 * Montant evoque en appel. Le champ s'appelle "annonce" et non "convenu" :
 * une estimation orale n'est jamais transformee en engagement ferme.
 */
export const BudgetAnnonce = z.object({
  montantTexte: z.string().max(100),
  montantCentimes: z.number().int().nullable(),
  /** Qui a annonce ce montant. */
  annoncePar: z.enum(['client', 'artisan', 'indetermine']),
  /** `true` si le montant a ete presente comme un ordre de grandeur. */
  estUneEstimation: z.boolean(),
  extraitSource: z.string().max(500).nullable(),
  statut: StatutInfo,
});

export const Engagement = z.object({
  qui: z.enum(['artisan', 'client']),
  quoi: z.string().max(300),
  echeanceTexte: z.string().max(200).nullable(),
  extraitSource: z.string().max(500).nullable(),
  statut: StatutInfo,
});

export const Ambiguite = z.object({
  sujet: z.string().max(200),
  pourquoi: z.string().max(500),
  questionAPoser: z.string().max(300),
});

export const TacheProposee = z.object({
  titre: z.string().max(200),
  /** Rappel eventuel, exprime tel qu'entendu ; resolu ensuite par du code. */
  echeanceTexte: z.string().max(200).nullable(),
  priorite: z.enum(['haute', 'normale', 'basse']),
  extraitSource: z.string().max(500).nullable(),
});

/**
 * Signalement d'une tentative d'injection reperee dans la conversation.
 * Le modele n'obeit jamais a une instruction entendue dans un appel ; s'il en
 * detecte une, il la remonte comme un fait a montrer a l'artisan.
 */
export const SignalementInstruction = z.object({
  extraitSource: z.string().max(500),
  raison: z.string().max(300),
});

export const AnalyseAppel = z.object({
  /** Resume factuel, 3 phrases maximum, sans interpretation commerciale. */
  resume: z.string().max(800),
  interlocuteur: z.object({
    nom: ChampTexteOptionnel,
    telephoneEvoque: ChampTexteOptionnel,
    emailEvoque: ChampTexteOptionnel,
    estUnClientExistantSelonLAppel: z.boolean().nullable(),
  }),
  adresseChantier: ChampTexteOptionnel,
  natureTravaux: ChampTexte,
  elements: z.array(ElementChiffre).max(50).default([]),
  contraintes: z.array(ChampTexte).max(20).default([]),
  urgence: z.object({
    niveau: NiveauUrgence,
    extraitSource: z.string().max(500).nullable(),
    statut: StatutInfo,
  }),
  disponibilites: z.array(CreneauEvoque).max(20).default([]),
  budgetAnnonce: BudgetAnnonce.nullable().default(null),
  engagements: z.array(Engagement).max(20).default([]),
  tachesProposees: z.array(TacheProposee).max(20).default([]),
  /** Ce qu'il manque pour chiffrer : formule comme une question a poser. */
  informationsManquantes: z.array(z.string().max(300)).max(20).default([]),
  ambiguites: z.array(Ambiguite).max(20).default([]),
  instructionsDetecteesDansLAppel: z.array(SignalementInstruction).max(10).default([]),
  /** Qualite audio percue ; sert a expliquer une analyse pauvre. */
  qualiteAudio: z.enum(['bonne', 'moyenne', 'mauvaise', 'inexploitable']),
});
export type AnalyseAppel = z.infer<typeof AnalyseAppel>;

export type ResultatValidation =
  | { ok: true; analyse: AnalyseAppel; avertissements: readonly string[] }
  | { ok: false; erreurs: readonly string[] };

/**
 * Valide une sortie de modele et applique les regles que le schema seul ne
 * peut pas exprimer.
 *
 * Regle appliquee ici : une information marquee "explicite" sans extrait
 * source est retrogradee en "a_confirmer". On ne fait jamais confiance a un
 * modele qui affirme sans citer.
 */
export function validerAnalyse(donnees: unknown): ResultatValidation {
  const parsed = AnalyseAppel.safeParse(donnees);
  if (!parsed.success) {
    return {
      ok: false,
      erreurs: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  const avertissements: string[] = [];
  const analyse = parsed.data;

  const retrograder = (chemin: string, champ: { extraitSource: string | null; statut: StatutInfo }): void => {
    if (champ.statut === 'explicite' && (champ.extraitSource === null || champ.extraitSource.trim() === '')) {
      champ.statut = 'a_confirmer';
      avertissements.push(
        `${chemin} etait marque "explicite" sans extrait de transcription : passe en "a confirmer".`,
      );
    }
  };

  retrograder('interlocuteur.nom', analyse.interlocuteur.nom);
  retrograder('interlocuteur.telephoneEvoque', analyse.interlocuteur.telephoneEvoque);
  retrograder('interlocuteur.emailEvoque', analyse.interlocuteur.emailEvoque);
  retrograder('adresseChantier', analyse.adresseChantier);
  retrograder('natureTravaux', analyse.natureTravaux);
  retrograder('urgence', analyse.urgence);
  analyse.elements.forEach((e, i) => { retrograder(`elements[${String(i)}]`, e); });
  analyse.contraintes.forEach((c, i) => { retrograder(`contraintes[${String(i)}]`, c); });
  analyse.disponibilites.forEach((d, i) => { retrograder(`disponibilites[${String(i)}]`, d); });
  analyse.engagements.forEach((e, i) => { retrograder(`engagements[${String(i)}]`, e); });
  if (analyse.budgetAnnonce) retrograder('budgetAnnonce', analyse.budgetAnnonce);

  if (analyse.instructionsDetecteesDansLAppel.length > 0) {
    avertissements.push(
      `${String(analyse.instructionsDetecteesDansLAppel.length)} instruction(s) reperee(s) dans la conversation : ` +
        'elles sont affichees a titre informatif et ne declenchent aucune action.',
    );
  }

  return { ok: true, analyse, avertissements };
}

/** Squelette vide, utilise quand l'analyse echoue : jamais de fiche partielle trompeuse. */
export function analyseVide(raison: string): AnalyseAppel {
  return {
    resume: raison,
    interlocuteur: {
      nom: { valeur: null, extraitSource: null, repereSecondes: null, statut: 'a_confirmer' },
      telephoneEvoque: { valeur: null, extraitSource: null, repereSecondes: null, statut: 'a_confirmer' },
      emailEvoque: { valeur: null, extraitSource: null, repereSecondes: null, statut: 'a_confirmer' },
      estUnClientExistantSelonLAppel: null,
    },
    adresseChantier: { valeur: null, extraitSource: null, repereSecondes: null, statut: 'a_confirmer' },
    natureTravaux: { valeur: '', extraitSource: null, repereSecondes: null, statut: 'a_confirmer' },
    elements: [],
    contraintes: [],
    urgence: { niveau: 'inconnu', extraitSource: null, statut: 'a_confirmer' },
    disponibilites: [],
    budgetAnnonce: null,
    engagements: [],
    tachesProposees: [],
    informationsManquantes: [],
    ambiguites: [],
    instructionsDetecteesDansLAppel: [],
    qualiteAudio: 'inexploitable',
  };
}
