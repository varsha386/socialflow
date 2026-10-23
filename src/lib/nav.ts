import {
  CalendarDays,
  ChartColumn,
  CircleAlert,
  CircleCheck,
  Clock,
  Crown,
  FileText,
  Inbox,
  LayoutDashboard,
  Layers,
  Link2,
  List,
  ListClock,
  MessagesSquare,
  Plug,
  Settings,
  SquarePen,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string; // may include ?status=... for a Posts tab
  label: string;
  icon: LucideIcon;
  badge?: "failed"; // shows the number of failed posts
};

// A heading that opens and closes, with its own pages underneath.
export type NavGroup = { label: string; icon: LucideIcon; items: NavLink[] };

export type NavEntry = NavLink | NavGroup;

export const isGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

export const NAV: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    label: "Create",
    icon: SquarePen,
    items: [
      { href: "/create", label: "Create post", icon: SquarePen },
      { href: "/bulk", label: "Bulk upload", icon: Layers },
    ],
  },
  {
    label: "Posts",
    icon: List,
    items: [
      { href: "/posts", label: "All posts", icon: List },
      { href: "/posts?status=draft", label: "Drafts", icon: FileText },
      { href: "/posts?status=scheduled", label: "Scheduled", icon: Clock },
      { href: "/posts?status=published", label: "Published", icon: CircleCheck },
      { href: "/posts?status=failed", label: "Failed", icon: CircleAlert, badge: "failed" },
    ],
  },
  {
    label: "Schedule",
    icon: CalendarDays,
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/queue", label: "Queue", icon: ListClock },
    ],
  },
  {
    label: "Engage",
    icon: MessagesSquare,
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/analytics", label: "Analytics", icon: ChartColumn },
    ],
  },
  {
    label: "Profile",
    icon: UserRound,
    items: [
      { href: "/connections", label: "Connections", icon: Plug },
      { href: "/bio", label: "Link in bio", icon: Link2 },
    ],
  },
  {
    label: "Account",
    icon: Settings,
    items: [
      { href: "/plan", label: "Plan", icon: Crown },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
