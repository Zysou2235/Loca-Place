/**
 * Resolution des dates relatives entendues en appel, en heure francaise.
 *
 * Un artisan dit "jeudi matin", pas "2026-03-26T09:00:00+01:00". Ce module
 * transforme l'un en l'autre, a partir de la date de l'appel et du fuseau de
 * l'entreprise (Europe/Paris par defaut), en signalant explicitement :
 *  - les changements d'heure (heure inexistante ou heure doublee) ;
 *  - les expressions ambigues ("vendredi" : celui-ci ou le prochain ?) ;
 *  - l'absence d'heure precise.
 *
 * Rien ici ne cree un rendez-vous confirme : la sortie est toujours une
 * *proposition* que l'artisan valide.
 */

export const FUSEAU_PAR_DEFAUT = 'Europe/Paris';

export interface ComposantesLocales {
  annee: number;
  mois: number; // 1-12
  jour: number;
  heure: number;
  minute: number;
  /** 0 = dimanche ... 6 = samedi */
  jourSemaine: number;
}

const FORMATTEURS = new Map<string, Intl.DateTimeFormat>();

function formatteur(fuseau: string): Intl.DateTimeFormat {
  let f = FORMATTEURS.get(fuseau);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    FORMATTEURS.set(fuseau, f);
  }
  return f;
}

const JOURS_COURTS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Composantes horaires locales d'un instant, dans le fuseau demande. */
export function composantesLocales(instant: Date, fuseau = FUSEAU_PAR_DEFAUT): ComposantesLocales {
  const parts = formatteur(fuseau).formatToParts(instant);
  const lu = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return {
    annee: Number(lu('year')),
    mois: Number(lu('month')),
    jour: Number(lu('day')),
    heure: Number(lu('hour')),
    minute: Number(lu('minute')),
    jourSemaine: JOURS_COURTS[lu('weekday')] ?? 0,
  };
}

/** Decalage du fuseau par rapport a UTC, en minutes, a cet instant. */
export function decalageMinutes(instant: Date, fuseau = FUSEAU_PAR_DEFAUT): number {
  const c = composantesLocales(instant, fuseau);
  const commeUtc = Date.UTC(c.annee, c.mois - 1, c.jour, c.heure, c.minute);
  // On ignore les secondes : le decalage d'un fuseau est toujours un multiple
  // de la minute.
  const instantMinutes = Math.floor(instant.getTime() / 60000) * 60000;
  return Math.round((commeUtc - instantMinutes) / 60000);
}

export type AnomalieHeure = 'aucune' | 'heure_inexistante' | 'heure_doublee';

export interface ResultatInstant {
  instant: Date;
  anomalie: AnomalieHeure;
}

/**
 * Convertit une heure murale francaise en instant UTC.
 *
 * Deux cas particuliers, tous deux signales et jamais avales en silence :
 *  - `heure_inexistante` : le dernier dimanche de mars, 02h30 n'existe pas.
 *    L'instant retourne est le premier instant valide qui suit.
 *  - `heure_doublee` : le dernier dimanche d'octobre, 02h30 existe deux fois.
 *    L'instant retourne est la premiere occurrence (heure d'ete).
 */
export function heureLocaleVersInstant(
  c: { annee: number; mois: number; jour: number; heure: number; minute: number },
  fuseau = FUSEAU_PAR_DEFAUT,
): ResultatInstant {
  const murale = Date.UTC(c.annee, c.mois - 1, c.jour, c.heure, c.minute);
  const decalage1 = decalageMinutes(new Date(murale), fuseau);
  const essai1 = murale - decalage1 * 60000;
  const decalage2 = decalageMinutes(new Date(essai1), fuseau);

  if (decalage1 === decalage2) {
    // Verifie s'il existe un second instant valide (heure doublee a l'automne).
    const essaiAlternatif = murale - (decalage1 + 60) * 60000;
    const decalageAlternatif = decalageMinutes(new Date(essaiAlternatif), fuseau);
    if (decalageAlternatif === decalage1 + 60) {
      return { instant: new Date(essaiAlternatif), anomalie: 'heure_doublee' };
    }
    return { instant: new Date(essai1), anomalie: 'aucune' };
  }

  const essai2 = murale - decalage2 * 60000;
  if (decalageMinutes(new Date(essai2), fuseau) === decalage2) {
    return { instant: new Date(essai2), anomalie: 'aucune' };
  }
  // Aucun instant ne correspond a cette heure murale : elle a ete sautee.
  return { instant: new Date(essai1), anomalie: 'heure_inexistante' };
}

export type Creneau = 'matin' | 'apres_midi' | 'soir' | 'journee';

/** Heure de debut conventionnelle d'un creneau, a confirmer avec le client. */
export const HEURES_CRENEAUX: Record<Creneau, { heure: number; minute: number }> = {
  matin: { heure: 8, minute: 0 },
  apres_midi: { heure: 14, minute: 0 },
  soir: { heure: 18, minute: 0 },
  journee: { heure: 8, minute: 0 },
};

export const JOURS_SEMAINE_FR: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

export type PrecisionDate = 'heure' | 'creneau' | 'jour';

export interface PropositionDate {
  /** Instant propose, en UTC. */
  instant: Date;
  precision: PrecisionDate;
  creneau: Creneau | null;
  /** `true` si plusieurs lectures sont defendables : il faut demander au client. */
  ambigu: boolean;
  /** Explication en francais, affichee telle quelle a l'artisan. */
  explication: string;
  anomalieHeure: AnomalieHeure;
}

export interface OptionsResolution {
  fuseau?: string;
  /**
   * "vendredi" prononce un mercredi designe-t-il le vendredi de cette semaine ?
   * Par defaut oui : c'est la lecture la plus courante en chantier. On la
   * signale quand meme comme ambigue si l'ecart depasse ce seuil de jours.
   */
  seuilAmbiguiteJours?: number;
}

/**
 * Resout une expression de date relative prononcee pendant un appel.
 *
 * Expressions reconnues : "aujourd'hui", "demain", "apres-demain",
 * "lundi".."dimanche", eventuellement prefixees de "ce"/"cette"/"le" et
 * suffixees de "prochain"/"en huit", combinees a "matin", "apres-midi",
 * "soir", ou a une heure explicite ("a 9h", "a 14h30").
 *
 * Retourne `null` si rien n'est reconnu : mieux vaut ne rien proposer que
 * proposer une date inventee.
 */
export function resoudreDateRelative(
  expression: string,
  instantAppel: Date,
  options: OptionsResolution = {},
): PropositionDate | null {
  const fuseau = options.fuseau ?? FUSEAU_PAR_DEFAUT;
  const seuil = options.seuilAmbiguiteJours ?? 3;
  const texte = normaliser(expression);
  if (texte === '') return null;

  const base = composantesLocales(instantAppel, fuseau);
  let decalageJours: number | null = null;
  let ambigu = false;
  let explication = '';

  if (/\baujourd hui\b|\bce jour\b/.test(texte)) {
    decalageJours = 0;
    explication = "« aujourd'hui » = le jour de l'appel.";
  } else if (/\bapres demain\b/.test(texte)) {
    decalageJours = 2;
    explication = '« apres-demain » = 2 jours apres l\'appel.';
  } else if (/\bdemain\b/.test(texte)) {
    decalageJours = 1;
    explication = '« demain » = le lendemain de l\'appel.';
  } else {
    const jour = Object.keys(JOURS_SEMAINE_FR).find((nom) =>
      new RegExp(`\\b${nom}\\b`).test(texte),
    );
    if (jour !== undefined) {
      const cible = JOURS_SEMAINE_FR[jour] as number;
      const semaineProchaine = /\bprochain\b|\bprochaine\b|\ben huit\b|\bsemaine prochaine\b/.test(
        texte,
      );
      let ecart = (cible - base.jourSemaine + 7) % 7;
      if (ecart === 0) ecart = 7; // "mardi" dit un mardi = le mardi suivant
      if (semaineProchaine) ecart += 7;
      decalageJours = ecart;
      explication = `« ${jour} » a partir du ${formatDateFr(instantAppel, fuseau)} = dans ${String(ecart)} jour(s).`;
      if (!semaineProchaine && ecart > seuil) {
        ambigu = true;
        explication += ` Ecart superieur a ${String(seuil)} jours : demander au client s'il parlait de cette semaine ou de la suivante.`;
      }
    }
  }

  if (decalageJours === null) return null;

  const creneau = detecterCreneau(texte);
  const heureExplicite = detecterHeure(texte);

  const jourCible = ajouterJours(base, decalageJours);
  let precision: PrecisionDate;
  let heure: number;
  let minute: number;

  if (heureExplicite) {
    precision = 'heure';
    heure = heureExplicite.heure;
    minute = heureExplicite.minute;
    explication += ` Heure entendue : ${String(heure)}h${String(minute).padStart(2, '0')}.`;
  } else if (creneau) {
    precision = 'creneau';
    const conv = HEURES_CRENEAUX[creneau];
    heure = conv.heure;
    minute = conv.minute;
    explication += ` Creneau « ${creneau.replace('_', '-')} » : heure de debut a confirmer.`;
  } else {
    precision = 'jour';
    heure = 8;
    minute = 0;
    explication += ' Aucune heure precisee : a confirmer.';
  }

  const { instant, anomalie } = heureLocaleVersInstant(
    { annee: jourCible.annee, mois: jourCible.mois, jour: jourCible.jour, heure, minute },
    fuseau,
  );

  if (anomalie === 'heure_inexistante') {
    explication +=
      ' Attention : passage a l\'heure d\'ete cette nuit-la, l\'heure annoncee n\'existe pas.';
    ambigu = true;
  } else if (anomalie === 'heure_doublee') {
    explication +=
      ' Attention : passage a l\'heure d\'hiver cette nuit-la, cette heure existe deux fois.';
    ambigu = true;
  }

  return {
    instant,
    precision,
    creneau: creneau ?? null,
    ambigu,
    explication,
    anomalieHeure: anomalie,
  };
}

function ajouterJours(
  base: ComposantesLocales,
  jours: number,
): { annee: number; mois: number; jour: number } {
  const d = new Date(Date.UTC(base.annee, base.mois - 1, base.jour));
  d.setUTCDate(d.getUTCDate() + jours);
  return { annee: d.getUTCFullYear(), mois: d.getUTCMonth() + 1, jour: d.getUTCDate() };
}

function detecterCreneau(texte: string): Creneau | null {
  if (/\bapres midi\b|\bapresmidi\b/.test(texte)) return 'apres_midi';
  if (/\bmatin\b|\bmatinee\b/.test(texte)) return 'matin';
  if (/\bsoir\b|\bsoiree\b|\bfin de journee\b/.test(texte)) return 'soir';
  if (/\bjournee\b|\btoute la journee\b/.test(texte)) return 'journee';
  return null;
}

function detecterHeure(texte: string): { heure: number; minute: number } | null {
  const m = /\b(\d{1,2})\s*(?:h|heures?)\s*(\d{1,2})?\b/.exec(texte);
  if (!m) return null;
  const heure = Number(m[1]);
  const minute = m[2] === undefined ? 0 : Number(m[2]);
  if (!Number.isInteger(heure) || heure < 0 || heure > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { heure, minute };
}

/** Minuscules, sans accents, ponctuation reduite a des espaces. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function formatDateFr(instant: Date, fuseau = FUSEAU_PAR_DEFAUT): string {
  const c = composantesLocales(instant, fuseau);
  return `${String(c.jour).padStart(2, '0')}/${String(c.mois).padStart(2, '0')}/${String(c.annee)}`;
}

export function formatDateHeureFr(instant: Date, fuseau = FUSEAU_PAR_DEFAUT): string {
  const c = composantesLocales(instant, fuseau);
  return `${formatDateFr(instant, fuseau)} ${String(c.heure).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
}
