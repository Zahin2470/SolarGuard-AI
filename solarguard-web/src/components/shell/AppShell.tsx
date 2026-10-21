"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { findNavItem } from "./nav";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  // Close the drawer with Escape and move focus into / back out of it.
  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        menuRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-ctl focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-pop"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] lg:block">
        <Sidebar />
      </aside>

      {/* Mobile / tablet drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            className="absolute inset-0 bg-pine-950/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] shadow-pop">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
            <button
              ref={closeRef}
              type="button"
              aria-label="Close navigation"
              onClick={() => {
                setDrawerOpen(false);
                menuRef.current?.focus();
              }}
              className="absolute right-2 top-3 grid size-10 place-items-center rounded-ctl text-pine-100 hover:bg-pine-800"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[var(--sidebar-w)]">
        <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            ref={menuRef}
            type="button"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="grid size-10 place-items-center rounded-ctl border border-line bg-surface text-ink hover:bg-sunken lg:hidden"
          >
            <Menu aria-hidden className="size-5" />
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate text-sm text-ink-muted">
            <span>SolarGuard</span>
            <span aria-hidden className="mx-1.5 text-line-strong">
              /
            </span>
            <span className="font-medium text-ink" aria-current="page">
              {current?.label ?? "Overview"}
            </span>
          </nav>

        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
