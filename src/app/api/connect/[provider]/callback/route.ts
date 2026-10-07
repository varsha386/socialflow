import { NextResponse, type NextRequest } from "next/server";
import { getConnector, saveAccounts } from "@/lib/connectors";
import { createClient } from "@/lib/supabase/server";
import { STATE_COOKIE } from "@/lib/connectors/state";

// GET /api/connect/youtube/callback or /api/connect/meta/callback
// Google/Facebook send the user back here with a one-time `code`.
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/connect/[provider]/callback">
) {
  const { provider } = await ctx.params;
  const { origin, searchParams } = request.nextUrl;

  const back = (query: string) => {
    const response = NextResponse.redirect(`${origin}/connections?${query}`);
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/connect" });
    return response;
  };

  const connector = getConnector(provider);
  if (!connector) return back("error=unknown_provider");

  // The user clicked "Cancel" on the permission screen.
  if (searchParams.get("error")) return back(`error=cancelled&provider=${provider}`);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const saved = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || saved !== `${provider}:${state}`) {
    return back(`error=expired&provider=${provider}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const accounts = await connector.handleCallback({
      code,
      redirectUri: `${origin}/api/connect/${provider}/callback`,
    });
    await saveAccounts(user.id, accounts);
    return back(`connected=${provider}&count=${accounts.length}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[connect] ${provider} callback failed:`, message);
    if (message === "NO_CHANNEL") return back("error=no_channel&provider=youtube");
    if (message === "NO_PAGES") return back("error=no_pages&provider=meta");
    return back(`error=failed&provider=${provider}`);
  }
}
