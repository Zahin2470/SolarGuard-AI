"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { findNavItem, NAV_ITEMS } from "./nav";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={clsx("size-8", className)}
      fill="none"
    >
      <rect width="32" height="32" rx="8" fill="#12392f" />
      <path
        d="M16 5.5 25 9v6.4c0 5.1-3.6 8.9-9 11.1-5.4-2.2-9-6-9-11.1V9l9-3.5Z"
        stroke="#b9e34b"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 17.5h11M13 14l-1.6 7M19 14l1.6 7M16 12v9"
        stroke="#9fc2b7"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = findNavItem(pathname);

  return (
    <div className="flex h-full flex-col bg-pine-900 text-pine-100">
      <div className="flex h-[var(--topbar-h)] items-center gap-2.5 border-b border-white/10 px-4">
        <BrandMark />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold text-white">SolarGuard AI</p>
          <p className="text-[11px] text-pine-300">Performance intelligence</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = active?.href === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "group relative flex items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-pine-700 text-white"
                      : "text-pine-100 hover:bg-pine-800 hover:text-white",
                  )}
                >
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-2 left-0 w-1 rounded-r bg-lime"
                    />
                  ) : null}
                  <Icon aria-hidden className="size-[18px] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {!item.built ? (
                    <span className="rounded border border-white/20 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-pine-300">
                      Soon
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-4 text-xs leading-relaxed text-pine-300">
        <p className="font-semibold text-pine-100">Data sources</p>
        <p>
          Each page states its source. With the API connected, figures are live records; without it, Overview,
          Sites and Alerts show labelled demo fixtures.
        </p>
      </div>
    </div>
  );
}
