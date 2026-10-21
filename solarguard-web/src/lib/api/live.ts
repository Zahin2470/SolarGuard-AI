import "server-only";

import { apiFetch } from "./client";
import type {
  ApiAlert,
  ApiCase,
  ApiSite,
  ApiSiteDataSummary,
  ApiTelemetryRow,
  ApiUploadResult,
} from "./types";

/** Read and write calls for the live (API-backed) workspace. All server-side. */

export const listSites = () => apiFetch<ApiSite[]>("/sites");

export const createSite = (site: {
  id: string;
  name: string;
  location?: string;
  capacity_kwp: number;
}) => apiFetch<ApiSite>("/sites", { method: "POST", json: site });

export const getSitesSummary = () => apiFetch<ApiSiteDataSummary[]>("/sites/summary");

export const listCases = (sort: "priority" | "newest" = "priority", siteId?: string) =>
  apiFetch<ApiCase[]>("/cases", { query: { sort, site_id: siteId } });

export const getCase = (id: string) => apiFetch<ApiCase>(`/cases/${encodeURIComponent(id)}`);

export const listAlerts = (status?: "open" | "closed", siteId?: string) =>
  apiFetch<ApiAlert[]>("/alerts", { query: { status, site_id: siteId } });

export const getAlert = (id: string) => apiFetch<ApiAlert>(`/alerts/${encodeURIComponent(id)}`);

export const getSite = (id: string) => apiFetch<ApiSite>(`/sites/${encodeURIComponent(id)}`);

export const getTelemetry = (siteId: string, fromIso: string, toIso: string) =>
  apiFetch<ApiTelemetryRow[]>(`/sites/${encodeURIComponent(siteId)}/telemetry`, {
    query: { from: fromIso, to: toIso },
  });

export const openCase = (alertId: string, actor: string) =>
  apiFetch<ApiCase>(`/alerts/${encodeURIComponent(alertId)}/case`, {
    method: "POST",
    json: { actor },
  });

export interface TransitionBody {
  to: string;
  actor: string;
  note?: string;
  owner?: string;
  action_taken?: string;
  action_started_at?: string;
  action_completed_at?: string;
}

export const transitionCase = (id: string, body: TransitionBody) =>
  apiFetch<ApiCase>(`/cases/${encodeURIComponent(id)}/transition`, { method: "POST", json: body });

export const editCase = (
  id: string,
  body: {
    actor: string;
    probable_cause?: string;
    set_recoverable?: boolean;
    recoverable_fraction?: number | null;
    recoverable_rationale?: string;
  },
) => apiFetch<ApiCase>(`/cases/${encodeURIComponent(id)}`, { method: "PATCH", json: body });

export const verifyCase = (id: string, actor: string) =>
  apiFetch<ApiCase>(`/cases/${encodeURIComponent(id)}/verify`, { method: "POST", json: { actor } });

export const uploadTelemetry = (siteId: string, form: FormData) =>
  apiFetch<ApiUploadResult>(`/sites/${encodeURIComponent(siteId)}/telemetry`, {
    method: "POST",
    form,
    timeoutMs: 60_000,
  });
