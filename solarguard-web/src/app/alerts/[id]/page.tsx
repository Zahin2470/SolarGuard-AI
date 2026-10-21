import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiProblem } from "@/components/cases/ApiProblem";
import { DemoAlertDetail } from "@/components/alerts/DemoAlertDetail";
import { LiveAlertDetail } from "@/components/alerts/LiveAlertDetail";
import { Skeleton } from "@/components/ui/States";
import { getAlertDetail } from "@/lib/api/alerts";
import { settle } from "@/lib/api/settle";

export const metadata: Metadata = { title: "Alert" };

async function AlertDetailView({ params }: { params: PageProps<"/alerts/[id]">["params"] }) {
  const { id } = await params;
  const res = await settle(getAlertDetail(id));
  if (!res.ok) return <ApiProblem error={res.error} />;
  const d = res.value;
  if (!d) notFound();
  return d.source === "api" ? <LiveAlertDetail d={d} /> : <DemoAlertDetail d={d} />;
}

export default function AlertDetailPage({ params }: PageProps<"/alerts/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6" aria-busy="true" aria-label="Loading alert">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <AlertDetailView params={params} />
    </Suspense>
  );
}
