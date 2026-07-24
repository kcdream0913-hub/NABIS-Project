import type { ReactNode } from "react";

/** A settings card: title, optional description, then rows. Uses the .card
 *  surface primitive so it adapts to light/dark. Presentational — usable from
 *  server or client sections. */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-ink-soft">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** A labelled row: label (+ hint) on the left, control on the right. Wraps on
 *  narrow screens. */
export function SettingsRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">{label}</label>
        {hint && <p className="mt-0.5 text-[13px] text-ink-soft">{hint}</p>}
      </div>
      {children && <div className="shrink-0 sm:pl-4">{children}</div>}
    </div>
  );
}

/** Small muted note (honest-scope disclaimers, etc.). */
export function SettingsNote({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-ink-soft">{children}</p>;
}
