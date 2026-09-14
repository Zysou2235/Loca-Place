import React from 'react';
import {
  Bandeau,
  Bouton,
  Carte,
  Chargement,
  Corps,
  ListeVide,
  MessageErreur,
  Page,
  PastilleStatut,
  Section,
  Titre,
} from '../composants/base';
import { useDonnees } from '../etat/useDonnees';
import { formatDureeFr, formatJourHeureFr } from '../format';
import { libelleStatut } from './Aujourdhui';
import type { ApiCarnet } from '../api/client';
import type { AppelDetail } from '../api/types';

export function EcranAppels({ api, ouvrirAppel }: { api: ApiCarnet; ouvrirAppel: (id: string) => void }) {
  const { donnees, erreur, enCours, recharger } = useDonnees(() => api.appels());

  if (enCours && !donnees) return <Chargement />;
  if (erreur && !donnees) return <MessageErreur message={erreur} onReessayer={recharger} />;

  const appels = donnees?.appels ?? [];
  return (
    <Page>
      <Titre>Appels</Titre>
      {appels.length === 0 ? (
        <ListeVide message="Aucun appel enregistre pour le moment." />
      ) : (
        appels.map((appel) => (
          <Carte key={appel.id} onPress={() => { ouvrirAppel(appel.id); }}>
            <Corps>
              {appel.client?.nom ?? (appel.numeroMasque ? 'Numero masque' : (appel.numeroDistant ?? 'Inconnu'))}
            </Corps>
            <Corps secondaire>
              {formatJourHeureFr(appel.debut)} · {formatDureeFr(appel.dureeSecondes)} ·{' '}
              {appel.direction === 'ENTRANT' ? 'entrant' : 'sortant'}
            </Corps>
            <Corps secondaire>{libelleStatut(appel.statutTraitement)}</Corps>
            {appel.chantier ? <Corps secondaire>Chantier : {appel.chantier.libelle}</Corps> : null}
            {appel.estDemonstration ? <Corps secondaire>— demonstration —</Corps> : null}
          </Carte>
        ))
      )}
      <Bouton titre="Actualiser" variante="secondaire" onPress={recharger} />
    </Page>
  );
}

/**
 * Detail d'un appel.
 *
 * Chaque information porte sa provenance : ce qui a ete dit mot pour mot, ce
 * qui a ete deduit, ce qui reste a confirmer. L'artisan doit pouvoir remonter
 * a la phrase d'origine sans nous croire sur parole.
 */
export function EcranAppelDetail({
  api,
  appelId,
  retour,
}: {
  api: ApiCarnet;
  appelId: string;
  retour: () => void;
}) {
  const { donnees, erreur, enCours, recharger } = useDonnees<AppelDetail>(() => api.appel(appelId));
  const [messageRelance, setMessageRelance] = React.useState<string | null>(null);

  if (enCours && !donnees) return <Chargement />;
  if (erreur && !donnees) return <MessageErreur message={erreur} onReessayer={recharger} />;
  if (!donnees) return null;

  const { appel } = donnees;
  const analyse = appel.analyse?.contenu ?? null;

  const relancer = (): void => {
    api
      .relancerAppel(appel.id)
      .then(() => { setMessageRelance('Analyse relancee. Revenez dans quelques instants.'); })
      .catch((e: unknown) => { setMessageRelance((e as Error).message); });
  };

  return (
    <Page>
      <Bouton titre="← Retour" variante="secondaire" onPress={retour} />
      <Titre>
        {appel.client?.nom ?? (appel.numeroMasque ? 'Numero masque' : (appel.numeroDistant ?? 'Appel'))}
      </Titre>
      <Corps secondaire>
        {formatJourHeureFr(appel.debut)} · {formatDureeFr(appel.dureeSecondes)} ·{' '}
        {appel.direction === 'ENTRANT' ? 'appel entrant' : 'appel sortant'}
      </Corps>
      {appel.estDemonstration ? (
        <Bandeau ton="demonstration" titre="Appel de demonstration" detail="Conversation fictive." />
      ) : null}

      {appel.statutTraitement === 'ECHEC' || appel.statutTraitement === 'SANS_ENREGISTREMENT' ? (
        <Bandeau
          ton="erreur"
          titre={libelleStatut(appel.statutTraitement)}
          detail={appel.erreurMessage}
          {...(appel.statutTraitement === 'ECHEC'
            ? { action: { libelle: 'Relancer l analyse', onPress: relancer } }
            : {})}
        />
      ) : null}
      {messageRelance ? <Bandeau ton="info" titre={messageRelance} /> : null}

      {appel.statutAssociation === 'A_CONFIRMER' ? (
        <Bandeau
          ton="attention"
          titre="Rattachement a confirmer"
          detail={appel.justificationAssociation}
        />
      ) : null}
      {appel.chantier ? <Corps>Chantier : {appel.chantier.libelle}</Corps> : null}

      {analyse ? (
        <>
          <Section>Resume</Section>
          <Carte>
            <Corps>{analyse.resume}</Corps>
          </Carte>

          {analyse.instructionsDetecteesDansLAppel.length > 0 ? (
            <Bandeau
              ton="erreur"
              titre="Instructions reperees dans la conversation"
              detail={`${analyse.instructionsDetecteesDansLAppel
                .map((i) => `« ${i.extraitSource} »`)
                .join('\n')}\n\nElles sont affichees a titre d information. Aucune action n a ete declenchee.`}
            />
          ) : null}

          {analyse.qualiteAudio === 'mauvaise' || analyse.qualiteAudio === 'inexploitable' ? (
            <Bandeau
              ton="attention"
              titre="Qualite audio degradee"
              detail="L analyse est probablement incomplete. Rappelez le client pour confirmer."
            />
          ) : null}

          <Section>Demande</Section>
          <Carte>
            <Corps>{analyse.natureTravaux.valeur}</Corps>
            <PastilleStatut statut={analyse.natureTravaux.statut} />
            {analyse.natureTravaux.extraitSource ? (
              <Corps secondaire>« {analyse.natureTravaux.extraitSource} »</Corps>
            ) : null}
          </Carte>

          {analyse.adresseChantier.valeur ? (
            <Carte>
              <Corps>Adresse : {analyse.adresseChantier.valeur}</Corps>
              <PastilleStatut statut={analyse.adresseChantier.statut} />
              {analyse.adresseChantier.extraitSource ? (
                <Corps secondaire>« {analyse.adresseChantier.extraitSource} »</Corps>
              ) : null}
            </Carte>
          ) : null}

          {analyse.elements.length > 0 ? (
            <>
              <Section>Quantites entendues</Section>
              {analyse.elements.map((element, index) => (
                <Carte key={`${element.designation}-${String(index)}`}>
                  <Corps>
                    {element.designation} : {element.valeurTexte}
                    {element.unite ? ` ${element.unite}` : ''}
                  </Corps>
                  <PastilleStatut statut={element.statut} />
                  {element.corrections.length > 0 ? (
                    <Bandeau
                      ton="attention"
                      titre="Le client s est repris"
                      detail={`Valeur abandonnee : ${element.corrections
                        .map((c) => c.valeurAbandonnee)
                        .join(', ')}. Valeur retenue : ${element.valeurTexte}.`}
                    />
                  ) : null}
                  {element.extraitSource ? <Corps secondaire>« {element.extraitSource} »</Corps> : null}
                </Carte>
              ))}
            </>
          ) : null}

          {analyse.contraintes.length > 0 ? (
            <>
              <Section>Contraintes</Section>
              {analyse.contraintes.map((contrainte, index) => (
                <Carte key={`contrainte-${String(index)}`}>
                  <Corps>{contrainte.valeur}</Corps>
                  <PastilleStatut statut={contrainte.statut} />
                </Carte>
              ))}
            </>
          ) : null}

          {analyse.informationsManquantes.length > 0 ? (
            <>
              <Section>A demander au client</Section>
              <Carte>
                {analyse.informationsManquantes.map((info, index) => (
                  <Corps key={`manque-${String(index)}`}>• {info}</Corps>
                ))}
              </Carte>
            </>
          ) : null}

          {analyse.ambiguites.length > 0 ? (
            <>
              <Section>Points a clarifier</Section>
              {analyse.ambiguites.map((ambiguite, index) => (
                <Carte key={`ambiguite-${String(index)}`}>
                  <Corps>{ambiguite.sujet}</Corps>
                  <Corps secondaire>{ambiguite.pourquoi}</Corps>
                  <Corps>Question : {ambiguite.questionAPoser}</Corps>
                </Carte>
              ))}
            </>
          ) : null}
        </>
      ) : (
        <Bandeau
          ton="info"
          titre="Pas encore d analyse"
          detail={libelleStatut(appel.statutTraitement)}
        />
      )}

      {donnees.transcriptionConservee && appel.transcription ? (
        <>
          <Section>Transcription</Section>
          <Carte>
            <Corps secondaire>{appel.transcription.texte}</Corps>
          </Carte>
        </>
      ) : null}
    </Page>
  );
}
