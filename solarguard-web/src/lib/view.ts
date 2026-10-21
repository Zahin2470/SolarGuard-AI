/**
 * Minimal view-model shapes shared by demo (fixtures) and live (API) data, so list components
 * never need fields that only one source can truthfully supply.
 */
import type { Severity, VerificationStatus } from "./domain";

export interface AlertRow {
  id: string;
  siteId: string;
  siteName: string;
  severity: Severity;
  status: "linked" | "closed" | "open";
  title: string;
  detectedAt: number;
  persistence: string;
  deviationPct: number | null;
  evidence: string[];
  /** Linked recovery case id, or null when no case has been opened. */
  caseId: string | null;
  windowLabel: string;
}

export interface SiteCaseRow {
  id: string;
  title: string;
  statusLabel: string;
  owner: string | null;
  verification: VerificationStatus;
  note?: string;
  /** Present for live cases, which have a detail page. */
  href?: string;
}

export interface CasePipeline {
  needsReview: number;
  actionAssigned: number;
  inProgress: number;
  resolved: number;
  verified: number;
  inconclusive: number;
}
