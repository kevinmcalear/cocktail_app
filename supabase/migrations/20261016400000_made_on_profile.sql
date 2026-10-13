-- DRAFT. Local stack only. Not applied to production; needs Kevin's review.
--
-- Made it, on your profile (board drink-sheet-made; Kevin, 12 Oct: "build
-- it"). A made_drinks log can carry a photo and can be shown on your profile.
--
--   made_drinks.image_id     a photo of the drink you made: an images row
--                            from your own upload to the drinks bucket (the
--                            bucket's insert policy already applies the daily
--                            upload limit, private.has_upload_room).
--   made_drinks.on_profile   "Show on my profile". Off by default: a log is
--                            private until its owner shows it.
--   made_drinks_select_shared
--                            others (signed in or out) read a log only when
--                            it's shown AND its owner's profile is one they
--                            may see (public.is_made_log_shown).
--   get_profile_made(profile)
--                            the shown logs on a person's profile, with the
--                            drink's name and picture and the photo, never
--                            the owner's user id; the day only when they show
--                            dates.
--
-- "May see" follows the rules get_profile_drinks already uses for the drinks
-- someone has had, since the canvas draws a made drink in that list ("Made at
-- home"): a public, unmoderated person profile whose owner passed the age
-- check, showing drinks had at all (had_mode not 'none'), with nobody on
-- either side of a block; and a drink any reader may be told the name of (a
-- catalog drink or a published one), so a log never names a bar's private
-- drink. A moderator hiding the profile hides its logs too. The note is
-- screened like other public text once a log is shown.

ALTER TABLE "public"."made_drinks"
    ADD COLUMN "image_id" "uuid" REFERENCES "public"."images"("id") ON DELETE SET NULL,
    ADD COLUMN "on_profile" boolean DEFAULT false NOT NULL;

CREATE INDEX "made_drinks_image_idx" ON "public"."made_drinks" ("image_id") WHERE "image_id" IS NOT NULL;
CREATE INDEX "made_drinks_shown_idx" ON "public"."made_drinks" ("user_id", "made_on" DESC) WHERE "on_profile";

-- Whether others may read this log. In public because anon has no USAGE on
-- private (as public.is_card_public); it answers only for one log id, and
-- only what reading the row would tell you anyway.
CREATE FUNCTION "public"."is_made_log_shown"("p_made_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.made_drinks m
    JOIN public.profiles p ON p.user_id = m.user_id AND p.kind = 'person'
    JOIN public.items i ON i.id = m.item_id
    WHERE m.id = p_made_id
      AND m.on_profile
      AND p.is_public AND p.moderated_at IS NULL AND p.had_mode <> 'none'
      AND m.user_id NOT IN (SELECT private.blocked_user_ids())
      AND EXISTS (SELECT 1 FROM private.age_checks a WHERE a.user_id = m.user_id AND a.confirmed_at IS NOT NULL)
      AND i.moderated_at IS NULL
      AND (
        (i.bar_id IS NULL AND i.created_by IS NULL)
        OR i.id IN (SELECT pi.id FROM public.published_items pi WHERE NOT pi.is_reference)
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION "public"."is_made_log_shown"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."is_made_log_shown"("uuid") TO "anon", "authenticated", "service_role";

CREATE POLICY "made_drinks_select_shared" ON "public"."made_drinks" FOR SELECT TO "anon", "authenticated"
    USING ("on_profile" AND "public"."is_made_log_shown"("id"));

-- As 20261010600000, plus: a photo only from your own upload.
DROP POLICY "made_drinks_insert_own" ON "public"."made_drinks";
CREATE POLICY "made_drinks_insert_own" ON "public"."made_drinks" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND "private"."is_age_confirmed"()
        AND (
            EXISTS (SELECT 1 FROM "public"."published_items" "p" WHERE "p"."id" = "item_id" AND NOT "p"."is_reference")
            OR EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id")
        )
        AND ("rank_entry_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."rank_entries" "r" WHERE "r"."id" = "rank_entry_id" AND "r"."user_id" = (SELECT "auth"."uid"())
        ))
        AND ("image_id" IS NULL OR "private"."is_my_drinks_upload"("image_id"))
    );

DROP POLICY "made_drinks_update_own" ON "public"."made_drinks";
CREATE POLICY "made_drinks_update_own" ON "public"."made_drinks" FOR UPDATE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND ("rank_entry_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."rank_entries" "r" WHERE "r"."id" = "rank_entry_id" AND "r"."user_id" = (SELECT "auth"."uid"())
        ))
        AND ("image_id" IS NULL OR "private"."is_my_drinks_upload"("image_id"))
    );

-- The owner can now change the photo and whether it shows.
GRANT UPDATE ("image_id", "on_profile") ON "public"."made_drinks" TO "authenticated";

-- Signed out: only what the profile shows. Never user_id (it's hidden from
-- signed-out visitors on profiles too), the comparison or the ranking.
GRANT SELECT ("id", "item_id", "made_on", "note", "image_id", "on_profile") ON "public"."made_drinks" TO "anon";

-- --- Screening ---

-- A shown log's note and swaps are public text: screened as profiles are,
-- when the log is shown or its text changes while shown.
CREATE FUNCTION "private"."screen_made_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT NEW.on_profile THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' OR NOT OLD.on_profile OR NEW.note IS DISTINCT FROM OLD.note THEN
        PERFORM private.refuse_screened(NEW.note, 'note', 'note');
    END IF;
    IF TG_OP = 'INSERT' OR NOT OLD.on_profile OR NEW.swaps IS DISTINCT FROM OLD.swaps THEN
        PERFORM private.refuse_screened(
            (SELECT string_agg(concat_ws(' ', s->>'from', s->>'to'), E'\n') FROM jsonb_array_elements(NEW.swaps) s),
            'change', 'swaps');
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."screen_made_text"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "note", "swaps", "on_profile" ON "public"."made_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_made_text"();

-- --- The profile's list ---

-- The logs a person shows, latest first, for their profile's Had list. Runs
-- as its owner but answers with the same rule as the policy above, so it
-- shows nothing a direct read wouldn't, and leaves out the user id. The day
-- shows only when they say when they had their drinks.
CREATE FUNCTION "public"."get_profile_made"("p_profile_id" "uuid")
    RETURNS TABLE(
        "id" "uuid", "item_id" "uuid", "name" "text",
        "image_url" "text", "image_is_generated" boolean,
        "photo_url" "text", "made_on" "date", "note" "text"
    )
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT m.id, m.item_id, i.name, img.url, img.is_generated, photo.url,
         CASE WHEN p.shows_dates THEN m.made_on END,
         m.note
  FROM public.profiles p
  JOIN public.made_drinks m ON m.user_id = p.user_id AND m.on_profile
  JOIN public.items i ON i.id = m.item_id
  LEFT JOIN public.images photo ON photo.id = m.image_id
  LEFT JOIN LATERAL (
    SELECT im.url, ii.is_generated
    FROM public.item_images ii JOIN public.images im ON im.id = ii.image_id
    WHERE ii.item_id = i.id AND ii.angle = 'hero'
    ORDER BY ii.is_generated, ii.sort_order NULLS LAST, ii.created_at
    LIMIT 1
  ) img ON true
  WHERE p.id = p_profile_id AND p.kind = 'person'
    AND public.is_made_log_shown(m.id)
  ORDER BY m.made_on DESC, m.created_at DESC
  LIMIT 200;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_profile_made"("uuid") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_profile_made"("uuid") TO "anon", "authenticated", "service_role";
