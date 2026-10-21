import "server-only";

import { connection } from "next/server";

/**
 * Server-side HTTP client for the SolarGuard backend.
 *
 * Configuration (server-only environment variables, never exposed to the browser):
 *   SOLARGUARD_API_URL  e.g. http://localhost:8000. Unset = live features show "not configured".
 *   SOLARGUARD_API_KEY  optional; sent as X-API-Key when the backend has API_KEY set.
 */

export class ApiNotConfiguredError extends Error {
  constructor() {
    super("SOLARGUARD_API_URL is not set.");
    this.name = "ApiNotConfiguredError";
  }
}

/** The backend could not be reached (network error, timeout, 5xx without a usable body). */
export class ApiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

/** The backend answered with a 4xx. `message` is safe to show to the person. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiBaseUrl(): string | null {
  const v = process.env.SOLARGUARD_API_URL?.trim();
  return v ? v.replace(/\/+$/, "") : null;
}

function describeDetail(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((d) => {
          if (d && typeof d === "object" && "msg" in d) {
            const loc = Array.isArray((d as { loc?: unknown[] }).loc)
              ? (d as { loc: unknown[] }).loc.filter((x) => x !== "body").join(".")
              : "";
            return loc ? `${loc}: ${String((d as { msg: unknown }).msg)}` : String((d as { msg: unknown }).msg);
          }
          return null;
        })
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
  }
  return fallback;
}

export interface ApiRequest {
  method?: "GET" | "POST" | "PATCH";
  query?: Record<string, string | number | undefined>;
  json?: unknown;
  form?: FormData;
  timeoutMs?: number;
}

/** True when an API is configured. Awaits connection() so the answer is per request, never baked in at build. */
export async function isLive(): Promise<boolean> {
  await connection();
  return apiBaseUrl() !== null;
}

export async function apiFetch<T>(path: string, req: ApiRequest = {}): Promise<T> {
  // Live data and env vars must be read per request, never baked into a prerendered shell.
  await connection();
  const base = apiBaseUrl();
  if (!base) throw new ApiNotConfiguredError();

  const url = new URL(base + path);
  for (const [k, v] of Object.entries(req.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.SOLARGUARD_API_KEY?.trim();
  if (key) headers["X-API-Key"] = key;

  let body: BodyInit | undefined;
  if (req.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(req.json);
  } else if (req.form) {
    body = req.form; // fetch sets the multipart boundary itself
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method ?? "GET",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    throw new ApiUnavailableError(`Could not reach the SolarGuard API (${reason}).`);
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (res.status === 401) {
    throw new ApiError(401, "The API rejected the request: missing or invalid API key.");
  }
  if (res.status >= 500) {
    throw new ApiUnavailableError(`The SolarGuard API returned an error (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    throw new ApiError(res.status, describeDetail(payload, `Request failed (HTTP ${res.status}).`));
  }
  return payload as T;
}
