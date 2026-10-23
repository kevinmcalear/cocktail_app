-- A guest bar's drinks on a run sheet are theirs (23 Oct 2026, Kevin; board
-- "Their drinks are theirs" on the whole-app canvas
-- https://claude.ai/artifact/KRE17t8L8SC8f4M4KFLgZe, run sheet screens 7 to 10).
--
-- Until now the run sheet guessed which drinks were the guest bar's from the
-- drink's credit, which only worked when the guest was linked to a bar page.
-- When we went to a bar that isn't on Cocktail, the drinks its own team
-- brings counted as ours.
--
--   menu_drinks.party_id   this drink is the guest bar's own, on this menu:
--                          they make it and its house preps start with them.
--                          NULL: ours. Only the menu's guest can be named.
--                          It's the one place the run sheet keeps whose drink
--                          it is (filled below from the old guess).
--
-- Credit follows it. While the guest is just a typed name, the credit stays
-- on that name (the party). Once the guest is linked to a bar page, each of
-- its drinks that is our own library copy is credited to that page
-- (items.origin_bar_profile_id, 'suggested' until the bar confirms it), when
-- it has no origin yet and the editor can edit the venue's drinks. Taking the
-- mark off, unlinking the page or taking the guest off the sheet removes a
-- suggested credit it gave, unless another menu still names that bar for the
-- drink. A verified or claimed credit is never touched, and no bar page is
-- ever made here: the app links an existing page or uses add_venue.
--
-- Linking a guest to a page (or adding a drink to a menu whose guest is
-- linked) marks the drinks already credited to that page, or made by that
-- bar's own venue, as theirs: the old guess, now as a default.
--
-- Access is unchanged: the column rides on menu_drinks' row policies (read
-- with the menu, written by whoever can edit it).

ALTER TABLE "public"."menu_drinks"
    ADD COLUMN "party_id" "uuid",
    ADD CONSTRAINT "menu_drinks_party_fkey" FOREIGN KEY ("party_id", "menu_id")
        REFERENCES "public"."menu_run_parties"("id", "menu_id") ON DELETE SET NULL ("party_id");

CREATE INDEX "menu_drinks_party_idx" ON "public"."menu_drinks" ("party_id") WHERE "party_id" IS NOT NULL;

COMMENT ON COLUMN "public"."menu_drinks"."party_id" IS
    'The run sheet''s guest bar, when this drink is theirs: they make it. NULL: the menu''s own bar. Only the menu''s guest.';

-- The old guess, kept: a linked guest's drinks are the ones credited to its
-- page or made at its own venue.
UPDATE "public"."menu_drinks" "md"
SET "party_id" = "p"."id"
FROM "public"."menu_run_parties" "p"
JOIN "public"."profiles" "pr" ON "pr"."id" = "p"."profile_id"
JOIN "public"."items" "i" ON true
WHERE "p"."menu_id" = "md"."menu_id"
  AND "p"."kind" = 'guest'
  AND "i"."id" = "md"."item_id"
  AND ("i"."origin_bar_profile_id" = "pr"."id" OR ("pr"."bar_id" IS NOT NULL AND "i"."bar_id" = "pr"."bar_id"));

-- ---------------------------------------------------------------------------
-- Credit on our own copy of a guest's drink
-- ---------------------------------------------------------------------------

-- Moves a run sheet's credit on one drink from one bar page to another
-- (either may be NULL). Only the menu's own bar's library copy, only for
-- someone who may edit that bar's drinks (or the service role), and only a
-- credit nobody has verified or claimed. A credit is taken off only when no
-- other run sheet (p_except_party aside) still names that page for the drink.
CREATE FUNCTION "private"."move_run_drink_credit"("p_item_id" "uuid", "p_menu_id" "uuid", "p_from" "uuid", "p_to" "uuid", "p_except_party" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_bar uuid;
BEGIN
    IF p_item_id IS NULL OR p_from IS NOT DISTINCT FROM p_to THEN
        RETURN;
    END IF;
    SELECT i.bar_id INTO v_bar
    FROM public.items i JOIN public.menus m ON m.bar_id = i.bar_id
    WHERE i.id = p_item_id AND m.id = p_menu_id;
    IF v_bar IS NULL THEN
        RETURN;
    END IF;
    IF auth.uid() IS NOT NULL AND v_bar NOT IN (SELECT private.bars_with_capability('edit_drinks')) THEN
        RETURN;
    END IF;

    IF p_from IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.menu_drinks md JOIN public.menu_run_parties p ON p.id = md.party_id
        WHERE md.item_id = p_item_id AND p.profile_id = p_from AND p.id IS DISTINCT FROM p_except_party
    ) THEN
        UPDATE public.items SET origin_bar_profile_id = NULL
        WHERE id = p_item_id AND origin_bar_profile_id = p_from AND credit_status = 'suggested';
    END IF;
    IF p_to IS NOT NULL THEN
        UPDATE public.items SET origin_bar_profile_id = p_to
        WHERE id = p_item_id AND origin_bar_profile_id IS NULL AND (credit_status IS NULL OR credit_status = 'suggested');
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION "private"."move_run_drink_credit"("uuid", "uuid", "uuid", "uuid", "uuid") FROM PUBLIC, "anon", "authenticated";

-- Only the menu's guest can be named, and a drink added to a menu whose guest
-- is linked starts as theirs when it's credited to their page or made at
-- their venue.
CREATE FUNCTION "private"."guard_menu_drink_party"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.party_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.menu_run_parties p WHERE p.id = NEW.party_id AND p.kind = 'guest'
    ) THEN
        RAISE EXCEPTION 'Only the guest bar''s own drinks can be theirs.' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.party_id IS NULL THEN
        SELECT p.id INTO NEW.party_id
        FROM public.menu_run_parties p
        JOIN public.profiles pr ON pr.id = p.profile_id
        JOIN public.items i ON i.id = NEW.item_id
        WHERE p.menu_id = NEW.menu_id AND p.kind = 'guest'
          AND (i.origin_bar_profile_id = pr.id OR (pr.bar_id IS NOT NULL AND i.bar_id = pr.bar_id));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_menu_drink_party" BEFORE INSERT OR UPDATE OF "party_id" ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_menu_drink_party"();

-- Marking a drink theirs (or not) moves its credit.
CREATE FUNCTION "private"."menu_drink_party_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_from uuid;
    v_to uuid;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT profile_id INTO v_from FROM public.menu_run_parties WHERE id = OLD.party_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT profile_id INTO v_to FROM public.menu_run_parties WHERE id = NEW.party_id;
    END IF;
    PERFORM private.move_run_drink_credit(COALESCE(NEW.item_id, OLD.item_id), COALESCE(NEW.menu_id, OLD.menu_id), v_from, v_to, NULL);
    RETURN NULL;
END;
$$;

CREATE TRIGGER "menu_drink_party_credit" AFTER INSERT OR DELETE OR UPDATE OF "party_id" ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."menu_drink_party_credit"();

-- Linking, relinking or unlinking the guest's page moves the credit on its
-- drinks, then marks the menu's drinks credited to the new page as theirs.
CREATE FUNCTION "private"."menu_run_party_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_item uuid;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.kind <> 'guest' AND EXISTS (SELECT 1 FROM public.menu_drinks WHERE party_id = NEW.id) THEN
        RAISE EXCEPTION 'Only the guest bar''s own drinks can be theirs.' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        FOR v_item IN SELECT item_id FROM public.menu_drinks WHERE party_id = NEW.id LOOP
            PERFORM private.move_run_drink_credit(v_item, NEW.menu_id, OLD.profile_id, NEW.profile_id, NULL);
        END LOOP;
    END IF;
    IF NEW.kind = 'guest' AND NEW.profile_id IS NOT NULL THEN
        UPDATE public.menu_drinks md SET party_id = NEW.id
        FROM public.items i, public.profiles pr
        WHERE md.menu_id = NEW.menu_id AND md.party_id IS NULL
          AND i.id = md.item_id AND pr.id = NEW.profile_id
          AND (i.origin_bar_profile_id = pr.id OR (pr.bar_id IS NOT NULL AND i.bar_id = pr.bar_id));
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "menu_run_party_credit" AFTER INSERT OR UPDATE OF "profile_id", "kind" ON "public"."menu_run_parties"
    FOR EACH ROW EXECUTE FUNCTION "private"."menu_run_party_credit"();

-- Taking the guest off the sheet takes their marks off (the foreign key
-- clears party_id after the row is gone, too late to know its page).
CREATE FUNCTION "private"."menu_run_party_uncredit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_item uuid;
BEGIN
    IF OLD.profile_id IS NOT NULL THEN
        FOR v_item IN SELECT item_id FROM public.menu_drinks WHERE party_id = OLD.id LOOP
            PERFORM private.move_run_drink_credit(v_item, OLD.menu_id, OLD.profile_id, NULL, OLD.id);
        END LOOP;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER "menu_run_party_uncredit" BEFORE DELETE ON "public"."menu_run_parties"
    FOR EACH ROW EXECUTE FUNCTION "private"."menu_run_party_uncredit"();

REVOKE EXECUTE ON FUNCTION "private"."guard_menu_drink_party"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."menu_drink_party_credit"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."menu_run_party_credit"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."menu_run_party_uncredit"() FROM PUBLIC, "anon", "authenticated";
