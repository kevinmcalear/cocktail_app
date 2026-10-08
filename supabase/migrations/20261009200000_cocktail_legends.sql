-- More cocktail legends, and past jobs that are public record.
--
-- 1-3. Bartenders who shaped modern drinking but had no profile yet (Eben
--    Freeman, Gary Regan, Murray Stenson, Colin Field, Kazuo Uyeda and
--    others): public, unclaimed person profiles in our own words, the bars
--    they worked at (closed ones included) and their jobs there. Professional
--    facts only, no photos. Existing profiles are reused by handle.
--    Their jobs come from the press as public careers, so past ones show; each
--    can switch one off after claiming.
-- 4. Their signature drinks, credited 'suggested' until claimed, with house
--    specs where one was verified. A catalog drink keeps an existing credit.
-- 5. Drink credits that name a creator and the bar it was first made at, where
--    the creator worked there, get that job (fact-checked one by one: a
--    patron, a brand executive or a guest menu is not a job).
-- 6. Past jobs are opt-in (20261007120000), so every seeded past job was
--    hidden. Those that are public record now show: the bar has closed, the
--    person created a credited drink there, or the person's credited drinks
--    go back before 2000. Only unclaimed profiles; anyone who claims theirs
--    can still switch each one off. Other living bartenders' past jobs stay
--    hidden until they choose.
--
-- No paid AI: app.image_worker stops sketch jobs, and the flavour jobs these
-- inserts queue are removed at the end. Idempotent: rerunning adds nothing twice.

SET "app.image_worker" = 'on';

CREATE TEMP TABLE "lg_jobs_before" AS SELECT "item_id" FROM "private"."item_flavor_jobs";

-- --- 1. Bars ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "locality", "address_line",
                                 "city", "region", "country_code", "is_closed", "closed_year")
SELECT 'bar', v.handle, v.name, v.bio, v.website, true, v.locality, v.address_line, v.city, v.region, v.country_code,
       v.is_closed, v.closed_year::smallint
FROM (VALUES
    ('atlantic.london', 'Atlantic Bar & Grill', 'Large Oliver Peyton bar and restaurant near Piccadilly that included Dick Bradsell''s bar and trained many of London''s leading bartenders in the 1990s.', NULL, NULL, NULL, 'London', 'England', 'GB', true, NULL::int),
    ('b.side.lounge.cambridge', 'B-Side Lounge', 'Cambridge bar opened in 1998 by Patrick Sullivan, credited with reviving classic cocktails in the Boston area. Closed in November 2008.', NULL, NULL, '92 Hampshire St', 'Cambridge', 'MA', 'US', true, 2008),
    ('barclacson.la', 'Bar Clacson', 'Downtown Los Angeles cocktail bar on Broadway from Eric Alperin and Richard Boccato, a 2017 Spirited Award finalist for Best New American Cocktail Bar.', NULL, 'Downtown', '351 S Broadway', 'Los Angeles', 'CA', 'US', false, NULL::int),
    ('barndiva.healdsburg', 'Barndiva', 'Healdsburg restaurant with a long focus on seasonality, with produce from its own farm in Philo feeding both kitchen and bar.', NULL, NULL, NULL, 'Healdsburg', 'CA', 'US', false, NULL::int),
    ('baruncommon.nola', 'Bar UnCommon', 'Hotel bar in the Renaissance Pere Marquette at Common and Baronne streets, where Chris McMillian led the bar. It has since closed.', NULL, 'Central Business District', NULL, 'New Orleans', 'LA', 'US', true, NULL::int),
    ('bellocq.nola', 'Bellocq', 'Cobbler-focused cocktail lounge from the Cure team in the Hotel Modern on Lee Circle, named for the Storyville photographer E.J. Bellocq. It opened in late 2011 with dozens of cobblers on the menu and closed in June 2016.', NULL, 'Lee Circle', NULL, 'New Orleans', 'LA', 'US', true, 2016),
    ('brick.and.mortar.cambridge', 'Brick & Mortar', 'Central Square cocktail bar opened by Patrick Sullivan''s team above Central Kitchen.', NULL, 'Central Square', NULL, 'Cambridge', 'MA', 'US', false, NULL::int),
    ('cafepacifico.amsterdam', 'Cafe Pacifico', 'Tomas Estes''s first Mexican restaurant and bar, opened in Amsterdam in 1976 and the start of the Cafe Pacifico group.', NULL, NULL, NULL, 'Amsterdam', 'North Holland', 'NL', false, NULL::int),
    ('canetable.nola', 'Cane & Table', 'French Quarter bar and restaurant from the Cure group, opened in 2013, built around rum and pre-tiki Caribbean drinks.', NULL, 'French Quarter', '1113 Decatur St', 'New Orleans', 'LA', 'US', false, NULL::int),
    ('cantina.sf', 'Cantina', 'Latin-leaning cocktail bar near Union Square, opened in 2007 by Duggan McDonnell and partners, known for pisco and fresh-juice drinks. It was sold at the end of 2015 and the space became Pacific Cocktail Haven in 2016.', NULL, 'Union Square', '580 Sutter St', 'San Francisco', 'CA', 'US', true, 2016),
    ('che.london', 'Che', 'London bar and restaurant whose bar, run by Nick Strangeway from 1998, won the Evening Standard''s Bar of the Year.', NULL, NULL, NULL, 'London', 'England', 'GB', true, NULL::int),
    ('crownshy.nyc', 'Crown Shy', 'Michelin-starred restaurant opened in 2019 by chef James Kent and Jeff Katz on the ground floor of the Art Deco tower at 70 Pine Street. Its bar team also built the programs for sister venues Saga and Overstory upstairs.', 'https://crownshy.nyc', 'Financial District', '70 Pine Street, New York, NY 10005', 'New York', 'NY', 'US', false, NULL::int),
    ('cyrus.healdsburg', 'Cyrus', 'Douglas Keane and Nick Peyton''s fine dining restaurant in Healdsburg, opened in 2005. Its seasonal bar under Scott Beattie drew national notice. The original restaurant closed in 2012.', NULL, NULL, NULL, 'Healdsburg', 'CA', 'US', true, 2012),
    ('door74.amsterdam', 'Door 74', 'Speakeasy behind an unmarked door off the Reguliersdwarsstraat, opened in 2008 by Philip Duff and Sergej Fokke. It was the first Dutch bar on the World''s 50 Best Bars list.', NULL, 'Centrum', NULL, 'Amsterdam', 'North Holland', 'NL', false, NULL::int),
    ('eastern.standard.boston', 'Eastern Standard', 'Brasserie and bar from Garrett Harker that opened in Kenmore Square in 2005 and became a high-volume classic cocktail landmark. It closed in 2020 and reopened at 775 Beacon St in 2023.', NULL, 'Kenmore', '775 Beacon St', 'Boston', 'MA', 'US', false, NULL::int),
    ('floridaroom.miami', 'The Florida Room', 'Basement lounge at the Delano hotel, designed with Lenny Kravitz and opened in 2007. Under John Lermayer its fresh cocktails helped move South Beach nightlife beyond vodka and energy drinks. It has since closed.', NULL, 'South Beach', NULL, 'Miami Beach', 'FL', 'US', true, NULL::int),
    ('forgery.sf', 'Forgery', 'PlumpJack Group cocktail bar on Mission Street, opened in May 2015 with Jacques Bezuidenhout as partner.', NULL, 'SoMa', '1525 Mission St', 'San Francisco', 'CA', 'US', false, NULL::int),
    ('frisson.sf', 'Frisson', 'San Francisco restaurant and lounge where Duggan McDonnell ran the bar before opening Cantina. It has since closed.', NULL, NULL, NULL, 'San Francisco', 'CA', 'US', true, NULL::int),
    ('fullers.seattle', 'Fuller''s', 'Restaurant in the Seattle Sheraton, opened in 1982, that launched a run of acclaimed Northwest chefs including Kathy Casey. Public dining ended in 2001.', NULL, 'Downtown', NULL, 'Seattle', 'WA', 'US', true, 2001),
    ('genuine.liquorette.nyc', 'Genuine Liquorette', 'AvroKO''s basement bar under Genuine Superette in Little Italy, opened in 2015 and known for canned cocktails and self-serve fridges.', NULL, 'Little Italy', '191 Grand St', 'New York', 'NY', 'US', true, NULL::int),
    ('grand.army.nyc', 'Grand Army', 'Boerum Hill corner bar for oysters and cocktails, opened in 2015 and named Imbibe''s Cocktail Bar of the Year for 2017.', NULL, 'Boerum Hill', NULL, 'New York', 'NY', 'US', false, NULL::int),
    ('green.street.cambridge', 'Green Street', 'Central Square restaurant and bar known for its long classic cocktail list.', NULL, 'Central Square', '280 Green St', 'Cambridge', 'MA', 'US', true, NULL::int),
    ('greenandred.london', 'Green & Red', 'Shoreditch Mexican cantina and tequila bar opened by Dre Masso in 2005.', NULL, 'Shoreditch', NULL, 'London', 'England', 'GB', false, NULL::int),
    ('happiest.hour.nyc', 'The Happiest Hour', 'West Village bar opened in 2014 by Jon Neidich and Jim Kearns, upstairs from Slowly Shirley.', NULL, 'West Village', '121 W 10th St', 'New York', 'NY', 'US', false, NULL::int),
    ('ilbistro.seattle', 'Il Bistro', 'Italian restaurant and bar tucked beneath Pike Place Market, open since 1975 and long one of Seattle''s most celebrated dining rooms.', NULL, 'Pike Place Market', '93 Pike St', 'Seattle', 'WA', 'US', false, NULL::int),
    ('island.creek.oyster.bar.boston', 'Island Creek Oyster Bar', 'Oyster bar in the Hotel Commonwealth in Kenmore Square, with a drinks list built around aperitifs, vermouth and Champagne. It shut in 2020 and did not reopen.', NULL, 'Kenmore', NULL, 'Boston', 'MA', 'US', true, 2020),
    ('lab.london', 'LAB', 'Soho cocktail bar, short for London Academy of Bartending, that ran from 1999 to 2016 and trained a generation of London bartenders.', NULL, 'Soho', NULL, 'London', 'England', 'GB', true, 2016),
    ('librarylounge.nola', 'Library Lounge, Ritz-Carlton New Orleans', 'Small wood-panelled bar in the Ritz-Carlton New Orleans where Chris McMillian made his name with classic drinks and a ceremonial Mint Julep. It has since closed.', NULL, 'French Quarter', NULL, 'New Orleans', 'LA', 'US', true, NULL::int),
    ('lonsdale.london', 'The Lonsdale', 'Notting Hill cocktail bar led by Henry Besant that won back-to-back Time Out bar awards in the early 2000s.', NULL, 'Notting Hill', NULL, 'London', 'England', 'GB', false, NULL::int),
    ('marksbar.london', 'Mark''s Bar', 'Basement bar beneath Mark Hix''s Soho restaurant, known for British ingredients and historic drinks. It closed with the restaurant in December 2019.', NULL, 'Soho', NULL, 'London', 'England', 'GB', true, 2019),
    ('mascafe.london', 'Mas Cafe', 'Notting Hill cafe bar opened by Henry Besant in 1993.', NULL, 'Notting Hill', NULL, 'London', 'England', 'GB', false, NULL::int),
    ('midnight.rambler.dallas', 'Midnight Rambler', 'Basement cocktail bar in The Joule hotel, opened in October 2014 by Chad Solomon and Christy Pope, with themed seasonal menus.', NULL, 'Downtown', NULL, 'Dallas', 'TX', 'US', false, NULL::int),
    ('milkandhoney.london', 'Milk & Honey', 'London offshoot of Sasha Petraske''s New York bar, opened in 2002 with Jonathan Downey behind an unmarked buzzer on Poland Street. It ran as a members'' club that took booked non-members early in the evening and helped set the standard for classic-cocktail bartending in London until it closed in 2020.', NULL, 'Soho', '61 Poland Street, London W1F 7NU', 'London', NULL, 'GB', true, 2020),
    ('mrcoco.lv', 'Mr. Coco', 'Cocktail lounge at the Palms opened in January 2019 by Francesco Lafranconi and named Eater''s best Las Vegas bar that year. It went dark when the pandemic closed the resort.', NULL, 'Palms', NULL, 'Las Vegas', 'NV', 'US', true, NULL::int),
    ('nopa.sf', 'Nopa', 'Busy restaurant in San Francisco''s NoPa neighbourhood whose bar became known around 2010 for house-made bitters, tinctures and liqueurs.', NULL, 'NoPa', NULL, 'San Francisco', 'CA', 'US', false, NULL::int),
    ('north.star.pub.nyc', 'North Star Pub', 'British-style pub at South Street Seaport where Gary Regan was bar manager.', NULL, 'South Street Seaport', NULL, 'New York', 'NY', 'US', false, NULL::int),
    ('obispo.sf', 'Obispo', 'Rum-focused bar from Thad Vogler in San Francisco''s Mission District. It closed during the pandemic.', NULL, 'Mission District', NULL, 'San Francisco', 'CA', 'US', true, NULL::int),
    ('opium.london', 'Opium Cocktail & Dim Sum Parlour', 'Chinatown cocktail and dim sum bar co-owned by Dre Masso with Eric Yu of The Breakfast Group.', NULL, 'Chinatown', NULL, 'London', 'England', 'GB', false, NULL::int),
    ('osteriamozza.la', 'Osteria Mozza', 'Italian restaurant in Hollywood from Nancy Silverton, Mario Batali and Joe Bastianich, opened in 2007.', NULL, 'Hollywood', NULL, 'Los Angeles', 'CA', 'US', false, NULL::int),
    ('ovenandshaker.pdx', 'Oven and Shaker', 'Pearl District pizzeria and cocktail bar opened in 2011 by Cathy Whims, Kurt Huffman and Ryan Magarian, with drinks grouped by style and recipes printed for guests. It announced its last service for 30 October 2026.', NULL, 'Pearl District', '1134 NW Everett St', 'Portland', 'OR', 'US', false, NULL::int),
    ('paparazzi.bratislava', 'Paparazzi', 'Bratislava cocktail bar shaped by Stanislav Vadrna, the subject of its own bar book.', NULL, NULL, NULL, 'Bratislava', 'Bratislava', 'SK', false, NULL::int),
    ('pebblebar.london', 'Pebble Bar', 'Soho bar linked to the Savoy group''s Stones Chop House, run for about 15 years by Peter Dorelli before he moved to the Savoy.', NULL, 'Soho', NULL, 'London', 'England', 'GB', true, 1980),
    ('prime.meats.nyc', 'Prime Meats', 'German-leaning restaurant and bar on Court Street from the Frankies team, with a respected cocktail program. Closed in 2018.', NULL, 'Carroll Gardens', '465 Court St', 'New York', 'NY', 'US', true, 2018),
    ('purl.london', 'Purl', 'Vaulted basement cocktail bar in Marylebone, opened in 2010 as Fluid Movement''s first bar and known for theatrical drinks.', NULL, 'Marylebone', '50-54 Blandford Street', 'London', 'England', 'GB', false, NULL::int),
    ('randolph.broome.nyc', 'The Randolph at Broome', 'Coffee and cocktail bar on Broome Street run by the Randolph group.', NULL, 'Nolita', '349 Broome St', 'New York', 'NY', 'US', true, NULL::int),
    ('redwoodroom.sf', 'Redwood Room', 'Historic bar in the Clift hotel near Union Square, panelled in redwood.', NULL, 'Union Square', NULL, 'San Francisco', 'CA', 'US', false, NULL::int),
    ('revel.nola', 'Revel Cafe & Bar', 'Small Mid-City bar and kitchen on Carrollton Avenue run by Chris and Laura McMillian, pairing classic cocktails with bar snacks.', NULL, 'Mid-City', '133 N Carrollton Ave', 'New Orleans', 'LA', 'US', false, NULL::int),
    ('sailingbar.sakurai', 'The Sailing Bar', 'Bar in Sakurai, Nara, open since 1994 and led by Takumi Watanabe, who mixes to order without a menu. Once members only, it is now open to the public.', NULL, 'Kibi', 'SHR Building 5F, 564-3 Kibi', 'Sakurai', 'Nara', 'JP', false, NULL::int),
    ('seamstress.nyc', 'Seamstress', 'Upper East Side cocktail bar opened in 2015 by the team behind The Gilroy, focused on American classics and new drinks by Pamela Wiznitzer.', NULL, 'Upper East Side', '339 E 75th St', 'New York', 'NY', 'US', true, NULL::int),
    ('shiseidoparlour.tokyo', 'Shiseido Parlour', 'Restaurant and cafe in Ginza run by the Shiseido company, with a cocktail bar where Kazuo Uyeda became chief bartender.', NULL, 'Ginza', NULL, 'Tokyo', 'Tokyo', 'JP', false, NULL::int),
    ('silver.lining.nyc', 'Silver Lining', 'Jazz and classic-cocktail bar in the basement of the Bogardus Mansion, opened in 2011 by Little Branch veterans with Sasha Petraske.', NULL, 'Tribeca', '75 Murray St', 'New York', 'NY', 'US', true, 2013),
    ('slanteddoor.sf', 'The Slanted Door', 'Charles Phan''s modern Vietnamese restaurant, which began on Valencia Street and later moved to the Ferry Building. Its early bar program helped set the pattern for seasonal, ingredient-led restaurant cocktails in San Francisco. The Ferry Building room closed in 2020.', NULL, 'Embarcadero', NULL, 'San Francisco', 'CA', 'US', true, 2020),
    ('slowly.shirley.nyc', 'Slowly Shirley', 'Art Deco cocktail lounge beneath The Happiest Hour, opened in 2014, with detailed themed menus by Jim Kearns.', NULL, 'West Village', '121 W 10th St', 'New York', 'NY', 'US', false, NULL::int),
    ('tailor.nyc', 'Tailor', 'Restaurant and cocktail bar on Broome Street from pastry chef Sam Mason, with drinks by Eben Freeman. Short lived but much copied for its smoke, fat-washing and savory flavors.', NULL, 'SoHo', '525 Broome St', 'New York', 'NY', 'US', true, 2009),
    ('tender.tokyo', 'Tender', 'Kazuo Uyeda''s Ginza bar, opened in 1997 and home of the hard shake. It closed its original room in 2020 and reopened nearby.', NULL, 'Ginza', NULL, 'Tokyo', 'Tokyo', 'JP', false, NULL::int),
    ('the.django.nyc', 'The Django', 'Jazz club and cocktail bar in the cellar of The Roxy Hotel, opened in 2015.', NULL, 'Tribeca', NULL, 'New York', 'NY', 'US', false, NULL::int),
    ('thevarnish.la', 'The Varnish', 'Small speakeasy behind an unmarked door in Cole''s French Dip, opened in 2009 by Eric Alperin, Sasha Petraske and Cedd Moses. Widely seen as the starting point of Los Angeles craft cocktails, it won Best American Cocktail Bar at Tales of the Cocktail in 2012 and closed in July 2024.', NULL, 'Downtown', NULL, 'Los Angeles', 'CA', 'US', true, 2024),
    ('tokyokaikan.tokyo', 'Tokyo Kaikan', 'Long-running banquet and dining hall in Marunouchi with a classic bar where Kazuo Uyeda began his career in 1966.', NULL, 'Marunouchi', NULL, 'Tokyo', 'Tokyo', 'JP', false, NULL::int),
    ('tresagaves.sf', 'Tres Agaves', 'Tequila-focused restaurant near the ballpark opened with Julio Bermejo, named Spirits Restaurant of the Year by Sante in 2006. It was renamed Tres in 2011.', NULL, NULL, NULL, 'San Francisco', 'CA', 'US', false, NULL::int),
    ('trounormand.sf', 'Trou Normand', 'Bar and restaurant from the Bar Agricole team, opened in March 2014 in the Pacific Telephone Building, known for house charcuterie and brandies sourced straight from small producers. It closed during the pandemic.', NULL, 'SoMa', '140 New Montgomery St', 'San Francisco', 'CA', 'US', true, NULL::int),
    ('wd50.nyc', 'wd~50', 'Wylie Dufresne''s experimental restaurant on Clinton Street, a training ground for modernist technique in food and drink.', NULL, 'Lower East Side', NULL, 'New York', 'NY', 'US', true, 2014),
    ('whistlingshop.london', 'Worship Street Whistling Shop', 'Victorian-styled Shoreditch basement bar with its own lab, run by Fluid Movement from 2010 until it closed in 2018.', NULL, 'Shoreditch', NULL, 'London', 'England', 'GB', true, 2018),
    ('zigzagcafe.seattle', 'Zig Zag Café', 'Cocktail bar on the Pike Street Hillclimb below Pike Place Market, open since 1999. Under owners Ben Dougherty and Kacy Fitch it became one of the first serious American craft cocktail bars, and the place where the Last Word was revived.', NULL, 'Pike Place Market', '1501 Western Ave', 'Seattle', 'WA', 'US', false, NULL::int)
) AS v("handle", "name", "bio", "website", "locality", "address_line", "city", "region", "country_code", "is_closed", "closed_year")
WHERE NOT EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.handle = v.handle);

-- --- 2. People ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "city")
SELECT 'person', v.handle, v.name, v.bio, v.website, true, v.city
FROM (VALUES
    ('brian.shebairo', 'Brian Shebairo', 'East Village restaurateur who founded the hot dog shop Crif Dogs. In 2007 he opened PDT (Please Don''t Tell) with Jim Meehan and Chris Antista, the bar reached through a phone booth inside Crif Dogs. He was a managing partner of PDT, including its Hong Kong outpost, until he sold PDT and Crif Dogs to Jeff Bell in 2020.', NULL, 'New York'),
    ('chris.mcmillian', 'Chris McMillian', 'Fourth generation bartender and drinks historian who settled in New Orleans in 1984. He spent eight years at the Library Lounge in the Ritz-Carlton, known for a Mint Julep made with a mallet and recited verse, and also led the bar at Bar UnCommon. He co-founded the Museum of the American Cocktail, co-wrote Lift Your Spirits, and opened Revel in Mid-City with his wife Laura.', NULL, 'New Orleans'),
    ('christy.pope', 'Christy Pope', 'Bartender trained in New York''s early craft bars, including Milk & Honey. With Chad Solomon and Sasha Petraske she founded the cocktail catering and consulting company Cuffs & Buttons, and in 2014 she and Solomon opened Midnight Rambler, a basement cocktail bar in The Joule hotel in Dallas.', NULL, 'Dallas'),
    ('colin.field', 'Colin Field', 'Bartender who reopened Bar Hemingway at the Ritz Paris in 1994 after a long closure and ran it until 2023, later also overseeing the hotel''s other bars. Trained at the Ferrandi school, he worked at Paris addresses such as Lasserre in the 1980s. He wrote The Cocktails of the Ritz Paris (2003) and Mixing Drinks, a Simple Story (2011), and still guest bartends and teaches.', NULL, 'Paris'),
    ('damon.boelte', 'Damon Boelte', 'Oklahoma-born bartender who started at The Electro Lounge in Oklahoma City before moving to Brooklyn. He ran the bar program at Prime Meats in Carroll Gardens and the cocktails at its sister restaurants, then in 2015 co-founded Grand Army in Boerum Hill, named Imbibe''s Cocktail Bar of the Year for 2017. He also co-hosted the radio show The Speakeasy.', NULL, 'New York'),
    ('dre.masso', 'Dre Masso', 'London bartender who came up at the Atlantic Bar & Grill and LAB in Soho before working at the Lonsdale, where he and Henry Besant set up the Worldwide Cocktail Club consultancy. He opened the tequila bar Green & Red in Shoreditch in 2005, co-owned Opium in Chinatown and led drinks for Bali''s Potato Head group for four years. He also helped create Olmeca Altos tequila.', NULL, 'London'),
    ('duggan.mcdonnell', 'Duggan McDonnell', 'San Francisco bartender and spirits maker. After running the bar at Frisson, he co-owned Cantina near Union Square from 2007 until selling it at the end of 2015, and co-founded San Francisco Cocktail Week. He co-founded Campo de Encanto pisco around 2010 and wrote Drinking the Devil''s Acre (2015), a history of the city through its drinks.', NULL, 'San Francisco'),
    ('eben.freeman', 'Eben Freeman', 'New York bartender known for bringing kitchen technique to the cocktail. After working at wd~50, he ran the drinks at Tailor in SoHo from 2007, where his smoked cola Waylon, fat-washed spirits and savory infusions drew wide attention. He later led bar programs for restaurant groups including Altamarea and AvroKO, the latter including Genuine Liquorette.', NULL, 'New York'),
    ('eric.alperin', 'Eric Alperin', 'New York born bartender who trained under Sasha Petraske at Milk & Honey and Little Branch before moving to Los Angeles. He ran the opening drinks program at Osteria Mozza, then in 2009 opened The Varnish with Petraske and Cedd Moses, a bar that shaped the city''s craft cocktail scene until it closed in 2024. He also opened Bar Clacson with Richard Boccato and wrote the memoir Unvarnished.', NULL, 'Los Angeles'),
    ('francesco.lafranconi', 'Francesco Lafranconi', 'Italian born bartender and educator who moved to Las Vegas in 2000 to lead mixology education for Southern Wine & Spirits, where he founded its Academy of Spirits and Fine Service. In 2019 he opened his own lounge, Mr. Coco, at the Palms, named Eater''s best Las Vegas bar that year. He later joined Carver Road Hospitality to run its beverage programs.', NULL, 'Las Vegas'),
    ('gary.regan', 'Gary "gaz" Regan', 'English-born bartender and writer who started tending bar in his teens, moved to New York in the 1970s and managed the North Star Pub at South Street Seaport. He wrote The Bartender''s Bible, The Joy of Mixology and The Negroni, created Regans'' Orange Bitters No. 6 with Sazerac, and mentored bartenders worldwide through his Cocktails in the Country classes. He died in 2019.', NULL, 'New York'),
    ('henry.besant', 'Henry Besant', 'London bar operator who opened Mas Cafe in Notting Hill in 1993, ran the members club 57 Jermyn Street and later led the Lonsdale, which won back-to-back Time Out bar awards. With Dre Masso he founded the Worldwide Cocktail Club consultancy, co-wrote Margarita Rocks (2005) and helped create Olmeca Altos tequila and the Tahona Society. He died in 2013, aged 40.', NULL, 'London'),
    ('jackson.cannon', 'Jackson Cannon', 'Boston bar leader who came to bartending from music. He opened Eastern Standard in Kenmore Square as bar manager in 2005, later became bar director there and at Island Creek Oyster Bar, and was a partner in The Hawthorne, which opened in 2011. He co-founded the Jack Rose Society and was named Bartender of the Year by Nightclub & Bar in 2011.', NULL, 'Boston'),
    ('jacques.bezuidenhout', 'Jacques Bezuidenhout', 'South African bartender who worked in London before settling in San Francisco in the late 1990s. He opened and ran the bar at Tres Agaves with Julio Bermejo, which won Sante''s Spirits Restaurant of the Year in 2006, then oversaw drinks for Kimpton Hotels and was Partida Tequila''s ambassador. In 2015 he opened Forgery as a partner with the PlumpJack Group.', NULL, 'San Francisco'),
    ('jason.littrell', 'Jason Littrell', 'New York bartender who led the bar team at The Randolph at Broome and tended bar at Death & Co and Dram in Brooklyn. He later moved into events and consulting, served as president of the United States Bartenders'' Guild, and wrote Bartender as a Business.', NULL, 'New York'),
    ('jim.kearns', 'Jim Kearns', 'New York bartender who learned high-volume classic bartending at Pegu Club and also worked at Death & Co in its first days and at Mayahuel. In 2014 he became beverage director and partner at The Happiest Hour in the West Village and Slowly Shirley, the 1940s-styled cocktail lounge below it, where he has written themed menus such as a film noir list.', NULL, 'New York'),
    ('john.lermayer', 'John Lermayer', 'Bartender who helped turn Miami Beach toward fresh, serious cocktails. After moving from New York in 2004 to tend bar at Skybar, he built the drinks at the Florida Room in the Delano, then co-founded Sweet Liberty in 2015, which won Best American High Volume Cocktail Bar at Tales of the Cocktail and made the World''s 50 Best Bars in 2017. He died in 2018 and entered the Bartender Hall of Fame in 2024.', NULL, 'Miami Beach'),
    ('kathy.casey', 'Kathy Casey', 'Seattle chef often called the first bar chef for bringing kitchen technique and fresh ingredients to cocktails in the early 1990s. In the 1980s she was one of the head chefs at Fuller''s in the Seattle Sheraton. She runs Kathy Casey Food Studios and Liquid Kitchen, a food and drink development agency, hosted the web series Kathy Casey''s Liquid Kitchen, and has written many cookbooks.', NULL, 'Seattle'),
    ('kazuo.uyeda', 'Kazuo Uyeda', 'Tokyo bartender credited with the hard shake, a stylised way of working a three-piece shaker meant to aerate and soften a drink. He started at Tokyo Kaikan in 1966, became chief bartender at Shiseido Parlour and opened Tender in Ginza in 1997. His colourful City Coral won the All Nippon Bartenders Association competition, and his book Cocktail Techniques reached English readers in 2010.', NULL, 'Tokyo'),
    ('kirk.estopinal', 'Kirk Estopinal', 'New Orleans bartender who joined the opening team at The Violet Hour in Chicago after Hurricane Katrina, then came home to open Cure in 2009 and became a partner within its first year. He went on to partner in Bellocq, a cobbler bar, and Cane & Table. With Maks Pazuniak he self-published Rogue Cocktails in 2009, a book of bold, bitters-heavy drinks.', NULL, 'New Orleans'),
    ('misty.kalkofen', 'Misty Kalkofen', 'Boston bartender and cocktail historian who joined the opening staff of the B-Side Lounge in 1998, managed the bar at Green Street and spent about three years at Drink before moving to Brick & Mortar. She created the mezcal Maximilian Affair, co-wrote Drinking Like Ladies (2018), and later worked in mezcal and industry education.', NULL, 'Boston'),
    ('murray.stenson', 'Murray Stenson', 'Seattle bartender whose career ran from the mid 1970s to the pandemic. He ran the bar at Il Bistro in Pike Place Market for about a decade, then led the bar at Zig Zag Café through the 2000s, where his menu brought the forgotten Last Word back into circulation. Named best American bartender at Tales of the Cocktail in 2010, he later worked at Canon. He died in 2023.', NULL, 'Seattle'),
    ('neyah.white', 'Neyah White', 'San Francisco bartender who came to drinks from restaurant kitchens. After working the Redwood Room and Bourbon & Branch, he became bar manager at Nopa, where his house-made bitters, tinctures and liqueurs drew wide notice around 2010. He later left Nopa to represent Suntory''s Japanese whiskies and taught classes with Duggan McDonnell.', NULL, 'San Francisco'),
    ('nick.strangeway', 'Nick Strangeway', 'London bartender who learned under Dick Bradsell at Fred''s Club from 1988 and followed him through Soho bars including the Atlantic Bar & Grill. He ran the bar at Che from 1998, opened Hawksmoor in Spitalfields as its first manager in 2006 and led Mark Hix''s Mark''s Bar in Soho. He won International Bartender of the Year at Tales of the Cocktail in 2008 and co-created Hepple Gin.', NULL, 'London'),
    ('pam.wiznitzer', 'Pamela Wiznitzer', 'New York bartender who moved into bars after a marketing career, working at Empellon and on the opening team of The Dead Rabbit. She then built the cocktail list at Seamstress on the Upper East Side, which opened in 2015. She has led the United States Bartenders'' Guild as New York chapter president and later national president.', NULL, 'New York'),
    ('peter.dorelli', 'Peter Dorelli', 'Rome-born bartender who led the American Bar at the Savoy in London for almost two decades. He ran the Pebble Bar in Soho for about 15 years before joining the Savoy around 1980, became head bartender in 1984 and retired in 2003, when his deputy Salim Khoury took over. He revised an edition of The Savoy Cocktail Book and later worked in bartender education with the UK Bartenders'' Guild.', NULL, 'London'),
    ('philip.duff', 'Philip Duff', 'Drinks educator who founded Liquid Solutions, the first bar consultancy in the Netherlands, in 1999 and co-founded the Amsterdam speakeasy Door 74 with Sergej Fokke around 2008. Door 74 became the first Dutch bar on the World''s 50 Best Bars list. A genever specialist, he launched Old Duff Genever and has served as director of education for Tales of the Cocktail.', NULL, NULL),
    ('ryan.magarian', 'Ryan Magarian', 'Portland bartender and bar consultant who co-created Aviation Gin with House Spirits Distillery in 2006. In 2011 he opened Oven and Shaker, a pizza and cocktail spot, with chef Cathy Whims and Kurt Huffman, printing house recipes on the menu so guests could make them at home. He has consulted on bar programs from Singapore to Phoenix.', NULL, 'Portland'),
    ('scott.beattie', 'Scott Beattie', 'Sonoma County bartender who made his name with hyper-seasonal, garden-driven drinks at Cyrus in Healdsburg from its 2005 opening. Before that he worked at Postrio and Martini House. His 2008 book Artisanal Cocktails gathers about 50 Cyrus recipes built on local produce and spirits. He later ran the drinks at Barndiva and estate events at Meadowood.', NULL, 'Healdsburg'),
    ('stanislav.vadrna', 'Stanislav Vadrna', 'Slovak bartender who trained in Japan and became a leading Western advocate of Japanese bar craft, organising Kazuo Uyeda''s hard shake seminars in Bratislava and New York. He is credited with shaping the Bratislava cocktail bar Paparazzi, founded the Analog Bartending Institute and has worked as Nikka Whisky''s global hospitality advocate.', NULL, 'Bratislava'),
    ('takumi.watanabe', 'Takumi Watanabe', 'Japanese bartender at The Sailing Bar in Sakurai, Nara, where he has worked since it opened in 1994 and is known for making drinks to suit each guest rather than from a menu. He devised Takumi''s Aviation for Diageo World Class in 2010, a drink later published by Gary Regan, and was once an ambassador for Nikka''s Taketsuru whisky.', NULL, 'Sakurai'),
    ('thad.vogler', 'Thad Vogler', 'San Francisco bar owner known for building drinks around farm-made spirits and their place of origin. He ran the bar at The Slanted Door from 2001, opened Bar Agricole in 2010 (three James Beard nominations for its bar program) and Trou Normand in 2014, and wrote By the Smoke and the Smell. He co-wrote a set of service rules with Erik Adkins.', NULL, 'San Francisco'),
    ('tomas.estes', 'Tomas Estes', 'Restaurateur who opened the first Cafe Pacifico in Amsterdam in 1976 and took it to London''s Covent Garden in 1982, helping introduce Europe to agave spirits. Mexico''s tequila industry chamber named him a Tequila Ambassador in 2003, and in 2008 he co-founded Tequila Ocho with Carlos Camarena. He wrote The Tequila Ambassador and died in 2021.', NULL, 'Amsterdam'),
    ('tristan.stephenson', 'Tristan Stephenson', 'Bartender and author who began in Cornwall, running the bar at Fifteen Cornwall around 2007. In 2009 he co-founded the consultancy Fluid Movement, whose bars include Purl in Marylebone (2010), the Worship Street Whistling Shop in Shoreditch and the whisky bar Black Rock. He writes the Curious Bartender book series, which began in 2013.', NULL, 'London'),
    ('vito.dieterle', 'Vito Dieterle', 'Tenor saxophonist and bar operator who has led a weekly jazz band at Little Branch since 2005. With fellow Little Branch veteran Joseph Schwartz and Sasha Petraske he opened Silver Lining, a jazz and classic-cocktail bar in Tribeca (2011 to 2013), and in 2015 he and Schwartz opened The Django, a jazz club in The Roxy Hotel.', NULL, 'New York')
) AS v("handle", "name", "bio", "website", "city")
WHERE NOT EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.handle = v.handle);

-- --- 3. Jobs ---

-- Each was researched from the press as a public career, so a past one shows
-- (is_shown); the person can switch it off once they claim the profile.

INSERT INTO "public"."profile_positions" ("person_profile_id", "bar_profile_id", "title", "is_current", "is_shown", "source_url")
SELECT pp.id, bp.id, v.title, v.is_current, NOT v.is_current, v.source_url
FROM (VALUES
    ('brian.shebairo', 'pdtnyc', 'Co-founder', false, 'https://en.wikipedia.org/wiki/Please_Don%27t_Tell'),
    ('chris.hannah', 'thefrench75bar', 'Head bartender', false, 'https://punchdrink.com/articles/bywater-new-orleans-nola-rum-cocktail/'),
    ('chris.mcmillian', 'baruncommon.nola', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Chris_McMillian'),
    ('chris.mcmillian', 'librarylounge.nola', 'Head bartender', false, 'https://imbibemagazine.com/?p=11460'),
    ('chris.mcmillian', 'revel.nola', 'Co-owner', false, 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-19'),
    ('christy.pope', 'midnight.rambler.dallas', 'Co-owner', false, 'https://www.restaurant-hospitality.com/drink-trends/inside-dallas-edgy-midnight-rambler-cocktail-bar'),
    ('christy.pope', 'milkandhoney.nyc', 'Bartender', false, 'https://www.restaurant-hospitality.com/drink-trends/inside-dallas-edgy-midnight-rambler-cocktail-bar'),
    ('colin.field', 'barhemingway', 'Head bartender', false, 'https://www.journaldespalaces.com/communique-66925-france-nominations-anne-sophie-prestail-la-releve-du-bar-hemingway.html'),
    ('damon.boelte', 'grand.army.nyc', 'Co-founder', false, 'https://imbibemagazine.com/inside-look-grand-army-bar-nyc/'),
    ('damon.boelte', 'prime.meats.nyc', 'Bar director', false, 'https://brooklynbased.com/?p=65448'),
    ('dick.bradsell', 'flamingobar.london', 'Bartender', false, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-437'),
    ('dre.masso', 'atlantic.london', 'Bartender', false, 'https://jobs.barcats.com.au/community/latest-news/a-chat-with-industry-legend-dre-masso-2/'),
    ('dre.masso', 'greenandred.london', 'Owner', false, 'https://jobs.barcats.com.au/community/latest-news/a-chat-with-industry-legend-dre-masso-2/'),
    ('dre.masso', 'lab.london', 'Bartender', false, 'https://jobs.barcats.com.au/community/latest-news/a-chat-with-industry-legend-dre-masso-2/'),
    ('dre.masso', 'lonsdale.london', 'Bartender', false, 'https://jobs.barcats.com.au/community/latest-news/a-chat-with-industry-legend-dre-masso-2/'),
    ('dre.masso', 'opium.london', 'Co-owner', false, 'https://jobs.barcats.com.au/community/latest-news/a-chat-with-industry-legend-dre-masso-2/'),
    ('dre.masso', 'potatoheadbali', 'Head of bars', false, 'https://www.diffordsguide.com/encyclopedia/2683/people/dre-masso'),
    ('duggan.mcdonnell', 'cantina.sf', 'Co-owner', false, 'https://www.tablehopper.com/quick-bar-updates-alembics-temporary-closure-fire-at-the-riptide-cantinas-new-owner/'),
    ('duggan.mcdonnell', 'frisson.sf', 'Bar manager', false, 'https://imbibemagazine.com/new-bar-cantina-san-francisco/'),
    ('eben.freeman', 'genuine.liquorette.nyc', 'Beverage director', false, 'https://timeout.com/newyork/blog/bartender-tales-eben-freeman-of-genuine-liquorette-032316'),
    ('eben.freeman', 'tailor.nyc', 'Bar director', false, 'https://punchdrink.com/articles/most-influential-failed-bar-tailor-nyc/'),
    ('eben.freeman', 'wd50.nyc', 'Bartender', false, 'https://punchdrink.com/articles/most-influential-failed-bar-tailor-nyc/'),
    ('eric.alperin', 'barclacson.la', 'Co-owner', false, 'https://punchdrink.com/news/daily-news-future-boxed-vodka-eric-alperin-richard-boccatos-new-bar/'),
    ('eric.alperin', 'littlebranch.nyc', 'Bartender', false, 'https://www.diffordsguide.com/encyclopedia/2746/people/eric-alperin'),
    ('eric.alperin', 'milkandhoney.nyc', 'Bartender', false, 'https://www.diffordsguide.com/encyclopedia/2746/people/eric-alperin'),
    ('eric.alperin', 'osteriamozza.la', 'Bar manager', false, 'https://www.diffordsguide.com/encyclopedia/2746/people/eric-alperin'),
    ('eric.alperin', 'thevarnish.la', 'Co-owner', false, 'https://www.aol.com/news/why-l-most-influential-cocktail-234936346.html'),
    ('francesco.lafranconi', 'mrcoco.lv', 'Owner', false, 'https://carverroad.com/?p=1357'),
    ('frank.meier', 'ritzbar.paris', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Frank_Meier'),
    ('gary.regan', 'north.star.pub.nyc', 'Bar manager', false, 'https://en.wikipedia.org/wiki/Gary_Regan'),
    ('harrison.ginsberg', 'crownshy.nyc', 'Bar director', false, 'https://vinepair.com/articles/2022-next-wave-harrison-ginsberg'),
    ('henry.besant', 'lonsdale.london', 'Director', false, 'https://www.diffordsguide.com/people/3030/henry-besant'),
    ('henry.besant', 'mascafe.london', 'Owner', false, 'https://en.wikipedia.org/wiki/Henry_Besant'),
    ('jackson.cannon', 'bar500a', 'Partner', false, 'https://punchdrink.com/lookbook/jackson-cannon-beverage-director-eastern-standard-island-creek-oyster-bar-boston/'),
    ('jackson.cannon', 'eastern.standard.boston', 'Bar manager', false, 'https://www.diffordsguide.com/encyclopedia/2797/people/jackson-cannon'),
    ('jackson.cannon', 'eastern.standard.boston', 'Bar director', false, 'https://punchdrink.com/lookbook/jackson-cannon-beverage-director-eastern-standard-island-creek-oyster-bar-boston/'),
    ('jackson.cannon', 'island.creek.oyster.bar.boston', 'Bar director', false, 'https://punchdrink.com/lookbook/jackson-cannon-beverage-director-eastern-standard-island-creek-oyster-bar-boston/'),
    ('jacques.bezuidenhout', 'forgery.sf', 'Partner', false, 'https://www.tablehopper.com/lush/forgery-from-the-plumpjack-group-now-open-in-mid-market/'),
    ('jacques.bezuidenhout', 'tresagaves.sf', 'Bar manager', false, 'https://www.foodgps.com/interview-bartender-jacques-bezuidenhout'),
    ('jason.littrell', 'deathandcompany', 'Bartender', false, 'https://www.barbizmag.com/news/a-new-generation-of-special-events-gurus/'),
    ('jason.littrell', 'dram.brooklyn', 'Bartender', false, 'https://heritageradionetwork.org/podcast/mcc-2013-preview-jason-littrell'),
    ('jason.littrell', 'randolph.broome.nyc', 'Head bartender', false, 'https://www.barbizmag.com/news/a-new-generation-of-special-events-gurus/'),
    ('jim.kearns', 'deathandcompany', 'Bartender', false, 'https://www.ediblemanhattan.com/?p=69483'),
    ('jim.kearns', 'happiest.hour.nyc', 'Beverage director', false, 'https://www.timeout.com/newyork/blog/bartender-tales-jim-kearns-of-the-happiest-hour-and-slowly-shirley-032316'),
    ('jim.kearns', 'mayahuel.nyc', 'Bartender', false, 'https://www.ediblemanhattan.com/?p=69483'),
    ('jim.kearns', 'pegu.club.nyc', 'Bartender', false, 'https://www.ediblemanhattan.com/?p=69483'),
    ('jim.kearns', 'slowly.shirley.nyc', 'Beverage director', false, 'https://www.timeout.com/newyork/blog/bartender-tales-jim-kearns-of-the-happiest-hour-and-slowly-shirley-032316'),
    ('jim.kearns', 'slowly.shirley.nyc', 'Partner', false, 'https://viewing.nyc/this-sober-bartender-runs-one-of-new-york-citys-best-cocktail-bars-slowly-shirley/'),
    ('joaquin.simo', 'deathandcompany', 'Bartender', false, 'https://punchdrink.com/articles/kingston-negroni-became-modern-classic-jamaican-rum-cocktail-recipe/'),
    ('joaquin.simo', 'pouring_ribbons', 'Partner', false, 'https://punchdrink.com/lookbook/joaquin-simo-owner-pouring-ribbons-bar-alchemy-consulting-nyc/'),
    ('john.lermayer', 'floridaroom.miami', 'Head bartender', false, 'https://www.miaminewtimes.com/restaurants/miami-beach-bartender-john-lermayer-found-dead-10419241'),
    ('john.lermayer', 'sweetlibertymia', 'Co-founder', false, 'https://www.miaminewtimes.com/restaurants/miami-beach-bartender-john-lermayer-found-dead-10419241'),
    ('kathy.casey', 'fullers.seattle', 'Head chef', false, 'https://archive.seattletimes.com/archive/20011031/taste310/fullers-public-dining-will-be-just-a-memory-after-saturday'),
    ('kazuo.uyeda', 'shiseidoparlour.tokyo', 'Chief bartender', false, 'https://whiskymag.com/articles/the-way-of-the-cocktail/'),
    ('kazuo.uyeda', 'tender.tokyo', 'Owner', false, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-224'),
    ('kazuo.uyeda', 'tokyokaikan.tokyo', 'Bartender', false, 'https://whiskymag.com/articles/the-way-of-the-cocktail/'),
    ('kevin.armstrong', 'milkandhoney.london', 'Bartender', false, 'https://en.wikipedia.org/wiki/Satan%27s_Whiskers'),
    ('kirk.estopinal', 'bellocq.nola', 'Partner', false, 'https://bevinfogroup.com/2012/08/26/scene-bellocq-blows-into-new-orleans/'),
    ('kirk.estopinal', 'canetable.nola', 'Partner', true, 'https://www.offbeat.com/articles/dining-out-cane-table/'),
    ('kirk.estopinal', 'curenola', 'Partner', false, 'https://thedailybeast.com/james-beard-award-winning-bar-cure-turns-10'),
    ('kirk.estopinal', 'violethourchicago', 'Bartender', false, 'https://bizneworleans.com/tales-of-the-cure/'),
    ('misty.kalkofen', 'b.side.lounge.cambridge', 'Bartender', false, 'https://beveragealcoholresource.com/who-we-are/who-we-are-misty/'),
    ('misty.kalkofen', 'brick.and.mortar.cambridge', 'Bartender', false, 'https://www.diffordsguide.com/encyclopedia/2748/people/misty-kalkofen'),
    ('misty.kalkofen', 'drink.boston', 'Bartender', false, 'https://www.diffordsguide.com/encyclopedia/2748/people/misty-kalkofen'),
    ('misty.kalkofen', 'green.street.cambridge', 'Bar manager', false, 'https://www.diffordsguide.com/encyclopedia/2748/people/misty-kalkofen'),
    ('murray.stenson', 'canonseattle', 'Bartender', false, 'https://www.seattlemet.com/eat-and-drink/2023/09/remembering-legendary-barman-murray-stenson'),
    ('murray.stenson', 'ilbistro.seattle', 'Bar manager', false, 'https://spiritsanddistilling.com/dictionary/id/acref-9780199311132-e-29'),
    ('murray.stenson', 'zigzagcafe.seattle', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Murray_Stenson'),
    ('neyah.white', 'bourbonandbranch', 'Bartender', false, 'https://www.seattlemet.com/eat-and-drink/2010/02/five-questions-bartender-neyah-white-021512'),
    ('neyah.white', 'nopa.sf', 'Bar manager', false, 'https://foodgps.com/interview-bartender-yanni-kehagiaris/'),
    ('neyah.white', 'redwoodroom.sf', 'Bartender', false, 'https://www.seattlemet.com/eat-and-drink/2010/02/five-questions-bartender-neyah-white-021512'),
    ('nick.strangeway', 'atlantic.london', 'Bartender', false, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-30'),
    ('nick.strangeway', 'che.london', 'Bar manager', false, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-30'),
    ('nick.strangeway', 'hawksmoorrestaurants', 'General manager', false, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-30'),
    ('nick.strangeway', 'marksbar.london', 'Bar director', false, 'https://www.cubitthouse.co.uk/introducing-cubitt-house-drinks-with/'),
    ('pam.wiznitzer', 'seamstress.nyc', 'Creative director', false, 'https://punchdrink.com/articles/pamela-wiznitzer-seamstress-nyc-usbg-president/'),
    ('pam.wiznitzer', 'thedeadrabbitny', 'Bartender', false, 'https://punchdrink.com/articles/three-drink-minimum-pamela-wiznitzer-bartender-seamstress-nyc-usbg/'),
    ('peter.dorelli', 'americanbarsavoy', 'Head bartender', false, 'https://www.diffordsguide.com/encyclopedia/2663/people/peter-dorelli'),
    ('peter.dorelli', 'pebblebar.london', 'Head bartender', false, 'https://www.diffordsguide.com/encyclopedia/2663/people/peter-dorelli'),
    ('philip.duff', 'door74.amsterdam', 'Co-founder', false, 'https://www.diffordsguide.com/encyclopedia/1390/people/philip-duff'),
    ('ryan.magarian', 'ovenandshaker.pdx', 'Co-owner', true, 'https://whatnow.com/?p=437674'),
    ('scott.beattie', 'barndiva.healdsburg', 'Beverage director', false, 'https://sonomawinegrape.org/foraging-for-cocktails/'),
    ('scott.beattie', 'cyrus.healdsburg', 'Bar manager', false, 'https://www.sonomamag.com/cyrus-famous-bartender-has-left-the-building/'),
    ('stanislav.vadrna', 'paparazzi.bratislava', 'Bartender', false, 'https://www.martinus.sk/295831-paparazzi-bar-book-v-anglickom-jazyku/kniha'),
    ('takumi.watanabe', 'sailingbar.sakurai', 'Head bartender', true, 'https://en.wikipedia.org/wiki/Takumi_Watanabe_(bartender)'),
    ('thad.vogler', 'baragricole', 'Owner', false, 'https://sfstandard.com/2022/08/16/bar-agricole-returns-after-controversy-and-covid-shutdowns-a-32-cocktail-leads-the-way/'),
    ('thad.vogler', 'obispo.sf', 'Owner', false, 'https://sfstandard.com/2022/08/16/bar-agricole-returns-after-controversy-and-covid-shutdowns-a-32-cocktail-leads-the-way/'),
    ('thad.vogler', 'slanteddoor.sf', 'Bar manager', false, 'https://www.goodbeerhunting.com/blog/2019/9/12/like-painting-on-black-velvet-how-the-bay-areas-cocktail-culture-grew-up-one-gin-at-a-time'),
    ('thad.vogler', 'trounormand.sf', 'Owner', false, 'https://sfist.com/2014/03/11/bar_agricole_spinoff_trou_normand_o.php'),
    ('tomas.estes', 'cafepacifico.amsterdam', 'Founder', false, 'https://cluboenologique.com/story/obituary-tomas-estes-1945-2021/'),
    ('tomas.estes', 'officialcafepacifico', 'Founder', false, 'https://cluboenologique.com/story/obituary-tomas-estes-1945-2021/'),
    ('tristan.stephenson', 'blackrockbars', 'Co-founder', false, 'https://www.thespiritsbusiness.com/2017/03/tristan-stephenson-joins-lidls-spirits-team'),
    ('tristan.stephenson', 'purl.london', 'Co-owner', false, 'https://www.diffordsguide.com/people/12887/bartender/tristan-stephenson'),
    ('tristan.stephenson', 'whistlingshop.london', 'Co-owner', false, 'https://www.diffordsguide.com/people/12887/bartender/tristan-stephenson'),
    ('vito.dieterle', 'silver.lining.nyc', 'Co-owner', false, 'https://tribecacitizen.com/2011/08/04/first-impressions-silver-lining/'),
    ('vito.dieterle', 'the.django.nyc', 'Co-founder', false, 'https://tribecacitizen.com/?p=99274')
) AS v("person", "bar", "title", "is_current", "source_url")
JOIN "public"."profiles" pp ON pp.handle = v.person AND pp.kind = 'person'
JOIN "public"."profiles" bp ON bp.handle = v.bar AND bp.kind = 'bar'
WHERE NOT EXISTS (SELECT 1 FROM "public"."profile_positions" x WHERE x.person_profile_id = pp.id AND x.bar_profile_id = bp.id)
ON CONFLICT ("person_profile_id", "bar_profile_id", "title") DO NOTHING;

-- --- 4. Their drinks ---

CREATE TEMP TABLE "lg_drinks" ("key" text PRIMARY KEY, "name" text NOT NULL, "year" int, "approx" boolean, "creator" text, "co" text[], "bar" text,
    "src" text, "description" text, "notes" text, "glass" text, "ice" text, "method" text, "catalog" boolean, "item_id" uuid, "is_new" boolean DEFAULT false);
-- catalog: a verified spec, so it joins the classics. The rest are shared
-- drinks credited to their maker (and bar), like the signature drinks seed.
INSERT INTO "lg_drinks" ("key", "name", "year", "approx", "creator", "co", "bar", "src", "description", "notes", "glass", "ice", "method", "catalog") VALUES
    ('campari-stinger', 'Campari Stinger', 2013, true, 'christy.pope', ARRAY[]::text[], NULL, 'https://imbibemagazine.com/campari-stinger-recipe/', 'A Stinger reworked with Campari, Cognac, fresh mint and a little maple syrup over crushed ice.', 'Pope made it through her catering company Cuffs & Buttons rather than at a bar. Fresh muddled mint takes the place of creme de menthe, and Campari adds bitterness to the brandy.', 'Rocks', 'Crushed', 'Shake', true),
    ('city.coral', 'City Coral', NULL, true, 'kazuo.uyeda', ARRAY[]::text[], NULL, 'https://www.tastingtable.com/entry_detail/dc/1629', 'A vividly coloured competition cocktail with blue curacao and a thick coral-style salt rim.', 'Uyeda won first place in the All Nippon Bartenders Association cocktail competition with this drink. It shows his love of bold colour and the coral garnish he is credited with, where salt is packed thickly onto the glass.', NULL, NULL, NULL, false),
    ('clandestino-old-fashioned', 'Clandestino Old Fashioned', NULL, true, 'jason.littrell', ARRAY[]::text[], 'deathandcompany', 'https://kindredcocktails.com/node/3433', 'A bourbon and rye Old Fashioned seasoned with Campari and cinnamon and vanilla syrups.', 'Littrell made it during his time behind the bar at Death & Co. A small measure of Campari and two spice syrups turn a two-whiskey Old Fashioned toward dessert.', 'Rocks', 'Large cube', 'Stir', true),
    ('colonial-affair', 'Colonial Affair', NULL, true, 'joaquin.simo', ARRAY[]::text[], 'pouring_ribbons', 'https://punchdrink.com/recipes/colonial-affair/', 'A Twentieth Century riff with pisco and cacao spirit in place of gin, plus white creme de cacao, Lillet Rose and lemon.', 'Simo made it at Pouring Ribbons, splitting the base between pisco and a spirit distilled from cacao fruit so the chocolate note comes from two directions.', 'Coupe', 'None', 'Shake', true),
    ('corleone', 'Corleone', 2011, true, 'ryan.magarian', ARRAY[]::text[], 'ovenandshaker.pdx', 'https://www.pdxmonthly.com/eat-and-drink/2011/12/ryan-magarian-oven-shaker-january-2012', 'A fresh, fruit-led gin drink of muddled green grapes, grappa, citrus and bitters.', 'Magarian put it on the opening menu at Oven and Shaker in the fresh category, one of four styles he used to sort the list. The grape and grappa pairing nods to the Italian kitchen next door. Like the rest of the menu, its recipe was printed for guests to make at home.', NULL, NULL, NULL, false),
    ('debonair', 'Debonair', 1995, true, 'gary.regan', ARRAY[]::text[], NULL, 'https://scotchwhisky.com/magazine/cocktails/11823/the-debonair-revisited/', 'A stirred two-ingredient drink of single malt Scotch and ginger liqueur.', 'Regan worked it out in Manhattan in the 1990s and first made it on a television segment about single malts. He tried several joke names before settling on one found in a thesaurus, and later reworked the idea into a newer drink called the Thrust and Parry.', 'Coupe', 'None', 'Stir', true),
    ('glasgow-mule', 'Glasgow Mule', NULL, true, 'damon.boelte', ARRAY[]::text[], 'prime.meats.nyc', 'https://punchdrink.com/recipes/glasgow-mule/', 'A mule built on blended Scotch with elderflower liqueur, lemon and ginger beer over crushed ice.', 'Boelte kept the familiar mule formula and swapped in Scotch, which gives the drink its name. It was served at Prime Meats in Carroll Gardens.', 'Copper mug', 'Crushed', 'Build', true),
    ('gunshop.fizz', 'Gunshop Fizz', 2009, true, 'kirk.estopinal', ARRAY[]::text[], 'curenola', 'https://punchdrink.com/recipes/gunshop-fizz/', 'A tall, muddled fizz that uses two full ounces of Peychaud''s bitters as its base, topped with Sanbitter.', 'Estopinal and Maks Pazuniak made it while tending bar at Cure, and it became the calling card of their self-published Rogue Cocktails in 2009. The idea came from an old Angostura Fizz, filtered through the Pimm''s Cup Estopinal had poured at The Violet Hour. Treating bitters as the main spirit made it a talking point for a new wave of bartenders.', 'Collins', 'Cubed', 'Shake', true),
    ('keep.your.dreams.a.burnin', 'Keep Your Dreams A Burnin''', NULL, false, 'kirk.estopinal', ARRAY[]::text[], NULL, 'https://kindredcocktails.com/cocktail/keep-your-dreams-burnin', 'A sherry cobbler built on bone-dry manzanilla, with funky Jamaican rum, orgeat and Angostura.', 'Estopinal''s take on the Sherry Cobbler, a style he worked through at length when he wrote the cobbler list for Bellocq. The small dose of rum and almond syrup gives the light sherry more weight while keeping it low in alcohol. It is served heaped with crushed ice and dressed with lemon, cinnamon and powdered sugar.', 'Julep cup', 'Crushed', 'Shake', true),
    ('kingston-negroni', 'Kingston Negroni', 2009, true, 'joaquin.simo', ARRAY[]::text[], 'deathandcompany', 'https://punchdrink.com/articles/kingston-negroni-became-modern-classic-jamaican-rum-cocktail-recipe/', 'A Negroni made with funky Jamaican rum in place of gin.', 'Simo built it on the spot at Death & Co after an importer handed him a bottle of Smith & Cross. Accounts date it to 2009 or spring 2010.', NULL, NULL, NULL, true),
    ('laughing.buddha', 'Laughing Buddha', NULL, false, 'duggan.mcdonnell', ARRAY[]::text[], 'cantina.sf', 'https://punchdrink.com/recipes/laughing-buddha/', 'A spicy buck of citron vodka, lime, five-spice agave, muddled ginger and serrano, lengthened with ginger beer.', 'McDonnell built it for Cantina, his Union Square bar, around freshly pressed citrus and a San Francisco made citron vodka. He leaned on friends and neighbours for local citrus. The five-spice agave and chile give a familiar highball real heat.', 'Highball', 'Cubed', 'Shake', true),
    ('m30.rain', 'M-30 Rain', NULL, true, 'kazuo.uyeda', ARRAY[]::text[], NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-224', 'A glowing blue-green shaken drink of vodka, grapefruit schnapps, lime juice and blue curacao.', 'One of the trademark drinks of Uyeda''s Tender bar in Ginza. A Ginza bar has described it as his tribute to the musician Ryuichi Sakamoto. Measures were not found in a reliable source.', NULL, NULL, 'Shake', false),
    ('maximilian-affair', 'Maximilian Affair', 2008, true, 'misty.kalkofen', ARRAY[]::text[], 'green.street.cambridge', 'https://vinepair.com/cocktail-recipe/maximilian-affair/', 'A mezcal sour-style drink with elderflower liqueur, Punt e Mes and a little lemon.', 'Kalkofen is said to have improvised it at Green Street around 2008 when Del Maguey founder Ron Cooper dropped in. The name nods to the French-installed Emperor Maximilian of Mexico, matching French elderflower with Mexican mezcal. Later printed versions shift the proportions toward more mezcal.', 'Coupe', 'None', 'Shake', true),
    ('mayauel.sling', 'Mayauel Sling', NULL, true, 'jacques.bezuidenhout', ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/encyclopedia/2671/people/jacques-bezuidenhout', 'A tiki-leaning reposado tequila sling with cherry liqueur, fino sherry, pineapple and Benedictine.', 'Bezuidenhout built it around reposado tequila during his years as a tequila specialist and brand ambassador. Dry fino sherry and Benedictine keep the pineapple and cherry from turning sweet.', 'Highball', 'Cubed', 'Shake', true),
    ('meyer.beautiful', 'Meyer Beautiful', NULL, false, 'scott.beattie', ARRAY[]::text[], 'cyrus.healdsburg', 'https://honestlyyum.com/207/meyer-lemon-sour', 'A Meyer lemon cocktail from Beattie''s seasonal bar menu at Cyrus.', 'One of the punning, produce-led drinks from Beattie''s years at Cyrus, collected in his 2008 book Artisanal Cocktails alongside the Hot Indian Date. Like much of that menu it depends on house preparations, so no spec is given here.', NULL, NULL, NULL, false),
    ('millennium.dorelli', 'Millennium Cocktail', NULL, true, 'peter.dorelli', ARRAY[]::text[], 'americanbarsavoy', 'https://www.abebooks.com/9781626540644/Savoy-Cocktail-Book-Paperback-Softback-1626540640/plp', 'A Savoy house cocktail created by Peter Dorelli to mark the new millennium.', 'Dorelli made it during his years as head bartender of the American Bar, and it was one of the new drinks added to an updated edition of The Savoy Cocktail Book. The recipe is not given here because no reliable spec was found.', NULL, NULL, NULL, false),
    ('quilty', 'Quilty', 2018, false, 'jim.kearns', ARRAY[]::text[], 'slowly.shirley.nyc', 'https://punchdrink.com/recipes/quilty/', 'A stirred mezcal drink with amontillado sherry, coffee liqueur, bourbon and peated Scotch.', 'Kearns wrote it for Slowly Shirley''s film noir menu in the fall of 2018. He describes it as big and bold, with coffee and smoke up front.', 'Double rocks', 'Large cube', 'Stir', true),
    ('serendipity', 'Serendipity', 1994, false, 'colin.field', ARRAY[]::text[], 'barhemingway', 'https://www.malaymail.com/news/eat/drink/2017/07/23/legendary-bar-hemingway-at-ritz-paris-shares-recipe-for-serendipity-cocktai/1426959', 'A tall Champagne drink built on Calvados, apple juice, sugar and fresh mint.', 'Colin Field first served it at Bar Hemingway on New Year''s Eve 1994, and the guest''s delighted one-word reaction became its name. It became the bar''s best-known drink, pairing Normandy apple brandy with Champagne for a drink he presents as thoroughly French. Later published versions often shake it with more Calvados and serve it short.', 'Highball', 'Cubed', 'Build', true),
    ('takumis.aviation', 'Takumi''s Aviation', 2010, false, 'takumi.watanabe', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Takumi%27s_aviation', 'An Aviation that swaps creme de violette for parfait d''amour, adding orange and vanilla notes.', 'Watanabe created it for the Diageo World Class competition in Athens in 2010, and Gary Regan later named it and printed it in The Joy of Mixology. In 2021 Watanabe rebalanced the recipe with more maraschino and lemon because the liqueurs had changed. This is his updated spec.', 'Martini', 'None', 'Shake', true),
    ('the-waterfront', 'The Waterfront', 2009, true, 'damon.boelte', ARRAY[]::text[], 'prime.meats.nyc', 'https://punchdrink.com/recipes/the-waterfront/', 'A Fernet-Branca and Branca Menta highball with lime and ginger beer.', 'Boelte calls it an aggressive highball, a bitter and minty cousin of the Dark ''n'' Stormy. It was on the opening menu at Prime Meats and stayed there until the restaurant closed.', 'Highball', 'Cubed', 'Build', true),
    ('waylon', 'Waylon', 2007, true, 'eben.freeman', ARRAY[]::text[], 'tailor.nyc', 'https://punchdrink.com/articles/most-influential-failed-bar-tailor-nyc/', 'Bourbon mixed with house cola that has been smoked over cherry and alder wood, served carbonated.', 'Freeman''s grown-up Jack and Coke, named for Waylon Jennings, became the signature of Tailor and an early marker of the smoke trend in cocktails. He smoked the cola himself and recarbonated it with water and CO2 rather than shaking or stirring the drink.', NULL, NULL, NULL, false),
    ('wiz-fizz', 'Wiz Fizz', 2015, true, 'pam.wiznitzer', ARRAY[]::text[], 'seamstress.nyc', 'https://punchdrink.com/recipes/wiz-fizz/', 'A Ramos-style gin fizz with Cynar, cream and egg white, lengthened with root beer.', 'Wiznitzer''s best-known drink from the opening list at Seamstress plays like a root beer float. Gin and the artichoke amaro Cynar cut the soda''s sweetness, and a long shake gives it a tall, foamy head.', 'Highball', 'None', 'Shake', true);

UPDATE "lg_drinks" f SET "item_id" = i.id FROM "public"."items" i WHERE i.is_catalog AND i.item_type = 'cocktail' AND lower(i.name) = lower(f.name);
-- Or the same drink already seeded under its maker's credit (signature drinks).
UPDATE "lg_drinks" f SET "item_id" = i.id
FROM "public"."items" i JOIN "public"."profiles" c ON c.id = i.creator_profile_id
WHERE f.item_id IS NULL AND c.handle = f.creator AND i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.created_by IS NULL
  AND lower(i.name) = lower(f.name);
UPDATE "lg_drinks" f SET "is_new" = true WHERE f.item_id IS NULL;

WITH "made" AS (
    INSERT INTO "public"."items" ("name", "item_type", "origin", "is_catalog")
    SELECT f.name, 'cocktail', CASE WHEN NOT f.catalog THEN 'Original' WHEN f.year < 2000 THEN 'Classic' ELSE 'Modern Classic' END, f.catalog
    FROM "lg_drinks" f WHERE f.item_id IS NULL
    RETURNING "id", "name"
)
UPDATE "lg_drinks" f SET "item_id" = m.id FROM "made" m WHERE f.item_id IS NULL AND m.name = f.name;

-- Year, what it is, its story, glass and ice, only where there's none yet.
UPDATE "public"."items" i SET
    "origin_year" = coalesce(i.origin_year, f.year::smallint),
    "origin_year_approx" = CASE WHEN i.origin_year IS NULL AND f.year IS NOT NULL THEN f.approx ELSE i.origin_year_approx END,
    "description" = coalesce(i.description, f.description),
    -- A bar-credited drink keeps its notes in credited_drink_notes (20261008050000).
    "notes" = CASE WHEN i.notes IS NULL AND NOT EXISTS (SELECT 1 FROM "public"."credited_drink_notes" n WHERE n.item_id = i.id) THEN f.notes ELSE i.notes END,
    "glassware_id" = coalesce(i.glassware_id, (SELECT g.id FROM "public"."items" g WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND lower(g.name) = lower(f.glass) ORDER BY g.created_at LIMIT 1)),
    "ice_id" = coalesce(i.ice_id, (SELECT c.id FROM "public"."items" c WHERE c.item_type = 'ice' AND c.bar_id IS NULL AND lower(c.name) = lower(f.ice) ORDER BY c.created_at LIMIT 1))
FROM "lg_drinks" f
WHERE i.id = f.item_id;

INSERT INTO "public"."item_methods" ("item_id", "method_item_id", "sort_order")
SELECT f.item_id, m.id, 0
FROM "lg_drinks" f
JOIN LATERAL (SELECT x.id FROM "public"."items" x WHERE x.item_type = 'method' AND x.bar_id IS NULL AND lower(x.name) = lower(f.method) ORDER BY x.created_at LIMIT 1) m ON true
WHERE f.method IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."item_methods" x WHERE x.item_id = f.item_id);

-- Specs, only for drinks with none. Ingredients reuse a shared one with the
-- same name key (or alias); new names are added out of ingredient search.
CREATE TEMP TABLE "lg_lines" ("key" text, "pos" int, "amount" numeric, "unit" text, "ingredient" text, "prep" text, "optional" boolean);
INSERT INTO "lg_lines" VALUES
    ('campari-stinger', 0, 1, 'piece', 'Mint sprig', 'muddled', false),
    ('campari-stinger', 1, 30, 'ml', 'Campari', NULL, false),
    ('campari-stinger', 2, 30, 'ml', 'Cognac', NULL, false),
    ('campari-stinger', 3, 0.25, 'barspoon', 'Maple syrup', NULL, false),
    ('campari-stinger', 4, 1, 'piece', 'Mint sprig', 'to garnish', false),
    ('clandestino-old-fashioned', 0, 45, 'ml', 'Bourbon', NULL, false),
    ('clandestino-old-fashioned', 1, 15, 'ml', 'Rye whiskey', NULL, false),
    ('clandestino-old-fashioned', 2, 1, 'barspoon', 'Campari', NULL, false),
    ('clandestino-old-fashioned', 3, 1, 'barspoon', 'Cinnamon syrup', NULL, false),
    ('clandestino-old-fashioned', 4, 1, 'barspoon', 'Vanilla syrup', NULL, false),
    ('clandestino-old-fashioned', 5, 1, 'dash', 'Whiskey barrel-aged bitters', NULL, false),
    ('clandestino-old-fashioned', 6, 1, 'piece', 'Orange peel', 'expressed, to garnish', false),
    ('colonial-affair', 0, 22.5, 'ml', 'Pisco', NULL, false),
    ('colonial-affair', 1, 22.5, 'ml', 'Cacao fruit spirit', NULL, false),
    ('colonial-affair', 2, 22.5, 'ml', 'White creme de cacao', NULL, false),
    ('colonial-affair', 3, 22.5, 'ml', 'Lillet Rose', NULL, false),
    ('colonial-affair', 4, 22.5, 'ml', 'Lemon juice', NULL, false),
    ('colonial-affair', 5, 1, 'barspoon', 'Simple syrup', NULL, false),
    ('debonair', 0, 75, 'ml', 'Single malt Scotch', NULL, false),
    ('debonair', 1, 30, 'ml', 'Ginger liqueur', NULL, false),
    ('debonair', 2, 1, 'piece', 'Lemon twist', 'to garnish', false),
    ('glasgow-mule', 0, 45, 'ml', 'Blended Scotch', NULL, false),
    ('glasgow-mule', 1, 15, 'ml', 'Elderflower liqueur', NULL, false),
    ('glasgow-mule', 2, 22.5, 'ml', 'Lemon juice', NULL, false),
    ('glasgow-mule', 3, 1, 'dash', 'Angostura bitters', NULL, false),
    ('glasgow-mule', 4, 120, 'ml', 'Ginger beer', NULL, false),
    ('glasgow-mule', 5, 1, 'piece', 'Lemon wheel', 'to garnish', false),
    ('glasgow-mule', 6, 1, 'piece', 'Candied ginger', 'to garnish', false),
    ('gunshop.fizz', 0, 60, 'ml', 'Peychaud''s bitters', NULL, false),
    ('gunshop.fizz', 1, 30, 'ml', 'Lemon juice', NULL, false),
    ('gunshop.fizz', 2, 30, 'ml', 'Simple syrup', NULL, false),
    ('gunshop.fizz', 3, 2, 'piece', 'Strawberry', 'muddled', false),
    ('gunshop.fizz', 4, 3, 'piece', 'Cucumber', 'slices, muddled', false),
    ('gunshop.fizz', 5, 3, 'piece', 'Grapefruit peel', 'muddled, rest 2 minutes before shaking', false),
    ('gunshop.fizz', 6, 3, 'piece', 'Orange peel', 'muddled', false),
    ('gunshop.fizz', 7, NULL, 'top', 'Sanbitter', NULL, false),
    ('gunshop.fizz', 8, 1, 'piece', 'Cucumber', 'slice, to garnish', false),
    ('keep.your.dreams.a.burnin', 0, 75, 'ml', 'Manzanilla sherry', NULL, false),
    ('keep.your.dreams.a.burnin', 1, 15, 'ml', 'Jamaican rum', NULL, false),
    ('keep.your.dreams.a.burnin', 2, 15, 'ml', 'Orgeat', NULL, false),
    ('keep.your.dreams.a.burnin', 3, 2, 'dash', 'Angostura bitters', NULL, false),
    ('keep.your.dreams.a.burnin', 4, 2, 'piece', 'Lemon peel', 'shaken with the drink', false),
    ('keep.your.dreams.a.burnin', 5, 3, 'piece', 'Lemon wheel', 'half wheels, to garnish', false),
    ('keep.your.dreams.a.burnin', 6, 1, 'piece', 'Cinnamon stick', 'to garnish', false),
    ('keep.your.dreams.a.burnin', 7, 1, 'pinch', 'Icing Sugar', 'dusted over the top', false),
    ('laughing.buddha', 0, 3, 'piece', 'Fresh ginger', 'diced and muddled', false),
    ('laughing.buddha', 1, 3, 'piece', 'Serrano chile', 'slices, muddled, to taste', false),
    ('laughing.buddha', 2, 60, 'ml', 'Citron vodka', NULL, false),
    ('laughing.buddha', 3, 30, 'ml', 'Lime juice', NULL, false),
    ('laughing.buddha', 4, 15, 'ml', 'Five-spice agave syrup', NULL, false),
    ('laughing.buddha', 5, 60, 'ml', 'Ginger beer', 'poured in as the drink is strained', false),
    ('laughing.buddha', 6, 1, 'piece', 'Fresh ginger', 'slice, to garnish', false),
    ('maximilian-affair', 0, 30, 'ml', 'Mezcal', NULL, false),
    ('maximilian-affair', 1, 30, 'ml', 'Elderflower liqueur', NULL, false),
    ('maximilian-affair', 2, 15, 'ml', 'Punt e Mes', NULL, false),
    ('maximilian-affair', 3, 7.5, 'ml', 'Lemon juice', NULL, false),
    ('maximilian-affair', 4, 1, 'piece', 'Lemon twist', 'to garnish', false),
    ('mayauel.sling', 0, 45, 'ml', 'Reposado tequila', NULL, false),
    ('mayauel.sling', 1, 15, 'ml', 'Cherry liqueur', NULL, false),
    ('mayauel.sling', 2, 22.5, 'ml', 'Fino sherry', NULL, false),
    ('mayauel.sling', 3, 7.5, 'ml', 'Lime juice', NULL, false),
    ('mayauel.sling', 4, 30, 'ml', 'Pineapple juice', NULL, false),
    ('mayauel.sling', 5, 7.5, 'ml', 'Benedictine', NULL, false),
    ('mayauel.sling', 6, 1, 'dash', 'Angostura bitters', NULL, false),
    ('mayauel.sling', 7, NULL, NULL, 'Lime', 'wheel, with a pineapple leaf, to garnish', false),
    ('quilty', 0, 30, 'ml', 'Mezcal', NULL, false),
    ('quilty', 1, 22.5, 'ml', 'Amontillado sherry', NULL, false),
    ('quilty', 2, 22.5, 'ml', 'Coffee liqueur', NULL, false),
    ('quilty', 3, 15, 'ml', 'Bourbon', NULL, false),
    ('quilty', 4, 15, 'ml', 'Islay Scotch', NULL, false),
    ('quilty', 5, 1, 'piece', 'Lemon peel', 'to garnish', false),
    ('serendipity', 0, NULL, 'leaves', 'Mint', 'fresh', false),
    ('serendipity', 1, 1, 'barspoon', 'Sugar', NULL, false),
    ('serendipity', 2, 20, 'ml', 'Calvados', NULL, false),
    ('serendipity', 3, 30, 'ml', 'Apple juice', NULL, false),
    ('serendipity', 4, NULL, 'top', 'Champagne', NULL, false),
    ('takumis.aviation', 0, 45, 'ml', 'Gin', NULL, false),
    ('takumis.aviation', 1, 30, 'ml', 'Maraschino liqueur', NULL, false),
    ('takumis.aviation', 2, 5, 'ml', 'Parfait d''amour', NULL, false),
    ('takumis.aviation', 3, 20, 'ml', 'Lemon juice', NULL, false),
    ('takumis.aviation', 4, NULL, NULL, 'Lemon twist', 'to garnish', false),
    ('the-waterfront', 0, 60, 'ml', 'Fernet-Branca', NULL, false),
    ('the-waterfront', 1, 30, 'ml', 'Branca Menta', NULL, false),
    ('the-waterfront', 2, 15, 'ml', 'Lime juice', NULL, false),
    ('the-waterfront', 3, NULL, 'top', 'Ginger beer', NULL, false),
    ('the-waterfront', 4, 1, 'piece', 'Lime', 'wheel, to garnish', false),
    ('the-waterfront', 5, 1, 'piece', 'Mint sprig', 'to garnish', false),
    ('wiz-fizz', 0, 45, 'ml', 'London dry gin', NULL, false),
    ('wiz-fizz', 1, 15, 'ml', 'Cynar', NULL, false),
    ('wiz-fizz', 2, 22.5, 'ml', 'Lemon juice', NULL, false),
    ('wiz-fizz', 3, 22.5, 'ml', 'Vanilla demerara syrup', NULL, false),
    ('wiz-fizz', 4, 1, 'piece', 'Egg white', NULL, false),
    ('wiz-fizz', 5, 30, 'ml', 'Heavy cream', NULL, false),
    ('wiz-fizz', 6, NULL, 'top', 'Root beer', NULL, false),
    ('wiz-fizz', 7, 1, 'pinch', 'Nutmeg', 'grated, to garnish', false);
DELETE FROM "lg_lines" WHERE "key" IS NULL;

CREATE TEMP TABLE "lg_ing" AS SELECT DISTINCT "ingredient" AS "name", public.ingredient_key("ingredient") AS "key", NULL::uuid AS "item_id" FROM "lg_lines";
UPDATE "lg_ing" n SET "item_id" = (
    SELECT i.id FROM "public"."items" i
    WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND public.ingredient_key(i.name) = n.key
    ORDER BY i.is_core DESC, i.created_at LIMIT 1);
UPDATE "lg_ing" n SET "item_id" = a.item_id FROM "public"."ingredient_aliases" a WHERE n.item_id IS NULL AND a.key = n.key;
INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
SELECT DISTINCT ON (n.key) n.name, 'ingredient', true FROM "lg_ing" n WHERE n.item_id IS NULL AND n.key IS NOT NULL ORDER BY n.key, n.name;
UPDATE "lg_ing" n SET "item_id" = (
    SELECT i.id FROM "public"."items" i
    WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND public.ingredient_key(i.name) = n.key
    ORDER BY i.is_core DESC, i.created_at LIMIT 1)
WHERE n.item_id IS NULL;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "amount", "unit", "preparation_notes", "is_optional", "sort_order")
SELECT f.item_id, n.item_id, l.amount, l.unit, l.prep, l.optional, l.pos
FROM "lg_lines" l
JOIN "lg_drinks" f ON f.key = l.key
JOIN "lg_ing" n ON n.name = l.ingredient AND n.item_id IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = f.item_id);

-- Credits: the maker, co-makers and the bar it was first made at. An existing
-- credit is kept.
UPDATE "public"."items" i SET
    "creator_profile_id" = coalesce(i.creator_profile_id, cp.id),
    "origin_bar_profile_id" = coalesce(i.origin_bar_profile_id, bp.id)
FROM "lg_drinks" f
LEFT JOIN "public"."profiles" cp ON cp.handle = f.creator AND cp.kind = 'person'
LEFT JOIN "public"."profiles" bp ON bp.handle = f.bar AND bp.kind = 'bar'
WHERE i.id = f.item_id AND (cp.id IS NOT NULL OR bp.id IS NOT NULL)
  AND (i.creator_profile_id IS NULL OR i.origin_bar_profile_id IS NULL);

INSERT INTO "public"."item_co_creators" ("item_id", "profile_id")
SELECT f.item_id, p.id
FROM "lg_drinks" f
CROSS JOIN LATERAL unnest(f.co) AS c(handle)
JOIN "public"."profiles" p ON p.handle = c.handle AND p.kind = 'person'
JOIN "public"."items" i ON i.id = f.item_id
WHERE p.id IS DISTINCT FROM i.creator_profile_id
ON CONFLICT DO NOTHING;

-- One web source per catalog drink, as its first record in "From the books".
INSERT INTO "public"."sources" ("key", "kind", "title", "rights", "url")
SELECT DISTINCT ON (f.src) 'web-' || substr(md5(f.src), 1, 12), 'web', regexp_replace(f.src, '^https?://(www\.)?([^/]+).*$', '\2') || ': ' || f.name, 'facts_only', f.src
FROM "lg_drinks" f
WHERE f.src IS NOT NULL AND f.catalog AND NOT EXISTS (SELECT 1 FROM "public"."sources" s WHERE s.url = f.src OR s.key = 'web-' || substr(md5(f.src), 1, 12));

INSERT INTO "public"."source_recipes" ("source_id", "item_id", "printed_name", "relation")
SELECT DISTINCT ON (f.item_id) s.id, f.item_id, f.name, 'first_print'
FROM "lg_drinks" f
JOIN "public"."sources" s ON s.url = f.src
WHERE f.src IS NOT NULL AND f.catalog
  AND NOT EXISTS (SELECT 1 FROM "public"."source_recipes" r WHERE r.item_id = f.item_id);

-- --- 5. Fact-checked fixes to earlier credits ---
-- A drink made by someone who worked at the bar at the time.
UPDATE "public"."items" i SET "origin_bar_profile_id" = b.id
FROM "public"."profiles" c, "public"."profiles" b
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.created_by IS NULL AND lower(i.name) = lower('Bywater') AND i.origin_bar_profile_id IS NULL
  AND c.handle = 'chris.hannah' AND c.kind = 'person' AND i.creator_profile_id = c.id AND b.handle = 'thefrench75bar' AND b.kind = 'bar';
UPDATE "public"."items" i SET "origin_bar_profile_id" = b.id
FROM "public"."profiles" c, "public"."profiles" b
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.created_by IS NULL AND lower(i.name) = lower('East 8 Hold-Up') AND i.origin_bar_profile_id IS NULL
  AND c.handle = 'kevin.armstrong' AND c.kind = 'person' AND i.creator_profile_id = c.id AND b.handle = 'milkandhoney.london' AND b.kind = 'bar';
UPDATE "public"."items" i SET "origin_bar_profile_id" = b.id
FROM "public"."profiles" c, "public"."profiles" b
WHERE i.item_type = 'cocktail' AND i.bar_id IS NULL AND i.created_by IS NULL AND lower(i.name) = lower('Perennial Gimlet') AND i.origin_bar_profile_id IS NULL
  AND c.handle = 'harrison.ginsberg' AND c.kind = 'person' AND i.creator_profile_id = c.id AND b.handle = 'crownshy.nyc' AND b.kind = 'bar';

-- --- 6. Past jobs on the public record show ---

UPDATE "public"."profile_positions" pp SET "is_shown" = true
FROM "public"."profiles" per, "public"."profiles" bar
WHERE per.id = pp.person_profile_id AND bar.id = pp.bar_profile_id
  AND NOT pp.is_current AND NOT pp.is_shown
  AND per.user_id IS NULL
  AND (
    bar.is_closed
    OR EXISTS (SELECT 1 FROM "public"."items" i WHERE i.creator_profile_id = per.id AND i.origin_bar_profile_id = bar.id)
    OR EXISTS (SELECT 1 FROM "public"."item_co_creators" c JOIN "public"."items" i ON i.id = c.item_id
               WHERE c.profile_id = per.id AND i.origin_bar_profile_id = bar.id)
    OR EXISTS (SELECT 1 FROM "public"."items" i WHERE i.creator_profile_id = per.id AND i.origin_year < 2000)
    OR EXISTS (SELECT 1 FROM "public"."item_co_creators" c JOIN "public"."items" i ON i.id = c.item_id
               WHERE c.profile_id = per.id AND i.origin_year < 2000)
  );

-- --- No paid AI: drop the flavour jobs these inserts queued ---

DELETE FROM "private"."item_flavor_jobs" j
USING "lg_drinks" f
WHERE j.item_id = f.item_id AND NOT EXISTS (SELECT 1 FROM "lg_jobs_before" b WHERE b.item_id = j.item_id);

DROP TABLE "lg_lines", "lg_ing", "lg_drinks", "lg_jobs_before";
