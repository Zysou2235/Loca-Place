import React from 'react';
import {
  Bouton,
  Carte,
  Chargement,
  Corps,
  ListeVide,
  MessageErreur,
  Page,
  Titre,
} from '../composants/base';
import { useDonnees } from '../etat/useDonnees';
import type { ApiCarnet } from '../api/client';

export function EcranClients({ api }: { api: ApiCarnet }) {
  const { donnees, erreur, enCours, recharger } = useDonnees(() => api.clients());

  if (enCours && !donnees) return <Chargement />;
  if (erreur && !donnees) return <MessageErreur message={erreur} onReessayer={recharger} />;

  const clients = donnees?.clients ?? [];
  return (
    <Page>
      <Titre>Clients et chantiers</Titre>
      {clients.length === 0 ? (
        <ListeVide message="Aucun client enregistre. Les fiches se creent a partir des appels." />
      ) : (
        clients.map((client) => (
          <Carte key={client.id}>
            <Corps>{client.nom}</Corps>
            {client.telephones.length > 0 ? (
              <Corps secondaire>{client.telephones.join(' · ')}</Corps>
            ) : null}
            {client.chantiers.length === 0 ? (
              <Corps secondaire>Aucun chantier</Corps>
            ) : (
              client.chantiers.map((chantier) => (
                <Corps key={chantier.id} secondaire>
                  • {chantier.libelle}
                  {chantier.adresse ? ` — ${chantier.adresse}` : ''}
                  {chantier.actif ? '' : ' (archive)'}
                </Corps>
              ))
            )}
            {client.chantiers.length > 1 ? (
              <Corps secondaire>
                Plusieurs chantiers : un appel de ce numero demandera lequel est concerne.
              </Corps>
            ) : null}
          </Carte>
        ))
      )}
      <Bouton titre="Actualiser" variante="secondaire" onPress={recharger} />
    </Page>
  );
}
