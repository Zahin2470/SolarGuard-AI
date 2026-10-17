"use client";

import { useId } from "react";
import { FormMessage, Field, SubmitButton, inputClass } from "@/components/ui/Form";
import { IDLE } from "@/lib/action-state";
import { useServerForm } from "@/lib/use-server-form";
import type { ApiCase } from "@/lib/api/types";
import { editCaseAction } from "@/app/recovery-cases/actions";
import { ActorInput, useActor } from "./ActorField";

/** Human-supplied judgement fields. Recoverable energy stays empty until a person gives a share AND a reason. */
export function CaseEstimates({ c }: { c: ApiCase }) {
  const { state, pending, onSubmit } = useServerForm(editCaseAction.bind(null, c.id), IDLE);
  const [actor, setActor] = useActor();
  const ids = { actor: useId(), cause: useId(), pct: useId(), why: useId() };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="actor" value={actor} />
      <ActorInput id={ids.actor} value={actor} onChange={setActor} />

      <Field
        label="Probable cause (hypothesis)"
        htmlFor={ids.cause}
        hint="Your working hypothesis, not a confirmed diagnosis. The data in this system cannot show the cause by itself."
      >
        <textarea
          id={ids.cause}
          name="probable_cause"
          rows={2}
          maxLength={500}
          defaultValue={c.probable_cause ?? ""}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Share of gap recoverable (%)" htmlFor={ids.pct} hint="0 to 100. Empty = not estimated.">
          <input
            id={ids.pct}
            name="recoverable_pct"
            type="number"
            min={0}
            max={100}
            step="1"
            inputMode="decimal"
            defaultValue={c.recoverable_fraction === null ? "" : String(Math.round(c.recoverable_fraction * 1000) / 10)}
            className={inputClass}
          />
        </Field>
        <Field label="Why that share? (required with a share)" htmlFor={ids.why}>
          <textarea
            id={ids.why}
            name="recoverable_rationale"
            rows={2}
            maxLength={1000}
            defaultValue={c.recoverable_rationale ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} tone="neutral">
          Save estimates
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
