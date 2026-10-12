"use client";

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
import clsx from "clsx";
import { EmptyState } from "@/components/ui/States";
import type { FleetPoint } from "@/lib/fixtures";
import { formatDay, formatDayTime, formatNumber, formatTime } from "@/lib/format";

type Range = "24h" | "72h";
const RANGES: { id: Range; label: string; hours: number }[] = [
  { id: "24h", label: "Last 24 h", hours: 24 },
  { id: "72h", label: "Last 72 h", hours: 72 },
];

interface Row extends FleetPoint {
  gapKw: number;
}

function TooltipBody({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
}) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const dev = r.expectedKw > 0 ? ((r.actualKw - r.expectedKw) / r.expectedKw) * 100 : null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-pop">
      <p className="font-semibold text-ink">
        {formatDayTime(r.t)}–{formatTime(r.t + 3_600_000)}
      </p>
      <p className="mb-1.5 text-ink-muted">Mean power over the hour</p>
      <dl className="num space-y-0.5">
        <div className="flex justify-between gap-6">
          <dt className="text-ink-muted">Actual</dt>
          <dd className="font-semibold text-ink">{formatNumber(r.actualKw, 1)} kW</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-ink-muted">Expected (model)</dt>
          <dd className="font-semibold text-ink">{formatNumber(r.expectedKw, 1)} kW</dd>
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
        <div className="flex justify-between gap-6">
          <dt className="text-ink-muted">Sites reporting</dt>
          <dd className="font-semibold text-ink">{r.reporting} of 6</dd>
        </div>
      </dl>
    </div>
  );
}

export function ProductionChart({
  series,
  sitesTotal,
}: {
  series: FleetPoint[];
  sitesTotal: number;
}) {
  const [range, setRange] = useState<Range>("24h");
  const tableId = useId();

  const hours = RANGES.find((r) => r.id === range)!.hours;
  const rows: Row[] = useMemo(
    () =>
      series.slice(-hours).map((p) => ({
        ...p,
        gapKw: Math.max(0, p.expectedKw - p.actualKw),
      })),
    [series, hours],
  );

  // Contiguous span of hours in which fewer sites reported than the fleet total.
  const partial = rows.filter((r) => r.reporting < sitesTotal);
  const partialFrom = partial[0]?.t;
  const partialTo = partial[partial.length - 1]?.t;
  const missingSites = partial.length ? sitesTotal - partial[partial.length - 1].reporting : 0;

  if (rows.length === 0) {
    return (
      <EmptyState title="No production data in this period">
        Upload a telemetry CSV for at least one site to see actual versus expected output.
      </EmptyState>
    );
  }

  const peak = Math.max(...rows.map((r) => Math.max(r.actualKw, r.expectedKw)));
  const yMax = Math.ceil((peak * 1.08) / 100) * 100;

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
              <line
                x1="0"
                y1="4"
                x2="26"
                y2="4"
                stroke="var(--color-series-expected)"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            </svg>
            Expected power, model (kW)
          </li>
          {partialFrom !== undefined ? (
            <li className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-3 w-5 rounded-sm border border-dashed border-warn-line bg-warn-soft" />
              Not all sites reporting
            </li>
          ) : null}
        </ul>

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
                range === r.id
                  ? "bg-surface text-ink shadow-card"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px] w-full sm:h-[340px]" role="img" aria-label={`Fleet actual versus expected power for the ${RANGES.find((r) => r.id === range)!.label.toLowerCase()}. A data table is available below the chart.`}>
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
            <Tooltip content={<TooltipBody />} cursor={{ stroke: "#8a9490", strokeDasharray: "3 3" }} />
            {partialFrom !== undefined && partialTo !== undefined ? (
              <ReferenceArea
                x1={partialFrom}
                x2={partialTo}
                fill="#fbefd6"
                fillOpacity={0.7}
                stroke="#e6c88d"
                strokeDasharray="4 3"
                ifOverflow="extendDomain"
              />
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
              isAnimationActive={false}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Times in Asia/Dhaka (UTC+6). Each point is mean power over one hour; energy is calculated by
        multiplying by the 1-hour interval. Zero overnight is real zero output, not missing data.
        {partialFrom !== undefined ? (
          <>
            {" "}
            <span className="font-medium text-warn">
              {missingSites} site{missingSites === 1 ? "" : "s"} not reporting since {formatTime(partialFrom)}
              : fleet totals in the shaded period exclude {missingSites === 1 ? "it" : "them"}, for both actual and expected.
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
            <caption className="sr-only">Hourly fleet actual and expected power</caption>
            <thead className="sticky top-0 bg-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Hour starting</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Actual (kW)</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Expected (kW)</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Sites reporting</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.t} className="border-t border-line">
                  <td className="px-3 py-1.5">{formatDayTime(r.t)}</td>
                  <td className="px-3 py-1.5 text-right">{formatNumber(r.actualKw, 1)}</td>
                  <td className="px-3 py-1.5 text-right">{formatNumber(r.expectedKw, 1)}</td>
                  <td className="px-3 py-1.5 text-right">{r.reporting}/{sitesTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
