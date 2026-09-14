import { chargerConfiguration } from './config.js';
import { fermerPrisma } from './db.js';
import { construireServices } from './services.js';
import { construireServeur } from './server.js';

async function demarrer(): Promise<void> {
  const config = chargerConfiguration();
  const services = construireServices(config);
  const app = await construireServeur(services);

  await app.listen({ port: config.PORT, host: config.HOTE });
  app.log.info(
    {
      telephonie: services.telephonie.nom,
      transcription: services.transcription.nom,
      analyse: services.extraction.nom,
    },
    'Serveur Carnet Artisan demarre',
  );

  const arret = async (): Promise<void> => {
    await app.close();
    await fermerPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void arret());
  process.on('SIGINT', () => void arret());
}

demarrer().catch((erreur: unknown) => {
  console.error('Demarrage impossible :', erreur);
  process.exit(1);
});
