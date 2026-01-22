INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('White Lady', '', '', 'Egg white foam', '45ml Gin
20ml Triple sec
20ml lemon
Egg shite', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sour'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'White Lady');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'White Lady'),
    (SELECT id FROM ingredients WHERE name = 'Gin'),
    45.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'White Lady'),
    (SELECT id FROM ingredients WHERE name = 'Triple sec'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'White Lady'),
    (SELECT id FROM ingredients WHERE name = 'lemon'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'White Lady'),
    (SELECT id FROM ingredients WHERE name = 'Egg shite'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('White Negroni
', 'Wayne Collins', 'Modern Classic', 'Lemon Twist', '40ml Gin
20ml Dry Vermouth
20ml Suze', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Rocks'), (SELECT id FROM families WHERE name = 'Aromatic'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'White Negroni
');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'White Negroni
'),
    (SELECT id FROM ingredients WHERE name = 'Gin'),
    40.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'White Negroni
'),
    (SELECT id FROM ingredients WHERE name = 'Dry Vermouth'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'White Negroni
'),
    (SELECT id FROM ingredients WHERE name = 'Suze'),
    20.0, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('A La Louisiane', 'restaurant De La Louisiane', 'Classic', 'Lemon Twist', '40ml Rye
20ml Sweet Vermouth
20ml Benedictine
2 Dash Pey
1 Dash Absinthe', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Rocks'), (SELECT id FROM families WHERE name = 'Sipper'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'A La Louisiane');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'A La Louisiane'),
    (SELECT id FROM ingredients WHERE name = 'Rye'),
    40.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'A La Louisiane'),
    (SELECT id FROM ingredients WHERE name = 'Sweet Vermouth'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'A La Louisiane'),
    (SELECT id FROM ingredients WHERE name = 'Benedictine'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'A La Louisiane'),
    (SELECT id FROM ingredients WHERE name = 'Pey'),
    NULL, 2.0, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'A La Louisiane'),
    (SELECT id FROM ingredients WHERE name = 'Absinthe'),
    NULL, 1.0, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Creole', '', '', 'Lemon disc', '50 Michters rye
15 sweet vermouth 
10 amer picon 
10 Dom Benedictine ', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Rocks'), (SELECT id FROM families WHERE name = 'Sipper'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Creole');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Creole'),
    (SELECT id FROM ingredients WHERE name = 'Michters rye'),
    NULL, NULL, 50.0
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Creole'),
    (SELECT id FROM ingredients WHERE name = 'sweet vermouth'),
    NULL, NULL, 15.0
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Creole'),
    (SELECT id FROM ingredients WHERE name = 'amer picon'),
    NULL, NULL, 10.0
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Creole'),
    (SELECT id FROM ingredients WHERE name = 'Dom Benedictine'),
    NULL, NULL, 10.0
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Fairbank Cocktail', 'Phil Ward Pegu club 2006', 'Modern Classic', 'Cherry', '20ml Rye
20ml Yellow Chartreuse
20ml Marachino
20ml Lemon juice', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Aromatic'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Fairbank Cocktail');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Fairbank Cocktail'),
    (SELECT id FROM ingredients WHERE name = 'Rye'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Fairbank Cocktail'),
    (SELECT id FROM ingredients WHERE name = 'Yellow Chartreuse'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Fairbank Cocktail'),
    (SELECT id FROM ingredients WHERE name = 'Marachino'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Fairbank Cocktail'),
    (SELECT id FROM ingredients WHERE name = 'Lemon juice'),
    20.0, NULL, NULL
);
