INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Champs Elysses'),
    (SELECT id FROM ingredients WHERE name = '10-15ml sugar'),
    NULL, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Champs Elysses'),
    (SELECT id FROM ingredients WHERE name = 'Ango'),
    NULL, 2.0, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Classico', '', '', '', '40ml cognac
20ml cassis', NULL, NULL, (SELECT id FROM families WHERE name = 'Martini'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Classico');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Classico'),
    (SELECT id FROM ingredients WHERE name = 'cognac'),
    40.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Classico'),
    (SELECT id FROM ingredients WHERE name = 'cassis'),
    20.0, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Corpse reviver #1', 'Decide on garnish', 'Classic', 'orange twist,Lemon Twist', '30ml cognac
30ml calvados
30ml sweet vermouth', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sipper'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Corpse reviver #1');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corpse reviver #1'),
    (SELECT id FROM ingredients WHERE name = 'cognac'),
    30.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corpse reviver #1'),
    (SELECT id FROM ingredients WHERE name = 'calvados'),
    30.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corpse reviver #1'),
    (SELECT id FROM ingredients WHERE name = 'sweet vermouth'),
    30.0, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Corpse Reviver 1', 'Harry Craddock 1930', 'Classic', 'Cherry', '40ml Cognac
15ml Applejack
25ml Sweet Vermouth
2 dash ango', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Manhatten'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Corpse Reviver 1');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corpse Reviver 1'),
    (SELECT id FROM ingredients WHERE name = 'Cognac'),
    40.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corpse Reviver 1'),
    (SELECT id FROM ingredients WHERE name = 'Applejack'),
    15.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corpse Reviver 1'),
    (SELECT id FROM ingredients WHERE name = 'Sweet Vermouth'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corpse Reviver 1'),
    (SELECT id FROM ingredients WHERE name = 'ango'),
    NULL, 2.0, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Cuban No.1', 'Harry Craddock 1930', 'Classic', '', '40ml Cognac
20ml Apry
20ml lemon juice', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sour'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Cuban No.1');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Cuban No.1'),
    (SELECT id FROM ingredients WHERE name = 'Cognac'),
    40.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Cuban No.1'),
    (SELECT id FROM ingredients WHERE name = 'Apry'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Cuban No.1'),
    (SELECT id FROM ingredients WHERE name = 'lemon juice'),
    20.0, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Deauville', 'Harry Craddock 1930', 'Classic', 'Lemon Twist', '20ml Applejack
20ml Cognac
20ml lemon
15ml dry triple sec
bsp sugar ', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sipper'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Deauville');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Deauville'),
    (SELECT id FROM ingredients WHERE name = 'Applejack'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Deauville'),
    (SELECT id FROM ingredients WHERE name = 'Cognac'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Deauville'),
    (SELECT id FROM ingredients WHERE name = 'lemon'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Deauville'),
    (SELECT id FROM ingredients WHERE name = 'dry triple sec'),
    15.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Deauville'),
    (SELECT id FROM ingredients WHERE name = 'bsp sugar'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Deauville', 'Boozy side car variant', 'Classic', '', '20ml cognac 
20ml applejack 
20ml dry curaçao 
20ml lemon juice ', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Aromatic'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Deauville');
