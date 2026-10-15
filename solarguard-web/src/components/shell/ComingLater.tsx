import { Hammer } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/States";

/** Purposeful placeholder for routes that exist in navigation but are not built yet. */
export function ComingLater({
  title,
  purpose,
  arrives,
  includes,
}: {
  title: string;
  purpose: string;
  arrives: string;
  includes: string[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={purpose} />
      <Panel title={`Not built yet: planned for ${arrives}`}>
        <EmptyState
          title="This screen is not available in the current build"
          action={
            <Link
              href="/"
              className="rounded-ctl bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
            >
              Back to Fleet Overview
            </Link>
          }
        >
          It will not show placeholder numbers in the meantime.
        </EmptyState>
        <div className="mx-auto mt-2 max-w-md rounded-lg border border-dashed border-line-strong p-4 text-sm text-ink-muted">
          <p className="mb-2 flex items-center gap-2 font-semibold text-ink">
            <Hammer aria-hidden className="size-4" />
            Planned scope
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {includes.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      </Panel>
    </div>
  );
}
