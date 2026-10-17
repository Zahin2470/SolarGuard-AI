import "server-only";

import { ApiError, ApiNotConfiguredError, ApiUnavailableError } from "./client";
import type { ActionState } from "../action-state";

/** Convert any thrown value into a message that is safe and useful to show. */
export function toErrorState(err: unknown): ActionState {
  if (err instanceof ApiNotConfiguredError) {
    return { status: "error", message: "The API is not configured (SOLARGUARD_API_URL is not set)." };
  }
  if (err instanceof ApiError || err instanceof ApiUnavailableError) {
    return { status: "error", message: err.message };
  }
  return { status: "error", message: "Something went wrong. Nothing was changed." };
}

export function text(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function actorFrom(form: FormData): string {
  const a = text(form, "actor").slice(0, 80);
  return a || "operator";
}

/**
 * <input type="datetime-local"> has no zone. The UI states the zone is Asia/Dhaka (UTC+6, no DST),
 * so convert to an explicit-offset ISO string. Returns null when empty, undefined when invalid.
 */
export function dhakaLocalToIso(value: string): string | null | undefined {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return undefined;
  const iso = `${value.length === 16 ? value + ":00" : value}+06:00`;
  return Number.isNaN(Date.parse(iso)) ? undefined : iso;
}
