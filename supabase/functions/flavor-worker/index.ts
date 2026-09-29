import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  aiPrompt,
  parseAiFlavors,
  profileFromSpec,
  RULES_VERSION,
  type IngredientFlavor,
  type SpecPart,
  type SpecProfile,
} from "../_shared/flavor.ts";
import { askJson, flavorModel } from "../_shared/gemini.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { isLocalStack, LOCAL_FLAVOR_WORKER_SECRET } from "../_shared/localStack.ts";

/**
 * Computes the flavor profiles queued in private.item_flavor_jobs.
 *
 * Called by the database (private.wake_flavor_worker, via pg_net) with the
 * shared secret; takes no input. For each claimed drink it:
 *   1. reads the spec (raw ingredient names, server side only) and scores it
 *      with the rules in _shared/flavor.ts;
 *   2. if some ingredients are unknown to the rules and have no cached answer,
 *      and the AI fill is on, saves the rules profile first, then asks the
 *      model once for all of them, billed to the drink's venue (or its
 *      creator) like the image worker, refunded if the call fails;
 *   3. saves the profile (numbers only) and the answers, cached per ingredient.
 * The AI fill is mocked on a local stack and off in production until
 * FLAVOR_MODEL=live is set.
 */

const FN = "flavor-worker";
const DEFAULT_VENUE_DAILY_LIMIT = 50;
const DEFAULT_USER_DAILY_LIMIT = 40;
const TIME_BUDGET_MS = 60_000;

function authorized(req: Request): boolean {
  const expected = Deno.env.get("FLAVOR_WORKER_SECRET") || (isLocalStack() ? LOCAL_FLAVOR_WORKER_SECRET : "");
  const given = req.headers.get("x-flavor-worker-secret") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * The local stand-in for the model: a sweet, fruity guess for everything.
 * An ingredient named with "[mock-fail]" makes the call fail, so tests can
 * check the refund. Local stacks only (flavorModel() never mocks elsewhere).
 */
function mockAnswer(parts: SpecPart[]): string {
  if (parts.some((p) => p.name.includes("[mock-fail]"))) throw new Error("Mock AI fill failed on purpose.");
  return JSON.stringify({ ingredients: parts.map((p) => ({ id: p.id, sweet: 0.5, fruity: 0.5, abv: 0 })) });
}

interface Job {
  item_id: string;
  revision: number;
  spec_fingerprint: string | null;
}

interface Line {
  id: string | null;
  name: string;
  genericName: string | null;
  categories: string[] | null;
  amount: number | null;
  unit: string | null;
  ai: IngredientFlavor | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!authorized(req)) return json({ error: "Not allowed." }, 401);
  const model = flavorModel();
  // Lets tests confirm the model is mocked before queueing any work.
  if (req.method === "GET") return json({ model });

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  const venueLimit = Number(Deno.env.get("VENUE_AI_DAILY_LIMIT")) || DEFAULT_VENUE_DAILY_LIMIT;
  const userLimit = Number(Deno.env.get("AI_DAILY_LIMIT")) || DEFAULT_USER_DAILY_LIMIT;

  const release = async (job: Job, outcome: "failed" | "over_quota" | "gone", message?: string) => {
    const { error } = await admin.rpc("release_item_flavor_job", {
      p_item_id: job.item_id,
      p_revision: job.revision,
      p_outcome: outcome,
      p_error: message ?? null,
    });
    if (error) console.error(`${FN}: release failed for ${job.item_id}:`, error);
  };

  const save = async (job: Job, result: SpecProfile, done: boolean, ingredients?: { id: string; name: string; flavor: IngredientFlavor }[]) => {
    const { error } = await admin.rpc("save_item_flavor", {
      p_item_id: job.item_id,
      p_profile: result.profile,
      p_coverage: result.coverage,
      p_source: result.usedAi ? "ai" : "rules",
      p_spec_fingerprint: job.spec_fingerprint,
      p_rules_version: RULES_VERSION,
      p_ingredients: ingredients ?? null,
      p_job_revision: done ? job.revision : null,
    });
    if (error) throw error;
  };

  const started = Date.now();
  const tally = { rules: 0, ai: 0, over_quota: 0, gone: 0, failed: 0 };

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data, error: claimError } = await admin.rpc("claim_item_flavor_job");
    if (claimError) {
      console.error(`${FN}: claim failed:`, claimError);
      return json({ error: "Could not claim a job." }, 500);
    }
    const job = (data as Job[] | null)?.[0];
    if (!job) break;
    if (!job.spec_fingerprint) {
      // Deleted, or no longer a cocktail.
      await release(job, "gone", "Nothing to compute.");
      tally.gone++;
      continue;
    }

    let charged = false;
    try {
      const { data: spec, error: specError } = await admin.rpc("get_item_flavor_spec", { p_item_id: job.item_id });
      if (specError) throw specError;
      const parts: SpecPart[] = ((spec ?? []) as Line[]).map((l) => ({ ...l, categories: l.categories ?? [] }));
      const rules = profileFromSpec(parts);
      const ask = rules.unknown.filter((p): p is SpecPart & { id: string } => !!p.id);

      if (!ask.length || model === "off") {
        await save(job, rules, true);
        tally.rules++;
        continue;
      }

      // Something to show while the AI fill runs, or if it never succeeds.
      await save(job, rules, false);

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
        // A catalog drink with no venue or creator: the rules profile stands.
        await save(job, rules, true);
        tally.rules++;
        continue;
      }
      charged = true;

      const answers = parseAiFlavors(model === "mock" ? mockAnswer(ask) : await askJson(aiPrompt(ask)), ask.map((p) => p.id));
      if (!answers.size) throw new Error("The AI fill returned nothing usable.");
      const filled = profileFromSpec(parts.map((p) => (p.id && answers.has(p.id) ? { ...p, ai: answers.get(p.id) } : p)));
      const ingredients = ask
        .filter((p) => answers.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, flavor: answers.get(p.id)! }));
      await save(job, filled, true, ingredients);
      tally.ai++;
    } catch (err) {
      console.error(`${FN}: job ${job.item_id} failed:`, err);
      if (charged) {
        // Nothing came of it, so it shouldn't count against the venue's allowance.
        const { error: refundError } = await admin.rpc("refund_item_ai_quota", { p_item_id: job.item_id, p_fn: FN });
        if (refundError) console.error(`${FN}: refund failed for ${job.item_id}:`, refundError);
      }
      await release(job, "failed", err instanceof Error ? err.message : String(err));
      tally.failed++;
    }
  }

  return json(tally);
});
