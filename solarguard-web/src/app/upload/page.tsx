import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { UploadForm } from "@/components/cases/UploadForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/States";
import { listSites } from "@/lib/api/live";
import { settle } from "@/lib/api/settle";

export const metadata: Metadata = { title: "Upload data" };

async function UploadSection() {
  const res = await settle(listSites());
  if (!res.ok) return <ApiProblem error={res.error} />;
  return <UploadForm sites={res.value} />;
}

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload data"
        description="Add hourly or sub-hourly power telemetry for a site. The file is validated, normalised to hourly means, and checked by the detection rule."
      />
      <Panel
        title="Telemetry upload"
        description="Missing readings stay as gaps and are never converted to zero. Every rejected row is reported with its line number."
        className="max-w-4xl"
      >
        <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
          <UploadSection />
        </Suspense>
      </Panel>
    </div>
  );
}
