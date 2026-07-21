"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Camera, ShieldCheck, CheckCircle2, Clock, XCircle, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { documentsFor } from "@/lib/countries";
import { useApp } from "@/lib/store";
import { getVerificationTracks, isBridgeEligible, type PolicyTrack, type TrackStatus } from "@/lib/kyc";

const TRACK_COUNTRY: Record<PolicyTrack, string> = { us: "United States", nepal: "Nepal" };

export default function VerifyProfilePage() {
  const t = useTranslations("verify");
  const router = useRouter();
  const supabase = createClient();
  const { view } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [tracks, setTracks] = useState<Record<PolicyTrack, TrackStatus>>({ us: "none", nepal: "none" });
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [activeTrack, setActiveTrack] = useState<PolicyTrack | null>(null);

  const [docType, setDocType] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function loadTracks() {
    setLoadingTracks(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setTracks(await getVerificationTracks(supabase, user.id));
    setLoadingTracks(false);
  }

  useEffect(() => {
    loadTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  function openTrack(track: PolicyTrack) {
    setActiveTrack(track);
    setDocType(documentsFor(TRACK_COUNTRY[track])[0]);
    setCaptured(false);
    setJustSubmitted(false);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch {
      setCameraError(t("cameraError"));
    }
  }

  function capture() {
    setCaptured(true);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    setCameraOn(false);
  }

  async function submit() {
    if (!activeTrack) return;
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Real DB write: creates a pending record for THIS policy track only. In
    // production this is where the Shufti Pro session/result is attached
    // (see docs/BUILD.md / SPECIFICATION.md §5.2) — the interface is
    // intentionally the same shape either way, so wiring the provider later
    // doesn't change this call site.
    await supabase.from("verification_records").insert({
      subject_type: "user",
      subject_id: user.id,
      provider: "pending_integration",
      document_type: docType,
      document_country: TRACK_COUNTRY[activeTrack],
      policy_track: activeTrack,
      checks: { captured: true },
      status: "pending",
    });

    setSubmitting(false);
    setJustSubmitted(true);
    setTracks((prev) => ({ ...prev, [activeTrack]: "pending" }));
  }

  const bridgeEligible = isBridgeEligible(tracks);

  const statusMeta: Record<TrackStatus, { label: string; icon: typeof Circle; className: string }> = {
    none: { label: t("statusNone"), icon: Circle, className: "text-ink-soft" },
    pending: { label: t("statusPending"), icon: Clock, className: "text-gold" },
    passed: { label: t("statusPassed"), icon: CheckCircle2, className: "text-text-success" },
    failed: { label: t("statusFailed"), icon: XCircle, className: "text-rhodo" },
  };

  // --- Track capture flow (open) ---
  if (activeTrack) {
    if (justSubmitted) {
      return (
        <div className="mx-auto max-w-md py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-bg-success text-text-success">
            <ShieldCheck size={26} />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">{t("submittedTitle")}</h1>
          <p className="mt-2 text-sm text-ink-soft">{t("trackSubmittedBody")}</p>
          <button
            onClick={() => setActiveTrack(null)}
            className="mt-6 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink"
          >
            {t("back")}
          </button>
        </div>
      );
    }

    const docs = documentsFor(TRACK_COUNTRY[activeTrack]);
    return (
      <div className="mx-auto max-w-md">
        <button onClick={() => setActiveTrack(null)} className="mb-3 text-sm font-medium text-ink-soft hover:text-ink">
          ← {t("back")}
        </button>
        <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
          {activeTrack === "us" ? t("usTrack") : t("nepalTrack")}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>

        <div className="mt-5 space-y-3">
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
            <video ref={videoRef} autoPlay playsInline muted className={cameraOn ? "h-full w-full object-cover" : "hidden"} />
            {captured && (
              <div className="grid h-full place-items-center text-sm text-ink-soft">{t("documentCaptured")}</div>
            )}
          </div>
          {cameraError && <p className="text-sm text-rhodo">{cameraError}</p>}
          {cameraOn && (
            <button onClick={capture} className="w-full rounded-md bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-pine-ink">
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
          <p className="text-center text-xs text-ink-soft">{t("footnote")}</p>
        </div>
      </div>
    );
  }

  // --- Overview: two independent tracks ---
  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>

      {view === "bridge" && (
        <p
          className={`mt-3 rounded-md border p-3 text-sm ${
            bridgeEligible ? "border-line bg-bg-success text-text-success" : "border-dashed border-line bg-mist text-ink-soft"
          }`}
        >
          {bridgeEligible ? t("bridgeReady") : t("bridgeExplainer")}
        </p>
      )}

      {loadingTracks ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : (
        <div className="mt-5 space-y-2">
          {(["us", "nepal"] as PolicyTrack[]).map((track) => {
            const status = tracks[track];
            const meta = statusMeta[status];
            const StatusIcon = meta.icon;
            const emphasized = view === track;
            return (
              <div
                key={track}
                className={`rounded-lg border p-4 ${emphasized ? "border-pine" : "border-line"} bg-white`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{track === "us" ? t("usTrack") : t("nepalTrack")}</span>
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.className}`}>
                    <StatusIcon size={14} /> {meta.label}
                  </span>
                </div>
                {status !== "passed" && (
                  <button
                    onClick={() => openTrack(track)}
                    className="mt-3 rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-mist"
                  >
                    {status === "failed" ? t("retry") : t("startVerification")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
