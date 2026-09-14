import { useCallback, useEffect, useState } from 'react';

/**
 * Chargement de donnees distantes.
 *
 * Trois etats explicites, jamais confondus : en cours, erreur, donnees.
 * Une erreur n'est jamais transformee en liste vide - l'artisan doit voir la
 * difference entre "vous n avez aucun appel" et "le serveur n a pas repondu".
 */
export function useDonnees<T>(charger: () => Promise<T>) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(true);

  const recharger = useCallback(() => {
    let annule = false;
    setEnCours(true);
    setErreur(null);
    charger()
      .then((resultat) => {
        if (!annule) setDonnees(resultat);
      })
      .catch((e: unknown) => {
        if (!annule) setErreur((e as Error).message);
      })
      .finally(() => {
        if (!annule) setEnCours(false);
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => recharger(), [recharger]);

  return { donnees, erreur, enCours, recharger };
}
