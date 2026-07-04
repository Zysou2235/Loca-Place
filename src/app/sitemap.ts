import type { MetadataRoute } from "next";
import { GUIDES } from "./guides/guides-data";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.escalebox.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPaths: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/guides", priority: 0.8 },
    { path: "/a-propos", priority: 0.5 },
    { path: "/cgv", priority: 0.3 },
    { path: "/mentions-legales", priority: 0.3 },
    { path: "/confidentialite", priority: 0.3 },
  ];

  const guides = GUIDES.map((g) => ({
    url: `${SITE_URL}/guides/${g.slug}`,
    lastModified: new Date(g.datePublished),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    ...staticPaths.map(({ path, priority }) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority,
    })),
    ...guides,
  ];
}
