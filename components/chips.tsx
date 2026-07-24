type ViewKey = "us" | "nepal" | "bridge";

const VIEW: Record<ViewKey, { cls: string; label: string }> = {
  us:     { cls: "bg-view-us-soft text-view-us",         label: "US" },
  nepal:  { cls: "bg-view-nepal-soft text-view-nepal",   label: "Nepal" },
  bridge: { cls: "bg-view-bridge-soft text-view-bridge", label: "Bridge" },
};

export function ViewChip({ view, label }: { view: ViewKey; label?: string }) {
  const v = VIEW[view];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.cls}`}>{label ?? v.label}</span>;
}

export function SectorChip({ label, primary = false }: { label: string; primary?: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${primary ? "bg-primary-soft text-chip-ink" : "bg-surface-2 text-ink-soft"}`}>
      {label}
    </span>
  );
}
