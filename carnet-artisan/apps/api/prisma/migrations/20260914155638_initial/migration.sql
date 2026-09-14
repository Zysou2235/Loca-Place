-- CreateEnum
CREATE TYPE "ModeExecution" AS ENUM ('DEMONSTRATION', 'REEL');

-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('PROPRIETAIRE', 'MEMBRE');

-- CreateEnum
CREATE TYPE "EtatTelephonie" AS ENUM ('NON_CONFIGURE', 'EN_ATTENTE_FOURNISSEUR', 'EN_ATTENTE_RENVOI_OPERATEUR', 'PRET_A_TESTER', 'TEST_REUSSI', 'ERREUR');

-- CreateEnum
CREATE TYPE "DirectionAppel" AS ENUM ('ENTRANT', 'SORTANT', 'INTERNE');

-- CreateEnum
CREATE TYPE "StatutTraitementAppel" AS ENUM ('RECU', 'EN_ATTENTE_ENREGISTREMENT', 'AUDIO_TELECHARGE', 'TRANSCRIPTION_EN_COURS', 'ANALYSE_EN_COURS', 'ANALYSE_TERMINEE', 'SANS_ENREGISTREMENT', 'ECHEC');

-- CreateEnum
CREATE TYPE "StatutAssociation" AS ENUM ('CERTAIN', 'A_CONFIRMER', 'AUCUN', 'CORRIGE_MANUELLEMENT');

-- CreateEnum
CREATE TYPE "NaturePrestation" AS ENUM ('FOURNITURE_SEULE', 'FORFAIT_POSE', 'MAIN_OEUVRE', 'FRAIS');

-- CreateEnum
CREATE TYPE "StatutDevis" AS ENUM ('BROUILLON_INCOMPLET', 'PRET_A_VERIFIER', 'VALIDE', 'EXPORTE');

-- CreateEnum
CREATE TYPE "StatutTache" AS ENUM ('A_FAIRE', 'FAITE', 'ABANDONNEE');

-- CreateEnum
CREATE TYPE "StatutRendezVous" AS ENUM ('PROPOSE', 'VALIDE', 'REFUSE');

-- CreateEnum
CREATE TYPE "StatutJob" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ECHEC_DEFINITIF');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('ESSAI', 'ACTIF', 'IMPAYE', 'SUSPENDU', 'RESILIE');

-- CreateTable
CREATE TABLE "Entreprise" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "metier" TEXT NOT NULL,
    "nomArtisan" TEXT NOT NULL,
    "telephonePro" TEXT NOT NULL,
    "emailContact" TEXT NOT NULL,
    "siret" TEXT,
    "adresseLigne1" TEXT,
    "codePostal" TEXT,
    "ville" TEXT,
    "fuseau" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "mode" "ModeExecution" NOT NULL DEFAULT 'DEMONSTRATION',
    "jetonWebhook" TEXT NOT NULL,
    "retentionAudioJours" INTEGER NOT NULL DEFAULT 30,
    "retentionTranscriptionJours" INTEGER NOT NULL DEFAULT 365,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entreprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "nomAffiche" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL DEFAULT 'PROPRIETAIRE',
    "derniereConnexion" TIMESTAMP(3),
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigTelephonie" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL DEFAULT 'zadarma',
    "etat" "EtatTelephonie" NOT NULL DEFAULT 'NON_CONFIGURE',
    "detail" TEXT NOT NULL DEFAULT 'Aucune configuration telephonique.',
    "identifiantFournisseur" TEXT,
    "cleApiChiffree" TEXT,
    "secretApiChiffre" TEXT,
    "numeroTechnique" TEXT,
    "extensionPbx" TEXT,
    "sipLogin" TEXT,
    "sipMotDePasseChiffre" TEXT,
    "numeroPersonnel" TEXT,
    "renvoiConfirmeParUtilisateur" BOOLEAN NOT NULL DEFAULT false,
    "derniereVerification" TIMESTAMP(3),
    "dernierTestReussi" TIMESTAMP(3),
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigTelephonie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email" TEXT,
    "notes" TEXT,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chantier" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "adresse" TEXT,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chantier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appel" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "pbxCallId" TEXT NOT NULL,
    "direction" "DirectionAppel" NOT NULL,
    "numeroDistant" TEXT,
    "numeroMasque" BOOLEAN NOT NULL DEFAULT false,
    "numeroAppele" TEXT,
    "debut" TIMESTAMP(3) NOT NULL,
    "dureeSecondes" INTEGER NOT NULL DEFAULT 0,
    "disposition" TEXT,
    "estEnregistre" BOOLEAN NOT NULL DEFAULT false,
    "callIdAvecEnregistrement" TEXT,
    "statutTraitement" "StatutTraitementAppel" NOT NULL DEFAULT 'RECU',
    "erreurMessage" TEXT,
    "nbTentativesAnalyse" INTEGER NOT NULL DEFAULT 0,
    "resume" TEXT,
    "clientId" TEXT,
    "chantierId" TEXT,
    "statutAssociation" "StatutAssociation" NOT NULL DEFAULT 'AUCUN',
    "justificationAssociation" TEXT,
    "alternativesAssociation" JSONB,
    "estDemonstration" BOOLEAN NOT NULL DEFAULT false,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvenementTelephonie" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL DEFAULT 'zadarma',
    "type" TEXT NOT NULL,
    "cleIdempotence" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "recuA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteA" TIMESTAMP(3),
    "erreur" TEXT,

    CONSTRAINT "EvenementTelephonie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcription" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "appelId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "moteur" TEXT NOT NULL,
    "dureeAudioSecondes" INTEGER NOT NULL DEFAULT 0,
    "coutCentimes" INTEGER NOT NULL DEFAULT 0,
    "signauxInjection" JSONB,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analyse" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "appelId" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "moteur" TEXT NOT NULL,
    "versionSchema" TEXT NOT NULL DEFAULT '1',
    "coutCentimes" INTEGER NOT NULL DEFAULT 0,
    "avertissements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analyse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichierAudio" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "appelId" TEXT NOT NULL,
    "chemin" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "typeMime" TEXT NOT NULL,
    "expireA" TIMESTAMP(3) NOT NULL,
    "supprimeA" TIMESTAMP(3),
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichierAudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prestation" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "description" TEXT,
    "unite" TEXT NOT NULL,
    "prixVenteCents" INTEGER NOT NULL,
    "coutAchatCents" INTEGER,
    "tempsMainOeuvreMinutes" INTEGER,
    "nature" "NaturePrestation" NOT NULL,
    "tvaRateBp" INTEGER NOT NULL,
    "archive" BOOLEAN NOT NULL DEFAULT false,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devis" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "statut" "StatutDevis" NOT NULL DEFAULT 'BROUILLON_INCOMPLET',
    "totalHtCents" INTEGER NOT NULL DEFAULT 0,
    "totalTvaCents" INTEGER NOT NULL DEFAULT 0,
    "totalTtcCents" INTEGER NOT NULL DEFAULT 0,
    "postesTva" JSONB,
    "avertissements" JSONB,
    "valideA" TIMESTAMP(3),
    "exporteA" TIMESTAMP(3),
    "cheminPdf" TEXT,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneDevis" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "devisId" TEXT NOT NULL,
    "prestationId" TEXT,
    "position" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "quantiteMilli" INTEGER,
    "prixUnitaireCents" INTEGER,
    "tvaRateBp" INTEGER,
    "remiseBp" INTEGER NOT NULL DEFAULT 0,
    "nature" "NaturePrestation" NOT NULL,
    "origine" TEXT NOT NULL,
    "appelSourceId" TEXT,
    "extraitSource" TEXT,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LigneDevis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tache" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "chantierId" TEXT,
    "appelId" TEXT,
    "titre" TEXT NOT NULL,
    "echeance" TIMESTAMP(3),
    "priorite" TEXT NOT NULL DEFAULT 'normale',
    "statut" "StatutTache" NOT NULL DEFAULT 'A_FAIRE',
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RendezVous" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "chantierId" TEXT,
    "appelId" TEXT,
    "debutPropose" TIMESTAMP(3) NOT NULL,
    "precision" TEXT NOT NULL,
    "expressionEntendue" TEXT,
    "expressionAbandonnee" TEXT,
    "ambigu" BOOLEAN NOT NULL DEFAULT false,
    "explication" TEXT,
    "statut" "StatutRendezVous" NOT NULL DEFAULT 'PROPOSE',
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RendezVous_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteChantier" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "chantierId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "cheminPhoto" TEXT,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteChantier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT,
    "type" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "statut" "StatutJob" NOT NULL DEFAULT 'EN_ATTENTE',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "maxTentatives" INTEGER NOT NULL DEFAULT 5,
    "prochaineExecution" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verrouJusqua" TIMESTAMP(3),
    "verrouPar" TEXT,
    "derniereErreur" TEXT,
    "cleUnicite" TEXT,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageMensuel" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "minutesAudio" INTEGER NOT NULL DEFAULT 0,
    "nbAppels" INTEGER NOT NULL DEFAULT 0,
    "nbAnalyses" INTEGER NOT NULL DEFAULT 0,
    "nbReprises" INTEGER NOT NULL DEFAULT 0,
    "coutTelephonieCentimes" INTEGER NOT NULL DEFAULT 0,
    "coutTranscriptionCentimes" INTEGER NOT NULL DEFAULT 0,
    "coutIaCentimes" INTEGER NOT NULL DEFAULT 0,
    "stockageOctets" BIGINT NOT NULL DEFAULT 0,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageMensuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abonnement" (
    "id" TEXT NOT NULL,
    "entrepriseId" TEXT NOT NULL,
    "statut" "StatutAbonnement" NOT NULL DEFAULT 'ESSAI',
    "prixMensuelCentimes" INTEGER NOT NULL DEFAULT 2490,
    "finPeriode" TIMESTAMP(3),
    "referenceExterne" TEXT,
    "creeA" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieA" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Abonnement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entreprise_jetonWebhook_key" ON "Entreprise"("jetonWebhook");

-- CreateIndex
CREATE INDEX "Entreprise_mode_idx" ON "Entreprise"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE INDEX "Utilisateur_entrepriseId_idx" ON "Utilisateur"("entrepriseId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigTelephonie_entrepriseId_key" ON "ConfigTelephonie"("entrepriseId");

-- CreateIndex
CREATE INDEX "Client_entrepriseId_idx" ON "Client"("entrepriseId");

-- CreateIndex
CREATE INDEX "Client_entrepriseId_nom_idx" ON "Client"("entrepriseId", "nom");

-- CreateIndex
CREATE INDEX "Chantier_entrepriseId_idx" ON "Chantier"("entrepriseId");

-- CreateIndex
CREATE INDEX "Chantier_entrepriseId_clientId_idx" ON "Chantier"("entrepriseId", "clientId");

-- CreateIndex
CREATE INDEX "Appel_entrepriseId_debut_idx" ON "Appel"("entrepriseId", "debut");

-- CreateIndex
CREATE INDEX "Appel_entrepriseId_statutTraitement_idx" ON "Appel"("entrepriseId", "statutTraitement");

-- CreateIndex
CREATE UNIQUE INDEX "Appel_entrepriseId_pbxCallId_key" ON "Appel"("entrepriseId", "pbxCallId");

-- CreateIndex
CREATE INDEX "EvenementTelephonie_entrepriseId_recuA_idx" ON "EvenementTelephonie"("entrepriseId", "recuA");

-- CreateIndex
CREATE UNIQUE INDEX "EvenementTelephonie_entrepriseId_cleIdempotence_key" ON "EvenementTelephonie"("entrepriseId", "cleIdempotence");

-- CreateIndex
CREATE UNIQUE INDEX "Transcription_appelId_key" ON "Transcription"("appelId");

-- CreateIndex
CREATE INDEX "Transcription_entrepriseId_idx" ON "Transcription"("entrepriseId");

-- CreateIndex
CREATE UNIQUE INDEX "Analyse_appelId_key" ON "Analyse"("appelId");

-- CreateIndex
CREATE INDEX "Analyse_entrepriseId_idx" ON "Analyse"("entrepriseId");

-- CreateIndex
CREATE UNIQUE INDEX "FichierAudio_appelId_key" ON "FichierAudio"("appelId");

-- CreateIndex
CREATE INDEX "FichierAudio_entrepriseId_expireA_idx" ON "FichierAudio"("entrepriseId", "expireA");

-- CreateIndex
CREATE INDEX "Prestation_entrepriseId_archive_idx" ON "Prestation"("entrepriseId", "archive");

-- CreateIndex
CREATE UNIQUE INDEX "Prestation_entrepriseId_reference_key" ON "Prestation"("entrepriseId", "reference");

-- CreateIndex
CREATE INDEX "Devis_entrepriseId_statut_idx" ON "Devis"("entrepriseId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "Devis_entrepriseId_numero_key" ON "Devis"("entrepriseId", "numero");

-- CreateIndex
CREATE INDEX "LigneDevis_entrepriseId_idx" ON "LigneDevis"("entrepriseId");

-- CreateIndex
CREATE INDEX "LigneDevis_devisId_position_idx" ON "LigneDevis"("devisId", "position");

-- CreateIndex
CREATE INDEX "Tache_entrepriseId_statut_idx" ON "Tache"("entrepriseId", "statut");

-- CreateIndex
CREATE INDEX "Tache_entrepriseId_echeance_idx" ON "Tache"("entrepriseId", "echeance");

-- CreateIndex
CREATE INDEX "RendezVous_entrepriseId_debutPropose_idx" ON "RendezVous"("entrepriseId", "debutPropose");

-- CreateIndex
CREATE INDEX "NoteChantier_entrepriseId_chantierId_idx" ON "NoteChantier"("entrepriseId", "chantierId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_cleUnicite_key" ON "Job"("cleUnicite");

-- CreateIndex
CREATE INDEX "Job_statut_prochaineExecution_idx" ON "Job"("statut", "prochaineExecution");

-- CreateIndex
CREATE UNIQUE INDEX "UsageMensuel_entrepriseId_periode_key" ON "UsageMensuel"("entrepriseId", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "Abonnement_entrepriseId_key" ON "Abonnement"("entrepriseId");

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigTelephonie" ADD CONSTRAINT "ConfigTelephonie_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chantier" ADD CONSTRAINT "Chantier_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chantier" ADD CONSTRAINT "Chantier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appel" ADD CONSTRAINT "Appel_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appel" ADD CONSTRAINT "Appel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appel" ADD CONSTRAINT "Appel_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementTelephonie" ADD CONSTRAINT "EvenementTelephonie_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcription" ADD CONSTRAINT "Transcription_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcription" ADD CONSTRAINT "Transcription_appelId_fkey" FOREIGN KEY ("appelId") REFERENCES "Appel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analyse" ADD CONSTRAINT "Analyse_appelId_fkey" FOREIGN KEY ("appelId") REFERENCES "Appel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichierAudio" ADD CONSTRAINT "FichierAudio_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FichierAudio" ADD CONSTRAINT "FichierAudio_appelId_fkey" FOREIGN KEY ("appelId") REFERENCES "Appel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prestation" ADD CONSTRAINT "Prestation_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devis" ADD CONSTRAINT "Devis_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDevis" ADD CONSTRAINT "LigneDevis_devisId_fkey" FOREIGN KEY ("devisId") REFERENCES "Devis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneDevis" ADD CONSTRAINT "LigneDevis_prestationId_fkey" FOREIGN KEY ("prestationId") REFERENCES "Prestation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_appelId_fkey" FOREIGN KEY ("appelId") REFERENCES "Appel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_appelId_fkey" FOREIGN KEY ("appelId") REFERENCES "Appel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteChantier" ADD CONSTRAINT "NoteChantier_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteChantier" ADD CONSTRAINT "NoteChantier_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageMensuel" ADD CONSTRAINT "UsageMensuel_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_entrepriseId_fkey" FOREIGN KEY ("entrepriseId") REFERENCES "Entreprise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
