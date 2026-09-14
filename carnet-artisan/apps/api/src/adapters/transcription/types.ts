export interface DemandeTranscription {
  audio: Buffer;
  typeMime: string;
  dureeSecondes: number;
  langue: string;
  /** Reference interne, utilisee par l'adaptateur de demonstration. */
  reference?: string;
}

export interface ResultatTranscription {
  texte: string;
  langue: string;
  moteur: string;
  coutCentimes: number;
}

export interface FournisseurTranscription {
  readonly nom: string;
  transcrire(demande: DemandeTranscription): Promise<ResultatTranscription>;
}

export class ErreurTranscription extends Error {
  override readonly name = 'ErreurTranscription';
}
