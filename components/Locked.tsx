import { Lock } from "lucide-react";
import Link from "next/link";

export default function Locked({
  title, phase, body, prep,
}: { title: string; phase: string; body: string; prep?: { label: string; href: string } }) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-lg border border-line bg-white p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold-soft text-gold">
          <Lock size={20} />
        </span>
        <p className="eyebrow mt-4 text-gold">{phase}</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{body}</p>
        {prep ? (
          <Link href={prep.href} className="mt-5 inline-block rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink">
            {prep.label}
          </Link>
        ) : null}
      </div>
      <p className="mt-3 text-center text-xs text-ink-soft">
        Sequencing is deliberate: community first, utility second, transactions third.
      </p>
    </div>
  );
}
