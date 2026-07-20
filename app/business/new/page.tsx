"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { SECTORS } from "@/lib/sectors";

export default function NewBusinessPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("United States");
  const [sector, setSector] = useState<string>(SECTORS[0].name);
  const [regNumber, setRegNumber] = useState("");
  const [bio, setBio] = useState("");
  const [isPaidProvider, setIsPaidProvider] = useState(false);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: business, error: insertError } = await supabase
      .from("businesses")
      .insert({
        name,
        country_of_registration: country,
        sector,
        registration_number: regNumber,
        bio,
        owner_user_id: user.id,
        is_paid_provider: isPaidProvider,
        access_price_amount: isPaidProvider ? Number(price) : null,
        access_price_currency: currency,
      })
      .select()
      .single();

    if (insertError || !business) {
      setError(insertError?.message ?? "Could not register the business.");
      setSubmitting(false);
      return;
    }

    // Owner is auto-added as the first team member (spec §5.3: only the owner
    // can add/remove others from here on).
    await supabase.from("business_members").insert({
      business_id: business.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      can_post: true,
      verified_via: "self",
      added_by: user.id,
    });

    router.push(`/business/${business.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow text-ink-soft">Register</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Your business</h1>
      <p className="mt-1 text-sm text-ink-soft">
        You verify as the owner; the entity is checked against its national registry in
        parallel — you're never blocked on paperwork.
      </p>

      <div className="mt-5 space-y-3 rounded-lg border border-line bg-white p-4">
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">Business name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Himalaya Freight Co."
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">Country of registration</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">Sector</span>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              {SECTORS.map((s) => (
                <option key={s.slug}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">Registration / tax number</span>
          <input
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            placeholder="PAN-VAT, EIN, or company no."
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
          />
        </label>

        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
          />
        </label>

        {/* Paid access — spec §5.13. Opt-in, per-provider. */}
        <div className="rounded-md border border-line bg-mist p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isPaidProvider}
              onChange={(e) => setIsPaidProvider(e.target.checked)}
              className="h-4 w-4 accent-pine"
            />
            Charge an upfront fee to contact this business
          </label>
          <p className="mt-1 text-xs text-ink-soft">
            Common for service providers — legal, freelancers, outsourcing, advisory.
            Browsing your bio stays free; paying unlocks contacting you. The platform
            takes a revenue-share commission on each payment.
          </p>
          {isPaidProvider && (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Amount"
                className="w-32 rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm"
              >
                <option>USD</option>
                <option>NPR</option>
              </select>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rhodo">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting || !name}
          className="w-full rounded-md bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-50"
        >
          {submitting ? "Registering…" : "Register business"}
        </button>
      </div>
    </div>
  );
}
