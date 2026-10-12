import {
  Bell,
  FileBarChart2,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** false = route exists but shows a "coming in a later phase" page. */
  built: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, built: true },
  { href: "/sites", label: "Sites", icon: MapPinned, built: false },
  { href: "/alerts", label: "Alerts", icon: Bell, built: false },
  { href: "/recovery-cases", label: "Recovery Cases", icon: LifeBuoy, built: false },
  { href: "/reports", label: "Reports & Impact", icon: FileBarChart2, built: false },
];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return NAV_ITEMS[0];
  return NAV_ITEMS.find((n) => n.href !== "/" && pathname.startsWith(n.href));
}
