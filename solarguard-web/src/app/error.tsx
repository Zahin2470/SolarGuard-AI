"use client";

import { useEffect } from "react";
import { Panel } from "@/components/ui/Panel";
import { ErrorState } from "@/components/ui/States";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Panel title="Fleet Overview">
      <ErrorState title="Fleet data could not be loaded" onRetry={reset}>
        Nothing was changed. Check that the data service is reachable, then try again.
        {error.digest ? ` (Reference: ${error.digest})` : ""}
      </ErrorState>
    </Panel>
  );
}
