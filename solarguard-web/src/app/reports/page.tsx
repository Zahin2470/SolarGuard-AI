import type { Metadata } from "next";
import { ComingLater } from "@/components/shell/ComingLater";

export const metadata: Metadata = { title: "Reports & Impact" };

export default function ReportsPage() {
  return (
    <ComingLater
      title="Reports & Impact"
      purpose="See detected gap, potentially recoverable energy and verified improvement kept strictly apart."
      arrives="Phase 4"
      includes={[
        "Impact ledger with calculation method and assumptions",
        "Pre-action baseline vs post-action window",
        "Exportable report separating estimates from verified outcomes",
      ]}
    />
  );
}
