/**
 * Generation du PDF d'un devis.
 *
 * Deux regles :
 *  - un devis non valide porte un filigrane "BROUILLON" et le mot brouillon
 *    dans son titre : un document exporte trop tot ne doit pas pouvoir passer
 *    pour un devis definitif ;
 *  - les mentions legales ne sont pas garanties completes. Le document affiche
 *    explicitement ce qui reste a verifier avant un usage commercial.
 */

import PDFDocument from 'pdfkit';
import { formatCents, formatQuantity, libelleTauxTva } from '@carnet/shared';

export interface EntrepriseEntete {
  nom: string;
  nomArtisan: string;
  adresseLigne1: string | null;
  codePostal: string | null;
  ville: string | null;
  telephonePro: string;
  emailContact: string;
  siret: string | null;
}

export interface LignePdf {
  libelle: string;
  unite: string;
  quantiteMilli: number | null;
  prixUnitaireCents: number | null;
  remiseBp: number;
  tvaRateBp: number | null;
  montantHtCents: number | null;
}

export interface DevisPdf {
  numero: string;
  objet: string;
  estBrouillon: boolean;
  clientNom: string;
  chantierLibelle: string;
  chantierAdresse: string | null;
  lignes: readonly LignePdf[];
  totalHtCents: number;
  postesTva: readonly { rateBp: number; baseHtCents: number; montantTvaCents: number }[];
  totalTvaCents: number;
  totalTtcCents: number;
  /** Points a verifier avant emission commerciale, affiches en pied de page. */
  reservesLegales: readonly string[];
}

export async function genererPdfDevis(
  entreprise: EntrepriseEntete,
  devis: DevisPdf,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const morceaux: Buffer[] = [];
  doc.on('data', (m: Buffer) => morceaux.push(m));
  const fini = new Promise<Buffer>((resolveFini) => {
    doc.on('end', () => { resolveFini(Buffer.concat(morceaux)); });
  });

  if (devis.estBrouillon) {
    doc.save();
    doc.rotate(-35, { origin: [300, 400] });
    doc.fontSize(78).fillColor('#e0e0e0').text('BROUILLON', 60, 360, { align: 'center' });
    doc.restore();
    doc.fillColor('black');
  }

  doc.fontSize(18).text(entreprise.nom);
  doc.fontSize(10).fillColor('#444');
  doc.text(entreprise.nomArtisan);
  if (entreprise.adresseLigne1) doc.text(entreprise.adresseLigne1);
  if (entreprise.codePostal ?? entreprise.ville) {
    doc.text(`${entreprise.codePostal ?? ''} ${entreprise.ville ?? ''}`.trim());
  }
  doc.text(`Tel. ${entreprise.telephonePro}`);
  doc.text(entreprise.emailContact);
  doc.text(entreprise.siret ? `SIRET ${entreprise.siret}` : 'SIRET a renseigner');
  doc.fillColor('black').moveDown();

  doc.fontSize(15).text(
    devis.estBrouillon ? `Brouillon de devis ${devis.numero}` : `Devis ${devis.numero}`,
  );
  doc.fontSize(10).fillColor('#444');
  doc.text(`Objet : ${devis.objet}`);
  doc.text(`Client : ${devis.clientNom}`);
  doc.text(`Chantier : ${devis.chantierLibelle}`);
  if (devis.chantierAdresse) doc.text(`Adresse : ${devis.chantierAdresse}`);
  doc.fillColor('black').moveDown();

  doc.fontSize(9);
  for (const ligne of devis.lignes) {
    const quantite = ligne.quantiteMilli === null ? 'a completer' : formatQuantity(ligne.quantiteMilli);
    const prix =
      ligne.prixUnitaireCents === null ? 'a completer' : formatCents(ligne.prixUnitaireCents);
    const montant = ligne.montantHtCents === null ? '—' : formatCents(ligne.montantHtCents);
    const tva = ligne.tvaRateBp === null ? 'TVA a choisir' : libelleTauxTva(ligne.tvaRateBp);
    doc.text(
      `${ligne.libelle}  |  ${quantite} ${ligne.unite}  x  ${prix}  |  ${tva}  |  ${montant}`,
    );
    if (ligne.remiseBp > 0) {
      doc.fillColor('#666').text(`   remise ${String(ligne.remiseBp / 100)} %`).fillColor('black');
    }
  }
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Total HT : ${formatCents(devis.totalHtCents)}`, { align: 'right' });
  for (const poste of devis.postesTva) {
    doc.text(
      `${libelleTauxTva(poste.rateBp)} sur ${formatCents(poste.baseHtCents)} : ${formatCents(poste.montantTvaCents)}`,
      { align: 'right' },
    );
  }
  doc.fontSize(12).text(`Total TTC : ${formatCents(devis.totalTtcCents)}`, { align: 'right' });

  doc.moveDown(2).fontSize(8).fillColor('#666');
  if (devis.estBrouillon) {
    doc.text(
      'Document de travail. Il ne constitue pas une offre commerciale et ne doit pas etre transmis en l etat.',
    );
  }
  if (devis.reservesLegales.length > 0) {
    doc.moveDown(0.5).text('A verifier avant emission commerciale :');
    for (const reserve of devis.reservesLegales) doc.text(`- ${reserve}`);
  }

  doc.end();
  return fini;
}

/**
 * Mentions dont l'absence est detectable automatiquement.
 * La liste n'a pas valeur de conformite juridique : elle signale seulement ce
 * que le logiciel sait verifier.
 */
export function reservesLegales(entreprise: EntrepriseEntete, aTvaZero: boolean): string[] {
  const reserves: string[] = [];
  if (!entreprise.siret) reserves.push('Numero SIRET absent.');
  if (!entreprise.adresseLigne1 || !entreprise.ville) {
    reserves.push('Adresse complete de l entreprise absente.');
  }
  if (aTvaZero) {
    reserves.push(
      'Une ligne est a 0 % : verifier la mention "TVA non applicable, art. 293 B du CGI".',
    );
  }
  reserves.push(
    'Mentions non verifiees par le logiciel : duree de validite, assurance decennale, conditions de reglement, delai de retractation.',
  );
  return reserves;
}
