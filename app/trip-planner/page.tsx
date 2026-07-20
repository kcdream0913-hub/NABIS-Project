import { Map } from "lucide-react";
import Link from "next/link";

export default function TripPlannerPage() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-lg border border-line bg-white p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-pine-soft text-pine"><Map size={20} /></span>
        <p className="eyebrow mt-4 text-pine">Phase 2 · Utility layer</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Trip Planner</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Budget estimates, itinerary building, and recommendations tuned to Nepal are next after the
          community reaches critical mass. It will draw on what members share here — real operators,
          real prices, real routes.
        </p>
        <div className="mt-5 space-y-2 rounded-md border border-dashed border-line bg-mist p-4">
          <p className="eyebrow text-ink-soft">Preview of the inputs</p>
          <div className="grid grid-cols-2 gap-2 opacity-60">
            <input disabled placeholder="Dates" className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
            <input disabled placeholder="Budget (USD)" className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
            <input disabled placeholder="Group size" className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
            <input disabled placeholder="Interests" className="rounded-md border border-line bg-white px-3 py-2 text-sm" />
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-soft">
          Planning a trip now? Post it in{" "}
          <Link href="/community" className="font-medium text-pine hover:text-pine-ink">Travel Plans</Link>{" "}
          — members are already coordinating around each other&apos;s dates.
        </p>
      </div>
    </div>
  );
}
