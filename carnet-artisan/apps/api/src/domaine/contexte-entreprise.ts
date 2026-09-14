/**
 * Acces aux donnees, toujours borne a une entreprise.
 *
 * Toutes les lectures et ecritures metier passent par cette classe. Elle ne
 * propose aucune methode capable de lire une ligne sans filtre `entrepriseId`,
 * et l'identifiant d'entreprise vient du jeton de session, jamais du corps de
 * la requete. Un artisan ne peut donc pas atteindre les donnees d'un autre en
 * changeant un identifiant dans une URL : la ligne demandee est simplement
 * introuvable.
 */

import type { PrismaClient } from '../db.js';

export class RessourceIntrouvable extends Error {
  override readonly name = 'RessourceIntrouvable';
  constructor(quoi: string) {
    super(`${quoi} introuvable.`);
  }
}

export class ContexteEntreprise {
  constructor(
    private readonly db: PrismaClient,
    readonly entrepriseId: string,
  ) {}

  private get filtre(): { entrepriseId: string } {
    return { entrepriseId: this.entrepriseId };
  }

  // --- Entreprise -----------------------------------------------------------

  async entreprise() {
    const entreprise = await this.db.entreprise.findUnique({ where: { id: this.entrepriseId } });
    if (!entreprise) throw new RessourceIntrouvable('Entreprise');
    return entreprise;
  }

  async configTelephonie() {
    return this.db.configTelephonie.findUnique({ where: { entrepriseId: this.entrepriseId } });
  }

  // --- Clients et chantiers -------------------------------------------------

  async listerClients() {
    return this.db.client.findMany({
      where: this.filtre,
      orderBy: { nom: 'asc' },
      include: { chantiers: { where: this.filtre, orderBy: { creeA: 'desc' } } },
    });
  }

  async trouverClient(id: string) {
    const client = await this.db.client.findFirst({ where: { id, ...this.filtre } });
    if (!client) throw new RessourceIntrouvable('Client');
    return client;
  }

  async trouverChantier(id: string) {
    const chantier = await this.db.chantier.findFirst({
      where: { id, ...this.filtre },
      include: {
        client: true,
        appels: { orderBy: { debut: 'desc' }, take: 50 },
        taches: { orderBy: { creeA: 'desc' } },
        devis: { orderBy: { creeA: 'desc' } },
        notes: { orderBy: { creeA: 'desc' } },
      },
    });
    if (!chantier) throw new RessourceIntrouvable('Chantier');
    return chantier;
  }

  async creerClient(donnees: { nom: string; telephones?: string[]; email?: string | null; notes?: string | null }) {
    return this.db.client.create({
      data: {
        ...this.filtre,
        nom: donnees.nom,
        telephones: donnees.telephones ?? [],
        email: donnees.email ?? null,
        notes: donnees.notes ?? null,
      },
    });
  }

  async creerChantier(donnees: {
    clientId: string;
    libelle: string;
    adresse?: string | null;
    description?: string | null;
  }) {
    // Verifie que le client appartient bien a cette entreprise avant de lier.
    await this.trouverClient(donnees.clientId);
    return this.db.chantier.create({
      data: {
        ...this.filtre,
        clientId: donnees.clientId,
        libelle: donnees.libelle,
        adresse: donnees.adresse ?? null,
        description: donnees.description ?? null,
      },
    });
  }

  // --- Appels ---------------------------------------------------------------

  async listerAppels(options: { limite?: number; statut?: string } = {}) {
    return this.db.appel.findMany({
      where: {
        ...this.filtre,
        ...(options.statut ? { statutTraitement: options.statut as never } : {}),
      },
      orderBy: { debut: 'desc' },
      take: Math.min(options.limite ?? 50, 200),
      include: { client: true, chantier: true },
    });
  }

  async trouverAppel(id: string) {
    const appel = await this.db.appel.findFirst({
      where: { id, ...this.filtre },
      include: { client: true, chantier: true, analyse: true, transcription: true },
    });
    if (!appel) throw new RessourceIntrouvable('Appel');
    return appel;
  }

  /**
   * Corrige a la main le rattachement d'un appel.
   * Le client et le chantier vises sont revalides : impossible de rattacher
   * un appel au chantier d'une autre entreprise.
   */
  async corrigerAssociationAppel(appelId: string, cible: { clientId: string | null; chantierId: string | null }) {
    await this.trouverAppel(appelId);
    if (cible.clientId) await this.trouverClient(cible.clientId);
    if (cible.chantierId) {
      const chantier = await this.db.chantier.findFirst({
        where: { id: cible.chantierId, ...this.filtre },
      });
      if (!chantier) throw new RessourceIntrouvable('Chantier');
      if (cible.clientId && chantier.clientId !== cible.clientId) {
        throw new RessourceIntrouvable('Chantier du client demande');
      }
    }
    return this.db.appel.update({
      where: { id: appelId },
      data: {
        clientId: cible.clientId,
        chantierId: cible.chantierId,
        statutAssociation: 'CORRIGE_MANUELLEMENT',
        justificationAssociation: 'Rattachement corrige par l artisan.',
      },
    });
  }

  // --- Catalogue ------------------------------------------------------------

  async listerPrestations(options: { inclureArchivees?: boolean } = {}) {
    return this.db.prestation.findMany({
      where: { ...this.filtre, ...(options.inclureArchivees ? {} : { archive: false }) },
      orderBy: { reference: 'asc' },
    });
  }

  async trouverPrestation(id: string) {
    const prestation = await this.db.prestation.findFirst({ where: { id, ...this.filtre } });
    if (!prestation) throw new RessourceIntrouvable('Prestation');
    return prestation;
  }

  // --- Devis ----------------------------------------------------------------

  async listerDevis() {
    return this.db.devis.findMany({
      where: this.filtre,
      orderBy: { creeA: 'desc' },
      include: { chantier: { include: { client: true } } },
    });
  }

  async trouverDevis(id: string) {
    const devis = await this.db.devis.findFirst({
      where: { id, ...this.filtre },
      include: { lignes: { orderBy: { position: 'asc' } }, chantier: { include: { client: true } } },
    });
    if (!devis) throw new RessourceIntrouvable('Devis');
    return devis;
  }

  // --- Taches et rendez-vous ------------------------------------------------

  async listerTaches(options: { seulementAFaire?: boolean } = {}) {
    return this.db.tache.findMany({
      where: { ...this.filtre, ...(options.seulementAFaire ? { statut: 'A_FAIRE' } : {}) },
      orderBy: [{ echeance: 'asc' }, { creeA: 'desc' }],
    });
  }

  async listerRendezVous(options: { depuis?: Date } = {}) {
    return this.db.rendezVous.findMany({
      where: {
        ...this.filtre,
        ...(options.depuis ? { debutPropose: { gte: options.depuis } } : {}),
      },
      orderBy: { debutPropose: 'asc' },
      include: { chantier: { include: { client: true } } },
    });
  }

  async trouverRendezVous(id: string) {
    const rdv = await this.db.rendezVous.findFirst({ where: { id, ...this.filtre } });
    if (!rdv) throw new RessourceIntrouvable('Rendez-vous');
    return rdv;
  }

  async trouverTache(id: string) {
    const tache = await this.db.tache.findFirst({ where: { id, ...this.filtre } });
    if (!tache) throw new RessourceIntrouvable('Tache');
    return tache;
  }

  // --- Suppression et export ------------------------------------------------

  /**
   * Supprime toutes les donnees de l'entreprise.
   *
   * Les cascades de la base font le gros du travail ; les fichiers sur disque
   * sont supprimes separement par l'appelant, qui recupere ici leurs chemins.
   * On ne pretend jamais avoir tout efface avant que les deux soient faits.
   */
  async cheminsFichiersASupprimer(): Promise<string[]> {
    const [audios, devis] = await Promise.all([
      this.db.fichierAudio.findMany({ where: this.filtre, select: { chemin: true } }),
      this.db.devis.findMany({
        where: { ...this.filtre, cheminPdf: { not: null } },
        select: { cheminPdf: true },
      }),
    ]);
    return [
      ...audios.map((a) => a.chemin),
      ...devis.map((d) => d.cheminPdf).filter((c): c is string => c !== null),
    ];
  }

  async supprimerToutesLesDonnees(): Promise<void> {
    await this.db.entreprise.delete({ where: { id: this.entrepriseId } });
  }
}
