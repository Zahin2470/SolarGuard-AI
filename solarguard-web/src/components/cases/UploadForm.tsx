"use client";

import clsx from "clsx";
import Link from "next/link";
import { useId, useState } from "react";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/ui/Form";
import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { StatusChip } from "@/components/ui/StatusChip";
import { UPLOAD_IDLE, type UploadState } from "@/lib/action-state";
import type { ApiSite } from "@/lib/api/types";
import { formatDayTime, formatNumber } from "@/lib/format";
import { useServerForm } from "@/lib/use-server-form";
import { uploadAction } from "@/app/upload/actions";

function Result({ state }: { state: Extract<UploadState, { status: "ok" }> }) {
  const r = state.report;
  const derived = r.expected_source !== "provided";
  return (
    <div className="space-y-5" aria-live="polite">
      <div className="rounded-lg border border-primary/30 bg-primary-soft/60 p-4">
        <p className="text-sm font-semibold text-primary-strong">
          Stored {formatNumber(r.hours_stored)} hourly records for site {state.siteId}
          {state.siteCreated ? " (newly registered)" : ""}.
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {r.first_hour && r.last_hour
            ? `${formatDayTime(Date.parse(r.first_hour))} to ${formatDayTime(Date.parse(r.last_hour))} (Asia/Dhaka). `
            : ""}
          Source interval {r.interval_minutes} min, averaged to hourly.
          {state.siteCreated ? " For further uploads to this site, choose it under Existing site." : ""}
        </p>
      </div>

      <dl className="num grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-muted">Rows received</dt>
          <dd className="font-semibold text-ink">{formatNumber(r.rows_received)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Rows rejected</dt>
          <dd className={clsx("font-semibold", r.rows_rejected > 0 ? "text-warn" : "text-ink")}>
            {formatNumber(r.rows_rejected)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Duplicates dropped</dt>
          <dd className="font-semibold text-ink">{formatNumber(r.duplicates_dropped)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Hours with data</dt>
          <dd className="font-semibold text-ink">{formatNumber(r.hours_with_actual)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Hours without data (kept as gaps)</dt>
          <dd className="font-semibold text-ink">{formatNumber(r.hours_without_actual)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Expected-power source</dt>
          <dd className="font-semibold text-ink">{derived ? "Derived from history" : "Provided in the file"}</dd>
        </div>
      </dl>

      {derived ? (
        <p className="rounded-lg border border-dashed border-warn-line bg-warn-soft/50 p-3 text-xs text-ink-muted">
          <span className="font-semibold text-warn">Derived baseline.</span> No <code>expected_kw</code> column was
          provided, so expected output is a trailing same-hour median of this site&apos;s own earlier days. It can
          absorb a long-running fault, and outcomes on it can never be marked Verified.
        </p>
      ) : null}

      {r.warnings.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">Warnings</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink-muted">
            {r.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.rejected_samples.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Rejected rows{r.rows_rejected > r.rejected_samples.length ? ` (first ${r.rejected_samples.length} shown)` : ""}
          </h3>
          <ul className="num mt-1 space-y-0.5 text-xs text-ink-muted">
            {r.rejected_samples.map((s) => (
              <li key={`${s.line}-${s.reason}`}>
                Line {s.line}: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-ink">Detection result</h3>
        {state.alerts.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">
            No sustained deviation was detected in this data by rule_v1. That is not proof of a healthy site: it only
            means no run of 4 or more production hours was 10% or more below expected.
          </p>
        ) : (
          <>
            <ul className="mt-2 space-y-2">
              {state.alerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-canvas/60 px-3 py-2 text-sm">
                  <StatusChip status={a.severity} />
                  <span className="font-medium text-ink">{a.title}</span>
                  <span className="text-xs text-ink-muted">{a.id}</span>
                  <ImpactStatusLabel level="detected" />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm">
              <Link href="/recovery-cases" className="font-semibold text-primary-strong underline underline-offset-2">
                Review these alerts and open recovery cases
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function UploadForm({ sites }: { sites: ApiSite[] }) {
  const { state, pending, onSubmit } = useServerForm(uploadAction, UPLOAD_IDLE);
  const [mode, setMode] = useState<"existing" | "new">(sites.length > 0 ? "existing" : "new");
  const ids = {
    site: useId(),
    newId: useId(),
    name: useId(),
    loc: useId(),
    cap: useId(),
    file: useId(),
    tz: useId(),
    tzList: useId(),
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <input type="hidden" name="mode" value={mode} />

        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-semibold text-ink">1. Site</legend>
          <div role="radiogroup" aria-label="Site source" className="inline-flex rounded-ctl border border-line bg-sunken p-0.5">
            {(["existing", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                disabled={m === "existing" && sites.length === 0}
                onClick={() => setMode(m)}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                  mode === m ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
                )}
              >
                {m === "existing" ? "Existing site" : "Register new site"}
              </button>
            ))}
          </div>

          {mode === "existing" ? (
            <Field label="Site" htmlFor={ids.site}>
              <select id={ids.site} name="site_id" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Choose a site
                </option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id}, {formatNumber(s.capacity_kwp)} kWp)
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site ID" htmlFor={ids.newId} hint="Letters, digits, dot, dash, underscore.">
                <input id={ids.newId} name="new_site_id" required maxLength={64} pattern="[A-Za-z0-9_.\-]+" className={inputClass} />
              </Field>
              <Field label="Site name" htmlFor={ids.name}>
                <input id={ids.name} name="name" required maxLength={200} className={inputClass} />
              </Field>
              <Field label="Location (optional)" htmlFor={ids.loc}>
                <input id={ids.loc} name="location" maxLength={200} className={inputClass} />
              </Field>
              <Field
                label="Capacity (kWp)"
                htmlFor={ids.cap}
                hint="Used to reject impossible readings and to tell production hours from night."
              >
                <input id={ids.cap} name="capacity_kwp" type="number" required min="0.1" step="any" inputMode="decimal" className={inputClass} />
              </Field>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-semibold text-ink">2. Telemetry CSV</legend>
          <Field
            label="File"
            htmlFor={ids.file}
            hint={
              <>
                Columns: <code>timestamp</code> (ISO 8601), <code>power_kw</code> (blank = no data), and optionally{" "}
                <code>expected_kw</code> from an independent weather-driven model. Up to 20 MB.
              </>
            }
          >
            <input
              id={ids.file}
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="block w-full text-sm text-ink file:mr-3 file:rounded-ctl file:border file:border-line-strong file:bg-surface file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:bg-sunken"
            />
          </Field>
          <div className="max-w-xs">
            <Field
              label="Time zone of timestamps without an offset"
              htmlFor={ids.tz}
              hint="Ignored for timestamps that carry an offset such as +06:00 or Z."
            >
              <input id={ids.tz} name="timezone" list={ids.tzList} defaultValue="UTC" className={inputClass} />
              <datalist id={ids.tzList}>
                <option value="UTC" />
                <option value="Asia/Dhaka" />
              </datalist>
            </Field>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending}>{pending ? "Validating and detecting…" : "Upload and run detection"}</SubmitButton>
          {state.status === "error" ? <FormMessage state={state} /> : <span className="sr-only" aria-live="polite" />}
        </div>
      </form>

      {state.status === "ok" ? <Result state={state} /> : null}
    </div>
  );
}
