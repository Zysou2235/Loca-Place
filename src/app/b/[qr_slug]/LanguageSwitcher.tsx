import Link from "next/link";
import { TRAVELER_LANGS, type TravelerLang } from "@/lib/traveler-i18n";

/** Sélecteur de langue par drapeaux — simples liens, aucun JS requis. */
export function LanguageSwitcher({
  qrSlug,
  lang,
}: {
  qrSlug: string;
  lang: TravelerLang;
}) {
  return (
    <div className="flex gap-1.5">
      {TRAVELER_LANGS.map((l) => (
        <Link
          key={l.code}
          href={l.code === "fr" ? `/b/${qrSlug}` : `/b/${qrSlug}?lang=${l.code}`}
          aria-label={l.label}
          aria-current={l.code === lang}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition ${
            l.code === lang
              ? "bg-brand/10 ring-2 ring-brand/30"
              : "opacity-50 hover:opacity-100"
          }`}
        >
          {l.flag}
        </Link>
      ))}
    </div>
  );
}
