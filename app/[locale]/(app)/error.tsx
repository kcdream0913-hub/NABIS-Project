"use client";

import { useEffect } from "react";

// Route-level error boundary for the whole (app) segment — Next.js renders this
// (inside the app layout) instead of the global blank-screen when a page throws.
// Deliberately dependency-free (no i18n / store / supabase hooks): the error
// page must never itself fail, even when the crash is in one of those. Bilingual
// copy is hardcoded for the same reason.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold text-ink">
        Something went wrong · केही गडबड भयो
      </h1>
      <p className="text-sm text-ink-soft">
        This screen hit an error. Try again, or return to the feed.
        <br />
        यो स्क्रिनमा त्रुटि आयो। पुनः प्रयास गर्नुहोस्, वा फिडमा फर्कनुहोस्।
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-pressed"
        >
          Try again · पुनः प्रयास
        </button>
        <a
          href="/"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"
        >
          Go to feed · फिड
        </a>
      </div>
    </div>
  );
}
