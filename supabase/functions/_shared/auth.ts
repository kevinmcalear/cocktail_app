import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

import { HttpError } from "./http.ts";

const DEFAULT_AI_DAILY_LIMIT = 40;

export interface Caller {
  user: User;
  /** Acts as the caller, so row-level security applies. */
  userClient: SupabaseClient;
  /** Service role; use only after the caller has been authorized. */
  admin: SupabaseClient;
}

export async function requireUser(req: Request): Promise<Caller> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new HttpError(401, "Please sign in again.");

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // The anon key is also a valid bearer token, so the gateway's JWT check is not
  // enough: only a real user session resolves to a user here.
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Please sign in again.");

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  return { user: data.user, userClient, admin };
}

export async function requireItemEditor(caller: Caller, itemId: string): Promise<void> {
  const { data, error } = await caller.userClient.rpc("can_edit_item", { p_item_id: itemId });
  if (error) throw error;
  if (data !== true) throw new HttpError(403, "You don't have permission to change this item.");
}

/** Records one paid AI call, refusing once the caller hits the daily limit. */
export async function consumeAiQuota(caller: Caller, fn: string): Promise<void> {
  const limit = Number(Deno.env.get("AI_DAILY_LIMIT")) || DEFAULT_AI_DAILY_LIMIT;
  const { data, error } = await caller.admin.rpc("consume_ai_quota", {
    p_user_id: caller.user.id,
    p_fn: fn,
    p_daily_limit: limit,
  });
  if (error) throw error;
  if (data !== true) {
    throw new HttpError(429, "You've reached today's AI limit. Try again tomorrow.");
  }
}
