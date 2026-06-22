import crypto from "crypto";

/** Turn a free-text name into a URL-safe slug with a short random suffix. */
export function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = crypto.randomBytes(3).toString("hex");
  return base ? `${base}-${suffix}` : suffix;
}
