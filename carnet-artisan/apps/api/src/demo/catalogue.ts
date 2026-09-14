import { TAUX_TVA } from '@carnet/shared';

/**
 * Catalogue de demonstration.
 *
 * Prix FICTIFS, arrondis, choisis pour illustrer le fonctionnement du moteur
 * de devis. Ce ne sont pas les tarifs de NC Electricite ni ceux d'aucune
 * entreprise reelle, et ils ne proviennent d'aucune base commerciale.
 * Chaque artisan saisit ou importe les siens.
 */
export const CATALOGUE_DEMO = [
  {
    reference: 'DEMO-PC16',
    libelle: 'Prise de courant 16 A, pose comprise',
    description: 'Fourniture et pose d une prise 16 A sur circuit existant. Prix fictif.',
    unite: 'u',
    prixVenteCents: 8500,
    coutAchatCents: 1200,
    tempsMainOeuvreMinutes: 45,
    nature: 'FORFAIT_POSE' as const,
    tvaRateBp: TAUX_TVA.INTERMEDIAIRE,
  },
  {
    reference: 'DEMO-SPOT',
    libelle: 'Spot encastre LED, pose comprise',
    description: 'Fourniture et pose d un spot encastre en faux plafond. Prix fictif.',
    unite: 'u',
    prixVenteCents: 6500,
    coutAchatCents: 1500,
    tempsMainOeuvreMinutes: 30,
    nature: 'FORFAIT_POSE' as const,
    tvaRateBp: TAUX_TVA.INTERMEDIAIRE,
  },
  {
    reference: 'DEMO-MO',
    libelle: 'Main-d oeuvre electricien',
    description: 'Temps passe hors forfait. Prix fictif.',
    unite: 'h',
    prixVenteCents: 4500,
    coutAchatCents: null,
    tempsMainOeuvreMinutes: 60,
    nature: 'MAIN_OEUVRE' as const,
    tvaRateBp: TAUX_TVA.INTERMEDIAIRE,
  },
  {
    reference: 'DEMO-DEPL',
    libelle: 'Deplacement',
    description: 'Forfait de deplacement. Prix fictif.',
    unite: 'forfait',
    prixVenteCents: 3500,
    coutAchatCents: null,
    tempsMainOeuvreMinutes: null,
    nature: 'FRAIS' as const,
    tvaRateBp: TAUX_TVA.INTERMEDIAIRE,
  },
  {
    reference: 'DEMO-DIAG',
    libelle: 'Diagnostic d installation electrique',
    description: 'Visite de diagnostic avec compte rendu. Prix fictif.',
    unite: 'forfait',
    prixVenteCents: 9000,
    coutAchatCents: null,
    tempsMainOeuvreMinutes: 90,
    nature: 'MAIN_OEUVRE' as const,
    tvaRateBp: TAUX_TVA.INTERMEDIAIRE,
  },
  {
    reference: 'DEMO-CABLE',
    libelle: 'Cable 3G2,5 (fourniture seule)',
    description: 'Fourniture au metre, pose non comprise. Prix fictif.',
    unite: 'ml',
    prixVenteCents: 320,
    coutAchatCents: 180,
    tempsMainOeuvreMinutes: null,
    nature: 'FOURNITURE_SEULE' as const,
    tvaRateBp: TAUX_TVA.INTERMEDIAIRE,
  },
] as const;
