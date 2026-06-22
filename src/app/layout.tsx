import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Staybox",
  description: "Achetez des produits proposés par votre hôte, en un scan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
