-- House prep recipes for bitters, foams, creams, a soda and food preps
-- (after 20261018030000). Stage 4F of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 20 shared catalog preps that had no recipe get one, each from the pages
--     it cites (one item_sources row per recipe, yield and keep fact; two
--     sites for the staples): house aromatic bitters, siphon foams and
--     creams (coconut, egg white, strawberry, orange, ube, whipped cream,
--     pandan cream), sobolo, herb oils, lemon curd, miso caramel, quick
--     pickles, dashi, leche de tigre, lacto-fermented tomato and chilli, and
--     Swiss meringue.
--   * Keeps for herb oils, dairy, eggs, pickles and curd come from food
--     safety pages (NCHFP, Ohio State and other extension services) where
--     they are shorter than the recipe's own. Dill oil applies a general soft
--     herb ratio and says it's a starting point.
--   * Held back: House tonic (no source shows its quinine under the US 83 ppm
--     or FSANZ 100 mg/kg limits) and Cola syrup (its only source, the
--     OpenCola formula, is GPL-licensed).
--   * New plain ingredients: Cream charger, Grapeseed oil, Groundnut oil,
--     Pickling salt and Red miso; Malt powder too where a database lacks it
--     (production has it).
--   * An independent second check of every fact in this stage (102) against
--     the cited pages found none wrong.
--
-- Written by scripts/prep-recipes.mjs from supabase/seeds/preps/f_bitters_foams_food.json;
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
($q$Cream charger$q$, $q$An 8 g steel cartridge of nitrous oxide (N2O) that charges a cream siphon to whip cream and make foams. One charges a 0.5 L siphon.$q$, NULL),
($q$Grapeseed oil$q$, $q$A light, neutral oil pressed from grape seeds. It stays liquid in the fridge, which makes it a good base for herb oils.$q$, NULL),
($q$Groundnut oil$q$, $q$Peanut oil: a neutral cooking oil with a mild flavour. Made from peanuts, so flag it for allergies.$q$, NULL),
($q$Malt powder$q$, $q$Powdered malted barley, sold as malted milk powder or plain malt powder. Adds a toasty, biscuity sweetness to creams and shakes.$q$, NULL),
($q$Pickling salt$q$, $q$Fine pure salt with no iodine or anti-caking agents, sold for canning and pickling so brines stay clear.$q$, $q$Salt$q$),
($q$Red miso$q$, $q$Aka miso: a longer-aged soybean paste, darker, saltier and more savoury than white miso.$q$, $q$Miso$q$);

INSERT INTO prep_in VALUES
($q$Basil oil$q$, $q$Basil$q$, false, $q$A bright green oil made by blanching basil and blending it with grapeseed oil, then dripping it clear. For drops on foamy or savoury drinks and garnishes.$q$, 0, true, 310, $q$ml$q$, 96, $q$Fridge at 4 °C or below, sealed bottle$q$, ARRAY[$q$Oil$q$, $q$Blend$q$, $q$Strain$q$]::text[], false),
($q$Coconut foam$q$, $q$Coconut$q$, false, $q$A light, sweet coconut cream foam from a siphon, for topping coffee drinks, tropical sours and highballs.$q$, 0, true, 550, $q$ml$q$, 24, $q$Fridge, in the sealed siphon$q$, ARRAY[$q$Foam$q$, $q$Mix$q$]::text[], false),
($q$Dashi$q$, $q$Kombu$q$, false, $q$Japanese stock of kombu and bonito flakes, clean and deeply savoury. For umami in savoury Martinis, Bloody Mary styles and broth drinks.$q$, 0, true, 800, $q$ml$q$, 72, $q$Fridge, sealed bottle; or freeze$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Dill oil$q$, $q$Dill$q$, false, $q$Blanched dill blended into neutral oil and dripped clear: a green, grassy oil for drops on savoury drinks and garnishes. Starting point: test a batch first.$q$, 0, true, 250, $q$g$q$, 96, $q$Fridge at 4 °C or below, sealed bottle$q$, ARRAY[$q$Oil$q$, $q$Blend$q$, $q$Strain$q$]::text[], false),
($q$Egg white foam$q$, $q$Egg white$q$, false, $q$A mousse-like siphon foam of egg white and a flavourful liquid such as fruit juice or cold tea, spooned or piped onto drinks.$q$, 0, true, 460, $q$ml$q$, 48, $q$Fridge, in the sealed siphon$q$, ARRAY[$q$Foam$q$, $q$Mix$q$, $q$Strain$q$]::text[], false),
($q$Fermented chili$q$, $q$Chilli$q$, false, $q$Chopped fresh chillies salted at 3% by weight and left to ferment into a sour, hot mash. Blend or strain for hot sauce, brines and spicy margaritas.$q$, 0, true, 1000, $q$g$q$, NULL, NULL, ARRAY[$q$Ferment$q$]::text[], false),
($q$House bitters$q$, $q$Bitters$q$, false, $q$Aromatic bitters made in house: gentian and mugwort for bite, orange peel and warm spice for aroma, rested two weeks in strong vodka. Dash into Old Fashioneds, Manhattans and anything that wants a bitter backbone.$q$, NULL, false, 480, $q$ml$q$, 8760, $q$Cool, dark cupboard, sealed bottle$q$, ARRAY[$q$Tincture$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$House-pickled onion$q$, $q$Pickled onion$q$, false, $q$Thin-sliced onions under a hot vinegar brine, kept in the fridge: a Gibson garnish and a sharp brine for savoury drinks.$q$, 0, true, NULL, NULL, 336, $q$Fridge, lidded jars. Never shelf stable$q$, '{}'::text[], false),
($q$Lacto-fermented tomato$q$, $q$Tomato$q$, false, $q$Chopped tomatoes salted at 2% by weight and left to ferment sour under their own juice. For savoury, tangy brines in Bloody Marys and Martinis.$q$, 0, true, 1000, $q$g$q$, NULL, NULL, ARRAY[$q$Ferment$q$]::text[], false),
($q$Leche De Tigre$q$, $q$Lime juice$q$, false, $q$A drinkable leche de tigre from Lil' Deb's Oasis: orange and lime juice blended with fresh turmeric, ginger, jalapeño and garlic, then strained and salted. Bright, hot and savoury.$q$, 0, true, 720, $q$ml$q$, 24, $q$Fridge, covered$q$, ARRAY[$q$Blend$q$, $q$Strain$q$]::text[], false),
($q$Lemon curd$q$, $q$Lemon$q$, false, $q$A thick, sharp-sweet custard of lemon, sugar, eggs and butter, cooked to 77 °C. For lemon meringue style drinks, rims and garnishes.$q$, 0, true, 720, $q$ml$q$, 168, $q$Fridge, covered; or freeze up to a year$q$, ARRAY[$q$Strain$q$]::text[], false),
($q$Meringue$q$, NULL, false, $q$Swiss meringue: egg whites and sugar warmed to 80 °C over water, then whipped thick and glossy. For piping and torching on top of sours and lemon meringue style drinks.$q$, 0, true, NULL, NULL, 24, $q$Fridge, covered or in a piping bag$q$, ARRAY[$q$Foam$q$]::text[], false),
($q$Miso caramel$q$, $q$Caramel$q$, false, $q$Caramel syrup with red miso whisked through: savoury-sweet, less cloying than plain caramel. Made at Jyan Isaac Bread to sweeten a flat white; works in coffee and dark spirit drinks.$q$, 0, true, 230, $q$ml$q$, NULL, NULL, ARRAY[$q$Mix$q$]::text[], false),
($q$Orange foam$q$, $q$Orange$q$, false, $q$A vegan orange espuma of orange juice and tonic lifted with a plant-based egg white, for coffee tonics and citrus highballs.$q$, 0, true, 500, $q$ml$q$, NULL, $q$Fridge, in the sealed siphon$q$, ARRAY[$q$Foam$q$, $q$Mix$q$]::text[], false),
($q$Pandan cream$q$, $q$Cream$q$, false, $q$A malty, grassy pandan whipped cream from a siphon, made with pandan syrup, for topping coffee and rum drinks or shots.$q$, 0, true, 360, $q$ml$q$, 24, $q$Fridge, in the sealed siphon$q$, ARRAY[$q$Foam$q$, $q$Infuse$q$, $q$Mix$q$]::text[], false),
($q$Pickled cucumber$q$, $q$Cucumber$q$, false, $q$Fridge pickles: cucumbers packed in jars under a boiled sour vinegar brine. A garnish, and the brine goes into dirty Martinis and pickleback-style shots.$q$, 0, true, NULL, NULL, 336, $q$Fridge, lidded jars. Never shelf stable$q$, '{}'::text[], false),
($q$Sobolo$q$, $q$Hibiscus$q$, false, $q$West African hibiscus drink, called sobolo in Ghana: dried hibiscus simmered with ginger, lemon and cinnamon, strained and sweetened. Tart and deep red, served chilled as a soft drink or a base for long drinks.$q$, 0, true, 1920, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Strawberry foam$q$, $q$Strawberry$q$, false, $q$A vegan strawberry espuma set with a little agar, for topping sours, spritzes and desserts.$q$, 0, true, 500, $q$ml$q$, NULL, $q$Fridge, in the sealed siphon$q$, ARRAY[$q$Foam$q$, $q$Blend$q$, $q$Strain$q$]::text[], false),
($q$Ube foam$q$, $q$Ube$q$, false, $q$A purple sweet cream foam of cream, milk and ube condensed milk from a siphon, for iced coffee, chai and matcha drinks.$q$, 0, true, 500, $q$ml$q$, 24, $q$Fridge, in the sealed siphon$q$, ARRAY[$q$Foam$q$, $q$Mix$q$]::text[], false),
($q$Whipped cream$q$, $q$Cream$q$, false, $q$Lightly sweetened vanilla whipped cream from a siphon, for Irish coffee, flips and dessert drinks.$q$, 0, true, 490, $q$g$q$, 24, $q$Fridge, in the sealed siphon$q$, ARRAY[$q$Foam$q$, $q$Mix$q$]::text[], false);

INSERT INTO alias_in VALUES
($q$Coconut foam$q$, $q$coconut cloud$q$),
($q$Dashi$q$, $q$Awase dashi$q$),
($q$Fermented chili$q$, $q$Fermented chilli$q$),
($q$House bitters$q$, $q$aromatic bitters$q$),
($q$House bitters$q$, $q$house aromatic bitters$q$),
($q$Meringue$q$, $q$Swiss meringue$q$),
($q$Pandan cream$q$, $q$pandan whipped cream$q$),
($q$Sobolo$q$, $q$Zobo$q$),
($q$Sobolo$q$, $q$Bissap$q$),
($q$Sobolo$q$, $q$Sorrel drink$q$),
($q$Ube foam$q$, $q$ube sweet cream$q$),
($q$Whipped cream$q$, $q$Chantilly cream$q$);

INSERT INTO line_in VALUES
($q$Basil oil$q$, 0, $q$Basil$q$, 70, $q$g$q$, $q$leaves and stems$q$, false),
($q$Basil oil$q$, 1, $q$Grapeseed oil$q$, 375, $q$ml$q$, NULL, false),
($q$Coconut foam$q$, 0, $q$Milk$q$, 200, $q$ml$q$, $q$cold$q$, false),
($q$Coconut foam$q$, 1, $q$Heavy cream$q$, 300, $q$ml$q$, $q$at least 32% fat, cold$q$, false),
($q$Coconut foam$q$, 2, $q$Coconut syrup$q$, 50, $q$ml$q$, $q$iSi uses Monin$q$, false),
($q$Coconut foam$q$, 3, $q$Cream charger$q$, 1, $q$each$q$, $q$8 g N2O$q$, false),
($q$Dashi$q$, 0, $q$Kombu$q$, 10, $q$g$q$, $q$one 10 cm square, a few slits cut in it$q$, false),
($q$Dashi$q$, 1, $q$Katsuobushi$q$, 10, $q$g$q$, $q$1 cup, packed$q$, false),
($q$Dashi$q$, 2, $q$Water$q$, 960, $q$ml$q$, NULL, false),
($q$Dill oil$q$, 0, $q$Dill$q$, 200, $q$g$q$, NULL, false),
($q$Dill oil$q$, 1, $q$Groundnut oil$q$, 300, $q$g$q$, $q$or another neutral oil$q$, false),
($q$Egg white foam$q$, 0, $q$Pasteurized egg white$q$, 60, $q$ml$q$, $q$pasteurised is the safe choice; about 2 whites$q$, false),
($q$Egg white foam$q$, 1, $q$Fruit juice$q$, 400, $q$ml$q$, $q$or cold tea; fine strained, not oily, any alcohol kept under 10%$q$, false),
($q$Egg white foam$q$, 2, $q$Cream charger$q$, 1, $q$each$q$, $q$8 g N2O$q$, false),
($q$Fermented chili$q$, 0, $q$Fresh chilli$q$, 1000, $q$g$q$, $q$stemmed and chopped$q$, false),
($q$Fermented chili$q$, 1, $q$Salt$q$, 30, $q$g$q$, $q$3% of the chilli weight; non-iodised$q$, false),
($q$House bitters$q$, 0, $q$Raisin$q$, 4, $q$tbsp$q$, $q$chopped$q$, false),
($q$House bitters$q$, 1, $q$Orange peel$q$, 14, $q$g$q$, $q$dried$q$, false),
($q$House bitters$q$, 2, $q$Gentian$q$, 14, $q$g$q$, $q$dried root chips$q$, false),
($q$House bitters$q$, 3, $q$Mugwort$q$, 2, $q$tbsp$q$, $q$dried$q$, false),
($q$House bitters$q$, 4, $q$Cardamom$q$, 8, $q$each$q$, $q$green pods$q$, false),
($q$House bitters$q$, 5, $q$Allspice$q$, 10, $q$each$q$, $q$whole berries, lightly crushed$q$, false),
($q$House bitters$q$, 6, $q$Clove$q$, 4, $q$each$q$, $q$whole$q$, false),
($q$House bitters$q$, 7, $q$Vodka$q$, 480, $q$ml$q$, $q$50% ABV (100 proof)$q$, false),
($q$House bitters$q$, 8, $q$Simple syrup$q$, 30, $q$ml$q$, $q$added after straining$q$, false),
($q$House-pickled onion$q$, 0, $q$Onion$q$, NULL, NULL, $q$peeled and thinly sliced, enough to pack 2 pint (500 ml) jars tightly$q$, false),
($q$House-pickled onion$q$, 1, $q$Vinegar$q$, 480, $q$ml$q$, $q$white (or apple cider)$q$, false),
($q$House-pickled onion$q$, 2, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$House-pickled onion$q$, 3, $q$Pickling salt$q$, 2, $q$tbsp$q$, NULL, false),
($q$House-pickled onion$q$, 4, $q$Sugar$q$, 4, $q$tsp$q$, NULL, false),
($q$Lacto-fermented tomato$q$, 0, $q$Tomato$q$, 1000, $q$g$q$, $q$chopped$q$, false),
($q$Lacto-fermented tomato$q$, 1, $q$Salt$q$, 20, $q$g$q$, $q$2% of the tomato weight; non-iodised$q$, false),
($q$Leche De Tigre$q$, 0, $q$Orange juice$q$, 480, $q$ml$q$, $q$fresh$q$, false),
($q$Leche De Tigre$q$, 1, $q$Lime juice$q$, 240, $q$ml$q$, $q$fresh$q$, false),
($q$Leche De Tigre$q$, 2, $q$Turmeric$q$, 1, $q$each$q$, $q$fresh root, a 7.5 cm piece$q$, false),
($q$Leche De Tigre$q$, 3, $q$Ginger$q$, 1, $q$each$q$, $q$a 5 cm piece, peeled and thinly sliced$q$, false),
($q$Leche De Tigre$q$, 4, $q$Jalapeño$q$, 1, $q$each$q$, $q$seeds removed, chopped$q$, false),
($q$Leche De Tigre$q$, 5, $q$Garlic$q$, 2, $q$each$q$, $q$cloves$q$, false),
($q$Leche De Tigre$q$, 6, $q$Kosher salt$q$, NULL, NULL, $q$to taste$q$, false),
($q$Lemon curd$q$, 0, $q$Caster sugar$q$, 500, $q$g$q$, NULL, false),
($q$Lemon curd$q$, 1, $q$Lemon zest$q$, 8, $q$tbsp$q$, $q$freshly grated$q$, false),
($q$Lemon curd$q$, 2, $q$Lemon juice$q$, 240, $q$ml$q$, $q$bottled in the tested recipe, for steady acidity$q$, false),
($q$Lemon curd$q$, 3, $q$Butter$q$, 170, $q$g$q$, $q$unsalted, chilled, cut into 2 cm pieces$q$, false),
($q$Lemon curd$q$, 4, $q$Egg yolk$q$, 7, $q$each$q$, $q$large$q$, false),
($q$Lemon curd$q$, 5, $q$Egg$q$, 4, $q$each$q$, $q$large, whole$q$, false),
($q$Meringue$q$, 0, $q$Egg white$q$, 4, $q$each$q$, $q$from large eggs$q$, false),
($q$Meringue$q$, 1, $q$Caster sugar$q$, 200, $q$g$q$, NULL, false),
($q$Meringue$q$, 2, $q$Salt$q$, 1, $q$pinch$q$, NULL, false),
($q$Miso caramel$q$, 0, $q$Caramel syrup$q$, 180, $q$ml$q$, NULL, false),
($q$Miso caramel$q$, 1, $q$Red miso$q$, 4, $q$tbsp$q$, NULL, false),
($q$Orange foam$q$, 0, $q$Orange essence$q$, 0.5, $q$tsp$q$, $q$pure orange extract$q$, false),
($q$Orange foam$q$, 1, $q$Orange juice$q$, 200, $q$ml$q$, $q$fine strained$q$, false),
($q$Orange foam$q$, 2, $q$Tonic water$q$, 150, $q$ml$q$, $q$cold$q$, false),
($q$Orange foam$q$, 3, $q$Egg white substitute$q$, 150, $q$ml$q$, $q$plant-based egg white; or 150 ml pasteurised egg white$q$, false),
($q$Orange foam$q$, 4, $q$Cream charger$q$, 1, $q$each$q$, $q$8 g N2O$q$, false),
($q$Pandan cream$q$, 0, $q$Heavy cream$q$, 240, $q$ml$q$, $q$cold$q$, false),
($q$Pandan cream$q$, 1, $q$Pandan syrup$q$, 120, $q$ml$q$, $q$Punch's: 240 ml water, 200 g sugar, 1 pandan leaf$q$, false),
($q$Pandan cream$q$, 2, $q$Malt powder$q$, 1.25, $q$tsp$q$, NULL, false),
($q$Pandan cream$q$, 3, $q$Cream charger$q$, 1, $q$each$q$, $q$8 g N2O$q$, false),
($q$Pickled cucumber$q$, 0, $q$Cucumber$q$, NULL, NULL, $q$washed and cut, enough to pack 4 pint (500 ml) jars snugly$q$, false),
($q$Pickled cucumber$q$, 1, $q$Vinegar$q$, 720, $q$ml$q$, $q$white (or apple cider); never dilute it more than this$q$, false),
($q$Pickled cucumber$q$, 2, $q$Water$q$, 720, $q$ml$q$, NULL, false),
($q$Pickled cucumber$q$, 3, $q$Pickling salt$q$, 3, $q$tbsp$q$, NULL, false),
($q$Pickled cucumber$q$, 4, $q$Sugar$q$, 2, $q$tbsp$q$, $q$optional$q$, false),
($q$Sobolo$q$, 0, $q$Dried hibiscus$q$, 480, $q$ml$q$, $q$2 cups by volume, rinsed$q$, false),
($q$Sobolo$q$, 1, $q$Water$q$, 2400, $q$ml$q$, NULL, false),
($q$Sobolo$q$, 2, $q$Ginger$q$, 5, $q$tbsp$q$, $q$fresh, chopped (grate for more bite)$q$, false),
($q$Sobolo$q$, 3, $q$Lemon$q$, 0.5, $q$each$q$, $q$cut in pieces$q$, false),
($q$Sobolo$q$, 4, $q$Cinnamon$q$, 2, $q$each$q$, $q$sticks$q$, false),
($q$Sobolo$q$, 5, $q$Sugar$q$, 100, $q$g$q$, $q$or sweetener of choice, to taste$q$, false),
($q$Strawberry foam$q$, 0, $q$Vegan cream$q$, 50, $q$ml$q$, $q$about 31% fat$q$, false),
($q$Strawberry foam$q$, 1, $q$Water$q$, 100, $q$ml$q$, NULL, false),
($q$Strawberry foam$q$, 2, $q$Strawberry$q$, 300, $q$g$q$, $q$hulled$q$, false),
($q$Strawberry foam$q$, 3, $q$Agar$q$, 2, $q$g$q$, NULL, false),
($q$Strawberry foam$q$, 4, $q$Icing sugar$q$, 100, $q$g$q$, NULL, false),
($q$Strawberry foam$q$, 5, $q$Cream charger$q$, 1, $q$each$q$, $q$8 g N2O$q$, false),
($q$Ube foam$q$, 0, $q$Cream$q$, 200, $q$ml$q$, $q$cold$q$, false),
($q$Ube foam$q$, 1, $q$Milk$q$, 250, $q$ml$q$, $q$cold$q$, false),
($q$Ube foam$q$, 2, $q$Ube condensed milk$q$, 50, $q$g$q$, $q$up to 100 g for a stronger flavour$q$, false),
($q$Ube foam$q$, 3, $q$Cream charger$q$, 1, $q$each$q$, $q$8 g N2O$q$, false),
($q$Whipped cream$q$, 0, $q$Heavy cream$q$, 450, $q$g$q$, $q$30 to 36% fat, well chilled$q$, false),
($q$Whipped cream$q$, 1, $q$Sugar$q$, 32, $q$g$q$, $q$caster or icing$q$, false),
($q$Whipped cream$q$, 2, $q$Vanilla extract$q$, 8, $q$g$q$, NULL, false),
($q$Whipped cream$q$, 3, $q$Cream charger$q$, 1, $q$each$q$, $q$8 g N2O$q$, false);

INSERT INTO step_in VALUES
($q$Basil oil$q$, 0, $q$Blanch the basil in salted boiling water for 10 seconds, then straight into iced water. Drain and pat it very dry.$q$, 10),
($q$Basil oil$q$, 1, $q$Blend the basil with the oil in a tall, narrow container until smooth.$q$, NULL),
($q$Basil oil$q$, 2, $q$Drip through paper towel or a double layer of cheesecloth for 5 hours, or overnight in the fridge. Don't press. Discard the solids.$q$, 18000),
($q$Basil oil$q$, 3, $q$Botulism risk: fresh herbs in oil must stay cold. Bottle, refrigerate straight away, label with the date, and throw it out after 4 days (or freeze it).$q$, NULL),
($q$Coconut foam$q$, 0, $q$Stir the cold milk, cream and coconut syrup together and pour into a 0.5 L siphon.$q$, NULL),
($q$Coconut foam$q$, 1, $q$Screw on one N2O cream charger and shake the siphon 6 to 8 times. Stop once it dispenses thick; it won't need shaking again.$q$, NULL),
($q$Coconut foam$q$, 2, $q$Keep it in the fridge. Hold it upside down to dispense onto the drink, and never open it while it is still under pressure.$q$, NULL),
($q$Dashi$q$, 0, $q$Optional: soak the kombu in the water for 2 to 3 hours (or up to 12 hours in the fridge) first.$q$, NULL),
($q$Dashi$q$, 1, $q$Heat the kombu and water over medium-low until almost boiling, about 10 minutes, skimming. Lift out the kombu before it boils, or the dashi turns slimy and bitter.$q$, 600),
($q$Dashi$q$, 2, $q$Add the bonito flakes, bring back to the boil, simmer 30 seconds and turn off the heat.$q$, 30),
($q$Dashi$q$, 3, $q$Let the flakes settle for about 10 minutes, then strain through a fine sieve.$q$, 600),
($q$Dill oil$q$, 0, $q$Blanch the dill for 30 seconds, then straight into iced water.$q$, 30),
($q$Dill oil$q$, 1, $q$Squeeze it dry and pat dry on a clean cloth.$q$, NULL),
($q$Dill oil$q$, 2, $q$Blend with the oil until the outside of the blender feels hot, then chill it fast in a bowl set over iced water.$q$, NULL),
($q$Dill oil$q$, 3, $q$Strain through a coffee filter overnight. Don't press.$q$, NULL),
($q$Dill oil$q$, 4, $q$Botulism risk: fresh herbs in oil must stay cold. Bottle, refrigerate straight away, label with the date, and throw it out after 4 days (or freeze it).$q$, NULL),
($q$Egg white foam$q$, 0, $q$Raw egg: use pasteurised egg white. Whisk it into the cold juice or tea, sweeten with a little syrup if you like, and strain fine.$q$, NULL),
($q$Egg white foam$q$, 1, $q$Pour into a 1 L siphon so it is no more than half full. Screw on one N2O cream charger and shake 6 times; over-shaking hurts it.$q$, NULL),
($q$Egg white foam$q$, 2, $q$Chill the siphon at least 40 minutes before use. Never put it in the freezer.$q$, 2400),
($q$Egg white foam$q$, 3, $q$Dispense upside down onto the drink. If it won't foam, shake and try again; never charge it more than twice. Keep it cold and bin it after 2 days.$q$, NULL),
($q$Fermented chili$q$, 0, $q$Wear gloves. Weigh the chopped chillies and mix in 3% salt by weight (30 g per kg).$q$, NULL),
($q$Fermented chili$q$, 1, $q$Leave in the bowl for 15 to 30 minutes to draw out juice.$q$, 1800),
($q$Fermented chili$q$, 2, $q$Pack tightly into a clean jar and weight it so everything stays under the liquid. Leave at room temperature.$q$, NULL),
($q$Fermented chili$q$, 3, $q$Taste daily; refrigerate when it's sour enough. Throw it out if you see mould.$q$, NULL),
($q$House bitters$q$, 0, $q$Put the raisins, dried peel, gentian, mugwort, cardamom, allspice and cloves in a 1 litre glass jar. Pour in the 50% ABV vodka, seal and shake.$q$, NULL),
($q$House bitters$q$, 1, $q$Leave in a cool, dark place for 2 weeks, shaking every other day. With 40% ABV vodka, give it 3 weeks. High-proof spirit is flammable: keep it away from flames and burners.$q$, NULL),
($q$House bitters$q$, 2, $q$Strain through a fine sieve lined with three layers of cheesecloth, pressing the solids to get all the liquid out. Discard the solids.$q$, NULL),
($q$House bitters$q$, 3, $q$Return to a clean jar, add the simple syrup and shake gently. Bottle into dasher or dropper bottles and label with the name and date.$q$, NULL),
($q$House-pickled onion$q$, 0, $q$Peel, rinse and thinly slice the onions, and pack them tightly into clean jars.$q$, NULL),
($q$House-pickled onion$q$, 1, $q$Boil the vinegar, water, salt and sugar for 2 minutes.$q$, 120),
($q$House-pickled onion$q$, 2, $q$Fill the jars to 1 cm below the rim, cover and refrigerate.$q$, NULL),
($q$House-pickled onion$q$, 3, $q$Give it a day or two before using. Use within 2 weeks.$q$, NULL),
($q$Lacto-fermented tomato$q$, 0, $q$Weigh the chopped tomatoes and mix in 2% salt by weight (20 g per kg).$q$, NULL),
($q$Lacto-fermented tomato$q$, 1, $q$Leave in the bowl for 15 to 30 minutes to draw out juice.$q$, 1800),
($q$Lacto-fermented tomato$q$, 2, $q$Pack tightly into a clean jar and weight it so everything stays under the liquid. Leave at room temperature.$q$, NULL),
($q$Lacto-fermented tomato$q$, 3, $q$Taste daily; refrigerate when it's sour enough. Throw it out if you see mould.$q$, NULL),
($q$Leche De Tigre$q$, 0, $q$Blend the orange juice, lime juice, turmeric, ginger, jalapeño and garlic until smooth.$q$, NULL),
($q$Leche De Tigre$q$, 1, $q$Strain through a fine sieve and season with salt.$q$, NULL),
($q$Leche De Tigre$q$, 2, $q$Cover and chill. Make it no more than a day ahead.$q$, NULL),
($q$Lemon curd$q$, 0, $q$Stir the sugar and zest together and leave for about 30 minutes.$q$, 1800),
($q$Lemon curd$q$, 1, $q$In the top of a double boiler, off the heat, whisk the yolks and whole eggs, then whisk in the sugar and zest, the lemon juice and the butter.$q$, NULL),
($q$Lemon curd$q$, 2, $q$Set over gently boiling water and stir constantly until it reaches 77 °C (170 °F) on a thermometer. This cooks the eggs safely.$q$, NULL),
($q$Lemon curd$q$, 3, $q$Off the heat, keep stirring until it thickens, about 5 minutes. Strain out the zest.$q$, 300),
($q$Lemon curd$q$, 4, $q$Cool with wrap pressed onto the surface, then refrigerate, or freeze for longer storage.$q$, NULL),
($q$Meringue$q$, 0, $q$Whisk the whites, sugar and salt in a heatproof bowl over gently simmering water until the sugar dissolves and it reads 80 °C, about 8 minutes.$q$, 480),
($q$Meringue$q$, 1, $q$Take it off the heat and whip on medium until thick and glossy.$q$, NULL),
($q$Meringue$q$, 2, $q$Spoon into a piping bag. Keep cold and use within 24 hours.$q$, NULL),
($q$Miso caramel$q$, 0, $q$Put the miso in a bowl and whisk in the caramel syrup a little at a time until fully emulsified and smooth.$q$, NULL),
($q$Miso caramel$q$, 1, $q$Bottle and label.$q$, NULL),
($q$Orange foam$q$, 0, $q$Pour everything into a 0.5 L siphon. Strain the juice fine first so pulp can't block the valve.$q$, NULL),
($q$Orange foam$q$, 1, $q$Screw on one N2O cream charger and shake hard 10 to 12 times.$q$, NULL),
($q$Orange foam$q$, 2, $q$Keep it cold until service and dispense upside down onto the drink. If you swap in egg white, use pasteurised.$q$, NULL),
($q$Pandan cream$q$, 0, $q$For the syrup: boil the water, take it off the heat, add the pandan leaf so it is submerged, cover and leave 30 minutes.$q$, 1800),
($q$Pandan cream$q$, 1, $q$Lift out the leaf and stir in the sugar until it dissolves. Cool.$q$, NULL),
($q$Pandan cream$q$, 2, $q$Stir the cream, 120 ml of the syrup and the malt powder together until the malt dissolves.$q$, NULL),
($q$Pandan cream$q$, 3, $q$Pour into a 0.5 L siphon, charge once with N2O, turn it upside down and shake 4 times. Keep it cold and use within a day.$q$, NULL),
($q$Pickled cucumber$q$, 0, $q$Wash and cut the cucumbers; no cooking needed. Pack them snugly into clean jars, with up to 2 tbsp of herbs or spices per jar (dill, garlic, mustard seed, peppercorns) if you like.$q$, NULL),
($q$Pickled cucumber$q$, 1, $q$Boil the vinegar, water, salt and sugar for 2 minutes.$q$, 120),
($q$Pickled cucumber$q$, 2, $q$Pour the brine over the cucumbers to 1 cm below the rim, lid the jars and refrigerate.$q$, NULL),
($q$Pickled cucumber$q$, 3, $q$Let the flavour develop for 1 to 2 days before serving. Use within 2 weeks.$q$, NULL),
($q$Sobolo$q$, 0, $q$Rinse the dried hibiscus well in a colander to wash off grit.$q$, NULL),
($q$Sobolo$q$, 1, $q$Put the hibiscus, water, chopped ginger, lemon and cinnamon sticks in a pot and bring to the boil.$q$, NULL),
($q$Sobolo$q$, 2, $q$Turn down to a simmer for 15 to 20 minutes.$q$, 900),
($q$Sobolo$q$, 3, $q$Strain through a fine sieve, then stir in the sweetener while it is still hot.$q$, NULL),
($q$Sobolo$q$, 4, $q$Cool and chill. It comes out strong: dilute with water to taste. For a Ghanaian-style spiced sobolo, cloves, black pepper and chilli are often added.$q$, NULL),
($q$Strawberry foam$q$, 0, $q$Blend everything smooth, then bring it to the boil in a pan and take it off the heat once it thickens.$q$, NULL),
($q$Strawberry foam$q$, 1, $q$Pour it through a fine sieve into a 0.5 L siphon. Screw on one N2O cream charger and shake hard 12 to 16 times.$q$, NULL),
($q$Strawberry foam$q$, 2, $q$Chill the siphon at least 4 hours so the agar sets.$q$, 14400),
($q$Strawberry foam$q$, 3, $q$Shake again before the first use, then dispense upside down.$q$, NULL),
($q$Ube foam$q$, 0, $q$Stir the cream, milk and ube condensed milk together until smooth.$q$, NULL),
($q$Ube foam$q$, 1, $q$Pour into a 0.5 L siphon, screw on one N2O cream charger and shake hard 6 to 8 times.$q$, NULL),
($q$Ube foam$q$, 2, $q$Keep it in the fridge until service and dispense upside down onto the drink.$q$, NULL),
($q$Whipped cream$q$, 0, $q$Chill the cream and the siphon. Stir the sugar and vanilla into the cold cream until the sugar dissolves.$q$, NULL),
($q$Whipped cream$q$, 1, $q$Pour into a 0.5 L siphon, no higher than its fill line. Screw on one N2O cream charger and shake 4 to 6 times.$q$, NULL),
($q$Whipped cream$q$, 2, $q$Test a little: if it comes out runny, shake once more. Once it is right, don't shake it again or it turns cakey.$q$, NULL),
($q$Whipped cream$q$, 3, $q$No siphon: whisk the cold cream by hand or mixer to soft peaks, add the sugar and vanilla, then whisk just to stiff peaks.$q$, NULL),
($q$Whipped cream$q$, 4, $q$Keep it in the fridge and use within a day. It should not sit out more than 2 hours.$q$, NULL);

INSERT INTO source_in VALUES
($q$Basil oil$q$, $q$recipe$q$, $q$https://www.ricardocuisine.com/en/recipes/11204-basil-oil$q$, $q$reference$q$, DATE '2026-10-13', $q$Ricardo: 2 cups (70 g) basil leaves and stems to 1 1/2 cups (375 ml) grapeseed oil, blanched 10 seconds, strained 5 hours or overnight. Used as written.$q$),
($q$Basil oil$q$, $q$recipe$q$, $q$https://www.greatbritishchefs.com/how-to-cook/how-to-make-herb-oil$q$, $q$reference$q$, DATE '2026-10-13', $q$Great British Chefs' general herb oil (basil named) runs heavier on herbs: 200 g herbs to 300 g oil. We use Ricardo's basil-specific ratio.$q$),
($q$Basil oil$q$, $q$yield$q$, $q$https://www.ricardocuisine.com/en/recipes/11204-basil-oil$q$, $q$reference$q$, DATE '2026-10-13', $q$About 1 1/4 cups (310 ml).$q$),
($q$Basil oil$q$, $q$keeps$q$, $q$https://nchfp.uga.edu/how/freeze/vegetable/freezing-garlic-in-oil/$q$, $q$law$q$, DATE '2026-10-13', $q$NCHFP's rule for fresh garlic in oil, from its research on vegetables and herbs stored in oil: fridge at 4 °C or below, no more than 4 days, or freeze.$q$),
($q$Basil oil$q$, $q$keeps$q$, $q$https://www.ricardocuisine.com/en/recipes/11204-basil-oil$q$, $q$reference$q$, DATE '2026-10-13', $q$Ricardo says 2 weeks for this oil; the safety source is shorter, so we use 4 days.$q$),
($q$Basil oil$q$, $q$keeps$q$, $q$https://www.greatbritishchefs.com/how-to-cook/how-to-make-herb-oil$q$, $q$reference$q$, DATE '2026-10-13', $q$Great British Chefs says 2 weeks for herb oil; the safety source is shorter, so we use 4 days.$q$),
($q$Coconut foam$q$, $q$recipe$q$, $q$https://culinary.isi.com/en-GB/culinary/recipe/coconut-cloud-topping$q$, $q$producer$q$, DATE '2026-10-13', $q$iSi Coconut Cloud Topping: 200 ml milk, 300 ml cream (min. 32% fat) and 50 ml coconut syrup in a 0.5 L whip with one charger, shaken 6 to 8 times. Used as written.$q$),
($q$Coconut foam$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/room-for-improvements-espresso-martini/$q$, $q$reference$q$, DATE '2026-10-13', $q$Second source (Room for Improvement via Punch) builds a coconut foam on a 14 oz can of coconut cream with 50 g sugar, 35 ml falernum, 3 g salt and 1 g Foam Magic, one N2O charge. A different style; we use iSi's ratio, the maker's own.$q$),
($q$Coconut foam$q$, $q$keeps$q$, $q$https://fayette.osu.edu/sites/fayette/files/imce/Guide%20to%20Safely%20Store%20Foods.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$Ohio State University Extension storage chart: sweetened whipped cream keeps 1 day in the fridge. Applied as the general keep for this sweetened cream and milk foam.$q$),
($q$Coconut foam$q$, $q$keeps$q$, $q$https://culinary.isi.com/en-GB/culinary/about-isi/isi-product-support/contentpages/how-long-does-cream-keep$q$, $q$producer$q$, DATE '2026-10-13', $q$iSi: cream left in a sealed, chilled whipper keeps up to 10 days. Applies to this cream foam only while sealed in the siphon; the shorter food-safety keep wins.$q$),
($q$Dashi$q$, $q$recipe$q$, $q$https://www.justonecookbook.com/how-to-make-dashi/$q$, $q$reference$q$, DATE '2026-10-13', $q$Just One Cookbook awase dashi: 10 g kombu, 10 g katsuobushi, 4 cups water (960 ml at 240 ml a cup). Used as written.$q$),
($q$Dashi$q$, $q$yield$q$, $q$https://www.justonecookbook.com/how-to-make-dashi/$q$, $q$reference$q$, DATE '2026-10-13', $q$One batch makes about 800 ml.$q$),
($q$Dashi$q$, $q$keeps$q$, $q$https://www.justonecookbook.com/how-to-make-dashi/$q$, $q$reference$q$, DATE '2026-10-13', $q$For this dashi: 3 to 5 days in the fridge, 2 weeks frozen. We use the short end, 3 days.$q$),
($q$Dill oil$q$, $q$recipe$q$, $q$https://www.greatbritishchefs.com/how-to-cook/how-to-make-herb-oil$q$, $q$reference$q$, DATE '2026-10-13', $q$Great British Chefs' herb oil for any soft herb: 200 g herbs to 300 g groundnut oil (1 : 1.5), blanched 30 seconds. The page doesn't name dill; it is a soft herb, so we apply the method untested.$q$),
($q$Dill oil$q$, $q$keeps$q$, $q$https://nchfp.uga.edu/how/freeze/vegetable/freezing-garlic-in-oil/$q$, $q$law$q$, DATE '2026-10-13', $q$NCHFP's rule for fresh garlic in oil, from its research on vegetables and herbs stored in oil: fridge at 4 °C or below, no more than 4 days, or freeze.$q$),
($q$Dill oil$q$, $q$keeps$q$, $q$https://www.greatbritishchefs.com/how-to-cook/how-to-make-herb-oil$q$, $q$reference$q$, DATE '2026-10-13', $q$Great British Chefs says 2 weeks for herb oil; the safety source is shorter, so we use 4 days.$q$),
($q$Egg white foam$q$, $q$recipe$q$, $q$https://www.diffordsguide.com/encyclopedia/326/cocktails/foams$q$, $q$reference$q$, DATE '2026-10-13', $q$About one egg white (30 ml) per 200 ml flavourful liquid, siphon filled to half, one 8 g N2O cartridge per half litre, shaken six times, chilled 40 minutes. Scaled to 60 ml white and 400 ml liquid.$q$),
($q$Egg white foam$q$, $q$recipe$q$, $q$https://culinary.isi.com/en-GB/culinary/recipe/orange-blossom-espresso-tonic$q$, $q$producer$q$, DATE '2026-10-13', $q$Second source: iSi's orange espuma allows 150 ml pasteurised egg white to 350 ml juice and tonic, a much richer white ratio. We use Difford's 1 white per 200 ml as the general base for any liquid.$q$),
($q$Egg white foam$q$, $q$keeps$q$, $q$https://fayette.osu.edu/sites/fayette/files/imce/Guide%20to%20Safely%20Store%20Foods.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$Ohio State University Extension storage chart: raw egg whites keep 2 to 4 days in the fridge. We take the short end, 2 days.$q$),
($q$Egg white foam$q$, $q$keeps$q$, $q$https://www.diffordsguide.com/encyclopedia/326/cocktails/foams$q$, $q$reference$q$, DATE '2026-10-13', $q$Difford's: a cold egg white foam in a charged siphon lasts around a week. Longer than the food-safety keep for raw whites, so the 2 days above wins.$q$),
($q$Fermented chili$q$, $q$recipe$q$, $q$https://revolutionfermentation.com/en/blogs/fermented-vegetables/how-much-salt-fermenting-vegetables/$q$, $q$producer$q$, DATE '2026-10-13', $q$Revolution Fermentation (a ferment culture maker) puts chili peppers at 3 to 4% salt by vegetable weight; its table gives 30 g per 1 kg at 3%. We use 3%, dry-salted, soaked 15 to 30 minutes, packed under a weight.$q$),
($q$House bitters$q$, $q$recipe$q$, $q$https://www.americastestkitchen.com/recipes/13460-old-fashioned-aromatic-bitters$q$, $q$reference$q$, DATE '2026-10-13', $q$ATK tested recipe, as written: 1/4 cup raisins (4 tbsp), 1/2 oz each dried orange peel and gentian chips (14 g), 2 tbsp mugwort, 8 cardamom, 10 allspice, 4 cloves in 16 oz 100-proof vodka (480 ml), 2 weeks, then 1 oz simple syrup (30 ml). 80 proof: add a week.$q$),
($q$House bitters$q$, $q$yield$q$, $q$https://www.americastestkitchen.com/recipes/13460-old-fashioned-aromatic-bitters$q$, $q$reference$q$, DATE '2026-10-13', $q$Recipe states it makes about 16 oz (480 ml).$q$),
($q$House bitters$q$, $q$keeps$q$, $q$https://www.americastestkitchen.com/recipes/13460-old-fashioned-aromatic-bitters$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep for this exact recipe: up to a year in a cool, dark place.$q$),
($q$House-pickled onion$q$, $q$recipe$q$, $q$https://ccfruitandnuts.ucanr.edu/sites/default/files/2025-07/MFP%20Quick%20Refrigerator%20Pickles.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$UC Master Food Preservers' pickled onions, per jar: 1 cup vinegar, 1 cup water, 1 tbsp pickling salt, 2 tsp sugar; onions to fill, as the brine ratio is what matters. Doubled for 2 jars.$q$),
($q$House-pickled onion$q$, $q$keeps$q$, $q$https://ccfruitandnuts.ucanr.edu/sites/default/files/2025-07/MFP%20Quick%20Refrigerator%20Pickles.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$For these pickled onions: use within 2 weeks.$q$),
($q$Lacto-fermented tomato$q$, $q$recipe$q$, $q$https://revolutionfermentation.com/en/blogs/fermented-vegetables/how-much-salt-fermenting-vegetables/$q$, $q$producer$q$, DATE '2026-10-13', $q$Revolution Fermentation (a ferment culture maker) puts tomatoes at 2% salt, dry-salted by vegetable weight: 20 g per 1 kg, soaked 15 to 30 minutes then packed under a weight. Below 2% needs a starter culture.$q$),
($q$Leche De Tigre$q$, $q$recipe$q$, $q$https://www.bonappetit.com/recipe/leche-de-tigre$q$, $q$reference$q$, DATE '2026-10-13', $q$Lil' Deb's Oasis (Hudson, NY) in Bon Appetit: 2 cups orange juice (480 ml), 1 cup lime juice (240 ml), a 3 inch piece turmeric, a 2 inch piece ginger, 1 jalapeño, 2 garlic cloves, salt to taste. Used as written.$q$),
($q$Leche De Tigre$q$, $q$yield$q$, $q$https://www.bonappetit.com/recipe/leche-de-tigre$q$, $q$reference$q$, DATE '2026-10-13', $q$Makes about 3 cups (720 ml).$q$),
($q$Leche De Tigre$q$, $q$keeps$q$, $q$https://www.bonappetit.com/recipe/leche-de-tigre$q$, $q$reference$q$, DATE '2026-10-13', $q$For this recipe: can be made 1 day ahead, covered and chilled.$q$),
($q$Lemon curd$q$, $q$recipe$q$, $q$https://nchfp.uga.edu/how/freeze/fruits/lemon-curd-freezer/$q$, $q$law$q$, DATE '2026-10-13', $q$NCHFP tested curd: 2 1/2 cups superfine sugar (500 g at 200 g a cup), 1/2 cup zest (8 tbsp), 1 cup bottled lemon juice (240 ml), 3/4 cup butter (12 tbsp, 170 g), 7 yolks, 4 eggs, cooked to 170 °F. Second source runs about half the sugar; we use NCHFP.$q$),
($q$Lemon curd$q$, $q$recipe$q$, $q$https://www.kingarthurbaking.com/recipes/lemon-curd-recipe$q$, $q$reference$q$, DATE '2026-10-13', $q$King Arthur: 248 g sugar, 227 g lemon juice, 4 eggs plus 2 yolks, 113 g butter (8 tbsp), also to 170 °F. About 1 : 1 sugar to juice against NCHFP's 2 : 1; we use the tested NCHFP recipe.$q$),
($q$Lemon curd$q$, $q$yield$q$, $q$https://nchfp.uga.edu/how/can/canning-fruits-and-fruit-products/lemon-curd-canned/$q$, $q$law$q$, DATE '2026-10-13', $q$The same NCHFP recipe makes 3 to 4 half-pint jars (720 to 960 ml); we give the lower figure.$q$),
($q$Lemon curd$q$, $q$keeps$q$, $q$https://nchfp.uga.edu/how/freeze/fruits/lemon-curd-freezer/$q$, $q$law$q$, DATE '2026-10-13', $q$For this recipe: frozen up to a year; once thawed in the fridge, use within 4 weeks.$q$),
($q$Lemon curd$q$, $q$keeps$q$, $q$https://www.kingarthurbaking.com/recipes/lemon-curd-recipe$q$, $q$reference$q$, DATE '2026-10-13', $q$King Arthur's lower-sugar curd (less preserved than ours) keeps 1 week in the fridge; we use this shorter keep.$q$),
($q$Meringue$q$, $q$recipe$q$, $q$https://www.greatbritishchefs.com/how-to-cook/how-to-make-swiss-meringue$q$, $q$reference$q$, DATE '2026-10-13', $q$Great British Chefs' Swiss meringue: 4 large egg whites, 200 g caster sugar, a pinch of salt, heated over water to 80 °C (about 8 minutes) then whipped. Used as written.$q$),
($q$Meringue$q$, $q$keeps$q$, $q$https://www.greatbritishchefs.com/how-to-cook/how-to-make-swiss-meringue$q$, $q$reference$q$, DATE '2026-10-13', $q$For this Swiss meringue: up to 24 hours in the fridge without weeping.$q$),
($q$Miso caramel$q$, $q$recipe$q$, $q$https://imbibemagazine.com/recipe/red-miso-caramel-flat-white/$q$, $q$reference$q$, DATE '2026-10-13', $q$Megumi Ota Geronimo (Jyan Isaac Bread, Santa Monica): 1/2 oz caramel syrup to 1 tsp red miso, whisked until emulsified (15 ml : 5 ml, 3 : 1 by volume). Scaled 12 times: 180 ml and 12 tsp (4 tbsp).$q$),
($q$Orange foam$q$, $q$recipe$q$, $q$https://culinary.isi.com/en-GB/culinary/recipe/orange-blossom-espresso-tonic$q$, $q$producer$q$, DATE '2026-10-13', $q$iSi vegan orange espuma: 0.5 tsp orange extract, 200 ml strained orange juice, 150 ml tonic and 150 ml plant-based egg white in a 0.5 L whip, one charger, 10 to 12 shakes. Used as written.$q$),
($q$Pandan cream$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/crossfit-breakfast/$q$, $q$reference$q$, DATE '2026-10-13', $q$Malted pandan whipped cream (CrossFit Breakfast, Punch): 1 cup cream, 1/2 cup pandan syrup (1 cup water, 1 cup sugar, 1 pandan leaf steeped 30 min) and 1 1/4 tsp malt powder, charged once, shaken 4 times. Cups to ml at 240 ml, sugar cup at 200 g.$q$),
($q$Pandan cream$q$, $q$keeps$q$, $q$https://fayette.osu.edu/sites/fayette/files/imce/Guide%20to%20Safely%20Store%20Foods.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$Ohio State University Extension storage chart: sweetened whipped cream keeps 1 day in the fridge. Applied as the general keep for this sweetened pandan whipped cream.$q$),
($q$Pickled cucumber$q$, $q$recipe$q$, $q$https://ccfruitandnuts.ucanr.edu/sites/default/files/2025-07/MFP%20Quick%20Refrigerator%20Pickles.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$UC Master Food Preservers' sour brine for quick fridge pickles (cucumbers named): 3 cups vinegar (720 ml), 3 cups water, 3 tbsp pickling salt, 2 tbsp sugar optional; boil 2 minutes; enough for up to 4 jars. Used as written.$q$),
($q$Pickled cucumber$q$, $q$keeps$q$, $q$https://ccfruitandnuts.ucanr.edu/sites/default/files/2025-07/MFP%20Quick%20Refrigerator%20Pickles.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$For these refrigerator pickles: use within 2 weeks.$q$),
($q$Sobolo$q$, $q$recipe$q$, $q$https://lowcarbafrica.com/sorrel-drink-zobo-drink-sobolo/$q$, $q$reference$q$, DATE '2026-10-13', $q$2 cups dried hibiscus, 1/2 lemon, 2 cinnamon sticks, 5 tbsp chopped ginger, 1/2 cup sweetener of choice, 10 cups water; simmer 15 to 20 min. Cups to ml at 240; 1/2 cup sugar taken as 100 g (the source uses monk fruit).$q$),
($q$Sobolo$q$, $q$yield$q$, $q$https://lowcarbafrica.com/sorrel-drink-zobo-drink-sobolo/$q$, $q$reference$q$, DATE '2026-10-13', $q$Makes 8 cups (1920 ml) before any dilution.$q$),
($q$Sobolo$q$, $q$keeps$q$, $q$https://lowcarbafrica.com/sorrel-drink-zobo-drink-sobolo/$q$, $q$reference$q$, DATE '2026-10-13', $q$About a week in the fridge, for this same recipe made with a no-sugar sweetener (no more preserved than a sugar version).$q$),
($q$Strawberry foam$q$, $q$recipe$q$, $q$https://culinary.isi.com/en-GB/culinary/recipe/vegan-strawberry-espuma$q$, $q$producer$q$, DATE '2026-10-13', $q$iSi vegan strawberry espuma: 50 ml vegan cream (31%), 100 ml water, 300 g strawberries, 2 g agar, 100 g icing sugar; boiled, sieved into a 0.5 L whip, one charger, 12 to 16 shakes, 4 hours cold. Used as written.$q$),
($q$Ube foam$q$, $q$recipe$q$, $q$https://culinary.isi.com/en-GB/culinary/recipe/ube-dirty-chai$q$, $q$producer$q$, DATE '2026-10-13', $q$iSi Ube Sweet Cream Cloud: 200 ml cream, 250 ml milk and 50 g ube condensed milk in a 0.5 L whip, one charger, 6 to 8 shakes. iSi says up to 100 g ube condensed milk for more flavour. Used as written.$q$),
($q$Ube foam$q$, $q$keeps$q$, $q$https://fayette.osu.edu/sites/fayette/files/imce/Guide%20to%20Safely%20Store%20Foods.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$Ohio State University Extension storage chart: sweetened whipped cream keeps 1 day in the fridge. Applied as the general keep for this sweetened cream and milk foam.$q$),
($q$Ube foam$q$, $q$keeps$q$, $q$https://culinary.isi.com/en-GB/culinary/about-isi/isi-product-support/contentpages/how-long-does-cream-keep$q$, $q$producer$q$, DATE '2026-10-13', $q$iSi: cream left in a sealed, chilled whipper keeps up to 10 days. Applies to this cream foam only while sealed in the siphon; the shorter food-safety keep wins.$q$),
($q$Whipped cream$q$, $q$recipe$q$, $q$https://www.amazingfoodmadeeasy.com/info/modernist-recipes/more/shortcakes-with-agar-fruit-gels-and-siphon-whipped-cream$q$, $q$reference$q$, DATE '2026-10-13', $q$Siphon whipped cream: 225 g heavy cream, 16 g superfine or icing sugar, 4 g vanilla extract, shaken 4 to 6 times after charging. Scaled x2 to 450 g cream to fill a 0.5 L siphon.$q$),
($q$Whipped cream$q$, $q$recipe$q$, $q$https://www.bbcgoodfood.com/recipes/whipped-cream$q$, $q$reference$q$, DATE '2026-10-13', $q$Second source: plain chilled double or whipping cream, 300 ml whipped to about 600 ml, with sugar or vanilla only to taste and no amount given. We use the AFME sweetened ratio.$q$),
($q$Whipped cream$q$, $q$recipe$q$, $q$https://culinary.isi.com/en-GB/culinary/product/cream-profi-whip-0-5l$q$, $q$producer$q$, DATE '2026-10-13', $q$Charger count: one cream charger for a 0.5 L whip, two for 1 L.$q$),
($q$Whipped cream$q$, $q$keeps$q$, $q$https://fayette.osu.edu/sites/fayette/files/imce/Guide%20to%20Safely%20Store%20Foods.pdf$q$, $q$law$q$, DATE '2026-10-13', $q$Ohio State University Extension storage chart: sweetened whipped cream keeps 1 day in the fridge. Applied as the general keep for sweetened whipped cream.$q$),
($q$Whipped cream$q$, $q$keeps$q$, $q$https://blogs.extension.iastate.edu/answerline/2020/12/22/whipped-cream-tips-for-perfecting-by-stabilizing/$q$, $q$law$q$, DATE '2026-10-13', $q$Iowa State University Extension: plain whipped cream is best served the day it is made, and no more than two hours at room temperature.$q$),
($q$Whipped cream$q$, $q$keeps$q$, $q$https://culinary.isi.com/en-GB/culinary/about-isi/isi-product-support/contentpages/how-long-does-cream-keep$q$, $q$producer$q$, DATE '2026-10-13', $q$iSi: cream left in a sealed, chilled whipper keeps up to 10 days. Applies to whipped cream only while sealed in the siphon; the shorter food-safety keep wins.$q$);

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
