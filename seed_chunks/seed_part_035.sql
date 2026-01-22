INSERT INTO recipes (cocktail_id, ingredient_id, ingredient_ml, ingredient_dash, ingredient_amount)
VALUES (
    (SELECT id FROM cocktails WHERE name = 'Charlie Chaplin'),
    (SELECT id FROM ingredients WHERE name = 'lime juice'),
    30.0, NULL, NULL
);
