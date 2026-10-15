import type { CaseStatus } from "./domain";

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  needs_review: "Needs review",
  confirmed: "Confirmed",
  action_assigned: "Action assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};
