import type { Metadata } from "next";
import { ComingLater } from "@/components/shell/ComingLater";

export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return (
    <ComingLater
      title="Alerts"
      purpose="Triage anomalies with the evidence, confidence and next human check in one place."
      arrives="Phase 2"
      includes={[
        "Scannable alert list by severity, persistence and status",
        "Observed-vs-expected evidence separated from probable cause",
        "Create a recovery case from an alert",
      ]}
    />
  );
}
