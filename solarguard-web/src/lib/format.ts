/** Deterministic formatting helpers (fixed locale + time zone => identical on server and client). */

export const TIME_ZONE = "Asia/Dhaka";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
});

export function formatTime(t: number): string {
  return timeFmt.format(t);
}

export function formatDay(t: number): string {
  return dayFmt.format(t);
}

export function formatDayTime(t: number): string {
  return `${formatDay(t)} ${formatTime(t)}`;
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}%`;
}

/** "5 h ago", "42 min ago" relative to a supplied reference time (no Date.now(): stays deterministic). */
export function formatAgo(t: number, now: number): string {
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
