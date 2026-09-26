-- DRAFT (schema proposal, docs/schema_proposal.md section 5). Local stack only.
--
-- Events: a takeover, pop-up or private event at a bar, with dates, its own
-- menu, a guest venue credited on it, and a guest staff role that expires.
--
-- The event menu is an ordinary menus row (menu_drinks, cover, policies and
-- editors all unchanged). Guest drinks are copied into the host bar with their
-- creator and origin bar credited (items.creator_profile_id and
-- origin_bar_profile_id), since a bar's drinks are only visible to its own
-- members. The guest venue's staff get a venue role at the host bar that ends
-- when the event does.

CREATE TABLE "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "bar_id" "uuid" NOT NULL REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    -- "Pale Moth × Little Rye"
    "name" "text" NOT NULL CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
    "starts_at" timestamp with time zone NOT NULL,
    -- NULL: "7 pm to late".
    "ends_at" timestamp with time zone,
    "menu_id" "uuid" REFERENCES "public"."menus"("id") ON DELETE SET NULL,
    -- The guest venue, credited on the menu. A bar profile, so it can be a
    -- venue that isn't on the platform yet.
    "guest_profile_id" "uuid" REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
    -- The role the guest staff hold at this bar; its ends_at ends their access.
    "guest_role_id" "uuid",
    "covers_estimate" integer CHECK ("covers_estimate" >= 0),
    "notes" "text" CHECK (char_length("notes") <= 2000),
    "created_by" "uuid" DEFAULT "auth"."uid"() REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    FOREIGN KEY ("guest_role_id", "bar_id") REFERENCES "public"."venue_roles"("id", "bar_id") ON DELETE SET NULL ("guest_role_id"),
    CONSTRAINT "events_dates_check" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);

CREATE INDEX "events_bar_id_starts_at_idx" ON "public"."events" ("bar_id", "starts_at");
CREATE INDEX "events_guest_profile_id_idx" ON "public"."events" ("guest_profile_id");
CREATE INDEX "events_menu_id_idx" ON "public"."events" ("menu_id");

ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;

-- The host bar's members see its events; so do the guest venue's members, who
-- see the event itself but not the host's menu or drinks until they're given
-- the guest role.
CREATE POLICY "events_select" ON "public"."events" FOR SELECT TO "authenticated"
    USING (
        "bar_id" IN (SELECT "private"."my_bar_ids"(0))
        OR "guest_profile_id" IN (
            SELECT "p"."id" FROM "public"."profiles" "p" WHERE "p"."bar_id" IN (SELECT "private"."my_bar_ids"(0))
        )
    );

-- Built by members who build menus. The menu must be the host bar's, and the
-- guest a bar profile the builder can see.
CREATE POLICY "events_write" ON "public"."events" FOR ALL TO "authenticated"
    USING ("bar_id" IN (SELECT "private"."bars_with_capability"('menus')))
    WITH CHECK (
        "bar_id" IN (SELECT "private"."bars_with_capability"('menus'))
        AND ("menu_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."menus" "m" WHERE "m"."id" = "menu_id" AND "m"."bar_id" = "events"."bar_id"
        ))
        AND ("guest_profile_id" IS NULL OR EXISTS (
            SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "guest_profile_id" AND "p"."kind" = 'bar'
        ))
    );
