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
  Section,
  Titre,
} from '../composants/base';
import { useDonnees } from '../etat/useDonnees';
import { formatEuros } from '../format';
import type { ApiCarnet } from '../api/client';

export function EcranDevis({ api }: { api: ApiCarnet }) {
  const { donnees, erreur, enCours, recharger } = useDonnees(() => api.devis());
  const catalogue = useDonnees(() => api.catalogue());

  if (enCours && !donnees) return <Chargement />;
  if (erreur && !donnees) return <MessageErreur message={erreur} onReessayer={recharger} />;

  const devis = donnees?.devis ?? [];
  const prestations = catalogue.donnees?.prestations ?? [];

  return (
    <Page>
      <Titre>Devis</Titre>

      {devis.length === 0 ? (
        <ListeVide message="Aucun devis. Les brouillons se creent depuis un appel analyse." />
      ) : (
        devis.map((d) => (
          <Carte key={d.id}>
            <Corps>
              {d.numero} — {d.objet}
            </Corps>
            {d.chantier ? (
              <Corps secondaire>
                {d.chantier.client.nom} — {d.chantier.libelle}
              </Corps>
            ) : null}
            <Corps>
              {formatEuros(d.totalHtCents)} HT · {formatEuros(d.totalTtcCents)} TTC
            </Corps>
            {d.statut === 'BROUILLON_INCOMPLET' ? (
              <Bandeau
                ton="attention"
                titre="Brouillon incomplet"
                detail="Des prix ou des quantites manquent. Rien n a ete devine : completez avant de valider."
              />
            ) : null}
            {d.statut === 'PRET_A_VERIFIER' ? (
              <Bandeau
                ton="info"
                titre="Pret a verifier"
                detail="Relisez le detail, puis validez pour produire un devis definitif."
              />
            ) : null}
            {d.statut === 'VALIDE' || d.statut === 'EXPORTE' ? (
              <Bandeau ton="succes" titre="Devis valide" detail="Le PDF ne porte plus la mention brouillon." />
            ) : null}
          </Carte>
        ))
      )}

      <Section>Catalogue ({prestations.length})</Section>
      {prestations.length === 0 ? (
        <ListeVide message="Catalogue vide : saisissez vos prestations ou importez un fichier CSV." />
      ) : (
        prestations.slice(0, 20).map((p) => (
          <Carte key={p.id}>
            <Corps>
              {p.reference} — {p.libelle}
            </Corps>
            <Corps secondaire>
              {formatEuros(p.prixVenteCents)} / {p.unite} · TVA {String(p.tvaRateBp / 100)} %
              {p.nature === 'FORFAIT_POSE' ? ' · pose comprise' : ''}
            </Corps>
          </Carte>
        ))
      )}

      <Bandeau
        ton="info"
        titre="Le MVP n envoie aucun devis"
        detail="Aucun document n est transmis au client par l application. L export PDF reste sous votre controle."
      />
      <Bouton titre="Actualiser" variante="secondaire" onPress={recharger} />
    </Page>
  );
}
