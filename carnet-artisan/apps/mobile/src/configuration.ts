/**
 * Configuration de l'application mobile.
 *
 * Pas de lecture de `process.env` : React Native ne fournit pas cet objet a
 * l'execution. La valeur est remplacee au moment du build (par exemple avec
 * `react-native-config` ou une substitution Babel selon la variante), ou
 * modifiee ici pour un test local.
 *
 * `10.0.2.2` est l'adresse de la machine hote vue depuis l'emulateur Android.
 * Sur un iPhone ou un Android physique, il faut l'adresse IP de la machine sur
 * le reseau local : un `localhost` pointerait vers le telephone lui-meme.
 */

export const URL_API = 'http://10.0.2.2:3001';

/** Delai au-dela duquel une requete est consideree comme perdue. */
export const TIMEOUT_API_MS = 20_000;
