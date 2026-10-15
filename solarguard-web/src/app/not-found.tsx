import Link from "next/link";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/States";

export default function NotFound() {
  return (
    <Panel title="Not found">
      <EmptyState
        title="We could not find that page"
        action={
          <Link
            href="/"
            className="rounded-ctl bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            Back to Fleet Overview
          </Link>
        }
      >
        The site, alert or page you opened does not exist in this workspace.
      </EmptyState>
    </Panel>
  );
}
