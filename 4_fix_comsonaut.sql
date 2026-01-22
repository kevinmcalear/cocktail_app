-- Fix for Comsonaut
-- This script contains the full definition for the Comsonaut cocktail and its recipes.

INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Comsonaut', 'look at seasonal jams', 'Classic', '', '60ml Gin
25ml lemon
bar spoon rasp jam', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sour'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;

DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Comsonaut');

INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Comsonaut'),
    (SELECT id FROM ingredients WHERE name = 'Gin'),
    60.0, NULL, NULL
);

INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Comsonaut'),
    (SELECT id FROM ingredients WHERE name = 'lemon'),
    25.0, NULL, NULL
);

INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Comsonaut'),
    (SELECT id FROM ingredients WHERE name = 'bar spoon rasp jam'),
    NULL, NULL, NULL
);
