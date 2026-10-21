"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Severity } from "@/lib/domain";
import type { AlertRow } from "@/lib/view";
import { formatAgo, formatDayTime, formatPct } from "@/lib/format";

type StatusFilter = "all" | "open" | "closed";
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
];
const SEVERITY_TIER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export function AlertList({ alerts, now }: { alerts: AlertRow[]; now: number }) {
  const [status, setStatus] = useState<StatusFilter>("open");
  const [severity, setSeverity] = useState<"all" | Severity>("all");

  const visible = useMemo(
    () =>
      alerts
        .filter((a) => {
          if (status === "open" && a.status === "closed") return false;
          if (status === "closed" && a.status !== "closed") return false;
          if (severity !== "all" && a.severity !== severity) return false;
          return true;
        })
        .sort(
          (a, b) =>
            SEVERITY_TIER[a.severity] - SEVERITY_TIER[b.severity] || b.detectedAt - a.detectedAt,
        ),
    [alerts, status, severity],
  );

  const count = (s: StatusFilter) =>
    alerts.filter((a) => (s === "all" ? true : s === "open" ? a.status !== "closed" : a.status === "closed")).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter alerts by status" className="inline-flex rounded-ctl border border-line bg-sunken p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={status === f.id}
              onClick={() => setStatus(f.id)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                status === f.id ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
              )}
            >
              {f.label} <span className="num text-ink-subtle">{count(f.id)}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="severity-filter" className="text-xs font-medium text-ink-muted">
            Severity
          </label>
          <select
            id="severity-filter"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as "all" | Severity)}
            className="rounded-ctl border border-line bg-surface px-2.5 py-2 text-sm text-ink"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No alerts match these filters"
          action={
            <button
              type="button"
              onClick={() => {
                setStatus("all");
                setSeverity("all");
              }}
              className="rounded-ctl border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-sunken"
            >
              Show all alerts
            </button>
          }
        >
          Try a different status or severity.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => (
            <li key={a.id}>
              <Link
                href={`/alerts/${a.id}`}
                className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-canvas/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={a.severity} />
                  <span className="text-xs font-medium text-ink-muted">
                    {a.id} · {a.status === "closed" ? "Closed" : "Open"} · {a.caseId ? `case ${a.caseId}` : "no case yet"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {a.siteName}: {a.title}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">{a.evidence[0]}</p>
                <dl className="num mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
                  <div className="flex gap-1.5">
                    <dt>Detected</dt>
                    <dd className="font-semibold text-ink">
                      {formatDayTime(a.detectedAt)} ({formatAgo(a.detectedAt, now)})
                    </dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Persistence</dt>
                    <dd className="font-semibold text-ink">{a.persistence}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Deviation</dt>
                    <dd className="font-semibold text-ink">
                      {a.deviationPct === null ? "Not computable" : `${formatPct(a.deviationPct)} below expected`}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
