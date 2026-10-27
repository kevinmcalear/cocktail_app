-- A later part of a drink made in parts can be made fresh for each serve
-- (approved by Kevin 27 Oct 2026, board made-parts-making, "Batch, every
-- part made ahead").
--
-- The batch sheet makes every part ahead by default: part 1 in the bottle,
-- each later part in its own container. A part the bar would rather make for
-- each serve (cream whipped to order) says so in items.parts:
--   [{"name": "The coffee"}, {"name": "The cream", "join": "float", "fresh": true}]
--
-- private.drink_parts_ok (the items_parts_ok check, from
-- 20261123100000_drink_parts.sql) now allows "fresh", a boolean, beside
-- "name" and "join". Every other rule is as it was. The app reads "fresh"
-- on a later part only (part 1 is always the bottle), so it is allowed on
-- any part: moving a part up in the drink editor never makes a save fail.
--
-- Nothing else changes: save_drink_spec stores p_parts as given, versions
-- keep items.parts whole, and published_items.parts copies it. Existing
-- rows have no "fresh" and read as made ahead.

CREATE OR REPLACE FUNCTION "private"."drink_parts_ok"("p_parts" "jsonb") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT p_parts IS NULL OR (
    jsonb_typeof(p_parts) = 'array'
    AND jsonb_array_length(p_parts) BETWEEN 2 AND 9
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_parts) WITH ORDINALITY AS e(part, n)
       WHERE jsonb_typeof(e.part) <> 'object'
          OR jsonb_typeof(e.part -> 'name') IS DISTINCT FROM 'string'
          OR length(btrim(e.part ->> 'name')) NOT BETWEEN 1 AND 60
          OR (e.part ? 'join' AND jsonb_typeof(e.part -> 'join') <> 'null' AND (e.n = 1 OR (e.part ->> 'join') NOT IN ('float', 'pour')))
          OR (e.part ? 'fresh' AND jsonb_typeof(e.part -> 'fresh') <> 'boolean')
          OR EXISTS (SELECT 1 FROM jsonb_object_keys(e.part) k WHERE k NOT IN ('name', 'join', 'fresh'))));
$$;
