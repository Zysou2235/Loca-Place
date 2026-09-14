/**
 * Rattachement d'un appel a un client et a un chantier.
 *
 * Le numero de telephone identifie souvent le client, presque jamais le
 * chantier : un meme client peut avoir une maison, un appartement loue et un
 * local professionnel. Ce module propose, explique, et signale les cas ou il
 * faut demander. Il ne tranche jamais tout seul une ambiguite.
 */

import { normaliser, type PropositionAssociation } from '@carnet/shared';

export interface ChantierConnu {
  id: string;
  clientId: string;
  libelle: string;
  adresse: string | null;
  actif: boolean;
}

export interface ClientConnu {
  id: string;
  nom: string;
  telephones: readonly string[];
}

export interface ContexteAssociation {
  numeroDistant: string | null;
  numeroMasque: boolean;
  /** Adresse de chantier entendue dans l'appel, si elle a ete dite. */
  adresseEntendue: string | null;
  clients: readonly ClientConnu[];
  chantiers: readonly ChantierConnu[];
}

/**
 * Normalise un numero francais pour la comparaison : "02 96 12 34 56",
 * "+33296123456" et "0296123456" designent le meme abonne.
 */
export function normaliserNumero(numero: string): string {
  const chiffres = numero.replace(/[^0-9+]/g, '');
  if (chiffres.startsWith('+33')) return `0${chiffres.slice(3)}`;
  if (chiffres.startsWith('0033')) return `0${chiffres.slice(4)}`;
  if (chiffres.startsWith('33') && chiffres.length === 11) return `0${chiffres.slice(2)}`;
  return chiffres;
}

export function proposerAssociation(contexte: ContexteAssociation): PropositionAssociation {
  if (contexte.numeroMasque || !contexte.numeroDistant) {
    return {
      clientId: null,
      chantierId: null,
      statut: 'AUCUN',
      justification:
        'Numero masque : aucun rattachement automatique. A rattacher a la main si vous identifiez l appelant.',
      alternatives: [],
    };
  }

  const numero = normaliserNumero(contexte.numeroDistant);
  const correspondants = contexte.clients.filter((c) =>
    c.telephones.some((t) => normaliserNumero(t) === numero),
  );

  if (correspondants.length === 0) {
    return {
      clientId: null,
      chantierId: null,
      statut: 'AUCUN',
      justification: `Aucun client connu avec le numero ${contexte.numeroDistant}. A creer si c est un nouveau client.`,
      alternatives: [],
    };
  }

  if (correspondants.length > 1) {
    // Deux fiches partagent le meme numero : souvent un doublon a fusionner.
    return {
      clientId: null,
      chantierId: null,
      statut: 'A_CONFIRMER',
      justification: `${String(correspondants.length)} fiches clients portent ce numero. Choisissez laquelle rattacher.`,
      alternatives: correspondants.map((c) => ({
        clientId: c.id,
        chantierId: null,
        libelle: c.nom,
      })),
    };
  }

  const client = correspondants[0] as ClientConnu;
  const chantiersDuClient = contexte.chantiers.filter((ch) => ch.clientId === client.id && ch.actif);

  if (chantiersDuClient.length === 0) {
    return {
      clientId: client.id,
      chantierId: null,
      statut: 'A_CONFIRMER',
      justification: `Client reconnu : ${client.nom}. Aucun chantier actif : creez-en un pour cette demande.`,
      alternatives: [],
    };
  }

  const parAdresse = contexte.adresseEntendue
    ? chantiersDuClient.filter((ch) => adressesConcordent(ch, contexte.adresseEntendue as string))
    : [];

  if (parAdresse.length === 1) {
    const chantier = parAdresse[0] as ChantierConnu;
    // Une adresse entendue qui colle a un seul chantier est un bon indice,
    // mais elle vient d'une transcription : on laisse l'artisan confirmer.
    return {
      clientId: client.id,
      chantierId: chantier.id,
      statut: chantiersDuClient.length === 1 ? 'CERTAIN' : 'A_CONFIRMER',
      justification:
        chantiersDuClient.length === 1
          ? `Client ${client.nom}, un seul chantier actif : ${chantier.libelle}.`
          : `L adresse entendue correspond au chantier "${chantier.libelle}". A confirmer : ce client a ${String(chantiersDuClient.length)} chantiers actifs.`,
      alternatives: chantiersDuClient
        .filter((ch) => ch.id !== chantier.id)
        .map((ch) => ({ clientId: client.id, chantierId: ch.id, libelle: ch.libelle })),
    };
  }

  if (chantiersDuClient.length === 1) {
    const chantier = chantiersDuClient[0] as ChantierConnu;
    return {
      clientId: client.id,
      chantierId: chantier.id,
      statut: 'CERTAIN',
      justification: `Client ${client.nom}, un seul chantier actif : ${chantier.libelle}.`,
      alternatives: [],
    };
  }

  return {
    clientId: client.id,
    chantierId: null,
    statut: 'A_CONFIRMER',
    justification: `Client reconnu : ${client.nom}, mais ${String(chantiersDuClient.length)} chantiers actifs. Indiquez lequel est concerne.`,
    alternatives: chantiersDuClient.map((ch) => ({
      clientId: client.id,
      chantierId: ch.id,
      libelle: ch.libelle,
    })),
  };
}

/**
 * Concordance d'adresses volontairement prudente : il faut qu'un mot
 * significatif de l'adresse du chantier (nom de rue, ville) apparaisse dans ce
 * qui a ete entendu. Les mots outils ("rue", "de", "la") sont ecartes pour ne
 * pas faire correspondre deux adresses qui n'ont que "rue" en commun.
 */
const MOTS_OUTILS = new Set([
  'rue', 'avenue', 'boulevard', 'impasse', 'chemin', 'route', 'place', 'allee', 'lieu', 'dit',
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'bis', 'ter',
]);

export function adressesConcordent(chantier: ChantierConnu, adresseEntendue: string): boolean {
  const source = normaliser(`${chantier.adresse ?? ''} ${chantier.libelle}`);
  const entendue = normaliser(adresseEntendue);
  if (source.trim() === '' || entendue.trim() === '') return false;
  const motsSource = new Set(
    source.split(' ').filter((m) => m.length >= 3 && !MOTS_OUTILS.has(m)),
  );
  const motsEntendus = entendue.split(' ').filter((m) => m.length >= 3 && !MOTS_OUTILS.has(m));
  return motsEntendus.some((m) => motsSource.has(m));
}
