import {
  CalendarDays,
  Crown,
  Inbox,
  ChartColumn,
  LayoutDashboard,
  Layers,
  Link2,
  List,
  ListClock,
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
  { href: "/queue", label: "Queue", icon: ListClock },
  { href: "/posts", label: "Posts", icon: List },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/bio", label: "Link in bio", icon: Link2 },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/plan", label: "Plan", icon: Crown },
  { href: "/settings", label: "Settings", icon: Settings },
];
