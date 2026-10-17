"use client";

import { useId, type ReactNode } from "react";
import { FormMessage, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { IDLE } from "@/lib/action-state";
import { useServerForm } from "@/lib/use-server-form";
import type { ApiCaseStatus } from "@/lib/api/types";
import { transitionAction, verifyAction } from "@/app/recovery-cases/actions";
import { ActorInput, useActor } from "./ActorField";

function TransitionForm({
  caseId,
  to,
  actor,
  title,
  help,
  submit,
  tone,
  children,
}: {
  caseId: string;
  to: string;
  actor: string;
  title: string;
  help: ReactNode;
  submit: string;
  tone?: "primary" | "neutral" | "danger";
  children?: ReactNode;
}) {
  const { state, pending, onSubmit } = useServerForm(transitionAction.bind(null, caseId, to), IDLE);
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-line bg-canvas/60 p-4">
      <input type="hidden" name="actor" value={actor} />
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-ink-muted">{help}</p>
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} tone={tone}>
          {submit}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function NoteField({ label = "Note (optional)", required = false }: { label?: string; required?: boolean }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <textarea id={id} name="note" rows={2} required={required} maxLength={1000} className={inputClass} />
    </Field>
  );
}

function RejectForm({ caseId, actor }: { caseId: string; actor: string }) {
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink">
        Reject this case
      </summary>
      <div className="border-t border-line p-3">
        <TransitionForm
          caseId={caseId}
          to="rejected"
          actor={actor}
          title="Reject"
          help="Closes the case as not worth action. A reason is required and stays in the audit trail. This cannot be undone."
          submit="Reject case"
          tone="danger"
        >
          <NoteField label="Reason" required />
        </TransitionForm>
      </div>
    </details>
  );
}

function VerifyForm({ caseId, actor, rerun }: { caseId: string; actor: string; rerun: boolean }) {
  const { state, pending, onSubmit } = useServerForm(verifyAction.bind(null, caseId), IDLE);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="actor" value={actor} />
      <SubmitButton pending={pending}>{rerun ? "Re-run verification check" : "Run verification check"}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Workflow controls for the current status only: no control is shown that the API would refuse. */
export function CaseActions({
  caseId,
  status,
  verificationRun,
}: {
  caseId: string;
  status: ApiCaseStatus;
  /** True once a verification check has produced a result for this case. */
  verificationRun: boolean;
}) {
  const [actor, setActor] = useActor();
  const actorId = useId();
  const ownerId = useId();
  const startId = useId();
  const takenId = useId();
  const doneId = useId();

  if (status === "rejected") {
    return <p className="text-sm text-ink-muted">This case was rejected and is closed. No further actions.</p>;
  }

  return (
    <div className="space-y-4">
      <ActorInput id={actorId} value={actor} onChange={setActor} />

      {(status === "needs_review" || status === "inconclusive") && (
        <>
          <TransitionForm
            caseId={caseId}
            to="confirmed"
            actor={actor}
            title="Confirm for action"
            help="You have reviewed the evidence and judge it worth a technician's time. This does not confirm a diagnosis."
            submit="Confirm for action"
          >
            <NoteField />
          </TransitionForm>
          {status === "needs_review" && (
            <TransitionForm
              caseId={caseId}
              to="inconclusive"
              actor={actor}
              title="Mark review inconclusive"
              help="The data does not let you decide yet. The case stays open and can be confirmed or rejected later."
              submit="Mark inconclusive"
              tone="neutral"
            >
              <NoteField label="What is missing? (optional)" />
            </TransitionForm>
          )}
          <RejectForm caseId={caseId} actor={actor} />
        </>
      )}

      {status === "confirmed" && (
        <>
          <TransitionForm
            caseId={caseId}
            to="action_assigned"
            actor={actor}
            title="Assign the action"
            help="Name who will carry out the check or repair."
            submit="Assign action"
          >
            <Field label="Owner" htmlFor={ownerId}>
              <input id={ownerId} name="owner" required maxLength={120} className={inputClass} placeholder="Person or team" />
            </Field>
            <NoteField label="What should they do? (optional)" />
          </TransitionForm>
          <RejectForm caseId={caseId} actor={actor} />
        </>
      )}

      {status === "action_assigned" && (
        <TransitionForm
          caseId={caseId}
          to="in_progress"
          actor={actor}
          title="Start the work"
          help="Records when work began. Verification later compares the 7 days before this time with the 7 days after completion."
          submit="Mark in progress"
        >
          <Field
            label="Work started (Asia/Dhaka, optional)"
            htmlFor={startId}
            hint="Leave empty to use the current time."
          >
            <input id={startId} name="action_started_at" type="datetime-local" className={inputClass} />
          </Field>
          <NoteField />
        </TransitionForm>
      )}

      {status === "in_progress" && (
        <TransitionForm
          caseId={caseId}
          to="resolved"
          actor={actor}
          title="Record the action and resolve"
          help="Describe what was actually done. Resolving records the action; it does not claim the fix worked. Run the verification check afterwards, once post-action data exists."
          submit="Resolve case"
        >
          <Field label="Action taken" htmlFor={takenId} hint="For example: cleaned modules on array 2, replaced fuse on string 7.">
            <textarea id={takenId} name="action_taken" rows={3} required maxLength={2000} className={inputClass} />
          </Field>
          <Field
            label="Work completed (Asia/Dhaka, optional)"
            htmlFor={doneId}
            hint="Leave empty to use the current time. Cannot be in the future."
          >
            <input id={doneId} name="action_completed_at" type="datetime-local" className={inputClass} />
          </Field>
          <NoteField />
        </TransitionForm>
      )}

      {status === "resolved" && (
        <div className="space-y-2">
          <p className="text-sm text-ink-muted">
            Action recorded. Whether it improved output is decided by the verification check, which needs enough
            valid production hours before and after the action.
          </p>
          <VerifyForm caseId={caseId} actor={actor} rerun={verificationRun} />
        </div>
      )}
    </div>
  );
}
