import React from 'react';
import { View } from 'react-native';
import {
  Bandeau,
  Bouton,
  Carte,
  Chargement,
  Corps,
  ListeVide,
  MessageErreur,
  Page,
  Section,
  Titre,
} from '../composants/base';
import { useDonnees } from '../etat/useDonnees';
import type { ApiCarnet } from '../api/client';
import type { Aujourdhui, StatutTelephonie } from '../api/types';
import { formatHeureFr, formatJourHeureFr } from '../format';

interface Props {
  api: ApiCarnet;
  ouvrirAppel: (id: string) => void;
}

export function EcranAujourdhui({ api, ouvrirAppel }: Props) {
  const { donnees, erreur, enCours, recharger } = useDonnees<Aujourdhui>(() => api.aujourdhui());

  if (enCours && !donnees) return <Chargement message="Chargement de votre journee..." />;
  if (erreur && !donnees) return <MessageErreur message={erreur} onReessayer={recharger} />;
  if (!donnees) return null;

  return (
    <Page>
      <Titre>Aujourd&apos;hui</Titre>

      {donnees.mode === 'DEMONSTRATION' ? (
        <Bandeau
          ton="demonstration"
          titre="Mode demonstration"
          detail="Toutes les donnees affichees sont fictives. Aucun appel reel n est recu, aucun document n est envoye, rien n est facture."
        />
      ) : null}

      <BandeauTelephonie statut={donnees.telephonie} />

      {donnees.aRegler.length > 0 ? (
        <>
          <Section>A regler ({donnees.aRegler.length})</Section>
          {donnees.aRegler.map((item) => (
            <Carte key={item.id} onPress={() => { ouvrirAppel(item.id); }}>
              <Corps>{item.numeroDistant ?? 'Numero masque'}</Corps>
              <Corps secondaire>{formatJourHeureFr(item.debutIso)}</Corps>
              <Bandeau ton="erreur" titre="Traitement interrompu" detail={item.message} />
              {item.relancable ? <Corps secondaire>Ouvrez l appel pour relancer l analyse.</Corps> : null}
            </Carte>
          ))}
        </>
      ) : null}

      <Section>Nouvelles demandes ({donnees.nouvellesDemandes.length})</Section>
      {donnees.nouvellesDemandes.length === 0 ? (
        <ListeVide message="Aucune nouvelle demande a rattacher." />
      ) : (
        donnees.nouvellesDemandes.map((appel) => (
          <Carte key={appel.id} onPress={() => { ouvrirAppel(appel.id); }}>
            <Corps>{appel.client?.nom ?? appel.numeroDistant ?? 'Numero masque'}</Corps>
            <Corps secondaire>{formatJourHeureFr(appel.debut)}</Corps>
            {appel.resume ? <Corps>{appel.resume}</Corps> : null}
            {appel.statutAssociation === 'A_CONFIRMER' && appel.justificationAssociation ? (
              <Bandeau ton="attention" titre="Chantier a confirmer" detail={appel.justificationAssociation} />
            ) : null}
          </Carte>
        ))
      )}

      {donnees.analysesEnCours.length > 0 ? (
        <>
          <Section>Analyses en cours ({donnees.analysesEnCours.length})</Section>
          {donnees.analysesEnCours.map((appel) => (
            <Carte key={appel.id} onPress={() => { ouvrirAppel(appel.id); }}>
              <Corps>{appel.numeroDistant ?? 'Numero masque'}</Corps>
              <Corps secondaire>{libelleStatut(appel.statutTraitement)}</Corps>
            </Carte>
          ))}
        </>
      ) : null}

      <Section>Rappels du jour ({donnees.rappels.length})</Section>
      {donnees.rappels.length === 0 ? (
        <ListeVide message="Aucun rappel prevu aujourd hui." />
      ) : (
        donnees.rappels.map((tache) => (
          <Carte key={tache.id}>
            <Corps>{tache.titre}</Corps>
            <Corps secondaire>
              {tache.echeance ? `Echeance : ${formatJourHeureFr(tache.echeance)}` : 'Sans echeance'}
            </Corps>
          </Carte>
        ))
      )}

      <Section>Rendez-vous ({donnees.rendezVous.length})</Section>
      {donnees.rendezVous.length === 0 ? (
        <ListeVide message="Aucun rendez-vous propose." />
      ) : (
        donnees.rendezVous.map((rdv) => (
          <Carte key={rdv.id}>
            <Corps>
              {formatJourHeureFr(rdv.debutPropose)}
              {rdv.precision === 'creneau' ? ' (creneau)' : ''}
            </Corps>
            <Corps secondaire>
              {rdv.chantier ? `${rdv.chantier.client.nom} — ${rdv.chantier.libelle}` : 'Chantier a rattacher'}
            </Corps>
            {rdv.statut === 'PROPOSE' ? (
              <Bandeau
                ton={rdv.ambigu ? 'attention' : 'info'}
                titre="Proposition, pas encore confirmee"
                detail={rdv.explication}
              />
            ) : null}
            {rdv.expressionAbandonnee ? (
              <Corps secondaire>
                Le client s est repris : « {rdv.expressionAbandonnee} » puis « {rdv.expressionEntendue} ».
              </Corps>
            ) : null}
          </Carte>
        ))
      )}

      <Section>Brouillons a completer ({donnees.brouillons.length})</Section>
      {donnees.brouillons.length === 0 ? (
        <ListeVide message="Aucun brouillon en attente." />
      ) : (
        donnees.brouillons.map((devis) => (
          <Carte key={devis.id}>
            <Corps>
              {devis.numero} — {devis.objet}
            </Corps>
            <Corps secondaire>
              {devis.statut === 'BROUILLON_INCOMPLET'
                ? 'Incomplet : il manque des informations.'
                : 'Pret a verifier.'}
            </Corps>
          </Carte>
        ))
      )}

      <View style={{ height: 8 }} />
      <Bouton titre="Actualiser" variante="secondaire" onPress={recharger} />
    </Page>
  );
}

/**
 * L'etat telephonique est affiche tel quel. Aucun raccourci du type
 * "configure = connecte" : tant qu'un appel reel n'a pas ete recu et analyse,
 * le bandeau le dit.
 */
export function BandeauTelephonie({ statut }: { statut: StatutTelephonie | null }) {
  if (!statut) {
    return (
      <Bandeau
        ton="attention"
        titre="Telephonie non configuree"
        detail="Vos appels ne sont pas encore analyses. Rendez-vous dans Parametres."
      />
    );
  }
  const ton =
    statut.etat === 'TEST_REUSSI' ? 'succes' : statut.etat === 'ERREUR' ? 'erreur' : 'attention';
  const titre = {
    NON_CONFIGURE: 'Telephonie non configuree',
    EN_ATTENTE_FOURNISSEUR: 'En attente du fournisseur',
    EN_ATTENTE_RENVOI_OPERATEUR: 'Renvoi d appel a activer',
    PRET_A_TESTER: 'Pret a tester — chaine non encore verifiee',
    TEST_REUSSI: 'Appels analyses : chaine verifiee',
    ERREUR: 'Probleme sur la chaine telephonique',
  }[statut.etat];
  return (
    <Bandeau
      ton={ton}
      titre={titre}
      detail={statut.prochaineAction ? `${statut.detail}\n\nA faire : ${statut.prochaineAction}` : statut.detail}
    />
  );
}

export function libelleStatut(statut: string): string {
  return (
    {
      RECU: 'Appel recu, en attente de traitement',
      EN_ATTENTE_ENREGISTREMENT: 'En attente de l enregistrement',
      AUDIO_TELECHARGE: 'Enregistrement recupere',
      TRANSCRIPTION_EN_COURS: 'Transcription en cours',
      ANALYSE_EN_COURS: 'Analyse en cours',
      ANALYSE_TERMINEE: 'Analyse terminee',
      SANS_ENREGISTREMENT: 'Pas d enregistrement disponible',
      ECHEC: 'Traitement en echec',
    }[statut] ?? statut
  );
}

export { formatHeureFr };
