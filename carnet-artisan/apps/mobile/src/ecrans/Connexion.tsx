import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Bandeau, Bouton, Corps, Page, Titre, styles as base } from '../composants/base';
import { couleurs, espaces, TAILLE_TACTILE_MIN, typo } from '../theme';
import type { ApiCarnet } from '../api/client';

interface Props {
  api: ApiCarnet;
  onConnecte: (jeton: string) => void;
}

export function EcranConnexion({ api, onConnecte }: Props) {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [nomArtisan, setNomArtisan] = useState('');
  const [metier, setMetier] = useState('electricien');
  const [telephonePro, setTelephonePro] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const envoyer = (): void => {
    setErreur(null);
    setEnCours(true);
    const promesse =
      mode === 'connexion'
        ? api.connexion(email.trim(), motDePasse)
        : api.inscription({
            email: email.trim(),
            motDePasse,
            nomEntreprise: nomEntreprise.trim(),
            metier,
            nomArtisan: nomArtisan.trim(),
            telephonePro: telephonePro.trim(),
          });
    promesse
      .then((resultat) => { onConnecte(resultat.jeton); })
      .catch((e: unknown) => { setErreur((e as Error).message); })
      .finally(() => { setEnCours(false); });
  };

  return (
    <KeyboardAvoidingView
      style={locales.plein}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Page>
        <Titre>Carnet Artisan</Titre>
        <Corps secondaire>
          {mode === 'connexion'
            ? 'Connectez-vous pour retrouver vos appels et vos devis.'
            : 'Creez votre compte. Vous commencerez en mode demonstration : aucun appel reel ne sera traite tant que la telephonie n est pas configuree et testee.'}
        </Corps>

        {erreur ? <Bandeau ton="erreur" titre="Connexion impossible" detail={erreur} /> : null}

        <Champ
          libelle="Adresse email"
          valeur={email}
          onChange={setEmail}
          clavier="email-address"
          auto="email"
        />
        <Champ
          libelle="Mot de passe"
          valeur={motDePasse}
          onChange={setMotDePasse}
          secret
          aide={mode === 'inscription' ? '10 caracteres minimum.' : undefined}
        />

        {mode === 'inscription' ? (
          <>
            <Champ libelle="Nom de l entreprise" valeur={nomEntreprise} onChange={setNomEntreprise} />
            <Champ libelle="Votre nom" valeur={nomArtisan} onChange={setNomArtisan} />
            <Champ
              libelle="Metier"
              valeur={metier}
              onChange={setMetier}
              aide="electricien, plombier_chauffagiste, menuisier, macon, autre..."
            />
            <Champ
              libelle="Telephone professionnel"
              valeur={telephonePro}
              onChange={setTelephonePro}
              clavier="phone-pad"
            />
          </>
        ) : null}

        <Bouton
          titre={enCours ? 'Patientez...' : mode === 'connexion' ? 'Se connecter' : 'Creer mon compte'}
          onPress={envoyer}
          desactive={enCours}
        />
        <Bouton
          titre={mode === 'connexion' ? 'Je n ai pas encore de compte' : 'J ai deja un compte'}
          variante="secondaire"
          onPress={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setErreur(null); }}
        />
      </Page>
    </KeyboardAvoidingView>
  );
}

function Champ({
  libelle,
  valeur,
  onChange,
  secret,
  clavier,
  aide,
  auto,
}: {
  libelle: string;
  valeur: string;
  onChange: (v: string) => void;
  secret?: boolean;
  clavier?: 'default' | 'email-address' | 'phone-pad';
  aide?: string;
  auto?: 'email';
}) {
  return (
    <View style={locales.champ}>
      <Corps>{libelle}</Corps>
      <TextInput
        value={valeur}
        onChangeText={onChange}
        secureTextEntry={secret}
        keyboardType={clavier ?? 'default'}
        autoCapitalize={auto === 'email' ? 'none' : 'sentences'}
        autoCorrect={false}
        textContentType={auto === 'email' ? 'emailAddress' : undefined}
        style={locales.saisie}
        accessibilityLabel={libelle}
      />
      {aide ? <Corps secondaire>{aide}</Corps> : null}
    </View>
  );
}

const locales = StyleSheet.create({
  plein: { flex: 1, backgroundColor: couleurs.fond },
  champ: { gap: espaces.xs },
  saisie: {
    minHeight: TAILLE_TACTILE_MIN,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 8,
    backgroundColor: couleurs.carte,
    paddingHorizontal: espaces.m,
    ...typo.corps,
    color: couleurs.texte,
  },
});

export { base };
