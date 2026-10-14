-- House prep recipes retried after the search budget ran out (after
-- 20261018060000). Stage 4 of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 35 of the 53 preps dropped from stages C to G for want of a cited
--     page now have one: one item_sources row per recipe, yield and keep
--     fact, two sites for the staples.
--   * Four catalog recipes left uncited in C are corrected or cited
--     (replace): Rosemary syrup, Earl Grey syrup, Grapefruit sherbet and
--     Salt air. Each entry's "fix" in the seed says what changed and why.
--   * 31 new recipes on shared preps that had none: syrups (rose, popcorn,
--     chipotle, piloncillo, jasmine, osmanthus, grapefruit, plum,
--     champagne), tinctures, spicy and jalapeno tequila, horseradish vodka,
--     lemongrass mezcal and shochu, clarified banana, yoghurt whey, jasmine
--     and yuzu foam, strawberry cream, house-made cola, fig leaf soda,
--     spiced salt, house brine and spiced cold brew.
--   * New shared preps: Finger lime cordial, Desert lime cordial and
--     Pepperberry tincture. New plain ingredients: Browning sauce and
--     Desert lime (Dried osmanthus flowers is made only where missing).
--   * A keep is the shortest any cited page gives; with nothing to cite
--     there's no keep.
--   * An independent second check of 100 random facts (of 152) against the
--     cited pages found none wrong.
--
-- Written by scripts/prep-recipes.mjs from supabase/seeds/preps/r_retried.json;
-- edit the seed, not this file. Matched by name key: a second run changes
-- nothing, rows that are missing are made, and venue preps aren't touched.

SET statement_timeout = 0;
SET "app.image_worker" = 'on';
-- No paid flavour jobs: note the queue now and put it back at the end.
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE TEMP TABLE stub_in (name text PRIMARY KEY, description text, kind_of text);
CREATE TEMP TABLE prep_in (
    name text PRIMARY KEY, kind_of text, kind_of_force boolean NOT NULL, description text, abv numeric, has_abv boolean NOT NULL,
    yield_amount numeric, yield_unit text, keeps_hours integer, storage text, actions text[] NOT NULL, replace boolean NOT NULL
);
CREATE TEMP TABLE alias_in (name text NOT NULL, alias text NOT NULL);
CREATE TEMP TABLE line_in (name text NOT NULL, pos integer NOT NULL, ingredient text NOT NULL, amount numeric, unit text, note text, optional boolean NOT NULL, PRIMARY KEY (name, pos));
CREATE TEMP TABLE step_in (name text NOT NULL, pos integer NOT NULL, body text NOT NULL, timer_seconds integer, PRIMARY KEY (name, pos));
CREATE TEMP TABLE source_in (name text NOT NULL, field text NOT NULL, url text NOT NULL, kind text NOT NULL, checked_on date NOT NULL, note text);

INSERT INTO stub_in VALUES
($q$Browning sauce$q$, $q$A dark caramel and vegetable based kitchen sauce (such as Kitchen Bouquet) used to colour sauces and syrups brown.$q$, $q$Caramel$q$),
($q$Desert lime$q$, $q$Small, sharp wild lime from inland eastern Australia (Citrus glauca), used whole, skin and all, in preserves, syrups and sauces.$q$, $q$Citrus$q$),
($q$Dried osmanthus flowers$q$, $q$The small dried golden flowers of sweet osmanthus, with an apricot and honey scent, steeped for teas and syrups.$q$, $q$Osmanthus$q$);

INSERT INTO prep_in VALUES
($q$Champagne syrup$q$, $q$Syrup$q$, false, $q$Champagne (flat is fine) with an equal volume of sugar, dissolved over very low heat so the wine flavour stays bright. It keeps some alcohol. For Champagne daiquiris, French 75s and Bellinis.$q$, NULL, false, 360, $q$ml$q$, NULL, NULL, ARRAY[$q$Syrup$q$]::text[], false),
($q$Chile de arbol tincture$q$, $q$Tincture$q$, false, $q$Dried árbol chiles steeped two weeks in grain alcohol: a clean, sharp heat dropped on top of a finished margarita or other agave drink, two or three drops at a time.$q$, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Tincture$q$, $q$Strain$q$]::text[], false),
($q$Chili tincture$q$, $q$Tincture$q$, false, $q$Chopped habaneros pulled into vodka overnight (or in two hours sous vide): a quick, hot chili tincture added by the dash to tequila and vegetal drinks.$q$, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Tincture$q$, $q$Strain$q$]::text[], false),
($q$Chipotle syrup$q$, $q$Syrup$q$, false, $q$1:1 syrup boiled with a whole dried chipotle and left to rest so the smoke and heat build. For mezcal and tequila sours, mules and margaritas.$q$, 0, true, 360, $q$ml$q$, NULL, NULL, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Clarified banana$q$, $q$Banana$q$, false, $q$Banana purée treated with pectinase and spun in a centrifuge, leaving a clear, pale yellow banana juice. For clear banana sours, highballs and stirred drinks; needs a centrifuge.$q$, 0, true, NULL, NULL, NULL, NULL, ARRAY[$q$Blend$q$, $q$Clarify$q$, $q$Centrifuge$q$, $q$Strain$q$]::text[], false),
($q$Desert lime cordial$q$, $q$Cordial$q$, false, $q$A rich desert lime syrup: chopped whole desert limes simmered in sugar syrup until it reduces by a third, then strained. Lengthen with soda as a cordial or use it in native-citrus sours. Starting point: test a batch first.$q$, 0, true, NULL, NULL, NULL, NULL, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Earl Grey syrup$q$, $q$Syrup$q$, false, $q$A 1:1 simple syrup with loose Earl Grey steeped in it for a few minutes off the heat. Bergamot and light tannin for gin sours, punches and highballs.$q$, 0, true, 720, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], true),
($q$Fig leaf soda$q$, $q$Fig leaf$q$, false, $q$Dried fig leaf steeped in hot water, made into a 1:1 syrup sharpened with citric acid, then cut 1 to 3 with water and force carbonated. A house soda for highballs, in place of club soda or ginger beer.$q$, 0, true, 1440, $q$ml$q$, NULL, NULL, ARRAY[$q$Infuse$q$, $q$Strain$q$, $q$Syrup$q$, $q$Carbonate$q$]::text[], false),
($q$Finger lime cordial$q$, $q$Cordial$q$, false, $q$A rich wild lime syrup: chopped finger limes simmered in sugar syrup for about an hour until it reduces by a third, then strained. No added acid; lengthen with soda as a cordial or use it in native-citrus sours and highballs.$q$, 0, true, NULL, NULL, NULL, NULL, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Grapefruit sherbet$q$, $q$Sherbet$q$, false, $q$Grapefruit peel cured in sugar for a day, then dissolved in an equal measure of fresh grapefruit juice. Bittersweet and aromatic; for punches, Palomas and highballs.$q$, 0, true, 800, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], true),
($q$Grapefruit syrup$q$, $q$Syrup$q$, false, $q$Fresh pink grapefruit juice warmed with sugar and strips of zest, steeped and strained. For Palomas, grapefruit Negronis and highballs.$q$, 0, true, 120, $q$ml$q$, 672, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Habanero tincture$q$, $q$Tincture$q$, false, $q$Seeded habaneros steeped in vodka for one to two weeks: fruity, fierce heat to add by the dash to tequila, rum and ginger drinks.$q$, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Tincture$q$, $q$Strain$q$]::text[], false),
($q$Horseradish vodka$q$, $q$Vodka$q$, false, $q$Vodka infused for four to six days with ribbons of fresh horseradish root and lemon zest, then served ice cold. Sharp, nose-clearing heat for Bloody Marys and shots with pickles.$q$, NULL, false, 1000, $q$ml$q$, NULL, NULL, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$House brine$q$, $q$Brine$q$, false, $q$A salted, lightly soured water poured over crushed green olives and left to pick up their flavour in the fridge. For Dirty Martinis at 15 to 30 ml a drink.$q$, 0, true, NULL, NULL, NULL, NULL, ARRAY[$q$Mix$q$, $q$Infuse$q$]::text[], false),
($q$House-made cola$q$, $q$Cola$q$, false, $q$A natural cola syrup of lemon, lime and orange zest and juice with cinnamon, dried bitter orange peel, coriander and nutmeg, darkened with browning sauce. Lengthen 1 part to 3 parts cold seltzer, or charge in a soda siphon.$q$, 0, true, NULL, NULL, 336, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Jalapeno tequila$q$, $q$Tequila$q$, false, $q$Two sliced jalapeños steeped in a bottle of blanco tequila overnight to two days, then strained. Grassy, green heat for spicy margaritas.$q$, NULL, false, 750, $q$ml$q$, NULL, NULL, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Jasmine foam$q$, $q$Jasmine$q$, false, $q$A vegan siphon foam of jasmine pearl tea, lightly sweetened and soured with citric, malic and tartaric acid, set with methylcellulose and xanthan. Spoon or pipe it onto tea-led sours and highballs.$q$, 0, true, NULL, NULL, NULL, NULL, ARRAY[$q$Infuse$q$, $q$Strain$q$, $q$Foam$q$]::text[], false),
($q$Jasmine syrup$q$, $q$Syrup$q$, false, $q$Jasmine tea simmered with sugar and water, then strained: a light, floral sweetener for gin sours, highballs and sparkling drinks.$q$, 0, true, 360, $q$ml$q$, NULL, NULL, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Lemongrass mezcal$q$, $q$Mezcal$q$, false, $q$Mezcal flash-infused with fresh lemongrass in a cream whipper: bright lemon and grass over the smoke, for sours and highballs. Arnold's nitrous lemongrass method, moved from vodka to mezcal. Starting point: test a batch first.$q$, NULL, false, 270, $q$ml$q$, 24, $q$Freezer, sealed bottle$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Lemongrass shochu$q$, $q$Shochu$q$, false, $q$Shochu flash-infused with fresh lemongrass in a cream whipper: a clean citrus-grass shochu for chuhai and highballs. Arnold's nitrous lemongrass method, moved from vodka to shochu, which is lower in alcohol. Starting point: test a batch first.$q$, NULL, false, 270, $q$ml$q$, 24, $q$Freezer, sealed bottle$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Osmanthus syrup$q$, $q$Syrup$q$, false, $q$Dried osmanthus flowers simmered briefly in 1:1 syrup and steeped, for a honeyed apricot floral note in gin, baijiu, sake and tea drinks.$q$, 0, true, 160, $q$ml$q$, 336, $q$Fridge, airtight jar$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Pepperberry tincture$q$, $q$Tincture$q$, false, $q$Cracked dried Tasmanian pepperberries steeped a few days in high-proof vodka: a fruity, numbing native pepper heat dosed by the drop into Martinis, Bloody Marys and sours.$q$, NULL, false, 90, $q$ml$q$, NULL, NULL, ARRAY[$q$Tincture$q$, $q$Strain$q$]::text[], false),
($q$Piloncillo syrup$q$, $q$Simple syrup$q$, false, $q$A cone of piloncillo simmered with an equal weight of water into a dark, molasses edged syrup. For mezcal, tequila, rum and whiskey drinks.$q$, 0, true, 350, $q$ml$q$, 168, $q$Fridge, airtight container$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Plum syrup$q$, $q$Syrup$q$, false, $q$1:1 syrup simmered with pitted fresh plums for a soft stone fruit sweetener. Made for a gin Plum Sour; good in whisky and brandy sours too.$q$, 0, true, 380, $q$ml$q$, NULL, NULL, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Popcorn syrup$q$, $q$Syrup$q$, false, $q$A light sugar syrup steeped with popped popcorn and a pinch of salt for a day, then strained. Buttery and toasty, for bourbon, rum and dessert drinks.$q$, 0, true, NULL, NULL, 168, $q$Fridge, sealed jar$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Rose syrup$q$, $q$Syrup$q$, false, $q$Dried rose petals steeped in boiling water, then sweetened with an equal volume of sugar and lifted with a little rose water. For floral sours, spritzes and gin drinks.$q$, 0, true, 360, $q$ml$q$, 336, $q$Fridge, covered$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$, $q$Syrup$q$]::text[], false),
($q$Rosemary syrup$q$, $q$Syrup$q$, false, $q$A 1:1 simple syrup warmed with fresh rosemary and left to cool with the sprigs in. Piney and savoury; good with gin, grapefruit and whiskey sours.$q$, 0, true, 720, $q$ml$q$, 504, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], true),
($q$Salt air$q$, $q$Salt$q$, false, $q$A salty lime air whipped from lime juice, water, kosher salt and a little soy lecithin with a stick blender. Spooned onto a Margarita in place of a salt rim.$q$, 0, true, 720, $q$ml$q$, 24, $q$Fridge, unwhipped; whip fresh for service$q$, ARRAY[$q$Mix$q$, $q$Foam$q$]::text[], true),
($q$Spiced cold brew$q$, $q$Cold brew$q$, false, $q$Ground coffee steeped cold overnight with cinnamon, cardamom, turmeric and a pinch of saffron, then pressed. A chai-leaning cold brew for coffee highballs and Espresso Martini riffs.$q$, 0, true, NULL, NULL, NULL, NULL, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Spiced salt$q$, $q$Salt$q$, false, $q$Kosher salt rubbed with fresh lime zest, hot chile powder and a little cane sugar, with optional ground habanero. A rimming salt for Margaritas, Palomas and Micheladas.$q$, 0, true, 120, $q$ml$q$, 1440, $q$Airtight container$q$, ARRAY[$q$Mix$q$]::text[], false),
($q$Spicy tequila$q$, $q$Tequila$q$, false, $q$Blanco tequila infused with sliced jalapeños, from overnight to two days: green, bright heat for spicy margaritas and Palomas.$q$, NULL, false, 750, $q$ml$q$, NULL, NULL, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Spicy tincture$q$, $q$Tincture$q$, false, $q$A bar's all-purpose heat: chiles steeped in high-proof spirit and added a few drops at a time, so the heat stays the same drink to drink. This version uses seeded habaneros in vodka.$q$, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Tincture$q$, $q$Strain$q$]::text[], false),
($q$Strawberry cream$q$, $q$Cream$q$, false, $q$Heavy cream and a little milk whipped with strawberry syrup into a soft, pourable pink cream. Floated on iced coffee, matcha or creamy sours.$q$, 0, true, NULL, NULL, 48, $q$Fridge, covered$q$, ARRAY[$q$Mix$q$, $q$Foam$q$]::text[], false),
($q$Yoghurt whey$q$, $q$Whey$q$, false, $q$The thin, tangy liquid that drains out of plain yoghurt as it thickens. Adds a soft lactic sourness and body to sours, highballs and whey sodas.$q$, 0, true, 480, $q$ml$q$, NULL, NULL, ARRAY[$q$Strain$q$]::text[], false),
($q$Yuzu foam$q$, $q$Yuzu$q$, false, $q$A light lecithin air of yuzu juice and simple syrup, whipped with a stick blender and spooned onto the drink to order. Lasts minutes, so make it at service.$q$, 0, true, NULL, NULL, NULL, NULL, ARRAY[$q$Blend$q$, $q$Foam$q$]::text[], false);

INSERT INTO alias_in VALUES
($q$Champagne syrup$q$, $q$Sparkling wine syrup$q$),
($q$Chipotle syrup$q$, $q$Chipotle simple syrup$q$),
($q$Desert lime cordial$q$, $q$Desert lime syrup$q$),
($q$Finger lime cordial$q$, $q$Wild lime syrup$q$),
($q$Finger lime cordial$q$, $q$Finger lime syrup$q$),
($q$Grapefruit syrup$q$, $q$Grapefruit simple syrup$q$),
($q$Horseradish vodka$q$, $q$Hrenovuha$q$),
($q$Jasmine syrup$q$, $q$Jasmine tea syrup$q$),
($q$Osmanthus syrup$q$, $q$Osmanthus flower syrup$q$),
($q$Osmanthus syrup$q$, $q$Sweet osmanthus syrup$q$),
($q$Pepperberry tincture$q$, $q$Mountain pepper tincture$q$),
($q$Piloncillo syrup$q$, $q$Miel de piloncillo$q$),
($q$Piloncillo syrup$q$, $q$Piloncillo simple syrup$q$),
($q$Plum syrup$q$, $q$Plum simple syrup$q$),
($q$Popcorn syrup$q$, $q$Popcorn simple syrup$q$),
($q$Rose syrup$q$, $q$Rose simple syrup$q$),
($q$Rose syrup$q$, $q$Rose petal syrup$q$);

INSERT INTO line_in VALUES
($q$Champagne syrup$q$, 0, $q$Champagne$q$, 240, $q$ml$q$, $q$or other dry sparkling wine; flat leftovers work$q$, false),
($q$Champagne syrup$q$, 1, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Chile de arbol tincture$q$, 0, $q$Chile de árbol$q$, 20, $q$each$q$, $q$dried, whole$q$, false),
($q$Chile de arbol tincture$q$, 1, $q$Neutral grain spirit$q$, 420, $q$ml$q$, $q$grain alcohol such as Everclear; 1 3/4 cups at 240 ml$q$, false),
($q$Chili tincture$q$, 0, $q$Habanero$q$, 5, $q$each$q$, $q$roughly chopped (wear gloves)$q$, false),
($q$Chili tincture$q$, 1, $q$Vodka$q$, 500, $q$ml$q$, NULL, false),
($q$Chipotle syrup$q$, 0, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Chipotle syrup$q$, 1, $q$Water$q$, 240, $q$ml$q$, NULL, false),
($q$Chipotle syrup$q$, 2, $q$Chipotle$q$, 1, $q$each$q$, $q$dried chipotle chile$q$, false),
($q$Clarified banana$q$, 0, $q$Banana$q$, 1000, $q$g$q$, $q$peeled weight; slightly under-ripe gives a greener, grassier juice$q$, false),
($q$Clarified banana$q$, 1, $q$Pectinase$q$, 2, $q$g$q$, $q$Pectinex$q$, false),
($q$Desert lime cordial$q$, 0, $q$Sugar$q$, 250, $q$g$q$, $q$1 1/4 cups white sugar at 200 g per cup$q$, false),
($q$Desert lime cordial$q$, 1, $q$Water$q$, 240, $q$ml$q$, $q$1 cup$q$, false),
($q$Desert lime cordial$q$, 2, $q$Desert lime$q$, 60, $q$ml$q$, $q$1/4 cup whole fruit, chopped$q$, false),
($q$Earl Grey syrup$q$, 0, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$Earl Grey syrup$q$, 1, $q$Sugar$q$, 400, $q$g$q$, NULL, false),
($q$Earl Grey syrup$q$, 2, $q$Earl Grey tea$q$, 6, $q$tsp$q$, $q$loose leaf, or 6 tea bags$q$, false),
($q$Fig leaf soda$q$, 0, $q$Water$q$, 240, $q$ml$q$, $q$hot, for the steep$q$, false),
($q$Fig leaf soda$q$, 1, $q$Fig leaf$q$, 1, $q$tbsp$q$, $q$dried, crumbled; edible fig (Ficus carica) only$q$, false),
($q$Fig leaf soda$q$, 2, $q$Caster sugar$q$, 200, $q$g$q$, NULL, false),
($q$Fig leaf soda$q$, 3, $q$Citric acid$q$, 0.75, $q$tsp$q$, NULL, false),
($q$Fig leaf soda$q$, 4, $q$Water$q$, 1080, $q$ml$q$, $q$cold, filtered: 3 parts to 1 part syrup$q$, false),
($q$Finger lime cordial$q$, 0, $q$Sugar$q$, 250, $q$g$q$, $q$1 1/4 cups white sugar at 200 g per cup$q$, false),
($q$Finger lime cordial$q$, 1, $q$Water$q$, 240, $q$ml$q$, $q$1 cup$q$, false),
($q$Finger lime cordial$q$, 2, $q$Finger lime$q$, 60, $q$ml$q$, $q$1/4 cup whole fruit, chopped$q$, false),
($q$Grapefruit sherbet$q$, 0, $q$Grapefruit peel$q$, NULL, NULL, $q$peels of the grapefruit you juice, about 1 grapefruit per 240 ml of juice, thin, as little pith as possible$q$, false),
($q$Grapefruit sherbet$q$, 1, $q$Sugar$q$, 500, $q$g$q$, NULL, false),
($q$Grapefruit sherbet$q$, 2, $q$Grapefruit juice$q$, 500, $q$ml$q$, $q$fresh, strained$q$, false),
($q$Grapefruit syrup$q$, 0, $q$Grapefruit juice$q$, 100, $q$ml$q$, $q$fresh red or pink, from 1 to 2 fruit$q$, false),
($q$Grapefruit syrup$q$, 1, $q$Grapefruit peel$q$, 2, $q$peel$q$, $q$strips, pith removed$q$, false),
($q$Grapefruit syrup$q$, 2, $q$Sugar$q$, 75, $q$g$q$, $q$use 100 g for white grapefruit$q$, false),
($q$Habanero tincture$q$, 0, $q$Habanero$q$, 12, $q$each$q$, $q$stems and seeds removed (wear gloves)$q$, false),
($q$Habanero tincture$q$, 1, $q$Vodka$q$, 1000, $q$ml$q$, NULL, false),
($q$Horseradish vodka$q$, 0, $q$Horseradish$q$, 1, $q$each$q$, $q$fresh root, a 5 inch (13 cm) piece, outer layers off, cut into thin ribbons, core discarded$q$, false),
($q$Horseradish vodka$q$, 1, $q$Lemon zest$q$, 1, $q$each$q$, $q$zest of 1 large lemon in wide strips, no pith$q$, false),
($q$Horseradish vodka$q$, 2, $q$Vodka$q$, 1000, $q$ml$q$, NULL, false),
($q$House brine$q$, 0, $q$Green olive$q$, 480, $q$ml$q$, $q$whole, firmly mashed; they stay in the jar$q$, false),
($q$House brine$q$, 1, $q$Water$q$, 600, $q$ml$q$, NULL, false),
($q$House brine$q$, 2, $q$Vinegar$q$, 2, $q$tbsp$q$, NULL, false),
($q$House brine$q$, 3, $q$Salt$q$, 2, $q$tbsp$q$, NULL, false),
($q$House-made cola$q$, 0, $q$Water$q$, 960, $q$ml$q$, NULL, false),
($q$House-made cola$q$, 1, $q$Lemon$q$, 1, $q$each$q$, $q$finely grated zest and juice, kept apart$q$, false),
($q$House-made cola$q$, 2, $q$Lime$q$, 1, $q$each$q$, $q$finely grated zest and juice, kept apart$q$, false),
($q$House-made cola$q$, 3, $q$Orange$q$, 2, $q$each$q$, $q$finely grated zest and juice, kept apart$q$, false),
($q$House-made cola$q$, 4, $q$Cinnamon$q$, 3, $q$each$q$, $q$large 5 inch sticks, broken small$q$, false),
($q$House-made cola$q$, 5, $q$Bitter orange$q$, 2, $q$tbsp$q$, $q$dried peel$q$, false),
($q$House-made cola$q$, 6, $q$Coriander seed$q$, 2, $q$tsp$q$, NULL, false),
($q$House-made cola$q$, 7, $q$Nutmeg$q$, 0.25, $q$tsp$q$, $q$finely grated$q$, false),
($q$House-made cola$q$, 8, $q$Gum Arabic$q$, 1, $q$tsp$q$, $q$optional, for body$q$, false),
($q$House-made cola$q$, 9, $q$Sugar$q$, 907, $q$g$q$, $q$2 lb$q$, false),
($q$House-made cola$q$, 10, $q$Browning sauce$q$, 60, $q$ml$q$, $q$such as Kitchen Bouquet, for colour$q$, false),
($q$House-made cola$q$, 11, $q$Vanilla extract$q$, 0.5, $q$tsp$q$, NULL, false),
($q$Jalapeno tequila$q$, 0, $q$Jalapeño$q$, 2, $q$each$q$, $q$medium, about 50 g; stems off, sliced thin, seeds kept for more heat$q$, false),
($q$Jalapeno tequila$q$, 1, $q$Blanco tequila$q$, 750, $q$ml$q$, $q$100% agave$q$, false),
($q$Jasmine foam$q$, 0, $q$Water$q$, 300, $q$ml$q$, $q$at 60 to 70 °C$q$, false),
($q$Jasmine foam$q$, 1, $q$Jasmine Pearl Tea$q$, 5, $q$g$q$, NULL, false),
($q$Jasmine foam$q$, 2, $q$Sugar$q$, 30, $q$g$q$, NULL, false),
($q$Jasmine foam$q$, 3, $q$Citric acid$q$, 0.5, $q$g$q$, NULL, false),
($q$Jasmine foam$q$, 4, $q$Malic acid$q$, 0.5, $q$g$q$, NULL, false),
($q$Jasmine foam$q$, 5, $q$Tartaric acid$q$, 0.5, $q$g$q$, NULL, false),
($q$Jasmine foam$q$, 6, $q$Methylcellulose$q$, 1.8, $q$g$q$, $q$F50 type$q$, false),
($q$Jasmine foam$q$, 7, $q$Xanthan gum$q$, 0.5, $q$g$q$, NULL, false),
($q$Jasmine syrup$q$, 0, $q$Jasmine tea$q$, 4, $q$tsp$q$, $q$loose leaf, or 4 tea bags$q$, false),
($q$Jasmine syrup$q$, 1, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Jasmine syrup$q$, 2, $q$Water$q$, 360, $q$ml$q$, NULL, false),
($q$Lemongrass mezcal$q$, 0, $q$Lemongrass$q$, 180, $q$g$q$, $q$fresh stalks, sliced into thin disks$q$, false),
($q$Lemongrass mezcal$q$, 1, $q$Mezcal$q$, 300, $q$ml$q$, NULL, false),
($q$Lemongrass shochu$q$, 0, $q$Lemongrass$q$, 180, $q$g$q$, $q$fresh stalks, sliced into thin disks$q$, false),
($q$Lemongrass shochu$q$, 1, $q$Shochu$q$, 300, $q$ml$q$, NULL, false),
($q$Osmanthus syrup$q$, 0, $q$Sugar$q$, 100, $q$g$q$, NULL, false),
($q$Osmanthus syrup$q$, 1, $q$Water$q$, 120, $q$ml$q$, NULL, false),
($q$Osmanthus syrup$q$, 2, $q$Dried osmanthus flowers$q$, 3, $q$tbsp$q$, NULL, false),
($q$Osmanthus syrup$q$, 3, $q$Honey$q$, 1, $q$tsp$q$, NULL, true),
($q$Pepperberry tincture$q$, 0, $q$Vodka$q$, 100, $q$ml$q$, $q$over 50% ABV, or high-proof neutral grain spirit$q$, false),
($q$Pepperberry tincture$q$, 1, $q$Tasmanian pepperberry$q$, 7, $q$g$q$, $q$whole dried berries, coarsely cracked$q$, false),
($q$Piloncillo syrup$q$, 0, $q$Piloncillo$q$, 227, $q$g$q$, $q$one 8 oz cone, broken up$q$, false),
($q$Piloncillo syrup$q$, 1, $q$Water$q$, 240, $q$ml$q$, NULL, false),
($q$Plum syrup$q$, 0, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Plum syrup$q$, 1, $q$Water$q$, 240, $q$ml$q$, NULL, false),
($q$Plum syrup$q$, 2, $q$Plum$q$, 3, $q$each$q$, $q$pitted$q$, false),
($q$Popcorn syrup$q$, 0, $q$Sugar$q$, 100, $q$g$q$, NULL, false),
($q$Popcorn syrup$q$, 1, $q$Water$q$, 240, $q$ml$q$, NULL, false),
($q$Popcorn syrup$q$, 2, $q$Sea salt$q$, 1, $q$pinch$q$, NULL, false),
($q$Popcorn syrup$q$, 3, $q$Popcorn$q$, NULL, NULL, $q$3 cups popped (720 ml by volume; too light to weigh by volume)$q$, false),
($q$Rose syrup$q$, 0, $q$Dried rose$q$, 4, $q$tbsp$q$, $q$dried culinary rose petals (1/4 cup)$q$, false),
($q$Rose syrup$q$, 1, $q$Water$q$, 240, $q$ml$q$, $q$boiling, plus a little more hot water to top back up after straining$q$, false),
($q$Rose syrup$q$, 2, $q$Rose water$q$, 0.25, $q$tsp$q$, NULL, false),
($q$Rose syrup$q$, 3, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Rosemary syrup$q$, 0, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$Rosemary syrup$q$, 1, $q$Sugar$q$, 400, $q$g$q$, NULL, false),
($q$Rosemary syrup$q$, 2, $q$Rosemary$q$, 2, $q$sprig$q$, $q$fresh$q$, false),
($q$Salt air$q$, 0, $q$Lime juice$q$, 240, $q$ml$q$, $q$fresh$q$, false),
($q$Salt air$q$, 1, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$Salt air$q$, 2, $q$Kosher salt$q$, 1, $q$tbsp$q$, NULL, false),
($q$Salt air$q$, 3, $q$Soy lecithin$q$, 0.5, $q$tsp$q$, $q$powder$q$, false),
($q$Spiced cold brew$q$, 0, $q$Ground coffee$q$, 320, $q$ml$q$, NULL, false),
($q$Spiced cold brew$q$, 1, $q$Ground cinnamon$q$, 2, $q$tsp$q$, NULL, false),
($q$Spiced cold brew$q$, 2, $q$Cardamom$q$, 2, $q$tsp$q$, $q$ground$q$, false),
($q$Spiced cold brew$q$, 3, $q$Turmeric$q$, 1, $q$tsp$q$, $q$ground$q$, false),
($q$Spiced cold brew$q$, 4, $q$Saffron$q$, 4, $q$pinch$q$, NULL, false),
($q$Spiced cold brew$q$, 5, $q$Water$q$, 1920, $q$ml$q$, $q$cold or room temperature$q$, false),
($q$Spiced salt$q$, 0, $q$Kosher salt$q$, 8, $q$tbsp$q$, $q$1/2 cup$q$, false),
($q$Spiced salt$q$, 1, $q$Lime zest$q$, 1, $q$each$q$, $q$finely grated zest of 1 lime, no pith$q$, false),
($q$Spiced salt$q$, 2, $q$Chile powder$q$, 1, $q$tbsp$q$, $q$hot$q$, false),
($q$Spiced salt$q$, 3, $q$Cane sugar$q$, 1, $q$tbsp$q$, NULL, false),
($q$Spiced salt$q$, 4, $q$Habanero$q$, 0.5, $q$tsp$q$, $q$ground, optional$q$, false),
($q$Spicy tequila$q$, 0, $q$Jalapeño$q$, 2, $q$each$q$, $q$medium, about 50 g; stems off, sliced thin, seeds kept for more heat$q$, false),
($q$Spicy tequila$q$, 1, $q$Blanco tequila$q$, 750, $q$ml$q$, $q$100% agave$q$, false),
($q$Spicy tincture$q$, 0, $q$Habanero$q$, 6, $q$each$q$, $q$stems and seeds removed (wear gloves)$q$, false),
($q$Spicy tincture$q$, 1, $q$Vodka$q$, 480, $q$ml$q$, $q$2 cups at 240 ml; 50% ABV vodka extracts more$q$, false),
($q$Strawberry cream$q$, 0, $q$Heavy cream$q$, 240, $q$ml$q$, NULL, false),
($q$Strawberry cream$q$, 1, $q$Milk$q$, 120, $q$ml$q$, $q$2% milk$q$, false),
($q$Strawberry cream$q$, 2, $q$Strawberry syrup$q$, 120, $q$ml$q$, NULL, false),
($q$Yoghurt whey$q$, 0, $q$Yogurt$q$, 960, $q$ml$q$, $q$plain; 1 quart (4 cups at 240 ml). The source used nonfat.$q$, false),
($q$Yuzu foam$q$, 0, $q$Yuzu juice$q$, 90, $q$ml$q$, $q$6 tbsp$q$, false),
($q$Yuzu foam$q$, 1, $q$Simple syrup$q$, 60, $q$ml$q$, $q$1:1, 4 tbsp$q$, false),
($q$Yuzu foam$q$, 2, $q$Soy lecithin$q$, 0.375, $q$g$q$, $q$weigh on a fine scale; about 1/8 tsp$q$, false);

INSERT INTO step_in VALUES
($q$Champagne syrup$q$, 0, $q$Put the Champagne and sugar in a saucepan over very low heat.$q$, NULL),
($q$Champagne syrup$q$, 1, $q$Stir the whole time until the sugar has dissolved, then turn off the heat.$q$, NULL),
($q$Champagne syrup$q$, 2, $q$Cool to room temperature, bottle and keep in the fridge.$q$, NULL),
($q$Chile de arbol tincture$q$, 0, $q$Put the chiles and grain alcohol in a small jar with a tight lid.$q$, NULL),
($q$Chile de arbol tincture$q$, 1, $q$Leave at room temperature for 2 weeks, shaking hard for 5 to 10 seconds once a day.$q$, NULL),
($q$Chile de arbol tincture$q$, 2, $q$Strain into dropper bottles and label each with what it is and its strength. It is very strong and flammable: use by the drop.$q$, NULL),
($q$Chili tincture$q$, 0, $q$Wearing gloves, roughly chop the habaneros and put them in a jar with the vodka.$q$, NULL),
($q$Chili tincture$q$, 1, $q$Leave at room temperature overnight. Or seal in a vacuum bag and hold at 63 °C (145 °F) in a water bath for 2 hours, then chill.$q$, 7200),
($q$Chili tincture$q$, 2, $q$Fine strain into dropper bottles and label each with what it is. Use by the dash.$q$, NULL),
($q$Chipotle syrup$q$, 0, $q$Bring the sugar, water and dried chipotle to the boil in a small pot, stirring until the sugar dissolves, then take it off the heat.$q$, NULL),
($q$Chipotle syrup$q$, 1, $q$Cool in a heatproof container, cover and refrigerate with the chile in. Make it at least 2 days ahead, ideally a week; it gets smokier as it sits.$q$, NULL),
($q$Chipotle syrup$q$, 2, $q$Lift out or strain off the chile once it tastes right.$q$, NULL),
($q$Clarified banana$q$, 0, $q$Blend the peeled bananas to a smooth purée and weigh it.$q$, NULL),
($q$Clarified banana$q$, 1, $q$Stir in the Pectinex and leave it 10 minutes.$q$, 600),
($q$Clarified banana$q$, 2, $q$Divide into centrifuge bottles of matching weight and spin at about 5,000 rpm for 10 minutes. The pulp packs into a firm puck at the bottom.$q$, 600),
($q$Clarified banana$q$, 3, $q$Pour off the clear juice and pass it through a superbag, then a coffee filter. Keep cold.$q$, NULL),
($q$Desert lime cordial$q$, 0, $q$Dissolve the sugar in the water in a heavy saucepan, add the chopped desert limes and bring to the boil.$q$, NULL),
($q$Desert lime cordial$q$, 1, $q$Simmer gently until the liquid has dropped by about a third, roughly an hour. Taste: desert limes are sharper than finger limes.$q$, 3600),
($q$Desert lime cordial$q$, 2, $q$Strain out the fruit through a fine sieve and pour the syrup, still hot, into sterilised jars. Seal.$q$, NULL),
($q$Earl Grey syrup$q$, 0, $q$Warm the water and sugar in a small pan, stirring, until the sugar has dissolved.$q$, NULL),
($q$Earl Grey syrup$q$, 1, $q$Take the pan off the heat, add the tea and steep. Taste at 3 minutes: past 4 it turns bitter.$q$, 180),
($q$Earl Grey syrup$q$, 2, $q$Strain out the leaves without pressing them.$q$, NULL),
($q$Earl Grey syrup$q$, 3, $q$Cool, bottle and keep in the fridge.$q$, NULL),
($q$Fig leaf soda$q$, 0, $q$Steep the dried fig leaf in the hot water, then strain it out.$q$, 600),
($q$Fig leaf soda$q$, 1, $q$Stir in the sugar and citric acid until fully dissolved, then cool.$q$, NULL),
($q$Fig leaf soda$q$, 2, $q$Add three times the syrup's volume of cold filtered water and chill to near 0 °C.$q$, NULL),
($q$Fig leaf soda$q$, 3, $q$Fill pressure-rated bottles to 75%, squeeze out the air and cap. Charge at about 45 psi and shake hard, rest a minute, vent.$q$, 60),
($q$Fig leaf soda$q$, 4, $q$Repeat the charge three times from flat. Keep cold and pour over ice.$q$, NULL),
($q$Finger lime cordial$q$, 0, $q$Dissolve the sugar in the water in a heavy saucepan, add the chopped finger limes and bring to the boil.$q$, NULL),
($q$Finger lime cordial$q$, 1, $q$Simmer gently until the liquid has dropped by about a third, roughly an hour. Longer gives a darker, stronger syrup.$q$, 3600),
($q$Finger lime cordial$q$, 2, $q$Strain out the fruit through a fine sieve and pour the syrup, still hot, into sterilised jars. Seal.$q$, NULL),
($q$Grapefruit sherbet$q$, 0, $q$Peel the grapefruit thinly, leaving the white pith behind, then juice and strain them.$q$, NULL),
($q$Grapefruit sherbet$q$, 1, $q$Muddle the peels into the sugar, cover and leave at room temperature until the oil has turned the sugar wet and syrupy.$q$, 86400),
($q$Grapefruit sherbet$q$, 2, $q$Lift out the peels and stir in the juice. Warm it gently, without boiling, just until the sugar dissolves.$q$, NULL),
($q$Grapefruit sherbet$q$, 3, $q$Cool, bottle and keep in the fridge.$q$, NULL),
($q$Grapefruit syrup$q$, 0, $q$Put the juice, sugar and zest strips in a small pan and warm gently, stirring, until the sugar dissolves. Bring just to a simmer but do not boil.$q$, NULL),
($q$Grapefruit syrup$q$, 1, $q$Take off the heat and leave to infuse.$q$, 1800),
($q$Grapefruit syrup$q$, 2, $q$Strain into a sealable bottle and keep cold. Shake before use.$q$, NULL),
($q$Habanero tincture$q$, 0, $q$Wearing gloves, pull the stems and seeds out of the habaneros.$q$, NULL),
($q$Habanero tincture$q$, 1, $q$Put the peppers in a jar, cover with the vodka and seal.$q$, NULL),
($q$Habanero tincture$q$, 2, $q$Leave at room temperature for one to two weeks, shaking now and then and tasting from day seven.$q$, NULL),
($q$Habanero tincture$q$, 3, $q$Strain out the peppers into dropper bottles and label each with what it is. Use by the dash.$q$, NULL),
($q$Horseradish vodka$q$, 0, $q$Push the lemon zest and horseradish ribbons into a clean 1 litre bottle, fill it with the vodka and seal.$q$, NULL),
($q$Horseradish vodka$q$, 1, $q$Leave in a dark place at room temperature. After a day or two, shake it gently.$q$, NULL),
($q$Horseradish vodka$q$, 2, $q$Infuse 2 or 3 more days and taste; give it up to 2 more days for a bolder flavour.$q$, NULL),
($q$Horseradish vodka$q$, 3, $q$Strain out the solids when it tastes right, then store in the freezer and serve very cold.$q$, NULL),
($q$House brine$q$, 0, $q$Put the olives in a glass jar and crush them firmly with a wooden spoon to release their juice.$q$, NULL),
($q$House brine$q$, 1, $q$Stir the water, vinegar and salt together until the salt dissolves, then pour over the olives to cover, leaving some headspace.$q$, NULL),
($q$House brine$q$, 2, $q$Seal and shake hard, then refrigerate. Shake before each use; it grows stronger as it sits.$q$, NULL),
($q$House-made cola$q$, 0, $q$Zest the citrus finely, then juice it and set the juice aside.$q$, NULL),
($q$House-made cola$q$, 1, $q$In a large pan, whisk the water, zests, cinnamon, bitter orange peel, coriander, nutmeg and gum arabic until the gum has dissolved.$q$, NULL),
($q$House-made cola$q$, 2, $q$Add the sugar and bring to the boil, stirring until it dissolves, then boil for 1 minute.$q$, 60),
($q$House-made cola$q$, 3, $q$Take off the heat and stir in the citrus juices, browning sauce and vanilla. Cool, strain fine, bottle and keep cold.$q$, NULL),
($q$House-made cola$q$, 4, $q$To serve, 1 part syrup to 3 parts cold seltzer over ice, or about 180 ml syrup to 780 ml water charged with CO2 in a 1 litre soda siphon.$q$, NULL),
($q$Jalapeno tequila$q$, 0, $q$Cut the stems off the jalapeños and slice them into thin rounds or strips. Keep the seeds in for more heat, or leave some out for less.$q$, NULL),
($q$Jalapeno tequila$q$, 1, $q$Put the peppers in a jar, pour in the tequila, seal and shake.$q$, NULL),
($q$Jalapeno tequila$q$, 2, $q$Leave in a cool, dark place, shaking now and then. Taste after one night and every few hours after; most batches are hot enough by day two.$q$, NULL),
($q$Jalapeno tequila$q$, 3, $q$Strain out the peppers and seeds when it tastes right and pour the tequila back into its bottle.$q$, NULL),
($q$Jasmine foam$q$, 0, $q$Steep the jasmine pearls in the 60 to 70 °C water, then lift or strain them out so no leaf reaches the siphon valve.$q$, 600),
($q$Jasmine foam$q$, 1, $q$Stir in the sugar and the three acids until dissolved.$q$, NULL),
($q$Jasmine foam$q$, 2, $q$Add the methylcellulose and xanthan and blend with a stick blender until smooth.$q$, NULL),
($q$Jasmine foam$q$, 3, $q$Pour into a cream whipper, charge with two N2O chargers and shake between charges.$q$, NULL),
($q$Jasmine foam$q$, 4, $q$Chill in the fridge before dispensing, then shake once and dispense upside down onto the drink.$q$, 7200),
($q$Jasmine syrup$q$, 0, $q$Put the tea, sugar and water in a small pot and bring to the boil.$q$, NULL),
($q$Jasmine syrup$q$, 1, $q$Simmer uncovered over medium heat, stirring until the sugar dissolves, for 10 to 15 minutes.$q$, 600),
($q$Jasmine syrup$q$, 2, $q$Cool to room temperature, strain out the tea and keep cold in an airtight bottle.$q$, NULL),
($q$Lemongrass mezcal$q$, 0, $q$Put the sliced lemongrass and the spirit in a 0.5 litre whipper and close it.$q$, NULL),
($q$Lemongrass mezcal$q$, 1, $q$Charge with one N2O charger and shake, then add a second charger and shake again. The whole infusion takes about 2 minutes.$q$, 120),
($q$Lemongrass mezcal$q$, 2, $q$Hold the whipper upright, cover the nozzle with a glass and vent fast. Open it once the bubbling stops.$q$, NULL),
($q$Lemongrass mezcal$q$, 3, $q$Strain, pressing the lemongrass hard to get the spirit back. Let it rest 10 minutes before using, and use it fresh.$q$, 600),
($q$Lemongrass shochu$q$, 0, $q$Put the sliced lemongrass and the spirit in a 0.5 litre whipper and close it.$q$, NULL),
($q$Lemongrass shochu$q$, 1, $q$Charge with one N2O charger and shake, then add a second charger and shake again. The whole infusion takes about 2 minutes.$q$, 120),
($q$Lemongrass shochu$q$, 2, $q$Hold the whipper upright, cover the nozzle with a glass and vent fast. Open it once the bubbling stops.$q$, NULL),
($q$Lemongrass shochu$q$, 3, $q$Strain, pressing the lemongrass hard to get the spirit back. Let it rest 10 minutes before using, and use it fresh.$q$, 600),
($q$Osmanthus syrup$q$, 0, $q$Boil the sugar and water over medium heat until the sugar has fully dissolved.$q$, NULL),
($q$Osmanthus syrup$q$, 1, $q$Lower the heat, add the dried osmanthus and simmer gently.$q$, 180),
($q$Osmanthus syrup$q$, 2, $q$Off the heat, stir in the honey if using and let it steep.$q$, 600),
($q$Osmanthus syrup$q$, 3, $q$Strain through a fine sieve (or leave the flowers in), cool and seal.$q$, NULL),
($q$Pepperberry tincture$q$, 0, $q$Coarsely crack the pepperberries and put them in a clean jar with the spirit.$q$, NULL),
($q$Pepperberry tincture$q$, 1, $q$Seal and steep 3 to 5 days somewhere cool and dark, shaking gently once a day.$q$, NULL),
($q$Pepperberry tincture$q$, 2, $q$Strain twice through a fine strainer lined with cheesecloth into a dropper bottle. Label it and store cool and dark.$q$, NULL),
($q$Piloncillo syrup$q$, 0, $q$Break the piloncillo into pieces so it melts faster, then bring it and the water to a light boil.$q$, NULL),
($q$Piloncillo syrup$q$, 1, $q$Turn the heat down and simmer, stirring, until it has all melted.$q$, 600),
($q$Piloncillo syrup$q$, 2, $q$Cool, strain into an airtight container and keep cold.$q$, NULL),
($q$Plum syrup$q$, 0, $q$Put the sugar, water and pitted plums in a small saucepan and bring to the boil.$q$, NULL),
($q$Plum syrup$q$, 1, $q$Simmer until the sugar has dissolved, tasting now and then until the plum comes through.$q$, NULL),
($q$Plum syrup$q$, 2, $q$Let it cool, strain out the fruit and keep somewhere cool.$q$, NULL),
($q$Popcorn syrup$q$, 0, $q$Warm the sugar, water and salt to a simmer and cook a couple of minutes until the sugar has dissolved.$q$, NULL),
($q$Popcorn syrup$q$, 1, $q$Stir in the popped popcorn, take it off the heat and let it cool.$q$, NULL),
($q$Popcorn syrup$q$, 2, $q$Jar it with a tight lid and leave in the fridge at least a day.$q$, 86400),
($q$Popcorn syrup$q$, 3, $q$Strain out the popcorn, pressing lightly, and keep the syrup cold.$q$, NULL),
($q$Rose syrup$q$, 0, $q$Pour the boiling water over the dried rose petals and leave them to steep.$q$, 1800),
($q$Rose syrup$q$, 1, $q$Strain, pressing the petals lightly. Stir in the rose water, then add hot water to bring the liquid back to 240 ml.$q$, NULL),
($q$Rose syrup$q$, 2, $q$Stir in the sugar until it dissolves. Cover and keep cold.$q$, NULL),
($q$Rosemary syrup$q$, 0, $q$Put the sugar, water and rosemary in a small pan.$q$, NULL),
($q$Rosemary syrup$q$, 1, $q$Warm over low heat, stirring, just until the sugar has dissolved.$q$, NULL),
($q$Rosemary syrup$q$, 2, $q$Take it off the heat and let it cool with the rosemary still in.$q$, NULL),
($q$Rosemary syrup$q$, 3, $q$Lift out the sprigs, bottle and keep in the fridge.$q$, NULL),
($q$Salt air$q$, 0, $q$Stir the lime juice, water, salt and lecithin together in a wide bowl until the salt and lecithin dissolve.$q$, NULL),
($q$Salt air$q$, 1, $q$Tip the bowl away from you and run a stick blender in the far corner, half out of the liquid, until about 2.5 cm of air sits on top.$q$, NULL),
($q$Salt air$q$, 2, $q$Let it settle for a minute, then spoon the air onto the drink.$q$, 60),
($q$Salt air$q$, 3, $q$When the air is used up, blend again. Keep the leftover liquid cold.$q$, NULL),
($q$Spiced cold brew$q$, 0, $q$Put the coffee and spices in a large French press or jug.$q$, NULL),
($q$Spiced cold brew$q$, 1, $q$Pour in the water, stir and refrigerate overnight.$q$, NULL),
($q$Spiced cold brew$q$, 2, $q$Press the plunger, or strain through a fine filter, and keep cold.$q$, NULL),
($q$Spiced salt$q$, 0, $q$Grate the lime zest finely into a bowl, leaving the white pith behind.$q$, NULL),
($q$Spiced salt$q$, 1, $q$Add the salt and rub or whisk until the zest is spread evenly with no clumps.$q$, NULL),
($q$Spiced salt$q$, 2, $q$Whisk in the sugar, chile powder and habanero if using. Store airtight.$q$, NULL),
($q$Spicy tequila$q$, 0, $q$Cut the stems off the jalapeños and slice them into thin rounds or strips. Keep the seeds in for more heat, or leave some out for less.$q$, NULL),
($q$Spicy tequila$q$, 1, $q$Put the peppers in a jar, pour in the tequila, seal and shake.$q$, NULL),
($q$Spicy tequila$q$, 2, $q$Leave in a cool, dark place, shaking now and then. Taste after one night and every few hours after; most batches are hot enough by day two.$q$, NULL),
($q$Spicy tequila$q$, 3, $q$Strain out the peppers and seeds when it tastes right and pour the tequila back into its bottle.$q$, NULL),
($q$Spicy tincture$q$, 0, $q$Wearing gloves, remove the stems and seeds from the habaneros.$q$, NULL),
($q$Spicy tincture$q$, 1, $q$Put them in a sealable jar with the vodka.$q$, NULL),
($q$Spicy tincture$q$, 2, $q$Leave at room temperature, tasting as it goes; about a week for full heat.$q$, NULL),
($q$Spicy tincture$q$, 3, $q$Strain into dropper bottles and label each with what it is. Use a few drops per drink.$q$, NULL),
($q$Strawberry cream$q$, 0, $q$Stir the cream, milk and strawberry syrup together in a French press, leaving room for it to swell.$q$, NULL),
($q$Strawberry cream$q$, 1, $q$Pump the plunger up and down about 40 times until it thickens to a soft, pourable foam.$q$, NULL),
($q$Strawberry cream$q$, 2, $q$Spoon onto the drink. Keep any extra cold and re-whip briefly before use.$q$, NULL),
($q$Yoghurt whey$q$, 0, $q$Line a sieve with cheesecloth or a coffee filter and set it over a bowl or jug.$q$, NULL),
($q$Yoghurt whey$q$, 1, $q$Spoon in the yoghurt and leave it about an hour, then move the whole setup to the fridge.$q$, 3600),
($q$Yoghurt whey$q$, 2, $q$Drain in the fridge until the next day, about 24 hours in all. Keep the thick yoghurt for something else.$q$, 86400),
($q$Yoghurt whey$q$, 3, $q$Pour the whey into a clean bottle and keep it cold.$q$, NULL),
($q$Yuzu foam$q$, 0, $q$Blend the yuzu juice, syrup and lecithin until the lecithin has fully dissolved, then chill the base.$q$, NULL),
($q$Yuzu foam$q$, 1, $q$Pour into a wide, shallow container, deep enough to cover most of the blender head.$q$, NULL),
($q$Yuzu foam$q$, 2, $q$Blend with the blades tilted up at the surface so they pull in air, just until a dense foam builds on top.$q$, NULL),
($q$Yuzu foam$q$, 3, $q$Rest a moment, then spoon the foam off onto the drink. Repeat as needed and serve straight away.$q$, 60);

INSERT INTO source_in VALUES
($q$Champagne syrup$q$, $q$recipe$q$, $q$https://cocktailsdistilled.com/champagne-syrup/$q$, $q$reference$q$, DATE '2026-10-14', $q$Cocktails Distilled (Tiff Christie): 1 cup Champagne to 1 cup sugar, dissolved over very low heat. Cup as 240 ml wine, 200 g sugar. Its keep is only "a few weeks", too vague to use.$q$),
($q$Chile de arbol tincture$q$, $q$recipe$q$, $q$https://www.tastingtable.com/687416/the-ultimate-margarita-recipe-la-dona/$q$, $q$reference$q$, DATE '2026-10-14', $q$Tasting Table's La Doña, adapted from Jeret Peña: 20 árbol chiles in 1 3/4 cups grain alcohol, 2 weeks at room temperature, shaken daily. Cups at 240 ml.$q$),
($q$Chili tincture$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/green-pepper/$q$, $q$reference$q$, DATE '2026-10-14', $q$Shawn Lickliter and Vay Su, Vandell (Punch, Green Pepper): their chili tincture is 5 chopped habaneros in 500 ml vodka, sous vide at 145 F for 2 hours or overnight at room temperature, fine strained.$q$),
($q$Chipotle syrup$q$, $q$recipe$q$, $q$https://patijinich.com/chipotle-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-14', $q$Pati Jinich: 1 cup sugar, 1 cup water, 1 dried chipotle, boiled until dissolved, rested 48 h to a week. Cup as 200 g sugar, 240 ml water. Her yield of 1 cup reads low for these amounts, so ours is worked out.$q$),
($q$Clarified banana$q$, $q$recipe$q$, $q$https://classbarmag.com/news/fullstory.php/aid/1968/Three_ways_to_clarify_cocktails.html$q$, $q$reference$q$, DATE '2026-10-14', $q$Stu Bale of Crucible (CLASS magazine): Pectinex at 2 g per kg of banana flesh, 10 minutes rest, 10 minutes in the centrifuge at 5,000 rpm, then superbag and coffee filter. Scaled to 1 kg.$q$),
($q$Desert lime cordial$q$, $q$recipe$q$, $q$https://anpsa.org.au/APOL30/jun03-3a.html$q$, $q$reference$q$, DATE '2026-10-14', $q$Australian Native Plants Society wild lime syrup (after Robbins, Wild Classics, 2000): 1 1/4 cups sugar, 1 cup water, 1/4 cup chopped wild limes, finger lime given as the example. We apply the same ratio to desert lime, another Australian wild lime.$q$),
($q$Earl Grey syrup$q$, $q$recipe$q$, $q$https://twisttravelmag.com/earl-grey-simple-syrup-recipe/$q$, $q$reference$q$, DATE '2026-10-14', $q$Keryn Means: 1 cup water, 1 cup cane sugar, 3 tsp loose Earl Grey (or 3 bags), sugar dissolved first, tea steeped 3 to 4 min off the heat. Converted (cup sugar 200 g, cup water 240 ml) and doubled. We use this source's tea dose and short steep.$q$),
($q$Earl Grey syrup$q$, $q$recipe$q$, $q$https://www.milkglasshome.com/earl-grey-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$Same 1 cup sugar to 1 cup water; uses 2 tsp loose tea (or 2 bags) left in while the syrup cools. Sugar to water agrees exactly with the first source; tea is lighter because it steeps longer.$q$),
($q$Earl Grey syrup$q$, $q$yield$q$, $q$https://www.milkglasshome.com/earl-grey-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$About 1.5 cups from 1 cup each of sugar and water; doubled to 720 ml.$q$),
($q$Earl Grey syrup$q$, $q$keeps$q$, $q$https://twisttravelmag.com/earl-grey-simple-syrup-recipe/$q$, $q$reference$q$, DATE '2026-10-14', $q$About a week in the fridge for this syrup (or months frozen). The shorter of the two keeps, so it wins.$q$),
($q$Earl Grey syrup$q$, $q$keeps$q$, $q$https://www.milkglasshome.com/earl-grey-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$3 to 4 weeks sealed in the fridge; short end 3 weeks.$q$),
($q$Fig leaf soda$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/new-tone/$q$, $q$reference$q$, DATE '2026-10-14', $q$Punch (Claire Sprouse): syrup of 1 quart hot water, 1/4 cup dried fig leaf steeped 10 min, 1 quart superfine sugar, 1 tbsp citric acid; soda is 2 oz syrup to 6 oz water, carbonated. Quartered; 1 cup sugar at 200 g.$q$),
($q$Fig leaf soda$q$, $q$recipe$q$, $q$https://wpr.org/food/larry-loved-homemade-soda$q$, $q$reference$q$, DATE '2026-10-14', $q$Second check: toasted fig leaf syrup at 1 cup sugar to 1 cup water, the same 1:1 by volume as Punch (both about 0.83 g sugar per ml water). Leaf dose differs (fresh toasted leaves there); we follow Punch.$q$),
($q$Finger lime cordial$q$, $q$recipe$q$, $q$https://anpsa.org.au/APOL30/jun03-3a.html$q$, $q$reference$q$, DATE '2026-10-14', $q$Australian Native Plants Society recipe page, after Robbins, Wild Classics (2000): 1 1/4 cups sugar, 1 cup water, 1/4 cup chopped wild limes such as finger limes, simmered about an hour to reduce by a third. Cups converted at 240 ml, sugar at 200 g per cup.$q$),
($q$Grapefruit sherbet$q$, $q$recipe$q$, $q$https://the83k.substack.com/p/cocktail-nerdery-from-doctor-z-sherbet$q$, $q$reference$q$, DATE '2026-10-14', $q$Citrus sherbet: peels in sugar, covered, at least 24 h, then juice equal to the sugar, warmed until dissolved. Names grapefruit as a best fruit for it and counts about 8 oz juice per grapefruit, peeling as much fruit as you juice. Scaled to 500 g sugar and 500 ml juice.$q$),
($q$Grapefruit sherbet$q$, $q$recipe$q$, $q$https://cocktailsandbars.com/how-to-make-lemon-sherbet/$q$, $q$reference$q$, DATE '2026-10-14', $q$Lemon sherbet at 120 g sugar to 120 ml juice: shows the 1:1 read as grams of sugar to ml of juice, which we use for grapefruit.$q$),
($q$Grapefruit sherbet$q$, $q$keeps$q$, $q$https://veggiedesserts.com/wprm_print/grapefruit-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$Grapefruit syrup at 200 g sugar to 240 ml juice (less sugar than ours, though simmered 10 min) keeps 2 to 3 weeks; short end 2 weeks. We keep the catalog's shorter 168 h since ours is only warmed.$q$),
($q$Grapefruit syrup$q$, $q$recipe$q$, $q$https://www.littlesugarsnaps.com/wprm_print/grapefruit-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$Little Sugar Snaps (Jane Coupland): 100 ml red or pink grapefruit juice, 2 strips zest, 75 g sugar (100 g for white grapefruit), infused 30 min off the heat. Optional rosemary left out.$q$),
($q$Grapefruit syrup$q$, $q$yield$q$, $q$https://www.littlesugarsnaps.com/wprm_print/grapefruit-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$8 servings of 15 ml, so 120 ml.$q$),
($q$Grapefruit syrup$q$, $q$keeps$q$, $q$https://www.littlesugarsnaps.com/grapefruit-syrup/$q$, $q$reference$q$, DATE '2026-10-14', $q$Up to 4 weeks in the fridge, for this recipe.$q$),
($q$Habanero tincture$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/the-pastry-wars-spicy-with-tequila/$q$, $q$reference$q$, DATE '2026-10-14', $q$Bobby Heugel, The Pastry War (Punch): 12 seeded, destemmed habaneros in 1 litre of vodka for two weeks. 12 peppers a litre; we use this ratio.$q$),
($q$Habanero tincture$q$, $q$recipe$q$, $q$https://www.tastingtable.com/688747/border-storm-cocktail-recipe-from-anvil-bar-refuge/$q$, $q$reference$q$, DATE '2026-10-14', $q$Anvil Bar & Refuge (Tasting Table): 6 seeded habaneros in 2 cups (480 ml) vodka, one week at room temperature, then strained. About 12.5 peppers a litre, within 4% of the Pastry War ratio.$q$),
($q$Horseradish vodka$q$, $q$recipe$q$, $q$https://www.jewishfoodsociety.org/recipes/hrenovuha-horseradish-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Sasha Shor (Jewish Food Society): a 5 inch piece of horseradish in ribbons and the zest of 1 large lemon in 1 litre of vodka, 4 to 6 days in the dark, then frozen.$q$),
($q$Horseradish vodka$q$, $q$recipe$q$, $q$https://www.sunset.com/recipe/horseradish-infused-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Bonnie Frumkin Morales (Sunset): 1 sliced horseradish root steeped in a quart (about 950 ml) of vodka for a week, then strained. About one root per litre, like Shor's.$q$),
($q$Horseradish vodka$q$, $q$yield$q$, $q$https://www.jewishfoodsociety.org/recipes/hrenovuha-horseradish-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Makes 1 litre.$q$),
($q$House brine$q$, $q$recipe$q$, $q$https://www.lovetoknow.com/food-drink/cocktails/dirty-martini-olive-juice$q$, $q$reference$q$, DATE '2026-10-14', $q$Karen Frazier (LoveToKnow), olive juice for Dirty Martinis: 2 cups green olives, 2 1/2 cups water, 2 tbsp vinegar, 2 tbsp salt; 1/2 to 1 oz per drink. Cups at 240 ml, olives kept as ml.$q$),
($q$House-made cola$q$, $q$recipe$q$, $q$https://www.splendidtable.org/recipes/natural-cola$q$, $q$reference$q$, DATE '2026-10-14', $q$Andrew Schloss (Homemade Soda): 1 quart water, zest and juice of 1 lemon, 1 lime, 2 oranges, 3 cinnamon sticks, 2 tbsp dried bitter orange peel, 2 tsp coriander, 1/4 tsp nutmeg, 1 tsp gum arabic, 2 lb sugar, 1/4 cup browning sauce, 1/2 tsp vanilla. Quart at 960 ml, 2 lb at 907 g, 1/4 cup at 60 ml.$q$),
($q$House-made cola$q$, $q$recipe$q$, $q$https://www.mrdistilling.com/recipe/cola-syrup/$q$, $q$reference$q$, DATE '2026-10-14', $q$Second check: 8 cups water to 8 cups demerara with 2 each lemon, lime and orange, cinnamon, coriander, nutmeg, vanilla. At 200 g a cup that is 0.83 g sugar per ml water against our 0.94 (about 12% apart). We use the Schloss amounts because they are measured and give a keep.$q$),
($q$House-made cola$q$, $q$keeps$q$, $q$https://www.splendidtable.org/recipes/natural-cola$q$, $q$reference$q$, DATE '2026-10-14', $q$This same cola syrup: up to 2 weeks in the fridge.$q$),
($q$Jalapeno tequila$q$, $q$recipe$q$, $q$https://www.tastingtable.com/694360/jalapeno-infused-tequila/$q$, $q$reference$q$, DATE '2026-10-14', $q$Carey Jones (Tasting Table): two medium jalapeños, sliced with their seeds, to a 750 ml bottle of 100% agave tequila, left overnight then strained.$q$),
($q$Jalapeno tequila$q$, $q$recipe$q$, $q$https://www.theinfatuation.com/cocktails/c/cocktails-how-to-make-jalapeno-tequila$q$, $q$reference$q$, DATE '2026-10-14', $q$Bryan Kim (The Infatuation): two jalapeños, about 50 g, in rounds, to a 750 ml bottle of blanco tequila, two days in a cool dark place, a day more if it needs heat. Same ratio as Tasting Table.$q$),
($q$Jasmine foam$q$, $q$recipe$q$, $q$https://www.goodandpropertea.com/blogs/all/how-to-make-the-pirates-of-good-proper-the-curse-of-the-jasmine-pearl-tea-cocktail$q$, $q$producer$q$, DATE '2026-10-14', $q$Tea producer's cocktail recipe: 5 g jasmine pearls steeped 10 min in 300 ml water at 60 to 70 °C, then 30 g sugar, 0.5 g each citric, malic and tartaric acid, 1.8 g methylcellulose 50, 0.5 g xanthan; two N2O charges, at least 2 h cold before use.$q$),
($q$Jasmine syrup$q$, $q$recipe$q$, $q$https://carmyy.com/wprm_print/jasmine-syrup-recipe$q$, $q$reference$q$, DATE '2026-10-14', $q$Carmy: 4 tsp jasmine tea (or 4 bags), 1 cup sugar, 1 1/2 cups water, simmered 10 to 15 min. Cup as 200 g sugar, 240 ml water. Gives no keep.$q$),
($q$Lemongrass mezcal$q$, $q$recipe$q$, $q$https://www.cutoutandkeep.net/projects/the-lemon-pepper-fizz-and-lemongrass-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Dave Arnold (Liquid Intelligence, reproduced with permission): 180 g fresh lemongrass to 300 ml 40% vodka, two N2O chargers in a 0.5 litre whipper, 2 minutes. He uses the whipper because long lemongrass soaks taste soapy. We swap the vodka for mezcal.$q$),
($q$Lemongrass mezcal$q$, $q$yield$q$, $q$https://www.cutoutandkeep.net/projects/the-lemon-pepper-fizz-and-lemongrass-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Arnold's vodka batch makes about 270 ml after pressing; we assume the same for mezcal.$q$),
($q$Lemongrass mezcal$q$, $q$keeps$q$, $q$https://www.cutoutandkeep.net/projects/the-lemon-pepper-fizz-and-lemongrass-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Arnold: use it fresh, within a day or two; kept in the freezer about a week. We take the short end, 24 hours.$q$),
($q$Lemongrass shochu$q$, $q$recipe$q$, $q$https://www.cutoutandkeep.net/projects/the-lemon-pepper-fizz-and-lemongrass-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Dave Arnold (Liquid Intelligence, reproduced with permission): 180 g fresh lemongrass to 300 ml 40% vodka, two N2O chargers in a 0.5 litre whipper, 2 minutes. He uses the whipper because long lemongrass soaks taste soapy. We swap the vodka for shochu.$q$),
($q$Lemongrass shochu$q$, $q$yield$q$, $q$https://www.cutoutandkeep.net/projects/the-lemon-pepper-fizz-and-lemongrass-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Arnold's vodka batch makes about 270 ml after pressing; we assume the same for shochu.$q$),
($q$Lemongrass shochu$q$, $q$keeps$q$, $q$https://www.cutoutandkeep.net/projects/the-lemon-pepper-fizz-and-lemongrass-vodka$q$, $q$reference$q$, DATE '2026-10-14', $q$Arnold: use it fresh, within a day or two; kept in the freezer about a week. We take the short end, 24 hours.$q$),
($q$Osmanthus syrup$q$, $q$recipe$q$, $q$https://www.siftandsimmer.com/wprm_print/osmanthus-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$Sift & Simmer: 1/2 cup sugar, 1/2 cup water, 3 tbsp dried osmanthus, 1 tsp honey optional; simmer 3 to 5 min, steep 10 min. Cup as 200 g sugar, 240 ml water.$q$),
($q$Osmanthus syrup$q$, $q$keeps$q$, $q$https://www.siftandsimmer.com/wprm_print/osmanthus-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$Up to 2 weeks in the fridge, for this recipe.$q$),
($q$Pepperberry tincture$q$, $q$recipe$q$, $q$https://cocktailsandbars.com/australian-native-tinctures-wattleseed-lemon-myrtle-pepperberry/$q$, $q$reference$q$, DATE '2026-10-14', $q$Corinne Mossati, Cocktails & Bars (Aug 2017): 7 g cracked whole pepperberries in 100 ml vodka over 50% ABV (or high-proof neutral spirit), 3 to 5 days, shaken daily, strained twice through cheesecloth.$q$),
($q$Piloncillo syrup$q$, $q$recipe$q$, $q$https://mybartender.com/wprm_print/piloncillo-simple-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$MyBartender (Jenna Haley): one 8 oz piloncillo cone with 1 cup water, simmered 10 min; cinnamon and cloves optional and left out here. 8 oz as 227 g, cup as 240 ml.$q$),
($q$Piloncillo syrup$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/agave-gracias/$q$, $q$reference$q$, DATE '2026-10-14', $q$Punch (Agave Gracias): equal volumes of chopped piloncillo and water, boiled and strained; agrees on a roughly 1:1 syrup.$q$),
($q$Piloncillo syrup$q$, $q$keeps$q$, $q$https://mybartender.com/wprm_print/piloncillo-simple-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$1 to 2 weeks in the fridge; short end taken.$q$),
($q$Piloncillo syrup$q$, $q$keeps$q$, $q$https://punchdrink.com/recipes/agave-gracias/$q$, $q$reference$q$, DATE '2026-10-14', $q$Up to a month in the fridge; the shorter keep wins.$q$),
($q$Plum syrup$q$, $q$recipe$q$, $q$https://vinepair.com/cocktail-recipe/the-plum-sour-recipe/$q$, $q$reference$q$, DATE '2026-10-14', $q$VinePair (Plum Sour): 1 cup sugar, 1 cup water, 3 pitted plums, boiled then simmered until dissolved. Cup as 200 g sugar, 240 ml water. Gives no keep.$q$),
($q$Popcorn syrup$q$, $q$recipe$q$, $q$https://www.hungrycouplenyc.com/2018/02/buttered-bourbon-pop-tail.html$q$, $q$reference$q$, DATE '2026-10-14', $q$Hungry Couple (Anita Schecter): 1/2 cup sugar, 1 cup water, 3 cups popcorn, pinch of sea salt, steeped at least 24 h cold. Sugar:water 1:2 by volume; cup as 200 g sugar, 240 ml water.$q$),
($q$Popcorn syrup$q$, $q$recipe$q$, $q$https://www.cloverfoodlab.com/popcorn-soda/$q$, $q$reference$q$, DATE '2026-10-14', $q$Clover Food Lab popcorn soda syrup: 3 cups sugar to 6 cups water, the same 1:2 by volume, with popped popcorn blended in and strained (3 cups per 6 cups water, a lighter dose). We use the shared 1:2 ratio and the Hungry Couple popcorn dose.$q$),
($q$Popcorn syrup$q$, $q$keeps$q$, $q$https://www.hungrycouplenyc.com/2018/02/buttered-bourbon-pop-tail.html$q$, $q$reference$q$, DATE '2026-10-14', $q$Up to a week in the fridge after straining, for this recipe.$q$),
($q$Rose syrup$q$, $q$recipe$q$, $q$https://imbibemagazine.com/how-to-make-simple-syrups/Rose-Syrup-Recipe$q$, $q$reference$q$, DATE '2026-10-14', $q$Imbibe (Erick Castro): 1/4 cup dried rose petals steeped 30 min in 1 cup boiling water, 1/4 tsp rose water, 1 cup sugar (gum arabic optional, left out). Sugar:water 1:1 by volume; cup as 240 ml water, 200 g sugar, 1/4 cup petals as 4 tbsp.$q$),
($q$Rose syrup$q$, $q$recipe$q$, $q$https://fareisle.com/wprm_print/rose-petal-simple-syrup$q$, $q$reference$q$, DATE '2026-10-14', $q$Fare Isle: 1 cup sugar to 1 cup boiling water, petals steeped first then sugar added. Same 1:1 sugar to water by volume as Imbibe, so we use that ratio; Fare Isle uses far more petals (2 cups), we keep Imbibe's lighter dose.$q$),
($q$Rose syrup$q$, $q$keeps$q$, $q$https://imbibemagazine.com/how-to-make-simple-syrups/Rose-Syrup-Recipe$q$, $q$reference$q$, DATE '2026-10-14', $q$Up to 2 weeks in the fridge for this recipe (Fare Isle says a month; the shorter wins).$q$),
($q$Rosemary syrup$q$, $q$recipe$q$, $q$https://www.foodnetwork.com/recipes/food-network-kitchen/rosemary-greyhound-cocktail-3363162$q$, $q$reference$q$, DATE '2026-10-14', $q$Food Network Kitchen rosemary simple syrup: 1 cup sugar, 1 cup water, 1 sprig rosemary, warmed low until dissolved and cooled with the sprig in. Converted (cup sugar 200 g, cup water 240 ml) and doubled.$q$),
($q$Rosemary syrup$q$, $q$yield$q$, $q$https://www.foodnetwork.com/recipes/food-network-kitchen/rosemary-greyhound-cocktail-3363162$q$, $q$reference$q$, DATE '2026-10-14', $q$Makes 1.5 cups per batch; doubled to 3 cups, 720 ml.$q$),
($q$Rosemary syrup$q$, $q$keeps$q$, $q$https://www.foodnetwork.com/recipes/food-network-kitchen/rosemary-greyhound-cocktail-3363162$q$, $q$reference$q$, DATE '2026-10-14', $q$Up to 1 month sealed in the fridge for this same syrup; we keep the catalog's shorter 3 weeks.$q$),
($q$Salt air$q$, $q$recipe$q$, $q$https://washingtonian.com/?p=80457$q$, $q$reference$q$, DATE '2026-10-14', $q$Washingtonian (2007), a restaurant's salt air for margaritas: 1 cup lime juice, 2 cups water, 1 tbsp kosher salt, 1/2 tsp soy lecithin, blended at a tilted bowl until about an inch of foam forms. Cups at 240 ml.$q$),
($q$Salt air$q$, $q$keeps$q$, $q$https://washingtonian.com/?p=80457$q$, $q$reference$q$, DATE '2026-10-14', $q$The unwhipped mix keeps several days in the fridge; we read that as at least 2 days and keep the catalog's shorter 24 h.$q$),
($q$Spiced cold brew$q$, $q$recipe$q$, $q$https://www.frontiercoop.com/recipes/chai-spiced-cold-brew-iced-coffee$q$, $q$producer$q$, DATE '2026-10-14', $q$Frontier Co-op (spice producer): 1/3 cup ground coffee, 1/2 tsp cinnamon, 1/2 tsp cardamom powder, 1/4 tsp turmeric, a pinch of saffron, 2 cups water, refrigerated overnight in a French press. Scaled x4; cups at 240 ml.$q$),
($q$Spiced salt$q$, $q$recipe$q$, $q$https://www.thespicehouse.com/blogs/recipes/hot-chile-lime-margarita-salt$q$, $q$producer$q$, DATE '2026-10-14', $q$The Spice House: 1/2 cup kosher salt, zest of 1 lime, 1 tbsp hot chili powder, 1 tbsp cane sugar, optional 1/2 tsp ground habanero. 1/2 cup taken as 8 tbsp.$q$),
($q$Spiced salt$q$, $q$yield$q$, $q$https://www.thespicehouse.com/blogs/recipes/hot-chile-lime-margarita-salt$q$, $q$producer$q$, DATE '2026-10-14', $q$Makes 1/2 cup (120 ml).$q$),
($q$Spiced salt$q$, $q$keeps$q$, $q$https://www.thespicehouse.com/blogs/recipes/hot-chile-lime-margarita-salt$q$, $q$producer$q$, DATE '2026-10-14', $q$This same salt keeps a few months airtight, best within weeks; taken at the short end, 2 months.$q$),
($q$Spicy tequila$q$, $q$recipe$q$, $q$https://www.tastingtable.com/694360/jalapeno-infused-tequila/$q$, $q$reference$q$, DATE '2026-10-14', $q$Carey Jones (Tasting Table): two medium jalapeños, sliced with their seeds, to a 750 ml bottle of 100% agave tequila, left overnight then strained.$q$),
($q$Spicy tequila$q$, $q$recipe$q$, $q$https://www.theinfatuation.com/cocktails/c/cocktails-how-to-make-jalapeno-tequila$q$, $q$reference$q$, DATE '2026-10-14', $q$Bryan Kim (The Infatuation): two jalapeños, about 50 g, in rounds, to a 750 ml bottle of blanco tequila, two days in a cool dark place, a day more if it needs heat. Same ratio as Tasting Table.$q$),
($q$Spicy tincture$q$, $q$recipe$q$, $q$https://www.tastingtable.com/688747/border-storm-cocktail-recipe-from-anvil-bar-refuge/$q$, $q$reference$q$, DATE '2026-10-14', $q$Anvil Bar & Refuge (Tasting Table): 6 seeded habaneros in 2 cups (480 ml) vodka, one week at room temperature. We use this ratio. Cups at 240 ml.$q$),
($q$Spicy tincture$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/the-pastry-wars-spicy-with-tequila/$q$, $q$reference$q$, DATE '2026-10-14', $q$The Pastry War (Punch): 12 seeded habaneros per litre of vodka for two weeks, within 4% of Anvil's 12.5 a litre.$q$),
($q$Strawberry cream$q$, $q$recipe$q$, $q$https://www.ohhowcivilized.com/strawberry-cold-foam$q$, $q$reference$q$, DATE '2026-10-14', $q$Jee Choe: 1/4 cup heavy cream, 2 tbsp 2% milk, 2 tbsp strawberry syrup per serve, pumped 40 times in a French press. Scaled x4; cups at 240 ml, tbsp at 15 ml.$q$),
($q$Strawberry cream$q$, $q$keeps$q$, $q$https://www.ohhowcivilized.com/strawberry-cold-foam$q$, $q$reference$q$, DATE '2026-10-14', $q$This same strawberry cold foam: up to 2 days in the fridge.$q$),
($q$Yoghurt whey$q$, $q$recipe$q$, $q$https://www.kingarthurbaking.com/blog/2012/04/20/beyond-greek-yogurt-%E2%80%93-a-bakers-secret$q$, $q$reference$q$, DATE '2026-10-14', $q$PJ Hamel (King Arthur Baking): a quart of plain yoghurt drained 24 hours, an hour out then in the fridge. Quart at 4 cups, 240 ml a cup.$q$),
($q$Yoghurt whey$q$, $q$yield$q$, $q$https://www.kingarthurbaking.com/blog/2012/04/20/beyond-greek-yogurt-%E2%80%93-a-bakers-secret$q$, $q$reference$q$, DATE '2026-10-14', $q$A quart of yoghurt gives about 16 fl oz of whey (2 cups, 480 ml); a pint gives about 8 fl oz.$q$),
($q$Yuzu foam$q$, $q$recipe$q$, $q$https://marxfood.com/frozen-yuzu-air-recipe/$q$, $q$retailer$q$, DATE '2026-10-14', $q$Marx Foods (Sarah Mickey): 6 tbsp yuzu juice, 4 tbsp 1:1 simple syrup, 0.375 g lecithin; scale at about 1.5 g lecithin per 500 g liquid. Tbsp at 15 ml. The source freezes the air as a palate cleanser; we serve it fresh on the drink.$q$);

-- A shared ingredient by name, else by alias.
CREATE FUNCTION pg_temp.shared(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT public.resolve_ingredient(p_name);
$$;
-- A style (or a prep standing in as one, "Falernum") by name.
CREATE FUNCTION pg_temp.style(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT COALESCE(
        (SELECT i.id FROM public.items i
          WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role IN ('generic', 'prep')
            AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
          ORDER BY (i.ingredient_role = 'generic') DESC, i.is_core DESC, i.created_at LIMIT 1),
        (SELECT i.id FROM public.ingredient_aliases a JOIN public.items i ON i.id = a.item_id
          WHERE a.key = public.ingredient_key(p_name) AND i.bar_id IS NULL AND i.ingredient_role IN ('generic', 'prep')));
$$;
-- Changing a style trips guard_ingredient_name when another ingredient goes
-- by the prep's name; those keep the style they have.
CREATE FUNCTION pg_temp.name_free(p_id uuid, p_name text) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT NOT EXISTS (SELECT 1 FROM public.ingredient_aliases a
                        WHERE a.key = public.ingredient_key(p_name) AND a.item_id <> p_id);
$$;

-- --- Plain ingredients the lines need ---
DO $$
DECLARE s record; v uuid;
BEGIN
    FOR s IN SELECT * FROM stub_in ORDER BY name LOOP
        IF pg_temp.shared(s.name) IS NULL THEN
            INSERT INTO public.items (name, item_type, ingredient_role, description, hide_from_search)
            VALUES (s.name, 'ingredient', 'generic', s.description, false) RETURNING id INTO v;
            -- A new name can pick up a core suffix as its kind; set it as meant.
            UPDATE public.items SET generic_id = pg_temp.style(s.kind_of)
             WHERE id = v AND generic_id IS DISTINCT FROM pg_temp.style(s.kind_of);
        END IF;
    END LOOP;
END $$;

-- --- The prep each recipe lands on ---
-- The shared catalog prep by that name or alias. A bottle or a style by the
-- name isn't a prep, and someone's own prep isn't the catalog's: skipped. A
-- correction may land on a style that already carries a recipe (Elderflower
-- cordial, which bottles file under).
CREATE TEMP TABLE prep_row AS
SELECT p.*, i.id, (i.id IS NULL) AS is_new
  FROM prep_in p
  LEFT JOIN public.items i ON i.id = pg_temp.shared(p.name);
DELETE FROM prep_row r USING public.items i
 WHERE i.id = r.id
   AND (i.bar_id IS NOT NULL OR i.created_by IS NOT NULL OR i.item_type <> 'ingredient'
        OR (COALESCE(i.ingredient_role, 'prep') <> 'prep'
            AND NOT (r.replace AND i.ingredient_role = 'generic'
                     AND EXISTS (SELECT 1 FROM public.recipes x WHERE x.recipe_item_id = i.id AND x.amount IS NOT NULL))));

WITH ins AS (
    INSERT INTO public.items (name, item_type, ingredient_role, description, abv, hide_from_search)
    SELECT r.name, 'ingredient', 'prep', r.description, r.abv, false
      FROM prep_row r WHERE r.id IS NULL
    RETURNING id, name
)
UPDATE prep_row r SET id = ins.id FROM ins WHERE r.id IS NULL AND r.name = ins.name;

-- The style: set where there's none (and on a new row), or where the seed
-- says the one it has is wrong.
UPDATE public.items i SET generic_id = pg_temp.style(r.kind_of)
  FROM prep_row r
 WHERE i.id = r.id AND r.kind_of IS NOT NULL AND pg_temp.style(r.kind_of) IS NOT NULL
   AND pg_temp.style(r.kind_of) <> i.id
   AND (i.generic_id IS NULL OR r.is_new OR (r.kind_of_force AND i.generic_id <> pg_temp.style(r.kind_of)))
   AND pg_temp.name_free(i.id, i.name);
UPDATE public.items i SET ingredient_role = 'prep'
  FROM prep_row r WHERE i.id = r.id AND i.ingredient_role IS NULL;

-- A description where there's none; a corrected recipe brings its own.
UPDATE public.items i SET description = r.description
  FROM prep_row r
 WHERE i.id = r.id AND r.description IS NOT NULL
   AND (NULLIF(btrim(i.description), '') IS NULL OR (r.replace AND i.description IS DISTINCT FROM r.description));

-- A corrected recipe brings its strength when a source gives one; an unknown
-- one only clears a 0 (orgeat with brandy in it isn't 0%).
UPDATE public.items i SET abv = r.abv
  FROM prep_row r
 WHERE i.id = r.id AND r.replace AND r.has_abv AND i.abv IS DISTINCT FROM r.abv
   AND (r.abv IS NOT NULL OR i.abv = 0);

-- Other names people write it under, when nobody else has them.
INSERT INTO public.ingredient_aliases (key, item_id)
SELECT DISTINCT ON (public.ingredient_key(a.alias)) public.ingredient_key(a.alias), r.id
  FROM alias_in a JOIN prep_row r ON r.name = a.name
 WHERE public.ingredient_key(a.alias) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.items i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL
                      AND public.ingredient_key(i.name) = public.ingredient_key(a.alias))
ON CONFLICT (key) DO NOTHING;

-- --- Lines ---
-- Which preps get these lines: no line with an amount yet, or a correction.
CREATE TEMP TABLE prep_lines AS
SELECT r.id, r.name FROM prep_row r
 WHERE EXISTS (SELECT 1 FROM line_in l WHERE l.name = r.name)
   AND (r.replace OR NOT EXISTS (SELECT 1 FROM public.recipes x WHERE x.recipe_item_id = r.id AND x.amount IS NOT NULL));

DO $$
DECLARE missing text;
BEGIN
    SELECT string_agg(DISTINCT l.name || ': ' || l.ingredient, ', ') INTO missing
      FROM line_in l JOIN prep_lines p ON p.name = l.name
     WHERE pg_temp.shared(l.ingredient) IS NULL OR pg_temp.shared(l.ingredient) = p.id;
    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'Recipe lines with no shared ingredient: %', missing;
    END IF;
END $$;

DELETE FROM public.recipes x USING prep_lines p WHERE x.recipe_item_id = p.id;
INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, preparation_notes, is_optional, sort_order)
SELECT p.id, pg_temp.shared(l.ingredient), l.amount, l.unit, l.note, l.optional, l.pos
  FROM line_in l JOIN prep_lines p ON p.name = l.name;

-- The strength trigger reads a batch as one serve. These are prep recipes:
-- clear that, and keep the ABV written by hand.
UPDATE public.items i SET serve_ml = NULL, serve_abv = NULL
  FROM prep_lines p
 WHERE i.id = p.id AND i.abv_source = 'manual' AND (i.serve_ml IS NOT NULL OR i.serve_abv IS NOT NULL);

-- --- Yield, keep, storage and how it's made ---
INSERT INTO public.item_prep AS ip (item_id, yield_amount, yield_unit, shelf_life_hours, storage, actions)
SELECT r.id, r.yield_amount, r.yield_unit, r.keeps_hours, r.storage, r.actions FROM prep_row r
ON CONFLICT (item_id) DO UPDATE SET
    -- A corrected recipe's yield is its own, even none: the old one was for other amounts.
    yield_amount = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.yield_amount
                        WHEN ip.yield_amount IS NULL THEN EXCLUDED.yield_amount ELSE ip.yield_amount END,
    yield_unit = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.yield_unit
                      WHEN ip.yield_amount IS NULL THEN EXCLUDED.yield_unit ELSE ip.yield_unit END,
    shelf_life_hours = CASE WHEN (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id) THEN EXCLUDED.shelf_life_hours
                            ELSE COALESCE(ip.shelf_life_hours, EXCLUDED.shelf_life_hours) END,
    storage = CASE WHEN EXCLUDED.storage IS NOT NULL AND (NULLIF(btrim(ip.storage), '') IS NULL OR (SELECT r.replace FROM prep_row r WHERE r.id = ip.item_id))
                   THEN EXCLUDED.storage ELSE ip.storage END,
    actions = ip.actions || ARRAY(SELECT u.t FROM unnest(EXCLUDED.actions) WITH ORDINALITY u(t, n)
                                   WHERE u.t <> ALL (ip.actions) ORDER BY u.n),
    updated_at = now();

-- --- Steps ---
CREATE TEMP TABLE prep_steps AS
SELECT r.id, r.name FROM prep_row r
 WHERE EXISTS (SELECT 1 FROM step_in s WHERE s.name = r.name)
   AND (r.replace OR NOT EXISTS (SELECT 1 FROM public.item_steps x WHERE x.item_id = r.id));
DELETE FROM public.item_steps x USING prep_steps p WHERE x.item_id = p.id;
INSERT INTO public.item_steps (item_id, position, body, timer_seconds)
SELECT p.id, s.pos, s.body, s.timer_seconds FROM step_in s JOIN prep_steps p ON p.name = s.name;

-- --- Where each fact comes from ---
-- A corrected recipe's old sources for the facts it rewrites go first.
DELETE FROM public.item_sources s USING prep_row r
 WHERE r.replace AND s.item_id = r.id AND s.field IN ('recipe', 'yield', 'keeps')
   AND NOT EXISTS (SELECT 1 FROM source_in n WHERE n.name = r.name AND n.field = s.field AND n.url = s.url);
INSERT INTO public.item_sources (item_id, field, url, kind, checked_on, note)
SELECT r.id, s.field, s.url, s.kind, s.checked_on, s.note
  FROM source_in s JOIN prep_row r ON r.name = s.name
ON CONFLICT ON CONSTRAINT "item_sources_one_per_page" DO UPDATE
   SET note = EXCLUDED.note, kind = EXCLUDED.kind, checked_on = EXCLUDED.checked_on
 WHERE item_sources.note IS DISTINCT FROM EXCLUDED.note OR item_sources.kind IS DISTINCT FROM EXCLUDED.kind;

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;

DROP TABLE "flavor_jobs_before", "stub_in", "prep_in", "alias_in", "line_in", "step_in", "source_in",
           "prep_row", "prep_lines", "prep_steps";
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.name_free(uuid, text);
RESET "app.image_worker";
