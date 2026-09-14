import { validerAnalyse } from '@carnet/shared';
import { scenarioParId } from '../../demo/scenarios.js';
import { ErreurExtraction, type DemandeExtraction, type FournisseurExtraction, type ResultatExtraction } from './types.js';

/**
 * Analyse de demonstration : renvoie l'analyse ecrite a la main du scenario,
 * apres l'avoir passee par la meme validation que celle d'un vrai modele.
 *
 * Aucun modele de langage n'est appele. C'est ce qui rend la demonstration
 * reproductible - et c'est aussi pourquoi elle ne prouve rien sur la qualite
 * d'une analyse reelle.
 */
export class ExtractionDemo implements FournisseurExtraction {
  readonly nom = 'demonstration';

  analyser(demande: DemandeExtraction): Promise<ResultatExtraction> {
    const scenario = demande.reference ? scenarioParId(demande.reference) : undefined;
    if (!scenario) {
      throw new ErreurExtraction(
        `Aucun scenario de demonstration pour la reference "${demande.reference ?? '(absente)'}".`,
      );
    }
    const validation = validerAnalyse(scenario.analyse);
    if (!validation.ok) {
      // Un scenario de demonstration invalide est un bug du jeu de donnees,
      // pas une erreur a masquer.
      throw new ErreurExtraction(
        `Scenario "${scenario.id}" non conforme au schema : ${validation.erreurs.join(' ; ')}`,
      );
    }
    return Promise.resolve({
      analyse: validation.analyse,
      avertissements: validation.avertissements,
      moteur: 'demonstration',
      coutCentimes: 0,
    });
  }
}
