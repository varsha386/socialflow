import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that only logged-in users may see.
const PROTECTED = [
  "/dashboard",
  "/create",
  "/bulk",
  "/calendar",
  "/posts",
  "/inbox",
  "/connections",
  "/analytics",
  "/settings",
  "/reset-password",
];

// Pages that logged-in users don't need (they go to the dashboard instead).
const AUTH_PAGES = ["/login", "/signup"];

// Where people with two-step login turned on enter their 6-digit code.
const VERIFY_PAGE = "/verify-code";

// Addresses that act on someone's accounts, so they also need the code.
const CODE_REQUIRED_API = ["/api/posts", "/api/connect"];

const matches = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(p + "/"));

// Runs before every page request: keeps the login session fresh and
// sends people to the right place depending on whether they're logged in.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    }
  );

  // Checks the login token (and refreshes it if needed).
  const { data } = await supabase.auth.getClaims();
  const loggedIn = !!data?.claims;
  const path = request.nextUrl.pathname;

  // Redirect, keeping any refreshed login cookies.
  const redirectTo = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Two-step login: has this person turned it on but not entered the code yet?
  let needsCode = false;
  if (loggedIn) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    needsCode = aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  }

  if (path === VERIFY_PAGE) {
    if (!loggedIn) return redirectTo("/login");
    if (!needsCode) return redirectTo("/dashboard");
    return response;
  }

  if (!loggedIn && matches(path, PROTECTED)) return redirectTo("/login");

  if (needsCode) {
    // Publishing and connecting are blocked until the code is entered.
    if (matches(path, CODE_REQUIRED_API)) {
      return NextResponse.json({ error: "Enter your two-step login code first." }, { status: 401 });
    }
    // Remember where they were going (e.g. /reset-password), and return there after the code.
    if (matches(path, PROTECTED)) return redirectTo(VERIFY_PAGE, `?next=${encodeURIComponent(path)}`);
    if (matches(path, AUTH_PAGES)) return redirectTo(VERIFY_PAGE);
  }

  if (loggedIn && matches(path, AUTH_PAGES)) return redirectTo("/dashboard");

  return response;
}

export const config = {
  // Skip static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
