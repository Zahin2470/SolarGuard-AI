import type { Metadata } from "next";
import { ComingLater } from "@/components/shell/ComingLater";

export const metadata: Metadata = { title: "Recovery Cases" };

export default function RecoveryCasesPage() {
  return (
    <ComingLater
      title="Recovery Cases"
      purpose="Track an issue from detection to recorded action to an honest outcome status."
      arrives="Phase 3"
      includes={[
        "Case lifecycle: needs review, assigned, in progress, resolved",
        "Action notes and owner, with a timeline",
        "Outcome: verified, inconclusive or not verifiable",
      ]}
    />
  );
}
