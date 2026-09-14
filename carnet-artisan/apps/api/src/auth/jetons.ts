/**
 * Jetons de session (JWT signes HS256 via `jose`).
 *
 * Le jeton porte l'utilisateur ET son entreprise. L'entreprise n'est jamais
 * lue depuis le corps d'une requete : un client ne peut donc pas demander
 * "donne-moi les appels de l'entreprise X" en changeant un parametre.
 */

import { SignJWT, jwtVerify } from 'jose';
import { configuration } from '../config.js';

export interface ContenuJeton {
  utilisateurId: string;
  entrepriseId: string;
  role: 'PROPRIETAIRE' | 'MEMBRE';
}

const EMETTEUR = 'carnet-artisan';
const AUDIENCE = 'carnet-artisan-mobile';

function cle(): Uint8Array {
  return new TextEncoder().encode(configuration().JWT_SECRET);
}

export async function emettreJeton(contenu: ContenuJeton): Promise<string> {
  const minutes = configuration().DUREE_JETON_MINUTES;
  return new SignJWT({ entrepriseId: contenu.entrepriseId, role: contenu.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(contenu.utilisateurId)
    .setIssuer(EMETTEUR)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${String(minutes)}m`)
    .sign(cle());
}

export async function verifierJeton(jeton: string): Promise<ContenuJeton | null> {
  try {
    const { payload } = await jwtVerify(jeton, cle(), {
      issuer: EMETTEUR,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const utilisateurId = payload.sub;
    const entrepriseId = payload['entrepriseId'];
    const role = payload['role'];
    if (
      typeof utilisateurId !== 'string' ||
      typeof entrepriseId !== 'string' ||
      (role !== 'PROPRIETAIRE' && role !== 'MEMBRE')
    ) {
      return null;
    }
    return { utilisateurId, entrepriseId, role };
  } catch {
    return null;
  }
}
