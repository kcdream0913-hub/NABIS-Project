"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSectors } from "@/lib/useSectors";
import { normalizeProfileLinks } from "@/lib/socialLinks";
import AvatarUpload from "@/components/AvatarUpload";
import ProfileLinksEditor from "@/components/ProfileLinksEditor";

type Profile = {
  id: string;
  name: string | null;
  headline: string | null;
  bio: string | null;
  bio_ne: string | null;
  city: string | null;
  country: "us" | "nepal" | null;
  sectors: string[] | null;
  links: Record<string, string> | null;
  avatar_url: string | null;
  verification_status: "unverified" | "verified";
} | null;

export default function ProfileEditor({
  userId,
  email,
  profile,
}: {
  userId: string;
  email: string;
  profile: Profile;
}) {
  const t = useTranslations("profile");
  const tAvatar = useTranslations("avatar");
  const sectors = useSectors();
  const router = useRouter();
  const supabase = createClient();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [name, setName] = useState(profile?.name ?? "");
  const [headline, setHeadline] = useState(profile?.headline ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [bioNe, setBioNe] = useState(profile?.bio_ne ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [linksInput, setLinksInput] = useState<Record<string, string>>(() => ({ ...(profile?.links ?? {}) }));
  const [country, setCountry] = useState<"us" | "nepal">(profile?.country ?? "us");
  const [selectedSectors, setSelectedSectors] = useState<string[]>(profile?.sectors ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isVerified = profile?.verification_status === "verified";

  function toggleSector(slug: string) {
    setSelectedSectors((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function save() {
    setSaving(true);
    await supabase
      .from("profiles")
      // Saving through the editor = the owner has taken ownership of the Nepali
      // bio, so it's no longer an unreviewed machine draft. links is normalised
      // here (UX); the render-time https-only guard is the security boundary.
      .update({
        name,
        headline: headline.trim() || null,
        bio,
        bio_ne: bioNe,
        bio_ne_auto: false,
        city,
        country,
        sectors: selectedSectors,
        links: normalizeProfileLinks(linksInput),
      })
      .eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{email}</p>
      </div>

      {/* Verification status — the entry point, per spec §5.2. Not a signup gate. */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          {isVerified ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-active-soft text-active">
              <ShieldCheck size={20} />
            </span>
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bridge-soft text-bridge">
              <ShieldQuestion size={20} />
            </span>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {isVerified ? t("verifiedTitle") : t("notVerifiedTitle")}
            </p>
            <p className="text-xs text-ink-soft">
              {isVerified
                ? t("verifiedBody")
                : t("notVerifiedBody")}
            </p>
          </div>
          {!isVerified && (
            <button
              onClick={() => router.push("/profile/verify")}
              className="shrink-0 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed"
            >
              {t("verifyCta")}
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{t("profileHeading")}</h2>
        <div className="mt-3">
          <AvatarUpload kind="user" currentUrl={avatarUrl} name={name} label={tAvatar("photoLabel")} onChange={setAvatarUrl} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">{t("name")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
            />
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">{t("country")}</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as "us" | "nepal")}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="us">{t("unitedStates")}</option>
              <option value="nepal">{t("nepal")}</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">{t("headline")}</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={120}
              placeholder={t("headlinePlaceholder")}
              className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">{t("city")}</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">{t("bioEn")}</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder={t("bioEnPlaceholder")}
              className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">{t("bioNe")}</span>
            <textarea
              value={bioNe}
              onChange={(e) => setBioNe(e.target.value)}
              rows={3}
              lang="ne"
              className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
            />
          </label>
        </div>
        <div className="mt-4">
          <ProfileLinksEditor value={linksInput} onChange={setLinksInput} />
        </div>
      </section>

      {/* "What describes you" = sector/channel names, per spec §5.2 */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{t("describeHeading")}</h2>
        <p className="mt-1 text-xs text-ink-soft">
          {t("describeHint")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sectors.map((sec) => {
            const active = selectedSectors.includes(sec.slug);
            return (
              <button
                key={sec.slug}
                onClick={() => toggleSector(sec.slug)}
                title={sec.description}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "border-primary bg-primary-soft text-primary-pressed"
                    : "border-border text-ink-soft hover:bg-bg"
                }`}
              >
                {sec.name}
              </button>
            );
          })}
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
      >
        {saved ? t("saved") : saving ? t("saving") : t("saveChanges")}
      </button>
    </div>
  );
}
