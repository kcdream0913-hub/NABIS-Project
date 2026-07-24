export function Cover({ accent = "brand" }: { accent?: "brand" | "bridge" }) {
  const bg = accent === "bridge"
    ? "linear-gradient(120deg, #7a5f14, var(--color-bridge))"
    : "linear-gradient(120deg, var(--color-primary-pressed), var(--color-primary))";
  return <div className="h-14 w-full" style={{ background: bg }} aria-hidden />;
}
