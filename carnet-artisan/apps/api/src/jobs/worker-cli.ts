import { chargerConfiguration } from '../config.js';
import { fermerPrisma } from '../db.js';
import { construireServices } from '../services.js';
import { boucleWorker } from './worker.js';

const config = chargerConfiguration();
const services = construireServices(config);
const controleur = new AbortController();

process.on('SIGTERM', () => { controleur.abort(); });
process.on('SIGINT', () => { controleur.abort(); });

console.log('Worker Carnet Artisan demarre.');
boucleWorker(services, {
  signal: controleur.signal,
  journaliser: (message, details) => { console.log(message, details ?? ''); },
})
  .then(async (traites) => {
    console.log(`Worker arrete apres ${String(traites)} job(s).`);
    await fermerPrisma();
  })
  .catch(async (erreur: unknown) => {
    console.error('Worker interrompu :', erreur);
    await fermerPrisma();
    process.exit(1);
  });
