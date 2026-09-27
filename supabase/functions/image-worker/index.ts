import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2";

import { mockImages } from "../_shared/gemini.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { drawItemSketch, loadItemForPrompt } from "../_shared/itemImage.ts";
import { isImageItemType } from "../_shared/itemPrompts.ts";
import { isLocalStack, LOCAL_IMAGE_WORKER_SECRET } from "../_shared/localStack.ts";

/**
 * Draws the automatic hero sketches queued in private.item_image_jobs.
 *
 * Called by the database (private.wake_image_worker, via pg_net) with the
 * shared secret; takes no input. It claims ready jobs one at a time until the
 * queue is empty or its time budget runs out, and bills each sketch to the
 * item's venue (or, for a personal item, its creator), never to whoever
 * happened to press Save.
 */

const FN = "image-worker";
const DEFAULT_VENUE_DAILY_LIMIT = 50;
const DEFAULT_USER_DAILY_LIMIT = 40;
// Stop claiming new jobs after this long, well inside the edge runtime's
// wall-clock limit; the next cron tick wakes a fresh worker.
const TIME_BUDGET_MS = 60_000;

function authorized(req: Request): boolean {
  const expected = Deno.env.get("IMAGE_WORKER_SECRET") || (isLocalStack() ? LOCAL_IMAGE_WORKER_SECRET : "");
  const given = req.headers.get("x-image-worker-secret") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

interface Job {
  item_id: string;
  revision: number;
  spec_fingerprint: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!authorized(req)) return json({ error: "Not allowed." }, 401);
  // Lets tests confirm the image model is mocked before queueing any work.
  if (req.method === "GET") return json({ model: mockImages() ? "mock" : "live" });

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  const venueLimit = Number(Deno.env.get("VENUE_AI_DAILY_LIMIT")) || DEFAULT_VENUE_DAILY_LIMIT;
  const userLimit = Number(Deno.env.get("AI_DAILY_LIMIT")) || DEFAULT_USER_DAILY_LIMIT;

  const release = async (job: Job, outcome: "failed" | "over_quota" | "no_payer", message?: string) => {
    const { error } = await admin.rpc("release_item_image_job", {
      p_item_id: job.item_id,
      p_revision: job.revision,
      p_outcome: outcome,
      p_error: message ?? null,
    });
    if (error) console.error(`${FN}: release failed for ${job.item_id}:`, error);
  };

  const started = Date.now();
  const tally = { drawn: 0, over_quota: 0, no_payer: 0, failed: 0 };

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data, error: claimError } = await admin.rpc("claim_item_image_job");
    if (claimError) {
      console.error(`${FN}: claim failed:`, claimError);
      return json({ error: "Could not claim a job." }, 500);
    }
    const job = (data as Job[] | null)?.[0];
    if (!job) break;

    let charged = false;
    try {
      const item = await loadItemForPrompt(admin, job.item_id);
      if (!item || !isImageItemType(item.item_type) || !job.spec_fingerprint) {
        // Deleted, or no longer a kind that gets sketches.
        await release(job, "no_payer", "Nothing to draw.");
        tally.no_payer++;
        continue;
      }

      const { data: quota, error: quotaError } = await admin.rpc("consume_item_ai_quota", {
        p_item_id: job.item_id,
        p_fn: FN,
        p_venue_daily_limit: venueLimit,
        p_user_daily_limit: userLimit,
      });
      if (quotaError) throw quotaError;
      if (quota === "limit") {
        await release(job, "over_quota", "Daily AI allowance used up.");
        tally.over_quota++;
        continue;
      }
      if (quota === "no_payer") {
        await release(job, "no_payer", "No venue or creator to bill.");
        tally.no_payer++;
        continue;
      }
      charged = true;

      const url = await drawItemSketch(admin, item, item.item_type);
      const { error: attachError } = await admin.rpc("attach_generated_item_image", {
        p_item_id: job.item_id,
        p_url: url,
        p_spec_fingerprint: job.spec_fingerprint,
        p_job_revision: job.revision,
      });
      if (attachError) throw attachError;
      tally.drawn++;
    } catch (err) {
      console.error(`${FN}: job ${job.item_id} failed:`, err);
      if (charged) {
        // Nothing was drawn, so it shouldn't count against the venue's allowance.
        const { error: refundError } = await admin.rpc("refund_item_ai_quota", { p_item_id: job.item_id, p_fn: FN });
        if (refundError) console.error(`${FN}: refund failed for ${job.item_id}:`, refundError);
      }
      await release(job, "failed", err instanceof Error ? err.message : String(err));
      tally.failed++;
    }
  }

  return json(tally);
});
