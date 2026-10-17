import clsx from "clsx";
import { useId, type ReactNode } from "react";

/** Standard content panel: titled section with optional description and header action. */
export function Panel({
  id,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const autoId = useId();
  const headingId = `${id ?? autoId}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={clsx(
        "rounded-card border border-line bg-surface shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={clsx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
