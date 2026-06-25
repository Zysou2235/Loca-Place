import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.escalebox.fr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Espaces privés / techniques : pas d'indexation.
      disallow: ["/host", "/admin", "/api", "/checkout"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
