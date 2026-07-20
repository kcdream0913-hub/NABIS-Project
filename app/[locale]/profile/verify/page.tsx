"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Camera, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES, documentsFor } from "@/lib/countries";

export default function VerifyProfilePage() {
  const t = useTranslations("verify");
  const router = useRouter();
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [country, setCountry] = useState("United States");
  const [docType, setDocType] = useState(documentsFor("United States")[0]);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const docs = documentsFor(country);

  useEffect(() => {
    if (!docs.includes(docType)) setDocType(docs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch {
      setCameraError(
        t("cameraError")
      );
    }
  }

  function capture() {
    setCaptured(true);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  }

  async function submit() {
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Real DB write: create a pending verification record. In production this
    // is where the Shufti Pro session/result is attached (see docs/BUILD.md /
    // SPECIFICATION.md §5.2) — the interface is intentionally the same shape
    // either way, so wiring the provider later doesn't change this call site.
    await supabase.from("verification_records").insert({
      subject_type: "user",
      subject_id: user.id,
      provider: "pending_integration",
      document_type: docType,
      document_country: country,
      checks: { captured: true },
      status: "pending",
    });

    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bg-success text-text-success">
          <ShieldCheck size={26} />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{t("submittedTitle")}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {t("submittedBody")}
        </p>
        <button
          onClick={() => router.push("/profile")}
          className="mt-6 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink"
        >
          {t("backToProfile")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {t("subtitle")}
      </p>

      <div className="mt-5 space-y-3">
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("countryOfId")}</span>
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
          <span className="eyebrow text-ink-soft">{t("document")}</span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
          >
            {docs.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>

        <div className="relative h-52 overflow-hidden rounded-lg border border-line bg-surface-2">
          {!cameraOn && !captured && (
            <div className="grid h-full place-items-center">
              <button
                onClick={startCamera}
                className="flex items-center gap-2 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink"
              >
                <Camera size={16} /> {t("turnOnCamera")}
              </button>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cameraOn ? "h-full w-full object-cover" : "hidden"}
          />
          {captured && (
            <div className="grid h-full place-items-center text-sm text-ink-soft">
              {t("documentCaptured")}
            </div>
          )}
        </div>
        {cameraError && <p className="text-sm text-rhodo">{cameraError}</p>}
        {cameraOn && (
          <button
            onClick={capture}
            className="w-full rounded-md bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-pine-ink"
          >
            {t("capture")}
          </button>
        )}

        <button
          onClick={submit}
          disabled={!captured || submitting}
          className="w-full rounded-md bg-fill-accent px-4 py-2.5 text-sm font-medium text-on-accent disabled:opacity-40"
        >
          {submitting ? t("submitting") : t("submit")}
        </button>
        <p className="text-center text-xs text-ink-soft">
          {t("footnote")}
        </p>
      </div>
    </div>
  );
}
