-- Classics a venue's menu has that the catalog lacked: 47 drinks from the
-- unmatched names on Caretaker's Cottage's imported spec sheet (E50 follow-up
-- to #892). Most are pre-war bar-book drinks (Kappeler 1895, Straub 1914,
-- Ensslin 1917, the Savoy 1930, the Old Waldorf-Astoria books, Meier 1936,
-- Baker 1939, Gaige 1941: Allies, Arsenic and Old Lace, Astoria, Trinity,
-- Deauville, Betsy Ross, Claridge, Self-Starter, Jabberwock...), the rest
-- documented modern classics with a named maker (Archangel, Rome With a View,
-- London Calling, Too Soon?, Shaky Pete's Ginger Brew...). The bar's own
-- originals are left out, and so is any drink whose spec we could not check.
-- Researched and checked against the sources named in each drink's first
-- record, 26 Oct 2026.
--
-- 1. Each drink is a catalog classic with its year, family, what changed from
--    its parent, and its parent: another of these drinks, a classic already
--    in the tree, or a style. Dr Henderson and Naked Ape have no year in any
--    source, so they stay off the timeline.
-- 2. Credits only where a source names the maker and we already have the
--    person or bar ('suggested' until claimed). A drink a book merely printed
--    has no maker; its story says the credit is for print only.
-- 3. House specs (proportions are facts), from the earliest printing; gone
--    products take today's nearest (Kina Lillet and Caperitif as Lillet
--    Blanc). Every ingredient is one production has; a name a stack lacks
--    is added as a plain ingredient.
-- 4. True other names (Allies Martini, Betty Ross, Bermudiana Rose, Sputnek,
--    Fairbanks No. 2, Pan Am Clipper...) go in classic_aliases with a source,
--    and Turf Club becomes another name for the Turf. Match to classics reads
--    them, so a menu that uses one matches the classic exactly.
-- 5. One web source per drink as its first record in "From the books".
--
-- No venue's drinks are linked here: Match to classics suggests them and the
-- bar's staff confirm. No paid AI: app.image_worker stops sketch jobs, and
-- the flavour jobs these inserts queue are removed at the end. No RLS or
-- grant changes. Running it again adds nothing.

SET "app.image_worker" = 'on';

CREATE TEMP TABLE "vc_jobs_before" AS SELECT "item_id" FROM "private"."item_flavor_jobs";

-- --- 1. The drinks ---

CREATE TEMP TABLE "vc_drinks" ("key" text PRIMARY KEY, "name" text NOT NULL, "year" int, "approx" boolean, "family" text, "parent_kind" text, "parent" text,
    "note" text, "creator" text, "bar" text, "src" text, "description" text, "notes" text, "glass" text, "ice" text, "method" text, "origin" text, "item_id" uuid);
INSERT INTO "vc_drinks" ("key", "name", "year", "approx", "family", "parent_kind", "parent", "note", "creator", "bar", "src", "description", "notes", "glass", "ice", "method", "origin") VALUES
    ('addington', 'Addington', 1930, false, 'highball', 'style', 'highball', 'Dry and sweet vermouth in equal parts, lengthened with soda', NULL, NULL, 'https://archive.org/details/savoycocktailboo0000vari/page/n20/', 'A low-proof aperitif of equal dry and sweet vermouth lengthened with soda and finished with orange peel.', 'The Addington appears in Harry Craddock''s 1930 Savoy Cocktail Book, and no earlier printing turned up; the credit is for print only. It is simply the two vermouths in equal measure, shaken and stretched with soda, which makes it one of the lightest drinks in the book. Where the name comes from is not documented.

Method: Shake the two vermouths with ice, strain into a wine glass and top with soda. Squeeze orange peel over the top.', 'Wine', NULL, 'shake and top', 'Classic'),
    ('allies-cocktail', 'Allies Cocktail', 1917, false, 'martini', 'tree', 'Martini', 'Equal gin and dry vermouth with dashes of kümmel', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/17688/allies-martini', 'A fifty-fifty gin and dry vermouth cocktail seasoned with a little caraway kümmel.', 'Hugo Ensslin printed the Allies in his 1917 Recipes for Mixed Drinks, and Harry Craddock repeated it in the 1930 Savoy Cocktail Book; the credit is for print only. The name points to the First World War alliance, with English gin, French vermouth and Russian kümmel sharing one glass.

Method: Stir with ice and strain into a chilled martini glass.', 'Martini', NULL, 'Stir', 'Classic'),
    ('loud-speaker', 'Loud Speaker', 1930, false, 'sidecar', 'tree', 'Sidecar', 'Half the brandy swapped for gin', NULL, NULL, 'https://archive.org/details/savoycocktailboo0000vari/page/n101/', 'A Sidecar-style sour split between brandy and dry gin, with Cointreau and lemon.', 'The Loud Speaker was printed in Harry Craddock''s 1930 Savoy Cocktail Book; the credit is for print only. Craddock added a joke that it explains the odd diction of radio announcers, and that a few more rounds lead from oscillation to osculation. It reads as a Sidecar with half the brandy swapped for gin.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('astoria', 'Astoria', 1914, false, 'martini', 'tree', 'Martini', 'Old Tom gin two to one with dry vermouth and orange bitters', NULL, NULL, 'https://archive.org/details/drinks00unse/page/n20/', 'A two-to-one Old Tom gin and dry vermouth Martini with a dash of orange bitters.', 'Jacques Straub, wine steward of Chicago''s Blackstone hotel, printed the Astoria in his 1914 book Drinks; the credit is for print only. Harry McElhone (1927) and Harry Craddock (1930) carried it on with an olive, and the name is usually tied to New York''s Astoria hotel. A later Waldorf book flipped it to a vermouth-heavy version.

Method: Stir with ice and strain into a chilled martini glass. An olive is optional.', 'Martini', NULL, 'Stir', 'Classic'),
    ('bronx-terrace', 'Bronx Terrace', 1914, false, 'martini', 'tree', 'Bronx', 'Lime in place of orange juice, no sweet vermouth', NULL, NULL, 'https://archive.org/details/drinks00unse/page/n24/', 'A dry, tart gin and French vermouth cocktail sharpened with lime, from the Bronx family.', 'The Bronx Terrace was printed in Jacques Straub''s 1914 Drinks as equal parts dry gin and French vermouth with half a lime; the credit is for print only. By the time Harry McElhone (1927) and Harry Craddock (1930) printed it, the gin had grown to two thirds. Unlike the Bronx it has no orange and no sweet vermouth.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('campden', 'Campden', 1930, false, 'martini', 'tree', 'Martini', 'Lillet and orange liqueur in place of vermouth', NULL, NULL, 'https://archive.org/details/savoycocktailboo0000vari/page/n44/', 'A gin cocktail sweetened with Cointreau and softened with Kina Lillet, in a two-one-one ratio.', 'The Campden first shows up in Harry Craddock''s 1930 Savoy Cocktail Book; the credit is for print only. Nothing about its origin is recorded beyond that printing. Made to the letter it runs sweet, so many modern versions pull back the orange liqueur.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('charlie-lindbergh', 'Charlie Lindbergh', 1930, false, 'martini', 'tree', 'Martini', 'Equal gin and Lillet with dashes of apricot and orange juice', NULL, NULL, 'https://archive.org/details/savoycocktailboo0000vari/page/n99/', 'Equal parts Plymouth gin and Kina Lillet with a touch of apricot liqueur and orange juice.', 'The Charlie Lindbergh was printed in Harry Craddock''s 1930 Savoy Cocktail Book; the credit is for print only. It carries the name of aviator Charles Lindbergh, whose transatlantic flight also inspired other bar tributes of the period, such as the Spirit of St. Louis. The original calls for Pricota, a British apricot liqueur, and Kina Lillet, both long gone.

Method: Shake with ice, strain into a chilled coupe and squeeze lemon peel over the top.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('claridge-cocktail', 'Claridge Cocktail', 1922, false, 'martini', 'tree', 'Martini', 'Equal gin and dry vermouth sweetened with apricot and orange liqueurs', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/440/claridge-cocktail', 'Gin and dry vermouth in equal parts, sweetened with apricot liqueur and Cointreau.', 'The Claridge was first printed by Harry McElhone in 1922 and credited to Leon, the bartender at Claridge''s Hotel on the Champs-Élysées in Paris. McElhone kept it in his 1927 book and Harry Craddock repeated it in the 1930 Savoy Cocktail Book. The Paris hotel, not the London one, is the namesake.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('self-starter', 'Self-Starter', 1930, false, 'martini', 'tree', 'Martini', 'Lillet in place of vermouth, with apricot and absinthe', NULL, NULL, 'https://archive.org/details/savoycocktailboo0000vari/page/n147/', 'Dry gin and Kina Lillet with a little apricot liqueur and a whisper of absinthe.', 'The Self-Starter first appears in Harry Craddock''s 1930 Savoy Cocktail Book; the credit is for print only. Nothing is recorded about who made it or why it got the name. It sits close to the Savoy''s other Lillet and apricot drinks, with absinthe adding lift.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('deauville', 'Deauville', 1930, false, 'sidecar', 'tree', 'Sidecar', 'Calvados shares the base with brandy', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/2625/deauville', 'An apple-brandy and cognac sour with orange liqueur, a Sidecar with Calvados sharing the base.', 'It appears in the 1930 Savoy Cocktail Book as an equal-parts drink of brandy, Calvados, Cointreau and lemon, and no earlier printing turned up. The credit is for print only. It sits in the Sidecar family, splitting the base between grape and apple brandy, and is named for the Normandy seaside resort.

Method: Shake hard with ice, strain into a chilled coupe and finish with a lemon twist.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('dick-jr', 'Dick, Jr.', 1917, false, 'martini', 'new', 'bronx-terrace', 'Apricot liqueur added in equal measure', NULL, NULL, 'https://archive.org/download/vintage-cocktail-books-euvs/1917%20Recipes%20for%20Mixed%20Drinks%20by%20Hugo%20R%20Ensslin%20%28second%20edition%29.pdf', 'An equal-parts gin, dry vermouth and apricot liqueur cocktail sharpened with lime.', 'Hugo Ensslin printed it in the 1917 second edition of his Recipes for Mixed Drinks. The credit is for print only. It is one of the last bar books before Prohibition, and the drink is a fruity, tart take on the gin and French vermouth pairing of the day.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('fairbank', 'Fairbank', 1907, false, 'martini', 'tree', 'Martini', 'A two to one dry Martini with crème de noyaux', NULL, NULL, 'https://drinkboy.com/cocktails/Recipe.aspx?itemid=253', 'A dry gin and French vermouth cocktail tinted pink and almond-scented with a couple of dashes of crème de noyaux.', 'A St. Louis bartender, Henry Hoffman, is reported to have mixed it in July 1907 for Vice President Charles W. Fairbanks, a teetotaller then in trouble over cocktails served at a party he hosted. Robert Vermeire printed it in 1922 as the Fairbank and tied it to the senator, while the 1930 Savoy relabelled it Fairbanks No. 2 and joked about the actor Douglas Fairbanks. At heart it is a 2:1 dry Martini with a little noyaux.

Method: Stir with ice, strain into a chilled coupe and add a cherry.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('franks-special', 'Frank''s Special', 1936, false, 'martini', 'tree', 'Martini', 'Half gin, half dry vermouth, with a dash of peach', NULL, NULL, 'https://euvs-vintage-cocktail-books.cld.bz/1936-The-Artistry-of-Mixing-Drinks-by-Frank-Meier/31/', 'A fifty-fifty gin and dry vermouth Martini with a dash of peach.', 'It was printed in 1936 in The Artistry of Mixing Drinks, by Frank Meier of the Ritz bar in Paris. The credit is for print only, though the name suggests it was one of his own. It is essentially a half-and-half dry Martini lifted with a single dash of peach brandy.

Method: Stir with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('hoop-la', 'Hoop La', 1930, false, 'sidecar', 'tree', 'Sidecar', 'Lillet takes a quarter of the drink', NULL, NULL, 'https://kindredcocktails.com/cocktail/hoop-la', 'An equal-parts Sidecar softened with Kina Lillet.', 'The 1930 Savoy Cocktail Book prints it with an exclamation mark as the Hoop La!, using exactly the same four equal parts as its Frank Sullivan and Odd McIntyre. The credit is for print only. It is a Sidecar with a quarter of aperitif wine, which takes the edge off the sourness.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('odd-mcintyre', 'Odd McIntyre', 1930, false, 'sidecar', 'tree', 'Sidecar', 'Lillet takes a quarter of the drink', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/38317/odd-mcintyre', 'An equal-parts Sidecar with Kina Lillet added.', 'The 1930 Savoy Cocktail Book prints it with the same four equal parts as its Frank Sullivan and Hoop La!, and R. de Fleury repeated all three in 1934. The credit is for print only. The quarter measure of quinine wine gives the Sidecar formula a faint bitter, aperitif edge.

Method: Shake hard with ice, strain into a chilled coupe and finish with a lemon twist.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('jabberwock', 'Jabberwock', 1930, false, 'martini', 'tree', 'Martini', 'Dry sherry and aperitif wine in place of vermouth', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/4908/jabberwock', 'An equal-parts gin, dry sherry and aperitif-wine cocktail with orange bitters.', 'It was printed in the 1930 Savoy Cocktail Book with a footnote borrowing nonsense words from Lewis Carroll''s Jabberwocky. The credit is for print only. The original called for Caperitif, an aromatised wine that no longer exists, so modern versions use a quinquina or Lillet in its place.

Method: Stir with ice, strain into a chilled coupe and finish with a lemon twist.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('last-round', 'Last Round', 1936, false, 'martini', 'tree', 'Martini', 'Half and half, with dashes of brandy and absinthe', NULL, NULL, 'https://euvs-vintage-cocktail-books.cld.bz/1936-The-Artistry-of-Mixing-Drinks-by-Frank-Meier/34/', 'A fifty-fifty gin and dry vermouth cocktail seasoned with dashes of absinthe and brandy.', 'It was printed in 1936 in Frank Meier''s The Artistry of Mixing Drinks, from the Ritz bar in Paris. The credit is for print only. It is a wet, half-and-half Martini with a whisper of anise and brandy, the kind of nightcap its name suggests.

Method: Stir with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('montana', 'Montana', 1931, false, 'martini', 'tree', 'Manhattan', 'Brandy, dry vermouth and port in equal parts', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/26633/montana-albert-stevens-crockett-1931', 'An equal-parts stirred drink of brandy, dry vermouth and port.', 'Albert Stevens Crockett recorded it among the pre-Prohibition drinks of the old Waldorf-Astoria bar in New York, first in 1931 and again in his 1935 bar book. He explains the name as a compliment to the part of the country where many of the bar''s early patrons did their business. An earlier Montana of 1913 used the same brandy and French vermouth but only dashes of port, with bitters and anisette.

Method: Stir with ice, strain into a chilled coupe and finish with a lemon twist.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('swan', 'Swan', 1935, false, 'martini', 'new', 'bronx-terrace', 'Angostura and absinthe added', NULL, NULL, 'https://archive.org/download/vintage-cocktail-books-euvs/1935%20Old%20Waldorf-Astoria%20Bar%20Book.pdf', 'A gin and dry vermouth sour with lime, Angostura and a touch of absinthe.', 'Albert Stevens Crockett listed it among the pre-Prohibition cocktails of the old Waldorf-Astoria bar in New York in his 1935 bar book. The recipe specifies a brand called Swan gin, which matches the drink''s name. The credit is for print only.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('trinity', 'Trinity', 1930, false, 'martini', 'tree', 'Perfect Martini', 'Equal thirds, so the vermouth leads', NULL, NULL, 'https://punchdrink.com/recipes/the-trinity/', 'Equal parts gin, dry vermouth and sweet vermouth: a vermouth-forward perfect Martini.', 'The 1930 Savoy Cocktail Book prints it as equal thirds of French vermouth, Italian vermouth and dry gin. The credit is for print only. With two parts vermouth to one of gin it is a low-strength, food-friendly cousin of the perfect Martini.

Method: Stir with ice, strain into a chilled coupe and finish with a lemon twist.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('betsy-ross', 'Betsy Ross', 1932, false, 'martini', 'tree', 'Manhattan', 'Brandy and port in place of whiskey and vermouth', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/3245/betsy-ross', 'Equal parts brandy and port with a little orange curaçao and aromatic bitters.', 'It first shows up as the Betty Ross on a cocktail list from Sloppy Joe''s bar in Havana in the early 1930s, and took the Betsy Ross name in American bar books of 1940, including Crosby Gaige''s Cocktail Guide. The credit is for print only. The flag-sewing legend behind the name is itself doubtful, and nothing links the drink to Betsy Ross beyond the name.

Method: Stir with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('allegheny', 'Allegheny', 1977, false, 'martini', 'tree', 'Manhattan', 'Bourbon and dry vermouth with a little blackberry and lemon', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/9728/allegheny', 'A bourbon and dry vermouth cocktail sharpened with lemon and a little blackberry.', 'The earliest printing we could confirm is in Stanley M. Jones''s 1977 bar guide, as a stirred mix of bourbon and dry vermouth in equal parts with a touch of blackberry and lemon. No creator is named, so the credit is for print only. It takes its name from the Allegheny River and county in western Pennsylvania, a name with Lenape roots.

Method: Stir with ice, strain into a chilled coupe and finish with a lemon twist.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('arsenic-and-old-lace', 'Arsenic and Old Lace', 1941, false, 'martini', 'tree', 'Martini', 'Crème de violette and absinthe added', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/5167/arsenic-and-old-lace', 'A dry gin Martini tinted with violet liqueur and a few drops of absinthe.', 'The same four ingredients first appeared in equal parts as the Attention Cocktail in Hugo Ensslin''s 1917 book, then as the drier Atty in the 1930 Savoy Cocktail Book. Crosby Gaige printed it under the Arsenic and Old Lace name in 1941, the year Joseph Kesselring''s play of that name reached Broadway, though nobody can say for sure that he renamed it. The credit is for print only.

Method: Stir with ice, strain into a chilled coupe and finish with a lemon twist.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('battle-of-new-orleans', 'Battle of New Orleans', 1941, true, 'oldfashioned', 'tree', 'Sazerac', 'Bourbon in place of rye, with orange bitters, served on ice', NULL, NULL, 'https://kindredcocktails.com/cocktail/battle-new-orleans', 'A bourbon Old Fashioned seasoned the New Orleans way with Peychaud''s and a dash of absinthe.', 'This bourbon Old Fashioned variation is traced to Crosby Gaige''s 1940s cocktail guide, and the credit is for print only. It leans on the Sazerac''s New Orleans markers, Peychaud''s bitters and absinthe, and adds orange bitters. The name points to New Orleans and its famous battle.

Method: Stir with ice, strain into a rocks glass over fresh ice and finish with a lemon twist.', 'Rocks', 'Cubes', 'Stir', 'Classic'),
    ('bennett', 'Bennett', 1922, false, 'sour', 'tree', 'Gimlet', 'Old Tom gin and Angostura, little or no sugar', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/3655/bennett-cocktail', 'A tart gin and lime sour with a couple of dashes of Angostura, close to a Gimlet.', 'Robert Vermeire printed it in 1922 and said it honoured a well known Chilean landowner. It turned up again in 1930 in both the Savoy Cocktail Book and the book by ''Jimmy'' of Ciro''s in London. The early versions use Old Tom gin and no added sugar, so the gin''s sweetness does the balancing. The credit is for print only.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('bermuda-rose', 'Bermuda Rose', 1930, false, 'sour', 'tree', 'Gin Sour', 'Apricot liqueur and grenadine as the sweet', NULL, NULL, 'https://archive.org/download/vintage-cocktail-books-euvs/1930%20Cocktails%20by%20_Jimmy_%20late%20of%20Ciro%27s%20London.pdf', 'A pink gin sour with apricot liqueur, grenadine and lemon.', 'The lemon version first shows up as the Bermudiana Rose in a 1930 book by ''Jimmy'', a bartender late of Ciro''s in London, and London bar books of 1937 repeat it. Later American guides shortened the name to Bermuda Rose, and Trader Vic''s 1972 guide dropped the lemon. The credit is for print only.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('ford', 'Ford', 1895, false, 'martini', 'tree', 'Martini', 'Old Tom gin with Bénédictine and orange bitters', NULL, NULL, 'https://archive.org/download/vintage-cocktail-books-euvs/1895%20Modern%20American%20drinks%3B%20how%20to%20mix%20and%20serve%20all%20kinds%20of%20cups%20and%20drinks.pdf', 'An equal-parts Old Tom gin and dry vermouth cocktail with Bénédictine and orange bitters.', 'George Kappeler printed it in his 1895 New York bar guide, Modern American Drinks. It is a fifty-fifty Martini of Old Tom gin and dry vermouth, seasoned with a few dashes of Bénédictine and orange bitters and an orange peel. The credit is for print only.

Method: Stir with ice, strain into a chilled coupe and finish with an orange twist.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('frisco-sour', 'Frisco Sour', 1934, false, 'sour', 'tree', 'Whiskey Sour', 'Bénédictine in place of sugar, lemon and lime', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/2417/frisco-sour', 'A whiskey sour sweetened with Bénédictine instead of plain sugar.', 'It began as the Frisco, a stirred mix of whisky and Bénédictine printed by William ''Cocktail Bill'' Boothby in 1934. By the late 1940s some recipes added lemon juice, and the full sour with lemon and lime appears in Stanley Jones''s 1977 guide. Egg white was added much later, likely in 1990s London bars. The credit is for print only.

Method: Shake hard with ice (dry shake first if using egg white), strain into a chilled coupe and garnish with lemon and lime.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('pan-american-clipper', 'Pan American Clipper', 1939, false, 'sour', 'tree', 'Jack Rose', 'Lime and a dash of absinthe', NULL, NULL, 'https://archive.org/download/vintage-cocktail-books-euvs/The%20Gentleman%E2%80%99s%20Companion%2C%20Volume%20II%20An%20Exotic%20Drinking%20Book%20by%20Charles%20H%20Baker%20Jr%20%281939%29.pdf', 'An apple brandy sour with lime, a little grenadine and a dash of absinthe.', 'Charles H. Baker Jr. printed it in 1939 in the drinking volume of The Gentleman''s Companion. He said it came from the notebook of a pilot friend, and he noted that Calvados was even better than applejack. Lime, grenadine and a dash of absinthe round out the apple brandy. The credit is for print only.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('vanilla-punch', 'Vanilla Punch', 1862, false, 'sour', 'style', 'punch', 'A single brandy punch scented with vanilla', NULL, NULL, 'https://archive.org/details/bub_gb_iBoZAAAAYAAJ', 'A single-serve brandy punch of sugar and lemon over shaved ice, scented with vanilla.', 'Jerry Thomas included it among the punches in his 1862 bar guide, How to Mix Drinks. It is a brandy, sugar and lemon punch shaken over shaved ice and finished with a few drops of vanilla extract, and Thomas advised sipping it through a straw. The credit is for print only.

Method: Shake the brandy, syrup and lemon with ice, pour into a rocks glass filled with crushed ice, add the vanilla and a lemon slice and serve with a straw.', 'Rocks', 'Crushed', 'Shake', 'Classic'),
    ('kitty-highball', 'Kitty Highball', 1941, false, 'highball', 'style', 'highball', 'Red wine and ginger ale', NULL, NULL, 'https://punchdrink.com/articles/throw-some-ice-in-your-red-wine-cocktail-recipe/', 'A light highball of red wine and ginger ale over ice.', 'A two-ingredient highball from W. C. Whitfield''s 1941 book Here''s How, as later accounts of the book describe it. It is simply red wine stretched with ginger ale over ice, which keeps it low in alcohol. The credit is for print only.

Method: Build the wine over ice in a highball glass, top with ginger ale and stir gently.', 'Highball', 'Cubes', 'Build', 'Classic'),
    ('archangel', 'Archangel', 2006, false, 'martini', 'tree', 'Martini', 'Aperol and muddled cucumber', NULL, NULL, 'https://umamimart.com/blogs/main/the-pdt-project-archangel', 'A stirred, pink, spirit-forward gin drink with Aperol and muddled cucumber.', 'Two Milk & Honey bartenders, Michael McIlroy and Richard Boccato, came up with it in 2006. The name grew out of a bar-side chat about the footballer Gabriel Batistuta, which led them to the Archangel Gabriel. It is often described as a take on Pink Gin and later appeared in the PDT cocktail book.

Method: Muddle the cucumber in the mixing glass, add the gin and Aperol, stir with ice, double strain into a chilled coupe and express a lemon twist over the top.', 'Coupe', NULL, 'Stir', 'Modern Classic'),
    ('flame-of-love', 'Flame of Love', 1970, true, 'martini', 'tree', 'Vodka Martini', 'A fino rinse and flamed orange peels', NULL, NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-314', 'An ice-cold vodka Martini in a sherry-rinsed glass, finished with flamed orange peel.', 'Pepe Ruiz, a longtime bartender at Chasen''s in Hollywood, made it around 1970 after Dean Martin asked why he had no drink of his own there. The show is in the finish: orange peels are flamed over a fino-rinsed glass before the chilled vodka goes in. A tale that Frank Sinatra once ordered dozens of them for a table is usually told as lore.

Method: Rinse a chilled coupe with the fino and flame an orange peel over it. Shake or stir the vodka with ice, strain into the glass and flame a second peel over the top.', 'Coupe', NULL, 'Shake', 'Modern Classic'),
    ('london-calling', 'London Calling', 2002, false, 'sour', 'tree', 'Gin Sour', 'Fino sherry and orange bitters added', NULL, 'milkandhoney.london', 'https://www.diffordsguide.com/cocktails/recipe/1184/london-calling', 'A gin sour lifted with fino sherry and orange bitters, served up with a grapefruit twist.', 'Chris Jepson made it in 2002 while working at Milk & Honey in London, first entering it in a drinks trade magazine competition. It became a fixture on that bar''s menu and then spread to cocktail lists around the world. Some point to an older drink with similar ingredients, but the sugar here makes it a true sour rather than a sherried Martini.

Method: Shake hard with ice, strain into a chilled coupe and express a grapefruit twist over the top.', 'Coupe', NULL, 'Shake', 'Modern Classic'),
    ('rome-with-a-view', 'Rome With a View', 2008, false, 'negroni', 'tree', 'Americano', 'Dry vermouth, lime and sugar, built long like a Collins', 'michael.mcilroy', 'milkandhoney.nyc', 'https://punchdrink.com/recipes/rome-with-a-view/', 'A low-alcohol Collins built on Campari and dry vermouth with lime and soda.', 'Michael McIlroy made it at Milk & Honey in 2008 for guests who claimed they did not like bitter drinks. He wanted something light in alcohol that any bar could copy easily. It sits between a Collins and an Americano, swapping sweet vermouth for dry and adding lime and sugar, and it has inspired a string of riffs.

Method: Shake everything but the soda with ice, strain into a Collins glass over fresh ice, top with soda and garnish with an orange wheel.', 'Collins', 'Cubes', 'shake and top', 'Modern Classic'),
    ('too-soon', 'Too Soon?', 2011, false, 'sour', 'tree', 'Gin Sour', 'Half the base is Cynar, with orange slices shaken in', 'sam.ross', NULL, 'https://kindredcocktails.com/node/4298', 'A bittersweet gin and Cynar sour shaken with orange slices.', 'Sam Ross created it in New York, splitting the base evenly between gin and the artichoke amaro Cynar; accounts place it at Milk & Honey or at Attaboy, which he went on to run. The orange slices go into the shaker whole, so the shake pulls out juice and oil without the bitterness of the pith. It was later printed in Sasha Petraske''s book Regarding Cocktails.

Method: Shake the orange slices with the rest and plenty of ice, double strain into a chilled coupe and express an orange twist if you like.', 'Coupe', NULL, 'Shake', 'Modern Classic'),
    ('medicina-latina', 'Medicina Latina', 2009, false, 'sour', 'tree', 'Penicillin', 'Tequila and lime in place of Scotch and lemon', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/3638/medicina-latina', 'A tequila take on the Penicillin: lime, honey and ginger, with a smoky mezcal float.', 'Usually credited to Marcos Tello at The Varnish in Los Angeles around 2009, as an agave answer to the Penicillin; some accounts tie it to Milk & Honey instead. Tequila takes the place of Scotch, lime the place of lemon, and a small float of mezcal brings the smoke. Candied ginger on a pick is the usual garnish.

Method: Shake everything but the mezcal with ice, strain into a rocks glass over fresh ice, float the mezcal on top and garnish with candied ginger.', 'Rocks', 'Cubes', 'Shake', 'Modern Classic'),
    ('shaky-petes-ginger-brew', 'Shaky Pete''s Ginger Brew', 2008, true, 'highball', 'style', 'buck', 'Gin, lemon and ginger topped with English ale', NULL, 'hawksmoorrestaurants', 'https://classbarmag.com/news/fullstory.php/aid/2144/Neo_classic:_the_story_of_Shaky_Pete_92s_Ginger_Brew.html', 'A frothy blended gin, lemon and fresh ginger drink topped with English ale.', 'Pete Jeary first made it for a Beefeater cocktail competition, where he came second, and brought it to Hawksmoor when he joined in 2008. It began life as a fresh lemonade he made at another London bar, with gin, ginger and London Pride added. A Hawksmoor co-founder named it after Jeary''s nickname, earned by his nervous hands at competitions, and it has never left the menu.

Method: Blend or hard shake the gin, lemon and ginger syrup with a little ice, pour into a chilled mug and top with the ale.', 'Mug', NULL, 'shake and top', 'Modern Classic'),
    ('adderley', 'Adderley', 2005, false, 'sour', 'tree', 'Whiskey Sour', 'Maraschino in place of sugar, with orange bitters', 'sam.ross', 'milkandhoney.nyc', 'https://kindredcocktails.com/cocktail/adderley-cocktail?f=55', 'A rye sour sweetened with maraschino and seasoned with orange bitters.', 'Sam Ross made it at Milk & Honey in New York in 2005. He thinks of it as a rye whiskey version of the Casino, the old gin, maraschino and orange bitters sour. It is served up with no ice.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Modern Classic'),
    ('commando', 'Commando', 1946, false, 'sidecar', 'tree', 'Sidecar', 'Bourbon and lime, with dashes of absinthe', NULL, NULL, 'https://kindredcocktails.com/cocktail/commando', 'A bourbon sidecar-style sour with triple sec and lime, sharpened by a couple of dashes of absinthe.', 'This bourbon sour with orange liqueur and a touch of anise was printed in the 1946 bar book of New York''s Stork Club, the society nightspot of the era. The credit is for print only: the book records the house drink but names no bartender. Its wartime name fits the year it appeared.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('gypsy-queen', 'Gypsy Queen', 1938, false, 'flip', 'style', 'duo', 'Vodka and Bénédictine with a dash of bitters', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/2804/gypsy-queen', 'A stirred vodka and Bénédictine cocktail with a dash of bitters, one of the earliest American vodka drinks.', 'The earliest known printing is a 1938 booklet from New York''s Russian Tea Room, which makes it one of the first vodka cocktails recorded in the United States. David Embury included it in his 1948 book under the name Gypsy, noting that the original two-to-one mix ran sweet and suggesting far more vodka. The credit is for print only.

Method: Stir with ice, strain into a chilled Nick & Nora and finish with an orange twist.', 'Nick & Nora', NULL, 'Stir', 'Classic'),
    ('dr-henderson', 'Dr Henderson', NULL, true, 'flip', 'tree', 'Stinger', 'Fernet-Branca in place of brandy', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/32988/dr-henderson', 'A two-ingredient digestif of Fernet-Branca and crème de menthe served over crushed ice.', 'London chef Fergus Henderson made this bitter, minty pick-me-up famous at his St. John restaurants, where it is pitched as a cure for overindulgence. He says the recipe came from his father, and the drink carries the family name. It has since been sold ready-bottled.

Method: Stir the Fernet-Branca and crème de menthe over crushed ice in a rocks glass and garnish with mint.', 'Rocks', 'Crushed', 'Stir', 'Modern Classic'),
    ('astor-hotel-special', 'Astor Hotel Special', 1939, false, 'highball', 'style', 'fizz', 'Cognac and absinthe with maraschino and egg white', NULL, NULL, 'https://kindredcocktails.com/node/3176', 'A frothy cognac and absinthe sour-style drink with maraschino and egg white, lengthened with a splash of soda.', 'Charles H. Baker Jr. printed this drink in his 1939 travel-and-drinking book after tasting it at the Astor Hotel in Shanghai on a trip around the world. The credit is for print only. With a full three quarters of an ounce of absinthe it is a bold drink, and modern bars often rebalance it with more lemon and maraschino.

Method: Shake everything but the soda hard with ice, strain into a chilled wine glass and top with a splash of soda.', 'Wine', NULL, 'shake and top', 'Classic'),
    ('sputnik', 'Sputnik', 1957, true, 'sour', 'style', 'sour', 'A vodka sour bittered with Fernet-Branca', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/33497/sputnek', 'A shaken vodka sour bittered with Fernet-Branca, named for the first Soviet satellite.', 'The drink takes its name from Sputnik 1, launched in October 1957, when American bars answered the space race with themed food and drinks. The recipe sources point to is the one printed in Stanley M. Jones''s 1977 bar guide, and the credit is for print only. Fernet-Branca gives the simple vodka sour a bitter, minty edge.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('coo-ee-special', 'Coo-ee Special', 1937, false, 'sour', 'style', 'sour', 'Gin, absinthe, orgeat and lemon in equal parts', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/24545/coo-ee-special', 'An equal-parts sour of gin, absinthe, orgeat and lemon.', 'This equal-parts drink was printed in the UK Bartenders'' Guild''s 1937 book of approved cocktails, credited to T. D. Nagle, and listed by name the same year in the Cafe Royal Cocktail Book. Its name comes from the long-carrying ''cooee'' call used in Australia. A full quarter of absinthe makes it far more anise-forward than most sours.

Method: Shake hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('naked-ape', 'Naked Ape', NULL, true, 'tiki', 'style', 'tiki', 'Banana and cinnamon with Jamaican rum', NULL, NULL, 'https://www.diffordsguide.com/cocktails/recipe/36894/naked-ape', 'A tiki-style rum sour with banana liqueur, cinnamon syrup and a hit of funky Jamaican rum, over crushed ice.', 'Martin Cate created this banana and cinnamon rum sour at Smuggler''s Cove in San Francisco. It was first served in a tiki mug shaped like a monkey''s head in a fez, made as merchandise for a local exotica band called Ape, which gave the drink its name.

Method: Shake with ice, pour into a rocks glass or tiki mug filled with crushed ice and garnish with a cinnamon stick and a piece of banana.', 'Rocks', 'Crushed', 'Shake', 'Modern Classic'),
    ('precursory', 'Precursory', 2009, false, 'martini', 'tree', 'Adonis', 'Tawny port in place of sherry, shaken with lemon and sugar', NULL, 'milkandhoney.london', 'https://www.diffordsguide.com/cocktails/recipe/2835/precursory', 'A low-proof shaken cocktail of tawny port and sweet vermouth with a little lemon, sugar and bitters.', 'Tim Philips created this port and vermouth drink at Milk & Honey in London in 2009, and it won that year''s CLASS magazine Bartender of the Year competition. It is a low-alcohol drink that still tastes rich and layered.

Method: Shake hard with ice, strain into a chilled coupe, express a lemon twist and discard it, and set an orange quarter on the rim.', 'Coupe', NULL, 'Shake', 'Modern Classic');

UPDATE "vc_drinks" f SET "item_id" = i.id FROM "public"."items" i WHERE i.is_catalog AND i.item_type = 'cocktail' AND lower(i.name) = lower(f.name);

INSERT INTO "public"."items" ("name", "item_type", "origin", "is_catalog")
SELECT f.name, 'cocktail', f.origin, true FROM "vc_drinks" f WHERE f.item_id IS NULL;

UPDATE "vc_drinks" f SET "item_id" = i.id FROM "public"."items" i
WHERE f.item_id IS NULL AND i.is_catalog AND i.item_type = 'cocktail' AND lower(i.name) = lower(f.name);

-- Year, family, what changed and the parent: one of these drinks, a classic
-- already in the tree (by name), or a style. A drink already in the tree keeps
-- its place.
UPDATE "public"."items" i SET
    "origin_year" = f.year::smallint,
    "origin_year_approx" = f.approx,
    "lineage_family" = f.family,
    "lineage_note" = f.note,
    "lineage_parent_id" = CASE f.parent_kind WHEN 'new' THEN pf.item_id WHEN 'tree' THEN pt.id END,
    "lineage_style_id" = CASE WHEN f.parent_kind = 'style' THEN s.id END
FROM "vc_drinks" f
LEFT JOIN "vc_drinks" pf ON f.parent_kind = 'new' AND pf.key = f.parent
LEFT JOIN LATERAL (SELECT t.id FROM "public"."items" t
                   WHERE f.parent_kind = 'tree' AND t.is_catalog AND t.lineage_family IS NOT NULL AND lower(t.name) = lower(f.parent)
                   ORDER BY t.created_at LIMIT 1) pt ON true
LEFT JOIN "public"."drink_styles" s ON f.parent_kind = 'style' AND s.key = f.parent
WHERE i.id = f.item_id AND i.lineage_family IS NULL;

-- What it is and its story, only where there's none yet. Glass and ice too.
UPDATE "public"."items" i SET
    "description" = coalesce(i.description, f.description),
    "notes" = coalesce(i.notes, f.notes),
    "glassware_id" = coalesce(i.glassware_id, (SELECT g.id FROM "public"."items" g WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND lower(g.name) = lower(f.glass) ORDER BY g.created_at LIMIT 1)),
    "ice_id" = coalesce(i.ice_id, (SELECT c.id FROM "public"."items" c WHERE c.item_type = 'ice' AND c.bar_id IS NULL AND lower(c.name) = lower(f.ice) ORDER BY c.created_at LIMIT 1))
FROM "vc_drinks" f
WHERE i.id = f.item_id;

INSERT INTO "public"."item_methods" ("item_id", "method_item_id", "sort_order")
SELECT f.item_id, m.id, 0
FROM "vc_drinks" f
JOIN LATERAL (SELECT x.id FROM "public"."items" x WHERE x.item_type = 'method' AND x.bar_id IS NULL AND lower(x.name) = lower(f.method) ORDER BY x.created_at LIMIT 1) m ON true
WHERE f.method IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."item_methods" x WHERE x.item_id = f.item_id);

-- Credits, only for the people and bars we already have and only where a
-- source names the maker; 'suggested' until claimed. An existing credit is
-- kept.
UPDATE "public"."items" i SET
    "creator_profile_id" = coalesce(i.creator_profile_id, cp.id),
    "origin_bar_profile_id" = coalesce(i.origin_bar_profile_id, bp.id)
FROM "vc_drinks" f
LEFT JOIN "public"."profiles" cp ON cp.handle = f.creator AND cp.kind = 'person'
LEFT JOIN "public"."profiles" bp ON bp.handle = f.bar AND bp.kind = 'bar'
WHERE i.id = f.item_id AND (cp.id IS NOT NULL OR bp.id IS NOT NULL)
  AND (i.creator_profile_id IS NULL OR i.origin_bar_profile_id IS NULL);

-- --- 2. Specs ---

CREATE TEMP TABLE "vc_lines" ("key" text, "pos" int, "amount" numeric, "unit" text, "ingredient" text, "prep" text, "optional" boolean);
INSERT INTO "vc_lines" VALUES
    ('addington', 0, 1.5, 'oz', 'Dry vermouth', NULL, false),
    ('addington', 1, 1.5, 'oz', 'Sweet vermouth', NULL, false),
    ('addington', 2, 2, 'oz', 'Soda water', 'to top', false),
    ('addington', 3, 1, 'twist', 'Orange twist', 'squeezed over the top', false),
    ('allies-cocktail', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('allies-cocktail', 1, 1.5, 'oz', 'Dry vermouth', NULL, false),
    ('allies-cocktail', 2, 2, 'dash', 'Kümmel', NULL, false),
    ('loud-speaker', 0, 1.25, 'oz', 'Gin', NULL, false),
    ('loud-speaker', 1, 1.25, 'oz', 'Brandy', NULL, false),
    ('loud-speaker', 2, 0.5, 'oz', 'Triple sec', NULL, false),
    ('loud-speaker', 3, 0.5, 'oz', 'Lemon juice', NULL, false),
    ('astoria', 0, 2, 'oz', 'Old Tom gin', NULL, false),
    ('astoria', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('astoria', 2, 1, 'dash', 'Orange bitters', NULL, false),
    ('astoria', 3, 1, 'each', 'Stuffed olive', NULL, true),
    ('bronx-terrace', 0, 1.25, 'oz', 'Gin', NULL, false),
    ('bronx-terrace', 1, 1.25, 'oz', 'Dry vermouth', NULL, false),
    ('bronx-terrace', 2, 0.5, 'oz', 'Lime juice', NULL, false),
    ('campden', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('campden', 1, 0.75, 'oz', 'Triple sec', NULL, false),
    ('campden', 2, 0.75, 'oz', 'Lillet Blanc', NULL, false),
    ('charlie-lindbergh', 0, 1.5, 'oz', 'Gin', 'Plymouth style', false),
    ('charlie-lindbergh', 1, 1.5, 'oz', 'Lillet Blanc', NULL, false),
    ('charlie-lindbergh', 2, 2, 'dash', 'Apricot liqueur', NULL, false),
    ('charlie-lindbergh', 3, 2, 'dash', 'Orange juice', NULL, false),
    ('charlie-lindbergh', 4, 1, 'twist', 'Lemon twist', 'squeezed over the top', false),
    ('claridge-cocktail', 0, 1, 'oz', 'Gin', NULL, false),
    ('claridge-cocktail', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('claridge-cocktail', 2, 0.5, 'oz', 'Apricot liqueur', NULL, false),
    ('claridge-cocktail', 3, 0.5, 'oz', 'Triple sec', NULL, false),
    ('self-starter', 0, 2, 'oz', 'Gin', NULL, false),
    ('self-starter', 1, 1.5, 'oz', 'Lillet Blanc', NULL, false),
    ('self-starter', 2, 0.5, 'oz', 'Apricot liqueur', NULL, false),
    ('self-starter', 3, 2, 'dash', 'Absinthe', NULL, false),
    ('deauville', 0, 0.75, 'oz', 'Cognac', NULL, false),
    ('deauville', 1, 0.75, 'oz', 'Calvados', NULL, false),
    ('deauville', 2, 0.75, 'oz', 'Triple sec', NULL, false),
    ('deauville', 3, 0.75, 'oz', 'Lemon juice', NULL, false),
    ('deauville', 4, 1, 'twist', 'Lemon twist', NULL, false),
    ('dick-jr', 0, 1, 'oz', 'Gin', NULL, false),
    ('dick-jr', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('dick-jr', 2, 1, 'oz', 'Apricot liqueur', NULL, false),
    ('dick-jr', 3, 0.75, 'oz', 'Lime juice', NULL, false),
    ('fairbank', 0, 2, 'oz', 'London dry gin', NULL, false),
    ('fairbank', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('fairbank', 2, 2, 'dash', 'Crème de noyaux', NULL, false),
    ('fairbank', 3, 2, 'dash', 'Orange bitters', NULL, false),
    ('fairbank', 4, 1, 'each', 'Maraschino cherry', NULL, false),
    ('franks-special', 0, 1.5, 'oz', 'London dry gin', NULL, false),
    ('franks-special', 1, 1.5, 'oz', 'Dry vermouth', NULL, false),
    ('franks-special', 2, 1, 'dash', 'Peach liqueur', NULL, false),
    ('hoop-la', 0, 0.75, 'oz', 'Cognac', NULL, false),
    ('hoop-la', 1, 0.75, 'oz', 'Triple sec', NULL, false),
    ('hoop-la', 2, 0.75, 'oz', 'Lillet Blanc', NULL, false),
    ('hoop-la', 3, 0.75, 'oz', 'Lemon juice', NULL, false),
    ('odd-mcintyre', 0, 0.75, 'oz', 'Cognac', NULL, false),
    ('odd-mcintyre', 1, 0.75, 'oz', 'Triple sec', NULL, false),
    ('odd-mcintyre', 2, 0.75, 'oz', 'Lillet Blanc', NULL, false),
    ('odd-mcintyre', 3, 0.75, 'oz', 'Lemon juice', NULL, false),
    ('odd-mcintyre', 4, 1, 'twist', 'Lemon twist', NULL, false),
    ('jabberwock', 0, 1, 'oz', 'London dry gin', NULL, false),
    ('jabberwock', 1, 1, 'oz', 'Fino sherry', NULL, false),
    ('jabberwock', 2, 1, 'oz', 'Lillet Blanc', NULL, false),
    ('jabberwock', 3, 2, 'dash', 'Orange bitters', NULL, false),
    ('jabberwock', 4, 1, 'twist', 'Lemon twist', NULL, false),
    ('last-round', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('last-round', 1, 1.5, 'oz', 'Dry vermouth', NULL, false),
    ('last-round', 2, 2, 'dash', 'Cognac', NULL, false),
    ('last-round', 3, 2, 'dash', 'Absinthe', NULL, false),
    ('montana', 0, 1, 'oz', 'Cognac', NULL, false),
    ('montana', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('montana', 2, 1, 'oz', 'Ruby port', NULL, false),
    ('montana', 3, 1, 'twist', 'Lemon twist', NULL, false),
    ('swan', 0, 1, 'oz', 'Gin', NULL, false),
    ('swan', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('swan', 2, 0.75, 'oz', 'Lime juice', NULL, false),
    ('swan', 3, 2, 'dash', 'Aromatic bitters', NULL, false),
    ('swan', 4, 2, 'dash', 'Absinthe', NULL, false),
    ('trinity', 0, 1, 'oz', 'Gin', NULL, false),
    ('trinity', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('trinity', 2, 1, 'oz', 'Sweet vermouth', NULL, false),
    ('trinity', 3, 1, 'twist', 'Lemon twist', NULL, false),
    ('betsy-ross', 0, 1.5, 'oz', 'Cognac', NULL, false),
    ('betsy-ross', 1, 1.5, 'oz', 'Ruby port', NULL, false),
    ('betsy-ross', 2, 1, 'tsp', 'Orange curaçao', NULL, false),
    ('betsy-ross', 3, 2, 'dash', 'Aromatic bitters', NULL, false),
    ('allegheny', 0, 1, 'oz', 'Bourbon', NULL, false),
    ('allegheny', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('allegheny', 2, 0.25, 'oz', 'Crème de mûre', NULL, false),
    ('allegheny', 3, 0.25, 'oz', 'Lemon juice', NULL, false),
    ('allegheny', 4, 1, 'dash', 'Aromatic bitters', NULL, false),
    ('allegheny', 5, 1, 'twist', 'Lemon twist', NULL, false),
    ('arsenic-and-old-lace', 0, 2.25, 'oz', 'Gin', NULL, false),
    ('arsenic-and-old-lace', 1, 0.75, 'oz', 'Dry vermouth', NULL, false),
    ('arsenic-and-old-lace', 2, 3, 'dash', 'Crème de violette', NULL, false),
    ('arsenic-and-old-lace', 3, 3, 'dash', 'Absinthe', NULL, false),
    ('arsenic-and-old-lace', 4, 1, 'twist', 'Lemon twist', NULL, false),
    ('battle-of-new-orleans', 0, 2.5, 'oz', 'Bourbon', NULL, false),
    ('battle-of-new-orleans', 1, 0.25, 'oz', 'Simple syrup', NULL, false),
    ('battle-of-new-orleans', 2, 1, 'dash', 'Absinthe', NULL, false),
    ('battle-of-new-orleans', 3, 2, 'dash', 'Peychaud''s bitters', NULL, false),
    ('battle-of-new-orleans', 4, 1, 'dash', 'Orange bitters', NULL, false),
    ('battle-of-new-orleans', 5, 1, 'twist', 'Lemon twist', NULL, false),
    ('bennett', 0, 2, 'oz', 'Old Tom gin', NULL, false),
    ('bennett', 1, 1, 'oz', 'Lime juice', NULL, false),
    ('bennett', 2, 2, 'dash', 'Aromatic bitters', NULL, false),
    ('bennett', 3, 0.25, 'oz', 'Simple syrup', NULL, true),
    ('bermuda-rose', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('bermuda-rose', 1, 0.75, 'oz', 'Apricot liqueur', NULL, false),
    ('bermuda-rose', 2, 0.75, 'oz', 'Grenadine', NULL, false),
    ('bermuda-rose', 3, 0.75, 'oz', 'Lemon juice', NULL, false),
    ('ford', 0, 1.5, 'oz', 'Old Tom gin', NULL, false),
    ('ford', 1, 1.5, 'oz', 'Dry vermouth', NULL, false),
    ('ford', 2, 3, 'dash', 'Bénédictine', NULL, false),
    ('ford', 3, 3, 'dash', 'Orange bitters', NULL, false),
    ('ford', 4, 1, 'twist', 'Orange twist', NULL, false),
    ('frisco-sour', 0, 1.25, 'oz', 'Bourbon', NULL, false),
    ('frisco-sour', 1, 0.75, 'oz', 'Bénédictine', NULL, false),
    ('frisco-sour', 2, 0.5, 'oz', 'Lemon juice', NULL, false),
    ('frisco-sour', 3, 0.25, 'oz', 'Lime juice', NULL, false),
    ('frisco-sour', 4, 0.25, 'tsp', 'Simple syrup', NULL, false),
    ('frisco-sour', 5, 0.5, 'oz', 'Egg white', NULL, true),
    ('frisco-sour', 6, 1, 'each', 'Lemon wedge', NULL, false),
    ('frisco-sour', 7, 1, 'each', 'Lime wheel', NULL, false),
    ('pan-american-clipper', 0, 2, 'oz', 'Applejack', NULL, false),
    ('pan-american-clipper', 1, 0.75, 'oz', 'Lime juice', NULL, false),
    ('pan-american-clipper', 2, 0.25, 'oz', 'Grenadine', NULL, false),
    ('pan-american-clipper', 3, 1, 'dash', 'Absinthe', NULL, false),
    ('vanilla-punch', 0, 2, 'oz', 'Brandy', NULL, false),
    ('vanilla-punch', 1, 0.5, 'oz', 'Simple syrup', NULL, false),
    ('vanilla-punch', 2, 0.25, 'oz', 'Lemon juice', NULL, false),
    ('vanilla-punch', 3, 4, 'drop', 'Vanilla extract', NULL, false),
    ('vanilla-punch', 4, 1, 'slice', 'Lemon', NULL, false),
    ('kitty-highball', 0, 3, 'oz', 'Red wine', NULL, false),
    ('kitty-highball', 1, 3, 'oz', 'Ginger ale', NULL, false),
    ('archangel', 0, 2, 'slice', 'Cucumber', 'muddled', false),
    ('archangel', 1, 2.25, 'oz', 'Gin', NULL, false),
    ('archangel', 2, 0.75, 'oz', 'Aperol', NULL, false),
    ('archangel', 3, 1, 'twist', 'Lemon twist', 'expressed', false),
    ('flame-of-love', 0, 0.25, 'oz', 'Fino sherry', 'rinse the glass', false),
    ('flame-of-love', 1, 3, 'oz', 'Vodka', NULL, false),
    ('flame-of-love', 2, 1, 'twist', 'Orange twist', 'flamed', false),
    ('london-calling', 0, 1.5, 'oz', 'London dry gin', NULL, false),
    ('london-calling', 1, 0.5, 'oz', 'Fino sherry', NULL, false),
    ('london-calling', 2, 0.5, 'oz', 'Lemon juice', NULL, false),
    ('london-calling', 3, 0.5, 'oz', 'Simple syrup', NULL, false),
    ('london-calling', 4, 2, 'dash', 'Orange bitters', NULL, false),
    ('london-calling', 5, 1, 'twist', 'Grapefruit twist', 'expressed', false),
    ('rome-with-a-view', 0, 1, 'oz', 'Campari', NULL, false),
    ('rome-with-a-view', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('rome-with-a-view', 2, 1, 'oz', 'Lime juice', NULL, false),
    ('rome-with-a-view', 3, 0.75, 'oz', 'Simple syrup', NULL, false),
    ('rome-with-a-view', 4, 2, 'oz', 'Soda water', 'to top', false),
    ('rome-with-a-view', 5, 1, 'wheel', 'Orange', NULL, false),
    ('too-soon', 0, 2, 'slice', 'Orange', 'shaken, not muddled', false),
    ('too-soon', 1, 1, 'oz', 'Gin', NULL, false),
    ('too-soon', 2, 1, 'oz', 'Cynar', NULL, false),
    ('too-soon', 3, 0.75, 'oz', 'Lemon juice', NULL, false),
    ('too-soon', 4, 0.5, 'oz', 'Simple syrup', NULL, false),
    ('too-soon', 5, 1, 'twist', 'Orange twist', 'expressed', true),
    ('medicina-latina', 0, 2, 'oz', 'Tequila blanco', NULL, false),
    ('medicina-latina', 1, 0.75, 'oz', 'Lime juice', NULL, false),
    ('medicina-latina', 2, 0.25, 'oz', 'Honey syrup', '3:1 honey to water', false),
    ('medicina-latina', 3, 0.25, 'oz', 'Ginger syrup', NULL, false),
    ('medicina-latina', 4, 1, 'tsp', 'Mezcal', 'floated on top', false),
    ('medicina-latina', 5, 1, 'each', 'Candied ginger', 'skewered', false),
    ('shaky-petes-ginger-brew', 0, 1.25, 'oz', 'London dry gin', NULL, false),
    ('shaky-petes-ginger-brew', 1, 1.75, 'oz', 'Lemon juice', NULL, false),
    ('shaky-petes-ginger-brew', 2, 1.75, 'oz', 'Ginger syrup', NULL, false),
    ('shaky-petes-ginger-brew', 3, 4, 'oz', 'Ale', 'English bitter, such as London Pride', false),
    ('adderley', 0, 2, 'oz', 'Rye whiskey', NULL, false),
    ('adderley', 1, 0.75, 'oz', 'Lemon juice', NULL, false),
    ('adderley', 2, 0.75, 'oz', 'Maraschino liqueur', NULL, false),
    ('adderley', 3, 2, 'dash', 'Orange bitters', NULL, false),
    ('commando', 0, 1.5, 'oz', 'Bourbon', NULL, false),
    ('commando', 1, 0.75, 'oz', 'Triple sec', NULL, false),
    ('commando', 2, 0.5, 'oz', 'Lime juice', NULL, false),
    ('commando', 3, 2, 'dash', 'Absinthe', NULL, false),
    ('gypsy-queen', 0, 2, 'oz', 'Vodka', NULL, false),
    ('gypsy-queen', 1, 1, 'oz', 'Bénédictine', NULL, false),
    ('gypsy-queen', 2, 1, 'dash', 'Aromatic bitters', NULL, false),
    ('gypsy-queen', 3, 1, 'twist', 'Orange twist', NULL, false),
    ('dr-henderson', 0, 1.5, 'oz', 'Fernet-Branca', NULL, false),
    ('dr-henderson', 1, 0.75, 'oz', 'Crème de menthe', NULL, false),
    ('dr-henderson', 2, 1, 'sprig', 'Mint sprigs', NULL, false),
    ('astor-hotel-special', 0, 1.5, 'oz', 'Cognac', NULL, false),
    ('astor-hotel-special', 1, 0.75, 'oz', 'Absinthe', NULL, false),
    ('astor-hotel-special', 2, 1, 'tsp', 'Maraschino liqueur', NULL, false),
    ('astor-hotel-special', 3, 0.5, 'tsp', 'Lemon juice', NULL, false),
    ('astor-hotel-special', 4, 2, 'tsp', 'Egg white', NULL, false),
    ('astor-hotel-special', 5, 1, 'oz', 'Soda water', 'top', false),
    ('sputnik', 0, 1.5, 'oz', 'Vodka', NULL, false),
    ('sputnik', 1, 0.5, 'oz', 'Fernet-Branca', NULL, false),
    ('sputnik', 2, 0.5, 'oz', 'Lemon juice', NULL, false),
    ('sputnik', 3, 1, 'tsp', 'Simple syrup', NULL, false),
    ('coo-ee-special', 0, 0.75, 'oz', 'Gin', NULL, false),
    ('coo-ee-special', 1, 0.75, 'oz', 'Absinthe', NULL, false),
    ('coo-ee-special', 2, 0.75, 'oz', 'Orgeat', NULL, false),
    ('coo-ee-special', 3, 0.75, 'oz', 'Lemon juice', NULL, false),
    ('naked-ape', 0, 1.5, 'oz', 'Dark rum', NULL, false),
    ('naked-ape', 1, 0.5, 'oz', 'Jamaican rum', 'overproof pot still', false),
    ('naked-ape', 2, 0.5, 'oz', 'Banana liqueur', NULL, false),
    ('naked-ape', 3, 0.5, 'oz', 'Cinnamon syrup', NULL, false),
    ('naked-ape', 4, 0.5, 'oz', 'Lemon juice', NULL, false),
    ('naked-ape', 5, 1, 'dash', 'Aromatic bitters', NULL, false),
    ('naked-ape', 6, 1, 'each', 'Cinnamon stick', NULL, false),
    ('naked-ape', 7, 1, 'piece', 'Banana', NULL, false),
    ('precursory', 0, 1.5, 'oz', 'Tawny port', NULL, false),
    ('precursory', 1, 1.5, 'oz', 'Sweet vermouth', NULL, false),
    ('precursory', 2, 0.25, 'oz', 'Simple syrup', NULL, false),
    ('precursory', 3, 1, 'tsp', 'Lemon juice', NULL, false),
    ('precursory', 4, 3, 'dash', 'Aromatic bitters', NULL, false),
    ('precursory', 5, 3, 'dash', 'Orange bitters', NULL, true),
    ('precursory', 6, 1, 'twist', 'Lemon twist', 'expressed and discarded', false),
    ('precursory', 7, 1, 'each', 'Orange slice', 'quarter, on the rim', false);

-- Specs, only for drinks with none. Each ingredient is the shared one with
-- the same name key (or alias); a name we don't have yet is added as a plain
-- ingredient.
CREATE TEMP TABLE "vc_ing" AS SELECT DISTINCT "ingredient" AS "name", public.resolve_ingredient("ingredient") AS "item_id" FROM "vc_lines";
INSERT INTO "public"."items" ("name", "item_type", "ingredient_role", "hide_from_search")
SELECT DISTINCT ON (public.ingredient_key(n.name)) n.name, 'ingredient', 'generic', false
FROM "vc_ing" n WHERE n.item_id IS NULL ORDER BY public.ingredient_key(n.name), n.name;
UPDATE "vc_ing" n SET "item_id" = public.resolve_ingredient(n.name) WHERE n.item_id IS NULL;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "amount", "unit", "preparation_notes", "is_optional", "sort_order")
SELECT f.item_id, n.item_id, l.amount, l.unit, l.prep, l.optional, l.pos
FROM "vc_lines" l
JOIN "vc_drinks" f ON f.key = l.key
JOIN "vc_ing" n ON n.name = l.ingredient AND n.item_id IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = f.item_id);

-- --- 3. Other names ---

CREATE TEMP TABLE "vc_aliases" ("key" text, "alias" text, "source" text);
INSERT INTO "vc_aliases" VALUES
    ('allies-cocktail', 'Allies Martini', 'https://www.diffordsguide.com/cocktails/recipe/17688/allies-martini'),
    ('charlie-lindbergh', 'Charles Lindbergh', 'https://www.diffordsguide.com/cocktails/recipe/13311/charlie-lindbergh-cocktail'),
    ('fairbank', 'Fairbanks No. 2', 'https://www.diffordsguide.com/cocktails/recipe/4678/fairbanks-no2'),
    ('betsy-ross', 'Betty Ross', 'https://www.diffordsguide.com/cocktails/recipe/3245/betsy-ross'),
    ('bermuda-rose', 'Bermudiana Rose', 'https://www.diffordsguide.com/cocktails/recipe/543/bermuda-rose-cocktail'),
    ('pan-american-clipper', 'Pan Am Clipper', 'https://wulfcocktailden.com/2023/12/flying-old-school-the-pan-am-clipper'),
    ('flame-of-love', 'Flame of Love Martini', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-314'),
    ('sputnik', 'Sputnek', 'https://www.diffordsguide.com/cocktails/recipe/33497/sputnek'),
    ('coo-ee-special', 'Cooee Special', 'https://www.diffordsguide.com/cocktails/recipe/24545/coo-ee-special');

-- True other names only, each with a source. An alias never shadows a classic
-- with that name, and names one classic.
INSERT INTO "public"."classic_aliases" ("classic_id", "alias", "source")
SELECT f.item_id, a.alias, a.source
FROM "vc_aliases" a
JOIN "vc_drinks" f ON f.key = a.key
WHERE NOT EXISTS (SELECT 1 FROM "public"."items" o WHERE o.is_catalog AND o.item_type = 'cocktail'
                  AND private.drink_name_key(o.name) = private.drink_name_key(a.alias))
ON CONFLICT DO NOTHING;

-- The Turf Club is the Turf under the name McElhone printed in 1922.
INSERT INTO "public"."classic_aliases" ("classic_id", "alias", "source")
SELECT t.id, 'Turf Club', 'https://www.diffordsguide.com/cocktails/recipe/3394/turf-club-1900-harry-johnson'
FROM "public"."items" t
WHERE t.is_catalog AND t.item_type = 'cocktail' AND t.name = 'Turf'
ON CONFLICT DO NOTHING;

-- --- 4. Sources ---

INSERT INTO "public"."sources" ("key", "kind", "title", "rights", "url")
SELECT v.key, 'web', v.title, 'facts_only', v.url
FROM (VALUES
    ('web:archive-org-details-savoycocktailboo0000vari-page-n20', 'Addington', 'https://archive.org/details/savoycocktailboo0000vari/page/n20/'),
    ('web:www-diffordsguide-com-cocktails-recipe-17688-allies-martini', 'Allies Cocktail', 'https://www.diffordsguide.com/cocktails/recipe/17688/allies-martini'),
    ('web:archive-org-details-savoycocktailboo0000vari-page-n101', 'Loud Speaker', 'https://archive.org/details/savoycocktailboo0000vari/page/n101/'),
    ('web:archive-org-details-drinks00unse-page-n20', 'Astoria', 'https://archive.org/details/drinks00unse/page/n20/'),
    ('web:archive-org-details-drinks00unse-page-n24', 'Bronx Terrace', 'https://archive.org/details/drinks00unse/page/n24/'),
    ('web:archive-org-details-savoycocktailboo0000vari-page-n44', 'Campden', 'https://archive.org/details/savoycocktailboo0000vari/page/n44/'),
    ('web:archive-org-details-savoycocktailboo0000vari-page-n99', 'Charlie Lindbergh', 'https://archive.org/details/savoycocktailboo0000vari/page/n99/'),
    ('web:www-diffordsguide-com-cocktails-recipe-440-claridge-cocktail', 'Claridge Cocktail', 'https://www.diffordsguide.com/cocktails/recipe/440/claridge-cocktail'),
    ('web:archive-org-details-savoycocktailboo0000vari-page-n147', 'Self-Starter', 'https://archive.org/details/savoycocktailboo0000vari/page/n147/'),
    ('web:www-diffordsguide-com-cocktails-recipe-2625-deauville', 'Deauville', 'https://www.diffordsguide.com/cocktails/recipe/2625/deauville'),
    ('web:archive-org-download-vintage-cocktail-books-euvs-1917-20recipes-20for-20-3d5a461', 'Dick, Jr.', 'https://archive.org/download/vintage-cocktail-books-euvs/1917%20Recipes%20for%20Mixed%20Drinks%20by%20Hugo%20R%20Ensslin%20%28second%20edition%29.pdf'),
    ('web:drinkboy-com-cocktails-recipe-aspx-itemid-253', 'Fairbank', 'https://drinkboy.com/cocktails/Recipe.aspx?itemid=253'),
    ('web:euvs-vintage-cocktail-books-cld-bz-1936-the-artistry-of-mixing-drinks-by-9841d6a', 'Frank''s Special', 'https://euvs-vintage-cocktail-books.cld.bz/1936-The-Artistry-of-Mixing-Drinks-by-Frank-Meier/31/'),
    ('web:kindredcocktails-com-cocktail-hoop-la', 'Hoop La', 'https://kindredcocktails.com/cocktail/hoop-la'),
    ('web:www-diffordsguide-com-cocktails-recipe-38317-odd-mcintyre', 'Odd McIntyre', 'https://www.diffordsguide.com/cocktails/recipe/38317/odd-mcintyre'),
    ('web:www-diffordsguide-com-cocktails-recipe-4908-jabberwock', 'Jabberwock', 'https://www.diffordsguide.com/cocktails/recipe/4908/jabberwock'),
    ('web:euvs-vintage-cocktail-books-cld-bz-1936-the-artistry-of-mixing-drinks-by-b5b3ee0', 'Last Round', 'https://euvs-vintage-cocktail-books.cld.bz/1936-The-Artistry-of-Mixing-Drinks-by-Frank-Meier/34/'),
    ('web:www-diffordsguide-com-cocktails-recipe-26633-montana-albert-stevens-croc-1684233', 'Montana', 'https://www.diffordsguide.com/cocktails/recipe/26633/montana-albert-stevens-crockett-1931'),
    ('web:archive-org-download-vintage-cocktail-books-euvs-1935-20old-20waldorf-as-2f2b64f', 'Swan', 'https://archive.org/download/vintage-cocktail-books-euvs/1935%20Old%20Waldorf-Astoria%20Bar%20Book.pdf'),
    ('web:punchdrink-com-recipes-the-trinity', 'Trinity', 'https://punchdrink.com/recipes/the-trinity/'),
    ('web:www-diffordsguide-com-cocktails-recipe-3245-betsy-ross', 'Betsy Ross', 'https://www.diffordsguide.com/cocktails/recipe/3245/betsy-ross'),
    ('web:www-diffordsguide-com-cocktails-recipe-9728-allegheny', 'Allegheny', 'https://www.diffordsguide.com/cocktails/recipe/9728/allegheny'),
    ('web:www-diffordsguide-com-cocktails-recipe-5167-arsenic-and-old-lace', 'Arsenic and Old Lace', 'https://www.diffordsguide.com/cocktails/recipe/5167/arsenic-and-old-lace'),
    ('web:kindredcocktails-com-cocktail-battle-new-orleans', 'Battle of New Orleans', 'https://kindredcocktails.com/cocktail/battle-new-orleans'),
    ('web:www-diffordsguide-com-cocktails-recipe-3655-bennett-cocktail', 'Bennett', 'https://www.diffordsguide.com/cocktails/recipe/3655/bennett-cocktail'),
    ('web:archive-org-download-vintage-cocktail-books-euvs-1930-20cocktails-20by-2-3db6f23', 'Bermuda Rose', 'https://archive.org/download/vintage-cocktail-books-euvs/1930%20Cocktails%20by%20_Jimmy_%20late%20of%20Ciro%27s%20London.pdf'),
    ('web:archive-org-download-vintage-cocktail-books-euvs-1895-20modern-20america-c0540bf', 'Ford', 'https://archive.org/download/vintage-cocktail-books-euvs/1895%20Modern%20American%20drinks%3B%20how%20to%20mix%20and%20serve%20all%20kinds%20of%20cups%20and%20drinks.pdf'),
    ('web:www-diffordsguide-com-cocktails-recipe-2417-frisco-sour', 'Frisco Sour', 'https://www.diffordsguide.com/cocktails/recipe/2417/frisco-sour'),
    ('web:archive-org-download-vintage-cocktail-books-euvs-the-20gentleman-e2-80-9-c9027ea', 'Pan American Clipper', 'https://archive.org/download/vintage-cocktail-books-euvs/The%20Gentleman%E2%80%99s%20Companion%2C%20Volume%20II%20An%20Exotic%20Drinking%20Book%20by%20Charles%20H%20Baker%20Jr%20%281939%29.pdf'),
    ('web:archive-org-details-bub-gb-ibozaaaayaaj', 'Vanilla Punch', 'https://archive.org/details/bub_gb_iBoZAAAAYAAJ'),
    ('web:punchdrink-com-articles-throw-some-ice-in-your-red-wine-cocktail-recipe', 'Kitty Highball', 'https://punchdrink.com/articles/throw-some-ice-in-your-red-wine-cocktail-recipe/'),
    ('web:umamimart-com-blogs-main-the-pdt-project-archangel', 'Archangel', 'https://umamimart.com/blogs/main/the-pdt-project-archangel'),
    ('web:www-spiritsanddistilling-com-dictionary-acref-9780199311132-e-314', 'Flame of Love', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-314'),
    ('web:www-diffordsguide-com-cocktails-recipe-1184-london-calling', 'London Calling', 'https://www.diffordsguide.com/cocktails/recipe/1184/london-calling'),
    ('web:punchdrink-com-recipes-rome-with-a-view', 'Rome With a View', 'https://punchdrink.com/recipes/rome-with-a-view/'),
    ('web:kindredcocktails-com-node-4298', 'Too Soon?', 'https://kindredcocktails.com/node/4298'),
    ('web:www-diffordsguide-com-cocktails-recipe-3638-medicina-latina', 'Medicina Latina', 'https://www.diffordsguide.com/cocktails/recipe/3638/medicina-latina'),
    ('web:classbarmag-com-news-fullstory-php-aid-2144-neo-classic-the-story-of-sha-93dbc79', 'Shaky Pete''s Ginger Brew', 'https://classbarmag.com/news/fullstory.php/aid/2144/Neo_classic:_the_story_of_Shaky_Pete_92s_Ginger_Brew.html'),
    ('web:kindredcocktails-com-cocktail-adderley-cocktail-f-55', 'Adderley', 'https://kindredcocktails.com/cocktail/adderley-cocktail?f=55'),
    ('web:kindredcocktails-com-cocktail-commando', 'Commando', 'https://kindredcocktails.com/cocktail/commando'),
    ('web:www-diffordsguide-com-cocktails-recipe-2804-gypsy-queen', 'Gypsy Queen', 'https://www.diffordsguide.com/cocktails/recipe/2804/gypsy-queen'),
    ('web:www-diffordsguide-com-cocktails-recipe-32988-dr-henderson', 'Dr Henderson', 'https://www.diffordsguide.com/cocktails/recipe/32988/dr-henderson'),
    ('web:kindredcocktails-com-node-3176', 'Astor Hotel Special', 'https://kindredcocktails.com/node/3176'),
    ('web:www-diffordsguide-com-cocktails-recipe-33497-sputnek', 'Sputnik', 'https://www.diffordsguide.com/cocktails/recipe/33497/sputnek'),
    ('web:www-diffordsguide-com-cocktails-recipe-24545-coo-ee-special', 'Coo-ee Special', 'https://www.diffordsguide.com/cocktails/recipe/24545/coo-ee-special'),
    ('web:www-diffordsguide-com-cocktails-recipe-36894-naked-ape', 'Naked Ape', 'https://www.diffordsguide.com/cocktails/recipe/36894/naked-ape'),
    ('web:www-diffordsguide-com-cocktails-recipe-2835-precursory', 'Precursory', 'https://www.diffordsguide.com/cocktails/recipe/2835/precursory')
) AS v("key", "title", "url")
WHERE NOT EXISTS (SELECT 1 FROM "public"."sources" s WHERE s.key = v.key OR s.url = v.url);

INSERT INTO "public"."source_recipes" ("source_id", "item_id", "printed_name", "relation")
SELECT s.id, f.item_id, f.name, 'first_print'
FROM "vc_drinks" f
JOIN "public"."sources" s ON s.url = f.src
WHERE f.src IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "public"."source_recipes" r WHERE r.item_id = f.item_id);


-- --- No paid AI: drop the flavour jobs these inserts queued ---

DELETE FROM "private"."item_flavor_jobs" j
USING "vc_drinks" f
WHERE j.item_id = f.item_id AND NOT EXISTS (SELECT 1 FROM "vc_jobs_before" b WHERE b.item_id = j.item_id);

DROP TABLE "vc_aliases", "vc_lines", "vc_ing", "vc_drinks", "vc_jobs_before";
