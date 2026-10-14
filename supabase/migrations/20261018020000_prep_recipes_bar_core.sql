-- House prep recipes for the modern bar core (after 20261018010000). Stage
-- 4D of the bottle catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 38 shared catalog preps that had no recipe get one, each from the pages
--     it cites (one item_sources row per recipe, yield and keep fact; two
--     sites for the staples): cordials, orgeats, acid solutions, a house
--     falernum (now a kind of Falernum), house grenadine (now a kind of
--     Grenadine), oleos, honey syrups, sherbets, fruit syrups and shrubs.
--     One new row: Malic acid solution (10%). One new plain ingredient:
--     Wild blueberry.
--   * Seven bar blends (Vermouth blend, Sherry blend and the like) get the
--     Mix tag only: their amounts are each bar's own.
--   * A keep is the shortest any cited page gives for that recipe or a less
--     preserved one; with nothing to cite there's no keep.
--   * An independent second check of 100 random facts against the cited
--     pages found 1 wrong (1%): a keep longer than the page's shortest. It is
--     fixed (Lemon cordial keeps a week).
--
-- Written by scripts/prep-recipes.mjs from supabase/seeds/preps/d_bar_core.json;
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
($q$Wild blueberry$q$, $q$Small lowbush blueberries, sold fresh or frozen, with a deeper colour and sharper flavour than cultivated blueberries.$q$, $q$Blueberry$q$);

INSERT INTO prep_in VALUES
($q$Apple cordial$q$, $q$Cordial$q$, false, $q$A sharp green apple cordial: filtered Granny Smith juice with sugar at 40% of its weight and a blend of malic, citric and ascorbic acid. Built for a crisp, clear Apple Martini.$q$, 0, true, 650, $q$ml$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Strain$q$, $q$Syrup$q$]::text[], false),
($q$Apple shrub$q$, $q$Shrub$q$, false, $q$Shredded whole apples steeped two days with cider vinegar, raw sugar and cinnamon, then pressed and strained. A spiced, tart base for highballs and whisky drinks.$q$, 0, true, 350, $q$ml$q$, 8736, $q$Fridge, sealed jar or bottle$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Apricot syrup$q$, $q$Syrup$q$, false, $q$Diced fresh apricots simmered in 1:1 syrup and strained. For sours, spritzes and tonic highballs.$q$, 0, true, 800, $q$ml$q$, 336, $q$Fridge, sealed jar$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Banana oleo saccharum$q$, $q$Oleo saccharum$q$, false, $q$Ripe banana peels cured in an equal weight of sugar until they give up a soft, tropical syrup. Use it in place of some of the simple syrup in a Daiquiri or Old Fashioned, and it puts peels from banana prep to work.$q$, 0, true, 300, $q$g$q$, 168, $q$Fridge, sealed non-reactive container$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Bellboy rum blend$q$, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Mix$q$]::text[], false),
($q$Blackberry shrub$q$, $q$Shrub$q$, false, $q$Equal parts blackberries, sugar and cider vinegar: berries macerated with sugar, then rested with vinegar and strained. A deep purple, jammy-tart syrup for sodas and bramble-style drinks.$q$, 0, true, 1440, $q$ml$q$, 672, $q$Fridge, glass jar$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Blueberry syrup$q$, $q$Syrup$q$, false, $q$Wild blueberries simmered in 1:1 syrup and pressed through a sieve, deep purple and jammy. For sours, lemonades and sodas.$q$, 0, true, 800, $q$ml$q$, 336, $q$Fridge, sealed jar$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Cherry syrup$q$, $q$Syrup$q$, false, $q$Halved pitted cherries simmered in 1:1 syrup, mashed and strained. For cherry sours, old fashioneds, Shirley Temples and sodas.$q$, 0, true, 640, $q$ml$q$, 336, $q$Fridge, sealed jar$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Citrus blend$q$, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Mix$q$]::text[], false),
($q$Citrus cordial$q$, $q$Cordial$q$, false, $q$A lemon and lime cordial: zest simmered in a sugar syrup, sharpened with citric and tartaric acid, then finished with the fresh juice. For highballs, gimlet riffs and long no-alcohol drinks.$q$, 0, true, 1000, $q$ml$q$, NULL, $q$Fridge, sterilised bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Ginger honey$q$, $q$Honey syrup$q$, false, $q$Honey syrup simmered with fresh ginger, then strained: sweet, warm and peppery. The one bottle a Penicillin or a hot toddy needs.$q$, 0, true, 950, $q$ml$q$, 336, $q$Fridge, airtight bottle$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Grapefruit cordial$q$, $q$Cordial$q$, false, $q$Grapefruit juice warmed with sugar and peel, then sharpened with citric acid. A bright, bitter-edged cordial for Palomas, spritzes and Americano riffs.$q$, 0, true, 780, $q$ml$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Grapefruit shrub$q$, $q$Shrub$q$, false, $q$Grapefruit peel muddled into sugar for its oil, then segments and cider vinegar steeped two to four days in the fridge. Bitter-bright, for Palomas, sodas and spritzes.$q$, 0, true, 450, $q$ml$q$, 8736, $q$Fridge, sealed bottle$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$House falernum$q$, $q$Falernum$q$, true, $q$A house falernum: overproof rum steeped with lime zest, ginger, clove and nutmeg, then married with rich syrup. The spiced lime sweetener for Corn 'n' Oil, Zombies and other tiki drinks.$q$, NULL, false, 720, $q$ml$q$, 672, $q$Fridge, airtight container$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$, $q$Syrup$q$]::text[], false),
($q$House rum blend$q$, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Mix$q$]::text[], false),
($q$House-made grenadine$q$, $q$Grenadine$q$, true, $q$Real grenadine from pomegranate juice and sugar, deepened with pomegranate molasses and a little orange flower water. Made cold, so it keeps the fresh fruit flavour for Jack Roses, Tequila Sunrises and Ward Eights.$q$, 0, true, 850, $q$ml$q$, 336, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Mix$q$]::text[], false),
($q$Jasmine cordial$q$, $q$Cordial$q$, false, $q$A floral cordial of jasmine flowers and jasmine green tea, steeped gently sous vide in a light citric syrup. For highballs with tequila, gin or soda.$q$, 0, true, 700, $q$ml$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Sous vide$q$, $q$Infuse$q$, $q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Lemon cordial$q$, $q$Cordial$q$, false, $q$A sweet-sharp lemon concentrate made Morgenthaler's way: sugar, hot water, juice, zest and citric acid blended and strained. Keeps far longer than juice and goes into gimlet-style drinks and highballs.$q$, 0, true, 720, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Blend$q$, $q$Strain$q$]::text[], false),
($q$Lemon oleo$q$, $q$Oleo saccharum$q$, false, $q$Lemon rinds cured in white and demerara sugar for a day, then loosened with boiling water into a pourable lemon oil syrup. A punch base that gets more out of the lemons you squeeze.$q$, 0, true, 250, $q$ml$q$, 336, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Lime sherbet$q$, $q$Sherbet$q$, false, $q$Lime peel cured in sugar overnight, then dissolved in an equal weight of fresh lime juice: a sweet and sour lime syrup with the oil of the peel in it. Lime peel runs bitter, so taste before you commit it to a drink. Starting point: test a batch first.$q$, 0, true, 800, $q$ml$q$, 336, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$LPV tequila and mezcal blend$q$, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Mix$q$]::text[], false),
($q$Lychee syrup$q$, $q$Syrup$q$, false, $q$A floral syrup of lychees simmered in a little under 1:1 sugar syrup, then chilled and strained. For lychee martinis, highballs and spritzes.$q$, 0, true, 700, $q$ml$q$, 168, $q$Fridge, sealed jar$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Makrut lime leaf cordial$q$, $q$Cordial$q$, false, $q$A lemon cordial steeped overnight with makrut lime leaves and ginger and sharpened with tartaric acid. The leaves give the lime perfume; lemon and acid carry the sourness.$q$, 0, true, 1200, $q$ml$q$, NULL, $q$Fridge, sterilised bottle$q$, ARRAY[$q$Infuse$q$, $q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Malic acid solution (10%)$q$, $q$Acid$q$, false, $q$Malic acid dissolved in water at the bar strength of 1 part acid to 10 parts water by weight, which bars call a 10% solution. It adds a green apple style sourness a dash at a time, or acid to batched drinks without citrus.$q$, 0, true, 530, $q$ml$q$, NULL, $q$Sealed glass bottle, room temperature$q$, ARRAY[$q$Mix$q$]::text[], false),
($q$Mandarin cordial$q$, $q$Cordial$q$, false, $q$Fresh mandarin juice boiled with an oleo saccharum made from the peels, plus citric acid. Carries the peel's perfume as well as the juice, for spritzes and gin drinks.$q$, 0, true, 650, $q$ml$q$, NULL, NULL, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Mandarin shrub$q$, $q$Shrub$q$, false, $q$Mandarin juice and peel blitzed with raw sugar and steeped overnight with champagne vinegar. Bright and usable at once, rounder after a few weeks in the bottle.$q$, 0, true, 1000, $q$ml$q$, 8064, $q$Fridge, sterilised sealed bottle$q$, ARRAY[$q$Blend$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Mango syrup$q$, $q$Syrup$q$, false, $q$Diced ripe mango simmered in 1:1 syrup and pressed through a sieve. For mango daiquiris, margaritas, mojitos and sodas.$q$, 0, true, 720, $q$ml$q$, 168, $q$Fridge, sealed jar$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Orange cordial$q$, $q$Cordial$q$, false, $q$Fresh orange juice, water and sugar with citric and malic acid added, since orange alone lacks the sourness of lemon or lime. Built for long drinks and highballs.$q$, 0, true, 1600, $q$ml$q$, NULL, NULL, ARRAY[$q$Syrup$q$]::text[], false),
($q$Orange syrup$q$, $q$Syrup$q$, false, $q$A 1:1 syrup simmered with orange zest and rested before the zest comes out. Adds orange oil and sweetness to sours, spritzes and coffee drinks.$q$, 0, true, 640, $q$ml$q$, 336, $q$Fridge, sealed jar$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Pear shrub$q$, $q$Shrub$q$, false, $q$A cold-process drinking vinegar of ripe pear, sugar and cider vinegar, left a week in the fridge so the fruit softens the vinegar. For highballs, sodas and autumn sours.$q$, 0, true, 500, $q$ml$q$, 672, $q$Fridge, sealed bottle$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Pepita orgeat$q$, $q$Orgeat$q$, false, $q$A nut-free orgeat made from hulled pumpkin seeds blended with water and sugar, giving a green-tinged, savoury nutty syrup. Use it where you would use almond orgeat, or for guests with tree nut allergies.$q$, 0, true, 360, $q$ml$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Blend$q$, $q$Strain$q$, $q$Syrup$q$]::text[], false),
($q$Pistachio orgeat$q$, $q$Orgeat$q$, false, $q$An orgeat made with pistachios in place of almonds: a blended nut milk sweetened into a creamy syrup. Swap it in for almond orgeat in Mai Tais, Saturn riffs and sours.$q$, 0, true, 945, $q$ml$q$, 672, $q$Fridge, sealed glass jar$q$, ARRAY[$q$Blend$q$, $q$Strain$q$, $q$Syrup$q$]::text[], false),
($q$Pomegranate syrup$q$, $q$Grenadine$q$, false, $q$A plain, rich pomegranate syrup: fresh juice with twice its volume of sugar, warmed only until dissolved. A simple grenadine for any drink that wants clean pomegranate sweetness.$q$, 0, true, 950, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Recomposed lime$q$, $q$Lime juice$q$, false, $q$A clear lime juice stand-in built from citric and malic acid in water, matching the acid make-up of fresh lime. It has the sourness but none of lime's sugar or peel aroma, so it bolsters juice or replaces it in clear and batched drinks.$q$, 0, true, 1000, $q$ml$q$, NULL, $q$Fridge, sealed glass bottle$q$, ARRAY[$q$Mix$q$]::text[], false),
($q$Rhubarb cordial$q$, $q$Cordial$q$, false, $q$Rhubarb simmered with sugar, lemon and a little ginger, then strained to a pink, tart cordial. Lengthen with soda or use in spritzes and sours.$q$, 0, true, 700, $q$ml$q$, 336, $q$Fridge, sterilised bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Rhubarb shrub$q$, $q$Shrub$q$, false, $q$Chopped rhubarb steeped five days in white wine vinegar, strained and warmed with sugar. Pink, sharp and vegetal, for spritzes, sodas and gin drinks.$q$, 0, true, 400, $q$ml$q$, 8736, $q$Fridge, sealed bottle$q$, ARRAY[$q$Infuse$q$, $q$Strain$q$, $q$Syrup$q$]::text[], false),
($q$Sherry blend$q$, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Mix$q$]::text[], false),
($q$Spiced honey$q$, $q$Honey syrup$q$, false, $q$Honey and sugar syrup simmered briefly with clove, star anise, cinnamon and allspice. A small measure warms up whisky drinks and autumn sours.$q$, 0, true, 650, $q$ml$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Infuse$q$, $q$Strain$q$]::text[], false),
($q$Spiced vermouth blend$q$, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Mix$q$]::text[], false),
($q$Strawberry cordial$q$, $q$Cordial$q$, false, $q$Strawberries simmered in water and strained clear, then sweetened and sharpened with lemon and citric acid. A pink, fresh-tasting cordial for sodas, spritzes and long drinks.$q$, 0, true, 1300, $q$ml$q$, NULL, $q$Fridge, sterilised bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Verdita$q$, $q$Juice$q$, false, $q$Pineapple juice blended with mint, coriander, lime and green chilli, then fine strained: the green Mexican chaser for a neat tequila or mezcal, and a bright mixer in a Margarita.$q$, 0, true, 750, $q$ml$q$, 72, $q$Fridge, sealed glass bottle$q$, ARRAY[$q$Blend$q$, $q$Strain$q$]::text[], false),
($q$Vermouth blend$q$, NULL, false, NULL, NULL, false, NULL, NULL, NULL, NULL, ARRAY[$q$Mix$q$]::text[], false),
($q$Watermelon cordial$q$, $q$Cordial$q$, false, $q$Watermelon blended with water and strained, then heated with sugar, citric acid and a little salt to lift the fruit. For watermelon sodas, Margaritas and highballs.$q$, 0, true, 1400, $q$ml$q$, 168, $q$Fridge, glass bottle$q$, ARRAY[$q$Blend$q$, $q$Strain$q$, $q$Syrup$q$]::text[], false),
($q$Yuzu cordial$q$, $q$Cordial$q$, false, $q$Sliced whole yuzu macerated cold in sugar with a little salt and citric acid, then rinsed with hot water to pull out the last of the syrup. For chuhai, highballs and sours.$q$, 0, true, NULL, NULL, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false),
($q$Yuzu sherbet$q$, $q$Sherbet$q$, false, $q$Yuzu peel cured in sugar overnight, then dissolved in an equal weight of yuzu juice for a fragrant, sharp citrus syrup. Built on the general citrus sherbet ratio, not a yuzu recipe. Starting point: test a batch first.$q$, 0, true, 400, $q$ml$q$, 336, $q$Fridge, sealed bottle$q$, ARRAY[$q$Syrup$q$, $q$Strain$q$]::text[], false);

INSERT INTO alias_in VALUES
($q$Apple cordial$q$, $q$Sour apple cordial$q$),
($q$Apple shrub$q$, $q$Cinnamon apple shrub$q$),
($q$Apricot syrup$q$, $q$Apricot simple syrup$q$),
($q$Banana oleo saccharum$q$, $q$Banana oleo$q$),
($q$Banana oleo saccharum$q$, $q$Banana peel oleo$q$),
($q$Blueberry syrup$q$, $q$Blueberry simple syrup$q$),
($q$Cherry syrup$q$, $q$Cherry simple syrup$q$),
($q$Citrus cordial$q$, $q$Lemon and lime cordial$q$),
($q$Ginger honey$q$, $q$Ginger honey syrup$q$),
($q$Jasmine cordial$q$, $q$Jasmine flower cordial$q$),
($q$Lemon oleo$q$, $q$Lemon oleo saccharum$q$),
($q$Lemon oleo$q$, $q$Lemon oleo-saccharum$q$),
($q$Makrut lime leaf cordial$q$, $q$Kaffir lime leaf cordial$q$),
($q$Makrut lime leaf cordial$q$, $q$Makrut lime and lemon cordial$q$),
($q$Malic acid solution (10%)$q$, $q$Malic solution$q$),
($q$Orange cordial$q$, $q$Citric orange cordial$q$),
($q$Orange syrup$q$, $q$Orange simple syrup$q$),
($q$Pepita orgeat$q$, $q$Pumpkin seed orgeat$q$),
($q$Spiced honey$q$, $q$Spiced honey syrup$q$),
($q$Verdita$q$, $q$Green sangrita$q$),
($q$Watermelon cordial$q$, $q$Salted watermelon cordial$q$);

INSERT INTO line_in VALUES
($q$Apple cordial$q$, 0, $q$Granny Smith apple juice$q$, 500, $q$g$q$, $q$freshly juiced and filtered clear, or clear 100% apple juice$q$, false),
($q$Apple cordial$q$, 1, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Apple cordial$q$, 2, $q$Malic acid$q$, 21, $q$g$q$, NULL, false),
($q$Apple cordial$q$, 3, $q$Citric acid$q$, 10.5, $q$g$q$, NULL, false),
($q$Apple cordial$q$, 4, $q$Ascorbic acid$q$, 3.5, $q$g$q$, NULL, false),
($q$Apple shrub$q$, 0, $q$Apple$q$, 3, $q$each$q$, $q$medium, quartered, core and seeds left in$q$, false),
($q$Apple shrub$q$, 1, $q$Apple cider vinegar$q$, 240, $q$ml$q$, NULL, false),
($q$Apple shrub$q$, 2, $q$Turbinado sugar$q$, 100, $q$g$q$, NULL, false),
($q$Apple shrub$q$, 3, $q$Cinnamon$q$, 2, $q$each$q$, $q$sticks$q$, false),
($q$Apricot syrup$q$, 0, $q$Apricot$q$, 480, $q$ml$q$, $q$diced (2 cups, about 8 to 10 apricots)$q$, false),
($q$Apricot syrup$q$, 1, $q$Sugar$q$, 400, $q$g$q$, $q$cane sugar$q$, false),
($q$Apricot syrup$q$, 2, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$Banana oleo saccharum$q$, 0, $q$Banana peel$q$, 250, $q$g$q$, $q$ripe, chopped into 1 cm pieces$q$, false),
($q$Banana oleo saccharum$q$, 1, $q$Sugar$q$, 250, $q$g$q$, $q$white granulated$q$, false),
($q$Blackberry shrub$q$, 0, $q$Blackberry$q$, 480, $q$ml$q$, $q$fresh (2 cups by volume)$q$, false),
($q$Blackberry shrub$q$, 1, $q$Sugar$q$, 400, $q$g$q$, NULL, false),
($q$Blackberry shrub$q$, 2, $q$Apple cider vinegar$q$, 480, $q$ml$q$, NULL, false),
($q$Blueberry syrup$q$, 0, $q$Wild blueberry$q$, 480, $q$ml$q$, $q$fresh or frozen (2 cups); the source allows twice the volume of regular blueberries$q$, false),
($q$Blueberry syrup$q$, 1, $q$Sugar$q$, 400, $q$g$q$, $q$cane sugar$q$, false),
($q$Blueberry syrup$q$, 2, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$Cherry syrup$q$, 0, $q$Sugar$q$, 400, $q$g$q$, $q$granulated or cane$q$, false),
($q$Cherry syrup$q$, 1, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$Cherry syrup$q$, 2, $q$Cherry$q$, 480, $q$ml$q$, $q$pitted and halved, fresh or frozen (2 cups)$q$, false),
($q$Citrus cordial$q$, 0, $q$Lime$q$, 5, $q$each$q$, $q$zested and juiced$q$, false),
($q$Citrus cordial$q$, 1, $q$Lemon$q$, 3, $q$each$q$, $q$zested and juiced$q$, false),
($q$Citrus cordial$q$, 2, $q$Sugar$q$, 660, $q$g$q$, $q$white$q$, false),
($q$Citrus cordial$q$, 3, $q$Water$q$, 625, $q$ml$q$, NULL, false),
($q$Citrus cordial$q$, 4, $q$Citric acid$q$, 1, $q$tsp$q$, NULL, false),
($q$Citrus cordial$q$, 5, $q$Tartaric acid$q$, 2, $q$tsp$q$, NULL, false),
($q$Ginger honey$q$, 0, $q$Honey$q$, 600, $q$g$q$, NULL, false),
($q$Ginger honey$q$, 1, $q$Water$q$, 600, $q$g$q$, NULL, false),
($q$Ginger honey$q$, 2, $q$Ginger$q$, 250, $q$g$q$, $q$fresh root, peeled, 1 cm chunks$q$, false),
($q$Grapefruit cordial$q$, 0, $q$Grapefruit juice$q$, 500, $q$g$q$, $q$clarified in the source; at least fine strained$q$, false),
($q$Grapefruit cordial$q$, 1, $q$Sugar$q$, 450, $q$g$q$, NULL, false),
($q$Grapefruit cordial$q$, 2, $q$Grapefruit peel$q$, 25, $q$g$q$, NULL, false),
($q$Grapefruit cordial$q$, 3, $q$Citric acid$q$, 10, $q$g$q$, NULL, false),
($q$Grapefruit shrub$q$, 0, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Grapefruit shrub$q$, 1, $q$Grapefruit peel$q$, 1, $q$peel$q$, $q$whole peel of 1 medium grapefruit, little pith$q$, false),
($q$Grapefruit shrub$q$, 2, $q$Grapefruit$q$, 240, $q$ml$q$, $q$fresh segments (1 cup by volume)$q$, false),
($q$Grapefruit shrub$q$, 3, $q$Apple cider vinegar$q$, 240, $q$ml$q$, NULL, false),
($q$House falernum$q$, 0, $q$Overproof rum$q$, 240, $q$ml$q$, NULL, false),
($q$House falernum$q$, 1, $q$Clove$q$, 40, $q$each$q$, $q$whole$q$, false),
($q$House falernum$q$, 2, $q$Lime zest$q$, 10, $q$each$q$, $q$zest of 10 limes$q$, false),
($q$House falernum$q$, 3, $q$Ginger$q$, 85, $q$g$q$, $q$peeled and diced$q$, false),
($q$House falernum$q$, 4, $q$Nutmeg$q$, 0.25, $q$each$q$, $q$grated$q$, false),
($q$House falernum$q$, 5, $q$Sugar$q$, 567, $q$g$q$, NULL, false),
($q$House falernum$q$, 6, $q$Water$q$, 284, $q$ml$q$, $q$hot$q$, false),
($q$House-made grenadine$q$, 0, $q$Pomegranate juice$q$, 480, $q$ml$q$, $q$room temperature$q$, false),
($q$House-made grenadine$q$, 1, $q$Sugar$q$, 400, $q$g$q$, $q$superfine$q$, false),
($q$House-made grenadine$q$, 2, $q$Pomegranate molasses$q$, 120, $q$ml$q$, NULL, false),
($q$House-made grenadine$q$, 3, $q$Orange blossom water$q$, 10, $q$ml$q$, $q$optional, to taste$q$, false),
($q$Jasmine cordial$q$, 0, $q$Caster sugar$q$, 280, $q$g$q$, NULL, false),
($q$Jasmine cordial$q$, 1, $q$Water$q$, 560, $q$ml$q$, $q$filtered$q$, false),
($q$Jasmine cordial$q$, 2, $q$Jasmine$q$, 6, $q$g$q$, $q$dried jasmine flowers$q$, false),
($q$Jasmine cordial$q$, 3, $q$Jasmine tea$q$, 18, $q$g$q$, $q$jasmine green tea, loose leaf$q$, false),
($q$Jasmine cordial$q$, 4, $q$Citric acid$q$, 10, $q$g$q$, NULL, false),
($q$Lemon cordial$q$, 0, $q$Sugar$q$, 500, $q$g$q$, NULL, false),
($q$Lemon cordial$q$, 1, $q$Water$q$, 480, $q$ml$q$, $q$hot$q$, false),
($q$Lemon cordial$q$, 2, $q$Lemon juice$q$, 90, $q$ml$q$, $q$fresh$q$, false),
($q$Lemon cordial$q$, 3, $q$Lemon zest$q$, 16, $q$g$q$, $q$freshly grated$q$, false),
($q$Lemon cordial$q$, 4, $q$Citric acid$q$, 50, $q$g$q$, NULL, false),
($q$Lemon oleo$q$, 0, $q$Lemon peel$q$, 125, $q$ml$q$, $q$rinds, loosely packed (half a cup)$q$, false),
($q$Lemon oleo$q$, 1, $q$Caster sugar$q$, 133, $q$g$q$, $q$superfine white$q$, false),
($q$Lemon oleo$q$, 2, $q$Demerara sugar$q$, 33, $q$g$q$, NULL, false),
($q$Lemon oleo$q$, 3, $q$Water$q$, 250, $q$ml$q$, $q$boiling$q$, false),
($q$Lime sherbet$q$, 0, $q$Lime peel$q$, NULL, NULL, $q$peels of the limes you juice, thin, as little pith as possible$q$, false),
($q$Lime sherbet$q$, 1, $q$Sugar$q$, 500, $q$g$q$, $q$caster or superfine$q$, false),
($q$Lime sherbet$q$, 2, $q$Lime juice$q$, 500, $q$ml$q$, $q$fresh, strained$q$, false),
($q$Lychee syrup$q$, 0, $q$Water$q$, 500, $q$ml$q$, NULL, false),
($q$Lychee syrup$q$, 1, $q$Sugar$q$, 400, $q$g$q$, $q$granulated$q$, false),
($q$Lychee syrup$q$, 2, $q$Lychee$q$, 48, $q$each$q$, $q$peeled and pitted, fresh or canned$q$, false),
($q$Makrut lime leaf cordial$q$, 0, $q$Lemon$q$, 4, $q$each$q$, $q$scrubbed, zested and juiced; squeezed halves steeped then lifted out$q$, false),
($q$Makrut lime leaf cordial$q$, 1, $q$Makrut lime leaf$q$, 4, $q$leaf$q$, NULL, false),
($q$Makrut lime leaf cordial$q$, 2, $q$Ginger$q$, NULL, NULL, $q$3 cm piece, bruised$q$, false),
($q$Makrut lime leaf cordial$q$, 3, $q$Caster sugar$q$, 700, $q$g$q$, NULL, false),
($q$Makrut lime leaf cordial$q$, 4, $q$Water$q$, 1000, $q$ml$q$, $q$boiling$q$, false),
($q$Makrut lime leaf cordial$q$, 5, $q$Tartaric acid$q$, 50, $q$g$q$, NULL, false),
($q$Malic acid solution (10%)$q$, 0, $q$Malic acid$q$, 50, $q$g$q$, NULL, false),
($q$Malic acid solution (10%)$q$, 1, $q$Water$q$, 500, $q$ml$q$, $q$filtered, hot$q$, false),
($q$Mandarin cordial$q$, 0, $q$Mandarin peel$q$, 12, $q$each$q$, NULL, false),
($q$Mandarin cordial$q$, 1, $q$Sugar$q$, 250, $q$g$q$, NULL, false),
($q$Mandarin cordial$q$, 2, $q$Mandarin juice$q$, 500, $q$ml$q$, $q$freshly juiced, solids strained out$q$, false),
($q$Mandarin cordial$q$, 3, $q$Citric acid$q$, 10, $q$g$q$, NULL, false),
($q$Mandarin shrub$q$, 0, $q$Raw sugar$q$, 660, $q$g$q$, NULL, false),
($q$Mandarin shrub$q$, 1, $q$Mandarin peel$q$, 6, $q$peel$q$, $q$peel of 6 mandarins$q$, false),
($q$Mandarin shrub$q$, 2, $q$Lemon zest$q$, 1, $q$each$q$, $q$zest of 1 lemon$q$, false),
($q$Mandarin shrub$q$, 3, $q$Mandarin juice$q$, 750, $q$ml$q$, $q$fresh$q$, false),
($q$Mandarin shrub$q$, 4, $q$Champagne vinegar$q$, 500, $q$ml$q$, $q$or white wine vinegar$q$, false),
($q$Mango syrup$q$, 0, $q$Sugar$q$, 400, $q$g$q$, $q$cane sugar$q$, false),
($q$Mango syrup$q$, 1, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$Mango syrup$q$, 2, $q$Mango$q$, 480, $q$ml$q$, $q$diced, ripe, fresh or frozen (2 cups)$q$, false),
($q$Orange cordial$q$, 0, $q$Orange juice$q$, 600, $q$g$q$, $q$freshly squeezed$q$, false),
($q$Orange cordial$q$, 1, $q$Water$q$, 600, $q$ml$q$, NULL, false),
($q$Orange cordial$q$, 2, $q$Sugar$q$, 600, $q$g$q$, NULL, false),
($q$Orange cordial$q$, 3, $q$Citric acid$q$, 30, $q$g$q$, NULL, false),
($q$Orange cordial$q$, 4, $q$Malic acid$q$, 15, $q$g$q$, NULL, false),
($q$Orange syrup$q$, 0, $q$Sugar$q$, 400, $q$g$q$, $q$cane sugar$q$, false),
($q$Orange syrup$q$, 1, $q$Water$q$, 480, $q$ml$q$, NULL, false),
($q$Orange syrup$q$, 2, $q$Orange zest$q$, 2, $q$each$q$, $q$zest of 2 oranges, cut with a peeler, white pith removed$q$, false),
($q$Pear shrub$q$, 0, $q$Pear$q$, 480, $q$ml$q$, $q$very ripe Bartlett, peeled, 1 cm dice (2 cups by volume)$q$, false),
($q$Pear shrub$q$, 1, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Pear shrub$q$, 2, $q$Apple cider vinegar$q$, 240, $q$ml$q$, $q$unfiltered$q$, false),
($q$Pepita orgeat$q$, 0, $q$Pumpkin seeds$q$, 113, $q$g$q$, $q$hulled pepitas$q$, false),
($q$Pepita orgeat$q$, 1, $q$Water$q$, 227, $q$ml$q$, NULL, false),
($q$Pepita orgeat$q$, 2, $q$Sugar$q$, 227, $q$g$q$, NULL, false),
($q$Pistachio orgeat$q$, 0, $q$Water$q$, 720, $q$ml$q$, $q$near boiling$q$, false),
($q$Pistachio orgeat$q$, 1, $q$Pistachio$q$, 198, $q$g$q$, $q$shelled, unsalted$q$, false),
($q$Pistachio orgeat$q$, 2, $q$Sugar$q$, 450, $q$g$q$, NULL, false),
($q$Pomegranate syrup$q$, 0, $q$Pomegranate juice$q$, 480, $q$ml$q$, $q$fresh pressed, strained$q$, false),
($q$Pomegranate syrup$q$, 1, $q$Sugar$q$, 800, $q$g$q$, NULL, false),
($q$Recomposed lime$q$, 0, $q$Water$q$, 940, $q$ml$q$, $q$filtered$q$, false),
($q$Recomposed lime$q$, 1, $q$Citric acid$q$, 40, $q$g$q$, NULL, false),
($q$Recomposed lime$q$, 2, $q$Malic acid$q$, 20, $q$g$q$, NULL, false),
($q$Rhubarb cordial$q$, 0, $q$Rhubarb$q$, 500, $q$g$q$, $q$cut into chunks$q$, false),
($q$Rhubarb cordial$q$, 1, $q$Sugar$q$, 250, $q$g$q$, $q$caster or granulated$q$, false),
($q$Rhubarb cordial$q$, 2, $q$Water$q$, 400, $q$ml$q$, NULL, false),
($q$Rhubarb cordial$q$, 3, $q$Lemon$q$, 1, $q$each$q$, $q$zest and juice$q$, false),
($q$Rhubarb cordial$q$, 4, $q$Ginger$q$, NULL, NULL, $q$optional, thumb-sized piece, peeled and finely grated$q$, false),
($q$Rhubarb cordial$q$, 5, $q$Citric acid$q$, 1, $q$tsp$q$, $q$stirred into the strained cordial$q$, false),
($q$Rhubarb shrub$q$, 0, $q$Rhubarb$q$, 360, $q$ml$q$, $q$stalks only, chopped (1.5 cups by volume)$q$, false),
($q$Rhubarb shrub$q$, 1, $q$White wine vinegar$q$, 240, $q$ml$q$, NULL, false),
($q$Rhubarb shrub$q$, 2, $q$Sugar$q$, 200, $q$g$q$, NULL, false),
($q$Spiced honey$q$, 0, $q$Water$q$, 250, $q$ml$q$, NULL, false),
($q$Spiced honey$q$, 1, $q$Honey$q$, 250, $q$ml$q$, $q$1 cup$q$, false),
($q$Spiced honey$q$, 2, $q$Sugar$q$, 250, $q$g$q$, NULL, false),
($q$Spiced honey$q$, 3, $q$Clove$q$, 5, $q$each$q$, $q$whole$q$, false),
($q$Spiced honey$q$, 4, $q$Star anise$q$, 5, $q$each$q$, $q$pods$q$, false),
($q$Spiced honey$q$, 5, $q$Cinnamon$q$, 1, $q$each$q$, $q$stick$q$, false),
($q$Spiced honey$q$, 6, $q$Allspice$q$, 5, $q$each$q$, $q$berries$q$, false),
($q$Strawberry cordial$q$, 0, $q$Strawberry$q$, 1000, $q$g$q$, $q$washed, hulled, halved if large; pulp strained out$q$, false),
($q$Strawberry cordial$q$, 1, $q$Water$q$, 600, $q$ml$q$, NULL, false),
($q$Strawberry cordial$q$, 2, $q$Sugar$q$, 500, $q$g$q$, NULL, false),
($q$Strawberry cordial$q$, 3, $q$Lemon juice$q$, 30, $q$ml$q$, NULL, false),
($q$Strawberry cordial$q$, 4, $q$Citric acid$q$, 1, $q$tsp$q$, NULL, false),
($q$Verdita$q$, 0, $q$Pineapple juice$q$, 750, $q$ml$q$, NULL, false),
($q$Verdita$q$, 1, $q$Lime$q$, 1, $q$each$q$, $q$juiced, more to taste$q$, false),
($q$Verdita$q$, 2, $q$Coriander$q$, NULL, NULL, $q$1 large handful fresh leaves (cilantro)$q$, false),
($q$Verdita$q$, 3, $q$Mint$q$, NULL, NULL, $q$1 large handful fresh leaves$q$, false),
($q$Verdita$q$, 4, $q$Jalapeño$q$, 1, $q$each$q$, $q$half to one, seeds out, diced, added to taste$q$, false),
($q$Watermelon cordial$q$, 0, $q$Watermelon$q$, 800, $q$g$q$, $q$peeled, seeded flesh$q$, false),
($q$Watermelon cordial$q$, 1, $q$Water$q$, 400, $q$g$q$, NULL, false),
($q$Watermelon cordial$q$, 2, $q$Salt$q$, 12, $q$g$q$, $q$1% of the strained juice weight$q$, false),
($q$Watermelon cordial$q$, 3, $q$Citric acid$q$, 3, $q$tsp$q$, $q$half a teaspoon per 200 g strained juice$q$, false),
($q$Watermelon cordial$q$, 4, $q$Sugar$q$, 400, $q$g$q$, $q$a third of the strained juice weight$q$, false),
($q$Yuzu cordial$q$, 0, $q$Yuzu$q$, 10, $q$each$q$, $q$sliced$q$, false),
($q$Yuzu cordial$q$, 1, $q$Sugar$q$, 500, $q$g$q$, $q$granulated$q$, false),
($q$Yuzu cordial$q$, 2, $q$Kosher salt$q$, 5, $q$g$q$, NULL, false),
($q$Yuzu cordial$q$, 3, $q$Citric acid$q$, 5, $q$g$q$, NULL, false),
($q$Yuzu cordial$q$, 4, $q$Water$q$, 250, $q$g$q$, $q$hot, for rinsing the solids$q$, false),
($q$Yuzu sherbet$q$, 0, $q$Yuzu peel$q$, NULL, NULL, $q$peels of the yuzu you juice, thin, as little pith as possible$q$, false),
($q$Yuzu sherbet$q$, 1, $q$Sugar$q$, 250, $q$g$q$, $q$caster or superfine$q$, false),
($q$Yuzu sherbet$q$, 2, $q$Yuzu juice$q$, 250, $q$ml$q$, $q$fresh, strained$q$, false);

INSERT INTO step_in VALUES
($q$Apple cordial$q$, 0, $q$Juice the apples and pass the juice through a fine sieve, then a coffee filter, until it runs clear. Weigh it.$q$, NULL),
($q$Apple cordial$q$, 1, $q$Stir the sugar with half the juice over low heat just until it dissolves, then take it off the heat and add the rest of the juice.$q$, NULL),
($q$Apple cordial$q$, 2, $q$Weigh the mix and stir in the malic, citric and ascorbic acid until dissolved. Bottle and chill.$q$, NULL),
($q$Apple shrub$q$, 0, $q$Shred the quartered apples on a box grater or in a food processor.$q$, NULL),
($q$Apple shrub$q$, 1, $q$Mix the apple, vinegar, sugar and cinnamon sticks in a non-reactive tub, cover and leave somewhere cool for up to 2 days.$q$, NULL),
($q$Apple shrub$q$, 2, $q$Strain through a fine sieve, pressing the apple to get all the liquid out. Discard the solids.$q$, NULL),
($q$Apple shrub$q$, 3, $q$Bottle, shake to mix and keep in the fridge. Bin it if it turns bubbly, cloudy or slimy, or shows mould.$q$, NULL),
($q$Apricot syrup$q$, 0, $q$Bring apricots, sugar and water to the boil, stirring just until the sugar dissolves.$q$, NULL),
($q$Apricot syrup$q$, 1, $q$Turn down and simmer.$q$, 600),
($q$Apricot syrup$q$, 2, $q$Take off the heat and cool.$q$, 600),
($q$Apricot syrup$q$, 3, $q$Strain through a fine sieve, pressing the fruit. Close the jar once cool and keep cold.$q$, NULL),
($q$Banana oleo saccharum$q$, 0, $q$Chop the ripe banana peels into 1 cm pieces and weigh them.$q$, NULL),
($q$Banana oleo saccharum$q$, 1, $q$Seal the peels with an equal weight of sugar in a jar or bag and shake to coat.$q$, NULL),
($q$Banana oleo saccharum$q$, 2, $q$Leave at room temperature for 24 to 48 hours, until the sugar has turned to syrup.$q$, 86400),
($q$Banana oleo saccharum$q$, 3, $q$Strain out all the solids and bottle the syrup. Keep it cold.$q$, NULL),
($q$Blackberry shrub$q$, 0, $q$Mash the blackberries with the sugar and leave in the fridge for a few hours or overnight.$q$, NULL),
($q$Blackberry shrub$q$, 1, $q$Stir in the vinegar and return to the fridge for a few hours up to a few days, depending on how sharp you want it.$q$, NULL),
($q$Blackberry shrub$q$, 2, $q$Strain out the solids and bottle in glass. Keep cold.$q$, NULL),
($q$Blueberry syrup$q$, 0, $q$Bring blueberries, sugar and water to the boil, stirring until the sugar dissolves.$q$, NULL),
($q$Blueberry syrup$q$, 1, $q$Turn down and simmer.$q$, 900),
($q$Blueberry syrup$q$, 2, $q$Take off the heat and cool 10 to 15 minutes.$q$, NULL),
($q$Blueberry syrup$q$, 3, $q$Strain through a fine sieve, pressing the berries. Close the jar once fully cool and keep cold.$q$, NULL),
($q$Cherry syrup$q$, 0, $q$Bring sugar, water and cherries to the boil, stirring until the sugar dissolves.$q$, NULL),
($q$Cherry syrup$q$, 1, $q$Simmer gently; don't let it boil hard.$q$, 600),
($q$Cherry syrup$q$, 2, $q$Off the heat, mash the cherries and let it stand.$q$, 600),
($q$Cherry syrup$q$, 3, $q$Strain through a fine sieve, pressing the fruit. Close the jar once cool and keep cold.$q$, NULL),
($q$Citrus cordial$q$, 0, $q$Put the lime and lemon zest, sugar and water in a pan and bring to the boil.$q$, NULL),
($q$Citrus cordial$q$, 1, $q$Turn the heat down and simmer gently.$q$, 300),
($q$Citrus cordial$q$, 2, $q$Stir in the citric and tartaric acid and take the pan off the heat.$q$, NULL),
($q$Citrus cordial$q$, 3, $q$Add the lime and lemon juice, strain out the zest and bottle in sterilised bottles.$q$, NULL),
($q$Ginger honey$q$, 0, $q$Peel the ginger and cut it into 1 cm chunks.$q$, NULL),
($q$Ginger honey$q$, 1, $q$Bring the ginger, honey and water to a low boil, then turn down and simmer gently, stirring now and then.$q$, 600),
($q$Ginger honey$q$, 2, $q$Take it off the heat and let it stand before straining.$q$, 600),
($q$Ginger honey$q$, 3, $q$Strain out the ginger, cool and bottle. Shake before use, as it settles.$q$, NULL),
($q$Grapefruit cordial$q$, 0, $q$Put the grapefruit juice, sugar and peel in a pot and bring just to a simmer.$q$, NULL),
($q$Grapefruit cordial$q$, 1, $q$Take it off the heat and stir until all the sugar has dissolved.$q$, NULL),
($q$Grapefruit cordial$q$, 2, $q$Strain out the peel.$q$, NULL),
($q$Grapefruit cordial$q$, 3, $q$Stir in the citric acid, let it cool, then bottle and keep in the fridge.$q$, NULL),
($q$Grapefruit shrub$q$, 0, $q$Muddle the sugar with the grapefruit peel to work the oils out.$q$, NULL),
($q$Grapefruit shrub$q$, 1, $q$Add the segments, muddle again and leave for 10 minutes.$q$, 600),
($q$Grapefruit shrub$q$, 2, $q$Stir in the vinegar, cover and steep in the fridge for 2 to 4 days: shorter for a sharper shrub.$q$, NULL),
($q$Grapefruit shrub$q$, 3, $q$Strain out the solids, bottle and keep cold.$q$, NULL),
($q$House falernum$q$, 0, $q$Combine the rum, cloves, lime zest, ginger and nutmeg in a sealed container and leave for 24 hours. Overproof rum: keep it well away from flames and hot burners.$q$, 86400),
($q$House falernum$q$, 1, $q$Strain the infusion through a fine sieve.$q$, NULL),
($q$House falernum$q$, 2, $q$Make a rich syrup: stir the sugar into the hot water until fully dissolved, then cool.$q$, NULL),
($q$House falernum$q$, 3, $q$Blend the strained infusion with the cooled syrup and let it rest for several hours before using. Keep chilled.$q$, NULL),
($q$House-made grenadine$q$, 0, $q$Combine the pomegranate juice and sugar in a bottle or jar and shake until the sugar dissolves.$q$, NULL),
($q$House-made grenadine$q$, 1, $q$Add the pomegranate molasses and shake well; it dissolves faster if the juice is at room temperature.$q$, NULL),
($q$House-made grenadine$q$, 2, $q$Add orange flower water to taste, then refrigerate. Extra can be frozen.$q$, NULL),
($q$Jasmine cordial$q$, 0, $q$Put everything in a vacuum bag and seal.$q$, NULL),
($q$Jasmine cordial$q$, 1, $q$Cook sous vide at 50°C.$q$, 3600),
($q$Jasmine cordial$q$, 2, $q$Strain out the flowers and tea, bottle and chill.$q$, NULL),
($q$Lemon cordial$q$, 0, $q$Put the sugar, hot water, lemon juice, grated zest and citric acid in a blender.$q$, NULL),
($q$Lemon cordial$q$, 1, $q$Blend on medium for 30 seconds, until the sugar and acid have dissolved.$q$, 30),
($q$Lemon cordial$q$, 2, $q$Pass through a fine strainer to take out the zest.$q$, NULL),
($q$Lemon cordial$q$, 3, $q$Bottle and keep in the fridge.$q$, NULL),
($q$Lemon oleo$q$, 0, $q$Put the lemon rinds in a jar with both sugars and leave for 24 hours.$q$, 86400),
($q$Lemon oleo$q$, 1, $q$Pour boiling water over the sugar and rinds and stir until the sugar has dissolved.$q$, NULL),
($q$Lemon oleo$q$, 2, $q$Strain out the rinds and bottle the syrup. Keep it cold.$q$, NULL),
($q$Lime sherbet$q$, 0, $q$Peel the limes thinly, leaving the white pith behind (it makes lime sherbet bitter), then juice and strain them.$q$, NULL),
($q$Lime sherbet$q$, 1, $q$Muddle the peels into the sugar, cover and leave at room temperature, stirring now and then, until the oil has turned the sugar to syrup.$q$, 86400),
($q$Lime sherbet$q$, 2, $q$Lift out the peels and stir in the juice until the sugar dissolves. Warm it gently if needed, but never boil.$q$, NULL),
($q$Lime sherbet$q$, 3, $q$Bottle and keep cold.$q$, NULL),
($q$Lychee syrup$q$, 0, $q$Bring the water and sugar to a simmer over medium heat.$q$, NULL),
($q$Lychee syrup$q$, 1, $q$Add the lychees, pressing them lightly, and simmer until the syrup lightly coats a spoon, like thin maple syrup.$q$, 600),
($q$Lychee syrup$q$, 2, $q$Pour syrup and fruit into a jar and let cool.$q$, NULL),
($q$Lychee syrup$q$, 3, $q$Chill with the fruit in so the flavour carries through.$q$, 3600),
($q$Lychee syrup$q$, 4, $q$Strain into a clean bottle, pressing the lychees lightly. Keep cold.$q$, NULL),
($q$Makrut lime leaf cordial$q$, 0, $q$Put the lemon zest, juice and squeezed halves, lime leaves, ginger and sugar in a heatproof bowl.$q$, NULL),
($q$Makrut lime leaf cordial$q$, 1, $q$Pour over the boiling water and stir until the sugar dissolves. Cool a little, cover and steep in the fridge overnight.$q$, NULL),
($q$Makrut lime leaf cordial$q$, 2, $q$Lift out the lemon halves, leaves and ginger.$q$, NULL),
($q$Makrut lime leaf cordial$q$, 3, $q$Stir in the tartaric acid, bottle and keep cold. Shake before pouring.$q$, NULL),
($q$Malic acid solution (10%)$q$, 0, $q$Weigh the malic acid and pour over the hot water.$q$, NULL),
($q$Malic acid solution (10%)$q$, 1, $q$Whisk until fully dissolved, then cool.$q$, NULL),
($q$Malic acid solution (10%)$q$, 2, $q$Bottle in glass rather than plastic or metal, and label with the strength.$q$, NULL),
($q$Mandarin cordial$q$, 0, $q$Muddle the mandarin peels with the sugar in a sealed container to release their oils, then leave 24 hours.$q$, 86400),
($q$Mandarin cordial$q$, 1, $q$Lift out the peels and add the oily sugar to the strained mandarin juice.$q$, NULL),
($q$Mandarin cordial$q$, 2, $q$Add the citric acid and bring to the boil, stirring until the sugar and acid have dissolved.$q$, NULL),
($q$Mandarin cordial$q$, 3, $q$Let it cool and pour into a clean bottle.$q$, NULL),
($q$Mandarin shrub$q$, 0, $q$Blitz the sugar and mandarin peel for about 10 seconds to a coarse, wet pulp.$q$, 10),
($q$Mandarin shrub$q$, 1, $q$Tip into a bowl and stir in the lemon zest, mandarin juice and vinegar until the sugar dissolves.$q$, NULL),
($q$Mandarin shrub$q$, 2, $q$Cover with a clean cloth and leave at room temperature overnight.$q$, NULL),
($q$Mandarin shrub$q$, 3, $q$Strain through a fine sieve into a sterilised bottle, seal and refrigerate. Use now or rest 3 to 4 weeks to mellow.$q$, NULL),
($q$Mango syrup$q$, 0, $q$Bring sugar, water and mango to the boil, stirring until the sugar dissolves.$q$, NULL),
($q$Mango syrup$q$, 1, $q$Turn down and simmer.$q$, 900),
($q$Mango syrup$q$, 2, $q$Take off the heat and cool.$q$, 600),
($q$Mango syrup$q$, 3, $q$Strain through a fine sieve, pressing the mango hard. Close the jar once cool and keep cold.$q$, NULL),
($q$Orange cordial$q$, 0, $q$Put the orange juice, water, sugar, citric acid and malic acid in a pot.$q$, NULL),
($q$Orange cordial$q$, 1, $q$Warm, stirring, until the sugar has dissolved.$q$, NULL),
($q$Orange cordial$q$, 2, $q$Take it off the heat, let it cool and bottle.$q$, NULL),
($q$Orange syrup$q$, 0, $q$Cut the zest with a peeler and trim off the white pith, which is bitter.$q$, NULL),
($q$Orange syrup$q$, 1, $q$Bring sugar, water and zest to the boil, stirring until the sugar dissolves.$q$, NULL),
($q$Orange syrup$q$, 2, $q$Simmer gently.$q$, 900),
($q$Orange syrup$q$, 3, $q$Off the heat, rest 10 to 15 minutes, then lift out the zest. Close the jar once cool and keep cold.$q$, NULL),
($q$Pear shrub$q$, 0, $q$Put the diced pear, sugar and vinegar in a clean jar and seal it.$q$, NULL),
($q$Pear shrub$q$, 1, $q$Leave in the fridge for 5 to 7 days, giving it a gentle stir once a day so the sugar dissolves.$q$, NULL),
($q$Pear shrub$q$, 2, $q$Strain out the fruit through a fine sieve, bottle and keep cold. Bin it if it fizzes hard or smells off.$q$, NULL),
($q$Pepita orgeat$q$, 0, $q$Blend the pepitas to a fine powder.$q$, NULL),
($q$Pepita orgeat$q$, 1, $q$With the blender on low, add the water slowly until fully combined.$q$, NULL),
($q$Pepita orgeat$q$, 2, $q$Still on low, add the sugar slowly until dissolved.$q$, NULL),
($q$Pepita orgeat$q$, 3, $q$Strain through a coffee filter, bottle and chill.$q$, NULL),
($q$Pistachio orgeat$q$, 0, $q$Blend the pistachios with the near-boiling water on high for 2 full minutes; the longer the blend, the smoother the syrup.$q$, 120),
($q$Pistachio orgeat$q$, 1, $q$Strain through a nut-milk bag, or a fine sieve lined with several layers of cheesecloth, and discard the solids.$q$, NULL),
($q$Pistachio orgeat$q$, 2, $q$Return the nut milk to the blender, add the sugar and blend for another minute until dissolved.$q$, 60),
($q$Pistachio orgeat$q$, 3, $q$Bottle in glass, chill, and shake before each use as it can separate.$q$, NULL),
($q$Pomegranate syrup$q$, 0, $q$Pour the pomegranate juice into a saucepan and gradually stir in the sugar.$q$, NULL),
($q$Pomegranate syrup$q$, 1, $q$Warm gently until the sugar dissolves; do not let it simmer.$q$, NULL),
($q$Pomegranate syrup$q$, 2, $q$Cool, fine strain into a clean bottle and refrigerate. Mind the use-by date of the juice.$q$, NULL),
($q$Recomposed lime$q$, 0, $q$Weigh the citric and malic acid into the filtered water.$q$, NULL),
($q$Recomposed lime$q$, 1, $q$Stir until both acids have fully dissolved, then bottle and label.$q$, NULL),
($q$Recomposed lime$q$, 2, $q$Use it like lime juice, but taste the drink: it is sour without lime's sweetness, so you may want a touch more syrup.$q$, NULL),
($q$Rhubarb cordial$q$, 0, $q$Put the rhubarb, sugar, ginger, lemon zest and juice and water in a pan and bring to the boil.$q$, NULL),
($q$Rhubarb cordial$q$, 1, $q$Simmer until the rhubarb is soft and the sugar has dissolved.$q$, 600),
($q$Rhubarb cordial$q$, 2, $q$Strain through a sieve without pressing; let it drip for a clearer cordial.$q$, NULL),
($q$Rhubarb cordial$q$, 3, $q$Stir in the citric acid, bottle in sterilised bottles and chill.$q$, NULL),
($q$Rhubarb shrub$q$, 0, $q$Use the stalks only: rhubarb leaves are not edible. Put the chopped rhubarb in a jar, cover with the vinegar and seal.$q$, NULL),
($q$Rhubarb shrub$q$, 1, $q$Keep somewhere dark and cool for 5 days, shaking once a day.$q$, NULL),
($q$Rhubarb shrub$q$, 2, $q$Strain the vinegar into a pan, add the sugar and warm, stirring, until it has fully dissolved.$q$, NULL),
($q$Rhubarb shrub$q$, 3, $q$Cool, bottle and keep in the fridge.$q$, NULL),
($q$Spiced honey$q$, 0, $q$Warm the water, honey and sugar over low heat, stirring until the sugar dissolves.$q$, NULL),
($q$Spiced honey$q$, 1, $q$Add the cloves, star anise, cinnamon and allspice.$q$, NULL),
($q$Spiced honey$q$, 2, $q$Bring to the boil, then turn down and simmer.$q$, 180),
($q$Spiced honey$q$, 3, $q$Strain out the spices, cool to room temperature and bottle. Keep it cold.$q$, NULL),
($q$Strawberry cordial$q$, 0, $q$Warm the strawberries in the water over a medium heat for 15 to 20 minutes, pressing them gently as they soften.$q$, 1200),
($q$Strawberry cordial$q$, 1, $q$Pour through a fine sieve or cloth and let it drip for about 30 minutes; don't squeeze, or it goes cloudy.$q$, 1800),
($q$Strawberry cordial$q$, 2, $q$Return the strawberry water to the pan with the sugar, lemon juice and citric acid and stir over the heat until the sugar dissolves.$q$, NULL),
($q$Strawberry cordial$q$, 3, $q$Pour hot into sterilised bottles, seal, cool, and keep in the fridge once opened.$q$, NULL),
($q$Verdita$q$, 0, $q$Blend the pineapple juice, the juice of one lime, the coriander and the mint until smooth.$q$, NULL),
($q$Verdita$q$, 1, $q$Add a little jalapeño and blend again. Taste, then add more chilli or lime to balance heat and sharpness.$q$, NULL),
($q$Verdita$q$, 2, $q$Fine strain into a clean glass bottle and keep cold. Shake gently before use.$q$, NULL),
($q$Watermelon cordial$q$, 0, $q$Blend the watermelon flesh with half its weight in water until smooth, then strain out the pulp.$q$, NULL),
($q$Watermelon cordial$q$, 1, $q$Weigh the juice: add 1% of that weight in salt, half a teaspoon of citric acid per 200 g and a third of the weight in sugar. The amounts listed assume about 1,200 g of juice.$q$, NULL),
($q$Watermelon cordial$q$, 2, $q$Heat to just below a boil and hold 10 minutes, stirring until everything dissolves.$q$, 600),
($q$Watermelon cordial$q$, 3, $q$Cool, strain through muslin if you have it, bottle and keep in the fridge.$q$, NULL),
($q$Yuzu cordial$q$, 0, $q$Put the sliced yuzu, sugar, salt and citric acid in a non-reactive container, seal and shake until the fruit is coated.$q$, NULL),
($q$Yuzu cordial$q$, 1, $q$Refrigerate for 3 days.$q$, NULL),
($q$Yuzu cordial$q$, 2, $q$Strain, keeping the syrup and the solids apart.$q$, NULL),
($q$Yuzu cordial$q$, 3, $q$Stir the solids with the hot water, strain again, then combine both liquids and bottle.$q$, NULL),
($q$Yuzu sherbet$q$, 0, $q$Peel the yuzu thinly, leaving the white pith behind, then juice and strain the fruit.$q$, NULL),
($q$Yuzu sherbet$q$, 1, $q$Muddle the peels into the sugar, cover and leave at room temperature, stirring now and then, until the oil has turned the sugar to syrup.$q$, 86400),
($q$Yuzu sherbet$q$, 2, $q$Lift out the peels and stir in the juice until the sugar dissolves. Warm it gently if needed, but never boil.$q$, NULL),
($q$Yuzu sherbet$q$, 3, $q$Bottle and keep cold.$q$, NULL);

INSERT INTO source_in VALUES
($q$Apple cordial$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/apple-martini/$q$, $q$reference$q$, DATE '2026-10-13', $q$Punch (Ramsey Musk's clarified sour apple cordial): sugar at 40% of the juice weight, then 3% malic, 0.5% ascorbic and 1.5% citric acid by weight of the juice and sugar mix. Scaled to 500 g juice (700 g mix).$q$),
($q$Apple shrub$q$, $q$recipe$q$, $q$https://www.ccfruitandnuts.ucanr.edu/sites/default/files/2023-10/389540.pdf$q$, $q$reference$q$, DATE '2026-10-13', $q$UC ANR Master Food Preservers (El Dorado), Cinnamon-Apple Shrub after Michael Dietsch: 3 medium apples, 1 cup cider vinegar, 1/2 cup turbinado, 2 cinnamon sticks. Cups at 240 ml, sugar at 200 g a cup.$q$),
($q$Apple shrub$q$, $q$keeps$q$, $q$https://www.ccfruitandnuts.ucanr.edu/sites/default/files/2023-10/389540.pdf$q$, $q$reference$q$, DATE '2026-10-13', $q$This Cinnamon-Apple Shrub recipe, refrigerated: up to one year (52 weeks).$q$),
($q$Apricot syrup$q$, $q$recipe$q$, $q$https://thehealthfulideas.com/apricot-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 cup diced apricots (4 to 5 fruit), 1 cup sugar, 1 cup water, simmered 10 minutes, cooled 10, strained. Doubled; 1 cup sugar taken as 200 g, 1 cup as 240 ml.$q$),
($q$Apricot syrup$q$, $q$yield$q$, $q$https://thehealthfulideas.com/apricot-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 2/3 cups per batch; doubled is about 800 ml.$q$),
($q$Apricot syrup$q$, $q$keeps$q$, $q$https://thehealthfulideas.com/apricot-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$Two weeks in the fridge, given for this same recipe.$q$),
($q$Banana oleo saccharum$q$, $q$recipe$q$, $q$https://www.campariacademy.com/en-us/inspiration/trends/banana-oleo-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$250 g chopped ripe banana peel to 250 g white sugar (1 : 1 by weight), sealed 24 to 48 hours, then strained. Agrees exactly with Punch; we use this one.$q$),
($q$Banana oleo saccharum$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/banana-oleo-saccharum/$q$, $q$reference$q$, DATE '2026-10-13', $q$Project Halcyon (Manchester): 250 g banana peels to 250 g sugar, sealed in a bag for 48 hours, strained and refrigerated. Same 1 : 1 ratio as Campari Academy.$q$),
($q$Banana oleo saccharum$q$, $q$keeps$q$, $q$https://www.campariacademy.com/en-us/inspiration/trends/banana-oleo-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep for this same 1 : 1 banana peel recipe: fridge, 1 to 2 weeks. We use the shorter end, 1 week.$q$),
($q$Blackberry shrub$q$, $q$recipe$q$, $q$https://foodwise.org/recipes/blackberry-shrub$q$, $q$reference$q$, DATE '2026-10-13', $q$CUESA (Foodwise): 1 cup each of blackberries, sugar and cider vinegar (1 : 1 : 1 by volume), the common ratio UC ANR also names. Doubled; cups at 240 ml, sugar at 200 g a cup.$q$),
($q$Blackberry shrub$q$, $q$yield$q$, $q$https://foodwise.org/recipes/blackberry-shrub$q$, $q$reference$q$, DATE '2026-10-13', $q$About 3 cups per cup of each; doubled to about 1.44 litres.$q$),
($q$Blackberry shrub$q$, $q$keeps$q$, $q$https://foodwise.org/recipes/blackberry-shrub$q$, $q$reference$q$, DATE '2026-10-13', $q$This blackberry shrub recipe: about a month in the fridge.$q$),
($q$Blackberry shrub$q$, $q$keeps$q$, $q$https://www.ccfruitandnuts.ucanr.edu/sites/default/files/2023-10/389540.pdf$q$, $q$reference$q$, DATE '2026-10-13', $q$UC ANR Master Food Preservers general shrub storage, for cold-process shrubs at 1:1:1 fruit, sugar, vinegar.$q$),
($q$Blueberry syrup$q$, $q$recipe$q$, $q$https://thehealthfulideas.com/blueberry-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 cup wild blueberries (or 2 cups regular), 1 cup sugar, 1 cup water, simmered 15 minutes and strained. Doubled with wild berries; 1 cup sugar taken as 200 g, 1 cup as 240 ml.$q$),
($q$Blueberry syrup$q$, $q$yield$q$, $q$https://thehealthfulideas.com/blueberry-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 2/3 cups per batch; doubled is about 800 ml.$q$),
($q$Blueberry syrup$q$, $q$keeps$q$, $q$https://thehealthfulideas.com/blueberry-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$Two weeks in the fridge, given for this same recipe.$q$),
($q$Cherry syrup$q$, $q$recipe$q$, $q$https://thehealthfulideas.com/cherry-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 cup sugar, 1 cup halved pitted cherries, 1 cup water, simmered 10 minutes, cooled 10, strained. Doubled; 1 cup sugar taken as 200 g, 1 cup as 240 ml.$q$),
($q$Cherry syrup$q$, $q$recipe$q$, $q$https://cakenknife.com/cherry-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$Same 1 : 1 : 1 by volume (cherries, water, sugar), simmered 10 minutes, mashed and rested 15 minutes before straining.$q$),
($q$Cherry syrup$q$, $q$yield$q$, $q$https://thehealthfulideas.com/cherry-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 1/3 cups per batch; doubled is about 640 ml.$q$),
($q$Cherry syrup$q$, $q$keeps$q$, $q$https://thehealthfulideas.com/cherry-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$Two weeks in the fridge, given for this same recipe.$q$),
($q$Citrus cordial$q$, $q$recipe$q$, $q$https://www.miele.co.nz/experiences/recipes/lemon-and-lime-cordial$q$, $q$reference$q$, DATE '2026-10-13', $q$Miele recipe: zest and juice of 5 limes and 3 lemons, 660 g sugar, 625 ml water, 1 tsp citric acid, 2 tsp tartaric acid; zest simmered 5 minutes in the syrup, acids then juice added, strained. Used as given.$q$),
($q$Citrus cordial$q$, $q$yield$q$, $q$https://www.miele.co.nz/experiences/recipes/lemon-and-lime-cordial$q$, $q$reference$q$, DATE '2026-10-13', $q$The page gives the recipe size as 1 litre.$q$),
($q$Ginger honey$q$, $q$recipe$q$, $q$https://blog.modernistpantry.com/recipes/honey-ginger-penicillin/$q$, $q$producer$q$, DATE '2026-10-13', $q$120 g honey, 50 g fresh ginger, 120 g water (1 : 0.42 : 1 by weight), simmered 10 minutes, rested 10, strained; scaled to 600 g honey. Feast and West runs wetter (1 cup honey to 1.5 cups water); we use Modernist Pantry's weighed ratio.$q$),
($q$Ginger honey$q$, $q$recipe$q$, $q$https://feastandwest.com/honey-ginger-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 cup honey, 1.5 cups water, a 4 inch piece of ginger simmered 10 to 15 minutes. Its honey to water runs about 1 : 1.5 by volume against Modernist Pantry's 1 : 1; we use Modernist Pantry's.$q$),
($q$Ginger honey$q$, $q$keeps$q$, $q$https://feastandwest.com/honey-ginger-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep for Feast and West's honey ginger syrup, which has more water (less sugar) than ours, so it carries over: fridge, up to 2 weeks.$q$),
($q$Grapefruit cordial$q$, $q$recipe$q$, $q$https://www.starchefs.com/recipes/grapefruit-americano$q$, $q$reference$q$, DATE '2026-10-13', $q$Mike Capoferri (Thunderbolt, Los Angeles): 500 g clarified grapefruit juice, 450 g sugar, 25 g peel, 10 g citric acid. Used as written.$q$),
($q$Grapefruit cordial$q$, $q$recipe$q$, $q$https://sunset.com/recipe/ruby-dove$q$, $q$reference$q$, DATE '2026-10-13', $q$Second source runs about 40 oz juice to 30 oz sugar and 1 oz citric acid, then reduces it by half; we use Thunderbolt's unreduced 0.9 : 1 sugar to juice.$q$),
($q$Grapefruit shrub$q$, $q$recipe$q$, $q$https://www.thelittleepicurean.com/wprm_print/grapefruit-shrub$q$, $q$reference$q$, DATE '2026-10-13', $q$The Little Epicurean: 1 cup sugar, peel of 1 medium grapefruit, 1 cup segments, 1 cup cider vinegar, steeped 2 to 4 days cold. Cups at 240 ml, sugar at 200 g a cup; segments kept as a volume.$q$),
($q$Grapefruit shrub$q$, $q$keeps$q$, $q$https://www.ccfruitandnuts.ucanr.edu/sites/default/files/2023-10/389540.pdf$q$, $q$reference$q$, DATE '2026-10-13', $q$UC ANR Master Food Preservers general shrub storage, for cold-process shrubs at about 1:1:1 fruit, sugar, vinegar, which this recipe is.$q$),
($q$House falernum$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/falernum/$q$, $q$reference$q$, DATE '2026-10-13', $q$Adam Bernbach (2 Birds 1 Stone) via Punch: 8 oz overproof rum, 40 cloves, zest of 10 limes, 3 oz ginger, 1/4 nutmeg, steeped 24 h, then rich syrup of 20 oz sugar to 10 oz water. Ounces read as 240 ml rum, 85 g ginger, 567 g sugar, 284 g water.$q$),
($q$House falernum$q$, $q$yield$q$, $q$https://punchdrink.com/recipes/falernum/$q$, $q$reference$q$, DATE '2026-10-13', $q$The Punch recipe yields about 3 cups (720 ml).$q$),
($q$House falernum$q$, $q$keeps$q$, $q$https://punchdrink.com/recipes/falernum/$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep given for this exact Punch recipe (the one we use): up to one month refrigerated, airtight.$q$),
($q$House-made grenadine$q$, $q$recipe$q$, $q$https://imbibemagazine.com/recipe/homemade-grenadine-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$Imbibe: 8 oz pomegranate juice, 1 cup superfine sugar, 2 oz pomegranate molasses, 1 to 3 tsp orange flower water (optional). Converted to 240 ml, 200 g, 60 ml, 5 ml and doubled. Optional vodka left out.$q$),
($q$House-made grenadine$q$, $q$keeps$q$, $q$https://imbibemagazine.com/recipe/homemade-grenadine-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep given for this Imbibe recipe (the one we use, made without the optional vodka): use within 2 weeks refrigerated.$q$),
($q$Jasmine cordial$q$, $q$recipe$q$, $q$https://www.koppertcress.com/en/recipes/zoe-cocktail$q$, $q$reference$q$, DATE '2026-10-13', $q$Koppert Cress (Andrea Arcaini, Rita Cocktails Milano): 140 g caster sugar, 280 ml water, 3 g jasmine flowers, 9 g jasmine green tea, 5 g citric acid, sealed and cooked sous vide 1 h at 50°C. Doubled.$q$),
($q$Lemon cordial$q$, $q$recipe$q$, $q$https://jeffreymorgenthaler.com/lime-cordial/$q$, $q$reference$q$, DATE '2026-10-13', $q$Morgenthaler's lime cordial: 250 g sugar, 240 ml hot water, 45 ml juice, 8 g grated peel, 25 g citric acid; he confirms lemon swapped in like for like works. Doubled. Second source (Bonnie's, StarChefs) is juice heavy with no acid; we use this one.$q$),
($q$Lemon cordial$q$, $q$recipe$q$, $q$https://www.starchefs.com/recipes/frozen-ribena-lemonade$q$, $q$reference$q$, DATE '2026-10-13', $q$Channing Centeno (Bonnie's, New York): 1.5 kg sugar steeped overnight with the peel of 12 lemons, then 2 quarts lemon juice, no acid. Far more juice than Morgenthaler's; we use Morgenthaler's ratio.$q$),
($q$Lemon cordial$q$, $q$yield$q$, $q$https://jeffreymorgenthaler.com/lime-cordial/$q$, $q$reference$q$, DATE '2026-10-13', $q$About 12 fl oz (360 ml) per batch; doubled to 720 ml.$q$),
($q$Lemon cordial$q$, $q$keeps$q$, $q$https://jeffreymorgenthaler.com/lime-cordial/$q$, $q$reference$q$, DATE '2026-10-13', $q$The author's answers in the page's comments run from a week or more to two weeks; we take the shorter, a week.$q$),
($q$Lemon oleo$q$, $q$recipe$q$, $q$https://www.lcbo.com/en/recipe/lemon-oleo-saccharum/F202002035$q$, $q$reference$q$, DATE '2026-10-13', $q$Half a cup (125 ml) lemon rinds, 2/3 cup fine white sugar, 1/6 cup demerara, 1 cup (250 ml) boiling water after a 24 hour cure. Sugar converted at 1 cup about 200 g (133 g and 33 g).$q$),
($q$Lemon oleo$q$, $q$yield$q$, $q$https://www.lcbo.com/en/recipe/lemon-oleo-saccharum/F202002035$q$, $q$reference$q$, DATE '2026-10-13', $q$The recipe states it makes 1 cup (250 ml).$q$),
($q$Lemon oleo$q$, $q$keeps$q$, $q$https://www.lcbo.com/en/recipe/lemon-oleo-saccharum/F202002035$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep for this same LCBO lemon oleo recipe: up to 2 weeks in the fridge.$q$),
($q$Lime sherbet$q$, $q$recipe$q$, $q$https://the83k.substack.com/p/cocktail-nerdery-from-doctor-z-sherbet$q$, $q$reference$q$, DATE '2026-10-13', $q$Citrus sherbet: peels in sugar at least 24 hours, then juice equal to the sugar; peel as much fruit as you juice. Names lime and warns its peel is more bitter. Scaled to 500 g sugar and 500 ml lime juice.$q$),
($q$Lime sherbet$q$, $q$recipe$q$, $q$https://cocktailsandbars.com/how-to-make-lemon-sherbet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Lemon sherbet: 120 g caster sugar, peel of 2 lemons, 120 ml lemon juice (1 : 1 sugar to juice), dissolved without boiling. Same ratio we apply to lime.$q$),
($q$Lime sherbet$q$, $q$keeps$q$, $q$https://cocktailsandbars.com/how-to-make-lemon-sherbet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep for Cocktails and Bars' lemon sherbet at the same 1 : 1 sugar to juice; lemon is no more acidic than lime, so it carries over: about 2 weeks in the fridge.$q$),
($q$Lychee syrup$q$, $q$recipe$q$, $q$https://www.siftandsimmer.com/wprm_print/homemade-lychee-syrup$q$, $q$reference$q$, DATE '2026-10-13', $q$125 ml water, 100 g sugar and 12 lychees, simmered until it coats a spoon, chilled 1 hour, strained. Scaled four times.$q$),
($q$Lychee syrup$q$, $q$recipe$q$, $q$https://shesalmostalwayshungry.com/lychee-ginger-simple-syrup/print/922$q$, $q$reference$q$, DATE '2026-10-13', $q$A lychee and ginger syrup: 1.5 cups each of sugar and water (about 300 g to 360 ml, 0.83 : 1) with 3 cups lychee. Its sugar to water ratio agrees with the 0.8 : 1 we use from Sift and Simmer.$q$),
($q$Lychee syrup$q$, $q$keeps$q$, $q$https://www.siftandsimmer.com/wprm_print/homemade-lychee-syrup$q$, $q$reference$q$, DATE '2026-10-13', $q$One week in the fridge, given for this same recipe.$q$),
($q$Makrut lime leaf cordial$q$, $q$recipe$q$, $q$https://www.sbs.com.au/food/recipe/makrut-lime-and-lemon-cordial/xe6gf1d8w$q$, $q$reference$q$, DATE '2026-10-13', $q$SBS Food (Feast magazine, Feb 2014): 4 lemons, 4 makrut lime leaves, 3 cm ginger, 700 g caster sugar, 1 L boiling water, 50 g tartaric acid; steeped overnight in the fridge. Used as given.$q$),
($q$Makrut lime leaf cordial$q$, $q$yield$q$, $q$https://www.sbs.com.au/food/recipe/makrut-lime-and-lemon-cordial/xe6gf1d8w$q$, $q$reference$q$, DATE '2026-10-13', $q$Makes 1.2 L of cordial.$q$),
($q$Malic acid solution (10%)$q$, $q$recipe$q$, $q$https://punchdrink.com/articles/drink-science-with-team-lyan-acidity-without-citrus/$q$, $q$reference$q$, DATE '2026-10-13', $q$Team Lyan's 10% malic solution: 10 g malic acid to 100 g water, whisked and bottled. Scaled x5 to 50 g acid in 500 g water. Keep solutions in glass.$q$),
($q$Malic acid solution (10%)$q$, $q$recipe$q$, $q$https://www.debortoli.com.au/wines/food-matching/recipes/cocktail-recipe/noble-stone$q$, $q$reference$q$, DATE '2026-10-13', $q$Same strength: 10 g malic acid to 100 ml boiling water, stirred to dissolve, stored airtight at room temperature, called non perishable (no time given).$q$),
($q$Mandarin cordial$q$, $q$recipe$q$, $q$https://theduke-gin.de/en/blogs/drinks/botanic-gardens$q$, $q$reference$q$, DATE '2026-10-13', $q$THE DUKE gin: 250 ml mandarin juice, an oleo of 6 to 7 peels with 125 g sugar (24 h), 5 g citric acid. Doubled to 500 ml juice, 12 peels.$q$),
($q$Mandarin shrub$q$, $q$recipe$q$, $q$https://pipmagazine.com.au/raw-mandarin-shrub-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$Pip Magazine, after Holly Davis's Ferment: 660 g raw sugar, peel of 6 mandarins, zest of 1 lemon, 750 ml mandarin juice, 500 ml champagne or white wine vinegar. Used as given.$q$),
($q$Mandarin shrub$q$, $q$yield$q$, $q$https://pipmagazine.com.au/raw-mandarin-shrub-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$About 1 litre per batch.$q$),
($q$Mandarin shrub$q$, $q$keeps$q$, $q$https://pipmagazine.com.au/raw-mandarin-shrub-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$This mandarin shrub recipe: up to 12 months refrigerated (12 x 4 weeks).$q$),
($q$Mandarin shrub$q$, $q$keeps$q$, $q$https://www.ccfruitandnuts.ucanr.edu/sites/default/files/2023-10/389540.pdf$q$, $q$reference$q$, DATE '2026-10-13', $q$UC ANR Master Food Preservers general shrub storage, for shrubs of fruit, sugar and vinegar kept in the fridge.$q$),
($q$Mango syrup$q$, $q$recipe$q$, $q$https://thehealthfulideas.com/mango-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 cup sugar, 1 cup water, 1 cup diced mango, simmered 15 minutes and strained. Doubled; 1 cup sugar taken as 200 g, 1 cup as 240 ml.$q$),
($q$Mango syrup$q$, $q$recipe$q$, $q$https://charmingcocktails.com/wprm_print/mango-nectar$q$, $q$reference$q$, DATE '2026-10-13', $q$Second source is a blended, unstrained mango nectar: 3/4 cup of 1:1 syrup to 1 cup mango, so about half the sugar per cup of fruit. We use the strained syrup ratio from The Healthful Ideas.$q$),
($q$Mango syrup$q$, $q$yield$q$, $q$https://thehealthfulideas.com/mango-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1.5 cups per batch; doubled is 3 cups, about 720 ml.$q$),
($q$Mango syrup$q$, $q$keeps$q$, $q$https://thehealthfulideas.com/mango-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$Two weeks in the fridge, given for this same recipe.$q$),
($q$Mango syrup$q$, $q$keeps$q$, $q$https://charmingcocktails.com/wprm_print/mango-nectar$q$, $q$reference$q$, DATE '2026-10-13', $q$One week in the fridge, given for the blended mango nectar (less sugar, uncooked). We keep the shorter figure.$q$),
($q$Orange cordial$q$, $q$recipe$q$, $q$https://foodism.ca/recipes/civil-liberties-payday-blues$q$, $q$reference$q$, DATE '2026-10-13', $q$Tristan K Joseph (Civil Liberties, Toronto): 600 g orange juice, 600 ml water, 600 g sugar, 30 g citric acid, 15 g malic acid. Used as written.$q$),
($q$Orange cordial$q$, $q$recipe$q$, $q$https://www.cookingwithnanaling.com/wprm_print/orange-cordial$q$, $q$reference$q$, DATE '2026-10-13', $q$Second source is a home cordial for diluting with water: 300 ml juice, 2.5 cups sugar, 2 cups water, 2 tsp tartaric acid, so much less juice; we use Civil Liberties' bar ratio.$q$),
($q$Orange syrup$q$, $q$recipe$q$, $q$https://thehealthfulideas.com/orange-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 cup sugar, 1 cup water and the zest of 1 orange, simmered 15 minutes and rested before removing the zest. Doubled; 1 cup sugar taken as 200 g, 1 cup as 240 ml.$q$),
($q$Orange syrup$q$, $q$yield$q$, $q$https://thehealthfulideas.com/orange-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 1/3 cups per batch; doubled is about 640 ml.$q$),
($q$Orange syrup$q$, $q$keeps$q$, $q$https://thehealthfulideas.com/orange-simple-syrup/$q$, $q$reference$q$, DATE '2026-10-13', $q$Two weeks in the fridge, given for this same recipe.$q$),
($q$Pear shrub$q$, $q$recipe$q$, $q$https://entirelyelizabeth.com/pear-shrub-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$2 cups diced ripe pear, 1 cup sugar, 1 cup cider vinegar (2 : 1 : 1 by volume), a week in the fridge. Cups converted at 240 ml, sugar at 200 g a cup; pear kept as a volume.$q$),
($q$Pear shrub$q$, $q$keeps$q$, $q$https://entirelyelizabeth.com/pear-shrub-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$This pear shrub recipe: the method says 3 months, the recipe notes say 1 month; we take the shorter.$q$),
($q$Pear shrub$q$, $q$keeps$q$, $q$https://www.ccfruitandnuts.ucanr.edu/sites/default/files/2023-10/389540.pdf$q$, $q$reference$q$, DATE '2026-10-13', $q$UC ANR Master Food Preservers general shrub storage, for cold-process shrubs at 1:1:1 or 2:1:1 fruit, sugar, vinegar.$q$),
($q$Pepita orgeat$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/pepita-orgeat/$q$, $q$reference$q$, DATE '2026-10-13', $q$Punch (Kevin Diedrich, Pacific Cocktail Haven): 4 oz pepitas, 8 oz water, 8 oz sugar, read as weight: 113 g, 227 g, 227 g (1 : 2 : 2).$q$),
($q$Pepita orgeat$q$, $q$yield$q$, $q$https://punchdrink.com/recipes/pepita-orgeat/$q$, $q$reference$q$, DATE '2026-10-13', $q$The Punch recipe yields 12 oz (about 360 ml).$q$),
($q$Pistachio orgeat$q$, $q$recipe$q$, $q$https://imbibemagazine.com/?p=30868$q$, $q$reference$q$, DATE '2026-10-13', $q$The Merchant (Madison) via Imbibe: 3 cups near-boiling water, 7 oz pistachios, 2 1/4 cups sugar; converted to 720 ml, 198 g (weight ounces) and 450 g. Optional gum stabilisers left out.$q$),
($q$Pistachio orgeat$q$, $q$recipe$q$, $q$https://americanpistachios.org/node/679$q$, $q$producer$q$, DATE '2026-10-13', $q$American Pistachios runs 200 g pistachios, 660 g very hot water, 500 g demerara, the same blend-strain-blend method and within about 10% of the Imbibe ratio we use.$q$),
($q$Pistachio orgeat$q$, $q$yield$q$, $q$https://imbibemagazine.com/?p=30868$q$, $q$reference$q$, DATE '2026-10-13', $q$The Imbibe recipe makes 1 quart (about 945 ml).$q$),
($q$Pistachio orgeat$q$, $q$keeps$q$, $q$https://imbibemagazine.com/?p=30868$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep given for this exact Imbibe recipe (the one we use): up to 1 month refrigerated.$q$),
($q$Pomegranate syrup$q$, $q$recipe$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/category/803/pomegranate-grenadine-syrup$q$, $q$reference$q$, DATE '2026-10-13', $q$Difford's: 2 cups sugar to 1 cup pomegranate juice, warmed until dissolved without simmering. Converted (1 cup 240 ml, 1 cup sugar 200 g) and doubled to 480 ml juice, 800 g sugar.$q$),
($q$Pomegranate syrup$q$, $q$keeps$q$, $q$https://www.diffordsguide.com/beer-wine-spirits/category/803/pomegranate-grenadine-syrup$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep given for this exact Difford's recipe (the one we use): about a week refrigerated.$q$),
($q$Recomposed lime$q$, $q$recipe$q$, $q$https://community.chefsteps.com/discussion/7828/substitute-for-lime$q$, $q$reference$q$, DATE '2026-10-13', $q$Dave Arnold's lime acid (Liquid Intelligence) as quoted: 94 g water, 4 g citric, 2 g malic, 0.04 g succinic (optional, left out here). Scaled x10 to 940 g water, 40 g citric, 20 g malic.$q$),
($q$Recomposed lime$q$, $q$recipe$q$, $q$https://blog.modernistpantry.com/advice/how-to-acid-adjust-juices/$q$, $q$producer$q$, DATE '2026-10-13', $q$Confirms the target: lime juice is about 4% citric and 2% malic acid, the same 2:1 split used here.$q$),
($q$Rhubarb cordial$q$, $q$recipe$q$, $q$https://www.joskitchenlarder.com/?p=5143$q$, $q$reference$q$, DATE '2026-10-13', $q$Jo's Kitchen Larder: 500 g rhubarb, 250 g sugar, 400 ml water, 1 lemon, optional ginger, simmered 10 to 15 minutes and strained; the author adds 1 tsp citric acid for this batch to keep it longer. Used as given.$q$),
($q$Rhubarb cordial$q$, $q$yield$q$, $q$https://www.joskitchenlarder.com/?p=5143$q$, $q$reference$q$, DATE '2026-10-13', $q$The author says the recipe makes roughly a 700 ml bottle.$q$),
($q$Rhubarb cordial$q$, $q$keeps$q$, $q$https://www.joskitchenlarder.com/?p=5143$q$, $q$reference$q$, DATE '2026-10-13', $q$Two weeks in the fridge for this same recipe without citric acid (less preserved than ours). The longer keep the author gives with acid is vague, so not used.$q$),
($q$Rhubarb shrub$q$, $q$recipe$q$, $q$https://nourishedkitchen.com/rhubarb-shrub/$q$, $q$reference$q$, DATE '2026-10-13', $q$1.5 cups chopped rhubarb steeped 5 days in 1 cup white wine vinegar, then warmed with 1 cup sugar. Cups at 240 ml, sugar at 200 g a cup; rhubarb kept as a volume.$q$),
($q$Rhubarb shrub$q$, $q$keeps$q$, $q$https://www.ccfruitandnuts.ucanr.edu/sites/default/files/2023-10/389540.pdf$q$, $q$reference$q$, DATE '2026-10-13', $q$UC ANR Master Food Preservers general shrub storage. Applied because this recipe carries more sugar and vinegar per unit of fruit than the 1:1:1 shrub UC ANR describes.$q$),
($q$Spiced honey$q$, $q$recipe$q$, $q$https://www.williams-sonoma.com/recipe/the-barn-nail.html$q$, $q$retailer$q$, DATE '2026-10-13', $q$1 cup (250 ml) water, 1 cup honey, 1 cup (250 g) sugar, 5 cloves, 5 star anise, 1 cinnamon stick, 5 allspice, simmered 3 minutes. The page prints honey as 375 ml, which clashes with its 1 cup; we use its 250 ml cup.$q$),
($q$Strawberry cordial$q$, $q$recipe$q$, $q$https://documentingsimpleliving.com/strawberry-cordial/$q$, $q$reference$q$, DATE '2026-10-13', $q$1 kg strawberries simmered in 600 ml water and strained, then 500 g sugar, 2 tbsp (30 ml) lemon juice and 1 tsp citric acid. Used as written. Second source runs far sweeter; we use this one.$q$),
($q$Strawberry cordial$q$, $q$recipe$q$, $q$https://www.theirishmanswife.com/strawberry-thyme-cordial/$q$, $q$reference$q$, DATE '2026-10-13', $q$Second source macerates 500 g strawberries in 600 g sugar overnight, then simmers with 400 ml water, half a lemon and thyme: more than twice the sugar per berry. We use the 1 kg : 500 g recipe above.$q$),
($q$Verdita$q$, $q$recipe$q$, $q$https://www.lcbo.com/en/recipe/tromba-verdita/F201803069$q$, $q$reference$q$, DATE '2026-10-13', $q$Tequila Tromba's verdita: 3 cups (750 ml) pineapple juice, juice of 1 or more limes, a large handful each of coriander and mint, half to 1 seeded jalapeño to taste. Amounts as given.$q$),
($q$Verdita$q$, $q$yield$q$, $q$https://www.lcbo.com/en/recipe/tromba-verdita/F201803069$q$, $q$reference$q$, DATE '2026-10-13', $q$The recipe states it makes just over 3 cups (750 ml).$q$),
($q$Verdita$q$, $q$keeps$q$, $q$https://www.lcbo.com/en/recipe/tromba-verdita/F201803069$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep for this same Tromba verdita recipe: refrigerate up to 3 days. Campari Academy's verdita (with cucumber and water) says serve within 24 hours.$q$),
($q$Watermelon cordial$q$, $q$recipe$q$, $q$https://www.smartblend.co.uk/blog/salt-and-watermelon-cordial-recipe-with-cocktails$q$, $q$reference$q$, DATE '2026-10-13', $q$Cameron Fielding: 400 g watermelon blended with 200 g water (gave 600 g juice), 1% salt, half a tsp citric acid per 200 g juice, a third the juice weight in sugar. Doubled. Second source differs; we use this one.$q$),
($q$Watermelon cordial$q$, $q$recipe$q$, $q$https://nourishmagazine.co.nz/watermelon-cordial/$q$, $q$reference$q$, DATE '2026-10-13', $q$Second source simmers 800 g watermelon with 300 g sugar and 200 ml water, then adds 80 ml lemon juice: less sugar and water, lemon for acid. We use Smartblend's ratio.$q$),
($q$Watermelon cordial$q$, $q$keeps$q$, $q$https://www.smartblend.co.uk/blog/salt-and-watermelon-cordial-recipe-with-cocktails$q$, $q$reference$q$, DATE '2026-10-13', $q$With citric acid, 4+ weeks; with lime juice instead, 2 to 3 days.$q$),
($q$Watermelon cordial$q$, $q$keeps$q$, $q$https://nourishmagazine.co.nz/watermelon-cordial/$q$, $q$reference$q$, DATE '2026-10-13', $q$Up to a week in the fridge in a glass bottle.$q$),
($q$Yuzu cordial$q$, $q$recipe$q$, $q$https://www.starchefs.com/recipes/yuzu-chuhai$q$, $q$reference$q$, DATE '2026-10-13', $q$StarChefs (Justin Kato, RYLA): 10 sliced yuzu, 500 g sugar, 5 g kosher salt, 5 g citric acid, 3 days in the fridge, solids rinsed with 250 g hot water. Source calls it yuzu syrup and gives a 32 oz (about 960 ml) yield. Used as given.$q$),
($q$Yuzu sherbet$q$, $q$recipe$q$, $q$https://the83k.substack.com/p/cocktail-nerdery-from-doctor-z-sherbet$q$, $q$reference$q$, DATE '2026-10-13', $q$General citrus sherbet: peels in sugar at least 24 hours, then juice equal in amount to the sugar; peel as much fruit as you juice. Applied to yuzu at 250 g sugar to 250 ml juice; no source gives a yuzu version.$q$),
($q$Yuzu sherbet$q$, $q$recipe$q$, $q$https://cocktailsandbars.com/how-to-make-lemon-sherbet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Lemon sherbet: 120 g caster sugar, peel of 2 lemons, 120 ml lemon juice (1 : 1 sugar to juice), dissolved without boiling. Same ratio we apply to yuzu.$q$),
($q$Yuzu sherbet$q$, $q$keeps$q$, $q$https://cocktailsandbars.com/how-to-make-lemon-sherbet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Keep for Cocktails and Bars' lemon sherbet at the same 1 : 1 sugar to juice; lemon juice is no more acidic than yuzu, so it carries over: about 2 weeks in the fridge.$q$);

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
