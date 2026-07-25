"use client";

import { useState } from "react";
import Step0Country from "./_components/Step0Country";
import ManualBusinessForm, { type ManualInitial } from "./_components/ManualBusinessForm";
import GuidedBuilder from "./_components/guided/GuidedBuilder";
import PathSwitchLink from "./_components/shared/PathSwitchLink";

// Host: Step 0 country fork → path (BL-BIZ-02 §4, D-033). US routes to the
// existing manual form (Google import deferred); Nepal to the guided builder.
// Shared fields (name/city/sectors) are held here so switching paths never loses
// what was already entered (R2).
export default function NewBusinessPage() {
  const [path, setPath] = useState<null | "us" | "nepal">(null);
  const [shared, setShared] = useState<ManualInitial>({});

  if (!path) return <Step0Country onPick={setPath} />;

  if (path === "nepal") {
    return (
      <GuidedBuilder
        initial={shared}
        onShared={setShared}
        switchLink={<PathSwitchLink to="manual" onSwitch={() => setPath("us")} />}
      />
    );
  }

  return (
    <ManualBusinessForm
      initial={{ ...shared, country: shared.country ?? "United States" }}
      onShared={setShared}
      switchLink={<PathSwitchLink to="guided" onSwitch={() => setPath("nepal")} />}
    />
  );
}
