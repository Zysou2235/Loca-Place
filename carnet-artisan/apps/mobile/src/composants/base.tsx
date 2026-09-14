import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { couleurs, espaces, TAILLE_TACTILE_MIN, typo } from '../theme';

export function Titre({ children }: { children: React.ReactNode }) {
  return <Text style={styles.titre}>{children}</Text>;
}

export function Section({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Corps({ children, secondaire }: { children: React.ReactNode; secondaire?: boolean }) {
  return <Text style={secondaire ? styles.corpsSecondaire : styles.corps}>{children}</Text>;
}

export function Carte({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.carte, style, pressed && styles.cartePressee]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.carte, style]}>{children}</View>;
}

export function Bouton({
  titre,
  onPress,
  variante = 'principal',
  desactive,
}: {
  titre: string;
  onPress: () => void;
  variante?: 'principal' | 'secondaire' | 'danger';
  desactive?: boolean;
}) {
  const fond =
    variante === 'principal'
      ? couleurs.accent
      : variante === 'danger'
        ? couleurs.erreur
        : couleurs.carte;
  const texte = variante === 'secondaire' ? couleurs.texte : couleurs.accentTexte;
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: desactive === true }}
      style={({ pressed }) => [
        styles.bouton,
        { backgroundColor: fond, opacity: desactive === true ? 0.5 : pressed ? 0.85 : 1 },
        variante === 'secondaire' && styles.boutonSecondaire,
      ]}
    >
      <Text style={[styles.boutonTexte, { color: texte }]}>{titre}</Text>
    </Pressable>
  );
}

/**
 * Bandeau d'etat. Le ton dit ce qu'il faut faire, pas ce qu'on espere :
 * "erreur" est rouge, "en attente" est orange, et rien n'est vert tant que la
 * chose n'a pas ete verifiee pour de bon.
 */
export function Bandeau({
  ton,
  titre,
  detail,
  action,
}: {
  ton: 'info' | 'attention' | 'erreur' | 'succes' | 'demonstration';
  titre: string;
  detail?: string | null;
  action?: { libelle: string; onPress: () => void };
}) {
  const fond = {
    info: '#eff6ff',
    attention: '#fffbeb',
    erreur: '#fef2f2',
    succes: '#f0fdf4',
    demonstration: '#f5f3ff',
  }[ton];
  const bordure = {
    info: couleurs.accent,
    attention: couleurs.attention,
    erreur: couleurs.erreur,
    succes: couleurs.succes,
    demonstration: couleurs.demonstration,
  }[ton];
  return (
    <View style={[styles.bandeau, { backgroundColor: fond, borderLeftColor: bordure }]}>
      <Text style={styles.bandeauTitre}>{titre}</Text>
      {detail ? <Text style={styles.bandeauDetail}>{detail}</Text> : null}
      {action ? (
        <View style={styles.bandeauAction}>
          <Bouton titre={action.libelle} onPress={action.onPress} variante="secondaire" />
        </View>
      ) : null}
    </View>
  );
}

/** Pastille indiquant la fiabilite d'une information extraite d'un appel. */
export function PastilleStatut({ statut }: { statut: 'explicite' | 'deduit' | 'a_confirmer' }) {
  const libelle = {
    explicite: 'dit pendant l appel',
    deduit: 'deduit',
    a_confirmer: 'a confirmer',
  }[statut];
  const fond = { explicite: '#dcfce7', deduit: '#e0e7ff', a_confirmer: '#fef3c7' }[statut];
  return (
    <View style={[styles.pastille, { backgroundColor: fond }]}>
      <Text style={styles.pastilleTexte}>{libelle}</Text>
    </View>
  );
}

export function Chargement({ message }: { message?: string }) {
  return (
    <View style={styles.centre}>
      <ActivityIndicator size="large" color={couleurs.accent} />
      {message ? <Text style={styles.corpsSecondaire}>{message}</Text> : null}
    </View>
  );
}

export function MessageErreur({ message, onReessayer }: { message: string; onReessayer?: () => void }) {
  return (
    <View style={styles.centre}>
      <Bandeau ton="erreur" titre="Une erreur est survenue" detail={message} />
      {onReessayer ? <Bouton titre="Reessayer" onPress={onReessayer} variante="secondaire" /> : null}
    </View>
  );
}

export function ListeVide({ message }: { message: string }) {
  return (
    <View style={styles.vide}>
      <Text style={styles.corpsSecondaire}>{message}</Text>
    </View>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContenu}>
      {children}
    </ScrollView>
  );
}

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.fond },
  pageContenu: { padding: espaces.l, paddingBottom: espaces.xxl, gap: espaces.m },
  titre: { ...typo.titre, color: couleurs.texte },
  section: { ...typo.section, color: couleurs.texte, marginTop: espaces.s },
  corps: { ...typo.corps, color: couleurs.texte },
  corpsSecondaire: { ...typo.corps, color: couleurs.texteSecondaire },
  carte: {
    backgroundColor: couleurs.carte,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espaces.m,
    gap: espaces.xs,
  },
  cartePressee: { opacity: 0.85 },
  bouton: {
    minHeight: TAILLE_TACTILE_MIN,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaces.l,
  },
  boutonSecondaire: { borderWidth: 1, borderColor: couleurs.bordure },
  boutonTexte: { ...typo.corps, fontWeight: '600' },
  bandeau: {
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: espaces.m,
    gap: espaces.xs,
  },
  bandeauTitre: { ...typo.corps, fontWeight: '600', color: couleurs.texte },
  bandeauDetail: { ...typo.petit, color: couleurs.texteSecondaire },
  bandeauAction: { marginTop: espaces.s, alignSelf: 'flex-start' },
  pastille: { borderRadius: 999, paddingHorizontal: espaces.s, paddingVertical: 2, alignSelf: 'flex-start' },
  pastilleTexte: { fontSize: 11, color: couleurs.texte },
  centre: { padding: espaces.xl, gap: espaces.m },
  vide: { padding: espaces.l, alignItems: 'center' },
});
