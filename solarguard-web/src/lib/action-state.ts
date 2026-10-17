/** Shared result shape for server actions used with useActionState. */
export type ActionState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export const IDLE: ActionState = { status: "idle" };

import type { ApiIngestReport, ApiAlert } from "./api/types";

export type UploadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; siteId: string; siteCreated: boolean; report: ApiIngestReport; alerts: ApiAlert[] };

export const UPLOAD_IDLE: UploadState = { status: "idle" };
