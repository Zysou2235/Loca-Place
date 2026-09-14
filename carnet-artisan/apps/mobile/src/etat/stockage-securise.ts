/**
 * Stockage du jeton de session.
 *
 * ETAT REEL : l'implementation ci-dessous garde le jeton EN MEMOIRE
 * uniquement. Elle est volontairement incapable de persister : un jeton de
 * session n'a rien a faire dans AsyncStorage, qui est lisible en clair sur un
 * appareil compromis.
 *
 * Pour la persistance entre deux lancements, il faut brancher le Keychain iOS
 * et le Keystore Android (par exemple `react-native-keychain`), ce qui suppose
 * un build natif. Tant que ce n'est pas fait, l'artisan doit se reconnecter a
 * chaque demarrage : c'est une gene assumee, pas une faille silencieuse.
 * Voir docs/07-limites-et-dependances.md.
 */

export interface StockageSecurise {
  lire(cle: string): Promise<string | null>;
  ecrire(cle: string, valeur: string): Promise<void>;
  effacer(cle: string): Promise<void>;
  /** `false` tant que le Keychain / Keystore n'est pas branche. */
  readonly persistant: boolean;
}

export class StockageMemoire implements StockageSecurise {
  readonly persistant = false;
  private readonly valeurs = new Map<string, string>();

  lire(cle: string): Promise<string | null> {
    return Promise.resolve(this.valeurs.get(cle) ?? null);
  }

  ecrire(cle: string, valeur: string): Promise<void> {
    this.valeurs.set(cle, valeur);
    return Promise.resolve();
  }

  effacer(cle: string): Promise<void> {
    this.valeurs.delete(cle);
    return Promise.resolve();
  }
}

export const CLE_JETON = 'carnet.session';
