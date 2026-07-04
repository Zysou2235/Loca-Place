import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Domaine public officiel — sert de base aux URLs canoniques / Open Graph.
// Surchargable via NEXT_PUBLIC_SITE_URL si besoin (préprod, etc.).
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.escalebox.fr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Escale Box — La boutique autonome pour voyageurs",
  description:
    "La box transparente avec QR code qui permet aux hôtes de vendre des produits à leurs voyageurs. Paiement direct, 0% de commission, installation en 5 minutes.",
  // Pas de canonical ici : il serait hérité par TOUTES les pages, qui se
  // déclareraient alors doublons de l'accueil. Chaque page publique définit
  // le sien (voir alternates dans chaque page.tsx).
  openGraph: {
    // Valeurs par défaut (siteName, type, logo) — chaque page publique
    // définit son propre titre/description/url OG.
    type: "website",
    siteName: "Escale Box",
    images: ["/escale-box-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${poppins.variable} ${inter.variable}`}>
      <body className="min-h-screen scroll-smooth antialiased">{children}</body>
    </html>
  );
}
