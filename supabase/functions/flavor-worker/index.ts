import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  AI_FLAVOR_VERSION,
  aiPrompt,
  parseAiFlavors,
  partWeight,
  profileFromSpec,
  ruleFor,
  RULES_VERSION,
  staleAiFlavor,
  TASTE_DIMENSIONS,
  type IngredientFlavor,
  type SpecPart,
  type SpecProfile,
} from "../_shared/flavor.ts";
import {
  aiAnswerSchema,
  parseAiDrink,
  parseAiLooks,
  SKETCH_VERSION,
  sketchFromDrink,
  sketchPromptAddendum,
  type DrinkLook,
  type IngredientLook,
  type SketchDrink,
  type SketchResult,
} from "../_shared/sketch.ts";
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
 * In the same pass it works out the drink's drawing inputs (_shared/sketch.ts):
 * glass, ice, method, colour, foam and garnish, from the drink's data, its
 * spec, name and description. For a drink with no picture, the same AI call
 * also asks what unknown ingredients look like and, when the rules can't
 * settle it, how the drink is served. Catalog drinks with no venue or creator
 * only get that AI help when CATALOG_AI_FILL=on, which bills nobody.
 * The AI fill is mocked on a local stack and off in production until
 * FLAVOR_MODEL=live is set.
 */

const FN = "flavor-worker";
const DEFAULT_VENUE_DAILY_LIMIT = 50;
const DEFAULT_USER_DAILY_LIMIT = 40;
const TIME_BUDGET_MS = 60_000;
const CONCURRENCY = 4;

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
function mockAnswer(parts: SpecPart[], drink: SketchDrink | null): string {
  if (parts.some((p) => p.name.includes("[mock-fail]")) || drink?.name.includes("[mock-fail]")) {
    throw new Error("Mock AI fill failed on purpose.");
  }
  return JSON.stringify({
    ingredients: parts.map((p) => ({ id: p.id, sweet: 0.5, fruity: 0.5, abv: 0, color: "#c0392b", tint: 0.8, foam: null })),
    ...(drink ? { drink: { glass: "flute", ice: "none", method: "build", garnish: "lemon_peel", color: "pale_straw", foam: null } } : {}),
  });
}

interface SketchContext {
  name: string;
  description: string | null;
  glass: string | null;
  ice: string | null;
  methods: string[];
  hasImage: boolean;
  /** Whether the drink already has a drawing (20261007100000_glass_variants). */
  hasSketch?: boolean;
  ai: { basis: string; answer: DrinkLook } | null;
}

/** What the model is shown about a drink, hashed: a cached answer stands until it changes. */
async function sketchBasis(ctx: SketchContext, parts: SpecPart[]): Promise<string> {
  // SKETCH_VERSION too: answers asked under older rules are asked again.
  const text = JSON.stringify([SKETCH_VERSION, ctx.name, ctx.description ?? "", parts.map((p) => p.name)]);
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function sketchDrink(ctx: SketchContext, parts: SpecPart[], ai: DrinkLook | null, looks?: Map<string, IngredientLook>): SketchDrink {
  return {
    name: ctx.name,
    description: ctx.description,
    glass: ctx.glass,
    ice: ctx.ice,
    methods: ctx.methods,
    ai,
    lines: parts.map((p) => ({
      id: p.id,
      name: p.name,
      genericName: p.genericName,
      categories: p.categories,
      amount: p.amount,
      unit: p.unit,
      volume: partWeight(p).volume,
      look: (p.id && looks?.get(p.id)) || ((p.ai?.look as IngredientLook | undefined) ?? null),
    })),
  };
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

  const catalogAi = Deno.env.get("CATALOG_AI_FILL") === "on";

  const saveSketch = async (job: Job, sketch: SketchResult, drinkAnswer?: { basis: string; answer: DrinkLook }) => {
    const { error } = await admin.rpc("save_item_sketch", {
      p_item_id: job.item_id,
      p_inputs: sketch.inputs,
      p_source: sketch.usedAi ? "ai" : "rules",
      p_spec_fingerprint: job.spec_fingerprint,
      p_rules_version: SKETCH_VERSION,
      p_ai_basis: drinkAnswer?.basis ?? null,
      p_ai_answer: drinkAnswer?.answer ?? null,
    });
    if (error) throw error;
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
  const tally = { rules: 0, ai: 0, over_quota: 0, gone: 0, failed: 0, sketches: 0 };

  let claimFailed = false;
  // One job from claim to save. False when there's nothing left to claim.
  const workOne = async (): Promise<boolean> => {
    const { data, error: claimError } = await admin.rpc("claim_item_flavor_job");
    if (claimError) {
      console.error(`${FN}: claim failed:`, claimError);
      claimFailed = true;
      return false;
    }
    const job = (data as Job[] | null)?.[0];
    if (!job) return false;
    if (!job.spec_fingerprint) {
      // Deleted, or no longer a cocktail.
      await release(job, "gone", "Nothing to compute.");
      tally.gone++;
      return true;
    }

    let charged = false;
    try {
      const { data: spec, error: specError } = await admin.rpc("get_item_flavor_spec", { p_item_id: job.item_id });
      if (specError) throw specError;
      const parts: SpecPart[] = ((spec ?? []) as Line[]).map((l) => ({ ...l, categories: l.categories ?? [] }));
      const { data: ctxData, error: ctxError } = await admin.rpc("get_item_sketch_context", { p_item_id: job.item_id });
      if (ctxError) throw ctxError;
      const ctx = ctxData as SketchContext;
      const basis = await sketchBasis(ctx, parts);
      const cachedDrink = ctx.ai?.basis === basis ? ctx.ai.answer : null;

      const rules = profileFromSpec(parts);
      const looks = sketchFromDrink(sketchDrink(ctx, parts, cachedDrink));
      // How a drink looks only matters while it has no picture: only then is it worth an AI question.
      const askLooks = ctx.hasImage ? [] : looks.unknown.filter((l) => l.id).map((l) => l.id as string);
      const askDrink = !ctx.hasImage && looks.askDrink && !cachedDrink;
      // Cached answers from before the current dimensions are asked again.
      const stale = parts.filter((p) => p.id && staleAiFlavor(p.ai) && !ruleFor(p)).map((p) => p.id as string);
      const askIds = new Set([...rules.unknown.map((p) => p.id).filter((id): id is string => !!id), ...askLooks, ...stale]);
      const ask = parts.filter((p): p is SpecPart & { id: string } => !!p.id && askIds.has(p.id));
      // Only refreshing old answers: our change, so it isn't billed to the venue.
      const refreshOnly = !askDrink && ask.every((p) => stale.includes(p.id));

      if ((!ask.length && !askDrink) || model === "off") {
        await saveSketch(job, looks);
        await save(job, rules, true);
        tally.rules++;
        tally.sketches++;
        return true;
      }

      // Something to show while the AI fill runs, or if it never succeeds. Not
      // over a drawing the drink already has: re-queued, it would swap that for
      // a rougher one and back again, and people saw it change on refresh.
      if (!ctx.hasSketch) await saveSketch(job, looks);
      await save(job, rules, false);

      const { data: quota, error: quotaError } = refreshOnly
        ? { data: "refresh", error: null }
        : await admin.rpc("consume_item_ai_quota", {
            p_item_id: job.item_id,
            p_fn: FN,
            p_venue_daily_limit: venueLimit,
            p_user_daily_limit: userLimit,
          });
      if (quotaError) throw quotaError;
      if (quota === "limit") {
        await release(job, "over_quota", "Daily AI allowance used up.");
        tally.over_quota++;
        return true;
      }
      if (quota === "no_payer" && !catalogAi) {
        // A catalog drink with no venue or creator: the rules stand.
        if (ctx.hasSketch) await saveSketch(job, looks);
        await save(job, rules, true);
        tally.rules++;
        tally.sketches++;
        return true;
      }
      charged = quota !== "no_payer" && quota !== "refresh";

      const drinkForPrompt = askDrink ? sketchDrink(ctx, parts, null) : null;
      const prompt = aiPrompt(ask, sketchPromptAddendum(drinkForPrompt));
      const text = model === "mock" ? mockAnswer(ask, drinkForPrompt) : await askJson(prompt, aiAnswerSchema(TASTE_DIMENSIONS, !!drinkForPrompt));
      const answers = parseAiFlavors(text, ask.map((p) => p.id));
      const lookAnswers = parseAiLooks(text, ask.map((p) => p.id));
      const drinkAnswer = askDrink ? parseAiDrink(text) : null;
      if (!answers.size && !lookAnswers.size && !drinkAnswer) throw new Error("The AI fill returned nothing usable.");

      const filled = profileFromSpec(parts.map((p) => (p.id && answers.has(p.id) ? { ...p, ai: answers.get(p.id) } : p)));
      const ingredients = ask
        .filter((p) => answers.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, flavor: { ...answers.get(p.id)!, v: AI_FLAVOR_VERSION, look: lookAnswers.get(p.id) ?? p.ai?.look ?? null } }));
      const drawn = sketchFromDrink(sketchDrink(ctx, parts, drinkAnswer ?? cachedDrink, lookAnswers));
      await saveSketch(job, drawn, drinkAnswer ? { basis, answer: drinkAnswer } : undefined);
      await save(job, filled, true, ingredients);
      tally.ai++;
      tally.sketches++;
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
    return true;
  };

  // A few jobs at a time: most of a job is waiting on the model.
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (Date.now() - started < TIME_BUDGET_MS && (await workOne()));
    }),
  );
  if (claimFailed) return json({ error: "Could not claim a job.", ...tally }, 500);

  return json(tally);
});
