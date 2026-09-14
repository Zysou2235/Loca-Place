import type { FastifyReply, FastifyRequest } from 'fastify';
import { ContexteEntreprise } from '../domaine/contexte-entreprise.js';
import { verifierJeton, type ContenuJeton } from './jetons.js';
import type { PrismaClient } from '../db.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Toujours renseigne sur les routes protegees. */
    session?: ContenuJeton;
    contexte?: ContexteEntreprise;
  }
}

/**
 * Verifie le jeton et installe un contexte borne a l'entreprise.
 *
 * L'entreprise vient uniquement du jeton signe. Aucune route ne lit un
 * `entrepriseId` fourni par le client.
 */
export function authentification(db: PrismaClient) {
  return async function verifier(requete: FastifyRequest, reponse: FastifyReply): Promise<void> {
    const entete = requete.headers.authorization;
    if (!entete?.startsWith('Bearer ')) {
      await reponse.code(401).send({ erreur: 'Authentification requise.' });
      return;
    }
    const session = await verifierJeton(entete.slice('Bearer '.length).trim());
    if (!session) {
      await reponse.code(401).send({ erreur: 'Session expiree ou invalide.' });
      return;
    }
    requete.session = session;
    requete.contexte = new ContexteEntreprise(db, session.entrepriseId);
  };
}

export function contexteDe(requete: FastifyRequest): ContexteEntreprise {
  if (!requete.contexte) throw new Error('Contexte entreprise absent : route mal protegee.');
  return requete.contexte;
}

export function sessionDe(requete: FastifyRequest): ContenuJeton {
  if (!requete.session) throw new Error('Session absente : route mal protegee.');
  return requete.session;
}
