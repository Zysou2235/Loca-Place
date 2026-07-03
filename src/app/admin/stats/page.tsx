import { redirect } from "next/navigation";

/**
 * Fusionné dans « Données » (/admin/data) : une seule page d'analytics au
 * lieu de deux qui se recoupaient (CA, panier moyen, répartition par box).
 * On garde la route pour les favoris/liens existants.
 */
export default function AdminStatsPage() {
  redirect("/admin/data");
}
