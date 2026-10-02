-- Signature drinks of The World's 50 Best Bars, with specs where one is
-- published, and the catalog classics filled in from Punch.
--
-- 1. Each bar's best-known drinks, researched from the bars' own sites and
--    menus, The World's 50 Best, Punch, Difford's Guide, Imbibe and the
--    drinks press. They are shared drinks credited to the bar
--    (origin_bar_profile_id), so they show under its Originals and can be
--    ranked there. A version of a classic links to its catalog entry
--    (riff_of_id). Drinks from other famous bars that Punch publishes are
--    added the same way when that bar has a profile here.
-- 2. The description names the main ingredients. The notes say what makes the
--    drink special, who made it, how, and where the spec comes from. Both are
--    in our words, not the bars' menu copy or the articles' text.
-- 3. Ingredients (recipes rows) where a menu or article lists them. Measures,
--    glass, ice and method only where a real spec is published, and every
--    measure was checked against the source's own text. Never estimated. A
--    branded bottle is the recipe's ingredient and its generic is the parent,
--    same as a venue's own specs.
-- 4. The catalog classics get a description, their history (notes), origin
--    year and Punch's spec, only where they have none yet.
--
-- Safe to re-run. A drink the bar already has (same name, e.g. from the
-- city-bars seed) keeps its row and only gains empty fields, and a spec if it
-- has none. Ingredients reuse a shared ingredient of the same name.

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';

CREATE TEMP TABLE "seed_drinks" ("handle" text, "bar_name" text, "name" text, "description" text, "notes" text,
    "riff_of" text, "origin_year" int, "glass" text, "ice" text, "method" text);
CREATE TEMP TABLE "seed_lines" ("handle" text, "bar_name" text, "drink" text, "pos" int, "amount" numeric, "unit" text,
    "ingredient" text, "generic" text, "prep" text, "optional" boolean);
CREATE TEMP TABLE "seed_classics" ("name" text, "description" text, "notes" text, "origin_year" int,
    "glass" text, "ice" text, "method" text);

INSERT INTO "seed_drinks" VALUES
    ('barleonehk', NULL, 'Olive Oil Sour', 'Bourbon, Italian brandy and oloroso sherry sour with honey, lemon, egg white and a dash of extra virgin olive oil.', 'The house signature: a whiskey sour given silkier body and a savoury, grassy edge by a small measure of olive oil. At the bar it is whipped on a spindle blender instead of shaken, which emulsifies the oil into a dense foam.

Created by Lorenzo Antinori in 2023.

Method: Shake with ice, strain back into the shaker, dry shake to emulsify, then fine strain. (Bar Leone mixes it on a spindle blender.)
Honey syrup: Mix 3 parts honey with 1 part water by weight.

Spec adapted from Difford''s Guide (https://www.diffordsguide.com/cocktails/recipe/37746/olive-oil-sour).', 'Whiskey Sour', 2023, 'Coupette', NULL, 'dry shake and shake'),
    ('barleonehk', NULL, 'Filthy Martini', 'Vodka stirred with the bar''s own smoked olive brine and garnished with a smoked olive.', 'The bar''s best-seller, a dirty Martini built on olives that the team smokes over cherry wood in the kitchen''s combi oven, using their brine for a smoky, salty edge against clean vodka.

Created by Lorenzo Antinori in 2023.

Method: Stir with ice until very cold and strain into a chilled Martini glass.
Smoked olive brine: Spanish olives are smoked with cherry wood in a combi oven; their brine is used in the drink.

Spec from The World''s 50 Best Bars (https://www.the50.com/stories/News/bar-leone-asias-50-best-bars-2025-recipes.html).', 'Martini', 2023, 'Martini', NULL, 'Stir'),
    ('barleonehk', NULL, 'Yuzu Negroni', 'Gin, gentian aperitif, bianco vermouth and yuzu liqueur stirred and served over a large cube.', 'Bar Leone''s house Negroni swaps Campari and red vermouth for a paler, gentian-led build brightened with Japanese yuzu liqueur, an Italian classic with a Hong Kong accent.

Created by Lorenzo Antinori in 2023.

Method: Stir with ice until frosty and pour into a short tumbler over a large ice cube.

Spec from The World''s 50 Best Bars (https://www.the50.com/stories/News/bar-leone-asias-50-best-bars-2025-recipes.html).', 'White Negroni', 2023, 'Rocks', 'Large Cube', 'Stir'),
    ('barleonehk', NULL, 'Leone Martini', 'Pre-diluted wet Martini of Italian gin and marsala with orange blossom water, poured from the freezer with an almond-stuffed olive.', 'A batched, freezer-cold wet Martini that uses marsala in place of dry vermouth, giving it a nutty Italian character; poured straight from the bottle for speed and consistency.

Created by Lorenzo Antinori in 2023.

Method: Pre-diluted and stored in the freezer; poured from the bottle.

Ingredients from 50 Best Discovery (https://www.theworlds50best.com/discovery/Establishments/Hong-Kong/Hong-Kong/Bar-Leone.html). No measures have been published.', 'Martini', 2023, NULL, NULL, 'Build'),
    ('barleonehk', NULL, 'Caffè Paradiso', 'Cold brew coffee with Scotch, Amaro Lucano, Torino vermouth and honey, topped with salted cream and cardamom.', 'Bar Leone''s chilled, Italianised Irish coffee: amaro and vermouth add bittersweet depth to cold brew and Scotch, finished with salted cream and freshly grated green cardamom.

Method: Stir the coffee, Scotch, amaro, vermouth, syrup and liqueur, pour into an Irish coffee glass leaving about 3 cm, and float salted cream on top.

Spec from The World''s 50 Best Bars (https://www.the50.com/stories/News/bar-leone-asias-50-best-bars-2025-recipes.html).', NULL, NULL, NULL, NULL, 'Stir'),
    ('handshake_bar', NULL, 'Fig Martini', 'Dry gin Martini with Cinzano blanco vermouth, a sous-vide fig leaf cordial and lemon oil, finished with fresh fig.', 'The drink the owners say started it all: on the menu since opening day and the one they point first-timers to. The fig leaf cordial is cooked sous vide for 48 hours from locally foraged leaves, giving almond and green-fig notes to a clean dry Martini.

Created by Eric van Beek in 2018.

Method: Stirred.

Ingredients from Islands (https://www.islands.com/1863801/handshake-speakeasy-mexico-city-north-america-best-bar-intimate-hideaway-fig-martini-worth-booking-flight/). No measures have been published.', 'Martini', 2018, NULL, NULL, 'Stir'),
    ('handshake_bar', NULL, 'Mexi-Thai', 'Crystal-clear tequila drink of coconut-oil-washed blanco tequila, makrut lime leaf distillate and clarified tomato cordial with basil oil.', 'Inspired by the tom yum soup Eric van Beek ate in Amsterdam, it looks like a Martini but tastes tropical and savoury. Every component is fat-washed, distilled or clarified in house, and Punch reported it as the bar''s best-seller despite being a love-it-or-hate-it drink.

Created by Eric van Beek.

Spec adapted from Punch (https://punchdrink.com/articles/tequila-cocktail-handshake-speakeasys-mexi-thai/).', NULL, NULL, 'Coupette', NULL, NULL),
    ('handshake_bar', NULL, 'Salt N Pepper', 'Highball of strawberry-infused mezcal, carbonated yellow bell pepper soda and habanero tincture, with a bell pepper powder rim.', 'Handshake''s take on the Paloma: mezcal replaces tequila, and the grapefruit soda becomes a house soda of yellow bell peppers slow-cooked sous vide with wood, citric acid and sugar, then carbonated. Fruity, vegetal and gently spicy, and a notorious repeat order.

Created by Eric van Beek and Yiyi Aparicio in 2024.

Method: Build in a highball over ice.
Strawberry mezcal: Infuse mezcal with fresh strawberries overnight (about 24 hours), then strain and filter.
Yellow bell pepper soda: Cook yellow bell peppers sous vide at 55C for two hours with wood, water, citric acid and sugar; strain, cool and carbonate three times at 55 psi.

Spec from The Spirits Business (https://www.thespiritsbusiness.com/2025/01/cocktail-stories-salt-n-pepper-handshake-speakeasy/).', 'Paloma', 2024, 'Highball', NULL, 'Build'),
    ('handshake_bar', NULL, 'Peanut Butter Jelly', 'Peanut-butter-distilled Belvedere vodka infused with raspberry, with raspberry cordial, Cocchi Rosa, raspberry vinegar and salt, served with a PB&J sandwich.', 'One of Handshake''s best-loved serves, a PB&J sandwich in liquid form: the vodka is redistilled with peanut butter, then infused with raspberries, and the drink arrives with a small sandwich from a local bakery.

Created by Eric van Beek.

Ingredients from Drinks International (https://drinksint.com/news/fullstory.php/aid/11458/Menu_of_the_month:_Handshake_Speakeasy.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('handshake_bar', NULL, 'Once Upon a Time in Oaxaca', 'Mezcal infused for eight hours with mint and absinthe, served with a burning steel wool flourish.', 'An homage to Mexico''s master mezcaleros, pairing smoky mezcal with a mint and absinthe infusion; the lit steel wool ball makes it one of the bar''s theatrical serves.

Sources: https://www.the50.com/stories/News/handshake-speakeasy-the-best-bar-in-north-america-2025.html', NULL, NULL, NULL, NULL, NULL),
    ('sips.barcelona', NULL, 'Primordial', 'Aged Scotch whisky with ruby Port and nashi pear, sipped from cast-metal cupped hands.', 'Sips'' best-known serve: the vessel is a pair of sculpted metal hands, a nod to the first drinking tool humans ever used. The drink itself is a fruity, fortified-wine-softened Scotch sipper.

Created by Simone Caporale and Marc Álvarez.

Ingredients from Sips menu (https://uqrmecdn.s3.us-east-2.amazonaws.com/u/477582/877078-18115827fbd58c5034d5d5a706a41268354aa36.pdf). No measures have been published.', NULL, NULL, 'Custom', NULL, NULL),
    ('sips.barcelona', NULL, 'Krypta', 'Gin and Armagnac with clarified green kiwi, served in an egg-shaped terrarium vessel.', 'Billed as a cocktail you can breathe: the closed, egg-like terrarium traps the aroma so the scent reaches you before the first sip, and the clarified kiwi keeps it bright and clear.

Created by Simone Caporale and Marc Álvarez.

Ingredients from Sips menu (https://uqrmecdn.s3.us-east-2.amazonaws.com/u/477582/877078-18115827fbd58c5034d5d5a706a41268354aa36.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('sips.barcelona', NULL, 'Sips Adonis', 'Stirred Adonis of Martini Rubino vermouth, palo cortado sherry, extra dry vermouth and Santoni aperitivo.', 'A richer, bittersweet take on the sherry-and-vermouth Adonis, doubling up on vermouths and adding a red Italian aperitivo. On the Sips menu it appears with hazelnut praline for a nutty aroma.

Created by Simone Caporale and Marc Álvarez in 2024.

Method: Stir with ice and fine strain into a chilled coupe.

Spec from Difford''s Guide (original Sips spec, Amaro Santoni takeover at Double Chicken Please, July 2024) (https://www.diffordsguide.com/cocktails/recipe/29588/sips-adonis).', NULL, 2024, 'Coupette', NULL, 'Stir'),
    ('sips.barcelona', NULL, 'Sips Sgroppino', 'Blended Sgroppino of Savoia Americano Rosso, Italicus, raspberry sorbet and extra dry Prosecco.', 'Marc Álvarez''s dessert-style take on the Venetian sorbet-and-prosecco palate cleanser: raspberry sorbet instead of lemon and a bitter Italian aperitivo underneath, blended without ice into a frothy, pink ''raspberry bomb''.

Created by Marc Álvarez in 2021.

Method: Blend all ingredients without ice and pour into a chilled glass.

Spec adapted from Difford''s Guide (https://www.diffordsguide.com/cocktails/recipe/11081/sips-sgroppino).', NULL, 2021, 'Coupette', NULL, 'Blitz'),
    ('sips.barcelona', NULL, 'Mil Fulls', 'Grey Goose vodka with vanilla, lemon tree leaves and soda, inspired by the mille-feuille pastry.', 'A dessert turned into a highball: the flavours of a Catalan mil fulls pastry (vanilla, citrus) in a light, sparkling vodka drink, served in custom etched glassware.

Created by Simone Caporale and Marc Álvarez.

Ingredients from Sips menu (https://uqrmecdn.s3.us-east-2.amazonaws.com/u/477582/877078-18115827fbd58c5034d5d5a706a41268354aa36.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('paradiso_barcelona', NULL, 'Mediterranean Treasure', 'Ketel One vodka sour with oyster-leaf fino sherry, St-Germain, lemon, agave, coriander and egg white, served in a shell inside a smoking chest.', 'Paradiso''s calling card and one of the most photographed drinks in Barcelona: it arrives in a seashell inside a wooden treasure chest that releases smoke of Mediterranean herbs when opened. Oyster leaf gives the fino a briny, sea-air note against the floral, herbal sour. It was named Spain''s best cocktail in 2014 and remains a house classic.

Created by Giacomo Giannotti in 2014.

Oyster leaf fino: Fino sherry infused with oyster leaves.

Ingredients from CNN Travel (https://www.cnn.com/travel/article/mediterranean-treasure-el-paradiso-barcelona/index.html). No measures have been published.', NULL, 2014, 'Custom', NULL, NULL),
    ('paradiso_barcelona', NULL, 'Supercool Martini', 'Paradiso''s own white truffle gin with Mancino Secco vermouth, mustard seed and a gordal olive, served frozen.', 'A house classic Martini built on a gin distilled for the bar with white truffle, seasoned with mustard seed and served very cold and dry. It is one of the signatures kept on every new menu, including 2026''s Oltre.

Created by Giacomo Giannotti.

Ingredients from Paradiso menu (https://paradiso.cat/en/cocktails-menu/). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('paradiso_barcelona', NULL, 'Kriptonite', 'Paradiso gin with shiso, lemongrass, Sichuan pepper, riboflavin, electric liqueur, grapefruit cordial and chocolate bitters.', 'Named for its glowing colour, which comes from riboflavin (vitamin B2) that fluoresces under light; Sichuan pepper and an ''electric'' liqueur add a tingling, numbing edge. A long-running house classic.

Created by Giacomo Giannotti.

Ingredients from Paradiso menu (https://paradiso.cat/en/cocktails-menu/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('paradiso_barcelona', NULL, 'Great Gatsby', 'The Macallan 12 Double Cask with white truffle honey, amaro and lavender, smoked with vanilla and chocolate tobacco.', 'A smoky, powerful whisky signature finished tableside with vanilla and chocolate tobacco smoke, one of the showpiece house classics carried from menu to menu.

Created by Giacomo Giannotti.

Method: Smoked with vanilla and chocolate tobacco.

Ingredients from Paradiso menu (https://paradiso.cat/en/cocktails-menu/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('paradiso_barcelona', NULL, 'Fleming', 'Milk-clarified Paloma of black-miso tequila, grapefruit, grapefruit kefir water, dry vermouth and beer syrup with a cultured koji rim.', 'A tribute to Alexander Fleming and penicillin: fermentation runs through it, from the miso-infused tequila and kefir water to a rim of koji grown in a humidity-controlled chamber. The punch is clarified overnight with Thai-aromatic coconut and rice milks.

Created by Giacomo Giannotti and the Paradiso team in 2023.

Method: Combine the base, pour the heated infused milks over it, leave to curdle overnight and filter through cheesecloth until clear.
Beer syrup: Equal parts weissbier and sugar.
Koji rim: Agar-agar, glucose, tempeh and koji spores cultured in a temperature- and humidity-controlled chamber until firm, then cut into a ring that fits the rim.

Ingredients from Punch (https://punchdrink.com/articles/paloma-milk-punch-cocktail-paradiso-barcelona/). No measures have been published.', 'Paloma', 2023, NULL, NULL, 'Build'),
    ('tayer_elementary', NULL, 'One Sip Martini', 'A single-sip Martini of vodka, Ambrato vermouth and fino sherry with a Gorgonzola-stuffed gordal olive, served in a small veladora glass.', 'Elementary''s signature and the drink 50 Best calls the natural starting point for a visit: a Martini shrunk to one cold mouthful, pre-batched and kept in the freezer so it is always perfectly chilled. The blue-cheese olive has become part of the bar''s identity (they even sell ''Cult of One Sip Martini'' merch).

Created by Monica Berg.

Method: Stir with ice until chilled and strain into a small glass. (The bar pre-batches and freezes it.)

Spec from Punch (https://punchdrink.com/recipes/one-sip-martini/).', 'Martini', NULL, NULL, NULL, 'Stir'),
    ('tayer_elementary', NULL, 'Bergamot Margarita', 'Tequila Margarita scented with bergamot, served over ice; also sold bottled by the bar.', 'Kratena and Berg''s idea is that bergamot is the ideal citrus for tequila, adding a green, floral complexity to the classic. It appears in 50 Best''s coverage of Tayēr and became one of the bar''s bottled signatures.

Created by Alex Kratena and Monica Berg.

Sources: https://www.the50.com/stories/News/disaronno-highest-new-entry-tayer-elementary.html, https://tayer-elementary.com/products/tayer-bergamot-margarita', 'Margarita', NULL, NULL, NULL, NULL),
    ('tayer_elementary', NULL, 'Sandalwood Martini', 'Dry, woody freezer Martini with a sandalwood note lifting the citrus, from the bar''s bottled range.', 'Part of Tayēr''s line of ''perfumery'' classics built around a single woody or floral note (sandalwood, cedarwood, vetiver, jasmine). Bottled at about 31% ABV and meant to be poured straight from the freezer into a frozen glass, reflecting the bar''s hatred of warm, over-diluted Martinis.

Created by Alex Kratena and Monica Berg.

Sources: https://tayer-elementary.com/products/tayer-sandalwood-martini', 'Martini', NULL, NULL, NULL, NULL),
    ('connaughtbar', NULL, 'Connaught Martini', 'Tanqueray No. Ten with a house blend of dry vermouths, mixed at your table from the Martini trolley with a bitters of your choice.', 'The drink that made the bar famous: a bartender wheels the trolley to you, stirs the gin (or vodka) with the house vermouth blend and pours it from a height into a glass seasoned with one of several handmade bitters (such as cardamom, tonka or lavender). Every Martini is tailored to the guest, and the ritual has run for decades.

Created by Agostino Perrone.

Method: Stirred with ice at the table from the Martini trolley and poured from a height into a bitters-seasoned glass.

Ingredients from Connaught Bar menu (https://dxp.maybourne.com/contentassets/e4e490b61c004cdfb9ba66cf2018e231/the-connaught-bar-menu-june-2026.pdf). No measures have been published.', 'Martini', NULL, 'Martini', NULL, 'Stir'),
    ('connaughtbar', NULL, 'Mulata Daisy', 'White rum, crème de cacao, Galliano, lime and sugar shaken with muddled fennel seeds, served with a cocoa rim.', 'Agostino Perrone''s own favourite creation, built from the Cuban Mulata Daiquiri with fennel and Galliano adding an anise lift to the chocolate. It won the 2009 Bacardi Legacy competition and is still on the Connaught''s Masterpieces list.

Created by Agostino Perrone in 2008.

Method: Muddle the fennel seeds in the shaker, add lime juice and sugar and stir to dissolve, add the rest, shake with ice and strain into a chilled coupe.

Spec adapted from Difford''s Guide (https://www.diffordsguide.com/cocktails/recipe/2512/mulata-daisy).', 'Daiquiri', 2008, 'Coupette', NULL, 'muddle and shake'),
    ('connaughtbar', NULL, 'Connaught Bloody Mary', 'Vodka, tomato juice, a house spice mix and lemon, rolled and topped with celery air and nutmeg.', 'The Connaught''s reworked reviver swaps the celery stick for a light celery ''air'' foam that adds texture and freshness, and uses a punchy house mix of Worcestershire, soy, English mustard, horseradish and chilli.

Created by Agostino Perrone.

Method: Combine in a shaker and roll between two shakers two or three times, then strain into a coupe. Top with celery air and grated nutmeg.
Bloody Mary mix: Blend Worcestershire sauce, a little soy sauce, English mustard, Tabasco, coriander sprigs, grated fresh horseradish, a sliver of hot chilli and sea salt.
Celery air: Mix fresh celery juice with lecithin and celery salt, then aerate into a light foam.

Spec from Punch (https://punchdrink.com/recipes/connaught-bars-bloody-mary/).', 'Bloody Mary', NULL, 'Coupette', NULL, 'shake and top'),
    ('connaughtbar', NULL, 'Number 11', 'Grey Goose vodka and Fords gin with Martini Ambrato, Amalfi lemon oil and a distillate of five bitters.', 'Created to mark 11 years of the bar, it is a refined evolution of the Connaught Martini: a vodka-gin split with amber vermouth and a distillation of five of the house bitters (cardamom, tonka bean, ginseng and bergamot, lavender, coriander seed).

Ingredients from Connaught Bar menu (https://dxp.maybourne.com/contentassets/e4e490b61c004cdfb9ba66cf2018e231/the-connaught-bar-menu-june-2026.pdf). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('connaughtbar', NULL, 'Kyuzu', 'Hibiki Harmony whisky with black yuzu cordial, Japanese rice orgeat and tonka bitters, served in a bespoke ceramic.', 'Inspired by the harmony of the Japanese tea ceremony, it is served in a vessel made for the bar by ceramicist Reino Kaneko; earthy, floral and citrus notes meet in a short whisky serve.

Ingredients from Connaught Bar menu (https://dxp.maybourne.com/contentassets/e4e490b61c004cdfb9ba66cf2018e231/the-connaught-bar-menu-june-2026.pdf). No measures have been published.', NULL, NULL, 'Ceramic', NULL, NULL),
    ('moebiusmilano', NULL, 'Pesto Martini', 'Vodka Martini seasoned with house-made pesto and white balsamic vinegar.', 'Moebius''s best-known drink and a 50 Best-named crowd favourite: a strong, dry, herbal Martini that tastes of Ligurian basil pesto, with white balsamic adding a gentle sour-sweet edge. It sums up the bar''s food-meets-cocktail style.

Ingredients from Moebius drink list (https://moebiusmilano.it/tapa-bistrot-drink-list/). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('moebiusmilano', NULL, 'Peach Vodka Soda', 'Light vodka highball with peach, basil and bubbles.', 'A pared-back, easy-drinking signature named by 50 Best as a crowd favourite; the fruit changes with the season (the 2026 list pours a Plum Vodka Soda with Belvedere, plum, basil and soda).

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/moebius-milano.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('moebiusmilano', NULL, 'Seed Negroni', 'Rich Negroni variation made with pumpkin seeds and cream.', 'Singled out by 50 Best as an indulgent signature: nutty pumpkin seed and cream soften the Negroni''s bitterness into something rounder and more dessert-like.

Sources: https://www.the50.com/bars/the-list/moebius-milano.html', 'Negroni', NULL, NULL, NULL, NULL),
    ('moebiusmilano', NULL, 'Winter Melon Negroni', 'Bulldog gin, Campari and Del Professore rosso vermouth with winter melon, balsamic vinegar and feta.', 'The current menu''s Negroni twist leans savoury: winter melon and feta bring a salty, fresh, almost salad-like note, with balsamic deepening the bitter-sweet backbone.

Ingredients from Moebius drink list (https://moebiusmilano.it/tapa-bistrot-drink-list/). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('moebiusmilano', NULL, 'Tzatziki Highball', 'Espolòn blanco tequila with yogurt, coconut water, cucumber and Aegean tonic, finished with dill oil.', 'A savoury, lactic highball that turns the Greek dip into a long drink: yogurt and cucumber for freshness and body, dill oil for aroma, lengthened with tonic.

Ingredients from Moebius drink list (https://moebiusmilano.it/tapa-bistrot-drink-list/). No measures have been published.', NULL, NULL, 'Highball', NULL, NULL),
    ('line.athens', NULL, 'Delusional Margarita', 'Reposado tequila Margarita twist made with mustard, ketchup, potato water and spices.', 'The drink 50 Best singles out at Line: a savoury, fast-food-inspired Margarita where condiments and potato water (a kitchen by-product) stand in for the usual sweet and sour, in keeping with the bar''s low-waste, kitchen-led approach.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/line.html). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('line.athens', NULL, 'Pomegranate Why-In', 'Line''s house-fermented pomegranate wine, made from nothing but fruit, yeast and time.', 'Why-ins are Line''s signature: grapeless ''wines'' fermented in house from Greek fruit with winemaker Thanos Georgilas, served straight (''classic'') or dressed up with distillates and aromatics (''fancy''). The pomegranate version, from Wonderful and Hermione pomegranates grown in Fthiotida, also feeds several of the bar''s cocktails.

Sources: https://lineathens.gr/wp-content/uploads/2024/01/new-menu-line-athens.pdf, https://www.the50.com/bars/the-list/line.html', NULL, 2022, NULL, NULL, NULL),
    ('line.athens', NULL, 'Leftover Spritz', 'Spritz of Line''s leftover spirit with Fokiano rosé wine, tomato, cardamom and elderflower.', 'Built on a spirit the bar makes from its own leftovers, it shows Line''s zero-waste thinking in its most approachable form: a light, savoury-floral aperitivo with tomato and cardamom.

Ingredients from Line menu (https://lineathens.gr/wp-content/uploads/2024/01/new-menu-line-athens.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('line.athens', NULL, 'Porn Star Spritz', 'Finlandia vodka with vanilla, brown butter, bitter and passion fruit, lengthened with Three Cents tonic.', 'Line''s long, bubbly reworking of the Porn Star Martini, with beurre noisette adding a nutty richness to the passion fruit and vanilla.

Ingredients from Line menu (https://lineathens.gr/wp-content/uploads/2024/01/new-menu-line-athens.pdf). No measures have been published.', 'Porn Star Martini', NULL, NULL, NULL, NULL),
    ('line.athens', NULL, 'Line''s Cobbler', 'Axia mastiha with Line''s Symposium vermouth, house grenadine and the classic pomegranate why-in.', 'A Greek-accented cobbler made almost entirely from Line''s own products (their fortified-wine vermouth, grenadine and pomegranate why-in), with mastiha bringing resinous Chios aromatics.

Ingredients from Line menu (https://lineathens.gr/wp-content/uploads/2024/01/new-menu-line-athens.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('jiggerandponysg', NULL, 'Red Revival', 'Beetroot-led drink layered with house-roasted smoky coffee, tequila and strawberry.', 'Highlighted by 50 Best from the EMBRACE menuzine: it makes beetroot, usually a supporting flavour, the star, with the bar roasting its own coffee to add smoke and depth against earthy beet and bright strawberry.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/jigger-pony.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('jiggerandponysg', NULL, 'Jigger & Pony Paloma', 'Aged, lightly smoky tequila with a house guava and pink grapefruit soda, served with a peeled grapefruit wedge.', 'A Paloma built on a house-made guava and pink grapefruit soda; guests pop the peeled grapefruit wedge into the drink themselves for a final burst of citrus, a small bit of the interactive hospitality the bar is known for.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/jigger-pony.html). No measures have been published.', 'Paloma', NULL, NULL, NULL, NULL),
    ('jiggerandponysg', NULL, 'White Toreador', 'Yoghurt fat-washed Código 1530 blanco tequila with Merlet apricot, lime and egg white.', 'A revival of the 1930s Toreador (a tequila-apricot sour that predates written Margarita recipes). First served in 2019 with freeze-dried yoghurt, it returned on the IDENTITY menu with the tequila fat-washed in Greek yoghurt for a creamy, velvety texture.

Method: Shaken.
Yoghurt tequila: Fat-wash blanco tequila with Greek yoghurt.

Ingredients from Jigger & Pony (https://www.jiggerandpony.com/jigger-pony-discovery/2024/1/8/white-toreador). No measures have been published.', NULL, 2019, NULL, NULL, 'Shake'),
    ('jiggerandponysg', NULL, 'Funky Panky', 'Stranger & Sons gin with Sarawak tuak rice wine, Cocchi Americano, agarwood and a house herbal amaro, garnished with chrysanthemum.', 'An Asian take on the Hanky Panky: tuak, a fortified glutinous rice wine made for the bar by a Singapore fermentation company, replaces vermouth, and a house amaro made from a Malaysian herbal tea stands in for Fernet.

Method: Stirred.

Ingredients from Jigger & Pony (https://www.jiggerandpony.com/jigger-pony-discovery/2024/1/8/funky-panky-stranger-and-sons). No measures have been published.', 'Hanky Panky', NULL, NULL, NULL, 'Stir'),
    ('jiggerandponysg', NULL, 'Ugly Tomatoes', 'Hapusa Himalayan gin with rescued heirloom beefsteak tomatoes, kümmel and Seedlip Spice, in a crumpled Kimura glass.', 'A sustainability drink using cosmetically rejected heirloom tomatoes from a Malaysian highland farm that would otherwise go to waste; caraway-rich kümmel gives it the seasoning of a tomato dish, and the deliberately crumpled glass echoes the ''ugly'' fruit.

Ingredients from Jigger & Pony (https://www.jiggerandpony.com/jigger-pony-discovery/2023/12/8/ugly-tomatoes-a-savoury-beauty-with-hapusa-himalayan-gin). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('3monosbar', NULL, 'Julep de D10S', 'Julep built on Tres Monos'' own Licor del Norte (three Argentine botanicals) with amari, strawberry miso and grapefruit.', 'The drink 50 Best names on the bar''s page, and a showcase for the house''s own-label liqueur made from native Argentine botanicals; strawberry miso adds an umami-fruit twist. The name plays on ''D10S'', Argentina''s nickname for Maradona.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/tres-monos.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('3monosbar', NULL, 'El Triple Tini', 'Low-ABV Bamboo-style drink of sake and dry vermouth with strawberry, orange and celery.', 'A light, dry, fruity-herbal aperitif that swaps the Bamboo''s sherry for sake (Tres Monos makes its own); 50 Best picked it for its list of 50 cocktails to try around the world.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/stories/News/50-incredible-cocktails-to-try-around-the-world.html). No measures have been published.', 'Bamboo', NULL, NULL, NULL, NULL),
    ('3monosbar', NULL, 'Misticollins', 'Collins-style highball of house sake and spirit with cucumber, olive brine and tonic.', 'A savoury take on the spirit-and-tonic highball that the team built around Peruvian Alfonso olives after tasting them in New York. The 2023 version paired Tres Monos'' own sake with London dry gin, aloe vera, cucumber and brine; Punch describes a mezcal or tequila version with Japanese cucumber.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/stories/News/tres-monos-buenos-aires-art-of-hospitality-worlds-50-best-bars-2023.html). No measures have been published.', NULL, NULL, 'Highball', NULL, NULL),
    ('3monosbar', NULL, 'Golden Curry', 'Clarified Japanese whisky drink with vanilla and curry spices.', 'Born from a collaboration with Buenos Aires restaurant Papa San, it borrows the curry from Papa San''s kitchen; the drink is clarified so it stays clear and silky despite the spice.

Method: Clarified.

Ingredients from Punch (https://punchdrink.com/articles/tres-monos-papa-san-cocktail-bar-collaboration/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('3monosbar', NULL, 'Fresco y Batata', 'Whisky drink with Parmesan, sweet potato jam and toasted walnuts.', 'A liquid version of ''queso y dulce'' (fresco y batata), the Argentine dessert of fresh cheese with sweet potato paste; a popular drink from the bar''s 2023 menu.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/stories/News/tres-monos-buenos-aires-art-of-hospitality-worlds-50-best-bars-2023.html). No measures have been published.', NULL, 2023, NULL, NULL, NULL),
    ('alquimicocartagena', NULL, 'Petronio', 'Tequila, viche (Pacific-coast sugarcane spirit), lulo purée and lime; some versions add vanilla and orange.', 'Jean Trinh calls it the one drink that sums up Alquímico. It is named for the Petronio Álvarez festival of Afro-Colombian music, and its viche, historically made by Afro-descendant women on the Pacific coast, carries that story into a bright, sour drink built for Caribbean heat.

Created by Jean Trinh.

Ingredients from Alquímico menu (https://alquimico.com/en/from-the-house/). No measures have been published.', NULL, NULL, 'Rocks', NULL, NULL),
    ('alquimicocartagena', NULL, 'Mango', 'Patrón Reposado with house mango vermouth, palm wine and hops, served in a Nick & Nora.', 'The drink The World''s 50 Best Bars tells you to order if you try only one. It opens the 2026 ''Comunidad'' menu, whose sales fund a school and infrastructure for the ASOCOMAN farmers'' association in the Montes de María, a grower known for dozens of mango varieties.

Ingredients from Alquímico menu (https://alquimico.com/menumovil01/). No measures have been published.', NULL, 2025, 'Nick & Nora', NULL, NULL),
    ('alquimicocartagena', NULL, 'Selva Martini', 'A martini of house ''jungle vermouth'' made from native Colombian herbs, finished with a touch of mambe (toasted coca leaf) oil.', 'Beverage director Mélany Marcati built it to evoke the Colombian rainforest, with the mambe oil a tribute to the ancestral rituals of Indigenous communities. It sits on the house best-seller list.

Ingredients from Alquímico menu (https://alquimico.com/en/from-the-house/). No measures have been published.', 'Martini', NULL, 'Coupette', NULL, NULL),
    ('alquimicocartagena', NULL, 'Alquímico Negroni', 'Alquímico''s take on the Negroni with gin, mead, Campari, blackberry, limoncello and wormwood.', 'The first-floor bar reinterprets classics through Colombian ingredients, and this Negroni brings in mead, a house speciality whose honey comes from the bees on Alquímico''s own farm.

Ingredients from 50 Best (https://www.the50.com/stories/News/alquimico-michters-art-of-hospitality-award-2026.html). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('alquimicocartagena', NULL, 'Salitre', 'Ginger-infused rum shaken with muddled lime and sugar, served in a glass rimmed with rose salt.', 'One of Alquímico''s early house signatures, showing the bar''s habit of infusing its own spirits, and a recipe the bar shared with a local guide in 2017. The current best seller Inquisición uses a similar build of ginger rum, lime and a seasoned salt.

Method: Shake lime and sugar together, add the ginger rum and ice and shake. Rub the glass rim with lime, dip in rose salt, and pour the drink in.

Spec from This Is Cartagena (2017) (http://web.archive.org/web/20201129020223/https://cartagena.welcometotheneighbourhood.net/542-2/).', NULL, NULL, NULL, NULL, 'Shake'),
    ('superbuenonyc', NULL, 'Green Mango Martini', 'Tequila infused with unripe green mango, stirred with Sauternes, mango eau de vie and honey, finished with a drop of costeño chile oil.', 'The bar''s cult bestseller, built to prove a tequila martini can work; Jimenez went through 50 iterations. It channels the green mango with chile sold by vendors on New York subway platforms, layering mango as an infusion and a distillate, with chile oil added tableside in place of Tajín. The bar has since added a touch of mango vinegar, which the published spec predates.

Created by Ignacio ''Nacho'' Jimenez in 2023.

Method: Stir all ingredients with ice in a mixing glass until cold, then strain.
Green mango-infused tequila: Infuse 350 g peeled, chopped green mango in 1 liter blanco tequila overnight, up to 24 hours, then strain and bottle.
Costeño chile oil: Steep 70 g chopped costeño chiles in 1 liter extra-virgin olive oil for 3 to 4 weeks (or warm gently for an hour and cool), strain into a dropper bottle.

Spec from PUNCH (https://punchdrink.com/recipes/green-mango-martini/).', 'Martini', 2023, 'Nick & Nora', NULL, 'Stir'),
    ('superbuenonyc', NULL, 'Vodka y Soda', 'Grey Goose infused with pasilla and guajillo chiles, Velvet Falernum and a clarified guava soda, force-carbonated with a guava salt rim.', 'Jimenez turned the most basic call drink into the bar''s top seller (around 2,500 a month), inspired by the guava Boing! soda he grew up on. Guava purée is clarified with pectinase and agar, re-acidified into a cordial and the whole drink is carbonated in batches.

Created by Ignacio ''Nacho'' Jimenez in 2023.

Method: Half-rim a highball with guava salt. Combine the ingredients, carbonate, and pour into the glass.
Clarified guava cordial: Rest guava purée with pectinase, add water and bring to a boil, dissolve agar-agar, let it set, then strain through a coffee filter. Acidify the clear liquid with tartaric and malic acids and sweeten with sugar.
Guava salt: Mix Maldon salt with guava purée and dry it in a low oven.

Spec from The Spirits Business (https://www.thespiritsbusiness.com/2024/11/cocktail-stories-vodka-y-soda-superbueno/).', NULL, 2023, 'Highball', NULL, 'Build'),
    ('superbuenonyc', NULL, 'Mushroom Margarita', 'Mezcal infused with huitlacoche (corn smut), orange liqueur, lime and a lava salt rim.', 'Built around huitlacoche, the prized pre-Hispanic corn fungus, steeped unstrained in mezcal for 24 hours to keep its texture. The original spec came from molecular mixology pioneer Eben Freeman and Jimenez kept it unchanged.

Created by Eben Freeman.

Ingredients from Resy (https://blog.resy.com/2025/08/superbueno-nyc-best-cocktails/). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('superbuenonyc', NULL, 'Roasted Corn Sour', 'Mexican corn whiskey and reposado tequila with roasted corn and guajillo syrup, lemon and egg white, garnished with charred corn husk.', 'A whiskey sour that celebrates corn as the root of Mexican cuisine. Charred kernels sit for a day with brown sugar, guajillo and epazote, and a tea made from the cobs becomes a rich roasted-corn syrup, so no part of the corn goes to waste.

Created by Ignacio ''Nacho'' Jimenez.

Roasted corn syrup: Char corn, rest the kernels 24 hours with brown sugar, guajillo, epazote and spices; brew a tea from the cobs and combine with sugar at 2:1.

Ingredients from Superbueno menu (https://www.superbuenonyc.com/menu). No measures have been published.', 'Whiskey Sour', NULL, NULL, NULL, NULL),
    ('superbuenonyc', NULL, 'Mole Negroni', 'Mezcal fat-washed with mole, a blend of amari, sweet vermouth and xocolatl bitters.', 'Singled out by The World''s 50 Best Bars as a marquee drink. Fat-washing the mezcal with mole spices gives the bittersweet classic an earthy, chocolate-and-chile depth.

Ingredients from Superbueno menu (https://www.superbuenonyc.com/menu). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('ladybee.lima', NULL, 'Three Sips Martini', 'A botanical Peruvian dry martini with sherry and extra-dry vermouth, served with an olive, sea lettuce and Puno trout caviar on a three-bowl spoon.', 'The bar''s best-known serve, built as three sips paired with three bites. Chef Gabriela León designed the ''Tres Tiempos'' spoon, carved from Amazon wood felled by storms, to hold an Arequipa olive, Ica seaweed and Arapa trout caviar.

Created by Alonso Palomino.

Ingredients from The Spirits Business (https://www.thespiritsbusiness.com/2025/01/cocktail-chat-limas-lady-bee/). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('ladybee.lima', NULL, 'Oca Mashua', 'A dry, earthy drink on a red oca distillate from Cusco, coloured with mashua and topped with slices of both Andean tubers.', 'A customer favourite from the Tubers section that puts Andean root crops in the glass. The base is a red oca spirit made by Manuel Choqque in Huatata, Cusco, and slices of oca and mashua sit on the ice as edible accents. The same pickled tubers turn up on the food menu, and an earlier version, Oca/Olluco, used olluco tubers and potato pickles.

Created by Alonso Palomino.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/stories/News/the-buzz-about-limas-lady-bee.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('ladybee.lima', NULL, 'Bee''s Knees (Amazon twist)', 'The classic gin, honey and citrus sour with an Amazon twist: mandarin-lime and honey from stingless ''abeja señorita'' bees.', 'Half of the bar''s name and a permanent fixture on the list. The honey comes from the native stingless bee that the bar is named after, one of the first products it received from its Amazon producer communities.

Created by Alonso Palomino in 2021.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/best-in-the-world/the-list/lady-bee.html). No measures have been published.', 'Bee''s Knees', 2021, NULL, NULL, NULL),
    ('ladybee.lima', NULL, 'Bloody Mary', 'Lady Bee''s Bloody Mary, topped with a fresh scallop from Ica.', 'A showcase of the bar''s producer network: the scallops come via marine biologist Pamela Lazarte, who works with artisanal fishermen on the Peruvian coast, and the same scallops appear in a dish from chef Gabriela León.

Ingredients from 50 Best (https://www.the50.com/stories/News/lady-bee-lima-art-of-hospitality-the-worlds-50-best-bars-2025.html). No measures have been published.', 'Bloody Mary', NULL, NULL, NULL, NULL),
    ('ladybee.lima', NULL, 'Acholado Cacaotal', 'The house acholado pisco blended with a mix of Peruvian chocolates.', 'Pairs the bar''s own acholado pisco blend with Peruvian cacao, in line with the menu''s focus on Peruvian distillates and chocolate. Alquímico bartender Miguel Angel Mora named it the best cocktail he drank in 2024.

Ingredients from 50 Best (https://www.the50.com/stories/News/what-bartenders-really-drink.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('himkok.oslo', NULL, 'Birch', 'A dry martini twist on Himkok''s own Old Tom gin with meadowsweet and a birch sap syrup, served with a blue cheese olive.', 'Himkok''s answer to the martini and, per The World''s 50 Best Bars, a modern cocktail icon and must-try. It uses Old Tom gin from the bar''s own micro-distillery with syrup made from native birch and meadowsweet.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/best-in-the-world/the-list/himkok.html). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('himkok.oslo', NULL, 'Beetroot (Reindeer Moss Martini)', 'An earthy, mezcal-based martini built on beetroot.', 'One of the house classics Himkok keeps on its list across menu changes, pairing smoky mezcal with Nordic beetroot for an adventurous take on the martini.

Ingredients from Europe''s 50 Best Bars (https://www.the50.com/bars/best-in-europe/the-list/himkok.html). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('himkok.oslo', NULL, 'Softis', 'A soft-serve-inspired dessert drink of Himkok x Linie aquavit with Diplom-Is ice cream, amaretto, white cacao and fino sherry.', 'Modelled on the Norwegian soft-serve cone. On the 2025 ''Designed by Sipping'' menu each drink was turned into a design object by Studio Sløyd, and Softis became a sculptural clock evoking melting ice cream.

Created by Paul Aguilar and Maroš Dzurus in 2025.

Ingredients from The Spirits Business (https://www.thespiritsbusiness.com/2025/09/himkok-menu-imagines-cocktail-as-a-lamp/). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('himkok.oslo', NULL, 'Cherry', 'A Manhattan riff of Buffalo Trace, Merlet cherry liqueur, Carpano Dry and dark chocolate with a butter-washed finish.', 'From the 2025 design-led menu, where it was reimagined as a moody floor lamp. Butter-washing and dark chocolate give the classic a rich, rounded texture.

Created by Paul Aguilar and Maroš Dzurus in 2025.

Ingredients from The Spirits Business (https://www.thespiritsbusiness.com/2025/09/himkok-menu-imagines-cocktail-as-a-lamp/). No measures have been published.', 'Manhattan', 2025, NULL, NULL, NULL),
    ('himkok.oslo', NULL, 'Parsnip', 'Buffalo Trace bourbon with a parsnip maple syrup and Angostura cocoa bitters.', 'From the 2023 menu, an Old Fashioned-style drink that turns a humble Nordic root vegetable into a syrup, in keeping with the bar''s one-ingredient-per-drink menus.

Ingredients from Drinks International (https://drinksint.com/menu-of-the-month-himkok/). No measures have been published.', 'Old Fashioned', 2023, NULL, NULL, NULL),
    ('bar.us.bkk', NULL, 'Pad Thai', 'Chilli-oil fat-washed vodka with a leek distillate, red shallot, tamarind, coconut, sugarcane and nut syrup, garnished with a burnt pickled onion.', 'A signature of the bar''s savoury style, turning Thailand''s best-known noodle dish into a stirred drink. Leek is redistilled to capture its aroma without its vegetal taste, and the vodka is fat-washed with a chilli oil made from dried red chilli and shallot.

Method: Stir all ingredients and serve over a large ice cube.
Leek distillate: Redistil leek to get a strong leek aroma with little flavour.
Chilli oil fat-wash: Make a chilli oil from dried red chilli and red shallot and use it to fat-wash the vodka.

Ingredients from Drinks International (https://drinksint.com/menu-of-the-month-bar-us/). No measures have been published.', NULL, 2025, 'Rocks', 'Large Cube', 'Stir'),
    ('bar.us.bkk', NULL, 'Beef + Onion', 'Beef jerky-infused Ketel One with chilli oil, red onion, ginger, makrut lime, cucumber and pickled ginger powder.', 'An established fan favourite and the centrepiece ''main'' of the savoury section, with beef-jerky vodka, chilli oil and raw onion. 50 Best cites it alongside pad Thai as the kind of savoury flavour the bar is known for.

Ingredients from Bar Us menu (https://www.us-bar.com/menus). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bar.us.bkk', NULL, 'Coriander + Cucumber + Roasted Rice', 'Coriander distillate with Hendrick''s gin, green apple, cucumber and green olive under a roasted rice foam.', 'The starter 50 Best names as the bar''s favourite opening drink: a light, green serve that redistils coriander for a clean herb aroma and tops it with a toasty foam of roasted rice, a staple Thai seasoning.

Ingredients from Bar Us menu (https://www.us-bar.com/menus). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bar.us.bkk', NULL, 'Black Sesame + Cheese + Almond', 'Jameson Black Barrel with black sesame, cream cheese, liquid yoghurt and almond, finished with Parmesan dust.', 'The bar''s take on a cheese course, the closing ''After'' drink 50 Best recommends to end the menu''s three-course journey.

Ingredients from Bar Us menu (https://www.us-bar.com/menus). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bar.us.bkk', NULL, 'Satay', 'A masala-spice vodka distillate fat-washed with Thai chilli oil, stirred with pickled ginger brine, macadamia syrup, red shallot and cucumber salt solution.', 'Rebuilds Bangkok''s grilled-skewer street snack, with the brine, shallot and cucumber echoing satay''s usual sides. The coupe is dotted with chilli oil at the table.

Method: Stirred.

Ingredients from 50 Best (https://www.the50.com/stories/News/asias-culinary-cocktails.html). No measures have been published.', NULL, 2024, 'Coupette', NULL, 'Stir'),
    ('zest.seoul', NULL, 'Jeju Garibaldi', 'Zest''s take on the Garibaldi, made with the fluffy fresh juice of Jeju hallabong citrus and carrots from Gujwa village.', 'Zest''s best-known example of whole-ingredient use: hallabong citrus and Jeju carrots are juiced for the drink, the peels are redistilled into one of the four seasonal house gins, and the leftover pulp becomes a cordial or the bar''s pulp sauerkraut.

Ingredients from Asia''s 50 Best Bars (https://www.theworlds50best.com/bars/asia/the-list/zest.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('zest.seoul', NULL, 'Oh My Gibson', 'A Gibson riff of citrus-cardamom gin and Italian vermouth with omegi sour yakju and seasonal pickles.', 'Swaps the Gibson''s cocktail onion for seasonal pickles and gets its texture and acidity from omegi, an artisanal sour yakju (clear rice brew), part of the bar''s push to show off small Korean producers. Spelled ''Oh. My. G!bson'' on the 50 Best list page.

Ingredients from Asia''s 50 Best Bars (https://www.theworlds50best.com/bars/asia/the-list/zest.html). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('zest.seoul', NULL, 'Z&T', 'Zest''s gin and tonic, made with a seasonal house gin and a tonic produced in-house.', 'One of the bar''s signature serves. All of Zest''s tonics, colas and sodas are made in-house and poured from reusable bottles, so no cans or plastic bottles end up in the bin.

Ingredients from 50 Best (https://www.the50.com/stories/News/zest-seoul-asia-bars-highest-climber-2023.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('zest.seoul', NULL, 'Nutty & Bitter', 'A Negroni riff built on millet soju, garnished with a jelly made from leftover Champagne and house citrus stock.', 'Shows the bar''s zero-waste habit: flat Champagne left over from French 75s is cooked with citrus stock into the jelly garnish, while the base swaps gin for a Korean millet soju.

Champagne citrus jelly: Cook leftover Champagne with homemade citrus stock and set it as a jelly.

Ingredients from 50 Best (https://www.the50.com/stories/News/zest-highest-new-entry-worlds-50-best-bars-2023.html). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('barnouveau', NULL, 'Ramos', 'Bar Nouveau''s blender-made Ramos with vanilla yoghurt, a touch of peat and St-Germain, served with an oyster-shell spoon.', 'The bar''s most talked-about drink, with a loyal following; the hum of the blender making it is part of the room''s soundtrack. Yoghurt stands in for the classic''s cream and egg white, and a peaty note adds depth.

Method: Blended.

Ingredients from 50 Best Discovery (https://www.theworlds50best.com/discovery/Establishments/France/Paris/Bar-Nouveau.html). No measures have been published.', 'Ramos Gin Fizz', 2023, NULL, NULL, 'Blitz'),
    ('barnouveau', NULL, 'Fine à l''Eau', 'The old French bistro serve of cognac and water, rounded out with sugar and verjus.', 'A typical Bar Nouveau move: reviving a half-forgotten French bistro classic with a minimal, precise touch rather than a list of new ingredients.

Ingredients from 52 Martinis (https://52martinis.com/bar-nouveau/). No measures have been published.', NULL, 2023, NULL, NULL, NULL),
    ('benfiddich_tokyo', NULL, 'Farm Julep', 'A julep of farm-grown fennel and intensely aromatic mint, sipped through a century-old pewter straw.', 'Shows Kayama''s farm-to-glass style: the herbs come from his family land in Chichibu, north-west of Tokyo, and the antique pewter straw is part of the bar''s apothecary-like ritual.

Created by Hiroyasu Kayama.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/best-in-the-world/the-list/bar-benfiddich.html). No measures have been published.', 'Mint Julep', NULL, NULL, NULL, NULL),
    ('benfiddich_tokyo', NULL, 'Hot Buttered Roku', 'Roku gin, Japanese pear purée, yuzu juice, butter and syrup, heated and emulsified by plunging a red-hot metal brazier into the drink.', 'A winter drink in Kayama''s apothecary style: instead of a kettle, a superheated iron is plunged into the glass, emulsifying the butter and lifting the yuzu aromas. Created for a Roku Gin seasonal series featuring 50 Best bars.

Created by Hiroyasu Kayama in 2022.

Method: Stir the ingredients together, then heat by plunging in a red-hot metal brazier.

Spec from 50 Best (Roku Gin partner feature) (https://www.the50.com/stories/News/roku-seasonal-cocktails.html).', NULL, 2022, NULL, NULL, 'Stir'),
    ('benfiddich_tokyo', NULL, 'House Absinthe', 'Absinthe distilled by Kayama from wormwood and botanicals he grows and dries on his family farm.', 'Asia''s 50 Best calls the house absinthe a must. Kayama grows the wormwood himself, distils it into absinthe and green herbal liqueurs, and absinthe drippers of honey water hang above the walnut counter for his drinks.

Created by Hiroyasu Kayama.

Ingredients from Asia''s 50 Best Bars (https://www.theworlds50best.com/bars/asia/the-list/bar-benfiddich.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('caretakers.cottage', NULL, 'House Martini', 'A very cold gin martini poured straight from the freezer, made with a gin produced for the bar.', 'The bar''s signature and a fixture on lists of Australia''s best cocktails. Regulars pair it with a pint of Guinness as what 50 Best calls the country''s best boilermaker, and it travelled to sister bar Three Horses with an optional splash of fino sherry.

Created by Matt Stirling, Ryan Noreiks and Rob Libecans in 2022.

Method: Pre-batched and served from the freezer.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/best-in-the-world/the-list/caretakers-cottage.html). No measures have been published.', 'Martini', 2022, NULL, NULL, 'Build'),
    ('caretakers.cottage', NULL, 'The Snail & The Whale', 'Hendrick''s Flora Adora gin shaken with blueberry wine, Amaro Montenegro and blood orange, served in a whale-like porcelain cup with a snail-shell garnish.', 'Rob Libecans named it after a children''s picture book he reads to his kids, for the travel-themed October 2023 menu he wrote with Kitty Gardner. The pollinator-inspired gin and the snail shell garnish tie the drink to the story.

Created by Rob Libecans and Kitty Gardner in 2023.

Method: Shake.

Ingredients from Australian Bartender (https://australianbartender.com.au/2023/11/30/creativity-cocktails-caretakers-cottage-how-to-interweave-a-story-through-cocktails-featuring-hendricks-flora-adora/). No measures have been published.', NULL, 2023, 'Custom', NULL, 'Shake'),
    ('thecambridge_paris', NULL, 'Pimm''s', 'The pub''s ever-changing house Pimm''s; the 2025 version pairs gin with Alsatian wine and St-Germain.', 'A menu evergreen since the bar''s first year (Pimm''s 2.0 was on the 2019 list, served without the usual fruit salad to cut waste), reworked seasonally ever since. Later versions: Pimm''s 4.0 (2022) with Pimm''s, Americano, verjus, clarified lemon and orange wine; a fizzy Pimm''s with Cocchi Americano, rosé and Hendrick''s (2024); Pimms 6.0 with vermouth, rosé, gin and bitters.

Created by Hyacinthe Lescoët in 2019.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/best-in-the-world/the-list/the-cambridge-public-house.html). No measures have been published.', NULL, 2019, NULL, NULL, NULL),
    ('thecambridge_paris', NULL, 'Cigarette After Sex', 'A smoky mix of mezcal, sloe gin and agua de jamaica (hibiscus).', 'Named by The World''s 50 Best Bars as a standard that has been on the list since the bar opened in 2019. Mezcal smoke and tart hibiscus give it its cheeky, after-hours character.

Ingredients from 50 Best (https://www.the50.com/stories/News/the-cambridge-public-house-highest-climber-the-worlds-50-best-bars-2024.html). No measures have been published.', NULL, 2019, NULL, NULL, NULL),
    ('thecambridge_paris', NULL, 'Akira Kira', 'Sencha-infused vodka, galangal-infused Lillet Blanc, clarified Corsican grapefruit cordial and verjus, stirred and served up.', 'A low-waste spring drink built around Corsican grapefruit, published with a full spec by the bar''s own sustainability platform. The infusions are cooked sous vide and the card even records the waste per drink: about 2.9 g of tea, galangal and grapefruit.

Method: Stir with ice and strain.
Sencha vodka: Vacuum-seal 4 L vodka with 46 g sencha green tea and cook at 65°C for 1 hour; cool and strain through cloth the same day.
Galangal Lillet Blanc: Vacuum-seal 2 L Lillet Blanc with 100 g dried galangal root and cook at 70°C for 3 hours; cool and strain the same day.
Clarified grapefruit cordial: Stir 400 g sugar and 10 g malic acid into 1 L clarified grapefruit juice until dissolved; refrigerate.

Spec from Shaken Leaf (The Cambridge Public House) (https://lh3.googleusercontent.com/d/1MuEbx-jAebzAeo9J3gCjHVedh5WeM4l3).', NULL, NULL, 'Coupette', NULL, 'Stir'),
    ('thecambridge_paris', NULL, 'Arty Shock', 'Fords Gin and Select bitter topped up with the water purple artichokes were cooked in, carbonated and served in a flute.', 'A zero-waste highball that turns artichoke cooking water into the main mixer. The leaves become the garnish and the hearts a compote served with cheese, so the card lists zero grams of waste.

Method: Carbonate.
Artichoke water: Simmer 30 purple artichokes in 3 L water with lemon zest, sage, bay leaf and thyme for an hour to reduce, strain, then add sugar (10% of the liquid) and malic acid (about 3.6 g per 1.4 L).

Spec from Shaken Leaf (The Cambridge Public House) (https://drive.google.com/uc?export=view&id=1XXNh3NArTnpH2hQoxMvprsVi3f5xaUMH).', NULL, NULL, 'Flute', NULL, 'Build'),
    ('thecambridge_paris', NULL, 'Daylight & Darkness', 'Avallen Calvados with an eggplant and black garlic cordial, Dolin Blanc and Dry, roasted sweet potato shochu and verjus, garnished with an eggplant-skin chip.', 'A savoury stirred drink that uses the whole aubergine: the roasted flesh becomes a black garlic cordial and the skin is dried into the garnish. It is one of the most up-voted cocktails in the bar''s public recipe database.

Method: Stir with ice and strain.
Eggplant and black garlic syrup: Roast halved eggplants at 180°C for 30 minutes, scoop the flesh (keep the skins), then vacuum-seal 1 kg flesh with 1 L 50% sugar syrup, 10 g salt, 20 g black garlic and 10 g malic acid; run through three glass-washer cycles to heat, then strain through cloth.

Spec from Shaken Leaf (The Cambridge Public House) (https://drive.google.com/uc?export=view&id=1TlW3UaRPlf6xoDE8Qq_pBcFxFZmABhc8).', NULL, NULL, 'Ceramic', NULL, 'Stir'),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 'Gin, fresh orange and lemon juice, Grand Marnier, dry vermouth and Punt e Mes, shaken with an orange slice and served up.', 'The bar is named after this Savoy Cocktail Book drink, and Armstrong rebuilt the old formula into the house signature. He swaps sweet vermouth for Punt e Mes, adds lemon and a little sugar for freshness, and shakes a whole orange slice in the tin for peel oils. He insists on fresh-squeezed orange juice and a short, cold shake.

Created by Kevin Armstrong in 2013.

Method: Add everything, including the orange slice, to a shaker with ice. Shake hard but briefly to limit dilution, then double-strain.

Spec from PUNCH (https://punchdrink.com/recipes/kevin-armstrongs-satans-whiskers/).', NULL, 2013, 'Coupette', NULL, 'Shake'),
    ('satans_whiskers', NULL, 'East 8 Hold-Up', 'Vodka, Aperol, fresh pineapple, lime and passion fruit syrup, shaken and served over ice.', 'A modern classic Armstrong wrote at Milk & Honey London to give the menu a good vodka drink, built around freshly prepared pineapple juice at a time few London bars bothered. It is named for a friend''s comic mugging in the E8 postcode, has spread to bars worldwide, and is a Satan''s Whiskers staple.

Created by Kevin Armstrong in 2006.

Method: Shake with ice and strain into an ice-filled glass.

Spec adapted from Difford''s Guide (https://www.diffordsguide.com/cocktails/recipe/3519/east-8-hold-up-cocktail).', NULL, 2006, 'Rocks', 'Cubes', 'Shake'),
    ('satans_whiskers', NULL, 'Satan''s Manhattan', 'The house take on the Manhattan: whiskey, sweet vermouth and bitters, stirred and served up.', '50 Best singles out the bar''s Manhattan as one of the best versions going. It shows the bar''s whole approach: classics made to order, never batched, with tested house specs.

Sources: https://www.theworlds50best.com/bars/the-list/satans-whiskers.html', 'Manhattan', NULL, NULL, NULL, NULL),
    ('satans_whiskers', NULL, 'Miami Vice', 'A strawberry Daiquiri and a Piña Colada swirled together in one glass.', 'A deliberately playful, retro drink that the bar executes with total seriousness. 50 Best calls out its pastel swirl as a house highlight.

Sources: https://www.theworlds50best.com/bars/the-list/satans-whiskers.html', 'Piña Colada', NULL, NULL, NULL, NULL),
    ('localefirenze', NULL, 'Foglia', 'A gin sour lifted with mint, basil and hemp.', '50 Best names it as one of the house signatures of the 2025 list. It takes the familiar gin sour shape and pushes it into green, herbal territory with hemp alongside garden herbs, in line with the bar''s seasonal, low-waste approach.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/the-list/locale-firenze.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('localefirenze', NULL, 'Locale Manhattan', 'A Manhattan that uses marsala in place of vermouth, backed by kombucha and cold-brew coffee.', 'The drink keeps the Manhattan''s structure but swaps the vermouth for Sicilian marsala, an Italian fortified wine, and adds kombucha and cold brew for depth. 50 Best and EP Club both single it out from the current list.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/the-list/locale-firenze.html). No measures have been published.', 'Manhattan', NULL, NULL, NULL, NULL),
    ('localefirenze', NULL, 'Green Fizz', 'A fizz built on butter and sage, the classic Italian kitchen pairing.', 'It turns burro e salvia, one of the most familiar flavour pairings in Italian cooking, into a long bar drink. The kitchen-to-glass idea reflects Locale''s close bar and kitchen collaboration.

Sources: https://www.theworlds50best.com/bars/the-list/locale-firenze.html, https://www.enprimeurclub.com/bars/locale-firenze', NULL, NULL, NULL, NULL, NULL),
    ('localefirenze', NULL, 'Seasonal Margarita', 'Tequila, acidified celery extract, chestnut honey and Carandini white sweet vinegar, shaken and served with a salt rim.', 'Fabio Fanni replaces lime with an acidified celery extract and a sweet white vinegar, so the sourness comes without citrus, in keeping with the bar''s low-waste thinking. Chestnut honey gives a Tuscan, earthy sweetness.

Created by Fabio Fanni in 2024.

Ingredients from Appetito (https://appetitomagazine.com/recipes/cocktails/how-a-legendary-florence-cocktail-bar-uses-carandini-vinegar). No measures have been published.', 'Margarita', 2024, 'Martini', NULL, NULL),
    ('localefirenze', NULL, 'Api del Giambologna', 'Aged rum with a grilled-pineapple tiki sauce, fermented pineapple skin, nettle-orange liqueur and bee pollen foam.', 'A former signature from Matteo Di Ienno''s era, built around his interest in fermentation: pineapple skins that would otherwise be thrown away are fermented with Jamaican pepper. The name nods to Giambologna, the Renaissance sculptor of Florence, in keeping with the bar''s history-led menus.

Created by Matteo Di Ienno in 2019.

Spec from Le Cocktail Connoisseur (https://lecocktailconnoisseur.com/2019/06/13/matteo-di-ienno-locale-florence/).', NULL, 2019, NULL, NULL, NULL),
    ('tlecan', NULL, 'Paloma Blanca', 'Mezcal with clarified, carbonated grapefruit juice, lime and Colima salt.', 'The bar''s best-known drink: grapefruit juice is clarified and then carbonated, so the Paloma arrives crystal clear and sparkling while still tasting like the classic. 50 Best and North America''s 50 Best both lead with it.

Spec from Tlecān menu (https://tlecan.com/cocteleria.pdf).', 'Paloma', NULL, NULL, NULL, NULL),
    ('tlecan', NULL, 'Pulque Colada', 'Fresh pulque with pineapple milk punch, coconut water and coconut-oil-washed espadín mezcal.', 'A Piña Colada rebuilt around pulque, the ancient fermented agave sap, brought in fresh from Hidalgo. The coconut comes from a coconut-oil fat wash on the mezcal and coconut water, and the pineapple from a clarified milk punch, so the drink is light rather than creamy.

Spec from Tlecān menu (https://tlecan.com/cocteleria.pdf).', 'Piña Colada', NULL, NULL, NULL, NULL),
    ('tlecan', NULL, 'Tascalate Sour', 'Mezcal sour flavoured with tascalate: toasted corn, fermented cacao, cinnamon and achiote, with lemon and syrup.', 'Eli Martínez Bello turned tascalate, a centuries-old Maya drink from Chiapas, into a mezcal sour, sourcing the tascalate from Chiapas artisans. PUNCH profiled it as a way of telling generations of Mexican drinking history in one glass.

Created by Eli Martínez Bello.

Spec from Tlecān menu (https://tlecan.com/cocteleria.pdf).', NULL, NULL, 'Coupette', NULL, NULL),
    ('tlecan', NULL, 'Oceloyotl', 'A carajillo of anise-, cinnamon- and clove-infused espadín, corn liqueur, Puebla espresso and piloncillo syrup.', 'The bar''s take on the Veracruz-style carajillo: instead of a Spanish liqueur, the sweetness and spice come from spiced mezcal, corn liqueur and unrefined piloncillo sugar, with coffee roasted in Puebla.

Spec from Tlecān menu (https://tlecan.com/cocteleria.pdf).', NULL, NULL, NULL, NULL, NULL),
    ('tlecan', NULL, 'Martini Papantla', 'Equal parts mezcal and vanilla-infused dry vermouth.', 'A 50/50 mezcal Martini named for Papantla, the Veracruz town that is the historic home of vanilla, which is infused into the vermouth. It is one of the few drinks on the menu with a full published spec.

Spec from Tlecān menu (https://tlecan.com/cocteleria.pdf).', 'Martini', NULL, NULL, NULL, NULL),
    ('tantannb', NULL, 'Dirty Collins', 'White cachaça and tequila with olive and Tahiti lime, lengthened with a house olive soda.', 'The bar''s long-running original: it began as a Dirty Martini stretched into a Collins, and the team kept refining it, first clarifying the olive syrup and then turning it into a carbonated olive soda. The cachaça base is the nod to Brazil, and 50 Best names it among the drinks to order.

Created by Caio Carvalhaes.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/the-list/tan-tan.html). No measures have been published.', 'Tom Collins', NULL, NULL, NULL, NULL),
    ('tantannb', NULL, 'Curupira', 'Tanqueray gin with cambuci sparkling wine, mint cordial and cumaru, the Brazilian ''vanilla'' seed.', 'It shares its name with the forest guardian of Brazilian folklore and is built on native flavours: tart cambuci fruit and cumaru (Brazilian tonka), balanced against mint. EP Club calls it a house signature for its sweet and sour balance.

Created by Caio Carvalhaes in 2024.

Ingredients from CNN Brasil (https://www.cnnbrasil.com.br/viagemegastronomia/gastronomia/tan-tan-eleito-o-melhor-bar-do-brasil-esta-com-cara-e-menu-repaginados/). No measures have been published.', NULL, 2024, NULL, NULL, NULL),
    ('tantannb', NULL, 'Tsukemono', 'Don Julio Blanco tequila with wasabi, cucumber cordial and orange bitters.', 'Named for Japanese pickles, it sums up the bar''s Japanese-through-a-Brazilian-lens idea. The drink is designed to change as the ice melts, with the wasabi heat and cucumber freshness shifting in the glass.

Created by Caio Carvalhaes in 2024.

Ingredients from CNN Brasil (https://www.cnnbrasil.com.br/viagemegastronomia/gastronomia/tan-tan-eleito-o-melhor-bar-do-brasil-esta-com-cara-e-menu-repaginados/). No measures have been published.', NULL, 2024, NULL, NULL, NULL),
    ('tantannb', NULL, 'Libertine', 'Cachaça with yuzu, grape leaf, Drambuie and jabuticaba vermouth.', 'From the 2025 Pour-Hibition menu, which uses the American Prohibition era as a frame. Jabuticaba, a Brazilian berry with grape and plum notes, is made into a vermouth and set against Japanese yuzu so the contrasting flavours play off each other.

Created by Caio Carvalhaes in 2025.

Ingredients from 7 Caníbales (https://www.7canibales.com/comer-y-beber/tan-tan-sao-paulo/). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('tantannb', NULL, 'Hedonism', 'A low-ABV mango drink with Ketel One vodka, fino sherry, awamori and dry vermouth.', 'Around 13% ABV, it reflects the Pour-Hibition menu''s push toward lighter drinking without losing complexity. Mango leads, with Okinawan awamori and fino adding savoury depth.

Created by Caio Carvalhaes in 2025.

Ingredients from 7 Caníbales (https://www.7canibales.com/comer-y-beber/tan-tan-sao-paulo/). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('mirrorbarcarlton', NULL, 'Lantern of Infinity', 'Diplomático rum with clarified goji and rosehip juice, red miso butter caramel and rice milk.', 'The Design-section showpiece: it is served inside a glowing mirrored cube (a tesseract) whose reflections multiply the glass into infinity. The drink itself is umami and silky, using clarified juice with miso caramel and rice milk. 50 Best highlights it as a signature.

Ingredients from Mirror Bar menu (https://www.mirrorbarcarlton.com/s/Mirror-Menu-3Q-2026.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('mirrorbarcarlton', NULL, 'Lux', 'Tanqueray No. 10 gin with passion fruit, Paragon Rue Berry, Tío Pepe fino and prosecco.', 'Themed on light as the origin of life, it is served beneath a living bonsai from the bar''s botanical lab. A fruity, sparkling gin drink that has carried over into the menu''s Highlights of past favourites, and even has a non-alcoholic version.

Ingredients from Mirror Bar menu (https://www.mirrorbarcarlton.com/s/Mirror-Menu-3Q-2026.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('mirrorbarcarlton', NULL, 'Marble', 'Hennessy VSOP with cornflakes, coconut, Cointreau and champagne.', 'The bar''s nod to Breakfast at Tiffany''s: breakfast cereal and coconut meet cognac and champagne, pairing luxury ingredients with a playful, artistic serve. It is one of the past-menu favourites kept in the Highlights section.

Ingredients from Mirror Bar menu (https://www.mirrorbarcarlton.com/s/Mirror-Menu-3Q-2026.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('mirrorbarcarlton', NULL, 'Ľudovít Štúr', 'A low-ABV Bamboo of Tío Pepe fino, dry vermouth, Paragon cordial, apple-quince-pear juice and citrus bitters.', 'Part of the Classy menu, where each twisted classic honours a famous guest of the Hotel Carlton. It salutes the champion of the Slovak language, a regular at the hotel and a light drinker, so the drink is a gentle sherry-based Bamboo with local orchard fruit.

Ingredients from Mirror Bar menu (https://www.mirrorbarcarlton.com/s/Mirror-Menu-3Q-2026.pdf). No measures have been published.', 'Bamboo', NULL, NULL, NULL, NULL),
    ('mirrorbarcarlton', NULL, 'Elementum', 'Borovička Domovina with gooseberry, an earthy soda and edible fruit air.', 'Built on borovička, Slovakia''s traditional juniper spirit, it is themed on aether, the classical fifth element. A fruity, earthy highball that shows off a local spirit in the Highlights section of past favourites.

Ingredients from Mirror Bar menu (https://www.mirrorbarcarlton.com/s/Mirror-Menu-3Q-2026.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('cochinchina.bar', NULL, 'La Vida Que Me Merezco', 'A Margarita-style drink balanced with pineapple, lemon and vanilla.', 'Its name means ''the life I deserve'', and 50 Best calls it one of the bar''s iconic drinks. It keeps the Margarita''s shape but rounds it with pineapple and vanilla, typical of how the bar reworks familiar formats.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/the-list/cochinchina.html). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('cochinchina.bar', NULL, 'Blend de los Buenos', 'Cantieri Navali vermouth lengthened with soda water and a saline hit of capers.', 'Built on Cantieri Navali, the vermouth Inés de los Santos makes herself, served long with soda and seasoned with capers for salinity. It is a low-strength signature that shows off her own product.

Created by Inés de los Santos.

Ingredients from The World''s 50 Best Bars (https://www.theworlds50best.com/bars/the-list/cochinchina.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('cochinchina.bar', NULL, 'Dijon Bloody Mary', 'A Bloody Mary seasoned with Dijon mustard.', 'Listed under ''Clásicos de Inés'', the section of owner Inés de los Santos''s own signature drinks. The French mustard fits the bar''s Franco-Vietnamese theme.

Created by Inés de los Santos.

Sources: https://www.the50.com/discovery/Establishments/Argentina/Buenos-Aires/CoChinChina.html, https://www.enprimeurclub.com/bars/cochinchina-buenos-aires', 'Bloody Mary', NULL, NULL, NULL, NULL),
    ('cochinchina.bar', NULL, 'Jazmín Shanghái', 'Whisky with umeshu (Japanese plum liqueur) and jasmine tea.', 'Another of the ''Clásicos de Inés'', pairing whisky with the fruit of umeshu and the floral lift of jasmine tea, in line with the bar''s Asian influences.

Created by Inés de los Santos.

Ingredients from 50 Best Discovery (https://www.the50.com/discovery/Establishments/Argentina/Buenos-Aires/CoChinChina.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('baba_au_rum', NULL, 'Supremus n°58', 'Rhum agricole and aged rum with lime, distilled falernum, spices and white summer tea.', 'The bar''s modern take on the Ti'' Punch, keeping grassy rhum agricole at the centre but adding an aged rum, a distilled falernum and white tea for a lighter, more aromatic drink. 50 Best names it among the signatures.

Ingredients from Baba au Rum menu (https://www.babaaurum.com/the-menu). No measures have been published.', 'Ti'' Punch', NULL, 'Rocks', NULL, NULL),
    ('baba_au_rum', NULL, 'Baba''s Zombie', 'Five aged rums with fresh tropical juices, falernum, dry orange curaçao, lime, bitters and spices, in a tiki mug.', 'The house Zombie is the bar''s tiki flagship, blending five hand-picked Caribbean rums with old-school tiki ingredients. A pricier Star-5-Zombie version swaps in five ultra-premium aged rums for special occasions.

Ingredients from Baba au Rum menu (https://www.babaaurum.com/the-menu). No measures have been published.', NULL, NULL, 'Custom', NULL, NULL),
    ('baba_au_rum', NULL, 'Spicy Baba No7', 'Aged Puerto Rican rum with ginger, lime, sweet berries, mint and cranberry.', 'A crowd favourite that the menu says has been popular since 2010. Ginger heat and berries make it an easy entry point to the rum list.

Ingredients from Baba au Rum menu (https://www.babaaurum.com/the-menu). No measures have been published.', NULL, 2010, 'Rocks', NULL, NULL),
    ('baba_au_rum', NULL, 'Beatnik Paloma', 'Tequila and mezcal with beetroot and black cardamom, served long.', '50 Best picks it to show the bar''s range beyond rum: a Paloma reworked with earthy beetroot and smoky black cardamom alongside a split agave base.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/baba-au-rum.html). No measures have been published.', 'Paloma', NULL, NULL, NULL, NULL),
    ('baba_au_rum', NULL, 'Baba au Rum', 'A Daiquiri variation of Barceló Imperial rum with sweet sherry, vanilla, oak, basil and lime.', 'The bar''s namesake drink, listed in its Rum Society section of originals. It builds a Daiquiri out with sherry, vanilla and oak notes, echoing the rum-soaked cake the bar is named after.

Ingredients from 50 Best Discovery (https://www.the50.com/discovery/Establishments/Greece/Athens/Baba-Au-Rum.html). No measures have been published.', 'Daiquiri', NULL, NULL, NULL, NULL),
    ('nouvellevague_tirana', NULL, 'C''est Rum', 'A rum blend with pineapple, passion fruit, lime and chocolate bitters.', 'The menu bills it as the bar''s best seller since opening night: a bright, balanced tropical rum sour with a touch of chocolate bitters.

Ingredients from Nouvelle Vague menu (https://nouvellevaguetirana.com/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('nouvellevague_tirana', NULL, 'Nu Fashion', 'Rye and bourbon with blended vermouth, ginger, lime and bitters.', 'The bar calls it its signature since day one: a personal take on the Old Fashioned that splits the whiskey base and brings in vermouth and a little ginger and lime.

Ingredients from Nouvelle Vague menu (https://nouvellevaguetirana.com/). No measures have been published.', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('nouvellevague_tirana', NULL, 'Deviated Negroni', 'Juniper raki, a bitter aperitif and fortified Kallmet wine.', 'A terroir-driven Negroni that replaces gin with juniper raki and vermouth with a fortified wine made from Kallmet, Albania''s noble native red grape. 50 Best highlights it from the Origin''al menu, which celebrates Albanian producers.

Ingredients from Nouvelle Vague menu (https://nouvellevaguetirana.com/). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('nouvellevague_tirana', NULL, 'Nou Whey', 'Pear raki with hazelnut milk, tonka bean, cocoa and elderflower.', 'A creamy, dessert-like drink built on hazelnut milk and tonka bean, lifted with elderflower and anchored by pear raki. 50 Best names it as a signature of the current menu.

Ingredients from Nouvelle Vague menu (https://nouvellevaguetirana.com/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('nouvellevague_tirana', NULL, 'Black Sabah', 'Muscat raki and rum with Turkish coffee, toasted corn, honey and spices.', 'Turns the Albanian morning habit of coffee with a shot of raki into an evening cocktail. 50 Best singles it out as a signature.

Ingredients from Nouvelle Vague menu (https://nouvellevaguetirana.com/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('hopeandsesame', NULL, 'Ginseng Penicillin', 'Chivas 12 blended Scotch with aged tangerine peel, American ginseng, ginger, honey and a peated float.', 'A Cantonese reading of the modern classic Penicillin: the honey-ginger base gains bitter-sweet American ginseng and aged tangerine peel (chenpi), two staples of Cantonese herbal cooking. It fits the menu''s theme that every bitterness hides a sweetness.

Ingredients from Hope & Sesame menu Vol. 17 ''Bittersweet'' (https://hopeandsesame.cn/wp-content/Uploads%20by%20Bastien/HOPE-VOL17.pdf). No measures have been published.', 'Penicillin', 2025, NULL, NULL, NULL),
    ('hopeandsesame', NULL, 'Wintermelon High', 'Olmeca Altos tequila with chrysanthemum, ginger, winter melon and Three Cents pink grapefruit soda.', 'A tequila highball built on chrysanthemum and winter melon tea, the cooling drinks sold at Cantonese herbal tea stalls. Pink grapefruit soda adds a gentle bitter edge.

Ingredients from Hope & Sesame menu Vol. 17 ''Bittersweet'' (https://hopeandsesame.cn/wp-content/Uploads%20by%20Bastien/HOPE-VOL17.pdf). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('hopeandsesame', NULL, 'Pu''er Old Fashioned', 'Bumbu rum with pu''er tea, red date, goji berry, Licor 43, caramel and chocolate bitters.', 'An Old Fashioned seasoned like a Cantonese tonic soup, with red dates and goji, and given earthy depth by fermented pu''er tea. Rum, Licor 43 and caramel keep it rich and round.

Ingredients from Hope & Sesame menu Vol. 17 ''Bittersweet'' (https://hopeandsesame.cn/wp-content/Uploads%20by%20Bastien/HOPE-VOL17.pdf). No measures have been published.', 'Old Fashioned', 2025, NULL, NULL, NULL),
    ('hopeandsesame', NULL, 'Guang-Hattan', 'Michter''s US*1 rye with coconut, ylang-ylang, rosso vermouth and rhododendron.', 'The bar''s Cantonese Manhattan, served up in a stemmed glass. Coconut and floral ylang-ylang and rhododendron soften the rye and vermouth backbone.

Ingredients from Hope & Sesame menu Vol. 17 ''Bittersweet'' (https://hopeandsesame.cn/wp-content/Uploads%20by%20Bastien/HOPE-VOL17.pdf). No measures have been published.', 'Manhattan', 2025, 'Martini', NULL, NULL),
    ('hopeandsesame', NULL, 'Coffee & Tea Sour', 'Jameson Irish whiskey with coffee, Phoenix Dancong tea, grapefruit, peach and chickpea.', 'Its Chinese name translates roughly as a pick-me-up symphony: coffee and Phoenix Dancong, the aromatic oolong from Chaozhou, share a whiskey sour with grapefruit and peach. Chickpea stands in for egg white, and it is served in a playful stacked ceramic vessel.

Ingredients from Hope & Sesame menu Vol. 17 ''Bittersweet'' (https://hopeandsesame.cn/wp-content/Uploads%20by%20Bastien/HOPE-VOL17.pdf). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('danicoparis', NULL, 'Kota Ternate', 'Planteray OFTD and 3 Stars rums with pineapple, coconut, a spice mix, lime and milk.', 'From Danico''s first menu (2016-17) and still listed with unlimited stock on the anniversary menu, which says of its taste only that guests already know. Named for Ternate, the Indonesian spice island, it pairs two rums with tropical fruit, spice and milk, and set the tone for the bar''s travel-inspired drinks.

Ingredients from Danico 10 Years menu (https://daroco.com/wp-content/uploads/2026/08/danico-menu-des-10-ans-web.pdf). No measures have been published.', NULL, 2016, NULL, NULL, NULL),
    ('danicoparis', NULL, 'Leche de Tigre', 'Citadelle gin with a ceviche distillate, coconut oil, lime, ají amarillo and coriander.', 'From the Peru chapter of Nico de Soto''s Xplorer menu series, it bottles the citrus-chilli marinade of ceviche as a sour. A ceviche distillate carries the savoury flavour without the solids, and 50 Best singles it out as the bar''s signature.

Ingredients from Danico 10 Years menu (https://daroco.com/wp-content/uploads/2026/08/danico-menu-des-10-ans-web.pdf). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('danicoparis', NULL, 'Krakatoa', 'Peanut butter distillate and Planteray 3 Stars rum with palm sugar, mango, pineapple, cucumber, sweet potato, lime and soy milk.', 'An Indonesian-inspired clarified milk punch that uses soy milk for clarification and a peanut butter distillate for nutty depth. The menu notes that Nico de Soto called it the best milk punch he had tried.

Ingredients from Danico 10 Years menu (https://daroco.com/wp-content/uploads/2026/08/danico-menu-des-10-ans-web.pdf). No measures have been published.', NULL, 2023, NULL, NULL, NULL),
    ('danicoparis', NULL, 'Café-Moutarde Banane', 'A black mustard seed distillate with coffee liqueur, espresso and banana.', 'The bar''s Espresso Martini, which the menu cheekily bills as the best one ever. Black mustard seed is distilled to add a warm, peppery lift, and banana rounds out the coffee.

Ingredients from Danico 10 Years menu (https://daroco.com/wp-content/uploads/2026/08/danico-menu-des-10-ans-web.pdf). No measures have been published.', 'Espresso Martini', 2022, NULL, NULL, NULL),
    ('danicoparis', NULL, 'Sakura', 'Citadelle gin, sweet vermouth, Campari, umeshu and sakura.', 'A Japanese-accented Negroni that the team calls its favourite, with plum-based umeshu and cherry blossom softening the bitter backbone. It shows the bar''s habit of dressing classics in the flavours of its travel menus.

Ingredients from Danico 10 Years menu (https://daroco.com/wp-content/uploads/2026/08/danico-menu-des-10-ans-web.pdf). No measures have been published.', 'Negroni', 2024, NULL, NULL, NULL),
    ('scarfesbar', NULL, 'Iron Lady', 'Glenfiddich 12 with chocolate wine, fig leaf and clarified citrus, served with a cracker.', 'The Margaret Thatcher ''hero'' page of the Heroes & Villains menu, where each Scarfe caricature gets a light and a dark drink behind a pull-out page. Reviewers singled it out as a sharper, citrus-led whisky serve, with the clarified citrus keeping a rich base bright.

Created by Andy Loudon and the Scarfes Bar team in 2026.

Ingredients from Rosewood London (https://www.rosewoodhotels.com/en/london/media-hub/Scarfes-Bar-Menu-Launch). No measures have been published.', NULL, 2026, NULL, NULL, NULL),
    ('scarfesbar', NULL, 'Hot-Air Balloon', 'The Macallan 12 with palo santo and Earl Grey sherry and peated almond.', 'The Richard Branson ''hero'' drink on Heroes & Villains, pairing a sherried Speyside malt with a sherry flavoured with palo santo and Earl Grey and a smoky almond element. Press tasting the launch menu called it one of the best cocktails they had tried.

Created by Andy Loudon and the Scarfes Bar team in 2026.

Ingredients from Rosewood London (https://www.rosewoodhotels.com/en/london/media-hub/Scarfes-Bar-Menu-Launch). No measures have been published.', NULL, 2026, NULL, NULL, NULL),
    ('scarfesbar', NULL, 'Toothless Grin', 'Sazerac twist on Rémy Martin 1738 cognac, medjool dates, evaporated beetroot and citra hops, served with goat''s cheese, lemon curd and absinthe.', 'From the ''Fears'' chapter of the Long Drawn Out Sip menu, built on the fear of losing your teeth, and the drink 50 Best named when ranking the bar. It pairs an earthy, hoppy cognac Sazerac with a small savoury bite on the side.

Created by Andy Loudon and the Scarfes Bar team in 2025.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/scarfes-bar.html). No measures have been published.', 'Sazerac', 2025, NULL, NULL, NULL),
    ('scarfesbar', NULL, 'Royal Salute Kensington', 'Royal Salute 21 year old blended Scotch shaken with rosewater honey syrup and lemon, lengthened with soda.', 'A whisky highball-sour built to show off the rose and marmalade notes of Royal Salute 21, with a floral honey syrup echoing the whisky''s nose. Created by former Director of Bars Martin Siska for a 2020 brand series, it is one of the few Scarfes specs published in full.

Created by Martin Siska in 2020.

Rosewater honey syrup: Stir together equal parts boiling water, rose water and honey, then let it cool.

Ingredients from Elite Traveler (https://elitetraveler.com/finest-dining/royal-salute-kensington-scarfes-bar-rosewood-london). No measures have been published.', NULL, 2020, 'Rocks', 'Cubes', NULL),
    ('scarfesbar', NULL, 'Night Beat', 'Glenmorangie Signet with balsamic vermouth and cedarwood or acorn bitters, served over ice.', 'A short, rich Christmas collaboration with Glenmorangie that uses a balsamic vermouth to pull out the whisky''s mocha and syrupy notes. It sat on the bar''s ''10'' menu marking its tenth anniversary.

Created by Martin Siska and Yann Bouvignies.

Method: Shake all ingredients with ice and serve over ice.

Spec from Luxury London (https://luxurylondon.co.uk/taste/food/recipes/night-beat-cocktail-scarfes-bar/).', NULL, NULL, NULL, NULL, 'Shake'),
    ('svanen.oslo', NULL, 'Stolen Apples', 'Eminente 7 rum and gin with green apple juice, lapsang souchong tea, ginger and shiso, clarified with oat milk.', 'The drink 50 Best names as Svanen''s signature, and a fixture across menus. Smoky lapsang meets tart green apple and ginger, and an oat milk clarification leaves it clear and silky rather than cloudy.

Method: Milk-punch style clarification with oat milk.

Ingredients from Svanen (https://www.svanenoslo.no/signature-cocktails). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('svanen.oslo', NULL, 'Norwegian Waffles (Smørbukk)', 'Michter''s bourbon and Campari with brown cheese, butter and strawberries, clarified with sour cream.', 'A drinkable take on Norway''s waffle with brunost and jam: brown cheese and butter bring the sweet-savoury caramel note, strawberry the jam, and a sour cream clarification adds tang while keeping it clear.

Method: Clarified with sour cream.

Ingredients from Svanen (https://www.svanenoslo.no/signature-cocktails). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('svanen.oslo', NULL, 'Rabarbra Spritz', 'Ketel One vodka, Rinomato aperitivo and rhubarb liqueur topped with prosecco and soda.', 'Svanen''s bright house spritz, leaning on rhubarb, a staple of Nordic gardens, for a floral and tart aperitif. It is listed first on the signature menu and regularly picked out in guides.

Ingredients from Svanen (https://www.svanenoslo.no/signature-cocktails). No measures have been published.', 'Aperol Spritz', NULL, NULL, NULL, NULL),
    ('svanen.oslo', NULL, 'Midnight Sun', 'Bacardi Carta Blanca, St-Germain and yellow Chartreuse with passion fruit, saffron, cocoa butter and a wheat beer syrup.', 'A floral, fruity sour named for the Nordic summer, using a wheat beer syrup and cocoa butter for body and a vegan ''fake egg white'' for the foam.

Ingredients from Svanen (https://www.svanenoslo.no/signature-cocktails). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('sastreriamartinezlima', NULL, 'Kené', 'Cartavio Solera 12 rum fat-washed with chestnut, a house Amazon citrus distillate and white vermouth made with mamey sapote.', 'Named for the geometric designs of the Shipibo-Conibo people of the Amazon, it headlines the 2025 textile-themed menu. The rum is fat-washed with chestnut and the citrus comes as a clear house distillate of lemon, mandarin and rough lemon rather than juice.

Created by Diego Macedo and team in 2025.

Ingredients from The Spirits Business (https://www.thespiritsbusiness.com/2025/07/sastreria-martinez-unveils-new-cocktail-menu/). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('sastreriamartinezlima', NULL, 'Mrs Martínez', 'Peruvian Intira gin with strawberry-infused Aperol, mandarin lime, blueberries and bitter lemon.', 'A house signature that has now run to a fourth version, updated for the 2025 menu under its coastal section. It is the bar''s bright, aperitivo-style highball, built on a Peruvian gin.

Created by Diego Macedo and team.

Ingredients from The Spirits Business (https://www.thespiritsbusiness.com/2025/07/sastreria-martinez-unveils-new-cocktail-menu/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('sastreriamartinezlima', NULL, 'Mr. Martinez 2.0', 'Johnnie Walker Gold infused with cheesecake, thyme blanco vermouth, bergamot, quinine and cacao mucilage.', 'The team''s favourite on the Colección 2023 menu, a stirred house drink that plays on the bar''s name (and the Martinez) with a cheesecake-infused Scotch and cacao pulp, one of several native Peruvian ingredients on that list.

Created by Diego Macedo and Daniel Rengifo in 2023.

Ingredients from Chilled Magazine (https://chilledmagazine.com/we-ask-the-team-at-speakeasy-sastreria-martinez-about-their-cocktail-creations/). No measures have been published.', NULL, 2023, NULL, NULL, NULL),
    ('sastreriamartinezlima', NULL, 'Huaca Pietra', 'Wine and vermouth with coca leaf, passion fruit, yacón honey, limón sidra and grapefruit bitters.', 'One of the two drinks 50 Best highlights, an off-dry, low-proof serve that draws on Andean ingredients like coca leaf and yacón rather than a spirit base.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/sastreria-martinez.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('sastreriamartinezlima', NULL, 'Cochinilla', 'Rum with red desert prickly pear, Amazonian cocona, beetroot liqueur, sanky cordial, lime and cacao bitters.', 'Its name is Spanish for cochineal, the red-dye insect that lives on prickly pear, which fits the drink''s colour and fruit. It pulls fruit from the coast, the highlands (sanky cactus) and the Amazon (cocona) into one sour-leaning drink.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/sastreria-martinez.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('pandaandsons', NULL, 'Coconut Daiquiri', 'Bacardi Carta Blanca ''switched'' with coconut milk and roasted coconut, plus lime, clarified to a clear, thick-textured daiquiri.', 'The drink most tied to McPherson''s switching technique: the rum is frozen so its water can be pulled off and replaced with roasted coconut milk, then clarified like a milk punch. 50 Best names it the bar''s signature.

Created by Iain McPherson.

Method: Freeze the rum, remove the frozen water, replace it with roasted coconut milk, then clarify milk-punch style.

Ingredients from EdinburghGuide.com (https://edinburghguide.com/venues/pubs/panda-sons). No measures have been published.', 'Daiquiri', NULL, NULL, NULL, NULL),
    ('pandaandsons', NULL, 'Red Panda 2.0 (Bloody Mary)', 'Bloody Mary of cucumber and makrut lime gin, cryo-concentrated tomato juice, spice, Worcestershire and lemon, under a black Guinness foam.', 'The Red Panda has been on since the bar opened in 2013; the 2.0 version keeps the ingredients but freezes the water out of the tomato juice for a denser, sweeter, more acidic base. Punch called it one of the best Bloody Marys in the UK.

Created by Iain McPherson in 2013.

Method: Throw the drink between tins to aerate and dilute, then top with Guinness foam.
Cryo-concentrated tomato juice: Freeze shop-bought tomato juice upright in an insulated cooler at about -10°C for 24 to 30 hours until partly frozen, then lift off the watery ice on top and keep the concentrated juice underneath.
Guinness foam: Mix Guinness with xanthan gum and black food colouring, chill, and dispense from a cream whipper charged with N2O.

Ingredients from Punch (https://punchdrink.com/articles/bloody-mary-cocktail-panda-sons/). No measures have been published.', 'Bloody Mary', 2013, NULL, NULL, NULL),
    ('pandaandsons', NULL, 'Birdcage', 'Johnnie Walker Gold Reserve with a rhubarb and lemongrass shrub, Aperol and Angostura, served under a glass birdcage of cinnamon and clove smoke.', 'An early showpiece: the drink arrives inside a smoke-filled glass cage that is lifted at the table to ''free the bird''. It helped build the bar''s name for theatrical serves in its first years.

Method: Served under a glass birdcage filled with cinnamon and clove smoke.

Ingredients from Liquid Grain (https://www.liquidgrain.co.uk/2014/08/panda-sons-edinburgh-review-king-of.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('rodahusetsthlm', NULL, 'Sweet Vernal Grass with Good Cream', 'Vodka and a house vernal grass liqueur with Granny Smith apple, clarified through Danish cream into a clear milk punch.', 'The bar''s bestseller and twice Sweden''s Best Signature Cocktail at the Bartenders'' Choice Awards. It began as a reworked apple Martini with bison grass vodka; the cream is gently heated and split with a green apple sour mix, leaving a clear drink with cinnamon notes and a creamy texture, served over an ice spear with a blade of grass frozen inside.

Created by Hampus Thunholm and Jacob Ekman.

Method: Gently heat the cream, curdle it with the apple sour mix and spirits, and force it through a piping bag to clarify.
Sweet vernal grass liqueur: Infuse Absolut Elyx with foraged sweet vernal grass and sweeten with Galliano.

Ingredients from Punch (https://punchdrink.com/articles/milk-punch-cocktail-recipe-roda-huset/). No measures have been published.', NULL, NULL, NULL, 'Spear', NULL),
    ('rodahusetsthlm', NULL, 'Apple & Hops', 'Whisky with freshly pressed, late-harvest Ingrid Marie apples and Swedish hops.', 'A three-ingredient drink that shows the bar''s approach: each batch is pressed fresh and the apple variety and hop strain change with the season, so the drink shifts through the year.

Created by Hampus Thunholm.

Ingredients from Class (https://classbarmag.com/news/fullstory.php/aid/1772/International_spotlight:_Inside_R_F6da_Huset_in_Stockholm.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('rodahusetsthlm', NULL, 'Plums from Dreyer in Höör', 'Sweet and sour plums from a named grower in Höör, rested with vodka and eau-de-vie.', 'Singled out by 50 Best, it is typical of the bar''s habit of naming drinks after the farm the produce came from, letting one fruit carry the drink with minimal intervention.

Method: Plums rested with the spirits.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/roda-huset.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('rodahusetsthlm', NULL, 'Raspberries & Whey', 'Tequila with whey flavoured with raspberries.', 'Another 50 Best pick, using whey, a dairy by-product, as the body of the drink, in keeping with the bar''s Fäviken-inspired focus on Nordic produce and preservation.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/roda-huset.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('mimikakushi', NULL, 'Shadrach (Kori Kakushi Martini)', 'Pre-bottled Martini of The Botanist gin dripped through Japanese ume with a touch of Mancino Secco vermouth, frozen in ice and served at -20°C.', 'The bar''s trademark, billed as one of the world''s coldest Martinis. Bottles are frozen layer by layer into a big ice block for a week, then carved out at the table from a trolley with Japanese ice tools, poured thick and syrupy, spritzed with a house citrus perfume and paired with a Toshiko Akiyoshi jazz track that gives it its name.

Created by Manja Stankovic.

Method: Slowly drip the gin through Japanese ume with a touch of dry vermouth, bottle, and store frozen in ice at -20°C until served.

Spec from The Spirits Business (https://www.thespiritsbusiness.com/2025/04/cocktail-stories-shadrach-mimi-kakushi/).', 'Martini', NULL, NULL, NULL, NULL),
    ('mimikakushi', NULL, 'Sayonara', 'Negroni built with umeshu, the Japanese ume plum liqueur.', 'The bar''s East-meets-West aperitivo: the Negroni''s bitter backbone softened by umeshu, the plum liqueur that runs through much of the menu.

Sources: https://mimikakushi.ae/wp-content/uploads/2026/06/MK-Drinks-Menu_4-MAY_compressed.pdf', 'Negroni', NULL, NULL, NULL, NULL),
    ('mimikakushi', NULL, 'Tokoramo', 'Americano of Campari and Mancino Rosso vermouth lengthened with a Japanese cherry sencha kombucha.', 'Swaps the soda in an Americano for a fermented kombucha brewed from cherry sencha, the tea the restaurant also sells under its own name.

Ingredients from Mimi Kakushi (https://mimikakushi.ae/wp-content/uploads/2026/06/MK-Drinks-Menu_4-MAY_compressed.pdf). No measures have been published.', 'Americano', NULL, NULL, NULL, NULL),
    ('mimikakushi', NULL, 'Kimura', 'Old Fashioned-style Bulleit bourbon with umeshu, rooibos and coconut water.', 'A lighter take on a whisky stirred drink, using umeshu for sweetness, rooibos for a tannic herbal note and coconut water to soften the bourbon.

Ingredients from Mimi Kakushi (https://mimikakushi.ae/wp-content/uploads/2026/06/MK-Drinks-Menu_4-MAY_compressed.pdf). No measures have been published.', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('coahongkong', NULL, 'La Paloma de Oaxaca', 'Split-base Paloma of tequila and mezcal with lime and grapefruit soda, rimmed with worm salt.', 'The only cocktail that has stayed on COA''s list since it opened in 2017, according to Asia''s 50 Best. Khan splits the base between tequila and mezcal to tame the smoke, and finishes it with sal de gusano (worm salt), an ingredient he says he would put in everything.

Created by Jay Khan in 2017.

Method: Build and top with grapefruit soda.

Spec from Le Cocktail Connoisseur (https://lecocktailconnoisseur.com/2018/11/15/jay-khan-coa-hong-kong/).', 'Paloma', 2017, NULL, NULL, 'Build'),
    ('coahongkong', NULL, 'Orchata de Pistachio', 'Tequila shaken with horchata, pistachio orgeat, lemon and whey.', 'The drink Jay Khan named as his signature when COA was a year old: a creamy, nutty take on Mexican horchata, where whey adds body and a gentle tang without dairy heaviness.

Created by Jay Khan.

Spec from Le Cocktail Connoisseur (https://lecocktailconnoisseur.com/2018/11/15/jay-khan-coa-hong-kong/).', NULL, NULL, NULL, NULL, NULL),
    ('coahongkong', NULL, 'Bitter Melon Collins', 'Tequila infused with coconut and green curry botanicals, a bitter melon cordial and bitter orange tonic, garnished with cucumber.', 'Inspired by a trip to Bangkok, it tastes like Thai green curry in a Collins glass: coconut, lime leaf and lemongrass in the tequila, bitter melon in the cordial. A clear, fragrant long drink that reviewers single out as a favourite.

Created by Jay Khan.

Method: Combine the acid solution, cordial, tequila and tonic in a tall glass, add a clear ice block carefully, and garnish.

Spec from The Beat Asia (https://thebeat.asia/hong-kong/delish/people/all-mixed-up-jay-khan-co-founder-of-coa-bar-in-hong-kong-shanghai).', 'Tom Collins', NULL, NULL, 'Large Cube', NULL),
    ('coahongkong', NULL, 'Pepper Smash', 'Jalapeño-infused agave spirit with yellow bell pepper, basil and pineapple, topped with a mint sprig.', 'One of the two drinks 50 Best tells guests to order: a frothy, savoury smash where sweet yellow bell pepper and jalapeño heat meet pineapple and basil.

Ingredients from Clean Plate (https://www.cleanplateblog.com/post/coa-hong-kongs-cocktail-pride). No measures have been published.', NULL, NULL, 'Rocks', NULL, NULL),
    ('coahongkong', NULL, 'Smacked Cucumber', 'Mezcal and tequila with cucumber and a soy-forward Chinese salad dressing.', 'A newer fan favourite that turns the Chinese smacked cucumber salad into a drink, balancing smoky agave against fresh cucumber and savoury soy.

Ingredients from Asia''s 50 Best Bars (https://www.the50.com/bars/asia/the-list/coa.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('salmonguru', NULL, 'Old School Funny', 'Le Tribute gin, red vermouth, Campari, amontillado sherry and tawny port, aged six years in a solera.', 'The bar''s iconic Negroni, given an Iberian accent with amontillado and tawny port and aged in a dynamic solera so each pour blends older and newer batches. 50 Best calls it a must-try, and it sits in the menu''s ''Untouchables'' section.

Method: Aged in the bar''s solera system.

Ingredients from Salmon Guru (https://salmonguru.es/wp-content/uploads/2026/04/Cocktails-Salmonguru.pdf). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('salmonguru', NULL, 'Ultramarino', 'Mezcal Unión, manzanilla, and a lime and rhubarb cordial, rested 72 hours in clay amphorae sunk in seawater.', 'A gimlet-style drink with a sherry and mezcal edge, kept in the menu''s ''Untouchables'' section. The batch rests in clay amphorae sunk in the sea, part of the bar''s experiments with osmosis and ocean ageing described in its 10th-anniversary material.

Method: Rested 72 hours in clay amphorae submerged in seawater.

Ingredients from Salmon Guru (https://salmonguru.es/wp-content/uploads/2026/04/Cocktails-Salmonguru.pdf). No measures have been published.', 'Gimlet', NULL, NULL, NULL, NULL),
    ('salmonguru', NULL, 'Pantera Jackson', '1615 pisco milk punch with 400 Conejos mezcal, mango water and fish sauce, clarified through Greek yoghurt.', 'A savoury-tropical milk punch that uses yoghurt rather than milk to clarify, with fish sauce adding umami against mango. It reflects the Asian and South American influences the bar mixes into its Madrid base.

Method: Milk-punch clarification using Greek yoghurt.

Ingredients from Salmon Guru (https://salmonguru.es/wp-content/uploads/2026/04/Cocktails-Salmonguru.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('salmonguru', NULL, 'Chipotle Chillón', '400 Conejos mezcal, lemon juice and chipotle chilli syrup with an absinthe aroma.', 'A smoky, spicy mezcal sour with an absinthe aroma, one of the long-running drinks the bar keeps in its ''Untouchables'' section alongside Old School Funny.

Ingredients from Salmon Guru (https://salmonguru.es/wp-content/uploads/2026/04/Cocktails-Salmonguru.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('salmonguru', NULL, 'Modern Times', 'Brandy de Jerez with Reus red vermouth, Navarre pacharán and a slice of Valencian orange.', 'A Spanish-ingredient vermouth cocktail from Diego Cabrera that pairs two of his favourite products, sherry-country brandy and sloe-based pacharán. Published as one of his signature recipes by Spain''s trade body.

Created by Diego Cabrera.

Spec from Foods & Wines from Spain (https://www.foodswinesfromspain.com/en/wine/spirited-spain/2023/february/modern-times-cocktail-recipe-diego-cabrera).', NULL, NULL, NULL, NULL, NULL),
    ('sipandguzzlenyc', NULL, 'Miami Vice Negroni', 'Negroni infused with strawberries and washed with coconut, served over one large clear cube.', 'The drink 50 Best tells you to order at Guzzle. It borrows the strawberry and coconut pairing of the Miami Vice (a Strawberry Daiquiri and Piña Colada side by side) and folds it into a Negroni via an infusion and a coconut fat wash.

Method: Infuse with strawberry, wash with coconut, and serve over a large clear cube.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/sip-guzzle.html). No measures have been published.', 'Negroni', NULL, NULL, 'Large Cube', NULL),
    ('sipandguzzlenyc', NULL, 'Tomato Tree', 'Tomato water with dill-infused gin, shochu, mastiha, St-Germain and lemon.', 'The standout at Shingo Gokan''s downstairs Sip bar and kept on the menu by popular demand. Clear tomato water and dill give it a savoury, garden-fresh profile, with shochu and mastiha adding a Japanese and Greek accent.

Created by Shingo Gokan.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/sip-guzzle.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('sipandguzzlenyc', NULL, 'Sherry Colada Highball', 'Cream sherry lengthened with coconut-pineapple seltzer over spear ice.', 'A two-ingredient highball that drinks like a clear, sparkling Piña Colada without any clarification or carbonation rig. Schneider found it at home with what was in his fridge; the sweetness of cream sherry makes the faint seltzer flavours pop. Punch named it an easy best-in-class recipe.

Created by Steve Schneider.

Method: Build both ingredients in a highball glass over a spear of ice.

Spec from Punch (https://punchdrink.com/recipes/sherry-colada-highball/).', NULL, NULL, 'Highball', 'Spear', 'Build'),
    ('drinkkongbar', NULL, 'Canova', 'Gimlet of Roku gin with a Mediterranean cordial of thyme, rosemary, basil and black olive, served up.', 'One of two drinks Pistolesi recommends to first-timers and on every menu since. Named after the neoclassical sculptor Antonio Canova as a nod to the bar''s aim of making modern classics, it swaps lime cordial for a savoury, sea-evoking herb and olive cordial.

Created by Patrick Pistolesi.

Ingredients from Drink Kong (https://www.drinkkong.com/wp-content/uploads/2026/08/MENU-FLUX-2026.pdf). No measures have been published.', 'Gimlet', NULL, 'Coupette', NULL, NULL),
    ('drinkkongbar', NULL, 'Gaijin', 'Nikka Coffey Grain whisky with miso, milk and pineapple.', 'Pistolesi''s tribute to Japan (the name means ''outsider''), and the other drink 50 Best says sums up the bar. Miso brings umami and salinity to a soft Japanese grain whisky, rounded with milk and pineapple.

Created by Patrick Pistolesi.

Ingredients from Drink Kong (https://www.drinkkong.com/wp-content/uploads/2026/08/MENU-FLUX-2026.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('drinkkongbar', NULL, 'Big Trouble in Oaxaca', 'Del Maguey Vida mezcal with pineapple liqueur, jalapeño, Midori, lemon and agave, served in a tumbler.', 'A Heritage cocktail that has travelled through several Kong menus. A spicy, green mezcal sour whose name riffs on the cult film Big Trouble in Little China, in keeping with the bar''s retro pop-culture look.

Ingredients from Drink Kong (https://www.drinkkong.com/wp-content/uploads/2026/08/MENU-FLUX-2026.pdf). No measures have been published.', NULL, NULL, 'Rocks', NULL, NULL),
    ('drinkkongbar', NULL, 'Bowie', 'Merlet Eau de Vigne with Italicus and Merlet Trois Citrus, citric solution and sugar, in a blue curaçao coral crusta.', 'The drink Pistolesi chose as his signature in 2019: a grape-brandy sour in the Crusta style, with bergamot from Italicus, extra citrus liqueur and a striking blue ''coral'' sugar rim.

Created by Patrick Pistolesi.

Spec from Le Cocktail Connoisseur (https://lecocktailconnoisseur.com/2019/03/07/patrick-pistolesi-drink-kong-rome/).', 'Brandy Crusta', NULL, NULL, NULL, NULL),
    ('drinkkongbar', NULL, 'Aceticus', 'Italicus with chamomile-infused Cocchi Americano, a zero-waste citrus cordial and Frascati white wine vinegar.', 'Pistolesi''s Italicus competition entry, an aperitivo built on the bar''s Kong Cordial made from spent citrus shells. Roman chamomile and a splash of Roman wine vinegar push the bergamot toward an odd, citrus-umami freshness.

Created by Patrick Pistolesi.

Chamomile Cocchi Americano: Infuse one bottle of Cocchi Americano with 20 g Roman chamomile for 24 hours, then strain.
Kong Cordial: Steep 1 kg of spent mixed citrus shells in 1 litre of water with 1 kg sugar, 40 g citric acid and 20 g malic acid for 24 hours, then strain.

Spec from Difford''s Guide (https://www.diffordsguide.com/competition/1172/italicus/patrick-pistolesi-drink-kong).', NULL, NULL, NULL, NULL, NULL),
    ('doublechickenpleasenyc', NULL, 'Japanese Cold Noodle', 'White rum, coconut, pineapple, cucumber and lime with a dash of sesame oil, served over a large ice block.', 'A savoury Pina Colada twist that began life as Venceremos, the drink GN Chan used to win the 2016 Bacardi Legacy global final before the bar existed. Cucumber and toasted sesame push the tropical base toward a bowl of cold noodles, and at the bar it is aerated with a milk frother before shaking for a lighter texture.

Created by GN Chan in 2016.

Method: Shake with ice and strain into an ice-filled glass. (At the bar it is aerated with a milk frother before shaking.)

Spec from Difford''s Guide (Bacardi Legacy 2016 competition spec as Venceremos) (https://www.diffordsguide.com/encyclopedia/1107/cocktails/bacardi-legacy-2016-global-final-all-recipes).', 'Piña Colada', 2016, 'Rocks', 'Large Cube', 'Shake'),
    ('doublechickenpleasenyc', NULL, 'Cold Pizza', 'Blanco tequila infused with parmesan and burnt toast, clarified tomato water, lime-basil cordial, oolong tea honey and egg white.', 'Built from the idea of a leftover slice of margherita pizza crossed with a Margarita. The savoury base comes from a parmesan and burnt toast infusion, and the foam carries an edible rice paper print of a hand holding a slice, which became one of the most photographed garnishes in New York.

Created by GN Chan and Faye Chen in 2022.

Method: Shake and strain into a chilled glass.

Spec adapted from Spirited Drinks (https://www.spiriteddrinks.com/cold-pizza-cocktail-double-chicken-please-nyc/).', 'Margarita', 2022, 'Martini', NULL, 'Shake'),
    ('doublechickenpleasenyc', NULL, 'French Toast', 'Barley tea vodka shaken with a flip mix of burnt brioche, maple, coconut water, milk and whole egg, with a house Oreo on the side.', 'The bar''s reverse-pairing idea in one glass: you drink the French toast and eat an Espresso Martini, served as a custom-moulded cookie filled with coffee ganache. Brioche is blended and cooked with maple rather than infused into spirit, and coconut water ties the rich flip together.

Created by GN Chan and Faye Chen in 2022.

Method: Shake all ingredients with ice and strain into a flip glass.
French toast mix: Blend 320 ml whole milk, 320 ml maple toast mix (burnt brioche cooked with maple syrup and coconut water), 5 whole eggs and 2.8 g sea salt with an immersion blender, strain and refrigerate.

Spec from The Spirits Business (https://www.thespiritsbusiness.com/2024/03/cocktail-stories-french-toast-double-chicken-please/).', NULL, 2022, NULL, NULL, 'Shake'),
    ('doublechickenpleasenyc', NULL, 'Red Eye Gravy', 'Irish whiskey with coffee butter, corn, walnut, wild mushroom and microwaved coppa.', 'A main-course drink from The Coop menu modelled on the Southern ham-and-coffee gravy, layering fat-washed coffee butter, earthy mushroom and crisped coppa over whiskey. It shows how far the bar pushes savoury flavours into a stirred-style drink.

Created by GN Chan and Faye Chen.

Ingredients from Double Chicken Please menu (https://doublechickenplease.com/pages/accessible-menus). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('maybe_sammy_sydney', NULL, 'The Sammy', 'A pre-batched miniature of gin, sweet and dry vermouth and mint, served in a tiny coupette.', 'The house namesake from the Rat Pack ''Minis'' list, a take on the old Roulette cocktail. The minis are batched small serves meant to make forgotten classics feel fashionable again, and they have become part of the bar''s welcome ritual.

Method: Pre-batched and served chilled.

Ingredients from Cocktails & Bars (https://cocktailsandbars.com/maybe-sammy/). No measures have been published.', NULL, NULL, 'Coupette', NULL, 'Build'),
    ('maybe_sammy_sydney', NULL, 'Milord', 'Plum brandy, Dubonnet, PX sherry and Calvados with absinthe and Peychaud''s, finished with drops of aged balsamic.', 'Created by co-owner Martin Hudak for the 2022 Stardust menu and named after the Edith Piaf song. It brings French, Italian and Spanish ingredients together in a round, spirit-forward stir, served in a striking blue glass, with 25-year gran reserva PX balsamic as the finishing touch.

Created by Martin Hudak in 2022.

Method: Stir all but the balsamic with ice and strain over block ice. Finish with three drops of balsamic.

Spec from Boothby (https://www.boothby.com.au/maybe-sammys-stardust-menu-how-they-make-the-milford-cocktail/).', NULL, 2022, 'Rocks', 'Large Cube', 'Stir'),
    ('maybe_sammy_sydney', NULL, 'Vino Bastardo', 'Raisin-infused Glenfiddich 14, Cocchi Americano, Pavan and saffron grappa, stirred as an aromatic Old Fashioned.', 'From the 2023 Mirage menu, built on the idea of wine turning into whisky. Raisins are cooked sous vide into the Scotch and saffron is steeped into Nardini grappa, giving a grape-driven Old Fashioned served in a stemless wine glass.

Method: Build in the glass over one large ice cube and stir gently until cold.
Raisin Glenfiddich: Seal 300 g raisins with 700 ml Glenfiddich 14 in a vacuum bag, cook sous vide at 60 C for two hours, then strain through a coffee filter.
Saffron Nardini Tagliatella: Steep 1.5 g saffron in 500 ml Nardini Tagliatella overnight, then strain through cloth.

Spec from Bars and Cocktails (https://www.barsandcocktails.com.au/recipes/cocktail-menu-maybe-sammys-vino-bastardo/).', 'Old Fashioned', 2023, 'Wine', 'Large Cube', 'Stir'),
    ('maybe_sammy_sydney', NULL, 'Claret Snap', 'Gin, Malbec, lemon, cacao syrup and fresh raspberries, shaken hard and double strained.', 'A bartender''s drink from Will Oxenham that folds red wine into a gin sour, with cacao syrup rounding the tannin and raspberries adding bright fruit. The team shared the spec publicly as an easy way to recreate a Maybe Sammy serve at home.

Created by Will Oxenham in 2021.

Method: Shake hard with ice to break up the raspberries, then double strain into a chilled glass.

Spec from Food Wine Travel (https://www.foodwinetravel.com.au/more/drinks-more/the-team-from-maybe-sammy-show-us-how-to-make-an-awesome-cocktail/).', NULL, 2021, 'Coupette', NULL, 'Shake'),
    ('maybe_sammy_sydney', NULL, 'Peaky Blinders', 'Benriach 10 Scotch with sherry, mead and green tea soda, from the 2025 Showtime menu.', 'One of the twelve film and TV drinks on the Showtime menu, each shipped with a short trailer the team wrote, shot and starred in. It pairs a Speyside malt with honeyed mead and a green tea soda for a long, lightly smoky serve.

Ingredients from Australian Bartender (https://australianbartender.com.au/2025/09/30/maybe-sammy-unveils-new-cocktail-menu-showtime/). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('1930cocktailbar', NULL, 'Tortellini in Brodo', 'Tortellini soaked in a nutmeg bourbon and vermouth mix, served in hot chicken broth; a Boulevardier-style drink.', 'The most talked-about ''first course'' on the 2025 menu turns Emilia''s classic soup into a warm cocktail. The pasta is pre-soaked in a Boulevardier-like blend of nutmeg-infused bourbon, Martini Riserva Rubino vermouth and bitters before it meets the broth, so you eat and drink the cocktail together.

Created by Benjamin Fabio Cavagna in 2025.

Ingredients from MT Magazine (https://blog.mtmagazine.it/en/the-new-1930-has-just-launched-a-gastronomic-cocktail-list/). No measures have been published.', 'Boulevardier', 2025, NULL, NULL, NULL),
    ('1930cocktailbar', NULL, 'Tacos de Carnita', 'Del Maguey Vida mezcal with pulled pork and Mexican spices, a smoky taco in liquid form.', 'A ''main course'' that press reports call the bar''s best seller since the gastronomic menu launched. It captures slow-cooked pork and taco spice in a smoky mezcal drink, the clearest example of 1930''s dishes-into-drinks approach.

Created by Benjamin Fabio Cavagna in 2025.

Ingredients from il Giornale (https://www.ilgiornale.it/news/cucina/1930-cocktail-mangiare-piatti-bere-2454063.html). No measures have been published.', NULL, 2025, NULL, NULL, NULL),
    ('1930cocktailbar', NULL, 'Parmigiano Colada', 'Rum and pineapple with Sarawak pepper and truffle, topped with a siphoned foam of 24-month Parmigiano Reggiano.', 'A Pina Colada where aged Parmigiano replaces the coconut: the cheese is blended until creamy and dispensed as a foam over the rum and pineapple. It became a viral hit for the bar, which keeps experimenting with different cheese ages and fruits.

Created by Benjamin Fabio Cavagna in 2025.

Method: Build rum, liqueur and pineapple over ice and top with Parmigiano foam from a siphon.

Ingredients from MT Magazine (https://blog.mtmagazine.it/en/the-new-1930-has-just-launched-a-gastronomic-cocktail-list/). No measures have been published.', 'Piña Colada', 2025, NULL, 'Cubes', 'Build'),
    ('1930cocktailbar', NULL, 'Caviar Martini', 'Salty gin with a caviar distillate and Empirical Ayuuk, a savoury Martini.', 'One of the ''unforgettables'' kept on the relaunched menu. The bar distils caviar in its lab to carry a clean briny note into the Martini, and reviewers single it out as a standout.

Ingredients from MT Magazine (https://blog.mtmagazine.it/en/the-new-1930-has-just-launched-a-gastronomic-cocktail-list/). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('1930cocktailbar', NULL, 'Caronte', 'Octopus-ink bourbon with red pepper dry vermouth, saffron and black rice gum syrups, absinthe and barbecue bitters.', 'Cavagna''s long-standing signature from the bar''s early years, dark as the ferryman it is named after. House infusions (squid-ink bourbon, pepper vermouth) and gum syrup for texture show his love of umami and savoury depth, and it is served with chocolate on the side.

Created by Benjamin Fabio Cavagna in 2016.

Method: Throw between tins (per The Pouring Tales) and strain.

Spec from Le Cocktail Connoisseur (https://lecocktailconnoisseur.com/2016/12/08/fabio-cavagna-1930-milan/).', NULL, 2016, NULL, NULL, 'Build'),
    ('jewelnola', NULL, 'Brandy Crusta', 'Cognac, dry curacao, lemon, maraschino and Angostura in a sugar-crusted glass with a long lemon peel collar.', 'The house signature and the reason for the bar''s name: Joseph Santini created the crusta at the original Jewel of the South in the 1850s, and it is often cited as the first cocktail with fresh citrus. Hannah is credited with bringing it back to New Orleans in 2004 and now pours it with Remy 1738 and Pierre Ferrand, plus a luxe ''Upper Crusta'' with XO cognac.

Created by Chris Hannah (after Joseph Santini) in 2019.

Method: Shake with ice and strain into a sugar-rimmed cocktail glass.

Spec from Punch (https://punchdrink.com/recipes/brandy-crusta/).', 'Brandy Crusta', 2019, 'Martini', NULL, 'Shake'),
    ('jewelnola', NULL, 'Jewel Sazerac', 'Sazerac 100-proof rye with Rainwater Madeira and rancio sec, demerara, Herbsaint and Peychaud''s.', 'A house take on New Orleans'' official cocktail that splits the base between high-proof rye and fortified and rancio wines, adding nutty, oxidative depth to the classic Herbsaint rinse. It sits among the bar''s permanent ''Jewel Classics''.

Created by Chris Hannah.

Ingredients from Jewel of the South menu (https://www.jewelnola.com/menus/). No measures have been published.', 'Sazerac', NULL, NULL, NULL, NULL),
    ('jewelnola', NULL, 'Night Tripper', 'Bourbon with Averna, Strega and Peychaud''s, pre-chilled and traditionally served from a flask.', 'Hannah''s tribute to Dr. John, whose nickname was the Night Tripper. Two Italian liqueurs give bittersweet herbal depth to the bourbon, and the drink is batched and chilled so it can be poured straight from a flask, a playful serve he brought over from Arnaud''s to Jewel''s classics list.

Created by Chris Hannah.

Method: Funnel into a flask, cap and chill. Serve from the flask or pour over ice.

Spec from Punch (https://punchdrink.com/recipes/night-tripper/).', NULL, NULL, 'Rocks', NULL, 'Build'),
    ('jewelnola', NULL, 'Bywater', 'Aged rum stirred with Averna, green Chartreuse, falernum and Peychaud''s and orange bitters.', 'Created by Hannah at Arnaud''s in 2007 and named for a New Orleans neighbourhood, it is a Southern cousin of the Brooklyn: rum replaces rye, Averna stands in for vermouth and falernum nods to the city''s Caribbean ties. Jewel now pours it with its own Zinfandel-cask Don Q private barrel.

Created by Chris Hannah in 2007.

Method: Stir with ice in a mixing glass and strain.

Spec from Punch (https://punchdrink.com/recipes/bywater/).', 'Brooklyn', 2007, 'Nick & Nora', NULL, 'Stir'),
    ('jewelnola', NULL, 'Pouves-Vous Poulet', 'Duck fat-washed rums with lapsang-smoked maple syrup and Caribbean bitters, an Old Fashioned-style sipper.', 'A savoury seasonal favourite built on fat washing: the rums pick up richness from rendered duck (and, per one report, chicken) fat, then smoky lapsang maple and Bitter Queen''s bitters round it out. Its pun name reflects the bar''s playful side.

Ingredients from Jewel of the South menu (https://www.jewelnola.com/menus/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('virtutokyo', NULL, 'Virtù Martini', 'Japanese gin and vodka with French vermouth and hinoki bitters, a Vesper-leaning house Martini.', 'The bar''s calling card distils its Paris-meets-Tokyo idea into one stirred drink: a gin and vodka split like a Vesper, French vermouth, and bitters scented with hinoki cypress for a woody, clean finish. The World''s 50 Best singles it out.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/asia/the-list/virtu.html). No measures have been published.', 'Vesper', NULL, NULL, NULL, NULL),
    ('virtutokyo', NULL, 'Smoked Ume Fashioned', 'House brandy umeshu with Michter''s bourbon, Japanese whisky and hinoki bitters, served smoked.', 'An Old Fashioned built around plum brandy the team makes in-house in the style of umeshu, layered with American and Japanese whiskies. Hinoki cypress bitters and smoke give it a distinctly Japanese aroma; it is the drink most often photographed at the bar.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/asia/the-list/virtu.html). No measures have been published.', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('virtutokyo', NULL, 'Fig Cognac & Spices', 'Cognac with fig, spices and chai-style black tea, clarified with milk into a silky after-dinner sipper.', 'Fits Virtù''s role as a cognac lounge: a milk-clarified punch that turns fig and warm spice into a clear, smooth nightcap. The 50 Best describes it as an indulgent after-dinner drink.

Method: Milk-clarified.

Ingredients from Tokyo MK (https://www.tokyomk.global/post/virt%C3%B9-four-seasons-hotel-tokyo). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('overstory', NULL, 'Terroir Old Fashioned', 'Reposado tequila with palo santo and sea salt the team harvests at Fort Tilden in Queens; earlier builds added Vin Jaune and yellow Chartreuse.', 'The bar''s signature, named for its sense of place: the salt is gathered by the team from the beach at Fort Tilden, a few miles from the bar, and palo santo adds a resinous, incense-like note to the agave. It has stayed on the menu while the rest of the list rotates.

Created by Harrison Ginsberg.

Ingredients from Overstory menu (https://www.overstory-nyc.com/). No measures have been published.', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('overstory', NULL, 'In the Clouds', 'Whiskey, Earl Grey and vanilla, clarified with milk and topped with champagne.', 'A long-running favourite that marries a milk punch with a champagne cocktail: bergamot tea and vanilla are clarified into a silky whiskey base, then lifted with bubbles. The 50 Best highlights it among the bar''s key drinks.

Method: Milk-clarified base topped with champagne.

Ingredients from Overstory menu (https://www.overstory-nyc.com/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('overstory', NULL, 'El Bandito', 'Tequila with tomato water, koseret, lime and yuzu kosho.', 'A savoury, herbaceous agave sour that pairs clear tomato water with koseret, an Ethiopian herb, and the citrus-chilli heat of yuzu kosho. It shows the bar''s habit of pairing agave with unexpected, globally sourced accents.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/overstory.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('overstory', NULL, 'Five Spice Milk Punch', 'Rum, dry curacao, peanut, sesame, five spice and lime, clarified with milk.', 'A current-menu milk punch that folds nutty peanut and sesame and Chinese five spice into a clear, silky rum drink, a good snapshot of the bar''s clarified-texture style.

Method: Milk-clarified.

Ingredients from Overstory menu (https://www.overstory-nyc.com/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('the.bar.in.front.of.the.bar', NULL, 'Kafeneio', 'Gin and vodka with Greek olive, air-dried salami, fortified wine and a touch of Skinos mastiha.', 'The menu calls it the house signature: a savoury Martini-style drink that bottles the smell of a traditional Greek kafeneio, with cured salami and olive alongside mastiha. It is a love letter to Athenian coffee-house culture.

Ingredients from The Bar in Front of the Bar menu (2025 PDF) (http://thebarinfrontofthebar.gr/wp-content/uploads/2025/12/menu-2025.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('the.bar.in.front.of.the.bar', NULL, 'Taco Margarita', 'Don Julio tequila with jalapeno and morita chillies, coriander, tomato water and a corn salt rim.', 'Meant to taste like a taco and a Margarita at once: corn salt plays the taco shell, while two chillies and tomato water add heat and savoury depth. Reviewers note it tastes uncannily like drinking a taco.

Ingredients from The Bar in Front of the Bar menu (2025 PDF) (http://thebarinfrontofthebar.gr/wp-content/uploads/2025/12/menu-2025.pdf). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('the.bar.in.front.of.the.bar', NULL, 'The Yellow House', 'Lost Explorer mezcal with lacto-fermented pineapple, Dijon mustard and black garlic.', 'Inspired by Van Gogh''s yellow house in Arles, it uses smoky mezcal for his intensity, a lacto-fermented pineapple for brightness and black garlic for earthy darkness. The Dijon mustard is an unexpected, sharp savoury note that press single out.

Ingredients from The Bar in Front of the Bar menu (2025 PDF) (http://thebarinfrontofthebar.gr/wp-content/uploads/2025/12/menu-2025.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('the.bar.in.front.of.the.bar', NULL, 'Talking Heads', 'Martini Bitter and Martini Rubino vermouth with kimchi distillate, papaya and green bell pepper, served long.', 'An Americano-style highball built from a collaboration between two bartenders. A kimchi distillate brings a funky, fermented edge while papaya and green pepper keep it fresh and vegetal.

Ingredients from The Bar in Front of the Bar menu (2025 PDF) (http://thebarinfrontofthebar.gr/wp-content/uploads/2025/12/menu-2025.pdf). No measures have been published.', 'Americano', NULL, NULL, NULL, NULL),
    ('the.bar.in.front.of.the.bar', NULL, 'Ali Bomaye', 'Johnnie Walker Black Label with Greek porcini, berries, miso and a little lactose.', 'Named for the crowd''s chant at the 1974 Rumble in the Jungle, the fight that gives the hidden back bar its name. Earthy porcini and umami miso meet dark berries over blended Scotch, and it arrives in a distinctive glass.

Ingredients from The Bar in Front of the Bar menu (2025 PDF) (http://thebarinfrontofthebar.gr/wp-content/uploads/2025/12/menu-2025.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('the_bellwood', NULL, 'Au Lait Not Martini', 'Barley shochu with Potosi coffee beans and clarified milk, served in a glass rimmed with miso powder.', 'The bar''s signature coffee drink, part of the Japanese-cafe side of The Bellwood. Milk clarification gives a silky, clear texture, and the miso rim sharpens the coffee with a salty, savoury edge. Later press lists it as the Martini au Lait.

Created by Atsushi Suzuki.

Method: Milk-clarified.

Ingredients from Wine & Spirits Association of All Japan (https://wine-spirits.blog/the-bellwood-creative-and-upscale-cocktails-in-shibuya/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('the_bellwood', NULL, 'Yakiniku Bloody', 'Smoked vodka with wagyu fat, yellow tomato and black garlic, a Bloody Mary tasting of Japanese barbecue.', 'Takes the Bloody Mary to a yakiniku grill: wagyu fat brings beefy richness, smoked vodka the char, and black garlic sweet umami, while yellow tomato keeps it lighter than a red base. Time Out Tokyo highlights it as a standout.

Created by Atsushi Suzuki.

Ingredients from Time Out Tokyo (https://www.timeout.com/tokyo/bars-and-pubs/the-bellwood). No measures have been published.', 'Bloody Mary', NULL, NULL, NULL, NULL),
    ('the_bellwood', NULL, 'Miyako Fizz', 'Zubrowka vodka with mulberry leaf, kombu and umeboshi, lengthened with soda.', 'A briny, umami highball that uses kombu kelp and pickled plum, core Japanese pantry ingredients, to season a bison-grass vodka. It is built to pair with savoury food, in keeping with the bar''s kaiseki framing.

Ingredients from Wine & Spirits Association of All Japan (https://wine-spirits.blog/the-bellwood-creative-and-upscale-cocktails-in-shibuya/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('the_bellwood', NULL, 'Yama no Highball', 'A mountain-themed highball with a tree-sap spirit, black cardamom and roasted bay leaves.', 'Suzuki imagined what he would want to drink at the top of a mountain, and built a woodsy highball around a spirit distilled from tree sap, smoky black cardamom and roasted bay.

Created by Atsushi Suzuki.

Ingredients from Tokyo Weekender (https://www.tokyoweekender.com/food-and-drink/the-bellwood-tokyo-cocktails/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('the_bellwood', NULL, 'Ne(w)groni', 'A Negroni reworked with distilled Tabasco and a vermouth made with fermented strawberry juice.', 'A late-2023 menu addition where Suzuki rebuilds the Negroni with lab techniques: a distilled Tabasco brings chilli character, and the vermouth element is made with fermented strawberry juice.

Created by Atsushi Suzuki in 2023.

Ingredients from Tokyo Weekender (https://www.tokyoweekender.com/food-and-drink/the-bellwood-tokyo-cocktails/). No measures have been published.', 'Negroni', 2023, NULL, NULL, NULL),
    ('bkksocialclub', NULL, 'Hand of God', 'Reposado tequila with Campari and a cacao and Malbec wine cordial, a Negroni-style stirred drink.', 'Named for Maradona''s infamous 1986 World Cup goal, it fuses the bar''s Argentine roots (Malbec) with Mexican agave. It outlived the Argentina menu and is now also sold bottled in 750 ml and three-litre formats.

Created by Philip Bischoff in 2020.

Ingredients from Asia Bars & Restaurants (https://www.asia-bars.com/2022/04/bkk-social-club-cocktail-bar-at-four-seasons-hotel-bangkok/). No measures have been published.', 'Negroni', 2020, NULL, NULL, NULL),
    ('bkksocialclub', NULL, 'Evita', 'Pineapple rum with Campari, Aperol, citrus, bay leaf and cinnamon syrup.', 'A tribute to Eva Peron from the opening Buenos Aires menu, pairing pineapple rum with two Italian bitters and warming it with bay leaf and cinnamon. The World''s 50 Best singled it out among the bar''s signatures.

Created by Philip Bischoff in 2020.

Ingredients from Asia Bars & Restaurants (https://www.asia-bars.com/2022/04/bkk-social-club-cocktail-bar-at-four-seasons-hotel-bangkok/). No measures have been published.', NULL, 2020, NULL, NULL, NULL),
    ('bkksocialclub', NULL, 'Bananazo', 'Michter''s US 1 bourbon with salted ripe banana and chocolate bitters, served with caviar.', 'A rich bourbon sipper from the Argentina menu that plays salted banana against chocolate bitters, with a bump of caviar adding a salty, luxurious contrast.

Created by Philip Bischoff in 2020.

Ingredients from Asia Bars & Restaurants (https://www.asia-bars.com/2022/04/bkk-social-club-cocktail-bar-at-four-seasons-hotel-bangkok/). No measures have been published.', NULL, 2020, NULL, NULL, NULL),
    ('bkksocialclub', NULL, 'Mezcal Negroni', 'Mezcal with pineapple-infused Campari, coffee vermouth and olive saline.', 'A current Mexico-menu take on the Negroni that swaps gin for mezcal and layers tropical, roasted and briny notes through a pineapple Campari, a coffee vermouth and a saline made with olive. 50 Best names it among the menu''s highlights.

Created by Philip Bischoff in 2024.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/the-list/bkk-social-club.html). No measures have been published.', 'Negroni', 2024, NULL, NULL, NULL),
    ('nutmegandclove', NULL, 'Nutmeg & Clove', 'Clove-spiced rum with gula melaka, lemon, cream and egg white, topped with ginger beer.', 'The bar''s namesake, placed first in the menu''s Hall of Fame of crowd favourites since 2014. It reads like a spiced, creamy fizz sweetened with gula melaka palm sugar, putting the two spices in the bar''s name into a highball.

Clove-infused spiced rum: Spiced rum infused with clove (no quantities published).

Spec from Le Cocktail Connoisseur (Shelley Tai) (https://lecocktailconnoisseur.com/2022/10/06/shelley-tai-nutmeg-clove-singapore/).', NULL, NULL, NULL, NULL, NULL),
    ('nutmegandclove', NULL, 'Michael Jackson Punch', 'Fernet-Branca and Braulio with a little gin, lime, soy milk, pandan vanilla syrup and toasted soy powder.', 'Shelley Tai''s pick as the bar''s signature in 2022: a creamy, amaro-heavy punch that softens Fernet-Branca with soy milk and pandan vanilla, finished with toasted soy powder.

Created by Shelley Tai.

Spec from Le Cocktail Connoisseur (Shelley Tai) (https://lecocktailconnoisseur.com/2022/10/06/shelley-tai-nutmeg-clove-singapore/).', NULL, NULL, NULL, NULL, NULL),
    ('nutmegandclove', NULL, 'Die Die Must Try', 'Blanco tequila and mezcal with green papaya, tomato, chilli, roasted garlic, gula melaka, shrimp, peanut, fish sauce and lime.', 'A liquid papaya salad from the 2026 Singlish menu, named for the local phrase for food worth dying for and nodding to the Thai eateries of Golden Mile Complex. Shrimp paste funk, peanut and fish sauce make it one of the most savoury drinks on the list.

Ingredients from Nutmeg & Clove menu (https://www.nutmegclove.com/_files/ugd/39dbee_02452c8c3601464f8fc41832ad27b01e.pdf). No measures have been published.', NULL, 2026, NULL, NULL, NULL),
    ('nutmegandclove', NULL, 'Stylo Milo', 'Maker''s Mark with barley shochu, Milo, white cacao, almond milk and peated whisky under a hojicha foam.', 'A Hall of Fame crowd favourite that turns Milo, the malted chocolate drink every Singaporean grows up on, into a creamy nightcap, with a wisp of peat and roasted tea foam for grown-up depth.

Ingredients from Nutmeg & Clove menu (https://www.nutmegclove.com/_files/ugd/39dbee_02452c8c3601464f8fc41832ad27b01e.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('nutmegandclove', NULL, 'Is It Really Boulevardier?', 'Woodford Reserve bourbon, Campari and sweet vermouth with pandan, coffee and coconut.', 'A Hall of Fame riff that keeps the Boulevardier''s bourbon, Campari and vermouth frame but seasons it with pandan, coconut and coffee, three flavours central to Singapore''s kopitiam culture.

Ingredients from Nutmeg & Clove menu (https://www.nutmegclove.com/_files/ugd/39dbee_02452c8c3601464f8fc41832ad27b01e.pdf). No measures have been published.', 'Boulevardier', NULL, NULL, NULL, NULL),
    ('tayer_elementary', NULL, 'Butter Martini', 'A stirred Martini of butter-washed Bombay Sapphire gin and Martini Bianco, garnished with a lacto-fermented gooseberry.', 'Monica Berg created this two-ingredient Martini at Tayēr + Elementary in London. It looks simple, but Punch reports it takes at least four days of prep for the butter wash and the fermented gooseberry garnish. Berg credits the quality of the butter, from the Norwegian farm Fannremsgården, as the real star, giving richness and a little acidity.

Created by Monica Berg.

Method: Stir all ingredients with ice and strain into a coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/butter-martini/).', NULL, NULL, 'Coupette', NULL, 'Stir'),
    ('sipandguzzlenyc', NULL, 'Sixty Forty', 'A stirred cross between a Martini and a Manhattan: gin, rye, dry and sweet vermouth, with touches of Seedlip Spice and Seedlip Garden.', 'Shingo Gokan created this drink for Sip, the lower level of his bi-level New York bar Sip & Guzzle. Punch describes it as built to taste like a Martini when ice-cold and to drift toward a Manhattan as it warms, splitting the base between gin and a little rye and using both vermouths. Head bartender Ben Yabrow says the two nonalcoholic Seedlip expressions work as seasoning, drawing out the gin''s wood and herbal notes.

Created by Shingo Gokan.

Method: Stir all ingredients with ice in a mixing glass and strain into a Martini glass.

Spec adapted from Punch (https://punchdrink.com/recipes/sixty-forty/).', NULL, NULL, 'Martini', NULL, 'Stir'),
    ('satans_whiskers', NULL, 'Dry Daiquiri', 'A Daiquiri dried out with Campari: lightly aged rum, lime, simple syrup and a dash of passion fruit syrup, served in a frozen coupe.', 'Kevin Armstrong created the Dry Daiquiri in 2005 at London''s Match Bar, adding Campari so the drink starts like a classic Daiquiri and finishes drier and more bitter. His trademark dash of passion fruit syrup rounds it out. It spread through London after Trailer Happiness put it on its menu in 2006, and Match alumni kept it alive at bars such as Happiness Forgets and Armstrong''s own Satan''s Whiskers.

Created by Kevin Armstrong in 2005.

Method: Shake all ingredients hard with ice and strain into a frozen coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/dry-daiquiri/).', NULL, 2005, 'Coupette', NULL, 'Shake'),
    ('sips.barcelona', NULL, 'Pink Chihuahua', 'A pink highball of two gins (one orange-infused) and dry sherry, topped with blood orange soda and grated lime zest.', 'Simone Caporale serves this highball at Sips in Barcelona, and it takes its name from its pink color. Punch frames it as a cross between a Sherry Cobbler and sangria: wine, citrus and sugar lengthened with a fizzy blood orange soda. Punch included it in a roundup of modern Kalimotxo-style wine highballs.

Created by Simone Caporale.

Method: Build all ingredients in a highball glass over ice.

Spec adapted from Punch (https://punchdrink.com/recipes/pink-chihuahua/).', NULL, NULL, 'Highball', NULL, 'Build'),
    ('jewelnola', NULL, 'Crusta Alcala', 'An agave Crusta of blanco tequila, mezcal, lime, yellow Chartreuse and crème de cacao, served in a glass with a coffee-sugar rim.', 'Chris Hannah created this tequila and mezcal riff on the Brandy Crusta at Jewel of the South, the French Quarter bar he opened with Nick Detrich in 2019. The bar takes its name from Joseph Santini''s 19th-century New Orleans saloon, where the original Crusta was invented, and the Brandy Crusta anchors its menu. Hannah swaps the usual sugar rim for a mix of ground coffee and sugar.

Created by Chris Hannah.

Method: Rim a cocktail glass with 1 part finely ground coffee to 2 parts sugar. Shake all ingredients with ice until chilled and strain into the rimmed glass.

Spec adapted from Punch (https://punchdrink.com/recipes/crusta-alcala/).', NULL, NULL, 'Martini', NULL, 'Shake'),
    ('jewelnola', NULL, 'Second Line Season', 'Calvados shaken with lemon, Amaro Montenegro, maraschino and Boker''s bitters, served over pebble ice in a half-sugared wine glass with dried apple.', 'Nick Detrich and Chris Hannah built this understated apple brandy drink for Jewel of the South, their 2019 revival of a historic New Orleans bar name in an 1830s Creole cottage in the French Quarter. The half-sugared rim nods to the Brandy Crusta, the drink the original Jewel''s owner Joseph Santini is credited with inventing.

Created by Nick Detrich and Chris Hannah.

Method: Wet the rim of a wine glass with a lemon wedge and coat half of it with a thin layer of sugar. Fill the glass with pebble ice and tuck 3 or 4 dried apple slices inside. Shake the ingredients with ice and strain into the prepared glass.

Spec adapted from Punch (https://punchdrink.com/recipes/second-line-season/).', NULL, NULL, 'Wine', NULL, 'Shake'),
    ('overstory', NULL, 'Chelsea Sidecar', 'A frothy gin sour of Roku gin, Cointreau, lemon, mandarin oleo saccharum and egg white, finished with drops of citrus oils.', 'Harrison Ginsberg''s Chelsea Sidecar is a reworked White Lady, the gin, Cointreau and lemon sour codified in the Savoy Cocktail Book. He renamed it around 2021 for the team behind Overstory and Saga in New York, feeling the old name had not aged well. His version uses citrusy Japanese Roku gin, a mandarin oleo saccharum for body and egg white for foam.

Created by Harrison Ginsberg in 2021.

Method: Dry shake all ingredients without ice, then add ice and shake again. Strain into a coupe and express a lemon twist over the top.

Spec adapted from Punch (https://punchdrink.com/recipes/chelsea-sidecar/).', NULL, 2021, 'Coupette', NULL, 'dry shake and shake'),
    (NULL, 'PDT', 'Benton''s Old Fashioned', 'An Old-Fashioned of bacon fat-washed bourbon sweetened with Grade B maple syrup and seasoned with Angostura bitters.', 'Don Lee created this drink at PDT in New York''s East Village, fat-washing bourbon with Benton''s smoky Tennessee bacon. The technique was seen as a hassle at first, but the drink became the bar''s bestseller; Punch reports PDT makes around 150 a week and goes through about 12 bottles of the washed bourbon in that time. The recipe comes from Jim Meehan''s The PDT Cocktail Book (2011).

Created by Don Lee.

Method: Stir all ingredients with ice in a mixing glass and strain into a rocks glass over a large cube. For the bourbon, melt 1.5 oz bacon fat (preferably Benton''s) over low heat, stir it into a 750 ml bottle of bourbon, infuse 4 hours, freeze 2 hours, remove the solid fat and fine-strain through cheesecloth.

Spec adapted from Punch (https://punchdrink.com/recipes/bentons-old-fashioned/).', NULL, NULL, 'Rocks', 'Large Cube', 'Stir'),
    (NULL, 'Employees Only', 'Ginger Smash', 'A muddled tequila smash of fresh ginger, kumquats and sugar with Clément Creole Shrubb and lime, poured unstrained over ice.', 'Dushan Zaric, a co-founder of Employees Only in New York, built this tequila version of the Ginger Smash. He muddles fresh ginger and kumquats with sugar and adds Rhum Clément''s Creole Shrubb, an orange liqueur, to play off the ginger''s spice. The drink is shaken briefly and dumped into the glass unstrained, ice and fruit included.

Created by Dushan Zaric.

Method: Muddle the ginger, kumquats and sugar in a shaker. Add the remaining ingredients and enough ice to fill a rocks glass, shake firmly but briefly, and pour everything unstrained into a rocks glass.

Spec adapted from Punch (https://punchdrink.com/recipes/ginger-smash/).', NULL, NULL, 'Rocks', NULL, 'muddle and shake'),
    (NULL, 'Trick Dog', 'I Am ... I Said', 'A crushed-ice sherry cooler of amontillado, genever and dry curaçao with lemon, a touch of syrup and a drop of menthol tincture.', 'Morgan Schick built this at Trick Dog in San Francisco as a cross between a Mint Julep and a Sherry Cobbler. He reached for genever because its malty character suits the nutty amontillado, and added curaçao as a nod to old cobbler recipes. The cooling hit comes from a single drop of menthol tincture, an idea he picked up from soap-making forums. The spec appears in Talia Baiocchi''s 2014 book Sherry.

Created by Morgan Schick.

Method: Shake all ingredients with ice and strain over crushed ice.

Spec adapted from Punch (https://punchdrink.com/recipes/i-am-i-said/).', NULL, NULL, 'Rocks', 'Crushed', 'Shake'),
    (NULL, 'Trick Dog', 'Natoma St.', 'A low-proof, equal-parts stirred drink of amontillado sherry, Gran Classico and dry vermouth, served over a big cube.', 'Caitlin Laman made this sherry-based Negroni riff at Trick Dog in San Francisco as something she could sip through a whole shift. Swapping gin for amontillado and sweet vermouth for dry keeps it bitter and herbal but light on alcohol. Punch featured it in 2015 in a round-up of low-proof stirred drinks chosen by bartenders.

Created by Caitlin Laman.

Method: Stir with ice and strain into a rocks glass over one large ice cube.

Spec adapted from Punch (https://punchdrink.com/recipes/natoma-st/).', NULL, NULL, 'Rocks', 'Large Cube', 'Stir'),
    (NULL, 'Clover Club', 'Gin Blossom', 'A soft, aromatic Martini riff of Plymouth gin and bianco vermouth in equal parts with apricot eau de vie and orange bitters.', 'Julie Reiner created the Gin Blossom in 2009 as a house drink for Clover Club in Brooklyn, working through versions at her Manhattan bar Flatiron Lounge. Apricot eau de vie from importer Haus Alpenz sparked the idea, and Plymouth gin won out because its lower proof lets the fruit and bianco vermouth show. It became a Clover Club bestseller and spread to menus across the country as drinkers looked for lighter Martinis.

Created by Julie Reiner in 2009.

Method: Stir with ice and strain into a coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/gin-blossom/).', NULL, 2009, 'Coupette', NULL, 'Stir'),
    (NULL, 'Clover Club', 'The Slope', 'Clover Club''s house Manhattan: rye stirred with Punt e Mes, a little apricot liqueur and Angostura bitters.', 'Julie Reiner put The Slope on the Clover Club menu in Brooklyn in 2008 as the bar''s house Manhattan. Punch files it with the wave of Brooklyn-neighborhood riffs that followed Milk & Honey''s Red Hook, though it plays more like a Manhattan than a Brooklyn. The apricot liqueur paired with Punt e Mes is a combination Reiner returns to in several of her drinks.

Created by Julie Reiner in 2008.

Method: Stir with ice and strain into a cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/the-slope/).', NULL, 2008, 'Martini', NULL, 'Stir'),
    (NULL, 'Pegu Club', 'French Pearl', 'A shaken, mint-muddled gin sour with lime and simple syrup, lifted by a small measure of pastis.', 'Audrey Saunders created the French Pearl at Pegu Club in New York in spring 2006, part of her push to get Americans drinking gin and pastis, two spirits few bartenders reached for at the time. The name nods to pastis''s 19th-century French heyday and to the pearly cloud it throws when mixed. It was slower to catch on than her Gin-Gin Mule and Old Cuban, but became a Pegu staple and later turned up on menus in London, Germany and Japan.

Created by Audrey Saunders in 2006.

Method: Muddle the lime juice, syrup and mint in a shaker. Add the gin, pastis and ice, shake until chilled and fine-strain into a coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/french-pearl/).', NULL, 2006, 'Coupette', NULL, 'muddle and shake'),
    (NULL, 'Dante', 'Garibaldi', 'Campari topped with freshly juiced, aerated fluffy orange juice, built over ice in a small highball.', 'The Garibaldi is an old two-ingredient Italian aperitivo, but Naren Young and his team at Dante in New York turned it into the bar''s signature. The trick is orange juice run through a high-speed Breville juicer to order, which whips air into it for a light, frothy texture; Young has said the bar did not invent the drink but perfected it. Its success set off a wave of riffs across the US, from frozen versions to tequila takes. The name honors Giuseppe Garibaldi, with red Campari from the north and Sicilian-style orange from the south standing for Italian unification.

Created by Naren Young.

Method: Build both ingredients in a small highball glass filled with ice and stir.

Spec adapted from Punch (https://punchdrink.com/recipes/dantes-garibaldi/).', NULL, NULL, 'Highball', NULL, 'Stir'),
    (NULL, 'Milk & Honey', 'Greenpoint', 'A stirred Brooklyn riff of rye, sweet vermouth and yellow Chartreuse with Angostura and orange bitters.', 'Michael McIlroy created the Greenpoint at Milk & Honey in New York in 2006, riffing on the Brooklyn, itself a Manhattan variation. It followed Vincenzo Errico''s Red Hook (2004) and is one of a run of Brooklyn-neighborhood drinks that bartenders made between 2004 and 2009, mostly at Manhattan bars. Despite the name it uses yellow Chartreuse, not green.

Created by Michael McIlroy in 2006.

Method: Stir with ice and strain into a coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/greenpoint/).', NULL, 2006, 'Coupette', NULL, 'Stir'),
    (NULL, 'The Dead Rabbit', 'Irish Coffee', 'Irish whiskey, hot coffee and demerara syrup in a small tulip glass under a float of barely whipped, unsweetened cream.', 'The Dead Rabbit in New York has served Irish Coffee since it opened in 2013, and Punch credits this spec to co-founder Jack McGarry. Keeping the coffee around 75 degrees avoids burnt, metallic notes, and the cream is unsweetened, about 35 percent fat, whipped just enough to float. In 2016 the bar reworked the drink with Dale DeGroff; Jillian Vose''s later spec uses 1.25 oz of Clontarf and drops the nutmeg, and the bar sells a few hundred a week.

Created by Jack McGarry in 2013.

Method: Add the whiskey, coffee and syrup to the glass, then float the whipped cream on top.

Spec adapted from Punch (https://punchdrink.com/recipes/the-dead-rabbit-irish-coffee/).', NULL, 2013, NULL, NULL, NULL);

INSERT INTO "seed_lines" VALUES
    ('barleonehk', NULL, 'Olive Oil Sour', 0, 1, 'oz', 'Maker''s Mark Bourbon', 'Bourbon Whiskey', NULL, false),
    ('barleonehk', NULL, 'Olive Oil Sour', 1, 0.67, 'oz', 'Vecchia Romagna Etichetta Nera Italian Brandy', 'Italian Brandy', NULL, false),
    ('barleonehk', NULL, 'Olive Oil Sour', 2, 0.33, 'oz', 'Lustau Oloroso Don Nuño Sherry', 'Oloroso Sherry', 'chilled', false),
    ('barleonehk', NULL, 'Olive Oil Sour', 3, 0.5, 'oz', 'Honey Syrup', NULL, '3 parts honey to 1 part water by weight', false),
    ('barleonehk', NULL, 'Olive Oil Sour', 4, 0.5, 'oz', 'Lemon Juice', NULL, 'fresh', false),
    ('barleonehk', NULL, 'Olive Oil Sour', 5, 0.17, 'oz', 'Extra Virgin Olive Oil', NULL, NULL, false),
    ('barleonehk', NULL, 'Olive Oil Sour', 6, 0.5, 'oz', 'Egg White', NULL, 'pasteurised, or 3 dashes foamer', false),
    ('barleonehk', NULL, 'Olive Oil Sour', 7, NULL, NULL, 'Freshly grated nutmeg', NULL, 'garnish', false),
    ('barleonehk', NULL, 'Filthy Martini', 0, 70, 'ml', 'Vodka', NULL, NULL, false),
    ('barleonehk', NULL, 'Filthy Martini', 1, 15, 'ml', 'Smoked Olive Brine', NULL, 'house-made', false),
    ('barleonehk', NULL, 'Filthy Martini', 2, NULL, NULL, 'Smoked olive', NULL, 'garnish', false),
    ('barleonehk', NULL, 'Yuzu Negroni', 0, 22.5, 'ml', 'Gin', NULL, NULL, false),
    ('barleonehk', NULL, 'Yuzu Negroni', 1, 22.5, 'ml', 'Gentian Aperitif', NULL, 'Drinks International lists Suze', false),
    ('barleonehk', NULL, 'Yuzu Negroni', 2, 15, 'ml', 'Bianco Vermouth', NULL, NULL, false),
    ('barleonehk', NULL, 'Yuzu Negroni', 3, 7.5, 'ml', 'Yuzu Liqueur', NULL, NULL, false),
    ('barleonehk', NULL, 'Yuzu Negroni', 4, NULL, NULL, 'Lemon peel', NULL, 'garnish', false),
    ('barleonehk', NULL, 'Leone Martini', 0, NULL, NULL, 'Gin', NULL, 'Italian', false),
    ('barleonehk', NULL, 'Leone Martini', 1, NULL, NULL, 'Marsala', NULL, NULL, false),
    ('barleonehk', NULL, 'Leone Martini', 2, NULL, NULL, 'Orange Blossom Water', NULL, NULL, false),
    ('barleonehk', NULL, 'Leone Martini', 3, NULL, NULL, 'Almond-stuffed olive', NULL, 'garnish', false),
    ('barleonehk', NULL, 'Caffè Paradiso', 0, 60, 'ml', 'Brew Coffee', NULL, NULL, false),
    ('barleonehk', NULL, 'Caffè Paradiso', 1, 20, 'ml', 'Scotch Whisky', NULL, NULL, false),
    ('barleonehk', NULL, 'Caffè Paradiso', 2, 20, 'ml', 'Amaro Lucano', 'Amaro', NULL, false),
    ('barleonehk', NULL, 'Caffè Paradiso', 3, 10, 'ml', 'Vermouth di Torino', NULL, NULL, false),
    ('barleonehk', NULL, 'Caffè Paradiso', 4, 7.5, 'ml', 'Honey Syrup', NULL, NULL, false),
    ('barleonehk', NULL, 'Caffè Paradiso', 5, 2.5, 'ml', 'French Herbal Liqueur', NULL, NULL, false),
    ('barleonehk', NULL, 'Caffè Paradiso', 6, NULL, NULL, 'Salted Double Cream', NULL, '5 g', false),
    ('barleonehk', NULL, 'Caffè Paradiso', 7, 1, NULL, 'Green Cardamom Pod', NULL, 'for grating', false),
    ('barleonehk', NULL, 'Caffè Paradiso', 8, NULL, NULL, 'Grated green cardamom', NULL, 'garnish', false),
    ('handshake_bar', NULL, 'Fig Martini', 0, NULL, NULL, 'Gin', NULL, 'dry', false),
    ('handshake_bar', NULL, 'Fig Martini', 1, NULL, NULL, 'Cinzano Blanco Vermouth', 'Blanco Vermouth', NULL, false),
    ('handshake_bar', NULL, 'Fig Martini', 2, NULL, NULL, 'Fig Leaf Cordial', NULL, 'house-made, 48-hour sous vide', false),
    ('handshake_bar', NULL, 'Fig Martini', 3, NULL, NULL, 'Lemon oil and half a fresh fig', NULL, 'garnish', false),
    ('handshake_bar', NULL, 'Mexi-Thai', 0, NULL, NULL, 'Blanco Tequila', NULL, 'coconut oil fat-washed', false),
    ('handshake_bar', NULL, 'Mexi-Thai', 1, NULL, NULL, 'Makrut Lime Leaf Distillate', NULL, 'house-made', false),
    ('handshake_bar', NULL, 'Mexi-Thai', 2, NULL, NULL, 'Clarified Tomato Cordial', NULL, 'house-made', false),
    ('handshake_bar', NULL, 'Mexi-Thai', 3, 3, 'drop', 'Basil Oil', NULL, 'garnish', false),
    ('handshake_bar', NULL, 'Mexi-Thai', 4, NULL, NULL, 'Three drops of basil oil', NULL, 'garnish', false),
    ('handshake_bar', NULL, 'Salt N Pepper', 0, 30, 'ml', 'Lost Explorer Mezcal', 'Mezcal', 'strawberry-infused', false),
    ('handshake_bar', NULL, 'Salt N Pepper', 1, 90, 'ml', 'Yellow Bell Pepper Soda', NULL, 'house-made', false),
    ('handshake_bar', NULL, 'Salt N Pepper', 2, 3, 'dash', 'Habanero Tincture', NULL, NULL, false),
    ('handshake_bar', NULL, 'Salt N Pepper', 3, NULL, NULL, 'Bell pepper powder on one side of the rim', NULL, 'garnish', false),
    ('handshake_bar', NULL, 'Peanut Butter Jelly', 0, NULL, NULL, 'Belvedere Vodka', 'Vodka', 'distilled with peanut butter, then raspberry-infused', false),
    ('handshake_bar', NULL, 'Peanut Butter Jelly', 1, NULL, NULL, 'Raspberry Cordial', NULL, NULL, false),
    ('handshake_bar', NULL, 'Peanut Butter Jelly', 2, NULL, NULL, 'Cocchi Rosa Rosé Vermouth', 'Rosé Vermouth', NULL, false),
    ('handshake_bar', NULL, 'Peanut Butter Jelly', 3, NULL, NULL, 'Raspberry Vinegar', NULL, 'a touch', false),
    ('handshake_bar', NULL, 'Peanut Butter Jelly', 4, NULL, NULL, 'Salt', NULL, NULL, false),
    ('handshake_bar', NULL, 'Peanut Butter Jelly', 5, NULL, NULL, 'Served with a PB&J sandwich', NULL, 'garnish', false),
    ('sips.barcelona', NULL, 'Primordial', 0, NULL, NULL, 'Scotch Whisky', NULL, '12 year old', false),
    ('sips.barcelona', NULL, 'Primordial', 1, NULL, NULL, 'Ruby Port', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Primordial', 2, NULL, NULL, 'Nashi Pear', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Krypta', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Krypta', 1, NULL, NULL, 'Armagnac', NULL, 'one press review lists calvados instead', false),
    ('sips.barcelona', NULL, 'Krypta', 2, NULL, NULL, 'Clarified Green Kiwi', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Sips Adonis', 0, 45, 'ml', 'Martini Riserva Speciale Rubino Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('sips.barcelona', NULL, 'Sips Adonis', 1, 25, 'ml', 'Palo Cortado Sherry', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Sips Adonis', 2, 20, 'ml', 'Noilly Prat Extra Dry Vermouth', 'Extra Dry Vermouth', NULL, false),
    ('sips.barcelona', NULL, 'Sips Adonis', 3, 10, 'ml', 'Santoni', 'Red Aperitivo', NULL, false),
    ('sips.barcelona', NULL, 'Sips Adonis', 4, NULL, NULL, 'Orange zest twist', NULL, 'garnish', false),
    ('sips.barcelona', NULL, 'Sips Sgroppino', 0, 1.5, 'oz', 'Savoia Americano Rosso', 'Americano Rosso', NULL, false),
    ('sips.barcelona', NULL, 'Sips Sgroppino', 1, 0.5, 'oz', 'Italicus', 'Bergamot Liqueur', NULL, false),
    ('sips.barcelona', NULL, 'Sips Sgroppino', 2, 1, NULL, 'Raspberry Sorbet', NULL, '1 scoop', false),
    ('sips.barcelona', NULL, 'Sips Sgroppino', 3, 3, 'oz', 'Fiol Extra Dry', 'Prosecco', NULL, false),
    ('sips.barcelona', NULL, 'Sips Sgroppino', 4, NULL, NULL, 'Edible flower or freeze-dried raspberry', NULL, 'garnish', false),
    ('sips.barcelona', NULL, 'Mil Fulls', 0, NULL, NULL, 'Grey Goose Vodka', 'Vodka', NULL, false),
    ('sips.barcelona', NULL, 'Mil Fulls', 1, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Mil Fulls', 2, NULL, NULL, 'Lemon Tree Leaves', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Mil Fulls', 3, NULL, NULL, 'Schweppes', 'Soda', NULL, false),
    ('paradiso_barcelona', NULL, 'Mediterranean Treasure', 0, NULL, NULL, 'Ketel One Vodka', 'Vodka', NULL, false),
    ('paradiso_barcelona', NULL, 'Mediterranean Treasure', 1, NULL, NULL, 'Fino Sherry', NULL, 'infused with oyster leaves', false),
    ('paradiso_barcelona', NULL, 'Mediterranean Treasure', 2, NULL, NULL, 'St-Germain', 'Elderflower Liqueur', NULL, false),
    ('paradiso_barcelona', NULL, 'Mediterranean Treasure', 3, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Mediterranean Treasure', 4, NULL, NULL, 'Agave Syrup', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Mediterranean Treasure', 5, NULL, NULL, 'Coriander', NULL, '6 to 8 fresh leaves', false),
    ('paradiso_barcelona', NULL, 'Mediterranean Treasure', 6, NULL, NULL, 'Egg White', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Supercool Martini', 0, NULL, NULL, 'Paradiso White Truffle Gin', 'White Truffle Gin', NULL, false),
    ('paradiso_barcelona', NULL, 'Supercool Martini', 1, NULL, NULL, 'Mancino Secco Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('paradiso_barcelona', NULL, 'Supercool Martini', 2, NULL, NULL, 'Mustard Seed', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Supercool Martini', 3, NULL, NULL, 'Gordal Olive', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Kriptonite', 0, NULL, NULL, 'MG Paradiso Gin', 'Gin', NULL, false),
    ('paradiso_barcelona', NULL, 'Kriptonite', 1, NULL, NULL, 'Shiso, Lemongrass and Sichuan Pepper', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Kriptonite', 2, NULL, NULL, 'Riboflavin', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Kriptonite', 3, NULL, NULL, 'Electric Liqueur', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Kriptonite', 4, NULL, NULL, 'Grapefruit Cordial', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Kriptonite', 5, NULL, NULL, 'Chocolate Bitters', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Kriptonite', 6, NULL, NULL, 'Makrut Lime Essential Oil', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Great Gatsby', 0, NULL, NULL, 'The Macallan 12 Double Cask Scotch', 'Scotch Whisky', NULL, false),
    ('paradiso_barcelona', NULL, 'Great Gatsby', 1, NULL, NULL, 'White Truffle Honey', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Great Gatsby', 2, NULL, NULL, 'Amaro', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Great Gatsby', 3, NULL, NULL, 'Lavender Essence', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Fleming', 0, NULL, NULL, 'Tequila', NULL, 'infused overnight with black miso', false),
    ('paradiso_barcelona', NULL, 'Fleming', 1, NULL, NULL, 'Grapefruit Juice', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Fleming', 2, NULL, NULL, 'Kefir Water', NULL, 'infused with grapefruit peels', false),
    ('paradiso_barcelona', NULL, 'Fleming', 3, NULL, NULL, 'Dry Vermouth', NULL, NULL, false),
    ('paradiso_barcelona', NULL, 'Fleming', 4, NULL, NULL, 'Beer Syrup', NULL, 'equal parts weissbier and sugar', false),
    ('paradiso_barcelona', NULL, 'Fleming', 5, NULL, NULL, 'Coconut Milk and Rice Milk', NULL, 'infused with lemongrass, makrut lime, lemon balm, ginger and coriander; used to clarify', false),
    ('paradiso_barcelona', NULL, 'Fleming', 6, NULL, NULL, 'Koji rim', NULL, 'garnish', false),
    ('tayer_elementary', NULL, 'One Sip Martini', 0, 1, 'oz', 'Tayēr Vodka', 'Vodka', NULL, false),
    ('tayer_elementary', NULL, 'One Sip Martini', 1, 0.5, 'oz', 'Martini & Rossi Riserva Speciale Ambrato Vermouth', 'Ambrato Vermouth', NULL, false),
    ('tayer_elementary', NULL, 'One Sip Martini', 2, 1, 'tsp', 'Una Palma Fino Sherry', 'Fino Sherry', NULL, false),
    ('tayer_elementary', NULL, 'One Sip Martini', 3, 1, NULL, 'Gordal Olive', NULL, 'stuffed with Gorgonzola, for garnish', false),
    ('tayer_elementary', NULL, 'One Sip Martini', 4, NULL, NULL, 'Gorgonzola-stuffed gordal olive', NULL, 'garnish', false),
    ('connaughtbar', NULL, 'Connaught Martini', 0, NULL, NULL, 'Tanqueray No. Ten Gin', 'Gin', NULL, false),
    ('connaughtbar', NULL, 'Connaught Martini', 1, NULL, NULL, 'Dry Vermouth Blend', NULL, 'house blend', false),
    ('connaughtbar', NULL, 'Connaught Martini', 2, NULL, NULL, 'Bitters', NULL, 'guest''s choice of house-made bitters', false),
    ('connaughtbar', NULL, 'Mulata Daisy', 0, 1, 'bsp', 'Fennel Seeds', NULL, NULL, false),
    ('connaughtbar', NULL, 'Mulata Daisy', 1, 1, 'bsp', 'Powdered Sugar', NULL, NULL, false),
    ('connaughtbar', NULL, 'Mulata Daisy', 2, 0.67, 'oz', 'Lime Juice', NULL, 'fresh', false),
    ('connaughtbar', NULL, 'Mulata Daisy', 3, 1.67, 'oz', 'White Rum', NULL, 'the bar uses Bacardi Heritage', false),
    ('connaughtbar', NULL, 'Mulata Daisy', 4, 0.33, 'oz', 'Galliano L''Autentico', 'Galliano', NULL, false),
    ('connaughtbar', NULL, 'Mulata Daisy', 5, 0.5, 'oz', 'Dark Crème de Cacao', NULL, NULL, false),
    ('connaughtbar', NULL, 'Mulata Daisy', 6, NULL, NULL, 'Chocolate powder rim', NULL, 'garnish', false),
    ('connaughtbar', NULL, 'Connaught Bloody Mary', 0, 1.75, 'oz', 'Vodka', NULL, 'or gin or tequila; the bar menu uses Ketel One', false),
    ('connaughtbar', NULL, 'Connaught Bloody Mary', 1, 3.5, 'oz', 'Tomato Juice', NULL, 'fresh', false),
    ('connaughtbar', NULL, 'Connaught Bloody Mary', 2, 0.75, 'oz', 'Bloody Mary Mix', NULL, 'house-made', false),
    ('connaughtbar', NULL, 'Connaught Bloody Mary', 3, 0.5, 'oz', 'Lemon Juice', NULL, 'fresh', false),
    ('connaughtbar', NULL, 'Connaught Bloody Mary', 4, NULL, 'top', 'Celery Air', NULL, 'house-made', false),
    ('connaughtbar', NULL, 'Connaught Bloody Mary', 5, NULL, NULL, 'Nutmeg', NULL, 'freshly grated', false),
    ('connaughtbar', NULL, 'Connaught Bloody Mary', 6, NULL, NULL, 'Celery air and grated nutmeg', NULL, 'garnish', false),
    ('connaughtbar', NULL, 'Number 11', 0, NULL, NULL, 'Grey Goose Vodka', 'Vodka', NULL, false),
    ('connaughtbar', NULL, 'Number 11', 1, NULL, NULL, 'Fords Gin', 'Gin', NULL, false),
    ('connaughtbar', NULL, 'Number 11', 2, NULL, NULL, 'Martini Ambrato Vermouth', 'Ambrato Vermouth', NULL, false),
    ('connaughtbar', NULL, 'Number 11', 3, NULL, NULL, 'Amalfi Lemon Oil', NULL, NULL, false),
    ('connaughtbar', NULL, 'Number 11', 4, NULL, NULL, 'Bitters Distillate', NULL, 'cardamom, tonka bean, ginseng and bergamot, lavender, coriander seed', false),
    ('connaughtbar', NULL, 'Kyuzu', 0, NULL, NULL, 'Suntory Hibiki Harmony Japanese Whisky', 'Japanese Whisky', NULL, false),
    ('connaughtbar', NULL, 'Kyuzu', 1, NULL, NULL, 'Black Yuzu Cordial', NULL, NULL, false),
    ('connaughtbar', NULL, 'Kyuzu', 2, NULL, NULL, 'Japanese Rice Orgeat', NULL, NULL, false),
    ('connaughtbar', NULL, 'Kyuzu', 3, NULL, NULL, 'Tonka Bitters', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Pesto Martini', 0, NULL, NULL, 'Altamura Vodka', 'Vodka', NULL, false),
    ('moebiusmilano', NULL, 'Pesto Martini', 1, NULL, NULL, 'Vermouth', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Pesto Martini', 2, NULL, NULL, 'Pesto', NULL, 'house-made', false),
    ('moebiusmilano', NULL, 'Pesto Martini', 3, NULL, NULL, 'White Balsamic Vinegar', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Peach Vodka Soda', 0, NULL, NULL, 'Vodka', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Peach Vodka Soda', 1, NULL, NULL, 'Peach', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Peach Vodka Soda', 2, NULL, NULL, 'Basil', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Peach Vodka Soda', 3, NULL, 'top', 'Soda', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Winter Melon Negroni', 0, NULL, NULL, 'Bulldog Gin', 'Gin', NULL, false),
    ('moebiusmilano', NULL, 'Winter Melon Negroni', 1, NULL, NULL, 'Campari', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Winter Melon Negroni', 2, NULL, NULL, 'Vermouth del Professore Rosso', 'Sweet Vermouth', NULL, false),
    ('moebiusmilano', NULL, 'Winter Melon Negroni', 3, NULL, NULL, 'Winter Melon', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Winter Melon Negroni', 4, NULL, NULL, 'Balsamic Vinegar', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Winter Melon Negroni', 5, NULL, NULL, 'Feta', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Tzatziki Highball', 0, NULL, NULL, 'Espolòn Blanco Tequila', 'Blanco Tequila', NULL, false),
    ('moebiusmilano', NULL, 'Tzatziki Highball', 1, NULL, NULL, 'Yogurt', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Tzatziki Highball', 2, NULL, NULL, 'Coconut Water', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Tzatziki Highball', 3, NULL, NULL, 'Cucumber', NULL, NULL, false),
    ('moebiusmilano', NULL, 'Tzatziki Highball', 4, NULL, 'top', 'Three Cents Aegean', 'Tonic Water', NULL, false),
    ('moebiusmilano', NULL, 'Tzatziki Highball', 5, NULL, NULL, 'Dill Oil', NULL, NULL, false),
    ('line.athens', NULL, 'Delusional Margarita', 0, NULL, NULL, 'Reposado Tequila', NULL, NULL, false),
    ('line.athens', NULL, 'Delusional Margarita', 1, NULL, NULL, 'Mustard', NULL, NULL, false),
    ('line.athens', NULL, 'Delusional Margarita', 2, NULL, NULL, 'Ketchup', NULL, NULL, false),
    ('line.athens', NULL, 'Delusional Margarita', 3, NULL, NULL, 'Potato Water', NULL, NULL, false),
    ('line.athens', NULL, 'Delusional Margarita', 4, NULL, NULL, 'Spices', NULL, NULL, false),
    ('line.athens', NULL, 'Leftover Spritz', 0, NULL, NULL, 'Line', 'Leftover Spirit', 'house-made', false),
    ('line.athens', NULL, 'Leftover Spritz', 1, NULL, NULL, 'Rosé Wine', NULL, 'Fokiano grape', false),
    ('line.athens', NULL, 'Leftover Spritz', 2, NULL, NULL, 'Tomato', NULL, NULL, false),
    ('line.athens', NULL, 'Leftover Spritz', 3, NULL, NULL, 'Cardamom', NULL, NULL, false),
    ('line.athens', NULL, 'Leftover Spritz', 4, NULL, NULL, 'Elderflower', NULL, NULL, false),
    ('line.athens', NULL, 'Porn Star Spritz', 0, NULL, NULL, 'Finlandia Vodka', 'Vodka', NULL, false),
    ('line.athens', NULL, 'Porn Star Spritz', 1, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('line.athens', NULL, 'Porn Star Spritz', 2, NULL, NULL, 'Brown Butter', NULL, 'beurre noisette', false),
    ('line.athens', NULL, 'Porn Star Spritz', 3, NULL, NULL, 'Bitter', NULL, NULL, false),
    ('line.athens', NULL, 'Porn Star Spritz', 4, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('line.athens', NULL, 'Porn Star Spritz', 5, NULL, 'top', 'Three Cents', 'Tonic Water', NULL, false),
    ('line.athens', NULL, 'Line''s Cobbler', 0, NULL, NULL, 'Axia', 'Mastiha', NULL, false),
    ('line.athens', NULL, 'Line''s Cobbler', 1, NULL, NULL, 'Line Symposium Sweet Vermouth', 'Sweet Vermouth', 'house-made', false),
    ('line.athens', NULL, 'Line''s Cobbler', 2, NULL, NULL, 'Line', 'Grenadine', 'house-made', false),
    ('line.athens', NULL, 'Line''s Cobbler', 3, NULL, NULL, 'Line', 'Pomegranate Why-in', 'house fruit wine', false),
    ('jiggerandponysg', NULL, 'Red Revival', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('jiggerandponysg', NULL, 'Red Revival', 1, NULL, NULL, 'Beetroot', NULL, NULL, false),
    ('jiggerandponysg', NULL, 'Red Revival', 2, NULL, NULL, 'Coffee', NULL, 'house-roasted', false),
    ('jiggerandponysg', NULL, 'Red Revival', 3, NULL, NULL, 'Strawberry', NULL, NULL, false),
    ('jiggerandponysg', NULL, 'Jigger & Pony Paloma', 0, NULL, NULL, 'Aged Tequila', NULL, 'slightly smoky', false),
    ('jiggerandponysg', NULL, 'Jigger & Pony Paloma', 1, NULL, NULL, 'Guava and Pink Grapefruit Soda', NULL, 'house-made', false),
    ('jiggerandponysg', NULL, 'Jigger & Pony Paloma', 2, NULL, NULL, 'Peeled grapefruit wedge', NULL, 'garnish', false),
    ('jiggerandponysg', NULL, 'White Toreador', 0, NULL, NULL, 'Código 1530 Blanco Tequila', 'Blanco Tequila', 'part fat-washed with Greek yoghurt', false),
    ('jiggerandponysg', NULL, 'White Toreador', 1, NULL, NULL, 'Merlet', 'Apricot Liqueur', NULL, false),
    ('jiggerandponysg', NULL, 'White Toreador', 2, NULL, NULL, 'Lime Juice', NULL, 'fresh', false),
    ('jiggerandponysg', NULL, 'White Toreador', 3, NULL, NULL, 'Egg White', NULL, NULL, false),
    ('jiggerandponysg', NULL, 'Funky Panky', 0, NULL, NULL, 'Stranger & Sons Gin', 'Gin', NULL, false),
    ('jiggerandponysg', NULL, 'Funky Panky', 1, NULL, NULL, 'Starter Culture', 'Tuak', 'rice wine; fortified with baijiu', false),
    ('jiggerandponysg', NULL, 'Funky Panky', 2, NULL, NULL, 'Cocchi', NULL, NULL, false),
    ('jiggerandponysg', NULL, 'Funky Panky', 3, NULL, NULL, 'Agarwood', NULL, NULL, false),
    ('jiggerandponysg', NULL, 'Funky Panky', 4, NULL, NULL, 'Herbal Amaro', NULL, 'house-made from Malaysian herbal tea', false),
    ('jiggerandponysg', NULL, 'Funky Panky', 5, NULL, NULL, 'Chrysanthemum flower', NULL, 'garnish', false),
    ('jiggerandponysg', NULL, 'Ugly Tomatoes', 0, NULL, NULL, 'Hapusa Gin', 'Gin', NULL, false),
    ('jiggerandponysg', NULL, 'Ugly Tomatoes', 1, NULL, NULL, 'Heirloom Tomatoes', NULL, 'imperfect ''ugly'' beefsteak tomatoes', false),
    ('jiggerandponysg', NULL, 'Ugly Tomatoes', 2, NULL, NULL, 'Kümmel', NULL, NULL, false),
    ('jiggerandponysg', NULL, 'Ugly Tomatoes', 3, NULL, NULL, 'Seedlip Spice 94', 'Non-alcoholic Spirit', NULL, false),
    ('3monosbar', NULL, 'Julep de D10S', 0, NULL, NULL, 'Tres Monos', 'Licor Del Norte', 'house herbal liqueur of three Argentine botanicals', false),
    ('3monosbar', NULL, 'Julep de D10S', 1, NULL, NULL, 'Amaro', NULL, 'a blend of amari', false),
    ('3monosbar', NULL, 'Julep de D10S', 2, NULL, NULL, 'Strawberry Miso', NULL, NULL, false),
    ('3monosbar', NULL, 'Julep de D10S', 3, NULL, NULL, 'Grapefruit', NULL, NULL, false),
    ('3monosbar', NULL, 'El Triple Tini', 0, NULL, NULL, 'Sake', NULL, NULL, false),
    ('3monosbar', NULL, 'El Triple Tini', 1, NULL, NULL, 'Dry Vermouth', NULL, NULL, false),
    ('3monosbar', NULL, 'El Triple Tini', 2, NULL, NULL, 'Strawberry', NULL, NULL, false),
    ('3monosbar', NULL, 'El Triple Tini', 3, NULL, NULL, 'Orange', NULL, NULL, false),
    ('3monosbar', NULL, 'El Triple Tini', 4, NULL, NULL, 'Celery', NULL, NULL, false),
    ('3monosbar', NULL, 'Misticollins', 0, NULL, NULL, 'Tres Monos Sake', 'Sake', 'house-made', false),
    ('3monosbar', NULL, 'Misticollins', 1, NULL, NULL, 'London Dry Gin', NULL, '2023 version; Punch lists mezcal or tequila', false),
    ('3monosbar', NULL, 'Misticollins', 2, NULL, NULL, 'Aloe Vera', NULL, NULL, false),
    ('3monosbar', NULL, 'Misticollins', 3, NULL, NULL, 'Cucumber', NULL, NULL, false),
    ('3monosbar', NULL, 'Misticollins', 4, NULL, NULL, 'Olive Brine', NULL, 'Alfonso olives', false),
    ('3monosbar', NULL, 'Misticollins', 5, NULL, 'top', 'Tonic Water', NULL, NULL, false),
    ('3monosbar', NULL, 'Golden Curry', 0, NULL, NULL, 'Japanese Whisky', NULL, NULL, false),
    ('3monosbar', NULL, 'Golden Curry', 1, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('3monosbar', NULL, 'Golden Curry', 2, NULL, NULL, 'Curry Spices', NULL, NULL, false),
    ('3monosbar', NULL, 'Fresco y Batata', 0, NULL, NULL, 'Whisky', NULL, NULL, false),
    ('3monosbar', NULL, 'Fresco y Batata', 1, NULL, NULL, 'Parmesan Cheese', NULL, NULL, false),
    ('3monosbar', NULL, 'Fresco y Batata', 2, NULL, NULL, 'Sweet Potato Jam', NULL, NULL, false),
    ('3monosbar', NULL, 'Fresco y Batata', 3, NULL, NULL, 'Toasted Walnuts', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Petronio', 0, NULL, NULL, 'Patrón Reposado Tequila', 'Reposado Tequila', NULL, false),
    ('alquimicocartagena', NULL, 'Petronio', 1, NULL, NULL, 'Viche', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Petronio', 2, NULL, NULL, 'Lulo Purée', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Petronio', 3, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Mango', 0, NULL, NULL, 'Patrón Reposado Tequila', 'Reposado Tequila', NULL, false),
    ('alquimicocartagena', NULL, 'Mango', 1, NULL, NULL, 'Mango Vermouth', NULL, 'house-made', false),
    ('alquimicocartagena', NULL, 'Mango', 2, NULL, NULL, 'Palm Wine', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Mango', 3, NULL, NULL, 'Hops', NULL, 'maceration', false),
    ('alquimicocartagena', NULL, 'Selva Martini', 0, NULL, NULL, 'Gin or Vodka', NULL, 'menu lists Tanqueray No. Ten gin; 50 Best feature says vodka', false),
    ('alquimicocartagena', NULL, 'Selva Martini', 1, NULL, NULL, 'Jungle Vermouth', NULL, 'house-made from native Colombian herbs', false),
    ('alquimicocartagena', NULL, 'Selva Martini', 2, NULL, NULL, 'Mambe Oil', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Alquímico Negroni', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Alquímico Negroni', 1, NULL, NULL, 'Mead', NULL, 'house-made', false),
    ('alquimicocartagena', NULL, 'Alquímico Negroni', 2, NULL, NULL, 'Campari', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Alquímico Negroni', 3, NULL, NULL, 'Blackberry', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Alquímico Negroni', 4, NULL, NULL, 'Limoncello', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Alquímico Negroni', 5, NULL, NULL, 'Wormwood', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Salitre', 0, 2, 'tbsp', 'Lime Juice', NULL, 'fresh; keep a wedge for the rim', false),
    ('alquimicocartagena', NULL, 'Salitre', 1, 2, 'tbsp', 'Sugar', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Salitre', 2, 2, 'oz', 'Ginger-infused Rum', NULL, NULL, false),
    ('alquimicocartagena', NULL, 'Salitre', 3, NULL, NULL, 'Rose Salt', NULL, 'for the rim', false),
    ('alquimicocartagena', NULL, 'Salitre', 4, NULL, NULL, 'Rose salt rim', NULL, 'garnish', false),
    ('superbuenonyc', NULL, 'Green Mango Martini', 0, 2.5, 'oz', 'Green Mango-infused Tequila', NULL, 'made with Patrón Silver', false),
    ('superbuenonyc', NULL, 'Green Mango Martini', 1, 0.75, 'oz', 'Sauternes', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Green Mango Martini', 2, 0.5, 'oz', 'Mango Eau de Vie', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Green Mango Martini', 3, 0.25, 'oz', 'Honey Syrup', NULL, '1:1 honey to water', false),
    ('superbuenonyc', NULL, 'Green Mango Martini', 4, 2, 'dash', 'Salt Solution', NULL, 'made with Maldon; 1:10 salt to water', false),
    ('superbuenonyc', NULL, 'Green Mango Martini', 5, NULL, NULL, 'A drop of costeño chile oil', NULL, 'garnish', false),
    ('superbuenonyc', NULL, 'Vodka y Soda', 0, 45, 'ml', 'Pasilla and Guajillo Chile-infused Vodka', NULL, 'made with Grey Goose', false),
    ('superbuenonyc', NULL, 'Vodka y Soda', 1, 7, 'ml', 'Velvet Falernum', 'Falernum', NULL, false),
    ('superbuenonyc', NULL, 'Vodka y Soda', 2, 142, 'ml', 'Guava Soda', NULL, 'clarified guava purée with tartaric and malic acid and sugar', false),
    ('superbuenonyc', NULL, 'Vodka y Soda', 3, NULL, NULL, 'Guava salt half rim', NULL, 'garnish', false),
    ('superbuenonyc', NULL, 'Mushroom Margarita', 0, NULL, NULL, 'Huitlacoche-infused Mezcal', NULL, 'made with Mal Bien; infused 24 hours, unstrained', false),
    ('superbuenonyc', NULL, 'Mushroom Margarita', 1, NULL, NULL, 'Alma Finca', 'Orange Liqueur', NULL, false),
    ('superbuenonyc', NULL, 'Mushroom Margarita', 2, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Mushroom Margarita', 3, NULL, NULL, 'Simple Syrup', NULL, 'a touch', false),
    ('superbuenonyc', NULL, 'Mushroom Margarita', 4, NULL, NULL, 'Lava Salt', NULL, 'rim', false),
    ('superbuenonyc', NULL, 'Mushroom Margarita', 5, NULL, NULL, 'Lava salt rim', NULL, 'garnish', false),
    ('superbuenonyc', NULL, 'Roasted Corn Sour', 0, NULL, NULL, 'Abasolo Corn Whiskey', 'Corn Whiskey', NULL, false),
    ('superbuenonyc', NULL, 'Roasted Corn Sour', 1, NULL, NULL, 'Reposado Tequila', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Roasted Corn Sour', 2, NULL, NULL, 'Pox', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Roasted Corn Sour', 3, NULL, NULL, 'Roasted Corn and Guajillo Syrup', NULL, 'house-made', false),
    ('superbuenonyc', NULL, 'Roasted Corn Sour', 4, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Roasted Corn Sour', 5, NULL, NULL, 'Egg White', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Roasted Corn Sour', 6, NULL, NULL, 'Charred corn husk', NULL, 'garnish', false),
    ('superbuenonyc', NULL, 'Mole Negroni', 0, NULL, NULL, 'Mole Fat-washed Mezcal', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Mole Negroni', 1, NULL, NULL, 'Amari Blend', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Mole Negroni', 2, NULL, NULL, 'Sweet Vermouth', NULL, NULL, false),
    ('superbuenonyc', NULL, 'Mole Negroni', 3, NULL, NULL, 'Xocolatl Mole Bitters', NULL, NULL, false),
    ('ladybee.lima', NULL, 'Three Sips Martini', 0, NULL, NULL, 'Gin or Botanical Cane Distillate', NULL, 'made with Intira Gin (2024) / Coastal Hills distillate by Mater Iniciativa (2023); sources differ by year', false),
    ('ladybee.lima', NULL, 'Three Sips Martini', 1, NULL, NULL, 'Sherry', NULL, NULL, false),
    ('ladybee.lima', NULL, 'Three Sips Martini', 2, NULL, NULL, 'Extra-dry Vermouth', NULL, NULL, false),
    ('ladybee.lima', NULL, 'Three Sips Martini', 3, NULL, NULL, 'Olive, sea lettuce (and salicornia) and trout caviar served on a three-bowl…', NULL, 'garnish', false),
    ('ladybee.lima', NULL, 'Oca Mashua', 0, NULL, NULL, 'Red Oca Distillate', NULL, 'made with Manuel Choqque', false),
    ('ladybee.lima', NULL, 'Oca Mashua', 1, NULL, NULL, 'Mashua', NULL, 'for colour', false),
    ('ladybee.lima', NULL, 'Oca Mashua', 2, NULL, NULL, 'Pickled Tubers', NULL, 'per 50 Best 2025', false),
    ('ladybee.lima', NULL, 'Oca Mashua', 3, NULL, NULL, 'Slices of oca and mashua on the ice', NULL, 'garnish', false),
    ('ladybee.lima', NULL, 'Bee''s Knees (Amazon twist)', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('ladybee.lima', NULL, 'Bee''s Knees (Amazon twist)', 1, NULL, NULL, 'Mandarin-lime Juice', NULL, NULL, false),
    ('ladybee.lima', NULL, 'Bee''s Knees (Amazon twist)', 2, NULL, NULL, 'Stingless Bee Honey', NULL, 'abeja señorita, Amazon', false),
    ('ladybee.lima', NULL, 'Bloody Mary', 0, NULL, NULL, 'Scallop', NULL, 'fresh, from Ica; as topping', false),
    ('ladybee.lima', NULL, 'Bloody Mary', 1, NULL, NULL, 'Fresh Ica scallop', NULL, 'garnish', false),
    ('ladybee.lima', NULL, 'Acholado Cacaotal', 0, NULL, NULL, 'Acholado Pisco', NULL, 'house blend', false),
    ('ladybee.lima', NULL, 'Acholado Cacaotal', 1, NULL, NULL, 'Peruvian Chocolate', NULL, 'blend', false),
    ('himkok.oslo', NULL, 'Birch', 0, NULL, NULL, 'Himkok Old Tom Gin', 'Old Tom Gin', 'distilled in-house', false),
    ('himkok.oslo', NULL, 'Birch', 1, NULL, NULL, 'Meadowsweet', NULL, NULL, false),
    ('himkok.oslo', NULL, 'Birch', 2, NULL, NULL, 'Birch Sap', NULL, NULL, false),
    ('himkok.oslo', NULL, 'Birch', 3, NULL, NULL, 'Blue cheese olive', NULL, 'garnish', false),
    ('himkok.oslo', NULL, 'Beetroot (Reindeer Moss Martini)', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('himkok.oslo', NULL, 'Beetroot (Reindeer Moss Martini)', 1, NULL, NULL, 'Beetroot', NULL, NULL, false),
    ('himkok.oslo', NULL, 'Softis', 0, NULL, NULL, 'Linie', 'Aquavit', NULL, false),
    ('himkok.oslo', NULL, 'Softis', 1, NULL, NULL, 'Diplom-Is', 'Ice Cream', NULL, false),
    ('himkok.oslo', NULL, 'Softis', 2, NULL, NULL, 'Disaronno', 'Amaretto', NULL, false),
    ('himkok.oslo', NULL, 'Softis', 3, NULL, NULL, 'White Cacao Liqueur', NULL, NULL, false),
    ('himkok.oslo', NULL, 'Softis', 4, NULL, NULL, 'Fino Sherry', NULL, NULL, false),
    ('himkok.oslo', NULL, 'Cherry', 0, NULL, NULL, 'Buffalo Trace Bourbon', 'Bourbon', NULL, false),
    ('himkok.oslo', NULL, 'Cherry', 1, NULL, NULL, 'Merlet', 'Cherry Liqueur', NULL, false),
    ('himkok.oslo', NULL, 'Cherry', 2, NULL, NULL, 'Carpano Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('himkok.oslo', NULL, 'Cherry', 3, NULL, NULL, 'Dark Chocolate', NULL, NULL, false),
    ('himkok.oslo', NULL, 'Cherry', 4, NULL, NULL, 'Butter', NULL, 'butter-washed finish', false),
    ('himkok.oslo', NULL, 'Parsnip', 0, NULL, NULL, 'Buffalo Trace Bourbon', 'Bourbon', NULL, false),
    ('himkok.oslo', NULL, 'Parsnip', 1, NULL, NULL, 'Parsnip Maple Syrup', NULL, 'house infusion', false),
    ('himkok.oslo', NULL, 'Parsnip', 2, NULL, NULL, 'Angostura', 'Cocoa Bitters', NULL, false),
    ('bar.us.bkk', NULL, 'Pad Thai', 0, NULL, NULL, 'Leek Distillate', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Pad Thai', 1, NULL, NULL, 'Vodka', NULL, 'fat-washed with chilli oil', false),
    ('bar.us.bkk', NULL, 'Pad Thai', 2, NULL, NULL, 'Red Shallot', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Pad Thai', 3, NULL, NULL, 'Sugarcane', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Pad Thai', 4, NULL, NULL, 'Coconut', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Pad Thai', 5, NULL, NULL, 'Tamarind', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Pad Thai', 6, NULL, NULL, 'Nut Syrup', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Pad Thai', 7, NULL, NULL, 'Ginger Brine', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Pad Thai', 8, NULL, NULL, 'Modern Sour', NULL, 'house acid blend', false),
    ('bar.us.bkk', NULL, 'Pad Thai', 9, NULL, NULL, 'Burnt pickled onion', NULL, 'garnish', false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 0, NULL, NULL, 'Beef Jerky', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 1, NULL, NULL, 'Ketel One Vodka', 'Vodka', NULL, false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 2, NULL, NULL, 'Chilli Oil', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 3, NULL, NULL, 'Red Onion', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 4, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 5, NULL, NULL, 'Makrut Lime', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 6, NULL, NULL, 'Cucumber', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 7, NULL, NULL, 'Salt Solution', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 8, NULL, NULL, 'Modern Sour', NULL, 'house acid blend', false),
    ('bar.us.bkk', NULL, 'Beef + Onion', 9, NULL, NULL, 'Pickled Ginger Powder', NULL, 'garnish', false),
    ('bar.us.bkk', NULL, 'Coriander + Cucumber + Roasted Rice', 0, NULL, NULL, 'Coriander Distillate', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Coriander + Cucumber + Roasted Rice', 1, NULL, NULL, 'Hendrick''s Gin', 'Gin', NULL, false),
    ('bar.us.bkk', NULL, 'Coriander + Cucumber + Roasted Rice', 2, NULL, NULL, 'Green Apple', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Coriander + Cucumber + Roasted Rice', 3, NULL, NULL, 'Cucumber', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Coriander + Cucumber + Roasted Rice', 4, NULL, NULL, 'Green Olive', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Coriander + Cucumber + Roasted Rice', 5, NULL, NULL, 'Roasted Rice Foam', NULL, 'topping', false),
    ('bar.us.bkk', NULL, 'Black Sesame + Cheese + Almond', 0, NULL, NULL, 'Jameson Black Barrel Irish Whiskey', 'Irish Whiskey', NULL, false),
    ('bar.us.bkk', NULL, 'Black Sesame + Cheese + Almond', 1, NULL, NULL, 'Black Sesame', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Black Sesame + Cheese + Almond', 2, NULL, NULL, 'Cream Cheese', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Black Sesame + Cheese + Almond', 3, NULL, NULL, 'Liquid Yoghurt', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Black Sesame + Cheese + Almond', 4, NULL, NULL, 'Almond', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Black Sesame + Cheese + Almond', 5, NULL, NULL, 'Parmesan Dust', NULL, 'garnish', false),
    ('bar.us.bkk', NULL, 'Black Sesame + Cheese + Almond', 6, NULL, NULL, 'Parmesan cheese dust', NULL, 'garnish', false),
    ('bar.us.bkk', NULL, 'Satay', 0, NULL, NULL, 'Masala Spice Vodka Distillate', NULL, 'fat-washed with Thai chilli oil', false),
    ('bar.us.bkk', NULL, 'Satay', 1, NULL, NULL, 'Pickled Ginger Brine', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Satay', 2, NULL, NULL, 'Macadamia Syrup', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Satay', 3, NULL, NULL, 'Red Shallot', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Satay', 4, NULL, NULL, 'Cucumber Salt Solution', NULL, NULL, false),
    ('bar.us.bkk', NULL, 'Satay', 5, NULL, NULL, 'Chilli oil drops added tableside', NULL, 'garnish', false),
    ('zest.seoul', NULL, 'Jeju Garibaldi', 0, NULL, NULL, 'Hallabong Orange Juice', NULL, 'fresh, from Jeju', false),
    ('zest.seoul', NULL, 'Jeju Garibaldi', 1, NULL, NULL, 'Carrot', NULL, 'from Gujwa village, Jeju', false),
    ('zest.seoul', NULL, 'Oh My Gibson', 0, NULL, NULL, 'Citrus Cardamom Gin', NULL, NULL, false),
    ('zest.seoul', NULL, 'Oh My Gibson', 1, NULL, NULL, 'Italian Vermouth', NULL, NULL, false),
    ('zest.seoul', NULL, 'Oh My Gibson', 2, NULL, NULL, 'Omegi Sour Yakju', NULL, 'artisanal Korean rice wine', false),
    ('zest.seoul', NULL, 'Oh My Gibson', 3, NULL, NULL, 'Seasonal pickles', NULL, 'garnish', false),
    ('zest.seoul', NULL, 'Z&T', 0, NULL, NULL, 'Gin', NULL, 'seasonal house gin', false),
    ('zest.seoul', NULL, 'Z&T', 1, NULL, NULL, 'Tonic', NULL, 'house-made', false),
    ('zest.seoul', NULL, 'Nutty & Bitter', 0, NULL, NULL, 'Millet Soju', NULL, NULL, false),
    ('zest.seoul', NULL, 'Nutty & Bitter', 1, NULL, NULL, 'Jelly of leftover Champagne and citrus stock', NULL, 'garnish', false),
    ('barnouveau', NULL, 'Ramos', 0, NULL, NULL, 'Vanilla Yoghurt', NULL, NULL, false),
    ('barnouveau', NULL, 'Ramos', 1, NULL, NULL, 'Peated Spirit', NULL, 'source says only ''peat''', false),
    ('barnouveau', NULL, 'Ramos', 2, NULL, NULL, 'St-Germain', 'Elderflower Liqueur', NULL, false),
    ('barnouveau', NULL, 'Ramos', 3, NULL, NULL, 'Served with an oyster-shell spoon', NULL, 'garnish', false),
    ('barnouveau', NULL, 'Fine à l''Eau', 0, NULL, NULL, 'Cognac', NULL, NULL, false),
    ('barnouveau', NULL, 'Fine à l''Eau', 1, NULL, NULL, 'Water', NULL, NULL, false),
    ('barnouveau', NULL, 'Fine à l''Eau', 2, NULL, NULL, 'Sugar', NULL, NULL, false),
    ('barnouveau', NULL, 'Fine à l''Eau', 3, NULL, NULL, 'Verjus', NULL, NULL, false),
    ('benfiddich_tokyo', NULL, 'Farm Julep', 0, NULL, NULL, 'Fennel', NULL, 'farm-grown', false),
    ('benfiddich_tokyo', NULL, 'Farm Julep', 1, NULL, NULL, 'Mint', NULL, 'farm-grown', false),
    ('benfiddich_tokyo', NULL, 'Hot Buttered Roku', 0, 45, 'ml', 'Roku Gin', 'Gin', NULL, false),
    ('benfiddich_tokyo', NULL, 'Hot Buttered Roku', 1, NULL, NULL, 'Japanese Pear Purée', NULL, '70 g (grams not an allowed unit)', false),
    ('benfiddich_tokyo', NULL, 'Hot Buttered Roku', 2, 10, 'ml', 'Yuzu Juice', NULL, NULL, false),
    ('benfiddich_tokyo', NULL, 'Hot Buttered Roku', 3, NULL, NULL, 'Butter', NULL, '5 g (grams not an allowed unit)', false),
    ('benfiddich_tokyo', NULL, 'Hot Buttered Roku', 4, 1, 'tsp', 'Simple Syrup', NULL, NULL, false),
    ('benfiddich_tokyo', NULL, 'Hot Buttered Roku', 5, NULL, NULL, 'Yuzu peel', NULL, 'garnish', false),
    ('benfiddich_tokyo', NULL, 'House Absinthe', 0, NULL, NULL, 'Absinthe', NULL, 'house-distilled from home-grown wormwood', false),
    ('caretakers.cottage', NULL, 'House Martini', 0, NULL, NULL, 'Gin', NULL, 'custom-made for the bar', false),
    ('caretakers.cottage', NULL, 'The Snail & The Whale', 0, NULL, NULL, 'Hendrick''s Flora Adora Gin', 'Gin', NULL, false),
    ('caretakers.cottage', NULL, 'The Snail & The Whale', 1, NULL, NULL, 'Blueberry Wine', NULL, NULL, false),
    ('caretakers.cottage', NULL, 'The Snail & The Whale', 2, NULL, NULL, 'Amaro Montenegro', 'Amaro', NULL, false),
    ('caretakers.cottage', NULL, 'The Snail & The Whale', 3, NULL, NULL, 'Blood Orange Juice', NULL, NULL, false),
    ('caretakers.cottage', NULL, 'The Snail & The Whale', 4, NULL, NULL, 'Snail shells', NULL, 'garnish', false),
    ('thecambridge_paris', NULL, 'Pimm''s', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Pimm''s', 1, NULL, NULL, 'Alsatian Wine', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Pimm''s', 2, NULL, NULL, 'St-Germain', 'Elderflower Liqueur', NULL, false),
    ('thecambridge_paris', NULL, 'Cigarette After Sex', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Cigarette After Sex', 1, NULL, NULL, 'Sloe Gin', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Cigarette After Sex', 2, NULL, NULL, 'Agua de Jamaica', NULL, 'hibiscus', false),
    ('thecambridge_paris', NULL, 'Akira Kira', 0, 40, 'ml', 'Sencha Green Tea-infused Vodka', NULL, 'made with Nikka', false),
    ('thecambridge_paris', NULL, 'Akira Kira', 1, 20, 'ml', 'Lillet', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Akira Kira', 2, 25, 'ml', 'Clarified Corsican Grapefruit Cordial', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Akira Kira', 3, 10, 'ml', 'Verjus', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Akira Kira', 4, NULL, NULL, 'Grapefruit zest', NULL, 'garnish', false),
    ('thecambridge_paris', NULL, 'Arty Shock', 0, 30, 'ml', 'Fords Gin', 'Gin', NULL, false),
    ('thecambridge_paris', NULL, 'Arty Shock', 1, 10, 'ml', 'Select', 'Bitter Aperitivo', NULL, false),
    ('thecambridge_paris', NULL, 'Arty Shock', 2, 80, 'ml', 'Artichoke Cooking Water', NULL, 'house-made', false),
    ('thecambridge_paris', NULL, 'Arty Shock', 3, 10, 'ml', 'Micro-filtered Water', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Arty Shock', 4, NULL, NULL, 'Cooked artichoke leaf', NULL, 'garnish', false),
    ('thecambridge_paris', NULL, 'Daylight & Darkness', 0, 20, 'ml', 'Avallen Calvados', 'Calvados', NULL, false),
    ('thecambridge_paris', NULL, 'Daylight & Darkness', 1, 25, 'ml', 'Eggplant and Black Garlic Cordial', NULL, 'house-made', false),
    ('thecambridge_paris', NULL, 'Daylight & Darkness', 2, 10, 'ml', 'Dolin Blanc Vermouth', 'Blanc Vermouth', NULL, false),
    ('thecambridge_paris', NULL, 'Daylight & Darkness', 3, 5, 'ml', 'Dolin Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('thecambridge_paris', NULL, 'Daylight & Darkness', 4, 5, 'ml', '3S Sweet Potato Shochu', 'Roasted Sweet Potato Shochu', NULL, false),
    ('thecambridge_paris', NULL, 'Daylight & Darkness', 5, 5, 'ml', 'Verjus', NULL, NULL, false),
    ('thecambridge_paris', NULL, 'Daylight & Darkness', 6, NULL, NULL, 'Eggplant skin chip', NULL, 'garnish', false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 0, 0.75, 'oz', 'Tanqueray London Dry Gin', 'London Dry Gin', 'higher-proof', false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 1, 0.75, 'oz', 'Orange Juice', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 2, 0.25, 'oz', 'Noilly Prat Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 3, 0.25, 'oz', 'Punt e Mes', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 4, 0.25, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 5, 0.25, 'oz', 'Simple Syrup', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 6, 0.25, 'oz', 'Grand Marnier', 'Orange Liqueur', NULL, false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 7, 1, 'dash', 'Orange Bitters', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 8, 1, 'slice', 'Orange', NULL, 'shaken in the tin', false),
    ('satans_whiskers', NULL, 'Satan''s Whiskers (Kevin Armstrong''s)', 9, NULL, NULL, 'Orange twist', NULL, 'garnish', false),
    ('satans_whiskers', NULL, 'East 8 Hold-Up', 0, 1.5, 'oz', 'Ketel One Vodka', 'Vodka', NULL, false),
    ('satans_whiskers', NULL, 'East 8 Hold-Up', 1, 0.5, 'oz', 'Luxardo Aperitivo', 'Bittersweet Orange Aperitivo', 'Aperol in the original', false),
    ('satans_whiskers', NULL, 'East 8 Hold-Up', 2, 0.67, 'oz', 'Pineapple Juice', NULL, 'fresh', false),
    ('satans_whiskers', NULL, 'East 8 Hold-Up', 3, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    ('satans_whiskers', NULL, 'East 8 Hold-Up', 4, 0.25, 'oz', 'Rich Sugar Syrup', NULL, '2:1', false),
    ('satans_whiskers', NULL, 'East 8 Hold-Up', 5, 0.17, 'oz', 'Passion Fruit Syrup', NULL, 'made with Monin', false),
    ('satans_whiskers', NULL, 'East 8 Hold-Up', 6, NULL, NULL, 'Pineapple and lime wedges', NULL, 'garnish', false),
    ('localefirenze', NULL, 'Foglia', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('localefirenze', NULL, 'Foglia', 1, NULL, NULL, 'Mint', NULL, NULL, false),
    ('localefirenze', NULL, 'Foglia', 2, NULL, NULL, 'Basil', NULL, NULL, false),
    ('localefirenze', NULL, 'Foglia', 3, NULL, NULL, 'Hemp', NULL, NULL, false),
    ('localefirenze', NULL, 'Locale Manhattan', 0, NULL, NULL, 'Whiskey', NULL, NULL, false),
    ('localefirenze', NULL, 'Locale Manhattan', 1, NULL, NULL, 'Marsala', NULL, NULL, false),
    ('localefirenze', NULL, 'Locale Manhattan', 2, NULL, NULL, 'Kombucha', NULL, NULL, false),
    ('localefirenze', NULL, 'Locale Manhattan', 3, NULL, NULL, 'Cold-brew Coffee', NULL, NULL, false),
    ('localefirenze', NULL, 'Seasonal Margarita', 0, NULL, NULL, 'Tequila', NULL, 'as published; likely 50 ml', false),
    ('localefirenze', NULL, 'Seasonal Margarita', 1, NULL, NULL, 'Acidified Celery Extract', NULL, NULL, false),
    ('localefirenze', NULL, 'Seasonal Margarita', 2, NULL, NULL, 'Chestnut Honey', NULL, NULL, false),
    ('localefirenze', NULL, 'Seasonal Margarita', 3, NULL, NULL, 'Carandini Bianca', 'White Sweet Vinegar', NULL, false),
    ('localefirenze', NULL, 'Seasonal Margarita', 4, NULL, NULL, 'Coarse salt rim', NULL, 'garnish', false),
    ('localefirenze', NULL, 'Api del Giambologna', 0, 45, 'ml', 'Mathusalem Gran Reserva 15 Aged Rum', 'Aged Rum', NULL, false),
    ('localefirenze', NULL, 'Api del Giambologna', 1, 30, 'ml', 'Tiki Sauce', NULL, 'grilled pineapple, honey, raspberry, rice milk, turmeric', false),
    ('localefirenze', NULL, 'Api del Giambologna', 2, 45, 'ml', 'Fermented Pineapple Skin', NULL, 'with Jamaican pepper (allspice)', false),
    ('localefirenze', NULL, 'Api del Giambologna', 3, 15, 'ml', 'Nettle and Orange Liqueur', NULL, NULL, false),
    ('localefirenze', NULL, 'Api del Giambologna', 4, 0.5, NULL, 'Lime Twist', NULL, NULL, false),
    ('localefirenze', NULL, 'Api del Giambologna', 5, NULL, NULL, 'Bee Pollen Foam', NULL, NULL, false),
    ('localefirenze', NULL, 'Api del Giambologna', 6, NULL, NULL, 'Lime twist, bee pollen foam', NULL, 'garnish', false),
    ('tlecan', NULL, 'Paloma Blanca', 0, 45, 'ml', 'Mezcal', NULL, NULL, false),
    ('tlecan', NULL, 'Paloma Blanca', 1, NULL, NULL, 'Grapefruit Juice', NULL, 'clarified and carbonated', false),
    ('tlecan', NULL, 'Paloma Blanca', 2, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('tlecan', NULL, 'Paloma Blanca', 3, NULL, NULL, 'Colima Salt', NULL, NULL, false),
    ('tlecan', NULL, 'Pulque Colada', 0, NULL, NULL, 'Pulque', NULL, 'natural, fresh', false),
    ('tlecan', NULL, 'Pulque Colada', 1, NULL, NULL, 'Pineapple Milk Punch', NULL, NULL, false),
    ('tlecan', NULL, 'Pulque Colada', 2, NULL, NULL, 'Coconut Water', NULL, NULL, false),
    ('tlecan', NULL, 'Pulque Colada', 3, 45, 'ml', 'Mezcal Espadín', NULL, 'fat-washed with coconut oil', false),
    ('tlecan', NULL, 'Tascalate Sour', 0, 45, 'ml', 'Mezcal', NULL, NULL, false),
    ('tlecan', NULL, 'Tascalate Sour', 1, NULL, NULL, 'Toasted Corn', NULL, 'as tascalate', false),
    ('tlecan', NULL, 'Tascalate Sour', 2, NULL, NULL, 'Fermented Cacao', NULL, 'as tascalate', false),
    ('tlecan', NULL, 'Tascalate Sour', 3, NULL, NULL, 'Cinnamon', NULL, 'as tascalate', false),
    ('tlecan', NULL, 'Tascalate Sour', 4, NULL, NULL, 'Achiote', NULL, 'as tascalate', false),
    ('tlecan', NULL, 'Tascalate Sour', 5, NULL, NULL, 'Syrup', NULL, 'PUNCH names agave nectar', false),
    ('tlecan', NULL, 'Tascalate Sour', 6, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('tlecan', NULL, 'Tascalate Sour', 7, NULL, NULL, 'Egg White', NULL, 'per PUNCH, not on the menu', true),
    ('tlecan', NULL, 'Tascalate Sour', 8, NULL, NULL, 'Fermented cacao powder', NULL, 'garnish', false),
    ('tlecan', NULL, 'Oceloyotl', 0, 45, 'ml', 'Mezcal Espadín', NULL, 'infused with anise, cinnamon and clove', false),
    ('tlecan', NULL, 'Oceloyotl', 1, NULL, NULL, 'Corn Liqueur', NULL, NULL, false),
    ('tlecan', NULL, 'Oceloyotl', 2, NULL, NULL, 'Espresso', NULL, 'coffee roasted in Puebla', false),
    ('tlecan', NULL, 'Oceloyotl', 3, NULL, NULL, 'Piloncillo Syrup', NULL, NULL, false),
    ('tlecan', NULL, 'Martini Papantla', 0, 45, 'ml', 'Mezcal', NULL, NULL, false),
    ('tlecan', NULL, 'Martini Papantla', 1, 45, 'ml', 'Dry Vermouth', NULL, 'infused with vanilla', false),
    ('tantannb', NULL, 'Dirty Collins', 0, NULL, NULL, 'White Cachaça', NULL, NULL, false),
    ('tantannb', NULL, 'Dirty Collins', 1, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('tantannb', NULL, 'Dirty Collins', 2, NULL, NULL, 'Olive Soda', NULL, 'house-made from a clarified olive syrup', false),
    ('tantannb', NULL, 'Dirty Collins', 3, NULL, NULL, 'Tahiti Lime', NULL, NULL, false),
    ('tantannb', NULL, 'Curupira', 0, NULL, NULL, 'Tanqueray Dry Gin', 'Dry Gin', NULL, false),
    ('tantannb', NULL, 'Curupira', 1, NULL, NULL, 'Cambuci Sparkling Wine', NULL, NULL, false),
    ('tantannb', NULL, 'Curupira', 2, NULL, NULL, 'Mint Cordial', NULL, NULL, false),
    ('tantannb', NULL, 'Curupira', 3, NULL, NULL, 'Cumaru', NULL, NULL, false),
    ('tantannb', NULL, 'Tsukemono', 0, NULL, NULL, 'Don Julio Blanco Tequila', 'Blanco Tequila', NULL, false),
    ('tantannb', NULL, 'Tsukemono', 1, NULL, NULL, 'Wasabi', NULL, NULL, false),
    ('tantannb', NULL, 'Tsukemono', 2, NULL, NULL, 'Cucumber Cordial', NULL, NULL, false),
    ('tantannb', NULL, 'Tsukemono', 3, NULL, NULL, 'Orange Bitters', NULL, NULL, false),
    ('tantannb', NULL, 'Libertine', 0, NULL, NULL, 'Cachaça', NULL, NULL, false),
    ('tantannb', NULL, 'Libertine', 1, NULL, NULL, 'Yuzu', NULL, NULL, false),
    ('tantannb', NULL, 'Libertine', 2, NULL, NULL, 'Grape Leaf', NULL, NULL, false),
    ('tantannb', NULL, 'Libertine', 3, NULL, NULL, 'Drambuie', NULL, NULL, false),
    ('tantannb', NULL, 'Libertine', 4, NULL, NULL, 'Jabuticaba Vermouth', NULL, NULL, false),
    ('tantannb', NULL, 'Hedonism', 0, NULL, NULL, 'Mango', NULL, NULL, false),
    ('tantannb', NULL, 'Hedonism', 1, NULL, NULL, 'Ketel One Vodka', 'Vodka', NULL, false),
    ('tantannb', NULL, 'Hedonism', 2, NULL, NULL, 'Fino Sherry', NULL, NULL, false),
    ('tantannb', NULL, 'Hedonism', 3, NULL, NULL, 'Awamori', NULL, NULL, false),
    ('tantannb', NULL, 'Hedonism', 4, NULL, NULL, 'Dry Vermouth', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Lantern of Infinity', 0, NULL, NULL, 'Diplomático Selección de Familia Rum', 'Rum', NULL, false),
    ('mirrorbarcarlton', NULL, 'Lantern of Infinity', 1, NULL, NULL, 'Goji and Rosehip Clarified Juice', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Lantern of Infinity', 2, NULL, NULL, 'Red Miso Butter Caramel', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Lantern of Infinity', 3, NULL, NULL, 'Rice Milk', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Lux', 0, NULL, NULL, 'Tanqueray No. Ten Gin', 'Gin', NULL, false),
    ('mirrorbarcarlton', NULL, 'Lux', 1, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Lux', 2, NULL, NULL, 'Rue Berry Cordial', NULL, 'made with Paragon Rue Berry', false),
    ('mirrorbarcarlton', NULL, 'Lux', 3, NULL, NULL, 'Tío Pepe Fino Sherry', 'Fino Sherry', NULL, false),
    ('mirrorbarcarlton', NULL, 'Lux', 4, NULL, NULL, 'Prosecco', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Marble', 0, NULL, NULL, 'Hennessy VSOP Cognac', 'Cognac', NULL, false),
    ('mirrorbarcarlton', NULL, 'Marble', 1, NULL, NULL, 'Cornflakes', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Marble', 2, NULL, NULL, 'Coconut', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Marble', 3, NULL, NULL, 'Champagne', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Marble', 4, NULL, NULL, 'Cointreau', 'Orange Liqueur', NULL, false),
    ('mirrorbarcarlton', NULL, 'Ľudovít Štúr', 0, NULL, NULL, 'Tío Pepe Fino Sherry', 'Fino Sherry', NULL, false),
    ('mirrorbarcarlton', NULL, 'Ľudovít Štúr', 1, NULL, NULL, 'Dry Vermouth', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Ľudovít Štúr', 2, NULL, NULL, 'Cordial', NULL, 'made with Paragon', false),
    ('mirrorbarcarlton', NULL, 'Ľudovít Štúr', 3, NULL, NULL, 'Apple-quince-pear Juice', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Ľudovít Štúr', 4, NULL, NULL, 'Mirror', 'Citrus Bitters', 'house', false),
    ('mirrorbarcarlton', NULL, 'Elementum', 0, NULL, NULL, 'Domovina', 'Borovička', NULL, false),
    ('mirrorbarcarlton', NULL, 'Elementum', 1, NULL, NULL, 'Gooseberry', NULL, NULL, false),
    ('mirrorbarcarlton', NULL, 'Elementum', 2, NULL, NULL, 'Earthy Soda', NULL, 'house', false),
    ('mirrorbarcarlton', NULL, 'Elementum', 3, NULL, NULL, 'Edible Fruit Air', NULL, NULL, false),
    ('cochinchina.bar', NULL, 'La Vida Que Me Merezco', 0, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('cochinchina.bar', NULL, 'La Vida Que Me Merezco', 1, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('cochinchina.bar', NULL, 'La Vida Que Me Merezco', 2, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('cochinchina.bar', NULL, 'Blend de los Buenos', 0, NULL, NULL, 'Cantieri Navali Vermouth', 'Vermouth', NULL, false),
    ('cochinchina.bar', NULL, 'Blend de los Buenos', 1, NULL, NULL, 'Soda', NULL, NULL, false),
    ('cochinchina.bar', NULL, 'Blend de los Buenos', 2, NULL, NULL, 'Capers', NULL, NULL, false),
    ('cochinchina.bar', NULL, 'Jazmín Shanghái', 0, NULL, NULL, 'Whisky', NULL, NULL, false),
    ('cochinchina.bar', NULL, 'Jazmín Shanghái', 1, NULL, NULL, 'Umeshu', NULL, NULL, false),
    ('cochinchina.bar', NULL, 'Jazmín Shanghái', 2, NULL, NULL, 'Jasmine Tea', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Supremus n°58', 0, NULL, NULL, 'Rhum Agricole', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Supremus n°58', 1, NULL, NULL, 'Aged Rum', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Supremus n°58', 2, NULL, NULL, 'Lime', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Supremus n°58', 3, NULL, NULL, 'Distilled Falernum', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Supremus n°58', 4, NULL, NULL, 'Spices', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Supremus n°58', 5, NULL, NULL, 'White Summer Tea', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba''s Zombie', 0, NULL, NULL, 'Aged Rums', NULL, 'five, blended', false),
    ('baba_au_rum', NULL, 'Baba''s Zombie', 1, NULL, NULL, 'Tropical Juices', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba''s Zombie', 2, NULL, NULL, 'Bitters', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba''s Zombie', 3, NULL, NULL, 'Spices', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba''s Zombie', 4, NULL, NULL, 'Falernum', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba''s Zombie', 5, NULL, NULL, 'Dry Orange Curaçao', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba''s Zombie', 6, NULL, NULL, 'Lime', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Spicy Baba No7', 0, NULL, NULL, 'Aged Rum', NULL, 'Puerto Rican', false),
    ('baba_au_rum', NULL, 'Spicy Baba No7', 1, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Spicy Baba No7', 2, NULL, NULL, 'Lime', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Spicy Baba No7', 3, NULL, NULL, 'Sweet Berries', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Spicy Baba No7', 4, NULL, NULL, 'Mint', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Spicy Baba No7', 5, NULL, NULL, 'Cranberry', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Beatnik Paloma', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Beatnik Paloma', 1, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Beatnik Paloma', 2, NULL, NULL, 'Beetroot', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Beatnik Paloma', 3, NULL, NULL, 'Black Cardamom', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba au Rum', 0, NULL, NULL, 'Barceló Imperial Rum', 'Rum', NULL, false),
    ('baba_au_rum', NULL, 'Baba au Rum', 1, NULL, NULL, 'Sweet Sherry', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba au Rum', 2, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba au Rum', 3, NULL, NULL, 'Oak', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba au Rum', 4, NULL, NULL, 'Basil', NULL, NULL, false),
    ('baba_au_rum', NULL, 'Baba au Rum', 5, NULL, NULL, 'Lime', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'C''est Rum', 0, NULL, NULL, 'Rum Blend', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'C''est Rum', 1, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'C''est Rum', 2, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'C''est Rum', 3, NULL, NULL, 'Lime', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'C''est Rum', 4, NULL, NULL, 'Chocolate Bitters', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nu Fashion', 0, NULL, NULL, 'Rye Whiskey', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nu Fashion', 1, NULL, NULL, 'Bourbon', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nu Fashion', 2, NULL, NULL, 'Blended Vermouth', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nu Fashion', 3, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nu Fashion', 4, NULL, NULL, 'Lime', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nu Fashion', 5, NULL, NULL, 'Bitters', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Deviated Negroni', 0, NULL, NULL, 'Juniper Raki', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Deviated Negroni', 1, NULL, NULL, 'Bitter Aperitif', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Deviated Negroni', 2, NULL, NULL, 'Fortified Kallmet Wine', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nou Whey', 0, NULL, NULL, 'Pear Raki', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nou Whey', 1, NULL, NULL, 'Hazelnut Milk', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nou Whey', 2, NULL, NULL, 'Tonka Bean', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nou Whey', 3, NULL, NULL, 'Cocoa', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Nou Whey', 4, NULL, NULL, 'Elderflower', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Black Sabah', 0, NULL, NULL, 'Muscat Raki', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Black Sabah', 1, NULL, NULL, 'Rum', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Black Sabah', 2, NULL, NULL, 'Turkish Coffee', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Black Sabah', 3, NULL, NULL, 'Toasted Corn', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Black Sabah', 4, NULL, NULL, 'Honey', NULL, NULL, false),
    ('nouvellevague_tirana', NULL, 'Black Sabah', 5, NULL, NULL, 'Spices', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Ginseng Penicillin', 0, NULL, NULL, 'Chivas Regal 12 Blended Scotch', 'Blended Scotch Whisky', NULL, false),
    ('hopeandsesame', NULL, 'Ginseng Penicillin', 1, NULL, NULL, 'Aged Tangerine Peel', NULL, 'chenpi', false),
    ('hopeandsesame', NULL, 'Ginseng Penicillin', 2, NULL, NULL, 'American Ginseng', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Ginseng Penicillin', 3, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Ginseng Penicillin', 4, NULL, NULL, 'Honey', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Ginseng Penicillin', 5, NULL, NULL, 'Peated Scotch', NULL, 'menu lists ''peated''', false),
    ('hopeandsesame', NULL, 'Wintermelon High', 0, NULL, NULL, 'Olmeca Altos Tequila', 'Tequila', NULL, false),
    ('hopeandsesame', NULL, 'Wintermelon High', 1, NULL, NULL, 'Chrysanthemum', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Wintermelon High', 2, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Wintermelon High', 3, NULL, NULL, 'Winter Melon', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Wintermelon High', 4, NULL, NULL, 'Three Cents', 'Pink Grapefruit Soda', NULL, false),
    ('hopeandsesame', NULL, 'Pu''er Old Fashioned', 0, NULL, NULL, 'Bumbu The Original Rum', 'Rum', NULL, false),
    ('hopeandsesame', NULL, 'Pu''er Old Fashioned', 1, NULL, NULL, 'Pu''er Tea', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Pu''er Old Fashioned', 2, NULL, NULL, 'Red Date', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Pu''er Old Fashioned', 3, NULL, NULL, 'Goji Berry', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Pu''er Old Fashioned', 4, NULL, NULL, 'Chocolate Bitters', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Pu''er Old Fashioned', 5, NULL, NULL, 'Licor 43', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Pu''er Old Fashioned', 6, NULL, NULL, 'Caramel', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Guang-Hattan', 0, NULL, NULL, 'Michter''s US*1 Rye', 'Rye Whiskey', NULL, false),
    ('hopeandsesame', NULL, 'Guang-Hattan', 1, NULL, NULL, 'Coconut', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Guang-Hattan', 2, NULL, NULL, 'Ylang-ylang', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Guang-Hattan', 3, NULL, NULL, 'Rosso Vermouth', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Guang-Hattan', 4, NULL, NULL, 'Rhododendron', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Coffee & Tea Sour', 0, NULL, NULL, 'Jameson Irish Whiskey', 'Irish Whiskey', NULL, false),
    ('hopeandsesame', NULL, 'Coffee & Tea Sour', 1, NULL, NULL, 'Coffee', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Coffee & Tea Sour', 2, NULL, NULL, 'Phoenix Dancong Tea', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Coffee & Tea Sour', 3, NULL, NULL, 'Grapefruit', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Coffee & Tea Sour', 4, NULL, NULL, 'Peach', NULL, NULL, false),
    ('hopeandsesame', NULL, 'Coffee & Tea Sour', 5, NULL, NULL, 'Chickpea', NULL, NULL, false),
    ('danicoparis', NULL, 'Kota Ternate', 0, NULL, NULL, 'Planteray O.F.T.D. Overproof Rum', 'Overproof Rum', NULL, false),
    ('danicoparis', NULL, 'Kota Ternate', 1, NULL, NULL, 'Planteray 3 Stars White Rum', 'White Rum', NULL, false),
    ('danicoparis', NULL, 'Kota Ternate', 2, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('danicoparis', NULL, 'Kota Ternate', 3, NULL, NULL, 'Coconut', NULL, NULL, false),
    ('danicoparis', NULL, 'Kota Ternate', 4, NULL, NULL, 'Spice Mix', NULL, NULL, false),
    ('danicoparis', NULL, 'Kota Ternate', 5, NULL, NULL, 'Lime', NULL, NULL, false),
    ('danicoparis', NULL, 'Kota Ternate', 6, NULL, NULL, 'Milk', NULL, 'for clarification', false),
    ('danicoparis', NULL, 'Leche de Tigre', 0, NULL, NULL, 'Citadelle Gin', 'Gin', NULL, false),
    ('danicoparis', NULL, 'Leche de Tigre', 1, NULL, NULL, 'Ceviche Distillate', NULL, NULL, false),
    ('danicoparis', NULL, 'Leche de Tigre', 2, NULL, NULL, 'Coconut Oil', NULL, NULL, false),
    ('danicoparis', NULL, 'Leche de Tigre', 3, NULL, NULL, 'Lime', NULL, NULL, false),
    ('danicoparis', NULL, 'Leche de Tigre', 4, NULL, NULL, 'Ají Amarillo', NULL, NULL, false),
    ('danicoparis', NULL, 'Leche de Tigre', 5, NULL, NULL, 'Coriander', NULL, NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 0, NULL, NULL, 'Peanut Butter Distillate', NULL, NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 1, NULL, NULL, 'Planteray 3 Stars Rum', 'Rum', NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 2, NULL, NULL, 'Palm Sugar', NULL, NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 3, NULL, NULL, 'Mango', NULL, NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 4, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 5, NULL, NULL, 'Cucumber', NULL, NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 6, NULL, NULL, 'Sweet Potato', NULL, NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 7, NULL, NULL, 'Lime', NULL, NULL, false),
    ('danicoparis', NULL, 'Krakatoa', 8, NULL, NULL, 'Soy Milk', NULL, 'for clarification', false),
    ('danicoparis', NULL, 'Café-Moutarde Banane', 0, NULL, NULL, 'Black Mustard Seed Distillate', NULL, NULL, false),
    ('danicoparis', NULL, 'Café-Moutarde Banane', 1, NULL, NULL, 'Coffee Liqueur', NULL, NULL, false),
    ('danicoparis', NULL, 'Café-Moutarde Banane', 2, NULL, NULL, 'Espresso', NULL, NULL, false),
    ('danicoparis', NULL, 'Café-Moutarde Banane', 3, NULL, NULL, 'Banana', NULL, NULL, false),
    ('danicoparis', NULL, 'Sakura', 0, NULL, NULL, 'Citadelle Gin', 'Gin', NULL, false),
    ('danicoparis', NULL, 'Sakura', 1, NULL, NULL, 'Sweet Vermouth', NULL, NULL, false),
    ('danicoparis', NULL, 'Sakura', 2, NULL, NULL, 'Campari', NULL, NULL, false),
    ('danicoparis', NULL, 'Sakura', 3, NULL, NULL, 'Umeshu', NULL, NULL, false),
    ('danicoparis', NULL, 'Sakura', 4, NULL, NULL, 'Sakura', NULL, NULL, false),
    ('scarfesbar', NULL, 'Iron Lady', 0, NULL, NULL, 'Glenfiddich 12 Single Malt Scotch', 'Single Malt Scotch Whisky', NULL, false),
    ('scarfesbar', NULL, 'Iron Lady', 1, NULL, NULL, 'Chocolate Wine', NULL, NULL, false),
    ('scarfesbar', NULL, 'Iron Lady', 2, NULL, NULL, 'Fig Leaf', NULL, NULL, false),
    ('scarfesbar', NULL, 'Iron Lady', 3, NULL, NULL, 'Citrus', NULL, 'clarified', false),
    ('scarfesbar', NULL, 'Iron Lady', 4, NULL, NULL, 'Cracker', NULL, 'garnish', false),
    ('scarfesbar', NULL, 'Hot-Air Balloon', 0, NULL, NULL, 'The Macallan 12 Single Malt Scotch', 'Single Malt Scotch Whisky', NULL, false),
    ('scarfesbar', NULL, 'Hot-Air Balloon', 1, NULL, NULL, 'Sherry', NULL, 'flavoured with palo santo and Earl Grey', false),
    ('scarfesbar', NULL, 'Hot-Air Balloon', 2, NULL, NULL, 'Almond', NULL, 'peated', false),
    ('scarfesbar', NULL, 'Toothless Grin', 0, NULL, NULL, 'Rémy Martin 1738 Cognac', 'Cognac', NULL, false),
    ('scarfesbar', NULL, 'Toothless Grin', 1, NULL, NULL, 'Medjool Dates', NULL, NULL, false),
    ('scarfesbar', NULL, 'Toothless Grin', 2, NULL, NULL, 'Evaporated Beetroot', NULL, NULL, false),
    ('scarfesbar', NULL, 'Toothless Grin', 3, NULL, NULL, 'Citra Hops', NULL, NULL, false),
    ('scarfesbar', NULL, 'Toothless Grin', 4, NULL, NULL, 'Served with a spoon of goat''s cheese, lemon curd and absinthe', NULL, 'garnish', false),
    ('scarfesbar', NULL, 'Royal Salute Kensington', 0, NULL, NULL, 'Royal Salute 21 Year Old The Signature Blend Blended Scotch', 'Blended Scotch Whisky', NULL, false),
    ('scarfesbar', NULL, 'Royal Salute Kensington', 1, NULL, NULL, 'Rosewater Honey Syrup', NULL, 'house made', false),
    ('scarfesbar', NULL, 'Royal Salute Kensington', 2, NULL, NULL, 'Lemon Juice', NULL, 'fresh', false),
    ('scarfesbar', NULL, 'Royal Salute Kensington', 3, NULL, NULL, 'Soda', NULL, NULL, false),
    ('scarfesbar', NULL, 'Royal Salute Kensington', 4, NULL, NULL, 'Small edible flower', NULL, 'garnish', false),
    ('scarfesbar', NULL, 'Night Beat', 0, 50, 'ml', 'Glenmorangie Signet Single Malt Scotch', 'Single Malt Scotch Whisky', NULL, false),
    ('scarfesbar', NULL, 'Night Beat', 1, 10, 'ml', 'Balsamic Vermouth', NULL, NULL, false),
    ('scarfesbar', NULL, 'Night Beat', 2, 1, 'dash', 'Cedarwood And/or Acorn Bitters', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Stolen Apples', 0, NULL, NULL, 'Eminente 7 Year Old Rum', 'Rum', NULL, false),
    ('svanen.oslo', NULL, 'Stolen Apples', 1, NULL, NULL, 'Bombay Sapphire Premier Cru Gin', 'Gin', NULL, false),
    ('svanen.oslo', NULL, 'Stolen Apples', 2, NULL, NULL, 'Green Apple Juice', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Stolen Apples', 3, NULL, NULL, 'Lapsang Souchong Tea', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Stolen Apples', 4, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Stolen Apples', 5, NULL, NULL, 'Green Shiso', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Stolen Apples', 6, NULL, NULL, 'Oat Milk', NULL, 'used to clarify', false),
    ('svanen.oslo', NULL, 'Norwegian Waffles (Smørbukk)', 0, NULL, NULL, 'Michter''s US*1 Bourbon', 'Bourbon Whiskey', NULL, false),
    ('svanen.oslo', NULL, 'Norwegian Waffles (Smørbukk)', 1, NULL, NULL, 'Campari', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Norwegian Waffles (Smørbukk)', 2, NULL, NULL, 'Brown Cheese', NULL, 'brunost', false),
    ('svanen.oslo', NULL, 'Norwegian Waffles (Smørbukk)', 3, NULL, NULL, 'Butter', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Norwegian Waffles (Smørbukk)', 4, NULL, NULL, 'Strawberries', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Norwegian Waffles (Smørbukk)', 5, NULL, NULL, 'Sour Cream', NULL, 'used to clarify', false),
    ('svanen.oslo', NULL, 'Rabarbra Spritz', 0, NULL, NULL, 'Ketel One Vodka', 'Vodka', NULL, false),
    ('svanen.oslo', NULL, 'Rabarbra Spritz', 1, NULL, NULL, 'Rinomato L''Aperitivo Deciso', 'Aperitivo', NULL, false),
    ('svanen.oslo', NULL, 'Rabarbra Spritz', 2, NULL, NULL, 'Rhubarb Liqueur', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Rabarbra Spritz', 3, NULL, 'top', 'Martini Prosecco', 'Prosecco', NULL, false),
    ('svanen.oslo', NULL, 'Rabarbra Spritz', 4, NULL, 'top', 'Soda', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Midnight Sun', 0, NULL, NULL, 'Bacardi Carta Blanca White Rum', 'White Rum', NULL, false),
    ('svanen.oslo', NULL, 'Midnight Sun', 1, NULL, NULL, 'St-Germain', 'Elderflower Liqueur', NULL, false),
    ('svanen.oslo', NULL, 'Midnight Sun', 2, NULL, NULL, 'Chartreuse', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Midnight Sun', 3, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Midnight Sun', 4, NULL, NULL, 'Saffron', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Midnight Sun', 5, NULL, NULL, 'Cocoa Butter', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Midnight Sun', 6, NULL, NULL, 'Wheat Beer Syrup', NULL, NULL, false),
    ('svanen.oslo', NULL, 'Midnight Sun', 7, NULL, NULL, 'Egg White Substitute', NULL, 'listed as ''fake egg white''', false),
    ('sastreriamartinezlima', NULL, 'Kené', 0, NULL, NULL, 'Cartavio Solera 12 Year Old Aged Rum', 'Aged Rum', 'fat-washed with chestnut', false),
    ('sastreriamartinezlima', NULL, 'Kené', 1, NULL, NULL, 'Amazon Citrus Distillate', NULL, 'house made from lemon, mandarin and rough lemon', false),
    ('sastreriamartinezlima', NULL, 'Kené', 2, NULL, NULL, 'White Vermouth', NULL, 'house made with mamey sapote', false),
    ('sastreriamartinezlima', NULL, 'Mrs Martínez', 0, NULL, NULL, 'Intira Gin', 'Gin', NULL, false),
    ('sastreriamartinezlima', NULL, 'Mrs Martínez', 1, NULL, NULL, 'Aperol', NULL, 'strawberry infused', false),
    ('sastreriamartinezlima', NULL, 'Mrs Martínez', 2, NULL, NULL, 'Mandarin Lime', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Mrs Martínez', 3, NULL, NULL, 'Blueberries', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Mrs Martínez', 4, NULL, NULL, 'Bitter Lemon', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Mr. Martinez 2.0', 0, NULL, NULL, 'Johnnie Walker Gold Label Blended Scotch', 'Blended Scotch Whisky', 'cheesecake infused', false),
    ('sastreriamartinezlima', NULL, 'Mr. Martinez 2.0', 1, NULL, NULL, 'Blanco Vermouth', NULL, 'thyme infused', false),
    ('sastreriamartinezlima', NULL, 'Mr. Martinez 2.0', 2, NULL, NULL, 'Bergamot', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Mr. Martinez 2.0', 3, NULL, NULL, 'Quinine', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Mr. Martinez 2.0', 4, NULL, NULL, 'Cacao Mucilage', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Huaca Pietra', 0, NULL, NULL, 'Wine', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Huaca Pietra', 1, NULL, NULL, 'Vermouth', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Huaca Pietra', 2, NULL, NULL, 'Coca Leaf', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Huaca Pietra', 3, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Huaca Pietra', 4, NULL, NULL, 'Yacón Honey', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Huaca Pietra', 5, NULL, NULL, 'Limón Sidra', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Huaca Pietra', 6, NULL, NULL, 'Grapefruit Bitters', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Cochinilla', 0, NULL, NULL, 'Rum', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Cochinilla', 1, NULL, NULL, 'Red Prickly Pear', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Cochinilla', 2, NULL, NULL, 'Cocona', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Cochinilla', 3, NULL, NULL, 'Beetroot Liqueur', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Cochinilla', 4, NULL, NULL, 'Sanky Cordial', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Cochinilla', 5, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('sastreriamartinezlima', NULL, 'Cochinilla', 6, NULL, NULL, 'Cacao Bitters', NULL, NULL, false),
    ('pandaandsons', NULL, 'Coconut Daiquiri', 0, NULL, NULL, 'Bacardi Carta Blanca White Rum', 'White Rum', 'switched with roasted coconut milk', false),
    ('pandaandsons', NULL, 'Coconut Daiquiri', 1, NULL, NULL, 'Coconut Milk', NULL, 'Thai, with roasted coconut flakes', false),
    ('pandaandsons', NULL, 'Coconut Daiquiri', 2, NULL, NULL, 'Lime', NULL, NULL, false),
    ('pandaandsons', NULL, 'Red Panda 2.0 (Bloody Mary)', 0, NULL, NULL, 'Tanqueray No. Ten Gin', 'Gin', 'infused with cucumber and torn makrut lime leaves', false),
    ('pandaandsons', NULL, 'Red Panda 2.0 (Bloody Mary)', 1, NULL, NULL, 'Tomato Juice', NULL, 'cryo-concentrated', false),
    ('pandaandsons', NULL, 'Red Panda 2.0 (Bloody Mary)', 2, NULL, NULL, 'Spice Mix', NULL, 'house blend', false),
    ('pandaandsons', NULL, 'Red Panda 2.0 (Bloody Mary)', 3, NULL, NULL, 'Salt and Pepper', NULL, NULL, false),
    ('pandaandsons', NULL, 'Red Panda 2.0 (Bloody Mary)', 4, NULL, NULL, 'Worcestershire Sauce', NULL, NULL, false),
    ('pandaandsons', NULL, 'Red Panda 2.0 (Bloody Mary)', 5, NULL, NULL, 'Lemon Juice', NULL, 'fresh', false),
    ('pandaandsons', NULL, 'Red Panda 2.0 (Bloody Mary)', 6, NULL, 'top', 'Guinness', NULL, NULL, false),
    ('pandaandsons', NULL, 'Birdcage', 0, NULL, NULL, 'Johnnie Walker Gold Reserve Blended Scotch', 'Blended Scotch Whisky', NULL, false),
    ('pandaandsons', NULL, 'Birdcage', 1, NULL, NULL, 'Rhubarb and Lemongrass Shrub', NULL, 'house made', false),
    ('pandaandsons', NULL, 'Birdcage', 2, NULL, NULL, 'Aperol', NULL, NULL, false),
    ('pandaandsons', NULL, 'Birdcage', 3, NULL, NULL, 'Angostura', NULL, NULL, false),
    ('pandaandsons', NULL, 'Birdcage', 4, NULL, NULL, 'Cinnamon and clove smoke', NULL, 'garnish', false),
    ('rodahusetsthlm', NULL, 'Sweet Vernal Grass with Good Cream', 0, NULL, NULL, 'Vodka', NULL, NULL, false),
    ('rodahusetsthlm', NULL, 'Sweet Vernal Grass with Good Cream', 1, NULL, NULL, 'Sweet Vernal Grass Liqueur', NULL, 'house made on Absolut Elyx, sweetened with Galliano', false),
    ('rodahusetsthlm', NULL, 'Sweet Vernal Grass with Good Cream', 2, NULL, NULL, 'Green Apple Sour Mix', NULL, 'made with Happī Sour Mix; made from Swedish Granny Smith apples', false),
    ('rodahusetsthlm', NULL, 'Sweet Vernal Grass with Good Cream', 3, NULL, NULL, 'Cream', NULL, 'from Jylland, Denmark', false),
    ('rodahusetsthlm', NULL, 'Apple & Hops', 0, NULL, NULL, 'Whisky', NULL, NULL, false),
    ('rodahusetsthlm', NULL, 'Apple & Hops', 1, NULL, NULL, 'Ingrid Marie Apples', NULL, 'late harvest, freshly pressed', false),
    ('rodahusetsthlm', NULL, 'Apple & Hops', 2, NULL, NULL, 'Swedish Hops', NULL, NULL, false),
    ('rodahusetsthlm', NULL, 'Plums from Dreyer in Höör', 0, NULL, NULL, 'Plums', NULL, 'from Dreyer in Höör', false),
    ('rodahusetsthlm', NULL, 'Plums from Dreyer in Höör', 1, NULL, NULL, 'Vodka', NULL, NULL, false),
    ('rodahusetsthlm', NULL, 'Plums from Dreyer in Höör', 2, NULL, NULL, 'Eau-de-vie', NULL, NULL, false),
    ('rodahusetsthlm', NULL, 'Raspberries & Whey', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('rodahusetsthlm', NULL, 'Raspberries & Whey', 1, NULL, NULL, 'Whey', NULL, 'raspberry flavoured', false),
    ('mimikakushi', NULL, 'Shadrach (Kori Kakushi Martini)', 0, 60, 'ml', 'The Botanist Islay Dry Gin', 'Gin', NULL, false),
    ('mimikakushi', NULL, 'Shadrach (Kori Kakushi Martini)', 1, 20, 'ml', 'Japanese Ume', NULL, 'the gin is dripped slowly through the ume', false),
    ('mimikakushi', NULL, 'Shadrach (Kori Kakushi Martini)', 2, NULL, NULL, 'Mancino Vermouth Secco', 'Dry Vermouth', 'a touch', false),
    ('mimikakushi', NULL, 'Shadrach (Kori Kakushi Martini)', 3, NULL, NULL, 'Spritz of house citrus perfume', NULL, 'garnish', false),
    ('mimikakushi', NULL, 'Tokoramo', 0, NULL, NULL, 'Campari', NULL, NULL, false),
    ('mimikakushi', NULL, 'Tokoramo', 1, NULL, NULL, 'Mancino Rosso Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('mimikakushi', NULL, 'Tokoramo', 2, NULL, NULL, 'Cherry Sencha Kombucha', NULL, NULL, false),
    ('mimikakushi', NULL, 'Kimura', 0, NULL, NULL, 'Bulleit Bourbon', 'Bourbon Whiskey', NULL, false),
    ('mimikakushi', NULL, 'Kimura', 1, NULL, NULL, 'Umeshu', NULL, NULL, false),
    ('mimikakushi', NULL, 'Kimura', 2, NULL, NULL, 'Rooibos', NULL, NULL, false),
    ('mimikakushi', NULL, 'Kimura', 3, NULL, NULL, 'Coconut Water', NULL, NULL, false),
    ('coahongkong', NULL, 'La Paloma de Oaxaca', 0, 15, 'ml', 'Tequila', NULL, NULL, false),
    ('coahongkong', NULL, 'La Paloma de Oaxaca', 1, 15, 'ml', 'Mezcal', NULL, NULL, false),
    ('coahongkong', NULL, 'La Paloma de Oaxaca', 2, 5, 'ml', 'Lime Juice', NULL, NULL, false),
    ('coahongkong', NULL, 'La Paloma de Oaxaca', 3, NULL, 'top', 'Grapefruit Soda', NULL, NULL, false),
    ('coahongkong', NULL, 'La Paloma de Oaxaca', 4, NULL, NULL, 'Worm salt rim', NULL, 'garnish', false),
    ('coahongkong', NULL, 'Orchata de Pistachio', 0, 40, 'ml', 'Tequila', NULL, NULL, false),
    ('coahongkong', NULL, 'Orchata de Pistachio', 1, 20, 'ml', 'Horchata', NULL, 'listed as ''Orchata''', false),
    ('coahongkong', NULL, 'Orchata de Pistachio', 2, 20, 'ml', 'Pistachio Orgeat', NULL, NULL, false),
    ('coahongkong', NULL, 'Orchata de Pistachio', 3, 20, 'ml', 'Lemon Juice', NULL, NULL, false),
    ('coahongkong', NULL, 'Orchata de Pistachio', 4, 10, 'ml', 'Whey', NULL, NULL, false),
    ('coahongkong', NULL, 'Bitter Melon Collins', 0, 45, 'ml', 'Tequila', NULL, 'infused with coconut and green curry botanicals', false),
    ('coahongkong', NULL, 'Bitter Melon Collins', 1, 50, 'ml', 'Bitter Melon Cordial', NULL, 'house made', false),
    ('coahongkong', NULL, 'Bitter Melon Collins', 2, 1, 'tbsp', 'Citric Acid Solution', NULL, NULL, false),
    ('coahongkong', NULL, 'Bitter Melon Collins', 3, 50, 'ml', 'Bitter Orange Tonic', NULL, NULL, false),
    ('coahongkong', NULL, 'Bitter Melon Collins', 4, NULL, NULL, 'Cucumber slice', NULL, 'garnish', false),
    ('coahongkong', NULL, 'Pepper Smash', 0, NULL, NULL, 'Agave Spirit', NULL, 'jalapeño infused', false),
    ('coahongkong', NULL, 'Pepper Smash', 1, NULL, NULL, 'Yellow Bell Pepper', NULL, NULL, false),
    ('coahongkong', NULL, 'Pepper Smash', 2, NULL, NULL, 'Italian Basil', NULL, NULL, false),
    ('coahongkong', NULL, 'Pepper Smash', 3, NULL, NULL, 'Pineapple Juice', NULL, NULL, false),
    ('coahongkong', NULL, 'Pepper Smash', 4, NULL, NULL, 'Mint sprig', NULL, 'garnish', false),
    ('coahongkong', NULL, 'Smacked Cucumber', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('coahongkong', NULL, 'Smacked Cucumber', 1, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('coahongkong', NULL, 'Smacked Cucumber', 2, NULL, NULL, 'Cucumber', NULL, NULL, false),
    ('coahongkong', NULL, 'Smacked Cucumber', 3, NULL, NULL, 'Chinese Salad Sauce', NULL, 'soy based', false),
    ('salmonguru', NULL, 'Old School Funny', 0, NULL, NULL, 'Le Tribute Gin', 'Gin', NULL, false),
    ('salmonguru', NULL, 'Old School Funny', 1, NULL, NULL, 'Red Vermouth', NULL, NULL, false),
    ('salmonguru', NULL, 'Old School Funny', 2, NULL, NULL, 'Campari', NULL, NULL, false),
    ('salmonguru', NULL, 'Old School Funny', 3, NULL, NULL, 'Amontillado Sherry', NULL, NULL, false),
    ('salmonguru', NULL, 'Old School Funny', 4, NULL, NULL, 'Tawny Port', NULL, NULL, false),
    ('salmonguru', NULL, 'Ultramarino', 0, NULL, NULL, 'Mezcal Unión', 'Mezcal', NULL, false),
    ('salmonguru', NULL, 'Ultramarino', 1, NULL, NULL, 'Manzanilla Sherry', NULL, NULL, false),
    ('salmonguru', NULL, 'Ultramarino', 2, NULL, NULL, 'Lime and Rhubarb Cordial', NULL, 'house made', false),
    ('salmonguru', NULL, 'Pantera Jackson', 0, NULL, NULL, '1615 Pisco', 'Pisco', NULL, false),
    ('salmonguru', NULL, 'Pantera Jackson', 1, NULL, NULL, '400 Conejos Mezcal', 'Mezcal', NULL, false),
    ('salmonguru', NULL, 'Pantera Jackson', 2, NULL, NULL, 'Mango Water', NULL, NULL, false),
    ('salmonguru', NULL, 'Pantera Jackson', 3, NULL, NULL, 'Fish Sauce', NULL, NULL, false),
    ('salmonguru', NULL, 'Pantera Jackson', 4, NULL, NULL, 'Greek Yoghurt', NULL, 'used to clarify', false),
    ('salmonguru', NULL, 'Chipotle Chillón', 0, NULL, NULL, '400 Conejos Mezcal', 'Mezcal', NULL, false),
    ('salmonguru', NULL, 'Chipotle Chillón', 1, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('salmonguru', NULL, 'Chipotle Chillón', 2, NULL, NULL, 'Chipotle Chilli Syrup', NULL, NULL, false),
    ('salmonguru', NULL, 'Chipotle Chillón', 3, NULL, NULL, 'Absinthe', NULL, 'aroma', false),
    ('salmonguru', NULL, 'Modern Times', 0, 0.7, 'oz', 'Brandy de Jerez', NULL, NULL, false),
    ('salmonguru', NULL, 'Modern Times', 1, 1.35, 'oz', 'Red Vermouth', NULL, 'from Reus', false),
    ('salmonguru', NULL, 'Modern Times', 2, 0.35, 'oz', 'Pacharán', NULL, 'from Navarre', false),
    ('salmonguru', NULL, 'Modern Times', 3, 1, 'slice', 'Orange', NULL, 'Valencian', false),
    ('sipandguzzlenyc', NULL, 'Miami Vice Negroni', 0, NULL, NULL, 'Gin', NULL, 'implied by the classic Negroni base; not itemised by source', false),
    ('sipandguzzlenyc', NULL, 'Miami Vice Negroni', 1, NULL, NULL, 'Campari', NULL, 'implied by the classic Negroni base; not itemised by source', false),
    ('sipandguzzlenyc', NULL, 'Miami Vice Negroni', 2, NULL, NULL, 'Sweet Vermouth', NULL, 'implied by the classic Negroni base; not itemised by source', false),
    ('sipandguzzlenyc', NULL, 'Miami Vice Negroni', 3, NULL, NULL, 'Strawberries', NULL, 'infused', false),
    ('sipandguzzlenyc', NULL, 'Miami Vice Negroni', 4, NULL, NULL, 'Coconut', NULL, 'fat wash', false),
    ('sipandguzzlenyc', NULL, 'Tomato Tree', 0, NULL, NULL, 'Tomato Water', NULL, NULL, false),
    ('sipandguzzlenyc', NULL, 'Tomato Tree', 1, NULL, NULL, 'Gin', NULL, 'dill infused', false),
    ('sipandguzzlenyc', NULL, 'Tomato Tree', 2, NULL, NULL, 'Shochu', NULL, NULL, false),
    ('sipandguzzlenyc', NULL, 'Tomato Tree', 3, NULL, NULL, 'Mastiha', NULL, NULL, false),
    ('sipandguzzlenyc', NULL, 'Tomato Tree', 4, NULL, NULL, 'St-Germain', 'Elderflower Liqueur', NULL, false),
    ('sipandguzzlenyc', NULL, 'Tomato Tree', 5, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('sipandguzzlenyc', NULL, 'Sherry Colada Highball', 0, 1, 'part', 'Harveys Bristol Cream Sherry', 'Cream Sherry', '1 part; brand is Punch''s suggestion', false),
    ('sipandguzzlenyc', NULL, 'Sherry Colada Highball', 1, 2, 'part', 'Bubly', 'Coconut-pineapple Seltzer', '2 parts; unsweetened seltzer', false),
    ('drinkkongbar', NULL, 'Canova', 0, NULL, NULL, 'Roku Gin', 'Gin', NULL, false),
    ('drinkkongbar', NULL, 'Canova', 1, NULL, NULL, 'Thyme', NULL, 'in the Mediterranean cordial', false),
    ('drinkkongbar', NULL, 'Canova', 2, NULL, NULL, 'Rosemary', NULL, 'in the Mediterranean cordial', false),
    ('drinkkongbar', NULL, 'Canova', 3, NULL, NULL, 'Basil', NULL, 'in the Mediterranean cordial', false),
    ('drinkkongbar', NULL, 'Canova', 4, NULL, NULL, 'Black Olive', NULL, 'in the Mediterranean cordial', false),
    ('drinkkongbar', NULL, 'Gaijin', 0, NULL, NULL, 'Nikka Coffey Grain Whisky', 'Grain Whisky', NULL, false),
    ('drinkkongbar', NULL, 'Gaijin', 1, NULL, NULL, 'Miso', NULL, NULL, false),
    ('drinkkongbar', NULL, 'Gaijin', 2, NULL, NULL, 'Milk', NULL, NULL, false),
    ('drinkkongbar', NULL, 'Gaijin', 3, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('drinkkongbar', NULL, 'Big Trouble in Oaxaca', 0, NULL, NULL, 'Del Maguey Vida Mezcal', 'Mezcal', NULL, false),
    ('drinkkongbar', NULL, 'Big Trouble in Oaxaca', 1, NULL, NULL, 'Pineapple Liqueur', NULL, NULL, false),
    ('drinkkongbar', NULL, 'Big Trouble in Oaxaca', 2, NULL, NULL, 'Jalapeño', NULL, NULL, false),
    ('drinkkongbar', NULL, 'Big Trouble in Oaxaca', 3, NULL, NULL, 'Midori', 'Melon Liqueur', NULL, false),
    ('drinkkongbar', NULL, 'Big Trouble in Oaxaca', 4, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('drinkkongbar', NULL, 'Big Trouble in Oaxaca', 5, NULL, NULL, 'Agave Syrup', NULL, NULL, false),
    ('drinkkongbar', NULL, 'Bowie', 0, 50, 'ml', 'Merlet Eau de Vigne Vie', 'Grape Eau de Vie', NULL, false),
    ('drinkkongbar', NULL, 'Bowie', 1, 15, 'ml', 'Italicus Rosolio di Bergamotto', 'Bergamot Liqueur', NULL, false),
    ('drinkkongbar', NULL, 'Bowie', 2, 15, 'ml', 'Merlet Trois Citrus', 'Citrus Liqueur', NULL, false),
    ('drinkkongbar', NULL, 'Bowie', 3, 20, 'ml', 'Citric Acid Solution', NULL, 'house made', false),
    ('drinkkongbar', NULL, 'Bowie', 4, 7.5, 'ml', 'Simple Syrup', NULL, 'listed as ''sugar''', false),
    ('drinkkongbar', NULL, 'Bowie', 5, 2, 'dash', 'Grapefruit Bitters', NULL, NULL, false),
    ('drinkkongbar', NULL, 'Bowie', 6, NULL, NULL, 'Coral crusta rim made with blue curaçao; grapefruit zest', NULL, 'garnish', false),
    ('drinkkongbar', NULL, 'Aceticus', 0, 40, 'ml', 'Italicus Rosolio di Bergamotto', 'Bergamot Liqueur', NULL, false),
    ('drinkkongbar', NULL, 'Aceticus', 1, 25, 'ml', 'Cocchi Americano', NULL, 'infused with Roman chamomile', false),
    ('drinkkongbar', NULL, 'Aceticus', 2, 50, 'ml', 'Kong Cordial', NULL, 'house citrus-shell cordial', false),
    ('drinkkongbar', NULL, 'Aceticus', 3, 10, 'ml', 'White Wine Vinegar', NULL, 'Frascati Superiore', false),
    ('doublechickenpleasenyc', NULL, 'Japanese Cold Noodle', 0, 45, 'ml', 'Bacardi Carta Blanca White Rum', 'White Rum', NULL, false),
    ('doublechickenpleasenyc', NULL, 'Japanese Cold Noodle', 1, 15, 'ml', 'Coconut Liqueur', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Japanese Cold Noodle', 2, 25, 'ml', 'Pineapple Juice', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Japanese Cold Noodle', 3, 15, 'ml', 'Cucumber Juice', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Japanese Cold Noodle', 4, 5, 'ml', 'Lime Juice', NULL, 'freshly squeezed', false),
    ('doublechickenpleasenyc', NULL, 'Japanese Cold Noodle', 5, 1, 'dash', 'Sesame Oil', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Japanese Cold Noodle', 6, NULL, NULL, 'Pineapple leaves', NULL, 'garnish', false),
    ('doublechickenpleasenyc', NULL, 'Cold Pizza', 0, 30, 'ml', 'Don Fulano Blanco Tequila', 'Tequila', 'infused with Parmigiano Reggiano and burnt toast', false),
    ('doublechickenpleasenyc', NULL, 'Cold Pizza', 1, 10, 'ml', 'Lime-basil Cordial', NULL, 'house-made', false),
    ('doublechickenpleasenyc', NULL, 'Cold Pizza', 2, 5, 'ml', 'Oolong Tea Honey', NULL, 'house-made', false),
    ('doublechickenpleasenyc', NULL, 'Cold Pizza', 3, 40, 'ml', 'Tomato Water', NULL, 'clarified', false),
    ('doublechickenpleasenyc', NULL, 'Cold Pizza', 4, 15, 'ml', 'Egg White', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Cold Pizza', 5, NULL, NULL, 'Edible rice paper print of a hand holding a pizza slice, laid on the foam', NULL, 'garnish', false),
    ('doublechickenpleasenyc', NULL, 'French Toast', 0, 35, 'ml', 'Grey Goose Barley Tea Vodka', 'Barley Tea Vodka', 'vodka infused with roasted barley tea', false),
    ('doublechickenpleasenyc', NULL, 'French Toast', 1, 60, 'ml', 'French Toast Mix', NULL, 'house-made', false),
    ('doublechickenpleasenyc', NULL, 'French Toast', 2, 10, 'ml', 'Brown Sugar Syrup', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'French Toast', 3, NULL, NULL, 'House-made Espresso Martini ''Oreo''', NULL, 'garnish', false),
    ('doublechickenpleasenyc', NULL, 'Red Eye Gravy', 0, NULL, NULL, 'Teeling Irish Whiskey', 'Irish Whiskey', NULL, false),
    ('doublechickenpleasenyc', NULL, 'Red Eye Gravy', 1, NULL, NULL, 'Coffee Butter', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Red Eye Gravy', 2, NULL, NULL, 'Corn', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Red Eye Gravy', 3, NULL, NULL, 'Walnut', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Red Eye Gravy', 4, NULL, NULL, 'Wild Mushroom', NULL, NULL, false),
    ('doublechickenpleasenyc', NULL, 'Red Eye Gravy', 5, NULL, NULL, 'Coppa', NULL, 'microwaved', false),
    ('maybe_sammy_sydney', NULL, 'The Sammy', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'The Sammy', 1, NULL, NULL, 'Sweet Vermouth', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'The Sammy', 2, NULL, NULL, 'Dry Vermouth', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'The Sammy', 3, NULL, NULL, 'Mint', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Milord', 0, 25, 'ml', 'Branko Plum Brandy', 'Plum Brandy', NULL, false),
    ('maybe_sammy_sydney', NULL, 'Milord', 1, 20, 'ml', 'Dubonnet', 'Aromatised Wine', NULL, false),
    ('maybe_sammy_sydney', NULL, 'Milord', 2, 15, 'ml', 'PX Sherry', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Milord', 3, 10, 'ml', 'Avallen Calvados', 'Calvados', NULL, false),
    ('maybe_sammy_sydney', NULL, 'Milord', 4, 3, 'dash', 'Absinthe', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Milord', 5, 3, 'dash', 'Peychaud''s', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Milord', 6, 3, 'drop', 'PX Balsamic Vinegar', NULL, '25-year-old gran reserva, as garnish', false),
    ('maybe_sammy_sydney', NULL, 'Milord', 7, NULL, NULL, 'Three drops of aged PX balsamic vinegar', NULL, 'garnish', false),
    ('maybe_sammy_sydney', NULL, 'Vino Bastardo', 0, 30, 'ml', 'Raisin-infused Scotch Whisky', NULL, 'made with Glenfiddich 14 Year Old; house infusion', false),
    ('maybe_sammy_sydney', NULL, 'Vino Bastardo', 1, 30, 'ml', 'Cocchi Americano Bianco', 'Aperitif Wine', NULL, false),
    ('maybe_sammy_sydney', NULL, 'Vino Bastardo', 2, 5, 'ml', 'Pavan', 'Muscat Liqueur', NULL, false),
    ('maybe_sammy_sydney', NULL, 'Vino Bastardo', 3, 5, 'ml', 'Saffron-infused Grappa', NULL, 'made with Nardini Tagliatella; house infusion', false),
    ('maybe_sammy_sydney', NULL, 'Vino Bastardo', 4, 0.75, 'ml', 'Cassis Angostura Bitters', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Vino Bastardo', 5, NULL, NULL, 'Half a red grape and micro basil on a wooden pick', NULL, 'garnish', false),
    ('maybe_sammy_sydney', NULL, 'Claret Snap', 0, 30, 'ml', 'Gin', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Claret Snap', 1, 30, 'ml', 'Taylor Made', 'Malbec', NULL, false),
    ('maybe_sammy_sydney', NULL, 'Claret Snap', 2, 20, 'ml', 'Lemon Juice', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Claret Snap', 3, 20, 'ml', 'Cacao Syrup', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Claret Snap', 4, 3, NULL, 'Raspberries', NULL, 'fresh', false),
    ('maybe_sammy_sydney', NULL, 'Claret Snap', 5, NULL, NULL, 'Skewered raspberry', NULL, 'garnish', false),
    ('maybe_sammy_sydney', NULL, 'Peaky Blinders', 0, NULL, NULL, 'Benriach 10 Scotch', 'Scotch Whisky', NULL, false),
    ('maybe_sammy_sydney', NULL, 'Peaky Blinders', 1, NULL, NULL, 'Sherry', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Peaky Blinders', 2, NULL, NULL, 'Mead', NULL, NULL, false),
    ('maybe_sammy_sydney', NULL, 'Peaky Blinders', 3, NULL, NULL, 'Green Tea Soda', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Tortellini in Brodo', 0, NULL, NULL, 'Bourbon', NULL, 'nutmeg-infused', false),
    ('1930cocktailbar', NULL, 'Tortellini in Brodo', 1, NULL, NULL, 'Martini Riserva Rubino Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('1930cocktailbar', NULL, 'Tortellini in Brodo', 2, NULL, NULL, 'Bitters', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Tortellini in Brodo', 3, NULL, NULL, 'Tortellini', NULL, 'pre-cooked, soaked in the cocktail', false),
    ('1930cocktailbar', NULL, 'Tortellini in Brodo', 4, NULL, NULL, 'Chicken Broth', NULL, 'hot', false),
    ('1930cocktailbar', NULL, 'Tacos de Carnita', 0, NULL, NULL, 'Del Maguey Vida Mezcal', 'Mezcal', NULL, false),
    ('1930cocktailbar', NULL, 'Tacos de Carnita', 1, NULL, NULL, 'Pulled Pork', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Tacos de Carnita', 2, NULL, NULL, 'Mexican Spices', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Parmigiano Colada', 0, NULL, NULL, 'Havana Club 3 Rum', 'Rum', 'a Transcontinental Rum Jamaica 2006 version is also reported', false),
    ('1930cocktailbar', NULL, 'Parmigiano Colada', 1, NULL, NULL, 'Pineapple Juice', NULL, 'with Sarawak white pepper', false),
    ('1930cocktailbar', NULL, 'Parmigiano Colada', 2, NULL, NULL, 'Truffle Oil', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Parmigiano Colada', 3, NULL, NULL, 'Parmigiano Reggiano Foam', NULL, '24-month cheese, from a siphon', false),
    ('1930cocktailbar', NULL, 'Caviar Martini', 0, NULL, NULL, 'Trip Gin Bari Edition', 'Gin', 'salty gin', false),
    ('1930cocktailbar', NULL, 'Caviar Martini', 1, NULL, NULL, 'Caviar Distillate', NULL, 'house-made', false),
    ('1930cocktailbar', NULL, 'Caviar Martini', 2, NULL, NULL, 'Empirical Ayuuk', 'Spirit', NULL, false),
    ('1930cocktailbar', NULL, 'Caronte', 0, 40, 'ml', 'Octopus Black Ink Bourbon', NULL, 'house infusion', false),
    ('1930cocktailbar', NULL, 'Caronte', 1, 35, 'ml', 'Red Pepper Dry Vermouth', NULL, 'house infusion', false),
    ('1930cocktailbar', NULL, 'Caronte', 2, 2.5, 'ml', 'Saffron Syrup', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Caronte', 3, 2.5, 'ml', 'Venere Black Rice Gum Syrup', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Caronte', 4, 5, 'drop', 'Absinthe', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Caronte', 5, 10, 'drop', 'Barbecue Bitters', NULL, NULL, false),
    ('1930cocktailbar', NULL, 'Caronte', 6, NULL, NULL, 'Chocolate pieces on the side', NULL, 'garnish', false),
    ('jewelnola', NULL, 'Brandy Crusta', 0, 1.75, 'oz', 'Cognac', NULL, 'Remy Martin 1738 at the bar', false),
    ('jewelnola', NULL, 'Brandy Crusta', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('jewelnola', NULL, 'Brandy Crusta', 2, 0.5, 'oz', 'Orange Curacao', NULL, 'Pierre Ferrand Dry Curacao at the bar', false),
    ('jewelnola', NULL, 'Brandy Crusta', 3, 0.25, 'oz', 'Luxardo', 'Maraschino Liqueur', NULL, false),
    ('jewelnola', NULL, 'Brandy Crusta', 4, 2, 'dash', 'Angostura', NULL, NULL, false),
    ('jewelnola', NULL, 'Brandy Crusta', 5, NULL, NULL, 'Peel of half a lemon lining the glass', NULL, 'garnish', false),
    ('jewelnola', NULL, 'Jewel Sazerac', 0, NULL, NULL, 'Sazerac 100 Proof Rye', 'Rye Whiskey', NULL, false),
    ('jewelnola', NULL, 'Jewel Sazerac', 1, NULL, NULL, 'H&H', 'Rainwater Madeira', NULL, false),
    ('jewelnola', NULL, 'Jewel Sazerac', 2, NULL, NULL, 'Matifoc', 'Rancio Sec', NULL, false),
    ('jewelnola', NULL, 'Jewel Sazerac', 3, NULL, NULL, 'Demerara Syrup', NULL, NULL, false),
    ('jewelnola', NULL, 'Jewel Sazerac', 4, NULL, NULL, 'Herbsaint', NULL, NULL, false),
    ('jewelnola', NULL, 'Jewel Sazerac', 5, NULL, NULL, 'Peychaud''s', NULL, NULL, false),
    ('jewelnola', NULL, 'Night Tripper', 0, 1.5, 'oz', 'Bourbon', NULL, 'Evan Williams Bottled-in-Bond at the bar', false),
    ('jewelnola', NULL, 'Night Tripper', 1, 0.75, 'oz', 'Averna', 'Amaro', NULL, false),
    ('jewelnola', NULL, 'Night Tripper', 2, 0.75, 'oz', 'Strega', 'Herbal Liqueur', NULL, false),
    ('jewelnola', NULL, 'Night Tripper', 3, 2, 'dash', 'Peychaud''s', NULL, NULL, false),
    ('jewelnola', NULL, 'Bywater', 0, 1.75, 'oz', 'Aged Rum', NULL, 'Jewel private-barrel Don Q at the bar', false),
    ('jewelnola', NULL, 'Bywater', 1, 0.75, 'oz', 'Averna', 'Amaro', NULL, false),
    ('jewelnola', NULL, 'Bywater', 2, 0.5, 'oz', 'Chartreuse', NULL, NULL, false),
    ('jewelnola', NULL, 'Bywater', 3, 0.25, 'oz', 'Velvet Falernum', 'Falernum', NULL, false),
    ('jewelnola', NULL, 'Bywater', 4, 2, 'dash', 'Peychaud''s', NULL, NULL, false),
    ('jewelnola', NULL, 'Bywater', 5, 2, 'dash', 'Regans''', 'Orange Bitters', NULL, false),
    ('jewelnola', NULL, 'Bywater', 6, NULL, NULL, 'Orange twist (expressed and discarded) and a cherry', NULL, 'garnish', false),
    ('jewelnola', NULL, 'Pouves-Vous Poulet', 0, NULL, NULL, 'Rum', NULL, 'duck fat-washed blend', false),
    ('jewelnola', NULL, 'Pouves-Vous Poulet', 1, NULL, NULL, 'Lapsang Maple Syrup', NULL, NULL, false),
    ('jewelnola', NULL, 'Pouves-Vous Poulet', 2, NULL, NULL, 'Bitter Queen''s', 'Caribbean Bitters', NULL, false),
    ('virtutokyo', NULL, 'Virtù Martini', 0, NULL, NULL, 'Japanese Gin', NULL, NULL, false),
    ('virtutokyo', NULL, 'Virtù Martini', 1, NULL, NULL, 'Vodka', NULL, NULL, false),
    ('virtutokyo', NULL, 'Virtù Martini', 2, NULL, NULL, 'French Dry Vermouth', NULL, NULL, false),
    ('virtutokyo', NULL, 'Virtù Martini', 3, NULL, NULL, 'Hinoki Bitters', NULL, NULL, false),
    ('virtutokyo', NULL, 'Smoked Ume Fashioned', 0, NULL, NULL, 'Brandy Umeshu', NULL, 'house-made plum brandy', false),
    ('virtutokyo', NULL, 'Smoked Ume Fashioned', 1, NULL, NULL, 'Michter''s Bourbon', 'Bourbon', NULL, false),
    ('virtutokyo', NULL, 'Smoked Ume Fashioned', 2, NULL, NULL, 'Japanese Whisky', NULL, NULL, false),
    ('virtutokyo', NULL, 'Smoked Ume Fashioned', 3, NULL, NULL, 'Hinoki Bitters', NULL, NULL, false),
    ('virtutokyo', NULL, 'Fig Cognac & Spices', 0, NULL, NULL, 'Cognac', NULL, NULL, false),
    ('virtutokyo', NULL, 'Fig Cognac & Spices', 1, NULL, NULL, 'Fig', NULL, NULL, false),
    ('virtutokyo', NULL, 'Fig Cognac & Spices', 2, NULL, NULL, 'Spices', NULL, NULL, false),
    ('virtutokyo', NULL, 'Fig Cognac & Spices', 3, NULL, NULL, 'Black Tea', NULL, 'Japanese black tea, chai-style', false),
    ('virtutokyo', NULL, 'Fig Cognac & Spices', 4, NULL, NULL, 'Milk', NULL, 'used to clarify', false),
    ('overstory', NULL, 'Terroir Old Fashioned', 0, NULL, NULL, 'Reposado Tequila', NULL, NULL, false),
    ('overstory', NULL, 'Terroir Old Fashioned', 1, NULL, NULL, 'Palo Santo', NULL, NULL, false),
    ('overstory', NULL, 'Terroir Old Fashioned', 2, NULL, NULL, 'Sea Salt', NULL, 'harvested at Fort Tilden, Queens', false),
    ('overstory', NULL, 'Terroir Old Fashioned', 3, NULL, NULL, 'Vin Jaune', NULL, 'listed by 50 Best, not on the current menu', true),
    ('overstory', NULL, 'Terroir Old Fashioned', 4, NULL, NULL, 'Chartreuse', NULL, 'listed by 50 Best, not on the current menu', true),
    ('overstory', NULL, 'In the Clouds', 0, NULL, NULL, 'Whiskey', NULL, NULL, false),
    ('overstory', NULL, 'In the Clouds', 1, NULL, NULL, 'Earl Grey Tea', NULL, NULL, false),
    ('overstory', NULL, 'In the Clouds', 2, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('overstory', NULL, 'In the Clouds', 3, NULL, NULL, 'Milk', NULL, 'used to clarify', false),
    ('overstory', NULL, 'In the Clouds', 4, NULL, 'top', 'Champagne', NULL, NULL, false),
    ('overstory', NULL, 'El Bandito', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('overstory', NULL, 'El Bandito', 1, NULL, NULL, 'Tomato Water', NULL, NULL, false),
    ('overstory', NULL, 'El Bandito', 2, NULL, NULL, 'Koseret', NULL, NULL, false),
    ('overstory', NULL, 'El Bandito', 3, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('overstory', NULL, 'El Bandito', 4, NULL, NULL, 'Yuzu Kosho', NULL, NULL, false),
    ('overstory', NULL, 'Five Spice Milk Punch', 0, NULL, NULL, 'Rum', NULL, NULL, false),
    ('overstory', NULL, 'Five Spice Milk Punch', 1, NULL, NULL, 'Dry Curacao', NULL, NULL, false),
    ('overstory', NULL, 'Five Spice Milk Punch', 2, NULL, NULL, 'Peanut', NULL, NULL, false),
    ('overstory', NULL, 'Five Spice Milk Punch', 3, NULL, NULL, 'Sesame', NULL, NULL, false),
    ('overstory', NULL, 'Five Spice Milk Punch', 4, NULL, NULL, 'Five Spice', NULL, NULL, false),
    ('overstory', NULL, 'Five Spice Milk Punch', 5, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('overstory', NULL, 'Five Spice Milk Punch', 6, NULL, NULL, 'Milk', NULL, 'used to clarify', false),
    ('the.bar.in.front.of.the.bar', NULL, 'Kafeneio', 0, NULL, NULL, 'Fords Gin', 'Gin', NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Kafeneio', 1, NULL, NULL, 'Ketel One Vodka', 'Vodka', NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Kafeneio', 2, NULL, NULL, 'Greek Olive', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Kafeneio', 3, NULL, NULL, 'Air-dried Salami', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Kafeneio', 4, NULL, NULL, 'Fortified Wine', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Kafeneio', 5, NULL, NULL, 'Skinos', 'Mastiha', NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Taco Margarita', 0, NULL, NULL, 'Don Julio Tequila', 'Tequila', NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Taco Margarita', 1, NULL, NULL, 'Morita Pepper', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Taco Margarita', 2, NULL, NULL, 'Jalapeno Pepper', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Taco Margarita', 3, NULL, NULL, 'Coriander', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Taco Margarita', 4, NULL, NULL, 'Tomato Water', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Taco Margarita', 5, NULL, NULL, 'Corn Salt', NULL, 'rim', false),
    ('the.bar.in.front.of.the.bar', NULL, 'The Yellow House', 0, NULL, NULL, 'Lost Explorer Mezcal', 'Mezcal', NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'The Yellow House', 1, NULL, NULL, 'Pineapple', NULL, 'lacto-fermented', false),
    ('the.bar.in.front.of.the.bar', NULL, 'The Yellow House', 2, NULL, NULL, 'Dijon Mustard', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'The Yellow House', 3, NULL, NULL, 'Black Garlic', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Talking Heads', 0, NULL, NULL, 'Martini Bitter', 'Bitter Aperitivo', NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Talking Heads', 1, NULL, NULL, 'Martini Rubino Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Talking Heads', 2, NULL, NULL, 'Kimchi Distillate', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Talking Heads', 3, NULL, NULL, 'Papaya', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Talking Heads', 4, NULL, NULL, 'Green Bell Pepper', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Ali Bomaye', 0, NULL, NULL, 'Johnnie Walker Black Label Blended Scotch', 'Blended Scotch Whisky', NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Ali Bomaye', 1, NULL, NULL, 'Porcini', NULL, 'Greek', false),
    ('the.bar.in.front.of.the.bar', NULL, 'Ali Bomaye', 2, NULL, NULL, 'Berries', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Ali Bomaye', 3, NULL, NULL, 'Miso', NULL, NULL, false),
    ('the.bar.in.front.of.the.bar', NULL, 'Ali Bomaye', 4, NULL, NULL, 'Lactose', NULL, NULL, false),
    ('the_bellwood', NULL, 'Au Lait Not Martini', 0, NULL, NULL, 'Barley Shochu', NULL, NULL, false),
    ('the_bellwood', NULL, 'Au Lait Not Martini', 1, NULL, NULL, 'Coffee Beans', NULL, 'Potosi', false),
    ('the_bellwood', NULL, 'Au Lait Not Martini', 2, NULL, NULL, 'Milk', NULL, 'used to clarify', false),
    ('the_bellwood', NULL, 'Au Lait Not Martini', 3, NULL, NULL, 'Miso Powder', NULL, 'rim', false),
    ('the_bellwood', NULL, 'Au Lait Not Martini', 4, NULL, NULL, 'Miso powder rim', NULL, 'garnish', false),
    ('the_bellwood', NULL, 'Yakiniku Bloody', 0, NULL, NULL, 'Vodka', NULL, 'smoked', false),
    ('the_bellwood', NULL, 'Yakiniku Bloody', 1, NULL, NULL, 'Wagyu Fat', NULL, NULL, false),
    ('the_bellwood', NULL, 'Yakiniku Bloody', 2, NULL, NULL, 'Yellow Tomato', NULL, NULL, false),
    ('the_bellwood', NULL, 'Yakiniku Bloody', 3, NULL, NULL, 'Black Garlic', NULL, NULL, false),
    ('the_bellwood', NULL, 'Miyako Fizz', 0, NULL, NULL, 'Zubrowka Vodka', 'Vodka', NULL, false),
    ('the_bellwood', NULL, 'Miyako Fizz', 1, NULL, NULL, 'Mulberry Leaf', NULL, NULL, false),
    ('the_bellwood', NULL, 'Miyako Fizz', 2, NULL, NULL, 'Kombu', NULL, NULL, false),
    ('the_bellwood', NULL, 'Miyako Fizz', 3, NULL, NULL, 'Umeboshi', NULL, NULL, false),
    ('the_bellwood', NULL, 'Miyako Fizz', 4, NULL, NULL, 'Soda', NULL, NULL, false),
    ('the_bellwood', NULL, 'Yama no Highball', 0, NULL, NULL, 'Tree-sap Spirit', NULL, NULL, false),
    ('the_bellwood', NULL, 'Yama no Highball', 1, NULL, NULL, 'Black Cardamom', NULL, NULL, false),
    ('the_bellwood', NULL, 'Yama no Highball', 2, NULL, NULL, 'Bay Leaves', NULL, 'roasted', false),
    ('the_bellwood', NULL, 'Ne(w)groni', 0, NULL, NULL, 'Tabasco Distillate', NULL, NULL, false),
    ('the_bellwood', NULL, 'Ne(w)groni', 1, NULL, NULL, 'Strawberry Vermouth', NULL, 'made from fermented strawberry juice', false),
    ('bkksocialclub', NULL, 'Hand of God', 0, NULL, NULL, 'Ocho Reposado Tequila', 'Reposado Tequila', NULL, false),
    ('bkksocialclub', NULL, 'Hand of God', 1, NULL, NULL, 'Campari', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Hand of God', 2, NULL, NULL, 'Cacao Malbec Wine Cordial', NULL, 'house-made', false),
    ('bkksocialclub', NULL, 'Evita', 0, NULL, NULL, 'Plantation Pineapple Rum', 'Pineapple Rum', NULL, false),
    ('bkksocialclub', NULL, 'Evita', 1, NULL, NULL, 'Campari', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Evita', 2, NULL, NULL, 'Aperol', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Evita', 3, NULL, NULL, 'Citrus Mix', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Evita', 4, NULL, NULL, 'Bay Leaf', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Evita', 5, NULL, NULL, 'Cinnamon Syrup', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Bananazo', 0, NULL, NULL, 'Michter''s US 1 Bourbon', 'Bourbon', NULL, false),
    ('bkksocialclub', NULL, 'Bananazo', 1, NULL, NULL, 'Salted Ripe Banana', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Bananazo', 2, NULL, NULL, 'Chocolate Bitters', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Bananazo', 3, NULL, NULL, 'Caviar', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Mezcal Negroni', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Mezcal Negroni', 1, NULL, NULL, 'Campari', NULL, 'pineapple-infused', false),
    ('bkksocialclub', NULL, 'Mezcal Negroni', 2, NULL, NULL, 'Coffee Vermouth', NULL, NULL, false),
    ('bkksocialclub', NULL, 'Mezcal Negroni', 3, NULL, NULL, 'Olive Saline', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Nutmeg & Clove', 0, 45, 'ml', 'Spiced Rum', NULL, 'clove-infused; current menu uses Ron Zacapa 23 with nutmeg and clove', false),
    ('nutmegandclove', NULL, 'Nutmeg & Clove', 1, 20, 'ml', 'Gula Melaka Syrup', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Nutmeg & Clove', 2, 15, 'ml', 'Lemon Juice', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Nutmeg & Clove', 3, 30, 'ml', 'Cream', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Nutmeg & Clove', 4, 30, 'ml', 'Egg White', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Nutmeg & Clove', 5, NULL, 'top', 'Ginger Ale', NULL, 'current menu lists ginger beer', false),
    ('nutmegandclove', NULL, 'Michael Jackson Punch', 0, 40, 'ml', 'Fernet-Branca', 'Fernet', NULL, false),
    ('nutmegandclove', NULL, 'Michael Jackson Punch', 1, 15, 'ml', 'Gin', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Michael Jackson Punch', 2, 10, 'ml', 'Braulio', 'Amaro', NULL, false),
    ('nutmegandclove', NULL, 'Michael Jackson Punch', 3, 15, 'ml', 'Lime Juice', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Michael Jackson Punch', 4, 60, 'ml', 'Soy Milk', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Michael Jackson Punch', 5, 20, 'ml', 'Pandan Vanilla Syrup', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Michael Jackson Punch', 6, NULL, NULL, 'Toasted Soy Powder', NULL, '1 g', false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 0, NULL, NULL, 'Codigo 1530 Still Strength Blanco Tequila', 'Blanco Tequila', NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 1, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 2, NULL, NULL, 'Green Papaya', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 3, NULL, NULL, 'Tomato', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 4, NULL, NULL, 'Chilli', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 5, NULL, NULL, 'Roasted Garlic', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 6, NULL, NULL, 'Gula Melaka', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 7, NULL, NULL, 'Shrimp', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 8, NULL, NULL, 'Peanut', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 9, NULL, NULL, 'Fish Sauce', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Die Die Must Try', 10, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Stylo Milo', 0, NULL, NULL, 'Maker''s Mark Bourbon', 'Bourbon', NULL, false),
    ('nutmegandclove', NULL, 'Stylo Milo', 1, NULL, NULL, 'Barley Shochu', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Stylo Milo', 2, NULL, NULL, 'Milo', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Stylo Milo', 3, NULL, NULL, 'White Cacao Liqueur', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Stylo Milo', 4, NULL, NULL, 'Almond Milk', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Stylo Milo', 5, NULL, NULL, 'Peated Whisky', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Stylo Milo', 6, NULL, NULL, 'Hojicha Foam', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Is It Really Boulevardier?', 0, NULL, NULL, 'Woodford Reserve Bourbon', 'Bourbon', NULL, false),
    ('nutmegandclove', NULL, 'Is It Really Boulevardier?', 1, NULL, NULL, 'Campari', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Is It Really Boulevardier?', 2, NULL, NULL, 'Sweet Vermouth', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Is It Really Boulevardier?', 3, NULL, NULL, 'Pandan', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Is It Really Boulevardier?', 4, NULL, NULL, 'Coffee', NULL, NULL, false),
    ('nutmegandclove', NULL, 'Is It Really Boulevardier?', 5, NULL, NULL, 'Coconut', NULL, NULL, false),
    ('tayer_elementary', NULL, 'Butter Martini', 0, 2, 'oz', 'Butter-washed Gin', NULL, 'made with Bombay Sapphire', false),
    ('tayer_elementary', NULL, 'Butter Martini', 1, 0.5, 'oz', 'Martini Bianco Vermouth', 'Bianco Vermouth', NULL, false),
    ('tayer_elementary', NULL, 'Butter Martini', 2, NULL, NULL, 'Lacto-fermented gooseberry', NULL, 'garnish', false),
    ('sipandguzzlenyc', NULL, 'Sixty Forty', 0, 2, 'oz', 'Bombay Sapphire Gin', 'Gin', NULL, false),
    ('sipandguzzlenyc', NULL, 'Sixty Forty', 1, 0.33, 'oz', 'Rittenhouse Rye', 'Rye Whiskey', NULL, false),
    ('sipandguzzlenyc', NULL, 'Sixty Forty', 2, 0.33, 'oz', 'Mancino Secco Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('sipandguzzlenyc', NULL, 'Sixty Forty', 3, 0.33, 'oz', 'Mancino Rosso Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('sipandguzzlenyc', NULL, 'Sixty Forty', 4, 1, 'bsp', 'Seedlip', NULL, NULL, false),
    ('sipandguzzlenyc', NULL, 'Sixty Forty', 5, 2, 'dash', 'Seedlip', NULL, NULL, false),
    ('sipandguzzlenyc', NULL, 'Sixty Forty', 6, NULL, NULL, 'Olive and cherry', NULL, 'garnish', false),
    ('satans_whiskers', NULL, 'Dry Daiquiri', 0, 1.25, 'oz', 'Havana Club 3 Year Lightly Aged Rum', 'Lightly Aged Rum', NULL, false),
    ('satans_whiskers', NULL, 'Dry Daiquiri', 1, 0.25, 'oz', 'Campari', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Dry Daiquiri', 2, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Dry Daiquiri', 3, 0.5, 'oz', 'Simple Syrup', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Dry Daiquiri', 4, 1, 'dash', 'Passion Fruit Syrup', NULL, NULL, false),
    ('satans_whiskers', NULL, 'Dry Daiquiri', 5, NULL, NULL, 'Flamed orange twist (optional)', NULL, 'garnish', false),
    ('sips.barcelona', NULL, 'Pink Chihuahua', 0, 0.67, 'oz', 'Canaïma Gin', 'Gin', NULL, false),
    ('sips.barcelona', NULL, 'Pink Chihuahua', 1, 0.67, 'oz', 'Orange-infused Gin', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Pink Chihuahua', 2, 0.75, 'oz', 'Dry Sherry', NULL, 'heavy pour', false),
    ('sips.barcelona', NULL, 'Pink Chihuahua', 3, NULL, NULL, 'Blood Orange Soda, To Top', NULL, NULL, false),
    ('sips.barcelona', NULL, 'Pink Chihuahua', 4, NULL, NULL, 'Grated lime zest', NULL, 'garnish', false),
    ('jewelnola', NULL, 'Crusta Alcala', 0, 1.25, 'oz', 'Blanco Tequila', NULL, NULL, false),
    ('jewelnola', NULL, 'Crusta Alcala', 1, 0.5, 'oz', 'Del Maguey Vida Mezcal', 'Mezcal', NULL, false),
    ('jewelnola', NULL, 'Crusta Alcala', 2, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    ('jewelnola', NULL, 'Crusta Alcala', 3, 0.5, 'oz', 'Chartreuse', NULL, NULL, false),
    ('jewelnola', NULL, 'Crusta Alcala', 4, 0.25, 'oz', 'Crème de Cacao', NULL, NULL, false),
    ('jewelnola', NULL, 'Crusta Alcala', 5, 2, 'dash', 'Chocolate Bitters', NULL, NULL, false),
    ('jewelnola', NULL, 'Crusta Alcala', 6, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    ('jewelnola', NULL, 'Second Line Season', 0, 2, 'oz', 'Lemorton Calvados Reserve Apple Brandy', 'Apple Brandy', NULL, false),
    ('jewelnola', NULL, 'Second Line Season', 1, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('jewelnola', NULL, 'Second Line Season', 2, 2, 'tsp', 'Montenegro', NULL, NULL, false),
    ('jewelnola', NULL, 'Second Line Season', 3, 1, 'tsp', 'Maraschino Liqueur', NULL, NULL, false),
    ('jewelnola', NULL, 'Second Line Season', 4, 2, 'dash', 'Boker''s', NULL, NULL, false),
    ('jewelnola', NULL, 'Second Line Season', 5, NULL, NULL, 'Dried apple slices and grated nutmeg', NULL, 'garnish', false),
    ('overstory', NULL, 'Chelsea Sidecar', 0, 1.5, 'oz', 'Roku Gin', 'Gin', NULL, false),
    ('overstory', NULL, 'Chelsea Sidecar', 1, 0.75, 'oz', 'Cointreau', 'Orange Liqueur', NULL, false),
    ('overstory', NULL, 'Chelsea Sidecar', 2, 0.25, 'oz', 'Mandarin Oleo Saccharum', NULL, NULL, false),
    ('overstory', NULL, 'Chelsea Sidecar', 3, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('overstory', NULL, 'Chelsea Sidecar', 4, 1, NULL, 'Egg White', NULL, NULL, false),
    ('overstory', NULL, 'Chelsea Sidecar', 5, NULL, NULL, 'Lemon twist, plus drops of lemon, lime and orange oils', NULL, 'garnish', false),
    (NULL, 'PDT', 'Benton''s Old Fashioned', 0, 2, 'oz', 'Bacon Fat-infused Bourbon', NULL, 'made with Four Roses', false),
    (NULL, 'PDT', 'Benton''s Old Fashioned', 1, 0.25, 'oz', 'Grade B Maple Syrup', NULL, NULL, false),
    (NULL, 'PDT', 'Benton''s Old Fashioned', 2, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, 'PDT', 'Benton''s Old Fashioned', 3, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    (NULL, 'Employees Only', 'Ginger Smash', 0, 2, 'slice', 'Ginger Root', NULL, 'thin', false),
    (NULL, 'Employees Only', 'Ginger Smash', 1, 2, NULL, 'Kumquats', NULL, NULL, false),
    (NULL, 'Employees Only', 'Ginger Smash', 2, 2, 'tsp', 'Sugar', NULL, NULL, false),
    (NULL, 'Employees Only', 'Ginger Smash', 3, 1.5, 'oz', 'Cabeza Tequila', 'Tequila', NULL, false),
    (NULL, 'Employees Only', 'Ginger Smash', 4, 1, 'oz', 'Creole Shrubb', NULL, 'made with Rhum Clément', false),
    (NULL, 'Employees Only', 'Ginger Smash', 5, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, 'Trick Dog', 'I Am ... I Said', 0, 2, 'oz', 'Amontillado Sherry', NULL, NULL, false),
    (NULL, 'Trick Dog', 'I Am ... I Said', 1, 0.5, 'oz', 'Pierre Ferrand', 'Dry Orange Curaçao', NULL, false),
    (NULL, 'Trick Dog', 'I Am ... I Said', 2, 0.5, 'oz', 'Bols Genever', 'Genever', NULL, false),
    (NULL, 'Trick Dog', 'I Am ... I Said', 3, 0.25, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, 'Trick Dog', 'I Am ... I Said', 4, 0.25, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, 'Trick Dog', 'I Am ... I Said', 5, 1, 'drop', 'Menthol Tincture', NULL, '1 oz menthol crystals dissolved in 5 oz vodka', false),
    (NULL, 'Trick Dog', 'I Am ... I Said', 6, NULL, NULL, 'Mint sprig and half orange wheel', NULL, 'garnish', false),
    (NULL, 'Trick Dog', 'Natoma St.', 0, 1, 'oz', 'Hidalgo Napoleon Amontillado Sherry', 'Amontillado Sherry', NULL, false),
    (NULL, 'Trick Dog', 'Natoma St.', 1, 1, 'oz', 'Gran Classico', NULL, NULL, false),
    (NULL, 'Trick Dog', 'Natoma St.', 2, 1, 'oz', 'Dolin Dry Vermouth', 'Dry Vermouth', NULL, false),
    (NULL, 'Trick Dog', 'Natoma St.', 3, NULL, NULL, 'Lemon twist', NULL, 'garnish', false),
    (NULL, 'Clover Club', 'Gin Blossom', 0, 1.5, 'oz', 'Plymouth Gin', 'Gin', NULL, false),
    (NULL, 'Clover Club', 'Gin Blossom', 1, 1.5, 'oz', 'Martini & Rossi Bianco Vermouth', 'Bianco Vermouth', NULL, false),
    (NULL, 'Clover Club', 'Gin Blossom', 2, 0.75, 'oz', 'Apricot Eau de Vie', NULL, NULL, false),
    (NULL, 'Clover Club', 'Gin Blossom', 3, 2, 'dash', 'Orange Bitters', NULL, NULL, false),
    (NULL, 'Clover Club', 'Gin Blossom', 4, NULL, NULL, 'Expressed orange peel', NULL, 'garnish', false),
    (NULL, 'Clover Club', 'The Slope', 0, 2.5, 'oz', 'Rye Whiskey', NULL, NULL, false),
    (NULL, 'Clover Club', 'The Slope', 1, 0.75, 'oz', 'Punt e Mes', NULL, NULL, false),
    (NULL, 'Clover Club', 'The Slope', 2, 0.25, 'oz', 'Rothman & Winter Orchard Apricot', 'Apricot Liqueur', NULL, false),
    (NULL, 'Clover Club', 'The Slope', 3, 1, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, 'Pegu Club', 'French Pearl', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    (NULL, 'Pegu Club', 'French Pearl', 1, 0.25, 'oz', 'Pastis', NULL, NULL, false),
    (NULL, 'Pegu Club', 'French Pearl', 2, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, 'Pegu Club', 'French Pearl', 3, 0.75, 'oz', 'Simple Syrup', NULL, NULL, false),
    (NULL, 'Pegu Club', 'French Pearl', 4, 6, 'sprig', 'Mint', NULL, NULL, false),
    (NULL, 'Dante', 'Garibaldi', 0, 1.5, 'oz', 'Campari', NULL, NULL, false),
    (NULL, 'Dante', 'Garibaldi', 1, 4, 'oz', 'Orange Juice, Juiced To Order So It Is Fluffy', NULL, NULL, false),
    (NULL, 'Dante', 'Garibaldi', 2, NULL, NULL, 'Orange wedge', NULL, 'garnish', false),
    (NULL, 'Milk & Honey', 'Greenpoint', 0, 2, 'oz', 'Rye Whiskey', NULL, NULL, false),
    (NULL, 'Milk & Honey', 'Greenpoint', 1, 0.5, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, 'Milk & Honey', 'Greenpoint', 2, 0.5, 'oz', 'Chartreuse', NULL, NULL, false),
    (NULL, 'Milk & Honey', 'Greenpoint', 3, 1, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, 'Milk & Honey', 'Greenpoint', 4, 1, 'dash', 'Orange Bitters', NULL, NULL, false),
    (NULL, 'Milk & Honey', 'Greenpoint', 5, NULL, NULL, 'Lemon twist', NULL, 'garnish', false),
    (NULL, 'The Dead Rabbit', 'Irish Coffee', 0, 1.5, 'oz', 'Powers Gold Label Irish Whiskey', 'Irish Whiskey', NULL, false),
    (NULL, 'The Dead Rabbit', 'Irish Coffee', 1, 4, 'oz', 'Hot Filtered Coffee', NULL, NULL, false),
    (NULL, 'The Dead Rabbit', 'Irish Coffee', 2, 0.5, 'oz', 'Demerara Syrup', NULL, 'equal parts demerara sugar and water', false),
    (NULL, 'The Dead Rabbit', 'Irish Coffee', 3, 1, 'oz', 'Heavy Cream, Lightly Whipped', NULL, NULL, false),
    (NULL, 'The Dead Rabbit', 'Irish Coffee', 4, NULL, NULL, 'Freshly grated nutmeg', NULL, 'garnish', false),
    (NULL, NULL, 'Martini', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Martini', 1, 1, 'oz', 'Dolin Dry Vermouth', 'Dry Vermouth', NULL, false),
    (NULL, NULL, 'Martini', 2, 2, 'dash', 'Orange Bitters', NULL, NULL, false),
    (NULL, NULL, 'Martini', 3, NULL, NULL, 'Lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'Negroni', 0, 1, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Negroni', 1, 1, 'oz', 'Campari', NULL, NULL, false),
    (NULL, NULL, 'Negroni', 2, 1, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Negroni', 3, NULL, NULL, 'Orange or lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'Old Fashioned', 0, 2, 'oz', 'Rye or Bourbon', NULL, NULL, false),
    (NULL, NULL, 'Old Fashioned', 1, 1, 'cube', 'Sugar', NULL, NULL, false),
    (NULL, NULL, 'Old Fashioned', 2, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Old Fashioned', 3, NULL, NULL, 'Warm Water', NULL, NULL, false),
    (NULL, NULL, 'Old Fashioned', 4, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    (NULL, NULL, 'Manhattan', 0, 2, 'oz', 'Rye or Bourbon', NULL, NULL, false),
    (NULL, NULL, 'Manhattan', 1, 1, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Manhattan', 2, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Manhattan', 3, NULL, NULL, 'Brandied cherry (preferably Luxardo) or lemon twist', NULL, 'garnish', false),
    (NULL, NULL, 'Daiquiri', 0, 2, 'oz', 'Light or White Rum', NULL, NULL, false),
    (NULL, NULL, 'Daiquiri', 1, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Daiquiri', 2, 0.75, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Daiquiri', 3, NULL, NULL, 'Lime wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Margarita', 0, 2, 'oz', 'Blanco Tequila', NULL, NULL, false),
    (NULL, NULL, 'Margarita', 1, 0.75, 'oz', 'Cointreau', 'Orange Liqueur', NULL, false),
    (NULL, NULL, 'Margarita', 2, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Margarita', 3, 1, 'tsp', 'Agave Nectar', NULL, NULL, false),
    (NULL, NULL, 'Margarita', 4, NULL, NULL, 'Lime wedge, optional salt rim', NULL, 'garnish', false),
    (NULL, NULL, 'Sazerac', 0, 2, 'oz', 'Rye Whiskey', NULL, NULL, false),
    (NULL, NULL, 'Sazerac', 1, 0.5, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Sazerac', 2, 2, 'dash', 'Peychaud''s', NULL, NULL, false),
    (NULL, NULL, 'Sazerac', 3, 1, 'bsp', 'Absinthe', NULL, NULL, false),
    (NULL, NULL, 'Sazerac', 4, NULL, NULL, 'Expressed lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'Martinez', 0, 1.5, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Martinez', 1, 1.5, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Martinez', 2, 1, 'tsp', 'Maraschino Liqueur', NULL, NULL, false),
    (NULL, NULL, 'Martinez', 3, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Martinez', 4, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    (NULL, NULL, 'Boulevardier', 0, 1.5, 'oz', 'Bourbon or Rye', NULL, NULL, false),
    (NULL, NULL, 'Boulevardier', 1, 1, 'oz', 'Campari', NULL, NULL, false),
    (NULL, NULL, 'Boulevardier', 2, 1, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Boulevardier', 3, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    (NULL, NULL, 'Americano', 0, 1.5, 'oz', 'Campari', NULL, NULL, false),
    (NULL, NULL, 'Americano', 1, 1.5, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Americano', 2, NULL, NULL, 'Soda Water, To Top', NULL, NULL, false),
    (NULL, NULL, 'Americano', 3, NULL, NULL, 'Orange slice or orange peel', NULL, 'garnish', false),
    (NULL, NULL, 'Aviation', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Aviation', 1, 0.25, 'oz', 'Luxardo', 'Maraschino Liqueur', NULL, false),
    (NULL, NULL, 'Aviation', 2, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Aviation', 3, 0.25, 'oz', 'Crème de Violette', NULL, NULL, false),
    (NULL, NULL, 'Aviation', 4, NULL, NULL, 'Brandied cherry (preferably Luxardo)', NULL, 'garnish', false),
    (NULL, NULL, 'Last Word', 0, 0.75, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Last Word', 1, 0.75, 'oz', 'Chartreuse', NULL, NULL, false),
    (NULL, NULL, 'Last Word', 2, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Last Word', 3, 0.75, 'oz', 'Luxardo', 'Maraschino Liqueur', NULL, false),
    (NULL, NULL, 'Last Word', 4, NULL, NULL, 'Brandied cherry', NULL, 'garnish', false),
    (NULL, NULL, 'Sidecar', 0, 2, 'oz', 'Cognac', NULL, 'VS or VSOP', false),
    (NULL, NULL, 'Sidecar', 1, 0.75, 'oz', 'Cointreau', 'Orange Liqueur', NULL, false),
    (NULL, NULL, 'Sidecar', 2, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Sidecar', 3, NULL, NULL, 'Orange peel, optional sugar rim', NULL, 'garnish', false),
    (NULL, NULL, 'Whiskey Sour', 0, 2, 'oz', 'Bourbon', NULL, NULL, false),
    (NULL, NULL, 'Whiskey Sour', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Whiskey Sour', 2, 0.75, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Whiskey Sour', 3, 0.5, 'oz', 'Egg White', NULL, 'or 1 small egg white', false),
    (NULL, NULL, 'Pisco Sour', 0, 2, 'oz', 'Pisco', NULL, NULL, false),
    (NULL, NULL, 'Pisco Sour', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Pisco Sour', 2, 0.5, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Pisco Sour', 3, 1, NULL, 'Small Egg White', NULL, 'or half a large one', false),
    (NULL, NULL, 'Pisco Sour', 4, NULL, NULL, 'Angostura bitters', NULL, 'garnish', false),
    (NULL, NULL, 'Tom Collins', 0, 1.5, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Tom Collins', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Tom Collins', 2, 0.75, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Tom Collins', 3, NULL, NULL, 'Soda Water, To Top', NULL, NULL, false),
    (NULL, NULL, 'Tom Collins', 4, NULL, NULL, 'Brandied cherry (preferably Luxardo) and orange wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Gimlet', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Gimlet', 1, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Gimlet', 2, 0.75, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Gimlet', 3, NULL, NULL, 'Lime wheel', NULL, 'garnish', false),
    (NULL, NULL, 'French 75', 0, 2, 'oz', 'Cognac or Gin', NULL, NULL, false),
    (NULL, NULL, 'French 75', 1, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'French 75', 2, 0.25, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'French 75', 3, 3, 'oz', 'Sparkling Wine, Preferably Dry Champagne', NULL, NULL, false),
    (NULL, NULL, 'French 75', 4, NULL, NULL, 'Long, curly lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'Corpse Reviver #2', 0, 1, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Corpse Reviver #2', 1, 1, 'oz', 'Cointreau', NULL, NULL, false),
    (NULL, NULL, 'Corpse Reviver #2', 2, 1, 'oz', 'Lillet', NULL, 'or Cocchi Americano', false),
    (NULL, NULL, 'Corpse Reviver #2', 3, 1, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Corpse Reviver #2', 4, 1, 'dash', 'Absinthe', NULL, NULL, false),
    (NULL, NULL, 'Corpse Reviver #2', 5, NULL, NULL, 'Orange or lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'Vieux Carré', 0, 1, 'oz', 'Rye Whiskey', NULL, NULL, false),
    (NULL, NULL, 'Vieux Carré', 1, 1, 'oz', 'Cognac', NULL, NULL, false),
    (NULL, NULL, 'Vieux Carré', 2, 1, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Vieux Carré', 3, 0.25, 'oz', 'Bénédictine', NULL, NULL, false),
    (NULL, NULL, 'Vieux Carré', 4, 2, 'dash', 'Peychaud''s', NULL, NULL, false),
    (NULL, NULL, 'Vieux Carré', 5, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Vieux Carré', 6, NULL, NULL, 'Orange or lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'Hanky Panky', 0, 1.5, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Hanky Panky', 1, 1.5, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Hanky Panky', 2, 1, 'bsp', 'Fernet-Branca', NULL, NULL, false),
    (NULL, NULL, 'Hanky Panky', 3, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    (NULL, NULL, 'Bee''s Knees', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Bee''s Knees', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Bee''s Knees', 2, 0.75, 'oz', 'Honey Syrup', NULL, '2:1 honey to water', false),
    (NULL, NULL, 'Bee''s Knees', 3, NULL, NULL, 'Lemon peel or lemon wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Mojito', 0, 2, 'oz', 'Light Rum', NULL, NULL, false),
    (NULL, NULL, 'Mojito', 1, 1, NULL, 'Lime, Quartered', NULL, NULL, false),
    (NULL, NULL, 'Mojito', 2, 2, 'tsp', 'Sugar', NULL, NULL, false),
    (NULL, NULL, 'Mojito', 3, 2, 'sprig', 'Mint', NULL, NULL, false),
    (NULL, NULL, 'Mojito', 4, NULL, NULL, 'Soda Water, To Top', NULL, NULL, false),
    (NULL, NULL, 'Mojito', 5, NULL, NULL, 'Mint sprig and lime wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Mai Tai', 0, 0.5, 'oz', 'Neisson L''Esprit White Rhum', 'White Rhum Agricole', NULL, false),
    (NULL, NULL, 'Mai Tai', 1, 0.5, 'oz', 'Hamilton Jamaican Gold Rum', 'Gold Jamaican Rum', NULL, false),
    (NULL, NULL, 'Mai Tai', 2, 0.5, 'oz', 'El Dorado 15 Year Aged Rum', 'Aged Rum', NULL, false),
    (NULL, NULL, 'Mai Tai', 3, 0.5, 'oz', 'Appleton 12 Year or Plantation Jamaica 2001 Aged Jamaican Rum', 'Aged Jamaican Rum', NULL, false),
    (NULL, NULL, 'Mai Tai', 4, 0.5, 'oz', 'Clément Créole Shrubb or Pierre Ferrand Dry Curaçao', 'Orange Curaçao', NULL, false),
    (NULL, NULL, 'Mai Tai', 5, 1, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Mai Tai', 6, 0.75, 'oz', 'Orgeat Works or Small Hand Foods', 'Orgeat', NULL, false),
    (NULL, NULL, 'Mai Tai', 7, NULL, NULL, 'Lime wheel, mint sprig and an umbrella (optional)', NULL, 'garnish', false),
    (NULL, NULL, 'Moscow Mule', 0, 2, 'oz', 'Vodka', NULL, NULL, false),
    (NULL, NULL, 'Moscow Mule', 1, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Moscow Mule', 2, 4, 'oz', 'Fever-Tree or Fentimans', 'Ginger Beer', NULL, false),
    (NULL, NULL, 'Moscow Mule', 3, NULL, NULL, 'Lime wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Paloma', 0, 2, 'oz', 'Tequila', NULL, NULL, false),
    (NULL, NULL, 'Paloma', 1, 1, 'oz', 'Grapefruit Juice', NULL, NULL, false),
    (NULL, NULL, 'Paloma', 2, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Paloma', 3, 0.75, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Paloma', 4, 2, 'dash', 'Grapefruit Bitters', NULL, 'optional', false),
    (NULL, NULL, 'Paloma', 5, NULL, NULL, 'Soda Water, To Top', NULL, NULL, false),
    (NULL, NULL, 'Paloma', 6, NULL, NULL, 'Grapefruit half wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Vesper', 0, 3, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Vesper', 1, 1, 'oz', 'Vodka', NULL, NULL, false),
    (NULL, NULL, 'Vesper', 2, 0.5, 'oz', 'Lillet', NULL, '0.5 to 0.75 oz, or 0.5 oz Cocchi Americano', false),
    (NULL, NULL, 'Vesper', 3, NULL, NULL, 'Lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'Rob Roy', 0, 2, 'oz', 'Blended Scotch Whisky', NULL, NULL, false),
    (NULL, NULL, 'Rob Roy', 1, 1, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Rob Roy', 2, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Rob Roy', 3, NULL, NULL, 'Brandied cherry (preferably Luxardo) or lemon twist', NULL, 'garnish', false),
    (NULL, NULL, 'Brooklyn', 0, 2, 'oz', 'Rye Whiskey', NULL, NULL, false),
    (NULL, NULL, 'Brooklyn', 1, 0.5, 'oz', 'Dry Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Brooklyn', 2, 0.25, 'oz', 'Maraschino Liqueur', NULL, NULL, false),
    (NULL, NULL, 'Brooklyn', 3, 0.25, 'oz', 'Amer Picon', NULL, 'or Amaro CioCiaro', false),
    (NULL, NULL, 'Clover Club', 0, 1.5, 'oz', 'Plymouth Gin', 'Gin', NULL, false),
    (NULL, NULL, 'Clover Club', 1, 0.5, 'oz', 'Dolin Dry Vermouth', 'Dry Vermouth', NULL, false),
    (NULL, NULL, 'Clover Club', 2, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Clover Club', 3, 0.5, 'oz', 'Raspberry Syrup', NULL, NULL, false),
    (NULL, NULL, 'Clover Club', 4, 0.25, 'oz', 'Egg White', NULL, NULL, false),
    (NULL, NULL, 'Clover Club', 5, NULL, NULL, '2 or 3 skewered raspberries', NULL, 'garnish', false),
    (NULL, NULL, 'Ramos Gin Fizz', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Ramos Gin Fizz', 1, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Ramos Gin Fizz', 2, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Ramos Gin Fizz', 3, 0.5, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Ramos Gin Fizz', 4, 3, 'dash', 'Orange Flower Water', NULL, NULL, false),
    (NULL, NULL, 'Ramos Gin Fizz', 5, 1, 'oz', 'Cream', NULL, NULL, false),
    (NULL, NULL, 'Ramos Gin Fizz', 6, 1, NULL, 'Egg White', NULL, NULL, false),
    (NULL, NULL, 'Ramos Gin Fizz', 7, 2, 'oz', 'Soda', NULL, NULL, false),
    (NULL, NULL, 'Ramos Gin Fizz', 8, NULL, NULL, 'Half orange wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Bamboo', 0, 1.5, 'oz', 'Fino Sherry', NULL, NULL, false),
    (NULL, NULL, 'Bamboo', 1, 1.5, 'oz', 'Dry Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Bamboo', 2, 1, 'tsp', 'Rich Simple Syrup', NULL, NULL, false),
    (NULL, NULL, 'Bamboo', 3, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Bamboo', 4, 2, 'dash', 'Orange Bitters', NULL, NULL, false),
    (NULL, NULL, 'Jack Rose', 0, 2, 'oz', 'Laird''s', 'Applejack', NULL, false),
    (NULL, NULL, 'Jack Rose', 1, 1, 'oz', 'Grenadine', NULL, NULL, false),
    (NULL, NULL, 'Jack Rose', 2, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Jack Rose', 3, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Mint Julep', 0, 2, 'oz', 'Bourbon', NULL, '2 to 2.5 oz', false),
    (NULL, NULL, 'Mint Julep', 1, 0.5, 'oz', 'Simple Syrup, 1:1', NULL, '0.5 to 0.75 oz', false),
    (NULL, NULL, 'Mint Julep', 2, 1, NULL, 'Large Mint Sprig', NULL, NULL, false),
    (NULL, NULL, 'Mint Julep', 3, NULL, NULL, 'Bouquet of spanked mint', NULL, 'garnish', false),
    (NULL, NULL, 'Pegu Club', 0, 2, 'oz', 'London Dry Gin', NULL, NULL, false),
    (NULL, NULL, 'Pegu Club', 1, 0.75, 'oz', 'Pierre Ferrand', 'Dry Curacao', NULL, false),
    (NULL, NULL, 'Pegu Club', 2, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Pegu Club', 3, 1, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Pegu Club', 4, 1, 'dash', 'Orange Bitters', NULL, NULL, false),
    (NULL, NULL, 'Pegu Club', 5, NULL, NULL, 'Lime peel', NULL, 'garnish', false),
    (NULL, NULL, 'Bloody Mary', 0, 2, 'oz', 'Ketel One Vodka', 'Vodka', NULL, false),
    (NULL, NULL, 'Bloody Mary', 1, 4, 'oz', 'Tomato Juice', NULL, NULL, false),
    (NULL, NULL, 'Bloody Mary', 2, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Bloody Mary', 3, 8, 'drop', 'Red Hot Pepper Sauce', NULL, 'e.g. Tabasco', false),
    (NULL, NULL, 'Bloody Mary', 4, 4, 'dash', 'Worcestershire Sauce', NULL, NULL, false),
    (NULL, NULL, 'Bloody Mary', 5, 2, 'grind', 'Black Pepper', NULL, NULL, false),
    (NULL, NULL, 'Bloody Mary', 6, 1, 'pinch', 'Celery Salt', NULL, NULL, false),
    (NULL, NULL, 'Bloody Mary', 7, NULL, NULL, 'Celery stalk plus a skewered cherry tomato, gherkin and cocktail onion', NULL, 'garnish', false),
    (NULL, NULL, 'Piña Colada', 0, 2, 'oz', 'Rum', NULL, 'light or aged', false),
    (NULL, NULL, 'Piña Colada', 1, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Piña Colada', 2, 1, 'oz', 'Pineapple Juice', NULL, NULL, false),
    (NULL, NULL, 'Piña Colada', 3, 1, 'oz', 'Cream of Coconut', NULL, NULL, false),
    (NULL, NULL, 'Piña Colada', 4, 1, 'oz', 'Coconut Milk', NULL, NULL, false),
    (NULL, NULL, 'Piña Colada', 5, 2, 'cup', 'Ice', NULL, NULL, false),
    (NULL, NULL, 'Piña Colada', 6, NULL, NULL, 'Pineapple wedge and a cocktail umbrella', NULL, 'garnish', false),
    (NULL, NULL, 'Sbagliato', 0, 1, 'oz', 'Campari', NULL, NULL, false),
    (NULL, NULL, 'Sbagliato', 1, 1, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Sbagliato', 2, NULL, NULL, 'Prosecco or Other Dry Sparkling Wine, To Top', NULL, NULL, false),
    (NULL, NULL, 'Sbagliato', 3, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    (NULL, NULL, 'Aperol Spritz', 0, 3, 'oz', 'Prosecco', NULL, NULL, false),
    (NULL, NULL, 'Aperol Spritz', 1, 2, 'oz', 'Aperol', NULL, NULL, false),
    (NULL, NULL, 'Aperol Spritz', 2, 1, 'oz', 'Soda', NULL, NULL, false),
    (NULL, NULL, 'Aperol Spritz', 3, NULL, NULL, 'Orange half-wheel', NULL, 'garnish', false),
    (NULL, NULL, 'White Lady', 0, 1.5, 'oz', 'London Dry Gin', NULL, NULL, false),
    (NULL, NULL, 'White Lady', 1, 0.75, 'oz', 'Cointreau', NULL, NULL, false),
    (NULL, NULL, 'White Lady', 2, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'White Lady', 3, 1, NULL, 'Small Egg White', NULL, NULL, false),
    (NULL, NULL, 'White Lady', 4, NULL, NULL, 'Lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'El Diablo', 0, 1.5, 'oz', 'Tequila', NULL, NULL, false),
    (NULL, NULL, 'El Diablo', 1, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'El Diablo', 2, 0.5, 'oz', 'Crème de Cassis', NULL, NULL, false),
    (NULL, NULL, 'El Diablo', 3, NULL, NULL, 'Ginger Beer, To Top', NULL, NULL, false),
    (NULL, NULL, 'El Diablo', 4, NULL, NULL, 'Lime wedge', NULL, 'garnish', false),
    (NULL, NULL, 'Bellini', 0, 2, 'oz', 'Fiol Extra Dry', 'Prosecco, Chilled', NULL, false),
    (NULL, NULL, 'Bellini', 1, 2, 'oz', 'White Peach Purée', NULL, NULL, false),
    (NULL, NULL, 'Bellini', 2, 0.33, 'oz', 'Peach Schnapps Liqueur', NULL, NULL, false),
    (NULL, NULL, 'Bellini', 3, 0.25, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Bellini', 4, NULL, NULL, 'Peach wedge on the rim', NULL, 'garnish', false),
    (NULL, NULL, 'Stinger', 0, 2.25, 'oz', 'Cognac', NULL, NULL, false),
    (NULL, NULL, 'Stinger', 1, 0.75, 'oz', 'Tempus Fugit', 'Crème de Menthe', NULL, false),
    (NULL, NULL, 'Stinger', 2, 1, 'dash', 'Orange Bitters', NULL, NULL, false),
    (NULL, NULL, 'Stinger', 3, 1, 'sprig', 'Mint', NULL, NULL, false),
    (NULL, NULL, 'Stinger', 4, NULL, NULL, 'Small mint sprig', NULL, 'garnish', false),
    (NULL, NULL, 'Ti'' Punch', 0, 2, 'oz', 'Rhum Agricole Blanc', NULL, NULL, false),
    (NULL, NULL, 'Ti'' Punch', 1, 1, 'bsp', 'Cane Syrup', NULL, NULL, false),
    (NULL, NULL, 'Ti'' Punch', 2, 1, NULL, 'Lime Coin', NULL, NULL, false),
    (NULL, NULL, 'Ti'' Punch', 3, NULL, NULL, 'Lime coin', NULL, 'garnish', false),
    (NULL, NULL, 'Caipirinha', 0, 2, 'oz', 'Cachaça', NULL, NULL, false),
    (NULL, NULL, 'Caipirinha', 1, 1, NULL, 'Lime, Quartered', NULL, NULL, false),
    (NULL, NULL, 'Caipirinha', 2, 2, 'tsp', 'Sugar', NULL, NULL, false),
    (NULL, NULL, 'Caipirinha', 3, NULL, NULL, 'Lime wedge or wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Brandy Crusta', 0, 1.75, 'oz', 'Cognac', NULL, NULL, false),
    (NULL, NULL, 'Brandy Crusta', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Brandy Crusta', 2, 0.5, 'oz', 'Orange Curaçao', NULL, NULL, false),
    (NULL, NULL, 'Brandy Crusta', 3, 0.25, 'oz', 'Maraschino Liqueur', NULL, NULL, false),
    (NULL, NULL, 'Brandy Crusta', 4, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Brandy Crusta', 5, NULL, NULL, 'Peel of half a lemon', NULL, 'garnish', false),
    (NULL, NULL, 'Remember the Maine', 0, 2, 'oz', 'Rye Whiskey', NULL, NULL, false),
    (NULL, NULL, 'Remember the Maine', 1, 0.75, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Remember the Maine', 2, 2, 'tsp', 'Cherry Heering', NULL, NULL, false),
    (NULL, NULL, 'Remember the Maine', 3, 1, 'dash', 'Absinthe', NULL, NULL, false),
    (NULL, NULL, 'Remember the Maine', 4, NULL, NULL, 'Brandied cherry (preferably Luxardo)', NULL, 'garnish', false),
    (NULL, NULL, 'Bobby Burns', 0, 1.5, 'oz', 'J&B Rare Blended Scotch', 'Blended Scotch Whisky', NULL, false),
    (NULL, NULL, 'Bobby Burns', 1, 1.5, 'oz', 'Strucchi Rosso Sweet (rosso) Vermouth', 'Sweet (rosso) Vermouth', NULL, false),
    (NULL, NULL, 'Bobby Burns', 2, 0.25, 'oz', 'Bénédictine D.O.M.', 'Bénédictine', NULL, false),
    (NULL, NULL, 'Bobby Burns', 3, NULL, NULL, 'Lemon twist (expressed and discarded) and a maraschino cherry', NULL, 'garnish', false),
    (NULL, NULL, 'New York Sour', 0, 2, 'oz', 'Rye or Bourbon', NULL, NULL, false),
    (NULL, NULL, 'New York Sour', 1, 1, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'New York Sour', 2, 1, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'New York Sour', 3, 0.25, 'oz', 'Dry Red Wine', NULL, NULL, false),
    (NULL, NULL, 'Hemingway Daiquiri', 0, 2, 'oz', 'White Rum', NULL, NULL, false),
    (NULL, NULL, 'Hemingway Daiquiri', 1, 0.5, 'oz', 'Luxardo', 'Maraschino Liqueur', NULL, false),
    (NULL, NULL, 'Hemingway Daiquiri', 2, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Hemingway Daiquiri', 3, 0.5, 'oz', 'Grapefruit Juice', NULL, NULL, false),
    (NULL, NULL, 'Hemingway Daiquiri', 4, NULL, NULL, 'Lime wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Tuxedo', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Tuxedo', 1, 1, 'oz', 'Fino Sherry', NULL, NULL, false),
    (NULL, NULL, 'Tuxedo', 2, 2, 'dash', 'Regans''', 'Orange Bitters', NULL, false),
    (NULL, NULL, 'Tuxedo', 3, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    (NULL, NULL, 'Alaska', 0, 2, 'oz', 'Old Tom Gin', NULL, NULL, false),
    (NULL, NULL, 'Alaska', 1, 1, 'oz', 'Yellow Chartreuse', NULL, NULL, false),
    (NULL, NULL, 'Alaska', 2, 2, 'dash', 'Orange Bitters', NULL, NULL, false),
    (NULL, NULL, 'Bijou', 0, 1, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Bijou', 1, 1, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    (NULL, NULL, 'Bijou', 2, 0.75, 'oz', 'Green Chartreuse', NULL, NULL, false),
    (NULL, NULL, 'Bijou', 3, 1, 'dash', 'Orange Bitters', NULL, NULL, false),
    (NULL, NULL, 'Bijou', 4, NULL, NULL, 'Brandied cherry (preferably Luxardo)', NULL, 'garnish', false),
    (NULL, NULL, 'Milano Torino', 0, 1, 'oz', 'Campari', NULL, NULL, false),
    (NULL, NULL, 'Milano Torino', 1, 1, 'oz', 'Vermouth di Torino', NULL, NULL, false),
    (NULL, NULL, 'Milano Torino', 2, NULL, NULL, 'Orange slice', NULL, 'garnish', false),
    (NULL, NULL, 'Pompier', 0, 45, 'ml', 'Strucchi Dry Vermouth', 'Dry Vermouth', NULL, false),
    (NULL, NULL, 'Pompier', 1, 15, 'ml', 'Crème de Cassis', NULL, NULL, false),
    (NULL, NULL, 'Pompier', 2, 60, 'ml', 'Thomas Henry', 'Soda', NULL, false),
    (NULL, NULL, 'Pompier', 3, NULL, NULL, 'Lemon wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Jungle Bird', 0, 1.5, 'oz', 'Jamaican or Blackstrap Rum', NULL, NULL, false),
    (NULL, NULL, 'Jungle Bird', 1, 0.75, 'oz', 'Campari', NULL, NULL, false),
    (NULL, NULL, 'Jungle Bird', 2, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Jungle Bird', 3, 0.5, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Jungle Bird', 4, 1.5, 'oz', 'Pineapple Juice', NULL, NULL, false),
    (NULL, NULL, 'Jungle Bird', 5, NULL, NULL, 'Pineapple wedge', NULL, 'garnish', false),
    (NULL, NULL, 'Espresso Martini', 0, 2, 'oz', 'Vodka', NULL, NULL, false),
    (NULL, NULL, 'Espresso Martini', 1, 1, 'oz', 'Espresso', NULL, NULL, false),
    (NULL, NULL, 'Espresso Martini', 2, 0.5, 'oz', 'Coffee Liqueur', NULL, NULL, false),
    (NULL, NULL, 'Espresso Martini', 3, 0.25, 'oz', 'Simple Syrup', NULL, NULL, false),
    (NULL, NULL, 'Espresso Martini', 4, NULL, NULL, 'Three coffee beans', NULL, 'garnish', false),
    (NULL, NULL, 'Penicillin', 0, 2, 'oz', 'Famous Grouse Blended Scotch', 'Blended Scotch', NULL, false),
    (NULL, NULL, 'Penicillin', 1, 0.75, 'oz', 'Honey-ginger Syrup', NULL, NULL, false),
    (NULL, NULL, 'Penicillin', 2, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Penicillin', 3, 0.25, 'oz', 'Laphroaig 10 Year Single Malt Scotch', 'Islay Single Malt Scotch', NULL, false),
    (NULL, NULL, 'Penicillin', 4, NULL, NULL, 'Candied ginger', NULL, 'garnish', false),
    (NULL, NULL, 'Paper Plane', 0, 0.75, 'oz', 'Bourbon', NULL, NULL, false),
    (NULL, NULL, 'Paper Plane', 1, 0.75, 'oz', 'Nonino', NULL, NULL, false),
    (NULL, NULL, 'Paper Plane', 2, 0.75, 'oz', 'Aperol', NULL, NULL, false),
    (NULL, NULL, 'Paper Plane', 3, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Naked and Famous', 0, 0.75, 'oz', 'Del Maguey Chichicapa Mezcal', 'Mezcal', NULL, false),
    (NULL, NULL, 'Naked and Famous', 1, 0.75, 'oz', 'Yellow Chartreuse', NULL, NULL, false),
    (NULL, NULL, 'Naked and Famous', 2, 0.75, 'oz', 'Aperol', NULL, NULL, false),
    (NULL, NULL, 'Naked and Famous', 3, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Oaxaca Old Fashioned', 0, 1.5, 'oz', 'El Tesoro Reposado Tequila', 'Reposado Tequila', NULL, false),
    (NULL, NULL, 'Oaxaca Old Fashioned', 1, 0.5, 'oz', 'Del Maguey San Luis Del Rio Mezcal', 'Mezcal', NULL, false),
    (NULL, NULL, 'Oaxaca Old Fashioned', 2, 2, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Oaxaca Old Fashioned', 3, 1, 'bsp', 'Agave Nectar', NULL, NULL, false),
    (NULL, NULL, 'Oaxaca Old Fashioned', 4, NULL, NULL, 'Flamed orange twist', NULL, 'garnish', false),
    (NULL, NULL, 'Gold Rush', 0, 2, 'oz', 'Elijah Craig Bourbon', 'Bourbon', NULL, false),
    (NULL, NULL, 'Gold Rush', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Gold Rush', 2, 0.75, 'oz', 'Honey Syrup', NULL, '3:1 honey to water', false),
    (NULL, NULL, 'Tommy''s Margarita', 0, 2, 'oz', 'Tequila', NULL, '100% agave', false),
    (NULL, NULL, 'Tommy''s Margarita', 1, 1, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Tommy''s Margarita', 2, 0.5, 'oz', 'Agave Nectar', NULL, NULL, false),
    (NULL, NULL, 'Tommy''s Margarita', 3, NULL, NULL, 'Lime wedge (salt rim optional)', NULL, 'garnish', false),
    (NULL, NULL, 'Bramble', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'Bramble', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Bramble', 2, 0.25, 'oz', 'Simple Syrup', NULL, '1:1', false),
    (NULL, NULL, 'Bramble', 3, 0.5, 'oz', 'Crème de Mûre', NULL, NULL, false),
    (NULL, NULL, 'Bramble', 4, NULL, NULL, 'Blackberries and a lemon wheel', NULL, 'garnish', false),
    (NULL, NULL, 'Trinidad Sour', 0, 1.5, 'oz', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Trinidad Sour', 1, 1, 'oz', 'Orgeat', NULL, NULL, false),
    (NULL, NULL, 'Trinidad Sour', 2, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Trinidad Sour', 3, 0.5, 'oz', 'Rye Whiskey', NULL, NULL, false),
    (NULL, NULL, 'Red Hook', 0, 2, 'oz', 'Rye Whiskey', NULL, NULL, false),
    (NULL, NULL, 'Red Hook', 1, 0.5, 'oz', 'Punt e Mes', NULL, NULL, false),
    (NULL, NULL, 'Red Hook', 2, 0.5, 'oz', 'Maraschino Liqueur', NULL, '0.25 to 0.5 oz, to taste', false),
    (NULL, NULL, 'Little Italy', 0, 2, 'oz', 'Rittenhouse 100 proof Rye', 'Rye Whiskey', NULL, false),
    (NULL, NULL, 'Little Italy', 1, 0.75, 'oz', 'Martini & Rossi Rosso Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    (NULL, NULL, 'Little Italy', 2, 0.5, 'oz', 'Cynar', NULL, NULL, false),
    (NULL, NULL, 'Little Italy', 3, NULL, NULL, 'Luxardo maraschino cherries on a skewer', NULL, 'garnish', false),
    (NULL, NULL, 'White Negroni', 0, 1.5, 'oz', 'Gin', NULL, NULL, false),
    (NULL, NULL, 'White Negroni', 1, 0.75, 'oz', 'Suze', NULL, NULL, false),
    (NULL, NULL, 'White Negroni', 2, 1, 'oz', 'Lillet', NULL, NULL, false),
    (NULL, NULL, 'White Negroni', 3, NULL, NULL, 'Lemon peel', NULL, 'garnish', false),
    (NULL, NULL, 'Cosmopolitan', 0, 1.5, 'oz', 'Absolut Citron Vodka', 'Citron Vodka', NULL, false),
    (NULL, NULL, 'Cosmopolitan', 1, 0.75, 'oz', 'Cointreau', NULL, NULL, false),
    (NULL, NULL, 'Cosmopolitan', 2, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Cosmopolitan', 3, 0.75, 'oz', 'Ocean Spray', 'Cranberry Juice Cocktail', NULL, false),
    (NULL, NULL, 'Cosmopolitan', 4, NULL, NULL, 'Lemon twist', NULL, 'garnish', false),
    (NULL, NULL, 'Lemon Drop', 0, 2, 'oz', 'Ketel One Citroen Citrus Vodka', 'Citrus Vodka', NULL, false),
    (NULL, NULL, 'Lemon Drop', 1, 0.25, 'oz', 'Cointreau', 'Triple Sec', NULL, false),
    (NULL, NULL, 'Lemon Drop', 2, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Lemon Drop', 3, 0.5, 'oz', 'Rich Sugar Syrup', NULL, '2:1', false),
    (NULL, NULL, 'Lemon Drop', 4, 3, 'drop', 'Saline Solution', NULL, NULL, false),
    (NULL, NULL, 'Lemon Drop', 5, NULL, NULL, 'Lemon twist', NULL, 'garnish', false),
    (NULL, NULL, 'Bitter Mai Tai', 0, 1.5, 'oz', 'Campari', NULL, NULL, false),
    (NULL, NULL, 'Bitter Mai Tai', 1, 0.75, 'oz', 'Smith & Cross Aged Jamaican Rum', 'Aged Jamaican Rum', NULL, false),
    (NULL, NULL, 'Bitter Mai Tai', 2, 0.5, 'oz', 'Orange Curaçao', NULL, NULL, false),
    (NULL, NULL, 'Bitter Mai Tai', 3, 0.75, 'oz', 'Orgeat', NULL, NULL, false),
    (NULL, NULL, 'Bitter Mai Tai', 4, 1, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Bitter Mai Tai', 5, NULL, NULL, 'Mint sprig', NULL, 'garnish', false),
    (NULL, NULL, 'Porn Star Martini', 0, 1.5, 'oz', 'Grey Goose La Vanille or Absolut Vanilia Vanilla Vodka', 'Vanilla Vodka', NULL, false),
    (NULL, NULL, 'Porn Star Martini', 1, 0.5, 'oz', 'Passoã or De Kuyper', 'Passion Fruit Liqueur', NULL, false),
    (NULL, NULL, 'Porn Star Martini', 2, 2, 'oz', 'Passion Fruit Purée', NULL, NULL, false),
    (NULL, NULL, 'Porn Star Martini', 3, 2, 'bsp', 'Vanilla Sugar', NULL, NULL, false),
    (NULL, NULL, 'Porn Star Martini', 4, 2, 'oz', 'Champagne, Chilled', NULL, 'served on the side', false),
    (NULL, NULL, 'Porn Star Martini', 5, NULL, NULL, 'Half a fresh passion fruit', NULL, 'garnish', false),
    (NULL, NULL, 'Division Bell', 0, 1, 'oz', 'Del Maguey Vida Mezcal', 'Mezcal', NULL, false),
    (NULL, NULL, 'Division Bell', 1, 0.75, 'oz', 'Aperol', NULL, NULL, false),
    (NULL, NULL, 'Division Bell', 2, 0.5, 'oz', 'Maraschino Liqueur', NULL, NULL, false),
    (NULL, NULL, 'Division Bell', 3, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    (NULL, NULL, 'Division Bell', 4, NULL, NULL, 'Grapefruit twist, expressed and discarded', NULL, 'garnish', false),
    (NULL, NULL, 'Fitzgerald', 0, 1.67, 'oz', 'Hayman''s London Dry Gin', 'London Dry Gin', NULL, false),
    (NULL, NULL, 'Fitzgerald', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    (NULL, NULL, 'Fitzgerald', 2, 0.5, 'oz', 'Rich Sugar Syrup', NULL, '2:1', false),
    (NULL, NULL, 'Fitzgerald', 3, 3, 'dash', 'Angostura', NULL, NULL, false),
    (NULL, NULL, 'Fitzgerald', 4, 2, 'drop', 'Saline Solution', NULL, 'optional', false),
    (NULL, NULL, 'Fitzgerald', 5, NULL, NULL, 'Lemon wheel', NULL, 'garnish', false);

INSERT INTO "seed_classics" VALUES
    ('Martini', 'A stirred, spirit-forward mix of gin and dry vermouth with a couple dashes of orange bitters, finished with lemon peel.', 'Nobody can pin down exactly where the Martini began, but Punch places it after the Manhattan, likely growing out of sweet vermouth and sweeter gin until drier styles of both took over around 1900. Through the 20th century the bitters disappeared and the vermouth shrank to almost nothing, tilting the drink heavily toward gin. The cocktail revival brought vermouth and bitters back, though ratio, garnish and method are still hotly argued; Punch''s 2025 expert tasting favored a very dry 5:1 build.

Method: Stir with ice in a mixing glass and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/martini/).', NULL, 'Coupette', NULL, 'Stir'),
    ('Negroni', 'An equal-parts, bittersweet stirred drink of gin, Campari and sweet vermouth, served over ice with an orange peel.', 'The usual story puts its birth at Caffè Casoni in Florence in 1919, when bartender Fosco Scarselli made Count Negroni a stronger Americano by swapping the soda for gin (early accounts say only a few drops of gin). The equal-parts recipe did not show up in print until 1947, in Amedeo Gandiglio''s Cocktails Portfolio. Punch notes it was seen as a lowbrow drink in Italy from the late 1970s through the 1990s before brand campaigns, bartender competitions and the gin boom made it a pillar of the classic cocktail revival.

Method: Stir with ice in a mixing glass and strain over fresh ice into a rocks glass (or up into a chilled coupe).

Spec adapted from Punch (https://punchdrink.com/recipes/negroni/).', 1919, 'Rocks', NULL, 'Stir'),
    ('Old Fashioned', 'Rye or bourbon stirred with a sugar cube, Angostura bitters and a splash of water, served over a big cube with orange peel.', 'It is the original cocktail formula of spirit, sugar, bitters and water, the combination printed in 1806 as the first definition of a cocktail; the name came later in the 1800s as fancier new drinks arrived. During Prohibition bartenders started muddling in fruit and cherries to hide rough liquor, and that version stuck after repeal. Punch credits the cocktail revival, around 2009, with bringing the stripped-back original back from near extinction.

Method: Muddle the sugar cube with the bitters and warm water in a double rocks glass until dissolved. Add the whiskey and ice (ideally one large cube) and stir well.

Spec adapted from Punch (https://punchdrink.com/recipes/old-fashioned/).', NULL, 'Rocks', NULL, 'muddle and shake'),
    ('Manhattan', 'Rye or bourbon stirred with sweet vermouth and Angostura bitters, served up with a brandied cherry or lemon twist.', 'The Manhattan grew out of the Old Fashioned once sweet vermouth caught on in the late 19th century. Historians still argue over its birthplace, with the leading theories pointing to New York''s Manhattan Club or a bartender named Black working in lower Manhattan in the 1870s. Punch dismisses the popular tale tying it to Winston Churchill''s mother as a myth.

Method: Stir with ice in a mixing glass and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/manhattan/).', NULL, 'Coupette', NULL, 'Stir'),
    ('Daiquiri', 'A shaken rum sour of light rum, fresh lime juice and simple syrup, served up with a lime wheel.', 'Credit usually goes to Jennings Cox, an American mining engineer near the Cuban town of Daiquiri around the time of the Spanish-American War, though Cubans had long mixed rum, lime and sugar; Jeff Berry calls Cox the drink''s midwife because his is the only story with a paper trail. Hemingway''s 1930s Havana helped make it famous, and wartime whiskey shortages in the 1940s pushed Caribbean rum and the Daiquiri further into the mainstream. Punch stresses that the real thing is a simple, balanced sour, not the frozen chain-restaurant version.

Method: Shake with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/daiquiri/).', NULL, 'Coupette', NULL, 'Shake'),
    ('Margarita', 'Blanco tequila shaken with lime juice, orange liqueur and a touch of agave, served with an optional salt rim and lime wedge.', 'Rival origin stories credit a restaurateur south of Tijuana in the 1930s or an Acapulco socialite in the 1940s, but it is clearly a Mexican take on the Daisy (margarita is Spanish for daisy) that Americans embraced soon after Repeal. Esquire named it cocktail of the month in December 1953, sealing its fame. Later milestones include Mariano Martinez''s frozen Margarita machine in Dallas in 1971 and the agave-sweetened Tommy''s Margarita of the early 1990s.

Method: Salt the rim of the glass if desired. Shake all ingredients with ice and strain into a coupe, cocktail or rocks glass.

Spec adapted from Punch (https://punchdrink.com/recipes/margarita/).', NULL, 'Coupette', NULL, 'Shake'),
    ('Sazerac', 'Rye whiskey stirred with simple syrup and Peychaud''s bitters, strained into an absinthe-rinsed glass and finished with lemon oil.', 'The Sazerac comes out of New Orleans in the mid-1800s and is tied to the Sazerac Coffee House. The long-told story that it began with Cognac and switched to rye after phylloxera wiped out French vineyards has been largely set aside; David Wondrich''s research suggests it only caught on in the 1890s and was a rye drink all along. Its signature comes from the trio of anise, spicy rye and Peychaud''s bitters.

Method: Swirl the absinthe to coat a rocks glass and discard the excess. Stir the rye, syrup and bitters with ice in a mixing glass and strain into the prepared glass. Express a lemon peel over the top.

Spec adapted from Punch (https://punchdrink.com/recipes/sazerac/).', NULL, 'Rocks', NULL, 'Stir'),
    ('Martinez', 'A sweet, stirred forerunner of the Martini: gin and sweet vermouth in equal measure with maraschino liqueur and Angostura bitters.', 'Often called an ancestor of the Martini, it first appeared in print in O.H. Byron''s 1884 The Modern Bartender''s Guide. Its origin is disputed between a bar in Martinez, California, and Jerry Thomas mixing it for a traveler bound there. It was traditionally made with Old Tom gin, but Punch prefers London dry gin to keep the sweetness in check.

Method: Stir with ice in a mixing glass and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/martinez/).', NULL, 'Coupette', NULL, 'Stir'),
    ('Boulevardier', 'A whiskey Negroni of bourbon or rye stirred with Campari and sweet vermouth, served up or on the rocks with orange peel.', 'Punch sums it up as half Negroni, half Manhattan. It is named for Erskine Gwynne, a 1920s Paris figure who ran a magazine for American expats, and it appears in Harry MacElhone''s 1927 book Barflies and Cocktails. Because whiskey is heavier than gin, bartenders often adjust the bitter and sweet parts to suit the whiskey they choose.

Method: Stir with ice in a mixing glass and strain into a chilled coupe, or over fresh ice in a rocks glass.

Spec adapted from Punch (https://punchdrink.com/recipes/boulevardier/).', NULL, 'Coupette', NULL, 'Stir'),
    ('Americano', 'A low-proof highball of Campari and sweet vermouth over ice, topped with soda water and an orange slice.', 'Despite the name it is Italian, grown from the 19th-century Milano-Torino (Campari from Milan, vermouth from Turin) with soda added. The name is thought to reflect its popularity with American visitors in Italy during Prohibition. It is also the parent of the Negroni, which swapped the soda for gin.

Method: Build the Campari and vermouth in the glass over ice and top with soda water.

Spec adapted from Punch (https://punchdrink.com/recipes/americano/).', NULL, 'Highball', NULL, 'Build'),
    ('Aviation', 'A sky-blue gin sour shaken with lemon juice, maraschino liqueur and crème de violette, garnished with a brandied cherry.', 'It first appears in the 1916 Recipes for Mixed Drinks by Hugo Ensslin, head bartender at the Hotel Wallick in Times Square. The Savoy Cocktail Book dropped the crème de violette in the 1930s, and the liqueur itself vanished from the market in the 1960s, leaving a plain sour for decades. Once Rothman & Winter brought violette back in 2007, bartenders revived the original four-ingredient version.

Method: Shake with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/aviation/).', 1916, 'Coupette', NULL, 'Shake'),
    ('Last Word', 'An equal-parts shaken drink of gin, green Chartreuse, maraschino liqueur and lime juice, served up with a brandied cherry.', 'One of the rare Prohibition-era drinks to survive, it came from the Detroit Athletic Club, and Ted Saucier''s 1951 book Bottoms Up credits vaudeville performer Frank Fogarty. It sat forgotten until Murray Stenson found it in old bar books and put it on the menu at Seattle''s Zig Zag Café in 2004. It then went from bartender favorite to full classic, spawning riffs like the Paper Plane, Final Ward and Naked and Famous.

Method: Shake with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/last-word/).', NULL, 'Coupette', NULL, 'Shake'),
    ('Sidecar', 'Cognac shaken with Cointreau and lemon juice, served up in an optionally sugar-rimmed glass with an orange peel.', 'Its origins are split between London and Paris around the end of World War I, with Harry''s New York Bar in Paris a leading contender; owner Harry MacElhone printed an equal-parts brandy, lemon and Cointreau recipe in his 1927 Barflies and Cocktails. Punch describes it as essentially a Cognac sour sweetened with Cointreau, descended from the 19th-century New Orleans Brandy Crusta. Bartenders now agree the old 1:1:1 ratio is too tart with modern ingredients, and the sugared rim, borrowed from the Crusta, only enters written Sidecar recipes in the 1930s.

Method: Sugar the rim of the glass if desired. Shake with ice and strain into the prepared glass.

Spec adapted from Punch (https://punchdrink.com/recipes/sidecar/).', NULL, 'Coupette', NULL, 'Shake'),
    ('Whiskey Sour', 'A shaken sour of bourbon, fresh lemon juice and simple syrup, given a silky foam with egg white.', 'The Whiskey Sour is the textbook example of the sour template (spirit, citrus, sugar), and Punch treats it as a building block for a huge number of later cocktails. Punch''s version adds egg white, which technically makes it the Boston Sour style. A related 19th-century offshoot, the New York Sour, floats red wine on top.

Method: Dry shake all ingredients without ice. Add ice and shake again until well chilled. Strain into a chilled coupe, or over fresh ice in a rocks glass.

Spec adapted from Punch (https://punchdrink.com/recipes/whiskey-sour/).', NULL, 'Coupette', NULL, 'dry shake and shake'),
    ('Pisco Sour', 'A frothy sour of pisco, lemon juice, simple syrup and egg white, finished with drops of Angostura bitters.', 'The Pisco Sour is credited to Victor Morris, an American who went to Peru in the early 1900s to work on the railroads and instead opened Morris'' Bar in Lima in 1916. He applied the classic sour template to Peru''s native grape brandy. Morris'' Bar served Lima''s elite and became a hub for other early Peruvian cocktails such as the Capitán, and the drink''s roots are claimed by both the U.S. and Peru.

Method: Dry shake all ingredients without ice. Add ice and shake well. Strain into a chilled glass and dot the foam with bitters.

Spec adapted from Punch (https://punchdrink.com/recipes/pisco-sour/).', 1916, 'Coupette', NULL, 'dry shake and shake'),
    ('Tom Collins', 'A tall, fizzy gin sour of gin, lemon juice and simple syrup lengthened with soda water, essentially a spiked lemonade.', 'The first printed recipe appears in the 1876 edition of Jerry Thomas''s Bartender''s Guide. Two origin stories compete: an American one tied to the Great Tom Collins Hoax of 1874, a prank that sent people hunting for a man who did not exist, and a British one crediting London bartender John Collins with a gin punch built on Old Tom gin. Punch describes the result as the original hard lemonade.

Method: Shake gin, lemon juice and simple syrup with ice until chilled. Strain over fresh ice into a Collins glass and top with soda water.

Spec adapted from Punch (https://punchdrink.com/recipes/tom-collins/).', 1876, 'Highball', NULL, 'shake and top'),
    ('Gimlet', 'A bracing shaken sour of gin, fresh lime juice and simple syrup, served up in a coupe.', 'The Gimlet dates to the mid-1800s and is essentially a gin sour made with lime, reportedly devised to get Royal Navy sailors to drink the lime ration that kept scurvy away. Its name may come from Thomas Desmond Gimlette, a naval surgeon of the era. It was traditionally made with Rose''s lime cordial, but Punch favors fresh lime and simple syrup because modern Rose''s is made with high-fructose corn syrup and additives.

Method: Shake all ingredients with ice until chilled. Strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/gimlet/).', NULL, 'Coupette', NULL, 'Shake'),
    ('French 75', 'A sparkling sour of Cognac or gin, lemon juice and simple syrup, topped with dry Champagne.', 'The French 75 was made famous at the New York Bar in Paris (opened 1911, renamed Harry''s New York Bar after Scottish bartender Harry MacElhone bought it in the 1920s). It takes its name from a French 75mm artillery gun of World War I, a nod to its kick. Some records point to Cognac as the original base, fitting its French roots, though a gin version appeared in print in 1927 and became the more common spec; Punch lists both.

Method: Shake the spirit, lemon juice and simple syrup with ice until chilled. Strain into a coupe or flute and top with sparkling wine.

Spec adapted from Punch (https://punchdrink.com/recipes/french-75/).', NULL, 'Coupette', NULL, 'shake and top'),
    ('Corpse Reviver #2', 'An equal-parts shaken cocktail of gin, Cointreau, Lillet Blanc and lemon juice in an absinthe-rinsed coupe.', 'The Corpse Reviver No. 2 comes from a pre-Prohibition family of hangover-cure ''reviver'' drinks and first appeared in print in The Savoy Cocktail Book (1930), which jokes that four in quick succession will undo the revival. Punch calls it a lighter cousin of the Sidecar. In Punch''s expert tasting, judges agreed it must stay truly equal parts (more lemon turns it sharp, more gin turns it dry) and that it never takes a cherry garnish.

Method: Rinse a chilled glass with the absinthe and discard the excess. Shake the remaining ingredients with ice until chilled and strain into the prepared glass.

Spec adapted from Punch (https://punchdrink.com/recipes/corpse-reviver-2/).', 1930, 'Coupette', NULL, 'Shake'),
    ('Vieux Carré', 'A stirred New Orleans classic of rye, Cognac, sweet vermouth and Bénédictine with Peychaud''s and Angostura bitters.', 'The Vieux Carré was created in 1938 by bartender Walter Bergeron at the Hotel Monteleone in the French Quarter (the Vieux Carré), in what was then called the Swan Room, reportedly as an alternative to the trademarked Sazerac. Stanley Clisby Arthur credited it to the hotel in his book Famous New Orleans Drinks and How to Mix ''Em. It is still served there at the Carousel Bar, whose bar top, built in 1949 on an old merry-go-round frame, slowly rotates.

Method: Stir all ingredients with ice in a mixing glass until chilled. Strain over fresh ice into a rocks glass.

Spec adapted from Punch (https://punchdrink.com/recipes/vieux-carre/).', 1938, 'Rocks', NULL, 'Stir'),
    ('Hanky Panky', 'A stirred, equal-parts sweet Martini of gin and sweet vermouth sharpened with a barspoon of Fernet-Branca.', 'Ada ''Coley'' Coleman created the Hanky Panky around 1925 as head bartender of the American Bar at the Savoy in London, a post she held for 23 years before Harry Craddock took over. She made it for regular Sir Charles Hawtrey, a stage actor who asked for something with some punch; he declared the Fernet-laced sweet Martini the real hanky-panky. It remains her best-known drink and is still served at the Savoy.

Method: Stir all ingredients with ice in a mixing glass until chilled. Strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/hanky-panky/).', 1925, 'Coupette', NULL, 'Stir'),
    ('Bee''s Knees', 'A Prohibition-era gin sour of gin, fresh lemon juice and rich honey syrup, shaken and served up.', 'The Bee''s Knees is generally dated to American Prohibition, when honey and lemon helped cover up rough bootleg gin. It is a simple twist on the Gin Sour, and its name is 1920s slang for something excellent, alongside phrases like ''the cat''s whiskers.'' Punch notes it has come back into favor with renewed interest in vintage drinking culture.

Method: Shake all ingredients with ice until chilled. Strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/bees-knees/).', NULL, 'Coupette', NULL, 'Shake'),
    ('Mojito', 'A tall Cuban highball of light rum, muddled lime, sugar and mint, lengthened with soda water.', 'The Mojito descends from the Draque, an old Cuban mix of unrefined rum, cane sugar and lime sometimes tied to the privateer Francis Drake, and likely took its modern form once lighter white rums arrived in the late 19th century. Printed recipes matching today''s drink date to the 1930s. The name may come from mojo, a Cuban lime seasoning, or mojado (Spanish for wet), and the drink''s U.S. boom came with Miami club culture in the early 2000s; Havana''s La Bodeguita del Medio, famous for serving it to Hemingway, still pours it.

Method: Gently muddle the mint and sugar in a Collins glass to release the oils. Add the lime pieces and muddle to release the juice. Add the rum and stir, fill with ice and top with soda water.

Spec adapted from Punch (https://punchdrink.com/recipes/mojito/).', NULL, 'Highball', NULL, 'muddle and shake'),
    ('Mai Tai', 'A tiki classic of a blend of aged Jamaican and Martinique rums, fresh lime, orange curaçao and orgeat, over crushed ice.', 'Victor ''Trader Vic'' Bergeron created the Mai Tai at Trader Vic''s in Oakland in 1944 for two friends visiting from Tahiti, and the name comes from the Tahitian word for good. Because the recipe was a trade secret, bars poured whatever they liked under the name, and after Bergeron took it to Hawaii in 1953 it was cut with pineapple juice and premixes, earning a reputation as the most abused drink around. Around 2010 bartenders such as Martin Cate and Jeff ''Beachbum'' Berry led a return to the original template of Jamaican rum, lime, curaçao and orgeat; Punch''s spec is tiki bartender Brian Miller''s take on the 1944 original.

Method: Shake all ingredients with ice until chilled. Strain over crushed ice into a rocks glass.

Spec adapted from Punch (https://punchdrink.com/recipes/mai-tai/).', 1944, 'Rocks', 'Crushed', 'Shake'),
    ('Moscow Mule', 'A vodka buck of vodka and fresh lime juice topped with spicy ginger beer, famously served in a copper mug.', 'The Moscow Mule came together in the early 1940s when John G. Martin, an executive at Smirnoff''s bottler, and Jack Morgan, owner of the Cock ''n'' Bull in Hollywood and a ginger beer producer, combined their two slow-selling products into one easy drink with a catchy name. It belongs to the long line of ginger beer bucks. After World War II, Smirnoff''s marketing tied it to the copper mug and ''Mule Parties,'' one of the first times a single cocktail was used to sell a spirit, and it helped vodka become America''s most popular spirit.

Method: Add the vodka and lime juice to the glass and fill with crushed or cracked ice. Top with ginger beer and swizzle gently to combine.

Spec adapted from Punch (https://punchdrink.com/recipes/moscow-mule-2/).', NULL, 'Highball', NULL, 'Blitz'),
    ('Paloma', 'A tall Mexican highball of tequila, fresh grapefruit and lime juices and simple syrup, topped with soda water.', 'The Paloma (Spanish for dove) is a Mexican cooler of unclear origin that Punch notes is said to outsell the Margarita in its home country. Punch pitches it as a cross between a Margarita and a Greyhound. The traditional build tops tequila with grapefruit soda, while Punch''s version uses fresh grapefruit and lime juice, syrup and a splash of soda.

Method: Shake tequila, juices, syrup and bitters with ice. Strain into a Collins glass over fresh ice and top with soda water.

Spec adapted from Punch (https://punchdrink.com/recipes/paloma/).', NULL, 'Highball', NULL, 'shake and top'),
    ('Vesper', 'James Bond''s stirred martini of gin and vodka with Lillet Blanc, served up with a lemon peel.', 'Ian Fleming invented the Vesper for James Bond in the 1953 novel Casino Royale, where Bond orders it shaken, though Punch recommends stirring. Historians debate whether Fleming meant vermouth rather than Kina Lillet. Because Lillet was reformulated in the mid-1980s into a lighter, sweeter aperitif, Punch suggests raising the Lillet or swapping in Cocchi Americano to get closer to the original.

Method: Stir all ingredients with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/vesper/).', 1953, 'Coupette', NULL, 'Stir'),
    ('Rob Roy', 'Scotland''s answer to the Manhattan: blended Scotch stirred with sweet vermouth and Angostura bitters.', 'The Rob Roy was created at the Waldorf Astoria in Manhattan in 1897, essentially a Manhattan with Scotch in place of American whiskey. It takes its name from an operetta about the Scottish folk hero that had opened in Manhattan a few years earlier. Punch notes it drinks leaner than the whiskey original and that blended Scotch works well here.

Method: Stir all ingredients with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/rob-roy/).', 1897, 'Coupette', NULL, 'Stir'),
    ('Brooklyn', 'A Manhattan cousin of rye whiskey stirred with dry vermouth, maraschino liqueur and Amer Picon.', 'The Brooklyn is an early 20th-century whiskey cocktail that Punch calls the Manhattan''s more obscure neighbor. It faded after Prohibition largely because its ingredients, especially Amer Picon, became hard to find. Its recent revival owes much to bartenders making their own Picon substitutes, since the French amer remains scarce in the U.S.; Punch suggests Amaro CioCiaro as a stand-in.

Method: Stir all ingredients with ice and strain into a coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/brooklyn/).', NULL, 'Coupette', NULL, 'Stir'),
    ('Clover Club', 'A pink, frothy sour of gin, dry vermouth, lemon juice, raspberry syrup and egg white, shaken and served up.', 'The Clover Club takes its name from an all-male club of Philadelphia lawyers and writers that met at the Bellevue-Stratford Hotel in the late 1800s, and the drink appeared later in the club''s run. It slipped into obscurity, which Punch attributes partly to the egg white and to the raspberry''s reputation as a feminine flavor. The cocktail revival brought it back, and Julie Reiner made it the signature of her Brooklyn bar named after it; Punch''s recipe page (slug clover-club) is her version, with dry vermouth added.

Method: Shake all ingredients with ice and strain. Return to the tin and dry shake without ice, then pour into a chilled cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/clover-club/).', NULL, 'Martini', NULL, 'dry shake and shake'),
    ('Ramos Gin Fizz', 'A creamy, foamy New Orleans fizz of gin, lemon and lime juice, simple syrup, cream, egg white and orange flower water, topped with soda.', 'Henry C. Ramos created the drink in 1888 at his Imperial Cabinet Saloon in New Orleans. He wanted it so light and cloudlike that he lined up a relay of bartenders to take turns shaking each one. Punch''s method calls for a full minute of dry shaking before shaking hard with ice, which gives the fizz its milkshake-like body and tall foam cap.

Method: Dry shake everything except the soda for a full minute. Add ice and shake until well chilled. Strain into a Collins glass (or two small fizz glasses) and top with soda water.

Spec adapted from Punch (https://punchdrink.com/recipes/ramos-gin-fizz/).', 1888, 'Highball', NULL, 'dry shake and shake'),
    ('Bamboo', 'A low-proof stirred aperitif of fino sherry and dry vermouth with a touch of rich syrup and Angostura and orange bitters.', 'German bartender Louis Eppinger created the Bamboo in the 1890s at the Grand Hotel in Yokohama, Japan, a hotel partly owned by American military men. The drink crossed the Pacific quickly, turning up on American menus by 1901 and later being sold bottled across the country. Punch''s recipe page (slug bamboo) uses Joaquin Simo''s spec, which adds a teaspoon of rich syrup to round out the dry sherry and vermouth.

Method: Stir all ingredients with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/bamboo/).', NULL, 'Coupette', NULL, 'Stir'),
    ('Jack Rose', 'A tart, rosy sour of applejack, grenadine, lemon juice and lime juice, shaken and served up.', 'The Jack Rose is a New Jersey drink built on applejack, the Jersey Lightning that Punch counts among America''s oldest continuously produced spirits, with Laird''s still the largest maker. Its name is disputed: one story credits the early 20th-century gangland figure Bald Jack Rose, another a Jersey City bartender named Frank J. May who went by Jack Rose. By the middle of the 20th century it was considered a drink every bartender should know.

Method: Shake all ingredients with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/jack-rose/).', NULL, 'Coupette', NULL, 'Shake'),
    ('Mint Julep', 'Bourbon poured over crushed ice with simple syrup and muddled mint, crowned with a big bouquet of fresh mint.', 'The Mint Julep dates to the 18th century, probably Virginia in the late 1700s, when silver cups and ice made it a drink of the wealthy. It spread across the South through the 1800s, and bourbon became the standard base after the Civil War, when brandy was scarce and the region was poor. Today it is tied to the Kentucky Derby, where Punch reports roughly 120,000 are sold each year.

Method: Gently muddle the mint with the syrup in a julep tin or rocks glass. Pack with crushed ice, pour in the bourbon, then mound more crushed ice on top.

Spec adapted from Punch (https://punchdrink.com/recipes/mint-julep/).', NULL, 'Julep Cup', NULL, 'muddle and shake'),
    ('Pegu Club', 'A crisp gin sour of London dry gin, dry curacao and lime juice with a dash each of Angostura and orange bitters.', 'The Pegu Club was the house drink of a British colonial gentlemen''s club of the same name in Rangoon (now Yangon), Myanmar, in the 1920s. It was printed in Harry MacElhone''s 1927 book Barflies and Cocktails. In the modern era Audrey Saunders cemented its reputation by naming her influential New York bar after it.

Method: Shake all ingredients with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/pegu-club/).', NULL, 'Coupette', NULL, 'Shake'),
    ('Bloody Mary', 'A savory highball of vodka and tomato juice seasoned with lemon, hot sauce, Worcestershire, black pepper and celery salt.', 'Punch notes the Bloody Mary has nearly as many origin stories as recipes. The most cited credits Fernand Petiot, who served an early version of vodka, tomato juice, lemon, salt, pepper and Worcestershire at Harry''s New York Bar in Paris and later popularized it as the Red Snapper at the St. Regis''s King Cole Bar in New York; rival claims name comedian George Jessel and a Chicago dive. It stayed fairly restrained until the late 1980s, then snowballed into the garnish-heavy brunch spectacle of the 2000s and 2010s.

Method: Rim a chilled Collins glass with salt. Roll all ingredients with ice between two tins (rather than shaking) and strain into the glass over fresh ice.

Spec adapted from Difford''s Guide (no Punch recipe page) (https://www.diffordsguide.com/cocktails/recipe/251/bloody-mary).', NULL, 'Highball', NULL, NULL),
    ('Piña Colada', 'A blended tropical drink of rum, pineapple juice, lime, cream of coconut and coconut milk, served tall with a pineapple wedge.', 'The Pina Colada grew out of an alcohol-free Cuban pineapple slush popular in the early 1900s. The Caribe Hilton in San Juan, Puerto Rico, claims to have invented the cocktail in 1954, but Punch points out that the New York Times described the drink in 1950 and credited it to Cuba. Two pop hits in 1978 and 1979 locked in its status as the definitive beach cocktail.

Method: Blend all ingredients on high until smooth and pour into a Collins or hurricane glass (or a hollowed-out frozen pineapple).

Spec adapted from Punch (https://punchdrink.com/recipes/pina-colada/).', 1954, 'Highball', NULL, 'Blitz'),
    ('Sbagliato', 'A bubbly Negroni twist: Campari and sweet vermouth over ice, topped with prosecco in place of gin.', 'The Negroni Sbagliato is credited to Mirko Stocchetto, a Harry''s Bar alumnus who bought Milan''s Bar Basso in 1967; the story goes that he grabbed sparkling wine instead of gin while making a Negroni. Punch dates the mix-up to the late 1960s in one piece and to 1972 in another. Sbagliato means mistaken in Italian, and Bar Basso, now run by his son Maurizio, still serves it in enormous hand-blown goblets.

Method: Add Campari and sweet vermouth to a rocks glass with ice, top with prosecco and stir gently to combine.

Spec adapted from Punch (https://punchdrink.com/recipes/negroni-sbagliato/).', NULL, 'Rocks', NULL, 'Stir'),
    ('Aperol Spritz', 'Italy''s low-proof aperitivo: Aperol and prosecco lengthened with a splash of soda over plenty of ice.', 'The spritz grew out of a 19th-century habit in the Veneto of splashing water into wine, which later picked up bitters and soda. Aperol, the bittersweet liqueur from Padua, turned that regional ritual into a fixed three-two-one formula of prosecco, Aperol and soda. By the mid-2010s it was spreading across Europe and the US; Punch''s expert tasting favoured a big wine glass, lots of ice and no added syrups.

Method: Fill a stemmed wine glass with ice, add prosecco, Aperol and soda, and stir gently.

Spec adapted from Punch (https://punchdrink.com/recipes/aperol-spritz/).', NULL, 'Wine', NULL, 'Stir'),
    ('White Lady', 'A silky gin sour of London dry gin, Cointreau and lemon juice, shaken with egg white and served up.', 'Harry MacElhone first made a White Lady at Ciro''s Club in London in 1919, using crème de menthe rather than gin. A few years later, running Harry''s New York Bar in Paris, he settled on gin, Cointreau and lemon with optional egg white. Harry Craddock put it in The Savoy Cocktail Book in 1930, and the Savoy''s American Bar still serves it.

Method: Dry shake all ingredients without ice, then add ice and shake until chilled. Strain into a chilled glass.

Spec adapted from Punch (https://punchdrink.com/recipes/white-lady/).', NULL, 'Coupette', NULL, 'dry shake and shake'),
    ('El Diablo', 'A long tequila highball with lime and crème de cassis, topped with spicy ginger beer.', 'The El Diablo first appeared in print in Trader Vic''s Book of Food and Drink in 1946. It shows Victor Bergeron applying his tiki habit of blending flavours to spirits beyond rum, in this case tequila. Punch counts it among the enduring tequila classics of the 1940s and 1950s, with the black currant liqueur giving it its purple tint.

Method: Shake tequila, lime juice and crème de cassis with ice until chilled. Strain into a Collins glass and top with ginger beer.

Spec adapted from Punch (https://punchdrink.com/recipes/el-diablo/).', 1946, 'Highball', NULL, 'shake and top'),
    ('Bellini', 'Venice''s pink sparkler of fresh white peach purée topped with prosecco.', 'Giuseppe Cipriani created the Bellini at Harry''s Bar in Venice (Difford''s dates it to 1945) and named it after the painter Giovanni Bellini for its rosy colour. Harry''s still makes it only with fresh, ripe white peaches, so longtime bartender Walter Bolzonella refused to serve it out of season. Punch notes it arrives in a short juice glass rather than a flute, poured in rows, and remains the bar''s most popular drink.

Method: Pour the prosecco into a chilled flute. Shake the purée, schnapps and lemon juice with ice and fine strain into the glass.

Spec adapted from Difford''s Guide (no Punch recipe page) (https://www.diffordsguide.com/cocktails/recipe/202/bellini-diffords-recipe).', 1945, 'Flute', NULL, 'Shake'),
    ('Stinger', 'A pre-Prohibition after-dinner drink of Cognac and crème de menthe, here brightened with fresh mint and orange bitters.', 'The Stinger began around 1890 as the Bartholdi Cocktail, named for the Madison Square hotel where it was mixed: just Cognac and crème de menthe, shaken and served up. It became a 1920s high-society favourite (Reginald Vanderbilt reportedly made them daily), and Cary Grant''s 1957 film Kiss Them For Me made it famous. Punch''s house version adds muddled mint and orange bitters to the classic pair.

Method: Muddle the mint with the crème de menthe and bitters in a shaker. Add Cognac and ice, shake until chilled, and strain over ice into a rocks glass or up into a chilled coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/stinger/).', 1890, 'Coupette', NULL, 'muddle and shake'),
    ('Ti'' Punch', 'Martinique''s national drink: rhum agricole blanc with a spoon of cane syrup and a coin of lime.', 'The Ti'' Punch (short for petit punch) is the everyday drink of Martinique, built from unaged rhum agricole distilled from fresh cane juice. It is traditionally self-served, which inspired the local saying that everyone prepares their own death. Punch''s expert panel wanted 50 percent ABV rhum, a thin lime coin with little pith, and little or no ice, warning that extra lime or ice pushes it toward a Daiquiri.

Method: Add cane syrup to a rocks glass and squeeze in the lime coin. Add the rhum and a few ice cubes and stir gently.

Spec adapted from Punch (https://punchdrink.com/recipes/ti-punch/).', NULL, 'Rocks', NULL, 'Stir'),
    ('Caipirinha', 'Brazil''s national cocktail: cachaça poured over lime muddled with sugar, served on ice.', 'The Caipirinha came out of the Brazilian countryside in the mid-19th century, where rural caipiras drank the lime, sugar and cachaça mix as a cheap daily ration, partly to mask rough spirit. David Wondrich notes it only caught on in cities in the early 20th century, once known as the Batida Paulista. It went international in the late 1970s and 1980s as producers like Pitú pushed cachaça abroad.

Method: Muddle the lime and sugar in a rocks glass until well juiced. Add cachaça and ice, then stir.

Spec adapted from Punch (https://punchdrink.com/recipes/caipirinha/).', NULL, 'Rocks', NULL, 'muddle and shake'),
    ('Brandy Crusta', 'A New Orleans original of Cognac, lemon, orange Curaçao, maraschino and Angostura in a sugar-rimmed glass.', 'Italian bartender Joseph Santini created the Crusta in 1850s New Orleans, making it one of the city''s first signature drinks and older than the Sazerac. Jerry Thomas published it in 1862, and though whiskey or gin could stand in, brandy became the definitive version. It faded in the early 20th century until Chris Hannah revived it in New Orleans in 2004; his spec, used here, adds maraschino.

Method: Shake all ingredients with ice and strain into a sugar-rimmed cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/brandy-crusta/).', NULL, 'Martini', NULL, 'Shake'),
    ('Remember the Maine', 'A stirred rye drink with sweet vermouth, Cherry Heering and an absinthe rinse, part Manhattan, part Sazerac.', 'Charles H. Baker recorded the drink in his 1939 book The Gentleman''s Companion, tying it to his stay in Havana during the 1933 revolution, when bombs punctuated his drinking. The name recalls the USS Maine, which exploded off Havana in 1898 and became the rallying cry for the Spanish-American War. Its rye and vermouth base nods to the Manhattan, while the absinthe rinse borrows from the Sazerac.

Method: Rinse a chilled coupe with the absinthe and discard the excess. Stir the rest with ice and strain into the glass.

Spec adapted from Punch (https://punchdrink.com/recipes/remember-the-maine/).', 1939, 'Coupette', NULL, 'Stir'),
    ('Bobby Burns', 'A Scotch Manhattan cousin: blended Scotch and sweet vermouth in equal parts with a touch of Bénédictine.', 'Harry Craddock''s 1930 Savoy Cocktail Book gave the lasting spec of equal parts Scotch and sweet vermouth with a few dashes of Bénédictine, calling it a big seller on Saint Andrew''s Day. A different Bobby Burns appeared in print as early as 1899, and it may be named for the poet or for a Robert Burns cigar shop near New York''s Waldorf-Astoria. Later versions swapped in absinthe or Drambuie for the Bénédictine.

Method: Stir all ingredients with ice and fine strain into a chilled coupe.

Spec adapted from Difford''s Guide (no Punch recipe page) (https://www.diffordsguide.com/cocktails/recipe/280/bobby-burns-craddocks-recipe).', NULL, 'Coupette', NULL, 'Stir'),
    ('New York Sour', 'A Whiskey Sour of rye or bourbon, lemon and simple syrup, finished with a float of dry red wine.', 'Floating red wine on a Whiskey Sour was a late-19th-century flourish that predates Prohibition. The drink went by many names, including the Continental, Brunswick, Waldorf and Southern Whiskey Sour, before New York stuck. Punch stresses that the dry red wine float is the whole point: skip it and you just have a Whiskey Sour.

Method: Shake whiskey, lemon juice and syrup with ice and strain over ice into a rocks glass. Float the red wine on top by pouring it gently over the back of a barspoon.

Spec adapted from Punch (https://punchdrink.com/recipes/new-york-sour/).', NULL, 'Rocks', NULL, 'shake and top'),
    ('Hemingway Daiquiri', 'A tart Daiquiri variation of white rum, lime and grapefruit juices and maraschino liqueur, shaken and served up with no added syrup.', 'This Daiquiri riff was poured for Ernest Hemingway at El Floridita in Havana, the bar of Constante Ribalaigua, and is unusual for skipping simple syrup (often attributed to Hemingway being diabetic). The 1930s original used only a teaspoon each of grapefruit and maraschino; by the 1940s it carried more grapefruit and just drops of maraschino, and his habit of ordering doubles gave rise to the name Papa Doble. Punch''s expert panel found the most common modern mistake is too much maraschino, which buries the rum in cherry and almond.

Method: Shake all ingredients with ice until chilled and strain into a chilled glass.

Spec adapted from Punch (https://punchdrink.com/recipes/hemingway-daiquiri/).', NULL, 'Coupette', NULL, 'Shake'),
    ('Tuxedo', 'A dry, Martini-style stirred drink of gin and fino sherry with orange bitters, garnished with an orange peel.', 'A 19th-century gin classic tied to the Waldorf-Astoria bar in New York, where members of the exclusive Tuxedo Park colony (founded 1886, and also the namesake of the tailless dinner jacket) drank before heading back to their country estates. Historian David Wondrich identifies the Waldorf''s gin and sherry drink as the first Tuxedo. It is essentially a 2:1 Martini with fino sherry in place of vermouth, reflecting the late-1800s fashion for pairing gin with sherry; the better-known Tuxedo No. 2 swaps in vermouth, maraschino and absinthe.

Method: Stir all ingredients with ice and strain into a chilled glass.

Spec adapted from Punch (https://punchdrink.com/recipes/tuxedo/).', NULL, 'Coupette', NULL, 'Stir'),
    ('Alaska', 'A golden, Martini-like drink of Old Tom gin and yellow Chartreuse with a couple of dashes of orange bitters, served up.', 'The earliest known recipe appears in Jacques Straub''s 1914 book Drinks, making the Alaska one of the oldest cocktails to use yellow Chartreuse as a main ingredient, and the 1930 Savoy Cocktail Book later praised it. The original called for rounder Old Tom gin; London dry became the usual substitute once Old Tom vanished, and the style''s return in 2007 (Hayman''s was first back on shelves) let bartenders rebuild the older version, which Punch''s Robert Simonson finds more elegant and mellow.

Method: Shake all ingredients with ice for about 15 seconds and strain into a chilled coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/alaska/).', 1914, 'Coupette', NULL, 'Shake'),
    ('Bijou', 'A rich stirred cocktail of gin, sweet vermouth and green Chartreuse with a dash of orange bitters, garnished with a brandied cherry.', 'The name first appears in C.F. Lawlor''s 1895 The Mixicologist as an equal-parts mix of gin, sweet vermouth and Grand Marnier, but the version that survived is Harry Johnson''s from the 1900 edition of his Bartender''s Manual, which swapped in green Chartreuse and added orange bitters. Bijou is French for jewel, a nod to the gem-like colors of its three spirits. Johnson allowed a cherry or an olive; today the cherry is standard.

Method: Stir all ingredients with ice and strain into a chilled glass.

Spec adapted from Punch (https://punchdrink.com/recipes/bijou/).', 1900, 'Coupette', NULL, 'Stir'),
    ('Milano Torino', 'An equal-parts aperitivo of Campari and Vermouth di Torino, built over ice and finished with an orange slice.', 'First served around 1860 at Gaspare Campari''s cafe in Milan, the drink is named for the hometowns of its two ingredients: Campari from Milan and vermouth from Turin. Often shortened to Mi-To, it is the bittersweet template that the Americano (add soda) and the Negroni (add gin) were built on. Naren Young of Dante has called it the blueprint for those aperitivo classics.

Method: Build in an Old-Fashioned glass over ice and stir.

Spec adapted from Punch (https://punchdrink.com/recipes/milano-torino/).', 1860, NULL, NULL, 'Stir'),
    ('Pompier', 'A low-alcohol highball of dry vermouth and crème de cassis lengthened with soda water and served over ice with a lemon wheel.', 'Pompier is French for firefighter, and the vermouth and cassis highball was a popular order in New York in the late 1930s. Difford''s notes that when the proportions are right it picks up a surprising cola-like note, while too much cassis or too little dilution tips it into blackcurrant cordial territory. Punch has no dedicated recipe page for it.

Method: Stir the vermouth and cassis with ice, then strain into an ice-filled glass while pouring in the soda.

Spec adapted from Difford''s Guide (no Punch recipe page) (https://www.diffordsguide.com/cocktails/recipe/5809/pompier).', NULL, 'Highball', NULL, 'Stir'),
    ('Jungle Bird', 'A bitter-leaning tiki drink of dark Jamaican or blackstrap rum, Campari, pineapple and lime juices and simple syrup, served over ice.', 'Created around 1978 at the Aviary Bar of the Kuala Lumpur Hilton in Malaysia, the drink sat in obscurity until Jeff "Beachbum" Berry found it in the 1989 New American Bartender''s Guide and reprinted it in his 2002 book Intoxica!, reading its vague "dark rum" as dark Jamaican. The original used a hefty 4 oz of pineapple juice; around 2010 Giuseppe González at New York''s Painkiller cut the pineapple and switched to blackstrap rum to stand up to the Campari, and that bolder version is now the norm (it also won Punch''s blind tasting). Punch does not name the original bartender.

Method: Shake all ingredients with ice and strain over fresh ice.

Spec adapted from Punch (https://punchdrink.com/recipes/jungle-bird/).', 1978, 'Rocks', NULL, 'Shake'),
    ('Espresso Martini', 'A shaken coffee cocktail of vodka, fresh espresso, coffee liqueur and a little simple syrup, served up with three coffee beans.', 'Dick Bradsell invented it in the 1980s (his daughter places it around 1985) as an off-menu Vodka Espresso at the Soho Brasserie in London, reportedly for a model who wanted a drink to wake her up and then knock her out; that first version was vodka, espresso and syrup on the rocks. It picked up coffee liqueur and a stemmed glass at Match EC1 in the late 1990s, taking the Espresso Martini name during the ''tini craze, and was briefly the Pharmaceutical Stimulant at Pharmacy in Notting Hill. Bradsell modeled its balance on the Brandy Alexander, and Punch ranks it among the most influential coffee drinks since Irish Coffee. Chosen slug: espresso-martini-2 (Bradsell''s spec; /recipes/espresso-martini/ is Giuseppe González''s version).

Method: Shake all ingredients with ice until chilled and strain into a coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/espresso-martini-2/).', 1985, 'Coupette', NULL, 'Shake'),
    ('Penicillin', 'A smoky, spicy Whisky Sour of blended Scotch, lemon juice and honey-ginger syrup, topped with a float of peated Islay Scotch.', 'Sam Ross, an Australian bartender who moved to New York in 2004, created it at Milk & Honey in 2005 while playing with a peated Compass Box whisky, partly inspired by the bar''s bourbon-and-honey Gold Rush. It went on the menu around 2007 at a server''s urging, and Ross''s consulting work in Los Angeles that year helped spread it west. By the 2010s it was about as close to a household name as any cocktail since the Cosmopolitan, and Punch calls it the most riffed-on modern classic.

Method: Shake the blended Scotch, honey-ginger syrup and lemon juice with ice, strain over one large cube, then float the Islay Scotch on top.

Spec adapted from Punch (https://punchdrink.com/recipes/penicillin/).', 2005, 'Rocks', 'Large Cube', 'Blitz'),
    ('Paper Plane', 'An equal-parts sour of bourbon, Amaro Nonino, Aperol and fresh lemon juice, shaken and served up.', 'Sam Ross of Milk & Honey in New York created it in 2008 for the opening menu of The Violet Hour in Chicago at Toby Maloney''s request, naming it after an M.I.A. song; Maloney misheard Ross''s late-night voicemail and it first appeared as the Paper Airplane. The debut version used Campari, but within days Ross found it too bitter and swapped in Aperol. Promoted in both Chicago and New York at once, it spread fast, became something like Toronto''s house drink, and inspired riffs such as Joaquín Simó''s Naked and Famous.

Method: Shake all ingredients with ice and strain into a coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/paper-plane/).', 2008, 'Coupette', NULL, 'Shake'),
    ('Naked and Famous', 'An equal-parts shaken cocktail of smoky mezcal, yellow Chartreuse, Aperol and fresh lime juice, served up.', 'Joaquín Simó created it at Death & Co in New York as a mezcal cross between the Last Word and the Paper Plane, calling it the illegitimate offspring of the two. Difford''s dates it to 2011 and notes it also debuted at Candelaria in Paris and Teardrop Lounge in Portland, Oregon (Punch''s recipe page vaguely says the early aughts, which cannot be right since the Paper Plane dates to 2008). Smoky mezcal balances herbal Chartreuse and bittersweet Aperol, and the riff has become a modern classic in its own right.

Method: Shake all ingredients hard with ice and strain into a coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/naked-famous/).', 2011, 'Coupette', NULL, 'Shake'),
    ('Oaxaca Old Fashioned', 'An agave Old Fashioned of reposado tequila and a little mezcal, sweetened with agave nectar, dashed with Angostura and topped with a flamed orange twist.', 'Phil Ward created it at Death & Co in Manhattan in 2007, after owner David Kaplan brought in mezcal for the bar to play with (Kaplan also named the drink). It spread quickly across New York and took off when Ward opened the agave bar Mayahuel in 2009, where staff say they made a million of them. Putting smoky mezcal in a familiar Old Fashioned format made it far less intimidating, and Punch credits the drink with opening American bartenders'' eyes to tequila and mezcal in cocktails.

Method: Stir all ingredients in an Old-Fashioned glass over one large ice cube until chilled, then flame an orange twist over the top and drop it in.

Spec adapted from Punch (https://punchdrink.com/recipes/oaxaca-old-fashioned/).', 2007, NULL, 'Large Cube', 'Stir'),
    ('Gold Rush', 'A Whiskey Sour update of bourbon, fresh lemon juice and rich honey syrup, shaken and served over a large ice cube.', 'T.J. Siegal, a restaurant worker rather than a bartender, came up with it around 2000 while sitting at Milk & Honey in New York, asking Sasha Petraske to make his usual Bourbon Sour with the bar''s new honey syrup instead of simple. It was a house staple by 2002, and Petraske carried it to Little Branch, Dutch Kills and The Varnish while Jim Meehan put it in Mr. Boston and The PDT Cocktail Book. It also partly inspired Sam Ross''s Penicillin, which later outshone it.

Method: Shake all ingredients with ice and strain into a rocks glass over a large ice cube.

Spec adapted from Punch (https://punchdrink.com/recipes/gold-rush/).', 2000, 'Rocks', 'Large Cube', 'Shake'),
    ('Tommy''s Margarita', 'A lean Margarita of 100 percent agave tequila, fresh lime juice and agave nectar, with no orange liqueur, served on the rocks.', 'Julio Bermejo built this version at his family''s Tommy''s Mexican Restaurant in San Francisco in the early 1990s, dropping the orange liqueur and sweetening with agave syrup, then mostly a health-food product made from a plant related to tequila''s source. He also swapped sour mix for fresh lime and discouraged the salt rim. Punch notes the bar became a pilgrimage site for bartenders, and the recipe is now effectively the industry''s default Margarita worldwide.

Method: Salt the rim of a rocks glass if desired. Shake all ingredients with ice and strain over fresh ice into the glass.

Spec adapted from Punch (https://punchdrink.com/recipes/tommys-margarita/).', NULL, 'Rocks', NULL, 'Shake'),
    ('Bramble', 'Gin, lemon and simple syrup shaken and poured over crushed ice, then drizzled with blackberry liqueur (crème de mûre).', 'Dick Bradsell created the Bramble in 1984 at Fred''s Club in London''s Soho, sitting somewhere between a Cobbler and a Gin Sour. He framed it as a nostalgic, all-British take on the Singapore Sling, with the blackberry note recalling his childhood on the Isle of Wight. Bradsell, a founding figure of the UK cocktail revival (he also gave us the Espresso Martini), made it one of London''s defining modern classics.

Method: Shake the gin, lemon juice and simple syrup with ice. Strain over crushed ice in a rocks glass, then drizzle the crème de mûre over the top.

Spec adapted from Punch (https://punchdrink.com/recipes/bramble/).', 1984, 'Rocks', 'Crushed', 'shake and top'),
    ('Trinidad Sour', 'An inverted sour built on a full 1.5 oz of Angostura bitters, balanced with orgeat, lemon juice and a small measure of rye.', 'Giuseppe González says he created the Trinidad Sour in the early days of his short stint at Clover Club in Brooklyn, which opened in 2008; owner Julie Reiner disputes that he put it on the menu, though she included it on the bar''s 10th-anniversary list. Using Angostura as the base made it costly to pour, yet it spread to menus around the world and is often called the best known of the bitters-as-base drinks. Some bartenders add egg white in the manner of a classic sour.

Method: Shake all ingredients with ice and strain into a chilled coupe.

Spec adapted from Punch (https://punchdrink.com/recipes/trinidad-sour/).', 2008, 'Coupette', NULL, 'Shake'),
    ('Red Hook', 'A stirred rye cocktail with Punt e Mes and maraschino liqueur, crossing the Manhattan with the Brooklyn.', 'Vincenzo (Enzo) Errico created the Red Hook in 2004 while tending bar at Milk & Honey in New York (some accounts say 2003). It streamlined the Brooklyn by dropping the hard-to-find Amer Picon, using lightly bitter Punt e Mes as the vermouth. Bartenders treated it as a revelation, and it kicked off a run of drinks named for Brooklyn neighborhoods, including the Greenpoint, Cobble Hill and Bushwick.

Method: Stir all ingredients with ice and strain into a coupe. Use between 0.25 and 0.5 oz maraschino to taste.

Spec adapted from Punch (https://punchdrink.com/recipes/red-hook/).', 2004, 'Coupette', NULL, 'Stir'),
    ('Little Italy', 'A Manhattan riff of rye whiskey and sweet vermouth with a half ounce of Cynar, the artichoke amaro, garnished with maraschino cherries.', 'Audrey Saunders created the Little Italy at Pegu Club in New York in 2005, naming it for the neighborhood a short walk from the bar. It adds Cynar to a rye Manhattan, blending Italian and American ingredients. Punch counts it among the bold Manhattan variations that pushed other bartenders to build their own riffs.

Method: Stir all ingredients with ice until chilled and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/little-italy/).', 2005, 'Coupette', NULL, 'Stir'),
    ('White Negroni', 'A pale Negroni of gin, Lillet Blanc and gentian-based Suze, stirred and garnished with lemon peel.', 'London bartender Wayne Collins made the first White Negroni in 2001 near Bordeaux, while traveling to Vinexpo with Plymouth Gin''s Nick Blacknell: they bought local French ingredients, using Lillet Blanc for vermouth and Suze for Campari, and garnished with pink grapefruit. It was largely forgotten in the UK until Plymouth ambassador Simon Ford brought it to New York, where Audrey Saunders served it at Bemelmans and Pegu Club, reportedly carrying Suze back from England. It took off once Suze was imported to the US in 2012; Punch''s feature says the modern consensus is equal parts with a grapefruit garnish.

Method: Stir all ingredients with ice until chilled. Strain into a chilled coupe, or over ice in a rocks glass.

Spec adapted from Punch (https://punchdrink.com/recipes/white-negroni/).', 2001, 'Coupette', NULL, 'Stir'),
    ('Cosmopolitan', 'Citron vodka, Cointreau, fresh lime juice and cranberry juice shaken and served up in a coupe or cocktail glass.', 'Toby Cecchini created the modern Cosmopolitan at the Odeon in New York in 1988, rebuilding a crude pink drink from San Francisco (rail vodka, Rose''s lime, grenadine and cranberry) with Absolut Citron, Cointreau, fresh lime and Ocean Spray. Absolut''s own inquiry into a dozen claimants backed his account; Cheryl Cook in Miami and John Caine in San Francisco figure in the prehistory, and Dale DeGroff popularized it but did not invent it. Sex and the City made it a global icon in the late 1990s, though the original is a fairly dry drink.

Method: Shake all ingredients with ice and strain into a chilled coupe or cocktail glass.

Spec adapted from Punch (https://punchdrink.com/recipes/cosmopolitan/).', 1988, 'Coupette', NULL, 'Shake'),
    ('Lemon Drop', 'Citrus vodka, triple sec, fresh lemon juice and sugar syrup shaken and served up with a lemon twist.', 'The Lemon Drop is traced to Norman Jay Hobday (known as Henry Africa) at his San Francisco fern bar, Henry Africa''s, in the 1970s; Punch notes he opened the bar in 1969 and it closed in 1986. Structurally it is a vodka Sidecar, and it helped lay the groundwork for the Cosmopolitan. The served-up Lemon Drop Martini version became a hit of the 1990s Martini-glass era, alongside a shot version.

Method: Shake all ingredients with ice and fine strain into a chilled Martini glass. Express a lemon twist over the drink and use it as garnish.

Spec adapted from Difford''s Guide (no Punch recipe page) (https://www.diffordsguide.com/cocktails/recipe/1144/lemon-drop-martini).', NULL, 'Martini', NULL, 'Shake'),
    ('Bitter Mai Tai', 'A bitter, pink Mai Tai led by 1.5 oz Campari, with Jamaican rum, orange curaçao, orgeat and lime over crushed ice.', 'Jeremy Oertel created the Bitter Mai Tai at Dram, the now-closed Brooklyn cocktail bar. He was inspired by a Mai Tai variation that swapped Angostura bitters in for the rum, but took his in another direction by leading with Campari and scaling back the rum. A measure of funky Jamaican rum (Smith & Cross) keeps it grounded, and it has become one of the most popular Mai Tai reinterpretations.

Method: Shake all ingredients with ice for about 10 seconds and strain over crushed ice in a large rocks glass.

Spec adapted from Punch (https://punchdrink.com/recipes/bitter-mai-tai-2/).', NULL, 'Rocks', 'Crushed', 'Shake'),
    ('Porn Star Martini', 'Vanilla vodka, passion fruit liqueur, passion fruit purée and vanilla sugar shaken and served up, with a shot of Champagne on the side.', 'Douglas Ankrah created the drink at his Townhouse bar in London''s Knightsbridge around 2002 (Punch''s recipe page says 2003); he first conceived it in Cape Town as the Maverick Martini, after a local gentlemen''s club, and renamed it back in London. The sparkling wine comes as a separate chaser rather than a topper, sipped between mouthfuls as a palate cleanser. By 2019 it was reported as the most ordered cocktail in the UK, and Marks & Spencer renamed its canned version the Passion Star Martini.

Method: Shake everything except the Champagne with ice and strain into a chilled Martini glass. Serve the chilled Champagne in a shot glass alongside.

Spec adapted from Punch (https://punchdrink.com/recipes/pornstar-martini/).', 2002, 'Martini', NULL, 'Shake'),
    ('Division Bell', 'A Last Word riff of mezcal, Aperol, maraschino liqueur and lime juice, shaken and served up with a grapefruit twist.', 'Phil Ward, an early champion of mezcal in American bars, created the Division Bell in 2009 at Mayahuel, the agave-focused bar he opened that year in New York''s East Village. It is a simple riff on the Last Word, with mezcal in place of gin and Aperol standing in for green Chartreuse. It shows the spirit-forward, template-driven approach Ward also used for his Oaxaca Old-Fashioned.

Method: Shake all ingredients with ice and strain into a coupe. Express a grapefruit twist over the drink and discard it.

Spec adapted from Punch (https://punchdrink.com/recipes/division-bell/).', 2009, 'Coupette', NULL, 'Shake'),
    ('Fitzgerald', 'A gin sour without egg white: gin, lemon juice and sugar syrup shaken with a few dashes of Angostura bitters and served on the rocks.', 'Dale DeGroff improvised the Fitzgerald in the early 1990s at the Rainbow Room''s Promenade Bar in New York, when a regular tired of his summer Gin and Tonic asked for a new gin drink. It is essentially a Gin Sour lifted with aromatic bitters. Online bartending communities later spread it to craft menus worldwide, and London''s White Lyan served a frozen version.

Method: Shake all ingredients with ice and strain into an ice-filled old-fashioned glass.

Spec adapted from Difford''s Guide (no Punch recipe page) (https://www.diffordsguide.com/cocktails/recipe/2408/fitzgerald).', NULL, NULL, NULL, 'Shake');

-- --- Glassware this adds (the picker had no Nick & Nora or martini glass) ---

INSERT INTO "public"."items" ("name", "item_type")
SELECT g, 'glassware'
FROM unnest(ARRAY['Nick & Nora', 'Martini', 'Julep Cup', 'Wine']) AS g
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i WHERE i.item_type = 'glassware' AND i.bar_id IS NULL AND lower(i.name) = lower(g)
);

-- --- Which bar each drink belongs to ---

ALTER TABLE "seed_drinks" ADD COLUMN "bar_profile_id" uuid;
UPDATE "seed_drinks" s SET "bar_profile_id" = p.id
FROM "public"."profiles" p
WHERE p.kind = 'bar' AND (p.handle = s.handle OR (s.handle IS NULL AND lower(p.display_name) = lower(s.bar_name)));
-- A bar that has no profile here is skipped.
DELETE FROM "seed_drinks" WHERE "bar_profile_id" IS NULL;

-- --- The drinks ---

INSERT INTO "public"."items" ("name", "item_type", "description", "notes", "origin", "riff_of_id",
                              "origin_bar_profile_id", "origin_year")
SELECT DISTINCT ON (s.bar_profile_id, lower(s.name))
       s.name, 'cocktail', s.description, s.notes, CASE WHEN c.id IS NULL THEN 'Original' ELSE 'Varient' END,
       c.id, s.bar_profile_id, s.origin_year::smallint
FROM "seed_drinks" s
LEFT JOIN "public"."items" c ON c.is_catalog AND lower(c.name) = lower(s.riff_of)
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i WHERE i.origin_bar_profile_id = s.bar_profile_id AND lower(i.name) = lower(s.name)
);

-- The drink each seed row now points at (new, or already there).
ALTER TABLE "seed_drinks" ADD COLUMN "item_id" uuid;
UPDATE "seed_drinks" s SET "item_id" = (
    SELECT i.id FROM "public"."items" i
    WHERE i.origin_bar_profile_id = s.bar_profile_id AND lower(i.name) = lower(s.name)
    ORDER BY i.created_at LIMIT 1
);

-- Fill gaps on drinks that were already there; never overwrite.
UPDATE "public"."items" i SET
    "description" = coalesce(i.description, s.description),
    "notes" = coalesce(i.notes, s.notes),
    "origin_year" = coalesce(i.origin_year, s.origin_year::smallint)
FROM "seed_drinks" s
WHERE i.id = s.item_id;

-- --- The classics ---

ALTER TABLE "seed_classics" ADD COLUMN "item_id" uuid;
UPDATE "seed_classics" s SET "item_id" = c.id
FROM "public"."items" c WHERE c.is_catalog AND lower(c.name) = lower(s.name);

UPDATE "public"."items" i SET
    "description" = coalesce(i.description, s.description),
    "notes" = coalesce(i.notes, s.notes),
    "origin_year" = coalesce(i.origin_year, s.origin_year::smallint)
FROM "seed_classics" s
WHERE i.id = s.item_id;

-- --- Specs: only for drinks that have none ---

CREATE TEMP TABLE "seed_targets" AS
SELECT s.item_id, s.handle, s.bar_name, s.name, s.glass, s.ice, s.method FROM "seed_drinks" s
UNION ALL
SELECT s.item_id, NULL, NULL, s.name, s.glass, s.ice, s.method FROM "seed_classics" s WHERE s.item_id IS NOT NULL;

DELETE FROM "seed_targets" t
WHERE t.item_id IS NULL
   OR EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = t.item_id)
   OR EXISTS (
        SELECT 1 FROM "public"."items" i
        WHERE i.id = t.item_id AND i.bar_id IS NULL
          AND i.notes ~ 'Spec (adapted )?from (Difford|Punch|Imbibe|The World''s 50 Best|50 Best)'
      );

ALTER TABLE "seed_lines" ADD COLUMN "item_id" uuid;
UPDATE "seed_lines" l SET "item_id" = t.item_id
FROM "seed_targets" t
WHERE lower(t.name) = lower(l.drink)
  AND t.handle IS NOT DISTINCT FROM l.handle AND t.bar_name IS NOT DISTINCT FROM l.bar_name;
DELETE FROM "seed_lines" WHERE "item_id" IS NULL;

-- Shared ingredients, reusing one with the same name. New ones stay out of
-- ingredient search (most are one bar's house preps); drink pages still show them.
INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
SELECT DISTINCT ON (lower(n)) n, 'ingredient', true
FROM (SELECT ingredient AS n FROM "seed_lines" UNION ALL SELECT generic FROM "seed_lines" WHERE generic IS NOT NULL) x
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."items" i WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND lower(i.name) = lower(x.n)
);

CREATE TEMP TABLE "seed_ingredients" AS
SELECT DISTINCT ON (lower(name)) lower(name) AS key, id
FROM "public"."items" WHERE item_type = 'ingredient' AND bar_id IS NULL
ORDER BY lower(name), created_at;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "parent_ingredient_id", "amount", "unit",
                                "preparation_notes", "is_optional", "sort_order")
SELECT l.item_id, i.id, g.id, l.amount, l.unit, l.prep, l.optional, l.pos
FROM "seed_lines" l
JOIN "seed_ingredients" i ON i.key = lower(l.ingredient)
LEFT JOIN "seed_ingredients" g ON g.key = lower(l.generic);

UPDATE "public"."items" i SET
    "glassware_id" = coalesce(i.glassware_id, (SELECT g.id FROM "public"."items" g WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND lower(g.name) = lower(t.glass) ORDER BY g.created_at LIMIT 1)),
    "ice_id" = coalesce(i.ice_id, (SELECT c.id FROM "public"."items" c WHERE c.item_type = 'ice' AND c.bar_id IS NULL AND lower(c.name) = lower(t.ice) ORDER BY c.created_at LIMIT 1))
FROM "seed_targets" t
WHERE i.id = t.item_id;

INSERT INTO "public"."item_methods" ("item_id", "method_item_id", "sort_order")
SELECT t.item_id, (SELECT m.id FROM "public"."items" m WHERE m.item_type = 'method' AND m.bar_id IS NULL AND lower(m.name) = lower(t.method) ORDER BY m.created_at LIMIT 1), 0
FROM "seed_targets" t
WHERE t.method IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "public"."item_methods" x WHERE x.item_id = t.item_id)
  AND EXISTS (SELECT 1 FROM "public"."items" m WHERE m.item_type = 'method' AND m.bar_id IS NULL AND lower(m.name) = lower(t.method));

DROP TABLE "seed_drinks", "seed_lines", "seed_classics", "seed_targets", "seed_ingredients";

RESET "app.image_worker";

