"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Re-runs the server render of the current route (used on API error states). */
export function RetryButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
      className="rounded-ctl bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-70"
    >
      {pending ? "Retrying…" : "Try again"}
    </button>
  );
}
