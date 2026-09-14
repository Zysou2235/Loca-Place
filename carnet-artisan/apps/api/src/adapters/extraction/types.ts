import type { AnalyseAppel } from '@carnet/shared';

export interface DemandeExtraction {
  transcription: string;
  /** Instant de debut de l'appel, pour resoudre les dates relatives. */
  instantAppel: Date;
  fuseau: string;
  metier: string;
  /** Reference interne, utilisee par l'adaptateur de demonstration. */
  reference?: string;
}

export interface ResultatExtraction {
  analyse: AnalyseAppel;
  avertissements: readonly string[];
  moteur: string;
  coutCentimes: number;
}

export interface FournisseurExtraction {
  readonly nom: string;
  analyser(demande: DemandeExtraction): Promise<ResultatExtraction>;
}

export class ErreurExtraction extends Error {
  override readonly name = 'ErreurExtraction';
}
