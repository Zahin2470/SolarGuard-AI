import clsx from "clsx";
import { CircleAlert, Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Skeleton block sized by the caller to match the final component. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("sg-skeleton", className)} />;
}

function StateShell({
  icon: Icon,
  title,
  children,
  action,
  tone,
  role,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone: "neutral" | "error";
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center"
    >
      <span
        className={clsx(
          "grid size-11 place-items-center rounded-full",
          tone === "error" ? "bg-crit-soft text-crit" : "bg-sunken text-ink-muted",
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="max-w-md">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {children ? <p className="mt-1 text-sm text-ink-muted">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Empty state: explain why there is nothing here and offer a valid next step. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <StateShell icon={Inbox} title={title} action={action} tone="neutral" role="status">
      {children}
    </StateShell>
  );
}

/** Error state: human-readable explanation plus a retry action where it is safe to retry. */
export function ErrorState({
  title = "This section could not be loaded",
  children,
  onRetry,
}: {
  title?: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <StateShell
      icon={CircleAlert}
      title={title}
      tone="error"
      role="alert"
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-ctl bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            Try again
          </button>
        ) : null
      }
    >
      {children}
    </StateShell>
  );
}
