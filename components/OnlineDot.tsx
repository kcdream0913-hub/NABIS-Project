export function OnlineDot({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Online"
      className={`block h-2.5 w-2.5 rounded-full bg-online ring-2 ring-surface ${className}`}
    />
  );
}
