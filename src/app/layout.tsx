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
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://escalebox.fr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Escale Box — La boutique autonome pour voyageurs",
  description:
    "La box transparente avec QR code qui permet aux hôtes de vendre des produits à leurs voyageurs. Paiement direct, 0% de commission, installation en 5 minutes.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Escale Box — La boutique autonome pour voyageurs",
    description:
      "Transformez votre logement en boutique autonome. Vos voyageurs scannent, paient, se servent. Vous encaissez.",
    type: "website",
    url: SITE_URL,
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
