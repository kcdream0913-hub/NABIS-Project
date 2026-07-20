"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SECTORS } from "@/lib/sectors";

type Profile = {
  id: string;
  name: string | null;
  bio: string | null;
  city: string | null;
  country: "us" | "nepal" | null;
  sectors: string[] | null;
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
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(profile?.name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [country, setCountry] = useState<"us" | "nepal">(profile?.country ?? "us");
  const [sectors, setSectors] = useState<string[]>(profile?.sectors ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isVerified = profile?.verification_status === "verified";

  function toggleSector(slug: string) {
    setSectors((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  async function save() {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ name, bio, city, country, sectors })
      .eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="eyebrow text-ink-soft">Account</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Profile &amp; settings</h1>
        <p className="mt-1 text-sm text-ink-soft">{email}</p>
      </div>

      {/* Verification status — the entry point, per spec §5.2. Not a signup gate. */}
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-3">
          {isVerified ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-success text-text-success">
              <ShieldCheck size={20} />
            </span>
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-soft text-gold">
              <ShieldQuestion size={20} />
            </span>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {isVerified ? "Verified profile" : "Not yet verified"}
            </p>
            <p className="text-xs text-ink-soft">
              {isVerified
                ? "You can post and message across BridgeLink."
                : "Verify to unlock posting and messaging."}
            </p>
          </div>
          {!isVerified && (
            <button
              onClick={() => router.push("/profile/verify")}
              className="shrink-0 rounded-md bg-pine px-3.5 py-2 text-sm font-medium text-white hover:bg-pine-ink"
            >
              Verify your profile
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
            />
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">Country</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as "us" | "nepal")}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="us">United States</option>
              <option value="nepal">Nepal</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
            />
          </label>
        </div>
      </section>

      {/* "What describes you" = sector/channel names, per spec §5.2 */}
      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">What describes you</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Select every channel that fits — you can belong to more than one.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SECTORS.map((s) => {
            const active = sectors.includes(s.slug);
            return (
              <button
                key={s.slug}
                onClick={() => toggleSector(s.slug)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "border-pine bg-pine-soft text-pine-ink"
                    : "border-line text-ink-soft hover:bg-mist"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-50"
      >
        {saved ? "Saved" : saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
