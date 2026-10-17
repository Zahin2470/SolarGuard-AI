"use client";

import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { FormMessage, SubmitButton } from "@/components/ui/Form";
import { EmptyState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { IDLE } from "@/lib/action-state";
import { useServerForm } from "@/lib/use-server-form";
import type { ApiAlert } from "@/lib/api/types";
import { formatDayTime, formatNumber } from "@/lib/format";
import { openCaseAction } from "@/app/recovery-cases/actions";
import { ActorInput, useActor } from "./ActorField";

function OpenCaseForm({ alert, actor }: { alert: ApiAlert; actor: string }) {
  const { state, pending, onSubmit } = useServerForm(openCaseAction.bind(null, alert.id), IDLE);
  return (
    <form onSubmit={onSubmit} className="flex flex-col items-start gap-1.5">
      <input type="hidden" name="actor" value={actor} />
      <SubmitButton pending={pending} tone="neutral">
        Open recovery case
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function AlertTriage({ alerts }: { alerts: ApiAlert[] }) {
  const [actor, setActor] = useActor();
  if (alerts.length === 0) {
    return (
      <EmptyState title="No alerts without a case">
        Alerts appear after a telemetry upload finds sustained underperformance or missing data. Every alert already
        has a case.
      </EmptyState>
    );
  }
  return (
    <div>
      <div className="mb-4">
        <ActorInput id="triage-actor" value={actor} onChange={setActor} />
      </div>
    <ul className="divide-y divide-line">
      {alerts.map((a) => (
        <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
          <div className="min-w-0 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={a.severity} />
              <span className="text-xs text-ink-muted">
                {a.id} · site {a.site_id} · {a.status === "closed" ? "deviation ended" : "still open"}
              </span>
              <ImpactStatusLabel level="detected" />
            </div>
            <p className="mt-1 text-sm font-semibold text-ink">{a.title}</p>
            <p className="num text-xs text-ink-muted">
              {formatDayTime(Date.parse(a.window_from))} to {formatDayTime(Date.parse(a.window_to))} ·{" "}
              {a.persistence_hours} h
              {a.est_gap_kwh !== null ? ` · estimated gap ${formatNumber(a.est_gap_kwh)} kWh` : ""}
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs text-ink-muted">
              {a.evidence.slice(0, 2).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
          <OpenCaseForm alert={a} actor={actor} />
        </li>
      ))}
    </ul>
    </div>
  );
}
