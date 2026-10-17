import { ApiError, ApiNotConfiguredError, ApiUnavailableError } from "@/lib/api/client";
import { EmptyState } from "@/components/ui/States";
import { RetryButton } from "@/components/ui/RetryButton";
import { CircleAlert } from "lucide-react";

/** Explains an API failure in plain words. Never substitutes demo data for a live screen. */
export function ApiProblem({ error }: { error: unknown }) {
  if (error instanceof ApiNotConfiguredError) {
    return (
      <EmptyState title="The API is not connected">
        Set <code className="rounded bg-sunken px-1 py-0.5 text-xs">SOLARGUARD_API_URL</code> (for example{" "}
        <code className="rounded bg-sunken px-1 py-0.5 text-xs">http://localhost:8000</code>) in{" "}
        <code className="rounded bg-sunken px-1 py-0.5 text-xs">.env.local</code> and restart the web app. This
        screen shows live records only; it never fills in sample cases.
      </EmptyState>
    );
  }
  const message =
    error instanceof ApiUnavailableError || error instanceof ApiError
      ? error.message
      : "An unexpected error occurred while loading this section.";
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-crit-soft text-crit">
        <CircleAlert aria-hidden className="size-5" />
      </span>
      <div className="max-w-md">
        <p className="text-sm font-semibold text-ink">This section could not be loaded</p>
        <p className="mt-1 text-sm text-ink-muted">{message} Nothing on this page has been changed.</p>
      </div>
      <RetryButton />
    </div>
  );
}
