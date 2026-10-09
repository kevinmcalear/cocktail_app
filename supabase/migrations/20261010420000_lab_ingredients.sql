-- Six lab ingredients the technique library uses but the shared catalog
-- didn't have, so nobody could put them on My Bar's lab shelf or a recipe
-- line: gellan, sodium alginate, calcium lactate, Versawhip, tapioca
-- maltodextrin and sodium citrate. Each line is the technique library's own
-- (lib/techniques/ingredients.ts). One is only added when no shared
-- ingredient already goes by any of its names, so running it on a catalog
-- that has some of them adds the rest. Plain ingredients, not a kind of
-- anything; no paid flavour jobs.

SET "app.image_worker" = 'on';
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

INSERT INTO "public"."items" ("name", "item_type", "ingredient_role", "description", "hide_from_search")
SELECT l.name, 'ingredient', 'generic', l.what, false
FROM (VALUES
    ('Gellan Gum', 'Makes fluid gels that hold garnishes mid-glass, and firm, clear gels.', ARRAY['gellan', 'gellan gum', 'low acyl gellan', 'high acyl gellan', 'gellan f']),
    ('Sodium Alginate', 'Forms a skin with calcium: spheres and caviar.', ARRAY['sodium alginate', 'alginate']),
    ('Calcium Lactate', 'The calcium that sets alginate.', ARRAY['calcium lactate', 'calcium chloride', 'calcium lactate gluconate']),
    ('Versawhip', 'A soy protein foamer, about twice as airy as egg white and very acid tolerant.', ARRAY['versawhip', 'versawhip 600k']),
    ('Tapioca Maltodextrin', 'Turns fats into powders.', ARRAY['tapioca maltodextrin', 'n-zorbit', 'maltodextrin']),
    ('Sodium Citrate', 'Tames calcium and acidity so gels and spheres set.', ARRAY['sodium citrate', 'trisodium citrate'])
) AS l(name, what, names)
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i
     WHERE i."item_type" = 'ingredient' AND i."bar_id" IS NULL
       AND "public"."ingredient_key"(i."name") IN (SELECT "public"."ingredient_key"(n) FROM unnest(l.names) AS n)
);

-- No paid flavour jobs for these (see 20261008900100).
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
DROP TABLE "flavor_jobs_before";
RESET "app.image_worker";
