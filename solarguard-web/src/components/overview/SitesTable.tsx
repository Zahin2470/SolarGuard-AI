"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import type { SiteSummary } from "@/lib/fixtures";
import { formatAgo, formatNumber, formatPct, formatTime } from "@/lib/format";

type Filter = "all" | "attention" | "healthy";
type SortKey = "attention" | "name" | "ratio" | "capacity";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "attention", label: "Needs attention first" },
  { id: "name", label: "Name (A to Z)" },
  { id: "ratio", label: "24 h ratio (lowest first)" },
  { id: "capacity", label: "Capacity (largest first)" },
];
const STATUS_ORDER: Record<SiteSummary["status"], number> = {
  critical: 0,
  warning: 1,
  stale: 2,
  healthy: 3,
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs attention" },
  { id: "healthy", label: "Healthy" },
];

function PrCell({ site }: { site: SiteSummary }) {
  if (site.performanceRatioPct === null) return <span>n/a</span>;
  const low = site.performanceRatioPct < 95;
  return (
    <span className={clsx("font-semibold", low ? "text-crit" : "text-ink")}>
      {formatPct(site.performanceRatioPct)}
    </span>
  );
}

export function SitesTable({ sites, now }: { sites: SiteSummary[]; now: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("attention");
  const searchId = useId();
  const sortId = useId();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sites.filter((s) => {
      if (filter === "attention" && s.status === "healthy") return false;
      if (filter === "healthy" && s.status !== "healthy") return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "capacity") return b.capacityKwp - a.capacityKwp;
      if (sort === "ratio")
        return (a.performanceRatioPct ?? 999) - (b.performanceRatioPct ?? 999);
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name);
    });
  }, [sites, filter, query, sort]);

  const counts = {
    all: sites.length,
    attention: sites.filter((s) => s.status !== "healthy").length,
    healthy: sites.filter((s) => s.status === "healthy").length,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter sites by status" className="inline-flex rounded-ctl border border-line bg-sunken p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f.id ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
              )}
            >
              {f.label} <span className="num text-ink-subtle">{counts[f.id]}</span>
            </button>
          ))}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label htmlFor={sortId} className="sr-only">
            Sort sites
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-ctl border border-line bg-surface px-2.5 py-2 text-sm text-ink"
          >
            {SORTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        <div className="relative w-full sm:w-64">
          <label htmlFor={searchId} className="sr-only">
            Search sites
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID or location"
            className="w-full rounded-ctl border border-line bg-surface py-2 pl-8 pr-3 text-sm text-ink placeholder:text-ink-subtle"
          />
        </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No sites match these filters"
          action={
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
              className="rounded-ctl border border-line-strong bg-surface px-3.5 py-2 text-sm font-semibold text-ink hover:bg-sunken"
            >
              Clear filters
            </button>
          }
        >
          Try a different status or search term.
        </EmptyState>
      ) : (
        <>
          {/* Wide screens: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="num w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Site performance over the last 24 hours</caption>
              <thead className="text-xs text-ink-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-semibold">Site</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Capacity (kWp)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Latest power (kW)</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">24 h actual / expected</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Last data</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <th scope="row" className="py-3 pr-3 text-left font-normal">
                      <Link href={`/sites/${s.id}`} className="font-semibold text-ink underline-offset-2 hover:text-primary-strong hover:underline">
                        {s.name}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {s.id} · {s.location}
                      </p>
                    </th>
                    <td className="px-3 py-3">
                      <StatusChip status={s.status} />
                      <p className="mt-1 text-xs text-ink-muted">{s.statusReason}</p>
                    </td>
                    <td className="px-3 py-3 text-right">{formatNumber(s.capacityKwp)}</td>
                    <td className="px-3 py-3 text-right">
                      {s.latestKw === null || s.status === "stale" ? (
                        <span className="text-ink-muted">No data</span>
                      ) : (
                        formatNumber(s.latestKw, 1)
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <PrCell site={s} />
                      <p className="text-xs text-ink-muted">
                        {formatNumber(s.actualKwh24h)} / {formatNumber(s.expectedKwh24h)} kWh
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-ink-muted">
                      {s.latestAt === null ? (
                        "No data"
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-ink">{formatTime(s.latestAt + 3_600_000)}</p>
                          <p>{formatAgo(s.latestAt + 3_600_000, now)}</p>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Narrow screens: stacked cards */}
          <ul className="space-y-3 md:hidden">
            {visible.map((s) => (
              <li key={s.id} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/sites/${s.id}`} className="font-semibold text-ink underline-offset-2 hover:text-primary-strong hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {s.id} · {s.location}
                    </p>
                  </div>
                  <StatusChip status={s.status} />
                </div>
                <p className="mt-1 text-xs text-ink-muted">{s.statusReason}</p>
                <dl className="num mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-muted">Latest kW</dt>
                    <dd className="font-semibold text-ink">
                      {s.latestKw === null || s.status === "stale" ? "No data" : formatNumber(s.latestKw, 1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">24 h ratio</dt>
                    <dd><PrCell site={s} /></dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Last data</dt>
                    <dd className="font-semibold text-ink">
                      {s.latestAt === null ? "None" : formatAgo(s.latestAt + 3_600_000, now)}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        24 h ratio = actual ÷ modelled expected energy over intervals with data. A ratio below 95% is
        highlighted; it is a signal to investigate, not a confirmed fault.
      </p>
    </div>
  );
}
