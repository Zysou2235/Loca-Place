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

export const metadata: Metadata = {
  title: "Eskale Box — La boutique autonome pour voyageurs",
  description:
    "La box transparente avec QR code qui permet aux hôtes de vendre des produits à leurs voyageurs. Paiement direct, 0% de commission, installation en 5 minutes.",
  openGraph: {
    title: "Eskale Box — La boutique autonome pour voyageurs",
    description:
      "Transformez votre logement en boutique autonome. Vos voyageurs scannent, paient, se servent. Vous encaissez.",
    type: "website",
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
