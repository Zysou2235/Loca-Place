import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { ApiCarnet } from './api/client';
import { CLE_JETON, StockageMemoire } from './etat/stockage-securise';
import { EcranAujourdhui } from './ecrans/Aujourdhui';
import { EcranAppelDetail, EcranAppels } from './ecrans/Appels';
import { EcranClients } from './ecrans/Clients';
import { EcranConnexion } from './ecrans/Connexion';
import { EcranDemonstration } from './ecrans/Demonstration';
import { EcranDevis } from './ecrans/Devis';
import { EcranParametres } from './ecrans/Parametres';
import { couleurs, espaces, TAILLE_TACTILE_MIN, typo } from './theme';
import { TIMEOUT_API_MS, URL_API } from './configuration';

type Onglet = 'aujourdhui' | 'appels' | 'clients' | 'devis' | 'parametres';

const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: 'aujourdhui', libelle: "Aujourd'hui" },
  { cle: 'appels', libelle: 'Appels' },
  { cle: 'clients', libelle: 'Clients' },
  { cle: 'devis', libelle: 'Devis' },
  { cle: 'parametres', libelle: 'Reglages' },
];

/**
 * Navigation volontairement faite a la main.
 *
 * Choix assume pour le MVP : cinq onglets et un ecran de detail ne justifient
 * pas d ajouter react-navigation et ses dependances natives, qui compliqueraient
 * le premier build sur appareil. A revoir des que la navigation se complexifie
 * (retour materiel Android, liens profonds, etat restaure).
 */
export default function App() {
  const stockage = useMemo(() => new StockageMemoire(), []);
  const [jeton, setJeton] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('aujourdhui');
  const [appelOuvert, setAppelOuvert] = useState<string | null>(null);
  const [demonstration, setDemonstration] = useState(false);
  const [rafraichissement, setRafraichissement] = useState(0);

  const seDeconnecterRef = React.useRef<() => void>(() => undefined);
  const api = useMemo(
    () =>
      new ApiCarnet({
        urlBase: URL_API,
        jeton,
        timeoutMs: TIMEOUT_API_MS,
        // Une session expiree ramene a l ecran de connexion plutot que
        // d afficher des listes vides, qui feraient croire a une perte de
        // donnees.
        onSessionExpiree: () => { seDeconnecterRef.current(); },
      }),
    [jeton],
  );

  const seConnecter = useCallback(
    (nouveauJeton: string) => {
      void stockage.ecrire(CLE_JETON, nouveauJeton);
      setJeton(nouveauJeton);
    },
    [stockage],
  );

  const seDeconnecter = useCallback(() => {
    void stockage.effacer(CLE_JETON);
    setJeton(null);
    setAppelOuvert(null);
    setOnglet('aujourdhui');
  }, [stockage]);

  seDeconnecterRef.current = seDeconnecter;

  if (!jeton) {
    return (
      <SafeAreaView style={locales.plein}>
        <StatusBar barStyle="dark-content" />
        <EcranConnexion api={api} onConnecte={seConnecter} />
      </SafeAreaView>
    );
  }

  const ouvrirAppel = (id: string): void => { setAppelOuvert(id); setDemonstration(false); };

  return (
    <SafeAreaView style={locales.plein}>
      <StatusBar barStyle="dark-content" />
      <View style={locales.contenu} key={String(rafraichissement)}>
        {appelOuvert ? (
          <EcranAppelDetail
            api={api}
            appelId={appelOuvert}
            retour={() => { setAppelOuvert(null); }}
          />
        ) : demonstration ? (
          <EcranDemonstration
            api={api}
            apresRejeu={() => { setDemonstration(false); setRafraichissement((n) => n + 1); }}
          />
        ) : onglet === 'aujourdhui' ? (
          <EcranAujourdhui api={api} ouvrirAppel={ouvrirAppel} />
        ) : onglet === 'appels' ? (
          <EcranAppels api={api} ouvrirAppel={ouvrirAppel} />
        ) : onglet === 'clients' ? (
          <EcranClients api={api} />
        ) : onglet === 'devis' ? (
          <EcranDevis api={api} />
        ) : (
          <EcranParametres
            api={api}
            onDeconnexion={seDeconnecter}
            stockagePersistant={stockage.persistant}
          />
        )}
      </View>

      {!demonstration && !appelOuvert ? (
        <Pressable
          style={locales.lienDemo}
          onPress={() => { setDemonstration(true); }}
          accessibilityRole="button"
        >
          <Text style={locales.lienDemoTexte}>Ouvrir la demonstration</Text>
        </Pressable>
      ) : null}

      <View style={locales.barre}>
        {ONGLETS.map((item) => {
          const actif = onglet === item.cle && !appelOuvert && !demonstration;
          return (
            <Pressable
              key={item.cle}
              onPress={() => { setOnglet(item.cle); setAppelOuvert(null); setDemonstration(false); }}
              style={locales.onglet}
              accessibilityRole="tab"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={item.libelle}
            >
              <Text style={[locales.ongletTexte, actif && locales.ongletActif]}>{item.libelle}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const locales = StyleSheet.create({
  plein: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { flex: 1 },
  barre: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
    backgroundColor: couleurs.carte,
  },
  onglet: {
    flex: 1,
    minHeight: TAILLE_TACTILE_MIN + 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: espaces.s,
  },
  ongletTexte: { ...typo.petit, color: couleurs.texteSecondaire },
  ongletActif: { color: couleurs.accent, fontWeight: '700' },
  lienDemo: { alignItems: 'center', paddingVertical: espaces.s },
  lienDemoTexte: { ...typo.petit, color: couleurs.demonstration, textDecorationLine: 'underline' },
});
