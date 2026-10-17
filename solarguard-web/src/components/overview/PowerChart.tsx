"use client";

import clsx from "clsx";
import { useId, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/ui/States";
import { formatDay, formatDayTime, formatNumber, formatTime } from "@/lib/format";

export interface ChartPoint {
  t: number;
  /** Mean actual power over the hour (kW). null = no data, which is NOT zero output. */
  actualKw: number | null;
  /** null = no expected value for this hour (never treated as zero). */
  expectedKw: number | null;
  /** Fleet mode only: how many sites contributed to this point. */
  reporting?: number;
}

type Range = "24h" | "72h";
const RANGES: { id: Range; label: string; hours: number }[] = [
  { id: "24h", label: "Last 24 h", hours: 24 },
  { id: "72h", label: "Last 72 h", hours: 72 },
];
const HOUR = 3_600_000;

function TooltipBody({
  active,
  payload,
  sitesTotal,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  sitesTotal?: number;
}) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const dev =
    r.actualKw !== null && r.expectedKw !== null && r.expectedKw > 0
      ? ((r.actualKw - r.expectedKw) / r.expectedKw) * 100
      : null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-pop">
      <p className="font-semibold text-ink">
        {formatDayTime(r.t)}–{formatTime(r.t + HOUR)}
      </p>
      <p className="mb-1.5 text-ink-muted">Mean power over the hour</p>
      <dl className="num space-y-0.5">
        <div className="flex justify-between gap-6">
          <dt className="text-ink-muted">Actual</dt>
          <dd className="font-semibold text-ink">
            {r.actualKw === null ? "No data" : `${formatNumber(r.actualKw, 1)} kW`}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-ink-muted">Expected</dt>
          <dd className="font-semibold text-ink">
            {r.expectedKw === null ? "n/a" : `${formatNumber(r.expectedKw, 1)} kW`}
          </dd>
        </div>
        {dev !== null ? (
          <div className="flex justify-between gap-6">
            <dt className="text-ink-muted">Deviation</dt>
            <dd className="font-semibold text-ink">
              {dev > 0 ? "+" : ""}
              {dev.toFixed(1)}%
            </dd>
          </div>
        ) : null}
        {r.reporting !== undefined && sitesTotal ? (
          <div className="flex justify-between gap-6">
            <dt className="text-ink-muted">Sites reporting</dt>
            <dd className="font-semibold text-ink">
              {r.reporting} of {sitesTotal}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** Contiguous run of points matching a predicate, as [firstT, lastT]. */
function span(rows: ChartPoint[], pred: (r: ChartPoint) => boolean): [number, number] | null {
  const hit = rows.filter(pred);
  if (hit.length === 0) return null;
  return [hit[0].t, hit[hit.length - 1].t];
}

export function PowerChart({
  points,
  sitesTotal,
  highlight,
  subject,
  defaultRange = "24h",
  showRangeTabs = true,
  expectedLabel = "Expected power, model (kW)",
}: {
  points: ChartPoint[];
  /** Fleet mode: total number of sites, used to flag partially reporting hours. */
  sitesTotal?: number;
  /** Optional shaded evidence window from `from` to the last point. */
  highlight?: { from: number; label: string };
  /** Used in the accessible name, e.g. "Fleet" or "Factory Rooftop A". */
  subject: string;
  defaultRange?: Range;
  showRangeTabs?: boolean;
  /** Legend text for the expected series; say where the baseline came from. */
  expectedLabel?: string;
}) {
  const [range, setRange] = useState<Range>(defaultRange);
  const tableId = useId();

  const hours = RANGES.find((r) => r.id === range)!.hours;
  const rows = useMemo(() => points.slice(-hours), [points, hours]);

  if (rows.length === 0) {
    return (
      <EmptyState title="No production data in this period">
        Upload a telemetry CSV for at least one site to see actual versus expected output.
      </EmptyState>
    );
  }

  const partial =
    sitesTotal !== undefined ? span(rows, (r) => (r.reporting ?? sitesTotal) < sitesTotal) : null;
  const noData = span(rows, (r) => r.actualKw === null);
  const missingSites =
    partial && sitesTotal !== undefined
      ? sitesTotal - (rows[rows.length - 1].reporting ?? sitesTotal)
      : 0;
  const hl =
    highlight && highlight.from <= rows[rows.length - 1].t
      ? ([Math.max(highlight.from, rows[0].t), rows[rows.length - 1].t] as [number, number])
      : null;

  const peak = Math.max(...rows.map((r) => Math.max(r.actualKw ?? 0, r.expectedKw ?? 0)));
  const step = peak > 600 ? 100 : 50;
  const yMax = Math.max(step, Math.ceil((peak * 1.08) / step) * step);
  const rangeLabel = RANGES.find((r) => r.id === range)!.label.toLowerCase();

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-muted" aria-label="Chart legend">
          <li className="flex items-center gap-2">
            <svg aria-hidden width="26" height="8">
              <line x1="0" y1="4" x2="26" y2="4" stroke="var(--color-series-actual)" strokeWidth="3" />
            </svg>
            Actual power (kW)
          </li>
          <li className="flex items-center gap-2">
            <svg aria-hidden width="26" height="8">
              <line x1="0" y1="4" x2="26" y2="4" stroke="var(--color-series-expected)" strokeWidth="2" strokeDasharray="5 4" />
            </svg>
            {expectedLabel}
          </li>
          {partial ? (
            <li className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-3 w-5 rounded-sm border border-dashed border-warn-line bg-warn-soft" />
              Not all sites reporting
            </li>
          ) : null}
          {noData ? (
            <li className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-3 w-5 rounded-sm border border-dashed border-line-strong bg-offline-soft" />
              No data (not zero output)
            </li>
          ) : null}
          {hl && highlight ? (
            <li className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-3 w-5 rounded-sm border border-info-line bg-info-soft" />
              {highlight.label}
            </li>
          ) : null}
        </ul>

        {showRangeTabs ? (
          <div role="tablist" aria-label="Time range" className="inline-flex rounded-ctl border border-line bg-sunken p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.id}
                role="tab"
                type="button"
                aria-selected={range === r.id}
                onClick={() => setRange(r.id)}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  range === r.id ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="h-[280px] w-full sm:h-[330px]"
        role="img"
        aria-label={`${subject} actual versus expected power for the ${rangeLabel}. A data table is available below the chart.`}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 320 }}>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="sgActualFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e7c61" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#0e7c61" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#dedcd1" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t: number) =>
                range === "24h" ? formatTime(t) : `${formatDay(t)} ${formatTime(t)}`
              }
              minTickGap={range === "24h" ? 28 : 56}
              tick={{ fontSize: 12, fill: "#51605b" }}
              tickLine={false}
              axisLine={{ stroke: "#c6c3b4" }}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 12, fill: "#51605b" }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => formatNumber(v)}
              label={{
                value: "kW",
                angle: -90,
                position: "insideLeft",
                offset: 14,
                style: { fontSize: 12, fill: "#51605b" },
              }}
            />
            <Tooltip
              content={<TooltipBody sitesTotal={sitesTotal} />}
              cursor={{ stroke: "#8a9490", strokeDasharray: "3 3" }}
            />
            {hl ? (
              <ReferenceArea x1={hl[0]} x2={hl[1]} fill="#e3eef6" fillOpacity={0.75} stroke="#a9c7dd" strokeDasharray="4 3" />
            ) : null}
            {partial ? (
              <ReferenceArea x1={partial[0]} x2={partial[1]} fill="#fbefd6" fillOpacity={0.7} stroke="#e6c88d" strokeDasharray="4 3" />
            ) : null}
            {noData ? (
              <ReferenceArea x1={noData[0]} x2={noData[1]} fill="#ececee" fillOpacity={0.9} stroke="#c6c3b4" strokeDasharray="4 3" />
            ) : null}
            <Area
              type="monotone"
              dataKey="actualKw"
              stroke="none"
              fill="url(#sgActualFill)"
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
              tooltipType="none"
            />
            <Line
              type="monotone"
              dataKey="expectedKw"
              stroke="var(--color-series-expected)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="actualKw"
              stroke="var(--color-series-actual)"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Times in Asia/Dhaka (UTC+6). Each point is mean power over one hour; energy is that power
        multiplied by the 1-hour interval. Zero overnight is real zero output, not missing data.
        {partial ? (
          <>
            {" "}
            <span className="font-medium text-warn">
              {missingSites} site{missingSites === 1 ? "" : "s"} not reporting since {formatTime(partial[0])}: fleet
              totals in the shaded period exclude {missingSites === 1 ? "it" : "them"}, for both actual and expected.
            </span>
          </>
        ) : null}
        {noData ? (
          <>
            {" "}
            <span className="font-medium text-warn">
              No data from {formatTime(noData[0])}; the gap is left blank and excluded from energy totals.
            </span>
          </>
        ) : null}
      </p>

      <details className="mt-3 rounded-lg border border-line bg-canvas/60 text-sm">
        <summary className="cursor-pointer select-none px-3 py-2 font-medium text-ink">
          View chart data as a table
        </summary>
        <div
          id={tableId}
          tabIndex={0}
          className="max-h-64 overflow-auto border-t border-line"
          aria-label="Chart data table, scrollable"
        >
          <table className="num w-full text-left text-xs">
            <caption className="sr-only">Hourly actual and expected power</caption>
            <thead className="sticky top-0 bg-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Hour starting</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Actual (kW)</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Expected (kW)</th>
                {sitesTotal !== undefined ? (
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Sites reporting</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.t} className="border-t border-line">
                  <td className="px-3 py-1.5">{formatDayTime(r.t)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {r.actualKw === null ? "No data" : formatNumber(r.actualKw, 1)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {r.expectedKw === null ? "n/a" : formatNumber(r.expectedKw, 1)}
                  </td>
                  {sitesTotal !== undefined ? (
                    <td className="px-3 py-1.5 text-right">
                      {r.reporting}/{sitesTotal}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
