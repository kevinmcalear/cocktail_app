-- House prep recipes for clarification and washes (after 20261018020000).
-- Stage 4E of the bottle catalog plan:
-- https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 16 shared catalog preps that had no recipe get one, each from the pages
--     it cites (one item_sources row per recipe, yield and keep fact; two
--     sites for the staples): tomato water and clarified tomato water,
--     clarified lime, lemon, grapefruit, orange, apple, pineapple, watermelon,
--     guava, coconut and citrus juice (Dave Arnold's agar methods), a milk
--     wash, clarified and California milk punch, and an olive oil washed
--     vodka.
--   * Clarified guava and coconut apply Arnold's general agar dose to juices
--     he never tested: they say "Starting point: test a batch first."
--   * The milk preps say they contain milk. One new plain ingredient:
--     Cocktail batch (the base a milk wash is poured from).
--   * An independent second check of every fact in this stage (64) against
--     the cited pages found 4 wrong, all keeps that took the long end of a
--     range (clarified citrus, milk wash, both milk punches). All four are
--     fixed to the short end.
--
-- Written by scripts/prep-recipes.mjs from supabase/seeds/preps/e_clarified.json;
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
($q$Cocktail batch$q$, $q$Any drink mixed ahead in bulk before dilution or service. Used as the base for milk washes and punches.$q$, NULL);

INSERT INTO prep_in VALUES
($q$Clarified apple juice$q$, $q$Apple juice$q$, false, $q$Fresh apple juice cleared with a weak agar gel, a third of it boiled with the agar and the rest whisked in cold. Clear, crisp apple for highballs, spritzes and carbonated drinks.$q$, 0, true, 1000, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified citrus$q$, $q$Citrus juice$q$, false, $q$Lime (or lemon) juice made crystal clear with a weak agar gel, so it carbonates well and looks clean in clear drinks. Make it the day you use it.$q$, 0, true, 345, $q$g$q$, 12, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified coconut$q$, $q$Coconut$q$, false, $q$Coconut water set with a weak agar gel and drained crystal clear, for clear tropical drinks and highballs. Starting point: test a batch first.$q$, 0, true, 345, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified grapefruit juice$q$, $q$Grapefruit juice$q$, false, $q$Fresh grapefruit juice cleared with a weak agar gel. Clarifying leaves it clean and bright, with less bitterness, and it carbonates far better than cloudy juice: think clear Palomas and highballs.$q$, 0, true, 700, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified guava$q$, $q$Guava juice$q$, false, $q$Guava juice set with a weak agar gel and drained clear, for clean, pale tropical highballs and stirred drinks. Starting point: test a batch first.$q$, 0, true, 345, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified lemon juice$q$, $q$Lemon juice$q$, false, $q$Fresh lemon juice cleared with a weak agar gel, which traps the haze so the juice drains out clear. For clear sours, carbonated drinks and stirred drinks that want lemon. Made like Arnold's lime, unboiled.$q$, 0, true, 700, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified lime juice$q$, $q$Lime juice$q$, false, $q$Fresh lime juice cleared with a weak agar gel, which traps the haze so the juice drains out water-clear. For clear sours, carbonated drinks and stirred drinks that want lime; use it the day it's made.$q$, 0, true, 700, $q$g$q$, 12, $q$Fridge, use the same day$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified milk punch$q$, NULL, false, $q$A batched gin, lemon and Earl Grey punch poured into milk so the curds filter it clear, silky and shelf stable. Bottle it and pour over ice. Contains milk: drinks made with it carry milk as an allergen.$q$, NULL, false, 1700, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Milk wash$q$, $q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified orange juice$q$, $q$Orange juice$q$, false, $q$Orange juice cleared with a weak agar gel: a third of the juice is boiled with the agar, the rest whisked in cold. Arnold's own worked example; clear orange for stirred and carbonated drinks.$q$, 0, true, 517, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified pineapple juice$q$, $q$Pineapple juice$q$, false, $q$Fresh pineapple juice cleared with a weak agar gel, a third of it boiled with the agar and the rest whisked in cold. Clear pineapple for stirred tiki riffs and carbonated drinks.$q$, 0, true, 1000, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified tomato water$q$, $q$Tomato water$q$, false, $q$Tomato purée set with a little gelatine, frozen and thawed slowly through cloth, so only crystal-clear tomato water drips out. The clearest tomato water for stirred drinks and carbonating.$q$, 0, true, 600, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Blend$q$, $q$Freeze$q$, $q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Clarified watermelon juice$q$, $q$Watermelon juice$q$, false, $q$Fresh watermelon juice cleared with a weak agar gel into a pale, clear juice in under an hour. For clear coolers, spritzes and carbonated drinks.$q$, 0, true, 700, $q$g$q$, NULL, $q$Fridge, sealed bottle$q$, ARRAY[$q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Milk punch$q$, NULL, false, $q$Jerry Thomas's bottling milk punch from 1887: brandy, Jamaican rum and arrack steeped with lemon, pineapple, spice and green tea, then broken with hot milk and filtered bright. Serve iced. Contains milk: drinks made with it carry milk as an allergen.$q$, NULL, false, 3000, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Infuse$q$, $q$Milk wash$q$, $q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Milk wash$q$, $q$Milk$q$, false, $q$The base ratio for milk washing: a sour or tannic batch poured into a quarter of its volume of milk, rested and filtered through the curds until clear and silky. Contains milk: drinks made with it carry milk as an allergen.$q$, NULL, false, 1100, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Milk wash$q$, $q$Clarify$q$, $q$Strain$q$]::text[], false),
($q$Olive oil washed vodka$q$, $q$Vodka$q$, false, $q$Vodka rested with extra virgin olive oil, then frozen so the oil sets and lifts off, leaving a rounder, peppery, grassy spirit for Martinis.$q$, NULL, false, 720, $q$ml$q$, 168, $q$Fridge, sealed bottle$q$, ARRAY[$q$Fat wash$q$, $q$Freeze$q$, $q$Strain$q$]::text[], false),
($q$Tomato water$q$, $q$Tomato$q$, false, $q$The pale, savoury liquid that drips from blended salted tomatoes left to hang in cloth. Brings fresh tomato and umami to Martinis, highballs and Bloody Mary riffs without the pulp.$q$, 0, true, 500, $q$ml$q$, 72, $q$Fridge, sealed bottle$q$, ARRAY[$q$Blend$q$, $q$Strain$q$, $q$Clarify$q$]::text[], false);

INSERT INTO alias_in VALUES
($q$Clarified citrus$q$, $q$Clarified lime juice$q$),
($q$Clarified citrus$q$, $q$Clear lime juice$q$),
($q$Clarified coconut$q$, $q$Clarified coconut water$q$),
($q$Clarified milk punch$q$, $q$English milk punch$q$),
($q$Milk punch$q$, $q$California milk punch$q$),
($q$Milk wash$q$, $q$Milk washing$q$),
($q$Milk wash$q$, $q$Milk-washed batch$q$),
($q$Olive oil washed vodka$q$, $q$Olive oil vodka$q$),
($q$Olive oil washed vodka$q$, $q$Oil-washed vodka$q$);

INSERT INTO line_in VALUES
($q$Clarified apple juice$q$, 0, $q$Apple juice$q$, 500, $q$g$q$, $q$cold; boiled with the agar$q$, false),
($q$Clarified apple juice$q$, 1, $q$Apple juice$q$, 1000, $q$g$q$, $q$cold; whisked in after$q$, false),
($q$Clarified apple juice$q$, 2, $q$Agar$q$, 3, $q$g$q$, NULL, false),
($q$Clarified citrus$q$, 0, $q$Lime juice$q$, 375, $q$g$q$, $q$freshly squeezed, room temperature; lemon works the same way$q$, false),
($q$Clarified citrus$q$, 1, $q$Water$q$, 125, $q$g$q$, NULL, false),
($q$Clarified citrus$q$, 2, $q$Agar$q$, 1, $q$g$q$, NULL, false),
($q$Clarified coconut$q$, 0, $q$Coconut water$q$, 375, $q$g$q$, $q$room temperature$q$, false),
($q$Clarified coconut$q$, 1, $q$Water$q$, 125, $q$g$q$, NULL, false),
($q$Clarified coconut$q$, 2, $q$Agar$q$, 1, $q$g$q$, NULL, false),
($q$Clarified grapefruit juice$q$, 0, $q$Grapefruit juice$q$, 800, $q$g$q$, $q$fresh, at room temperature$q$, false),
($q$Clarified grapefruit juice$q$, 1, $q$Water$q$, 200, $q$g$q$, NULL, false),
($q$Clarified grapefruit juice$q$, 2, $q$Agar$q$, 2, $q$g$q$, NULL, false),
($q$Clarified guava$q$, 0, $q$Guava juice$q$, 375, $q$g$q$, $q$room temperature, sieved first if pulpy$q$, false),
($q$Clarified guava$q$, 1, $q$Water$q$, 125, $q$g$q$, NULL, false),
($q$Clarified guava$q$, 2, $q$Agar$q$, 1, $q$g$q$, NULL, false),
($q$Clarified lemon juice$q$, 0, $q$Lemon juice$q$, 800, $q$g$q$, $q$fresh, at room temperature$q$, false),
($q$Clarified lemon juice$q$, 1, $q$Water$q$, 200, $q$g$q$, NULL, false),
($q$Clarified lemon juice$q$, 2, $q$Agar$q$, 2, $q$g$q$, NULL, false),
($q$Clarified lime juice$q$, 0, $q$Lime juice$q$, 800, $q$g$q$, $q$fresh, at room temperature$q$, false),
($q$Clarified lime juice$q$, 1, $q$Water$q$, 200, $q$g$q$, NULL, false),
($q$Clarified lime juice$q$, 2, $q$Agar$q$, 2, $q$g$q$, NULL, false),
($q$Clarified milk punch$q$, 0, $q$Gin$q$, 600, $q$ml$q$, NULL, false),
($q$Clarified milk punch$q$, 1, $q$Lemon juice$q$, 225, $q$ml$q$, $q$fresh, strained$q$, false),
($q$Clarified milk punch$q$, 2, $q$Simple syrup$q$, 150, $q$ml$q$, $q$1:1$q$, false),
($q$Clarified milk punch$q$, 3, $q$Earl Grey tea$q$, 600, $q$ml$q$, $q$brewed strong: 2 heaped tsp leaves per 240 ml hot water, cooled$q$, false),
($q$Clarified milk punch$q$, 4, $q$Milk$q$, 395, $q$ml$q$, $q$whole, cold$q$, false),
($q$Clarified orange juice$q$, 0, $q$Orange juice$q$, 250, $q$g$q$, $q$cold; boiled with the agar$q$, false),
($q$Clarified orange juice$q$, 1, $q$Orange juice$q$, 500, $q$g$q$, $q$cold; whisked in after$q$, false),
($q$Clarified orange juice$q$, 2, $q$Agar$q$, 1.5, $q$g$q$, NULL, false),
($q$Clarified pineapple juice$q$, 0, $q$Pineapple juice$q$, 500, $q$g$q$, $q$cold; boiled with the agar$q$, false),
($q$Clarified pineapple juice$q$, 1, $q$Pineapple juice$q$, 1000, $q$g$q$, $q$cold; whisked in after$q$, false),
($q$Clarified pineapple juice$q$, 2, $q$Agar$q$, 3, $q$g$q$, NULL, false),
($q$Clarified tomato water$q$, 0, $q$Tomato$q$, 1000, $q$g$q$, $q$ripe, blended smooth; unsalted$q$, false),
($q$Clarified tomato water$q$, 1, $q$Gelatine$q$, 5, $q$g$q$, $q$powdered$q$, false),
($q$Clarified watermelon juice$q$, 0, $q$Watermelon juice$q$, 800, $q$g$q$, $q$fresh, strained, at room temperature$q$, false),
($q$Clarified watermelon juice$q$, 1, $q$Water$q$, 200, $q$g$q$, NULL, false),
($q$Clarified watermelon juice$q$, 2, $q$Agar$q$, 2, $q$g$q$, NULL, false),
($q$Milk punch$q$, 0, $q$Lemon$q$, 6, $q$each$q$, $q$juiced: 4 at the start, 2 more with the milk$q$, false),
($q$Milk punch$q$, 1, $q$Lemon peel$q$, 2, $q$each$q$, $q$rind of 2 lemons$q$, false),
($q$Milk punch$q$, 2, $q$Sugar$q$, 225, $q$g$q$, $q$dissolved in just enough hot water$q$, false),
($q$Milk punch$q$, 3, $q$Pineapple$q$, 1, $q$each$q$, $q$peeled, sliced and pounded$q$, false),
($q$Milk punch$q$, 4, $q$Clove$q$, 6, $q$each$q$, NULL, false),
($q$Milk punch$q$, 5, $q$Coriander seed$q$, 20, $q$each$q$, NULL, false),
($q$Milk punch$q$, 6, $q$Cinnamon$q$, 1, $q$each$q$, $q$1 small stick$q$, false),
($q$Milk punch$q$, 7, $q$Brandy$q$, 480, $q$ml$q$, NULL, false),
($q$Milk punch$q$, 8, $q$Jamaican rum$q$, 480, $q$ml$q$, NULL, false),
($q$Milk punch$q$, 9, $q$Batavia arrack$q$, 120, $q$ml$q$, NULL, false),
($q$Milk punch$q$, 10, $q$Green tea$q$, 240, $q$ml$q$, $q$brewed strong$q$, false),
($q$Milk punch$q$, 11, $q$Water$q$, 960, $q$ml$q$, $q$boiling$q$, false),
($q$Milk punch$q$, 12, $q$Milk$q$, 960, $q$ml$q$, $q$hot$q$, false),
($q$Milk wash$q$, 0, $q$Cocktail batch$q$, 1000, $q$ml$q$, $q$must taste sour or tannic: citrus, tea, coffee or wine$q$, false),
($q$Milk wash$q$, 1, $q$Milk$q$, 250, $q$ml$q$, $q$whole, cold or room temperature$q$, false),
($q$Milk wash$q$, 2, $q$Lemon juice$q$, NULL, NULL, $q$only if the batch has no acid or tannin, to taste$q$, true),
($q$Olive oil washed vodka$q$, 0, $q$Vodka$q$, 750, $q$ml$q$, NULL, false),
($q$Olive oil washed vodka$q$, 1, $q$Extra virgin olive oil$q$, 135, $q$ml$q$, $q$good quality$q$, false),
($q$Tomato water$q$, 0, $q$Tomato$q$, 900, $q$g$q$, $q$ripe, quartered, with all juice and seeds$q$, false),
($q$Tomato water$q$, 1, $q$Salt$q$, 1, $q$pinch$q$, NULL, false);

INSERT INTO step_in VALUES
($q$Clarified apple juice$q$, 0, $q$Whisk the agar into the smaller portion of cold juice, bring it to the boil while stirring, then simmer a couple of minutes so the agar hydrates.$q$, 120),
($q$Clarified apple juice$q$, 1, $q$Whisking hard, pour the rest of the cold juice into the boiling mix in a thin stream. Don't let it fall below 35 °C before it's all in or it sets in lumps.$q$, NULL),
($q$Clarified apple juice$q$, 2, $q$Set the bowl over an ice bath until it firms to a soft, loose gel.$q$, NULL),
($q$Clarified apple juice$q$, 3, $q$Break the gel into curds with a whisk, tip into a cheesecloth-lined sieve and let it drain. Stir the curds or twist the cloth gently; pressing hard pushes agar through.$q$, NULL),
($q$Clarified apple juice$q$, 4, $q$Pass through a coffee filter if any agar specks got through, then bottle and chill.$q$, NULL),
($q$Clarified citrus$q$, 0, $q$Whisk the agar into the water, bring it to the boil and let it simmer a couple of minutes, whisking, until clear.$q$, 120),
($q$Clarified citrus$q$, 1, $q$Off the heat, whisk the room temperature juice into the hot agar water. The mix should land near 39 °C; never boil the juice.$q$, NULL),
($q$Clarified citrus$q$, 2, $q$Leave it in the fridge or over ice until it sets to a soft gel.$q$, NULL),
($q$Clarified citrus$q$, 3, $q$Break the gel up gently with a whisk and pour it into a sieve lined with three layers of cheesecloth.$q$, NULL),
($q$Clarified citrus$q$, 4, $q$Massage the cloth gently to let the clear juice out. Squeezing hard pushes agar through; run it through a coffee filter if any bits get past.$q$, NULL),
($q$Clarified coconut$q$, 0, $q$Whisk the agar into the water, bring it to the boil and let it simmer a couple of minutes, whisking, until clear.$q$, 120),
($q$Clarified coconut$q$, 1, $q$Off the heat, whisk the room temperature juice into the hot agar water. The mix should land near 39 °C; never boil the juice.$q$, NULL),
($q$Clarified coconut$q$, 2, $q$Leave it in the fridge or over ice until it sets to a soft gel.$q$, NULL),
($q$Clarified coconut$q$, 3, $q$Break the gel up gently with a whisk and pour it into a sieve lined with three layers of cheesecloth.$q$, NULL),
($q$Clarified coconut$q$, 4, $q$Massage the cloth gently to let the clear juice out. Squeezing hard pushes agar through; run it through a coffee filter if any bits get past.$q$, NULL),
($q$Clarified grapefruit juice$q$, 0, $q$Let the juice come to room temperature (about 25 °C). Whisk the agar into the water and bring it to the boil, whisking, then simmer a couple of minutes so it hydrates.$q$, 120),
($q$Clarified grapefruit juice$q$, 1, $q$Off the heat, pour the juice into the hot agar water in a thin stream, whisking hard. Never boil the juice, and don't let the mix fall below 35 °C before it's all in or it sets in lumps.$q$, NULL),
($q$Clarified grapefruit juice$q$, 2, $q$Set the bowl over an ice bath until it firms to a soft, loose gel.$q$, NULL),
($q$Clarified grapefruit juice$q$, 3, $q$Break the gel into curds with a whisk, tip into a cheesecloth-lined sieve and let it drain. Stir the curds or twist the cloth gently; pressing hard pushes agar through.$q$, NULL),
($q$Clarified grapefruit juice$q$, 4, $q$Pass through a coffee filter if any agar specks got through, then bottle and chill.$q$, NULL),
($q$Clarified guava$q$, 0, $q$Whisk the agar into the water, bring it to the boil and let it simmer a couple of minutes, whisking, until clear.$q$, 120),
($q$Clarified guava$q$, 1, $q$Off the heat, whisk the room temperature juice into the hot agar water. The mix should land near 39 °C; never boil the juice.$q$, NULL),
($q$Clarified guava$q$, 2, $q$Leave it in the fridge or over ice until it sets to a soft gel.$q$, NULL),
($q$Clarified guava$q$, 3, $q$Break the gel up gently with a whisk and pour it into a sieve lined with three layers of cheesecloth.$q$, NULL),
($q$Clarified guava$q$, 4, $q$Massage the cloth gently to let the clear juice out. Squeezing hard pushes agar through; run it through a coffee filter if any bits get past.$q$, NULL),
($q$Clarified lemon juice$q$, 0, $q$Let the juice come to room temperature (about 25 °C). Whisk the agar into the water and bring it to the boil, whisking, then simmer a couple of minutes so it hydrates.$q$, 120),
($q$Clarified lemon juice$q$, 1, $q$Off the heat, pour the juice into the hot agar water in a thin stream, whisking hard. Never boil the juice, and don't let the mix fall below 35 °C before it's all in or it sets in lumps.$q$, NULL),
($q$Clarified lemon juice$q$, 2, $q$Set the bowl over an ice bath until it firms to a soft, loose gel.$q$, NULL),
($q$Clarified lemon juice$q$, 3, $q$Break the gel into curds with a whisk, tip into a cheesecloth-lined sieve and let it drain. Stir the curds or twist the cloth gently; pressing hard pushes agar through.$q$, NULL),
($q$Clarified lemon juice$q$, 4, $q$Pass through a coffee filter if any agar specks got through, then bottle and chill.$q$, NULL),
($q$Clarified lime juice$q$, 0, $q$Let the juice come to room temperature (about 25 °C). Whisk the agar into the water and bring it to the boil, whisking, then simmer a couple of minutes so it hydrates.$q$, 120),
($q$Clarified lime juice$q$, 1, $q$Off the heat, pour the juice into the hot agar water in a thin stream, whisking hard. Never boil the juice, and don't let the mix fall below 35 °C before it's all in or it sets in lumps.$q$, NULL),
($q$Clarified lime juice$q$, 2, $q$Set the bowl over an ice bath until it firms to a soft, loose gel.$q$, NULL),
($q$Clarified lime juice$q$, 3, $q$Break the gel into curds with a whisk, tip into a cheesecloth-lined sieve and let it drain. Stir the curds or twist the cloth gently; pressing hard pushes agar through.$q$, NULL),
($q$Clarified lime juice$q$, 4, $q$Pass through a coffee filter if any agar specks got through. Chill and use the same day.$q$, NULL),
($q$Clarified milk punch$q$, 0, $q$Brew the Earl Grey strong, strain out the leaves and let it cool.$q$, NULL),
($q$Clarified milk punch$q$, 1, $q$Mix the gin, lemon, syrup and tea. If there is time, let the batch sit a few hours.$q$, NULL),
($q$Clarified milk punch$q$, 2, $q$Pour about a third of the batch into the cold milk (never the milk into the batch) and stir once. When it breaks, add the rest gently without stirring.$q$, NULL),
($q$Clarified milk punch$q$, 3, $q$Cover and rest in the fridge at least 24 hours; 48 is better.$q$, 86400),
($q$Clarified milk punch$q$, 4, $q$Strain a scoop at a time through a coffee filter or a sieve lined with double cheesecloth. Pour the first cloudy run back through. Never press the curds.$q$, NULL),
($q$Clarified milk punch$q$, 5, $q$Bottle and keep cold. Contains milk.$q$, NULL),
($q$Clarified orange juice$q$, 0, $q$Whisk the agar into the smaller portion of cold juice, bring it to the boil while stirring, then simmer a couple of minutes so the agar hydrates.$q$, 120),
($q$Clarified orange juice$q$, 1, $q$Whisking hard, pour the rest of the cold juice into the boiling mix in a thin stream. Don't let it fall below 35 °C before it's all in or it sets in lumps.$q$, NULL),
($q$Clarified orange juice$q$, 2, $q$Set the bowl over an ice bath until it firms to a soft, loose gel.$q$, NULL),
($q$Clarified orange juice$q$, 3, $q$Break the gel into curds with a whisk, tip into a cheesecloth-lined sieve and let it drain. Stir the curds or twist the cloth gently; pressing hard pushes agar through.$q$, NULL),
($q$Clarified orange juice$q$, 4, $q$Pass through a coffee filter if any agar specks got through, then bottle and chill.$q$, NULL),
($q$Clarified pineapple juice$q$, 0, $q$Whisk the agar into the smaller portion of cold juice, bring it to the boil while stirring, then simmer a couple of minutes so the agar hydrates.$q$, 120),
($q$Clarified pineapple juice$q$, 1, $q$Whisking hard, pour the rest of the cold juice into the boiling mix in a thin stream. Don't let it fall below 35 °C before it's all in or it sets in lumps.$q$, NULL),
($q$Clarified pineapple juice$q$, 2, $q$Set the bowl over an ice bath until it firms to a soft, loose gel.$q$, NULL),
($q$Clarified pineapple juice$q$, 3, $q$Break the gel into curds with a whisk, tip into a cheesecloth-lined sieve and let it drain. Stir the curds or twist the cloth gently; pressing hard pushes agar through.$q$, NULL),
($q$Clarified pineapple juice$q$, 4, $q$Pass through a coffee filter if any agar specks got through, then bottle and chill.$q$, NULL),
($q$Clarified tomato water$q$, 0, $q$Blend the tomatoes smooth. Don't salt them yet: what drips out first is more concentrated.$q$, NULL),
($q$Clarified tomato water$q$, 1, $q$Bloom the gelatine in a little cold purée, melt it into a small warmed portion, then stir that through the rest.$q$, NULL),
($q$Clarified tomato water$q$, 2, $q$Pour into a shallow tray, leave it in the fridge a while so the gelatine can work, then freeze it solid.$q$, 28800),
($q$Clarified tomato water$q$, 3, $q$Set the frozen block in a cloth-lined perforated pan or sieve over a container and let it thaw in the fridge. Don't press it.$q$, NULL),
($q$Clarified tomato water$q$, 4, $q$Stir all the drips together before bottling: the first ones carry most of the flavour, sugar and acid.$q$, NULL),
($q$Clarified watermelon juice$q$, 0, $q$Let the juice come to room temperature (about 25 °C). Whisk the agar into the water and bring it to the boil, whisking, then simmer a couple of minutes so it hydrates.$q$, 120),
($q$Clarified watermelon juice$q$, 1, $q$Off the heat, pour the juice into the hot agar water in a thin stream, whisking hard. Never boil the juice, and don't let the mix fall below 35 °C before it's all in or it sets in lumps.$q$, NULL),
($q$Clarified watermelon juice$q$, 2, $q$Set the bowl over an ice bath until it firms to a soft, loose gel.$q$, NULL),
($q$Clarified watermelon juice$q$, 3, $q$Break the gel into curds with a whisk, tip into a cheesecloth-lined sieve and let it drain. Stir the curds or twist the cloth gently; pressing hard pushes agar through.$q$, NULL),
($q$Clarified watermelon juice$q$, 4, $q$Pass through a coffee filter if any agar specks got through, then bottle and chill.$q$, NULL),
($q$Milk punch$q$, 0, $q$Put the juice of 4 lemons, the rind of 2, the dissolved sugar, pounded pineapple, spices, brandy, rum, arrack and tea in a large clean jar. Add the boiling water last.$q$, NULL),
($q$Milk punch$q$, 1, $q$Seal it so nothing evaporates and steep at least 6 hours.$q$, 21600),
($q$Milk punch$q$, 2, $q$Add the hot milk and the juice of 2 more lemons and mix.$q$, NULL),
($q$Milk punch$q$, 3, $q$Filter through a jelly bag or coffee filter until it runs bright. Do not press.$q$, NULL),
($q$Milk punch$q$, 4, $q$Bottle tightly and keep cold; serve over ice. For same-day use the source says filtering can be skipped. Contains milk.$q$, NULL),
($q$Milk wash$q$, 0, $q$Make sure the batch tastes sour or tannic. If not, add some acid.$q$, NULL),
($q$Milk wash$q$, 1, $q$Pour about a third of the batch into the milk (never the milk into the batch) and stir. Stop when it breaks.$q$, NULL),
($q$Milk wash$q$, 2, $q$Add the rest gently without stirring and leave it at least 15 minutes, up to a few hours.$q$, 900),
($q$Milk wash$q$, 3, $q$Strain through a coffee filter or nut-milk bag. Pour the first cloudy run back through once the curds form a mat. Never press.$q$, NULL),
($q$Milk wash$q$, 4, $q$Bottle and chill. Contains milk.$q$, NULL),
($q$Olive oil washed vodka$q$, 0, $q$Combine the vodka and olive oil in a freezer-safe container.$q$, NULL),
($q$Olive oil washed vodka$q$, 1, $q$Leave it at room temperature for 5 days.$q$, NULL),
($q$Olive oil washed vodka$q$, 2, $q$Freeze until the oil sets into a solid layer.$q$, NULL),
($q$Olive oil washed vodka$q$, 3, $q$Break through the oil, lift it off and strain the vodka through cheesecloth or a coffee filter.$q$, NULL),
($q$Olive oil washed vodka$q$, 4, $q$Bottle and keep in the fridge.$q$, NULL),
($q$Tomato water$q$, 0, $q$Quarter ripe tomatoes, keeping all their juice and seeds, and blend with the salt until smooth.$q$, NULL),
($q$Tomato water$q$, 1, $q$Pour into a cheesecloth-lined sieve (or a coffee filter) over a clean bowl.$q$, NULL),
($q$Tomato water$q$, 2, $q$Let it drip in the fridge for several hours or overnight. Don't press, squeeze or stir, or it turns cloudy.$q$, NULL),
($q$Tomato water$q$, 3, $q$Bottle the clear liquid and keep it cold.$q$, NULL);

INSERT INTO source_in VALUES
($q$Clarified apple juice$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold: juice that can take some heat has a third boiled with the agar (0.2% of the total) and two thirds whisked in cold; his orange batch is 250 g + 500 g + 1.5 g. Doubled to 500 g + 1000 g + 3 g.$q$),
($q$Clarified apple juice$q$, $q$recipe$q$, $q$https://punchdrink.com/articles/how-to-clarified-cocktail-recipe-drink-science-super-lyan/$q$, $q$reference$q$, DATE '2026-10-13', $q$Team Lyan's quick gel: agar at 0.02% of the liquid weight, a tenth of Arnold's figure and most likely a misprint. We use Arnold's measured 0.2% (2 g per kilo).$q$),
($q$Clarified citrus$q$, $q$recipe$q$, $q$https://cookingissues.com/2010/07/20/simple-agar-clarification-1-year-anniversary-plus-a-rundown-of-current-clarification-techniques/$q$, $q$reference$q$, DATE '2026-10-13', $q$Dave Arnold's quick agar clarification for heat-sensitive lime juice: 375 g juice, 1 g agar boiled in 125 g water, juice tempered in. His orange juice test returned about 69% (516.8 g from 750 g); our yield applies that.$q$),
($q$Clarified citrus$q$, $q$keeps$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold: clarified lime must be used the day it is made, not even the next morning; recorded as 12 hours.$q$),
($q$Clarified citrus$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$The original method: agar at 0.2% of the juice weight, set, broken and drained through cheesecloth; 516.8 g clear juice back from 750 g orange juice.$q$),
($q$Clarified coconut$q$, $q$recipe$q$, $q$https://cookingissues.com/2010/07/20/simple-agar-clarification-1-year-anniversary-plus-a-rundown-of-current-clarification-techniques/$q$, $q$reference$q$, DATE '2026-10-13', $q$Dave Arnold's quick agar ratio (2 g agar per kg of juice 'or whatever'), in his heat-sensitive form: 375 g liquid, 1 g agar boiled in 125 g water. He did not test coconut water, so this is untested arithmetic.$q$),
($q$Clarified coconut$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$The 0.2% agar method in full, and hydrating agar in water for liquids that can't be boiled.$q$),
($q$Clarified grapefruit juice$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold's quick agar clarification: agar at 0.2% of the total weight; heat-sensitive juice stays unboiled, 4 parts room-temperature juice to 1 part water that the agar is boiled in. Scaled to 800 g juice, 200 g water, 2 g agar.$q$),
($q$Clarified grapefruit juice$q$, $q$recipe$q$, $q$https://punchdrink.com/articles/how-to-clarified-cocktail-recipe-drink-science-super-lyan/$q$, $q$reference$q$, DATE '2026-10-13', $q$Team Lyan's quick gel: agar at 0.02% of the liquid weight, a tenth of Arnold's figure and most likely a misprint. We use Arnold's measured 0.2% (2 g per kilo).$q$),
($q$Clarified grapefruit juice$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/17/simple-agar-clarification-vs-gelatin-clarification-another-difference/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold on clarified grapefruit: tastes clean and bright and loses some bitterness; he also clarifies it with gelatin. We treat it as fresh citrus and keep it unboiled.$q$),
($q$Clarified guava$q$, $q$recipe$q$, $q$https://cookingissues.com/2010/07/20/simple-agar-clarification-1-year-anniversary-plus-a-rundown-of-current-clarification-techniques/$q$, $q$reference$q$, DATE '2026-10-13', $q$Dave Arnold's quick agar ratio (2 g agar per kg of juice 'or whatever'), in his heat-sensitive form: 375 g juice, 1 g agar boiled in 125 g water. He tested lime and orange, not guava, so this is untested arithmetic.$q$),
($q$Clarified guava$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$The 0.2% agar method in full, and the way to hydrate agar in water for juices that can't be boiled.$q$),
($q$Clarified lemon juice$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold's quick agar clarification: agar at 0.2% of the total weight; heat-sensitive juice stays unboiled, 4 parts room-temperature juice to 1 part water that the agar is boiled in. Scaled to 800 g juice, 200 g water, 2 g agar.$q$),
($q$Clarified lemon juice$q$, $q$recipe$q$, $q$https://punchdrink.com/articles/how-to-clarified-cocktail-recipe-drink-science-super-lyan/$q$, $q$reference$q$, DATE '2026-10-13', $q$Team Lyan's quick gel: agar at 0.02% of the liquid weight, a tenth of Arnold's figure and most likely a misprint. We use Arnold's measured 0.2% (2 g per kilo).$q$),
($q$Clarified lime juice$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold's quick agar clarification: agar at 0.2% of the total weight; heat-sensitive juice stays unboiled, 4 parts room-temperature juice to 1 part water that the agar is boiled in. Scaled to 800 g juice, 200 g water, 2 g agar.$q$),
($q$Clarified lime juice$q$, $q$recipe$q$, $q$https://punchdrink.com/articles/how-to-clarified-cocktail-recipe-drink-science-super-lyan/$q$, $q$reference$q$, DATE '2026-10-13', $q$Team Lyan's quick gel: agar at 0.02% of the liquid weight, a tenth of Arnold's figure and most likely a misprint. We use Arnold's measured 0.2% (2 g per kilo).$q$),
($q$Clarified lime juice$q$, $q$keeps$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold: clarified lime keeps no better than fresh lime and must be used the day it's made. We record that as 12 hours.$q$),
($q$Clarified milk punch$q$, $q$recipe$q$, $q$https://milkpunch.substack.com/p/milk-punch-method$q$, $q$reference$q$, DATE '2026-10-13', $q$Mia Glanz's Earl Grey milk punch, batched x10: 20 oz gin, 7.5 oz lemon, 5 oz simple syrup, 20 oz Earl Grey tea (600 / 225 / 150 / 600 ml at 30 ml per oz), with milk at 4 parts batch to 1 (about 395 ml); rest 24 to 48 h.$q$),
($q$Clarified milk punch$q$, $q$recipe$q$, $q$https://www.campariacademy.com/en-us/training/tools-techniques/milk-punch-guide-and-recipes/$q$, $q$reference$q$, DATE '2026-10-13', $q$Campari Academy: milk is batch volume x 0.25 (the same 4:1), and their test sour ran 2 vodka : 0.75 lemon : 0.75 simple syrup with 20% milk, no tea. Sweeter than Glanz's; we use Glanz's spec and Campari's third-first pouring.$q$),
($q$Clarified milk punch$q$, $q$keeps$q$, $q$https://alcademics.com/milk-punch-science-and-practice/$q$, $q$reference$q$, DATE '2026-10-13', $q$After a week or two the solids drop out and it needs refiltering; we take the short end, a week.$q$),
($q$Clarified orange juice$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold's worked example as written: 1.5 g agar (0.2%) boiled in 250 g cold orange juice, then 500 g cold juice whisked in.$q$),
($q$Clarified orange juice$q$, $q$yield$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold got 516.8 g of clear juice from this 750 g batch, from unstrained juice.$q$),
($q$Clarified pineapple juice$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold: juice that can take some heat has a third boiled with the agar (0.2% of the total) and two thirds whisked in cold; his orange batch is 250 g + 500 g + 1.5 g. Doubled to 500 g + 1000 g + 3 g.$q$),
($q$Clarified tomato water$q$, $q$recipe$q$, $q$https://cookingissues.com/2010/07/20/simple-agar-clarification-1-year-anniversary-plus-a-rundown-of-current-clarification-techniques/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold's gelatin freeze-thaw: 5 g gelatin per kilo of product, rested in the fridge, frozen solid, thawed in the fridge over cheesecloth; batch all the drips together. Used as written for 1 kg.$q$),
($q$Clarified tomato water$q$, $q$recipe$q$, $q$https://www.greatitalianchefs.com/recipes/tomato-water-fennel-puree-recipe$q$, $q$reference$q$, DATE '2026-10-13', $q$Damini brothers' tomato water: 400 g blitzed tomatoes with 2 g powdered gelatine (0.5%, the same ratio), frozen at least 8 hours and thawed in muslin in the fridge.$q$),
($q$Clarified watermelon juice$q$, $q$recipe$q$, $q$https://cookingissues.com/2009/07/14/agar-clarification-made-stupid-simple-best-technique-yet/$q$, $q$reference$q$, DATE '2026-10-13', $q$Arnold's quick agar clarification, unboiled version for delicate juice: 4 parts room-temperature juice to 1 part water the agar is boiled in, agar 0.2% of the total. Scaled to 800 g juice. A reader on the page reports watermelon clear in under an hour.$q$),
($q$Milk punch$q$, $q$recipe$q$, $q$https://archive.org/details/bartendersguideo00thom/page/86/$q$, $q$reference$q$, DATE '2026-10-13', $q$Jerry Thomas, Bar-Tender's Guide (1887), p. 86, California Milk Punch for bottling (public domain). Converted: pint 480 ml, quart 960 ml, gill 120 ml, cup 240 ml, half a pound of sugar about 225 g.$q$),
($q$Milk punch$q$, $q$keeps$q$, $q$https://alcademics.com/milk-punch-science-and-practice/$q$, $q$reference$q$, DATE '2026-10-13', $q$After a week or two the solids drop out and it needs refiltering; we take the short end, a week.$q$),
($q$Milk wash$q$, $q$recipe$q$, $q$https://www.campariacademy.com/en-us/training/tools-techniques/milk-punch-guide-and-recipes/$q$, $q$reference$q$, DATE '2026-10-13', $q$Campari Academy: milk volume is batch volume x 0.25; add a third of the batch to the milk first, rest 15 minutes to a few hours. Their lab test used 20% milk. Scaled to a 1 litre batch.$q$),
($q$Milk wash$q$, $q$recipe$q$, $q$https://milkpunch.substack.com/p/milk-punch-method$q$, $q$reference$q$, DATE '2026-10-13', $q$Mia Glanz uses 4 parts cocktail to 1 part milk, the same as Campari's; she notes many bartenders use 6:1.$q$),
($q$Milk wash$q$, $q$keeps$q$, $q$https://alcademics.com/milk-punch-science-and-practice/$q$, $q$reference$q$, DATE '2026-10-13', $q$After a week or two the solids drop out and it needs refiltering; we take the short end, a week.$q$),
($q$Olive oil washed vodka$q$, $q$recipe$q$, $q$https://imbibemagazine.com/recipe/olive-oil-washed-martini-recipe/$q$, $q$reference$q$, DATE '2026-10-13', $q$Mark Bystrom (Forequarter, Madison): 250 ml vodka to 45 ml extra virgin olive oil, 5 days at room temperature, then frozen and the oil scraped off. Scaled to a 750 ml bottle (135 ml oil).$q$),
($q$Olive oil washed vodka$q$, $q$recipe$q$, $q$https://imbibemagazine.com/recipe/caesar-martini/$q$, $q$reference$q$, DATE '2026-10-13', $q$Shy Shy's Caesar vodka washes a 750 ml bottle with 3 oz (90 ml) olive oil, freezes, then strains through cheesecloth. Lighter than Forequarter's; we use Forequarter's plain-vodka ratio.$q$),
($q$Olive oil washed vodka$q$, $q$recipe$q$, $q$https://drinksworld.com/fat-washing-guide/$q$, $q$reference$q$, DATE '2026-10-13', $q$Drinks World's general fat wash runs 1 to 2 oz (30 to 60 ml) fat per 750 ml, far lighter; olive oil washes in bar recipes run heavier, so we use Forequarter's.$q$),
($q$Olive oil washed vodka$q$, $q$keeps$q$, $q$https://drinksworld.com/fat-washing-guide/$q$, $q$reference$q$, DATE '2026-10-13', $q$General guidance for fat-washed spirits, fridge: about 1 to 2 weeks; we take the shorter. (Shy Shy says indefinitely; we use the cautious figure.)$q$),
($q$Tomato water$q$, $q$recipe$q$, $q$https://imbibemagazine.com/recipe/little-sister-tomato-soju-cocktail/$q$, $q$reference$q$, DATE '2026-10-13', $q$Little Sister's tomato water: 2 lb tomatoes blended with a pinch of salt and strained clear through a coffee filter. 2 lb taken as about 900 g.$q$),
($q$Tomato water$q$, $q$recipe$q$, $q$https://punchdrink.com/recipes/ode-to-tomatoes/$q$, $q$reference$q$, DATE '2026-10-13', $q$Ode to Tomatoes: 2 quarts cherry tomatoes salted with 1 tsp kosher salt (herbs optional), pulsed and drained overnight through cheesecloth in the fridge. Salts much harder than Imbibe; we use Imbibe's pinch, and this page's cloth drip.$q$),
($q$Tomato water$q$, $q$keeps$q$, $q$https://imbibemagazine.com/recipe/little-sister-tomato-soju-cocktail/$q$, $q$reference$q$, DATE '2026-10-13', $q$A week in the fridge, for this same pinch-salted tomato water.$q$),
($q$Tomato water$q$, $q$keeps$q$, $q$https://punchdrink.com/recipes/ode-to-tomatoes/$q$, $q$reference$q$, DATE '2026-10-13', $q$3 to 4 days in the fridge for a herb and salt tomato water salted a little harder than ours; we take 3 days, the shorter keep. Another Imbibe tomato water (Eden's River) says to use it immediately.$q$);

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
