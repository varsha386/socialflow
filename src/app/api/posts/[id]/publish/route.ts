import { NextResponse, type NextRequest } from "next/server";
import { publishPost } from "@/lib/publishing";
import { createClient } from "@/lib/supabase/server";

// Uploading videos and waiting for Instagram can take a few minutes.
export const maxDuration = 300;

// POST /api/posts/<id>/publish: publish (or retry) a post now.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/posts/[id]/publish">) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Your session expired. Log in again." }, { status: 401 });

  const outcome = await publishPost(id, user.id);
  return NextResponse.json(outcome, { status: "error" in outcome ? 400 : 200 });
}
