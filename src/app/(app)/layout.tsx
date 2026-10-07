import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentUser } from "@/lib/data";

// Every page inside the (app) folder shares this sidebar layout.
// The brackets mean "(app)" is only a group; it doesn't appear in the URL.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Sends logged-out visitors to /login (proxy.ts does this too; this is a second check).
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <AppSidebar user={{ name: user.name, email: user.email }} />
      <main className="flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
