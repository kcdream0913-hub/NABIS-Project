import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ChannelsPage() {
  const t = await getTranslations("channels");
  const tSectors = await getTranslations("sectors");
  const supabase = await createClient();
  const { data: channels } = await supabase
    .from("channels")
    .select("id, slug, name, description")
    .order("name");

  // Channel slug === sector slug: render the localized sector label, not the DB
  // English name/description. Falls back to the stored text for any non-sector slug.
  const sectorName = (slug: string, fallback: string) => {
    try { return tSectors(`${slug}.name`); } catch { return fallback; }
  };
  const sectorDesc = (slug: string, fallback: string) => {
    try { return tSectors(`${slug}.description`); } catch { return fallback; }
  };

  return (
    <div>
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(channels ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/channels/${c.slug}`}
            className="rounded-lg border border-border bg-surface p-4 hover:border-primary"
          >
            <p className="text-sm font-semibold"># {sectorName(c.slug, c.name)}</p>
            <p className="mt-1 text-xs text-ink-soft">{sectorDesc(c.slug, c.description)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
