"use client";

import { useTranslations } from "next-intl";

// The R2 escape hatch: every step of both paths links to the other one. Google
// import is deferred (D-033), so the guided→manual link is honest plain copy
// ("fill in a standard form") rather than "import from Google".
export default function PathSwitchLink({ to, onSwitch }: { to: "manual" | "guided"; onSwitch: () => void }) {
  const t = useTranslations("guided");
  return (
    <button
      type="button"
      onClick={onSwitch}
      className="text-left text-xs font-medium text-primary underline underline-offset-2 hover:text-primary-pressed"
    >
      {t(to === "manual" ? "switchToManual" : "switchToGuided")}
    </button>
  );
}
