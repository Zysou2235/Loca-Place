import React, { useState } from 'react';
import {
  Bandeau,
  Bouton,
  Carte,
  Chargement,
  Corps,
  MessageErreur,
  Page,
  Section,
  Titre,
} from '../composants/base';
import { useDonnees } from '../etat/useDonnees';
import { BandeauTelephonie } from './Aujourdhui';
import { formatEuros } from '../format';
import type { ApiCarnet } from '../api/client';
import type { Parametres } from '../api/types';

interface Props {
  api: ApiCarnet;
  onDeconnexion: () => void;
  stockagePersistant: boolean;
}

export function EcranParametres({ api, onDeconnexion, stockagePersistant }: Props) {
  const { donnees, erreur, enCours, recharger } = useDonnees<Parametres>(() => api.parametres());
  const [verification, setVerification] = useState<string | null>(null);

  if (enCours && !donnees) return <Chargement />;
  if (erreur && !donnees) return <MessageErreur message={erreur} onReessayer={recharger} />;
  if (!donnees) return null;

  const verifier = (): void => {
    setVerification('Verification en cours...');
    api
      .verifierTelephonie()
      .then((r) => {
        setVerification(r.telephonie?.detail ?? 'Etat inconnu.');
        recharger();
      })
      .catch((e: unknown) => { setVerification((e as Error).message); });
  };

  return (
    <Page>
      <Titre>Parametres</Titre>

      <Section>Entreprise</Section>
      <Carte>
        <Corps>{donnees.entreprise.nom}</Corps>
        <Corps secondaire>{donnees.entreprise.nomArtisan} · {donnees.entreprise.metier}</Corps>
        <Corps secondaire>{donnees.entreprise.telephonePro}</Corps>
        <Corps secondaire>{donnees.entreprise.emailContact}</Corps>
        <Corps secondaire>
          {donnees.entreprise.siret ? `SIRET ${donnees.entreprise.siret}` : 'SIRET a renseigner'}
        </Corps>
        <Corps secondaire>Fuseau : {donnees.entreprise.fuseau}</Corps>
      </Carte>

      {donnees.entreprise.mode === 'DEMONSTRATION' ? (
        <Bandeau
          ton="demonstration"
          titre="Mode demonstration actif"
          detail="Les donnees sont fictives et aucun appel reel n est traite. Le passage en mode reel demande une configuration telephonique complete et un appel de test reussi."
        />
      ) : null}

      <Section>Telephonie</Section>
      <BandeauTelephonie statut={donnees.telephonie} />
      {verification ? <Bandeau ton="info" titre="Verification" detail={verification} /> : null}
      <Bouton titre="Verifier l etat reel de la chaine" variante="secondaire" onPress={verifier} />

      {donnees.telephonie ? (
        <Carte>
          <Corps secondaire>Fournisseur : {donnees.telephonie.fournisseur}</Corps>
          <Corps secondaire>
            Numero technique : {donnees.telephonie.numeroTechnique ?? 'non attribue'}
          </Corps>
          <Corps secondaire>
            Cle API : {donnees.telephonie.cleApiEnregistree ?? 'non enregistree'}
          </Corps>
          <Corps secondaire>
            Renvoi declare par vous :{' '}
            {donnees.telephonie.renvoiConfirmeParUtilisateur ? 'oui' : 'non'}
          </Corps>
        </Carte>
      ) : null}

      {/*
        Point le plus important de cet ecran : dire la verite sur la reception
        des appels. Tant que le fournisseur n expose pas de push VoIP vers une
        application tierce, cette application ne peut pas sonner a la place du
        telephone. On ne met donc AUCUN bouton d appel : il serait faux.
      */}
      {donnees.capacitesFournisseur.pushVoipVersApplicationTierce ? (
        <Bandeau
          ton="info"
          titre="Reception des appels dans cette application"
          detail="Le fournisseur expose les notifications VoIP necessaires. L integration reste a valider sur appareil reel."
        />
      ) : (
        <Bandeau
          ton="attention"
          titre="Les appels ne sonnent pas dans cette application"
          detail={
            "Le fournisseur telephonique retenu n expose pas de notification VoIP vers une application tierce. " +
            "Cette application recoit donc l ANALYSE de vos appels, pas les appels eux-memes : vous continuez a " +
            'repondre avec l application du fournisseur ou votre telephone. Le detail technique et les conditions ' +
            'pour y arriver un jour sont dans la documentation du projet.'
          }
        />
      )}

      <Section>Donnees</Section>
      <Carte>
        <Corps secondaire>
          Enregistrements conserves {String(donnees.entreprise.retentionAudioJours)} jours.
        </Corps>
        <Corps secondaire>
          {donnees.entreprise.retentionTranscriptionJours > 0
            ? `Transcriptions conservees ${String(donnees.entreprise.retentionTranscriptionJours)} jours.`
            : 'Transcriptions non conservees.'}
        </Corps>
      </Carte>
      <Bandeau
        ton="info"
        titre="Avant d enregistrer de vrais clients"
        detail="L information des personnes enregistrees et les parametres de conservation doivent etre definis. Ce logiciel n est pas « certifie RGPD » : il vous outille, il ne vous met pas en conformite."
      />

      {donnees.abonnement ? (
        <>
          <Section>Abonnement</Section>
          <Carte>
            <Corps>
              {formatEuros(donnees.abonnement.prixMensuelCentimes)} TTC / mois — statut{' '}
              {donnees.abonnement.statut.toLowerCase()}
            </Corps>
            <Corps secondaire>
              Paiement en mode {donnees.abonnement.modePaiement} : aucun prelevement reel.
            </Corps>
          </Carte>
        </>
      ) : null}

      {!stockagePersistant ? (
        <Bandeau
          ton="attention"
          titre="Reconnexion demandee a chaque lancement"
          detail="Le jeton de session n est pas encore stocke dans le Keychain (iOS) ni le Keystore (Android). Il reste en memoire, et disparait a la fermeture de l application."
        />
      ) : null}

      <Bouton titre="Se deconnecter" variante="danger" onPress={onDeconnexion} />
    </Page>
  );
}
