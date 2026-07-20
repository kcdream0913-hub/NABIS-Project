import type { LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function EmptyState({
  icon: Icon, title, body, actionHref, actionLabel,
}: {
  icon: LucideIcon; title: string; body: string; actionHref?: string; actionLabel?: string;
}) {
  return (
    <div className="grid place-items-center rounded-lg border border-dashed border-line bg-white px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-mist text-ink-soft">
        <Icon size={20} />
      </span>
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{body}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-4 rounded-md bg-pine px-3.5 py-2 text-sm font-medium text-white hover:bg-pine-ink">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
