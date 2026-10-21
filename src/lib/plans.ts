// The Free and Pro plans. Pro has no limits. Payments come later; for now,
// someone is moved to Pro by hand (see supabase/migrations/20261020120000_pro_plan.sql).

export type Plan = "free" | "pro";

export const PRO_PRICE = "$9 / month";

export const FREE_LIMITS = {
  accounts: 3, // connected social accounts
  scheduledPerMonth: 30, // posts scheduled or queued to go out in one calendar month
  aiCaptionsPerMonth: 10, // times the AI Caption Writer is used in one calendar month
};

export type Usage = { accounts: number; scheduledThisMonth: number; aiCaptionsThisMonth: number };

export const toPlan = (value: unknown): Plan => (value === "pro" ? "pro" : "free");
