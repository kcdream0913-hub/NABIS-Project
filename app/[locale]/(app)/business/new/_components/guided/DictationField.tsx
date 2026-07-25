"use client";

import { useId } from "react";

// A field tuned for phone-keyboard dictation (§10): visible <label> (never
// placeholder-as-label), no maxlength that truncates mid-dictation, no validation
// while speaking (validate on blur only). autocapitalize/autocorrect/spellcheck
// are per-field. Gboard's Nepali voice typing does the ASR — this just gives it a
// forgiving field.
export default function DictationField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  multiline,
  autoCapitalize = "sentences",
  spellCheck = true,
  autoCorrect = true,
  lang,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
  spellCheck?: boolean;
  autoCorrect?: boolean;
  lang?: string;
  error?: string | null;
}) {
  const id = useId();
  const common = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onBlur,
    placeholder,
    lang,
    autoCapitalize,
    spellCheck,
    autoCorrect: autoCorrect ? "on" : "off",
    inputMode: "text" as const,
    className: "mt-1 w-full rounded-lg border border-border-input px-3.5 py-3 text-base focus:border-primary",
  };
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
      {multiline ? (
        <textarea {...common} rows={4} />
      ) : (
        <input {...common} type="text" />
      )}
      {error && <p className="mt-1 text-xs text-accent" role="alert">{error}</p>}
    </div>
  );
}
