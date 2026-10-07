import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getConnector, missingEnv } from "@/lib/connectors";
import { STATE_COOKIE } from "@/lib/connectors/state";
import { createClient } from "@/lib/supabase/server";

// GET /api/connect/youtube or /api/connect/meta
// Sends the logged-in user to Google's or Facebook's permission screen.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/connect/[provider]">) {
  const { provider } = await ctx.params;
  const { origin } = request.nextUrl;
  const back = (query: string) => NextResponse.redirect(`${origin}/connections?${query}`);

  const connector = getConnector(provider);
  if (!connector) return back("error=unknown_provider");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const missing = missingEnv(connector);
  if (missing.length) {
    console.error(`[connect] ${provider} is missing env vars: ${missing.join(", ")}`);
    return back(`error=not_configured&provider=${provider}`);
  }

  // A random value we check when the user comes back, so nobody can fake the return trip.
  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${origin}/api/connect/${provider}/callback`;

  const response = NextResponse.redirect(connector.authorizeUrl({ redirectUri, state }));
  response.cookies.set(STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/connect",
    maxAge: 10 * 60,
  });
  return response;
}
