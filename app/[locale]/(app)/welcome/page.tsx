"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, Newspaper, Users, Map, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSectors } from "@/lib/useSectors";
import { markOnboarded } from "@/lib/onboarding";
import { trustTier } from "@/lib/trust";
import { TOURISM_SECTOR } from "@/lib/offerings";
import Avatar from "@/components/Avatar";
import AvatarUpload from "@/components/AvatarUpload";
import TrustBadge from "@/components/TrustBadge";
import ProfileLinksEditor from "@/components/ProfileLinksEditor";
import { normalizeProfileLinks } from "@/lib/socialLinks";

const STEP_COUNT = 3;

type MemberRow = { id: string; name: string | null; avatar_url: string | null; sectors: string[] | null; verification_status: string; bridge: boolean | null; preferences: { visibility?: string } | null };
type BusinessRow = { id: string; name: string; logo_url: string | null; primary_sector: string | null; secondary_sectors: string[] | null; verification_status: string };
type Suggestion = { key: string; kind: "member" | "business"; id: string; name: string; avatarUrl: string | null; tier: ReturnType<typeof trustTier> };

export default function WelcomePage() {
  const t = useTranslations("welcome");
  const tCommon = useTranslations("common");
  const tAvatar = useTranslations("avatar");
  const sectors = useSectors();
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [bioNe, setBioNe] = useState("");
  const [city, setCity] = useState("");
  const [linksInput, setLinksInput] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("name, headline, bio, bio_ne, city, sectors, avatar_url, links").eq("id", user.id).maybeSingle();
      if (data) {
        setUserName(data.name ?? null); setAvatarUrl(data.avatar_url ?? null);
        setHeadline(data.headline ?? "");
        setBio(data.bio ?? ""); setBioNe(data.bio_ne ?? ""); setCity(data.city ?? "");
        setSelected((data.sectors as string[]) ?? []);
        setLinksInput({ ...((data.links as Record<string, string>) ?? {}) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real directory suggestions for the selected sectors (RLS-respecting; private filtered).
  useEffect(() => {
    if (step !== 2 || selected.length === 0 || !userId) { setMembers([]); setBusinesses([]); return; }
    let active = true;
    (async () => {
      const [{ data: mem }, { data: biz }] = await Promise.all([
        supabase.from("profiles").select("id, name, avatar_url, sectors, verification_status, bridge, preferences").overlaps("sectors", selected).neq("id", userId).limit(40),
        supabase.from("businesses").select("id, name, logo_url, primary_sector, secondary_sectors, verification_status").in("primary_sector", selected).limit(40),
      ]);
      if (!active) return;
      setMembers(((mem as MemberRow[]) ?? []).filter((m) => (m.preferences?.visibility ?? "public") !== "private"));
      setBusinesses((biz as BusinessRow[]) ?? []);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selected, userId]);

  function toggleSector(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  function suggestionsFor(slug: string): Suggestion[] {
    const m: Suggestion[] = members
      .filter((x) => (x.sectors ?? []).includes(slug))
      .map((x) => ({ key: `m-${x.id}`, kind: "member", id: x.id, name: x.name ?? tCommon("verified"), avatarUrl: x.avatar_url, tier: trustTier(x) }));
    const b: Suggestion[] = businesses
      .filter((x) => x.primary_sector === slug || (x.secondary_sectors ?? []).includes(slug))
      .map((x) => ({ key: `b-${x.id}`, kind: "business", id: x.id, name: x.name, avatarUrl: x.logo_url, tier: trustTier({ verification_status: x.verification_status }) }));
    return [...b, ...m].slice(0, 3);
  }

  async function saveProfile() {
    if (!userId) return;
    // links normalised here (UX); the render-time https-only guard is the security boundary.
    await supabase.from("profiles").update({ headline: headline.trim() || null, bio, bio_ne: bioNe, city, links: normalizeProfileLinks(linksInput) }).eq("id", userId);
  }
  async function saveSectors() {
    if (!userId) return;
    await supabase.from("profiles").update({ sectors: selected }).eq("id", userId);
  }

  async function next() {
    setBusy(true);
    if (step === 1) await saveProfile();
    if (step === 2) await saveSectors();
    setBusy(false);
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }

  async function complete(href: string) {
    if (!userId) { router.push(href); return; }
    setBusy(true);
    if (step === 2) await saveSectors();
    await markOnboarded(userId);
    router.push(href);
  }

  const canPublish = selected.includes(TOURISM_SECTOR);
  const selectedWithSuggestions = selected.map((s) => ({ slug: s, name: sectors.find((x) => x.slug === s)?.name ?? s, items: suggestionsFor(s) })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-ink">{t("title")}</h1>
        </div>
        <button onClick={() => complete("/")} className="shrink-0 text-[13px] font-medium text-ink-soft hover:text-ink">
          {t("skip")}
        </button>
      </div>

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / STEP_COUNT) * 100}%` }} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{t("s1Title")}</h2>
              <p className="mt-0.5 text-[13px] text-ink-soft">{t("s1Subtitle")}</p>
            </div>
            {userId && (
              <AvatarUpload kind="user" currentUrl={avatarUrl} name={userName} label={tAvatar("photoLabel")} onChange={setAvatarUrl} />
            )}
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("headline")}</span>
              <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} placeholder={t("headlinePlaceholder")} className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary" />
            </label>
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("bioEn")}</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder={t("bioEnPlaceholder")} className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary" />
            </label>
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("bioNe")}</span>
              <textarea value={bioNe} onChange={(e) => setBioNe(e.target.value)} rows={3} lang="ne" className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary" />
            </label>
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("city")}</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("cityPlaceholder")} className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary" />
            </label>
            <ProfileLinksEditor value={linksInput} onChange={setLinksInput} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{t("s2Title")}</h2>
              <p className="mt-0.5 text-[13px] text-ink-soft">{t("s2Subtitle")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sectors.map((sec) => {
                const active = selected.includes(sec.slug);
                return (
                  <button key={sec.slug} onClick={() => toggleSector(sec.slug)} title={sec.description}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-primary bg-primary-soft text-primary-pressed" : "border-border text-ink-soft hover:bg-bg"}`}>
                    {sec.name}
                  </button>
                );
              })}
            </div>

            {selectedWithSuggestions.length > 0 && (
              <div className="space-y-3 border-t border-border pt-3">
                {selectedWithSuggestions.map((g) => (
                  <div key={g.slug}>
                    <p className="eyebrow text-ink-soft">{g.name}</p>
                    <div className="mt-1.5 space-y-1.5">
                      {g.items.map((s) => (
                        <Link key={s.key} href={s.kind === "business" ? `/business/${s.id}` : `/people/${s.id}`}
                          className="flex items-center gap-2 rounded-md border border-border p-2 hover:bg-bg">
                          <Avatar name={s.name} url={s.avatarUrl} size={28} shape={s.kind === "business" ? "rounded" : "circle"} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{s.name}</span>
                          <TrustBadge tier={s.tier} label={s.tier === "bridge" ? tCommon("bridgeVerified") : s.kind === "business" ? tCommon("verifiedBusiness") : tCommon("verified")} />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{t("s3Title")}</h2>
              <p className="mt-0.5 text-[13px] text-ink-soft">{t("s3Subtitle")}</p>
            </div>
            <div className="grid gap-2">
              <WelcomeCard icon={<Newspaper size={18} />} title={t("feedTitle")} body={t("feedBody")} onClick={() => complete("/")} />
              <WelcomeCard icon={<Users size={18} />} title={t("dirTitle")} body={t("dirBody")} onClick={() => complete("/members")} />
              {canPublish ? (
                <WelcomeCard icon={<Store size={18} />} title={t("publishTitle")} body={t("publishBody")} onClick={() => complete("/offerings/new")} />
              ) : (
                <WelcomeCard icon={<Map size={18} />} title={t("tripTitle")} body={t("tripBody")} onClick={() => complete("/trip-planner")} />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface disabled:opacity-0">
          <ArrowLeft size={15} /> {t("back")}
        </button>
        {step < STEP_COUNT ? (
          <button onClick={next} disabled={busy}
            className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50">
            {busy ? t("saving") : t("next")} <ArrowRight size={15} />
          </button>
        ) : (
          <button onClick={() => complete("/")} disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50">
            {busy ? t("saving") : t("finish")}
          </button>
        )}
      </div>
    </div>
  );
}

function WelcomeCard({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-bg">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] text-ink-soft">{body}</span>
      </span>
    </button>
  );
}
