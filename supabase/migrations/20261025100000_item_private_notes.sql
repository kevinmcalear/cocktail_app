-- DRAFT. Local stack only until Kevin's OK.
--
-- Notes only you read (Eddie, 7 Oct jam: "personal notes, shared notes").
-- A drink's notes (items.notes) go wherever the drink goes: its venue's team,
-- or anyone it's published to. A personal note is its writer's alone.
--
--   item_private_notes  one note per person per drink, read and written by
--                       that person only. Never public, never shared with a
--                       venue, never in published_items. Goes with the
--                       account (auth.users cascade) and with the drink.
--
-- The add-drink wizard's "Just me" writes it; the drink page shows it to its
-- writer, who can change or remove it there.

CREATE TABLE "public"."item_private_notes" (
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "body" "text" NOT NULL CHECK (char_length(btrim("body")) BETWEEN 1 AND 2000),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("user_id", "item_id")
);
CREATE INDEX "item_private_notes_item_id_idx" ON "public"."item_private_notes" ("item_id");

ALTER TABLE "public"."item_private_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_private_notes_select_own" ON "public"."item_private_notes" FOR SELECT TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));
-- Only on a drink you can read (items RLS decides).
CREATE POLICY "item_private_notes_insert_own" ON "public"."item_private_notes" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = (SELECT "auth"."uid"())
        AND EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id")
    );
CREATE POLICY "item_private_notes_update_own" ON "public"."item_private_notes" FOR UPDATE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()))
    WITH CHECK ("user_id" = (SELECT "auth"."uid"()));
CREATE POLICY "item_private_notes_delete_own" ON "public"."item_private_notes" FOR DELETE TO "authenticated"
    USING ("user_id" = (SELECT "auth"."uid"()));

REVOKE ALL ON "public"."item_private_notes" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT, INSERT, DELETE ON "public"."item_private_notes" TO "authenticated";
-- The text and when, nothing else: a note can't move to another person or drink.
GRANT UPDATE ("body", "updated_at") ON "public"."item_private_notes" TO "authenticated";
GRANT ALL ON "public"."item_private_notes" TO "service_role";
