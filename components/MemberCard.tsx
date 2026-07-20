import Link from "next/link";
import type { Member } from "@/lib/types";
import { VIEW_META, initials } from "@/lib/data";

export default function MemberCard({ member }: { member: Member }) {
  const chip = member.country === "us" ? VIEW_META.us.chip : VIEW_META.nepal.chip;
  return (
    <article className="flex flex-col rounded-lg border border-line bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-pine-soft text-sm font-bold text-pine">
          {initials(member.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{member.name}</p>
          <p className="truncate text-xs text-ink-soft">{member.role}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-soft">{member.bio}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chip}`}>{member.location}</span>
        <Link href="/messages" className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-mist">
          Message
        </Link>
      </div>
    </article>
  );
}
