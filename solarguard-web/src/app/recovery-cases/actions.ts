"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { actorFrom, dhakaLocalToIso, text, toErrorState } from "@/lib/api/action-helpers";
import { editCase, openCase, transitionCase, verifyCase, type TransitionBody } from "@/lib/api/live";

const CASE_ID = /^RC-\d{4,}$/;
const ALERT_ID = /^AL-\d{4,}$/;
const TARGETS = new Set(["confirmed", "rejected", "inconclusive", "action_assigned", "in_progress", "resolved"]);

function refresh(caseId?: string) {
  revalidatePath("/recovery-cases");
  if (caseId) revalidatePath(`/recovery-cases/${caseId}`);
}

export async function openCaseAction(alertId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  if (!ALERT_ID.test(alertId)) return { status: "error", message: "Invalid alert id." };
  let caseId: string;
  try {
    caseId = (await openCase(alertId, actorFrom(form))).id;
  } catch (err) {
    return toErrorState(err);
  }
  refresh();
  redirect(`/recovery-cases/${caseId}`);
}

export async function transitionAction(
  caseId: string,
  to: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  if (!CASE_ID.test(caseId) || !TARGETS.has(to)) return { status: "error", message: "Invalid request." };

  const body: TransitionBody = { to, actor: actorFrom(form) };
  const note = text(form, "note");
  if (note) body.note = note;

  if (to === "rejected" && !note) return { status: "error", message: "Say why this case is being rejected." };
  if (to === "action_assigned") {
    const owner = text(form, "owner");
    if (!owner) return { status: "error", message: "Enter the person or team who owns the action." };
    body.owner = owner;
  }
  if (to === "in_progress") {
    const started = dhakaLocalToIso(text(form, "action_started_at"));
    if (started === undefined) return { status: "error", message: "Start time is not a valid date and time." };
    if (started) body.action_started_at = started;
  }
  if (to === "resolved") {
    const taken = text(form, "action_taken");
    if (!taken) return { status: "error", message: "Describe what was actually done." };
    body.action_taken = taken;
    const done = dhakaLocalToIso(text(form, "action_completed_at"));
    if (done === undefined) return { status: "error", message: "Completion time is not a valid date and time." };
    if (done && Date.parse(done) > Date.now()) {
      return { status: "error", message: "Completion time cannot be in the future." };
    }
    if (done) body.action_completed_at = done;
  }

  try {
    await transitionCase(caseId, body);
  } catch (err) {
    return toErrorState(err);
  }
  refresh(caseId);
  return { status: "ok", message: "Saved." };
}

export async function editCaseAction(caseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  if (!CASE_ID.test(caseId)) return { status: "error", message: "Invalid request." };
  const body: Parameters<typeof editCase>[1] = { actor: actorFrom(form) };

  body.probable_cause = text(form, "probable_cause");

  const pctRaw = text(form, "recoverable_pct");
  const rationale = text(form, "recoverable_rationale");
  if (pctRaw === "") {
    if (rationale) return { status: "error", message: "A rationale needs a recoverable share. Enter a percentage or clear both." };
    body.set_recoverable = true;
    body.recoverable_fraction = null;
    body.recoverable_rationale = "";
  } else {
    const pct = Number(pctRaw);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return { status: "error", message: "Recoverable share must be a number from 0 to 100." };
    }
    if (!rationale) return { status: "error", message: "Explain why that share is recoverable." };
    body.set_recoverable = true;
    body.recoverable_fraction = pct / 100;
    body.recoverable_rationale = rationale;
  }

  try {
    await editCase(caseId, body);
  } catch (err) {
    return toErrorState(err);
  }
  refresh(caseId);
  return { status: "ok", message: "Estimates saved." };
}

export async function verifyAction(caseId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  if (!CASE_ID.test(caseId)) return { status: "error", message: "Invalid request." };
  try {
    await verifyCase(caseId, actorFrom(form));
  } catch (err) {
    return toErrorState(err);
  }
  refresh(caseId);
  return { status: "ok", message: "Verification check completed." };
}
