-- Classics the family tree missed: 38 drinks the 2026-10-08 tree
-- (20261008950100) left out, from the IBA list (Champagne Cocktail, Planter's
-- Punch, Mary Pickford, Angel Face, French Martini, Spicy Fifty...), the
-- pre-Prohibition and Savoy bar books (Charlie Chaplin, Widow's Kiss, Star,
-- Blackthorn, Satan's Whiskers, Leap Year...) and the regional classics
-- (Sangria, Mulled Wine, Eggnog, Chilcano, Cantarito, Vampiro, Rebujito,
-- Bicicletta), plus one documented riff (Fairbanks Loan No. 2). Researched and
-- checked against the sources named in each drink's first record, 24 Oct 2026.
--
-- 1. The people who made them and the bars they were first made at get
--    public, unclaimed profiles where we had none (closed bars marked
--    closed), with positions linking the two. Professional facts only, in our
--    own words, no photos. Existing profiles are reused by handle.
-- 2. Each drink is a catalog classic with its year (approximate where the
--    sources only give a decade), family, what changed from its parent, and
--    its parent: another of these drinks, a classic already in the tree, or a
--    style. Champagne Cocktail, Planter's Punch and Eggnog were styles only;
--    each now has its drink under the style. The Baltimore and General
--    Harrison's nogs, Tom and Jerry and Coquito move under Eggnog. Credits
--    are 'suggested' until claimed; a disputed credit is left empty and the
--    story says so.
-- 3. House specs (proportions are facts). Every ingredient is one we have.
-- 4. One web source per drink as its first record in "From the books".
-- 5. Bars' drinks with one of these names (or a common spelling; not the
--    one-word ones like Star or Paradise, too common to be sure) become
--    versions of the classic (riff_of_id), so they rank in its list, and so do
--    named versions picked by hand (the sangrias, Clyde Common Eggnog, the
--    Cantaritos...). Same-name drinks that are something else are left alone,
--    and so are home drinks.
--
-- No paid AI: app.image_worker stops sketch jobs, and the flavour jobs these
-- inserts queue are removed at the end. No RLS or grant changes. Running it
-- again adds nothing.

SET "app.image_worker" = 'on';

CREATE TEMP TABLE "mc_jobs_before" AS SELECT "item_id" FROM "private"."item_flavor_jobs";

-- --- 1. Bars and people ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "locality", "address_line",
                                 "postcode", "city", "region", "country_code", "latitude", "longitude", "is_closed", "closed_year")
SELECT 'bar', v.handle, v.name, v.bio, v.website, true, v.locality, v.address_line, v.postcode, v.city, v.region, v.country_code,
       v.latitude::double precision, v.longitude::double precision, v.is_closed, v.closed_year::smallint
FROM (VALUES
    ('barlido.michelangelo', 'Bar Lido, SS Michelangelo', 'One of the seven bars on the Italian liner Michelangelo, which sailed between Genoa and New York from 1965 to 1975; the Barracuda was first served here.', NULL, NULL, NULL, NULL, 'Genoa', 'Liguria', 'IT', NULL, NULL, true, 1975),
    ('cloakroom.treviso', 'Cloakroom Cocktail Lab', 'Cocktail bar in the centre of Treviso run by Samuele Ambrosi, known for its large gin selection.', NULL, NULL, NULL, NULL, 'Treviso', 'Veneto', 'IT', NULL, NULL, false, NULL),
    ('fifty.london', 'Fifty', 'Private members'' club and casino at 50 St James''s Street, owned by Robert Earl, where Salvatore Calabrese ran the bar and created the Spicy Fifty.', NULL, 'St James''s', '50 St James''s Street', NULL, 'London', 'England', 'GB', 51.507387, -0.140579, true, 2009),
    ('holidayisle.islamorada', 'Tiki Bar at Holiday Isle', 'Open-air beachfront bar in the Florida Keys, opened in 1969 as the Hapi Hula Hut, which calls itself the home of the original Rum Runner.', NULL, NULL, NULL, NULL, 'Islamorada', 'Florida', 'US', NULL, NULL, false, NULL),
    ('hollandhouse.nyc', 'Holland House', 'A luxury hotel on Fifth Avenue at 30th Street in New York, opened in 1892, whose bar was run by George J. Kappeler. By the 1920s the building had become a commercial loft building.', NULL, 'NoMad', '274-276 Fifth Avenue', NULL, 'New York', 'NY', 'US', 40.7459, -73.9868, true, NULL),
    ('theinternational.philly', 'The International', 'A two level bar in Kensington, Philadelphia, opened in 2018 by the owners of Standard Tap and Johnny Brenda''s, with records on the turntable downstairs and a cocktail bar upstairs.', NULL, 'Kensington', '1624 North Front Street', NULL, 'Philadelphia', 'PA', 'US', NULL, NULL, false, NULL)
) AS v("handle", "name", "bio", "website", "locality", "address_line", "postcode", "city", "region", "country_code", "latitude", "longitude", "is_closed", "closed_year")
WHERE NOT EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.handle = v.handle);

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "city")
SELECT 'person', v.handle, v.name, v.bio, v.website, true, v.city
FROM (VALUES
    ('benito.cuppari', 'Benito Cuppari', 'Genoese bartender who worked the bars of the Italian liners Cristoforo Colombo and Michelangelo, where he created the Barracuda in 1965; it won the long drink category at the 1966 AIBES national competition. He later opened the Shaker Club in Genoa.', NULL, 'Genoa'),
    ('brian.kane', 'Brian Kane', 'Philadelphia bartender who created the Fairbanks Loan No. 2, a take on the Douglas Fairbanks, while at The International.', NULL, 'Philadelphia'),
    ('george.kappeler', 'George J. Kappeler', 'Head barkeeper at the Holland House hotel in New York and author of Modern American Drinks (1895), one of the best regarded early bartenders'' guides and the first to print the Widow''s Kiss.', NULL, 'New York'),
    ('jimmy.obrien', 'Jimmy O''Brien', 'New York bartender, called the head inventor of drinks at a Columbus Avenue restaurant, credited in a 1901 newspaper story with creating the Floradora for a member of the Florodora Sextette.', NULL, 'New York'),
    ('john.elber', 'John Elber', 'Manager of the Tiki Bar at the Holiday Isle resort in Islamorada, Florida, known as Tiki John, credited by the bar with creating the Rum Runner in the early 1970s.', NULL, 'Islamorada'),
    ('oscar.hernandez', 'Oscar Hernández', 'Drinks and fruit vendor in San Luis Soyatlán, on Lake Chapala in Jalisco, who says he invented the Vampiro in the early 1980s and still sells it there in plastic bags with a straw.', NULL, 'San Luis Soyatlán'),
    ('samuele.ambrosi', 'Samuele Ambrosi', 'Italian bartender from the Veneto, credited with the Illegal, created in the late 1990s at the Castel Brando hotel; owner of Cloakroom Cocktail Lab in Treviso and co-creator of the IBA''s VE.N.TO.', NULL, 'Treviso')
) AS v("handle", "name", "bio", "website", "city")
WHERE NOT EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.handle = v.handle);

INSERT INTO "public"."profile_positions" ("person_profile_id", "bar_profile_id", "title", "is_current", "source_url")
SELECT pp.id, bp.id, v.title, v.is_current, v.source_url
FROM (VALUES
    ('benito.cuppari', 'barlido.michelangelo', 'Bartender', false, 'https://www.diffordsguide.com/encyclopedia/3276/people/benito-cuppari'),
    ('brian.kane', 'theinternational.philly', 'Bartender', false, 'https://punchdrink.com/recipes/fairbanks-loan-2/'),
    ('george.kappeler', 'hollandhouse.nyc', 'Head Bartender', false, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-1401'),
    ('john.elber', 'holidayisle.islamorada', 'Bar manager', false, 'https://www.alcoholprofessor.com/blog-posts/rum-runner-history'),
    ('salvatore.calabrese', 'fifty.london', 'Head bartender', false, 'https://www.thecaterer.com/news/pub-bar/salvatore-calabrese-at-fifty'),
    ('samuele.ambrosi', 'cloakroom.treviso', 'Owner', true, 'https://wineandtravelitaly.com/?p=9879')
) AS v("person", "bar", "title", "is_current", "source_url")
JOIN "public"."profiles" pp ON pp.handle = v.person AND pp.kind = 'person'
JOIN "public"."profiles" bp ON bp.handle = v.bar AND bp.kind = 'bar'
ON CONFLICT ("person_profile_id", "bar_profile_id", "title") DO NOTHING;

-- --- 2. The drinks ---

CREATE TEMP TABLE "mc_drinks" ("key" text PRIMARY KEY, "name" text NOT NULL, "year" int, "approx" boolean, "family" text, "parent_kind" text, "parent" text,
    "note" text, "creator" text, "co" text[], "bar" text, "src" text, "description" text, "notes" text, "glass" text, "ice" text, "method" text, "origin" text, "item_id" uuid);
INSERT INTO "mc_drinks" ("key", "name", "year", "approx", "family", "parent_kind", "parent", "note", "creator", "co", "bar", "src", "description", "notes", "glass", "ice", "method", "origin") VALUES
    ('champagne-cocktail-drink', 'Champagne Cocktail', 1862, false, 'highball', 'style', 'champagne-cocktail', 'The first printed recipe: sugar, bitters and lemon peel with sparkling wine', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Champagne_cocktail', 'A sugar cube soaked in bitters at the bottom of a flute, topped with cold Champagne and a lemon twist.', 'Champagne Cocktails were already being drunk in the 1850s, but the first printed recipe is in Jerry Thomas''s 1862 bar guide; the credit is for print only. That version had sugar, bitters, lemon peel, broken ice and wine, and told the bartender to shake it, which later editions dropped in favour of a lump of sugar, Angostura and a gentle stir. The splash of brandy many bars add came later, often credited to John Dougherty winning a New York cocktail contest in 1889, though that story is not well documented.

Method: Soak the sugar cube with the bitters in a chilled flute, fill slowly with cold Champagne and finish with a lemon twist.', 'Flute', NULL, 'Build', 'Classic'),
    ('planters-punch-drink', 'Planter''s Punch', 1908, false, 'tiki', 'style', 'planters-punch', 'The Jamaican punch made one glass at a time, with lime', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Planter%27s_punch', 'Jamaican rum, lime and sugar swizzled over crushed ice in a tall glass with bitters and nutmeg.', 'Planter''s Punch comes from Jamaica, where the old rhyme ''one of sour, two of sweet, three of strong, four of weak'' set the proportions. A rhymed bowl recipe was printed in London in 1878, and by about 1900 it had become a single drink swizzled over crushed ice in a tall tumbler, the way visitors to Kingston knew it. The first printed single recipe with lime appeared in the New York Times in 1908. Myers''s Rum did much to spread it from 1924 on. The often repeated story that it was invented at the Planters Hotel in Charleston has no evidence behind it. After the Second World War the name drifted to almost any rum and fruit juice drink sweetened with grenadine.

Method: Build the rum, lime and syrup over crushed ice in a tall glass, swizzle until frosted, dash bitters on top and grate nutmeg over.', 'Collins', 'Crushed', 'Swizzle', 'Classic'),
    ('mary-pickford', 'Mary Pickford', 1926, false, 'sour', 'style', 'sour', 'Pineapple juice in place of citrus, sweetened with maraschino and grenadine', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Mary_Pickford_(cocktail)', 'White rum shaken with pineapple juice, a little maraschino and grenadine, served up.', 'A Prohibition era Havana drink named for the silent film star. The story that it was made for her on a trip to Havana with Douglas Fairbanks and Charlie Chaplin does not hold up: no such trip is on record. A Mary Pickford was being served at the Sevilla hotel by 1926, and a 1928 Havana drinks book credits Fred Kaufman, a bartender there; later accounts credit Eddie Woelke instead, and the Hotel Nacional is sometimes named though it opened only in 1930. The credit is disputed, so none is set here. Early versions varied (one 1924 Cuban recipe used gin, a 1927 one added egg white) before rum, pineapple, maraschino and grenadine settled as the standard.

Method: Shake everything hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('douglas-fairbanks', 'Douglas Fairbanks', 1931, true, 'sour', 'tree', 'Gin Sour', 'Apricot brandy in place of sugar, with egg white', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/douglas-fairbanks-daiquiri-cocktail-recipe-cuba/', 'Gin, apricot brandy, lemon and egg white shaken to a foam and served up.', 'A Prohibition era Havana drink named for the film star, best known from the seasonal cocktail manuals printed by Sloppy Joe''s bar in Havana in the early 1930s; a close recipe is also in a 1930 London book. Where and when it was first made is not documented, and Fairbanks himself did not drink. It should not be confused with the older Fairbanks cocktail, a gin and dry vermouth drink with crème de noyaux named for Vice President Charles W. Fairbanks around 1907. The egg white is often left out.

Method: Dry shake everything, shake again with ice and strain into a chilled coupe.', 'Coupe', NULL, 'dry shake and shake', 'Classic'),
    ('fairbanks-loan-no-2', 'Fairbanks Loan No. 2', 2019, true, 'sour', 'new', 'douglas-fairbanks', 'Gin and pineapple rum split base, an aperitif blend in place of apricot, no egg', 'brian.kane', ARRAY[]::text[], 'theinternational.philly', 'https://punchdrink.com/recipes/fairbanks-loan-2/', 'Gin and pineapple rum shaken with lemon, lime, honey and a Lillet, Cynar and Campari blend, served up.', 'Brian Kane''s loose take on the Douglas Fairbanks, made at The International in Philadelphia and written up in 2019. He splits the base between gin and a pineapple rum, a nod to the fruit brandy in the original, swaps the apricot for a small measure of Lillet, Cynar and Campari, sweetens with honey and drops the egg white. He described the result as close to a souped up Daiquiri.

Method: Stir the Lillet, Cynar and Campari together first (4:2:1), then shake half an ounce of it with the other ingredients and strain into a chilled coupe with a lemon twist.', 'Coupe', NULL, 'Shake', 'Modern Classic'),
    ('charlie-chaplin', 'Charlie Chaplin', 1915, true, 'sour', 'style', 'sour', 'Equal parts sloe gin, apricot brandy and lime', NULL, ARRAY[]::text[], 'waldorfastoria.1893', 'https://www.diffordsguide.com/cocktails/recipe/2914/charlie-chaplin', 'Equal parts sloe gin, apricot brandy and fresh lime, shaken and served up.', 'A drink from the bar of the old Waldorf-Astoria in New York, named for Charlie Chaplin in the early years of his film fame and before Prohibition closed the bar in 1920. It was written down in the 1935 Waldorf-Astoria bar book, which kept the old hotel''s recipes, and revived in its 2016 successor, which swapped apricot brandy for the easier to find apricot liqueur. Some modern bars use lemon in place of lime. No bartender is named.

Method: Shake everything hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('angel-face', 'Angel Face', 1930, false, 'flip', 'style', 'duo', 'A trio of gin, apricot brandy and Calvados in equal parts', 'harry.craddock', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Angel_Face_(cocktail)', 'Equal parts gin, apricot brandy and Calvados, shaken cold and served up.', 'The Angel Face first appears in Harry Craddock''s Savoy Cocktail Book of 1930; the credit is for print only, and who first mixed it is not known. It is three spirits and liqueurs in equal measure with no citrus, the apricot softening the gin and apple brandy. It is on the IBA list of Unforgettables.

Method: Shake the three with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('paradise', 'Paradise', 1922, false, 'sour', 'style', 'sour', 'Orange juice and apricot brandy as the sour and sweet', 'harry.macelhone', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Paradise_(cocktail)', 'Gin shaken with apricot brandy, orange juice and a little lemon, served up.', 'The Paradise was first printed by Harry MacElhone in his 1922 ABC of Mixing Cocktails, written while he worked at Ciro''s in London; the credit is for print only. Harry Craddock''s 1930 Savoy Cocktail Book fixed the version most bars follow, roughly two parts gin to one each of apricot brandy and orange juice with a splash of lemon. It is on the IBA list of Unforgettables.

Method: Shake everything hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('periodista', 'Periodista', 1948, false, 'sour', 'tree', 'Daiquiri', 'Apricot brandy and orange curaçao added', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/1510/periodista-daiquiri', 'White rum shaken with lime, apricot brandy and orange liqueur, served up.', 'A Havana drink whose name means ''journalist''. Its earliest known recipe is in the 1948 manual of Cuba''s bartenders'' club, a Daiquiri with a quarter measure each of apricot brandy and curaçao; who made it first is not known, and the usual tale that Hemingway drank it at El Floridita is unproven. It faded, then came back in Boston bars in the 2000s, where it is often made with dark rum and equal measures of the two liqueurs.

Method: Shake everything hard with ice, strain into a chilled coupe and finish with a lime twist.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('floradora', 'Floradora', 1901, false, 'highball', 'style', 'buck', 'Gin buck with lime and raspberry', 'jimmy.obrien', ARRAY[]::text[], NULL, 'https://classbarmag.com/news/fullstory.php/aid/524/Florodora_-_the_tale_of_the_tribute_cocktail_that_outlived_its_inspiration.html', 'Gin, lime and raspberry syrup shaken and lengthened with ginger ale over ice.', 'Named for the Broadway musical Florodora and its famous Sextette, which arrived in New York from London in 1900. In 1901 a New York newspaper told how it was made for one of the Sextette who wanted something brand new, at an after-show party in a Columbus Avenue restaurant, by a bartender named Jimmy O''Brien: raspberry syrup, a whole lime, Plymouth gin and ginger ale over crushed ice. By 1913 it was in print as the Floradora Cooler, and the misspelled name stuck. Bars now use ginger ale or ginger beer.

Method: Shake the gin, lime and raspberry syrup with ice, strain into an ice filled Collins glass and top with ginger ale.', 'Collins', 'Cubes', 'shake and top', 'Classic'),
    ('twelve-mile-limit', 'Twelve Mile Limit', 1924, true, 'sour', 'style', 'sour', 'Rum, rye and brandy together, sweetened with grenadine', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/13849/twelve-mile-limit', 'White rum, rye and brandy shaken with lemon and grenadine, served up.', 'A Prohibition joke in a glass: in April 1924 the line beyond which American law could not reach rum ships moved from three miles offshore to twelve, and the party boats moved with it. The drink builds on the older Three Miller (rum, brandy, lemon, grenadine) by adding rye, a stronger pour for a longer trip. Who first mixed it, and where, is not recorded.

Method: Shake everything hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('widows-kiss', 'Widow''s Kiss', 1895, false, 'oldfashioned', 'style', 'cocktail', 'Apple brandy sweetened with Bénédictine and yellow Chartreuse instead of sugar', 'george.kappeler', ARRAY[]::text[], 'hollandhouse.nyc', 'https://www.gutenberg.org/ebooks/61065', 'Apple brandy stirred with Bénédictine, yellow Chartreuse and Angostura, served up.', 'The Widow''s Kiss was first printed in George J. Kappeler''s Modern American Drinks (New York, 1895), written while he was head barkeeper at the Holland House hotel on Fifth Avenue, and it is usually credited to him there. The book is the only evidence for that credit; nothing else is known about how the drink was made or named. Kappeler''s recipe is one pony of apple brandy with half a pony each of yellow Chartreuse and Bénédictine and two dashes of Angostura, shaken. The Savoy Cocktail Book (1930) printed the same drink with Calvados. Two herbal liqueurs do the work of the sugar in an old-style cocktail, so it drinks rich and honeyed with a dry apple finish.

Method: Stir the apple brandy, Bénédictine, Chartreuse and bitters with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('star', 'Star', 1895, false, 'martini', 'tree', 'Manhattan', 'Apple brandy in place of whiskey, equal parts with Italian vermouth', NULL, ARRAY[]::text[], NULL, 'https://www.gutenberg.org/ebooks/61065', 'Apple brandy and sweet vermouth in equal parts, stirred with bitters and a touch of syrup and finished with lemon peel.', 'A Star cocktail of applejack and vermouth was already being talked about in New York in 1893, when a Cleveland paper listed it among the newer drinks in a story about the Manhattan Club, though that version also had yellow Chartreuse and cherry bounce. The first printed recipe is in George J. Kappeler''s Modern American Drinks (1895): half a jigger each of apple brandy and Italian vermouth with two dashes of gum syrup and three of Peychaud''s or Angostura bitters, stirred, with lemon peel. The Savoy Cocktail Book (1930) kept the equal parts with Calvados or applejack. It is in effect an apple brandy Manhattan made with a full share of vermouth.

Method: Stir the apple brandy, vermouth, syrup and bitters with ice, strain into a chilled coupe and twist lemon peel over the top.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('blackthorn', 'Blackthorn', 1900, false, 'martini', 'tree', 'Manhattan', 'Irish whiskey and dry vermouth in equal parts, with absinthe and bitters', 'harry.johnson', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Blackthorn_(cocktail)', 'Irish whiskey and dry vermouth in equal parts, stirred with dashes of absinthe and bitters and finished with lemon peel.', 'The first cocktail printed under the name is Harry Johnson''s Black Thorn, in the 1900 edition of his Bartender''s Manual: equal parts Irish whiskey and French vermouth with a few dashes each of absinthe and Boker''s bitters, stirred. It is not in his 1888 edition, so it likely dates from the 1890s; the credit is for print only. Robert Vermeire printed it in the 1920s with the recipe credited to Johnson, and the Savoy Cocktail Book (1930) kept it as its Blackthorn.

A second Blackthorn, named for the sloe (the blackthorn''s fruit), is made with sloe gin and vermouth. Sloe gin drinks under the name appear from 1900, and a sloe gin and vermouth version was printed by 1906; Vermeire gave it as the other way to make the drink, credited to Cocktail Boothby, and the Savoy listed it as Blackthorn No. 2. Today bars write the whiskey one as Blackthorn or Irish Blackthorn, and many modern versions use sweet vermouth.

Method: Stir the whiskey, vermouth, absinthe and bitters with ice, strain into a chilled coupe and twist lemon peel over the top.', 'Coupe', NULL, 'Stir', 'Classic'),
    ('algonquin', 'Algonquin', 1935, false, 'martini', 'tree', 'Manhattan', 'Dry vermouth and pineapple juice with rye, shaken', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/algonquin/', 'Rye whiskey shaken with dry vermouth and pineapple juice, served up.', 'The Algonquin is named for the Algonquin Hotel on West 44th Street in New York, home of the Round Table of writers and wits in the 1920s, though the hotel was dry and no document ties the drink to the group. It first appears in print in Gustav Selmer Fougner''s 1935 book Along the Wine Trail as the New Algonquin: two parts rye, one part French vermouth and one part pineapple juice. Unrelated drinks later took the name, among them a 1941 Algonquin Special of sherry and port and a rum Algonquin printed by Ted Saucier. The hotel''s own bar serves the rye version.

Method: Shake the rye, vermouth and pineapple juice hard with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('satans-whiskers', 'Satan''s Whiskers', 1930, false, 'martini', 'tree', 'Bronx', 'Add orange liqueur and orange bitters to the Bronx', NULL, ARRAY[]::text[], NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-410', 'Gin, sweet and dry vermouth and orange juice in equal parts with Grand Marnier and orange bitters, shaken and served up.', 'Satan''s Whiskers first appears in the Savoy Cocktail Book (1930), which gives no source for it. It is a Bronx made richer with orange liqueur: two parts each of Italian vermouth, French vermouth, gin and orange juice, one part Grand Marnier and a dash of orange bitters. The book calls that the Straight; swap the Grand Marnier for orange curaçao and it is Curled. Both reached America within months of Repeal, fell away after the Second World War, and were revived as lost classics around 2000. Some accounts tie it to the Embassy Club in Prohibition Hollywood, though no document proves it.

Method: Shake everything with ice, strain into a chilled coupe and garnish with orange peel.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('income-tax', 'Income Tax', 1930, false, 'martini', 'tree', 'Bronx', 'Add Angostura bitters to the Bronx', NULL, ARRAY[]::text[], NULL, 'https://cold-glass.com/2013/04/12/feeling-bitter-in-the-bronx-the-income-tax-cocktail', 'Gin shaken with sweet and dry vermouth, orange juice and Angostura bitters, served up.', 'The Income Tax is a Bronx with bitters. Its earliest known recipe is in the Savoy Cocktail Book (1930): about half gin, the rest split between French and Italian vermouth, the juice of a quarter orange and a dash or two of Angostura. Who first added the bitters, and who gave it the name, is not recorded. The bitters dry out the Bronx and give it more backbone.

Method: Shake everything with ice, strain into a chilled coupe and garnish with orange peel.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('abbey', 'Abbey', 1930, false, 'martini', 'style', 'vermouth-cocktail', 'Gin with Kina Lillet and orange juice and a dash of Angostura', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/3/abbey', 'Gin shaken with Lillet, orange juice and a dash of Angostura bitters, served up.', 'The Abbey is the first cocktail in the Savoy Cocktail Book (1930), which gives it as half dry gin, a quarter Kina Lillet, a quarter orange juice and a dash of Angostura, shaken. It was repeated in the Café Royal Cocktail Book (1937), and nothing earlier is known. Kina Lillet carried more quinine bitterness than today''s Lillet Blanc, so many bars use Cocchi Americano to get closer to the original.

Method: Shake everything with ice, strain into a chilled coupe and express lemon or orange peel over the top.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('leap-year', 'Leap Year', 1928, false, 'martini', 'tree', 'Martini', 'Gin and Italian vermouth with Grand Marnier and a dash of lemon', 'harry.craddock', ARRAY[]::text[], 'americanbarsavoy', 'https://archive.org/details/savoycocktailboo0000vari', 'Gin shaken with Grand Marnier, sweet vermouth and a dash of lemon, served up with lemon peel.', 'Harry Craddock created the Leap Year for the leap day celebrations at the Savoy Hotel in London on 29 February 1928, and printed it in his Savoy Cocktail Book (1930): two thirds gin, a sixth each of Grand Marnier and Italian vermouth, and a dash of lemon juice, with lemon peel squeezed on top. The book claims it was responsible for more proposals than any other cocktail, a line written to sell it. It drinks like a sweet Martini brightened with orange.

Method: Shake everything with ice, strain into a chilled coupe and squeeze lemon peel over the top.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('journalist', 'Journalist', 1930, false, 'martini', 'tree', 'Perfect Martini', 'Add a little curaçao, lemon juice and Angostura', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/1072/journalist', 'Gin with equal parts sweet and dry vermouth, a little curaçao and lemon and a dash of Angostura, shaken and served up.', 'The Journalist first appears in the Savoy Cocktail Book (1930); who made it is not known. It is a Perfect Martini (gin with both French and Italian vermouth) sharpened with small measures of lemon juice and orange curaçao and a dash of Angostura, shaken. Fresh vermouth matters, since it carries most of the flavour.

Method: Shake everything with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('orange-blossom', 'Orange Blossom', 1922, true, 'martini', 'tree', 'Bronx', 'Drop the vermouths: gin and orange juice in equal parts', NULL, ARRAY[]::text[], NULL, 'https://archive.org/details/cocktails_202208', 'Gin and fresh orange juice in equal parts, shaken with a dash of orange bitters and served up.', 'The Orange Blossom is gin and orange juice, a Prohibition favourite because the juice hid the taste of bad gin. Robert Vermeire printed it in Cocktails: How to Mix Them (first published in London in 1922) as a quarter gill each of gin and orange juice with a dash of orange bitters and grenadine if wanted sweet, crediting the recipe to Malloy of Pittsburg. The Savoy Cocktail Book (1930) made it half orange juice, half dry gin. It sits with the Bronx, which became a juicier drink of the same kind once the orange took over from the vermouth.

Method: Shake the gin, orange juice and bitters with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('absinthe-suissesse', 'Absinthe Suissesse', 1904, false, 'oldfashioned', 'tree', 'Absinthe Frappe', 'Shaken with egg white, orgeat and cream', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/absinthe-suissesse-cocktail-new-orleans/', 'Absinthe shaken with orgeat, egg white and cream into a frothy, pale green drink.', 'The Suissesse began in Europe, not New Orleans. The first known recipe is in Frank P. Newman''s American-Bar (Paris, 1904): absinthe shaken with egg white, sugar and a few drops of grenadine, topped with soda. Orgeat appears in a German recipe around 1910, and the Savoy Cocktail Book (1930) gives a Suisse of absinthe, anisette and egg white. Stanley Clisby Arthur''s Famous New Orleans Drinks (1937) recorded a New Orleans version with French vermouth, egg white and a float of crème de menthe. The city took it up as a brunch drink, and the version made there today is absinthe or Herbsaint with orgeat, egg white and cream, a cousin of the Absinthe Frappé, the Grasshopper and the Ramos Gin Fizz.

Method: Dry shake everything to whip the egg white, shake again with ice and strain into a chilled coupe.', 'Coupe', NULL, 'dry shake and shake', 'Classic'),
    ('french-martini', 'French Martini', 1988, true, 'martini', 'tree', 'Vodka Martini', 'Raspberry liqueur and pineapple juice in place of vermouth, shaken', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/French_martini', 'Vodka shaken with black raspberry liqueur and pineapple juice until it foams, served up.', 'The French Martini came out of New York in the late 1980s, when almost any drink in a V-shaped glass was sold as a martini. It is tied to Keith McNally''s bars: it was on the menu at Pravda in 1996 and became a hit at Balthazar in SoHo soon after (some accounts say 1997). Some tellings credit Dale DeGroff with the original, but no record settles who first made it. It holds no vermouth; the French in the name is the raspberry liqueur. By 1997 it had reached London, where it spread through the Met Bar and Dick Bradsell''s bars. Balthazar''s own version uses crème de cassis in place of raspberry liqueur.

Method: Shake the vodka, raspberry liqueur and pineapple juice hard with ice and fine strain into a chilled glass. Express a lemon peel over the top.', 'Martini', NULL, 'Shake', 'Modern Classic'),
    ('sex-on-the-beach', 'Sex on the Beach', 1982, true, 'highball', 'tree', 'Cape Codder', 'Peach schnapps and orange juice added to the vodka and cranberry', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Sex_on_the_Beach', 'Vodka and peach schnapps built over ice with orange and cranberry juice.', 'The usual story puts the Sex on the Beach in Fort Lauderdale in 1987: a young bartender named Ted Pizio at a bar called Confetti mixed it for a spring break contest that rewarded whoever sold the most of a new peach schnapps, and named it for the two things he thought brought tourists to Florida. A recipe under the same name, with peach schnapps, was already in print in a 1982 bartending school guide, so the Fort Lauderdale credit is tradition rather than proven. It reads as a Fuzzy Navel (peach schnapps and orange) poured into a Cape Codder (vodka and cranberry). Early versions used grenadine where cranberry is now standard.

Method: Build everything in a highball glass full of ice, stir gently and garnish with an orange slice.', 'Highball', 'Cubes', 'Build', 'Modern Classic'),
    ('russian-spring-punch', 'Russian Spring Punch', 1985, true, 'highball', 'tree', 'Kir Royale', 'Vodka and lemon added and served long over ice', 'dick.bradsell', ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/1720/russian-spring-punch', 'Vodka, lemon, sugar and crème de cassis shaken and topped with Champagne over ice.', 'Dick Bradsell made the Russian Spring Punch in London in the 1980s, for friends throwing a cocktail party on a small budget: guests brought a bottle of sparkling wine, and each glass got a shot of vodka with lemon, sugar and cassis over ice, topped with their wine. He later described it as a spiked Kir Royale over ice, built on the old punch formula with Champagne in place of the water. He named it for the vodka (Russian) and for being a long, Collins-style drink, which he thought of as a spring drink. He was not sure whether he was working at Zanzibar or Fred''s at the time.

Method: Shake the vodka, lemon, cassis and syrup with ice, strain into an ice-filled Collins glass and top with Champagne. Garnish with berries and a lemon wheel.', 'Collins', 'Cubes', 'shake and top', 'Modern Classic'),
    ('spicy-fifty', 'Spicy Fifty', 2005, true, 'sour', 'style', 'sour', 'Vanilla vodka sour sweetened with elderflower and honey, with fresh red chilli', 'salvatore.calabrese', ARRAY[]::text[], 'fifty.london', 'https://en.wikipedia.org/wiki/Spicy_Fifty', 'Vanilla vodka shaken with elderflower cordial, lime, honey and fresh red chilli, served up.', 'Salvatore Calabrese created the Spicy Fifty as the signature drink for the first menu of his bar at Fifty, a private members'' club and casino on St James''s Street in London, around 2004 to 2005. It is a vodka sour built on vanilla vodka, sweetened with elderflower cordial and honey and warmed with a couple of slices of red chilli. The club closed in 2009, but the drink outlived it, and the IBA added it to its official list in 2020.

Method: Shake everything hard with ice, double strain into a chilled glass and garnish with a red chilli.', 'Martini', NULL, 'Shake', 'Modern Classic'),
    ('illegal', 'Illegal', 1998, true, 'sour', 'style', 'sour', 'Mezcal and overproof rum sour spiced with falernum and maraschino', 'samuele.ambrosi', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Illegal_(cocktail)', 'Mezcal and overproof white rum shaken with falernum, maraschino, lime and sugar.', 'The Illegal is credited to the Italian bartender Samuele Ambrosi, who first made it in the late 1990s while working at the Castel Brando hotel in Cison di Valmarino, in the Veneto, and later reworked it at Dom''us in Oderzo, swapping the original tequila for mezcal. The story goes that an American guest said it was so good it must be illegal. It is a mezcal sour with a Caribbean side: overproof white rum, falernum and a spoon of maraschino. The IBA added it to its official list in 2020 with the modern mezcal recipe. It is often served in a clay mug.

Method: Shake everything hard with ice and strain into a chilled coupe, or over ice in a clay mug.', 'Coupe', NULL, 'Shake', 'Modern Classic'),
    ('barracuda', 'Barracuda', 1965, false, 'tiki', 'style', 'tiki', 'Gold rum, Galliano and pineapple shaken short and topped with prosecco', 'benito.cuppari', ARRAY[]::text[], 'barlido.michelangelo', 'https://www.diffordsguide.com/encyclopedia/3276/people/benito-cuppari', 'Gold rum, Galliano, pineapple and a little lime shaken and topped with prosecco.', 'The Barracuda was made by the Genoese bartender Benito Cuppari. He worked out an early pineapple, rum and Galliano drink in the late 1950s aboard the liner Cristoforo Colombo, then settled the recipe in 1965 at the Bar Lido on the new liner Michelangelo, sailing between Genoa and New York. He named it after the Barracuda nightclub on the Ligurian coast, run by a friend. It won the long drink category at the 1966 Italian bartenders'' (AIBES) national competition, was first served in half a pineapple and later in a ceramic pineapple that Galliano promoted. The IBA lists it among its New Era drinks.

Method: Shake the rum, Galliano, pineapple and lime with ice, strain into a chilled glass and top with prosecco. Garnish with a pineapple wedge.', 'Coupe', NULL, 'shake and top', 'Classic'),
    ('yellow-bird', 'Yellow Bird', 1972, true, 'sidecar', 'style', 'daisy', 'Rum daisy with Galliano beside the orange liqueur', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Yellow_bird_(cocktail)', 'White rum shaken with Galliano, triple sec and lime, served up.', 'Nobody knows who made the Yellow Bird. The name is usually tied to the Haitian song of that name, rewritten in English in 1957 and a top-five hit for Arthur Lyman in Hawaii in 1961, and one theory places the drink at the Shell Bar in the Hilton Hawaiian Village, where that record played every week. Others say the name is just the colour that Galliano gives it. The earliest print found so far is a 1972 Galliano advertising insert in a Florida newspaper, with no creator named, so the drink is likely older than its first known print. It is a rum daisy with Galliano alongside the orange liqueur.

Method: Shake everything with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake', 'Classic'),
    ('rum-runner', 'Rum Runner', 1972, true, 'tiki', 'style', 'tiki', 'Rum with banana and blackberry liqueurs, fruit juice and grenadine, made to use up overstock', 'john.elber', ARRAY[]::text[], 'holidayisle.islamorada', 'https://lodgingmagazine.com/holiday-isle-tiki-bar-reopens/', 'Rum shaken with banana and blackberry liqueurs, pineapple, orange, lime and grenadine, over crushed ice.', 'The Rum Runner comes from the Tiki Bar at the Holiday Isle resort in Islamorada, in the Florida Keys, which opened in 1969 as the Hapi Hula Hut. The bar''s own story says that in the early 1970s (1972 in one telling) its manager, John Elber, known as Tiki John, was told to make a drink from the bottles crowding the storeroom: rum, banana liqueur, blackberry brandy and grenadine, with the grenadine added to give it a pink colour. He named it for the smugglers who ran liquor through the Keys during Prohibition. The bar still serves it, shaken and frozen. Recipes vary widely; most add pineapple or orange juice and lime.

Method: Shake everything with ice and strain over crushed ice in a tall glass. Garnish with a pineapple wedge and a cherry.', 'Collins', 'Crushed', 'Shake', 'Classic'),
    ('whisky-mac', 'Whisky Mac', 1899, true, 'flip', 'style', 'duo', 'Scotch with green ginger wine, no bitters or sugar', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Whisky_Mac', 'Blended Scotch and green ginger wine, roughly three to two, served short.', 'The Whisky Mac, short for Whisky Macdonald, is a two-part drink of Scotch and green ginger wine. Tradition credits Major General Sir Hector MacDonald, who is said to have first mixed it in India around 1899, when ginger wine was drunk as a guard against cholera. No document proves it, and the usual telling mixes him up with a different MacDonald. In Britain it became a cold-weather drink, sometimes called the golfer''s favourite, and a hot version adds boiling water like a toddy. Equal parts is the old serve; most bars now use more whisky than wine.

Method: Pour the Scotch and ginger wine into a rocks glass and stir. Add ice if you like.', 'Rocks', NULL, 'Build', 'Classic'),
    ('sangria', 'Sangria', 1800, true, 'oldfashioned', 'tree', 'Sangaree', 'Wine with chopped fruit, brandy and sugar, made by the pitcher', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Sangria', 'Red wine with brandy, orange liqueur, orange juice and chopped fruit, left to steep and poured over ice.', 'Sangria grew out of Spain''s old habit of mixing wine with fruit and sugar; a wine lemonade from the medieval Kingdom of León is the usual precursor. The name, from the Spanish for bloodletting, can be traced to the 18th century, and the drink has been enjoyed since at least the early 19th century, so the year here is approximate. Sangaree, its older Caribbean cousin, was the form Americans knew until it faded in the early 20th century. Spanish restaurants brought sangria back to the United States as an iced drink by the late 1940s, and the 1964 World''s Fair in New York made it widely popular. Recipes vary wildly even within Spain; red wine is the constant, with fruit, sugar and often a splash of brandy.

Method: Build the wine, brandy, liqueur, juice and syrup over chopped fruit, stir and rest it in the fridge for a few hours. Pour over ice into a wine glass, with some of the fruit.', 'Wine', 'Cubes', 'Build', 'Classic'),
    ('mulled-wine', 'Mulled Wine', 1600, true, 'oldfashioned', 'style', 'punch', 'Red wine heated with sugar, citrus and warm spices; recorded from 1390, placed at the start of the timeline', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Mulled_wine', 'Red wine warmed gently with sugar, orange, cinnamon, clove and star anise, with a splash of brandy, served hot in a mug.', 'Heated, spiced wine is far older than any cocktail: the first record of wine being spiced and heated is in a Roman play by Plautus from the 2nd century BC, and a medieval English cookery book of about 1390 gives a recipe for ypocras, spices mixed with red wine and sugar. The year here follows that English recipe and is approximate. German Glühwein, Scandinavian glögg and French vin chaud are the same idea, and it is still the drink of winter markets. There is no fixed recipe; spices are often simmered in a sugar syrup before the wine goes in, and the wine is warmed, never boiled.

Method: Warm the wine, syrup, orange and spices in a pan until steaming but not boiling, add the brandy and pour into a heated mug.', 'Mug', NULL, 'Build', 'Classic'),
    ('eggnog', 'Eggnog', 1775, false, 'flip', 'style', 'nog', 'The plain nog: spirit, whole egg, sugar, milk and cream', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Eggnog', 'Cognac and aged rum shaken hard with a whole egg, sugar, milk and cream, served cold under grated nutmeg.', 'Eggnog descends from posset, the hot spiced milk drink of medieval Britain, but it took its name and shape in colonial America. The word first appears in a 1775 poem by the Maryland clergyman Jonathan Boucher, published long after his death, and first reached print in the New-Jersey Journal in 1788. By 1800 travellers described it as new milk, eggs, rum and sugar. It became the American Christmas drink: in 1826 smuggled whiskey for the West Point Christmas nog set off the Eggnog Riot. George Washington''s own rye, rum and sherry version is often told, though it carries no date. Rum, brandy, whiskey or a mix are all traditional.

Method: Shake everything except the nutmeg very hard with ice, strain into a chilled glass and grate nutmeg over the top.', 'Small Rocks', NULL, 'Shake', 'Classic'),
    ('chilcano', 'Chilcano', 1900, true, 'highball', 'style', 'buck', 'Pisco buck with lime and a few drops of bitters', NULL, ARRAY[]::text[], NULL, 'https://es.wikipedia.org/wiki/Chilcano_(bebida)', 'Peruvian pisco over ice with fresh lime and a few drops of Angostura, topped with ginger ale.', 'The Chilcano is Peru''s everyday pisco highball. Its earliest references are from the start of the 20th century: a Lima chronicle describing a party around 1900 mentions it, and ties it to the Buon Giorno, a grappa, ginger ale and lime mix drunk by Italian immigrants. The usual story is that Italian-run corner shops in Lima swapped in pisco when grappa ran short, though no one knows the exact date and the year here is approximate. It lost ground in the early 20th century and came back in the 1950s; since 2010 Peru has held a Chilcano Week every January. The name is often linked to chilcano, a fish broth eaten as a hangover cure.

Method: Build the pisco, lime and bitters over ice in a highball, top with ginger ale and stir once.', 'Highball', 'Cubes', 'Build', 'Classic'),
    ('cantarito', 'Cantarito', NULL, true, 'highball', 'style', 'highball', 'Tequila with three citrus juices and grapefruit soda in a clay cup', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Cantarito', 'Tequila with orange, grapefruit and lime juice and a pinch of salt, topped with grapefruit soda over ice in a clay cup.', 'The Cantarito is the roadside drink of Jalisco''s tequila country, served in the bars and stands around the town of Tequila in a squat clay cup, the cantarito, that keeps it cold. Its origins are unclear and no one knows who first made it or when; some place it in the early 20th century, but no record supports that. The firmest date is 1997, when Cantaritos El Güero opened in Amatitán as a bar serving nothing else. It is close kin to the Paloma, with fresh orange, grapefruit and lime squeezed in and a pinch of salt.

Method: Shake the tequila, juices and salt with ice, pour into an ice-filled clay cup or highball and top with grapefruit soda.', 'Highball', 'Cubes', 'shake and top', 'Classic'),
    ('vampiro', 'Vampiro', 1980, true, 'highball', 'style', 'highball', 'Tequila and grapefruit soda reddened with sangrita, orange, lime and salt', 'oscar.hernandez', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Vampiro_(cocktail)', 'Blanco tequila with orange and lime juice, a shot of sangrita and a pinch of salt, topped with grapefruit soda over ice in a salt-rimmed glass.', 'The Vampiro comes from San Luis Soyatlán, a village on the highway along Lake Chapala in Jalisco. The fruit-stand vendor Oscar Hernández says he invented it in the early 1980s, first making it for himself while looking after a lakeside house; the year here is approximate. It began as tequila and grapefruit soda with sangrita, and he added orange juice, lime and salt because it needed more flavour. The sangrita turns it blood red, hence the name. In the village it is still sold in a plastic bag tied around a wide straw, easier to handle in a car than a cup.

Method: Build the tequila, juices, sangrita and salt over ice in a salt-rimmed glass, top with grapefruit soda and stir.', 'Highball', 'Cubes', 'Build', 'Modern Classic'),
    ('rebujito', 'Rebujito', 1985, false, 'highball', 'tree', 'Sherry Cobbler', 'Fino or manzanilla lengthened with lemon-lime soda over ice', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Rebujito', 'Chilled manzanilla or fino sherry topped with twice as much lemon-lime soda over plenty of ice, with mint.', 'The Rebujito is the drink of the Andalusian fairs, poured by the jug at the Seville April Fair and the Feria de Jerez. It may have its precedent in the Sherry Cobbler, but as a fair drink it is recent: the first record is at the Corpus fiestas in Granada in 1985, and it became known outside western Andalusia in the mid 1990s. No one is credited with it. The usual measure is about one part manzanilla or fino to two parts lemon-lime soda, kept very cold.

Method: Fill a glass with ice, add the sherry and top with the soda, stir once and garnish with mint.', 'Highball', 'Cubes', 'Build', 'Modern Classic'),
    ('bicicletta', 'Bicicletta', NULL, true, 'highball', 'style', 'spritz', 'Campari and still dry white wine lengthened with soda', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/recipes/bicicletta/', 'Campari and dry Italian white wine over ice, topped with soda and an orange wheel.', 'The Bicicletta is a north Italian café aperitivo, usually called Milanese: Campari, still white wine and soda, a spritz made with the red bitter. Its name, Italian for bicycle, comes from a popular legend about old men who wobbled all over the road riding home after a few afternoon drinks at the café. No one is credited with it and no date is recorded. Proportions run from equal parts Campari and wine with a splash of soda to a longer, more wine-heavy build.

Method: Build the Campari and wine over ice in a wine glass, top with soda, stir gently and garnish with an orange wheel.', 'Wine', 'Cubes', 'Build', 'Classic');

UPDATE "mc_drinks" f SET "item_id" = i.id FROM "public"."items" i WHERE i.is_catalog AND i.item_type = 'cocktail' AND lower(i.name) = lower(f.name);

INSERT INTO "public"."items" ("name", "item_type", "origin", "is_catalog")
SELECT f.name, 'cocktail', f.origin, true FROM "mc_drinks" f WHERE f.item_id IS NULL;

UPDATE "mc_drinks" f SET "item_id" = i.id FROM "public"."items" i
WHERE f.item_id IS NULL AND i.is_catalog AND i.item_type = 'cocktail' AND lower(i.name) = lower(f.name);

-- Year, family, what changed and the parent: one of these drinks, a classic
-- already in the tree (by name), or a style.
UPDATE "public"."items" i SET
    "origin_year" = coalesce(f.year, i.origin_year)::smallint,
    "origin_year_approx" = CASE WHEN f.year IS NULL THEN i.origin_year_approx ELSE f.approx END,
    "lineage_family" = f.family,
    "lineage_note" = f.note,
    "lineage_parent_id" = CASE f.parent_kind WHEN 'new' THEN pf.item_id WHEN 'tree' THEN pt.id END,
    "lineage_style_id" = CASE WHEN f.parent_kind = 'style' THEN s.id END
FROM "mc_drinks" f
LEFT JOIN "mc_drinks" pf ON f.parent_kind = 'new' AND pf.key = f.parent
LEFT JOIN LATERAL (SELECT t.id FROM "public"."items" t
                   WHERE f.parent_kind = 'tree' AND t.is_catalog AND t.lineage_family IS NOT NULL AND lower(t.name) = lower(f.parent)
                   ORDER BY t.created_at LIMIT 1) pt ON true
LEFT JOIN "public"."drink_styles" s ON f.parent_kind = 'style' AND s.key = f.parent
WHERE i.id = f.item_id;

-- What it is and its story, only where there's none yet. Glass and ice too.
UPDATE "public"."items" i SET
    "description" = coalesce(i.description, f.description),
    "notes" = coalesce(i.notes, f.notes),
    "glassware_id" = coalesce(i.glassware_id, (SELECT g.id FROM "public"."items" g WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND lower(g.name) = lower(f.glass) ORDER BY g.created_at LIMIT 1)),
    "ice_id" = coalesce(i.ice_id, (SELECT c.id FROM "public"."items" c WHERE c.item_type = 'ice' AND c.bar_id IS NULL AND lower(c.name) = lower(f.ice) ORDER BY c.created_at LIMIT 1))
FROM "mc_drinks" f
WHERE i.id = f.item_id;

INSERT INTO "public"."item_methods" ("item_id", "method_item_id", "sort_order")
SELECT f.item_id, m.id, 0
FROM "mc_drinks" f
JOIN LATERAL (SELECT x.id FROM "public"."items" x WHERE x.item_type = 'method' AND x.bar_id IS NULL AND lower(x.name) = lower(f.method) ORDER BY x.created_at LIMIT 1) m ON true
WHERE f.method IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."item_methods" x WHERE x.item_id = f.item_id);

-- Credits: the maker, any co-makers and the bar, 'suggested' until claimed.
-- An existing credit is kept.
UPDATE "public"."items" i SET
    "creator_profile_id" = coalesce(i.creator_profile_id, cp.id),
    "origin_bar_profile_id" = coalesce(i.origin_bar_profile_id, bp.id)
FROM "mc_drinks" f
LEFT JOIN "public"."profiles" cp ON cp.handle = f.creator AND cp.kind = 'person'
LEFT JOIN "public"."profiles" bp ON bp.handle = f.bar AND bp.kind = 'bar'
WHERE i.id = f.item_id AND (cp.id IS NOT NULL OR bp.id IS NOT NULL)
  AND (i.creator_profile_id IS NULL OR i.origin_bar_profile_id IS NULL);

INSERT INTO "public"."item_co_creators" ("item_id", "profile_id")
SELECT f.item_id, p.id
FROM "mc_drinks" f
CROSS JOIN LATERAL unnest(f.co) AS c(handle)
JOIN "public"."profiles" p ON p.handle = c.handle AND p.kind = 'person'
JOIN "public"."items" i ON i.id = f.item_id
WHERE p.id IS DISTINCT FROM i.creator_profile_id
ON CONFLICT DO NOTHING;


-- Classics already in the tree that descend from one of these move under it.
UPDATE "public"."items" i SET "lineage_parent_id" = f.item_id, "lineage_style_id" = NULL
FROM (VALUES
    ('Baltimore Egg Nogg', 'eggnog'),
    ('General Harrison''s Egg Nogg', 'eggnog'),
    ('Tom and Jerry', 'eggnog'),
    ('Coquito', 'eggnog')
) AS v("name", "key")
JOIN "mc_drinks" f ON f.key = v.key
WHERE i.is_catalog AND i.lineage_family IS NOT NULL AND lower(i.name) = lower(v.name) AND i.lineage_parent_id IS DISTINCT FROM f.item_id;

-- --- 3. Specs ---

CREATE TEMP TABLE "mc_lines" ("key" text, "pos" int, "amount" numeric, "unit" text, "ingredient" text, "prep" text, "optional" boolean);
INSERT INTO "mc_lines" VALUES
    ('champagne-cocktail-drink', 0, 1, 'each', 'Sugar', 'cube', false),
    ('champagne-cocktail-drink', 1, 3, 'dash', 'Aromatic bitters', NULL, false),
    ('champagne-cocktail-drink', 2, 4.5, 'oz', 'Champagne', 'chilled', false),
    ('champagne-cocktail-drink', 3, 1, 'twist', 'Lemon twist', NULL, false),
    ('planters-punch-drink', 0, 2, 'oz', 'Jamaican rum', NULL, false),
    ('planters-punch-drink', 1, 0.75, 'oz', 'Lime juice', 'fresh', false),
    ('planters-punch-drink', 2, 0.75, 'oz', 'Demerara syrup', NULL, false),
    ('planters-punch-drink', 3, 2, 'dash', 'Aromatic bitters', NULL, false),
    ('planters-punch-drink', 4, 1, 'pinch', 'Nutmeg', 'grated', false),
    ('mary-pickford', 0, 1.5, 'oz', 'White rum', NULL, false),
    ('mary-pickford', 1, 1.5, 'oz', 'Pineapple juice', 'fresh', false),
    ('mary-pickford', 2, 0.25, 'oz', 'Maraschino liqueur', NULL, false),
    ('mary-pickford', 3, 1, 'tsp', 'Grenadine', NULL, false),
    ('mary-pickford', 4, 1, 'each', 'Maraschino cherry', NULL, true),
    ('douglas-fairbanks', 0, 1.5, 'oz', 'London dry gin', NULL, false),
    ('douglas-fairbanks', 1, 1, 'oz', 'Apricot liqueur', NULL, false),
    ('douglas-fairbanks', 2, 0.75, 'oz', 'Lemon juice', 'fresh', false),
    ('douglas-fairbanks', 3, 0.75, 'oz', 'Egg white', NULL, true),
    ('fairbanks-loan-no-2', 0, 0.75, 'oz', 'London dry gin', NULL, false),
    ('fairbanks-loan-no-2', 1, 0.75, 'oz', 'Rum', 'pineapple infused', false),
    ('fairbanks-loan-no-2', 2, 0.25, 'oz', 'Lillet Blanc', NULL, false),
    ('fairbanks-loan-no-2', 3, 0.125, 'oz', 'Cynar', NULL, false),
    ('fairbanks-loan-no-2', 4, 0.0625, 'oz', 'Campari', NULL, false),
    ('fairbanks-loan-no-2', 5, 0.25, 'oz', 'Honey syrup', NULL, false),
    ('fairbanks-loan-no-2', 6, 0.25, 'oz', 'Lemon juice', 'fresh', false),
    ('fairbanks-loan-no-2', 7, 0.25, 'oz', 'Lime juice', 'fresh', false),
    ('fairbanks-loan-no-2', 8, 1, 'twist', 'Lemon twist', NULL, false),
    ('charlie-chaplin', 0, 1, 'oz', 'Sloe gin', NULL, false),
    ('charlie-chaplin', 1, 1, 'oz', 'Apricot liqueur', NULL, false),
    ('charlie-chaplin', 2, 1, 'oz', 'Lime juice', 'fresh', false),
    ('angel-face', 0, 1, 'oz', 'Gin', NULL, false),
    ('angel-face', 1, 1, 'oz', 'Apricot liqueur', NULL, false),
    ('angel-face', 2, 1, 'oz', 'Calvados', NULL, false),
    ('paradise', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('paradise', 1, 0.75, 'oz', 'Apricot liqueur', NULL, false),
    ('paradise', 2, 0.75, 'oz', 'Orange juice', 'fresh', false),
    ('paradise', 3, 1, 'tsp', 'Lemon juice', 'fresh', false),
    ('periodista', 0, 1.5, 'oz', 'White rum', NULL, false),
    ('periodista', 1, 0.5, 'oz', 'Apricot liqueur', NULL, false),
    ('periodista', 2, 0.5, 'oz', 'Triple sec', NULL, false),
    ('periodista', 3, 0.5, 'oz', 'Lime juice', 'fresh', false),
    ('periodista', 4, 0.25, 'oz', 'Simple syrup', NULL, true),
    ('periodista', 5, 1, 'twist', 'Lime', 'twist', false),
    ('floradora', 0, 2, 'oz', 'Gin', NULL, false),
    ('floradora', 1, 0.75, 'oz', 'Lime juice', 'fresh', false),
    ('floradora', 2, 0.5, 'oz', 'Raspberry syrup', NULL, false),
    ('floradora', 3, NULL, 'top', 'Ginger ale', NULL, false),
    ('floradora', 4, 1, 'each', 'Raspberry', NULL, true),
    ('twelve-mile-limit', 0, 1, 'oz', 'White rum', NULL, false),
    ('twelve-mile-limit', 1, 0.5, 'oz', 'Rye whiskey', NULL, false),
    ('twelve-mile-limit', 2, 0.5, 'oz', 'Cognac', NULL, false),
    ('twelve-mile-limit', 3, 0.5, 'oz', 'Lemon juice', 'fresh', false),
    ('twelve-mile-limit', 4, 0.33, 'oz', 'Grenadine', NULL, false),
    ('widows-kiss', 0, 1.5, 'oz', 'Calvados', 'or apple brandy', false),
    ('widows-kiss', 1, 0.75, 'oz', 'Bénédictine D.O.M', NULL, false),
    ('widows-kiss', 2, 0.75, 'oz', 'Yellow Chartreuse', NULL, false),
    ('widows-kiss', 3, 2, 'dash', 'Aromatic bitters', NULL, false),
    ('star', 0, 1.5, 'oz', 'Apple brandy', 'or applejack', false),
    ('star', 1, 1.5, 'oz', 'Sweet vermouth', NULL, false),
    ('star', 2, 1, 'bsp', 'Simple syrup', NULL, false),
    ('star', 3, 2, 'dash', 'Aromatic bitters', 'or Peychaud''s', false),
    ('star', 4, 1, 'twist', 'Lemon twist', 'garnish', false),
    ('blackthorn', 0, 1.5, 'oz', 'Irish whiskey', NULL, false),
    ('blackthorn', 1, 1.5, 'oz', 'Dry vermouth', NULL, false),
    ('blackthorn', 2, 3, 'dash', 'Absinthe', NULL, false),
    ('blackthorn', 3, 3, 'dash', 'Aromatic bitters', NULL, false),
    ('blackthorn', 4, 1, 'twist', 'Lemon twist', 'garnish', false),
    ('algonquin', 0, 2, 'oz', 'Rye whiskey', NULL, false),
    ('algonquin', 1, 1, 'oz', 'Dry vermouth', NULL, false),
    ('algonquin', 2, 1, 'oz', 'Pineapple juice', 'fresh', false),
    ('satans-whiskers', 0, 0.5, 'oz', 'Gin', NULL, false),
    ('satans-whiskers', 1, 0.5, 'oz', 'Sweet vermouth', NULL, false),
    ('satans-whiskers', 2, 0.5, 'oz', 'Dry vermouth', NULL, false),
    ('satans-whiskers', 3, 0.5, 'oz', 'Orange juice', 'fresh', false),
    ('satans-whiskers', 4, 0.25, 'oz', 'Grand Marnier', 'or orange curaçao for Curled', false),
    ('satans-whiskers', 5, 1, 'dash', 'Orange bitters', NULL, false),
    ('satans-whiskers', 6, 1, 'twist', 'Orange twist', 'garnish', false),
    ('income-tax', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('income-tax', 1, 0.5, 'oz', 'Sweet vermouth', NULL, false),
    ('income-tax', 2, 0.5, 'oz', 'Dry vermouth', NULL, false),
    ('income-tax', 3, 0.75, 'oz', 'Orange juice', 'fresh', false),
    ('income-tax', 4, 2, 'dash', 'Aromatic bitters', NULL, false),
    ('income-tax', 5, 1, 'twist', 'Orange twist', 'garnish', false),
    ('abbey', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('abbey', 1, 0.75, 'oz', 'Lillet Blanc', 'or Cocchi Americano', false),
    ('abbey', 2, 0.75, 'oz', 'Orange juice', 'fresh', false),
    ('abbey', 3, 1, 'dash', 'Aromatic bitters', NULL, false),
    ('abbey', 4, 1, 'twist', 'Lemon twist', 'garnish', true),
    ('leap-year', 0, 2, 'oz', 'Gin', NULL, false),
    ('leap-year', 1, 0.5, 'oz', 'Grand Marnier', NULL, false),
    ('leap-year', 2, 0.5, 'oz', 'Sweet vermouth', NULL, false),
    ('leap-year', 3, 1, 'bsp', 'Lemon juice', 'fresh', false),
    ('leap-year', 4, 1, 'twist', 'Lemon twist', 'garnish', false),
    ('journalist', 0, 1.5, 'oz', 'London dry gin', NULL, false),
    ('journalist', 1, 0.5, 'oz', 'Dry vermouth', NULL, false),
    ('journalist', 2, 0.5, 'oz', 'Sweet vermouth', NULL, false),
    ('journalist', 3, 0.25, 'oz', 'Curaçao', 'dry orange', false),
    ('journalist', 4, 0.25, 'oz', 'Lemon juice', 'fresh', false),
    ('journalist', 5, 1, 'dash', 'Aromatic bitters', NULL, false),
    ('orange-blossom', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('orange-blossom', 1, 1.5, 'oz', 'Orange juice', 'fresh', false),
    ('orange-blossom', 2, 1, 'dash', 'Orange bitters', NULL, false),
    ('orange-blossom', 3, 1, 'bsp', 'Grenadine', NULL, true),
    ('absinthe-suissesse', 0, 1.5, 'oz', 'Absinthe', 'or Herbsaint', false),
    ('absinthe-suissesse', 1, 0.5, 'oz', 'Orgeat', NULL, false),
    ('absinthe-suissesse', 2, 0.75, 'oz', 'Egg white', NULL, false),
    ('absinthe-suissesse', 3, 1, 'oz', 'Heavy cream', NULL, false),
    ('absinthe-suissesse', 4, 1, 'dash', 'Orange blossom water', NULL, true),
    ('french-martini', 0, 1.5, 'oz', 'Vodka', NULL, false),
    ('french-martini', 1, 0.5, 'oz', 'Raspberry liqueur', NULL, false),
    ('french-martini', 2, 1.25, 'oz', 'Pineapple juice', 'fresh', false),
    ('french-martini', 3, 1, 'peel', 'Lemon peel', 'expressed, garnish', false),
    ('sex-on-the-beach', 0, 1.33, 'oz', 'Vodka', NULL, false),
    ('sex-on-the-beach', 1, 0.67, 'oz', 'Peach liqueur', 'peach schnapps', false),
    ('sex-on-the-beach', 2, 1.33, 'oz', 'Orange juice', 'fresh', false),
    ('sex-on-the-beach', 3, 1.33, 'oz', 'Cranberry juice', NULL, false),
    ('sex-on-the-beach', 4, 1, 'slice', 'Orange', 'garnish', false),
    ('russian-spring-punch', 0, 1.5, 'oz', 'Vodka', NULL, false),
    ('russian-spring-punch', 1, 0.75, 'oz', 'Lemon juice', 'fresh', false),
    ('russian-spring-punch', 2, 0.33, 'oz', 'Crème de cassis', NULL, false),
    ('russian-spring-punch', 3, 0.33, 'oz', 'Simple syrup', NULL, false),
    ('russian-spring-punch', 4, NULL, 'top', 'Champagne', 'brut', false),
    ('russian-spring-punch', 5, 3, 'each', 'Raspberry', 'garnish', true),
    ('spicy-fifty', 0, 1.67, 'oz', 'Vanilla vodka', NULL, false),
    ('spicy-fifty', 1, 0.5, 'oz', 'Elderflower cordial', NULL, false),
    ('spicy-fifty', 2, 0.5, 'oz', 'Lime juice', 'fresh', false),
    ('spicy-fifty', 3, 0.33, 'oz', 'Honey syrup', NULL, false),
    ('spicy-fifty', 4, 2, 'slice', 'Chilli', 'red, thin', false),
    ('spicy-fifty', 5, 1, 'each', 'Chilli', 'red, garnish', false),
    ('illegal', 0, 1, 'oz', 'Mezcal', 'espadín', false),
    ('illegal', 1, 0.5, 'oz', 'Overproof rum', 'Jamaican, white', false),
    ('illegal', 2, 0.5, 'oz', 'Falernum', NULL, false),
    ('illegal', 3, 1, 'bsp', 'Maraschino liqueur', NULL, false),
    ('illegal', 4, 0.75, 'oz', 'Lime juice', 'fresh', false),
    ('illegal', 5, 0.5, 'oz', 'Simple syrup', NULL, false),
    ('illegal', 6, 3, 'drop', 'Egg white', NULL, true),
    ('barracuda', 0, 1.5, 'oz', 'Aged rum', 'gold', false),
    ('barracuda', 1, 0.5, 'oz', 'Galliano', NULL, false),
    ('barracuda', 2, 1.5, 'oz', 'Pineapple juice', 'fresh', false),
    ('barracuda', 3, 1, 'dash', 'Lime juice', 'fresh', false),
    ('barracuda', 4, NULL, 'top', 'Prosecco', NULL, false),
    ('barracuda', 5, 1, 'wedge', 'Pineapple', 'garnish', false),
    ('yellow-bird', 0, 1, 'oz', 'White rum', NULL, false),
    ('yellow-bird', 1, 0.5, 'oz', 'Galliano', NULL, false),
    ('yellow-bird', 2, 0.5, 'oz', 'Triple sec', NULL, false),
    ('yellow-bird', 3, 0.5, 'oz', 'Lime juice', 'fresh', false),
    ('rum-runner', 0, 1, 'oz', 'Jamaican rum', NULL, false),
    ('rum-runner', 1, 1, 'oz', 'Aged rum', 'gold', false),
    ('rum-runner', 2, 0.75, 'oz', 'Banana liqueur', NULL, false),
    ('rum-runner', 3, 0.5, 'oz', 'Crème de mûre', 'or blackberry brandy', false),
    ('rum-runner', 4, 1.5, 'oz', 'Pineapple juice', 'fresh', false),
    ('rum-runner', 5, 1, 'oz', 'Orange juice', 'fresh', false),
    ('rum-runner', 6, 0.5, 'oz', 'Lime juice', 'fresh', false),
    ('rum-runner', 7, 0.25, 'oz', 'Grenadine', NULL, false),
    ('rum-runner', 8, 1, 'wedge', 'Pineapple', 'garnish', false),
    ('rum-runner', 9, 1, 'each', 'Maraschino cherry', 'garnish', false),
    ('whisky-mac', 0, 1.5, 'oz', 'Blended Scotch', NULL, false),
    ('whisky-mac', 1, 1, 'oz', 'Ginger wine', 'green', false),
    ('sangria', 0, 4, 'oz', 'Red wine', 'Spanish, such as Rioja or Garnacha', false),
    ('sangria', 1, 0.75, 'oz', 'Brandy', 'Spanish', false),
    ('sangria', 2, 0.5, 'oz', 'Orange liqueur', NULL, false),
    ('sangria', 3, 1, 'oz', 'Orange juice', 'fresh', false),
    ('sangria', 4, 0.25, 'oz', 'Simple syrup', 'to taste', false),
    ('sangria', 5, 2, 'slice', 'Orange', 'chopped', false),
    ('sangria', 6, 2, 'slice', 'Apple', 'chopped', false),
    ('sangria', 7, 1, 'each', 'Cinnamon', 'stick', true),
    ('sangria', 8, NULL, 'top', 'Soda water', NULL, true),
    ('mulled-wine', 0, 5, 'oz', 'Red wine', 'fruity and dry', false),
    ('mulled-wine', 1, 0.5, 'oz', 'Brandy', NULL, true),
    ('mulled-wine', 2, 0.5, 'oz', 'Simple syrup', 'or honey syrup', false),
    ('mulled-wine', 3, 1, 'slice', 'Orange', 'studded with cloves', false),
    ('mulled-wine', 4, 2, 'each', 'Clove', 'whole', false),
    ('mulled-wine', 5, 1, 'each', 'Cinnamon', 'stick', false),
    ('mulled-wine', 6, 1, 'each', 'Star anise', NULL, true),
    ('mulled-wine', 7, 1, 'pinch', 'Nutmeg', 'grated', true),
    ('eggnog', 0, 1, 'oz', 'Cognac', 'or bourbon', false),
    ('eggnog', 1, 0.5, 'oz', 'Aged rum', NULL, false),
    ('eggnog', 2, 1, 'each', 'Egg', 'whole', false),
    ('eggnog', 3, 0.75, 'oz', 'Simple syrup', NULL, false),
    ('eggnog', 4, 1.5, 'oz', 'Milk', 'whole', false),
    ('eggnog', 5, 0.75, 'oz', 'Cream', NULL, false),
    ('eggnog', 6, 1, 'pinch', 'Nutmeg', 'freshly grated, garnish', false),
    ('chilcano', 0, 2, 'oz', 'Pisco', 'Peruvian quebranta or acholado', false),
    ('chilcano', 1, 0.5, 'oz', 'Lime juice', 'fresh', false),
    ('chilcano', 2, 3, 'drop', 'Aromatic bitters', 'Angostura', false),
    ('chilcano', 3, 4, 'oz', 'Ginger ale', 'chilled', false),
    ('chilcano', 4, 1, 'wedge', 'Lime wedge', 'garnish', true),
    ('cantarito', 0, 2, 'oz', 'Blanco tequila', 'or reposado', false),
    ('cantarito', 1, 1.5, 'oz', 'Orange juice', 'fresh', false),
    ('cantarito', 2, 1, 'oz', 'Grapefruit juice', 'fresh', false),
    ('cantarito', 3, 0.5, 'oz', 'Lime juice', 'fresh', false),
    ('cantarito', 4, 1, 'pinch', 'Salt', NULL, false),
    ('cantarito', 5, 2, 'oz', 'Grapefruit soda', 'Squirt or similar', false),
    ('cantarito', 6, 1, 'wedge', 'Lime wedge', 'garnish', true),
    ('vampiro', 0, 2, 'oz', 'Blanco tequila', NULL, false),
    ('vampiro', 1, 1, 'oz', 'Orange juice', 'fresh', false),
    ('vampiro', 2, 0.5, 'oz', 'Lime juice', 'fresh', false),
    ('vampiro', 3, 1, 'oz', 'Sangrita', 'orange-based, such as Viuda de Sánchez', false),
    ('vampiro', 4, 1, 'pinch', 'Salt', NULL, false),
    ('vampiro', 5, NULL, 'top', 'Grapefruit soda', 'Squirt or similar', false),
    ('vampiro', 6, NULL, 'rim', 'Salt', 'coarse', false),
    ('rebujito', 0, 2, 'oz', 'Fino sherry', 'or manzanilla, well chilled', false),
    ('rebujito', 1, 4, 'oz', 'Lemonade', 'lemon-lime soda', false),
    ('rebujito', 2, 1, 'sprig', 'Mint', 'garnish', true),
    ('bicicletta', 0, 1.5, 'oz', 'Campari', NULL, false),
    ('bicicletta', 1, 2, 'oz', 'White wine', 'dry Italian, such as pinot grigio', false),
    ('bicicletta', 2, 2, 'oz', 'Soda water', 'chilled', false),
    ('bicicletta', 3, 1, 'wheel', 'Orange', 'garnish', false);

-- Specs, only for drinks with none. Each ingredient is the shared one with
-- the same name key (or alias); a name we don't have yet is added as a plain
-- ingredient.
CREATE TEMP TABLE "mc_ing" AS SELECT DISTINCT "ingredient" AS "name", public.resolve_ingredient("ingredient") AS "item_id" FROM "mc_lines";
INSERT INTO "public"."items" ("name", "item_type", "ingredient_role", "hide_from_search")
SELECT DISTINCT ON (public.ingredient_key(n.name)) n.name, 'ingredient', 'generic', false
FROM "mc_ing" n WHERE n.item_id IS NULL ORDER BY public.ingredient_key(n.name), n.name;
UPDATE "mc_ing" n SET "item_id" = public.resolve_ingredient(n.name) WHERE n.item_id IS NULL;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "amount", "unit", "preparation_notes", "is_optional", "sort_order")
SELECT f.item_id, n.item_id, l.amount, l.unit, l.prep, l.optional, l.pos
FROM "mc_lines" l
JOIN "mc_drinks" f ON f.key = l.key
JOIN "mc_ing" n ON n.name = l.ingredient AND n.item_id IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = f.item_id);


-- --- 5. Sources ---

INSERT INTO "public"."sources" ("key", "kind", "title", "rights", "url")
SELECT v.key, 'web', v.title, 'facts_only', v.url
FROM (VALUES
    ('web:en-wikipedia-org-wiki-champagne-cocktail', 'Champagne Cocktail', 'https://en.wikipedia.org/wiki/Champagne_cocktail'),
    ('web:en-wikipedia-org-wiki-planter-27s-punch', 'Planter''s Punch', 'https://en.wikipedia.org/wiki/Planter%27s_punch'),
    ('web:en-wikipedia-org-wiki-mary-pickford-cocktail', 'Mary Pickford', 'https://en.wikipedia.org/wiki/Mary_Pickford_(cocktail)'),
    ('web:punchdrink-com-articles-douglas-fairbanks-daiquiri-cocktail-recipe-cuba', 'Douglas Fairbanks', 'https://punchdrink.com/articles/douglas-fairbanks-daiquiri-cocktail-recipe-cuba/'),
    ('web:punchdrink-com-recipes-fairbanks-loan-2', 'Fairbanks Loan No. 2', 'https://punchdrink.com/recipes/fairbanks-loan-2/'),
    ('web:www-diffordsguide-com-cocktails-recipe-2914-charlie-chaplin', 'Charlie Chaplin', 'https://www.diffordsguide.com/cocktails/recipe/2914/charlie-chaplin'),
    ('web:en-wikipedia-org-wiki-angel-face-cocktail', 'Angel Face', 'https://en.wikipedia.org/wiki/Angel_Face_(cocktail)'),
    ('web:en-wikipedia-org-wiki-paradise-cocktail', 'Paradise', 'https://en.wikipedia.org/wiki/Paradise_(cocktail)'),
    ('web:www-diffordsguide-com-cocktails-recipe-1510-periodista-daiquiri', 'Periodista', 'https://www.diffordsguide.com/cocktails/recipe/1510/periodista-daiquiri'),
    ('web:classbarmag-com-news-fullstory-php-aid-524-florodora-the-tale-of-the-tribute-coc', 'Floradora', 'https://classbarmag.com/news/fullstory.php/aid/524/Florodora_-_the_tale_of_the_tribute_cocktail_that_outlived_its_inspiration.html'),
    ('web:www-diffordsguide-com-cocktails-recipe-13849-twelve-mile-limit', 'Twelve Mile Limit', 'https://www.diffordsguide.com/cocktails/recipe/13849/twelve-mile-limit'),
    ('web:www-gutenberg-org-ebooks-61065', 'Widow''s Kiss', 'https://www.gutenberg.org/ebooks/61065'),
    ('web:en-wikipedia-org-wiki-blackthorn-cocktail', 'Blackthorn', 'https://en.wikipedia.org/wiki/Blackthorn_(cocktail)'),
    ('web:vinepair-com-cocktail-recipe-algonquin', 'Algonquin', 'https://vinepair.com/cocktail-recipe/algonquin/'),
    ('web:www-spiritsanddistilling-com-dictionary-acref-9780199311132-e-410', 'Satan''s Whiskers', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-410'),
    ('web:cold-glass-com-2013-04-12-feeling-bitter-in-the-bronx-the-income-tax-cocktail', 'Income Tax', 'https://cold-glass.com/2013/04/12/feeling-bitter-in-the-bronx-the-income-tax-cocktail'),
    ('web:www-diffordsguide-com-cocktails-recipe-3-abbey', 'Abbey', 'https://www.diffordsguide.com/cocktails/recipe/3/abbey'),
    ('web:archive-org-details-savoycocktailboo0000vari', 'Leap Year', 'https://archive.org/details/savoycocktailboo0000vari'),
    ('web:www-diffordsguide-com-cocktails-recipe-1072-journalist', 'Journalist', 'https://www.diffordsguide.com/cocktails/recipe/1072/journalist'),
    ('web:archive-org-details-cocktails-202208', 'Orange Blossom', 'https://archive.org/details/cocktails_202208'),
    ('web:punchdrink-com-articles-absinthe-suissesse-cocktail-new-orleans', 'Absinthe Suissesse', 'https://punchdrink.com/articles/absinthe-suissesse-cocktail-new-orleans/'),
    ('web:en-wikipedia-org-wiki-french-martini', 'French Martini', 'https://en.wikipedia.org/wiki/French_martini'),
    ('web:en-wikipedia-org-wiki-sex-on-the-beach', 'Sex on the Beach', 'https://en.wikipedia.org/wiki/Sex_on_the_Beach'),
    ('web:www-diffordsguide-com-cocktails-recipe-1720-russian-spring-punch', 'Russian Spring Punch', 'https://www.diffordsguide.com/cocktails/recipe/1720/russian-spring-punch'),
    ('web:en-wikipedia-org-wiki-spicy-fifty', 'Spicy Fifty', 'https://en.wikipedia.org/wiki/Spicy_Fifty'),
    ('web:en-wikipedia-org-wiki-illegal-cocktail', 'Illegal', 'https://en.wikipedia.org/wiki/Illegal_(cocktail)'),
    ('web:www-diffordsguide-com-encyclopedia-3276-people-benito-cuppari', 'Barracuda', 'https://www.diffordsguide.com/encyclopedia/3276/people/benito-cuppari'),
    ('web:en-wikipedia-org-wiki-yellow-bird-cocktail', 'Yellow Bird', 'https://en.wikipedia.org/wiki/Yellow_bird_(cocktail)'),
    ('web:lodgingmagazine-com-holiday-isle-tiki-bar-reopens', 'Rum Runner', 'https://lodgingmagazine.com/holiday-isle-tiki-bar-reopens/'),
    ('web:en-wikipedia-org-wiki-whisky-mac', 'Whisky Mac', 'https://en.wikipedia.org/wiki/Whisky_Mac'),
    ('web:en-wikipedia-org-wiki-sangria', 'Sangria', 'https://en.wikipedia.org/wiki/Sangria'),
    ('web:en-wikipedia-org-wiki-mulled-wine', 'Mulled Wine', 'https://en.wikipedia.org/wiki/Mulled_wine'),
    ('web:en-wikipedia-org-wiki-eggnog', 'Eggnog', 'https://en.wikipedia.org/wiki/Eggnog'),
    ('web:es-wikipedia-org-wiki-chilcano-bebida', 'Chilcano', 'https://es.wikipedia.org/wiki/Chilcano_(bebida)'),
    ('web:en-wikipedia-org-wiki-cantarito', 'Cantarito', 'https://en.wikipedia.org/wiki/Cantarito'),
    ('web:en-wikipedia-org-wiki-vampiro-cocktail', 'Vampiro', 'https://en.wikipedia.org/wiki/Vampiro_(cocktail)'),
    ('web:en-wikipedia-org-wiki-rebujito', 'Rebujito', 'https://en.wikipedia.org/wiki/Rebujito'),
    ('web:punchdrink-com-recipes-bicicletta', 'Bicicletta', 'https://punchdrink.com/recipes/bicicletta/')
) AS v("key", "title", "url")
WHERE NOT EXISTS (SELECT 1 FROM "public"."sources" s WHERE s.key = v.key OR s.url = v.url);

INSERT INTO "public"."source_recipes" ("source_id", "item_id", "printed_name", "relation")
SELECT s.id, f.item_id, f.name, 'first_print'
FROM "mc_drinks" f
JOIN "public"."sources" s ON s.url = f.src
WHERE f.src IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "public"."source_recipes" r WHERE r.item_id = f.item_id);


-- --- 6. Bars' versions ---

CREATE TEMP TABLE "mc_names" ("lname" text PRIMARY KEY, "key" text NOT NULL);
INSERT INTO "mc_names" VALUES
    ('12 mile limit', 'twelve-mile-limit'),
    ('abbey cocktail', 'abbey'),
    ('absinthe suisse', 'absinthe-suissesse'),
    ('absinthe suissesse', 'absinthe-suissesse'),
    ('algonquin', 'algonquin'),
    ('algonquin cocktail', 'algonquin'),
    ('angel face', 'angel-face'),
    ('bicicleta', 'bicicletta'),
    ('bicicletta', 'bicicletta'),
    ('black thorn', 'blackthorn'),
    ('blackthorn', 'blackthorn'),
    ('blackthorn (irish)', 'blackthorn'),
    ('blackthorne', 'blackthorn'),
    ('cantarito', 'cantarito'),
    ('cantarito de barro', 'cantarito'),
    ('cantaritos', 'cantarito'),
    ('champagne cocktail', 'champagne-cocktail-drink'),
    ('charlie chaplin', 'charlie-chaplin'),
    ('charlie chaplin cocktail', 'charlie-chaplin'),
    ('chilcano', 'chilcano'),
    ('chilcano de pisco', 'chilcano'),
    ('classic champagne cocktail', 'champagne-cocktail-drink'),
    ('douglas fairbanks', 'douglas-fairbanks'),
    ('egg nog', 'eggnog'),
    ('egg nogg', 'eggnog'),
    ('egg-nog', 'eggnog'),
    ('eggnog', 'eggnog'),
    ('fairbanks loan no. 2', 'fairbanks-loan-no-2'),
    ('flora dora', 'floradora'),
    ('floradora', 'floradora'),
    ('floradora cooler', 'floradora'),
    ('florodora', 'floradora'),
    ('french martini', 'french-martini'),
    ('gluhwein', 'mulled-wine'),
    ('glühwein', 'mulled-wine'),
    ('illegal margarita', 'illegal'),
    ('income tax', 'income-tax'),
    ('income tax cocktail', 'income-tax'),
    ('irish blackthorn', 'blackthorn'),
    ('journalist cocktail', 'journalist'),
    ('leap year', 'leap-year'),
    ('leap year cocktail', 'leap-year'),
    ('mary pickford', 'mary-pickford'),
    ('mulled wine', 'mulled-wine'),
    ('new algonquin', 'algonquin'),
    ('orange blossom', 'orange-blossom'),
    ('orange blossom cocktail', 'orange-blossom'),
    ('paradise cocktail', 'paradise'),
    ('periodista', 'periodista'),
    ('periodista daiquiri', 'periodista'),
    ('planter''s punch', 'planters-punch-drink'),
    ('planter''s rum punch', 'planters-punch-drink'),
    ('planters punch', 'planters-punch-drink'),
    ('rebujito', 'rebujito'),
    ('rebujito sevillano', 'rebujito'),
    ('red sangria', 'sangria'),
    ('rum runner', 'rum-runner'),
    ('rumrunner', 'rum-runner'),
    ('russian spring punch', 'russian-spring-punch'),
    ('sangria', 'sangria'),
    ('sangría', 'sangria'),
    ('satan''s whiskers', 'satans-whiskers'),
    ('satan''s whiskers (curled)', 'satans-whiskers'),
    ('satan''s whiskers (straight)', 'satans-whiskers'),
    ('satans whiskers', 'satans-whiskers'),
    ('sex on the beach', 'sex-on-the-beach'),
    ('spiced wine', 'mulled-wine'),
    ('spicy 50', 'spicy-fifty'),
    ('spicy fifty', 'spicy-fifty'),
    ('star cocktail', 'star'),
    ('star no. 1', 'star'),
    ('suissesse', 'absinthe-suissesse'),
    ('twelve mile limit', 'twelve-mile-limit'),
    ('vampiro', 'vampiro'),
    ('vampiros', 'vampiro'),
    ('vin chaud', 'mulled-wine'),
    ('whiskey mac', 'whisky-mac'),
    ('whisky mac', 'whisky-mac'),
    ('whisky macdonald', 'whisky-mac'),
    ('widow''s kiss', 'widows-kiss'),
    ('widow''s kiss cocktail', 'widows-kiss'),
    ('widows kiss', 'widows-kiss'),
    ('yellow bird', 'yellow-bird'),
    ('yellowbird', 'yellow-bird');

CREATE TEMP TABLE "mc_skip" ("lname" text, "bar" text);
INSERT INTO "mc_skip" VALUES
    ('orange blossom', 'theironfairieskl'),
    ('paradise', 'barchimera'),
    ('barracuda', 'barmargauxmelbourne');

CREATE TEMP TABLE "mc_picks" ("lname" text, "bar" text, "key" text);
INSERT INTO "mc_picks" VALUES
    ('freekeh french martini', 'seedlibrarynyc', 'french-martini'),
    ('salt farm french martini', 'super.lyan', 'french-martini'),
    ('the gintarito', 'littlelondistillingco', 'cantarito'),
    ('chilcano de pisco', 'pisco_kl', 'chilcano'),
    ('chilcano izakaya', 'papasannyc', 'chilcano'),
    ('a little bit of fancy', 'arlechinmelbourne', 'champagne-cocktail-drink'),
    ('hot wine soup', 'whitehartbar', 'mulled-wine'),
    ('let''s mull it over', 'barjayda', 'mulled-wine'),
    ('apres ski sangria', 'barpendrymanhattanwest', 'sangria'),
    ('berry sangria', 'ponyfishisland', 'sangria'),
    ('far east sangria', 'ponyupshanghai', 'sangria'),
    ('java sangria', 'antisocialoffline', 'sangria'),
    ('lit''chee sangria', 'lighthouserooftop', 'sangria'),
    ('lpv sangria', 'londrapalacevenezia', 'sangria'),
    ('mena sangria', 'chezzou', 'sangria'),
    ('pavlova sangria', 'arboryeatery', 'sangria'),
    ('red sangria', 'bombabar', 'sangria'),
    ('white sangria', 'bombabar', 'sangria'),
    ('sangria sin fiesta', 'callmealhk', 'sangria'),
    ('seasonal sangria', 'sundayinbrooklyn', 'sangria'),
    ('sangría preparada', 'limantourmx', 'sangria'),
    ('skin of a killer', 'romeosnyc', 'sangria'),
    ('the ensemble', 'therabbitbooksandbar', 'sangria'),
    ('clyde common eggnog', 'clydecommon', 'eggnog'),
    ('tea leaf eggnog', 'dio.cafebar', 'eggnog'),
    ('satan''s whiskers (kevin armstrong''s)', 'satans_whiskers', 'satans-whiskers'),
    ('planter''s potion', 'sunkenharborclubnyc', 'planters-punch-drink'),
    ('periodista viejo', 'chainayateandcocktails', 'periodista');

-- Bars' drinks with one of these names (or a common spelling), and the named
-- versions picked by hand, become versions of the classic so they rank in
-- its list. Labelled a version like the earlier links. Same-name drinks that
-- are something else (mc_skip) and home drinks are left alone.
UPDATE "public"."items" i SET
    "riff_of_id" = f.item_id,
    "origin" = CASE WHEN i.origin = 'Original' THEN 'Varient' ELSE i.origin END
FROM "mc_names" n
JOIN "mc_drinks" f ON f.key = n.key
WHERE i.item_type = 'cocktail' AND NOT i.is_catalog AND i.riff_of_id IS NULL
  AND lower(btrim(i.name)) = n.lname
  AND (i.bar_id IS NOT NULL OR i.created_by IS NULL)
  AND i.id <> f.item_id
  AND NOT EXISTS (SELECT 1 FROM "mc_skip" k JOIN "public"."profiles" b ON b.handle = k.bar
                  WHERE k.lname = n.lname AND b.id = i.origin_bar_profile_id);

UPDATE "public"."items" i SET
    "riff_of_id" = f.item_id,
    "origin" = CASE WHEN i.origin = 'Original' THEN 'Varient' ELSE i.origin END
FROM "mc_picks" k
JOIN "public"."profiles" b ON b.handle = k.bar AND b.kind = 'bar'
JOIN "mc_drinks" f ON f.key = k.key
WHERE i.item_type = 'cocktail' AND NOT i.is_catalog AND i.riff_of_id IS NULL
  AND lower(btrim(i.name)) = k.lname AND i.origin_bar_profile_id = b.id
  AND (i.bar_id IS NOT NULL OR i.created_by IS NULL);


-- --- No paid AI: drop the flavour jobs these inserts queued ---

DELETE FROM "private"."item_flavor_jobs" j
USING "mc_drinks" f
WHERE j.item_id = f.item_id AND NOT EXISTS (SELECT 1 FROM "mc_jobs_before" b WHERE b.item_id = j.item_id);

DROP TABLE "mc_names", "mc_skip", "mc_picks", "mc_lines", "mc_ing", "mc_drinks", "mc_jobs_before";
