-- The staff link's settings on the bar (Kept-team, Invite): whether the link
-- is on, the role new people join as, and whether someone approves each one.
-- The existing bars_update policy decides who may change them (Admins and the
-- brand capability), as for the bar's other settings.
--
-- The link itself carries a secret: bar_staff_links.token, one per bar, 144
-- random bits, URL-safe. The link is the bar's page with the token
-- (/v/<slug>?join=<token>), and only the token lets someone ask or join
-- through it. Only the bar's Admins read the token (RLS), and New link
-- (new_staff_link) replaces it, so the old link stops working. Every bar has
-- one: the existing bars get theirs here, a new bar gets one when it's made.

ALTER TABLE "public"."bars"
    ADD COLUMN "staff_link_on" boolean DEFAULT true NOT NULL,
    ADD COLUMN "staff_link_role" integer DEFAULT 30 NOT NULL,
    ADD COLUMN "staff_link_approve" boolean DEFAULT true NOT NULL,
    ADD CONSTRAINT "bars_staff_link_role_check" CHECK ("staff_link_role" IN (10, 20, 30, 35));

-- --- The secret ---

CREATE FUNCTION "private"."new_staff_link_token"() RETURNS text
    LANGUAGE sql VOLATILE
    SET "search_path" TO ''
    AS $$
  SELECT translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

REVOKE ALL ON FUNCTION "private"."new_staff_link_token"() FROM PUBLIC, "anon", "authenticated";

CREATE TABLE "public"."bar_staff_links" (
    "bar_id" uuid NOT NULL PRIMARY KEY REFERENCES "public"."bars"("id") ON DELETE CASCADE,
    "token" text DEFAULT private.new_staff_link_token() NOT NULL,
    "made_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "bar_staff_links_token_key" UNIQUE ("token")
);

ALTER TABLE "public"."bar_staff_links" ENABLE ROW LEVEL SECURITY;

-- The bar's Admins only. Nobody writes rows directly: new_staff_link replaces
-- the token, the trigger below adds a new bar's.
CREATE POLICY "bar_staff_links_select" ON "public"."bar_staff_links" FOR SELECT TO "authenticated"
    USING ("bar_id" IN (SELECT private.my_bar_ids(40)));

REVOKE ALL ON TABLE "public"."bar_staff_links" FROM "anon", "public";
REVOKE ALL ON TABLE "public"."bar_staff_links" FROM "authenticated";
GRANT SELECT ON TABLE "public"."bar_staff_links" TO "authenticated";
GRANT ALL ON TABLE "public"."bar_staff_links" TO "service_role";

INSERT INTO "public"."bar_staff_links" ("bar_id") SELECT "id" FROM "public"."bars";

CREATE FUNCTION "private"."add_staff_link"() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    INSERT INTO public.bar_staff_links (bar_id) VALUES (NEW.id) ON CONFLICT (bar_id) DO NOTHING;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION "private"."add_staff_link"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "bars_add_staff_link"
    AFTER INSERT ON "public"."bars"
    FOR EACH ROW
    EXECUTE FUNCTION "private"."add_staff_link"();

-- New link: a fresh token for the bar, so the old link stops working. Admins
-- only. Returns the new token.
CREATE FUNCTION "public"."new_staff_link"("p_bar_id" uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_token text;
BEGIN
    IF p_bar_id IS NULL OR p_bar_id NOT IN (SELECT private.my_bar_ids(40)) THEN
        RAISE EXCEPTION 'Only an Admin can make a new staff link.' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.bar_staff_links (bar_id) VALUES (p_bar_id)
    ON CONFLICT (bar_id) DO UPDATE SET token = private.new_staff_link_token(), made_at = now()
    RETURNING token INTO v_token;
    RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION "public"."new_staff_link"(uuid) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."new_staff_link"(uuid) TO "authenticated", "service_role";
