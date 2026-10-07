import type { LucideIcon } from "lucide-react";

// Placeholder for pages we haven't built yet.
export function ComingSoon({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
        <Icon className="size-6" />
      </span>
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
