-- Want or not (Loop-want): swipe through drinks, Want one (a want_list row,
-- source 'swipe', as before) or pass on it. A pass is new: drink_passes keeps
-- it so the deck doesn't show that drink again. Private to the person, like
-- want_list. want_alerts is the Want list's "Tell me when one's on near you"
-- switch; sending those alerts is the push lane's.
--
-- want_deck: classics you haven't wanted, passed on or had, with a flavour
-- profile (so each card can show a match), most ranked first. Runs as the
-- caller, so it reads only their own rows.

CREATE TABLE "public"."drink_passes" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "passed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "item_id")
);

CREATE INDEX "drink_passes_item_id_idx" ON "public"."drink_passes" ("item_id");

ALTER TABLE "public"."drink_passes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drink_passes_select_own" ON "public"."drink_passes" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "drink_passes_insert_own" ON "public"."drink_passes" FOR INSERT TO "authenticated"
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "drink_passes_delete_own" ON "public"."drink_passes" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON TABLE "public"."drink_passes" FROM "anon";
GRANT SELECT, INSERT, DELETE ON TABLE "public"."drink_passes" TO "authenticated";

COMMENT ON TABLE "public"."drink_passes" IS
    'Drinks a person swiped Not for me on, so the want deck skips them. Private to them.';

ALTER TABLE "public"."user_prefs"
    ADD COLUMN "want_alerts" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."user_prefs"."want_alerts" IS
    'Tell me when a drink on my Want list is on near me.';

CREATE FUNCTION "public"."want_deck"("p_limit" integer DEFAULT 20) RETURNS TABLE("item_id" "uuid", "name" "text", "description" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT i.id, i.name, i.description
  FROM public.items i
  WHERE i.is_catalog AND i.item_type = 'cocktail' AND auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.item_flavors f WHERE f.item_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.want_list w WHERE w.user_id = auth.uid() AND w.item_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.drink_passes d WHERE d.user_id = auth.uid() AND d.item_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.drinks_had h WHERE h.user_id = auth.uid() AND h.item_id = i.id)
  ORDER BY (SELECT count(*) FROM public.rank_entries e WHERE e.ranked_as_item_id = i.id) DESC, i.name
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

REVOKE ALL ON FUNCTION "public"."want_deck"(integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."want_deck"(integer) TO "authenticated";
