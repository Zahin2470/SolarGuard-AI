import { ImpactStatusLabel } from "@/components/ui/ImpactStatusLabel";
import { VerificationLabel } from "@/components/ui/VerificationLabel";
import type { ApiCase, ApiVerificationWindow } from "@/lib/api/types";
import { formatDayTime, formatNumber, formatPct } from "@/lib/format";

function WindowRow({ label, w }: { label: string; w: ApiVerificationWindow }) {
  return (
    <tr className="border-t border-line">
      <th scope="row" className="px-3 py-2 text-left font-medium text-ink">
        {label}
        <span className="block text-[11px] font-normal text-ink-muted">
          {formatDayTime(Date.parse(w.from))} to {formatDayTime(Date.parse(w.to))}
        </span>
      </th>
      <td className="px-3 py-2 text-right">{w.valid_production_hours}</td>
      <td className="px-3 py-2 text-right">
        {w.performance_ratio === null ? "n/a" : formatPct(w.performance_ratio * 100)}
      </td>
      <td className="px-3 py-2 text-right">
        {formatNumber(w.actual_kwh)} / {formatNumber(w.expected_kwh)}
      </td>
    </tr>
  );
}

/** Shows the outcome exactly as the API computed it. Never upgrades a status. */
export function VerificationPanel({ c }: { c: ApiCase }) {
  if (c.status !== "resolved") {
    return (
      <p className="text-sm text-ink-muted">
        <VerificationLabel status="not_yet_verified" /> <span className="ml-1">Outcome checks become available once the case is resolved and an action is recorded.</span>
      </p>
    );
  }
  const d = c.verification_detail;
  if (c.verification_status === "not_yet_verified" || !d) {
    return (
      <div className="space-y-2">
        <VerificationLabel status="not_yet_verified" />
        <p className="text-sm text-ink-muted">
          The action is recorded, but no before/after comparison has been run. Use the check above once post-action
          data has been uploaded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <VerificationLabel status={c.verification_status} />
        {c.verification_level === "measured" ? <ImpactStatusLabel level="measured" /> : null}
      </div>
      <p className="text-sm text-ink">{d.summary}</p>

      <div className="relative overflow-x-auto rounded-lg border border-line">
        <table className="num w-full min-w-[26rem] text-xs">
          <caption className="sr-only">Performance ratio before and after the recorded action</caption>
          <thead className="bg-sunken text-ink-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Window</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Valid production hours</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Performance ratio</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Actual / expected kWh</th>
            </tr>
          </thead>
          <tbody>
            <WindowRow label="Before action" w={d.pre_window} />
            <WindowRow label="After action" w={d.post_window} />
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-muted">
        Expected-power baseline:{" "}
        {[...new Set([...d.pre_window.baseline_sources, ...d.post_window.baseline_sources])]
          .map((b) => (b === "provided" ? "provided with the upload (independent)" : "derived from the site's own history"))
          .join("; ") || "n/a"}
        .
      </p>

      {d.delta_performance_ratio_pts !== undefined ? (
        <dl className="num grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-muted">Change in performance ratio</dt>
            <dd className="font-semibold text-ink">
              {d.delta_performance_ratio_pts > 0 ? "+" : ""}
              {d.delta_performance_ratio_pts.toFixed(1)} points
            </dd>
          </div>
          {d.measured_incremental_kwh_post_window !== undefined ? (
            <div>
              <dt className="text-xs text-ink-muted">Extra energy in the post window versus the pre-action performance ratio</dt>
              <dd className="flex flex-wrap items-center gap-1.5 font-semibold text-ink">
                {formatNumber(d.measured_incremental_kwh_post_window)} kWh
                <ImpactStatusLabel level={c.verification_status === "verified" ? "verified" : "measured"} />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div>
        <h3 className="text-xs font-semibold text-ink">Limitations of this comparison</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-muted">
          {d.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">
          Method: {d.method.replaceAll("_", " ")}. Computed {formatDayTime(Date.parse(d.computed_at))}.
        </p>
      </div>
    </div>
  );
}
