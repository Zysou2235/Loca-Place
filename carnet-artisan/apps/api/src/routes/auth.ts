import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { METIERS } from '@carnet/shared';
import { hacherMotDePasse, verifierMotDePasse, ErreurMotDePasse } from '../auth/mots-de-passe.js';
import { emettreJeton } from '../auth/jetons.js';
import type { Services } from '../jobs/traitements.js';

const inscription = z.object({
  email: z.string().email(),
  motDePasse: z.string(),
  nomEntreprise: z.string().min(1).max(200),
  metier: z.string().min(1).max(60),
  nomArtisan: z.string().min(1).max(120),
  telephonePro: z.string().min(6).max(30),
  siret: z.string().max(20).optional(),
  adresseLigne1: z.string().max(200).optional(),
  codePostal: z.string().max(10).optional(),
  ville: z.string().max(100).optional(),
  fuseau: z.string().default('Europe/Paris'),
});

const connexion = z.object({ email: z.string().email(), motDePasse: z.string() });

export function routesAuth(services: Services): FastifyPluginAsync {
  return async function plugin(app: FastifyInstance) {
    app.get('/metiers', () => ({ metiers: METIERS }));

    app.post('/auth/inscription', async (requete, reponse) => {
      const parsed = inscription.safeParse(requete.body);
      if (!parsed.success) {
        return reponse.code(400).send({ erreur: 'Formulaire incomplet.', details: parsed.error.issues });
      }
      const d = parsed.data;
      const email = d.email.toLowerCase().trim();

      const existant = await services.db.utilisateur.findUnique({ where: { email } });
      if (existant) {
        return reponse.code(409).send({ erreur: 'Un compte existe deja avec cet email.' });
      }

      let motDePasseHash: string;
      try {
        motDePasseHash = await hacherMotDePasse(d.motDePasse);
      } catch (erreur) {
        if (erreur instanceof ErreurMotDePasse) {
          return reponse.code(400).send({ erreur: erreur.message });
        }
        throw erreur;
      }

      // Une entreprise nait toujours en mode DEMONSTRATION : aucun appel reel
      // ne peut arriver tant que la telephonie n'a pas ete configuree et testee.
      const entreprise = await services.db.entreprise.create({
        data: {
          nom: d.nomEntreprise,
          metier: d.metier,
          nomArtisan: d.nomArtisan,
          telephonePro: d.telephonePro,
          emailContact: email,
          siret: d.siret ?? null,
          adresseLigne1: d.adresseLigne1 ?? null,
          codePostal: d.codePostal ?? null,
          ville: d.ville ?? null,
          fuseau: d.fuseau,
          mode: 'DEMONSTRATION',
          utilisateurs: {
            create: { email, motDePasseHash, nomAffiche: d.nomArtisan, role: 'PROPRIETAIRE' },
          },
          configTelephonie: { create: {} },
          abonnement: { create: { statut: 'ESSAI' } },
        },
        include: { utilisateurs: true },
      });

      const utilisateur = entreprise.utilisateurs[0];
      if (!utilisateur) throw new Error('Utilisateur non cree.');
      const jeton = await emettreJeton({
        utilisateurId: utilisateur.id,
        entrepriseId: entreprise.id,
        role: 'PROPRIETAIRE',
      });
      return reponse.code(201).send({
        jeton,
        entreprise: { id: entreprise.id, nom: entreprise.nom, mode: entreprise.mode },
      });
    });

    app.post('/auth/connexion', async (requete, reponse) => {
      const parsed = connexion.safeParse(requete.body);
      if (!parsed.success) return reponse.code(400).send({ erreur: 'Identifiants incomplets.' });
      const email = parsed.data.email.toLowerCase().trim();

      const utilisateur = await services.db.utilisateur.findUnique({
        where: { email },
        include: { entreprise: true },
      });
      // Message identique dans les deux cas : on ne revele pas quels emails
      // ont un compte.
      const refus = { erreur: 'Email ou mot de passe incorrect.' };
      if (!utilisateur) {
        // Calcul factice pour ne pas distinguer les deux cas par le temps de reponse.
        await verifierMotDePasse(parsed.data.motDePasse, 'scrypt1$16384$8$1$AAAA$AAAA');
        return reponse.code(401).send(refus);
      }
      const ok = await verifierMotDePasse(parsed.data.motDePasse, utilisateur.motDePasseHash);
      if (!ok) return reponse.code(401).send(refus);

      await services.db.utilisateur.update({
        where: { id: utilisateur.id },
        data: { derniereConnexion: new Date() },
      });

      const jeton = await emettreJeton({
        utilisateurId: utilisateur.id,
        entrepriseId: utilisateur.entrepriseId,
        role: utilisateur.role,
      });
      return reponse.send({
        jeton,
        entreprise: {
          id: utilisateur.entreprise.id,
          nom: utilisateur.entreprise.nom,
          mode: utilisateur.entreprise.mode,
        },
      });
    });
  };
}
