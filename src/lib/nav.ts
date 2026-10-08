import {
  CalendarDays,
  ChartColumn,
  LayoutDashboard,
  Layers,
  List,
  Plug,
  Settings,
  SquarePen,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create post", icon: SquarePen },
  { href: "/bulk", label: "Bulk upload", icon: Layers },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/posts", label: "Posts", icon: List },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/settings", label: "Settings", icon: Settings },
];
