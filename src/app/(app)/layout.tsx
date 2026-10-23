import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentUser, getFailedPostCount } from "@/lib/data";

// Every page inside the (app) folder shares this sidebar layout.
// The brackets mean "(app)" is only a group; it doesn't appear in the URL.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Sends logged-out visitors to /login (proxy.ts does this too; this is a second check).
  const [user, failedCount] = await Promise.all([getCurrentUser(), getFailedPostCount()]);

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      {/* Suspense: the menu reads ?status=… from the address to highlight the right Posts tab. */}
      <Suspense>
        <AppSidebar user={{ name: user.name, email: user.email }} failedCount={failedCount} />
      </Suspense>
      <main className="flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
