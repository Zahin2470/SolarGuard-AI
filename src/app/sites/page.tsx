import type { Metadata } from "next";
import { ComingLater } from "@/components/shell/ComingLater";

export const metadata: Metadata = { title: "Sites" };

export default function SitesPage() {
  return (
    <ComingLater
      title="Sites"
      purpose="Browse every monitored site and open a detailed performance view."
      arrives="Phase 2"
      includes={[
        "Searchable, sortable site list with data freshness",
        "Site detail: actual vs expected, data quality, inverter metadata",
        "Recovery-case history per site",
      ]}
    />
  );
}
