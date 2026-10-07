import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";

// Every page inside the (app) folder shares this sidebar layout.
// The brackets mean "(app)" is only a group; it doesn't appear in the URL.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already sends logged-out visitors to /login; this is a second check
  // that also gives us the user's details. getUser() asks Supabase directly.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email ?? "";
  const name = (user.user_metadata.full_name as string | undefined) || email.split("@")[0];

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <AppSidebar user={{ name, email }} />
      <main className="flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
