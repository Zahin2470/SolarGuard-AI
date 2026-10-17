import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SolarGuard AI",
    template: "%s · SolarGuard AI",
  },
  description:
    "Explainable solar performance intelligence and verified energy recovery for PV operators.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* The shell reads the pathname; routes with runtime-only params need a Suspense boundary. */}
        <Suspense fallback={<div aria-busy="true" aria-label="Loading SolarGuard" className="min-h-screen" />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
