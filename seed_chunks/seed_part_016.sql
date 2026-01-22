INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Vanilla Punch', 'Jerry Thomas 1862', 'Classic', 'Cherry,orange slice', '40ml Cognac
20ml Lemon
20ml Licor 43', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Rocks'), (SELECT id FROM families WHERE name = 'Sour'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Vanilla Punch');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Vanilla Punch'),
    (SELECT id FROM ingredients WHERE name = 'Cognac'),
    40.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Vanilla Punch'),
    (SELECT id FROM ingredients WHERE name = 'Lemon'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Vanilla Punch'),
    (SELECT id FROM ingredients WHERE name = 'Licor 43'),
    20.0, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Corn and oil', 'Check speck - float black strap syrup?', '', '', '40ml Barbados rum 
15ml falernum
2 dash ango
Shake 
Float 15ml black strap rum ', (SELECT id FROM methods WHERE name = 'shake and top'), (SELECT id FROM glassware WHERE name = 'Rocks'), (SELECT id FROM families WHERE name = 'Tiki'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Corn and oil');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corn and oil'),
    (SELECT id FROM ingredients WHERE name = 'Barbados rum'),
    40.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corn and oil'),
    (SELECT id FROM ingredients WHERE name = 'falernum'),
    15.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corn and oil'),
    (SELECT id FROM ingredients WHERE name = 'ango'),
    NULL, 2.0, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corn and oil'),
    (SELECT id FROM ingredients WHERE name = 'Shake'),
    NULL, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Corn and oil'),
    (SELECT id FROM ingredients WHERE name = 'Float 15ml black strap rum'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Barracuda', 'Felix - the everleigh', 'Modern Classic', 'Naked', '25ml White rum
25ml Fino sherry 
25ml Sugar
25ml Lime 
3 dash orange bitters
', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sour'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Barracuda');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Barracuda'),
    (SELECT id FROM ingredients WHERE name = 'White rum'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Barracuda'),
    (SELECT id FROM ingredients WHERE name = 'Fino sherry'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Barracuda'),
    (SELECT id FROM ingredients WHERE name = 'Sugar'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Barracuda'),
    (SELECT id FROM ingredients WHERE name = 'Lime'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Barracuda'),
    (SELECT id FROM ingredients WHERE name = 'orange bitters'),
    NULL, 3.0, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Brunswick sour', 'Check speck

Jones bar guide', 'Classic', 'Blackberry', '45ml white rum
25ml lime juice
20ml sugar
Float claret / blackberry wine', (SELECT id FROM methods WHERE name = 'shake and top'), (SELECT id FROM glassware WHERE name = 'Custom'), (SELECT id FROM families WHERE name = 'Sour'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Brunswick sour');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Brunswick sour'),
    (SELECT id FROM ingredients WHERE name = 'white rum'),
    45.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Brunswick sour'),
    (SELECT id FROM ingredients WHERE name = 'lime juice'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Brunswick sour'),
    (SELECT id FROM ingredients WHERE name = 'sugar'),
    20.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Brunswick sour'),
    (SELECT id FROM ingredients WHERE name = 'Float claret / blackberry wine'),
    NULL, NULL, NULL
);
INSERT INTO cocktails (name, notes, origin, garnish, spec, method_id, glassware_id, family_id)
VALUES ('Daiquiri #4', 'Blended and made at La Floridita', 'Classic', '', '50ml white rum
10ml marachino
25ml lime juice 
(5ml sugar?)', (SELECT id FROM methods WHERE name = 'Shake'), (SELECT id FROM glassware WHERE name = 'Coupette'), (SELECT id FROM families WHERE name = 'Sour'))
ON CONFLICT (name) DO UPDATE SET 
    notes = EXCLUDED.notes, 
    origin = EXCLUDED.origin, 
    garnish = EXCLUDED.garnish, 
    spec = EXCLUDED.spec,
    method_id = EXCLUDED.method_id,
    glassware_id = EXCLUDED.glassware_id,
    family_id = EXCLUDED.family_id;
DELETE FROM recipes WHERE cocktail_id = (SELECT id FROM cocktails WHERE name = 'Daiquiri #4');
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Daiquiri #4'),
    (SELECT id FROM ingredients WHERE name = 'white rum'),
    50.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Daiquiri #4'),
    (SELECT id FROM ingredients WHERE name = 'marachino'),
    10.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Daiquiri #4'),
    (SELECT id FROM ingredients WHERE name = 'lime juice'),
    25.0, NULL, NULL
);
INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Daiquiri #4'),
    (SELECT id FROM ingredients WHERE name = '(5ml sugar?)'),
    NULL, NULL, NULL
);
