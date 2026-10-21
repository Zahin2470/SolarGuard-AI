import { Radio } from "lucide-react";
import { ImpactStatusLabel } from "./ImpactStatusLabel";

/** Says where a page's numbers come from. Every data page shows exactly one of these. */
export function SourceBadge({ source }: { source: "demo" | "api" }) {
  if (source === "demo") return <ImpactStatusLabel level="demo" />;
  return (
    <span
      title="These figures come from records stored in the SolarGuard API."
      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-primary-strong"
    >
      <Radio aria-hidden className="size-3 shrink-0" />
      Live API data
    </span>
  );
}
