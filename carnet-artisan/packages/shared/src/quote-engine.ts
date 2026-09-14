/**
 * Moteur de devis : 100 % deterministe.
 *
 * Aucun appel a un modele de langage ici. Le LLM peut *proposer* des lignes
 * (libelle, quantite entendue, reference catalogue pressentie) ; tous les
 * calculs - quantites, prix unitaires, remises, sous-totaux, TVA, total -
 * sont faits par ce fichier, a partir du catalogue de l'artisan.
 *
 * Regle absolue : une donnee manquante reste manquante. Le moteur ne comble
 * jamais un prix ou une quantite par defaut.
 */

import {
  applyBp,
  multiplyQuantity,
  roundHalfUp,
  sum,
  BP_SCALE,
  type Bp,
  type Cents,
  type Milli,
} from './money.js';

export type Unite = 'u' | 'h' | 'm' | 'ml' | 'm2' | 'm3' | 'kg' | 'forfait' | 'ens';

export const UNITES: readonly Unite[] = ['u', 'h', 'm', 'ml', 'm2', 'm3', 'kg', 'forfait', 'ens'];

/**
 * Nature d'une prestation. Determine notamment si la main-d'oeuvre est deja
 * incluse dans le prix, ce qui evite de la facturer deux fois.
 */
export type NaturePrestation =
  /** Materiel seul, pose non comprise. */
  | 'fourniture_seule'
  /** Prix tout compris : fourniture + pose. La main-d'oeuvre est deja dedans. */
  | 'forfait_pose'
  /** Main-d'oeuvre facturee au temps passe. */
  | 'main_oeuvre'
  /** Frais divers : deplacement, mise en decharge, etc. */
  | 'frais';

export interface PrestationCatalogue {
  id: string;
  reference: string;
  libelle: string;
  description?: string | null;
  unite: Unite;
  /** Prix de vente unitaire HT, en centimes. */
  prixVenteCents: Cents;
  /** Cout d'achat unitaire HT, facultatif (marge indicative). */
  coutAchatCents?: Cents | null;
  /** Temps de main-d'oeuvre associe, en minutes, facultatif. */
  tempsMainOeuvreMinutes?: number | null;
  nature: NaturePrestation;
  tvaRateBp: Bp;
  archive: boolean;
}

export type OrigineLigne = 'catalogue' | 'saisie_manuelle' | 'proposition_analyse';

export interface LigneDevisEntree {
  id: string;
  /** Prestation du catalogue rattachee, si elle est confirmee. */
  prestationId?: string | null;
  libelle: string;
  unite: Unite;
  /** `null` = quantite non determinee. Le moteur ne suppose jamais 1. */
  quantiteMilli: Milli | null;
  /** `null` = prix non determine. Le moteur ne suppose jamais un prix. */
  prixUnitaireCents: Cents | null;
  /** `null` = taux non choisi. Le moteur ne suppose jamais 20 %. */
  tvaRateBp: Bp | null;
  /** Remise sur la ligne, en points de base (500 = 5 %). */
  remiseBp?: Bp;
  nature: NaturePrestation;
  origine: OrigineLigne;
  /** Appel d'ou provient la proposition, pour la tracabilite. */
  appelSourceId?: string | null;
  /** Extrait de transcription justifiant la ligne, pour verification humaine. */
  extraitSource?: string | null;
}

export type CodeAvertissement =
  | 'QUANTITE_MANQUANTE'
  | 'PRIX_MANQUANT'
  | 'TVA_MANQUANTE'
  | 'REMISE_INVALIDE'
  | 'MAIN_OEUVRE_POTENTIELLEMENT_DOUBLEE'
  | 'PRESTATION_ARCHIVEE'
  | 'TAUX_TVA_HETEROGENE';

export interface Avertissement {
  code: CodeAvertissement;
  message: string;
  ligneId?: string;
}

export interface LigneDevisCalculee {
  id: string;
  libelle: string;
  unite: Unite;
  quantiteMilli: Milli | null;
  prixUnitaireCents: Cents | null;
  remiseBp: Bp;
  tvaRateBp: Bp | null;
  nature: NaturePrestation;
  origine: OrigineLigne;
  appelSourceId: string | null;
  extraitSource: string | null;
  /** Montant HT avant remise. `null` tant qu'il manque quantite ou prix. */
  montantBrutHtCents: Cents | null;
  remiseCents: Cents | null;
  /** Montant HT apres remise. `null` si incomplet. */
  montantHtCents: Cents | null;
  /** `true` si la ligne ne peut pas encore etre chiffree. */
  incomplete: boolean;
  champsManquants: readonly ('quantite' | 'prix' | 'tva')[];
}

export interface PosteTva {
  rateBp: Bp;
  baseHtCents: Cents;
  montantTvaCents: Cents;
}

export type EtatDevis = 'brouillon_incomplet' | 'pret_a_verifier';

export interface TotauxDevis {
  lignes: readonly LigneDevisCalculee[];
  /** Somme des montants HT avant remise, sur les seules lignes completes. */
  sousTotalBrutHtCents: Cents;
  totalRemisesCents: Cents;
  totalHtCents: Cents;
  postesTva: readonly PosteTva[];
  totalTvaCents: Cents;
  totalTtcCents: Cents;
  /** Nombre de lignes qui ne peuvent pas encore etre chiffrees. */
  nbLignesIncompletes: number;
  etat: EtatDevis;
  avertissements: readonly Avertissement[];
}

export interface OptionsCalcul {
  /** Catalogue de l'artisan, pour detecter les prestations archivees. */
  catalogue?: readonly PrestationCatalogue[];
}

/**
 * Calcule un devis.
 *
 * Le resultat est stable : memes entrees => memes centimes, sans dependance a
 * l'horloge, au fuseau ou a un service externe.
 */
export function calculerDevis(
  lignesEntree: readonly LigneDevisEntree[],
  options: OptionsCalcul = {},
): TotauxDevis {
  const avertissements: Avertissement[] = [];
  const parId = new Map<string, PrestationCatalogue>();
  for (const prestation of options.catalogue ?? []) parId.set(prestation.id, prestation);

  const lignes: LigneDevisCalculee[] = lignesEntree.map((ligne) => {
    const champsManquants: ('quantite' | 'prix' | 'tva')[] = [];
    if (ligne.quantiteMilli === null || ligne.quantiteMilli === undefined) {
      champsManquants.push('quantite');
      avertissements.push({
        code: 'QUANTITE_MANQUANTE',
        ligneId: ligne.id,
        message: `Quantite a preciser pour "${ligne.libelle}".`,
      });
    }
    if (ligne.prixUnitaireCents === null || ligne.prixUnitaireCents === undefined) {
      champsManquants.push('prix');
      avertissements.push({
        code: 'PRIX_MANQUANT',
        ligneId: ligne.id,
        message: `Aucun prix connu pour "${ligne.libelle}". A completer depuis le catalogue ou a saisir.`,
      });
    }
    if (ligne.tvaRateBp === null || ligne.tvaRateBp === undefined) {
      champsManquants.push('tva');
      avertissements.push({
        code: 'TVA_MANQUANTE',
        ligneId: ligne.id,
        message: `Taux de TVA a choisir pour "${ligne.libelle}".`,
      });
    }

    let remiseBp = ligne.remiseBp ?? 0;
    if (remiseBp < 0 || remiseBp > BP_SCALE) {
      avertissements.push({
        code: 'REMISE_INVALIDE',
        ligneId: ligne.id,
        message: `Remise ignoree sur "${ligne.libelle}" : une remise doit etre comprise entre 0 et 100 %.`,
      });
      remiseBp = 0;
    }

    const prestation = ligne.prestationId ? parId.get(ligne.prestationId) : undefined;
    if (prestation?.archive) {
      avertissements.push({
        code: 'PRESTATION_ARCHIVEE',
        ligneId: ligne.id,
        message: `"${prestation.libelle}" est archivee dans le catalogue : verifier le prix avant envoi.`,
      });
    }

    const chiffrable = ligne.quantiteMilli !== null && ligne.prixUnitaireCents !== null;
    const montantBrutHtCents = chiffrable
      ? multiplyQuantity(ligne.quantiteMilli as Milli, ligne.prixUnitaireCents as Cents)
      : null;
    const remiseCents = montantBrutHtCents === null ? null : applyBp(montantBrutHtCents, remiseBp);
    const montantHtCents =
      montantBrutHtCents === null || remiseCents === null ? null : montantBrutHtCents - remiseCents;

    return {
      id: ligne.id,
      libelle: ligne.libelle,
      unite: ligne.unite,
      quantiteMilli: ligne.quantiteMilli,
      prixUnitaireCents: ligne.prixUnitaireCents,
      remiseBp,
      tvaRateBp: ligne.tvaRateBp,
      nature: ligne.nature,
      origine: ligne.origine,
      appelSourceId: ligne.appelSourceId ?? null,
      extraitSource: ligne.extraitSource ?? null,
      montantBrutHtCents,
      remiseCents,
      montantHtCents,
      incomplete: champsManquants.length > 0,
      champsManquants,
    } satisfies LigneDevisCalculee;
  });

  avertissements.push(...detecterDoubleMainOeuvre(lignesEntree, parId));

  const lignesCompletes = lignes.filter(
    (ligne): ligne is LigneDevisCalculee & { montantHtCents: Cents; tvaRateBp: Bp } =>
      !ligne.incomplete && ligne.montantHtCents !== null && ligne.tvaRateBp !== null,
  );

  const sousTotalBrutHtCents = sum(lignesCompletes.map((l) => l.montantBrutHtCents ?? 0));
  const totalRemisesCents = sum(lignesCompletes.map((l) => l.remiseCents ?? 0));
  const totalHtCents = sum(lignesCompletes.map((l) => l.montantHtCents));

  // La TVA se calcule par taux, sur la base HT deja remisee, puis s'arrondit
  // une seule fois par poste. Arrondir ligne par ligne creerait des ecarts
  // d'un centime avec la comptabilite.
  const bases = new Map<Bp, Cents>();
  for (const ligne of lignesCompletes) {
    bases.set(ligne.tvaRateBp, (bases.get(ligne.tvaRateBp) ?? 0) + ligne.montantHtCents);
  }
  const postesTva: PosteTva[] = [...bases.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rateBp, baseHtCents]) => ({
      rateBp,
      baseHtCents,
      montantTvaCents: applyBp(baseHtCents, rateBp),
    }));

  if (postesTva.length > 1) {
    avertissements.push({
      code: 'TAUX_TVA_HETEROGENE',
      message:
        'Ce devis melange plusieurs taux de TVA. Verifier que chaque ligne releve bien du taux applique.',
    });
  }

  const totalTvaCents = sum(postesTva.map((p) => p.montantTvaCents));
  const nbLignesIncompletes = lignes.filter((l) => l.incomplete).length;

  return {
    lignes,
    sousTotalBrutHtCents,
    totalRemisesCents,
    totalHtCents,
    postesTva,
    totalTvaCents,
    totalTtcCents: totalHtCents + totalTvaCents,
    nbLignesIncompletes,
    etat: nbLignesIncompletes > 0 ? 'brouillon_incomplet' : 'pret_a_verifier',
    avertissements,
  };
}

/**
 * Detecte le double comptage de main-d'oeuvre.
 *
 * Cas vise : le devis contient un "forfait pose" (prix tout compris) ET une
 * ligne de main-d'oeuvre separee. Le moteur n'enleve rien tout seul - il
 * signale, et l'artisan tranche.
 */
function detecterDoubleMainOeuvre(
  lignes: readonly LigneDevisEntree[],
  parId: ReadonlyMap<string, PrestationCatalogue>,
): Avertissement[] {
  const forfaits = lignes.filter((l) => l.nature === 'forfait_pose');
  if (forfaits.length === 0) return [];

  const lignesMainOeuvre = lignes.filter((l) => l.nature === 'main_oeuvre');
  if (lignesMainOeuvre.length === 0) return [];

  const forfaitsAvecMainOeuvre = forfaits.filter((l) => {
    const prestation = l.prestationId ? parId.get(l.prestationId) : undefined;
    // Sans catalogue rattache, on part du principe qu'un forfait pose inclut
    // la pose : c'est la definition meme du forfait.
    return prestation ? (prestation.tempsMainOeuvreMinutes ?? 0) > 0 || true : true;
  });
  if (forfaitsAvecMainOeuvre.length === 0) return [];

  return lignesMainOeuvre.map((ligne) => ({
    code: 'MAIN_OEUVRE_POTENTIELLEMENT_DOUBLEE' as const,
    ligneId: ligne.id,
    message:
      `"${ligne.libelle}" facture de la main-d'oeuvre alors que le devis contient deja ` +
      `${String(forfaitsAvecMainOeuvre.length)} forfait(s) pose, pose comprise. ` +
      'Verifier que cette main-d oeuvre n est pas comptee deux fois.',
  }));
}

/**
 * Construit une ligne a partir d'une prestation du catalogue.
 * C'est le seul chemin autorise pour qu'un prix entre dans un devis
 * automatiquement : il vient du catalogue de l'artisan, jamais d'une analyse.
 */
export function ligneDepuisCatalogue(params: {
  id: string;
  prestation: PrestationCatalogue;
  quantiteMilli: Milli | null;
  remiseBp?: Bp;
  origine?: OrigineLigne;
  appelSourceId?: string | null;
  extraitSource?: string | null;
}): LigneDevisEntree {
  const { prestation } = params;
  return {
    id: params.id,
    prestationId: prestation.id,
    libelle: prestation.libelle,
    unite: prestation.unite,
    quantiteMilli: params.quantiteMilli,
    prixUnitaireCents: prestation.prixVenteCents,
    tvaRateBp: prestation.tvaRateBp,
    remiseBp: params.remiseBp ?? 0,
    nature: prestation.nature,
    origine: params.origine ?? 'catalogue',
    appelSourceId: params.appelSourceId ?? null,
    extraitSource: params.extraitSource ?? null,
  };
}

/**
 * Marge indicative d'un devis, calculee seulement sur les lignes dont le cout
 * d'achat est renseigne. Retourne `null` si aucun cout n'est connu, plutot
 * qu'un zero trompeur.
 */
export function margeIndicative(
  lignes: readonly LigneDevisCalculee[],
  catalogue: readonly PrestationCatalogue[],
  liaisons: ReadonlyMap<string, string>,
): { margeCents: Cents; couvertureBp: Bp } | null {
  const parId = new Map(catalogue.map((p) => [p.id, p]));
  let baseConnueHt = 0;
  let coutTotal = 0;
  let baseTotaleHt = 0;
  let auMoinsUnCout = false;

  for (const ligne of lignes) {
    if (ligne.montantHtCents === null || ligne.quantiteMilli === null) continue;
    baseTotaleHt += ligne.montantHtCents;
    const prestationId = liaisons.get(ligne.id);
    const prestation = prestationId ? parId.get(prestationId) : undefined;
    const cout = prestation?.coutAchatCents;
    if (cout === null || cout === undefined) continue;
    auMoinsUnCout = true;
    baseConnueHt += ligne.montantHtCents;
    coutTotal += multiplyQuantity(ligne.quantiteMilli, cout);
  }

  if (!auMoinsUnCout || baseTotaleHt === 0) return null;
  return {
    margeCents: baseConnueHt - coutTotal,
    couvertureBp: roundHalfUp(baseConnueHt * BP_SCALE, baseTotaleHt),
  };
}
