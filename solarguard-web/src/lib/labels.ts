import type { CaseStatus } from "./domain";

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  needs_review: "Needs review",
  confirmed: "Confirmed",
  action_assigned: "Action assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

import type { ApiCaseStatus } from "./api/types";

/** Labels for the live (API) case lifecycle, which includes rejected and inconclusive. */
export const LIVE_CASE_STATUS_LABEL: Record<ApiCaseStatus, string> = {
  needs_review: "Needs review",
  inconclusive: "Review inconclusive",
  confirmed: "Confirmed for action",
  action_assigned: "Action assigned",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

export const OPEN_CASE_STATUSES: ApiCaseStatus[] = [
  "needs_review",
  "inconclusive",
  "confirmed",
  "action_assigned",
  "in_progress",
];
