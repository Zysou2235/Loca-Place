import { scenarioParId } from '../../demo/scenarios.js';
import { ErreurTranscription, type DemandeTranscription, type FournisseurTranscription, type ResultatTranscription } from './types.js';

/**
 * Transcription de demonstration : renvoie le texte ecrit a la main du
 * scenario. Aucun service externe n'est appele, aucun cout n'est engage.
 */
export class TranscriptionDemo implements FournisseurTranscription {
  readonly nom = 'demonstration';

  transcrire(demande: DemandeTranscription): Promise<ResultatTranscription> {
    const scenario = demande.reference ? scenarioParId(demande.reference) : undefined;
    if (!scenario) {
      throw new ErreurTranscription(
        `Aucun scenario de demonstration pour la reference "${demande.reference ?? '(absente)'}".`,
      );
    }
    return Promise.resolve({
      texte: scenario.transcription,
      langue: 'fr',
      moteur: 'demonstration',
      coutCentimes: 0,
    });
  }
}
