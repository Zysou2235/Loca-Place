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
import type { ApiCarnet } from '../api/client';

/**
 * Ecran de demonstration : rejoue des conversations fictives.
 * Il porte en permanence son avertissement - une demonstration reussie ne dit
 * rien de la reception reelle des appels.
 */
export function EcranDemonstration({ api, apresRejeu }: { api: ApiCarnet; apresRejeu: () => void }) {
  const { donnees, erreur, enCours, recharger } = useDonnees(() => api.scenariosDemo());
  const [message, setMessage] = useState<string | null>(null);
  const [travail, setTravail] = useState(false);

  if (enCours && !donnees) return <Chargement />;
  if (erreur && !donnees) return <MessageErreur message={erreur} onReessayer={recharger} />;
  if (!donnees) return null;

  const rejouer = (scenarioId: string): void => {
    setTravail(true);
    setMessage(null);
    api
      .preparerDemo()
      .then(() => api.rejouerDemo(scenarioId))
      .then(() => {
        setMessage('Appel de demonstration analyse. Retrouvez-le dans Aujourd hui et Appels.');
        apresRejeu();
      })
      .catch((e: unknown) => { setMessage((e as Error).message); })
      .finally(() => { setTravail(false); });
  };

  return (
    <Page>
      <Titre>Demonstration</Titre>
      <Bandeau ton="demonstration" titre="Donnees fictives" detail={donnees.avertissement} />
      {message ? <Bandeau ton="info" titre={message} /> : null}

      <Section>Conversations a rejouer</Section>
      {donnees.scenarios.map((scenario) => (
        <Carte key={scenario.id}>
          <Corps>{scenario.titre}</Corps>
          <Corps secondaire>{scenario.metAlEpreuve}</Corps>
          <Bouton
            titre={travail ? 'Patientez...' : 'Rejouer cet appel'}
            variante="secondaire"
            desactive={travail}
            onPress={() => { rejouer(scenario.id); }}
          />
        </Carte>
      ))}
    </Page>
  );
}
