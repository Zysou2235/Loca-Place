import { ErreurTranscription, type DemandeTranscription, type FournisseurTranscription, type ResultatTranscription } from './types.js';

/**
 * Transcription par un service compatible avec l'API de transcription
 * d'OpenAI (`POST /v1/audio/transcriptions`, multipart).
 *
 * NON TESTE contre un service reel : aucune cle n'etait disponible pendant le
 * developpement. Le code est ecrit, il n'est pas valide de bout en bout.
 */
export class TranscriptionExterne implements FournisseurTranscription {
  readonly nom: string;

  constructor(
    private readonly options: {
      url: string;
      cle: string;
      modele: string;
      coutMilliemesParMinute: number;
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    },
  ) {
    this.nom = `externe:${options.modele}`;
  }

  async transcrire(demande: DemandeTranscription): Promise<ResultatTranscription> {
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const formulaire = new FormData();
    formulaire.append('file', new Blob([new Uint8Array(demande.audio)], { type: demande.typeMime }), 'appel.audio');
    formulaire.append('model', this.options.modele);
    formulaire.append('language', demande.langue);
    formulaire.append('response_format', 'json');

    const controleur = new AbortController();
    const minuteur = setTimeout(() => { controleur.abort(); }, this.options.timeoutMs ?? 120_000);
    let reponse: Response;
    try {
      reponse = await fetchImpl(this.options.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.options.cle}` },
        body: formulaire,
        signal: controleur.signal,
      });
    } catch (erreur) {
      throw new ErreurTranscription(`Service de transcription injoignable : ${(erreur as Error).message}`);
    } finally {
      clearTimeout(minuteur);
    }

    if (!reponse.ok) {
      throw new ErreurTranscription(`Transcription refusee (HTTP ${String(reponse.status)}).`);
    }
    const donnees = (await reponse.json()) as { text?: unknown };
    if (typeof donnees.text !== 'string') {
      throw new ErreurTranscription('Reponse de transcription inattendue : champ "text" absent.');
    }

    const minutes = Math.ceil(demande.dureeSecondes / 60);
    return {
      texte: donnees.text,
      langue: demande.langue,
      moteur: this.nom,
      // Arrondi au centime superieur : mieux vaut surestimer un cout que le
      // sous-estimer dans un modele economique.
      coutCentimes: Math.ceil((minutes * this.options.coutMilliemesParMinute) / 10),
    };
  }
}
