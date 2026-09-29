-- Bar awards: the Tales of the Cocktail Spirited Awards (2016-2026) and the
-- James Beard Awards' bar categories (Outstanding Bar Program from 2012,
-- Outstanding Bar, Best New Bar and Outstanding Professional in Cocktail
-- Service), every award won by a bar or a bartender, on the bar's or the
-- person's profile.
--
-- 1. Winning bars that weren't here yet (41), as public, unclaimed venue
--    profiles, same rules as the earlier seeds: a bar already here (same name
--    within 150 m, or the handle taken) is left alone. Closed bars are kept
--    and marked closed (profiles.is_closed, from the decade seed), with their
--    last address.
-- 2. Winners who weren't here yet (26), as public, unclaimed person
--    profiles: professional details only, in our words, no photos, same as
--    the bar people seeds. People who have died are left out.
-- 3. The awards, as Tales words each category that year, with the winners
--    announcement as the source (Tales' own pages; the Foundation's, or the
--    press for 2012-2014 when its pages are gone). A bar's award goes on the bar; a person's
--    goes on the person, or on the bar Tales named with the person's name in
--    the title when they have no profile. Not included: brand, spirits,
--    writing, media, wine and restaurant categories. A title already here in slightly
--    different wording isn't added again.
-- 4. The new bars' best-known drinks, credited to the bar, same as the
--    signature-drinks seed: our own description and notes, ingredients where
--    a menu or article lists them, and measures only where a real spec is
--    published, each checked against the source's own text.
--
-- Safe to re-run: bars, people, awards and drinks already present are left
-- alone.

-- --- Bars ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "locality", "address_line",
                                 "postcode", "city", "region", "country_code", "latitude", "longitude", "is_closed", "closed_year")
SELECT 'bar', v.handle, v.name, v.bio, v.website, true, v.locality, v.address_line,
       v.postcode::text, v.city, v.region::text, v.country_code, v.latitude, v.longitude, v.is_closed, v.closed_year::smallint
FROM (VALUES
    ('allegory_dc', 'Allegory', 'Speakeasy hidden behind a nondescript door in the library of the Eaton DC hotel, opened in 2018 with Deke Dunne as creative director. Erik Thor Sandberg''s mural retells Alice in Wonderland through the eyes of civil rights pioneer Ruby Bridges, and its storybook menus pair that tale with technique-heavy drinks. Best U.S. Hotel Bar and U.S. Bartender of the Year (Kapri Robinson) at the 2024 Spirited Awards, Best U.S. Bar Team in 2025 and World''s Best Cocktail Menu in 2026.', 'https://www.allegory-dc.com/', 'Downtown', '1201 K Street NW (inside Eaton DC)', '20005', 'Washington', 'District of Columbia', 'US', 38.90279, -77.02853, false, NULL),
    ('bryantslounge', 'Bryant''s Cocktail Lounge', 'Milwaukee''s oldest cocktail lounge: Bryant Sharp opened a beer hall here in 1936 and went cocktails-only around 1938, and is credited with the Pink Squirrel, Blue Tail Fly and Banshee. Rebuilt after a 1971 fire, it keeps velvet walls, low light and a gold-plated McIntosh stereo, and has never had a menu; bartenders work from a repertoire of about 450 drinks. Timeless U.S. Award at the 2026 Spirited Awards.', 'https://www.bryantscocktaillounge.com/', 'Historic Mitchell Street', '1579 S 9th St.', '53204', 'Milwaukee', 'Wisconsin', 'US', 43.01435, -87.92287, false, NULL),
    ('cleaverlv', 'Cleaver', 'Steakhouse off the Las Vegas Strip opened in 2018 by Nectaly Mendoza as the sister of his bartenders'' bar Herbs & Rye, in The Park complex on Paradise Road. Its cocktail list runs through bar history by era, from Gothic-age drinks like Atholl Brose through the golden age and tiki revival to modern classics such as the Penicillin. Best U.S. Restaurant Bar at the 2024 Spirited Awards.', 'https://www.cleaverlasvegas.com/', 'Paradise', '3900 Paradise Road Suite D-1', '89169', 'Las Vegas', 'Nevada', 'US', 36.11872, -115.15375, false, NULL),
    ('barcockmad', 'Bar Cock', 'Madrid cocktail bar opened in 1921 on Calle de la Reina by Emilio Saracho with Perico Chicote, who bought furniture in London to recreate an English club; Chicote took it over in 1945. High ceilings, a big fireplace and rooster paintings frame bow-tied waiters mixing classics such as gimlets, dry martinis and gin and tonics, and the house keeps a firm no-photos rule. Timeless International Award at the 2025 Spirited Awards.', 'https://www.barcock.com/en', 'Justicia (Centro)', 'Calle de la Reina, 16', '28004', 'Madrid', 'Community of Madrid', 'ES', 40.41989, -3.6988, false, NULL),
    ('devilscut.madrid', 'Devil''s Cut', 'Shingo Gokan''s first European bar, opened in September 2024 in the Barrio de las Letras room that was the neighbourhood bar Casa Pueblo from 1983. The name plays on his decade as head bartender of New York''s Angel''s Share: the menu mixes his Angel''s Share classics, drinks from his Asian bars and sherry-driven Madrid signatures, with Japanese-Spanish snacks. Best New International Cocktail Bar at the 2025 Spirited Awards.', 'https://devilscutmadrid.com/en/home/', 'Barrio de las Letras', 'C. del León, 3', '28014', 'Madrid', 'Community of Madrid', 'ES', 40.41462, -3.69855, false, NULL),
    ('floridita_cuba', 'El Floridita', 'Havana bar and seafood restaurant at the corner of Obispo and Monserrate, open since 1817 and known as the cradle of the daiquiri. Catalan-born Constantino Ribalaigua Vert tended bar from 1914, bought it in 1918 and popularised the frozen daiquiri; Ernest Hemingway drank here for decades, and a bronze statue of him has sat at the end of the bar since 2003. Timeless International Award at the 2019 Spirited Awards.', 'https://www.barfloridita.com/', 'Habana Vieja', 'Obispo 557, esquina a Monserrate', '10100', 'Havana', 'La Habana', 'CU', 23.13735, -82.35733, false, NULL),
    ('bar500a', 'The Hawthorne', 'Cocktail lounge that Jackson Cannon and the Eastern Standard team opened in November 2011 in the Hotel Commonwealth on Kenmore Square. Furnished like a mid-century living room, it paired classics with seasonal originals such as Cannon''s Phil Collins and ran daily specials. It never reopened after the 2020 shutdown, and its closure was confirmed in February 2021. Best American Hotel Bar at the 2017 Spirited Awards.', 'https://www.thehawthornebar.com/', 'Kenmore Square', '500A Commonwealth Avenue', '02215', 'Boston', 'Massachusetts', 'US', 42.34859, -71.09533, true, 2021),
    ('little_rituals_bar', 'Little Rituals', 'Fourth-floor bar in the Residence Inn and Courtyard by Marriott in downtown Phoenix, opened in 2018 by Tucson bartender Aaron DeFeo with Ross Simon of Bitter & Twisted. Its menu is laid out like a vintage photo album of memories and leans on sous vide syrups, clarification, fat washes and foams, under a collage mural of Phoenix landmarks. Best U.S. Hotel Bar at the 2025 Spirited Awards.', 'https://www.littleritualsbar.com/', 'Downtown Phoenix', '132 S Central Ave, 4th Floor', '85004', 'Phoenix', 'Arizona', 'US', 33.44639, -112.07411, false, NULL),
    ('raisedbywolvesspirits', 'Raised by Wolves', 'Bar hidden inside a bottle shop at the Westfield UTC mall in La Jolla, opened in 2018 by San Diego''s CH Projects, the group behind Polite Provisions and Craft & Commerce. Its ornate room owes a debt to London''s Victorian gin palaces, early drinks came from Erick Castro, and the menu adds spirit flights drawn from a deep, rare-bottle list. World''s Best Spirits Selection at the 2023 Spirited Awards.', 'https://raisedxwolves.com/', 'La Jolla (University City)', '4301 La Jolla Village Dr #2030', '92122', 'San Diego', 'California', 'US', 32.87208, -117.21284, false, NULL),
    ('thesilverdollar', 'The Silver Dollar', 'Honky-tonk whiskey bar and restaurant that Larry Rice and two partners opened in 2011 in a renovated firehouse on Frankfort Avenue. A tribute to the Bakersfield sound and its juke joints, it paired one of Louisville''s deepest bourbon lists with fresh-juiced cocktails and house bitters, served in plain glassware by bartenders in jeans. It closed after a final service on 15 November 2025. Best American Restaurant Bar at the 2020 Spirited Awards.', 'https://www.whiskeybythedrink.com/', 'Clifton', '1761 Frankfort Ave', '40206', 'Louisville', 'Kentucky', 'US', 38.257, -85.71672, true, 2025),
    ('tikiti1961', 'Tiki-Ti', 'Tiny tiki bar on Sunset Boulevard in Los Feliz, opened on 28 April 1961 by Ray Buhen and still run by his son and grandson. It pours a long list of exotic rum drinks, many of them house originals, and rituals are part of the show: the crowd chants ''Toro! Toro!'' for the Blood and Sand and ''Uga Booga'' for its namesake. Timeless U.S. Award at the 2023 Spirited Awards.', 'https://www.tiki-ti.com/', 'Los Feliz', '4427 Sunset Blvd', '90027', 'Los Angeles', 'California', 'US', 34.09748, -118.28576, false, NULL),
    ('keenssteakhouse', 'The Bar at Keens Steakhouse', 'The bar of Keens, a Herald Square chophouse that Albert Keen opened independently in 1885 and the last survivor of the old Herald Square theatre district. It holds the world''s largest collection of clay churchwarden pipes, and its bar pours Martinis, Old Fashioneds and a long single malt Scotch list, with free hard-boiled eggs on the counter. Timeless U.S. Award at the 2025 Spirited Awards.', 'https://www.keens.com/', 'Midtown (Herald Square)', '72 West 36th Street', '10018', 'New York', 'NY', 'US', 40.75077, -73.98641, false, NULL),
    ('thebuenavistasf', 'The Buena Vista', 'Fisherman''s Wharf cafe and bar by the Powell-Hyde cable car turnaround, credited with bringing the Irish Coffee to America. In November 1952 owner Jack Koeppler and travel writer Stanton Delaplane set out to recreate the drink Delaplane had at Shannon Airport, and the bar still lines up glass goblets by the dozen for it. Timeless U.S. Award at the 2024 Spirited Awards.', 'https://www.thebuenavista.com/', 'Fisherman''s Wharf', '2765 Hyde Street', '94109', 'San Francisco', 'CA', 'US', 37.80652, -122.42077, false, NULL),
    ('clydecommon', 'Clyde Common', 'Downtown Portland restaurant opened in 2007 by Nate Tilden and Matt Piacentini on the ground floor of what was then the Ace Hotel. Its bar, run by Jeffrey Morgenthaler from 2008, started the barrel-aged cocktail craze in 2010 and helped set the tone for American craft bartending. It closed for good in January 2022. Morgenthaler was American Bartender of the Year at the 2016 Spirited Awards, and the bar was Best American Restaurant Bar in 2018.', 'https://www.instagram.com/clydecommon/', 'Downtown', '1014 SW Stark Street', '97205', 'Portland', 'OR', 'US', 45.522, -122.68144, true, 2022),
    ('columbiaroom', 'Columbia Room', 'Derek Brown''s cocktail bar began in 2010 as a small tasting counter at the back of The Passenger and reopened in 2016 in Blagden Alley in Shaw, with a Punch Garden, a Spirits Library and a reservation-only Tasting Room. Its seasonal tasting menus used unusual ingredients, from kelp water to old books. It closed in February 2022. Best American Cocktail Bar at the 2017 Spirited Awards.', 'https://www.instagram.com/columbiaroom/', 'Shaw', '124 Blagden Alley NW', '20001', 'Washington', 'DC', 'US', 38.90635, -77.02447, true, 2022),
    ('dukeslondon', 'DUKES Bar', 'Small, clubby bar in Dukes London, a hotel tucked into St James''s Place since 1908 and a haunt of Ian Fleming. It is famous for the Dukes Martini, introduced by Salvatore Calabrese in the 1980s: frozen gin or vodka poured from a trolley straight into a frozen glass with no ice, limited to two per guest. Alessandro Palazzi has led the bar since 2007. Timeless International Award at the 2021 Spirited Awards.', 'https://www.dukeshotel.com/dukesbar.html', 'St James''s', '35 St James''s Place', 'SW1A 1NY', 'London', 'England', 'GB', 51.50557, -0.13961, false, NULL),
    ('napoleonhousenola', 'Napoleon House', 'French Quarter landmark at Chartres and St. Louis Streets, run by the Impastato family from 1914 and by Ralph Brennan since 2015. Its old rooms play classical music over muffulettas and Sazeracs, but the signature is the Pimm''s Cup, which the house introduced to New Orleans in the 1940s. Timeless American Award at the 2019 Spirited Awards.', 'https://www.napoleonhouse.com/', 'French Quarter', '500 Chartres Street', '70130', 'New Orleans', 'LA', 'US', 29.95586, -90.06507, false, NULL),
    ('saxonandparole', 'Saxon + Parole', 'Equestrian-themed American restaurant and bar that AvroKO opened in September 2011 on the corner of Bowery and Bleecker, in the space of its Double Crown. The bar, set up by Naren Young and Linden Pride and later run by Masa Urushido, developed drinks alongside chef Brad Farmerie''s kitchen. It went dark in March 2020 and did not reopen. Best American Restaurant Bar at the 2016 Spirited Awards.', 'https://www.instagram.com/saxonandparole/', 'NoHo / East Village', '316 Bowery', '10012', 'New York', 'NY', 'US', 40.72307, -73.99111, true, 2020),
    ('happyaccidentsbar', 'Happy Accidents', 'Bright, art-filled bar and craft distillery on Central Avenue in Albuquerque, opened in 2021 by bartenders Kate Gerwin and Blaze Montana. A wall of taps pours carbonated and nitro cocktails, martinis come thrown at a 50:50 house ratio, and many drinks play on nostalgia, from a Froot Loops milk punch to private karaoke rooms. Best New U.S. Cocktail Bar at the 2022 Spirited Awards and Best U.S. Bar Team in 2023.', 'https://www.happyaccidentsbar.com/', 'Nob Hill', '3225 Central Avenue NE', '87106', 'Albuquerque', 'NM', 'US', 35.08051, -106.6085, false, NULL),
    ('heylovepdx', 'Hey Love', 'Plant-filled lobby bar of the Jupiter Next hotel on East Burnside, opened in late 2018 by Rum Club bartender Emily Mistell, Sophie Thomson and Dig A Pony owners Aaron Hall and Nicholas Musso. The room nods to 1970s fern bars, the playlists stick to old soul and exotica, and the drinks run to bright tropical cocktails and slushees, with Mexico City street food from Machetes. Best U.S. Hotel Bar at the 2023 Spirited Awards.', 'https://www.heylovepdx.com/', 'Buckman', '920 East Burnside Street', '97214', 'Portland', 'OR', 'US', 45.52279, -122.65624, false, NULL),
    ('silverlyan', 'Silver Lyan', 'Ryan Chetiyawardana''s first American bar, opened in February 2020 in the old bank vault beneath the Riggs Washington DC hotel, a former Riggs National Bank building in Penn Quarter. Its themed menus tell stories of cultural exchange using techniques from his London bars, such as microwaved Manhattans and clay-infused bitters. Best New American Cocktail Bar at the 2020 Spirited Awards and Best U.S. Hotel Bar in 2022.', 'https://www.riggsdc.com/eat-drink/silver-lyan/', 'Penn Quarter', '900 F Street NW', '20004', 'Washington', 'DC', 'US', 38.8972, -77.02433, false, NULL),
    ('trailerh', 'Trailer Happiness', 'Basement tiki lounge on Portobello Road that Jonathan Downey opened in November 2003 as a kitsch 1960s bachelor pad serving Zombies and Mai Tais in tiki mugs. Local Sly Augustin later rescued it and built it into a rum-focused bar known for flaming Zombies, sharing bowls and training many top London bartenders. It reopened after a flash flood in 2021. Best International High Volume Cocktail Bar at the 2017 Spirited Awards.', 'https://trailerh.com/', 'Notting Hill', '177 Portobello Road', 'W11 2DY', 'London', 'England', 'GB', 51.515, -0.20463, false, NULL),
    ('bemelmansbar', 'Bemelmans Bar', 'Piano bar inside The Carlyle hotel on the Upper East Side, opened in 1947 and named for Madeline author Ludwig Bemelmans, who painted the Central Park murals on its walls in exchange for a stay at the hotel. Dale DeGroff and Audrey Saunders rebuilt its cocktail list in the early 2000s, and it is known for nightly piano and jazz, martinis and the Old Cuban. Timeless U.S. Award at the 2022 Spirited Awards.', 'https://www.rosewoodhotels.com/en/the-carlyle-new-york/dining/bemelmans-bar', 'Upper East Side', '35 East 76th Street', '10021', 'New York', 'NY', 'US', 40.77426, -73.96299, false, NULL),
    ('centurygrandphx', 'Century Grand', 'Rail-themed bar complex opened in fall 2019 by Jason Asher and Rich Furnari of Barter & Shake in a former pizza parlor on Indian School Road, built to feel like a 1920s train station. Its centerpiece is Platform 18, a replica presidential Pullman car where footage of a Rocky Mountain rail journey rolls past the windows, with the Grey Hen whiskey bar and bottle shop alongside. Best U.S. Cocktail Bar at the 2023 Spirited Awards.', 'https://www.centurygrandphx.com/', 'Camelback East', '3626 E Indian School Rd', '85018', 'Phoenix', 'AZ', 'US', 33.4955, -112.00306, false, NULL),
    ('cobracolumbus', 'Cobra', 'Asian American bar and restaurant in Columbus'' Brewery District, opened in October 2023 by hospitality veterans Alex Chien, David Yee and Josh Spiers, who bill it as a good-night bar. Drinks and food riff on growing up in immigrant families, from a Toki whisky Old Fashioned to Mama Chien''s dumplings, served until late. Best U.S. Restaurant Bar at the 2026 Spirited Awards.', 'https://www.cobrabarcolumbus.com/', 'Brewery District', '684 S. High St', '43206', 'Columbus', 'OH', 'US', 39.9482, -82.99759, false, NULL),
    ('comperelapin', 'Compère Lapin', 'Chef Nina Compton''s restaurant in the Old No. 77 Hotel & Chandlery in the Warehouse District, opened in June 2015 with her husband Larry Miller and named for the trickster rabbit of the St. Lucian folktales she grew up with. Its bar pairs Caribbean flavors and Gulf ingredients with New Orleans cocktail tradition, from rum drinks to frozen serves. Best American Hotel Bar at the 2019 Spirited Awards.', 'https://comperelapin.com/', 'Warehouse District', '535 Tchoupitoulas Street', '70130', 'New Orleans', 'LA', 'US', 29.94788, -90.06728, false, NULL),
    ('elevenmadisonpark', 'Eleven Madison Park', 'Fine-dining restaurant in the Art Deco Metropolitan Life North Building on Madison Square, opened by Danny Meyer in 1998 and bought in 2011 by chef Daniel Humm and Will Guidara. Now owned by Humm, it has held three Michelin stars since 2012 and topped The World''s 50 Best Restaurants in 2017; its bar is run by beverage director Sebastian Tollius. World''s Best Spirits Selection at the 2025 Spirited Awards.', 'https://www.elevenmadisonpark.com/', 'Flatiron District', '11 Madison Avenue', '10010', 'New York', 'NY', 'US', 40.7416, -73.98719, false, NULL),
    ('hawksmoorrestaurants', 'Hawksmoor Spitalfields', 'The first Hawksmoor, opened on Commercial Street in 2006 by Will Beckett and Huw Gott as a British steakhouse with a serious cocktail bar. It has a small bar in the dining room and a 60-seat basement bar in a former strip club, and it is where Pete Jeary''s Shaky Pete''s Ginger Brew became the group''s best-known drink. Best International Restaurant Bar at the 2016 and 2019 Spirited Awards.', 'https://thehawksmoor.com/locations/spitalfields/', 'Spitalfields', '157a Commercial Street', 'E1 6BJ', 'London', NULL, 'GB', 51.52141, -0.07588, false, NULL),
    ('jackroseindc', 'Jack Rose Dining Saloon', 'Adams Morgan whiskey saloon opened in 2011 by D.C. natives Bill Thomas and Stephen King, with library-style shelves holding more than 2,700 whiskies, which it bills as the largest collection in the Western Hemisphere. The three-story building adds a glass-enclosed rooftop terrace and a cellar tasting room and spirits shop, Premier Drams. World''s Best Spirits Selection at the 2022 Spirited Awards.', 'https://www.jackrosediningsaloon.com/', 'Adams Morgan', '2007 18th Street NW', '20009', 'Washington', 'DC', 'US', 38.91741, -77.04133, false, NULL),
    ('navystrengthseattle', 'Navy Strength', 'Tropical cocktail bar in Belltown opened in 2017 by Anu Apte and Chris Elford, who also run fellow Belltown bar Rob Roy. Its menu mixes modern tiki drinks with a rotating Travel section built around one country''s flavors and service styles at a time, served alongside nachos and Pacific Northwest oysters. Best New American Cocktail Bar at the 2018 Spirited Awards.', 'https://www.navystrengthseattle.com/', 'Belltown', '2505 2nd Ave Suite 102', '98121', 'Seattle', 'WA', 'US', 47.61532, -122.34815, false, NULL),
    ('sexyfishlondon', 'Sexy Fish', 'Japanese-inspired seafood restaurant and bar on Berkeley Square in Mayfair, opened in October 2015 by Richard Caring''s Caprice Holdings. Frank Gehry fish lamps hang over the bar and Damien Hirst bronze mermaids adorn it, and the bar claims the world''s largest Japanese whisky collection. Best International Restaurant Bar at the 2022 Spirited Awards.', 'https://sexyfish.com/london/', 'Mayfair', 'Berkeley Square House, Berkeley Square', 'W1J 6BR', 'London', NULL, 'GB', 51.50937, -0.14428, false, NULL),
    ('supernovaballroom', 'Supernova Ballroom', 'Low-waste cocktail bar that Kelsey Ramage and Iain Griffiths, founders of the Trash Tiki pop-up, opened in September 2019 in a heritage-listed room on Bay Street in Toronto''s Financial District, given a retro makeover. Its spritzes, highballs and French 75 twists leaned on house ferments and local produce. It closed for good in October 2020 because of the pandemic. Ramage was International Bartender of the Year at the 2020 Spirited Awards.', 'https://www.instagram.com/supernovaballroom/', 'Financial District', '330 Bay Street', 'M5H 2R2', 'Toronto', 'ON', 'CA', 43.65011, -79.38122, true, 2020),
    ('yachtclubbar', 'Yacht Club', 'Denver bar opened in 2021 by McLain Hedges and Mary Allison Wright, which grew out of a wine shop in a food market and calls itself a nerdy cocktail bar, natural wine bar and dive in one. Wine goes into every cocktail, the list leans coastal with frozen daiquiris and an Old Bay Martini, and hot dogs are served until 2 a.m. Best U.S. Cocktail Bar at the 2024 Spirited Awards.', 'https://www.yachtclubbar.com/', 'Cole', '3701 N Williams St', '80205', 'Denver', 'CO', 'US', 39.7683, -104.96618, false, NULL),
    ('thefrench75bar', 'Arnaud''s French 75 Bar', 'Cocktail bar inside Arnaud''s, the French Quarter restaurant, in a room that was once a men-only grill bar. The Casbarian family relaunched it in 2003 as the French 75 Bar, with a vintage bar and back bar built in the late 1800s, and it serves classic and New Orleans cocktails led by a cognac-based French 75. Outstanding Bar Program at the 2017 James Beard Awards.', 'https://www.arnaudsrestaurant.com/french-75/', 'French Quarter', '813 Bienville Street (inside Arnaud''s)', '70112', 'New Orleans', 'Louisiana', 'US', 29.95574, -90.06868, false, NULL),
    ('baragricole', 'Bar Agricole', 'Thad Vogler opened Bar Agricole in 2010 on 11th Street in SoMa, naming it for rhum agricole and building its drinks on single-origin spirits, many bottled for the bar. After a pandemic closure it reopened on Mission Street in 2022, moved beside Osito in the Mission in 2024 and closed that July; the name lives on as Vogler''s spirits label. Outstanding Bar Program at the 2019 James Beard Awards.', 'https://www.baragricole.com/', 'Mission District', '2875 18th Street (beside Osito)', '94110', 'San Francisco', 'California', 'US', 37.76167, -122.41075, true, 2024),
    ('barleatherapron', 'Bar Leather Apron', 'Intimate downtown Honolulu cocktail bar opened in 2015 by Justin Park and Tom Park on the mezzanine of the TOPA Financial Center. It pairs Japanese-style service and small bites with one of Hawaii''s largest whiskey collections, and is known for Justin Park''s smoke-infused E Ho''o Pau Mai Tai. Outstanding Bar at the 2023 James Beard Awards.', 'https://www.barleatherapron.com/', 'Downtown', '745 Fort Street Mall, Suite 127 (TOPA Financial Center, mezzanine)', '96813', 'Honolulu', 'Hawaii', 'US', 21.30801, -157.86364, false, NULL),
    ('identidadcocktailbar', 'Identidad Cocktail Bar', 'Cocktail bar on Calle Cerra in Santurce, San Juan''s art district, opened in July 2024 by co-founders Edrick Colón and Stephen Alonso. Its house cocktails put Caribbean and Latin American produce into modern drinks, served walk-in only alongside island-inspired plates. Best New Bar at the 2025 James Beard Awards.', 'https://identidadbarpr.com/', 'Santurce', '960 Calle Cerra', '00907', 'San Juan', NULL, 'PR', 18.45317, -66.07917, false, NULL),
    ('julephou', 'Julep', 'Alba Huerta opened Julep in November 2014 in a century-old building on Washington Avenue, building the bar around the drinking history of the American South and juleps in particular. Its recipes fill her 2018 book Julep: Southern Cocktails Refashioned, and it was Houston''s first national James Beard winner. Outstanding Bar Program at the 2022 James Beard Awards.', 'https://www.julephouston.com/', 'Washington Avenue', '1919 Washington Avenue', '77007', 'Houston', 'Texas', 'US', 29.76753, -95.3779, false, NULL),
    ('loma_bar', 'Loma', 'Classic cocktail bar in Providence''s Federal Hill opened in late 2024 by bartender Leishla Maldonado with brothers Osman and Yefri Cortave. The small room is styled like a 1960s-70s Latin American living room with Latin jazz and boleros, pairing numbered house cocktails with monthly featured spirits and a strong zero-proof list. Best New Bar at the 2026 James Beard Awards.', 'https://www.lomabar.com/', 'Federal Hill', '112 Spruce Street', '02903', 'Providence', 'Rhode Island', 'US', 41.82428, -71.4276, false, NULL),
    ('scotchlodge', 'Scotch Lodge', 'Tommy Klus, who built the collection at Multnomah Whiskey Library, opened this 48-seat subterranean bar in May 2019 in the former Biwa space in Portland''s Buckman neighborhood. Billed as a cocktail bar with a scotch problem, it pours around 300 whiskies, many as half pours, beside seasonal cocktails and chef Tim Artale''s food. Outstanding Bar at the 2026 James Beard Awards.', 'https://www.scotchlodge.com/', 'Buckman', '215 SE 9th Ave, Suite 102', '97214', 'Portland', 'Oregon', 'US', 45.52135, -122.65695, false, NULL),
    ('violethourchicago', 'The Violet Hour', 'Toby Maloney and partners from One Off Hospitality opened The Violet Hour in Wicker Park in 2007 behind an unmarked door in an ever-changing mural facade, with candlelit salons and a long marble bar. It helped start Chicago''s craft cocktail boom, introduced the Juliet & Romeo, Art of Choke and Paper Plane, and closed in June 2025 after damage to its building. Outstanding Bar Program at the 2015 James Beard Awards.', 'https://www.theviolethour.com/', 'Wicker Park', '1520 N Damen Ave', '60622', 'Chicago', 'Illinois', 'US', 41.90897, -87.67782, true, 2025)
) AS v("handle", "name", "bio", "website", "locality", "address_line", "postcode", "city", "region", "country_code",
       "latitude", "longitude", "is_closed", "closed_year")
-- Not a second copy of a bar someone already added (add_venue's rule).
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.kind = 'bar' AND p.latitude BETWEEN v.latitude - 0.002 AND v.latitude + 0.002
      AND private.venue_name_key(p.display_name) = private.venue_name_key(v.name)
      AND private.distance_km(v.latitude, v.longitude, p.latitude, p.longitude) <= 0.15
)
ON CONFLICT ("handle") DO NOTHING;

-- --- People ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "city")
SELECT 'person', v.handle, v.name, v.bio, v.website, true, v.city
FROM (VALUES
    ('axljump', 'Alex Jump', 'Denver bartender whose career took off opening the Denver location of Death & Co. In 2020 she co-founded Focus on Health with Lauren Paylor O''Brien, advocating for physical and mental wellbeing in hospitality, and runs a professional development scholarship for bartenders from marginalized backgrounds and smaller markets. Best U.S. Bar Mentor at the 2024 Spirited Awards.', 'https://www.instagram.com/axljump/', 'Denver'),
    ('amanda.gunderson', 'Amanda Gunderson', 'Hospitality veteran of more than two decades who co-founded Another Round Another Rally with Travis Nass in 2018 and serves as its CEO. The Phoenix-based nonprofit gives hospitality workers emergency aid, scholarships and career development grants, and has distributed more than $3 million. She is a Dame Hall of Fame inductee. Pioneer Award at the 2022 Spirited Awards and Best U.S. Bar Mentor (with Travis Nass) at the 2026 Spirited Awards.', 'https://anotherroundanotherrally.org/', 'Phoenix'),
    ('andy.seymour', 'Andy Seymour', 'New York bartender turned educator and consultant with more than 20 years in the bar and restaurant trade. He co-founded Liquid Productions, which builds beverage and education programmes and events, and is a partner in Beverage Alcohol Resource (BAR), the spirits and mixology training course. He has also served as a Spirited Awards judging co-chair. Best Bar Mentor at the 2018 Spirited Awards.', NULL, 'New York City'),
    ('anguswinchester', 'Angus Winchester', 'British bartender, consultant and educator. He was global ambassador for Tanqueray gin, is a founding member of Alconomics, one of the first global bar consultancies (2002), and has served as global director of education for Bar Convent Berlin. In 2021 he joined Singapore''s Jigger & Pony Group to lead staff training and talent development. Best Bar Mentor at the 2016 Spirited Awards.', 'https://www.instagram.com/anguswinchester/', NULL),
    ('mixellany', 'Anistatia Miller', 'Drinks historian, author and co-director with Jared Brown of Mixellany Limited, a consultancy and publisher specialising in spirits and mixed drinks. Together they have written more than 36 books, including Shaken Not Stirred, the two-volume Spirituous Journey and A Most Noble Water, and their research traced the first printed use of the word cocktail to 1798 London. Helen David Lifetime Achievement Award (with Jared Brown) at the 2021 Spirited Awards.', 'https://mixellany.com/', NULL),
    ('audreysaunders', 'Audrey Saunders', 'New York bartender trained under Dale DeGroff who ran Pegu Club in SoHo as operating partner and creative lead from 2005 until it closed in 2020, one of the most influential cocktail bars of its era. She has since been developing a retreat for drinks industry workers in rural Washington state. Ruth Fertel Pioneer Award at the 2016 Spirited Awards and Helen David Lifetime Achievement Award at the 2020 Spirited Awards.', 'https://www.instagram.com/audreysaunders/', NULL),
    ('chris.cabrera', 'Chris Cabrera', 'Hospitality advocate who became Bacardi''s first National LGBTQ+ Ambassador in North America and led the company''s Belonging initiative, after serving as Grey Goose ambassador in New York City. His work focuses on inclusion, education and safety standards across the bar industry. He received Liquor.com''s Holistic Hospitality Award in 2022. Pioneer Award at the 2021 Spirited Awards.', NULL, NULL),
    ('yummiwasabi', 'Christine Kim', 'Washington, D.C. bartender and a partner and beverage director at Service Bar, which she helped open in 2016 with Chad Spangler and Glendon Hartley after working with them to reopen Farmers Fishers Bakers. She has been a mainstay of the city''s bar scene for more than a decade. U.S. Bartender of the Year at the 2025 Spirited Awards.', 'https://www.instagram.com/yummiwasabi/', 'Washington, D.C.'),
    ('dramawise', 'Christine Wiseman', 'Miami bartender who, as global beverage director for Bar Lab Hospitality, led cocktail creation and training for the Broken Shaker bars in Miami, New York, Los Angeles and Chicago plus venues such as MaryGold''s Brasserie and Higher Ground. She was named the Altos Bartenders'' Bartender by North America''s 50 Best Bars in 2023. U.S. Bartender of the Year at the 2023 Spirited Awards.', 'https://www.instagram.com/dramawise/', 'Miami'),
    ('cocktailcolin', 'Colin Asare-Appiah', 'London-raised, New York-based bartender and Bacardi advocacy leader with more than a decade at the company, most recently as trade director of culture and lifestyle. He co-founded the London Academy of Bartending, co-authored Black Mixcellence with Tamika Hall, and co-founded Ajabu, the first cocktail conference based in Africa. Best U.S. Bar Mentor at the 2025 Spirited Awards.', 'https://www.instagram.com/cocktailcolin/', 'New York City'),
    ('cocktailman', 'Danil Nevsky', 'Bartender and educator who started in Aberdeen, led the bar at Tales & Spirits in Amsterdam, then ran The Vagabond Project, working in 11 bars across 11 countries. He founded Indie Bartender, a free resource hub with a cocktail menu database and industry calendar, and co-founded Broken Bartender merchandise. Best International Bar Mentor at the 2024 Spirited Awards.', 'https://indiebartender.com/dan-nevsky/', 'Barcelona'),
    ('david.wondrich', 'David Wondrich', 'New York drinks historian and writer who began writing about cocktails for Esquire in 1999. He wrote Imbibe!, the history of Jerry Thomas and the American bar, and Punch, and edited The Oxford Companion to Spirits & Cocktails with Noah Rothbaum. Best Bar Mentor at the 2017 Spirited Awards and Helen David Lifetime Achievement Award at the 2026 Spirited Awards.', NULL, 'New York City'),
    ('desmond.payne', 'Desmond Payne', 'Gin distiller whose 58-year career began at Plymouth Gin in 1967; after 25 years there he moved to Beefeater, where he was master distiller and later master distiller emeritus. He created Beefeater 24 among other expressions and retired at the end of 2025. Helen David Lifetime Achievement Award at the 2023 Spirited Awards.', NULL, NULL),
    ('don.lee', 'Don Lee', 'New York bartender and former software engineer who was opening beverage director at PDT, where his Benton''s Old Fashioned popularised fat-washing. He went on to build the cocktail programme at Momofuku, designed barware with Cocktail Kingdom, and co-founded the bar Existing Conditions with Dave Arnold and Greg Boehm. Best American Bar Mentor at the 2020 Spirited Awards.', NULL, 'New York City'),
    ('ian.burrell', 'Ian Burrell', 'London-based rum advocate known as the Global Rum Ambassador, representing the whole rum category rather than a single brand. In 2007 he founded UK RumFest, the first international festival dedicated to rum. Helen David Lifetime Achievement Award at the 2025 Spirited Awards.', NULL, 'London'),
    ('jared.brown', 'Jared Brown', 'Drinks historian, author and distiller who co-directs Mixellany Limited with Anistatia Miller, a spirits and cocktail consultancy and publisher. The pair have written more than 36 books, including Spirituous Journey and A Most Noble Water, and he helped launch Sipsmith gin as its master distiller. Helen David Lifetime Achievement Award (with Anistatia Miller) at the 2021 Spirited Awards.', 'https://mixellany.com/', NULL),
    ('jeffmorgen', 'Jeffrey Morgenthaler', 'Portland bartender since 1996 who ran the bar programmes at Clyde Common, a seven-time James Beard nominee where he pioneered barrel-aged cocktails, and Pepe Le Moko. He co-owns the hotel lobby bar Pacific Standard, co-founded the rooftop bar The Sunset Room, and wrote The Bar Book and Drinking Distilled. American Bartender of the Year at the 2016 Spirited Awards.', 'https://jeffreymorgenthaler.com/', 'Portland, Oregon'),
    ('kapri.possible', 'Kapri Robinson', 'Washington, D.C. bartender, educator and event organizer who founded and leads Chocolate City''s Best, which began in 2018 as a cocktail competition for bartenders of colour and grew into a community, mentorship and career development organisation for Black and Brown bar professionals. She was D.C.''s Cocktail Queen in 2017. U.S. Bartender of the Year at the 2024 Spirited Awards.', 'https://www.chocolatecitysbest.com/', 'Washington, D.C.'),
    ('kelseyramage', 'Kelsey Ramage', 'Bartender who worked at Dandelyan in London before co-founding Trash Tiki with Iain Griffiths in 2016, a zero-waste cocktail platform and pop-up that toured more than a dozen countries. She co-founded Toronto''s Supernova Ballroom and now runs the Trash Collective consultancy. International Bartender of the Year at the 2020 Spirited Awards.', 'https://www.kelseyramage.com/', 'Los Angeles'),
    ('laurenmote', 'Lauren Mote', 'Canadian bartender, educator and co-founder of the Bittered Sling bitters line. She was Diageo Reserve''s Global Cocktailian, joined Bacardi in 2022 and now leads global agave on-trade advocacy for Patrón, Cazadores and Ilegal along with Hacienda Patrón''s hospitality programme. She is a Dame Hall of Fame inductee. Best International Bar Mentor at the 2022 Spirited Awards.', 'https://www.instagram.com/laurenmote/', 'Amsterdam'),
    ('drinksat6', 'Lynnette Marrero', 'New York bartender and educator who co-founded Speed Rack, the women''s speed bartending competition, with Ivy Mix in 2011. She led the bars at Llama Inn and Llama San, hosts MasterClass''s mixology course, is head of education for Bar Convent Brooklyn, and is partner and beverage director of Milly''s Neighborhood Bar. Best Bar Mentor (with Ivy Mix) at the 2019 Spirited Awards.', 'https://www.lynnettemarrero.com/', 'New York City'),
    ('seankenyon13', 'Sean Kenyon', 'Third-generation bartender with more than 30 years behind the bar in New Jersey, Texas and Colorado. In 2011 he opened Williams & Graham in Denver, a James Beard-nominated bar and World''s 50 Best Bars listee, followed by the companion bar Occidental in 2015. American Bartender of the Year at the 2014 Spirited Awards and Best U.S. Bar Mentor at the 2022 Spirited Awards.', 'https://www.instagram.com/seankenyon13/', 'Denver'),
    ('shannonmustipher', 'Shannon Mustipher', 'Spirits educator, cocktail consultant and rum specialist who launched the Caribbean rum bar programme at Glady''s in Brooklyn in 2014. She founded Women Who Tiki, is a founding member of the Cane Club Collective, and wrote Tiki: Modern Tropical Cocktails, an IACP award winner. Pioneer Award at the 2020 Spirited Awards.', 'https://www.instagram.com/shannonmustipher/', NULL),
    ('travis.nass', 'Travis Nass', 'Phoenix bartender and former president of the U.S. Bartenders'' Guild Phoenix chapter who co-founded Another Round Another Rally with Amanda Gunderson in 2018 and serves as its COO. The nonprofit provides hospitality workers with emergency aid, scholarships and reimbursement grants. He is an Arizona Culinary Hall of Fame inductee. Best U.S. Bar Mentor (with Amanda Gunderson) at the 2026 Spirited Awards.', 'https://anotherroundanotherrally.org/', 'Phoenix'),
    ('yayo_nava', 'Yayo Nava', 'Mexico City bartender Eduardo "Yayo" Nava worked at Licorería Limantour and Café Paraíso and as a hospitality manager, brand ambassador and bar consultant. In 2024 he opened Bar Mauro with Ricardo Nava in Roma Norte, an aperitivo bar that won the Campari One To Watch Award at The World''s 50 Best Bars 2025. International Bartender of the Year at the 2026 Spirited Awards.', 'https://www.instagram.com/barmauromx/', 'Mexico City'),
    ('kingcocktail', 'Dale DeGroff', 'Bartender and author known as King Cocktail. After building Joe Baum''s classic cocktail bar at Aurora, he led the Rainbow Room bar from 1987 to 1999, reviving fresh classics and helping spark the craft cocktail movement. He wrote The Craft of the Cocktail, is founding president of the Museum of the American Cocktail and a partner in Beverage Alcohol Resource. Who''s Who of Food & Beverage in America at the 2015 James Beard Awards.', 'https://www.instagram.com/kingcocktail/', 'Westerly, Rhode Island')
) AS v("handle", "name", "bio", "website", "city")
-- Not a second profile for someone already here under the same name.
WHERE NOT EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.kind = 'person' AND lower(p.display_name) = lower(v.name))
ON CONFLICT ("handle") DO NOTHING;

-- --- Awards ---

INSERT INTO "public"."profile_awards" ("profile_id", "award", "year", "position", "title", "source_url")
SELECT p.id, v.award, v.year::smallint, NULL, v.title, v.source_url
FROM (VALUES
    ('abvsf', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best American Bar Team', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('herbsandrye', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best American High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('saxonandparole', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best American Restaurant Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('jeffmorgen', 'person', 'Tales of the Cocktail Spirited Awards', 2016, 'American Bartender of the Year', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('smugglerscovesf', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best American Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('elephantbarnomad', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best American Hotel Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('sweetlibertymia', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best New American Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('americanbarsavoy', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('calloohcallaybar', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best International High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('hawksmoorrestaurants', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('hidetsugu.ueno', 'person', 'Tales of the Cocktail Spirited Awards', 2016, 'International Bartender of the Year', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('happiness_hoxton', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('connaughtbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('theoriolebar', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('anguswinchester', 'person', 'Tales of the Cocktail Spirited Awards', 2016, 'Best Bar Mentor', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('dandelyan', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('tommysmexican', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('connaughtbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2016, 'World''s Best Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-spirited-awards-winners/'),
    ('audreysaunders', 'person', 'Tales of the Cocktail Spirited Awards', 2016, 'Ruth Fertel Pioneer Award', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('nomadbarnyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best American Bar Team', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('sweetlibertymia', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best American High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('dantenewyorkcity', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best American Restaurant Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('jeff.bell', 'person', 'Tales of the Cocktail Spirited Awards', 2017, 'American Bartender of the Year', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('columbiaroom', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best American Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('bar500a', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best American Hotel Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('blacktailnyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best New American Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('dandelyan', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('trailerh', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best International High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('tipplingclub', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('shingo.gokan', 'person', 'Tales of the Cocktail Spirited Awards', 2017, 'International Bartender of the Year', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('blackpearlfitzroy', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('dandelyan', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('swiftsoho', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('david.wondrich', 'person', 'Tales of the Cocktail Spirited Awards', 2017, 'Best Bar Mentor', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('trickdogbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('canonseattle', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('dandelyan', 'bar', 'Tales of the Cocktail Spirited Awards', 2017, 'World''s Best Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('charles.schumann', 'person', 'Tales of the Cocktail Spirited Awards', 2017, 'Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-cocktail-announces-2017-spirited-awards-winners/'),
    ('sweetlibertymia', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best American Bar Team', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('yael.vengroff', 'person', 'Tales of the Cocktail Spirited Awards', 2018, 'American Bartender of the Year', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('lostlakechicago', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best American Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('nomadbarnyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best American High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('brokenshaker', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best American Hotel Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('clydecommon', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best American Restaurant Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('navystrengthseattle', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best New American Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('americanbarsavoy', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('joe.schofield', 'person', 'Tales of the Cocktail Spirited Awards', 2018, 'International Bartender of the Year', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('happiness_hoxton', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('the_clumsies', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best International High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('americanbarsavoy', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('sagerandwilde', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('coupettelondon', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('andy.seymour', 'person', 'Tales of the Cocktail Spirited Awards', 2018, 'Best Bar Mentor', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('dandelyan', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('sweetlibertymia', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'World''s Best Spirit Selection', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('americanbarsavoy', 'bar', 'Tales of the Cocktail Spirited Awards', 2018, 'World''s Best Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-12th-annual-spirited-awards-winners/'),
    ('julio.cabrera', 'person', 'Tales of the Cocktail Spirited Awards', 2019, 'American Bartender of the Year', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('herbsandrye', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best American Bar Team', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('attaboy134', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best American Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('herbsandrye', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best American High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('comperelapin', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best American Hotel Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('dantenewyorkcity', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best American Restaurant Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('katanakitten_nyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best New American Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('monica.berg', 'person', 'Tales of the Cocktail Spirited Awards', 2019, 'International Bartender of the Year', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('limantourmx', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('atlasbarsg', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('schumanns_house', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best International High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('manhattan_sg', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('hawksmoorrestaurants', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('maybe_sammy_sydney', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('ivy.mix', 'person', 'Tales of the Cocktail Spirited Awards', 2019, 'Best Bar Mentor', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('drinksat6', 'person', 'Tales of the Cocktail Spirited Awards', 2019, 'Best Bar Mentor', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('trickdogbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('atlasbarsg', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('dantenewyorkcity', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'World''s Best Bar', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('javier.de.las.muelas', 'person', 'Tales of the Cocktail Spirited Awards', 2019, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('napoleonhousenola', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Timeless American Award', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('floridita_cuba', 'bar', 'Tales of the Cocktail Spirited Awards', 2019, 'Timeless International Award', 'https://talesofthecocktail.org/tales-cocktail-foundation-announces-13th-annual-spirited-awards-winners/'),
    ('cafelatrovamiami', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best American Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('pch_sf', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best American Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('abvsf', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best American High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('spareroomhwood', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best American Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('thesilverdollar', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best American Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('silverlyan', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best New American Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('connaughtbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('nativebarsg', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('limantourmx', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best International High Volume Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('scarfesbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('sober_company', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('kwantmayfair', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('atlasbarsg', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('amoryamargo', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-the-first-round-of-2020-spirited-awards-winners/'),
    ('don.lee', 'person', 'Tales of the Cocktail Spirited Awards', 2020, 'Best American Bar Mentor', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('kevin.diedrich', 'person', 'Tales of the Cocktail Spirited Awards', 2020, 'American Bartender of the Year', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('alex.kratena', 'person', 'Tales of the Cocktail Spirited Awards', 2020, 'Best International Bar Mentor', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('kelseyramage', 'person', 'Tales of the Cocktail Spirited Awards', 2020, 'International Bartender of the Year', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('audreysaunders', 'person', 'Tales of the Cocktail Spirited Awards', 2020, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('shannonmustipher', 'person', 'Tales of the Cocktail Spirited Awards', 2020, 'Pioneer Award', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('hopeandsesame', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Philanthropy Recognitions', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('angelssharenyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Timeless American', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('boadascocktails', 'bar', 'Tales of the Cocktail Spirited Awards', 2020, 'Timeless International', 'https://talesofthecocktail.org/spirited-awards-archive/'),
    ('jared.brown', 'person', 'Tales of the Cocktail Spirited Awards', 2021, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2021-spirited-awards-winners/'),
    ('mixellany', 'person', 'Tales of the Cocktail Spirited Awards', 2021, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2021-spirited-awards-winners/'),
    ('chris.cabrera', 'person', 'Tales of the Cocktail Spirited Awards', 2021, 'Pioneer Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2021-spirited-awards-winners/'),
    ('dukeslondon', 'bar', 'Tales of the Cocktail Spirited Awards', 2021, 'Timeless International Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2021-spirited-awards-winners/'),
    ('tommysmexican', 'bar', 'Tales of the Cocktail Spirited Awards', 2021, 'Timeless U.S. Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2021-spirited-awards-winners/'),
    ('remy.savage', 'person', 'Tales of the Cocktail Spirited Awards', 2022, 'International Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('laurenmote', 'person', 'Tales of the Cocktail Spirited Awards', 2022, 'Best International Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('maybe_sammy_sydney', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('tayer_elementary', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('lyanessbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('sexyfishlondon', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('abarwithshapesforaname', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('chris.hannah', 'person', 'Tales of the Cocktail Spirited Awards', 2022, 'U.S. Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('seankenyon13', 'person', 'Tales of the Cocktail Spirited Awards', 2022, 'Best U.S. Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('katanakitten_nyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best U.S. Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('katanakitten_nyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('silverlyan', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best U.S. Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('jewelnola', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best U.S. Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('happyaccidentsbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Best New U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('lyanessbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'World''s Best Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('littlereddoor_paris', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('jackroseindc', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('amanda.gunderson', 'person', 'Tales of the Cocktail Spirited Awards', 2022, 'Pioneer Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('harrysbar_theoriginal', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Timeless International Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('bemelmansbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2022, 'Timeless U.S. Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('julie.reiner', 'person', 'Tales of the Cocktail Spirited Awards', 2022, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2022-spirited-awards-winners/'),
    ('giorgio.bargiani', 'person', 'Tales of the Cocktail Spirited Awards', 2023, 'International Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('agostino.perrone', 'person', 'Tales of the Cocktail Spirited Awards', 2023, 'Best International Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('alquimicocartagena', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('sips.barcelona', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('jiggerandponysg', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('analogueinitiative', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('line.athens', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('dramawise', 'person', 'Tales of the Cocktail Spirited Awards', 2023, 'U.S. Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('happyaccidentsbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best U.S. Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('centurygrandphx', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('heylovepdx', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best U.S. Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('cafelatrovamiami', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best U.S. Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('martinys_nyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Best New U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('doublechickenpleasenyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('raisedbywolvesspirits', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('desmond.payne', 'person', 'Tales of the Cocktail Spirited Awards', 2023, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('longbarsg', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Timeless International Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('tikiti1961', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'Timeless U.S. Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('sips.barcelona', 'bar', 'Tales of the Cocktail Spirited Awards', 2023, 'World''s Best Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2023-spirited-awards-winners/'),
    ('eric.vanbeek', 'person', 'Tales of the Cocktail Spirited Awards', 2024, 'International Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('cocktailman', 'person', 'Tales of the Cocktail Spirited Awards', 2024, 'Best International Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('handshake_bar', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('alquimicocartagena', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('bkksocialclub', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('danicoparis', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('barleonehk', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('kapri.possible', 'person', 'Tales of the Cocktail Spirited Awards', 2024, 'U.S. Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('axljump', 'person', 'Tales of the Cocktail Spirited Awards', 2024, 'Best U.S. Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('jewelnola', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best U.S. Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('yachtclubbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('allegory_dc', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best U.S. Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('cleaverlv', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best U.S. Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('superbuenonyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Best New U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('handshake_bar', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('baba_au_rum', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('hidetsugu.ueno', 'person', 'Tales of the Cocktail Spirited Awards', 2024, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('officialcafepacifico', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Timeless International Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('thebuenavistasf', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'Timeless U.S. Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('alquimicocartagena', 'bar', 'Tales of the Cocktail Spirited Awards', 2024, 'World''s Best Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2024-spirited-awards-winners/'),
    ('lorenzo.antinori', 'person', 'Tales of the Cocktail Spirited Awards', 2025, 'International Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('iain.mcpherson', 'person', 'Tales of the Cocktail Spirited Awards', 2025, 'Best International Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('pandaandsons', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('barleonehk', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('sidehustlelondon', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('moebiusmilano', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('devilscut.madrid', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('yummiwasabi', 'person', 'Tales of the Cocktail Spirited Awards', 2025, 'U.S. Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('cocktailcolin', 'person', 'Tales of the Cocktail Spirited Awards', 2025, 'Best U.S. Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('allegory_dc', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best U.S. Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('trickdogbar', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('little_rituals_bar', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best U.S. Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('barkumiko', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best U.S. Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('sipandguzzlenyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Best New U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('barkumiko', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'World''s Best Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('pandaandsons', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('elevenmadisonpark', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('ian.burrell', 'person', 'Tales of the Cocktail Spirited Awards', 2025, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('barcockmad', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Timeless International Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('keenssteakhouse', 'bar', 'Tales of the Cocktail Spirited Awards', 2025, 'Timeless U.S. Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2025-spirited-awards-winners-2/'),
    ('yayo_nava', 'person', 'Tales of the Cocktail Spirited Awards', 2026, 'International Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('indra.kantono', 'person', 'Tales of the Cocktail Spirited Awards', 2026, 'Best International Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('barleonehk', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best International Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('satans_whiskers', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('argobarhk', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best International Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('fura.sg', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best International Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('devie.bar', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best New International Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('takuma.watanabe', 'person', 'Tales of the Cocktail Spirited Awards', 2026, 'U.S. Bartender of the Year', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('amanda.gunderson', 'person', 'Tales of the Cocktail Spirited Awards', 2026, 'Best U.S. Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('travis.nass', 'person', 'Tales of the Cocktail Spirited Awards', 2026, 'Best U.S. Bar Mentor', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('servicebardc', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best U.S. Bar Team', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('barsnack.nyc', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('viceversamiami', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best U.S. Hotel Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('cobracolumbus', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best U.S. Restaurant Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('schmuck.ny', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Best New U.S. Cocktail Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('fura.sg', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'World''s Best Bar', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('allegory_dc', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'World''s Best Cocktail Menu', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('tlecan', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'World''s Best Spirits Selection', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('david.wondrich', 'person', 'Tales of the Cocktail Spirited Awards', 2026, 'Helen David Lifetime Achievement Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('bamboobar.bkk', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Timeless International Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('bryantslounge', 'bar', 'Tales of the Cocktail Spirited Awards', 2026, 'Timeless U.S. Award', 'https://talesofthecocktail.org/tales-of-the-cocktail-foundation-announces-2026-spirited-awards-winners/'),
    ('pdtnyc', 'bar', 'James Beard Awards', 2012, 'Outstanding Bar Program', 'https://villagevoice.com/2012/05/08/a-few-words-with-some-james-beard-award-winners'),
    ('aviarycocktails', 'bar', 'James Beard Awards', 2013, 'Outstanding Bar Program', 'https://www.foxnews.com/food-drink/2013-james-beard-restaurant-and-chef-award-winners'),
    ('nomadbarnyc', 'bar', 'James Beard Awards', 2014, 'Outstanding Bar Program', 'https://www.foxnews.com/food-drink/2014-james-beard-restaurant-and-chef-award-winners.amp'),
    ('violethourchicago', 'bar', 'James Beard Awards', 2015, 'Outstanding Bar Program', 'https://www.jamesbeard.org/stories/the-2015-james-beard-award-winners'),
    ('kingcocktail', 'person', 'James Beard Awards', 2015, 'Who''s Who of Food & Beverage in America', 'https://www.jamesbeard.org/stories/the-2015-james-beard-award-winners'),
    ('maisonpremiere', 'bar', 'James Beard Awards', 2016, 'Outstanding Bar Program', 'https://www.jamesbeard.org/stories/the-2016-beard-award-winners'),
    ('thefrench75bar', 'bar', 'James Beard Awards', 2017, 'Outstanding Bar Program', 'https://www.jamesbeard.org/stories/the-2017-james-beard-award-winners'),
    ('curenola', 'bar', 'James Beard Awards', 2018, 'Outstanding Bar Program', 'https://www.jamesbeard.org/stories/the-2018-james-beard-award-winners'),
    ('baragricole', 'bar', 'James Beard Awards', 2019, 'Outstanding Bar Program', 'https://www.jamesbeard.org/stories/the-2019-james-beard-award-winners'),
    ('julephou', 'bar', 'James Beard Awards', 2022, 'Outstanding Bar Program', 'https://www.jamesbeard.org/stories/the-2022-james-beard-award-winners'),
    ('barleatherapron', 'bar', 'James Beard Awards', 2023, 'Outstanding Bar', 'https://www.jamesbeard.org/stories/the-2023-james-beard-award-winners'),
    ('jewelnola', 'bar', 'James Beard Awards', 2024, 'Outstanding Bar', 'https://www.jamesbeard.org/stories/the-2024-james-beard-award-winners'),
    ('barkumiko', 'bar', 'James Beard Awards', 2025, 'Outstanding Bar', 'https://www.jamesbeard.org/stories/the-2025-james-beard-award-winners'),
    ('identidadcocktailbar', 'bar', 'James Beard Awards', 2025, 'Best New Bar', 'https://www.jamesbeard.org/stories/the-2025-james-beard-award-winners'),
    ('nacho.jimenez', 'person', 'James Beard Awards', 2025, 'Outstanding Professional in Cocktail Service', 'https://www.jamesbeard.org/stories/the-2025-james-beard-award-winners'),
    ('scotchlodge', 'bar', 'James Beard Awards', 2026, 'Outstanding Bar', 'https://www.jamesbeard.org/stories/james-beard-award-winners-2026'),
    ('loma_bar', 'bar', 'James Beard Awards', 2026, 'Best New Bar', 'https://www.jamesbeard.org/stories/james-beard-award-winners-2026'),
    ('kevin.diedrich', 'person', 'James Beard Awards', 2026, 'Outstanding Professional in Cocktail Service', 'https://www.jamesbeard.org/stories/james-beard-award-winners-2026')
) AS v("handle", "kind", "award", "year", "title", "source_url")
JOIN "public"."profiles" p ON p.handle = v.handle AND p.kind::text = v.kind
-- Same award already there under slightly different wording (a curly
-- apostrophe, "The", or "Award" at the end).
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profile_awards" x
    WHERE x.profile_id = p.id AND x.award = v.award AND x.year = v.year::smallint
      AND regexp_replace(translate(lower(x.title), '’', chr(39)), '^the | award$', '', 'g')
        = regexp_replace(lower(v.title), '^the | award$', '', 'g')
)
ON CONFLICT DO NOTHING;

-- --- Signature drinks ---

-- Seeded drinks don't queue automatic sketches (nobody to bill for them).
SET "app.image_worker" = 'on';

CREATE TEMP TABLE "seed_drinks" ("handle" text, "bar_name" text, "name" text, "description" text, "notes" text,
    "riff_of" text, "origin_year" int, "glass" text, "ice" text, "method" text);
CREATE TEMP TABLE "seed_lines" ("handle" text, "bar_name" text, "drink" text, "pos" int, "amount" numeric, "unit" text,
    "ingredient" text, "generic" text, "prep" text, "optional" boolean);
CREATE TEMP TABLE "seed_classics" ("name" text, "description" text, "notes" text, "origin_year" int,
    "glass" text, "ice" text, "method" text);

INSERT INTO "seed_drinks" VALUES
    ('allegory_dc', NULL, 'Eyes of Flame', 'Stirred mezcal and rum drink with Nixta corn liqueur, mandarin oleo saccharum, clarified passion fruit and palo cortado.', 'Deke Dunne built it for the moment in the Down the Rabbit Hole storybook when Ruby, as Alice, slays the Jabberwocky. Two drops of pumpkin seed oil on top stand in for the creature''s eyes, and bartenders point guests to the mural when they serve it.

Created by Deke Dunne in 2022.

Method: Combine all ingredients, stir and refrigerate (batched).

Spec from The Spirits Business (https://www.thespiritsbusiness.com/2025/02/cocktail-stories-eyes-of-flame-allegory/).', NULL, 2022, NULL, NULL, 'Stir'),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 'Gin and rhum agricole with bitter bianco, snap peas, cardamom, aloe, black pepper coconut and lemon.', 'Kapri Robinson''s drink for the Down the Rabbit Hole menu, pitched to guests as a Mai Tai grown in a garden: green, earthy and fresh. It shows the menu''s habit of hiding farm and pantry techniques inside a familiar shape.

Created by Kapri Robinson in 2022.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/stories/News/north-america-bars-best-cocktail-menu-2023-allegory.html). No measures have been published.', 'Mai Tai', 2022, NULL, NULL, NULL),
    ('allegory_dc', NULL, 'Eden', 'A clarified, carbonated and bottled take on the Ramos Gin Fizz, served with a spray of bubbles.', 'Dunne wanted the drink for the Eden page of the story to taste like childhood summers, cut grass and orange creamsicle. He clarified and carbonated a Ramos Gin Fizz, and staff blow bubbles over the guest as it lands.

Created by Deke Dunne in 2022.

Sources: https://www.the50.com/stories/News/north-america-bars-best-cocktail-menu-2023-allegory.html', 'Ramos Gin Fizz', 2022, NULL, NULL, NULL),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 'Clarified kefir milk punch of Equiano rum, Starward Twofold whisky, banana liqueur, amontillado and yuzu, finished with ube gomme.', 'A milk punch clarified with kefir and whole milk, strained for a day through chinois until it runs clear, then sweetened with purple ube syrup. The result is silky without tasting milky, and it was served on a light-up coaster.

Method: Batch everything except kefir and milk, then add them and rest at least 30 minutes to curdle. Strain through chinois strainers until clear (all day or overnight), stir in the ube gomme, and pour 4 oz over a single rock.
Ube gomme: Gum syrup flavoured with ube; the source gives no method.

Ingredients from Cool Hunting (https://coolhunting.com/food-drink/allegory-at-eaton-dc/). No measures have been published.', NULL, NULL, NULL, 'Large Cube', 'Stir'),
    ('allegory_dc', NULL, 'All That She Carried', 'An Old Fashioned variation with a campfire-and-mountains character, from the Banned in D.C. menu.', 'Greg Long''s drink for Allegory''s 2025 Banned in D.C. menu, where each of 17 story chapters gets its own cocktail and the creator''s name is printed under it. The team pitches it as an Old Fashioned that went camping.

Created by Greg Long in 2025.

Sources: https://www.the50.com/stories/News/allegory-dc-north-americas-best-cocktail-menu-2026.html', 'Old Fashioned', 2025, NULL, NULL, NULL),
    ('bryantslounge', NULL, 'Pink Squirrel', 'Creamy pink after-dinner drink of crème de noyau, served at Bryant''s as an ice cream blend.', 'Bryant''s says founder Bryant Sharp created it at the bar in the 1940s (Difford''s dates it to 1941), and it became a Wisconsin supper-club staple. The house version uses ice cream and, per Difford''s, second owner Pat Malmberg dropped the crème de cacao in the 1960s.

Created by Bryant Sharp in 1941.

Method: Shake all ingredients with ice and fine strain into a chilled glass.

Spec adapted from Difford''s Guide (https://www.diffordsguide.com/cocktails/recipe/2736/pink-squirrel).', NULL, 1941, 'Nick & Nora', NULL, 'Shake'),
    ('bryantslounge', NULL, 'Blue Tail Fly', 'Blue ice cream-style lounge drink with bitter orange and vanilla flavours.', 'Another drink credited to Bryant Sharp; the bar says it was once nearly as popular as the Pink Squirrel in Wisconsin supper clubs, and it still features among the drinks guests can order by name.

Created by Bryant Sharp.

Sources: https://www.bryantscocktaillounge.com/cocktails, https://www.bryantscocktaillounge.com/history', NULL, NULL, NULL, NULL, NULL),
    ('bryantslounge', NULL, 'Kismet', 'Bryant''s original from the 1940s: Southern Comfort, lemon and the lounge''s own syrups.', 'One of the house recipes the bar keeps secret; staff describe its flavour as hard to pin down. It is part of the old repertoire that survived three owners because the recipes passed with the lounge.

Sources: https://www.bryantscocktaillounge.com/cocktails', NULL, NULL, NULL, NULL, NULL),
    ('bryantslounge', NULL, 'Railsplitter', 'Frothy Depression-era style bourbon drink served over extra-cold rocks.', 'A Bryant Sharp original from the bar''s family of blended Depression-era drinks, now served in a custom glass designed by Pete Klockau of The Black Lagoon Room.

Created by Bryant Sharp.

Sources: https://www.bryantscocktaillounge.com/cocktails', NULL, NULL, NULL, NULL, NULL),
    ('cleaverlv', NULL, 'Polynesian Pearl Diver', 'Rum blend with falernum, orange, cream and a cookie butter syrup.', 'Listed in the menu''s Tiki Revolution chapter; the house swaps the usual buttery spice mix for cookie butter syrup across Puerto Rican, demerara and Jamaican rums.

Ingredients from Cleaver Las Vegas (https://www.cleaverlasvegas.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('cleaverlv', NULL, 'Ready Fire Aim', 'Mezcal with pink peppercorn, honey, pineapple, lime and Hellfire bitters.', 'The spicy mezcal sour that opens the menu''s modern section, the era the bar dates from Dale DeGroff onward.

Ingredients from Cleaver Las Vegas (https://www.cleaverlasvegas.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('cleaverlv', NULL, 'Rattle Snake', 'Rye sour with absinthe, lemon and egg white.', 'A European-era classic the bar singles out on its own site as one of its signature pours, served in the menu''s 1910 to 1935 chapter.

Ingredients from Cleaver Las Vegas (https://www.cleaverlasvegas.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('cleaverlv', NULL, 'Cock n Bull Special', 'Stirred bourbon and cognac with Benedictine and bitters.', 'A spirit-forward classic the bar highlights for its happy hour, served from the menu''s European Influence chapter.

Ingredients from Cleaver Las Vegas (https://www.cleaverlasvegas.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('barcockmad', NULL, 'Gimlet', 'Gin and lime cordial, served cold and sharp in the old-club style.', 'Press coverage of Bar Cock repeatedly names the gimlet among the classics it does best; it is one of the drinks that define the bar''s refusal to chase modern mixology.

Sources: https://airmail.news/arts-intel/venues/bar-cock', 'Gimlet', NULL, NULL, NULL, NULL),
    ('barcockmad', NULL, 'Dry Martini', 'Gin and dry vermouth, stirred and served with a twist.', 'Air Mail describes the bar''s repertoire as gin martinis with a twist, negronis and gimlets, and the Dry Martini heads the list of its traditional cocktails in local guides.

Sources: https://airmail.news/arts-intel/venues/bar-cock, https://madridclick.es/bar-cock/', 'Martini', NULL, NULL, NULL, NULL),
    ('barcockmad', NULL, 'Gin and Tonic', 'Spanish-style gin and tonic, the drink the bar says it specialises in.', 'The bar''s own site names gin and tonic as its speciality, and quoted press praises its gin and tonics as impeccable, a nod to Madrid''s long love affair with the drink.

Sources: https://www.barcock.com/en', NULL, NULL, NULL, NULL, NULL),
    ('devilscut.madrid', NULL, 'Jamón Ibérico Fashioned', 'Sherry brandy with jamón ibérico, acorn (bellota) liqueur and palo cortado.', 'The drink most press picks from the Devil''s Signatures, the section Gokan curated for Madrid around sherry and Spanish pantry staples. Cured Iberian ham and bellota liqueur echo the acorn-fed pigs behind the jamón.

Sources: https://devilscutmadrid.com/wp-content/uploads/2026/07/DC-Menu-Carta-Website-260706-o.pdf, https://www.the50.com/discovery/Establishments/Spain/Madrid/Devils-Cut.html', 'Old Fashioned', 2024, NULL, NULL, NULL),
    ('devilscut.madrid', NULL, 'Manchego Sour', 'Pisco and moscatel sherry with oolong tea, egg white and Manchego cheese.', 'A Devil''s Signature that folds Spain''s best-known cheese into a pisco sour frame, with oolong and sweet moscatel giving it a Japanese-Spanish accent typical of the bar.

Sources: https://devilscutmadrid.com/wp-content/uploads/2026/07/DC-Menu-Carta-Website-260706-o.pdf', 'Pisco Sour', NULL, NULL, NULL, NULL),
    ('devilscut.madrid', NULL, 'Devil''s Adonis', 'Fino and amontillado sherries with sweet vermouth and passion fruit.', 'A sherry-on-sherry aperitif from the Devil''s Signatures, reflecting Gokan''s long association with sherry and the venencia.

Sources: https://devilscutmadrid.com/wp-content/uploads/2026/07/DC-Menu-Carta-Website-260706-o.pdf', NULL, NULL, NULL, NULL, NULL),
    ('devilscut.madrid', NULL, 'Devil''s Bamboo', 'Fino sherry and dry vermouth with tomato.', 'Singled out by 50 Best as a must-order: a savoury Bamboo built on Spanish tomato. It is not on the July 2026 menu.

Sources: https://www.the50.com/discovery/Establishments/Spain/Madrid/Devils-Cut.html', 'Bamboo', 2024, NULL, NULL, NULL),
    ('devilscut.madrid', NULL, 'Café con Leche', 'Haku vodka with milk-brewed Geisha coffee, vermouth and Pedro Ximénez.', 'A Madrid signature that turns Spain''s breakfast staple into an after-dinner drink, extracting Geisha coffee in milk and sweetening with PX sherry.

Sources: https://devilscutmadrid.com/wp-content/uploads/2026/07/DC-Menu-Carta-Website-260706-o.pdf', NULL, NULL, NULL, NULL, NULL),
    ('floridita_cuba', NULL, 'Daiquirí Floridita', 'Frozen daiquiri of Havana Club rum, sugar, lime and maraschino.', 'The house daiquiri that made the bar famous: Constante is credited with popularising the blended frozen daiquiri in the early 1930s, and the bar still calls itself the cradle of the daiquiri.

Created by Constantino Ribalaigua Vert.

Method: Blended with ice (frozen).

Ingredients from barfloridita.com (https://www.barfloridita.com/drinks-and-food). No measures have been published.', 'Daiquiri', NULL, NULL, NULL, 'Blitz'),
    ('floridita_cuba', NULL, 'Papa Hemingway (Hemingway Special)', 'Double-rum daiquiri with grapefruit and maraschino, made the way Hemingway asked for it.', 'Constante created it for Ernest Hemingway, who wanted his daiquiri with double rum and no sugar; it is on the bar''s menu today as the Papa Hemingway.

Created by Constantino Ribalaigua Vert.

Method: Shake all ingredients with ice and fine strain into a chilled glass.

Spec adapted from Difford''s Guide (https://www.diffordsguide.com/cocktails/recipe/954/hemingway-special-daiquiri-papa-doble).', 'Hemingway Daiquiri', NULL, 'Martini', NULL, 'Shake'),
    ('floridita_cuba', NULL, 'Daiquiri No. 4', 'Constante''s shaken daiquiri with maraschino.', 'The fourth of four numbered daiquiris in the 1934 first edition of the Bar La Florida Cocktails menu book, adding a little maraschino to rum, lime and sugar the way the bar''s house daiquiri still does.

Created by Constantino Ribalaigua Vert in 1934.

Method: Shake all ingredients with ice and fine strain into a chilled glass.

Spec adapted from Difford''s Guide (https://www.diffordsguide.com/cocktails/recipe/2368/daiquiri-no-4).', 'Daiquiri', 1934, 'Coupette', NULL, 'Shake'),
    ('floridita_cuba', NULL, 'Daiquirí Mulata', 'Aged Havana Club rum daiquiri with crème de cacao, lime and sugar.', 'One of the Floridita''s family of daiquiris, swapping white rum for añejo and adding chocolate liqueur for a darker, richer version.

Ingredients from barfloridita.com (https://www.barfloridita.com/drinks-and-food). No measures have been published.', 'Daiquiri', NULL, NULL, NULL, NULL),
    ('bar500a', NULL, 'Phil Collins', 'Cucumber vodka and yellow Chartreuse highball with lime, sugar, cranberry bitters and soda.', 'Jackson Cannon''s pun on the Tom Collins was on the bar''s opening menu and became its best-known drink; it returned each summer for a few weeks, and the bar threw a party for the singer''s birthday.

Created by Jackson Cannon in 2011.

Method: Shake everything but the soda with ice for 5 to 7 seconds, strain into an ice-filled Collins glass and top with soda.

Spec from The Food Lens (https://www.thefoodlens.com/boston/sides/recipes/cocktail-of-the-week-the-phil-collins/).', 'Tom Collins', 2011, 'Highball', 'Cubes', 'shake and top'),
    ('bar500a', NULL, 'Belafonte', 'Plantation rum with Carpano vermouth, Cynar and a house-made coffee liqueur.', 'A frequent fixture on the rotating menu, praised in the Daily Beast for its rich, luxurious flavour and a retro name that nods to calypso and Italy at once.

Ingredients from The Hawthorne (press page) (https://www.thehawthornebar.com/press). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bar500a', NULL, 'Under the Volcano', 'Stirred Chichicapa mezcal with East India sherry, Amaro Nonino and mole bitters.', 'A smoky, brown-and-stirred mezcal drink named in the Improper Bostonian''s praise of the bar and still being poured years later, finished with a flamed orange peel.

Ingredients from The Hawthorne (press page) (https://www.thehawthornebar.com/press). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('little_rituals_bar', NULL, 'Big City Nights', 'Blackberry gin sour with Suze, dry vermouth, lemon and herbed cinnamon syrup under an egg-white foam.', 'Aaron DeFeo''s statement on Phoenix sophistication: the foam carries an edible rice-paper disc printed with the bar''s mural of Phoenix landmarks. The bar makes its syrups sous vide; the magazine recipe is a simplified home version, and today''s menu uses fino vermouth.

Created by Aaron DeFeo in 2019.

Method: Dry shake 30 seconds, add ice and shake hard another 30 seconds, then fine strain into a chilled coupe.
Herbed cinnamon syrup: Boil 2 cups sugar with 1 cup water, a cinnamon stick and 1 tablespoon herbes de Provence, simmer until dissolved, cool and strain.

Spec adapted from PHOENIX magazine (https://www.phoenixmag.com/2019/05/28/how-to-make-little-rituals-big-city-nights-cocktail/).', NULL, 2019, 'Coupette', NULL, 'dry shake and shake'),
    ('little_rituals_bar', NULL, 'Reality Check', 'Raspberry and French vermouth highball with raspberry eau de vie, Acqua di Cedro, guava cordial, lemon and bubbles.', 'Bartender Raquel Villa''s drink, named by DeFeo in 2026 as his favourite on the menu: a two-ounce base of dry vermouth keeps it light enough for the Sonoran summer while the guava cordial adds depth.

Created by Raquel Villa.

Ingredients from Little Rituals (https://www.littleritualsbar.com/s/Complete-Menu-Aug-2026.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('little_rituals_bar', NULL, 'Ballpark Highball', 'Japanese and Scotch whisky highball with barley tea sherry and house soda, served with Japanese-style peanuts.', 'A nutty, dry whisky highball that pairs Suntory Toki and Monkey Shoulder with a barley-tea-infused sherry, and comes with a side of Japanese-style peanuts to match its name.

Ingredients from Little Rituals (https://www.littleritualsbar.com/s/Complete-Menu-Aug-2026.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('little_rituals_bar', NULL, 'Cartographer', 'Tiki-style bourbon and overproof rum drink with cascara cordial, vanilla passion fruit, clarified L.G.O. and cardamom.', 'One of the bar''s Classic Rituals, combining coffee-cherry cascara with a clarified lime-grapefruit-orange juice to keep a tropical drink velvety rather than pulpy.

Ingredients from Little Rituals (https://www.littleritualsbar.com/s/Complete-Menu-Aug-2026.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('raisedbywolvesspirits', NULL, 'Dreadlock Holiday', 'Stirred Jamaican rum drink with Suze, bianco vermouth and a spoon of pineapple liqueur.', 'Erick Castro balanced the bitter bite of gentian with the bar''s own blend of Jamaican rums and a touch of pineapple, served over one large cube.

Created by Erick Castro in 2018.

Method: Stir with ice and strain into a rocks glass over one large cube. Twist a lemon peel over the top and use it as garnish.
Wolf Rum: Equal parts Appleton Estate Reserve and Two James Spirits Doctor Bird, bottled together.

Spec from Imbibe (https://imbibemagazine.com/raised-by-wolves-cocktail-dreadlock-holiday/).', NULL, 2018, 'Rocks', 'Large Cube', 'Stir'),
    ('raisedbywolvesspirits', NULL, 'Sundress', 'Vodka and Thai basil eau de vie with dry vermouth, pandan, lime and seltzer.', 'Highlighted by 50 Best as typical of the bar''s globe-trotting list, pairing Southeast Asian pandan and Thai basil with a light vodka highball.

Sources: https://www.the50.com/discovery/Establishments/US/San-Diego/Raised-By-Wolves.html', NULL, NULL, NULL, NULL, NULL),
    ('raisedbywolvesspirits', NULL, 'Cosmic Dancer', 'Gin, vino amaro, raspberry and lemon: a remix of the bar''s Bramble.', 'The bar says the Bramble was probably its most-shaken cocktail of the decade; this Wolf Pack Classic reworks it with an herbal vino amaro.

Ingredients from Raised by Wolves (https://cdnm.heyzine.com/files/uploaded/v3/7c7b20eafbcc41f0bcaf51b859086cb24a105659-3.pdf). No measures have been published.', 'Bramble', NULL, NULL, NULL, NULL),
    ('raisedbywolvesspirits', NULL, 'Finders Keepers', 'Pan-Pacific Piña Colada with white and Oaxacan rums, nori, pineapple, coconut cream, macadamia-koji orgeat and lime.', 'A savoury, nutty take on the Piña Colada from the current menu, using nori and a koji-fermented macadamia orgeat.

Ingredients from Raised by Wolves (https://cdnm.heyzine.com/files/uploaded/v3/7c7b20eafbcc41f0bcaf51b859086cb24a105659-3.pdf). No measures have been published.', 'Piña Colada', NULL, NULL, NULL, NULL),
    ('thesilverdollar', NULL, 'Honky Tonk', 'Rye and Spanish brandy stirred with demerara, root beer and Angostura bitters in a Green Chartreuse-rinsed glass.', 'Larry Rice''s stirred house drink, named for the bar''s theme; Cardenal Mendoza brandy and root beer bitters round out bottled-in-bond rye.

Created by Larry Rice.

Method: Rinse a cocktail glass with the Green Chartreuse and discard the excess. Stir the rest with ice and strain into the glass. Twist an orange peel over the drink and discard.

Spec from The Bourbon Review (https://www.gobourbon.com/raising-the-bar-larry-rice/).', NULL, NULL, 'Martini', NULL, 'Stir'),
    ('thesilverdollar', NULL, 'One Horse Cowboy', 'Wild Turkey 101 bourbon with Cocchi Americano, dry curaçao, grapefruit, lemon and orange bitters.', 'One of Rice''s signature bourbon cocktails, a bright, citrusy sour showing the bar''s focus on Kentucky whiskey in fresh-juiced drinks.

Created by Larry Rice.

Ingredients from The Bourbon Review (https://www.gobourbon.com/raising-the-bar-larry-rice/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('tikiti1961', NULL, 'Ray''s Mistake', 'Passion fruit, lime and gin with a dark Jamaican rum float and a secret vanilla-tinged flavouring.', 'Named after founder Ray Buhen and the bar''s most popular drink since it was invented in 1968; the menu jokes that having too many would be the mistake.

Ingredients from Tiki-Ti (http://tiki-ti.com/QR-Menu/QR-menu.html). No measures have been published.', NULL, 1968, NULL, NULL, NULL),
    ('tikiti1961', NULL, 'Blood & Sand', 'Orange, lime and cherry with a choice of bourbon, Scotch or tequila, topped from a bull-shaped bottle.', 'Named for Rudolph Valentino''s bullfighting film, it is the bar''s ritual drink: most guests take it with the ''Bull'' pour while the room chants ''Toro! Toro! Olé! Olé!''.

Ingredients from Tiki-Ti (http://tiki-ti.com/QR-Menu/QR-menu.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('tikiti1961', NULL, 'Uga Booga', 'Passion fruit, lime and Myers''s rum.', 'The other chanting drink: the whole bar shouts ''Uga Booga!'' while it is made.

Ingredients from Tiki-Ti (http://tiki-ti.com/QR-Menu/QR-menu.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('keenssteakhouse', NULL, 'Keens Old Fashioned', 'Old Overholt rye stirred over ice with a barspoon of simple syrup, two dashes of bitters and orange oil, finished with lemon peel and a cherry.', 'Head bartender Manolo names the Old Fashioned the drink he pours most at Keens and his favourite to make. The house build is a big one, three ounces of rye, in keeping with the steakhouse''s strong pours.

Method: Express orange peel oil into the glass, add simple syrup and bitters, add the rye and stir over ice.

Spec from Punch (https://punchdrink.com/articles/keens-new-york-steakhouse/).', 'Old Fashioned', NULL, 'Rocks', NULL, 'Stir'),
    ('keenssteakhouse', NULL, 'Keens Martini', 'A large, very dry steakhouse Martini with gin or vodka and a splash of vermouth, often garnished with house-made blue-cheese-stuffed olives.', 'Keens sells more than a hundred Martinis a day, split roughly evenly between gin and vodka, from the bar and the dining rooms. Staff stuff the blue cheese olives by hand every day, and the drink is poured in the bar''s 19th-century room under the painting of Miss Keens.

Sources: https://punchdrink.com/articles/state-of-the-new-york-city-steakhouse-martini-cocktail-gallaghers-nyc/, https://punchdrink.com/articles/keens-new-york-steakhouse/', 'Martini', NULL, NULL, NULL, NULL),
    ('thebuenavistasf', NULL, 'Irish Coffee', 'Tullamore D.E.W. Irish whiskey, hot Peerless coffee and two sugar cubes in a warmed goblet, crowned with a float of lightly whipped heavy cream.', 'The drink that made the bar: Jack Koeppler and Stanton Delaplane worked on it from November 1952, and Koeppler even travelled to Shannon Airport to study the original. The cream is aged about 48 hours so it floats, and the six-ounce heat-treated goblet has not changed in decades.

Created by Jack Koeppler and Stanton Delaplane in 1952.

Method: Rinse the glass with hot water to warm it. Add hot coffee and stir in the sugar cubes until dissolved. Stir in the whiskey. Gently spoon a layer of thick cream on top.

Spec from 7x7 (courtesy of the Buena Vista) (https://www.7x7.com/buena-vista-cafe-original-irish-coffee-recipe-2651100231.html).', NULL, 1952, NULL, NULL, 'Stir'),
    ('clydecommon', NULL, 'Barrel-Aged Negroni', 'Equal parts gin, sweet vermouth and Campari batched and rested five to seven weeks in a used whiskey barrel before being stirred to order.', 'After tasting Tony Conigliaro''s bottle-aged Manhattan in London in 2009, Morgenthaler moved the idea into small used whiskey casks at Clyde Common, and the aged Negroni became the drink that launched a worldwide trend. The oak softens the Campari and adds vanilla and tannin, and a barrel-aged drink stayed on the menu for years.

Created by Jeffrey Morgenthaler in 2010.

Method: Batch recipe, makes three gallons. Stir together without ice, pour into a three-gallon used oak whiskey barrel and rest five to seven weeks, then bottle. To serve, stir a measure over ice and strain.

Spec from jeffreymorgenthaler.com (https://jeffreymorgenthaler.com/barrel-aged-cocktails/).', 'Negroni', 2010, NULL, NULL, 'Stir'),
    ('clydecommon', NULL, 'Bourbon Renewal', 'Bourbon shaken with lemon, crème de cassis, simple syrup and a dash of Angostura, served over ice.', 'A Morgenthaler original from 2004, named after a band his business partner once played in. At Clyde Common it was the best-selling drink on the menu for years, a sour built on the same proportions as a Sidecar with cassis bringing berry and colour.

Created by Jeffrey Morgenthaler in 2004.

Method: Shake with ice until cold and strain over fresh ice.

Spec from jeffreymorgenthaler.com (https://jeffreymorgenthaler.com/bourbon-renewal/).', 'Whiskey Sour', 2004, 'Rocks', NULL, 'Shake'),
    ('clydecommon', NULL, 'Amaretto Sour', 'Amaretto backed by cask-strength bourbon, with lemon, a spoon of rich syrup and egg white, shaken frothy and served on the rocks.', 'Morgenthaler''s 2012 rework rescued a much-mocked drink: less sugar, and cask-proof bourbon to give the amaretto backbone. It became one of the most copied modern recipes, credited with reviving the Amaretto Sour.

Created by Jeffrey Morgenthaler in 2012.

Method: Combine and dry shake, or froth with an immersion blender. Shake well with cracked ice and strain over fresh ice.

Spec from jeffreymorgenthaler.com (https://jeffreymorgenthaler.com/i-make-the-best-amaretto-sour-in-the-world/).', NULL, 2012, 'Rocks', NULL, 'dry shake and shake'),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 'A batched holiday eggnog of añejo tequila and amontillado sherry with eggs, sugar, milk, cream and nutmeg, aged overnight.', 'Morgenthaler''s holiday nog for Clyde Common skips the usual brandy or rum and builds on añejo tequila and nutty amontillado sherry. It is made in gallon batches and rested overnight so the flavours knit together.

Created by Jeffrey Morgenthaler.

Method: Batch, makes 1 gallon. Beat eggs smooth on low speed, slowly add nutmeg and sugar until dissolved, then sherry, tequila, milk and cream. Refrigerate overnight and serve in small chilled cups.

Spec from Punch (https://punchdrink.com/recipes/clyde-common-egg-nog/).', NULL, NULL, 'Custom', NULL, 'Build'),
    ('columbiaroom', NULL, 'Getaway', 'A dark, bitter Daiquiri of blackstrap-style rum and Cynar with lemon, lime and rich syrup, shaken and served up.', 'Brown made it on the spot when a guest challenged him to build something that tasted like a Daiquiri but used Cynar, the artichoke amaro, and he calls it the one improvised drink he got exactly right. The bar brought it back for its tenth-anniversary menu in 2020, paired with a zero-proof version.

Created by Derek Brown.

Method: Shake with ice and fine strain into a chilled coupe.

Spec adapted from Difford''s Guide (https://www.diffordsguide.com/cocktails/recipe/3281/the-getaway-aka-cynar-daiquiri).', 'Daiquiri', NULL, 'Coupette', NULL, 'Shake'),
    ('columbiaroom', NULL, 'Into Great Silence', 'Fino sherry, green Chartreuse, orgeat, grapefruit and a jus vert of spinach and parsley, served in a terrarium of fresh herbs.', 'Brown called it technically perfect: a savoury green juice sounds wrong in a cocktail but ties the Chartreuse and sherry together. The herb-filled terrarium means you smell Chartreuse botanicals before you sip. First served on the Paris in Spring menu and revived for the 2020 anniversary.

Ingredients from Washingtonian (https://www.washingtonian.com/2020/01/07/columbia-rooms-new-menu-revives-its-best-ever-cocktails/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('columbiaroom', NULL, 'Atlantic Ocean', 'Single malt Scotch and red vermouth meet cachaça and tomato water, bridged by house transatlantic bitters.', 'An old-world versus new-world drink, with house bitters built from spices traded across the Atlantic. Brown said the ingredient list scared him at first, yet named it his favourite cocktail ever to come out of Columbia Room.

Ingredients from Washingtonian (https://www.washingtonian.com/2020/01/07/columbia-rooms-new-menu-revives-its-best-ever-cocktails/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('columbiaroom', NULL, 'In Search of Time Past', 'Armagnac, vintage PX sherry, porcini cordial and eucalyptus with a spirit fat-washed from century-old book pages, served in a flask inside a hollowed book.', 'Inspired by candied book pages Brown saw at El Celler de Can Roca, head bartender JP Fetherston vacuum-sealed pages of 100-year-old books with grapeseed oil, then fat-washed a neutral spirit with it to capture the smell of an old library. It was the dessert course of the 2016 autumn tasting menu.

Created by JP Fetherston in 2016.

Old-book tincture: Vacuum-seal pages from century-old books with grapeseed oil, then use that oil to fat-wash a neutral high-proof spirit.

Ingredients from Washingtonian (https://washingtonian.com/2016/11/30/columbia-room-has-a-cocktail-literally-made-with-old-books/). No measures have been published.', NULL, 2016, NULL, NULL, NULL),
    ('dukeslondon', NULL, 'Dukes Martini', 'Frozen gin or vodka poured straight into a frozen glass washed with a few dashes of dry vermouth, finished with an olive or lemon peel.', 'Salvatore Calabrese''s direct method skips stirring with ice: the spirit is kept in the freezer so it pours thick and cold with no added water, and it is made tableside from a century-old rosewood trolley. Palazzi now uses an English vermouth made with Sacred and Amalfi lemon peel, and the size means a two-drink limit.

Created by Salvatore Calabrese in 1987.

Method: Dash vermouth into a frozen glass, then pour in the frozen gin or vodka. Do not stir.

Spec from Punch (https://punchdrink.com/recipes/dukes-martini/).', 'Martini', 1987, 'Martini', NULL, 'Stir'),
    ('dukeslondon', NULL, 'Vesper', 'No. 3 London Dry Gin and Potocki Polish vodka over a coating of Angostura and Lillet Blanc in a frozen glass, with orange zest.', 'Palazzi''s tribute to Ian Fleming, a Dukes regular, created in 2012 for the 50th anniversary of Dr. No. He picks a Polish vodka to honour a real wartime spy and a gin from neighbouring Berry Bros. & Rudd, and uses Lillet Blanc since the Kina Lillet of the novel no longer exists.

Created by Alessandro Palazzi in 2012.

Method: Freeze the glass. Add a dash of Angostura and swirl to coat the base, add the Lillet Blanc, then the vodka and the gin.

Spec from St James''s London (Alessandro Palazzi) (https://www.stjameslondon.co.uk/news/how-to-create-a-dukes-bar-vesper-martini-at-home).', 'Vesper', 2012, 'Martini', NULL, NULL),
    ('dukeslondon', NULL, 'Fleming 89', 'Vanilla-infused Russian vodka with sugared rose petals, vermouth, Lillet and chocolate bitters.', 'Palazzi''s second 2012 Bond tribute is named for Floris No. 89, the Jermyn Street eau de toilette that was James Bond''s scent, and is a softer, sweeter counterpart to the Dukes Martini.

Created by Alessandro Palazzi in 2012.

Vanilla vodka: Infuse Russian vodka with vanilla beans.

Ingredients from Cigar Aficionado (https://www.cigaraficionado.com/article/dukes-hotel-the-world-s-best-martini). No measures have been published.', NULL, 2012, NULL, NULL, NULL),
    ('napoleonhousenola', NULL, 'Pimm''s Cup', 'Pimm''s No. 1 over ice with house lemonade, topped with lemon-lime soda and garnished with cucumber.', 'Napoleon House gave the English summer cup a New Orleans twist in the 1940s with lemonade, 7UP and cucumber, and it became a city staple. It is a low-proof drink for hot afternoons; a longtime bartender says he goes through a case of Pimm''s a day.

Method: Fill a tall 12 oz glass with ice, add the Pimm''s and lemonade, and top with Seven Up.

Spec adapted from New Orleans & Company (https://www.neworleans.com/drink/cocktails/pimms-cup/).', NULL, NULL, 'Highball', NULL, NULL),
    ('napoleonhousenola', NULL, 'Sazerac', 'Sazerac rye with simple syrup, Peychaud''s and Angostura bitters and Herbsaint.', 'The New Orleans classic is the house''s other staple and, with the Pimm''s Cup, one of the drinks its bartenders make most. It can be ordered with Mata Hari absinthe in place of Herbsaint.

Ingredients from Napoleon House menu (https://www.napoleonhouse.com/cocktails). No measures have been published.', 'Sazerac', NULL, NULL, NULL, NULL),
    ('saxonandparole', NULL, 'Corn Milk Punch', 'Dark rum and brandy shaken with house corn-infused milk and cinnamon syrup, served tall over ice with black sesame seeds.', 'A summer take on the New Orleans milk punch: fresh corn kernels and cobs steep overnight in whole milk with vanilla and cinnamon, giving the drink a sweet, earthy corn flavour.

Method: Combine and shake with ice. Strain into an ice-filled glass and garnish.
Corn-infused milk: Cut the kernels from 3 ears of corn and soak kernels and cobs overnight in 2 quarts of full-cream milk with 2 split vanilla pods and 4 cinnamon sticks. Strain and refrigerate up to a week.

Spec from Imbibe (https://imbibemagazine.com/corn-milk-punch/).', NULL, 2014, 'Highball', NULL, 'Shake'),
    ('saxonandparole', NULL, 'Olive 7 Ways', 'A reworked Dirty Martini built from olive distillate, olive bitters, olive shrub and olive-infused vermouth.', 'Naren Young''s answer to the Dirty Martini swaps cloudy brine for olive flavour in several clearer forms, from a distillate to a shrub, for a cleaner, more layered savoury Martini.

Created by Naren Young.

Ingredients from Imbibe (https://imbibemagazine.com/martini-riffs/). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('saxonandparole', NULL, 'Cup ''o Punch', 'A batched autumn milk punch of Facundo Eximo rum and Laird''s bonded applejack with roasted pumpkin maple syrup, lemon and hojicha-steeped milk, strained clear.', 'Masa Urushido''s punch uses the milk-washing technique: hot hojicha milk is poured into the spirits, left to curdle and then strained through cheesecloth and a coffee filter, leaving a clear, silky drink. It is served over a hand-carved chunk of ice.

Created by Masa Urushido in 2017.

Pumpkin-orange maple syrup: Warm maple sugar with water; just before it simmers add roasted pumpkin and orange peel, then take off the heat and cool.

Ingredients from StarChefs (adapted) (https://www.starchefsarchive.com/cook/recipe/masa-urushido/cup-o-punch). No measures have been published.', NULL, 2017, 'Martini', 'Large Cube', NULL),
    ('happyaccidentsbar', NULL, 'Happy Little Accidents', 'Tequila and li hing mui-infused rum with guava and lemon under a passion fruit foam.', 'The bar''s namesake drink, pairing agave with rum infused with li hing mui, the salty-sweet dried plum powder, and finishing with a light passion fruit foam. It featured in 2024 press and is still on the menu.

Ingredients from Happy Accidents menu (https://www.happyaccidentsbar.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('happyaccidentsbar', NULL, 'Accidentally Loopy', 'A crystal-clear milk punch of vodka, pineapple, coriander and lemon clarified with milk infused with Froot Loops cereal.', 'Kate Gerwin''s example of her nostalgia-led approach: the cereal-infused milk curdles and clarifies the punch, leaving a clear, polished drink that still tastes of a childhood breakfast bowl.

Created by Kate Gerwin.

Method: Clarified milk punch.

Ingredients from Happy Accidents menu (https://www.happyaccidentsbar.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('happyaccidentsbar', NULL, 'Ursula', 'Vodka with ube, Calpico Japanese soda and lavender, originally garnished with lavender sugar tentacles.', 'Named for the sea witch, it gets its violet colour from ube and a creamy tang from Calpico, and was served with lavender sugar shaped into tentacles.

Ingredients from Edible New Mexico (https://www.ediblenm.com/happy-accidents/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('happyaccidentsbar', NULL, 'Dirty Talk', 'A savoury Martini of olive, garlic, leek and rosemary gins with dry vermouth.', 'The flagship of the bar''s martini list, which throws martinis rather than stirring them and defaults to an equal-parts 50:50 ratio as a nod to early martini recipes. Here the dirty flavour comes from four house-infused gins instead of brine.

Method: Thrown.

Ingredients from Happy Accidents menu (https://www.happyaccidentsbar.com/menu). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('heylovepdx', NULL, 'Oaxacan Sunrise', 'Mezcal and passion fruit margarita with a strawberry slushee float and a hibiscus salt rim.', 'Named in early coverage of the bar and still on the menu, it layers a frozen strawberry float over a smoky passion fruit margarita. It is strong enough that the bar limits guests to two.

Ingredients from Hey Love menu (https://www.heylovepdx.com/beverage). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('heylovepdx', NULL, 'Master of Karate & Friendship', 'A frozen strawberry Daiquiri made with funky rums, fresh lime and dry rosé.', 'Described in early coverage as a rum frosé and now listed as a frozen strawberry Daiquiri with dry rosé, it sits somewhere between the two. It is one of three slushees on the list.

Method: Frozen.

Ingredients from Hey Love menu (https://www.heylovepdx.com/beverage). No measures have been published.', 'Daiquiri', NULL, NULL, NULL, NULL),
    ('heylovepdx', NULL, 'Secret Life of Plants', 'A salty mango oolong Mai Tai of rum, falernum, absinthe, tea, lime, orgeat and basil.', 'A Mai Tai reworked for a bar full of plants: salted mango oolong tea brings fruit and tannin, while absinthe and basil add a green, herbal lift.

Ingredients from Hey Love menu (https://www.heylovepdx.com/beverage). No measures have been published.', 'Mai Tai', NULL, NULL, NULL, NULL),
    ('silverlyan', NULL, 'Project Manhattan', 'A batched Manhattan of American whiskey, bonded applejack, two sweet vermouths and blackcurrant liqueur, flash-infused in a microwave.', 'It brings a Lyan technique to DC: a short blast in the microwave warms the sealed batch so the flavours knit together fast, instead of resting it for weeks. It was one of the bar''s most popular opening drinks and still sits among its Silver Classics.

Created by Ryan Chetiyawardana in 2020.

Method: Batch. Vacuum-pack, or put in a glass bowl covered with a plate, and microwave for 3 minutes. Cool, strain and bottle. To serve, stir 70 ml over ice and strain into a chilled cocktail glass.

Spec from InsideHook (Ryan Chetiyawardana''s at-home adaptation) (https://www.insidehook.com/food-washington-dc/ryan-chetiyawardana-silver-lyan-cocktail-bar).', 'Manhattan', 2020, 'Martini', NULL, 'Stir'),
    ('silverlyan', NULL, 'Lucy Lemonade', 'Mint-infused white rum, mezcal and Pineau des Charentes with citrus oleo saccharum, lemon and salt over crushed ice.', 'One of the opening-menu hits Chetiyawardana adapted for home: a lemonade-style cooler where oleo saccharum carries citrus peel oil and the Pineau adds a rich, grapey middle.

Created by Ryan Chetiyawardana in 2020.

Method: Build over crushed ice.

Spec from InsideHook (Ryan Chetiyawardana''s at-home adaptation) (https://www.insidehook.com/food-washington-dc/ryan-chetiyawardana-silver-lyan-cocktail-bar).', NULL, 2020, NULL, 'Crushed', 'Build'),
    ('silverlyan', NULL, 'Nimbus Spritz', 'Force-carbonated spritz of white rum, carrot mead, mushroom caramel, spruce syrup, clay-infused bitters and dry chenin blanc.', 'Built around geosmin, the compound behind the smell of rain on soil: carrots and mushrooms bring earthiness, spruce adds freshness and bentonite-clay bitters, a Dandelyan technique, add minerality. It was served by the glass or in a Champagne bottle with a carved bamboo leaf.

Method: Batched, chilled and force-carbonated.
Carrot mead: Ferment carrot juice with honey.
Mushroom caramel: Pressure-cook candy cap and lion''s mane mushrooms into a broth, then reduce with sugar to a thick treacle.
Spruce syrup: Seal fresh spruce tips with sugar and cook gently sous vide to pull out the oils.
Clay bitters: Infuse food-safe bentonite clay into orange bitters, then filter thoroughly.

Ingredients from Punch (https://punchdrink.com/articles/spritz-cocktail-silver-lyan/). No measures have been published.', NULL, 2023, NULL, NULL, 'Build'),
    ('trailerh', NULL, 'Zombie', 'A blend of four rums with falernum, passion fruit, maraschino, grenadine, cinnamon, citrus, absinthe and Angostura, flamed with overproof rum.', 'Zombies have been on the menu since the bar opened in 2003, and the current version is flamed with Wray & Nephew overproof rum. It also comes as a sharing bowl for four or five, one of the bar''s signature sights.

Method: Flamed with Wray & Nephew.

Ingredients from Trailer Happiness menu (https://trailerh.com/wp-content/uploads/2026/06/menu2026_small.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('trailerh', NULL, 'Mai Tai', 'Chairman''s Reserve Legacy and Appleton Estate 12 year rums with orgeat, Grand Marnier, lime and demerara syrup.', 'The tiki benchmark the bar has poured since 2003, made here with a St Lucian and Jamaican rum split to show off the rum list the bar is known for.

Ingredients from Trailer Happiness menu (https://trailerh.com/wp-content/uploads/2026/06/menu2026_small.pdf). No measures have been published.', 'Mai Tai', NULL, NULL, NULL, NULL),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 'Two rums with apricot liqueur, blue curaçao, lime, apple and guava, plus Licor 43 in the current version.', 'A long-running house original: it appears on older menus with Galliano and Don Q, and on the 2026 list with Mount Gay Eclipse and Licor 43, with blue curaçao for colour.

Ingredients from Trailer Happiness menu (https://trailerh.com/wp-content/uploads/2026/06/menu2026_small.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('trailerh', NULL, 'Trailer Grog', 'Aged Rum Sixty Six and Don Q spiced rum with mango purée, lemon, apple juice and Angostura bitters.', 'The house take on a navy grog, cited by reviewers in the mid-2010s alongside the Zombie. It is not on the 2026 menu.

Ingredients from The Nudge (https://thenudge.com/london-bars/trailer-happiness/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bemelmansbar', NULL, 'Old Cuban', 'Aged rum, lime, sugar, mint and Angostura bitters shaken and topped with Champagne.', 'Audrey Saunders worked it up from the Mojito, swapping in aged rum and a Champagne top, and it made its debut at Bemelmans after Dale DeGroff brought her in to remake the bar program. A 2002 Bemelmans pop-up at The Ritz London carried it to Europe, and it is now a modern classic that is still on the Bemelmans menu.

Created by Audrey Saunders in 2001.

Method: Muddle the lime juice, syrup and mint in a mixing glass. Add the rum, bitters and ice and shake well. Strain into a cocktail glass and top with the Champagne.

Spec from Punch (Audrey Saunders'' spec via A Proper Drink) (https://punchdrink.com/recipes/old-cuban/).', 'Mojito', 2001, 'Martini', NULL, 'muddle and shake'),
    ('bemelmansbar', NULL, 'Madeline''s Vesper', 'A Vesper of Bombay Sapphire gin, Grey Goose vodka and Cocchi Americano.', 'The house Vesper, whose name nods to Madeline, the schoolgirl heroine painted across the bar''s murals. It heads the martini section of the current menu and is one of the drinks taught in the bar''s martini masterclass.

Ingredients from Bemelmans Bar menu (https://www.rosewoodhotels.com/en/the-carlyle-new-york/dining/bemelmans-bar/bemelmans-bar-dining-menu). No measures have been published.', 'Vesper', NULL, NULL, NULL, NULL),
    ('bemelmansbar', NULL, 'Bobby''s Manhattan', 'A rum Manhattan of Santa Teresa 1796, Carpano Antica, Cherry Heering and orange and Angostura bitters.', 'Swaps the whiskey for a solera-aged Venezuelan rum and adds cherry liqueur for a darker, fruitier Manhattan. It is one of the two house signatures the bartenders teach in the Bemelmans martini masterclass.

Ingredients from Bemelmans Bar menu (https://www.rosewoodhotels.com/en/the-carlyle-new-york/dining/bemelmans-bar/bemelmans-bar-dining-menu). No measures have been published.', 'Manhattan', NULL, NULL, NULL, NULL),
    ('bemelmansbar', NULL, 'JFK Daiquiri', 'Mount Gay XO rum with golden falernum, lime juice, lime cordial and simple syrup.', 'A richer daiquiri built on an aged Barbados rum, with falernum and lime cordial layered over fresh lime. It sits among the signature cocktails on the current menu.

Ingredients from Bemelmans Bar menu (https://www.rosewoodhotels.com/en/the-carlyle-new-york/dining/bemelmans-bar/bemelmans-bar-dining-menu). No measures have been published.', 'Daiquiri', NULL, NULL, NULL, NULL),
    ('centurygrandphx', NULL, 'Always Quiet in the Graveyard', 'A clarified milk punch of Hendrick''s Orbium gin and Plantation O.F.T.D. rum, served in a tea set with a house cookie.', 'A clarified milk punch served as a full tea service aboard the Platform 18 train car, the kind of theatrical presentation the bar is built around. Chilled singled it out as one of the car''s inspired originals.

Method: Clarified milk punch, served in a tea set with a cookie.

Ingredients from Chilled Magazine (https://chilledmagazine.com/all-aboard-platform-18-phoenixs-amazing-cocktail-adventure/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('centurygrandphx', NULL, 'Humboldt, CA', 'Whiskey, pear brandy, basil eau de vie, Fernet-Branca, lemon and Bittercube Jamaican No. 1 bitters.', 'A whiskey sour with a herbal, orchard-fruit twist from pear brandy and basil eau de vie, sharpened with Fernet-Branca. Imbibe featured it in its first look inside the bar.

Ingredients from Imbibe (https://imbibemagazine.com/inside-look-century-grand-phoenix/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('centurygrandphx', NULL, 'Clover Club', 'Platform 18''s Clover Club: Nolet''s gin, raspberry syrup, lemon, dry vermouth, egg white and fresh raspberries.', 'The train car pairs its originals with reworked classics, and this is the house spec it shared: a Clover Club lengthened with dry vermouth and fresh raspberries and reverse dry shaken for a thick foam.

Method: Reverse dry shake. Double strain into a coupe.

Spec from Chilled Magazine (https://chilledmagazine.com/all-aboard-platform-18-phoenixs-amazing-cocktail-adventure/).', 'Clover Club', NULL, 'Coupette', NULL, 'dry shake and shake'),
    ('cobracolumbus', NULL, 'Cobra Old-Fashioned', 'An Old Fashioned of Wild Turkey 101 bourbon and rye with Toki Japanese whisky, barley and cocoa.', 'The bar''s take on the American classic splits the base between American whiskey and Japanese whisky and seasons it with barley and cocoa, a small twist in the spirit of its Asian American menu. Ohio Magazine picked it out as a signature.

Ingredients from Cobra drink menu (https://www.cobrabarcolumbus.com/drink-menu). No measures have been published.', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('cobracolumbus', NULL, 'Kopiko Espresso Martini', 'An Espresso Martini inspired by Kopiko, the Indonesian coffee candy.', 'Co-owner Alex Chien built it around the Kopiko coffee sweets his grandmother used to give him, turning a family memory into a bar staple.

Created by Alex Chien.

Sources: https://www.ohiomagazine.com/food-drink/article/cobra-columbus', 'Espresso Martini', NULL, NULL, NULL, NULL),
    ('cobracolumbus', NULL, 'Gold Tooth Tiger', 'A pineapple rum drink with ginger, mint and curry leaf.', 'Created by bartender Kayla LeRoy with Southeast Asian flavors, one of several house drinks developed by the staff.

Created by Kayla LeRoy.

Sources: https://www.ohiomagazine.com/food-drink/article/cobra-columbus', NULL, NULL, NULL, NULL, NULL),
    ('cobracolumbus', NULL, 'Giiirl Dinner No. 2', 'An umami martini of Singani 63, sake, yuzu, Ilegal Joven mezcal, tamari and a Tomolive.', 'Billed on the menu as an umami martini, it builds savoriness from tamari and a pickled tomato garnish over a base of Bolivian singani, sake and mezcal.

Ingredients from Cobra drink menu (https://www.cobrabarcolumbus.com/drink-menu). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('comperelapin', NULL, 'Pretty Ricky Cobbler', 'A sherry cobbler boosted with aged rum, amontillado, lemon, demerara and a spoon of mixed fruit jam.', 'Ricky Gomez''s early Compère Lapin take on the sherry cobbler: aged rum makes it stronger, jam adds body, and it is shaken with citrus wheels then piled with crushed ice and fruit.

Created by Ricky Gomez in 2016.

Method: Place ingredients in a mixing tin with an orange wheel, lemon slice and a few ice cubes. Shake, strain into a glass, add crushed ice and garnish.

Spec from Imbibe (https://imbibemagazine.com/recipe/pretty-ricky-cobbler/).', NULL, 2016, 'Rocks', 'Crushed', 'Shake'),
    ('comperelapin', NULL, 'Big Boss Martini', 'A martini of Haitian clairin and blanco vermouth seasoned with pikliz.', 'Replaces gin with grassy Haitian cane spirit and borrows pikliz, the spicy Haitian pickled slaw, for a briny, Caribbean spin on the Martini.

Ingredients from Compère Lapin menu (https://comperelapin.com/assets/menus/glass-wine-cocktails.pdf). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('comperelapin', NULL, 'Sky Juice', 'A frozen drink of gin, coconut water, sweetened condensed milk and nutmeg.', 'A frozen version of the creamy gin and coconut water drink of the Bahamas, in keeping with the menu''s Caribbean leaning.

Method: Served frozen.

Ingredients from Compère Lapin menu (https://comperelapin.com/assets/menus/glass-wine-cocktails.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('comperelapin', NULL, 'Lucian Gold', 'Lucian rum with Lillet, lemon, mint and Licor 43, topped with sparkling wine.', 'A bright sparkling rum drink that nods to Compton''s native St. Lucia through its rum.

Ingredients from Compère Lapin menu (https://comperelapin.com/assets/menus/glass-wine-cocktails.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('elevenmadisonpark', NULL, 'Sunflower', 'A Mai Tai-inspired drink of dark rum, Batavia arrack, apricot eau de vie, sunflower miso orgeat and Meyer lemon.', 'Beverage director Sebastian Tollius built it on the Mai Tai template but replaced almond orgeat with one made from roasted sunflower seeds marinated in shiro miso for 36 hours, which gives a nutty, savory depth. It was one of his favorites on the 2022 summer menu.

Created by Sebastian Tollius in 2022.

Sunflower miso orgeat: Roasted sunflower seeds are marinated in shiro miso for 36 hours and the liquid strained off, then used as the base of the orgeat.

Ingredients from Eleven Madison Home (https://www.elevenmadisonhome.com/story/inside-eleven-madison-parks-new-cocktail-menu). No measures have been published.', 'Mai Tai', 2022, NULL, NULL, NULL),
    ('elevenmadisonpark', NULL, 'House Vermouth', 'A vermouth made in house and poured at the end of every meal.', 'The restaurant makes its own vermouth and serves it to close each meal; beverage director Sebastian Tollius later created a non-alcoholic version, infused for 24 hours with wormwood, angelica root and gentian, for the Eleven Madison Home range.

Created by Sebastian Tollius.

Sources: https://robbreport.com/food-drink/spirits/eleven-madison-park-mixers-bitters-vermouth-home-bar-1234818787/', NULL, NULL, NULL, NULL, NULL),
    ('hawksmoorrestaurants', NULL, 'Shaky Pete''s Ginger Brew', 'Gin, lemon and fiery house ginger syrup blended with ice and topped with London Pride ale.', 'Pete Jeary first made it for a Beefeater competition, inspired by ginger arriving at London''s Hay''s Wharf, and brought it to Hawksmoor when he joined as head bartender in 2008; co-founder Huw Gott added his nickname to the name. Blending the base with ice before the beer top gives it a frothy texture, and Hawksmoor calls it its most iconic cocktail.

Created by Pete Jeary.

Method: Put the ginger syrup, lemon juice and gin into a heavy-duty blender with a couple of ice cubes (the restaurants use 5). Blend until liquid but still frothy, pour into a very cold glass and top up with London Pride.
Ginger syrup: Roughly peel fresh ginger, leaving some skin on, run it through a centrifugal juicer, then stir the juice with sugar at 2:1 until dissolved.

Spec from Hawksmoor (https://thehawksmoor.com/blog/2022/06/15/meet-pete-jeary-a-k-a-shaky-pete/).', NULL, NULL, NULL, NULL, 'Blitz'),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Marmalade Martini', 'Gin shaken with orange marmalade, lemon, a little red bitter liqueur and orange bitters.', 'Hawksmoor''s version of the 1930 Savoy Marmalade Cocktail adds a touch of Campari-style bitter and orange bitters for a bittersweet breakfast-martini profile. Co-founder Huw Gott told Difford''s it went on the menu soon after Spitalfields opened in 2006.

Method: Stir the marmalade with the other ingredients in the base of the shaker to dissolve it. Shake with ice and fine strain into a chilled coupe.

Spec adapted from Difford''s Guide (adapted from Hawksmoor Spitalfields) (https://www.diffordsguide.com/cocktails/recipe/3460/english-marmalade-aka-hawksmoor-marmalade-martini).', NULL, 2006, 'Coupette', NULL, 'Shake'),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Blinker', 'Rye whiskey shaken with muddled raspberries, pink grapefruit and a little sugar.', 'A riff on Patrick Gavin Duffy''s 1934 Blinker that swaps the grenadine for fresh raspberries and a dash of syrup, which Difford''s found at Spitalfields and rates above the original.

Method: Muddle the raspberries in the base of the shaker. Add the other ingredients, shake with ice and fine strain into a chilled coupe.

Spec adapted from Difford''s Guide (adapted from Hawksmoor Spitalfields) (https://www.diffordsguide.com/cocktails/recipe/3657/blinker-hawksmoors-riff).', NULL, NULL, 'Coupette', NULL, 'muddle and shake'),
    ('jackroseindc', NULL, 'Signature Manhattan', 'A Manhattan of Old Overholt bottled-in-bond rye, Old Grand-Dad bottled-in-bond bourbon and Knob Creek 9-year bourbon with a house vermouth blend and Angostura.', 'Blends three American whiskeys, two of them bottled-in-bond, with the bar''s own vermouth blend, a showcase for a room built around whiskey.

Ingredients from Jack Rose Dining Saloon menu (https://www.jackrosediningsaloon.com/dinnermenu-2). No measures have been published.', 'Manhattan', NULL, NULL, NULL, NULL),
    ('jackroseindc', NULL, 'Signature Whisky Sour', 'A Scotch sour of Glenmorangie Original 12-year with lemon, grapefruit, house oleo saccharum and egg white.', 'Uses a Highland single malt rather than bourbon and sweetens with a house citrus oleo, adding grapefruit alongside the lemon.

Ingredients from Jack Rose Dining Saloon menu (https://www.jackrosediningsaloon.com/dinnermenu-2). No measures have been published.', 'Whiskey Sour', NULL, NULL, NULL, NULL),
    ('jackroseindc', NULL, 'Signature Old Fashioned', 'Wild Turkey 101 rye with demerara syrup and house bitters.', 'A straightforward overproof rye Old Fashioned finished with the bar''s own bitters, one of three signature whiskey classics on the menu.

Ingredients from Jack Rose Dining Saloon menu (https://www.jackrosediningsaloon.com/dinnermenu-2). No measures have been published.', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('navystrengthseattle', NULL, 'Escape Hatch', 'Aged rum, Jägermeister, falernum and lemon, lengthened with coconut water and served in a coconut shell.', 'One of the bar''s most loved drinks: Jägermeister brings herbal depth and falernum a hint of spice to an aged-rum base, and it is quick-shaken with little ice then topped with coconut water in the shell. Chris Elford made it for Punch''s Tip Your Bartender livestream in 2020, and it is still on the menu.

Created by Chris Elford.

Method: Combine all ingredients except the coconut water in a shaker. Add a small amount of ice and shake quickly to chill. Pour the whole contents into a coconut shell, tiki mug or glass, add the coconut water and top with more ice.

Spec from Seattle Met (https://www.seattlemet.com/eat-and-drink/2020/04/tip-your-navy-strength-bartenders-and-sip-the-escape-hatch-once-again).', NULL, NULL, 'Custom', NULL, 'shake and top'),
    ('navystrengthseattle', NULL, 'Kokum and Cashew Swizzle', 'Angostura 5-year rum and lemon swizzled with house kokum syrup, cashew orgeat, tonic syrup and Angostura bitters.', 'Made for the Travel section''s India menu, it sweetens a rum swizzle with syrup from kokum, a sour-sweet South Indian fruit, and an orgeat made from toasted cashews instead of almonds, with tonic syrup for an earthy edge.

Method: Fill a tall tiki mug with crushed ice and add everything except the garnishes. Swizzle until combined and frosty, topping up with ice if needed.
Kokum syrup: Boil dried kokum in water for 30 minutes, blend, add an equal volume of sugar and a pinch of salt, blend until dissolved, strain and cool.
Cashew orgeat: Toast chopped cashews until fragrant, blend with warm water, strain, then stir in an equal volume of sugar and a pinch of salt until dissolved.

Spec from Seattle magazine (https://seattlemag.com/eat-and-drink/travel-around-world-heat-beating-cocktail-navy-strength).', NULL, 2017, 'Highball', 'Crushed', 'Blitz'),
    ('navystrengthseattle', NULL, 'Mister Babadook', 'Scotch with ginger beer, apple cider, lemon, Marmite and black tea syrup.', 'A savory, malty highball on the current menu that works a spoon of Marmite into Scotch, cider and ginger beer.

Ingredients from Navy Strength menu (https://www.navystrengthseattle.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('sexyfishlondon', NULL, 'Miso Thirsty', 'Hibiki Japanese Harmony whisky with miso, plum and sesame.', 'A reworking of a favorite from the 2015 opening menu, it pairs umami miso and plum with Japanese whisky as a nod to the bar''s whisky collection. It opens the 2025 tenth-anniversary menu.

Ingredients from Sexy Fish menu (https://sexyfish.com/wp-content/uploads/2025/06/10908_SF_10_Year_Cocktail_Books_2025_London-v8.pdf). No measures have been published.', NULL, 2015, NULL, NULL, NULL),
    ('sexyfishlondon', NULL, 'Golden Riviera', 'Don Julio Blanco tequila with peach, citrus, oregano and chipotle.', 'The bar''s entry for the Diageo World Class global top 10 final, a spicy-margarita idea seasoned with chipotle and Provençal herbs. It returned on the anniversary menu.

Ingredients from Sexy Fish menu (https://sexyfish.com/wp-content/uploads/2025/06/10908_SF_10_Year_Cocktail_Books_2025_London-v8.pdf). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('sexyfishlondon', NULL, 'Super Magic Monkey', 'Altamura vodka with pineapple, citrus, ginger, gochujang, coconut and whey.', 'Inspired by the bar team''s travels to Shanghai and first served in 2019, it brings Korean chili paste and whey into a tropical vodka sour. The bar calls it its DNA in a glass.

Ingredients from Sexy Fish menu (https://sexyfish.com/wp-content/uploads/2025/06/10908_SF_10_Year_Cocktail_Books_2025_London-v8.pdf). No measures have been published.', NULL, 2019, NULL, NULL, NULL),
    ('sexyfishlondon', NULL, 'Strawberry', 'A highball of Suntory Toki whisky, dry vermouth and strawberry cordial topped with soda.', 'From the 2024 Unity menu, where each drink was named for one key flavor; it was designed as a light whisky-sour idea to make Japanese whisky approachable.

Method: Mix the whisky, cordial and vermouth in a highball glass over ice. Top up with soda water.

Spec from Luxury London (https://luxurylondon.co.uk/taste/food/recipes/cocktails/strawberry-cocktail-recipe-sexy-fish/).', NULL, 2024, 'Highball', 'Cubes', NULL),
    ('supernovaballroom', NULL, 'Supernova Bellini', 'Prosecco with white miso and a house Niagara peach wine.', 'Part of the Wild Airs section, where every drink had a fermented element: the peach came as a house-made fruit wine rather than purée, with miso for savory depth.

Ingredients from blogTO (https://www.blogto.com/bars/supernova-ballroom-toronto/). No measures have been published.', 'Bellini', 2019, NULL, NULL, NULL),
    ('supernovaballroom', NULL, 'Lady Divine', 'A French 75 twist of vodka, sparkling rosé and cedar leaf tincture in a glass painted with apple jam pectin.', 'One of a set of French 75 variations: a cedar tincture brings out cinnamon notes and the inside of the glass is brushed with apple pectin jam for a subtle sweetness.

Ingredients from blogTO (https://www.blogto.com/bars/supernova-ballroom-toronto/). No measures have been published.', 'French 75', 2019, NULL, NULL, NULL),
    ('supernovaballroom', NULL, 'A Great Day for Bay', 'House Saskatoon berry aperitif with Lillet Blanc and sparkling rosé.', 'Another Wild Airs drink, built on an aperitif the bar made from Saskatoon berries, a Canadian prairie fruit, with Lillet Blanc and sparkling rosé.

Ingredients from blogTO (https://www.blogto.com/bars/supernova-ballroom-toronto/). No measures have been published.', NULL, 2019, NULL, NULL, NULL),
    ('supernovaballroom', NULL, 'Ruthless Tea', 'Gooderham & Worts whisky and Amaro Nonino topped with red plum and house genmaicha kombucha.', 'From the Toppers list, which reworked the gin and tonic formula: local Canadian whisky and amaro lengthened with a kombucha the bar brewed from genmaicha tea.

Ingredients from blogTO (https://www.blogto.com/bars/supernova-ballroom-toronto/). No measures have been published.', NULL, 2019, NULL, NULL, NULL),
    ('yachtclubbar', NULL, 'Cocoffee Negroni', 'Coconut rum, cold brew coffee liqueur, Campari and 10-year Verdelho Madeira, stirred and served on a big rock.', 'McLain Hedges started from the rum-based Kingston Negroni and pushed it richer with coconut rum and coffee liqueur, using Madeira in place of sweet vermouth to tie it together, in line with the bar''s rule of wine in every cocktail.

Created by McLain Hedges.

Method: Combine all ingredients in a mixing glass and fill with ice. Stir for 10 to 15 seconds and strain over a large rock of ice in a rocks glass.

Spec from The Spirits Business (https://www.thespiritsbusiness.com/2025/06/cocktail-stories-cocoffee-negroni-yacht-club/).', 'Negroni', NULL, 'Rocks', 'Large Cube', 'Stir'),
    ('yachtclubbar', NULL, 'Frozen Strawberry Daiquiri', 'Aged rum, Madeira, strawberry cordial, lime and salt blended with crushed ice.', 'A frozen daiquiri that layers fresh strawberry purée and a lemon-peel strawberry syrup, with dry Madeira adding depth, showing how the bar treats frozen drinks seriously.

Created by McLain Hedges in 2022.

Method: Add all ingredients to a blender and blend on high for 15 seconds, or until smooth.
Strawberry syrup: Macerate 500 g sugar with 500 g fresh strawberries and 100 g lemon peel for 6 to 12 hours, simmer with 250 g water for 30 minutes, add 250 g ice to chill, then fine strain. Keeps 2 weeks refrigerated.
Strawberry cordial: Blend equal weights of strawberry purée and the strawberry syrup. Keeps 1 week refrigerated.

Spec from Imbibe (https://imbibemagazine.com/recipe/frozen-strawberry-daiquiri-from-yacht-club/).', 'Daiquiri', 2022, 'Highball', NULL, 'Blitz'),
    ('yachtclubbar', NULL, 'Frozen Banana Daiquiri', 'Overproof rums blended with ripe banana, coconut cordial, lime and salt.', 'A house standard that shows off the bar''s frozen-drink craft, balancing ripe banana and coconut against overproof rum and salt.

Method: Blended.

Ingredients from Yacht Club menu (https://www.yachtclubbar.com/menu). No measures have been published.', 'Daiquiri', NULL, NULL, NULL, 'Blitz'),
    ('yachtclubbar', NULL, 'Old Bay Martini', 'Gin and extra-dry vermouth seasoned with Old Bay, served with shrimp chips.', 'A seafood-shack joke played straight: the Chesapeake crab seasoning brings a savory, coastal edge to a dry martini in a bar far from any coast.

Ingredients from Yacht Club menu (https://www.yachtclubbar.com/menu). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('thefrench75bar', NULL, 'French 75', 'Cognac, lemon juice and simple syrup shaken, strained into a tulip flute and topped with brut Champagne.', 'The bar''s namesake drink is built on cognac (Courvoisier VS), the way Count Arnaud took it, rather than the gin most bars use. Chris Hannah, who ran the bar for years, tilted the ratio drier with a little more lemon than syrup and insists on real Champagne; by his own count he was closing in on a million of them.

Method: Shake the lemon, syrup and cognac with ice, strain into a tulip Champagne glass and top with Champagne.

Spec from Punch (https://punchdrink.com/recipes/chris-hannahs-french-75/).', 'French 75', NULL, 'Flute', NULL, 'shake and top'),
    ('thefrench75bar', NULL, 'Arnaud''s Special', 'Stirred Scotch drink with Dubonnet; the bar''s current version blends Monkey Shoulder and Laphroaig with Amer Picon and apricot liqueur.', 'This was the restaurant''s own signature cocktail in the 1940s and 50s, and Ted Saucier printed it in his 1951 book Bottoms Up as a simple mix of Scotch, Dubonnet and orange bitters. It still heads the bar''s classics list, now rebuilt with a smoky Islay component and French bitter-orange aperitif.

Ingredients from Arnaud''s French 75 Bar menu (https://www.arnaudsrestaurant.com/french-75/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('thefrench75bar', NULL, 'Katsura Fashioned', 'Suntory Toki whisky washed with sushi rice, sweetened with nigori sake syrup and seasoned with orange blossom, anise and bitters.', 'A current-menu Old Fashioned that borrows from Japanese flavours: the whisky is washed with sushi rice for texture and the sugar is swapped for a cloudy sake syrup. It shows the bar''s newer creative list alongside its classics.

Ingredients from Arnaud''s French 75 Bar menu (https://www.arnaudsrestaurant.com/french-75/). No measures have been published.', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('baragricole', NULL, 'Agricole Rhum Punch with Red Wine', 'Aged rhum agricole shaken with light red wine, lemon juice and gum syrup.', 'Vogler''s riff on Charles H. Baker''s Obispo de Cuba swaps the usual dry Cuban rum for aged agricole, the spirit the bar is named for. It was one of the headline drinks when the bar reopened on Mission Street in 2022, and a reviewer called it far greater than the sum of its parts.

Created by Thad Vogler in 2022.

Method: Shake all ingredients with ice and strain into a stemless glass or coupe.

Spec from Punch (https://punchdrink.com/recipes/agricole-rhum-punch-with-red-wine/).', NULL, 2022, 'Coupette', NULL, 'Shake'),
    ('baragricole', NULL, 'Turf Cocktail', 'Stirred gin drink with dry vermouth, maraschino, absinthe and orange bitters, finished with a lemon twist.', 'Vogler''s take on the pre-Prohibition Turf shows the bar''s house style: an old recipe made with carefully chosen spirits and nothing extra. The James Beard Foundation singled out his version as a model of balance.

Created by Thad Vogler.

Method: Stir with ice until chilled and strain into a chilled cocktail glass.

Spec from Find.Eat.Drink. (http://www.findeatdrink.com/Index/Drink/Entries/2011/9/8_thad_vogler_recipes.html).', NULL, NULL, 'Martini', NULL, 'Stir'),
    ('baragricole', NULL, 'Ti'' Punch', 'Rhum agricole with lime and cane sugar, the Martinique ritual drink.', 'The bar took its name from rhum agricole, and Vogler''s Ti'' Punch was a fixture that regulars still found on the list after the 2022 move. It sums up his approach of letting a single-origin spirit speak with almost nothing added.

Sources: https://sfist.com/2020/02/11/bar-agricole-to-close-in-april-and-relocate-obispo-to-close-and-re-concept/, https://sfstandard.com/2022/08/16/bar-agricole-returns-after-controversy-and-covid-shutdowns-a-32-cocktail-leads-the-way/', 'Ti'' Punch', NULL, NULL, NULL, NULL),
    ('baragricole', NULL, 'Rye Gin Old Fashioned', 'An Old Fashioned built on a rye-based gin instead of whiskey.', 'A long-running house drink that regulars recognised on the reopened 2022 menu, it applies the Old Fashioned template to a grain-forward gin to show off the spirit itself.

Sources: https://sfstandard.com/2022/08/16/bar-agricole-returns-after-controversy-and-covid-shutdowns-a-32-cocktail-leads-the-way/, https://www.sfgate.com/food/article/san-francisco-bar-agricole-reopens-17346267.php', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 'Raisin-infused El Dorado rum and El Dorado 12 with coconut water syrup, spiced orgeat, vanilla, ohia blossom honey, lime and absinthe, smoked with kiawe wood.', 'Justin Park''s winner of the 2015 Don the Beachcomber Mai Tai Festival (he is the event''s only three-time champion). It is poured at the table from a stoppered flask filled with kiawe wood smoke over absinthe-coated ice, and the Hawaiian name roughly means the end of all Mai Tais.

Created by Justin Park in 2015.

Ingredients from Bar Leather Apron menu (https://www.barleatherapron.com/cocktails/). No measures have been published.', 'Mai Tai', 2015, NULL, NULL, NULL),
    ('barleatherapron', NULL, 'BLA Old Fashioned', 'The bar''s own single-barrel Knob Creek bourbon with Angostura, Japanese wasanbon sugar and orange.', 'An opening-day drink built on a barrel the bar selected itself, sweetened with fine-grained wasanbon sugar from Japan. It reflects the Parks'' mix of classic American drinks and Japanese technique.

Ingredients from Bar Leather Apron menu (https://www.barleatherapron.com/cocktails/). No measures have been published.', 'Old Fashioned', 2015, NULL, NULL, NULL),
    ('barleatherapron', NULL, 'Leather Soul', 'Single-barrel Knob Creek and Laphroaig 10 stirred with Cynar and Carpano Antica, with lemon oil, sea salt and tobacco.', 'Named after Tom Park''s Honolulu menswear store, this stirred drink layers bourbon and peated Scotch with bittersweet artichoke amaro and a tobacco note. It is one of the house signatures on the bar''s menu.

Ingredients from Bar Leather Apron menu (https://www.barleatherapron.com/cocktails/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('barleatherapron', NULL, 'Yuzu Sour', 'Gin with yuzu, mandarin, lemon, hojicha, wasanbon sugar, citrus blend, Angostura and egg white.', 'A Japanese-leaning sour that uses roasted hojicha tea and wasanbon sugar; a 2016 visitor review pictured it alongside the Mai Tai and Old Fashioned.

Ingredients from Bar Leather Apron menu (https://www.barleatherapron.com/cocktails/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('identidadcocktailbar', NULL, 'La Trinidad', 'Don Q 7 year rum with Cardamaro, coffee syrup and cocoa, served on the rocks.', 'A spirit-forward house signature that pairs Puerto Rican aged rum with Cardamaro, a wine-based amaro, and coffee. Imbibe named it among the bar''s signature drinks after the Beard win.

Ingredients from Identidad menu (https://identidadbarpr.com/menu). No measures have been published.', NULL, NULL, 'Rocks', NULL, NULL),
    ('identidadcocktailbar', NULL, 'Tamarindo y Setas', 'Tequila with mushrooms, tamarind and a sesame cookie.', 'An earthy, savoury signature that mixes tamarind with mushroom and a sesame-cookie note. Imbibe listed it as one of the bar''s signature drinks in 2025.

Ingredients from Imbibe (https://imbibemagazine.com/where-to-drink-in-san-juan-puerto-rico/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('identidadcocktailbar', NULL, 'Juniper Paradise', 'Bombay gin with pineapple, lemon, basil, vanilla and cardamom under a basil air.', 'A tropical gin sour finished with a light basil foam, and the drink Imbibe chose to photograph for its San Juan guide.

Ingredients from Identidad menu (https://identidadbarpr.com/menu). No measures have been published.', NULL, NULL, 'Coupette', NULL, NULL),
    ('identidadcocktailbar', NULL, 'Pineapple Vesper', 'Beefeater 24 gin and Bacardi Carta Blanca rum stirred with pineapple-infused Cocchi Americano, lemongrass and ginger oil.', 'A Caribbean take on the Vesper that swaps vodka for white rum and infuses the aperitif wine with pineapple.

Ingredients from Identidad menu (https://identidadbarpr.com/menu). No measures have been published.', 'Vesper', NULL, 'Coupette', NULL, NULL),
    ('identidadcocktailbar', NULL, 'Cochee Milk Punch', 'Woodford Reserve bourbon and coconut tequila with lime, lychee and spices, clarified with milk.', 'A clear milk punch that uses milk clarification to soften bourbon and coconut-flavoured tequila around lychee.

Ingredients from Identidad menu (https://identidadbarpr.com/menu). No measures have been published.', NULL, NULL, 'Coupette', NULL, NULL),
    ('julephou', NULL, 'Mint Julep', 'Bourbon poured over lightly pressed mint and turbinado syrup, stirred with crushed ice and crowned with powdered-sugar-dusted mint.', 'The bar is named for this drink and keeps a list of julep variations; Huerta''s house method rinses the muddler with the bourbon and builds a domed crown of crushed ice. It appears in her book and holds a permanent place on the menu.

Created by Alba Huerta.

Method: Lightly press the mint with the syrup in a julep cup, add the bourbon over the muddler and stir. Fill a little over halfway with crushed ice, stir 15 to 20 times, then mound more ice on top and add a straw.
Turbinado syrup: Simmer two parts turbinado sugar with one part water, stirring, for about three minutes until dissolved and slightly thickened; cool and refrigerate for up to a week.

Spec from Julep: Southern Cocktails Refashioned (via Houston Chronicle) (https://www.houstonchronicle.com/life/food/article/Julep-redefines-Southern-classic-libations-12764021.php).', 'Mint Julep', NULL, 'Julep Cup', 'Crushed', 'muddle and shake'),
    ('julephou', NULL, 'Vinegar & Rye', 'Muddled fig shaken with bonded rye, rainwater Madeira, turbinado syrup, lime and Banyuls vinegar over crushed ice.', 'A shrub-style drink that uses a few drops of Banyuls vinegar and fresh fig to give rye and Madeira a sweet-sour lift. It is in Huerta''s book and still on the house list.

Created by Alba Huerta.

Method: Muddle the fig halves in a shaker until pulverised, add the rest, shake hard with ice cubes and pour into the glass. Top with crushed ice and add a straw.
Turbinado syrup: Simmer two parts turbinado sugar with one part water, stirring, for about three minutes until dissolved and slightly thickened; cool and refrigerate for up to a week.

Spec from Julep: Southern Cocktails Refashioned (via Houston Chronicle) (https://www.houstonchronicle.com/life/food/article/Julep-redefines-Southern-classic-libations-12764021.php).', NULL, NULL, 'Rocks', 'Crushed', 'muddle and shake'),
    ('julephou', NULL, 'Cherry Bounce Sour', 'High-proof bourbon with house cherry bounce, turbinado syrup, lemon, Angostura and egg white, served long.', 'Cherry bounce is an old way of preserving cherries in spirit, and Huerta uses its liqueur as the sweetener so the fruit plays against bourbon''s vanilla and spice. Imbibe calls it one of the bar''s signatures and a long-running favourite.

Created by Alba Huerta.

Method: Dry shake to emulsify, then shake again with ice and strain over ice cubes.

Spec from Imbibe (https://imbibemagazine.com/recipe/cherry-bounce-sour/).', 'Whiskey Sour', NULL, 'Highball', 'Cubes', 'dry shake and shake'),
    ('julephou', NULL, 'Snake-Bit Sprout', 'Ford''s gin with chamomile, pineapple, lime and cider.', 'One of Huerta''s original drinks inspired by the rural South, featured in her book and still on the Julep Favorites list.

Created by Alba Huerta.

Ingredients from Julep menu (https://www.julephouston.com/menu/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('julephou', NULL, 'Bottled in Bond', 'Large-format bourbon Manhattan over a big ice cube, served with chocolates, almonds and cherries for groups.', 'The bar''s shareable house Manhattan has been on the menu since the 2014 opening and is served six drinks at a time.

Sources: https://www.julephouston.com/menu/', 'Manhattan', 2014, NULL, NULL, NULL),
    ('loma_bar', NULL, '#14', 'Clarified low-proof drink of cryo-concentrated fino sherry, dry vermouth, blended Scotch, lemon and fig-chamomile-cardamom syrup, washed with Salvadoran crema.', 'Maldonado freezes fino sherry and collects the richer first melt, then clarifies the drink milk-punch style with Salvadoran crema for a silky, salty finish. Inspired by the Bamboo, it is the house cocktail Punch picked when it named Loma a best new bar of 2025.

Created by Leishla Maldonado.

Method: Combine everything and rest in the fridge for 3 hours to separate, then filter twice through a Superbag or coffee filter. Stir the clarified mix with ice and strain over a large cube into a glass sprayed three times with heavily peated Scotch.
Cryo-concentrated sherry: Freeze a bottle of fino in a shallow container overnight, then let it thaw slowly through a lined strainer in the fridge, keeping only the rich early melt (about half the volume) and stopping when it turns pale and watery.
Fig, chamomile and green cardamom syrup: Simmer sliced figs in water for about 10 minutes, add dried chamomile and cracked green cardamom, steep off the heat for 30 minutes, strain and dissolve in white sugar; keeps a week refrigerated.

Spec from Punch (https://punchdrink.com/recipes/14/).', 'Bamboo', NULL, 'Rocks', 'Large Cube', 'Stir'),
    ('loma_bar', NULL, 'Forraje (No. 5)', 'Amontillado and manzanilla sherries with house shiitake orgeat, Champagne vinegar and fresh orange juice, served julep-style.', 'Maldonado won the 2019 U.S. Sherry Cocktail Competition with this drink while at Courtland Club, and brought it to Loma as a signature. Sous-vide shiitake gives the almond orgeat a savoury, chocolatey depth; Dale DeGroff ordered it on the bar''s opening night.

Created by Leishla Maldonado in 2019.

Ingredients from Boston Globe (https://www.bostonglobe.com/2024/07/25/metro/loma-federal-hill-providence-ri-cocktail-bar/). No measures have been published.', NULL, 2019, NULL, NULL, NULL),
    ('loma_bar', NULL, 'No. 16', 'Vodka with green aniseed, pink peppercorn, Byrrh, Galliano, mahaleb, lemon, bitters and egg.', 'A house sour that leans on aromatic spices, including mahaleb cherry-stone spice and aniseed, around a Byrrh quinquina base. It was pictured as one of the bar''s drinks in Rhode Island Monthly''s 2026 Beard coverage.

Created by Leishla Maldonado.

Ingredients from Rhode Island Monthly (https://www.rimonthly.com/loma/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('loma_bar', NULL, 'Pisco Bee''s Knees', 'Suyo Italia pisco shaken with rich honey syrup and lemon.', 'An example of Loma''s featured-spirits list, where a rotating bottle is served neat or in a pared-back classic; Maldonado chose the Bee''s Knees so rich honey would support the floral Italia pisco without hiding it.

Created by Leishla Maldonado.

Method: Shake with ice and strain into a chilled coupe.

Spec from Punch (https://punchdrink.com/recipes/pisco-bees-knees/).', 'Bee''s Knees', NULL, 'Coupette', NULL, 'Shake'),
    ('scotchlodge', NULL, 'Namesake', 'Smoky Islay Scotch stirred with cherry liqueur, Cynar, Punt e Mes and orange bitters over a large cube.', 'The bar''s namesake drink, on the list since 2019, balances peat smoke against cherry and bittersweet artichoke amaro. Imbibe published Klus''s spec as the Scotch Lodge cocktail.

Created by Tommy Klus in 2019.

Method: Stir with ice and strain over a large cube.

Spec from Imbibe (https://imbibemagazine.com/recipe/scotch-lodge-recipe/).', NULL, 2019, 'Rocks', 'Large Cube', 'Stir'),
    ('scotchlodge', NULL, 'Only Fans Martini', 'Dutch gin with pineapple, orgeat, lemon and sparkling wine, coconut-milk clarified and served with passion fruit pearls.', 'A playful, clarified reworking of the Porn Star Martini on the current list, using coconut milk to strip and soften the pineapple-orgeat base.

Ingredients from Scotch Lodge menu (https://images.squarespace-cdn.com/content/v1/5c17e6cd710699e060eefbe0/c4e6a28d-0225-473e-b838-d69930885c76/drinks+9.8.jpg). No measures have been published.', 'Porn Star Martini', NULL, NULL, NULL, NULL),
    ('scotchlodge', NULL, 'Loch Stock', 'Mezcal and smoky Scotch stirred with Ancho Reyes, lapsang souchong sweet vermouth and mole bitters.', 'Doubles down on smoke from three directions (mezcal, peated whisky and tea-infused vermouth) with chile warmth, typical of the bar''s whisky-led stirred drinks.

Ingredients from Scotch Lodge menu (https://images.squarespace-cdn.com/content/v1/5c17e6cd710699e060eefbe0/c4e6a28d-0225-473e-b838-d69930885c76/drinks+9.8.jpg). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('scotchlodge', NULL, 'Pandan Old Fashioned', 'Pandan-infused mezcal and aged tequila with coconut-oolong demerara syrup and cacao bitters.', 'An agave Old Fashioned scented with pandan and coconut-oolong tea, in the vein of the coconut oolong infusions Portland Monthly noted in the bar''s early drinks.

Ingredients from Scotch Lodge menu (https://images.squarespace-cdn.com/content/v1/5c17e6cd710699e060eefbe0/c4e6a28d-0225-473e-b838-d69930885c76/drinks+9.8.jpg). No measures have been published.', 'Oaxaca Old Fashioned', NULL, NULL, NULL, NULL),
    ('violethourchicago', NULL, 'Juliet & Romeo', 'Gin shaken with muddled cucumber, salt, mint, lime and simple syrup, garnished with rose water and Angostura on a mint leaf.', 'Maloney built it in 2007 to win over people who thought they hated gin, aiming for the taste of an English garden. It was the bar''s second-best seller for over a decade (about 20 a day in 2019, behind only the Old Fashioned) and spread to menus across Chicago.

Created by Toby Maloney in 2007.

Method: Muddle the cucumber with the salt, add everything else, shake with ice and strain into a chilled coupe.

Spec from Punch (https://punchdrink.com/recipes/juliet-romeo/).', NULL, 2007, 'Coupette', NULL, 'muddle and shake'),
    ('violethourchicago', NULL, 'The Art of Choke', 'White rum and Cynar stirred with a little lime, demerara syrup and green Chartreuse, served on the rocks with mint.', 'Kyle Davidson created it at the bar in 2008 with a split base of rum and artichoke amaro, and stirred it despite the citrus, breaking the rules Maloney had taught him. It became a modern classic of the amaro era.

Created by Kyle Davidson in 2008.

Method: Stir with ice and strain into a rocks glass over ice.

Spec from Punch (https://punchdrink.com/recipes/the-art-of-choke/).', NULL, 2008, 'Rocks', 'Cubes', 'Stir'),
    ('violethourchicago', NULL, 'Paper Plane', 'Equal parts bourbon, Amaro Nonino, Aperol and lemon juice, shaken and served up.', 'Sam Ross wrote this equal-parts drink for The Violet Hour''s summer 2008 menu at Maloney''s request, riffing on the Last Word and naming it after an M.I.A. song. The first version used Campari before switching to Aperol, and it has since become a worldwide modern classic.

Created by Sam Ross in 2008.

Method: Shake with ice and strain into a coupe.

Spec from Punch (https://punchdrink.com/recipes/paper-plane/).', NULL, 2008, 'Coupette', NULL, 'Shake');

INSERT INTO "seed_lines" VALUES
    ('allegory_dc', NULL, 'Eyes of Flame', 0, 21, 'ml', 'Siete Misterios Mezcal', 'Mezcal', NULL, false),
    ('allegory_dc', NULL, 'Eyes of Flame', 1, 14, 'ml', 'Equiano Original Rum', 'Rum', NULL, false),
    ('allegory_dc', NULL, 'Eyes of Flame', 2, 7, 'ml', 'Altos Tequila', 'Tequila Añejo', NULL, false),
    ('allegory_dc', NULL, 'Eyes of Flame', 3, 14, 'ml', 'Nixta Licor de Elote', 'Corn Liqueur', NULL, false),
    ('allegory_dc', NULL, 'Eyes of Flame', 4, 7, 'ml', 'Mandarin Oleo Saccharum', NULL, NULL, false),
    ('allegory_dc', NULL, 'Eyes of Flame', 5, 7, 'ml', 'Clarified Passion Fruit', NULL, NULL, false),
    ('allegory_dc', NULL, 'Eyes of Flame', 6, 3.5, 'ml', 'Palo Cortado Sherry', NULL, NULL, false),
    ('allegory_dc', NULL, 'Eyes of Flame', 7, 1, 'dash', 'Salt Solution', NULL, NULL, false),
    ('allegory_dc', NULL, 'Eyes of Flame', 8, NULL, NULL, 'Pumpkin seed oil', NULL, 'garnish', false),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 0, NULL, NULL, 'R&R Assembly Gin', 'Gin', NULL, false),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 1, NULL, NULL, 'Rhum Agricole', NULL, NULL, false),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 2, NULL, NULL, 'Bitter Bianco', NULL, NULL, false),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 3, NULL, NULL, 'Snap Peas', NULL, NULL, false),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 4, NULL, NULL, 'Cardamom', NULL, NULL, false),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 5, NULL, NULL, 'Aloe', NULL, NULL, false),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 6, NULL, NULL, 'Black Pepper Coconut', NULL, NULL, false),
    ('allegory_dc', NULL, 'Garden of Live Flowers', 7, NULL, NULL, 'Lemon', NULL, NULL, false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 0, NULL, NULL, 'Equiano Original Aged Rum', 'Aged Rum', '35 gr per serve as printed (batch 2100 gr)', false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 1, NULL, NULL, 'Starward Twofold Whisky', 'Whisky', '13 gr per serve', false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 2, NULL, NULL, 'Giffard', 'Banana Liqueur', '8 gr per serve', false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 3, NULL, NULL, 'Amontillado Sherry', NULL, '8 gr per serve', false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 4, NULL, NULL, 'Yuzu Juice', NULL, '17 gr per serve', false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 5, NULL, NULL, 'Salt', NULL, '.18 gr per serve', false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 6, NULL, NULL, 'Kefir', NULL, '58 gr per serve', false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 7, NULL, NULL, 'Milk', NULL, '58 gr per serve', false),
    ('allegory_dc', NULL, 'They Can''t Kill Us', 8, NULL, NULL, 'Ube Gomme Syrup', NULL, '16 gr per serve, added after clarification', false),
    ('bryantslounge', NULL, 'Pink Squirrel', 0, 1, 'oz', 'Crème de Noyau Liqueur', NULL, NULL, false),
    ('bryantslounge', NULL, 'Pink Squirrel', 1, 1, 'oz', 'Giffard', 'White Crème de Cacao', NULL, false),
    ('bryantslounge', NULL, 'Pink Squirrel', 2, 1.5, 'oz', 'Whipping Cream', NULL, NULL, false),
    ('bryantslounge', NULL, 'Pink Squirrel', 3, NULL, NULL, 'Grated nutmeg and a line of Creole-style bitters', NULL, 'garnish', false),
    ('cleaverlv', NULL, 'Polynesian Pearl Diver', 0, NULL, NULL, 'Puerto Rican Rum', NULL, NULL, false),
    ('cleaverlv', NULL, 'Polynesian Pearl Diver', 1, NULL, NULL, 'Demerara Rum', NULL, NULL, false),
    ('cleaverlv', NULL, 'Polynesian Pearl Diver', 2, NULL, NULL, 'Jamaican Rum', NULL, NULL, false),
    ('cleaverlv', NULL, 'Polynesian Pearl Diver', 3, NULL, NULL, 'Falernum', NULL, NULL, false),
    ('cleaverlv', NULL, 'Polynesian Pearl Diver', 4, NULL, NULL, 'Orange', NULL, NULL, false),
    ('cleaverlv', NULL, 'Polynesian Pearl Diver', 5, NULL, NULL, 'Cream', NULL, NULL, false),
    ('cleaverlv', NULL, 'Polynesian Pearl Diver', 6, NULL, NULL, 'Cookie Butter Syrup', NULL, NULL, false),
    ('cleaverlv', NULL, 'Ready Fire Aim', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('cleaverlv', NULL, 'Ready Fire Aim', 1, NULL, NULL, 'Pink Peppercorn', NULL, NULL, false),
    ('cleaverlv', NULL, 'Ready Fire Aim', 2, NULL, NULL, 'Honey', NULL, NULL, false),
    ('cleaverlv', NULL, 'Ready Fire Aim', 3, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('cleaverlv', NULL, 'Ready Fire Aim', 4, NULL, NULL, 'Lime', NULL, NULL, false),
    ('cleaverlv', NULL, 'Ready Fire Aim', 5, NULL, NULL, 'Hellfire', 'Bitters', NULL, false),
    ('cleaverlv', NULL, 'Rattle Snake', 0, NULL, NULL, 'Rye Whiskey', NULL, NULL, false),
    ('cleaverlv', NULL, 'Rattle Snake', 1, NULL, NULL, 'Absinthe', NULL, NULL, false),
    ('cleaverlv', NULL, 'Rattle Snake', 2, NULL, NULL, 'Lemon', NULL, NULL, false),
    ('cleaverlv', NULL, 'Rattle Snake', 3, NULL, NULL, 'Egg White', NULL, NULL, false),
    ('cleaverlv', NULL, 'Cock n Bull Special', 0, NULL, NULL, 'Bourbon', NULL, NULL, false),
    ('cleaverlv', NULL, 'Cock n Bull Special', 1, NULL, NULL, 'Cognac', NULL, NULL, false),
    ('cleaverlv', NULL, 'Cock n Bull Special', 2, NULL, NULL, 'Benedictine', NULL, NULL, false),
    ('cleaverlv', NULL, 'Cock n Bull Special', 3, NULL, NULL, 'Bitters', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Daiquirí Floridita', 0, NULL, NULL, 'Havana Club Rum', 'Rum', NULL, false),
    ('floridita_cuba', NULL, 'Daiquirí Floridita', 1, NULL, NULL, 'Sugar', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Daiquirí Floridita', 2, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Daiquirí Floridita', 3, NULL, NULL, 'Maraschino Liqueur', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Papa Hemingway (Hemingway Special)', 0, 3.5, 'oz', 'Light Gold Rum', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Papa Hemingway (Hemingway Special)', 1, 1, 'oz', 'Pink Grapefruit Juice', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Papa Hemingway (Hemingway Special)', 2, 0.75, 'oz', 'Luxardo', 'Maraschino Liqueur', NULL, false),
    ('floridita_cuba', NULL, 'Papa Hemingway (Hemingway Special)', 3, 1, 'oz', 'Lime Juice', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Papa Hemingway (Hemingway Special)', 4, 0.5, 'oz', 'Rich Sugar Syrup', NULL, '2:1', false),
    ('floridita_cuba', NULL, 'Papa Hemingway (Hemingway Special)', 5, NULL, NULL, 'Maraschino cherry and/or lime wedge', NULL, 'garnish', false),
    ('floridita_cuba', NULL, 'Daiquiri No. 4', 0, 2, 'oz', 'Light Gold Rum', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Daiquiri No. 4', 1, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Daiquiri No. 4', 2, 0.17, 'oz', 'Luxardo', 'Maraschino Liqueur', 'printed as 1/6 fl oz', false),
    ('floridita_cuba', NULL, 'Daiquiri No. 4', 3, 0.25, 'oz', 'Rich Sugar Syrup', NULL, '2:1', false),
    ('floridita_cuba', NULL, 'Daiquiri No. 4', 4, 0.17, 'oz', 'Water', NULL, 'printed as 1/6 fl oz; omit if using wet ice', false),
    ('floridita_cuba', NULL, 'Daiquiri No. 4', 5, 2, 'drop', 'Saline Solution', NULL, NULL, true),
    ('floridita_cuba', NULL, 'Daiquiri No. 4', 6, NULL, NULL, 'Lime wedge', NULL, 'garnish', false),
    ('floridita_cuba', NULL, 'Daiquirí Mulata', 0, NULL, NULL, 'Havana Club Añejo Aged Rum', 'Aged Rum', NULL, false),
    ('floridita_cuba', NULL, 'Daiquirí Mulata', 1, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Daiquirí Mulata', 2, NULL, NULL, 'Crème de Cacao', NULL, NULL, false),
    ('floridita_cuba', NULL, 'Daiquirí Mulata', 3, NULL, NULL, 'Sugar', NULL, NULL, false),
    ('bar500a', NULL, 'Phil Collins', 0, 1.5, 'oz', 'Square One Cucumber Vodka', 'Cucumber Vodka', NULL, false),
    ('bar500a', NULL, 'Phil Collins', 1, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    ('bar500a', NULL, 'Phil Collins', 2, 0.75, 'oz', 'Simple Syrup', NULL, NULL, false),
    ('bar500a', NULL, 'Phil Collins', 3, 0.5, 'oz', 'Yellow Chartreuse', NULL, NULL, false),
    ('bar500a', NULL, 'Phil Collins', 4, 1, 'dash', 'Sweetgrass Farm Winery & Distillery', 'Cranberry Bitters', 'Peychaud''s can substitute', false),
    ('bar500a', NULL, 'Phil Collins', 5, 1, 'oz', 'Soda', NULL, NULL, false),
    ('bar500a', NULL, 'Belafonte', 0, NULL, NULL, 'Plantation Rum', 'Rum', NULL, false),
    ('bar500a', NULL, 'Belafonte', 1, NULL, NULL, 'Carpano Vermouth', 'Vermouth', NULL, false),
    ('bar500a', NULL, 'Belafonte', 2, NULL, NULL, 'Cynar', 'Amaro', NULL, false),
    ('bar500a', NULL, 'Belafonte', 3, NULL, NULL, 'House Coffee Liqueur', NULL, NULL, false),
    ('bar500a', NULL, 'Under the Volcano', 0, NULL, NULL, 'Del Maguey Chichicapa Mezcal', 'Mezcal', NULL, false),
    ('bar500a', NULL, 'Under the Volcano', 1, NULL, NULL, 'Lustau East India Solera Sherry', 'Sherry', NULL, false),
    ('bar500a', NULL, 'Under the Volcano', 2, NULL, NULL, 'Nonino', 'Amaro', NULL, false),
    ('bar500a', NULL, 'Under the Volcano', 3, NULL, NULL, 'Mole Bitters', NULL, NULL, false),
    ('bar500a', NULL, 'Under the Volcano', 4, NULL, NULL, 'Flamed orange peel', NULL, 'garnish', false),
    ('little_rituals_bar', NULL, 'Big City Nights', 0, 1.5, 'oz', 'Botanist Blackberry Gin', 'Blackberry Gin', NULL, false),
    ('little_rituals_bar', NULL, 'Big City Nights', 1, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Big City Nights', 2, 0.75, 'oz', 'Herbed Cinnamon Syrup', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Big City Nights', 3, 0.5, 'oz', 'Suze', 'Gentian Liqueur', NULL, false),
    ('little_rituals_bar', NULL, 'Big City Nights', 4, 0.5, 'oz', 'Dolin Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('little_rituals_bar', NULL, 'Big City Nights', 5, 1, NULL, 'Egg White', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Big City Nights', 6, NULL, NULL, 'Edible rice paper printed with the bar''s mural (at the bar)', NULL, 'garnish', false),
    ('little_rituals_bar', NULL, 'Reality Check', 0, NULL, NULL, 'Noilly Prat Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('little_rituals_bar', NULL, 'Reality Check', 1, NULL, NULL, 'Raspberry', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Reality Check', 2, NULL, NULL, 'Raspberry Eau de Vie', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Reality Check', 3, NULL, NULL, 'Acqua di Cedro', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Reality Check', 4, NULL, NULL, 'Guava Cordial', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Reality Check', 5, NULL, NULL, 'Lemon', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Reality Check', 6, NULL, NULL, 'Bubbles', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Ballpark Highball', 0, NULL, NULL, 'Suntory Toki Japanese Whisky', 'Japanese Whisky', NULL, false),
    ('little_rituals_bar', NULL, 'Ballpark Highball', 1, NULL, NULL, 'Monkey Shoulder Blended Malt Scotch', 'Blended Malt Scotch', NULL, false),
    ('little_rituals_bar', NULL, 'Ballpark Highball', 2, NULL, NULL, 'Barley Tea Sherry', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Ballpark Highball', 3, NULL, NULL, 'House Club Soda', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Ballpark Highball', 4, NULL, NULL, 'Japanese-style peanuts on the side', NULL, 'garnish', false),
    ('little_rituals_bar', NULL, 'Cartographer', 0, NULL, NULL, 'Old Forester Signature Bourbon', 'Bourbon', NULL, false),
    ('little_rituals_bar', NULL, 'Cartographer', 1, NULL, NULL, 'House Overproof Rum Blend', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Cartographer', 2, NULL, NULL, 'Cascara Cordial', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Cartographer', 3, NULL, NULL, 'Vanilla Passion Fruit', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Cartographer', 4, NULL, NULL, 'Clarified L.G.O.', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Cartographer', 5, NULL, NULL, 'Cardamom', NULL, NULL, false),
    ('little_rituals_bar', NULL, 'Cartographer', 6, NULL, NULL, 'Creole Bitters', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Dreadlock Holiday', 0, 1.5, 'oz', 'Wolf Rum (house blend)', 'Jamaican Rum', 'or your favourite Jamaican rum', false),
    ('raisedbywolvesspirits', NULL, 'Dreadlock Holiday', 1, 0.75, 'oz', 'Suze', 'Gentian Liqueur', NULL, false),
    ('raisedbywolvesspirits', NULL, 'Dreadlock Holiday', 2, 0.75, 'oz', 'Bianco Vermouth', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Dreadlock Holiday', 3, 1, 'tsp', 'Giffard', 'Pineapple Liqueur', NULL, false),
    ('raisedbywolvesspirits', NULL, 'Dreadlock Holiday', 4, NULL, NULL, 'Lemon peel', NULL, 'garnish', false),
    ('raisedbywolvesspirits', NULL, 'Cosmic Dancer', 0, NULL, NULL, 'London Dry Gin', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Cosmic Dancer', 1, NULL, NULL, 'Vino Amaro', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Cosmic Dancer', 2, NULL, NULL, 'Raspberry', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Cosmic Dancer', 3, NULL, NULL, 'Lemon', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Finders Keepers', 0, NULL, NULL, 'White Rum', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Finders Keepers', 1, NULL, NULL, 'Oaxacan Rum', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Finders Keepers', 2, NULL, NULL, 'Nori', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Finders Keepers', 3, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Finders Keepers', 4, NULL, NULL, 'Coconut Cream', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Finders Keepers', 5, NULL, NULL, 'Macadamia-koji Orgeat', NULL, NULL, false),
    ('raisedbywolvesspirits', NULL, 'Finders Keepers', 6, NULL, NULL, 'Lime', NULL, NULL, false),
    ('thesilverdollar', NULL, 'Honky Tonk', 0, 0.25, 'oz', 'Green Chartreuse', NULL, 'glass rinse', false),
    ('thesilverdollar', NULL, 'Honky Tonk', 1, 2, 'oz', 'Rittenhouse Bottled-in-Bond Rye', 'Rye Whiskey', NULL, false),
    ('thesilverdollar', NULL, 'Honky Tonk', 2, 0.5, 'oz', 'Cardenal Mendoza Brandy', 'Brandy', NULL, false),
    ('thesilverdollar', NULL, 'Honky Tonk', 3, 0.125, 'oz', 'Demerara Syrup', NULL, 'printed as ''Eighth of an oz''; 2 parts demerara sugar to 1 part water', false),
    ('thesilverdollar', NULL, 'Honky Tonk', 4, 3, 'dash', 'Root Beer Bitters', NULL, NULL, false),
    ('thesilverdollar', NULL, 'Honky Tonk', 5, 3, 'dash', 'Angostura', NULL, NULL, false),
    ('thesilverdollar', NULL, 'Honky Tonk', 6, NULL, NULL, 'Orange peel (expressed, discarded)', NULL, 'garnish', false),
    ('thesilverdollar', NULL, 'One Horse Cowboy', 0, NULL, NULL, 'Wild Turkey 101 Bourbon', 'Bourbon', NULL, false),
    ('thesilverdollar', NULL, 'One Horse Cowboy', 1, NULL, NULL, 'Cocchi Americano', 'Aperitif Wine', NULL, false),
    ('thesilverdollar', NULL, 'One Horse Cowboy', 2, NULL, NULL, 'Pierre Ferrand', 'Dry Curaçao', NULL, false),
    ('thesilverdollar', NULL, 'One Horse Cowboy', 3, NULL, NULL, 'Grapefruit', NULL, NULL, false),
    ('thesilverdollar', NULL, 'One Horse Cowboy', 4, NULL, NULL, 'Lemon', NULL, NULL, false),
    ('thesilverdollar', NULL, 'One Horse Cowboy', 5, NULL, NULL, 'Agent Orange', 'Orange Bitters', NULL, false),
    ('tikiti1961', NULL, 'Ray''s Mistake', 0, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('tikiti1961', NULL, 'Ray''s Mistake', 1, NULL, NULL, 'Lime', NULL, NULL, false),
    ('tikiti1961', NULL, 'Ray''s Mistake', 2, NULL, NULL, 'Gin', NULL, NULL, false),
    ('tikiti1961', NULL, 'Ray''s Mistake', 3, NULL, NULL, 'Dark Jamaican Rum Float', NULL, NULL, false),
    ('tikiti1961', NULL, 'Ray''s Mistake', 4, NULL, NULL, 'Secret House Flavouring', NULL, 'hint of vanilla', false),
    ('tikiti1961', NULL, 'Blood & Sand', 0, NULL, NULL, 'Orange', NULL, NULL, false),
    ('tikiti1961', NULL, 'Blood & Sand', 1, NULL, NULL, 'Lime', NULL, NULL, false),
    ('tikiti1961', NULL, 'Blood & Sand', 2, NULL, NULL, 'Cherry', NULL, NULL, false),
    ('tikiti1961', NULL, 'Blood & Sand', 3, NULL, NULL, 'Bourbon, Scotch or Tequila', NULL, NULL, false),
    ('tikiti1961', NULL, 'Uga Booga', 0, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('tikiti1961', NULL, 'Uga Booga', 1, NULL, NULL, 'Lime', NULL, NULL, false),
    ('tikiti1961', NULL, 'Uga Booga', 2, NULL, NULL, 'Myers''s Dark Rum', 'Dark Rum', NULL, false),
    ('keenssteakhouse', NULL, 'Keens Old Fashioned', 0, NULL, NULL, 'Orange Peel', NULL, 'oils expressed into the glass', false),
    ('keenssteakhouse', NULL, 'Keens Old Fashioned', 1, 1, 'bsp', 'Simple Syrup', NULL, NULL, false),
    ('keenssteakhouse', NULL, 'Keens Old Fashioned', 2, 2, 'dash', 'Bitters', NULL, NULL, false),
    ('keenssteakhouse', NULL, 'Keens Old Fashioned', 3, 3, 'oz', 'Old Overholt Rye', 'Rye Whiskey', NULL, false),
    ('keenssteakhouse', NULL, 'Keens Old Fashioned', 4, NULL, NULL, 'Lemon peel and a cherry', NULL, 'garnish', false),
    ('thebuenavistasf', NULL, 'Irish Coffee', 0, 1.5, 'oz', 'Tullamore D.E.W. Irish Whiskey', 'Irish Whiskey', NULL, false),
    ('thebuenavistasf', NULL, 'Irish Coffee', 1, NULL, NULL, 'Peerless', 'Hot Brewed Coffee', NULL, false),
    ('thebuenavistasf', NULL, 'Irish Coffee', 2, 2, NULL, 'Sugar Cubes', NULL, NULL, false),
    ('thebuenavistasf', NULL, 'Irish Coffee', 3, NULL, NULL, 'Heavy Cream', NULL, 'lightly whipped; the bar ages its cream 48 hours', false),
    ('clydecommon', NULL, 'Barrel-Aged Negroni', 0, 128, 'oz', 'Dry Gin', NULL, NULL, false),
    ('clydecommon', NULL, 'Barrel-Aged Negroni', 1, 128, 'oz', 'Sweet Vermouth', NULL, NULL, false),
    ('clydecommon', NULL, 'Barrel-Aged Negroni', 2, 128, 'oz', 'Campari', NULL, NULL, false),
    ('clydecommon', NULL, 'Bourbon Renewal', 0, 2, 'oz', 'Bourbon', NULL, NULL, false),
    ('clydecommon', NULL, 'Bourbon Renewal', 1, 1, 'oz', 'Lemon Juice', NULL, 'fresh', false),
    ('clydecommon', NULL, 'Bourbon Renewal', 2, 0.5, 'oz', 'Crème de Cassis', NULL, NULL, false),
    ('clydecommon', NULL, 'Bourbon Renewal', 3, 0.5, 'oz', 'Simple Syrup', NULL, NULL, false),
    ('clydecommon', NULL, 'Bourbon Renewal', 4, 1, 'dash', 'Angostura Bitters', NULL, NULL, false),
    ('clydecommon', NULL, 'Bourbon Renewal', 5, NULL, NULL, 'Lemon wedge, or fresh currants in season', NULL, 'garnish', false),
    ('clydecommon', NULL, 'Amaretto Sour', 0, 1.5, 'oz', 'Amaretto', NULL, NULL, false),
    ('clydecommon', NULL, 'Amaretto Sour', 1, 0.75, 'oz', 'Cask-proof Bourbon', NULL, NULL, false),
    ('clydecommon', NULL, 'Amaretto Sour', 2, 1, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('clydecommon', NULL, 'Amaretto Sour', 3, 1, 'tsp', 'Rich Simple Syrup', NULL, '2:1', false),
    ('clydecommon', NULL, 'Amaretto Sour', 4, 0.5, 'oz', 'Egg White', NULL, 'lightly beaten', false),
    ('clydecommon', NULL, 'Amaretto Sour', 5, NULL, NULL, 'Lemon peel and brandied cherries', NULL, 'garnish', false),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 0, 12, NULL, 'Eggs', NULL, 'large', false),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 1, NULL, NULL, 'Granulated Sugar', NULL, '2 1/4 cups', false),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 2, 12, 'oz', 'Añejo Tequila', NULL, NULL, false),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 3, 15, 'oz', 'Amontillado Sherry', NULL, NULL, false),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 4, 36, 'oz', 'Whole Milk', NULL, NULL, false),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 5, 24, 'oz', 'Heavy Cream', NULL, NULL, false),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 6, 3, 'tsp', 'Nutmeg', NULL, 'freshly grated', false),
    ('clydecommon', NULL, 'Clyde Common Eggnog', 7, NULL, NULL, 'Fresh nutmeg', NULL, 'garnish', false),
    ('columbiaroom', NULL, 'Getaway', 0, 1.5, 'oz', 'Dark/blackstrap Rum', NULL, NULL, false),
    ('columbiaroom', NULL, 'Getaway', 1, 0.5, 'oz', 'Cynar', NULL, NULL, false),
    ('columbiaroom', NULL, 'Getaway', 2, 0.25, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('columbiaroom', NULL, 'Getaway', 3, 0.25, 'oz', 'Lime Juice', NULL, NULL, false),
    ('columbiaroom', NULL, 'Getaway', 4, 0.25, 'oz', 'Rich Sugar Syrup', NULL, '2:1', false),
    ('columbiaroom', NULL, 'Getaway', 5, NULL, NULL, 'Lime wedge', NULL, 'garnish', false),
    ('columbiaroom', NULL, 'Into Great Silence', 0, NULL, NULL, 'Fino Sherry', NULL, NULL, false),
    ('columbiaroom', NULL, 'Into Great Silence', 1, NULL, NULL, 'Green Chartreuse', NULL, NULL, false),
    ('columbiaroom', NULL, 'Into Great Silence', 2, NULL, NULL, 'Orgeat', NULL, NULL, false),
    ('columbiaroom', NULL, 'Into Great Silence', 3, NULL, NULL, 'Grapefruit Juice', NULL, NULL, false),
    ('columbiaroom', NULL, 'Into Great Silence', 4, NULL, NULL, 'Jus Vert', NULL, 'spinach and parsley with a little salt and sugar', false),
    ('columbiaroom', NULL, 'Atlantic Ocean', 0, NULL, NULL, 'Single Malt Scotch Whisky', NULL, NULL, false),
    ('columbiaroom', NULL, 'Atlantic Ocean', 1, NULL, NULL, 'Red Vermouth', NULL, NULL, false),
    ('columbiaroom', NULL, 'Atlantic Ocean', 2, NULL, NULL, 'Cachaça', NULL, NULL, false),
    ('columbiaroom', NULL, 'Atlantic Ocean', 3, NULL, NULL, 'Tomato Water', NULL, NULL, false),
    ('columbiaroom', NULL, 'Atlantic Ocean', 4, NULL, NULL, 'Transatlantic Bitters', NULL, 'house-made', false),
    ('columbiaroom', NULL, 'In Search of Time Past', 0, NULL, NULL, 'Old-book Tincture', NULL, 'neutral high-proof spirit fat-washed with book pages infused in grapeseed oil', false),
    ('columbiaroom', NULL, 'In Search of Time Past', 1, NULL, NULL, 'Armagnac', NULL, NULL, false),
    ('columbiaroom', NULL, 'In Search of Time Past', 2, NULL, NULL, 'PX Sherry', NULL, 'vintage', false),
    ('columbiaroom', NULL, 'In Search of Time Past', 3, NULL, NULL, 'Porcini Cordial', NULL, NULL, false),
    ('columbiaroom', NULL, 'In Search of Time Past', 4, NULL, NULL, 'Eucalyptus', NULL, NULL, false),
    ('dukeslondon', NULL, 'Dukes Martini', 0, 3, 'dash', 'Dry Vermouth', NULL, NULL, false),
    ('dukeslondon', NULL, 'Dukes Martini', 1, 4, 'oz', 'Gin or Vodka', NULL, 'frozen; e.g. Aylesbury Duck, Belvedere or Plymouth', false),
    ('dukeslondon', NULL, 'Dukes Martini', 2, NULL, NULL, 'Olive or lemon peel', NULL, 'garnish', false),
    ('dukeslondon', NULL, 'Vesper', 0, NULL, NULL, 'Angostura Bitters', NULL, 'a splash', false),
    ('dukeslondon', NULL, 'Vesper', 1, NULL, NULL, 'Lillet Blanc', NULL, 'half a measure, fridge cold', false),
    ('dukeslondon', NULL, 'Vesper', 2, 20, 'ml', 'Potocki Vodka', 'Vodka', NULL, false),
    ('dukeslondon', NULL, 'Vesper', 3, 88, 'ml', 'No. 3 London Dry Gin (Berry Bros. & Rudd)', 'London Dry Gin', NULL, false),
    ('dukeslondon', NULL, 'Vesper', 4, NULL, NULL, 'Orange zest, with peel oils expressed over the drink', NULL, 'garnish', false),
    ('dukeslondon', NULL, 'Fleming 89', 0, NULL, NULL, 'Vodka', NULL, 'Russian, infused with vanilla beans', false),
    ('dukeslondon', NULL, 'Fleming 89', 1, NULL, NULL, 'Sugared Rose Petals', NULL, NULL, false),
    ('dukeslondon', NULL, 'Fleming 89', 2, NULL, NULL, 'Vermouth', NULL, NULL, false),
    ('dukeslondon', NULL, 'Fleming 89', 3, NULL, NULL, 'Lillet', NULL, NULL, false),
    ('dukeslondon', NULL, 'Fleming 89', 4, NULL, NULL, 'Chocolate Bitters', NULL, NULL, false),
    ('napoleonhousenola', NULL, 'Pimm''s Cup', 0, 1.25, 'oz', 'Pimm''s No. 1', NULL, NULL, false),
    ('napoleonhousenola', NULL, 'Pimm''s Cup', 1, 3, 'oz', 'Lemonade', NULL, NULL, false),
    ('napoleonhousenola', NULL, 'Pimm''s Cup', 2, NULL, 'top', 'Seven Up', 'Lemon-lime Soda', NULL, false),
    ('napoleonhousenola', NULL, 'Pimm''s Cup', 3, NULL, NULL, 'Cucumber', NULL, 'garnish', false),
    ('napoleonhousenola', NULL, 'Sazerac', 0, NULL, NULL, 'Sazerac Rye', 'Rye Whiskey', NULL, false),
    ('napoleonhousenola', NULL, 'Sazerac', 1, NULL, NULL, 'Simple Syrup', NULL, NULL, false),
    ('napoleonhousenola', NULL, 'Sazerac', 2, NULL, NULL, 'Peychaud''s Bitters', NULL, NULL, false),
    ('napoleonhousenola', NULL, 'Sazerac', 3, NULL, NULL, 'Angostura Bitters', NULL, NULL, false),
    ('napoleonhousenola', NULL, 'Sazerac', 4, NULL, NULL, 'Herbsaint', NULL, NULL, false),
    ('saxonandparole', NULL, 'Corn Milk Punch', 0, 0.75, 'oz', 'Dark Rum', NULL, NULL, false),
    ('saxonandparole', NULL, 'Corn Milk Punch', 1, 0.75, 'oz', 'Brandy', NULL, NULL, false),
    ('saxonandparole', NULL, 'Corn Milk Punch', 2, 5, 'oz', 'Corn-infused Milk', NULL, 'house-made', false),
    ('saxonandparole', NULL, 'Corn Milk Punch', 3, 0.5, 'oz', 'Cinnamon Syrup', NULL, NULL, false),
    ('saxonandparole', NULL, 'Corn Milk Punch', 4, NULL, NULL, 'Black sesame seeds', NULL, 'garnish', false),
    ('saxonandparole', NULL, 'Olive 7 Ways', 0, NULL, NULL, 'Olive Distillate', NULL, NULL, false),
    ('saxonandparole', NULL, 'Olive 7 Ways', 1, NULL, NULL, 'Olive Bitters', NULL, NULL, false),
    ('saxonandparole', NULL, 'Olive 7 Ways', 2, NULL, NULL, 'Olive Shrub', NULL, NULL, false),
    ('saxonandparole', NULL, 'Olive 7 Ways', 3, NULL, NULL, 'Olive-infused Vermouth', NULL, NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 0, NULL, NULL, 'Pumpkin', NULL, '150 grams, cut into 1-inch cubes and roasted with cinnamon sticks', false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 1, NULL, NULL, 'Maple Sugar', NULL, NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 2, NULL, NULL, 'Water', NULL, NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 3, NULL, NULL, 'Hojicha Green Tea', NULL, NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 4, NULL, NULL, 'Orange Peel', NULL, 'peel of half an orange', false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 5, NULL, NULL, 'Nutmeg', NULL, NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 6, NULL, NULL, 'Milk', NULL, NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 7, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 8, NULL, NULL, 'Facundo Eximo Rum', 'Rum', NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 9, NULL, NULL, 'Laird''s bonded', 'Applejack', NULL, false),
    ('saxonandparole', NULL, 'Cup ''o Punch', 10, NULL, NULL, 'Grated nutmeg', NULL, 'garnish', false),
    ('happyaccidentsbar', NULL, 'Happy Little Accidents', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Happy Little Accidents', 1, NULL, NULL, 'Rum', NULL, 'li hing mui-infused', false),
    ('happyaccidentsbar', NULL, 'Happy Little Accidents', 2, NULL, NULL, 'Guava', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Happy Little Accidents', 3, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Happy Little Accidents', 4, NULL, NULL, 'Passion Fruit Foam', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Accidentally Loopy', 0, NULL, NULL, 'Vodka', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Accidentally Loopy', 1, NULL, NULL, 'Froot Loops Cereal', NULL, 'infused into the milk', false),
    ('happyaccidentsbar', NULL, 'Accidentally Loopy', 2, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Accidentally Loopy', 3, NULL, NULL, 'Coriander', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Accidentally Loopy', 4, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Accidentally Loopy', 5, NULL, NULL, 'Milk', NULL, 'for clarification', false),
    ('happyaccidentsbar', NULL, 'Ursula', 0, NULL, NULL, 'Vodka', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Ursula', 1, NULL, NULL, 'Ube', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Ursula', 2, NULL, NULL, 'Calpico', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Ursula', 3, NULL, NULL, 'Lavender', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Ursula', 4, NULL, NULL, 'Lavender sugar tentacles', NULL, 'garnish', false),
    ('happyaccidentsbar', NULL, 'Dirty Talk', 0, NULL, NULL, 'Olive Gin', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Dirty Talk', 1, NULL, NULL, 'Garlic Gin', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Dirty Talk', 2, NULL, NULL, 'Leek Gin', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Dirty Talk', 3, NULL, NULL, 'Rosemary Gin', NULL, NULL, false),
    ('happyaccidentsbar', NULL, 'Dirty Talk', 4, NULL, NULL, 'Dry Vermouth', NULL, NULL, false),
    ('heylovepdx', NULL, 'Oaxacan Sunrise', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('heylovepdx', NULL, 'Oaxacan Sunrise', 1, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('heylovepdx', NULL, 'Oaxacan Sunrise', 2, NULL, NULL, 'Strawberry Slushee', NULL, 'floated on top', false),
    ('heylovepdx', NULL, 'Oaxacan Sunrise', 3, NULL, NULL, 'Hibiscus salt rim', NULL, 'garnish', false),
    ('heylovepdx', NULL, 'Master of Karate & Friendship', 0, NULL, NULL, 'Rum', NULL, 'funky rums', false),
    ('heylovepdx', NULL, 'Master of Karate & Friendship', 1, NULL, NULL, 'Strawberry', NULL, NULL, false),
    ('heylovepdx', NULL, 'Master of Karate & Friendship', 2, NULL, NULL, 'Lime Juice', NULL, 'fresh', false),
    ('heylovepdx', NULL, 'Master of Karate & Friendship', 3, NULL, NULL, 'Dry Rosé Wine', NULL, NULL, false),
    ('heylovepdx', NULL, 'Secret Life of Plants', 0, NULL, NULL, 'Rum', NULL, NULL, false),
    ('heylovepdx', NULL, 'Secret Life of Plants', 1, NULL, NULL, 'Falernum', NULL, NULL, false),
    ('heylovepdx', NULL, 'Secret Life of Plants', 2, NULL, NULL, 'Absinthe', NULL, NULL, false),
    ('heylovepdx', NULL, 'Secret Life of Plants', 3, NULL, NULL, 'Salty Mango Oolong Tea', NULL, NULL, false),
    ('heylovepdx', NULL, 'Secret Life of Plants', 4, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('heylovepdx', NULL, 'Secret Life of Plants', 5, NULL, NULL, 'Orgeat', NULL, NULL, false),
    ('heylovepdx', NULL, 'Secret Life of Plants', 6, NULL, NULL, 'Basil', NULL, NULL, false),
    ('silverlyan', NULL, 'Project Manhattan', 0, 400, 'ml', 'Westward American Whiskey', 'American Whiskey', NULL, false),
    ('silverlyan', NULL, 'Project Manhattan', 1, 250, 'ml', 'Laird''s bonded', 'Applejack', NULL, false),
    ('silverlyan', NULL, 'Project Manhattan', 2, 300, 'ml', 'Cocchi di Torino Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('silverlyan', NULL, 'Project Manhattan', 3, 300, 'ml', 'Martini Rosso Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('silverlyan', NULL, 'Project Manhattan', 4, 50, 'ml', 'Blackcurrant Liqueur', NULL, NULL, false),
    ('silverlyan', NULL, 'Project Manhattan', 5, 10, 'ml', 'Angostura Bitters', NULL, NULL, false),
    ('silverlyan', NULL, 'Project Manhattan', 6, 5, 'ml', 'Peychaud''s Bitters', NULL, NULL, false),
    ('silverlyan', NULL, 'Project Manhattan', 7, NULL, NULL, 'Cherry', NULL, 'garnish', false),
    ('silverlyan', NULL, 'Lucy Lemonade', 0, 30, 'ml', 'Bacardi Carta Blanca White Rum', 'White Rum', 'infused with mint', false),
    ('silverlyan', NULL, 'Lucy Lemonade', 1, 15, 'ml', 'Del Maguey Vida Mezcal', 'Mezcal', NULL, false),
    ('silverlyan', NULL, 'Lucy Lemonade', 2, 20, 'ml', 'Pineau Des Charentes', NULL, NULL, false),
    ('silverlyan', NULL, 'Lucy Lemonade', 3, 15, 'ml', 'Mixed Citrus Oleo Saccharum', NULL, NULL, false),
    ('silverlyan', NULL, 'Lucy Lemonade', 4, 1, 'pinch', 'Salt', NULL, NULL, false),
    ('silverlyan', NULL, 'Lucy Lemonade', 5, 10, 'ml', 'Lemon Juice', NULL, 'fresh', false),
    ('silverlyan', NULL, 'Lucy Lemonade', 6, NULL, NULL, 'Mint sprig and a lemon slice', NULL, 'garnish', false),
    ('silverlyan', NULL, 'Nimbus Spritz', 0, NULL, NULL, 'White Rum', NULL, NULL, false),
    ('silverlyan', NULL, 'Nimbus Spritz', 1, NULL, NULL, 'Carrot Mead', NULL, 'house-made', false),
    ('silverlyan', NULL, 'Nimbus Spritz', 2, NULL, NULL, 'Mushroom Caramel', NULL, 'candy cap and lion''s mane', false),
    ('silverlyan', NULL, 'Nimbus Spritz', 3, NULL, NULL, 'Spruce Tip Syrup', NULL, NULL, false),
    ('silverlyan', NULL, 'Nimbus Spritz', 4, NULL, NULL, 'Clay-infused Orange Bitters', NULL, NULL, false),
    ('silverlyan', NULL, 'Nimbus Spritz', 5, NULL, NULL, 'Chenin Blanc', NULL, 'dry, South African', false),
    ('silverlyan', NULL, 'Nimbus Spritz', 6, NULL, NULL, 'Lactic Acid Solution', NULL, NULL, false),
    ('silverlyan', NULL, 'Nimbus Spritz', 7, NULL, NULL, 'Mineral-adjusted Water', NULL, NULL, false),
    ('silverlyan', NULL, 'Nimbus Spritz', 8, NULL, NULL, 'Bamboo leaf carved with a lightning bolt', NULL, 'garnish', false),
    ('trailerh', NULL, 'Zombie', 0, NULL, NULL, 'Don Q 7 Rum', 'Rum', NULL, false),
    ('trailerh', NULL, 'Zombie', 1, NULL, NULL, 'Wray & Nephew Overproof Rum', 'Overproof Rum', NULL, false),
    ('trailerh', NULL, 'Zombie', 2, NULL, NULL, 'Chairman''s Reserve Legacy Rum', 'Rum', NULL, false),
    ('trailerh', NULL, 'Zombie', 3, NULL, NULL, 'Pusser''s Gunpowder Rum', 'Rum', NULL, false),
    ('trailerh', NULL, 'Zombie', 4, NULL, NULL, 'Falernum', NULL, NULL, false),
    ('trailerh', NULL, 'Zombie', 5, NULL, NULL, 'Passion Fruit', NULL, NULL, false),
    ('trailerh', NULL, 'Zombie', 6, NULL, NULL, 'Maraschino Liqueur', NULL, NULL, false),
    ('trailerh', NULL, 'Zombie', 7, NULL, NULL, 'Grenadine', NULL, NULL, false),
    ('trailerh', NULL, 'Zombie', 8, NULL, NULL, 'Cinnamon', NULL, NULL, false),
    ('trailerh', NULL, 'Zombie', 9, NULL, NULL, 'Citrus', NULL, NULL, false),
    ('trailerh', NULL, 'Zombie', 10, NULL, NULL, 'Absinthe', NULL, NULL, false),
    ('trailerh', NULL, 'Zombie', 11, NULL, NULL, 'Angostura Bitters', NULL, NULL, false),
    ('trailerh', NULL, 'Mai Tai', 0, NULL, NULL, 'Chairman''s Reserve Legacy Rum', 'Rum', NULL, false),
    ('trailerh', NULL, 'Mai Tai', 1, NULL, NULL, 'Appleton Estate 12 year Rum', 'Rum', NULL, false),
    ('trailerh', NULL, 'Mai Tai', 2, NULL, NULL, 'Orgeat', NULL, NULL, false),
    ('trailerh', NULL, 'Mai Tai', 3, NULL, NULL, 'Grand Marnier', 'Orange Liqueur', NULL, false),
    ('trailerh', NULL, 'Mai Tai', 4, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('trailerh', NULL, 'Mai Tai', 5, NULL, NULL, 'Demerara Syrup', NULL, NULL, false),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 0, NULL, NULL, 'Mount Gay Eclipse Rum', 'Rum', NULL, false),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 1, NULL, NULL, 'Wray & Nephew Overproof Rum', 'Overproof Rum', NULL, false),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 2, NULL, NULL, 'Licor 43', NULL, NULL, false),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 3, NULL, NULL, 'Merlet', 'Apricot Liqueur', NULL, false),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 4, NULL, NULL, 'Blue Curaçao', NULL, NULL, false),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 5, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 6, NULL, NULL, 'Apple Juice', NULL, NULL, false),
    ('trailerh', NULL, 'The Cotton Mouth Killer', 7, NULL, NULL, 'Guava', NULL, NULL, false),
    ('trailerh', NULL, 'Trailer Grog', 0, NULL, NULL, 'Rum Sixty Six 12 year', 'Rum', NULL, false),
    ('trailerh', NULL, 'Trailer Grog', 1, NULL, NULL, 'Don Q Spiced Rum', 'Spiced Rum', NULL, false),
    ('trailerh', NULL, 'Trailer Grog', 2, NULL, NULL, 'Mango Purée', NULL, NULL, false),
    ('trailerh', NULL, 'Trailer Grog', 3, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('trailerh', NULL, 'Trailer Grog', 4, NULL, NULL, 'Apple Juice', NULL, NULL, false),
    ('trailerh', NULL, 'Trailer Grog', 5, NULL, NULL, 'Angostura Bitters', NULL, NULL, false),
    ('bemelmansbar', NULL, 'Old Cuban', 0, 0.75, 'oz', 'Lime Juice', NULL, 'fresh', false),
    ('bemelmansbar', NULL, 'Old Cuban', 1, 1, 'oz', 'Simple Syrup', NULL, NULL, false),
    ('bemelmansbar', NULL, 'Old Cuban', 2, 6, 'leaf', 'Mint', NULL, 'whole leaves', false),
    ('bemelmansbar', NULL, 'Old Cuban', 3, 1.5, 'oz', 'Bacardi 8 Aged Rum', 'Aged Rum', NULL, false),
    ('bemelmansbar', NULL, 'Old Cuban', 4, 2, 'dash', 'Angostura', NULL, NULL, false),
    ('bemelmansbar', NULL, 'Old Cuban', 5, 2, 'oz', 'Champagne', NULL, NULL, false),
    ('bemelmansbar', NULL, 'Old Cuban', 6, NULL, NULL, 'Mint', NULL, 'garnish', false),
    ('bemelmansbar', NULL, 'Madeline''s Vesper', 0, NULL, NULL, 'Bombay Sapphire Gin', 'Gin', NULL, false),
    ('bemelmansbar', NULL, 'Madeline''s Vesper', 1, NULL, NULL, 'Grey Goose Vodka', 'Vodka', NULL, false),
    ('bemelmansbar', NULL, 'Madeline''s Vesper', 2, NULL, NULL, 'Cocchi Americano', 'Aperitif Wine', NULL, false),
    ('bemelmansbar', NULL, 'Bobby''s Manhattan', 0, NULL, NULL, 'Santa Teresa 1796 Rum', 'Rum', NULL, false),
    ('bemelmansbar', NULL, 'Bobby''s Manhattan', 1, NULL, NULL, 'Carpano Antica Formula Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('bemelmansbar', NULL, 'Bobby''s Manhattan', 2, NULL, NULL, 'Cherry Heering', 'Cherry Liqueur', NULL, false),
    ('bemelmansbar', NULL, 'Bobby''s Manhattan', 3, NULL, NULL, 'Orange Bitters', NULL, NULL, false),
    ('bemelmansbar', NULL, 'Bobby''s Manhattan', 4, NULL, NULL, 'Angostura', NULL, NULL, false),
    ('bemelmansbar', NULL, 'JFK Daiquiri', 0, NULL, NULL, 'Mount Gay XO Aged Rum', 'Aged Rum', NULL, false),
    ('bemelmansbar', NULL, 'JFK Daiquiri', 1, NULL, NULL, 'The Bitter Truth Golden Falernum', 'Falernum', NULL, false),
    ('bemelmansbar', NULL, 'JFK Daiquiri', 2, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('bemelmansbar', NULL, 'JFK Daiquiri', 3, NULL, NULL, 'Lime Cordial', NULL, NULL, false),
    ('bemelmansbar', NULL, 'JFK Daiquiri', 4, NULL, NULL, 'Simple Syrup', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Always Quiet in the Graveyard', 0, NULL, NULL, 'Hendrick''s Orbium Gin', 'Gin', NULL, false),
    ('centurygrandphx', NULL, 'Always Quiet in the Graveyard', 1, NULL, NULL, 'Plantation O.F.T.D. Rum', 'Rum', NULL, false),
    ('centurygrandphx', NULL, 'Humboldt, CA', 0, NULL, NULL, 'Whiskey', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Humboldt, CA', 1, NULL, NULL, 'Pear Brandy', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Humboldt, CA', 2, NULL, NULL, 'Basil Eau de Vie', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Humboldt, CA', 3, NULL, NULL, 'Fernet-Branca', 'Amaro', NULL, false),
    ('centurygrandphx', NULL, 'Humboldt, CA', 4, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Humboldt, CA', 5, NULL, NULL, 'Bittercube Jamaican #1', 'Bitters', NULL, false),
    ('centurygrandphx', NULL, 'Clover Club', 0, 2, 'oz', 'Nolet''s Gin', 'Gin', NULL, false),
    ('centurygrandphx', NULL, 'Clover Club', 1, 0.75, 'oz', 'Egg White', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Clover Club', 2, 0.75, 'oz', 'Raspberry Syrup', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Clover Club', 3, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Clover Club', 4, 0.5, 'oz', 'Carpano Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('centurygrandphx', NULL, 'Clover Club', 5, 3, NULL, 'Raspberries', NULL, NULL, false),
    ('centurygrandphx', NULL, 'Clover Club', 6, NULL, NULL, 'Raspberry on a pick', NULL, 'garnish', false),
    ('cobracolumbus', NULL, 'Cobra Old-Fashioned', 0, NULL, NULL, 'Wild Turkey 101 Bourbon', 'Bourbon', NULL, false),
    ('cobracolumbus', NULL, 'Cobra Old-Fashioned', 1, NULL, NULL, 'Wild Turkey 101 Rye', 'Rye Whiskey', NULL, false),
    ('cobracolumbus', NULL, 'Cobra Old-Fashioned', 2, NULL, NULL, 'Suntory Toki Japanese Whisky', 'Japanese Whisky', NULL, false),
    ('cobracolumbus', NULL, 'Cobra Old-Fashioned', 3, NULL, NULL, 'Barley', NULL, NULL, false),
    ('cobracolumbus', NULL, 'Cobra Old-Fashioned', 4, NULL, NULL, 'Cocoa', NULL, NULL, false),
    ('cobracolumbus', NULL, 'Giiirl Dinner No. 2', 0, NULL, NULL, 'Singani 63', 'Singani', NULL, false),
    ('cobracolumbus', NULL, 'Giiirl Dinner No. 2', 1, NULL, NULL, 'Sake', NULL, NULL, false),
    ('cobracolumbus', NULL, 'Giiirl Dinner No. 2', 2, NULL, NULL, 'Yuzu', NULL, NULL, false),
    ('cobracolumbus', NULL, 'Giiirl Dinner No. 2', 3, NULL, NULL, 'Ilegal Joven Mezcal', 'Mezcal', NULL, false),
    ('cobracolumbus', NULL, 'Giiirl Dinner No. 2', 4, NULL, NULL, 'Tamari', NULL, NULL, false),
    ('cobracolumbus', NULL, 'Giiirl Dinner No. 2', 5, NULL, NULL, 'Tomolive', 'Pickled Tomato', NULL, false),
    ('comperelapin', NULL, 'Pretty Ricky Cobbler', 0, 1.5, 'oz', 'Aged Rum', NULL, NULL, false),
    ('comperelapin', NULL, 'Pretty Ricky Cobbler', 1, 0.75, 'oz', 'Amontillado Sherry', NULL, NULL, false),
    ('comperelapin', NULL, 'Pretty Ricky Cobbler', 2, 0.25, 'oz', 'Lemon Juice', NULL, 'fresh', false),
    ('comperelapin', NULL, 'Pretty Ricky Cobbler', 3, 0.25, 'oz', 'Demerara Syrup', NULL, '1:1', false),
    ('comperelapin', NULL, 'Pretty Ricky Cobbler', 4, 1, 'bsp', 'Mixed Fruit Jam', NULL, NULL, false),
    ('comperelapin', NULL, 'Pretty Ricky Cobbler', 5, NULL, NULL, 'Berries, mint, orange wheel and powdered sugar', NULL, 'garnish', false),
    ('comperelapin', NULL, 'Big Boss Martini', 0, NULL, NULL, 'Clairin', NULL, NULL, false),
    ('comperelapin', NULL, 'Big Boss Martini', 1, NULL, NULL, 'Blanco Vermouth', NULL, NULL, false),
    ('comperelapin', NULL, 'Big Boss Martini', 2, NULL, NULL, 'Pikliz', NULL, NULL, false),
    ('comperelapin', NULL, 'Sky Juice', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('comperelapin', NULL, 'Sky Juice', 1, NULL, NULL, 'Coconut Water', NULL, NULL, false),
    ('comperelapin', NULL, 'Sky Juice', 2, NULL, NULL, 'Sweetened Condensed Milk', NULL, NULL, false),
    ('comperelapin', NULL, 'Sky Juice', 3, NULL, NULL, 'Nutmeg', NULL, NULL, false),
    ('comperelapin', NULL, 'Lucian Gold', 0, NULL, NULL, 'Lucian rum', 'Rum', NULL, false),
    ('comperelapin', NULL, 'Lucian Gold', 1, NULL, NULL, 'Lillet', 'Aperitif Wine', NULL, false),
    ('comperelapin', NULL, 'Lucian Gold', 2, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('comperelapin', NULL, 'Lucian Gold', 3, NULL, NULL, 'Mint', NULL, NULL, false),
    ('comperelapin', NULL, 'Lucian Gold', 4, NULL, NULL, 'Licor 43', 'Liqueur', NULL, false),
    ('comperelapin', NULL, 'Lucian Gold', 5, NULL, NULL, 'Sparkling Wine', NULL, NULL, false),
    ('elevenmadisonpark', NULL, 'Sunflower', 0, NULL, NULL, 'Ten to One Dark Rum', 'Dark Rum', NULL, false),
    ('elevenmadisonpark', NULL, 'Sunflower', 1, NULL, NULL, 'Batavia Arrack', NULL, NULL, false),
    ('elevenmadisonpark', NULL, 'Sunflower', 2, NULL, NULL, 'Apricot Eau de Vie', NULL, NULL, false),
    ('elevenmadisonpark', NULL, 'Sunflower', 3, NULL, NULL, 'Sunflower Miso Orgeat', NULL, NULL, false),
    ('elevenmadisonpark', NULL, 'Sunflower', 4, NULL, NULL, 'Meyer Lemon Juice', NULL, NULL, false),
    ('hawksmoorrestaurants', NULL, 'Shaky Pete''s Ginger Brew', 0, 50, 'ml', 'Ginger Syrup', NULL, 'house-made', false),
    ('hawksmoorrestaurants', NULL, 'Shaky Pete''s Ginger Brew', 1, 50, 'ml', 'Lemon Juice', NULL, NULL, false),
    ('hawksmoorrestaurants', NULL, 'Shaky Pete''s Ginger Brew', 2, 35, 'ml', 'Beefeater Gin', 'Gin', NULL, false),
    ('hawksmoorrestaurants', NULL, 'Shaky Pete''s Ginger Brew', 3, 100, 'ml', 'London Pride', 'Ale', NULL, false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Marmalade Martini', 0, 4, 'bsp', 'Orange Marmalade', NULL, NULL, false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Marmalade Martini', 1, 60, 'ml', 'Hayman''s London Dry Gin', 'London Dry Gin', NULL, false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Marmalade Martini', 2, 5, 'ml', 'Italian Red Bitter Liqueur', NULL, NULL, false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Marmalade Martini', 3, 15, 'ml', 'Lemon Juice', NULL, 'freshly squeezed', false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Marmalade Martini', 4, 7.5, 'ml', 'Rich Sugar Syrup', NULL, '2:1', false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Marmalade Martini', 5, 1, 'dash', 'Angostura Orange', 'Orange Bitters', NULL, false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Marmalade Martini', 6, NULL, NULL, 'Orange zest twist', NULL, 'garnish', false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Blinker', 0, 3, NULL, 'Raspberries', NULL, 'fresh', false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Blinker', 1, 60, 'ml', 'Straight Rye Whiskey', NULL, '100 proof', false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Blinker', 2, 15, 'ml', 'Pink Grapefruit Juice', NULL, 'freshly squeezed', false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Blinker', 3, 7.5, 'ml', 'Rich Sugar Syrup', NULL, '2:1', false),
    ('hawksmoorrestaurants', NULL, 'Hawksmoor Blinker', 4, NULL, NULL, 'Lemon zest twist', NULL, 'garnish', false),
    ('jackroseindc', NULL, 'Signature Manhattan', 0, NULL, NULL, 'Old Overholt Bottled in Bond Rye', 'Rye Whiskey', NULL, false),
    ('jackroseindc', NULL, 'Signature Manhattan', 1, NULL, NULL, 'Old Grand-Dad Bottled in Bond Bourbon', 'Bourbon', NULL, false),
    ('jackroseindc', NULL, 'Signature Manhattan', 2, NULL, NULL, 'Knob Creek 9 Year Bourbon', 'Bourbon', NULL, false),
    ('jackroseindc', NULL, 'Signature Manhattan', 3, NULL, NULL, 'house vermouth blend', 'Sweet Vermouth', NULL, false),
    ('jackroseindc', NULL, 'Signature Manhattan', 4, NULL, NULL, 'Angostura', NULL, NULL, false),
    ('jackroseindc', NULL, 'Signature Whisky Sour', 0, NULL, NULL, 'Glenmorangie Original 12 Year Single Malt Scotch', 'Single Malt Scotch', NULL, false),
    ('jackroseindc', NULL, 'Signature Whisky Sour', 1, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('jackroseindc', NULL, 'Signature Whisky Sour', 2, NULL, NULL, 'Grapefruit Juice', NULL, NULL, false),
    ('jackroseindc', NULL, 'Signature Whisky Sour', 3, NULL, NULL, 'Oleo Saccharum', NULL, 'made with house', false),
    ('jackroseindc', NULL, 'Signature Whisky Sour', 4, NULL, NULL, 'Egg White', NULL, NULL, false),
    ('jackroseindc', NULL, 'Signature Old Fashioned', 0, NULL, NULL, 'Wild Turkey 101 Rye', 'Rye Whiskey', NULL, false),
    ('jackroseindc', NULL, 'Signature Old Fashioned', 1, NULL, NULL, 'Demerara Syrup', NULL, NULL, false),
    ('jackroseindc', NULL, 'Signature Old Fashioned', 2, NULL, NULL, 'house', 'Bitters', NULL, false),
    ('navystrengthseattle', NULL, 'Escape Hatch', 0, 1.5, 'oz', 'Santa Teresa 1796 Aged Rum', 'Aged Rum', NULL, false),
    ('navystrengthseattle', NULL, 'Escape Hatch', 1, 0.75, 'oz', 'Jägermeister', 'Herbal Liqueur', NULL, false),
    ('navystrengthseattle', NULL, 'Escape Hatch', 2, 0.5, 'oz', 'Falernum', NULL, 'the bar makes its own', false),
    ('navystrengthseattle', NULL, 'Escape Hatch', 3, 0.75, 'oz', 'Lemon Juice', NULL, 'fresh', false),
    ('navystrengthseattle', NULL, 'Escape Hatch', 4, 3, 'oz', 'Coconut Water', NULL, NULL, false),
    ('navystrengthseattle', NULL, 'Escape Hatch', 5, NULL, NULL, 'Cinnamon, nutmeg and anything tropical (lime wheel, mint sprig, edible orchids)', NULL, 'garnish', false),
    ('navystrengthseattle', NULL, 'Kokum and Cashew Swizzle', 0, 2, 'oz', 'Angostura 5 Year Old Rum', 'Rum', NULL, false),
    ('navystrengthseattle', NULL, 'Kokum and Cashew Swizzle', 1, 1, 'oz', 'Lemon Juice', NULL, 'freshly squeezed', false),
    ('navystrengthseattle', NULL, 'Kokum and Cashew Swizzle', 2, 0.5, 'oz', 'Kokum Syrup', NULL, 'house-made', false),
    ('navystrengthseattle', NULL, 'Kokum and Cashew Swizzle', 3, 0.5, 'oz', 'Cashew Orgeat', NULL, 'house-made', false),
    ('navystrengthseattle', NULL, 'Kokum and Cashew Swizzle', 4, 0.25, 'oz', 'Tonic Syrup', NULL, 'made with Small Hand Foods', false),
    ('navystrengthseattle', NULL, 'Kokum and Cashew Swizzle', 5, 2, 'dash', 'Angostura', NULL, NULL, false),
    ('navystrengthseattle', NULL, 'Kokum and Cashew Swizzle', 6, NULL, NULL, 'Grated cinnamon, grated nutmeg and a mint sprig', NULL, 'garnish', false),
    ('navystrengthseattle', NULL, 'Mister Babadook', 0, NULL, NULL, 'Scotch Whisky', NULL, NULL, false),
    ('navystrengthseattle', NULL, 'Mister Babadook', 1, NULL, NULL, 'Ginger Beer', NULL, NULL, false),
    ('navystrengthseattle', NULL, 'Mister Babadook', 2, NULL, NULL, 'Apple Cider', NULL, NULL, false),
    ('navystrengthseattle', NULL, 'Mister Babadook', 3, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('navystrengthseattle', NULL, 'Mister Babadook', 4, NULL, NULL, 'Marmite', NULL, NULL, false),
    ('navystrengthseattle', NULL, 'Mister Babadook', 5, NULL, NULL, 'Black Tea Syrup', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Miso Thirsty', 0, NULL, NULL, 'Hibiki Japanese Harmony Whisky', 'Japanese Whisky', NULL, false),
    ('sexyfishlondon', NULL, 'Miso Thirsty', 1, NULL, NULL, 'Miso', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Miso Thirsty', 2, NULL, NULL, 'Plum', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Miso Thirsty', 3, NULL, NULL, 'Sesame', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Golden Riviera', 0, NULL, NULL, 'Don Julio Blanco Tequila', 'Blanco Tequila', NULL, false),
    ('sexyfishlondon', NULL, 'Golden Riviera', 1, NULL, NULL, 'Peach', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Golden Riviera', 2, NULL, NULL, 'Citrus', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Golden Riviera', 3, NULL, NULL, 'Oregano', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Golden Riviera', 4, NULL, NULL, 'Chipotle', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Super Magic Monkey', 0, NULL, NULL, 'Altamura Vodka', 'Vodka', NULL, false),
    ('sexyfishlondon', NULL, 'Super Magic Monkey', 1, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Super Magic Monkey', 2, NULL, NULL, 'Citrus', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Super Magic Monkey', 3, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Super Magic Monkey', 4, NULL, NULL, 'Gochujang', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Super Magic Monkey', 5, NULL, NULL, 'Coconut', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Super Magic Monkey', 6, NULL, NULL, 'Whey', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Strawberry', 0, 40, 'ml', 'Suntory Toki Japanese Whisky', 'Japanese Whisky', NULL, false),
    ('sexyfishlondon', NULL, 'Strawberry', 1, 15, 'ml', 'Noilly Prat Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('sexyfishlondon', NULL, 'Strawberry', 2, 30, 'ml', 'Strawberry Cordial', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Strawberry', 3, 90, 'ml', 'Soda', NULL, NULL, false),
    ('sexyfishlondon', NULL, 'Strawberry', 4, NULL, NULL, 'Basil leaf', NULL, 'garnish', false),
    ('supernovaballroom', NULL, 'Supernova Bellini', 0, NULL, NULL, 'Prosecco', NULL, NULL, false),
    ('supernovaballroom', NULL, 'Supernova Bellini', 1, NULL, NULL, 'White Miso', NULL, NULL, false),
    ('supernovaballroom', NULL, 'Supernova Bellini', 2, NULL, NULL, 'house-made, Niagara peaches', 'Peach Wine', NULL, false),
    ('supernovaballroom', NULL, 'Lady Divine', 0, NULL, NULL, 'Absolut Vodka', 'Vodka', NULL, false),
    ('supernovaballroom', NULL, 'Lady Divine', 1, NULL, NULL, 'Sparkling Rosé', NULL, NULL, false),
    ('supernovaballroom', NULL, 'Lady Divine', 2, NULL, NULL, 'Cedar Leaf Tincture', NULL, NULL, false),
    ('supernovaballroom', NULL, 'Lady Divine', 3, NULL, NULL, 'Apple Jam Pectin', NULL, NULL, false),
    ('supernovaballroom', NULL, 'A Great Day for Bay', 0, NULL, NULL, 'house-made', 'Saskatoon Berry Aperitif', NULL, false),
    ('supernovaballroom', NULL, 'A Great Day for Bay', 1, NULL, NULL, 'Lillet Blanc', 'Aperitif Wine', NULL, false),
    ('supernovaballroom', NULL, 'A Great Day for Bay', 2, NULL, NULL, 'Sparkling Rosé', NULL, NULL, false),
    ('supernovaballroom', NULL, 'Ruthless Tea', 0, NULL, NULL, 'Gooderham & Worts Canadian Whisky', 'Canadian Whisky', NULL, false),
    ('supernovaballroom', NULL, 'Ruthless Tea', 1, NULL, NULL, 'Amaro Nonino', 'Amaro', NULL, false),
    ('supernovaballroom', NULL, 'Ruthless Tea', 2, NULL, NULL, 'Red Plum', NULL, NULL, false),
    ('supernovaballroom', NULL, 'Ruthless Tea', 3, NULL, NULL, 'house-made', 'Genmaicha Kombucha', NULL, false),
    ('yachtclubbar', NULL, 'Cocoffee Negroni', 0, 30, 'ml', 'Planteray Coconut Rum', 'Coconut Rum', NULL, false),
    ('yachtclubbar', NULL, 'Cocoffee Negroni', 1, 30, 'ml', 'Mr Black Cold Brew Coffee Liqueur', 'Coffee Liqueur', NULL, false),
    ('yachtclubbar', NULL, 'Cocoffee Negroni', 2, 15, 'ml', 'Campari', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Cocoffee Negroni', 3, 15, 'ml', 'Madeira', NULL, '10-year-old Verdelho', false),
    ('yachtclubbar', NULL, 'Cocoffee Negroni', 4, NULL, NULL, 'Orange coin, expressed and set on the ice', NULL, 'garnish', false),
    ('yachtclubbar', NULL, 'Frozen Strawberry Daiquiri', 0, 1.25, 'oz', 'Appleton Estate Signature Blend Aged Rum', 'Aged Rum', NULL, false),
    ('yachtclubbar', NULL, 'Frozen Strawberry Daiquiri', 1, 0.75, 'oz', 'H&H', 'Madeira', '10-year Verdelho or Sercial', false),
    ('yachtclubbar', NULL, 'Frozen Strawberry Daiquiri', 2, 2, 'oz', 'Strawberry Cordial', NULL, 'house-made', false),
    ('yachtclubbar', NULL, 'Frozen Strawberry Daiquiri', 3, 0.75, 'oz', 'Lime Juice', NULL, 'fresh', false),
    ('yachtclubbar', NULL, 'Frozen Strawberry Daiquiri', 4, 1, 'pinch', 'Kosher Salt', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Frozen Strawberry Daiquiri', 5, NULL, NULL, 'Crushed Ice', NULL, '1 cup', false),
    ('yachtclubbar', NULL, 'Frozen Strawberry Daiquiri', 6, NULL, NULL, 'Mint sprig', NULL, 'garnish', false),
    ('yachtclubbar', NULL, 'Frozen Banana Daiquiri', 0, NULL, NULL, 'Overproof Rum', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Frozen Banana Daiquiri', 1, NULL, NULL, 'Ripe Banana', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Frozen Banana Daiquiri', 2, NULL, NULL, 'Coconut Cordial', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Frozen Banana Daiquiri', 3, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Frozen Banana Daiquiri', 4, NULL, NULL, 'Salt', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Old Bay Martini', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Old Bay Martini', 1, NULL, NULL, 'Extra Dry Vermouth', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Old Bay Martini', 2, NULL, NULL, 'Old Bay', NULL, NULL, false),
    ('yachtclubbar', NULL, 'Old Bay Martini', 3, NULL, NULL, 'Shrimp Chips', NULL, NULL, false),
    ('thefrench75bar', NULL, 'French 75', 0, 0.33, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('thefrench75bar', NULL, 'French 75', 1, 0.25, 'oz', 'Simple Syrup', NULL, '1:1', false),
    ('thefrench75bar', NULL, 'French 75', 2, 1.25, 'oz', 'Courvoisier VS Cognac', 'Cognac', NULL, false),
    ('thefrench75bar', NULL, 'French 75', 3, 2.25, 'oz', 'Moët & Chandon Impérial', 'Brut Champagne', NULL, false),
    ('thefrench75bar', NULL, 'French 75', 4, NULL, NULL, 'Lemon peel', NULL, 'garnish', false),
    ('thefrench75bar', NULL, 'Arnaud''s Special', 0, NULL, NULL, 'Monkey Shoulder Scotch', 'Scotch Whisky', NULL, false),
    ('thefrench75bar', NULL, 'Arnaud''s Special', 1, NULL, NULL, 'Laphroaig Islay Scotch', 'Islay Scotch Whisky', NULL, false),
    ('thefrench75bar', NULL, 'Arnaud''s Special', 2, NULL, NULL, 'Dubonnet', 'Quinquina', NULL, false),
    ('thefrench75bar', NULL, 'Arnaud''s Special', 3, NULL, NULL, 'Amer Picon', 'Bitter Orange Aperitif', NULL, false),
    ('thefrench75bar', NULL, 'Arnaud''s Special', 4, NULL, NULL, 'Apricot Liqueur', NULL, NULL, false),
    ('thefrench75bar', NULL, 'Katsura Fashioned', 0, NULL, NULL, 'Suntory Toki Japanese Whisky', 'Japanese Whisky', NULL, false),
    ('thefrench75bar', NULL, 'Katsura Fashioned', 1, NULL, NULL, 'Nigori Sake Syrup', NULL, NULL, false),
    ('thefrench75bar', NULL, 'Katsura Fashioned', 2, NULL, NULL, 'Orange Blossom Water', NULL, NULL, false),
    ('thefrench75bar', NULL, 'Katsura Fashioned', 3, NULL, NULL, 'Anise', NULL, NULL, false),
    ('thefrench75bar', NULL, 'Katsura Fashioned', 4, NULL, NULL, 'Angostura Bitters', NULL, NULL, false),
    ('thefrench75bar', NULL, 'Katsura Fashioned', 5, NULL, NULL, 'Orange Bitters', NULL, NULL, false),
    ('baragricole', NULL, 'Agricole Rhum Punch with Red Wine', 0, 1, 'oz', 'Aged Rhum Agricole', NULL, NULL, false),
    ('baragricole', NULL, 'Agricole Rhum Punch with Red Wine', 1, 0.75, 'oz', 'Light-bodied Red Wine', NULL, 'such as Beaujolais', false),
    ('baragricole', NULL, 'Agricole Rhum Punch with Red Wine', 2, 0.5, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('baragricole', NULL, 'Agricole Rhum Punch with Red Wine', 3, 0.25, 'oz', 'Gum Syrup', NULL, NULL, false),
    ('baragricole', NULL, 'Turf Cocktail', 0, 1.5, 'oz', 'Gin', NULL, NULL, false),
    ('baragricole', NULL, 'Turf Cocktail', 1, 0.75, 'oz', 'Dry Vermouth', NULL, NULL, false),
    ('baragricole', NULL, 'Turf Cocktail', 2, 0.25, 'oz', 'Maraschino Liqueur', NULL, NULL, false),
    ('baragricole', NULL, 'Turf Cocktail', 3, 2, 'dash', 'Absinthe', NULL, NULL, false),
    ('baragricole', NULL, 'Turf Cocktail', 4, 2, 'dash', 'Orange Bitters', NULL, NULL, false),
    ('baragricole', NULL, 'Turf Cocktail', 5, NULL, NULL, 'Lemon twist', NULL, 'garnish', false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 0, NULL, NULL, 'Raisin-infused Rum', NULL, 'made with El Dorado 8 yr', false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 1, NULL, NULL, 'El Dorado 12 yr Aged Rum', 'Aged Rum', NULL, false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 2, NULL, NULL, 'Coconut Water Syrup', NULL, NULL, false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 3, NULL, NULL, 'Spiced Orgeat', NULL, NULL, false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 4, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 5, NULL, NULL, 'Ohia Blossom Honey', NULL, NULL, false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 6, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 7, NULL, NULL, 'Absinthe', NULL, NULL, false),
    ('barleatherapron', NULL, 'E Ho''o Pau Mai Tai', 8, NULL, NULL, 'Kiawe Wood Smoke', NULL, NULL, false),
    ('barleatherapron', NULL, 'BLA Old Fashioned', 0, NULL, NULL, 'Knob Creek BLA Single Barrel Bourbon', 'Bourbon', NULL, false),
    ('barleatherapron', NULL, 'BLA Old Fashioned', 1, NULL, NULL, 'Angostura Bitters', NULL, NULL, false),
    ('barleatherapron', NULL, 'BLA Old Fashioned', 2, NULL, NULL, 'Wasanbon Sugar', NULL, NULL, false),
    ('barleatherapron', NULL, 'BLA Old Fashioned', 3, NULL, NULL, 'Orange', NULL, NULL, false),
    ('barleatherapron', NULL, 'Leather Soul', 0, NULL, NULL, 'Knob Creek LS Single Barrel Bourbon', 'Bourbon', NULL, false),
    ('barleatherapron', NULL, 'Leather Soul', 1, NULL, NULL, 'Laphroaig 10 yr Islay Scotch', 'Islay Scotch Whisky', NULL, false),
    ('barleatherapron', NULL, 'Leather Soul', 2, NULL, NULL, 'Cynar', 'Amaro', NULL, false),
    ('barleatherapron', NULL, 'Leather Soul', 3, NULL, NULL, 'Carpano Antica Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('barleatherapron', NULL, 'Leather Soul', 4, NULL, NULL, 'Lemon Oil', NULL, NULL, false),
    ('barleatherapron', NULL, 'Leather Soul', 5, NULL, NULL, 'Sea Salt', NULL, NULL, false),
    ('barleatherapron', NULL, 'Leather Soul', 6, NULL, NULL, 'Tobacco', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 1, NULL, NULL, 'Yuzu', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 2, NULL, NULL, 'Mandarin', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 3, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 4, NULL, NULL, 'Hojicha', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 5, NULL, NULL, 'Wasanbon Sugar', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 6, NULL, NULL, 'Citrus Blend', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 7, NULL, NULL, 'Angostura Bitters', NULL, NULL, false),
    ('barleatherapron', NULL, 'Yuzu Sour', 8, NULL, NULL, 'Egg White', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'La Trinidad', 0, NULL, NULL, 'Don Q 7 años Aged Rum', 'Aged Rum', NULL, false),
    ('identidadcocktailbar', NULL, 'La Trinidad', 1, NULL, NULL, 'Cardamaro', 'Amaro', NULL, false),
    ('identidadcocktailbar', NULL, 'La Trinidad', 2, NULL, NULL, 'Coffee Syrup', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'La Trinidad', 3, NULL, NULL, 'Cocoa', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Tamarindo y Setas', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Tamarindo y Setas', 1, NULL, NULL, 'Mushroom', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Tamarindo y Setas', 2, NULL, NULL, 'Tamarind', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Tamarindo y Setas', 3, NULL, NULL, 'Sesame Cookie', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Juniper Paradise', 0, NULL, NULL, 'Bombay Gin', 'Gin', NULL, false),
    ('identidadcocktailbar', NULL, 'Juniper Paradise', 1, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Juniper Paradise', 2, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Juniper Paradise', 3, NULL, NULL, 'Basil', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Juniper Paradise', 4, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Juniper Paradise', 5, NULL, NULL, 'Cardamom', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Juniper Paradise', 6, NULL, NULL, 'Basil Air', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Pineapple Vesper', 0, NULL, NULL, 'Beefeater 24 Gin', 'Gin', NULL, false),
    ('identidadcocktailbar', NULL, 'Pineapple Vesper', 1, NULL, NULL, 'Bacardi Carta Blanca White Rum', 'White Rum', NULL, false),
    ('identidadcocktailbar', NULL, 'Pineapple Vesper', 2, NULL, NULL, 'Cocchi Americano', 'Aperitif Wine', 'pineapple-infused', false),
    ('identidadcocktailbar', NULL, 'Pineapple Vesper', 3, NULL, NULL, 'Lemongrass', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Pineapple Vesper', 4, NULL, NULL, 'Ginger Oil', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Cochee Milk Punch', 0, NULL, NULL, 'Woodford Reserve Bourbon', 'Bourbon', NULL, false),
    ('identidadcocktailbar', NULL, 'Cochee Milk Punch', 1, NULL, NULL, '1800 Coconut Tequila', 'Coconut Tequila', NULL, false),
    ('identidadcocktailbar', NULL, 'Cochee Milk Punch', 2, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Cochee Milk Punch', 3, NULL, NULL, 'Lychee', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Cochee Milk Punch', 4, NULL, NULL, 'Spices', NULL, NULL, false),
    ('identidadcocktailbar', NULL, 'Cochee Milk Punch', 5, NULL, NULL, 'Milk', NULL, 'for clarification', false),
    ('julephou', NULL, 'Mint Julep', 0, 10, 'leaf', 'Mint Leaves', NULL, NULL, false),
    ('julephou', NULL, 'Mint Julep', 1, 0.5, 'oz', 'Turbinado Syrup', NULL, NULL, false),
    ('julephou', NULL, 'Mint Julep', 2, 2, 'oz', 'Bourbon', NULL, 'mid-80s to 90 proof', false),
    ('julephou', NULL, 'Mint Julep', 3, NULL, NULL, '2 to 3 mint sprigs, powdered sugar', NULL, 'garnish', false),
    ('julephou', NULL, 'Vinegar & Rye', 0, 1, NULL, 'Fig', NULL, 'whole, trimmed and halved', false),
    ('julephou', NULL, 'Vinegar & Rye', 1, 1, 'oz', 'Bonded Rye Whiskey', NULL, '100 proof', false),
    ('julephou', NULL, 'Vinegar & Rye', 2, 1, 'oz', 'Rainwater Madeira', NULL, NULL, false),
    ('julephou', NULL, 'Vinegar & Rye', 3, 0.5, 'oz', 'Turbinado Syrup', NULL, NULL, false),
    ('julephou', NULL, 'Vinegar & Rye', 4, 1, 'bsp', 'Lime Juice', NULL, NULL, false),
    ('julephou', NULL, 'Vinegar & Rye', 5, 1, 'bsp', 'Banyuls Vinegar', NULL, 'or sherry vinegar', false),
    ('julephou', NULL, 'Vinegar & Rye', 6, NULL, NULL, '2 mint sprigs and half a fresh fig', NULL, 'garnish', false),
    ('julephou', NULL, 'Cherry Bounce Sour', 0, 1.25, 'oz', 'Old Grand-Dad Bourbon', 'Bourbon', '100 proof', false),
    ('julephou', NULL, 'Cherry Bounce Sour', 1, 1, 'oz', 'Cherry Bounce', NULL, 'house-made', false),
    ('julephou', NULL, 'Cherry Bounce Sour', 2, 0.5, 'oz', 'Turbinado Simple Syrup', NULL, '1:1', false),
    ('julephou', NULL, 'Cherry Bounce Sour', 3, 0.25, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('julephou', NULL, 'Cherry Bounce Sour', 4, 1, 'dash', 'Angostura Bitters', NULL, NULL, false),
    ('julephou', NULL, 'Cherry Bounce Sour', 5, 1, NULL, 'Egg White', NULL, NULL, false),
    ('julephou', NULL, 'Cherry Bounce Sour', 6, NULL, NULL, 'Spritz of Angostura, grated cinnamon and a bourbon cherry', NULL, 'garnish', false),
    ('julephou', NULL, 'Snake-Bit Sprout', 0, NULL, NULL, 'Ford''s Gin', 'Gin', NULL, false),
    ('julephou', NULL, 'Snake-Bit Sprout', 1, NULL, NULL, 'Chamomile', NULL, NULL, false),
    ('julephou', NULL, 'Snake-Bit Sprout', 2, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('julephou', NULL, 'Snake-Bit Sprout', 3, NULL, NULL, 'Lime Juice', NULL, NULL, false),
    ('julephou', NULL, 'Snake-Bit Sprout', 4, NULL, NULL, 'Cider', NULL, NULL, false),
    ('loma_bar', NULL, '#14', 0, 2, 'oz', 'Cryo-concentrated Fino Sherry', NULL, NULL, false),
    ('loma_bar', NULL, '#14', 1, 1, 'oz', 'Dolin Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('loma_bar', NULL, '#14', 2, 1, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('loma_bar', NULL, '#14', 3, 0.75, 'oz', 'Dewar''s Blended Scotch', 'Blended Scotch Whisky', NULL, false),
    ('loma_bar', NULL, '#14', 4, 0.75, 'oz', 'Fig, Chamomile and Cardamom Syrup', NULL, NULL, false),
    ('loma_bar', NULL, '#14', 5, 3, 'drop', 'Sherry Vinegar', NULL, 'Vinagre de Jerez', false),
    ('loma_bar', NULL, '#14', 6, 4, 'oz', 'Quesos La Ricura', 'Salvadoran Crema', 'room temperature', false),
    ('loma_bar', NULL, '#14', 7, NULL, NULL, 'Peated Scotch spray and a fig slice', NULL, 'garnish', false),
    ('loma_bar', NULL, 'Forraje (No. 5)', 0, NULL, NULL, 'Amontillado Sherry', NULL, NULL, false),
    ('loma_bar', NULL, 'Forraje (No. 5)', 1, NULL, NULL, 'Manzanilla Sherry', NULL, NULL, false),
    ('loma_bar', NULL, 'Forraje (No. 5)', 2, NULL, NULL, 'Shiitake Mushroom Orgeat', NULL, NULL, false),
    ('loma_bar', NULL, 'Forraje (No. 5)', 3, NULL, NULL, 'Champagne Vinegar', NULL, NULL, false),
    ('loma_bar', NULL, 'Forraje (No. 5)', 4, NULL, NULL, 'Orange Juice', NULL, NULL, false),
    ('loma_bar', NULL, 'No. 16', 0, NULL, NULL, 'Vodka', NULL, NULL, false),
    ('loma_bar', NULL, 'No. 16', 1, NULL, NULL, 'Green Aniseed', NULL, NULL, false),
    ('loma_bar', NULL, 'No. 16', 2, NULL, NULL, 'Pink Peppercorn', NULL, NULL, false),
    ('loma_bar', NULL, 'No. 16', 3, NULL, NULL, 'Byrrh', 'Quinquina', NULL, false),
    ('loma_bar', NULL, 'No. 16', 4, NULL, NULL, 'Galliano', 'Herbal Liqueur', NULL, false),
    ('loma_bar', NULL, 'No. 16', 5, NULL, NULL, 'Mahaleb', NULL, NULL, false),
    ('loma_bar', NULL, 'No. 16', 6, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('loma_bar', NULL, 'No. 16', 7, NULL, NULL, 'Bitters', NULL, NULL, false),
    ('loma_bar', NULL, 'No. 16', 8, NULL, NULL, 'Egg', NULL, NULL, false),
    ('loma_bar', NULL, 'Pisco Bee''s Knees', 0, 2, 'oz', 'Suyo Italia Pisco', 'Pisco', NULL, false),
    ('loma_bar', NULL, 'Pisco Bee''s Knees', 1, 0.75, 'oz', 'Rich Honey Syrup', NULL, '2:1 honey to water', false),
    ('loma_bar', NULL, 'Pisco Bee''s Knees', 2, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false),
    ('loma_bar', NULL, 'Pisco Bee''s Knees', 3, NULL, NULL, 'De-seeded lemon wheel', NULL, 'garnish', false),
    ('scotchlodge', NULL, 'Namesake', 0, 1.5, 'oz', 'Bowmore Legend Scotch', 'Scotch Whisky', NULL, false),
    ('scotchlodge', NULL, 'Namesake', 1, 0.5, 'oz', 'Combier Rouge', 'Cherry Liqueur', NULL, false),
    ('scotchlodge', NULL, 'Namesake', 2, 0.5, 'oz', 'Cynar', 'Amaro', NULL, false),
    ('scotchlodge', NULL, 'Namesake', 3, 0.5, 'oz', 'Punt e Mes Sweet Vermouth', 'Sweet Vermouth', NULL, false),
    ('scotchlodge', NULL, 'Namesake', 4, 1, 'dash', 'Orange Bitters', NULL, NULL, false),
    ('scotchlodge', NULL, 'Namesake', 5, NULL, NULL, 'Orange peel', NULL, 'garnish', false),
    ('scotchlodge', NULL, 'Only Fans Martini', 0, NULL, NULL, 'Dutch Gin', NULL, NULL, false),
    ('scotchlodge', NULL, 'Only Fans Martini', 1, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('scotchlodge', NULL, 'Only Fans Martini', 2, NULL, NULL, 'Orgeat', NULL, NULL, false),
    ('scotchlodge', NULL, 'Only Fans Martini', 3, NULL, NULL, 'Sparkling Wine', NULL, NULL, false),
    ('scotchlodge', NULL, 'Only Fans Martini', 4, NULL, NULL, 'Lemon Juice', NULL, NULL, false),
    ('scotchlodge', NULL, 'Only Fans Martini', 5, NULL, NULL, 'Passion Fruit Pearls', NULL, NULL, false),
    ('scotchlodge', NULL, 'Only Fans Martini', 6, NULL, NULL, 'Coconut Milk', NULL, 'for clarification', false),
    ('scotchlodge', NULL, 'Loch Stock', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('scotchlodge', NULL, 'Loch Stock', 1, NULL, NULL, 'Smoky Scotch Whisky', NULL, NULL, false),
    ('scotchlodge', NULL, 'Loch Stock', 2, NULL, NULL, 'Ancho Reyes', 'Chile Liqueur', NULL, false),
    ('scotchlodge', NULL, 'Loch Stock', 3, NULL, NULL, 'Lapsang Souchong Sweet Vermouth', NULL, NULL, false),
    ('scotchlodge', NULL, 'Loch Stock', 4, NULL, NULL, 'Mole Bitters', NULL, NULL, false),
    ('scotchlodge', NULL, 'Pandan Old Fashioned', 0, NULL, NULL, 'Mezcal', NULL, 'pandan-infused', false),
    ('scotchlodge', NULL, 'Pandan Old Fashioned', 1, NULL, NULL, 'Aged Tequila', NULL, NULL, false),
    ('scotchlodge', NULL, 'Pandan Old Fashioned', 2, NULL, NULL, 'Coconut-oolong Demerara Syrup', NULL, NULL, false),
    ('scotchlodge', NULL, 'Pandan Old Fashioned', 3, NULL, NULL, 'Cacao Bitters', NULL, NULL, false),
    ('violethourchicago', NULL, 'Juliet & Romeo', 0, 2, 'oz', 'Beefeater London Dry Gin', 'London Dry Gin', NULL, false),
    ('violethourchicago', NULL, 'Juliet & Romeo', 1, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    ('violethourchicago', NULL, 'Juliet & Romeo', 2, 0.75, 'oz', 'Simple Syrup', NULL, NULL, false),
    ('violethourchicago', NULL, 'Juliet & Romeo', 3, 3, 'slice', 'Cucumber', NULL, NULL, false),
    ('violethourchicago', NULL, 'Juliet & Romeo', 4, 1, 'sprig', 'Mint', NULL, NULL, false),
    ('violethourchicago', NULL, 'Juliet & Romeo', 5, 1, 'pinch', 'Salt', NULL, NULL, false),
    ('violethourchicago', NULL, 'Juliet & Romeo', 6, NULL, NULL, 'Mint leaf with 1 dash of rose water on it and 3 dashes of Angostura bitters', NULL, 'garnish', false),
    ('violethourchicago', NULL, 'The Art of Choke', 0, 1, 'oz', 'White Rum', NULL, NULL, false),
    ('violethourchicago', NULL, 'The Art of Choke', 1, 1, 'oz', 'Cynar', 'Amaro', NULL, false),
    ('violethourchicago', NULL, 'The Art of Choke', 2, 0.75, 'tsp', 'Lime Juice', NULL, NULL, false),
    ('violethourchicago', NULL, 'The Art of Choke', 3, 0.75, 'tsp', 'Demerara Syrup', NULL, '2:1', false),
    ('violethourchicago', NULL, 'The Art of Choke', 4, 0.25, 'oz', 'Green Chartreuse', NULL, NULL, false),
    ('violethourchicago', NULL, 'The Art of Choke', 5, NULL, NULL, 'Mint sprig', NULL, 'garnish', false),
    ('violethourchicago', NULL, 'Paper Plane', 0, 0.75, 'oz', 'Bourbon', NULL, NULL, false),
    ('violethourchicago', NULL, 'Paper Plane', 1, 0.75, 'oz', 'Nonino Quintessentia', 'Amaro', NULL, false),
    ('violethourchicago', NULL, 'Paper Plane', 2, 0.75, 'oz', 'Aperol', NULL, NULL, false),
    ('violethourchicago', NULL, 'Paper Plane', 3, 0.75, 'oz', 'Lemon Juice', NULL, NULL, false);


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
WHERE t.item_id IS NULL OR EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = t.item_id);

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

