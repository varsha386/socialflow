import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Publishing (especially videos) can take a few minutes.
export const maxDuration = 300;

// Inngest calls this address to run our background jobs.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
