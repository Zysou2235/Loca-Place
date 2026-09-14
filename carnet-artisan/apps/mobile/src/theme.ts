/**
 * Apparence : sobre, contrastee, lisible en plein soleil sur un chantier.
 * Pas de degrades, pas d'animation superflue, des zones tactiles larges
 * (un artisan a souvent les mains sales ou des gants).
 */

export const couleurs = {
  fond: '#f5f5f4',
  carte: '#ffffff',
  texte: '#1c1917',
  texteSecondaire: '#57534e',
  bordure: '#e7e5e4',
  accent: '#1d4ed8',
  accentTexte: '#ffffff',
  succes: '#15803d',
  attention: '#b45309',
  erreur: '#b91c1c',
  demonstration: '#7c3aed',
} as const;

export const espaces = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

export const typo = {
  titre: { fontSize: 22, fontWeight: '700' as const },
  section: { fontSize: 17, fontWeight: '600' as const },
  corps: { fontSize: 15, fontWeight: '400' as const },
  petit: { fontSize: 13, fontWeight: '400' as const },
} as const;

/** Hauteur minimale d'une zone tactile, recommandation Apple et Google. */
export const TAILLE_TACTILE_MIN = 44;
