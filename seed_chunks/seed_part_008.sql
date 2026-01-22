INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Adderley'),
    (SELECT id FROM ingredients WHERE name = 'Marachino'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Adderley'),
    (SELECT id FROM ingredients WHERE name = 'Lemon'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Adderley'),
    (SELECT id FROM ingredients WHERE name = 'Orange bitters'),
    NULL, 2.0, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Allegheny', 'Jones bar guide', 'Classic', 'Lemon Twist', '25ml bourbon
25ml sweet vermouth
15ml blackberry brandy / cassis
15ml lemon juice
Dash bitters', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sour'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Allegheny');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Allegheny'),
    (SELECT id FROM ingredients WHERE name = 'bourbon'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Allegheny'),
    (SELECT id FROM ingredients WHERE name = 'sweet vermouth'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Allegheny'),
    (SELECT id FROM ingredients WHERE name = 'blackberry brandy / cassis'),
    15.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Allegheny'),
    (SELECT id FROM ingredients WHERE name = 'lemon juice'),
    15.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Allegheny'),
    (SELECT id FROM ingredients WHERE name = 'Dash bitters'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('American Flower', 'House amaro
900 picon
300 marionette bitter curaçao 
300 averna ', '', 'orange twist', '45 bourbon 
15 amaro - house made
15 cacao
3 dash lapsang bitters 
3 dash orange bitters', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Rocks'), (SELECT id FROM families WHERE name = 'Sipper'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'American Flower');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'American Flower'),
    (SELECT id FROM ingredients WHERE name = 'bourbon'),
    NULL, NULL, 45.0
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'American Flower'),
    (SELECT id FROM ingredients WHERE name = 'amaro - house made'),
    NULL, NULL, 15.0
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'American Flower'),
    (SELECT id FROM ingredients WHERE name = 'cacao'),
    NULL, NULL, 15.0
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'American Flower'),
    (SELECT id FROM ingredients WHERE name = 'lapsang bitters'),
    NULL, 3.0, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'American Flower'),
    (SELECT id FROM ingredients WHERE name = 'orange bitters'),
    NULL, 3.0, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Battle of New Orleans', 'Cosby Gaige 1945', 'Classic', 'Lemon Twist', '60ml Bourbon
10ml Sugar
2 dash pey
1 dash orange
1 dash ango
', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Rocks'), (SELECT id FROM families WHERE name = 'Sipper'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Battle of New Orleans');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Battle of New Orleans'),
    (SELECT id FROM ingredients WHERE name = 'Bourbon'),
    60.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Battle of New Orleans'),
    (SELECT id FROM ingredients WHERE name = 'Sugar'),
    10.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Battle of New Orleans'),
    (SELECT id FROM ingredients WHERE name = 'pey'),
    NULL, 2.0, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Battle of New Orleans'),
    (SELECT id FROM ingredients WHERE name = 'orange'),
    NULL, 1.0, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Battle of New Orleans'),
    (SELECT id FROM ingredients WHERE name = 'ango'),
    NULL, 1.0, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Boulvardier', '', 'Classic', 'orange twist', '25ml Bourbon
25ml campari
25ml sweet vermouth', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Rocks'), (SELECT id FROM families WHERE name = 'Negroni'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Boulvardier');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Boulvardier'),
    (SELECT id FROM ingredients WHERE name = 'Bourbon'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Boulvardier'),
    (SELECT id FROM ingredients WHERE name = 'campari'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Boulvardier'),
    (SELECT id FROM ingredients WHERE name = 'sweet vermouth'),
    25.0, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Brooklyn', '', 'Classic', 'Cherry', '50ml rye, 15ml dry vermouth, 7.5ml picon, 7.5ml maraschino', (SELECT id FROM methods WHERE name = 'Stir'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sipper'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Brooklyn');
