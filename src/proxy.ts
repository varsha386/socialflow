import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Pages that only logged-in users may see.
const PROTECTED = [
  "/dashboard",
  "/create",
  "/bulk",
  "/calendar",
  "/posts",
  "/connections",
  "/analytics",
  "/settings",
  "/reset-password",
];

// Pages that logged-in users don't need (they go to the dashboard instead).
const AUTH_PAGES = ["/login", "/signup"];

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

  if (!loggedIn && matches(path, PROTECTED)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (loggedIn && matches(path, AUTH_PAGES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
