INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Martinez (diffords)'),
    (SELECT id FROM ingredients WHERE name = 'Dry Curacao'),
    NULL, NULL, 7.5
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Martinez (diffords)'),
    (SELECT id FROM ingredients WHERE name = 'dash Ango'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Rome with a view', '', 'Modern Classic', 'orange slice', '30ml Campari
30ml Dolin
30ml lime
20ml sugar
top soda', (SELECT id FROM methods WHERE name = 'shake and top'), (SELECT id FROM glassware WHERE name = 'Highball'), (SELECT id FROM families WHERE name = 'Aromatic'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Rome with a view');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Rome with a view'),
    (SELECT id FROM ingredients WHERE name = 'Campari'),
    30.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Rome with a view'),
    (SELECT id FROM ingredients WHERE name = 'Dolin'),
    30.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Rome with a view'),
    (SELECT id FROM ingredients WHERE name = 'lime'),
    30.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Rome with a view'),
    (SELECT id FROM ingredients WHERE name = 'sugar'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Rome with a view'),
    (SELECT id FROM ingredients WHERE name = 'top soda'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('St Clemence 2', '', 'Classic', 'orange wedge', '50ml Campari
2 dash orange bitters
top bitter lemon', (SELECT id FROM methods WHERE name = 'Build'), (SELECT id FROM glassware WHERE name = 'Highball'), (SELECT id FROM families WHERE name = 'Highball'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'St Clemence 2');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'St Clemence 2'),
    (SELECT id FROM ingredients WHERE name = 'Campari'),
    50.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'St Clemence 2'),
    (SELECT id FROM ingredients WHERE name = 'orange bitters'),
    NULL, 2.0, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'St Clemence 2'),
    (SELECT id FROM ingredients WHERE name = 'top bitter lemon'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Aviation 1', '', 'Classic', '', '45ml Calvados
15ml cassis
25ml Lime
dash Absinthe', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Aromatic'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Aviation 1');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Aviation 1'),
    (SELECT id FROM ingredients WHERE name = 'Calvados'),
    45.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Aviation 1'),
    (SELECT id FROM ingredients WHERE name = 'cassis'),
    15.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Aviation 1'),
    (SELECT id FROM ingredients WHERE name = 'Lime'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Aviation 1'),
    (SELECT id FROM ingredients WHERE name = 'dash Absinthe'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Black velvet (house)', '', '', '', 'Guinness 
Top champagne ', (SELECT id FROM methods WHERE name = 'Build'), (SELECT id FROM glassware WHERE name = 'Flute'), (SELECT id FROM families WHERE name = 'champagne'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Black velvet (house)');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Black velvet (house)'),
    (SELECT id FROM ingredients WHERE name = 'Guinness'),
    NULL, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Black velvet (house)'),
    (SELECT id FROM ingredients WHERE name = 'Top champagne'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Kitty Highball', 'WC Whitfield Heres how 1941', 'Classic', 'Ginger', '50ml Dry red wine
20ml Sweetened ginger juice
15ml lime
top soda', (SELECT id FROM methods WHERE name = 'shake and top'), (SELECT id FROM glassware WHERE name = 'Highball'), (SELECT id FROM families WHERE name = 'Highball'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Kitty Highball');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Kitty Highball'),
    (SELECT id FROM ingredients WHERE name = 'Dry red wine'),
    50.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Kitty Highball'),
    (SELECT id FROM ingredients WHERE name = 'Sweetened ginger juice'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Kitty Highball'),
    (SELECT id FROM ingredients WHERE name = 'lime'),
    15.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Kitty Highball'),
    (SELECT id FROM ingredients WHERE name = 'top soda'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Bellini', 'Max''s peach syrup TBC', 'Classic', '', '50ml Peach syrup
100ml Prosecco', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Custom'), (SELECT id FROM families WHERE name = 'champagne'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Bellini');
