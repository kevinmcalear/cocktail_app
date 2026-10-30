-- A drink can credit the people who made it by name when they have no page.
--
-- items.creator_names: the makers typed as plain names ("Harry Craddock"),
-- for people who don't use the app and have no profile, classics above all
-- (Eddie, tf-063). Shown in the drink's credit after the makers with a page
-- (creator_profile_id, item_co_creators), with no link and no claim. A
-- person with a page is credited through it, never by name too: the app
-- only saves names nobody picked from the search.
--
-- Up to five names, each 1 to 80 characters. Null when there are none. The
-- items RLS policies cover the column like every other: whoever can write
-- the drink can write its names, and whoever can read the drink can read them.
ALTER TABLE public.items ADD COLUMN creator_names text[];

-- Each name trimmed, 1 to 80 characters (a CHECK can't hold a subquery).
CREATE FUNCTION private.names_fit(p_names text[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
  SELECT coalesce(bool_and(n = btrim(n) AND char_length(n) BETWEEN 1 AND 80), true)
    FROM unnest(p_names) n;
$$;
REVOKE EXECUTE ON FUNCTION private.names_fit(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.names_fit(text[]) TO authenticated, service_role;

ALTER TABLE public.items ADD CONSTRAINT items_creator_names_check CHECK (
  creator_names IS NULL
  OR (cardinality(creator_names) BETWEEN 1 AND 5
      AND array_position(creator_names, NULL) IS NULL
      AND private.names_fit(creator_names))
);
