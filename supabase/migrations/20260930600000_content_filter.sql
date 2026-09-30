-- DRAFT (step 11a, content filtering). Local stack only.
-- Not applied to production; needs Kevin's review first.
--
-- App Store guideline 1.2 asks for "a method for filtering objectionable
-- material" next to reporting and blocking (20260930500000 to 20260930500500).
-- This refuses a short list of slurs and clear abuse in text other people can
-- see, at the database, so every client is covered:
--
--   profiles            display_name, handle, bio (always: a profile can go
--                       public at any time, and names show in rankings,
--                       credits and reports)
--   profile_positions   title ("Bar director")
--   items               name, description, origin, while the drink's
--                       effective publish mode isn't 'private'. Opening a
--                       drink up by other means (a published menu it's on,
--                       its bar's default) checks the drinks it opens.
--   releases            name, description, once published or scheduled
--
-- Not filtered: private text (a bar's unpublished drinks, home menus, notes on
-- collected drinks, report details, claim messages), menu names (no public
-- path shows them yet), and rows written before this migration.
--
-- The refusal is a plain P0001 message the app shows under the field, with
-- the column name in DETAIL for clients that want to place it.
--
-- Matching, in private.screen_text():
--   lower case, accents and zero-width characters dropped, a few look-alike
--   Cyrillic letters and common leetspeak (0 1 3 4 5 7 9 @ $, and ! or |
--   before a letter) read as letters, everything else a space, and runs of
--   single letters joined ("n i g" and "n.i.g" read as "nig"). Each listed
--   word becomes a pattern where every letter may repeat ("gg" matches "gg"
--   and "ggggg" but not "g", so "Niger" isn't "n*gger"), and an l may be an i
--   (1 and ! read as i).
--
--   'word'      refused as a whole word or phrase, plus a plural s or es
--               (and a leading "a" or "i" that got joined to spelled-out
--               letters).
--               Most words: whole words only keeps "therapist", "Scunthorpe"
--               and "retardant" safe.
--   'anywhere'  refused inside other words too, because handles have no
--               spaces ("bigxxxxx"). Only words that don't sit inside
--               ordinary words.
--   'allow'     ordinary words that contain an 'anywhere' word ("snigger");
--               a word starting with one is skipped for the 'anywhere' check.
--
-- Ordinary drinking words aren't listed and must stay allowed: shot, screw,
-- bloody, cock (cocktail, Cock 'n' Bull), sex on the beach, slippery nipple,
-- zombie, corpse reviver, suffering bastard, dick (the name). The security
-- test (supabase/tests/content-filter.test.mjs) holds a list of those.
--
-- ponytail: a word list is easy to get around (misspellings, other scripts,
-- words split by spaces) and says nothing about meaning. Reports and the
-- moderator inbox catch the rest. The list is a table so a moderator can add
-- a word with one INSERT, no migration; a classifier (an edge function on
-- publish) is the upgrade if lists stop being enough.

-- --- The list ---

-- Each letter run becomes "letter, repeated at least as often": "nigger" ->
-- n+i+g{2,}e+r+. An l also matches i. A space in a phrase is optional, since
-- spaced-out letters are joined ("k i l l y o u r s e l f").
CREATE FUNCTION "private"."screen_pattern"("p_word" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
  SELECT string_agg(
    CASE
      WHEN m.r[1] = ' ' THEN ' ?'
      ELSE CASE WHEN m.r[2] = 'l' THEN '[li]' ELSE m.r[2] END
        || CASE WHEN length(m.r[1]) = 1 THEN '+' ELSE '{' || length(m.r[1]) || ',}' END
    END, '' ORDER BY m.n)
  FROM regexp_matches(p_word, '(([a-z])\2*| )', 'g') WITH ORDINALITY AS m(r, n);
$$;

CREATE TABLE "private"."screened_words" (
    "word" "text" PRIMARY KEY CHECK ("word" ~ '^[a-z]+( [a-z]+)*$'),
    "kind" "text" NOT NULL CHECK ("kind" IN ('word', 'anywhere', 'allow')),
    "pattern" "text" GENERATED ALWAYS AS ("private"."screen_pattern"("word")) STORED
);

-- Slurs and clear abuse only. Keep it short and certain: a false positive
-- blocks a real bar's real drink.
INSERT INTO "private"."screened_words" ("word", "kind") VALUES
    -- Racial and ethnic slurs.
    ('nigger', 'anywhere'),
    ('nigga', 'anywhere'),
    ('wetback', 'anywhere'),
    ('raghead', 'anywhere'),
    ('towelhead', 'anywhere'),
    ('kike', 'word'),
    ('gook', 'word'),
    ('beaner', 'word'),
    ('paki', 'word'),
    -- Homophobic and transphobic slurs.
    ('faggot', 'anywhere'),
    ('tranny', 'anywhere'),
    ('shemale', 'anywhere'),
    -- Ableist slurs.
    ('retard', 'word'),
    ('retarded', 'word'),
    -- Misogynist abuse.
    ('cunt', 'word'),
    -- Abuse and hate.
    ('rapist', 'word'),
    ('pedophile', 'word'),
    ('paedophile', 'word'),
    ('kill yourself', 'word'),
    ('kill urself', 'word'),
    ('heil hitler', 'word'),
    ('sieg heil', 'word'),
    -- Ordinary words that contain an 'anywhere' word.
    ('snigger', 'allow'),
    ('niggard', 'allow');

ALTER TABLE "private"."screened_words" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "private"."screened_words" FROM PUBLIC, "anon", "authenticated";

-- --- Matching ---

-- Text as the patterns see it: " n i g g e r " -> " nigger ", padded with a
-- space each side so whole words can be matched with spaces.
CREATE FUNCTION "private"."screen_normalize"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO ''
    AS $$
  SELECT ' ' || btrim(
    regexp_replace(
      regexp_replace(
        translate(
          regexp_replace(
            translate(
              regexp_replace(
                regexp_replace(lower(normalize(p_text, NFKD)), '[̀-ͯ­​-‍⁠﻿]', '', 'g'),
                '[!|](?=[a-z])', 'i', 'g'),
              'аеорсхуіј', 'aeopcxyij'),
            '[^a-z0-9@$]+', ' ', 'g'),
          '0134579@$', 'oieastgas'),
        '[^a-z]+', ' ', 'g'),
      '\m([a-z]) (?=[a-z]\M)', '\1', 'g')
  ) || ' ';
$$;

-- The listed word the text contains, or NULL.
CREATE FUNCTION "private"."screen_text"("p_text" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  WITH "t" AS (
    SELECT private.screen_normalize(p_text) AS s
  ), "allowed" AS (
    -- The text with every word that starts with an allowed word blanked out.
    SELECT COALESCE(
      regexp_replace(t.s, ' (' || (SELECT string_agg(w.pattern, '|') FROM private.screened_words w WHERE w.kind = 'allow') || ')[a-z]*(?= )', ' ', 'g'),
      t.s) AS s
    FROM t
  )
  SELECT w.word
  FROM private.screened_words w, t, allowed a
  -- A leading a or i: "a c.u.n.t" joins to "acunt".
  WHERE (w.kind = 'word' AND t.s ~ (' [ai]?' || w.pattern || '(e?s)? '))
     OR (w.kind = 'anywhere' AND a.s ~ w.pattern)
  LIMIT 1;
$$;

-- Raises the message the app shows under the field.
CREATE FUNCTION "private"."refuse_screened"("p_text" "text", "p_field" "text", "p_column" "text") RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    IF p_text IS NOT NULL AND private.screen_text(p_text) IS NOT NULL THEN
        RAISE EXCEPTION 'That % has a word we don''t allow. Please change it.', p_field
            USING DETAIL = p_column;
    END IF;
END;
$$;

-- --- Profiles and positions ---

CREATE FUNCTION "private"."screen_profile_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
        PERFORM private.refuse_screened(NEW.display_name, 'name', 'display_name');
    END IF;
    IF TG_OP = 'INSERT' OR NEW.handle IS DISTINCT FROM OLD.handle THEN
        PERFORM private.refuse_screened(NEW.handle, 'handle', 'handle');
    END IF;
    IF TG_OP = 'INSERT' OR NEW.bio IS DISTINCT FROM OLD.bio THEN
        PERFORM private.refuse_screened(NEW.bio, 'bio', 'bio');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "display_name", "handle", "bio" ON "public"."profiles"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_profile_text"();

CREATE FUNCTION "private"."screen_position_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.title IS DISTINCT FROM OLD.title THEN
        PERFORM private.refuse_screened(NEW.title, 'title', 'title');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "title" ON "public"."profile_positions"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_position_text"();

-- --- Drinks ---

-- A drink's own text, whenever its effective mode (the rule in
-- private.effective_publish_mode, on the new row) isn't private. Only the
-- text that changes, unless the drink is only now going public.
CREATE FUNCTION "private"."screen_item_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_mode public.item_publish_mode;
    v_all boolean;
BEGIN
    v_mode := COALESCE(
        NEW.publish_mode,
        (SELECT max(m.publish_mode)
           FROM public.menu_drinks md JOIN public.menus m ON m.id = md.menu_id
          WHERE md.item_id = NEW.id AND m.bar_id = NEW.bar_id AND m.publish_mode IS NOT NULL),
        (SELECT b.default_publish_mode FROM public.bars b WHERE b.id = NEW.bar_id),
        'private');
    IF v_mode = 'private' THEN
        RETURN NEW;
    END IF;
    -- The table still holds the old row here.
    v_all := TG_OP = 'INSERT' OR private.effective_publish_mode(OLD.id) = 'private';

    IF v_all OR NEW.name IS DISTINCT FROM OLD.name THEN
        PERFORM private.refuse_screened(NEW.name, 'name', 'name');
    END IF;
    IF v_all OR NEW.description IS DISTINCT FROM OLD.description THEN
        PERFORM private.refuse_screened(NEW.description, 'description', 'description');
    END IF;
    IF v_all OR NEW.origin IS DISTINCT FROM OLD.origin THEN
        PERFORM private.refuse_screened(NEW.origin, 'origin', 'origin');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "name", "description", "origin", "publish_mode", "bar_id" ON "public"."items"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_item_text"();

-- Drinks that a menu or a bar's default is about to open up: the first one
-- whose text has a listed word stops the change, by name.
CREATE FUNCTION "private"."refuse_screened_items"("p_item_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_name text;
    v_field text;
BEGIN
    SELECT i.name,
           CASE WHEN private.screen_text(i.name) IS NOT NULL THEN 'name'
                WHEN private.screen_text(i.description) IS NOT NULL THEN 'description'
                ELSE 'origin' END
      INTO v_name, v_field
      FROM public.items i
     WHERE i.id = ANY (p_item_ids)
       AND private.screen_text(concat_ws(E'\n', i.name, i.description, i.origin)) IS NOT NULL
     LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'The drink "%" has a word we don''t allow in its %. Change it before publishing.', v_name, v_field
            USING DETAIL = v_field;
    END IF;
END;
$$;

-- A bar menu that publishes opens every drink on it that inherits.
CREATE FUNCTION "private"."screen_menu_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.bar_id IS NULL OR COALESCE(NEW.publish_mode, 'private') = 'private'
       OR (TG_OP = 'UPDATE' AND COALESCE(OLD.publish_mode, 'private') <> 'private' AND NEW.bar_id = OLD.bar_id) THEN
        RETURN NEW;
    END IF;
    PERFORM private.refuse_screened_items(ARRAY(
        SELECT i.id FROM public.menu_drinks md JOIN public.items i ON i.id = md.item_id
         WHERE md.menu_id = NEW.id AND i.bar_id = NEW.bar_id AND i.publish_mode IS NULL));
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_publish" BEFORE INSERT OR UPDATE OF "publish_mode", "bar_id" ON "public"."menus"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_menu_publish"();

-- A drink put on a published menu opens with it.
CREATE FUNCTION "private"."screen_menu_drink"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.menus m JOIN public.items i ON i.id = NEW.item_id
         WHERE m.id = NEW.menu_id AND m.bar_id = i.bar_id
           AND COALESCE(m.publish_mode, 'private') <> 'private' AND i.publish_mode IS NULL
    ) THEN
        PERFORM private.refuse_screened_items(ARRAY[NEW.item_id]);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_publish" BEFORE INSERT OR UPDATE OF "menu_id", "item_id" ON "public"."menu_drinks"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_menu_drink"();

-- A bar that opens by default opens every drink of its that inherits.
CREATE FUNCTION "private"."screen_bar_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.default_publish_mode <> 'private' AND OLD.default_publish_mode = 'private' THEN
        PERFORM private.refuse_screened_items(ARRAY(
            SELECT i.id FROM public.items i WHERE i.bar_id = NEW.id AND i.publish_mode IS NULL));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_publish" BEFORE UPDATE OF "default_publish_mode" ON "public"."bars"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_bar_publish"();

-- --- Releases ---

CREATE FUNCTION "private"."screen_release_text"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_all boolean;
BEGIN
    IF NEW.published_at IS NULL THEN
        RETURN NEW;
    END IF;
    v_all := TG_OP = 'INSERT' OR OLD.published_at IS NULL;
    IF v_all OR NEW.name IS DISTINCT FROM OLD.name THEN
        PERFORM private.refuse_screened(NEW.name, 'name', 'name');
    END IF;
    IF v_all OR NEW.description IS DISTINCT FROM OLD.description THEN
        PERFORM private.refuse_screened(NEW.description, 'description', 'description');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "screen_text" BEFORE INSERT OR UPDATE OF "name", "description", "published_at" ON "public"."releases"
    FOR EACH ROW EXECUTE FUNCTION "private"."screen_release_text"();

-- --- Grants ---

REVOKE EXECUTE ON FUNCTION "private"."screen_pattern"("text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_normalize"("text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_text"("text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."refuse_screened"("text", "text", "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."refuse_screened_items"("uuid"[]) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_profile_text"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_position_text"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_item_text"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_menu_publish"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_menu_drink"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_bar_publish"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "private"."screen_release_text"() FROM PUBLIC, "anon", "authenticated";
