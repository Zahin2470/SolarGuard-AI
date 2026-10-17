"use client";

import clsx from "clsx";
import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

export const inputClass =
  "w-full rounded-ctl border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  tone = "primary",
}: {
  pending: boolean;
  children: ReactNode;
  tone?: "primary" | "neutral" | "danger";
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-ctl px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        tone === "primary" && "bg-primary text-white hover:bg-primary-strong",
        tone === "neutral" && "border border-line-strong bg-surface text-ink hover:bg-sunken",
        tone === "danger" && "border border-crit-line bg-crit-soft text-crit hover:bg-crit-soft/70",
      )}
    >
      {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

/** Polite live region: announces success or an actionable error without stealing focus. */
export function FormMessage({ state }: { state: ActionState }) {
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={clsx(
        "min-h-5 text-sm",
        state.status === "error" ? "font-medium text-crit" : "text-primary-strong",
      )}
    >
      {state.status === "idle" ? "" : state.message}
    </p>
  );
}
