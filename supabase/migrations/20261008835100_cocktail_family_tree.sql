-- The cocktail family tree, loaded: 391 classics and modern classics, the 25
-- historic styles they descend from, and the people and bars who made them.
-- Researched and fact-checked 2026-10-07 (draft: claude.ai artifact
-- XYGWUU8Y6ULbdvk2NywexD), approved by Kevin for production.
--
-- 1. drink_styles: Punch, Sling, the bittered sling, Sour, Daisy, Highball...
-- 2. Every drink in the tree is a catalog classic: the 74 already there are
--    matched by name, the rest are added. Each gets its year (approximate
--    where the sources only give a decade), its family, what changed from its
--    parent, and its parent: a classic (lineage_parent_id) or a style.
-- 3. The people who made them get public, unclaimed person profiles, and the
--    bars where they were first made get bar profiles, closed ones included
--    (is_closed, closed_year), with positions linking the two. Names, cities
--    and professional facts in our own words; no photos. Existing profiles
--    are reused by handle. Each claims their own through profile_claims.
-- 4. Credits: the first-named maker on the drink, the rest as co-creators,
--    and the bar it was first made at, all 'suggested' until claimed. An
--    existing credit on a classic is kept.
-- 5. One web source per drink (Wikipedia first where there is one) as its first
--    record in "From the books", for drinks that have none yet.
-- 6. Bars' drinks with a classic's exact name and no classic yet are linked to
--    it (riff_of_id), so they rank in that classic's list. Home drinks are
--    left alone.
--
-- No paid AI: app.image_worker stops sketch jobs, and the flavour jobs these
-- inserts queue are removed at the end (with CATALOG_AI_FILL=on each would be
-- a paid fill). Idempotent: rerunning adds nothing twice.

SET "app.image_worker" = 'on';

CREATE TEMP TABLE "ft_jobs_before" AS SELECT "item_id" FROM "private"."item_flavor_jobs";

-- --- 1. Styles ---

INSERT INTO "public"."drink_styles" ("key", "name", "family", "year", "year_approx", "summary")
SELECT v.key, v.name, v.family, v.year::smallint, v.approx, v.summary
FROM (VALUES
    ('punch', 'Punch', 'trunk', 1632, false, 'Spirit, sugar, citrus, water, spice, shared from a bowl. The ancestor of almost everything.'),
    ('flip', 'Flip', 'flip', 1695, false, 'Spirit or beer, sugar, whole egg'),
    ('sling', 'Sling', 'oldfashioned', 1759, false, 'Punch for one: spirit, sugar, water, no citrus'),
    ('nog', 'Eggnog', 'flip', 1775, false, 'Flip with milk or cream'),
    ('aperitivo', 'Aperitivo (Vermouth and Bitter)', 'negroni', 1786, false, 'Italian vermouth (Carpano, Turin 1786), later drunk with a bitter liqueur (Campari 1860). Its own root, apart from the American cocktail'),
    ('toddy', 'Toddy', 'oldfashioned', 1786, false, 'A sling served hot'),
    ('julep', 'Julep', 'oldfashioned', 1803, false, 'Mint and crushed ice'),
    ('cocktail', 'The Cocktail (Bittered Sling)', 'oldfashioned', 1806, false, 'Add bitters: spirit, sugar, water, bitters (The Balance and Columbian Repository)'),
    ('cobbler', 'Cobbler', 'highball', 1838, false, 'Wine or sherry, sugar, fruit, crushed ice, a straw'),
    ('highball', 'Highball', 'highball', 1840, true, 'Spirit and a carbonated mixer over ice. Brandy and soda by the 1840s; called a highball by the 1890s'),
    ('swizzle', 'Swizzle', 'tiki', 1840, false, 'Caribbean punch for one, churned with a swizzle stick over crushed ice'),
    ('spritz', 'Spritz', 'highball', 1850, false, 'Wine lengthened with soda (Austro-Hungarian Veneto), later with a bitter aperitivo'),
    ('crusta', 'Crusta', 'sidecar', 1852, false, 'Cocktail plus lemon and curaçao, sugared rim, whole peel (Joseph Santini, New Orleans)'),
    ('champagne-cocktail', 'Champagne Cocktail', 'highball', 1855, true, 'The cocktail topped with champagne instead of spirit'),
    ('fix', 'Fix', 'sour', 1856, false, 'A sour built over crushed ice and dressed with fruit'),
    ('sour', 'Sour', 'sour', 1856, false, 'Punch for one: spirit, citrus, sugar'),
    ('duo', 'Duos and Trios', 'flip', 1860, true, 'Spirit plus a liqueur, stirred; add cream to make a trio'),
    ('collins', 'Collins', 'highball', 1865, true, 'Sour served long over ice with soda. John Collins of Limmer''s, London; Tom Collins craze 1874 to 1876'),
    ('daisy', 'Daisy', 'sidecar', 1866, false, 'Sour sweetened with a liqueur or cordial'),
    ('vermouth-cocktail', 'Vermouth Cocktail', 'martini', 1869, false, 'Vermouth enters the cocktail'),
    ('fizz', 'Fizz', 'highball', 1876, false, 'Sour shaken, served short with soda, no ice'),
    ('planters-punch', 'Planter''s Punch', 'tiki', 1878, false, 'Jamaican rum punch: one of sour, two of sweet, three of strong, four of weak'),
    ('buck', 'Buck', 'highball', 1895, true, 'Spirit, citrus and ginger ale or ginger beer over ice'),
    ('tiki', 'Tiki (Don the Beachcomber)', 'tiki', 1934, false, 'Layered rums, spiced syrups, several citruses (Ernest Gantt, Hollywood)'),
    ('spiked-coffee', 'Spiked Coffee', 'flip', NULL, true, 'Hot coffee replaces hot water in the toddy: spirit, sugar, coffee, often cream')
) AS v("key", "name", "family", "year", "approx", "summary")
WHERE NOT EXISTS (SELECT 1 FROM "public"."drink_styles" s WHERE s.key = v.key);

UPDATE "public"."drink_styles" s SET "parent_style_id" = p.id
FROM (VALUES
    ('sling', 'punch'),
    ('nog', 'flip'),
    ('toddy', 'sling'),
    ('julep', 'sling'),
    ('cocktail', 'sling'),
    ('cobbler', 'punch'),
    ('highball', 'sling'),
    ('swizzle', 'punch'),
    ('spritz', 'highball'),
    ('crusta', 'cocktail'),
    ('champagne-cocktail', 'cocktail'),
    ('fix', 'sour'),
    ('sour', 'punch'),
    ('duo', 'cocktail'),
    ('collins', 'sour'),
    ('daisy', 'sour'),
    ('vermouth-cocktail', 'cocktail'),
    ('fizz', 'sour'),
    ('planters-punch', 'punch'),
    ('buck', 'highball'),
    ('tiki', 'planters-punch'),
    ('spiked-coffee', 'toddy')
) AS v("key", "parent")
JOIN "public"."drink_styles" p ON p.key = v.parent
WHERE s.key = v.key AND s.parent_style_id IS DISTINCT FROM p.id;

-- --- 2. People and bars ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "locality", "address_line",
                                 "postcode", "city", "region", "country_code", "latitude", "longitude", "is_closed", "closed_year")
SELECT 'bar', v.handle, v.name, v.bio, v.website, true, v.locality, v.address_line, v.postcode, v.city, v.region, v.country_code,
       v.latitude::double precision, v.longitude::double precision, v.is_closed, v.closed_year::smallint
FROM (VALUES
    ('21club.nyc', '21 Club', 'Former speakeasy turned Midtown restaurant and bar. It started in Greenwich Village in 1922 and moved to 21 West 52nd Street on 1 January 1930. Closed in 2020.', NULL, 'Midtown', '21 West 52nd Street', '10019', 'New York', 'NY', 'US', 40.7605, -73.9774, true, 2020),
    ('antoines.nola', 'Antoine''s', 'French Quarter restaurant founded by Antoine Alciatore in 1840 and still run by his descendants. Known for tableside Café Brûlot.', 'https://www.antoines.com', 'French Quarter', '713 St. Louis Street', '70130', 'New Orleans', 'LA', 'US', 29.9567, -90.0666, false, NULL),
    ('ashlandhouse.nyc', 'Ashland House', 'Hotel near Madison Square in New York where Patrick Gavin Duffy tended bar from about 1884 and became head bartender. Long closed.', NULL, NULL, NULL, NULL, 'New York', 'NY', 'US', NULL, NULL, true, NULL),
    ('aviarybar.klhilton', 'Aviary Bar, Kuala Lumpur Hilton', 'Bar of the original Kuala Lumpur Hilton on Jalan Sultan Ismail, which opened in 1973 as the city''s first five-star hotel. The Jungle Bird was its welcome drink. The hotel left the Hilton brand and was later demolished.', NULL, NULL, 'Jalan Sultan Ismail', NULL, 'Kuala Lumpur', NULL, 'MY', NULL, NULL, true, NULL),
    ('banffsprings', 'Banff Springs Hotel', 'Railway resort hotel in Banff, Alberta, whose head bartender Peter Fich is credited in one account with the B-52.', NULL, NULL, NULL, NULL, 'Banff', 'AB', 'CA', NULL, NULL, false, NULL),
    ('bankexchange.sf', 'Bank Exchange', 'Saloon in the Montgomery Block at Montgomery and Washington Streets, opened in 1853. Duncan Nicol, its proprietor from the late 1880s, made Pisco Punch its specialty. It closed with wartime Prohibition in 1919.', NULL, 'Financial District', 'Montgomery Street at Washington Street', NULL, 'San Francisco', 'CA', 'US', 37.795, -122.4031, true, 1919),
    ('baraccas.nyc', 'Baracca''s', 'Italian restaurant in Lower Manhattan''s financial district run by Victor Baracca, where Jacob Grohusko was head bartender in the 1900s and published Jack''s Manual in 1908.', NULL, 'Financial District', NULL, NULL, 'New York', 'NY', 'US', NULL, NULL, true, NULL),
    ('barbasso.milano', 'Bar Basso', 'Milan bar at Via Plinio 39, opened in 1947 and taken over in 1967 by Mirko Stocchetto, whose family still runs it. Home of the Negroni Sbagliato and its oversized glassware.', 'https://www.barbasso.com', 'Città Studi', 'Via Plinio 39', '20129', 'Milan', NULL, 'IT', 45.4785, 9.2144, false, NULL),
    ('barrelhouseflat', 'Barrelhouse Flat', 'Lincoln Park cocktail bar opened in late 2011 by Violet Hour alumni Stephen Cole and Greg Buttera, focused on forgotten classics. Closed after nearly eight years.', NULL, 'Lincoln Park', '2624 N Lincoln Ave', '60614', 'Chicago', 'IL', 'US', NULL, NULL, true, 2019),
    ('beacon.nyc', 'Beacon', 'Midtown restaurant of chef Waldy Malouf at 25 West 56th Street, focused on wood-fired cooking. Audrey Saunders led its bar from 1999. Now closed.', NULL, 'Midtown', '25 West 56th Street', '10019', 'New York', 'NY', 'US', 40.7627, -73.9767, true, NULL),
    ('belami.eugene', 'Bel Ami', 'Restaurant and lounge in Eugene''s Midtown Marketplace where Jeffrey Morgenthaler tended bar in the early 2000s. The restaurant and lounge closed in March 2009.', NULL, NULL, NULL, NULL, 'Eugene', 'OR', 'US', NULL, NULL, true, 2009),
    ('bellevue.philly', 'Bellevue Hotel', 'Hotel opened by George Boldt in 1891 at Broad and Walnut Streets, where the Clover Club dined. It was succeeded in 1904 by the Bellevue-Stratford across Walnut Street, which still operates as The Bellevue.', NULL, 'Center City', 'Broad Street at Walnut Street', NULL, 'Philadelphia', 'PA', 'US', 39.9492, -75.1646, true, NULL),
    ('bohemianclub.sf', 'Bohemian Club', 'Private San Francisco men''s club founded in 1872 by journalists and artists, with its clubhouse on Taylor Street. One of several places credited with the Gibson.', NULL, 'Nob Hill', '624 Taylor Street', NULL, 'San Francisco', 'CA', 'US', 37.7887, -122.4116, false, NULL),
    ('bourbonandbranch', 'Bourbon & Branch', 'Speakeasy-style cocktail bar in the Tenderloin opened in 2006, an early leader of San Francisco''s craft cocktail revival.', 'https://www.bourbonandbranch.com', 'Tenderloin', '501 Jones Street', '94102', 'San Francisco', 'CA', 'US', 37.7867, -122.4133, false, NULL),
    ('bridgetownclub.bb', 'Bridgetown Club', 'Social club in Bridgetown, Barbados, described by the Oxford Companion as a probable birthplace of the Green Swizzle around 1900.', NULL, NULL, NULL, NULL, 'Bridgetown', NULL, 'BB', NULL, NULL, false, NULL),
    ('brooks.club.london', 'Brooks''s', 'Gentlemen''s club on St James''s Street founded in 1764, historically linked to the Whigs.', NULL, 'St James''s', '60 St James''s Street', 'SW1A 1LN', 'London', NULL, 'GB', 51.507, -0.1393, false, NULL),
    ('brunos.sf', 'Bruno''s', 'Mission District venue on Mission Street for more than 60 years, first an Italian restaurant and later a jazz and nightclub. Jon Santer ran its bar in 2004. Closed in March 2020 and reopened in September 2026.', NULL, 'Mission District', '2389 Mission Street', '94110', 'San Francisco', 'CA', 'US', 37.7586, -122.4189, false, NULL),
    ('bucks.club.london', 'Buck''s Club', 'Mayfair gentlemen''s club founded in 1919 by Herbert Buckmaster. Its barman Pat McGarry is credited with the Buck''s Fizz in 1921.', NULL, 'Mayfair', '18 Clifford Street', 'W1S 3RF', 'London', NULL, 'GB', 51.5113, -0.1419, false, NULL),
    ('cafegeorge.dijon', 'Café George', 'Dijon café where, by popular account, a waiter named Faivre first mixed white wine with crème de cassis in 1904, the drink later called Kir.', NULL, 'Montchapet', 'Rue de Montchapet', NULL, 'Dijon', NULL, 'FR', NULL, NULL, false, NULL),
    ('cafemadrid.valencia', 'Café Madrid', 'Historic Valencia café-bar on Calle Abadía de San Martín where Constante Gil created Agua de Valencia in 1959. It reopened in 2018 after a closure.', NULL, NULL, 'Calle Abadía de San Martín 10', '46002', 'Valencia', NULL, 'ES', 39.4729, -0.3768, false, NULL),
    ('caferoyal.london', 'Café Royal', 'Regent Street café and restaurant founded in 1865 by wine merchant Daniel Nicols. Its bar produced the Café Royal Cocktail Book in 1937. It closed in 2008 and reopened as Hotel Café Royal in 2012.', 'https://www.hotelcaferoyal.com', 'Piccadilly', '68 Regent Street', 'W1B 4DY', 'London', NULL, 'GB', 51.51, -0.1358, false, NULL),
    ('caffecampari.milano', 'Caffè Campari', 'Café opened by Gaspare Campari in 1867 at the entrance of the new Galleria Vittorio Emanuele II, facing Piazza del Duomo. His son Davide opened the Camparino opposite it in 1915.', NULL, 'Galleria Vittorio Emanuele II', NULL, NULL, 'Milan', NULL, 'IT', 45.4654, 9.1897, true, NULL),
    ('caffecasoni.firenze', 'Caffè Casoni', 'Florence café at the corner of Via de'' Tornabuoni and Via della Spada, traditionally named as where the Negroni was first mixed around 1919. It later became Caffè Giacosa, which closed in 2017.', NULL, 'Via de'' Tornabuoni', 'Via de'' Tornabuoni at Via della Spada', NULL, 'Florence', NULL, 'IT', 43.7718, 11.2507, true, 2017),
    ('calgaryinn', 'Calgary Inn', 'Downtown Calgary hotel on 4th Avenue SW built in the mid-1960s, now The Westin Calgary. Food and beverage manager Walter Chell created the Caesar there in 1969.', 'https://www.marriott.com/en-us/hotels/yycwi-the-westin-calgary/overview/', NULL, '320 4 Avenue SW', 'T2P 2S6', 'Calgary', 'AB', 'CA', 51.0494, -114.0681, false, NULL),
    ('caribehilton', 'Caribe Hilton', 'San Juan resort hotel opened in 1949. It claims the Piña Colada, created by bartender Ramón ''Monchito'' Marrero and first served in 1954. Closed after Hurricane Maria in 2017 and reopened in 2019.', 'https://www.caribehilton.com', 'Puerta de Tierra', '1 San Gerónimo Street', '00901', 'San Juan', 'PR', 'PR', 18.4639, -66.085, false, NULL),
    ('caucusclub.detroit', 'Caucus Club', 'Downtown Detroit restaurant and bar in the Penobscot Building, opened in 1952 as an offshoot of the London Chop House. It closed in 2012 and reopened under new ownership in 2017.', 'https://caucusclubdetroit.com', 'Downtown', '150 West Congress Street', NULL, 'Detroit', 'MI', 'US', 42.3299, -83.0472, false, NULL),
    ('cirosclub.london', 'Ciro''s Club', 'Private nightclub on Orange Street behind the National Gallery, opened in May 1915. Lost its licence in 1916 and reopened after the war, when Harry MacElhone tended bar there.', NULL, 'Leicester Square', 'Orange Street', NULL, 'London', NULL, 'GB', NULL, NULL, true, NULL),
    ('clubdeportivopotosino', 'Club Deportivo Potosino', 'Private sports club in San Luis Potosí founded in 1940, the city''s oldest. Commonly named as the birthplace of the Michelada, after member Michel Ésper''s beer with lime and salt.', 'http://tudepor.com/', NULL, NULL, NULL, 'San Luis Potosí', 'SLP', 'MX', NULL, NULL, false, NULL),
    ('cocknbull.la', 'Cock ''n'' Bull', 'English-style pub and restaurant on the Sunset Strip opened in October 1937 by brothers Jack and Percy Morgan. Birthplace of the Moscow Mule. Closed in 1987.', NULL, 'Sunset Strip', '9170 Sunset Boulevard', NULL, 'West Hollywood', 'CA', 'US', 34.0905, -118.3894, true, 1987),
    ('detroitathleticclub', 'Detroit Athletic Club', 'Private Detroit club founded in 1887, in a clubhouse by Albert Kahn completed in 1915. The Last Word appears on its 1916 menu.', 'https://www.thedac.com', 'Downtown', '241 Madison Street', '48226', 'Detroit', 'MI', 'US', 42.3375, -83.0474, false, NULL),
    ('donna.brooklyn', 'Donna', 'Williamsburg cocktail bar near the waterfront known for tropical and frozen drinks, with Jeremy Oertel as beverage director. It opened in 2012 and closed in 2020 after eight years.', NULL, 'Williamsburg', NULL, NULL, 'New York', 'NY', 'US', NULL, NULL, true, 2020),
    ('donthebeachcomber.hwood', 'Don the Beachcomber', 'The first tiki bar, opened by Donn Beach in Hollywood in 1933 at 1722 North McCadden Place. It moved across the street to 1727 and grew into a restaurant. The original closed in 1985.', NULL, 'Hollywood', '1727 North McCadden Place', NULL, 'Los Angeles', 'CA', 'US', 34.1022, -118.3378, true, 1985),
    ('dram.brooklyn', 'Dram', 'Williamsburg cocktail bar opened in spring 2010 by Tom Chadwick in the former Chickenbone Café space on South 4th Street. Now closed.', NULL, 'Williamsburg', '177 South 4th Street', '11211', 'New York', 'NY', 'US', 40.7111, -73.96, true, NULL),
    ('drink.boston', 'Drink', 'Subterranean Fort Point cocktail bar from Barbara Lynch, opened in 2008 with John Gertsen, known for drinks built to each guest''s taste and no printed menu. Closed in early 2024.', NULL, 'Fort Point', 'Congress Street', NULL, 'Boston', 'MA', 'US', NULL, NULL, true, 2024),
    ('eldorado.sf', 'El Dorado', 'Gold Rush gambling hall and saloon on Portsmouth Square, first built in 1849 and rebuilt several times after fires. A young Jerry Thomas tended bar there.', NULL, 'Portsmouth Square', NULL, NULL, 'San Francisco', 'CA', 'US', NULL, NULL, true, NULL),
    ('embassyclub.london', 'Embassy Club', 'Members-only dancing club in London opened around 1920, where Robert Vermeire ran the bar and wrote Cocktails: How to Mix Them (1922). Long closed.', NULL, NULL, NULL, NULL, 'London', NULL, 'GB', NULL, NULL, true, NULL),
    ('excelsior.rome', 'Hotel Excelsior', 'Grand hotel on Via Veneto that opened in January 1906, now The Westin Excelsior Rome. A fixture of the Dolce Vita era.', 'https://www.marriott.com/en-us/hotels/romwi-the-westin-excelsior-rome/overview/', 'Ludovisi', 'Via Vittorio Veneto 125', '00187', 'Rome', NULL, 'IT', 41.9076, 12.489, false, NULL),
    ('fairmontbanffsprings', 'Fairmont Banff Springs', 'Railway hotel opened by the Canadian Pacific Railway in 1888 in Banff National Park, now run by Fairmont.', 'https://www.fairmont.com/banff-springs/', NULL, '405 Spray Avenue', 'T1L 1J4', 'Banff', 'AB', 'CA', 51.1644, -115.5619, false, NULL),
    ('flamingobar.london', 'The Flamingo', 'London bar where Dick Bradsell worked in the late 1990s and created the Treacle.', NULL, NULL, NULL, NULL, 'London', NULL, 'GB', NULL, NULL, true, NULL),
    ('flatironlounge', 'Flatiron Lounge', 'Cocktail bar on West 19th Street opened in May 2003 by Julie Reiner, an early force in New York''s craft cocktail revival. It closed in December 2018 after a rent increase.', NULL, 'Flatiron', '37 West 19th Street', '10011', 'New York', 'NY', 'US', 40.7397, -73.9925, true, 2018),
    ('foynes.terminal', 'Foynes Flying Boat Terminal', 'Restaurant and bar of the transatlantic flying-boat base at Foynes on the Shannon estuary, where chef Joe Sheridan served the first Irish Coffee in the 1940s. The site is now the Foynes Flying Boat Museum.', NULL, NULL, NULL, NULL, 'Foynes', 'Limerick', 'IE', 52.6118, -9.1076, true, 1945),
    ('fredsclub.london', 'Fred''s Club', 'Soho members'' bar where Dick Bradsell worked in the 1980s and created the Bramble around 1984.', NULL, 'Soho', NULL, NULL, 'London', NULL, 'GB', NULL, NULL, true, NULL),
    ('harrysbar.venezia', 'Harry''s Bar', 'Venice bar and restaurant opened in 1931 by Giuseppe Cipriani near Piazza San Marco. Birthplace of the Bellini and of carpaccio, and an Italian national landmark since 2001.', 'https://www.cipriani.com/eu/harrys-bar', 'San Marco', 'Calle Vallaresso 1323', '30124', 'Venice', NULL, 'IT', 45.4325, 12.3372, false, NULL),
    ('henryafricas.sf', 'Henry Africa''s', 'San Francisco bar opened in 1969 by Norman Jay Hobday, credited as the first fern bar. It later settled at Van Ness Avenue and Vallejo Street and closed in 1986.', NULL, 'Russian Hill', NULL, NULL, 'San Francisco', 'CA', 'US', NULL, NULL, true, 1986),
    ('hiltonhawaiianvillage', 'Hilton Hawaiian Village', 'Waikiki resort opened in 1955 as Henry Kaiser''s Hawaiian Village Hotel and run by Hilton since 1961. Head bartender Harry Yee created the Blue Hawaii there in 1957.', 'https://www.hiltonhawaiianvillage.com', 'Waikiki', '2005 Kalia Road', '96815', 'Honolulu', 'HI', 'US', 21.2827, -157.8374, false, NULL),
    ('hotelmetropole.nyc', 'Hotel Metropole', 'Times Square area hotel near Broadway and 43rd Street, known for its all-night café and gambling crowd. Its house cocktail appeared in print in 1895. It went bankrupt after the 1912 Rosenthal murder outside.', NULL, 'Times Square', NULL, NULL, 'New York', 'NY', 'US', NULL, NULL, true, NULL),
    ('hotelmonteleone', 'Hotel Monteleone', 'French Quarter hotel on Royal Street run by the Monteleone family since 1886. Its Carousel Bar dates from 1949; head bartender Walter Bergeron created the Vieux Carré in 1937.', 'https://www.hotelmonteleone.com', 'French Quarter', '214 Royal Street', '70130', 'New Orleans', 'LA', 'US', 29.9542, -90.0682, false, NULL),
    ('hotelnacional.cuba', 'Hotel Nacional de Cuba', 'Havana landmark hotel in Vedado overlooking the Malecón, opened on 30 December 1930.', 'https://www.hotelnacionaldecuba.com', 'Vedado', 'Calle 21 y O', NULL, 'Havana', NULL, 'CU', 23.1431, -82.3806, false, NULL),
    ('hotelwallick.nyc', 'Hotel Wallick', 'Times Square hotel at Broadway and 43rd Street, the former Barrett House renamed by the Wallick brothers in the 1910s, where Hugo Ensslin tended bar. Later the Cadillac Hotel, it closed in 1939 and was razed.', NULL, 'Times Square', 'Broadway at West 43rd Street', NULL, 'New York', 'NY', 'US', 40.7566, -73.9863, true, 1939),
    ('hubers.pdx', 'Huber''s', 'Portland''s oldest restaurant, founded in 1879 as The Bureau Saloon and now in the Pioneer Building on SW 3rd Avenue. Known for tableside Spanish Coffee, introduced by Jim Louie in 1975.', 'https://www.hubers.com', 'Downtown', '411 SW 3rd Avenue', '97204', 'Portland', 'OR', 'US', 45.5196, -122.6746, false, NULL),
    ('imperialcabinet.nola', 'Imperial Cabinet Saloon', 'Saloon at Carondelet and Gravier Streets run by Henry C. Ramos from 1887, where he made his gin fizz famous before moving to the Stag in 1907.', NULL, 'Central Business District', 'Carondelet Street at Gravier Street', NULL, 'New Orleans', 'LA', 'US', 29.9516, -90.071, true, NULL),
    ('jerrythomas.broadway', 'Jerry Thomas'' bar (Broadway)', 'Jerry Thomas''s best-known saloon, opened in 1866 on Broadway between 21st and 22nd Streets in Manhattan. He later had to sell it.', NULL, NULL, NULL, NULL, 'New York', 'NY', 'US', NULL, NULL, true, NULL),
    ('jewelofthesouth.1855', 'Jewel of the South (Santini''s)', 'Joseph Santini''s coffee house and bar on Gravier Street opposite the St. Charles Hotel, open from about 1855 and among the city''s fanciest. Santini handed it over in 1869.', NULL, 'Central Business District', 'Gravier Street', NULL, 'New Orleans', 'LA', 'US', NULL, NULL, true, NULL),
    ('kahiki.columbus', 'The Kahiki', 'Tiki supper club on East Broad Street opened in 1961 by Bill Sapp and Lee Henry, one of the grandest Polynesian restaurants in the US. Closed in 2000 and demolished.', NULL, NULL, '3583 E. Broad Street', NULL, 'Columbus', 'OH', 'US', 39.9725, -82.904722, true, 2000),
    ('kingcolebar', 'King Cole Bar', 'Bar of the St. Regis hotel on East 55th Street, which opened in 1904. Named for the Maxfield Parrish ''Old King Cole'' mural hung there in the 1930s. Bartender Fernand Petiot, at the hotel from 1934, is credited with its Red Snapper.', 'https://www.kingcolebar.com', 'Midtown', '2 East 55th Street', '10022', 'New York', 'NY', 'US', 40.7614, -73.9747, false, NULL),
    ('lalouisiane.nola', 'La Louisiane', 'French Creole restaurant on Iberville Street opened in 1881 by Louis and Ann Bezaudun and made famous by Fernand Alciatore. Its house cocktail was named for it. It changed hands many times and has closed for good.', NULL, 'French Quarter', '725 Iberville Street', NULL, 'New Orleans', 'LA', 'US', NULL, NULL, true, NULL),
    ('lanikai.nyc', 'Lani Kai', 'Hawaiian-inspired cocktail lounge and restaurant on Broome Street in SoHo, opened by Julie Reiner in October 2010. It closed in September 2012.', NULL, 'SoHo', 'Broome Street', NULL, 'New York', 'NY', 'US', NULL, NULL, true, 2012),
    ('lastword.livermore', 'The Last Word', 'Cocktail bar in Livermore, California.', NULL, NULL, NULL, NULL, 'Livermore', 'CA', 'US', NULL, NULL, false, NULL),
    ('latitude29nola', 'Latitude 29', 'Tiki bar and restaurant in the French Quarter of New Orleans opened in 2014 by tiki historian Jeff ''Beachbum'' Berry and Annene Kaye, serving vintage and original tropical drinks.', 'https://www.latitude29nola.com/', 'French Quarter', '321 N. Peters Street', '70130', 'New Orleans', 'LA', 'US', NULL, NULL, false, NULL),
    ('lechevalpie.paris', 'Le Cheval Pie', 'Paris restaurant whose bartender, known only as Charlie, is credited in the 1929 book Cocktails de Paris with the Lucien Gaudin.', NULL, NULL, NULL, NULL, 'Paris', NULL, 'FR', NULL, NULL, false, NULL),
    ('libation.nyc', 'Libation', 'Large multi-level bar and lounge at 137 Ludlow Street on the Lower East Side, whose cocktail menu was designed by George Delgado. Now closed.', NULL, 'Lower East Side', '137 Ludlow Street', '10002', 'New York', 'NY', 'US', 40.7203, -73.988, true, NULL),
    ('librarybar.lanesborough', 'Library Bar, The Lanesborough', 'Bar of The Lanesborough hotel at Hyde Park Corner, where Salvatore Calabrese created the Breakfast Martini in the 1990s.', NULL, 'Knightsbridge', NULL, NULL, 'London', NULL, 'GB', NULL, NULL, false, NULL),
    ('limmers.london', 'Limmer''s Hotel', 'Coffee house and hotel at Conduit Street and George Street in Mayfair, a haunt of the sporting crowd in the early 1800s. Its head waiter John Collins lent his name to the gin punch. The old house closed in 1876.', NULL, 'Mayfair', 'Conduit Street at George Street', NULL, 'London', NULL, 'GB', NULL, NULL, true, 1876),
    ('littlebranch.nyc', 'Little Branch', 'West Village basement cocktail bar opened in 2005 by Sasha Petraske and Joseph Schwartz.', NULL, 'West Village', NULL, NULL, 'New York', 'NY', 'US', NULL, NULL, false, NULL),
    ('lockeober.boston', 'Locke-Ober', 'Downtown Boston restaurant and bar on Winter Place, dating to about 1875. Long a political and business hangout, it is tied to the Ward 8 cocktail. Closed in 2012.', NULL, 'Downtown Crossing', '2 Winter Place', NULL, 'Boston', 'MA', 'US', 42.3554833, -71.0615028, true, 2012),
    ('lolas.weho', 'Lola''s', 'Martini bar and restaurant on North Fairfax Avenue in West Hollywood, opened in 1996. A bartender named Adam is credited with the apple martini there, first called the Adam''s Apple Martini. Closed in 2013 after 17 years.', NULL, NULL, '945 N. Fairfax Avenue', NULL, 'West Hollywood', 'CA', 'US', NULL, NULL, true, 2013),
    ('louis649.nyc', 'Louis 649', 'East Village lounge on East Ninth Street near Avenue C, opened in 2000 and known for free live jazz and later a serious cocktail list. Closed in fall 2014; the space reopened as the cocktail bar Mace.', NULL, 'East Village', '649 East 9th Street', NULL, 'New York', 'NY', 'US', NULL, NULL, true, 2014),
    ('marianos.dallas', 'Mariano''s Mexican Cuisine', 'Tex-Mex restaurant Mariano Martinez opened in 1971 in the Old Town shopping center on Greenville Avenue, where he built the first frozen margarita machine. After about 35 years it moved to Skillman Street and now trades as Mariano''s Hacienda.', NULL, 'Lake Highlands', '6300 Skillman Street', NULL, 'Dallas', 'TX', 'US', NULL, NULL, false, NULL),
    ('matchbar.london', 'Match Bar', 'Cocktail bar near Oxford Circus on Margaret Street, the West End sibling of Jonathan Downey''s Match EC1 (1997). It opened around 1999 and was a key stop in London''s late-1990s cocktail revival; Vincenzo Errico created the Enzoni there around 2001.', NULL, 'Fitzrovia', '37-38 Margaret Street', 'W1G 0JF', 'London', NULL, 'GB', NULL, NULL, false, NULL),
    ('mayahuel.nyc', 'Mayahuel', 'Agave-focused cocktail bar on East Sixth Street opened in 2009 by Phil Ward and Ravi DeRossi, an early champion of mezcal and tequila cocktails in New York. Closed in August 2017 when its lease ended.', NULL, 'East Village', '304 East 6th Street', NULL, 'New York', 'NY', 'US', NULL, NULL, true, 2017),
    ('metropole.brussels', 'Hotel Métropole', 'Brussels grand hotel on Place de Brouckère opened in 1895. Its barman Gustave Tops created the Black Russian there in 1949. Closed in 2020 and sold in 2022, with reopening planned.', NULL, 'Place de Brouckère', 'Place de Brouckère 31', '1000', 'Brussels', NULL, 'BE', 50.8514, 4.3536, true, 2020),
    ('miettas.melbourne', 'Mietta''s', 'Melbourne restaurant founded in 1974 by Mietta O''Donnell and Tony Knox on Brunswick Street, Fitzroy North. Jean-Paul Bourguignon created the Japanese Slipper there in 1984. It moved to Alfred Place in the city centre in 1985 and closed in 1995.', NULL, 'Fitzroy North', 'Brunswick Street', NULL, 'Melbourne', 'VIC', 'AU', NULL, NULL, true, 1995),
    ('milkandhoney.nyc', 'Milk & Honey', 'Sasha Petraske''s reservation-only bar on Eldridge Street, opened on New Year''s Eve 1999, set the template for the modern craft cocktail bar. It moved to East 23rd Street in 2012 or 2013, handing the old room to Attaboy, and closed in October 2014.', NULL, 'Lower East Side', '134 Eldridge Street', NULL, 'New York', 'NY', 'US', NULL, NULL, true, 2014),
    ('moana.surfrider', 'Moana Hotel', 'Waikiki''s first large hotel, opened on Kalakaua Avenue in 1901. Now the Moana Surfrider, a Westin resort, and still operating.', NULL, 'Waikiki', '2365 Kalakaua Avenue', NULL, 'Honolulu', 'HI', 'US', 21.2765, -157.826639, false, NULL),
    ('morrisbar.lima', 'Morris'' Bar', 'Saloon in central Lima opened in 1916 by American bartender Victor Vaughen Morris, who is credited with the pisco sour. Popular with foreigners and Lima society, it closed in 1929.', NULL, 'Centro de Lima', 'Calle Boza 836', NULL, 'Lima', NULL, 'PE', NULL, NULL, true, 1929),
    ('murraybros.newark', 'Murray Brothers'' Café', 'Newark, New Jersey cafe where bartender Joseph Rose worked when his Coronation cocktail placed in the 1903 Police Gazette contest. Long closed.', NULL, NULL, '184 Market Street', NULL, 'Newark', 'NJ', 'US', NULL, NULL, true, NULL),
    ('no9park.boston', 'No. 9 Park', 'Barbara Lynch''s flagship restaurant on Park Street facing Boston Common, opened in 1998. Its bar, led by John Gertsen in the 2000s, was central to Boston''s cocktail revival. Closed at the end of 2024.', NULL, 'Beacon Hill', '9 Park Street', NULL, 'Boston', 'MA', 'US', NULL, NULL, true, 2024),
    ('oakbeachinn', 'Oak Beach Inn', 'Waterfront inn on the barrier beach at Oak Beach, built in 1935 and turned into a huge nightclub by Robert Matherson from 1969. Robert ''Rosebud'' Butt says he created the Long Island Iced Tea there in 1972. Sold in 1999 and torn down in 2003.', NULL, 'Oak Beach', '1 Oak Beach Road', NULL, 'Oak Beach', 'NY', 'US', 40.6394667, -73.2872444, true, NULL),
    ('oldabsinthehouse', 'Old Absinthe House', 'Bourbon Street bar in a building completed around 1806, serving drinks since the 19th century. Cayetano Ferrer took over in the 1870s and built its reputation for the absinthe frappe. Still open.', 'https://www.oldabsinthehouse.com', 'French Quarter', '240 Bourbon Street', NULL, 'New Orleans', 'LA', 'US', 29.955358, -90.068434, false, NULL),
    ('oldkingbar.miami', 'Old King Bar', 'Miami bar where bartender Raimundo Alvarez is credited with the Golden Dream, an after-dinner drink popular in the 1960s and 1970s.', NULL, NULL, NULL, NULL, 'Miami', 'FL', 'US', NULL, NULL, false, NULL),
    ('parsons.chicago', 'Parson''s Chicken & Fish', 'Fried chicken and fish spot with a big patio in Logan Square, opened in spring 2013 by the Longman & Eagle team. Its frozen Negroni slushy became a citywide hit that summer. Still open, with more locations since.', NULL, 'Logan Square', '2952 W. Armitage Avenue', NULL, 'Chicago', 'IL', 'US', NULL, NULL, false, NULL),
    ('patobriens', 'Pat O''Brien''s', 'French Quarter bar that began as a Prohibition speakeasy and became a legal bar in 1933, moving to St. Peter Street in 1942. Its bartenders made the Hurricane in the 1940s to use up surplus rum. Still family-run.', 'https://www.patobriens.com', 'French Quarter', '718 St. Peter Street', NULL, 'New Orleans', 'LA', 'US', 29.9581, -90.0655, false, NULL),
    ('pegu.club.nyc', 'Pegu Club', 'Second-floor cocktail bar on West Houston Street in SoHo, opened in 2005 by Audrey Saunders with Julie Reiner. Named for the Rangoon club, it trained a generation of New York bartenders. Closed in 2020.', NULL, 'SoHo', '77 West Houston Street', NULL, 'New York', 'NY', 'US', 40.726536, -73.999554, true, 2020),
    ('pegu.club.yangon', 'Pegu Club, Rangoon', 'British gentlemen''s club in Rangoon (now Yangon), founded in 1871, in a teak clubhouse on Pyay Road from 1882. It gave its name to the Pegu Club cocktail of the 1920s. It ceased as a club during the 1942 Japanese occupation; the building has since been restored.', NULL, NULL, 'Corner of Pyay, Zagawar and Padonmar Roads', NULL, 'Yangon', NULL, 'MM', 16.786964, 96.142908, true, 1942),
    ('plantershouse', 'Planter''s House', 'Lafayette Square cocktail bar co-owned by Ted Kilgore, named after the hotel where Jerry Thomas once worked.', NULL, 'Lafayette Square', NULL, NULL, 'St. Louis', 'MO', 'US', NULL, NULL, false, NULL),
    ('politeprovisions', 'Polite Provisions', 'Cocktail bar styled after an old drugstore soda fountain, at Adams Avenue and 30th Street, opened in 2013 by Consortium Holdings with Erick Castro as partner and head bartender. Known for house syrups and sodas. Still open.', NULL, 'Normal Heights', '4696 30th Street', NULL, 'San Diego', 'CA', 'US', NULL, NULL, false, NULL),
    ('poorreds', 'Poor Red''s Bar-B-Q', 'Roadside barbecue bar in El Dorado, in an 1850s building that was a bar from the late 1920s. Run as Poor Red''s from 1948, it is the home of the Golden Cadillac (1952) and was once the largest Galliano customer in North America. Still open.', NULL, NULL, NULL, NULL, 'El Dorado', 'CA', 'US', NULL, NULL, false, NULL),
    ('prizefighter.emeryville', 'Prizefighter', 'Cocktail bar in Emeryville opened in 2011 in the former Kitty''s space by Jon Santer, who ran it until 2022.', NULL, NULL, '6702 Hollis Street', NULL, 'Emeryville', 'CA', 'US', NULL, NULL, false, NULL),
    ('queensparkhotel.tt', 'Queen''s Park Hotel', 'Grand hotel facing the Queen''s Park Savannah in Port of Spain, opened in January 1895. Its bar gave its name to the Queen''s Park Swizzle, popularised in the 1930s. Demolished in 1996.', NULL, NULL, NULL, NULL, 'Port of Spain', NULL, 'TT', NULL, NULL, true, 1996),
    ('rainbowroom.nyc', 'Rainbow Room', 'Supper club on the 65th floor of 30 Rockefeller Plaza, opened in 1934. Dale DeGroff ran its bar from the 1987 reopening into the 1990s, reviving classic cocktails. Now used mainly for private events.', 'https://www.rainbowroom.com', 'Midtown', '30 Rockefeller Plaza, 65th floor', '10112', 'New York', 'NY', 'US', 40.759, -73.979, false, NULL),
    ('ranch616', 'Ranch 616', 'South Texas-themed restaurant and bar at West Sixth and Nueces, opened by Kevin Williamson in 1999 and known as the home of Ranch Water. Run by his friends since his death in 2021.', NULL, 'Downtown', '616 Nueces Street', '78701', 'Austin', 'TX', 'US', NULL, NULL, false, NULL),
    ('range.sf', 'Range', 'Mission District restaurant on Valencia Street run by Phil and Cameron West, opened around 2005 and known for its cocktail bar, where Dominic Venegas created the 1794. Closed at the end of 2016 after nearly 12 years.', NULL, 'Mission District', '842 Valencia Street', NULL, 'San Francisco', 'CA', 'US', NULL, NULL, true, 2016),
    ('rickhouse.sf', 'Rickhouse', 'Two-level whiskey saloon on Kearny Street from the Bourbon & Branch team, opened in 2009 and known for bourbon and punch bowls. Still open.', NULL, 'Financial District', '246 Kearny Street', NULL, 'San Francisco', 'CA', 'US', NULL, NULL, false, NULL),
    ('ritzbar.paris', 'Ritz Bar, Hôtel Ritz Paris', 'Bar on the Rue Cambon side of the Hôtel Ritz, which opened on Place Vendôme in 1898. Frank Meier was its head barman from 1921 until 1947.', 'https://www.ritzparis.com', 'Place Vendôme', '15 Place Vendôme', '75001', 'Paris', NULL, 'FR', 48.8678, 2.3286, false, NULL),
    ('ritzparis', 'Ritz Paris', 'Hotel on Place Vendome opened in 1898 by Cesar Ritz. Frank Meier led its bar from 1921 until 1947, a period that gave the bar its fame and, by tradition, the Mimosa. Still open.', 'https://www.ritzparis.com', '1st arrondissement', '15 Place Vendome', '75001', 'Paris', NULL, 'FR', 48.86778, 2.32861, false, NULL),
    ('royalhawaiian', 'Royal Hawaiian Hotel', 'The ''Pink Palace'' on Waikiki Beach, opened on Kalakaua Avenue in 1927. Its beachfront Mai Tai Bar serves the Trader Vic recipe introduced there in the 1950s. Still open.', NULL, 'Waikiki', '2259 Kalakaua Avenue', NULL, 'Honolulu', 'HI', 'US', 21.2775, -157.82889, false, NULL),
    ('rumpoint.wreckbar', 'Wreck Bar at Rum Point', 'Beach bar at the Rum Point Club on Grand Cayman''s North Side, which claims the Mudslide, said to have been improvised by bartender Old Judd in the 1970s when cream ran out. Still open.', NULL, 'Rum Point', NULL, NULL, 'North Side', NULL, 'KY', NULL, NULL, false, NULL),
    ('rye.sf', 'Rye', 'Cocktail bar on Geary Street near Union Square, opened in 2006 by Greg Lindgren and Jon Gasparini. Known for its basil gimlet. Celebrated 20 years in 2026.', NULL, 'Tenderloin', '688 Geary Street', NULL, 'San Francisco', 'CA', 'US', NULL, NULL, false, NULL),
    ('sanzeno.naturns', 'San Zeno Bar', 'Wine and cocktail bar in Naturns (Naturno), South Tyrol, where bartender Roland Gruber created the Hugo in 2005 as a lighter alternative to the Spritz.', NULL, NULL, NULL, NULL, 'Naturns', 'Trentino-South Tyrol', 'IT', NULL, NULL, false, NULL),
    ('sazerac.coffeehouse', 'Sazerac Coffee House', 'New Orleans bar on Exchange Alley, renamed the Sazerac Coffee House around 1850 by Aaron Bird after the cognac Sewell Taylor imported. Thomas Handy ran it from about 1870, when the Sazerac shifted to rye whiskey.', NULL, 'French Quarter', 'Exchange Alley', NULL, 'New Orleans', 'LA', 'US', NULL, NULL, true, NULL),
    ('schuylkill.fishing', 'State in Schuylkill', 'Private fishing and social club founded in 1732 on the Schuylkill River, now the Schuylkill Fishing Company. Fish House Punch is credited to its Castle clubhouse. Since 1944 it has been based at Andalusia on the Delaware.', NULL, 'Andalusia', NULL, NULL, 'Andalusia', 'PA', 'US', 40.0621028, -74.9664861, false, NULL),
    ('seelbachhilton', 'The Seelbach', 'Downtown Louisville hotel opened in 1905 by Otto and Louis Seelbach, now the Seelbach Hilton. Adam Seger created the Seelbach cocktail there in 1995. Still open.', 'https://www.seelbachhilton.com', 'Downtown', '500 South 4th Street', '40202', 'Louisville', 'KY', 'US', 38.25083, -85.75806, false, NULL),
    ('shepheards.cairo', 'Shepheard''s Hotel', 'Cairo''s landmark hotel facing the Azbakeya Gardens, opened in 1841. Its Long Bar was a wartime haunt of Allied officers, and barman Joe Scialom created the Suffering Bastard there. Burned down in the Cairo Fire of 1952.', NULL, 'Azbakeya', NULL, NULL, 'Cairo', NULL, 'EG', 30.054158, 31.246499, true, 1952),
    ('shipsstore.stthomas', 'Ship''s Store & Sapphire Pub', 'Bar and deli in the Sapphire Village marina complex on St. Thomas, where bartender Angie Conigliaro and manager Tom Brokamp created the Bushwacker in spring 1975.', NULL, 'Sapphire Village', NULL, NULL, 'St. Thomas', NULL, 'VI', NULL, NULL, false, NULL),
    ('shoomakers.dc', 'Shoomaker''s', 'Pennsylvania Avenue saloon popular with politicians and journalists. Lobbyist Joe Rickey bought it around 1883, and head barkeeper George Williamson made the first Rickeys there. The JW Marriott now stands on the site.', NULL, 'Penn Quarter', 'Pennsylvania Avenue NW', NULL, 'Washington', 'DC', 'US', NULL, NULL, true, NULL),
    ('soggydollarbar', 'Soggy Dollar Bar', 'Beach bar at the Sandcastle on White Bay, Jost Van Dyke, opened around 1970. Sailors swim ashore and pay with wet bills, hence the name. Home of the Painkiller. Rebuilt after Hurricane Irma in 2017.', 'https://www.soggydollar.com', 'White Bay', NULL, NULL, 'Jost Van Dyke', NULL, 'VG', NULL, NULL, false, NULL),
    ('sohobrasserie.london', 'Soho Brasserie', 'Brasserie on Old Compton Street, Soho, where Dick Bradsell first served his vodka espresso, the drink later known as the Espresso Martini, in the early to mid 1980s. The site later became Bar Soho.', NULL, 'Soho', '23-25 Old Compton Street', NULL, 'London', NULL, 'GB', NULL, NULL, true, NULL),
    ('sohohouse.weho', 'Soho House West Hollywood', 'Members'' club on the top floors of a Sunset Boulevard tower, opened in 2010. Its bar created the Picante de la Casa, the house spicy margarita. Still open.', 'https://www.sohohouse.com', 'West Hollywood', '9200 Sunset Boulevard', NULL, 'West Hollywood', 'CA', 'US', NULL, NULL, false, NULL),
    ('starlightroom.sf', 'Harry Denton''s Starlight Room', 'Rooftop lounge on the 21st floor of the Sir Francis Drake Hotel, relaunched under Harry Denton''s name in 1996. It closed in early 2020; the room reopened as Starlite in 2024.', NULL, 'Union Square', '450 Powell Street', '94102', 'San Francisco', 'CA', 'US', 37.7889, -122.4087, true, 2020),
    ('storkclub.nyc', 'Stork Club', 'Sherman Billingsley''s nightclub, opened in 1929 and at 3 East 53rd Street from 1934, the society and celebrity hub of mid-century New York. Closed in 1965; Paley Park is on the site.', NULL, 'Midtown', '3 East 53rd Street', NULL, 'New York', 'NY', 'US', 40.76028, -73.97528, true, 1965),
    ('swizzleinn', 'Swizzle Inn', 'Pub in Bailey''s Bay, Hamilton Parish, opened in 1932, which calls itself the home of the Bermuda rum swizzle. Walls covered in visitors'' business cards. Still family-run.', NULL, 'Bailey''s Bay', NULL, NULL, 'Hamilton Parish', NULL, 'BM', NULL, NULL, false, NULL),
    ('taste.stl', 'Taste', 'Gerard Craft''s cocktail bar, opened in 2009 in Benton Park with Ted Kilgore running drinks, and moved to the Central West End in 2011. A key bar in St. Louis''s cocktail revival. Closed in October 2021.', NULL, 'Central West End', NULL, NULL, 'St. Louis', 'MO', 'US', NULL, NULL, true, 2021),
    ('tastebyniche', 'Taste by Niche', 'St. Louis cocktail bar from the Niche restaurant group, where Ted Kilgore created the Industry Sour in 2011.', NULL, NULL, NULL, NULL, 'St. Louis', 'MO', 'US', NULL, NULL, false, NULL),
    ('thebeagle.nyc', 'The Beagle', 'Craft cocktail bar and restaurant on Avenue A between 10th and 11th Streets, opened in May 2011. Closed in November 2013 after the owners sold the building.', NULL, 'East Village', '162 Avenue A', NULL, 'New York', 'NY', 'US', NULL, NULL, true, 2013),
    ('thelanesborough', 'The Lanesborough', 'Hotel at Hyde Park Corner opened in 1991 in a former hospital building. Salvatore Calabrese ran its Library Bar in the 1990s, where he created the Breakfast Martini. Now part of the Oetker Collection.', 'https://www.oetkercollection.com/hotels/the-lanesborough/', 'Knightsbridge', 'Hyde Park Corner', 'SW1X 7TA', 'London', NULL, 'GB', 51.5025, -0.1525, false, NULL),
    ('theluau.beverlyhills', 'The Luau', 'Polynesian restaurant on North Rodeo Drive that former actor Steve Crane opened in 1953 in the old Tropics space. A Hollywood favourite for decades, it was sold in 1978 and demolished in 1979.', NULL, NULL, '421 N. Rodeo Drive', NULL, 'Beverly Hills', 'CA', 'US', NULL, NULL, true, 1979),
    ('theodeon.nyc', 'The Odeon', 'Tribeca brasserie opened in 1980 by Keith McNally, Brian McNally and Lynn Wagenknecht in a 1930s cafeteria space. A downtown art-world hangout; Toby Cecchini made his Cosmopolitan there in the late 1980s. Still open.', NULL, 'Tribeca', '145 West Broadway', NULL, 'New York', 'NY', 'US', NULL, NULL, false, NULL),
    ('thetrident.sausalito', 'The Trident', 'Waterfront restaurant and bar on Bridgeway, bought by the Kingston Trio''s manager Frank Werber in 1960 and remade as the Trident in 1966. Bartenders Bobby Lozoff and Billy Rice made the modern Tequila Sunrise there. Closed at the end of 2025.', NULL, NULL, '558 Bridgeway', NULL, 'Sausalito', 'CA', 'US', NULL, NULL, true, 2025),
    ('threedotsandadash', 'Three Dots and a Dash', 'River North tiki bar opened in 2013 with Paul McGee running the bar.', NULL, 'River North', NULL, NULL, 'Chicago', 'IL', 'US', NULL, NULL, false, NULL),
    ('townhouse.emeryville', 'Townhouse Bar & Grill', 'Emeryville bar in a 1926 building that ran as a Prohibition speakeasy and then as Vernetti''s Town House. Now a restaurant, its bar was where Paul Harrington created the Jasmine around 1990. Still open.', NULL, NULL, '5862 Doyle Street', NULL, 'Emeryville', 'CA', 'US', NULL, NULL, false, NULL),
    ('townhouse.knightsbridge', 'Townhouse', 'Cocktail bar on Beauchamp Place in Knightsbridge, opened in 2002 by Douglas Ankrah, with a list of about 80 drinks. Birthplace of the Porn Star Martini. Closed for good in February 2010.', NULL, 'Knightsbridge', 'Beauchamp Place', NULL, 'London', NULL, 'GB', NULL, NULL, true, 2010),
    ('tradervics.oakland', 'Trader Vic''s (Oakland)', 'Victor Bergeron opened Hinky Dink''s in 1934 at San Pablo Avenue and 65th Street in Oakland and soon remade it as Trader Vic''s, birthplace of the Mai Tai (1944). The original closed in 1972 when the flagship moved to Emeryville.', NULL, 'Golden Gate', 'San Pablo Avenue at 65th Street', NULL, 'Oakland', 'CA', 'US', NULL, NULL, true, 1972),
    ('tujagues', 'Tujague''s', 'One of New Orleans'' oldest restaurants, founded on Decatur Street in 1856 by Guillaume and Marie Tujague. Philibert Guichet, a later owner, created the Grasshopper around 1918. Moved to 429 Decatur Street in 2020.', 'https://tujaguesrestaurant.com', 'French Quarter', '429 Decatur Street', NULL, 'New Orleans', 'LA', 'US', NULL, NULL, false, NULL),
    ('turfbar.tijuana', 'Turf Bar', 'Tijuana bar co-owned by Henry Madden that advertised itself in 1935 as the originator of the Tequila Daisy, often linked to the margarita.', NULL, NULL, NULL, NULL, 'Tijuana', 'BC', 'MX', NULL, NULL, false, NULL),
    ('tuxedoclub', 'Tuxedo Club', 'Private country club in Tuxedo Park, New York, founded by Pierre Lorillard IV in 1886. It gave its name to the dinner jacket and to the Tuxedo cocktail. Still active.', 'https://www.thetuxedoclub.org/', 'Tuxedo Park', 'West Lake Road', NULL, 'Tuxedo Park', 'NY', 'US', 41.16306, -74.23417, false, NULL),
    ('vendome.hollywood', 'Cafe Vendome', 'Restaurant and club on Sunset Boulevard opened in 1933 by Hollywood Reporter publisher Billy Wilkerson, a film-industry lunch spot. A bartender there is said to have created the Brown Derby cocktail.', NULL, 'Hollywood', '6666 Sunset Boulevard', NULL, 'Los Angeles', 'CA', 'US', NULL, NULL, true, NULL),
    ('ventadevargas.cordoba', 'Venta de Vargas', 'Roadside inn and flamenco tavern on the road to El Brillante outside Cordoba, where Federico Vargas is said to have mixed red wine with soda in the 1920s, the drink later called tinto de verano.', NULL, 'El Brillante', NULL, NULL, 'Córdoba', NULL, 'ES', NULL, NULL, false, NULL),
    ('waldorf.astoria.1893', 'Waldorf-Astoria', 'The original Waldorf-Astoria hotel on Fifth Avenue, whose bar was a center of New York drinking before Prohibition. Johnny Solon made the Bronx there and John E. O''Connor an early Dirty Martini. The building was demolished in 1929.', NULL, 'Midtown', NULL, NULL, 'New York', 'NY', 'US', NULL, NULL, true, 1929),
    ('waldorfastoria.1893', 'Waldorf-Astoria (Fifth Avenue)', 'The original Waldorf Hotel opened on Fifth Avenue at 33rd Street in 1893 and joined the Astoria next door in 1897. Its bar was the city''s grandest, credited with the Rob Roy and the Bronx. Closed in 1929 for the Empire State Building.', NULL, 'Midtown', 'Fifth Avenue at 33rd-34th Streets', NULL, 'New York', 'NY', 'US', 40.7484, -73.9857, true, 1929)
) AS v("handle", "name", "bio", "website", "locality", "address_line", "postcode", "city", "region", "country_code", "latitude", "longitude", "is_closed", "closed_year")
WHERE NOT EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.handle = v.handle);

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "city")
SELECT 'person', v.handle, v.name, v.bio, v.website, true, v.city
FROM (VALUES
    ('ada.coleman', 'Ada Coleman', 'London bartender who learned the trade at Claridge''s and became head bartender of the American Bar at the Savoy in 1903, holding the post for about 23 years. Known to regulars as Coley, she created the Hanky Panky for the actor Charles Hawtrey. Harry Craddock succeeded her in the mid-1920s.', NULL, 'London'),
    ('adam.seger', 'Adam Seger', 'American bartender and chef. As food and beverage manager at Louisville''s Seelbach Hotel he created the Seelbach cocktail in 1995 and invented a 1912 back story for it, which he admitted in 2016. Later ran the bar at Nacional 27 in Chicago and co-founded Hum botanical spirit.', NULL, 'Chicago'),
    ('adeline.shepherd', 'Adeline Shepherd', 'Bartender who worked with Craig Harper at Oloroso and The Hallion in Edinburgh and at Ruby in Copenhagen, where she finalised the Rapscallion with Talisker.', NULL, 'Copenhagen'),
    ('aldo.delbo', 'Aldo Del Bò', 'Credited in Livigno lore with the Bombardino, a hot drink of egg liqueur and spirit first served around 1972. Accounts describe him as a young manager from Genoa running ski lifts in Livigno who warmed guests with zabaione mixed with whisky.', NULL, 'Livigno'),
    ('angie.conigliaro', 'Angie Conigliaro', 'Bartender at the Ship''s Store in Sapphire Village, St. Thomas, US Virgin Islands, credited with blending the first Bushwacker in spring 1975 as a frozen, coconut and coffee liqueur twist on the White Russian.', NULL, 'St. Thomas'),
    ('bastian.heuser', 'Bastian Heuser', 'German bar professional credited with the Agavoni, a tequila version of the Negroni he formulated in 2008 after a tequila-themed issue of Mixology magazine.', NULL, NULL),
    ('bill.sterritt', 'Bill Sterritt', 'Bartender often named as the creator of the Mamie Taylor, a Scotch, lime and ginger ale highball said to date from 1899 at Ontario Beach near Rochester, New York.', NULL, 'Rochester'),
    ('billy.rice', 'Billy Rice', 'Bartender at the Trident in Sausalito who, with Bobby Lozoff, is credited with the modern Tequila Sunrise in the early 1970s.', NULL, 'Sausalito'),
    ('bobby.lozoff', 'Bobby Lozoff', 'Bartender at the Trident in Sausalito who, with Billy Rice, created the modern Tequila Sunrise of tequila, orange juice and grenadine in the early 1970s; it took off after the Rolling Stones'' 1972 tour party there. Later managed bars in Hawaii.', NULL, 'Sausalito'),
    ('brian.miller', 'Brian Miller', 'New York bartender who was on Pegu Club''s opening team and became head bartender at Death & Co, where he created the Conference. A tiki specialist, he later co-owned and ran the bar at The Polynesian in Midtown, opened in 2018 with Major Food Group.', NULL, 'New York'),
    ('bryant.sharp', 'Bryant Sharp', 'Milwaukee bar owner who bought a former brewery tied house in 1936 and turned it into Bryant''s Cocktail Lounge, the city''s oldest cocktail lounge. Credited with the Pink Squirrel and with drinks for the Bols liqueur company. Died in 1959.', NULL, 'Milwaukee'),
    ('ca.tuck', 'C. A. Tuck', 'British bartender credited with the Twentieth Century, a gin, Lillet, creme de cacao and lemon cocktail named after the New York to Chicago train and first printed in W. J. Tarling''s Cafe Royal Cocktail Book of 1937.', NULL, 'London'),
    ('cayetano.ferrer', 'Cayetano Ferrer', 'New Orleans bartender, previously at the French Opera House, hired at the Old Absinthe House around 1870 and running its bar from about 1873. He is credited with the Absinthe Frappe, served there from 1874.', NULL, 'New Orleans'),
    ('chad.solomon', 'Chad Solomon', 'Bartender at Milk & Honey (2002 to 2007) and Pegu Club (2005 to 2007), credited with popularising the dry shake. Co-founded the Cuffs & Buttons cocktail catering company with Christy Pope in 2006, and with her later opened Midnight Rambler in Dallas.', NULL, 'New York'),
    ('charlotte.voisey', 'Charlotte Voisey', 'British bartender who worked bars in London, Barcelona, Buenos Aires and New York and opened Apartment 195 in London in 2002. Joined William Grant & Sons, rising to lead its global brand ambassador team, and created the Unusual Negroni for Hendrick''s Gin. Named executive director of the Tales of the Cocktail Foundation in 2025.', NULL, 'New York'),
    ('chris.elford', 'Chris Elford', 'Bartender who created the Sharpie Mustache at Amor y Amargo in New York''s East Village around 2011 and also opened the beer bar Proletariat. Moved to Seattle in 2013, where he and his wife Anu Apte opened No Anchor and Navy Strength.', NULL, 'Seattle'),
    ('chris.ojeda', 'Chris Ojeda', 'Bar manager at Soho House West Hollywood who in 2012 created the Picante de la Casa, a simplified spicy tequila sour that became the best-selling cocktail across Soho House clubs worldwide.', NULL, 'Los Angeles'),
    ('constante.gil', 'Constante Gil', 'Galician-born painter who settled in Valencia in 1948 and ran the Cafe Madrid (the former Cerveceria Madrid) in the old town. In 1959 he mixed cava, orange juice, gin and vodka for Basque regulars, creating Agua de Valencia.', NULL, 'Valencia'),
    ('constantino.ribalaigua', 'Constantino Ribalaigua Vert', 'Catalan-born bartender, known as Constante, who started at El Floridita in Havana in 1914 and became its owner in 1918. Famed for fresh-juice rum drinks and credited with popularising the frozen daiquiri in the 1930s, including the version made for Ernest Hemingway.', NULL, 'Havana'),
    ('craig.harper', 'Craig Harper', 'Bartender who first mixed Scotch and PX sherry in Manhattan proportions while at Oloroso in Edinburgh, later refined with a pastis rinse at The Hallion. The drink, the Rapscallion, reached its Talisker form at Ruby in Copenhagen.', NULL, 'Edinburgh'),
    ('crosby.gaige', 'Crosby Gaige', 'Broadway producer of the early twentieth century who turned to food and wine writing after 1929. Published Crosby Gaige''s Cocktail Guide and Ladies'' Companion in 1941, which introduced original drinks including the Fancy Free, and The Standard Cocktail Guide in 1944.', NULL, 'New York'),
    ('damon.dyer', 'Damon Dyer', 'New York bartender who created the Monte Cassino, an equal-parts rye, Benedictine, yellow Chartreuse and lemon drink, at Louis 649 in 2010. It won the Benedictine 500th anniversary cocktail competition.', NULL, 'New York'),
    ('daphne.henderson', 'Daphne Henderson', 'Englishwoman who bought the White Bay beach bar on Jost Van Dyke in 1980 and ran it as the Soggy Dollar Bar. Pusser''s Rum, which trademarked the drink, credits her with the Painkiller.', NULL, 'Jost Van Dyke'),
    ('david.embury', 'David A. Embury', 'New York tax lawyer and amateur mixologist whose 1948 book The Fine Art of Mixing Drinks set out a ratio-based approach to cocktails and remains a key reference for bartenders.', NULL, 'New York'),
    ('dick.bradsell', 'Dick Bradsell', 'London bartender credited with reviving the city''s cocktail scene from the 1980s. Started at the Zanzibar club, then worked at the Soho Brasserie, Fred''s Club, Dick''s Bar at the Atlantic and El Camion''s Pink Chihuahua, training a generation of bartenders. Created the Espresso Martini, Bramble and Russian Spring Punch.', NULL, 'London'),
    ('dominic.venegas', 'Dominic Venegas', 'San Francisco bartender who set up the bar program at Range, where he created the 1794 (rye, sweet vermouth, Campari) in 2004. Later worked at Bourbon & Branch, Cantina and Smuggler''s Cove.', NULL, 'San Francisco'),
    ('donn.beach', 'Donn Beach', 'American restaurateur, born Ernest Raymond Gantt, who opened Don''s Beachcomber in Hollywood in 1933 and is seen as the founder of tiki culture. Created the Zombie, Navy Grog, Three Dots and a Dash and many more. After the war he moved to Hawaii and built the International Market Place in Waikiki.', NULL, 'Hollywood'),
    ('douglas.ankrah', 'Douglas Ankrah', 'London bartender and bar owner behind LAB bar in Soho. Created the Porn Star Martini in 2002 at Townhouse in London. Died in 2021.', NULL, 'London'),
    ('duncan.nicol', 'Duncan Nicol', 'Last owner of the Bank Exchange Saloon in San Francisco, which he took over in 1893 and ran until Prohibition closed it in 1919. Credited with the Pisco Punch, whose recipe he reportedly kept secret.', NULL, 'San Francisco'),
    ('edward.vernon', 'Edward Vernon', 'Royal Navy admiral and Member of Parliament who captured Portobelo in 1739. In 1740 he ordered his sailors'' rum ration diluted with water; the mix took the name grog from his nickname, Old Grog.', NULL, NULL),
    ('eliodoro.gonzalez', 'Eliodoro González P.', 'Venezuelan chemist and perfumer from Caracas who created the commercial Ponche Crema, a bottled egg and rum liqueur, in 1900.', NULL, 'Caracas'),
    ('erick.castro', 'Erick Castro', 'Bartender who worked at Bourbon & Branch and wrote the opening menu of Rickhouse in San Francisco in 2009. Opened Polite Provisions in San Diego in 2013 and Raised by Wolves in 2018. Hosts the Bartender at Large podcast.', NULL, 'San Diego'),
    ('ernest.hemingway', 'Ernest Hemingway', 'American novelist who contributed the Death in the Afternoon, absinthe topped with Champagne, to the 1935 celebrity cocktail book So Red the Nose.', NULL, NULL),
    ('erskine.gwynne', 'Erskine Gwynne', 'American-born writer who founded the Paris monthly Boulevardier (1927 to 1932). A regular at Harry''s New York Bar, he was credited by Harry MacElhone with the bourbon, Campari and vermouth drink named after his magazine.', NULL, 'Paris'),
    ('federico.vargas', 'Federico Vargas', 'Owner of the Venta de Vargas inn on the road to El Brillante in Cordoba, said to have topped his house red wine with soda in the 1920s. The drink, first called a Vargas, became Tinto de Verano.', NULL, 'Córdoba'),
    ('fosco.scarselli', 'Fosco Scarselli', 'Bartender at Caffe Casoni in Florence who, around 1919, swapped the soda in Count Camillo Negroni''s Americano for gin and garnished it with orange, creating the Negroni.', NULL, 'Florence'),
    ('francis.negus', 'Francis Negus', 'English army officer, courtier and Whig MP for Ipswich from 1717 to 1732. He is the reputed inventor of negus, wine diluted with hot water and sugar.', NULL, NULL),
    ('frank.klein', 'Frank Klein', 'Longtime bartender at Poor Red''s in El Dorado, California, credited with the Golden Cadillac (Galliano, white creme de cacao and cream), made around 1952 for a couple celebrating with a new gold Cadillac.', NULL, 'El Dorado, California'),
    ('frank.meier', 'Frank Meier', 'Austrian-born bartender who trained in New York and became the first head bartender of the Ritz in Paris in 1921 and running its bar into the 1940s. Author of The Artistry of Mixing Drinks and credited with the Bee''s Knees.', NULL, 'Paris'),
    ('frank.payne', 'Frank C. Payne', 'New York theatrical press agent, linked to the press agents'' union whose magazine was called The Quill. The 1996 edition of Harry''s ABC of Mixing Cocktails credits the Quill cocktail, a Negroni with absinthe, to him.', NULL, 'New York'),
    ('gaspare.campari', 'Gaspare Campari', 'Italian drinks maker who formulated the Campari bitter in 1860 and ran a cafe facing the Duomo in Milan, where the Milano-Torino of Campari and Turin vermouth was served. Died in 1882.', NULL, 'Milan'),
    ('george.delgado', 'George Delgado', 'New York bartender who wrote the cocktail menu at Libation on the Lower East Side, where he created the Eastside, a Southside with cucumber, in 2004.', NULL, 'New York'),
    ('george.jessel', 'George Jessel', 'American actor, comedian and producer. A December 1939 Lucius Beebe column called a mix of tomato juice and vodka George Jessel''s newest pick-me-up, the Bloody Mary, one of the drink''s earliest mentions.', NULL, 'New York'),
    ('george.myrick', 'George Myrick', 'With his wife Marie, built and ran the beach bar on White Bay, Jost Van Dyke, later known as the Soggy Dollar Bar, from 1970 until 1980. The couple say they devised the Painkiller there in 1971.', NULL, 'Jost Van Dyke'),
    ('george.williamson', 'George Williamson', 'Bartender at Shoomaker''s in Washington, D.C., nicknamed the King of Juleps, often credited with adding lime to Colonel Joe Rickey''s bourbon and soda around 1883, creating the Rickey.', NULL, 'Washington, D.C.'),
    ('giovanni.raimondo', 'Giovanni Raimondo', 'Bartender at the Hotel Excelsior in Rome who created the Cardinale, a dry gin, Riesling and Campari drink, in 1950 during Pope Pius XII''s Jubilee year.', NULL, 'Rome'),
    ('giuseppe.cipriani', 'Giuseppe Cipriani', 'Bartender at the Hotel Europa in Venice who opened Harry''s Bar in Venice in 1931. The bar is the home of the Bellini, created in the late 1940s, and of carpaccio. Died in 1980.', NULL, 'Venice'),
    ('giuseppe.gonzalez', 'Giuseppe Gonzalez', 'New York bartender who created the Trinidad Sour, built on a full measure of Angostura bitters, during a short stint at Clover Club in Brooklyn around 2008. Later owner-bartender of Suffolk Arms on the Lower East Side.', NULL, 'New York'),
    ('greg.lindgren', 'Greg Lindgren', 'San Francisco bar owner behind Rye, where he put a gin Basil Gimlet on the opening menu after his wife, sommelier Shelley Lindgren, tried a vodka version in Boston. Co-founded the catering business Rye on the Road.', NULL, 'San Francisco'),
    ('gustave.tops', 'Gustave Tops', 'Barman at the Hotel Metropole in Brussels, credited with creating the Black Russian in 1949 for Perle Mesta, then US ambassador to Luxembourg.', NULL, 'Brussels'),
    ('hanskarl.adam', 'Hans Karl Adam', 'German television chef who devised Rudesheimer Kaffee, coffee with flamed Asbach brandy and whipped cream, in 1957.', NULL, NULL),
    ('harry.craddock', 'Harry Craddock', 'English bartender who worked in Cleveland and New York hotels before Prohibition, then ran the American Bar at the Savoy in London from 1920. His Savoy Cocktail Book (1930) is still in print. Co-founded the UK Bartenders'' Guild in 1934 and later worked at the Dorchester and Brown''s.', NULL, 'London'),
    ('harry.johnson', 'Harry Johnson', 'Nineteenth-century bartender who worked in San Francisco and Chicago before settling in New York, where he bought the Little Jumbo bar in 1877. His Bartender''s Manual (1882) was the first book to teach bar management, and he is credited with the Bijou.', NULL, 'New York'),
    ('harry.macelhone', 'Harry MacElhone', 'Scottish bartender who worked at Ciro''s Club in London after the First World War and bought Harry''s New York Bar in Paris in 1923; his family still runs it. Author of Harry''s ABC of Mixing Cocktails and Barflies and Cocktails.', NULL, 'Paris'),
    ('harry.yee', 'Harry Yee', 'Honolulu bartender who was head bartender at Henry Kaiser''s Hawaiian Village, later the Hilton Hawaiian Village, for over 30 years from the 1950s. Created the Blue Hawaii in 1957 for Bols and is credited with the first paper parasols and orchid garnishes in tiki drinks.', NULL, 'Honolulu'),
    ('henry.madden', 'Henry Madden', 'Co-owner of the Turf Bar in Tijuana, which advertised itself as the originator of the Tequila Daisy by 1935. In 1936 he told a visiting journalist the drink began as a mistake. Often cited as a forerunner of the Margarita.', NULL, 'Tijuana'),
    ('henry.ramos', 'Henry C. Ramos', 'New Orleans saloon keeper who created the Ramos Gin Fizz in 1888 at his Imperial Cabinet Saloon on Gravier Street.', NULL, 'New Orleans'),
    ('hugo.ensslin', 'Hugo Ensslin', 'Head bartender at the Hotel Wallick in New York whose 1916 book Recipes for Mixed Drinks gave the first printed Aviation and other drinks including the Tipperary.', NULL, 'New York'),
    ('ian.fleming', 'Ian Fleming', 'British author of the James Bond novels. In Casino Royale (1953) Bond orders and names the Vesper, a gin, vodka and Kina Lillet martini.', NULL, 'London'),
    ('jack.morgan', 'Jack Morgan', 'Owner of the Cock ''n'' Bull restaurant on the Sunset Strip in Los Angeles and president of Cock ''n'' Bull Products, maker of the ginger beer used in the original Moscow Mule.', NULL, 'Los Angeles'),
    ('jacob.grohusko', 'Jacob Grohusko', 'English-born New York bartender who spent about a decade as head bartender at Baracca''s restaurant on Stone Street, publishing Jack''s Manual in 1908 with the first printed Brooklyn cocktail. Opened his own bar in 1910.', NULL, 'New York'),
    ('javier.delgado', 'Javier Delgado Corona', 'Owner and bartender of La Capilla in Tequila, Jalisco, for more than 60 years. Created the Batanga, tequila with Mexican cola, lime and a salted rim, stirred with the knife used to cut the limes. Died in 2020.', NULL, 'Tequila'),
    ('jeanpaul.bourguignon', 'Jean-Paul Bourguignon', 'French bartender who trained at Joe Allen in Paris and was brought to Melbourne to run the bar at Mietta''s, where he created the Japanese Slipper (Midori, Cointreau, lemon) in 1984.', NULL, 'Melbourne'),
    ('jeff.berry', 'Jeff Berry', 'Tiki historian and author known as Beachbum Berry, a former Hollywood screenwriter whose books from Grog Log (1998) to Potions of the Caribbean recovered lost tiki recipes. In 2014 he and Annene Kaye opened Latitude 29 in the French Quarter of New Orleans. Created the Ancient Mariner.', NULL, 'New Orleans'),
    ('jeffrey.ong', 'Jeffrey Ong', 'Malaysian beverage manager at the Aviary Bar of the Kuala Lumpur Hilton, where he created the Jungle Bird as a welcome drink when the hotel opened in 1973.', NULL, 'Kuala Lumpur'),
    ('jennings.cox', 'Jennings Cox', 'American mining engineer working in eastern Cuba around the Spanish-American War of 1898, traditionally credited with mixing the first Daiquiri from local rum, lime and sugar near the town of Daiquirí.', NULL, 'Daiquirí'),
    ('jeremy.oertel', 'Jeremy Oertel', 'Brooklyn bartender who started as a barback at Dram in Williamsburg, where he created the Campari-based Bitter Mai Tai, then worked at Mayahuel and Death & Co before running the bar at Donna. He now runs the consultancy You & Me Cocktails with Natasha David.', NULL, 'New York'),
    ('jerry.thomas', 'Jerry Thomas', 'Nineteenth-century American bartender often called the father of American mixology. He tended bar in San Francisco, where he made the flaming Blue Blazer at the El Dorado, and in New York, and wrote the first American bar guide, How to Mix Drinks, or The Bon-Vivant''s Companion (1862), expanded in 1876.', NULL, 'New York'),
    ('joe.scialom', 'Joe Scialom', 'Egyptian-born bartender who ran the Long Bar at Shepheard''s Hotel in Cairo from the late 1930s, creating the Suffering Bastard during the Second World War. He later managed the bar at the Caribe Hilton in San Juan and worked for decades as a mixologist for Hilton hotels in Havana, London, Rome and New York.', NULL, 'Cairo'),
    ('joe.sheridan', 'Joe Sheridan', 'Irish chef who ran the restaurant and coffee shop at the Foynes flying-boat terminal, where in 1942 or 1943 he added whiskey to coffee for cold transatlantic passengers, creating Irish Coffee. He later moved to San Francisco to work at the Buena Vista Cafe.', NULL, 'Foynes'),
    ('john.collins', 'John Collins', 'Head waiter at Limmer''s Old House, a hotel and coffee house on Conduit Street in Mayfair, London, popular in the late 18th and early 19th centuries. The John Collins and Tom Collins are believed to take their name from him.', NULL, 'London'),
    ('john.e.oconnor', 'John E. O''Connor', 'New York bartender at the original Waldorf-Astoria, credited by historian David Wondrich with serving a Martini with muddled olives in 1901, an early form of the Dirty Martini.', NULL, 'New York'),
    ('john.g.martin', 'John G. Martin', 'Executive and later president of the Hartford spirits company G.F. Heublein Brothers, which bought Smirnoff vodka. He promoted the Moscow Mule and its copper mug across the United States from the 1940s.', NULL, 'Hartford'),
    ('john.gertsen', 'John Gertsen', 'Boston bartender who led the bar at Barbara Lynch''s No. 9 Park, named Boston''s best bartender in 2008, and helped create and open her Fort Point cocktail bar Drink that year. He later oversaw cocktail programs across Lynch''s restaurant group.', NULL, 'Boston'),
    ('johnny.solon', 'Johnny Solon', 'Bartender at the original Waldorf-Astoria in New York from 1899, described by the hotel''s historian Albert Stevens Crockett as one of its best mixers and credited with creating the Bronx cocktail there.', NULL, 'New York'),
    ('jon.santer', 'Jon Santer', 'San Francisco Bay Area bartender who created the Revolver in 2004 while managing the bar at Bruno''s in the Mission, joined Bourbon & Branch in 2006, and founded and ran the Prizefighter bar in Emeryville from 2011 to 2022.', NULL, 'San Francisco'),
    ('joseph.rose', 'Joseph Rose', 'Newark, New Jersey bartender at Murray Brothers'' Café whose Coronation cocktail placed in the Police Gazette bartenders'' contest of 1903 and was printed under his name in the 1905 Hoffman House Bartender''s Guide.', NULL, 'Newark'),
    ('joseph.santini', 'Joseph Santini', 'Italian-born New Orleans bartender who worked at the City Exchange around 1850 and from about 1855 ran his own bar, the Jewel of the South on Gravier Street, where he created the Brandy Crusta. Jerry Thomas printed his recipes in 1862. He handed the bar to George Ittmann in 1869.', NULL, 'New Orleans'),
    ('jules.alciatore', 'Jules Alciatore', 'Son of Antoine''s founder Antoine Alciatore, he trained in France and ran Antoine''s restaurant in New Orleans from 1887 to 1934. He is credited with inventing Café Brûlot Diabolique there in the late 19th century.', NULL, 'New Orleans'),
    ('katie.stipe', 'Katie Stipe', 'Bartender who created the Siesta in 2006 early in her career at Flatiron Lounge in New York, a tequila and Campari riff on the Hemingway Daiquiri that became one of the bar''s best sellers. She later moved to Portland, Oregon, where she directs the bar at Voysey.', NULL, 'New York'),
    ('kevin.williamson', 'Kevin Williamson', 'Texas chef who opened Ranch 616 in downtown Austin in the late 1990s. He put Ranch Water, his mix of tequila, lime and Topo Chico from hunting trips in South Texas, on the menu there. He ran the restaurant until his death in 2021.', NULL, 'Austin'),
    ('kyle.davidson', 'Kyle Davidson', 'Chicago bartender who created the Art of Choke, a stirred drink of rum, Cynar and green Chartreuse, at The Violet Hour around 2008. He later worked at the Publican and ran the drinks program at Blackbird.', NULL, 'Chicago'),
    ('la.clarke', 'L. A. Clarke', 'Credited as the inventor of the Lion''s Tail in the Café Royal Cocktail Book, published in London in 1937 by W. J. Tarling for the UK Bartenders'' Guild. Nothing else is recorded about who Clarke was.', NULL, NULL),
    ('lester.gruber', 'Lester Gruber', 'Detroit restaurateur who, with his brother Sam, ran the London Chop House from the 1930s and opened the Caucus Club across the street in 1952. The Bull Shot was developed at his restaurant around 1952 with ad executive John Hurley for Campbell''s canned bouillon.', NULL, 'Detroit'),
    ('marcovaldo.dionysos', 'Marcovaldo Dionysos', 'San Francisco bartender known as Marco, who built the cocktail program at Absinthe in the late 1990s and worked at Bourbon & Branch, Harry Denton''s Starlight Room, Rye and Smuggler''s Cove. His Chartreuse Swizzle won a Chartreuse-sponsored competition in 2003.', NULL, 'San Francisco'),
    ('mariano.martinez', 'Mariano Martinez', 'Dallas restaurateur who opened Mariano''s Mexican Cuisine in 1971 and the same year adapted a soft-serve ice cream machine to make frozen margaritas, the first dedicated frozen margarita machine. The original machine is in the Smithsonian.', NULL, 'Dallas'),
    ('marie.myrick', 'Marie Myrick', 'With her husband George, built and ran the beach bar on White Bay, Jost Van Dyke, later known as the Soggy Dollar Bar, from 1970 until 1980, and claims the Painkiller from 1971.', NULL, 'Jost Van Dyke'),
    ('michel.esper', 'Michel Ésper', 'Member of the Club Deportivo Potosino in San Luis Potosí, Mexico, who in the 1960s asked for his beer with lime, salt and ice. Fellow members began ordering ''Michel''s lemonade'', one origin story for the Michelada.', NULL, 'San Luis Potosí'),
    ('mirko.stocchetto', 'Mirko Stocchetto', 'Venetian bartender who trained at Harry''s Bar in Venice under Giuseppe Cipriani and in 1967 took over Bar Basso in Milan, where he created the Negroni Sbagliato with prosecco in place of gin. He ran the bar until his death in 2016.', NULL, 'Milan'),
    ('naren.young', 'Naren Young', 'Sydney-born bartender and drinks writer who moved to New York in 2006, ran the bars for AvroKO including Saxon + Parole, and was creative director of Dante when it was named the world''s best bar in 2019. He now runs Sweet Liberty in Miami.', NULL, 'New York'),
    ('ngiam.tongboon', 'Ngiam Tong Boon', 'Hainanese bartender at the Long Bar of the Raffles Hotel in Singapore, credited with creating the Singapore Sling there in the early 20th century, traditionally dated to 1915.', NULL, 'Singapore'),
    ('norman.hobday', 'Norman Jay Hobday', 'Founder of Henry Africa''s on Russian Hill in San Francisco, which opened in 1969 and is often called the first fern bar. He is credited with inventing the Lemon Drop there in the 1970s.', NULL, 'San Francisco'),
    ('pat.mcgarry', 'Malachy "Pat" McGarry', 'Barman at Buck''s Club, the gentlemen''s club in Mayfair, London, where he is said to have first served the Buck''s Fizz in 1921.', NULL, 'London'),
    ('pat.obrien', 'Pat O''Brien', 'New Orleans bar owner whose French Quarter bar, Pat O''Brien''s, grew out of a speakeasy called Mr. O''Brien''s Club Tipperary. In the 1940s the bar created its passion fruit Hurricane, reportedly to use up surplus rum.', NULL, 'New Orleans'),
    ('patrick.gavin.duffy', 'Patrick Gavin Duffy', 'New York bartender who started at the Ashland House near Madison Square around 1884 and became its head bartender, later ran the Lyceum Cafe and the Hotel Empire bar, and wrote The Official Mixer''s Manual, published just after Repeal.', NULL, 'New York'),
    ('paul.harrington', 'Paul Harrington', 'Bay Area bartender at the Townhouse Bar & Grill in Emeryville, where he created the Jasmine in the early 1990s. He wrote the 1998 book Cocktail: The Drinks Bible for the 21st Century and later left bartending for architecture.', NULL, 'Emeryville'),
    ('peter.fich', 'Peter Fich', 'Head bartender at the Banff Springs Hotel in Alberta, credited in one account with inventing the B-52 shooter and naming it after the band the B-52s, in line with his habit of naming drinks after bands and songs.', NULL, 'Banff'),
    ('phil.ward', 'Phil Ward', 'New York bartender who rose from barback to head bartender at Flatiron Lounge, then at Pegu Club and Death & Co, where he made the Oaxaca Old Fashioned and Final Ward. In 2009 he opened Mayahuel, a pioneering tequila and mezcal bar, which ran for eight years.', NULL, 'New York'),
    ('philip.guichet', 'Philip Guichet', 'Owner of Tujague''s in the French Quarter of New Orleans, which credits him with creating the Grasshopper in 1918.', NULL, 'New Orleans'),
    ('popo.galsini', 'Popo Galsini', 'Philippine-born bartender, born Jose Valencia Galsim, who arrived in San Francisco in 1928 and worked at the Tropics in Hollywood and many California bars. A frequent competition winner from 1952, he created the Saturn, first called the X-15.', NULL, 'Los Angeles'),
    ('raimundo.alvarez', 'Raimundo Alvarez', 'Bartender at the Old King Bar in Miami, credited with the Golden Dream, a creamy Galliano and orange drink said to have been made for regular Joan Crawford around 1960.', NULL, 'Miami'),
    ('ramon.marrero', 'Ramón "Monchito" Marrero', 'Bartender at the Caribe Hilton hotel in San Juan, Puerto Rico, credited by the hotel with creating the Piña Colada in 1954.', NULL, 'San Juan'),
    ('rick.dobbs', 'Rick Dobbs', 'California bartender who opened The Last Word bar in Livermore, where in 2016 he created the Last of the Oaxacans, a mezcal version of the Last Word.', NULL, 'Livermore'),
    ('robert.butt', 'Robert "Rosebud" Butt', 'Bartender at the Oak Beach Inn on Long Island, New York, who says he created the Long Island Iced Tea in 1972 as an entry in a contest for a new drink using triple sec.', NULL, 'Long Island'),
    ('robert.hess', 'Robert Hess', 'Seattle cocktail writer and educator behind the DrinkBoy website and the Small Screen Network videos, and a co-founder of the Museum of the American Cocktail in 2005. He created the Trident around 2000, a Negroni riff with aquavit, Cynar and sherry.', 'https://www.drinkboy.com', 'Seattle'),
    ('robert.vermeire', 'Robert Vermeire', 'Belgian bartender who worked in London at the Royal Automobile Club and the Criterion, then led the bar at the Embassy Club from 1920. His 1922 book Cocktails: How to Mix Them was a best seller. He later ran his own bar in Knokke and the bar at the Albert Ier hotel in Brussels.', NULL, 'London'),
    ('roland.gruber', 'Roland Gruber', 'Bar manager at the San Zeno bar in Naturns, South Tyrol, Italy, credited with creating the Hugo spritz with elderflower syrup, mint and prosecco in 2005.', NULL, 'Naturns'),
    ('salvatore.calabrese', 'Salvatore Calabrese', 'Amalfi Coast-born bartender known as The Maestro, who made his name at the Dukes Hotel bar in London from the early 1980s, created the Breakfast Martini at the Lanesborough''s Library Bar in the 1990s, and wrote the best-selling Classic Cocktails (1997). A past president of the UK Bartenders'' Guild.', NULL, 'London'),
    ('sandro.conti', 'Sandro Conti', 'Bartender at the Kahiki, the Polynesian restaurant in Columbus, Ohio, who had the bourbon-based Port Light on its menu around 1961 and created the Polynesian Spell. Both recipes were rediscovered by Jeff Berry.', NULL, 'Columbus'),
    ('sasha.petraske', 'Sasha Petraske', 'New York bar owner who opened Milk & Honey on the Lower East Side in 1999, reviving classic technique and house rules, and went on to open or partner in Little Branch, The Varnish in Los Angeles, Milk & Honey London and The Everleigh in Melbourne. He trained many leading bartenders before his death in 2015.', NULL, 'New York'),
    ('sparrow.robertson', 'William "Sparrow" Robertson', 'Sports editor for the Paris edition of the New York Herald, credited with the Old Pal in Harry MacElhone''s 1927 book Barflies and Cocktails.', NULL, 'Paris'),
    ('stephen.cole', 'Stephen Cole', 'Chicago bartender who created the Bitter Giuseppe, a Cynar and vermouth drink, at The Violet Hour. In 2011 he left to open Barrelhouse Flat in Lincoln Park with Greg Buttera, and later worked at Lone Wolf.', NULL, 'Chicago'),
    ('steve.crane', 'Steve Crane', 'Actor turned restaurateur who in 1953 took over The Tropics in Beverly Hills and reopened it as The Luau, a celebrated tiki restaurant. From 1958 he built the Kon-Tiki chain of Polynesian restaurants in Sheraton hotels.', NULL, 'Beverly Hills'),
    ('ted.kilgore', 'Ted Kilgore', 'St. Louis bartender who created the Industry Sour, equal parts Fernet-Branca, green Chartreuse, lime and syrup, in 2011 while running the bar at Taste by Niche. He is proprietor of Planter''s House in Lafayette Square, named for the hotel where Jerry Thomas once worked.', NULL, 'St. Louis'),
    ('thomas.handy', 'Thomas H. Handy', 'New Orleans businessman who became proprietor of the Sazerac Coffee House around 1870. Around then the house drink switched from cognac to rye whiskey, and he recorded the Sazerac recipe before his death in 1889.', NULL, 'New Orleans'),
    ('tj.siegal', 'T.J. Siegal', 'New York restaurant worker and childhood friend of Sasha Petraske. As a regular at Milk & Honey around 2000 he asked for his usual bourbon sour made with the bar''s honey syrup and named the result the Gold Rush.', NULL, 'New York'),
    ('toby.maloney', 'Toby Maloney', 'Bartender trained in San Francisco who worked at Milk & Honey and Pegu Club in New York, then co-founded The Violet Hour in Chicago in 2007, a James Beard award winner, and the consultancy Alchemy Consulting. Author of The Bartender''s Manifesto (2022).', NULL, 'Chicago'),
    ('todd.smith', 'Todd Smith', 'San Francisco bartender who created the Black Manhattan, rye with Averna in place of vermouth, around 2005 and was the founding bar director of Bourbon & Branch. He is a co-owner of ABV in the Mission District.', NULL, 'San Francisco'),
    ('tom.richter', 'Tom Richter', 'New York bartender who learned the fresh-ingredient approach at Zuni Café in San Francisco, worked with Sasha Petraske at Milk & Honey, and was head bartender at The Beagle and Dear Irving. He created Tomr''s Tonic, a craft tonic syrup.', NULL, 'New York'),
    ('tony.abouganim', 'Tony Abou-Ganim', 'Bartender known as The Modern Mixologist. He made the Cable Car at Harry Denton''s Starlight Room in San Francisco in the mid-1990s, then built the fresh-juice cocktail program at Bellagio in Las Vegas from 1998 to 2004. Author of The Modern Mixologist (2010).', 'https://www.themodernmixologist.com', 'Las Vegas'),
    ('victor.bergeron', 'Victor Bergeron', 'Restaurateur known as Trader Vic, who opened Hinky Dink''s in Oakland in 1934, renamed it Trader Vic''s, and grew it into an international tiki chain. His restaurant credits him with inventing the Mai Tai in 1944.', NULL, 'Oakland'),
    ('victor.morris', 'Victor Morris', 'American who moved to Peru in the early 1900s to work on a railway at Cerro de Pasco and in 1916 opened Morris'' Bar in Lima, where he developed the Pisco Sour. The bar closed in 1929.', NULL, 'Lima'),
    ('vincenzo.errico', 'Vincenzo Errico', 'Italian bartender trained under Dick Bradsell in London, where he created the Enzoni at Match Bar around 2001. At Milk & Honey in New York he made the Red Hook. He now owns L''ArteFatto on the island of Ischia.', NULL, 'New York'),
    ('walter.bergeron', 'Walter Bergeron', 'Head bartender at the Hotel Monteleone in New Orleans in the 1930s, credited with creating the Vieux Carré there around 1937 and 1938.', NULL, 'New Orleans'),
    ('walter.chell', 'Walter Chell', 'Restaurant manager at the Calgary Inn in Alberta who invented the Caesar in 1969 for the hotel''s new Italian restaurant, mashing clams into a tomato nectar inspired by spaghetti alle vongole.', NULL, 'Calgary'),
    ('wayne.collins', 'Wayne Collins', 'British bartender and spirits brand ambassador, including for Seagram''s, who created the White Negroni with gin, Suze and Lillet Blanc in Bordeaux in 2001 while attending the Vinexpo trade fair.', NULL, NULL)
) AS v("handle", "name", "bio", "website", "city")
WHERE NOT EXISTS (SELECT 1 FROM "public"."profiles" p WHERE p.handle = v.handle);

INSERT INTO "public"."profile_positions" ("person_profile_id", "bar_profile_id", "title", "is_current", "source_url")
SELECT pp.id, bp.id, v.title, v.is_current, v.source_url
FROM (VALUES
    ('ada.coleman', 'americanbarsavoy', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Ada_Coleman'),
    ('adam.seger', 'seelbachhilton', 'Food and beverage manager', false, 'https://www.malaymail.com/news/eat-drink/2016/11/02/that-historic-cocktail-turns-out-its-a-fake/1241039'),
    ('agostino.perrone', 'connaughtbar', 'Director of mixology', true, 'https://en.wikipedia.org/wiki/Connaught_Hotel'),
    ('angie.conigliaro', 'shipsstore.stthomas', 'Bartender', false, 'https://punchdrink.com/articles/long-live-bushwacker-frozen-rum-cocktail-recipe/'),
    ('audreysaunders', 'pegu.club.nyc', 'Operating partner', false, 'https://en.wikipedia.org/wiki/Audrey_Saunders'),
    ('audreysaunders', 'beacon.nyc', 'Lead bartender', false, 'https://en.wikipedia.org/wiki/Audrey_Saunders'),
    ('audreysaunders', 'bemelmansbar', 'Bar manager', false, 'https://en.wikipedia.org/wiki/Audrey_Saunders'),
    ('bobby.lozoff', 'thetrident.sausalito', 'Bartender', false, 'https://en.wikipedia.org/wiki/Tequila_sunrise'),
    ('billy.rice', 'thetrident.sausalito', 'Bartender', false, 'https://en.wikipedia.org/wiki/Tequila_sunrise'),
    ('brian.miller', 'deathandcompany', 'Head bartender', false, 'https://vinepair.com/cocktail-recipe/conference/'),
    ('brian.miller', 'pegu.club.nyc', 'Bartender', false, 'https://vinepair.com/cocktail-recipe/conference/'),
    ('bryant.sharp', 'bryantslounge', 'Founder and owner', false, 'https://bryantscocktaillounge.com/history'),
    ('cayetano.ferrer', 'oldabsinthehouse', 'Bartender and manager', false, 'https://en.wikipedia.org/wiki/Old_Absinthe_House'),
    ('chad.solomon', 'milkandhoney.nyc', 'Bartender', false, 'https://punchdrink.com/articles/silent-dry-shake-cocktail-heard-round-world/'),
    ('chad.solomon', 'pegu.club.nyc', 'Bartender', false, 'https://punchdrink.com/articles/silent-dry-shake-cocktail-heard-round-world/'),
    ('chris.elford', 'amoryamargo', 'Bartender', false, 'https://punchdrink.com/recipes/sharpie-mustache/'),
    ('chris.ojeda', 'sohohouse.weho', 'Bar manager', false, 'https://www.sohohouse.com/house-notes/issue-006/food-and-drink/ever-wondered-where-our-picante-came-from'),
    ('constante.gil', 'cafemadrid.valencia', 'Owner', false, 'https://www.valenciabonita.es/2016/09/08/la-historia-del-agua-de-valencia-y-de-su-creador-constante-gil-rodriguez/'),
    ('constantino.ribalaigua', 'floridita_cuba', 'Owner and head bartender', false, 'https://en.wikipedia.org/wiki/El_Floridita'),
    ('craig.harper', 'rubycph', 'Bartender', false, 'https://punchdrink.com/articles/rapscallion-cocktail-manhattan-modern-classic/'),
    ('adeline.shepherd', 'rubycph', 'Bartender', false, 'https://punchdrink.com/articles/rapscallion-cocktail-manhattan-modern-classic/'),
    ('kingcocktail', 'rainbowroom.nyc', 'Chief bartender', false, 'https://en.wikipedia.org/wiki/Dale_DeGroff'),
    ('damon.dyer', 'louis649.nyc', 'Bartender', false, 'https://www.diffordsguide.com/cocktails/recipe/2994/monte-cassino'),
    ('dick.bradsell', 'fredsclub.london', 'Bartender', false, 'https://en.wikipedia.org/wiki/Dick_Bradsell'),
    ('dick.bradsell', 'sohobrasserie.london', 'Bartender', false, 'https://en.wikipedia.org/wiki/Dick_Bradsell'),
    ('dominic.venegas', 'range.sf', 'Bar program lead', false, 'https://www.diffordsguide.com/cocktails/recipe/36336/1794'),
    ('dominic.venegas', 'bourbonandbranch', 'Bartender', false, 'https://www.diffordsguide.com/cocktails/recipe/36336/1794'),
    ('dominic.venegas', 'smugglerscovesf', 'Bartender', false, 'https://www.diffordsguide.com/cocktails/recipe/36336/1794'),
    ('don.lee', 'pdtnyc', 'Bartender', false, 'https://punchdrink.com/articles/this-is-how-fat-washing-happened-pdt-speakeasy-bar-nyc/'),
    ('donn.beach', 'donthebeachcomber.hwood', 'Founder', false, 'https://en.wikipedia.org/wiki/Donn_Beach'),
    ('douglas.ankrah', 'townhouse.knightsbridge', 'Bartender', false, 'https://en.wikipedia.org/wiki/Douglas_Ankrah'),
    ('duncan.nicol', 'bankexchange.sf', 'Owner', false, 'https://en.wikipedia.org/wiki/Pisco_punch'),
    ('erick.castro', 'raisedbywolvesspirits', 'Co-owner', true, 'https://punchdrink.com/articles/erick-castro-is-taking-the-long-view/'),
    ('erick.castro', 'politeprovisions', 'Co-founder', false, 'https://punchdrink.com/articles/erick-castro-is-taking-the-long-view/'),
    ('erick.castro', 'rickhouse.sf', 'Bartender', false, 'https://punchdrink.com/articles/erick-castro-is-taking-the-long-view/'),
    ('erick.castro', 'bourbonandbranch', 'Bartender', false, 'https://punchdrink.com/articles/erick-castro-is-taking-the-long-view/'),
    ('federico.vargas', 'ventadevargas.cordoba', 'Owner', false, 'https://en.wikipedia.org/wiki/Tinto_de_verano'),
    ('fosco.scarselli', 'caffecasoni.firenze', 'Bartender', false, 'https://www.ilgiornale.it/news/secolo-allegro-drink-nato-essere-spavaldo-1631069.html'),
    ('frank.klein', 'poorreds', 'Bartender', false, 'https://punchdrink.com/recipes/golden-cadillac/'),
    ('frank.meier', 'ritzparis', 'Head bartender', false, 'https://thedailybeast.com/frank-meier-the-paris-ritzs-mysterious-bartender-spy'),
    ('gaspare.campari', 'caffecampari.milano', 'Owner', false, 'https://en.wikipedia.org/wiki/Gaspare_Campari'),
    ('george.delgado', 'libation.nyc', 'Cocktail menu creator', false, 'https://www.timeout.com/newyork/bars/libation'),
    ('george.williamson', 'shoomakers.dc', 'Bartender', false, 'https://en.wikipedia.org/wiki/Rickey_(cocktail)'),
    ('george.myrick', 'soggydollarbar', 'Owner', false, 'https://en.wikipedia.org/wiki/Painkiller_(cocktail)'),
    ('marie.myrick', 'soggydollarbar', 'Owner', false, 'https://en.wikipedia.org/wiki/Painkiller_(cocktail)'),
    ('daphne.henderson', 'soggydollarbar', 'Owner', false, 'https://en.wikipedia.org/wiki/Painkiller_(cocktail)'),
    ('giovanni.raimondo', 'excelsior.rome', 'Bartender', false, 'https://www.diffordsguide.com/en-au/cocktails/recipe/572/cardinale'),
    ('giuseppe.cipriani', 'harrysbar.venezia', 'Founder', false, 'https://en.wikipedia.org/wiki/Harry%27s_Bar_(Venice)'),
    ('giuseppe.gonzalez', 'cloverclubny', 'Bartender', false, 'https://punchdrink.com/lookbook/giuseppe-gonzalez-owner-suffolk-arms/'),
    ('greg.lindgren', 'rye.sf', 'Owner', false, 'https://punchdrink.com/recipes/basil-gimlet/'),
    ('gustave.tops', 'metropole.brussels', 'Barman', false, 'https://en.wikipedia.org/wiki/Black_Russian'),
    ('harry.craddock', 'americanbarsavoy', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Harry_Craddock'),
    ('harry.macelhone', 'harrysbar_theoriginal', 'Owner', false, 'https://en.wikipedia.org/wiki/Harry_MacElhone'),
    ('harry.macelhone', 'cirosclub.london', 'Bartender', false, 'https://en.wikipedia.org/wiki/Harry_MacElhone'),
    ('harry.yee', 'hiltonhawaiianvillage', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Harry_Yee'),
    ('henry.ramos', 'imperialcabinet.nola', 'Owner', false, 'https://en.wikipedia.org/wiki/Ramos_gin_fizz'),
    ('henry.madden', 'turfbar.tijuana', 'Co-owner', false, 'https://barrypopik.com/blog/tequila_daisy'),
    ('hugo.ensslin', 'hotelwallick.nyc', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Aviation_(cocktail)'),
    ('ivy.mix', 'leyendabk', 'Co-owner', false, 'https://en.wikipedia.org/wiki/Ivy_Mix'),
    ('ivy.mix', 'cloverclubny', 'Bartender', false, 'https://en.wikipedia.org/wiki/Ivy_Mix'),
    ('ivy.mix', 'lanikai.nyc', 'Bartender', false, 'https://en.wikipedia.org/wiki/Ivy_Mix'),
    ('jack.mcgarry', 'thedeadrabbitny', 'Co-founder and owner', true, 'https://en.wikipedia.org/wiki/The_Dead_Rabbit'),
    ('sean.muldoon', 'thedeadrabbitny', 'Co-founder', false, 'https://en.wikipedia.org/wiki/The_Dead_Rabbit'),
    ('jacob.grohusko', 'baraccas.nyc', 'Head bartender', false, 'https://library.cocktailkingdom.com/exh.figures.grohusko_jack.html'),
    ('javier.delgado', 'lacapilla.tequila', 'Owner and bartender', false, 'https://classbarmag.com/news/fullstory.php/aid/98/Don_Javier:_farewell_to_a_legend.html'),
    ('jeanpaul.bourguignon', 'miettas.melbourne', 'Bartender', false, 'https://punchdrink.com/articles/japanese-slipper-midori-cocktail-well-worn-ready-to-rally-melbourne/'),
    ('jeff.berry', 'latitude29nola', 'Co-owner', true, 'https://en.wikipedia.org/wiki/Jeff_Berry_(mixologist)'),
    ('jeffmorgen', 'clydecommon', 'Bar manager', false, 'https://en.wikipedia.org/wiki/Jeffrey_Morgenthaler'),
    ('jeffmorgen', 'belami.eugene', 'Bartender', false, 'https://en.wikipedia.org/wiki/Jeffrey_Morgenthaler'),
    ('jeffrey.ong', 'aviarybar.klhilton', 'Beverage manager', false, 'https://en.wikipedia.org/wiki/Jungle_Bird'),
    ('jeremy.oertel', 'dram.brooklyn', 'Bartender', false, 'https://punchdrink.com/recipes/bitter-mai-tai/'),
    ('jeremy.oertel', 'mayahuel.nyc', 'Bartender', false, 'https://punchdrink.com/recipes/bitter-mai-tai/'),
    ('jeremy.oertel', 'donna.brooklyn', 'Bar manager', false, 'https://punchdrink.com/recipes/bitter-mai-tai/'),
    ('jerry.thomas', 'eldorado.sf', 'Bartender', false, 'https://en.wikipedia.org/wiki/Jerry_Thomas_(bartender)'),
    ('jerry.thomas', 'jerrythomas.broadway', 'Owner', false, 'https://en.wikipedia.org/wiki/Jerry_Thomas_(bartender)'),
    ('joaquin.simo', 'deathandcompany', 'Bartender', false, 'https://en.wikipedia.org/wiki/Naked_and_Famous_(cocktail)'),
    ('joaquin.simo', 'pouring_ribbons', 'Co-owner', false, 'https://en.wikipedia.org/wiki/Naked_and_Famous_(cocktail)'),
    ('joe.scialom', 'shepheards.cairo', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Suffering_bastard'),
    ('joe.scialom', 'caribehilton', 'Bar manager', false, 'https://en.wikipedia.org/wiki/Suffering_bastard'),
    ('joe.sheridan', 'foynes.terminal', 'Head chef', false, 'https://en.wikipedia.org/wiki/Irish_coffee'),
    ('joe.sheridan', 'thebuenavistasf', 'Staff', false, 'https://en.wikipedia.org/wiki/Irish_coffee'),
    ('john.collins', 'limmers.london', 'Head waiter', false, 'https://en.wikipedia.org/wiki/Tom_Collins'),
    ('john.e.oconnor', 'waldorf.astoria.1893', 'Bartender', false, 'https://vinepair.com/articles/history-martini-olives-superstition'),
    ('jack.morgan', 'cocknbull.la', 'Owner', false, 'https://en.wikipedia.org/wiki/Moscow_mule'),
    ('john.gertsen', 'no9park.boston', 'Bar manager', false, 'https://drinkboston.com/2006/09/'),
    ('john.gertsen', 'drink.boston', 'Bar director', false, 'https://drinkboston.com/2006/09/'),
    ('johnny.solon', 'waldorf.astoria.1893', 'Bartender', false, 'https://en.wikipedia.org/wiki/Bronx_(cocktail)'),
    ('jon.santer', 'brunos.sf', 'Bar manager', false, 'https://whiskyadvocate.com/revolver-cocktail/'),
    ('jon.santer', 'bourbonandbranch', 'Bartender', false, 'https://whiskyadvocate.com/revolver-cocktail/'),
    ('jon.santer', 'prizefighter.emeryville', 'Founder and owner', false, 'https://whiskyadvocate.com/revolver-cocktail/'),
    ('jorg.meyer', 'barlelion', 'Owner', true, 'https://en.wikipedia.org/wiki/Gin_Basil_Smash'),
    ('joseph.rose', 'murraybros.newark', 'Bartender', false, 'https://punchdrink.com/recipes/coronation-no-1/'),
    ('joseph.santini', 'jewelofthesouth.1855', 'Owner', false, 'https://en.wikipedia.org/wiki/Brandy_crusta'),
    ('jules.alciatore', 'antoines.nola', 'Proprietor', false, 'https://en.wikipedia.org/wiki/Antoine%27s'),
    ('julie.reiner', 'cloverclubny', 'Co-owner', true, 'https://punchdrink.com/articles/how-siesta-became-modern-classic-tequila-campari-cocktail-recipe/'),
    ('julie.reiner', 'flatironlounge', 'Co-owner', false, 'https://punchdrink.com/articles/how-siesta-became-modern-classic-tequila-campari-cocktail-recipe/'),
    ('julie.reiner', 'leyendabk', 'Co-owner', false, 'https://punchdrink.com/articles/how-siesta-became-modern-classic-tequila-campari-cocktail-recipe/'),
    ('julio.bermejo', 'tommysmexican', 'Bartender and co-owner', true, 'https://punchdrink.com/recipes/tommys-margarita/'),
    ('katie.stipe', 'flatironlounge', 'Bartender', false, 'https://punchdrink.com/articles/how-siesta-became-modern-classic-tequila-campari-cocktail-recipe/'),
    ('kevin.williamson', 'ranch616', 'Chef and owner', false, 'https://communityimpact.com/austin/central-austin/dining/2026/05/05/ranch-616-the-birthplace-of-ranch-water-and-old-austin-eats/'),
    ('kyle.davidson', 'violethourchicago', 'Bartender', false, 'https://punchdrink.com/recipes/the-art-of-choke/'),
    ('lester.gruber', 'caucusclub.detroit', 'Owner', false, 'https://punchdrink.com/articles/bullshot-cocktail-detroit-caucus-club/'),
    ('pat.mcgarry', 'bucks.club.london', 'Barman', false, 'https://en.wikipedia.org/wiki/Buck%27s_Fizz'),
    ('marcovaldo.dionysos', 'starlightroom.sf', 'Bartender', false, 'https://en.wikipedia.org/wiki/Chartreuse_swizzle'),
    ('marcovaldo.dionysos', 'smugglerscovesf', 'Bartender', false, 'https://en.wikipedia.org/wiki/Chartreuse_swizzle'),
    ('mariano.martinez', 'marianos.dallas', 'Owner', false, 'https://en.wikipedia.org/wiki/Margarita'),
    ('martin.cate', 'smugglerscovesf', 'Owner', true, 'https://www.smugglerscovesf.com/'),
    ('michael.mcilroy', 'attaboy134', 'Co-owner', true, 'https://punchdrink.com/recipes/greenpoint/'),
    ('michael.mcilroy', 'milkandhoney.nyc', 'Bartender', false, 'https://punchdrink.com/recipes/greenpoint/'),
    ('mirko.stocchetto', 'barbasso.milano', 'Owner', false, 'https://www.gamberorossointernational.com/news/rip-mirko-stocchetto-the-barman-responsible-for-the-negroni-sbagliato'),
    ('mirko.stocchetto', 'harrysbar.venezia', 'Bartender', false, 'https://www.gamberorossointernational.com/news/rip-mirko-stocchetto-the-barman-responsible-for-the-negroni-sbagliato'),
    ('naren.young', 'dantenewyorkcity', 'Creative director', false, 'https://theshout.com.au/?p=31148'),
    ('naren.young', 'saxonandparole', 'Bar director', false, 'https://theshout.com.au/?p=31148'),
    ('naren.young', 'sweetlibertymia', 'Partner', true, 'https://theshout.com.au/?p=31148'),
    ('ngiam.tongboon', 'longbarsg', 'Bartender', false, 'https://en.wikipedia.org/wiki/Singapore_Sling'),
    ('norman.hobday', 'henryafricas.sf', 'Founder and owner', false, 'https://en.wikipedia.org/wiki/Lemon_drop_(cocktail)'),
    ('pat.obrien', 'patobriens', 'Owner', false, 'https://en.wikipedia.org/wiki/Hurricane_(cocktail)'),
    ('patrick.gavin.duffy', 'ashlandhouse.nyc', 'Head bartender', false, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-51'),
    ('paul.harrington', 'townhouse.emeryville', 'Bartender', false, 'https://punchdrink.com/articles/jasmine-became-modern-classic-campari-cocktail-recipe/'),
    ('paul.mcgee', 'lostlakechicago', 'Co-owner', false, 'https://punchdrink.com/recipes/lost-lake/'),
    ('paul.mcgee', 'threedotsandadash', 'Bar manager', false, 'https://punchdrink.com/recipes/lost-lake/'),
    ('peter.fich', 'banffsprings', 'Head bartender', false, 'https://en.wikipedia.org/wiki/B-52_(cocktail)'),
    ('phil.ward', 'mayahuel.nyc', 'Owner', false, 'https://punchdrink.com/articles/phil-ward-bartender-nyc-mayahuel-long-island-bar/'),
    ('phil.ward', 'deathandcompany', 'Head bartender', false, 'https://punchdrink.com/articles/phil-ward-bartender-nyc-mayahuel-long-island-bar/'),
    ('phil.ward', 'pegu.club.nyc', 'Head bartender', false, 'https://punchdrink.com/articles/phil-ward-bartender-nyc-mayahuel-long-island-bar/'),
    ('phil.ward', 'flatironlounge', 'Head bartender', false, 'https://punchdrink.com/articles/phil-ward-bartender-nyc-mayahuel-long-island-bar/'),
    ('philip.guichet', 'tujagues', 'Owner', false, 'https://en.wikipedia.org/wiki/Grasshopper_(cocktail)'),
    ('raimundo.alvarez', 'oldkingbar.miami', 'Bartender', false, 'https://en.wikipedia.org/wiki/Golden_dream_(cocktail)'),
    ('ramon.marrero', 'caribehilton', 'Bartender', false, 'https://en.wikipedia.org/wiki/Pi%C3%B1a_colada'),
    ('rick.dobbs', 'lastword.livermore', 'Owner', false, 'https://www.diffordsguide.com/cocktails/recipe/9733/last-of-the-oaxacans'),
    ('robert.butt', 'oakbeachinn', 'Bartender', false, 'https://en.wikipedia.org/wiki/Long_Island_iced_tea'),
    ('robert.vermeire', 'embassyclub.london', 'Head bartender', false, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-84'),
    ('roland.gruber', 'sanzeno.naturns', 'Bar manager', false, 'https://en.wikipedia.org/wiki/Hugo_(cocktail)'),
    ('salvatore.calabrese', 'dukeslondon', 'Head bartender', false, 'https://www.diffordsguide.com/encyclopedia/2672/people/salvatore-calabrese'),
    ('salvatore.calabrese', 'librarybar.lanesborough', 'Bar manager', false, 'https://www.diffordsguide.com/encyclopedia/2672/people/salvatore-calabrese'),
    ('salvatore.calabrese', 'thedonovanbar', 'Bar program lead', false, 'https://www.diffordsguide.com/encyclopedia/2672/people/salvatore-calabrese'),
    ('sam.ross', 'attaboy134', 'Co-owner', true, 'https://en.wikipedia.org/wiki/Penicillin_(cocktail)'),
    ('sam.ross', 'milkandhoney.nyc', 'Bartender', false, 'https://en.wikipedia.org/wiki/Penicillin_(cocktail)'),
    ('sandro.conti', 'kahiki.columbus', 'Bartender', false, 'https://kindredcocktails.com/cocktail/port-light'),
    ('sasha.petraske', 'milkandhoney.nyc', 'Founder', false, 'https://en.wikipedia.org/wiki/Sasha_Petraske'),
    ('sasha.petraske', 'littlebranch.nyc', 'Co-founder', false, 'https://en.wikipedia.org/wiki/Sasha_Petraske'),
    ('sasha.petraske', 'theeverleigh', 'Partner', false, 'https://en.wikipedia.org/wiki/Sasha_Petraske'),
    ('stephen.cole', 'violethourchicago', 'Bartender', false, 'https://punchdrink.com/recipes/bitter-giuseppe/'),
    ('stephen.cole', 'barrelhouseflat', 'Co-founder and owner', false, 'https://punchdrink.com/recipes/bitter-giuseppe/'),
    ('steve.crane', 'theluau.beverlyhills', 'Owner', false, 'https://www.enterthetiki.com/stephen-crane'),
    ('ted.kilgore', 'plantershouse', 'Co-owner', true, 'https://www.theeducatedbarfly.com/?p=32630'),
    ('ted.kilgore', 'tastebyniche', 'Bar manager', false, 'https://www.theeducatedbarfly.com/?p=32630'),
    ('thomas.handy', 'sazerac.coffeehouse', 'Proprietor', false, 'https://en.wikipedia.org/wiki/Sazerac'),
    ('toby.cecchini', 'thelongislandbar', 'Co-owner', true, 'https://en.wikipedia.org/wiki/Cosmopolitan_(cocktail)'),
    ('toby.cecchini', 'theodeon.nyc', 'Bartender', false, 'https://en.wikipedia.org/wiki/Cosmopolitan_(cocktail)'),
    ('toby.maloney', 'violethourchicago', 'Partner and head mixologist', false, 'https://punchdrink.com/lookbook/toby-maloney-the-violet-hour-chicago-mothers-ruin-loverboy-nyc/'),
    ('toby.maloney', 'milkandhoney.nyc', 'Bartender', false, 'https://punchdrink.com/lookbook/toby-maloney-the-violet-hour-chicago-mothers-ruin-loverboy-nyc/'),
    ('toby.maloney', 'pegu.club.nyc', 'Bartender', false, 'https://punchdrink.com/lookbook/toby-maloney-the-violet-hour-chicago-mothers-ruin-loverboy-nyc/'),
    ('todd.smith', 'abvsf', 'Co-owner', true, 'https://drinksanddrinking.substack.com/p/black-manhattan'),
    ('todd.smith', 'bourbonandbranch', 'Bar director', false, 'https://drinksanddrinking.substack.com/p/black-manhattan'),
    ('tom.richter', 'thebeagle.nyc', 'Head bartender', false, 'https://www.diffordsguide.com/encyclopedia/2844/people/tom-richter'),
    ('tom.richter', 'dearirving', 'Head bartender', false, 'https://www.diffordsguide.com/encyclopedia/2844/people/tom-richter'),
    ('tom.richter', 'attaboy134', 'Bartender', false, 'https://www.diffordsguide.com/encyclopedia/2844/people/tom-richter'),
    ('tony.abouganim', 'starlightroom.sf', 'Bartender', false, 'https://www.diffordsguide.com/encyclopedia/2677/people/tony-abou-ganim'),
    ('tony.conigliaro', '69colebrookerow', 'Founder', true, 'https://www.diffordsguide.com/cocktails/recipe/2923/death-in-venice'),
    ('tony.conigliaro', 'terminisoho', 'Co-founder', true, 'https://www.diffordsguide.com/cocktails/recipe/2923/death-in-venice'),
    ('victor.bergeron', 'tradervics.oakland', 'Founder', false, 'https://en.wikipedia.org/wiki/Victor_Bergeron'),
    ('victor.morris', 'morrisbar.lima', 'Owner', false, 'https://en.wikipedia.org/wiki/Pisco_sour'),
    ('vincenzo.errico', 'milkandhoney.nyc', 'Bartender', false, 'https://punchdrink.com/articles/enzoni-gin-campari-cocktail/'),
    ('vincenzo.errico', 'matchbar.london', 'Bartender', false, 'https://punchdrink.com/articles/enzoni-gin-campari-cocktail/'),
    ('walter.bergeron', 'hotelmonteleone', 'Head bartender', false, 'https://en.wikipedia.org/wiki/Vieux_Carr%C3%A9_(cocktail)'),
    ('walter.chell', 'calgaryinn', 'Restaurant manager', false, 'https://en.wikipedia.org/wiki/Caesar_(cocktail)')
) AS v("person", "bar", "title", "is_current", "source_url")
JOIN "public"."profiles" pp ON pp.handle = v.person AND pp.kind = 'person'
JOIN "public"."profiles" bp ON bp.handle = v.bar AND bp.kind = 'bar'
ON CONFLICT ("person_profile_id", "bar_profile_id", "title") DO NOTHING;

-- The French Pearl (Audrey Saunders, Pegu Club, 2006): the signature drinks
-- seed (20260930910000) had it, but skipped it while Pegu Club had no profile.
-- Its story and citation, credited to her; no borrowed spec (content_rights).
INSERT INTO "public"."items" ("name", "item_type", "description", "notes", "origin", "origin_bar_profile_id", "creator_profile_id", "origin_year")
SELECT 'French Pearl', 'cocktail', 'A shaken, mint-muddled gin sour with lime and simple syrup, lifted by a small measure of pastis.', 'Audrey Saunders created the French Pearl at Pegu Club in New York in spring 2006, part of her push to get Americans drinking gin and pastis, two spirits few bartenders reached for at the time. The name nods to pastis''s 19th-century French heyday and to the pearly cloud it throws when mixed. It was slower to catch on than her Gin-Gin Mule and Old Cuban, but became a Pegu staple and later turned up on menus in London, Germany and Japan.

Created by Audrey Saunders in 2006.

Spec adapted from Punch (https://punchdrink.com/recipes/french-pearl/).', 'Original', b.id, c.id, 2006
FROM "public"."profiles" b
LEFT JOIN "public"."profiles" c ON c.handle = 'audreysaunders' AND c.kind = 'person'
WHERE b.handle = 'pegu.club.nyc' AND b.kind = 'bar'
  AND NOT EXISTS (SELECT 1 FROM "public"."items" i WHERE i.origin_bar_profile_id = b.id AND lower(i.name) = lower('French Pearl'));

-- --- 3. The drinks ---

CREATE TEMP TABLE "ft_drinks" ("key" text PRIMARY KEY, "name" text NOT NULL, "year" int, "approx" boolean, "family" text, "parent" text, "parent_is_style" boolean,
    "note" text, "creator" text, "co" text[], "bar" text, "src" text, "description" text, "notes" text, "glass" text, "ice" text, "method" text, "item_id" uuid);
INSERT INTO "ft_drinks" ("key", "name", "year", "approx", "family", "parent", "parent_is_style", "note", "creator", "co", "bar", "src", "description", "notes", "glass", "ice", "method") VALUES
    ('rompope', 'Rompope', 1650, true, 'flip', 'punch', true, 'Cooked custard of milk, egg yolks, sugar, vanilla and cinnamon, spiked with cane spirit or rum', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Rompope', 'Mexico''s eggnog: milk, eggs and vanilla cooked into a thin custard, spiked with rum and served chilled in small glasses.', 'Rompope comes from the convent kitchens of Puebla in the 17th century. Tradition credits the Poor Clare nuns of the Convent of Santa Clara (one telling names Sister Eduviges) with turning Spanish egg drinks into a cooked custard laced with cane spirit, though no document proves it and the exact date is unknown. It sits with the flips as an older cousin of English eggnog; the cooking makes it thicker and lets it keep, and it is still sold bottled all over Mexico.

Method: Cook the milk, eggs and vanilla gently into a thin custard, cool it, stir in the rum and serve chilled.

No measures have been published for this one.', 'Small Rocks', NULL, NULL),
    ('milk-punch', 'Milk Punch', 1711, false, 'tiki', 'punch', true, 'Punch curdled with hot milk and strained clear, so it keeps in bottle', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Milk_punch', 'Brandy, citrus and sugar poured into milk, strained clear through cloth and served cold over a large cube: silky, bright and long-keeping.', 'Milk punch is first recorded in William Sacheverell''s 1688 account of Iona, and its earliest printed recipe appears in a 1711 cookbook; Benjamin Franklin wrote out his own in 1763. Pouring punch into milk curdles it, and straining off the curds leaves a clear, smooth drink that keeps for months, which made it a favourite bottled punch of the 18th century. Queen Victoria granted a royal warrant to a milk punch maker in 1838, and today''s clarified punches revive the same trick.

Method: Mix the spirit, citrus and sugar, pour into milk to curdle, strain through cloth until clear and serve over a large cube.

No measures have been published for this one.', 'Rocks', 'Large Cube', NULL),
    ('negus', 'Negus', 1725, true, 'oldfashioned', 'punch', true, 'Hot port or red wine with sugar, lemon and nutmeg', 'francis.negus', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Negus_(drink)', 'Ruby port with lemon juice and a little sugar, lengthened with boiling water and dusted with nutmeg; served hot.', 'The Negus is named for Colonel Francis Negus (died 1732), a royal household official who, as Edmond Malone told it, cooled a heated argument by proposing the wine be diluted with hot water and sugar. It dates to the early 18th century, though no exact year is known. It is punch made small and gentle: warm port, lemon, sugar and nutmeg, and it stayed a fixture of Georgian and Victorian parties.

Method: Build in a warmed glass, stir briefly and dust with grated nutmeg.', NULL, NULL, 'Build'),
    ('fish-house-punch', 'Fish House Punch', 1732, true, 'tiki', 'punch', true, 'Bowl punch of rum, cognac and peach brandy, lemon and sugar, lengthened with water or tea', NULL, ARRAY[]::text[], 'schuylkill.fishing', 'https://en.wikipedia.org/wiki/Fish_House_Punch', 'Cognac and rum with peach liqueur, lemon, sugar and cold black tea, shaken and served long over ice.', 'Fish House Punch belongs to the State in Schuylkill, a Philadelphia fishing club founded in 1732 that still meets today. That founding date is the traditional origin rather than a dated recipe. The original is a bowl punch of Jamaican rum, cognac and peach brandy with lemon and sugar, stretched with water or tea; this single-serve version uses peach liqueur in place of peach brandy.

Method: Shake everything with ice and strain into an ice-filled Collins glass.', 'Collins', 'Cubes', 'Shake'),
    ('sangaree', 'Sangaree', 1736, false, 'oldfashioned', 'punch', true, 'Fortified wine, sugar and nutmeg served short; later port or spirit', NULL, ARRAY[]::text[], NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-407', 'Tawny port shaken with a little sugar, served short over crushed ice with grated nutmeg on top.', 'In 1736 the Gentleman''s Magazine reported a new Madeira punch in London called ''Sangre'', and the French priest Labat had met a ''Sang-Gris'' in Martinique back in 1694. The name comes from the Spanish for blood. It trims punch down to fortified wine, sugar and nutmeg served short; port became the usual base, and spirit versions followed. It shares its roots, and its name, with sangria.

Method: Stir the port and sugar to dissolve, shake with ice, strain over crushed ice and dust with nutmeg.', 'Rocks', 'Crushed', 'Shake'),
    ('grog', 'Grog', 1740, false, 'tiki', 'punch', true, 'Royal Navy rum ration cut with water; sailors added lime and sugar', 'edward.vernon', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Grog', 'Navy-strength rum with lime juice, sugar, water and a couple of dashes of Angostura, shaken and served over ice.', 'In 1740 Admiral Edward Vernon ordered the Royal Navy''s rum ration cut with water to curb drunkenness, and sailors named the mix after his nickname, Old Grog. His order covered only rum and water; crews bought lime and sugar themselves to make it palatable. That sour, sweet, strong and weak balance it shares with Planter''s Punch, and it later lent its name to Don the Beachcomber''s Navy Grog.

Method: Shake with ice, strain into an ice-filled double rocks glass and garnish with a lime wedge.', 'Rocks', 'Cubes', 'Shake'),
    ('gin-sling', 'Gin Sling', 1790, false, 'oldfashioned', 'sling', true, 'The sling made with gin, nutmeg on top', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Gin_sling', 'Genever stirred with a spoon of sugar and a splash of water, served short with a little ice and grated nutmeg.', 'The Oxford English Dictionary dates the gin sling to 1790 as a North American drink: spirit, sugar and water, the plain sling that came before the bittered cocktail. Jerry Thomas printed it in 1862 much like a cold toddy, finished with nutmeg. Holland gin (genever) was the gin of the day; the tall, fruity Singapore Sling of the 20th century is a different drink.

Method: Stir the sugar and water in a rocks glass to dissolve, add the genever and a little ice, and grate nutmeg on top.', 'Rocks', 'Cubes', 'Build'),
    ('mint-julep', 'Mint Julep', 1803, false, 'oldfashioned', 'julep', true, 'Mint, sugar and spirit over crushed ice; brandy at first, bourbon by the 20th century', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Mint_julep', NULL, NULL, NULL, NULL, NULL),
    ('tom-and-jerry', 'Tom and Jerry', 1827, false, 'flip', 'nog', true, 'Served hot: a spiced egg batter cut with brandy, rum and hot milk or water', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Tom_and_Jerry_(drink)', 'Cognac and aged rum stirred into a spiced egg batter and topped with boiling water, served hot in a mug under grated nutmeg.', 'The earliest known print reference is the Salem Gazette in March 1827, describing rum, eggs, sugar and spices. Claims that Pierce Egan (1821) or Jerry Thomas (1847) invented it are unsupported, though Thomas did print it in 1862. A hot member of the eggnog line, it is built from a whipped batter of yolks, whites, sugar and spice made ahead, and became an American Christmas ritual served from matching bowls and mugs.

Method: Pour the cognac and rum into a warmed mug, add the batter, stir while topping with boiling water and dust with nutmeg.', NULL, NULL, 'Build'),
    ('draque', 'El Draque', 1833, false, 'tiki', 'punch', true, 'Cuban aguardiente with mint, lime and sugar, taken as a tonic', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/g/1228/mojito-cocktail/mojito-cocktail-history', 'Cuban cane aguardiente with lime, sugar and mint, taken as a daily tonic; the rough forerunner of the Mojito.', 'In 1833, during one of Havana''s worst cholera epidemics, the writer Ramón de Paula reported taking ''a little Drake'' of aguardiente every day at eleven and feeling fine. The drink mixed crude cane spirit with sugar, lime and mint and was valued as medicine. Its name is often tied to Francis Drake''s 1586 visit to Cuba, but that link is legend. Swap the aguardiente for rum and add soda, and you are on the road to the Mojito.

Method: Muddle the mint with sugar and lime, add the aguardiente and stir.

No measures have been published for this one.', NULL, NULL, 'Build'),
    ('sherry-cobbler', 'Sherry Cobbler', 1838, false, 'highball', 'cobbler', true, 'The defining cobbler: sherry, sugar, orange, crushed ice, a straw', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Cobbler_(drink)', 'Amontillado sherry shaken with sugar and muddled orange, served over crushed ice with berries, mint and a straw.', 'The earliest known mention is in Katherine Jane Ellice''s diary in 1838, and Dickens made it famous in Martin Chuzzlewit (1843). Sherry, sugar and orange over a heap of crushed ice was the defining cobbler and one of the first great American drinks. It needed a straw to get past the ice, and its fame helped spread both the drinking straw and the habit of crushed ice.

Method: Muddle the orange with the syrup, add sherry and ice, shake and strain into a Collins glass of crushed ice; garnish with lemon, berries and mint.', 'Collins', 'Crushed', 'muddle and shake'),
    ('brandy-smash', 'Brandy Smash', 1848, true, 'oldfashioned', 'julep', true, 'A julep on a small plan: less spirit, mint muddled, shorter glass', NULL, ARRAY[]::text[], NULL, 'https://imbibemagazine.com/?p=11809', 'Cognac shaken with fresh mint and a little sugar, strained over ice and crowned with a bouquet of mint sprigs.', 'An 1848 account describes a Brandy Smash, and Jerry Thomas defined the smash in 1862 as ''a julep on a small plan'': less spirit, muddled mint and a shorter glass. The 1850s were the smash decade, and the format has come back with the Whiskey Smash and the Gin Basil Smash. Many versions add seasonal fruit or a few lemon wheels.

Method: Shake with ice, fine strain over a large cube and garnish with mint sprigs.', 'Rocks', 'Large Cube', 'Shake'),
    ('chatham-artillery-punch', 'Chatham Artillery Punch', 1850, true, 'tiki', 'punch', true, 'Bowl punch of whiskey, brandy and rum with lemon and sugar, topped with champagne', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Chatham_Artillery_Punch', 'Bourbon, cognac and Jamaican rum shaken with lemon and demerara syrup, topped with Champagne over ice and dusted with nutmeg.', 'Savannah''s Chatham Artillery militia gave its name to one of America''s strongest punches. The tale that George Washington drank it in 1792 is legend; an 1885 Augusta Chronicle account places it in the 1850s, when the Chatham Artillery welcomed home the Republican Blues, and it won national notice in 1870. Nobody knows who first made it. Whiskey, brandy and rum with lemon and sugar, then Champagne, made it a punch with a reputation.

Method: Shake everything but the Champagne with ice, strain over ice, top with Champagne and grate nutmeg over.', 'Rocks', 'Cubes', 'shake and top'),
    ('pink-gin', 'Pink Gin', 1850, true, 'oldfashioned', 'cocktail', true, 'Drop the sugar: gin and Angostura only', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Pink_gin', 'Plymouth gin stirred with a generous dose of Angostura bitters and served up in a chilled coupe.', 'Pink Gin was fashionable in England from the mid 19th century, and is widely said to come from the Royal Navy, where Angostura was taken for seasickness, though that story is unsourced and the earliest dated reference is from the 1870s. It drops the sugar from the old bittered sling, leaving only gin and bitters. Some serve it with water instead, or rinse the glass with bitters and pour in the gin.

Method: Stir the gin and bitters with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Stir'),
    ('caipirinha', 'Caipirinha', 1856, true, 'tiki', 'punch', true, 'Cachaça muddled with lime wedges and sugar, built over ice', NULL, ARRAY[]::text[], NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-275', NULL, NULL, NULL, NULL, NULL),
    ('prescription-julep', 'Prescription Julep', 1857, false, 'oldfashioned', 'mint-julep', false, 'Split base: cognac with a little rye', NULL, ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.julep.html', 'Cognac with a little rye, mint, sugar and orange bitters, stirred over crushed ice in a julep tin and topped with mint.', 'The Prescription Julep was printed in September 1857 in Harper''s Monthly, inside the article ''A Winter in the South'', as a mock doctor''s prescription. Splitting the base, mostly cognac with a touch of rye, sets it apart from the plain Mint Julep. David Wondrich revived it in his book Imbibe! (2007), and it has been back on bar menus since.

Method: Press the mint with the syrup, add the spirits and bitters, stir with crushed ice, mound more ice on top and garnish with mint and orange peel.', 'Julep Cup', 'Crushed', 'Build'),
    ('milano-torino', 'Milano Torino', 1860, true, 'negroni', 'aperitivo', true, 'The founding pair: equal parts Campari (Milan) and sweet vermouth (Turin) over ice', 'gaspare.campari', ARRAY[]::text[], 'caffecampari.milano', 'https://classbarmag.com/news/fullstory.php/aid/2150/Classic_cocktails:_the_tale_of_the_Milano_Torino.html', NULL, NULL, NULL, NULL, NULL),
    ('black-velvet', 'Black Velvet', 1861, false, 'highball', 'champagne-cocktail', true, 'Stout and champagne half and half, no spirit or sugar', NULL, ARRAY[]::text[], 'brooks.club.london', 'https://en.wikipedia.org/wiki/Black_Velvet_(cocktail)', 'Guinness stout and Champagne in equal parts, layered gently in a flute; no spirit, no sugar.', 'The story goes that a bartender at Brooks''s club in London created it in 1861, after the death of Prince Albert, so the Champagne itself would be in mourning. It is traditional, and no contemporary record has been found. Half stout, half Champagne, it is about as simple as a mixed drink gets, and it is older than the Champagne Cocktail''s first printed recipe in 1862.

Method: Pour the stout into a flute and top gently with Champagne.', 'Flute', NULL, 'Build'),
    ('baltimore-egg-nogg', 'Baltimore Egg Nogg', 1862, false, 'flip', 'nog', true, 'Madeira joins brandy and rum in a bowl nog, no heat', NULL, ARRAY[]::text[], NULL, 'https://blogs.loc.gov/loc/2024/12/lift-a-glass-to-holiday-drinks-gone-by/', 'Cognac, dark rum and Madeira shaken with a whole egg, sugar, cream and milk, served up and dusted with nutmeg.', 'Jerry Thomas printed the Baltimore Egg Nogg in 1862, and it closely follows a recipe Eliza Leslie published in 1837. Where most noggs stick to brandy or rum, this one adds Madeira, the wine Baltimore and the rest of the eastern seaboard drank by the cask. It was made cold in a bowl for a crowd; the single-serve shaken version keeps the same balance.

Method: Shake everything hard with ice, fine strain into a chilled wine glass and grate nutmeg over.', 'Wine', NULL, 'Shake'),
    ('blue-blazer', 'Blue Blazer', 1862, false, 'oldfashioned', 'toddy', true, 'Whisky and boiling water set alight and poured between two mugs', 'jerry.thomas', ARRAY[]::text[], 'eldorado.sf', 'https://en.wikipedia.org/wiki/Jerry_Thomas_(bartender)', 'Blended Scotch and boiling water set alight and thrown in a flaming arc between two mugs, sweetened and finished with lemon zest.', 'Jerry Thomas printed the Blue Blazer in his 1862 guide, and it is said he first worked it out at the El Dorado in Gold Rush San Francisco, though the origin tales are legend. It is a hot toddy turned into theatre: whisky and boiling water are lit and poured back and forth until they mix, then sweetened. It demands practice and care, which is exactly why it made Thomas famous.

Method: Light the warmed whisky, pour it flaming back and forth between two mugs with the boiling water, snuff it out, sweeten and express lemon zest over.', NULL, NULL, 'Build'),
    ('brandy-cocktail', 'Brandy Cocktail', 1862, false, 'oldfashioned', 'cocktail', true, 'The bittered sling made with cognac, with a touch of curacao', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.improved_cocktail.html', 'Cognac stirred with a touch of dry curaçao, gum syrup and bitters, served up in a Nick & Nora with a lemon twist.', 'The Brandy Cocktail was the most popular cocktail of the mid 19th century, and Jerry Thomas recorded it in New York in his 1862 guide rather than inventing it. It is the original bittered sling (spirit, sugar, water, bitters) made with cognac, with a little orange curaçao. Add maraschino and absinthe and you have the Improved Brandy Cocktail; serve it up and dressed and it becomes the Fancy Brandy Cocktail.

Method: Stir with ice, fine strain into a chilled Nick & Nora and express a lemon twist over.', 'Nick & Nora', NULL, 'Stir'),
    ('brandy-crusta', 'Brandy Crusta', 1862, false, 'sidecar', 'crusta', true, 'The defining crusta: brandy cocktail with lemon, curaçao and maraschino, sugared rim, whole lemon peel collar', 'joseph.santini', ARRAY[]::text[], 'jewelofthesouth.1855', 'https://en.wikipedia.org/wiki/Brandy_Crusta', NULL, NULL, NULL, NULL, NULL),
    ('brandy-flip', 'Brandy Flip', 1862, false, 'flip', 'flip', true, 'Brandy as the spirit, whole egg and sugar, later shaken cold instead of heated', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Flip_(cocktail)', 'Cognac shaken with a whole egg and sugar until silky, served up in a coupe under freshly grated nutmeg.', 'Jerry Thomas printed hot and cold brandy flips in 1862 and again in 1887, and E.A. Simmons gave the first printed cold flip in 1874. The colonial flip was ale, spirit and sugar heated with a hot iron; the bar-book version kept the egg and sugar, chose brandy and moved to the shaker. Served cold, it is the template for every modern flip.

Method: Shake with ice, strain back into the shaker, dry shake, fine strain into a chilled coupe and grate nutmeg over.', 'Coupe', NULL, 'dry shake and shake'),
    ('brandy-milk-punch', 'Brandy Milk Punch', 1862, false, 'tiki', 'milk-punch', false, 'Unclarified: brandy shaken with milk or half-and-half, sugar, vanilla, nutmeg', NULL, ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.milk_punch.html', 'Cognac shaken with whole milk and vanilla syrup, served over ice in a highball with grated nutmeg on top.', 'Unlike the older clarified milk punch, this one is simply shaken and served creamy. Jerry Thomas printed a shaken milk punch in his 1862 guide, and that is the model for the brandy milk punch New Orleans still drinks at brunch. Some versions use half-and-half instead of milk, or add a little vanilla extract to plain syrup.

Method: Shake with ice, strain into an ice-filled highball and dust with nutmeg.', 'Highball', 'Cubes', 'Shake'),
    ('brandy-sour', 'Brandy Sour', 1862, false, 'sour', 'sour', true, 'The sour template with brandy as the base', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/g/1133/sour-cocktails/history', 'Cognac shaken with lemon, sugar and egg white with a few dashes of Angostura, served over ice with a lemon wheel and cherry.', 'Jerry Thomas listed the Brandy Sour in 1862 beside the Gin and Santa Cruz Sours, setting out the spirit, citrus and sugar template that runs through the whole sour family. Not to be confused with Cyprus''s Brandy Sour, a long drink with lemon squash and soda from the 1930s. Egg white and bitters are modern additions.

Method: Shake with ice, strain back into the shaker, dry shake and fine strain into an ice-filled rocks glass.', 'Rocks', 'Cubes', 'dry shake and shake'),
    ('fancy-brandy-cocktail', 'Fancy Brandy Cocktail', 1862, false, 'oldfashioned', 'brandy-cocktail', false, 'Strained into a stemmed glass with a twist instead of served on ice', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.improved_cocktail.html', 'Cognac with a little dry curaçao, gum syrup and bitters, served up in a stemmed glass with a twist instead of on ice.', 'Jerry Thomas printed ''Fancy'' versions of his brandy, whiskey and gin cocktails in 1862: the same plain cocktail, strained into a stemmed glass and dressed with lemon peel. It is a small step that marks the move from the plain cocktail toward the Improved Cocktail and, in time, the drinks we serve up today.

Method: Shake with ice, fine strain into a chilled Nick & Nora and garnish with a lemon twist.', 'Nick & Nora', NULL, 'Shake'),
    ('general-harrisons-egg-nogg', 'General Harrison''s Egg Nogg', 1862, false, 'flip', 'nog', true, 'Hard cider replaces spirit and milk', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/en-au/cocktails/recipe/3280/general-harrisons-nogg', 'A whole egg shaken hard with sugar syrup and hard cider, strained into a glass; a light, spirit-free nogg.', 'Jerry Thomas printed General Harrison''s Egg Nogg in 1862, swapping the usual spirit and milk for hard cider. The name points to William Henry Harrison, whose 1840 presidential campaign made hard cider its symbol, but the link is tradition, not record. Modern bartenders often add bourbon or apple brandy and pimento bitters.

Method: Shake hard with ice (cider builds pressure, so hold the shaker firmly) and strain into the glass.', 'Wine', NULL, 'Shake'),
    ('georgia-mint-julep', 'Georgia Mint Julep', 1862, false, 'oldfashioned', 'mint-julep', false, 'Half the brandy swapped for peach brandy', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://www.forgottencocktails.com/the-georgia-mint-julep', 'Cognac and real peach brandy over crushed ice with mint muddled with sugar, served in a silver julep cup.', 'Jerry Thomas printed ''The Real Georgia Mint Julep'' in 1862, replacing part of the brandy in a julep with peach brandy; Captain Marryat had already described a peach and common brandy julep in 1840. It reflects the julep before bourbon took over, when brandy was the usual base. Peach liqueur stands in when true peach brandy is hard to find, but it makes the drink sweeter.

Method: Muddle mint with sugar and a dash of water in a julep cup, add the brandies and crushed ice, stir hard and garnish with more mint.', 'Julep Cup', 'Crushed', 'Build'),
    ('gin-cocktail', 'Gin Cocktail', 1862, false, 'oldfashioned', 'cocktail', true, 'The bittered sling made with Holland gin (genever)', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.improved_cocktail.html', 'Oude genever stirred with dry curaçao, a little rich syrup and bitters, served up in a coupe with a lemon twist.', 'Jerry Thomas''s 1862 Gin Cocktail meant Holland gin, or genever, the malty Dutch spirit that was America''s gin at the time. It is the bittered sling with genever and a touch of curaçao. As Old Tom and then dry gin replaced genever, this drink led through the Martinez toward the Martini.

Method: Stir with ice, fine strain into a chilled coupe and express a lemon twist over.', 'Coupe', NULL, 'Stir'),
    ('gin-flip', 'Gin Flip', 1862, false, 'flip', 'flip', true, 'Gin (Holland or Old Tom style) as the spirit', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Flip_(cocktail)', 'Gin shaken with a whole egg and rich sugar syrup until silky, served up in a coupe and dusted with grated nutmeg.', 'Jerry Thomas listed hot and cold gin flips in his 1862 flip section, alongside brandy, rum and whiskey. Gin then meant Holland gin or sweetened Old Tom, both of which suit egg and sugar better than a sharp dry gin. Cold, shaken and topped with nutmeg, it is the brandy flip''s lighter cousin.

Method: Shake with ice, strain back into the shaker, dry shake, fine strain into a chilled coupe and grate nutmeg over.', 'Coupe', NULL, 'dry shake and shake'),
    ('gin-sour', 'Gin Sour', 1862, false, 'sour', 'sour', true, 'The sour template with gin as the base', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/g/1133/sour-cocktails/history', 'Old Tom gin shaken with lemon, sugar and optional egg white plus Angostura, served over ice with a lemon wheel and cherry.', 'Jerry Thomas included the Gin Sour in his 1862 guide: gin, lemon and sugar, nothing more. It is the hub of the gin sours, and the Clover Club, Bee''s Knees, Southside, Army and Navy, Fitzgerald and Bramble all branch from it. Old Tom keeps it close to the gins of Thomas''s day; egg white is a later, optional touch.

Method: Shake with ice, strain back into the shaker, dry shake and fine strain into an ice-filled rocks glass.', 'Rocks', 'Cubes', 'dry shake and shake'),
    ('hot-apple-toddy', 'Hot Apple Toddy', 1862, false, 'oldfashioned', 'toddy', true, 'Baked apple muddled in, applejack or brandy', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.hot_spiced_rum.html', 'Apple brandy and sugar in a warm mug with a baked apple quarter, topped with boiling water and grated nutmeg.', 'Jerry Thomas included an apple toddy in his 1862 guide, recording a drink already common in American taverns, and Haney''s 1869 manual called for two wine glasses of applejack, sugar and half a baked apple. It is the toddy (spirit, sugar, hot water) made with apple brandy, with the soft baked apple adding body and aroma. A strong winter drink, meant for cold nights.

Method: Stir the sugar into the apple brandy in a warm mug, add a baked apple quarter, top with boiling water and grate nutmeg over.', NULL, NULL, 'Build'),
    ('hot-buttered-rum', 'Hot Buttered Rum', 1862, true, 'flip', 'toddy', true, 'Rum toddy enriched with butter, brown sugar and spice', NULL, ARRAY[]::text[], NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-340', 'Dark rum and hot black tea stirred into a spiced butter and brown sugar batter, served steaming in a mug with star anise.', 'Hot buttered rum is colonial American and poorly documented; Jerry Thomas printed Hot Rum and a Hot Spiced Rum with butter in 1862. It is a rum toddy enriched with butter, sugar and spice, and its 20th-century revival is credited to Kenneth Roberts''s historical novels. This version uses hot tea in place of water.

Method: Warm a mug, stir a tablespoon of batter into hot tea, add the rums and top with more hot tea.', NULL, NULL, 'Build'),
    ('japanese-cocktail', 'Japanese Cocktail', 1862, false, 'oldfashioned', 'brandy-cocktail', false, 'Orgeat replaces sugar and curacao', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/search?s=japanese+cocktail', 'Cognac stirred with orgeat and Boker''s-style bitters, served up in a Nick & Nora with a lemon twist.', 'Jerry Thomas printed the Japanese Cocktail in his 1862 guide. It is usually said to honour the Japanese diplomatic mission that visited New York in 1860, though that is tradition rather than proven. Take the Brandy Cocktail and swap the sugar and curaçao for orgeat, and you get a nutty, softer drink. Some modern versions add lemon juice, pushing it toward the sours.

Method: Stir with ice and the lemon zest, strain into a chilled Nick & Nora and express a lemon twist over.', 'Nick & Nora', NULL, 'Stir'),
    ('port-wine-flip', 'Port Wine Flip', 1862, true, 'flip', 'flip', true, 'Fortified wine replaces the spirit', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Flip_(cocktail)', 'Port shaken with a whole egg and simple syrup, strained into a coupe and dusted with grated nutmeg.', 'The Port Wine Flip is listed with Jerry Thomas''s flips, but Wikipedia can only confirm it in the 1887 edition, so the 1862 date is uncertain. Fortified wine replaces the spirit, which makes it lighter and fruitier. Add a pony of brandy and it becomes the Coffee Cocktail; the IBA''s Porto Flip adds brandy too.

Method: Shake with ice, strain into a coupe and sprinkle with nutmeg.', 'Coupe', NULL, 'Shake'),
    ('pousse-cafe', 'Pousse Café', 1862, false, 'flip', 'duo', true, 'Several liqueurs and brandy layered by density, sipped after coffee', 'joseph.santini', ARRAY[]::text[], 'jewelofthesouth.1855', 'https://library.cocktailkingdom.com/exh.figures.santini_joe.html', 'Liqueurs and spirits layered by density in a small glass, from grenadine at the bottom to overproof rum on top, sipped after coffee.', 'Jerry Thomas printed a pousse café in 1862 credited to ''Santina'', meaning Joseph Santini, who ran the Jewel of the South on Gravier Street in New Orleans from 1855. Thomas apparently did not call for layering; Harry Johnson''s 1882 manual did. The French custom of an after-coffee pousse-café is older, so 1862 marks the first American print, not an invention. Any line-up works if each layer is lighter than the last.

Method: Chill the ingredients and float each carefully over the back of a spoon, in order, into a small glass.', NULL, NULL, 'Build'),
    ('rum-flip', 'Rum Flip', 1862, false, 'flip', 'flip', true, 'The colonial tavern flip (rum, ale, sugar, hot iron) written down as a single drink with egg', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Flip_(cocktail)', 'Rum shaken with a whole egg and rich sugar syrup until silky, served up in a coupe and dusted with grated nutmeg.', 'The colonial tavern flip of the 1690s was beer, rum and sugar heated with a red-hot iron. Jerry Thomas wrote it down in 1862 as both a hot rum flip and a version with egg, and the cold, shaken egg form is the one bartenders make today. Aged rum gives it a rich, spiced character.

Method: Shake with ice, strain back into the shaker, dry shake, fine strain into a chilled coupe and grate nutmeg over.', 'Coupe', NULL, 'dry shake and shake'),
    ('rum-sour', 'Rum Sour', 1862, false, 'sour', 'sour', true, 'The sour template with rum (originally St. Croix rum) as the base', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/g/1133/sour-cocktails/history', 'Aged rum shaken with lime, orange juice, sugar and egg white, served up in a chilled rocks glass with an orange twist.', 'Jerry Thomas printed it as the Santa Cruz Sour, made with St. Croix rum, alongside the Brandy and Gin Sours. It is the sour template with rum, and Jennings Cox reportedly described his unnamed Daiquiri as close to a rum sour. This modern spec brightens it with orange juice and egg white; the original was simply rum, citrus and sugar.

Method: Shake with ice, strain back into the shaker, dry shake and fine strain into a chilled rocks glass.', 'Rocks', NULL, 'dry shake and shake'),
    ('sherry-flip', 'Sherry Flip', 1862, true, 'flip', 'port-wine-flip', false, 'Sherry instead of port', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Flip_(cocktail)', 'Oloroso sherry shaken with a whole egg and simple syrup, served in a copita or small wine glass with grated nutmeg.', 'The Sherry Flip sits beside the Port Wine Flip in Jerry Thomas''s guide, though whether it first appeared in 1862 or 1887 is uncertain. Sherry replaces port: dry, nutty oloroso, with plenty of glycerol, matches the richness of the whole egg. Low in alcohol and creamy, it suits the end of a meal.

Method: Dry shake hard, add ice and shake again, strain into a copita and grate nutmeg over.', 'Wine', NULL, 'dry shake and shake'),
    ('stone-fence', 'Stone Fence', 1862, false, 'oldfashioned', 'sling', true, 'Spirit lengthened with cider', NULL, ARRAY[]::text[], NULL, 'https://www.thefoodhistorian.com/blog/food-history-happy-hour-episode-22-stone-fence-cocktail-19th-century', 'Straight rye whiskey topped with medium-dry apple cider, built over ice in a pint glass and served with straws.', 'Spirit and cider was a colonial habit, and the story that Ethan Allen''s men drank it before taking Ticonderoga in 1775 is folklore. Jerry Thomas printed a whiskey version in 1862. Lengthening a sling with cider makes it one of the earliest ancestors of the highball. Applejack or rum work as the base too.

Method: Pour the whiskey into an ice-filled glass, top with cider and stir.', 'Beer Glass', 'Cubes', 'Build'),
    ('whiskey-cocktail', 'Whiskey Cocktail', 1862, false, 'oldfashioned', 'cocktail', true, 'The bittered sling made with whiskey, printed as a named drink', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Old_fashioned_(cocktail)', 'Rye or bourbon stirred with gum syrup and aromatic bitters, strained into a cocktail glass with a lemon twist.', 'Whiskey cocktails were drunk for decades before Jerry Thomas printed this one as a named drink in his 1862 guide; he compiled it rather than invented it. It is the original bittered sling (spirit, sugar, water, bitters) with whiskey, and the ancestor of the Old Fashioned. Add maraschino and absinthe and you have the Improved Whiskey Cocktail.

Method: Stir with ice, strain into a cocktail glass and garnish with a lemon twist.', 'Coupe', NULL, 'Stir'),
    ('whiskey-flip', 'Whiskey Flip', 1862, false, 'flip', 'flip', true, 'Whiskey as the spirit', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Flip_(cocktail)', 'Whiskey shaken with a whole egg and rich sugar syrup until silky, served up in a coupe and dusted with grated nutmeg.', 'Jerry Thomas printed both a hot and a cold whiskey flip in his 1862 guide. Whiskey stands in for the brandy of the flip template: spirit, whole egg and sugar, shaken until smooth. Bourbon gives it vanilla sweetness and rye a drier, spicier edge.

Method: Shake with ice, strain back into the shaker, dry shake, fine strain into a chilled coupe and grate nutmeg over.', 'Coupe', NULL, 'dry shake and shake'),
    ('whiskey-skin', 'Whiskey Skin', 1862, false, 'oldfashioned', 'toddy', true, 'Hot whisky and sugar with a long lemon peel, no juice', NULL, ARRAY[]::text[], NULL, 'https://archive.org/download/bartendersguide01thom/bartendersguide01thom_djvu.txt', 'Single malt Scotch and a little sugar topped with boiling water in a warm mug, with a long twist of lemon peel and no juice.', 'Jerry Thomas printed the Scotch Whiskey Skin in 1862: Scotch, a piece of lemon peel and boiling water. His recipe has no sugar, which later versions added. It is the toddy pared down, the ''skin'' being the lemon peel that scents the hot whisky. Thomas also listed a Columbia Skin as the Boston version.

Method: Stir the sugar and whisky in a warm mug, add boiling water and a twist of lemon peel.', NULL, NULL, 'Build'),
    ('whiskey-sour', 'Whiskey Sour', 1862, false, 'sour', 'sour', true, 'The sour template with whiskey as the base', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Whiskey_sour', NULL, NULL, NULL, NULL, NULL),
    ('canchanchara', 'Canchánchara', 1868, true, 'tiki', 'punch', true, 'Aguardiente with honey, lime and water, from the mambises in the independence wars', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/original-cuban-cocktail-canchanchara-recipe/', 'Light rum shaken with lime juice and honey syrup, strained over ice in a rocks glass with a lime wedge.', 'The Canchánchara is credited to the mambises, Cuban independence fighters in the Ten Years'' War (1868 to 1878) or the 1895 war, around the Valle de los Ingenios near Trinidad. That is tradition rather than record. Aguardiente, honey, lime and water make it a rustic, punch-like drink. It was once drunk without ice; this modern spec uses light rum and serves it on the rocks.

Method: Shake with ice, strain into an ice-filled rocks glass and garnish with a lime wedge.', 'Rocks', 'Cubes', 'Shake'),
    ('gin-and-tonic', 'Gin and Tonic', 1868, true, 'highball', 'highball', true, 'Gin and quinine tonic water, lime', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Gin_and_tonic', 'London dry gin and tonic water poured over plenty of ice in a tall glass.', 'The gin and tonic grew out of British India, where officers mixed their gin ration with quinine water taken against malaria. Tonic water went on sale in 1858, and the earliest print mention is in the Oriental Sporting Magazine, often dated 1868. It is older than the word highball but built the same way: one spirit lengthened with a mixer over ice. Recipes range from one part gin to one of tonic up to one to three.

Method: Pour the gin and tonic into a chilled glass, then fill with ice.', 'Collins', 'Cubes', 'Build'),
    ('john-collins', 'John Collins', 1869, false, 'highball', 'collins', true, 'Gin punch for one, lengthened with soda (originally genever); today usually made with bourbon', 'john.collins', ARRAY[]::text[], 'limmers.london', 'https://en.wikipedia.org/wiki/John_Collins_(cocktail)', 'Gin shaken with lemon and sugar, strained into an ice-filled Collins glass and lengthened with soda.', 'The drink is named for John Collins, a headwaiter at Limmer''s Hotel in London, and David Wondrich links it to the gin punches of London clubs. Its first recipe, in the Steward and Barkeeper''s Manual of 1869, calls for Old Tom gin, and Harry Johnson (1882) split the John (genever) from the Tom (Old Tom). It is gin punch for one, stretched with soda. In the US a John Collins is now usually made with bourbon.

Method: Shake the gin, lemon and syrup with ice and strain into an ice-filled Collins glass while pouring in the soda.', 'Collins', 'Cubes', 'shake and top'),
    ('pharisaer', 'Pharisäer', 1872, true, 'flip', 'spiked-coffee', true, 'Rum hidden under whipped cream in sweet coffee', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Nordstrand,_Germany', 'Strong hot coffee sweetened with sugar cubes and spiked with dark rum, hidden under a cap of whipped cream; never stirred.', 'Legend places the Pharisäer on the North Frisian island of Nordstrand in the 19th century: at a christening, farmers hid rum in their coffee under whipped cream so the strict pastor, Georg Bleyer, would not smell it, and when he found out he called them Pharisees. English Wikipedia gives 1872, a Danish source 1873, and German Wikipedia only the 19th century; none of it can be proved. It is still drunk through the cream.

Method: Sweeten hot coffee with sugar cubes, add the rum and top with whipped cream without stirring.

No measures have been published for this one.', NULL, NULL, 'Build'),
    ('absinthe-frappe', 'Absinthe Frappe', 1874, true, 'oldfashioned', 'julep', true, 'Absinthe instead of spirit, shaken hard over crushed ice, mint optional', 'cayetano.ferrer', ARRAY[]::text[], 'oldabsinthehouse', 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-212', 'Absinthe and anisette shaken with water and a little sugar, poured over crushed ice and churned until frosty.', 'Cayetano Ferrer is credited with the Absinthe Frappé at the bar now called the Old Absinthe House in New Orleans, which he took over in the early 1870s. The Oxford Companion gives 1872 and treats the invention as a claim; 1874 is the usual popular date. It is a julep with absinthe instead of spirit, shaken hard and served over crushed ice, sometimes with mint.

Method: Shake with ice, fine strain over crushed ice and churn.', 'Rocks', 'Crushed', 'Shake'),
    ('brandy-daisy', 'Brandy Daisy', 1876, false, 'sidecar', 'daisy', true, 'Brandy sour sweetened with orange cordial or curaçao, a splash of seltzer', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Daisy_(cocktail)', 'Cognac stirred with yellow Chartreuse, lemon and sugar, strained over crushed ice in a wine glass and topped with a splash of soda.', 'The Brandy Daisy appears in the 1876 edition of Jerry Thomas''s guide, beside gin, whiskey and Santa Cruz rum daisies; Thomas compiled it rather than invented it. It is a brandy sour sweetened with a liqueur and given a splash of soda. Thomas used orange cordial or curaçao, while later bartenders reached for yellow Chartreuse, as this spec does. Wondrich frames the Margarita as a Brandy Daisy made with tequila.

Method: Stir the first four ingredients with ice, strain over crushed ice, top with soda and stir briefly.', 'Wine', 'Crushed', 'Stir'),
    ('gin-daisy', 'Gin Daisy', 1876, false, 'sidecar', 'daisy', true, 'Gin base; by the 1900s often sweetened with grenadine and served long over crushed ice with soda', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Daisy_(cocktail)', 'Genever shaken with orange liqueur, lemon and a little sugar, served up in a coupe with a splash of soda.', 'The Gin Daisy appears in the 1876 edition of Jerry Thomas''s guide: a gin sour sweetened with orange liqueur and given a splash of soda, served short. By the 1900s it was often sweetened with grenadine instead and served long over crushed ice, a style that leads toward the Monkey Gland. This spec follows Thomas, with genever.

Method: Shake everything but the soda with ice, fine strain into a chilled coupe and top with a splash of soda.', 'Coupe', NULL, 'shake and top'),
    ('gin-fizz', 'Gin Fizz', 1876, false, 'highball', 'fizz', true, 'Gin sour shaken hard and lengthened with a short pour of soda, no ice', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Gin_fizz', 'Gin shaken with lemon and sugar, strained into a glass with no ice and topped with soda.', 'The Gin Fizz was first printed in the appendix to Jerry Thomas''s 1876 Bar-Tender''s Guide; the credit is for print only. It is a gin sour shaken hard and lengthened with a short pour of soda, served without ice and drunk quickly while it fizzes. Egg white makes it a Silver Fizz, yolk a Golden Fizz, and cream and orange flower water the Ramos.

Method: Shake the gin, lemon and syrup with ice, strain into a chilled glass without ice and top with soda.', 'Highball', NULL, 'shake and top'),
    ('improved-brandy-cocktail', 'Improved Brandy Cocktail', 1876, false, 'oldfashioned', 'brandy-cocktail', false, 'Add maraschino and a dash of absinthe', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.improved_cocktail.html', 'Cognac with gum syrup, a little maraschino, a dash of absinthe and bitters, served up with an expressed lemon twist.', 'The Improved Brandy Cocktail comes from the appendix of Jerry Thomas''s 1876 edition, though Cocktail Kingdom notes Thomas may not have written that revision himself. It takes the Brandy Cocktail and adds maraschino and a dash of absinthe, small touches that give it depth. The same improvements, applied to rye, point toward the Sazerac.

Method: Express lemon oils into the shaker, add everything, shake with ice, fine strain into a chilled Nick & Nora and garnish with the twist.', 'Nick & Nora', NULL, 'Shake'),
    ('improved-gin-cocktail', 'Improved Gin Cocktail', 1876, false, 'oldfashioned', 'gin-cocktail', false, 'Add maraschino and absinthe to the Holland Gin Cocktail', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.improved_cocktail.html', 'Oude genever stirred with a touch of maraschino, sugar, absinthe and Angostura, served up with a lemon twist.', 'Jerry Thomas printed it in 1876 as the Improved Holland Gin Cocktail: his Gin Cocktail made with genever, with maraschino and absinthe added. The malty genever stands up well to those accents. Many modern bars make it with Old Tom gin instead.

Method: Stir with ice, strain into a chilled Nick & Nora and express a lemon twist over.', 'Nick & Nora', NULL, 'Stir'),
    ('improved-whiskey-cocktail', 'Improved Whiskey Cocktail', 1876, false, 'oldfashioned', 'whiskey-cocktail', false, 'Add maraschino and a dash of absinthe to the Whiskey Cocktail', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.improved_cocktail.html', 'Rye and bourbon stirred with maraschino, absinthe, gum syrup and bitters, served over a large cube with a lemon twist.', 'The Improved Whiskey Cocktail comes from Jerry Thomas''s 1876 edition: the Whiskey Cocktail plus maraschino and a dash of absinthe. Historians see it as a forerunner of both the Sazerac and the Manhattan. PDT in New York put it back on the menu, and it appears in The PDT Cocktail Book (2011).

Method: Stir with ice, strain over a large cube and express a lemon twist over.', 'Rocks', 'Large Cube', 'Stir'),
    ('tom-collins', 'Tom Collins', 1876, false, 'highball', 'john-collins', false, 'Old Tom gin replaces genever; the name sticks', 'jerry.thomas', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Tom_Collins', NULL, NULL, NULL, NULL, NULL),
    ('whiskey-daisy', 'Whiskey Daisy', 1876, false, 'sidecar', 'daisy', true, 'Whiskey base; later recipes sweeten with yellow Chartreuse', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Daisy_(cocktail)', 'Bourbon shaken with orange liqueur, honey syrup and lemon, strained over crushed ice in a goblet and topped with soda.', 'The Whiskey Daisy appears in the 1876 edition of Jerry Thomas''s guide: a whiskey sour sweetened with a liqueur and finished with a splash of soda. Later recipes swapped the orange liqueur for yellow Chartreuse, the style behind the Daisy de Santiago. This spec keeps the orange liqueur and adds honey.

Method: Shake the first four ingredients with ice, strain over crushed ice and top with a splash of soda.', 'Wine', 'Crushed', 'shake and top'),
    ('old-fashioned', 'Old Fashioned', 1880, false, 'oldfashioned', 'whiskey-cocktail', false, 'The original bittered-sling cocktail ordered ''the old-fashioned way'' as fancier cocktails took over', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Old_fashioned_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('golden-fizz', 'Golden Fizz', 1882, false, 'highball', 'gin-fizz', false, 'Add egg yolk', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Gin_fizz', 'Gin shaken with lemon, sugar and an egg yolk, strained into a fizz glass with no ice and topped with soda.', 'Harry Johnson listed the Golden Fizz in his 1882 manual. It is the Gin Fizz with an egg yolk added, which turns it rich, custardy and golden. It was often taken in the morning, and its siblings are the Silver Fizz (egg white) and the Royal Fizz (whole egg).

Method: Shake the first four ingredients hard with ice, fine strain into a chilled glass and top with soda.', 'Fizz', NULL, 'shake and top'),
    ('manhattan', 'Manhattan', 1882, false, 'martini', 'vermouth-cocktail', true, 'Whiskey cocktail (spirit, sugar, bitters) with Italian vermouth taking the place of most of the sugar', NULL, ARRAY[]::text[], NULL, 'https://www.copenhagendistillery.com/articles/the-history-of-the-manhattan', NULL, NULL, NULL, NULL, NULL),
    ('morning-glory-fizz', 'Morning Glory Fizz', 1882, false, 'highball', 'silver-fizz', false, 'Scotch for gin, absinthe, lemon and lime', 'harry.johnson', ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/morning-glory-fizz', 'Blended Scotch with lemon, lime, sugar, egg white and a few dashes of absinthe, shaken frothy and topped with soda.', 'Harry Johnson''s 1882 manual is the usual first source, though Dale DeGroff cites O.H. Byron (1884); Johnson''s credit is for print. It is the Silver Fizz with Scotch for gin, split lemon and lime, and a few dashes of absinthe. As the name says, it was meant as a morning restorative.

Method: Dry shake, add ice and shake until cold, strain into a glass, top with soda and garnish with orange peel.', 'Fizz', NULL, 'dry shake and shake'),
    ('pompier', 'Pompier', 1882, false, 'martini', 'vermouth-cocktail', true, 'French dry vermouth with creme de cassis, lengthened with soda', NULL, ARRAY[]::text[], NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-439', NULL, NULL, NULL, NULL, NULL),
    ('silver-fizz', 'Silver Fizz', 1882, false, 'highball', 'gin-fizz', false, 'Add egg white', 'harry.johnson', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Gin_fizz', 'Gin shaken with citrus, sugar and egg white, poured into a fizz glass and topped with soda so the foam rises above the rim.', 'Harry Johnson listed the Silver Fizz in his 1882 manual, and the credit is for print only. It is the Gin Fizz with egg white, which gives it a dense white head and a softer texture. It is the parent of the Morning Glory Fizz, and with cream and orange flower water it heads toward the Ramos.

Method: Shake with ice, strain back and dry shake, fine strain into a chilled glass, rest it briefly, then pour soda in from a height.', 'Fizz', NULL, 'dry shake and shake'),
    ('joe-rickey', 'Joe Rickey', 1883, true, 'highball', 'highball', true, 'Whiskey, half a lime and soda, no sugar', 'george.williamson', ARRAY[]::text[], 'shoomakers.dc', 'https://en.wikipedia.org/wiki/Rickey_(cocktail)', 'Bourbon and the juice of half a lime with the shell dropped in, built over ice and filled with soda; no sugar.', 'The Rickey is named for Colonel Joe Rickey, a Democratic lobbyist, and was first made at Shoomaker''s bar in Washington, D.C., around 1883. Bartender George Williamson is often credited, while Wondrich and DeGroff give the credit to Rickey himself; printed citations only start in 1890. Whiskey, lime and soda with no sugar make it one of the first true highballs, and the gin version later took over.

Method: Build over ice in a tall glass and fill with soda.', 'Highball', 'Cubes', 'Build'),
    ('new-york-sour', 'New York Sour', 1883, true, 'sour', 'whiskey-sour', false, 'Float red wine on top', NULL, ARRAY[]::text[], NULL, 'https://barrypopik.com/blog/new_york_sour', NULL, NULL, NULL, NULL, NULL),
    ('adonis', 'Adonis', 1884, true, 'martini', 'vermouth-cocktail', true, 'Dry sherry and sweet vermouth, no spirit', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Adonis_(cocktail)', 'Fino sherry stirred with sweet vermouth and orange bitters, served up with an orange peel; no spirit at all.', 'The Adonis is named for Adonis, the Broadway burlesque hit of 1884, and the earliest print mention found is in The Sun on 27 March 1887. It is often credited to the Waldorf, but the hotel did not open until 1893, so that claim is doubtful. Built only on fortified wines, it is a low-alcohol cousin of the Vermouth Cocktail and the Bamboo.

Method: Stir with ice, strain into a chilled coupe and garnish with an orange peel.', 'Coupe', NULL, 'Stir'),
    ('martinez', 'Martinez', 1884, false, 'martini', 'manhattan', false, 'Old Tom gin in place of whiskey, with maraschino', NULL, ARRAY[]::text[], NULL, 'https://bar-vademecum.eu/the-martini-cocktail-part-4-the-martinez-cocktail/', NULL, NULL, NULL, NULL, NULL),
    ('rock-and-rye', 'Rock and Rye', 1884, true, 'oldfashioned', 'sling', true, 'Rye sweetened with rock candy, often with fruit', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Rock_and_rye', 'Rye whiskey sweetened with rock candy, often with fruit, sipped neat or over ice; also sold bottled as a liqueur.', 'Rock and rye names both a home or bar mix and a bottled liqueur: rye whiskey sweetened with rock candy, often with fruit. Hochstadter''s says it has made one since 1884, and a 1914 Bureau of Chemistry report describes cheap imitations. For years it was a folk remedy for colds. There is no known creator; it is a sling of rye and sugar that became a product.

Method: Dissolve rock candy in rye, with fruit if using, and serve neat or over ice.

No measures have been published for this one.', 'Small Rocks', NULL, 'Build'),
    ('americano', 'Americano', 1885, true, 'negroni', 'milano-torino', false, 'Lengthen the Mi-To with soda water', NULL, ARRAY[]::text[], 'caffecampari.milano', 'https://en.wikipedia.org/wiki/Americano_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('bamboo', 'Bamboo', 1886, false, 'martini', 'adonis', false, 'Dry vermouth in place of sweet: the dry sherry Martini', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/18976/bamboo-diffords-classic-recipe', NULL, NULL, NULL, NULL, NULL),
    ('coffee-cocktail', 'Coffee Cocktail', 1887, false, 'flip', 'port-wine-flip', false, 'Port flip with a pony of brandy; named for its coffee colour, contains no coffee', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Jerry_Thomas_(bartender)', 'Tawny port and cognac shaken with a whole egg and sugar, served up in a wine glass with grated nutmeg; no coffee in it.', 'The Coffee Cocktail was printed in the posthumous 1887 edition of Jerry Thomas''s guide, which itself notes the name is a misnomer: there is no coffee and no bitters, only the colour and froth of a milky coffee. It is the Port Wine Flip with a pony of brandy added.

Method: Shake with ice, strain back into the shaker, dry shake, fine strain into a chilled wine glass and grate nutmeg over.', 'Wine', NULL, 'dry shake and shake'),
    ('saratoga', 'Saratoga', 1887, false, 'martini', 'manhattan', false, 'Split base of brandy and rye', NULL, ARRAY[]::text[], NULL, 'https://cold-glass.com/2010/09/30/saratoga-cocktail/', 'Cognac, rye and sweet vermouth in equal parts, stirred and served up in a coupe, with an optional dash of bitters.', 'The Saratoga appears in the posthumous 1887 edition of Jerry Thomas''s guide, named for the resort town of Saratoga Springs, New York; Thomas did not say which vermouth. It is a Manhattan with a split base of brandy and rye, and an ancestor of the Vieux Carré.

Method: Stir with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Stir'),
    ('martini', 'Martini', 1888, false, 'martini', 'martinez', false, 'Name settles on Martini; over 1888 to 1910s it moves from Old Tom and sweet vermouth to dry gin, dry vermouth and orange bitters', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Martini_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('ramos-gin-fizz', 'Ramos Gin Fizz', 1888, false, 'highball', 'silver-fizz', false, 'Add cream, lemon and lime, orange flower water; shaken very long', 'henry.ramos', ARRAY[]::text[], 'imperialcabinet.nola', 'https://www.diffordsguide.com/encyclopedia/2890/people/henry-c-ramos', NULL, NULL, NULL, NULL, NULL),
    ('fourth-regiment', 'Fourth Regiment', 1889, false, 'martini', 'manhattan', false, 'Equal parts rye and sweet vermouth with celery, orange and Peychaud''s bitters', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/11200/fourth-regiment', 'Rye and sweet vermouth in equal parts with celery, orange and Peychaud''s bitters, stirred and served up with a lemon twist.', 'The Fourth Regiment first appears in an 1889 pamphlet, 282 Mixed Drinks from the Private Records of a Bartender of the Olden Days, and later in Straub (1914) and Charles Baker (1939), who said he picked it up in Bombay. It is a Manhattan made with three bitters, celery among them, which give it a savoury edge.

Method: Stir with ice, fine strain into a chilled coupe and express a lemon twist over.', 'Coupe', NULL, 'Stir'),
    ('cafe-brulot', 'Café Brûlot', 1890, true, 'flip', 'spiked-coffee', true, 'Brandy and curaçao flamed tableside with sugar, citrus peel and spice, then coffee', 'jules.alciatore', ARRAY[]::text[], 'antoines.nola', 'https://www.frenchquarter.com/tradition-cafe-brulot/', 'Cognac flamed tableside with sugar, citrus peel, cloves and cinnamon, then put out with hot strong coffee and served in demitasse cups.', 'Antoine''s in the French Quarter credits Jules Alciatore, son of its founder, with inventing Café Brûlot in the 1890s; the Oxford Companion gives about 1895, and the Jean Lafitte story is folklore. Brandy, curaçao, sugar, peel and spice are set alight in a bowl and ladled flaming over a clove-studded orange spiral before coffee goes in. It grew popular in Prohibition, when coffee made a handy disguise.

Method: Warm and flame the cognac with sugar, peels and spices, ladle it over the orange spiral, then pour in hot coffee to put out the flame.

No measures have been published for this one.', NULL, NULL, 'Build'),
    ('sazerac', 'Sazerac', 1890, true, 'oldfashioned', 'brandy-cocktail', false, 'Peychaud''s bitters and an absinthe-rinsed glass; rye later replaced cognac', 'thomas.handy', ARRAY[]::text[], 'sazerac.coffeehouse', 'https://en.wikipedia.org/wiki/Sazerac', NULL, NULL, NULL, NULL, NULL),
    ('stinger', 'Stinger', 1892, true, 'flip', 'duo', true, 'Brandy and white crème de menthe, a stirred or shaken digestif duo', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Stinger_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('pisco-punch', 'Pisco Punch', 1893, true, 'tiki', 'punch', true, 'Pisco with pineapple gum syrup and lime, served for one', 'duncan.nicol', ARRAY[]::text[], 'bankexchange.sf', 'https://en.wikipedia.org/wiki/Pisco_punch', 'Pisco shaken with pineapple, orange and lemon juice, gomme and muddled clove, served in a Collins glass topped with sparkling wine.', 'Pisco Punch belongs to the Bank Exchange in San Francisco, where Duncan Nicol took over in 1893 and made it famous, though the drink may predate him there. Nicol kept his recipe secret; pisco with pineapple gum syrup and lime is the usual reconstruction. This modern spec adds clove and a splash of sparkling wine. Its cousin the Pisco Sour lives in the sour family.

Method: Muddle the cloves, add everything but the wine and shake with ice, fine strain into a chilled glass and top with sparkling wine.', 'Collins', NULL, 'muddle and shake'),
    ('rob-roy', 'Rob Roy', 1894, true, 'martini', 'manhattan', false, 'Swap rye for blended Scotch', NULL, ARRAY[]::text[], 'waldorfastoria.1893', 'https://en.wikipedia.org/wiki/Rob_Roy_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('whisky-highball', 'Whisky Highball', 1894, true, 'highball', 'highball', true, 'The defining highball: Scotch (later any whisky) and soda over ice', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/articles/the-history-of-the-highball-soda-cocktail', 'Blended Scotch and chilled soda water poured over ice in a highball glass, garnished with a lemon wheel.', 'Brandy and soda came first in Britain, but the Scotch highball defined the form. The word ''high ball'' was first written in 1894 in the play My Friend From India, and Chris Lawlor''s The Mixicologist printed the first recipe in 1895. Patrick Duffy of the Ashland House in New York claimed in a 1927 letter to have served the first Scotch highball in 1894, with shifting dates, and Tommy Dewar also claimed the name.

Method: Pour the whisky and soda into an ice-filled highball and garnish with a lemon wheel.', 'Highball', 'Cubes', 'Build'),
    ('gin-rickey', 'Gin Rickey', 1895, true, 'highball', 'joe-rickey', false, 'Gin for whiskey', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Rickey_(cocktail)', 'Gin shaken with fresh lime and a touch of sugar, strained over ice and topped with soda.', 'The Gin Rickey swapped gin into Colonel Joe Rickey''s whiskey drink and was in print by 1895; its first recipe came in Daly''s Bartenders'' Encyclopedia (1903). It overtook the original and in 2011 became the official cocktail of Washington, D.C. The classic is unsweetened, with the lime shell dropped in the glass; this spec adds a little sugar.

Method: Shake the gin, lime and syrup with ice, strain into an ice-filled highball and top with soda.', 'Highball', 'Cubes', 'shake and top'),
    ('harvard', 'Harvard', 1895, false, 'martini', 'manhattan', false, 'Brandy base, lengthened with a splash of soda', NULL, ARRAY[]::text[], NULL, 'https://cold-glass.com/2012/12/19/the-harvard-cocktail/', 'Cognac stirred with sweet vermouth and Angostura, strained into a chilled coupe, lifted with a splash of soda and an orange twist.', 'The Harvard first appears in George J. Kappeler''s Modern American Drinks (1895): equal parts brandy and Italian vermouth with gum syrup and bitters, stirred and topped with seltzer. In effect it is a brandy Manhattan with a little sparkle. Modern bartenders usually give the cognac two or three parts to one of vermouth and keep the soda to a splash, so it drinks closer to a Manhattan than a long spritz.

Method: Stir the cognac, vermouth and bitters with ice, strain into a chilled coupe, top with soda and garnish with an orange twist.', 'Coupe', NULL, 'Stir'),
    ('horses-neck', 'Horse''s Neck', 1895, true, 'highball', 'highball', true, 'Ginger ale with a whole spiral lemon peel; brandy or bourbon (the ''kick'') added around 1910', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Horse%27s_neck', 'Bourbon and Angostura topped with ginger ale over ice in a tall glass, wrapped in one long spiral of lemon peel.', 'The Horse''s Neck began in the 1890s as a soft drink: ginger ale in a tall glass with a whole lemon peel spiralled inside. Around 1910 drinkers started adding brandy or whiskey, ordering it ''with a kick'', and the spiked version became a Royal Navy favourite. It is one of the simplest highballs, defined more by its garnish than its spirit, and one theory even says the Buck family takes its name from that kick.

Method: Coil a long lemon peel into a highball glass, fill with ice, add bourbon and bitters, and top with ginger ale.', 'Highball', 'Cubes', 'Build'),
    ('liberal', 'Liberal', 1895, false, 'martini', 'manhattan', false, 'Amer Picon in place of (or alongside) the bitters', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/13420/liberal', 'Rye whiskey stirred with sweet vermouth, a little Amer Picon and orange bitters, served up with an orange twist.', 'The Liberal was first printed in George Kappeler''s Modern American Drinks (1895) as whiskey, Amer Picon and syrup, with no vermouth at all. By 1904 Thomas Stuart''s version had added Italian vermouth, giving it the Manhattan shape it keeps today, with the bittersweet orange of Picon standing in for most of the bitters. Picon is hard to find outside France, so bartenders often swap in a similar orange amaro.

Method: Stir all ingredients with ice, strain into a chilled Nick & Nora glass and garnish with an orange twist.', 'Nick & Nora', NULL, 'Stir'),
    ('metropole', 'Metropole', 1895, false, 'martini', 'manhattan', false, 'Brandy and dry vermouth with Peychaud''s and orange bitters', NULL, ARRAY[]::text[], 'hotelmetropole.nyc', 'https://cold-glass.com/2011/11/16/the-metropole-cocktail/', 'Cognac and dry vermouth stirred with a touch of syrup, Peychaud''s and orange bitters, served up with an orange twist and a cherry.', 'This was the house cocktail of New York''s Hotel Metropole, which opened near Times Square in 1889 and has long since closed. Kappeler printed it in Modern American Drinks (dated 1894 or 1895 depending on the source). It is a dry brandy Manhattan: French vermouth instead of Italian, sharpened with Peychaud''s and orange bitters. Some writers tie it to the 1884 Metropolitan, a sweeter brandy Manhattan.

Method: Stir all ingredients with ice, strain into a chilled Nick & Nora glass, express an orange twist and garnish with a cherry.', 'Nick & Nora', NULL, 'Stir'),
    ('daiquiri', 'Daiquiri', 1898, true, 'sour', 'sour', true, 'Cuban rum with lime and sugar', 'jennings.cox', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Daiquiri', NULL, NULL, NULL, NULL, NULL),
    ('gibson', 'Gibson', 1898, true, 'martini', 'martini', false, 'Dry Martini without bitters; later identified by a cocktail onion garnish', NULL, ARRAY[]::text[], 'bohemianclub.sf', 'https://spiritsanddistilling.com/dictionary/id/acref-9780199311132-e-323', 'Gin stirred with dry vermouth and served straight up in a chilled coupe, garnished with a pickled cocktail onion.', 'The Oxford Companion places the Gibson at San Francisco''s Bohemian Club around 1898, with Walter D.K. Gibson as the claimant; the popular story about illustrator Charles Dana Gibson is probably invented. The first printed recipe, in William Boothby''s 1908 book, differed from a dry Martini only by leaving out the bitters. The cocktail onion that now defines it arrived decades later.

Method: Stir gin and vermouth with ice, strain into a chilled coupe and garnish with a cocktail onion.', 'Coupe', NULL, 'Stir'),
    ('marguerite', 'Marguerite', 1898, false, 'martini', 'martinez', false, 'Dry (Plymouth) gin with French vermouth and orange bitters, no sweetener: the first true dry Martini', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/encyclopedia/1083/cocktails/martini-cocktail-and-its-evolution', 'Gin and dry vermouth in equal measure with orange bitters and a few drops of orange curaçao, stirred and served up with a citrus twist.', 'The earliest known Marguerite is in the 1898 book Cocktails: How to Make Them: equal parts Plymouth gin and French vermouth with orange bitters and an olive. Others point to Harry Johnson''s 1900 manual and to Thomas Stuart''s 1904 version, an unsweetened two-to-one mix. Either way, swapping the Martinez''s Old Tom and sweet vermouth for dry gin and French vermouth makes it the bridge to the dry Martini.

Method: Stir all ingredients with ice, strain into a chilled Nick & Nora glass and express an orange or lemon twist over the top.', 'Nick & Nora', NULL, 'Stir'),
    ('mamie-taylor', 'Mamie Taylor', 1899, false, 'highball', 'buck', true, 'Scotch, lime and ginger ale or ginger beer', 'bill.sterritt', ARRAY[]::text[], NULL, 'https://barrypopik.com/blog/mamie_taylor_cocktail', 'Scotch and fresh lime over ice in a highball glass, topped with spicy ginger beer.', 'The Mamie Taylor took its name from the singer Mayme Taylor and is usually traced to Rochester, New York, in 1899, with bartender Bill Sterritt as a tentative creator. It became a national craze in 1900, when one newspaper claimed Texans had drunk it for 30 years as the ''Scotch Lassie''. It is a Buck made with Scotch, and the later Moscow Mule is the same drink with vodka.

Method: Add Scotch and lime to a highball glass, fill with ice and top with ginger beer.', 'Highball', 'Cubes', 'Build'),
    ('bijou', 'Bijou', 1900, false, 'martini', 'martini', false, 'Green Chartreuse joins gin and sweet vermouth in equal parts', 'harry.johnson', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Bijou_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('bronx', 'Bronx', 1900, true, 'martini', 'martini', false, 'Perfect Martini shaken with orange juice', 'johnny.solon', ARRAY[]::text[], 'waldorf.astoria.1893', 'https://en.wikipedia.org/wiki/Bronx_(cocktail)', 'Gin shaken with sweet and dry vermouth and fresh orange juice, strained into a chilled cocktail glass with an orange twist.', 'The Bronx is a Perfect Martini shaken with orange juice, and it was one of the most popular drinks in America before Prohibition. Albert Crockett credited Johnny Solon of the Waldorf-Astoria around 1900, but the earliest Solon credit Barry Popik found is from 1932, while a 1901 paper names J.E. O''Connor of the same hotel. An 1895 Grand Union Hotel list and a Philadelphia claim by Joseph Sormani muddy things further.

Method: Shake all ingredients with ice and strain into a chilled cocktail glass; garnish with an orange twist.', 'Martini', NULL, 'Shake'),
    ('cuba-libre', 'Cuba Libre', 1900, true, 'highball', 'highball', true, 'Rum and cola with lime', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Rum_and_Coke', 'Rum and the juice of a fresh lime over ice in a Collins glass, topped with cola and garnished with a lime wheel.', 'The Cuba Libre (''free Cuba'') is said to have been born in Havana around 1900, soon after the war of independence. The main witness, Fausto Rodríguez, swore in the 1960s that he saw the first one poured in August 1900, but he was by then a Bacardi executive, so the story is disputed. The first printed recipe usually cited is in The Old Waldorf-Astoria Bar Book (1935). The lime is what separates it from a plain rum and Coke.

Method: Add rum to a Collins glass, squeeze in both lime halves, fill with ice, top with cola and stir gently.', 'Collins', 'Cubes', 'Build'),
    ('diamond-fizz', 'Diamond Fizz', 1900, true, 'highball', 'gin-fizz', false, 'Champagne instead of soda', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Fizz_(cocktail)', 'Gin, lemon and sugar shaken and strained into a chilled glass, then topped with brut champagne instead of soda.', 'The Diamond Fizz is a Gin Fizz that trades soda water for champagne. It dates to around the turn of the 20th century, when fizzes were booming in American bars, but no first printed recipe has been found, so the date is approximate. It is a close cousin of the French 75, and some older books call it a Royal Gin Fizz.

Method: Shake gin, lemon and syrup with ice, strain into a chilled glass without ice and top with champagne.', 'Fizz', NULL, 'shake and top'),
    ('green-swizzle', 'Green Swizzle', 1900, true, 'tiki', 'swizzle', true, 'Rum (or gin) with falernum and wormwood bitters, swizzled over shaved ice', NULL, ARRAY[]::text[], 'bridgetownclub.bb', 'https://en.wikipedia.org/wiki/Green_Swizzle', 'Rum and falernum with a spoon of wormwood bitters, swizzled over shaved ice until frosty and strained into a cocktail glass.', 'The Green Swizzle was a Caribbean favourite from the 1890s to the 1930s, most likely from Barbados (the Bridgetown Club is its usual home), though Trinidad''s Queen''s Park Hotel served it too. P.G. Wodehouse made it famous in a 1925 story. The green tint came from wormwood bitters; versions coloured with crème de menthe, like Havana''s Floridita, came later. Rum is standard, though gin was also used.

Method: Combine all ingredients in a tall glass half full of shaved ice, swizzle until the drink is nearly frozen, then strain into a cocktail glass.', 'Coupe', NULL, 'Swizzle'),
    ('ponche-crema', 'Ponche Crema', 1900, true, 'flip', 'nog', true, 'Bottled rum-and-egg cream with lime zest, Venezuela''s Christmas nog', 'eliodoro.gonzalez', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Ponche_crema', 'A thick, chilled cream of milk, eggs, sugar and rum scented with vanilla, nutmeg, cinnamon and lemon rind, poured into small glasses.', 'Ponche crema is Venezuela''s Christmas nog. Home versions vary by region, but the name mostly refers to a bottled product created in Caracas by the chemist and perfumer Eliodoro González P., whose recipe is still secret; sources date his patent to 1900 or 1904. It is an eggnog made shelf-stable and festive, and a similar ponche de crème is made in Trinidad and Tobago.

Method: Blend the milk, eggs, sugar and rum with the spices and lemon rind until smooth, chill well and serve cold in small glasses.

No measures have been published for this one.', 'Small Rocks', NULL, NULL),
    ('puritan', 'Puritan', 1900, true, 'martini', 'martini', false, 'Dry Martini with a spoon of yellow Chartreuse', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/puritan-chartreuse-martini-alaska-cocktail-recipe/', 'London dry gin stirred with dry vermouth, a little yellow Chartreuse and orange bitters, served up with a lemon twist.', 'The Puritan comes from The Cocktail Book: A Sideboard Manual for Gentlemen, published around 1900 (some cite a 1902 edition, and later printings carry the pseudonym R.L. Paget). It is a dry Martini with a spoon of yellow Chartreuse, which adds honey and herbs without hiding the gin. The original leaned on Plymouth gin; modern versions often use London dry.

Method: Stir all ingredients with ice, strain into a chilled Martini glass and garnish with a lemon twist.', 'Martini', NULL, 'Stir'),
    ('sloe-gin-fizz', 'Sloe Gin Fizz', 1900, true, 'highball', 'gin-fizz', false, 'Sloe gin for gin', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/sloe-gin-fizz', 'Sloe gin and dry gin shaken with lemon, sugar and optional egg white, poured over soda in a fizz glass for a fluffy pink head.', 'Sloe gin met the fizz at the start of the 20th century, when the plum-steeped liqueur was a popular bar staple. One claim cites an 1898 Sunset Magazine recipe, and some say Jerry Thomas printed one in 1887, but neither is verified. It is a Gin Fizz with sloe gin doing most of the work, and no creator is known.

Method: Pour a little soda into a fizz glass; dry shake the rest, shake again with ice and strain over the soda.', 'Fizz', NULL, 'dry shake and shake'),
    ('turf', 'Turf', 1900, false, 'martini', 'martini', false, 'Plymouth gin and dry vermouth with absinthe and maraschino, a Tuxedo twin', NULL, ARRAY[]::text[], NULL, 'https://tuxedono2.com/turf-cocktail-recipe', 'Gin and dry vermouth in equal parts with a spoon of maraschino and orange bitters, stirred into an absinthe-rinsed glass.', 'The Turf takes its name from the horse-racing crowd. Harry Johnson''s 1900 manual gives the formula most bartenders use: Plymouth gin, dry vermouth, absinthe, maraschino and orange bitters, which makes it a near twin of the Tuxedo. Sources disagree on the earlier 1884 Turf Club: one account gives Old Tom gin, sweet vermouth and bitters, another gin and dry vermouth.

Method: Stir gin, vermouth, maraschino and bitters with ice, strain into an absinthe-rinsed Nick & Nora glass and garnish with lemon peel.', 'Nick & Nora', NULL, 'Stir'),
    ('tuxedo', 'Tuxedo', 1900, false, 'martini', 'martini', false, 'Equal-parts gin and dry vermouth with maraschino and absinthe', NULL, ARRAY[]::text[], 'tuxedoclub', 'https://en.wikipedia.org/wiki/Tuxedo_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('clover-club', 'Clover Club', 1901, false, 'sour', 'gin-sour', false, 'Raspberry syrup and egg white, often a splash of dry vermouth', NULL, ARRAY[]::text[], 'bellevue.philly', 'https://en.wikipedia.org/wiki/Clover_Club_cocktail', NULL, NULL, NULL, NULL, NULL),
    ('dirty-martini', 'Dirty Martini', 1901, true, 'martini', 'martini', false, 'Olive (muddled, later brine) added for a savoury drink', 'john.e.oconnor', ARRAY[]::text[], 'waldorf.astoria.1893', 'https://vinepair.com/articles/history-martini-olives-superstition', 'Gin stirred with dry vermouth and a measure of olive brine, served up in a chilled Martini glass with skewered green olives.', 'The usual story, passed on by David Wondrich, has John E. O''Connor muddling an olive into a Martini at New York''s Waldorf-Astoria around 1901; it rests on secondary accounts, so treat it as legend. Brine itself first shows up in print in G.H. Steele''s My New Cocktail Book (1930, some say 1931). The brine turns a dry Martini savoury and salty, and the drink later became a vodka favourite too.

Method: Stir all ingredients with ice, strain into a chilled Martini glass and garnish with skewered olives.', 'Martini', NULL, 'Stir'),
    ('perfect-martini', 'Perfect Martini', 1901, true, 'martini', 'martini', false, 'Split the vermouth between dry and sweet', NULL, ARRAY[]::text[], NULL, 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-1394', 'Gin stirred with equal measures of dry and sweet vermouth and a dash of orange bitters, served up with an orange twist.', 'Splitting a Martini''s vermouth between dry and sweet goes back at least to 1901, when the New York Sun described it, and the name ''Perfect'' was in use by the early 1920s, according to the Oxford Companion. It sits between the dry and sweet Martini, and the Savoy Cocktail Book lists it as the Medium Martini. Add orange juice and you have the Bronx.

Method: Stir all ingredients with ice, strain into a chilled Martini glass and express an orange twist over the top.', 'Martini', NULL, 'Stir'),
    ('coronation', 'Coronation', 1903, false, 'martini', 'bamboo', false, 'Bamboo with a little maraschino', 'joseph.rose', ARRAY[]::text[], 'murraybros.newark', 'https://punchdrink.com/recipes/coronation-no-1/', 'Dry vermouth and fino sherry stirred with a spoon of maraschino and orange bitters, served up in a chilled coupe.', 'Joseph Rose of Murray Brothers'' Café in Newark entered this drink in the 1903 Police Gazette bartenders'' contest; accounts differ on whether it won or took second prize. It was first printed in the Hoffman House Bartender''s Guide (1905), and the name probably honours Edward VII''s 1902 coronation. It is essentially a Bamboo sweetened with a little maraschino.

Method: Stir all ingredients with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Stir'),
    ('gin-buck', 'Gin Buck', 1903, true, 'highball', 'buck', true, 'The archetypal Buck: gin, lemon or lime, ginger ale', NULL, ARRAY[]::text[], NULL, 'https://bar-vademecum.eu/gin-buck/', 'Gin and a little fresh lime built over ice in a Collins glass and topped with ginger ale.', 'The Gin Buck is the archetype of the Buck family: spirit, citrus and ginger ale. A 1903 newspaper item described it as that summer''s new fad, a Rickey made with ginger ale instead of soda, and it was still one of two Bucks in Albert Crockett''s Old Waldorf-Astoria Bar Book (1935). Lemon or lime both turn up in old recipes.

Method: Build gin and lime over ice in a Collins glass and top with ginger ale.', 'Collins', 'Cubes', 'Build'),
    ('kir', 'Kir', 1904, true, 'highball', 'cobbler', true, 'Still white wine sweetened with crème de cassis, no ice', NULL, ARRAY[]::text[], 'cafegeorge.dijon', 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-351', 'Chilled dry white wine poured over a small measure of crème de cassis in a wine glass, served without ice.', 'Some say it was first mixed in 1904 by a waiter named Faivre at Café George in Dijon, though the Oxford Companion treats that story as a claim and thinks blanc-cassis is older. It later took the name of Canon Félix Kir, mayor of Dijon from 1945 to 1968; his letter letting Lejay-Lagoute use the name is dated 20 November 1951. The traditional wine is Bourgogne Aligoté.

Method: Pour the crème de cassis into a wine glass and top with chilled white wine.', 'Wine', NULL, 'Build'),
    ('jack-rose', 'Jack Rose', 1905, true, 'sour', 'brandy-sour', false, 'Applejack with grenadine as the sweetener', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Jack_Rose_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('ward-8', 'Ward 8', 1906, false, 'sour', 'whiskey-sour', false, 'Add orange juice and grenadine', NULL, ARRAY[]::text[], 'lockeober.boston', 'https://en.wikipedia.org/wiki/Ward_8_(cocktail)', 'Rye whiskey shaken with lemon, orange juice and a spoon of grenadine, strained into a chilled cocktail glass.', 'Boston legend says the Ward 8 was made at Locke-Ober in 1898 to toast Martin Lomasney''s election win in the city''s Eighth Ward, credited to bartender Tom Hussion, but Hussion only started there in 1900. The earliest written mention is from 1906 (A Bachelor''s Cupboard), with a recipe in the Boston Herald in 1907. It is a whiskey sour with orange juice and grenadine.

Method: Shake rye, lemon, orange and grenadine with ice and strain into a chilled cocktail glass; add a cherry if you like.', 'Coupe', NULL, 'Shake'),
    ('affinity', 'Affinity', 1907, false, 'martini', 'rob-roy', false, 'Split the vermouth sweet and dry, equal parts with the Scotch', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/en-au/cocktails/recipe/19/affinity', 'Scotch, sweet vermouth and dry vermouth in equal parts, stirred with a dash of Angostura and served up with a lemon twist.', 'The Affinity was first seen in The New York Sun on 28 October 1907, then as Scotch, Italian vermouth, sugar and orange bitters. The equal-parts build with both vermouths that bartenders use now came later, and Jacques Straub printed a close version in 1913 as the Express Cocktail. It is a Rob Roy with the vermouth split sweet and dry.

Method: Stir all ingredients with ice, strain into a chilled coupe and express a lemon twist over the top.', 'Coupe', NULL, 'Stir'),
    ('brooklyn', 'Brooklyn', 1908, false, 'martini', 'manhattan', false, 'Add maraschino and Amer Picon; later standard uses dry vermouth', 'jacob.grohusko', ARRAY[]::text[], 'baraccas.nyc', 'https://robertsimonson.substack.com/p/a-brief-history-of-brooklyn-cocktails', NULL, NULL, NULL, NULL, NULL),
    ('casino', 'Casino', 1909, false, 'sidecar', 'crusta', true, 'Old Tom gin cocktail with maraschino, lemon and orange bitters, no sugared rim', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/the-casino', 'Old Tom gin shaken with maraschino, fresh lemon and orange bitters, strained into a chilled Nick & Nora with a cherry.', 'The Casino was first printed in Jacob A. Didier''s The Reminder (1909), then reprinted by Hugo Ensslin in 1916 and by the Savoy Cocktail Book in 1930. It is often described as an Aviation without the violette, and since it came first it may be where the Aviation started. It belongs with the Crusta line, minus the sugared rim.

Method: Shake all ingredients with ice, strain into a chilled Nick & Nora glass and garnish with a maraschino cherry.', 'Nick & Nora', NULL, 'Shake'),
    ('pimms-cup', 'Pimm''s Cup', 1912, true, 'highball', 'highball', true, 'A bottled gin cup lengthened with lemonade or ginger ale, fruit and cucumber', NULL, ARRAY[]::text[], NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-381', 'Pimm''s No. 1 with lemon and a little syrup, topped with ginger ale over ice and piled with cucumber, mint, berries and citrus.', 'James Pimm opened his London oyster bar in 1823, but the Oxford Companion finds no document showing he made the cup himself; what is confirmed is the 1912 trademark and the bottled product. The 1840 date on the label is marketing. Lengthened with lemonade or ginger ale and loaded with fruit, it became the English summer drink and reached the US in the late 1940s.

Method: Stir Pimm''s, lemon and syrup in a Collins glass, add ice, top with ginger ale and the bitters, and garnish generously.', 'Collins', 'Cubes', 'Build'),
    ('alaska', 'Alaska', 1913, false, 'martini', 'martini', false, 'Yellow Chartreuse in place of vermouth', NULL, ARRAY[]::text[], NULL, 'https://cold-glass.com/2023/03/19/a-martini-with-something-in-it-the-alaska-cocktail/', NULL, NULL, NULL, NULL, NULL),
    ('bobby-burns', 'Bobby Burns', 1913, false, 'martini', 'rob-roy', false, 'Add a bar spoon of Benedictine (earlier versions used absinthe)', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/encyclopedia/1075/cocktails/bobby-burns', NULL, NULL, NULL, NULL, NULL),
    ('pink-lady', 'Pink Lady', 1913, false, 'sour', 'clover-club', false, 'Grenadine for raspberry, add applejack', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Pink_lady_(cocktail)', 'Gin and applejack shaken with lemon, grenadine and egg white, strained into a chilled glass with a brandied cherry.', 'The Pink Lady was first printed in Jacques Straub''s 1913 manual and is probably named for The Pink Lady, a 1911 Broadway musical. It is a Clover Club that swaps raspberry for grenadine and adds a measure of applejack, which gives the pretty pink drink more backbone than its reputation suggests.

Method: Dry shake all ingredients, shake again with ice, strain into a chilled coupe and garnish with a brandied cherry.', 'Coupe', NULL, 'dry shake and shake'),
    ('southside', 'Southside', 1913, false, 'sour', 'gin-sour', false, 'Shake fresh mint into a gin sour', NULL, ARRAY[]::text[], NULL, 'https://www.tastingtable.com/1562873/history-southside-cocktail/', 'Gin shaken with lime, sugar and fresh mint, double strained into a chilled coupe and garnished with a mint sprig.', 'The earliest known reference is a 1913 Gordon''s gin advertisement for the ''Gordon''s South Side'' (gin, sugar, lemon and mint over crushed ice), which David Wondrich has cited. Hugo Ensslin printed a South Side Fizz in 1916. The popular origin stories about Chicago gangsters or New York''s 21 Club came later. It is a gin sour with mint, made with lemon or lime.

Method: Gently muddle the mint with the syrup, add the rest, shake with ice and double strain into a chilled coupe.', 'Coupe', NULL, 'muddle and shake'),
    ('bacardi-cocktail', 'Bacardi Cocktail', 1914, true, 'sour', 'daiquiri', false, 'Sweeten with grenadine; must use Bacardi rum', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Bacardi_cocktail', 'White rum shaken with lime, grenadine and a little rich syrup, strained into a chilled coupe with a cherry.', 'Some trace the Bacardi Cocktail to Cuba around 1917 as a Bacardi Daiquiri, with grenadine probably added once it reached the US; a grenadine version may already appear in Jacques Straub''s 1914 book. In 1936 a New York Supreme Court ruling held that the drink must be made with Bacardi rum. It is a pink Daiquiri with a brand written into its name.

Method: Shake all ingredients with ice, strain into a chilled coupe and garnish with a maraschino cherry.', 'Coupe', NULL, 'Shake'),
    ('emerald', 'Emerald', 1914, false, 'martini', 'manhattan', false, 'Irish whiskey and orange bitters', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/the-emerald/', 'Irish whiskey stirred with sweet vermouth and orange bitters, strained into a chilled Nick & Nora with an orange twist.', 'The Emerald is an Irish whiskey Manhattan with orange bitters in place of Angostura. The earliest dated print found is Jacques Straub''s Drinks (1914); stories that it came from Irish bartenders at the Waldorf or from a Rhode Island bar are undocumented. It is simple, but the vermouth and orange flatter Irish whiskey''s lighter, fruitier style.

Method: Stir all ingredients with ice, strain into a chilled Nick & Nora glass and garnish with an orange twist.', 'Nick & Nora', NULL, 'Stir'),
    ('campari-soda', 'Campari Soda', 1915, true, 'negroni', 'aperitivo', true, 'Drop the vermouth: the bitter alone lengthened with seltz', NULL, ARRAY[]::text[], 'camparinoingalleria', 'https://www.wallpaper.com/architecture/campari-soda-bottle-design-history', 'Chilled Campari with a few drops of lemon, topped with very lively soda water in a Collins glass with a single piece of ice.', 'The Campari Seltz was one of the house serves at Davide Campari''s Camparino in Galleria, Milan, which opened in 1915, though bitter with soda water is surely older. It is the aperitivo pared down: the vermouth is dropped and the bitter is simply lengthened. In 1932 Campari began selling it pre-mixed in Fortunato Depero''s conical bottle, still sold today.

Method: Add Campari and lemon to a Collins glass with one small piece of ice and top with cold soda water.', 'Collins', 'Cubes', 'Build'),
    ('el-presidente', 'El Presidente', 1915, false, 'martini', 'manhattan', false, 'Cuban rum with blanc or dry vermouth, orange curacao and grenadine', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/El_Presidente_(cocktail)', 'Gold rum stirred with vermouth, orange curaçao and a touch of grenadine, served up with an orange or lemon peel.', 'The first recipe is in John Escalante''s Manual del Cantinero (Havana, 1915), with bitters. Credits to Eddie Woelke, the Vista Alegre bar or Constantino Ribalaigua are unproven, and since 1915 is a decade before Gerardo Machado took office it probably honoured President Mario García Menocal. It follows the Manhattan pattern with rum. Some use dry vermouth; many bartenders prefer blanc.

Method: Stir all ingredients with ice, strain into a chilled coupe and garnish with an orange or lemon peel.', 'Coupe', NULL, 'Stir'),
    ('singapore-sling', 'Singapore Sling', 1915, true, 'tiki', 'sling', true, 'Gin sling with cherry brandy and Benedictine, later pineapple and grenadine', 'ngiam.tongboon', ARRAY[]::text[], 'longbarsg', 'https://en.wikipedia.org/wiki/Singapore_sling', 'Gin shaken with cherry liqueur, Cointreau, Bénédictine, pineapple, lime, grenadine and Angostura, served long with a pineapple and cherry garnish.', 'Ngiam Tong Boon created it at the Long Bar of Raffles Hotel some time between 1899 and 1915, the year he died; there is no recorded date. Singapore papers mention a pink sling by 1903, and it first appears in print as the Straits Sling (Vermeire, 1922). The pineapple and grenadine Raffles version rests on a 1936 note and may owe more to a 1970s relaunch.

Method: Shake all ingredients with ice and strain into a tall glass; garnish with pineapple and a cherry.', 'Collins', NULL, 'Shake'),
    ('alexander', 'Alexander', 1916, false, 'flip', 'duo', true, 'Spirit and liqueur duo becomes a trio with cream: gin, crème de cacao, cream', NULL, ARRAY[]::text[], NULL, 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-234', 'Gin shaken with white crème de cacao and cream (egg white optional), strained into a chilled coupe and dusted with nutmeg.', 'The original Alexander, equal parts gin, crème de cacao and cream, first appeared in Hugo Ensslin''s Recipes for Mixed Drinks in 1916 (some say 1915). One story credits Troy Alexander, a bartender at Rector''s in New York; another says it honoured Philadelphia pitcher Grover Cleveland Alexander. It turned the spirit and liqueur duo into a creamy trio, and the brandy version later overtook it.

Method: Dry shake all ingredients, shake again with ice, fine strain into a chilled coupe and dust with grated nutmeg.', 'Coupe', NULL, 'dry shake and shake'),
    ('aviation', 'Aviation', 1916, false, 'sidecar', 'casino', false, 'More lemon, maraschino plus crème de violette for colour and perfume', 'hugo.ensslin', ARRAY[]::text[], 'hotelwallick.nyc', 'https://en.wikipedia.org/wiki/Aviation_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('chrysanthemum', 'Chrysanthemum', 1916, true, 'martini', 'vermouth-cocktail', true, 'Dry vermouth leads, with Benedictine and absinthe', 'hugo.ensslin', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Chrysanthemum_(cocktail)', 'Dry vermouth stirred with Bénédictine and a few dashes of absinthe, served up in a chilled Nick & Nora with an orange twist.', 'Hugo Ensslin printed the Chrysanthemum in Recipes for Mixed Drinks (1916 or 1917) in equal parts. The Savoy Cocktail Book (1930) moved it to two parts vermouth to one of Bénédictine and noted it was popular in the American Bar of the liner S.S. Europa. It is a vermouth cocktail with the vermouth in the lead, gentle in strength but rich with honey and anise.

Method: Stir all ingredients with ice, strain into a chilled Nick & Nora glass and express an orange twist over the top.', 'Nick & Nora', NULL, 'Stir'),
    ('creole', 'Creole', 1916, false, 'martini', 'brooklyn', false, 'Benedictine in place of maraschino alongside Amer Picon and sweet vermouth', NULL, ARRAY[]::text[], NULL, 'https://cold-glass.com/2017/12/01/the-creole-cocktail-four-ways/', 'Rye and sweet vermouth in equal measure, stirred with Amer Picon and Bénédictine and served up with a lemon twist.', 'This Creole comes from Hugo Ensslin''s Recipes for Mixed Drinks (New York, 1916): whiskey, Italian vermouth, Amer Picon and Bénédictine. The Savoy Cocktail Book copied it in 1930, and Boothby later numbered it Creole No. 2. Jacques Straub''s 1913 Creole was a different drink of absinthe and vermouth, and Henry Ramos had his own curaçao version. It is a Brooklyn cousin with Bénédictine in place of maraschino.

Method: Stir all ingredients with ice, strain into a chilled coupe and express a lemon twist over the top.', 'Coupe', NULL, 'Stir'),
    ('last-word', 'Last Word', 1916, false, 'sidecar', 'daisy', true, 'Equal parts gin, green Chartreuse, maraschino and lime: two liqueurs do all the sweetening', NULL, ARRAY[]::text[], 'detroitathleticclub', 'https://en.wikipedia.org/wiki/Last_Word_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('pisco-sour', 'Pisco Sour', 1916, true, 'sour', 'whiskey-sour', false, 'Swap whiskey for Peruvian pisco and lemon for lime; egg white and Angostura added later', 'victor.morris', ARRAY[]::text[], 'morrisbar.lima', 'https://en.wikipedia.org/wiki/Pisco_sour', NULL, NULL, NULL, NULL, NULL),
    ('tipperary', 'Tipperary', 1916, false, 'martini', 'bijou', false, 'Irish whiskey in place of gin in the Bijou build', 'hugo.ensslin', ARRAY[]::text[], 'hotelwallick.nyc', 'https://www.cigaraficionado.com/article/the-tipperary-cocktail-for-st-patrick-s-day', 'Irish whiskey stirred with sweet vermouth and green Chartreuse, served up with an orange twist and a cherry.', 'Hugo Ensslin, head bartender at New York''s Hotel Wallick, printed the Tipperary in Recipes for Mixed Drinks (1916 or 1917) in equal parts. Harry MacElhone''s 1922 book pushed the whiskey forward and named green Chartreuse, which is how it is usually made now. It is a Bijou with Irish whiskey in place of gin, and the Chartreuse keeps it bold.

Method: Stir all ingredients with ice, strain into a chilled Nick & Nora glass, express an orange twist and garnish with a cherry.', 'Nick & Nora', NULL, 'Stir'),
    ('grasshopper', 'Grasshopper', 1918, true, 'flip', 'alexander', false, 'Green crème de menthe replaces the spirit: an all-liqueur cream trio', 'philip.guichet', ARRAY[]::text[], 'tujagues', 'https://en.wikipedia.org/wiki/Grasshopper_(cocktail)', 'Green crème de menthe, white crème de cacao and cream shaken hard and strained into a chilled cocktail glass.', 'Tujague''s in New Orleans credits owner Philip Guichet, saying it won second place at a New York contest in 1918, but his 1975 obituary dates that win to 1928 to 1930 and nothing confirms either. Boothby printed a layered Grasshopper in 1908; the earliest creamy recipe found dates from 1950. It is an Alexander where mint liqueur replaces the spirit, making an all-liqueur dessert drink.

Method: Shake all ingredients briskly with ice and strain into a chilled cocktail glass.', 'Coupe', NULL, 'Shake'),
    ('negroni', 'Negroni', 1919, true, 'negroni', 'americano', false, 'Swap the Americano''s soda for gin, orange garnish instead of lemon', 'fosco.scarselli', ARRAY[]::text[], 'caffecasoni.firenze', 'https://www.wsetglobal.com/knowledge-centre/blog/2025/the-disputed-regional-roots-of-the-negroni', NULL, NULL, NULL, NULL, NULL),
    ('white-lady', 'White Lady', 1919, false, 'sidecar', 'daisy', true, '1919: crème de menthe, triple sec and lemon. 1929: gin replaces the crème de menthe, making a gin Sidecar', 'harry.macelhone', ARRAY[]::text[], 'cirosclub.london', 'https://en.wikipedia.org/wiki/White_Lady_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('select-spritz', 'Select Spritz', 1920, true, 'highball', 'spritz', true, 'Venetian bitter aperitivo added to wine and soda, olive garnish', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Select_(ap%C3%A9ritif)', 'Prosecco and Select aperitivo with a splash of soda over lots of ice in a wine glass, garnished with a big green olive.', 'Select was launched in Venice in 1920 by the Pilla brothers, Mario and Vittorio. The Oxford Companion notes that Italians began adding bitters to the wine and soda spritz in the early 20th century, giving the Spritz Veneziano, often made with Select or Campari. Select''s claim to be the first bitter in a spritz is brand lore, but the green olive garnish is its Venetian signature.

Method: Fill a wine glass with ice, pour in prosecco, Select and a splash of soda, stir gently and garnish with a green olive.', 'Wine', 'Cubes', 'Build'),
    ('tinto-de-verano', 'Tinto de Verano', 1920, true, 'highball', 'spritz', true, 'Red wine lengthened with lemon soda', 'federico.vargas', ARRAY[]::text[], 'ventadevargas.cordoba', 'https://en.wikipedia.org/wiki/Tinto_de_verano', 'Dry red wine shaken with lemon syrup, poured over ice and topped with soda, garnished with lemon or seasonal fruit.', 'Punch, citing food writer Alfredo Martín-Gorriz, says Federico Vargas began topping his house red with siphon soda at Venta de Vargas near Córdoba in the 1920s, and locals ordered a ''Vargas''. Wikipedia flags the story as needing a better source, and no document from the time has turned up. Spain''s everyday summer drink is a lighter, simpler cousin of sangria, today usually made with lemon soda.

Method: Shake wine and lemon syrup with ice, pour over fresh ice, top with soda and garnish with fruit.', 'Wine', 'Cubes', 'shake and top'),
    ('bucks-fizz', 'Buck''s Fizz', 1921, false, 'highball', 'champagne-cocktail', true, 'Orange juice and champagne, champagne-heavy (2:1), no ice', 'pat.mcgarry', ARRAY[]::text[], 'bucks.club.london', 'https://en.wikipedia.org/wiki/Buck%27s_fizz', 'Two parts champagne to one of fresh orange juice, poured into a chilled flute without ice and finished with an orange twist.', 'The Buck''s Fizz is credited to Malachy ''Pat'' McGarry at Buck''s Club in London in 1921, though the claim is thinly documented and the club keeps its full recipe secret. It is champagne-heavy, two parts wine to one of juice, which sets it apart from the equal-parts Mimosa. Despite the name it is not a true fizz: no spirit, no sour and no soda.

Method: Pour orange juice into a flute, top with champagne, stir gently and garnish with an orange twist.', 'Flute', NULL, 'Build'),
    ('camerons-kick', 'Cameron''s Kick', 1922, false, 'sour', 'whiskey-sour', false, 'Split Scotch and Irish whiskey, orgeat as the sweetener', 'harry.macelhone', ARRAY[]::text[], NULL, 'https://archive.org/download/savoycocktailboo0000vari/savoycocktailboo0000vari_djvu.txt', 'Scotch and Irish whiskey shaken with lemon and orgeat (egg white optional), strained into a chilled coupe with a lemon twist.', 'The Cameron''s Kick was first printed in Harry MacElhone''s ABC of Mixing Cocktails (1922), written while he worked at Ciro''s in London, and later in the Savoy Cocktail Book (1930). Some credit MacElhone as its creator; others note the book names no author. It is a whiskey sour with a split Scotch and Irish base and almond orgeat as the sweetener.

Method: Shake all ingredients with ice, fine strain into a chilled coupe and express a lemon twist over the top.', 'Coupe', NULL, 'Shake'),
    ('gimlet', 'Gimlet', 1922, false, 'sour', 'sour', true, 'Gin with preserved lime cordial instead of fresh citrus and sugar', NULL, ARRAY[]::text[], NULL, 'https://kindredcocktails.com/review/gimlet', NULL, NULL, NULL, NULL, NULL),
    ('sidecar', 'Sidecar', 1922, false, 'sidecar', 'brandy-crusta', false, 'Drop the sugared rim, peel and bitters; more lemon and orange liqueur, served up', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Sidecar_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('toronto', 'Toronto', 1922, false, 'oldfashioned', 'old-fashioned', false, 'Fernet-Branca joins the sugar and bitters', 'robert.vermeire', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Toronto_(cocktail)', 'Rye whiskey stirred with Fernet-Branca, demerara syrup and Angostura, served up with an orange twist.', 'Robert Vermeire printed it as the Fernet Cocktail (with cognac or rye) in Cocktails: How to Mix Them (London, 1922), noting that Torontonians were fond of it. David Embury gave it the name Toronto in 1948, and Jamie Boudreau revived it in Seattle in 2006. It is an Old Fashioned built around a bracing measure of Fernet.

Method: Stir all ingredients with ice, strain into a chilled coupe and garnish with an orange twist.', 'Coupe', NULL, 'Stir'),
    ('monkey-gland', 'Monkey Gland', 1923, true, 'sidecar', 'gin-daisy', false, 'Orange juice replaces lemon, grenadine sweetens, absinthe accent', 'harry.macelhone', ARRAY[]::text[], 'harrysbar_theoriginal', 'https://en.wikipedia.org/wiki/Monkey_Gland', 'Gin and fresh orange juice shaken with grenadine and a measure of absinthe, strained into a chilled cocktail glass.', 'Harry MacElhone created the Monkey Gland at Harry''s New York Bar in Paris in the early 1920s and named it after Serge Voronoff''s notorious experiments grafting monkey glands onto men. It is a gin sour in the late Daisy style, with orange juice in place of lemon, grenadine for sweetness and absinthe for an aromatic edge.

Method: Shake all ingredients well with ice and strain into a chilled cocktail glass.', 'Coupe', NULL, 'Shake'),
    ('pegu-club', 'Pegu Club', 1923, false, 'sidecar', 'gin-daisy', false, 'Gin with orange curaçao and lime plus Angostura and orange bitters', NULL, ARRAY[]::text[], 'pegu.club.yangon', 'https://en.wikipedia.org/wiki/Pegu_Club_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('scofflaw', 'Scofflaw', 1924, false, 'sour', 'whiskey-sour', false, 'Split the base with dry vermouth, grenadine as sweetener', NULL, ARRAY[]::text[], 'harrysbar_theoriginal', 'https://australianbartender.com.au/2010/01/31/the-scofflaw-cocktail/', 'Rye whiskey and dry vermouth shaken with lemon, grenadine and orange bitters, strained into a chilled glass with a lemon twist.', 'In January 1924 a Boston contest crowned ''scofflaw'' as the word for people who flouted Prohibition, and within days Harry''s New York Bar in Paris had a drink named for it. Harry MacElhone credited a bartender there called Jock, though a Chicago Tribune piece of 21 January 1924 credited Maxim''s in Paris instead. It is a whiskey sour with dry vermouth and grenadine.

Method: Shake all ingredients with ice, strain into a chilled cocktail glass and garnish with a lemon twist.', 'Coupe', NULL, 'Shake'),
    ('champs-elysees', 'Champs-Élysées', 1925, false, 'sidecar', 'sidecar', false, 'Green Chartreuse replaces the orange liqueur, dash of Angostura', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/396/champs-elysees', 'Cognac shaken with green Chartreuse, lemon, rich syrup and Angostura, strained into a chilled coupe with a lemon twist.', 'The Champs-Élysées was first printed in Nina Toye and A.H. Adair''s Drinks Long and Short (London, 1925) and later in the Savoy Cocktail Book. It is a Sidecar that swaps the orange liqueur for green Chartreuse and adds a dash of bitters, giving brandy an herbal lift. Milk & Honey helped bring it back in the modern cocktail revival.

Method: Shake all ingredients with ice, fine strain into a chilled coupe and express a lemon twist over the top.', 'Coupe', NULL, 'Shake'),
    ('hanky-panky', 'Hanky Panky', 1925, true, 'martini', 'martini', false, 'Sweet Martini with a couple of dashes of Fernet-Branca', 'ada.coleman', ARRAY[]::text[], 'americanbarsavoy', 'https://en.wikipedia.org/wiki/Hanky_panky_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('mimosa', 'Mimosa', 1925, true, 'highball', 'bucks-fizz', false, 'Equal parts orange juice and champagne', 'frank.meier', ARRAY[]::text[], 'ritzparis', 'https://spiritsanddistilling.com/dictionary/id/acref-9780199311132-e-365', 'Equal parts well-chilled champagne and fresh orange juice, mixed in a flute and garnished with an orange twist.', 'The Mimosa is usually credited to Frank Meier at the Ritz in Paris around 1925, but his own 1936 book lists it without the mark he used for his creations. Harry Crosby''s diaries mention a mimosa in 1923, and Migliorero in Nice had printed one by 1925. It is the equal-parts cousin of the Buck''s Fizz and became the classic brunch drink.

Method: Make sure both are well chilled, then pour into a flute and serve.', 'Flute', NULL, 'Build'),
    ('barbary-coast', 'Barbary Coast', 1927, false, 'flip', 'alexander', false, 'Splits the base between gin and Scotch', NULL, ARRAY[]::text[], NULL, 'https://alcoholinfusions.com/?p=1731', 'Scotch and gin shaken with white crème de cacao and cream, strained into a chilled coupe and dusted with nutmeg.', 'The earliest known print is Judge Jr.''s Here''s How (1927); it is missing from the 1914 and 1917 manuals, so it looks like a Prohibition drink. The Savoy Cocktail Book (1930) served it long over cracked ice. It is an Alexander that splits the base between gin and Scotch, and its creator is unknown.

Method: Shake all ingredients with ice, fine strain into a chilled coupe and dust with grated nutmeg.', 'Coupe', NULL, 'Shake'),
    ('boulevardier', 'Boulevardier', 1927, false, 'negroni', 'negroni', false, 'Bourbon for gin; modern specs push the whiskey up', 'erskine.gwynne', ARRAY[]::text[], 'harrysbar_theoriginal', 'https://en.wikipedia.org/wiki/Boulevardier_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('french-75', 'French 75', 1927, false, 'highball', 'tom-collins', false, 'Champagne replaces the soda in a Collins, served up or long', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/French_75_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('old-pal', 'Old Pal', 1927, false, 'negroni', 'boulevardier', false, 'Rye or Canadian whisky, and (later) dry vermouth for sweet', 'sparrow.robertson', ARRAY[]::text[], NULL, 'https://cold-glass.com/2013/03/05/the-mystery-of-the-old-pal-cocktail/', 'Rye whiskey, Campari and dry vermouth in equal parts, stirred and served up with a lemon or orange peel.', 'The Old Pal is credited to William ''Sparrow'' Robertson, a Paris sportswriter, and appeared in a 1927 essay by Arthur Moss beside the Boulevardier, then made with Canadian Club and sweet vermouth. A much repeated 1922 date is unverified, and a 1930 edition of MacElhone''s book lists French vermouth, the dry version made today. It was on the first IBA list in 1961 and was dropped in 1987.

Method: Stir all ingredients with ice, strain into a chilled coupe and garnish with a lemon or orange peel.', 'Coupe', NULL, 'Stir'),
    ('bees-knees', 'Bee''s Knees', 1929, false, 'sour', 'gin-sour', false, 'Honey instead of sugar', 'frank.meier', ARRAY[]::text[], 'ritzbar.paris', 'https://en.wikipedia.org/wiki/Bee%27s_knees', NULL, NULL, NULL, NULL, NULL),
    ('lucien-gaudin', 'Lucien Gaudin', 1929, false, 'negroni', 'negroni', false, 'Dry vermouth for sweet, plus Cointreau', NULL, ARRAY[]::text[], 'lechevalpie.paris', 'https://cold-glass.com/2014/12/05/the-lucien-gaudin-cocktail/', 'Dry gin stirred with Campari, dry vermouth and Cointreau, served up with an orange peel.', 'First printed in Cocktails de Paris (1929), credited to a bartender called Charlie at Le Cheval Pie and named for the champion fencer Lucien Gaudin. The original runs three parts gin to one each of Campari, Cointreau and dry vermouth. It looks like a Negroni with dry vermouth and orange liqueur, but it predates the Negroni''s first printing, so the link is one of shape, not descent.

Method: Stir all ingredients with ice, strain into a chilled cocktail glass and garnish with an expressed orange peel.', 'Coupe', NULL, 'Stir'),
    ('mojito', 'Mojito', 1929, false, 'tiki', 'draque', false, 'Aguardiente replaced by white rum, lengthened with soda over ice', NULL, ARRAY[]::text[], NULL, 'https://library.cocktailkingdom.com/exh.essential-drinks.mojito.html', NULL, NULL, NULL, NULL, NULL),
    ('army-and-navy', 'Army and Navy', 1930, false, 'sour', 'gin-sour', false, 'Orgeat as the sweetener', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/recipes/army-navy/', 'Gin shaken with fresh lemon, orgeat and a dash of Angostura, strained into a chilled coupe.', 'The Army and Navy was printed in the Savoy Cocktail Book (1930). David Embury championed it in 1948 while cutting back the orgeat to suit his taste for drier drinks. It is a gin sour sweetened with almond orgeat, which gives it a soft, nutty roundness.

Method: Shake all ingredients with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake'),
    ('between-the-sheets', 'Between the Sheets', 1930, false, 'sidecar', 'sidecar', false, 'Split the base between cognac and white rum', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Between_the_sheets_(cocktail)', 'Cognac and white rum shaken with triple sec and fresh lemon, strained into a chilled coupe with an orange twist.', 'The earliest verified print is the Savoy Cocktail Book (1930). It is often credited to Harry MacElhone at Harry''s New York Bar in Paris, but only because it resembles his Sidecar; other claims point to London''s Berkeley Hotel around 1921 and to a King David Hotel story told by Charles H. Baker in 1939. It is a Sidecar with the base split between cognac and rum.

Method: Shake all ingredients with ice, strain into a chilled coupe and garnish with an orange twist.', 'Coupe', NULL, 'Shake'),
    ('blood-and-sand', 'Blood and Sand', 1930, false, 'martini', 'rob-roy', false, 'Equal parts Scotch, cherry liqueur, sweet vermouth and orange juice, shaken', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Blood_and_Sand_(cocktail)', 'Blended Scotch, cherry liqueur, sweet vermouth and fresh orange juice in equal parts, shaken and strained into a chilled coupe.', 'The Blood and Sand was first printed in the Savoy Cocktail Book (1930) and is named for the 1922 Rudolph Valentino bullfighting film, itself based on Vicente Blasco Ibáñez''s 1909 novel. Harry Craddock probably recorded it rather than invented it. A Scotch and vermouth drink shaken with juice, it sits between the Rob Roy and the sours, and Dale DeGroff revived it in the 1990s.

Method: Shake all ingredients with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake'),
    ('brandy-alexander', 'Brandy Alexander', 1930, true, 'flip', 'alexander', false, 'Brandy replaces gin, dark crème de cacao', NULL, ARRAY[]::text[], NULL, 'https://www.pastemagazine.com/drink/happy-hour-history-the-brandy-alexander', 'Brandy, crème de cacao and cream in equal parts, shaken and strained into a coupe with freshly grated nutmeg.', 'The brandy version of the Alexander appears beside the gin original in the Savoy Cocktail Book (1930) and again in W.J. Tarling''s Café Royal Cocktail Book (1937). Swapping gin for brandy and using dark crème de cacao made a richer dessert drink, and it soon eclipsed the gin version to become the Alexander most people know.

Method: Shake all ingredients with ice, strain into a coupe and dust with grated nutmeg.', 'Coupe', NULL, 'Shake'),
    ('corpse-reviver-1', 'Corpse Reviver #1', 1930, false, 'martini', 'saratoga', false, 'Cognac and apple brandy with sweet vermouth, 2:1:1', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Corpse_Reviver', 'Cognac and Calvados stirred with sweet vermouth and a dash of orange bitters, served up with an orange twist.', 'The Corpse Reviver No. 1 is in Harry Craddock''s Savoy Cocktail Book (London, 1930): two parts cognac, one part Calvados or apple brandy and one part Italian vermouth. Some credit Frank Meier of the Ritz in Paris, though his own 1936 book does not claim it. It belongs to the morning-after family of revivers and drinks like a brandy Manhattan with apple.

Method: Stir all ingredients with ice, strain into a chilled coupe and express an orange twist over the top.', 'Coupe', NULL, 'Stir'),
    ('corpse-reviver-2', 'Corpse Reviver #2', 1930, false, 'sidecar', 'white-lady', false, 'Equal parts with Kina Lillet added, absinthe rinse', 'harry.craddock', ARRAY[]::text[], 'americanbarsavoy', 'https://en.wikipedia.org/wiki/Corpse_Reviver', NULL, NULL, NULL, NULL, NULL),
    ('fifty-fifty', 'Fifty-Fifty', 1930, false, 'martini', 'martini', false, 'Equal parts gin and dry vermouth', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/50-50-martini/', 'Gin and dry vermouth in equal parts with a dash of orange bitters, stirred and served up in a chilled glass.', 'Equal parts gin and vermouth was common before Prohibition (Mahoney printed it around 1905, and Gordon''s sold Fifty-Fifty shakers by 1924), but the name first appears in the Savoy Cocktail Book (1930). Sasha Petraske revived it at Milk & Honey in the early 2000s and Audrey Saunders followed with her Fitty-Fitty. It is the wettest Martini, soft and aromatic.

Method: Stir all ingredients with ice and strain into a chilled Martini, coupe or Nick & Nora glass.', 'Martini', NULL, 'Stir'),
    ('hotel-nacional', 'Hotel Nacional Special', 1930, true, 'sour', 'daiquiri', false, 'Add pineapple juice and apricot brandy', NULL, ARRAY[]::text[], 'hotelnacional.cuba', 'https://www.diffordsguide.com/cocktails/recipe/1383/hotel-nacional', 'White rum shaken with pineapple, lime, apricot liqueur and cane syrup, served up with a lemon twist and a dash of Angostura on top.', 'The Hotel Nacional Special dates from around the 1930 opening of Havana''s Hotel Nacional de Cuba. Credit is disputed between Wil P. Taylor (per Charles H. Baker, 1939), Eddie Woelke of the Casino Nacional (Barman''s Mentor, 1936) and Fred Kaufman. The earliest print is Crockett''s Old Waldorf-Astoria Bar Book (1935), as the National. It is a Daiquiri with pineapple and apricot.

Method: Shake all ingredients with ice, strain into a chilled coupe, express a lemon twist and add a dash of Angostura on top.', 'Coupe', NULL, 'Shake'),
    ('maidens-prayer', 'Maiden''s Prayer', 1930, false, 'sidecar', 'white-lady', false, 'Add orange juice alongside the lemon', NULL, ARRAY[]::text[], 'americanbarsavoy', 'https://kindredcocktails.com/cocktail/maidens-prayer', 'Gin shaken with triple sec, lemon and orange juice, strained into a chilled cocktail glass.', 'The Maiden''s Prayer comes from the Savoy Cocktail Book (1930), compiled by Harry Craddock of the Savoy''s American Bar in London. It is a White Lady with orange juice joining the lemon, which rounds off the sourness. The Savoy also prints a second, different Maiden''s Prayer made with Lillet.

Method: Shake all ingredients with ice and strain into a chilled cocktail glass.', 'Coupe', NULL, 'Shake'),
    ('palmetto', 'Palmetto', 1930, false, 'martini', 'manhattan', false, 'Aged rum in place of whiskey, orange bitters', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/3298/palmetto-cocktail', 'Aged rum and sweet vermouth in equal parts, stirred with orange bitters and served up with an orange twist.', 'The first known print of the Palmetto is the Savoy Cocktail Book (1930), where it called for St. Croix rum. Harry Craddock recorded it, but there is no evidence he created it. It is a rum Manhattan with orange bitters, and an aged rum gives it the depth whiskey usually brings.

Method: Stir all ingredients with ice, strain into a chilled coupe and express an orange twist over the top.', 'Coupe', NULL, 'Stir'),
    ('rattlesnake', 'Rattlesnake', 1930, false, 'sour', 'boston-sour', false, 'Add an absinthe rinse or dash to an egg-white whiskey sour', 'harry.craddock', ARRAY[]::text[], 'americanbarsavoy', 'https://archive.org/download/savoycocktailboo0000vari/savoycocktailboo0000vari_djvu.txt', 'Rye whiskey shaken with lemon, sugar, egg white and a touch of absinthe, strained into a coupe and marked with Angostura.', 'The Rattlesnake is in the Savoy Cocktail Book (1930) as a batch for six: rye, egg whites, sweetened lemon and dashes of absinthe. Harry Craddock compiled the book, but nothing proves he invented the drink. It is a Boston Sour with an absinthe accent, and its modern revival is credited to Will Elliott''s version at Maison Premiere in Brooklyn.

Method: Dry shake all ingredients, shake again with ice, fine strain into a coupe and swirl a few drops of Angostura on the foam.', 'Coupe', NULL, 'dry shake and shake'),
    ('corn-n-oil', 'Corn ''n'' Oil', 1932, false, 'tiki', 'cocktail', true, 'Barbadian rum and falernum with bitters over crushed ice, lime added later', NULL, ARRAY[]::text[], NULL, 'https://spiritsandcocktails.community/t/corn-n-oil-and-falernum/1019', 'Aged Barbados or blackstrap rum stirred over crushed ice with falernum, lime and Angostura in a rocks glass.', 'The often repeated 1911 attribution to a Mr. Yearwood is wrong: forum researchers traced it to a 1990 Barbadian heritage book, and it was withdrawn. The earliest mention found is John Dos Passos''s 1932 novel Nineteen Nineteen, and a 1963 Miami Herald piece places it in Barbados. Murray Stenson''s blackstrap version at Seattle''s Zig Zag Café around 2006 started its revival. Lime is a later addition.

Method: Add all ingredients to a rocks glass, add crushed ice, stir and garnish with a lime wedge.', 'Rocks', 'Crushed', 'Build'),
    ('rum-collins', 'Rum Collins', 1932, true, 'highball', 'tom-collins', false, 'Rum for gin, often lime for lemon', NULL, ARRAY[]::text[], NULL, 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-435', 'Aged rum shaken with lemon, rich syrup and Angostura, strained over ice in a Collins glass and topped with soda.', 'The earliest Rum Collins recipe found is on the 1932 menu of Sloppy Joe''s Bar in Havana, and the Oxford Companion dates the drink to the 1930s, probably spread by Americans drinking in Cuba during Prohibition. It may be older, and no creator is known. It is a Tom Collins with rum, and many bartenders use lime instead of lemon.

Method: Shake rum, lemon, syrup and bitters with ice, strain into an ice-filled Collins glass and top with soda.', 'Collins', 'Cubes', 'shake and top'),
    ('rum-swizzle', 'Rum Swizzle', 1932, false, 'tiki', 'swizzle', true, 'Bermuda version: dark and gold rum with orange, pineapple, falernum and bitters', NULL, ARRAY[]::text[], 'swizzleinn', 'https://www.smithsonianmag.com/travel/story-behind-bermudas-rum-swizzle-cocktail-180971701/', 'Gold and dark rum swizzled over crushed ice with falernum, pineapple, orange, grapefruit, lime, lemon and Angostura.', 'Bermuda''s Swizzle Inn in Bailey''s Bay claims to have created the Rum Swizzle in 1932, though the drink is mentioned in 1930 by Joseph Hergesheimer and St Kitts and Barbados claim swizzles of their own. Bermuda''s version layers dark and gold rum (traditionally Gosling''s) with fruit juices, falernum and bitters, and in 2008 the island legislated over the name.

Method: Pour all ingredients into a Collins glass, two-thirds fill with crushed ice, swizzle until frosty and top with more crushed ice.', 'Collins', 'Crushed', 'Swizzle'),
    ('brown-derby', 'Brown Derby', 1933, false, 'sour', 'whiskey-sour', false, 'Grapefruit for lemon, honey for sugar', NULL, ARRAY[]::text[], 'vendome.hollywood', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-271', 'Bourbon shaken with fresh grapefruit juice and rich honey syrup, strained into a chilled coupe with a grapefruit twist.', 'The name first appears in George Buzza''s Hollywood Cocktails (1933), but the recipe was copied from the Savoy''s De Rigueur (1930), which in turn came from Judge Jr.''s Here''s How (1927), made there with Scotch. The often told origin at Los Angeles'' Cafe Vendome, now closed, is unsupported. It is a whiskey sour with grapefruit and honey, revived by Dale DeGroff in 2002 and by PDT.

Method: Shake all ingredients with ice, strain into a chilled coupe and garnish with a grapefruit twist.', 'Coupe', NULL, 'Shake'),
    ('presbyterian', 'Presbyterian', 1933, true, 'highball', 'whisky-highball', false, 'Split the top between ginger ale and soda', NULL, ARRAY[]::text[], NULL, 'https://kindredcocktails.com/cocktail/presbyterian', 'Scotch whisky over ice in a highball glass, topped with equal soda water and ginger ale and garnished with a lemon slice.', 'The earliest verified print is Julien Proskauer''s What''ll You Have? (1933); bar blogs place it in the 1890s but cite nothing. It is a whisky highball that splits the top between ginger ale and soda, so the ginger stays a hint rather than the main event. The name nods to Scotland''s Presbyterian church, and Scotch is the traditional base, though bourbon and rye versions are common.

Method: Pour Scotch and soda into an ice-filled highball glass, top with ginger ale, stir lightly and garnish with a lemon slice.', 'Highball', 'Cubes', 'Build'),
    ('blinker', 'Blinker', 1934, false, 'sour', 'whiskey-sour', false, 'Grapefruit for lemon, grenadine (later raspberry syrup) for sugar', 'patrick.gavin.duffy', ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/blinker-cocktail-rye-whiskey/', 'Rye whiskey shaken with fresh grapefruit juice and a spoon of raspberry syrup, served up with a grapefruit twist.', 'Patrick Gavin Duffy first printed the Blinker in his Official Mixer''s Manual (New York, 1934), made with rye, grapefruit and grenadine. Ted Haigh''s 2004 revision swapped the grenadine for raspberry syrup, and that is the version most bars pour today. It is a whiskey sour with grapefruit for lemon and fruit syrup for sugar.

Method: Shake all ingredients with ice, strain into a chilled coupe and garnish with a grapefruit twist or raspberries.', 'Coupe', NULL, 'Shake'),
    ('daiquiri-no-3', 'Daiquiri No. 3', 1934, true, 'sour', 'daiquiri', false, 'Add grapefruit juice and maraschino, serve frappe', 'constantino.ribalaigua', ARRAY[]::text[], 'floridita_cuba', 'https://www.diffordsguide.com/cocktails/recipe/2367/daiquiri-no-3', 'White rum blended with lime, rich syrup and a teaspoon each of grapefruit and maraschino, served frappé in a chilled coupe.', 'The third of the numbered daiquiris in El Floridita''s house booklet of 1934 or 1935, credited to head bartender Constantino Ribalaigua Vert in Havana. It keeps the Daiquiri''s rum and lime but adds a little grapefruit and maraschino and blends everything with fine ice. It became the direct template for the Hemingway Special. One account dates it to around 1915, with little evidence.

Method: Blend with about 4 oz crushed ice until smooth and pour into a chilled coupe or wine glass.', 'Coupe', NULL, 'Blitz'),
    ('floridita-daiquiri', 'Floridita Daiquiri', 1934, true, 'sour', 'daiquiri', false, 'Add a little maraschino and serve frappe (blended or on fine ice)', 'constantino.ribalaigua', ARRAY[]::text[], 'floridita_cuba', 'https://www.pbs.org/food/stories/ernest-hemingway', 'White rum, lime, maraschino and sugar blended with crushed ice into a snowy frappé, served in a coupe with a lime wheel.', 'Listed as Daiquiri No. 4 in the Bar La Florida booklet of 1934 or 1935, this is Constantino Ribalaigua Vert''s frozen house daiquiri at El Floridita, Havana. A spoon of maraschino and a blender full of fine ice turn the plain Daiquiri into a slushy frappé. One Catalan source dates it to 1922, and Emilio Gonzalez at the Plaza Hotel is also credited with early frozen daiquiris. The style is the ancestor of every frozen fruit daiquiri.

Method: Blend all ingredients with 1 1/2 cups crushed ice for 20 seconds and pour into a coupe.', 'Coupe', NULL, 'Blitz'),
    ('zombie', 'Zombie', 1934, false, 'tiki', 'tiki', true, 'Three rums, lime, grapefruit, falernum, Don''s Mix, grenadine, absinthe and bitters', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://en.wikipedia.org/wiki/Zombie_(cocktail)', 'Three rums flash-blended with lime, falernum, Don''s Mix, grenadine, a few drops of absinthe and bitters, served in a tall glass over crushed ice.', 'Donn Beach created the Zombie at Don the Beachcomber in Hollywood in 1934, and it became the first tiki drink to win national fame. He kept the formula secret and changed it several times between 1934 and 1956. The original was only recovered when Jeff Berry found it in a former Beachcomber headwaiter''s notebook from around 1937. Its layered rums, spice and potency set the pattern for the whole tiki canon.

Method: Blend with 3/4 cup crushed ice for no more than five seconds, pour into a tall glass, fill with ice and garnish with mint.', 'Collins', 'Crushed', 'Blitz'),
    ('death-in-the-afternoon', 'Death in the Afternoon', 1935, false, 'highball', 'champagne-cocktail', true, 'Absinthe instead of sugar and bitters, topped with champagne', 'ernest.hemingway', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Death_in_the_Afternoon_(cocktail)', 'A jigger of absinthe in a Champagne flute, topped slowly with iced Champagne until the drink turns cloudy.', 'Ernest Hemingway gave this recipe to the 1935 celebrity cocktail book So Red the Nose, or Breath in the Afternoon, borrowing the title of his 1932 bullfighting book. His instructions were simply absinthe in a Champagne glass, topped with iced Champagne until it clouded, and to drink three to five slowly. It swaps the sugar and bitters of the Champagne Cocktail for a heavy pour of absinthe. Modern bars usually use far less absinthe than Hemingway did.

Method: Pour the absinthe into a flute and slowly top with chilled Champagne.', 'Flute', NULL, 'Build'),
    ('muddled-old-fashioned', 'Muddled Fruit Old Fashioned', 1935, true, 'oldfashioned', 'old-fashioned', false, 'Muddle orange slice and cherry with the sugar, often add soda', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Old_fashioned_(cocktail)', 'Bourbon shaken with muddled orange, lemon and cherries, rich syrup and bitters, served over ice in a rocks glass.', 'The fruit-salad Old Fashioned crept in before Prohibition and became the American default after Repeal, around the mid-1930s. Bartenders began muddling an orange slice and cherry with the sugar and bitters, and often added soda, softening the plain whiskey cocktail. No single creator or bar is known, and the date is approximate. The craft revival of the 2000s went back to the plain build, but this style lives on in supper clubs.

Method: Muddle the fruit in a shaker, add the rest, shake with ice and fine strain into an ice-filled rocks glass.', 'Rocks', 'Cubes', 'muddle and shake'),
    ('queens-park-swizzle', 'Queen''s Park Swizzle', 1935, true, 'tiki', 'swizzle', true, 'Demerara rum, lime, sugar and mint swizzled, crowned with Angostura', NULL, ARRAY[]::text[], 'queensparkhotel.tt', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-394', 'Demerara rum, lime, sugar and mint swizzled over crushed ice in a tall glass, crowned with dashes of Angostura bitters.', 'Named for the Queen''s Park Hotel in Port of Spain, Trinidad, now closed. The Oxford Companion notes that it is missing from the hotel''s 1932 drinks booklet, which points to the mid to late 1930s, and it first appears in print in Trader Vic''s 1946 Book of Food and Drink. Vic visited in 1938 and may have shaped the recipe himself. Wikipedia''s 1920s date has no source. Mint and a red cap of bitters set it apart from earlier swizzles.

Method: Muddle mint with syrup in a tall glass, add lime, rum and crushed ice, swizzle, top with more ice and dash bitters over the top.', 'Collins', 'Crushed', 'Swizzle'),
    ('vodka-martini', 'Vodka Martini', 1935, true, 'martini', 'martini', false, 'Vodka in place of gin', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/articles/kangaroo-kicker-cocktail-history/', 'Vodka stirred with dry vermouth and a dash of orange bitters, served up in a chilled martini glass with a lemon twist.', 'Vodka first stepped into the Martini''s place in a 1935 Smirnoff brochure. Oscar Haimo of The Pierre in New York printed it as the Kangaroo Kicker in 1943, Crosby Gaige shortened that to Kangaroo in 1944, and David Embury called it the Vodka Martini in 1948. It is simply the Martini with vodka for gin, and it rode the postwar vodka boom into the mainstream.

Method: Stir with ice, strain into a chilled martini glass and express a lemon twist over the top.', 'Martini', NULL, 'Stir'),
    ('gin-and-it', 'Gin and It', 1936, true, 'martini', 'martini', false, 'Keep the Italian (sweet) vermouth of the 1888 Martini; drop curacao and syrup', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/833/gin-and-it', 'Gin stirred with sweet Italian vermouth and a dash of orange bitters, served up in a chilled coupe with a lemon twist.', 'The name first appears in print in Frank Meier''s The Artistry of Mixing Drinks (1936), written while Meier tended bar in Paris. Dale DeGroff traces the drink to the Sweet Martini of the 1880s and 1890s, later called Gin and Italian and shortened during Prohibition. It keeps the sweet vermouth of the early Martini and drops its curaçao and syrup. It became a London pub staple, traditionally poured without ice.

Method: Stir with ice, fine strain into a chilled coupe and express a lemon twist over the top.', 'Coupe', NULL, 'Stir'),
    ('tequila-daisy', 'Tequila Daisy', 1936, false, 'sidecar', 'brandy-daisy', false, 'Tequila in place of brandy (by legend, the wrong bottle)', 'henry.madden', ARRAY[]::text[], 'turfbar.tijuana', 'https://barrypopik.com/blog/tequila_daisy', 'Blanco tequila shaken with orange curaçao, lemon and grenadine, served up in a coupe with a splash of soda.', 'In July 1936 James Graham, editor of the Moville Mail in Iowa, reported meeting Henry Madden in Tijuana, who said he had made a Tequila Daisy by grabbing the wrong bottle for a Brandy Daisy. The Turf Bar later advertised itself as the drink''s originator. Margarita is Spanish for daisy, which is the main argument that the Margarita is this drink renamed. No spec survives from Madden, so modern versions are reconstructions.

Method: Shake everything but the soda with ice, fine strain into a chilled coupe and top with soda.', 'Coupe', NULL, 'shake and top'),
    ('b-and-b', 'B&B', 1937, true, 'flip', 'duo', true, 'Equal parts brandy and Bénédictine, later bottled premixed', NULL, ARRAY[]::text[], '21club.nyc', 'https://en.wikipedia.org/wiki/B%C3%A9n%C3%A9dictine', 'Cognac and Bénédictine stirred with ice and served over a large cube in a rocks glass with a lemon twist.', 'A simple pairing of brandy and Bénédictine, popularly said to have started at New York''s 21 Club in 1937, though that is likely lore. Bénédictine began selling a bottled B&B for the American market in 1937 or 1938. Brandy floated over Bénédictine already appears as a pousse-café in 1910, so the duo is older than the name.

Method: Stir with ice, strain over a large cube in a rocks glass and express a lemon twist over the top.', 'Rocks', 'Large Cube', 'Stir'),
    ('chancellor', 'Chancellor', 1937, false, 'martini', 'rob-roy', false, 'Port in place of sweet vermouth, plus dry vermouth', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/577/chancellor', 'Scotch stirred with tawny port, dry and bianco vermouth and Creole bitters, served up in a coupe with an orange twist.', 'The Chancellor is listed, without a recipe, in the supplementary list of W. J. Tarling''s Café Royal Cocktail Book (1937), and it most likely began in London. It did not reappear in print until 1977. It reads as a Rob Roy that trades sweet vermouth for port and adds dry vermouth. No creator or bar is known.

Method: Stir with ice, fine strain into a chilled coupe and express an orange twist over the top.', 'Coupe', NULL, 'Stir'),
    ('cobras-fang', 'Cobra''s Fang', 1937, true, 'tiki', 'tiki', true, 'Overproof demerara rum with passion fruit, orange, falernum and absinthe', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://en.wikipedia.org/wiki/Cobra%27s_fang', 'Overproof demerara rum blended with passion fruit syrup, orange, lime, falernum, bitters and absinthe, dusted with cinnamon.', 'A Donn Beach drink from Don the Beachcomber in Hollywood, on the menu by 1941; Jeff Berry''s version dates it to about 1937. Its theatrical name sat alongside the Shark''s Tooth and Nelson''s Blood on Beach''s menus. Wikipedia''s version uses fassionola and two rums, while Berry''s uses a single 151-proof demerara rum with passion fruit. Whether a snake-shaped mug ever existed is still debated.

Method: Blend with crushed ice for five seconds, pour into a tall glass and dust with cinnamon.', NULL, 'Crushed', 'Blitz'),
    ('de-la-louisiane', 'De La Louisiane', 1937, false, 'martini', 'manhattan', false, 'Benedictine, Peychaud''s and absinthe added to a rye and sweet vermouth base', NULL, ARRAY[]::text[], 'lalouisiane.nola', 'https://gumbopages.com/food/beverages/cocktail-louisiane.html', 'Rye stirred with Bénédictine, sweet vermouth, Peychaud''s bitters and absinthe, served up in a coupe with brandied cherries.', 'The house cocktail of Restaurant de la Louisiane in New Orleans, long since closed, printed by Stanley Clisby Arthur in 1937 alongside the Vieux Carré. Its creator is unknown. It builds on a Manhattan of rye and sweet vermouth, adding Bénédictine and the absinthe and Peychaud''s of the Sazerac. Arthur''s original was equal parts rye, Bénédictine and vermouth; modern specs give rye the lead.

Method: Stir with ice, strain into a chilled coupe and garnish with brandied cherries.', 'Coupe', NULL, 'Stir'),
    ('hemingway-daiquiri', 'Hemingway Daiquiri', 1937, true, 'sour', 'daiquiri-no-3', false, 'Double the rum, drop the sugar, keep grapefruit and maraschino', 'constantino.ribalaigua', ARRAY[]::text[], 'floridita_cuba', 'https://wnyc.org/story/the-cocktail-king-of-cuba-the-man-who-invented-hemingways-favorite-daiquiri/', NULL, NULL, NULL, NULL, NULL),
    ('lions-tail', 'Lion''s Tail', 1937, false, 'sour', 'whiskey-sour', false, 'Lime, allspice dram and Angostura', 'la.clarke', ARRAY[]::text[], 'caferoyal.london', 'https://punchdrink.com/articles/resurgence-lions-tail-prohibition-cocktail-recipe/', 'Bourbon shaken with lime, allspice dram, a little sugar and Angostura bitters, served up in a chilled coupe.', 'Printed in W. J. Tarling''s Café Royal Cocktail Book (London, 1937), where it is credited to L. A. Clarke, whose identity is unknown. It is a whiskey sour turned toward the tropics with lime and allspice dram. The drink faded until allspice dram returned to the United States in 2008, and it has been a modern bar favourite since.

Method: Shake with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake'),
    ('missionarys-downfall', 'Missionary''s Downfall', 1937, true, 'tiki', 'tiki', true, 'Rum blended with fresh mint, pineapple, peach brandy, honey and lime', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://vinepair.com/cocktail-recipe/missionarys-downfall/', 'White rum blended with peach liqueur, honey, lime, fresh pineapple and a handful of mint, served frappé in a chilled coupe.', 'A Donn Beach creation from Don the Beachcomber in Hollywood. Jeff Berry points to about 1937, while other sources say the 1940s. Fresh mint and pineapple blended with rum and honey make it one of the lightest and greenest of the early tiki drinks. The mint and rum echo the Mojito, but there is no documented link between the two.

Method: Blend with 1 cup crushed ice for no more than 20 seconds, pour into a chilled coupe and garnish with mint.', 'Coupe', NULL, 'Blitz'),
    ('mizuwari', 'Mizuwari', 1937, true, 'highball', 'whisky-highball', false, 'Still water instead of soda, about two parts water to one of whisky, stirred long over ice', NULL, ARRAY[]::text[], NULL, 'https://www.thereviewmag.co.uk/suntory-whisky/', 'Whisky lengthened with about twice as much cold still water, built over ice in a highball glass and gently stirred.', 'Mizuwari means cut with water, and the serve comes from the Japanese way of drinking shochu. Its date as a whisky drink is uncertain: one source credits Suntory with introducing it in the late 1930s, others point to a Suntory push in the 1960s and 1970s. It is the Whisky Highball with still water in place of soda, and Japanese bartenders treat the long, careful stir as a ritual.

Method: Pour whisky into an ice-filled highball glass, add the water and stir gently.', 'Highball', 'Cubes', 'Build'),
    ('nui-nui', 'Nui Nui', 1937, true, 'tiki', 'tiki', true, 'Single rum with cinnamon, vanilla, allspice dram, orange and lime', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://kindredcocktails.com/cocktail/nui-nui', 'Aged rum shaken with orange, lime, cinnamon and vanilla syrups and allspice dram, served over crushed ice with bitters on top.', 'A Donn Beach drink from Don the Beachcomber in Hollywood. Jeff Berry''s Sippin'' Safari points to about 1937, and today''s recipe is an adaptation of a 1930s original, so the decade is firm even if the year is not. Unlike the multi-rum Zombie family it leans on one rum and a warm spice blend of cinnamon, vanilla and allspice.

Method: Shake with ice, strain over crushed ice and top with a couple of dashes of bitters.', NULL, 'Crushed', 'Shake'),
    ('pearl-diver', 'Pearl Diver', 1937, true, 'tiki', 'tiki', true, 'Rums blended with Gardenia Mix (honey, butter, spices), orange and lime', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://beachbumberry.com/recipe-pearldiver.html', 'Gold and demerara rums blended with lime, orange and Don''s honey-butter Gardenia Mix, strained and served over crushed ice.', 'Donn Beach made the Pearl Diver at Don the Beachcomber in Hollywood; Jeff Berry, who decoded the recipe, dates it to 1937, while another account lists the 1950s. Its secret is the Gardenia Mix, a spiced blend of honey and butter that gives the drink a silky texture. Berry points out that emulsifying butter into a cold drink was decades ahead of modern techniques.

Method: Blend with 4 oz crushed ice for 20 seconds, strain through a fine sieve into a glass and fill with crushed ice.', NULL, 'Crushed', 'Blitz'),
    ('picador', 'Picador', 1937, false, 'sidecar', 'sidecar', false, 'Tequila base and lime: a Margarita in all but name, without salt', NULL, ARRAY[]::text[], 'caferoyal.london', 'https://thenibble.com/REVIEWS/MAIN/cocktails/margarita-recipe.asp', 'Tequila shaken with triple sec and lime and served up in a chilled coupe: a Margarita in all but name, with no salt.', 'The Picador appears in W. J. Tarling''s Café Royal Cocktail Book (London, 1937), as half tequila and a quarter each of orange liqueur and lime. That is 16 years before the name Margarita turns up in print, and writer Eric Felten flagged it as the Margarita''s printed precursor. It is a Sidecar built on tequila and lime. Who first mixed it is unknown.

Method: Shake with ice, fine strain into a chilled coupe and express a lime twist over the top.', 'Coupe', NULL, 'Shake'),
    ('qb-cooler', 'Q.B. Cooler', 1937, true, 'tiki', 'tiki', true, 'Rum cooler with honey, falernum, orange, lime, soda and Angostura', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://en.wikipedia.org/wiki/Q.B._Cooler', 'Three rums flash-blended with orange, lime, honey, falernum, ginger syrup, soda and Angostura, served over crushed ice with mint.', 'A Donn Beach cooler from Don the Beachcomber in Hollywood, named for an aviators'' fraternity (the Quiet Birdmen, per Wikipedia). There is no firm creation date, but it existed by 1937, when Beach said Trader Vic tasted it, and a recipe is said to date from that year. Some argue it shaped Vic''s Mai Tai, which others dispute. Wikipedia''s version adds fassionola and a 151 rum, so specs vary.

Method: Blend with 4 oz crushed ice for five seconds, top up with crushed ice and garnish with mint.', NULL, 'Crushed', 'Blitz'),
    ('rusty-nail', 'Rusty Nail', 1937, false, 'flip', 'duo', true, 'Scotch with Drambuie over ice', NULL, ARRAY[]::text[], NULL, 'https://www.pastemagazine.com/drink/happy-hour-history-the-rusty-nail', 'Scotch and Drambuie stirred over ice in a rocks glass, finished with a citrus peel.', 'The pairing first shows up in London in 1937 as the B.I.F., which also had bitters. Ted Saucier printed it as the Little Club No. 1 in Bottoms Up (1951), and Drambuie fixed the Rusty Nail name between 1963 and 1967. A rival story places its birth in Hawaii in 1942. Dale DeGroff holds that two parts Scotch to one part Drambuie is the classic balance.

Method: Stir with ice and strain over fresh ice in a rocks glass; garnish with a citrus peel if you like.', 'Rocks', 'Cubes', 'Stir'),
    ('scorpion', 'Scorpion', 1937, true, 'tiki', 'tiki', true, 'Rum and brandy punch with orange, lemon and orgeat, often for sharing in a bowl', 'victor.bergeron', ARRAY[]::text[], 'tradervics.oakland', 'https://kindredcocktails.com/cocktail/scorpion', 'Light rum and brandy blended with orange, lemon and orgeat over shaved ice, often made in a big bowl for sharing.', 'Trader Vic openly said he found the Scorpion in Honolulu, at a small bar called The Hut, where it was made with okolehao; he then built his rum and brandy version at Trader Vic''s in Oakland. One account gives about 1937, though no firm date exists for either drink. Bergeron is the adapter rather than the inventor. The sharing bowl version became a tiki bar centrepiece.

Method: Blend with a scoop of shaved ice for five seconds, pour into a glass and add ice to fill.', NULL, 'Shaved', 'Blitz'),
    ('toreador', 'Toreador', 1937, false, 'sidecar', 'picador', false, 'Apricot liqueur in place of Cointreau', NULL, ARRAY[]::text[], 'caferoyal.london', 'https://boothby.com.au/toreador-cocktail-tequila-apricot-brandy', 'Blanco tequila shaken with apricot liqueur, lime and a touch of syrup and saline, served up in a chilled coupe.', 'Printed in the same 1937 Café Royal Cocktail Book (London) as the Picador, with apricot liqueur in place of the orange liqueur. Its creator is unknown. The two read as siblings on the page rather than a documented parent and child, and both predate the Margarita in print. The apricot gives a rounder, fruitier take on the tequila sour.

Method: Shake with ice, fine strain into a chilled coupe and garnish with a lime wedge.', 'Coupe', NULL, 'Shake'),
    ('twentieth-century', 'Twentieth Century', 1937, false, 'sidecar', 'corpse-reviver-2', false, 'White crème de cacao replaces the orange liqueur, more gin', 'ca.tuck', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/20th_century_(cocktail)', 'Gin shaken with Lillet, crème de cacao and lemon, served up in a chilled coupe with a lemon peel.', 'Credited to C. A. Tuck in W. J. Tarling''s Café Royal Cocktail Book (London, 1937) and named after the 20th Century Limited express train between New York and Chicago. Gin, an aromatised wine, a liqueur and lemon give it the shape of a Corpse Reviver No. 2, with crème de cacao instead of orange liqueur. That kinship is structural, not a documented lineage.

Method: Shake with ice and strain into a chilled coupe; garnish with a lemon peel.', 'Coupe', NULL, 'Shake'),
    ('vieux-carre', 'Vieux Carré', 1937, false, 'martini', 'manhattan', false, 'Split rye and cognac base, Benedictine, both Peychaud''s and Angostura', 'walter.bergeron', ARRAY[]::text[], 'hotelmonteleone', 'https://bar-vademecum.eu/vieux-carre/', NULL, NULL, NULL, NULL, NULL),
    ('bloody-mary', 'Bloody Mary', 1939, false, 'highball', 'highball', true, 'Vodka lengthened with seasoned tomato juice: the savoury highball', 'george.jessel', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Bloody_Mary_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('daisy-de-santiago', 'Daisy de Santiago', 1939, false, 'sidecar', 'whiskey-daisy', false, 'Cuban white rum with lime, sweetened and topped with yellow Chartreuse over crushed ice', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/daisy-de-santiago/', 'White rum shaken with lime, sugar and yellow Chartreuse, served over crushed ice in a goblet with soda and mint.', 'First recorded by Charles H. Baker Jr. in The Gentleman''s Companion (1939), who credited an unknown Bacardi bartender in Santiago de Cuba. It follows the daisy style of sweetening a sour with a liqueur, here yellow Chartreuse, over crushed ice. The rum and lime also make it a cousin of the Daiquiri.

Method: Shake everything but the soda with ice, strain over crushed ice in a goblet, top with soda and garnish with mint.', 'Wine', 'Crushed', 'shake and top'),
    ('remember-the-maine', 'Remember the Maine', 1939, false, 'martini', 'manhattan', false, 'Cherry brandy and absinthe added', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Remember_the_Maine_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('fog-cutter', 'Fog Cutter', 1940, true, 'tiki', 'scorpion', false, 'Add gin to the Scorpion''s rum and brandy, float of sherry', 'victor.bergeron', ARRAY[]::text[], 'tradervics.oakland', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-316', 'Rum, brandy and gin shaken with lemon, orange and orgeat, poured into a tall glass and crowned with a float of sherry.', 'The Oxford Companion says Victor Bergeron created it at Trader Vic''s in Oakland by 1940 and first printed it in his 1946 Book of Food and Drink; Wikipedia cites his 1947 Bartender''s Guide and a 1940s menu, and notes rival claims from Don the Beachcomber and others. It builds on the Scorpion''s rum, brandy and orgeat, adds gin and finishes with sherry. Vic later toned it down as the Samoan Fog Cutter.

Method: Shake everything but the sherry with ice, pour unstrained into a tall glass and float the sherry on top.', 'Collins', 'Cubes', 'Shake'),
    ('hurricane', 'Hurricane', 1940, true, 'tiki', 'tiki', true, 'Rums with passion fruit syrup and lemon in a hurricane-lamp glass', 'pat.obrien', ARRAY[]::text[], 'patobriens', 'https://en.wikipedia.org/wiki/Hurricane_(cocktail)', 'Jamaican rum shaken with passion fruit syrup and lemon, served over crushed ice in a tall hurricane glass.', 'The rum Hurricane is credited to Pat O''Brien''s bar in New Orleans in the 1940s, served in a glass shaped like a hurricane lamp. Earlier, unrelated Hurricanes exist: a 1935 drink of whiskey, gin and crème de menthe, and a rum Hurricane at the 1939 World''s Fair. The New Orleans version is a big, simple rum sour sweetened with passion fruit, in the tiki spirit.

Method: Shake with ice, strain into a hurricane glass two-thirds filled with crushed ice, churn and top with more ice.', NULL, 'Crushed', 'Shake'),
    ('mulata-daiquiri', 'Mulata Daiquiri', 1940, true, 'sour', 'daiquiri', false, 'Aged rum with a chocolate liqueur (originally Elixir Bacardi)', NULL, ARRAY[]::text[], 'floridita_cuba', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-372', 'Aged rum shaken with lime, dark and white crème de cacao, rich syrup and saline, served up in a chilled coupe.', 'The Oxford Companion says the Mulata appeared in the early 1940s, apparently at El Floridita in Havana, first made with Elixir Bacardi. Some credit Constante Ribalaigua, while a Cuban book names José María Vázquez, so the creator is uncertain. It darkens the Daiquiri with aged rum and a chocolate liqueur.

Method: Shake with ice, fine strain into a chilled coupe and garnish with a lime wedge.', 'Coupe', NULL, 'Shake'),
    ('navy-grog', 'Navy Grog', 1940, true, 'tiki', 'tiki', true, 'Three rums with honey, lime and grapefruit, soda, served around an ice cone', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://en.wikipedia.org/wiki/Navy_Grog', 'Three rums with lime, grapefruit, honey mix and soda, served very cold in a double rocks glass around a cone of shaved ice.', 'Donn Beach created the Navy Grog at Don the Beachcomber in Hollywood around 1940 (some say 1941), and it stayed on tiki menus for decades. Trader Vic''s version swapped the honey for allspice syrup. The famous ice cone, with the straw running through it, came from Steve Crane''s Luau in 1953. The three-rum base is classic Beach.

Method: Shake with ice and strain into a double rocks glass over a cone of shaved ice (or crushed ice).', 'Rocks', 'Shaved', 'Shake'),
    ('air-mail', 'Air Mail', 1941, false, 'highball', 'french-75', false, 'Rum, lime and honey under champagne', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Airmail_(cocktail)', 'Golden rum shaken with lime and honey syrup, strained over ice in a highball and topped with brut sparkling wine.', 'Its first confirmed printing is W. C. Whitfield''s Here''s How Mixed Drinks (1941), followed by Embury in 1948 and Esquire''s Handbook for Hosts in 1949. A 1930s Bacardi pamphlet may have had it earlier, since Cuba''s airmail service began in 1930, but that is unverified. Rum, lime and honey under Champagne make it a cousin of the French 75. PDT helped revive it around 2011.

Method: Shake rum, lime and honey with ice, strain into an ice-filled highball and top with sparkling wine.', 'Highball', 'Cubes', 'shake and top'),
    ('fancy-free', 'Fancy Free', 1941, false, 'oldfashioned', 'improved-whiskey-cocktail', false, 'Drop the absinthe; maraschino and orange bitters carry the sweetness', 'crosby.gaige', ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/bring-back-the-fancy-free/', 'Bourbon stirred with maraschino liqueur, Angostura and orange bitters, served over a big cube with an orange twist.', 'First printed in Crosby Gaige''s Cocktail Guide and Ladies'' Companion (1941); some say 1940. Gaige''s version was shaken with Fine Arts whiskey and served in a sugar-rimmed glass. It drops the absinthe of the Improved Whiskey Cocktail and lets maraschino and two bitters carry it. Modern bars serve it stirred, like an Old Fashioned.

Method: Stir with ice, strain into a rocks glass over a large cube and garnish with an orange twist.', 'Rocks', 'Large Cube', 'Stir'),
    ('moscow-mule', 'Moscow Mule', 1941, false, 'highball', 'buck', true, 'Vodka and spicy ginger beer, lime, served in a copper mug', 'john.g.martin', ARRAY['jack.morgan']::text[], 'cocknbull.la', 'https://en.wikipedia.org/wiki/Moscow_mule', NULL, NULL, NULL, NULL, NULL),
    ('red-snapper', 'Red Snapper', 1941, false, 'highball', 'bloody-mary', false, 'Gin for vodka (the St. Regis house name)', NULL, ARRAY[]::text[], 'kingcolebar', 'https://www.diffordsguide.com/encyclopedia/496/cocktails/the-history-of-the-bloody-mary', 'Gin rolled with tomato juice, lemon, Worcestershire, hot sauce, celery salt and pepper, served over ice in a Collins glass.', 'Red Snapper was the house name for the tomato drink at the St. Regis King Cole Bar in New York, first documented in Crosby Gaige''s 1941 Cocktail Guide with a recipe attributed to Gaston Lauryssen. It is the Bloody Mary with gin in place of vodka. Some dispute that the early St. Regis drink used gin at all: the earliest gin Red Snapper found is from 1962.

Method: Roll all ingredients with ice between two tins and strain into an ice-filled Collins glass.', 'Collins', 'Cubes', 'Shake'),
    ('royal-bermuda-yacht-club', 'Royal Bermuda Yacht Club', 1941, false, 'sidecar', 'daisy', true, 'Barbados rum and lime sweetened with falernum and a little orange liqueur', NULL, ARRAY[]::text[], NULL, 'https://cold-glass.com/2015/05/23/the-royal-bermuda-yacht-club-cocktail/', 'Rum shaken with lime, falernum and a little orange curaçao, served up in a chilled coupe with a lime wheel.', 'First printed in Crosby Gaige''s Cocktail Guide and Ladies'' Companion (1941), calling for Barbados rum with falernum or sugar and Cointreau or brandy. Trader Vic later printed his own falernum and curaçao version in 1947, so he revised the drink rather than creating it. Who first made it, and whether at the Bermuda club itself, is unconfirmed. It is a daisy sweetened with falernum.

Method: Shake with ice, strain into a chilled coupe and garnish with a lime wheel.', 'Coupe', NULL, 'Shake'),
    ('test-pilot', 'Test Pilot', 1941, true, 'tiki', 'zombie', false, 'Lighter-proof Zombie cousin with Cointreau and falernum', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://vinepair.com/cocktail-recipe/test-pilot/', 'Dark Jamaican and light rum flash-blended with Cointreau, falernum, lime, Pernod and Angostura, served over crushed ice.', 'Donn Beach''s Test Pilot came out of Don the Beachcomber in Hollywood; Jeff Berry''s Grog Log dates it to about 1941, though some say the late 1930s. It is a lighter cousin of the Zombie, using orange liqueur and falernum for sweetness. Steve Crane''s Jet Pilot at The Luau (1958) built directly on it.

Method: Blend with 1 cup ice for about five seconds, pour unstrained into a double rocks glass and top with crushed ice.', 'Rocks', 'Crushed', 'Blitz'),
    ('suffering-bastard', 'Suffering Bastard', 1942, true, 'tiki', 'highball', true, 'Gin and brandy (or bourbon) buck with lime, bitters and ginger beer', 'joe.scialom', ARRAY[]::text[], 'shepheards.cairo', 'https://alcoholprofessor.com/blog/2017/09/12/classic-cocktails-in-history-suffering-bastard', 'Gin and brandy shaken with lime, demerara syrup and Angostura, strained over ginger beer and ice in a tall glass.', 'Joe Scialom created it at Shepheard''s Hotel in Cairo during the Second World War, as a hangover cure for British officers; it was documented by 1943. It is a buck, built on gin and brandy (or bourbon) with ginger beer, and was not tiki at birth. Trader Vic later served an unrelated rum drink under the same name, which is how it entered the tiki canon.

Method: Pour ginger beer into a tall glass, shake the rest with ice, strain in, fill with ice and garnish with mint.', 'Collins', 'Cubes', 'Shake'),
    ('three-dots-and-a-dash', 'Three Dots and a Dash', 1942, true, 'tiki', 'tiki', true, 'Agricole and aged rum with honey, orange, falernum and allspice; Morse code V for Victory', 'donn.beach', ARRAY[]::text[], 'donthebeachcomber.hwood', 'https://vinepair.com/cocktail-college/three-dots-and-a-dash/', 'Aged agricole and aged rum flash-blended with lime, orange, honey, falernum, allspice dram and bitters, served over crushed ice.', 'A Donn Beach drink from Don the Beachcomber in Hollywood during the Second World War (he served from 1942 to 1945); the exact year is unknown. The name is Morse code for V, for Victory, echoed by a garnish of three cherries and a pineapple spear. Jeff Berry republished it in Sippin'' Safari (2007), and Paul McGee named his 2013 Chicago tiki bar after it.

Method: Flash-blend with crushed ice, pour into a tiki mug or Collins glass and garnish with skewered fruit.', 'Collins', 'Crushed', 'Blitz'),
    ('irish-coffee', 'Irish Coffee', 1943, false, 'flip', 'spiked-coffee', true, 'Irish whiskey, brown sugar and coffee under a float of lightly whipped cream', 'joe.sheridan', ARRAY[]::text[], 'foynes.terminal', 'https://www.7x7.com/drink-up-sf-history-how-irish-coffee-came-to-america-1787160730.html', 'Hot coffee sweetened with sugar and spiked with Irish whiskey, under a collar of lightly whipped cream in a warmed glass.', 'Joe Sheridan is credited with making it in 1943 at the Foynes flying boat terminal in Ireland, to warm passengers off a turned-back flight. On 10 November 1952 Stanton Delaplane and Jack Koeppler brought it to the Buena Vista in San Francisco, and Sheridan later tended bar there. A rival claim names the Dolphin pub in Dublin in 1940. The trick is cream whipped just enough to float.

Method: Warm the glass, dissolve sugar in hot coffee, stir in the whiskey and float lightly whipped cream on top.', NULL, NULL, 'Build'),
    ('batida', 'Batida', 1944, false, 'tiki', 'punch', true, 'Cachaça shaken or blended with fruit juice or coconut, often condensed milk', NULL, ARRAY[]::text[], NULL, 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-246', 'Cachaça blended with lime, coconut cream, coconut milk and a little passion fruit, served frothy in a tall glass.', 'Brazil''s batida is cachaça shaken or blended with fruit juice or coconut. The earliest dated print found is João Zarattini''s 1944 Coquetel em Suas Diversas Fórmulas, which calls it the most Brazilian cocktail, while the Oxford Companion places its origins in the late 19th or early 20th century. Condensed milk versions came only after dairy campaigns in the 1960s. This spec is the coconut style, Batida de Coco.

Method: Blend with about 250 ml cracked ice until smooth and pour into a tall glass.', 'Collins', NULL, 'Blitz'),
    ('mai-tai', 'Mai Tai', 1944, false, 'tiki', 'tiki', true, 'Aged Jamaican rum, lime, orange curaçao and orgeat over crushed ice', 'victor.bergeron', ARRAY[]::text[], 'tradervics.oakland', 'https://en.wikipedia.org/wiki/Mai_Tai', NULL, NULL, NULL, NULL, NULL),
    ('cape-codder', 'Cape Codder', 1945, false, 'highball', 'highball', true, 'Vodka and cranberry juice, lime', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Cape_Codder_(cocktail)', 'Vodka and cranberry juice built over ice in a highball glass, finished with a lime wedge.', 'Ocean Spray promoted vodka with cranberry juice as the Red Devil in 1945, from its growers'' base on Cape Cod, Massachusetts. The Cape Codder name took over in the early 1960s. It is a two-ingredient highball, and proportions vary widely between sources. It later fed into the Cosmopolitan line.

Method: Build vodka and cranberry juice over ice in a highball glass and garnish with a lime wedge.', 'Highball', 'Cubes', 'Build'),
    ('greyhound', 'Greyhound', 1945, false, 'highball', 'highball', true, 'Gin (later vodka) and grapefruit juice', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Greyhound_(cocktail)', 'Vodka and fresh grapefruit juice built over ice in a highball glass, with a grapefruit twist or wheel.', 'Harper''s Magazine named the Greyhound in 1945, as a drink served in Greyhound bus terminal restaurants. A gin and grapefruit cocktail already appears in the Savoy Cocktail Book (1930). It began with gin and moved to vodka after the Second World War. With a salted rim it becomes the Salty Dog.

Method: Build in a highball glass over ice and garnish with a grapefruit twist or wheel.', 'Highball', 'Cubes', 'Build'),
    ('pink-squirrel', 'Pink Squirrel', 1945, true, 'flip', 'grasshopper', false, 'Crème de noyaux replaces crème de menthe: pink and almondy', 'bryant.sharp', ARRAY[]::text[], 'bryantslounge', 'https://en.wikipedia.org/wiki/Pink_Squirrel', 'Crème de noyaux and white crème de cacao shaken with heavy cream, served up in a coupe with grated nutmeg.', 'Bryant''s Cocktail Lounge in Milwaukee credits founder Bryant Sharp with the Pink Squirrel in the 1940s, though the bar has no hard evidence. Almond-flavoured crème de noyaux turns the creamy Grasshopper template pink. If the cream Grasshopper itself only took shape around 1950, the two may be siblings rather than parent and child. Wisconsin bars often blend it with ice cream.

Method: Shake with ice, strain into a chilled coupe and grate nutmeg on top.', 'Coupe', NULL, 'Shake'),
    ('wisconsin-brandy-old-fashioned', 'Wisconsin Brandy Old Fashioned', 1945, true, 'oldfashioned', 'muddled-old-fashioned', false, 'Brandy base, muddled fruit, topped with lemon-lime soda (sweet), grapefruit soda (sour) or half soda water (press)', NULL, ARRAY[]::text[], NULL, 'https://www.wuwm.com/post/real-story-behind-why-wisconsinites-drink-brandy-old-fashioneds', 'Brandy over muddled orange, cherry, brown sugar syrup and bitters on crushed ice, often topped with lemon-lime or grapefruit soda.', 'Wisconsin''s state drink swaps whiskey for brandy in the muddled-fruit Old Fashioned. The popular story credits Korbel at the 1893 Chicago World''s Fair, while Jeanette Hurt ties the brandy habit to whiskey shortages in the Second World War; the date here is approximate. Supper clubs serve it sweet with lemon-lime soda, sour with grapefruit soda or press with half soda water.

Method: Muddle orange, cherry, syrup and bitters in a rocks glass, add brandy and crushed ice, and stir.', 'Rocks', 'Crushed', 'Build'),
    ('brooklynite', 'Brooklynite', 1946, false, 'sour', 'daiquiri', false, 'Dark rum, honey and a dash of Angostura', NULL, ARRAY[]::text[], 'storkclub.nyc', 'https://kindredcocktails.com/cocktail/brooklynite', 'Jamaican rum shaken with lime and honey syrup, served up with a lime wedge; some versions add a dash of Angostura.', 'The Brooklynite is printed in The Stork Club Bar Book (1946), and a Trader Vic guide of the same era also lists it, both with Angostura. No creator is named, and the print date is no proof it started at the Stork Club. It is a Daiquiri with darker rum and honey in place of sugar.

Method: Shake with ice, strain into a chilled coupe and garnish with a lime wedge.', 'Coupe', NULL, 'Shake'),
    ('el-diablo', 'El Diablo', 1946, false, 'highball', 'buck', true, 'Tequila buck with crème de cassis', 'victor.bergeron', ARRAY[]::text[], 'tradervics.oakland', 'https://alcademics.com/', NULL, NULL, NULL, NULL, NULL),
    ('bellini', 'Bellini', 1948, false, 'highball', 'mimosa', false, 'White peach purée and prosecco', 'giuseppe.cipriani', ARRAY[]::text[], 'harrysbar.venezia', 'https://www.eataly.com/us_en/magazine/culture-and-tradition/history-bellini-cocktail', NULL, NULL, NULL, NULL, NULL),
    ('honeysuckle', 'Honeysuckle', 1948, false, 'sour', 'daiquiri', false, 'Honey syrup in place of sugar', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/970/honeysuckle-daiquiri', 'Light rum shaken with lemon, orange juice and honey syrup, served up in a chilled coupe.', 'The earliest printing found is David Embury''s The Fine Art of Mixing Drinks (1948), which calls it the Bee''s Knees made with white Cuban rum, so his version used lemon. His wording suggests the drink already existed. It reads as a Daiquiri with honey in place of sugar, though the Bee''s Knees is its literal parent in Embury''s text.

Method: Shake with ice and fine strain into a chilled coupe.', 'Coupe', NULL, 'Shake'),
    ('monte-carlo', 'Monte Carlo', 1948, false, 'oldfashioned', 'old-fashioned', false, 'Benedictine replaces the sugar', 'david.embury', ARRAY[]::text[], NULL, 'https://kindredcocktails.com/cocktail/monte-carlo', 'Rye whiskey stirred with Bénédictine and Angostura bitters, served over a large cube with a lemon twist.', 'First printed in David Embury''s The Fine Art of Mixing Drinks (1948); Embury recorded it rather than claiming it. One source places it in Gale and Marco''s 1937 book, but that is unverified. It is an Old Fashioned with Bénédictine in place of sugar, and is often filed as a Manhattan variation.

Method: Stir with ice, strain over a large cube in a rocks glass and express a lemon twist over the top.', 'Rocks', 'Large Cube', 'Stir'),
    ('royal-hawaiian', 'Royal Hawaiian', 1948, true, 'tiki', 'tiki', true, 'Gin sour with pineapple and orgeat', NULL, ARRAY[]::text[], 'moana.surfrider', 'https://kindredcocktails.com/cocktail/royal-hawaiian', 'Gin shaken with pineapple juice, lemon and orgeat, served up in a chilled coupe.', 'It may have been created in 1948 at the Moana Hotel in Waikiki and first printed in Ted Saucier''s Bottoms Up (1951). Another calls the Royal Hawaiian Hotel origin unproven and thinks the name dates from the 1950s. It is a gin sour with pineapple and orgeat, more tropical than tiki.

Method: Shake with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake'),
    ('snowball', 'Snowball', 1948, true, 'flip', 'nog', true, 'Bottled egg liqueur (advocaat) lengthened with lemonade', NULL, ARRAY[]::text[], NULL, 'https://britishfoodhistory.com/2019/12/24/the-snowball/', 'Advocaat over lime juice and lemonade in an ice-filled Collins glass, briefly stirred.', 'A British favourite built on bottled egg liqueur. Sources place it in the 1940s, or in the late 1940s or early 1950s, with a peak in the 1970s. Early versions reportedly added brandy to the advocaat and lime. It is a light, fizzy descendant of eggnog, with no known creator.

Method: Pour lemonade and lime into an ice-filled Collins glass, add the advocaat and stir briefly.', 'Collins', 'Cubes', 'Build'),
    ('black-russian', 'Black Russian', 1949, true, 'flip', 'duo', true, 'Vodka with coffee liqueur over ice', 'gustave.tops', ARRAY[]::text[], 'metropole.brussels', 'https://barrypopik.com/blog/black_russian_cocktail', 'Vodka and coffee liqueur stirred with ice and strained over fresh ice in a rocks glass.', 'The standard story credits Gustave Tops at the Hotel Métropole in Brussels in 1949, making it for the American ambassador Perle Mesta, but nothing from the time backs it up. The earliest print found is Herb Caen''s column in the San Francisco Examiner in October 1956, which called it new at Romanoff''s. Adding cream makes the White Russian.

Method: Stir with ice and strain into an ice-filled rocks glass.', 'Rocks', 'Cubes', 'Stir'),
    ('screwdriver', 'Screwdriver', 1949, false, 'highball', 'highball', true, 'Vodka and orange juice', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Screwdriver_(cocktail)', 'Vodka and orange juice mixed over ice in a highball glass, garnished with an orange slice.', 'The Screwdriver first appears in print in Time on 24 October 1949, at the Park Hotel in Ankara, Turkey. The name may date to 1943 or 1944 among Americans working in Turkey; the tale of stirring it with a screwdriver is folklore. It is a two-ingredient highball and the base of the Harvey Wallbanger.

Method: Mix in an ice-filled highball glass and garnish with an orange slice.', 'Highball', 'Cubes', 'Build'),
    ('aperol-spritz', 'Aperol Spritz', 1950, true, 'highball', 'spritz', true, 'Aperol as the bitter, prosecco, 3-2-1 build, orange slice', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/articles/history-aperol-spritz/', NULL, NULL, NULL, NULL, NULL),
    ('cardinale', 'Cardinale', 1950, false, 'negroni', 'negroni', false, 'Dry vermouth (originally dry Mosel Riesling) for sweet vermouth, gin-forward, served up', 'giovanni.raimondo', ARRAY[]::text[], 'excelsior.rome', 'https://www.vice.com/it/article/cardinale-cocktail-storia/', 'Gin stirred with Campari and dry vermouth, served over ice in a rocks glass with a lemon twist.', 'Giovanni Raimondo made it at the Hotel Excelsior in Rome in 1950, for a visiting cardinal (DeGroff says a German one) during the Holy Year Jubilee. His original used dry Mosel Riesling, later replaced by dry vermouth, making a drier, lighter Negroni. David Wondrich notes earlier drinks of the name, including a Campari Cardinal in a 1926 Campari booklet. In southern Italy, Cardinale also means Campari Soda with aranciata.

Method: Stir with ice in a rocks glass and garnish with a lemon twist.', 'Rocks', 'Cubes', 'Stir'),
    ('vodka-gimlet', 'Vodka Gimlet', 1950, true, 'sour', 'gimlet', false, 'Vodka for gin', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/vodka-gimlet/', 'Vodka shaken with fresh lime juice and simple syrup, served up in a chilled coupe with a lime wheel.', 'The vodka version of the Gimlet arrived with the Smirnoff boom of the 1950s; it dates to that decade, and no first printed recipe has been found, so the year is approximate. It simply swaps vodka for gin. Older versions use lime cordial, while this spec uses fresh lime and syrup.

Method: Shake hard with ice, strain into a chilled coupe and garnish with a lime wheel.', 'Coupe', NULL, 'Shake'),
    ('bull-shot', 'Bull Shot', 1952, true, 'highball', 'bloody-mary', false, 'Beef bouillon for tomato juice', 'lester.gruber', ARRAY[]::text[], 'caucusclub.detroit', 'https://vinepair.com/articles/bullshot-cocktail-origin-story/', 'Vodka shaken with beef bouillon, lemon, Worcestershire, hot sauce, salt and pepper, served over ice in a Collins glass.', 'Lester Gruber of the Caucus Club in Detroit made it with John Hurley, a public relations man for Campbell''s soup, in the early 1950s; the Oxford Companion says 1954 or 1955, and it was in print by 1956. It is a Bloody Mary with beef bouillon in place of tomato juice. The Bloody Bull mixes the two.

Method: Shake with ice and strain into an ice-filled Collins glass.', 'Collins', 'Cubes', 'Shake'),
    ('golden-cadillac', 'Golden Cadillac', 1952, false, 'flip', 'grasshopper', false, 'Galliano replaces crème de menthe', 'frank.klein', ARRAY[]::text[], 'poorreds', 'https://alcademics.com/?p=3383', 'Equal parts Galliano, white crème de cacao and cream, shaken and served in a small wine glass under grated dark chocolate.', 'Local lore says Frank Klein made it in 1952 at Poor Red''s Bar-B-Q in El Dorado, California, for a newly engaged couple who drove a gold Cadillac; sources disagree on the bartender''s name. It swaps the Grasshopper''s crème de menthe for vanilla-anise Galliano. Poor Red''s has since claimed to be the largest consumer of Galliano in the world.

Method: Shake with ice, double strain into a small wine glass and grate dark chocolate on top.', 'Wine', NULL, 'Shake'),
    ('japanese-highball', 'Japanese Highball', 1952, true, 'highball', 'whisky-highball', false, 'Japanese whisky, very cold highly carbonated soda, precise build and stir, lemon peel', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Highball', 'Japanese whisky topped with very cold soda over ice in a highball glass, finished with an expressed lemon peel.', 'The highball came to Japan with the American occupation, and Suntory''s Torys bar chain made the Kakubin highball the standard serve from the 1950s. Suntory''s 2008 campaign and highball taps revived it. The bar-craft version, with very cold whisky and soda poured carefully so the bubbles survive, is now made worldwide.

Method: Pour whisky into an ice-filled highball glass, top with soda without pouring onto the ice, and express a lemon peel.', 'Highball', 'Cubes', 'Build'),
    ('margarita', 'Margarita', 1953, false, 'sidecar', 'tequila-daisy', false, 'Tequila, orange liqueur and lime served up with a salted rim', NULL, ARRAY[]::text[], NULL, 'https://barrypopik.com/blog/tequila_daisy', NULL, NULL, NULL, NULL, NULL),
    ('royal-hawaiian-mai-tai', 'Royal Hawaiian Mai Tai', 1953, false, 'tiki', 'mai-tai', false, 'Lengthened with pineapple and orange juice for Matson''s Hawaii hotels', 'victor.bergeron', ARRAY[]::text[], 'royalhawaiian', 'https://en.wikipedia.org/wiki/Mai_Tai', 'Light, dark and demerara rums shaken with orange and pineapple juice, lime, lemon, orgeat, curaçao and syrup, served over ice.', 'Trader Vic wrote a cocktail menu for Matson''s Royal Hawaiian and Moana hotels in Honolulu in 1953, and the Mai Tai on it became a tourist hit. Over the next years Hawaiian bars lengthened it with pineapple and orange juice and a dark rum float. The original 1953 spec is not recorded; this one is the Royal Hawaiian Surf Room recipe of 1972, with juice amounts suggested by Jeff Berry.

Method: Shake with ice, pour into a glass and garnish with pineapple, sugar cane, an orchid and mint.', NULL, NULL, 'Shake'),
    ('vesper', 'Vesper', 1953, false, 'martini', 'martini', false, 'Gin and vodka together, Kina Lillet in place of vermouth, shaken', 'ian.fleming', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Vesper_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('pina-colada', 'Piña Colada', 1954, false, 'tiki', 'tiki', true, 'Rum blended with pineapple juice and cream of coconut', 'ramon.marrero', ARRAY[]::text[], 'caribehilton', 'https://www.diffordsguide.com/encyclopedia/2014-07-08/469/cocktails/pina-colada-cocktail', NULL, NULL, NULL, NULL, NULL),
    ('blue-hawaii', 'Blue Hawaii', 1957, false, 'tiki', 'tiki', true, 'Rum and vodka with blue curaçao, pineapple and sour mix', 'harry.yee', ARRAY[]::text[], 'hiltonhawaiianvillage', 'https://en.wikipedia.org/wiki/Blue_Hawaii_(cocktail)', 'Light rum and vodka shaken with blue curaçao, pineapple juice and sour mix, served over ice in a hurricane glass.', 'Harry Yee, head bartender at the Hilton Hawaiian Village in Waikiki, created it in 1957 when a sales rep from Bols asked him for a drink using blue curaçao. The bright blue colour made it a holiday icon. It is often blended or served by the bowl. Adding coconut makes the Blue Hawaiian, a Piña Colada cousin.

Method: Shake with ice and pour with the ice into a hurricane glass; garnish with pineapple and a cherry.', NULL, 'Cubes', 'Shake'),
    ('rudesheimer-kaffee', 'Rüdesheimer Kaffee', 1957, false, 'flip', 'cafe-brulot', false, 'Asbach brandy flamed with sugar cubes in the cup, coffee, vanilla cream and chocolate', 'hanskarl.adam', ARRAY[]::text[], NULL, 'https://de.wikipedia.org/wiki/R%C3%BCdesheimer_Kaffee', 'Asbach brandy flamed with sugar cubes in the cup, topped with strong coffee, vanilla-sweetened whipped cream and chocolate flakes.', 'Television chef Hans Karl Adam created it in 1957 for the Asbach brandy house in Rüdesheim am Rhein, Germany. In Rüdesheim it is made in a special cup: the brandy is flamed with sugar until it dissolves, then coffee and a thick cap of vanilla cream go on top. It is a German cousin of New Orleans'' Café Brûlot and of Irish Coffee.

Method: Flame the brandy with the sugar in a warmed cup and stir until dissolved, add hot coffee, top with whipped cream and chocolate flakes.', NULL, NULL, 'Build'),
    ('jet-pilot', 'Jet Pilot', 1958, false, 'tiki', 'test-pilot', false, 'Drop Cointreau, add grapefruit, cinnamon syrup and overproof rum', 'steve.crane', ARRAY[]::text[], 'theluau.beverlyhills', 'https://cold-glass.com/2016/06/05/classic-tiki-the-jet-pilot/', 'Jamaican, gold and overproof demerara rums blended with lime, grapefruit, cinnamon syrup, falernum, absinthe and bitters.', 'Steve Crane served the Jet Pilot at The Luau in Beverly Hills around 1958, and it is still on the menu at the Mai-Kai. It reworks Donn Beach''s Test Pilot, dropping the Cointreau and adding grapefruit, cinnamon syrup and a slug of overproof demerara rum. Its popularity has outrun the original.

Method: Blend with 4 oz crushed ice for no more than five seconds and pour into a rocks glass.', 'Rocks', 'Crushed', 'Blitz'),
    ('agua-de-valencia', 'Agua de Valencia', 1959, false, 'highball', 'bucks-fizz', false, 'Cava and orange juice fortified with vodka and gin, made by the jug', 'constante.gil', ARRAY[]::text[], 'cafemadrid.valencia', 'https://en.wikipedia.org/wiki/Agua_de_Valencia', 'Cava poured over ice with gin, vodka, orange juice and a little syrup stirred in, served in a copa glass with an orange slice.', 'Constante Gil created it at Café Madrid in Valencia in 1959, riffing on the Agua de Bilbao order of cava. It lengthens the Buck''s Fizz pairing of sparkling wine and orange juice with vodka and gin. It spread through Valencian nightlife in the 1970s and is usually made by the jug.

Method: Pour cava into an ice-filled glass, stir the rest with ice and strain over the cava; garnish with an orange slice.', 'Wine', 'Cubes', 'Stir'),
    ('campari-shakerato', 'Campari Shakerato', 1960, true, 'negroni', 'aperitivo', true, 'Campari alone, shaken hard with ice and served up with a froth', NULL, ARRAY[]::text[], NULL, 'https://campariacademy.com/en-us/inspiration/trends/the-shakerato', 'Campari shaken hard with ice, a pinch of saline and orange flower water, served frothy in a chilled Nick & Nora glass.', 'Camparino''s head bartender Tommaso Cecca says the Shakerato has no birth date but became popular in Italian bars around 1960. Shaking Campari alone hard with ice chills and dilutes it and gives it a pale, foamy head. Nothing ties its creation to Camparino or to Milan.

Method: Shake hard with ice, strain into a chilled Nick & Nora glass and garnish with an orange twist.', 'Nick & Nora', NULL, 'Shake'),
    ('golden-dream', 'Golden Dream', 1960, true, 'flip', 'golden-cadillac', false, 'Galliano cream drink with triple sec and orange juice instead of crème de cacao', 'raimundo.alvarez', ARRAY[]::text[], 'oldkingbar.miami', 'https://en.wikipedia.org/wiki/Golden_dream_(cocktail)', 'Galliano and triple sec shaken with fresh orange juice and cream, served up in a chilled cocktail glass.', 'Wikipedia credits Raimundo Alvarez at the Old King Bar in Miami, who dedicated it to Joan Crawford; EcuRed dates it to early 1960. Cointreau''s site claims a rival 1959 California origin, which is unverified. It keeps the Golden Cadillac''s Galliano and cream but trades crème de cacao for orange liqueur and juice.

Method: Shake with ice and strain into a chilled cocktail glass.', 'Martini', NULL, 'Shake'),
    ('michelada', 'Michelada', 1960, true, 'highball', 'highball', true, 'Mexican lager with lime and salt, later spiced with hot and savoury sauces', 'michel.esper', ARRAY[]::text[], 'clubdeportivopotosino', 'https://en.wikipedia.org/wiki/Michelada', 'Mexican lager over ice with lime juice, Worcestershire and hot sauce, often in a salt or chilli rimmed glass.', 'One story credits Michel Ésper at the Club Deportivo Potosino in San Luis Potosí in the 1960s, who asked for his beer with lime and salt, his limonada. A rival etymology reads the name as mi chela helada, my cold beer, and neither is documented. What began as beer, lime and salt now takes many hot and savoury sauces across Mexico.

Method: Build lime, sauces and beer in an ice-filled glass, rimmed with salt if you like.', 'Collins', 'Cubes', 'Build'),
    ('batanga', 'Batanga', 1961, false, 'highball', 'cuba-libre', false, 'Tequila for rum, salted rim, stirred with a knife', 'javier.delgado', ARRAY[]::text[], 'lacapilla.tequila', 'https://gardenandgun.com/recipe/the-ultimate-tequila-cocktail-from-tequila-mexico', 'Blanco tequila, lime and Mexican cola over ice in a salt-rimmed glass, traditionally stirred with a knife.', 'Don Javier Delgado Corona created the Batanga at La Capilla in the town of Tequila, Mexico, in 1961, and stirred it with the same long knife he used for limes. It is a Cuba Libre with tequila in place of rum and a salted rim. One Diageo page claims a Cuban origin, which no other source supports.

Method: Rim a glass with salt, dissolve a pinch of salt in the lime juice, add ice, tequila and cola, and stir.', 'Collins', 'Cubes', 'Build'),
    ('port-light', 'Port Light', 1961, true, 'tiki', 'tiki', true, 'Bourbon instead of rum, with passion fruit, lemon and grenadine', 'sandro.conti', ARRAY[]::text[], 'kahiki.columbus', 'https://kindredcocktails.com/cocktail/port-light', 'Bourbon blended with lemon, passion fruit syrup and grenadine, poured into a tall glass with a slapped mint sprig.', 'Sandro Conti served the Port Light at The Kahiki in Columbus, Ohio, around 1961, per Jeff Berry''s Grog Log. It is an unusual tiki drink built on bourbon rather than rum, sweetened with passion fruit and grenadine. Smuggler''s Cove makes it with egg white and honey.

Method: Blend with plenty of ice for five seconds and pour unstrained into a tall glass; garnish with mint.', NULL, NULL, 'Blitz'),
    ('salty-dog', 'Salty Dog', 1962, true, 'highball', 'greyhound', false, 'Add a salted rim', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Greyhound_(cocktail)', 'Vodka shaken with pink grapefruit juice and a touch of rich syrup, served over ice in a highball with a salted rim.', 'The Salty Dog is a Greyhound with a salted rim, a late 1950s or early 1960s idea first found in a recipe book in Ted Saucier''s revised Bottoms Up (1962), made with vodka, grapefruit and salt. The Greyhound itself is first named in print in 1945. The salt softens the grapefruit''s bitterness and makes the juice taste sweeter. A popular credit to George Jessel has no evidence behind it, and claims of a 1920s origin are unsourced.

Method: Salt the rim, shake with ice and strain into the ice-filled glass.', 'Highball', 'Cubes', 'Shake'),
    ('vodka-collins', 'Vodka Collins', 1962, true, 'highball', 'tom-collins', false, 'Vodka for gin', NULL, ARRAY[]::text[], NULL, 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-435', 'Vodka shaken with lemon juice and rich syrup, strained over ice in a Collins glass and topped with soda water.', 'The Vodka Collins swaps vodka for the gin in a Tom Collins and rode the postwar vodka boom; it was also called a Joe Collins. Its first recipe-book appearance is in Ted Saucier''s Bottoms Up (sources give both 1952 and 1962), credited to Ted Majeski of UPI, a contributor rather than its inventor. The Oxford Companion says it began to emerge in the 1930s and was everywhere by the 1950s, so the date is loose.

Method: Shake the vodka, lemon and syrup with ice, strain into an ice-filled Collins glass and top with soda.', 'Collins', 'Cubes', 'shake and top'),
    ('white-russian', 'White Russian', 1965, false, 'flip', 'black-russian', false, 'Add cream to the Black Russian', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/White_Russian_(cocktail)', 'Vodka and coffee liqueur poured over ice in a rocks glass, with fresh cream floated on top and stirred in slowly.', 'Add cream to a Black Russian and you have a White Russian. The earliest citation in the Oxford English Dictionary is an Oakland Tribune item of 21 November 1965, made with Southern coffee liqueur, though Heublein had already tried to trademark the name in 1962. It settled into life as a dessert drink until The Big Lebowski (1998) made it the Dude''s signature and gave it a second life.

Method: Pour the vodka and coffee liqueur over ice, float the cream on top and stir slowly.', 'Rocks', 'Cubes', 'Build'),
    ('saturn', 'Saturn', 1967, false, 'tiki', 'tiki', true, 'Gin base with passion fruit, falernum, orgeat and lemon', 'popo.galsini', ARRAY[]::text[], NULL, 'https://kindredcocktails.com/cocktail/saturn', 'Gin with lemon, passion fruit syrup, falernum and orgeat, blended with ice until smooth and poured unstrained into a tall glass.', 'Popo Galsini won a 1967 bartenders'' competition in California with the Saturn (often given as the IBA or USBG contest, though the details are unconfirmed). It is a rare gin tiki drink, built on the Don the Beachcomber pattern of citrus, passion fruit, falernum and orgeat, then blended. Long forgotten, it was revived by Paul McGee and the Three Dots and a Dash crew.

Method: Blend with a cup of ice until smooth and pour unstrained into a pilsner or other tall glass.', 'Beer Glass', 'Crushed', 'Blitz'),
    ('caesar', 'Caesar', 1969, false, 'highball', 'bloody-mary', false, 'Clam-tomato juice, celery-salt rim', 'walter.chell', ARRAY[]::text[], 'calgaryinn', 'https://en.wikipedia.org/wiki/Caesar_(cocktail)', 'Vodka and Clamato with hot sauce, Worcestershire and pepper, built over ice in a highball with a celery-salt rim, lime and celery.', 'Walter Chell created the Caesar in 1969 for the opening of Marco''s Italian restaurant at the Calgary Inn, taking his cue from spaghetti alle vongole, pasta with clams and tomato. Clam-spiked tomato juice and a celery-salt rim set it apart from the Bloody Mary it descends from. It became Canada''s national cocktail and remains far more common there than anywhere else.

Method: Rim the glass with celery salt, fill with ice, add the vodka, sauces and pepper, top with Clamato and garnish with lime and celery.', 'Highball', 'Cubes', 'Build'),
    ('harvey-wallbanger', 'Harvey Wallbanger', 1969, true, 'highball', 'screwdriver', false, 'Float Galliano on a Screwdriver', NULL, ARRAY[]::text[], NULL, 'https://culinarylore.com/drinks:was-the-harvey-wallbanger-named-after-a-real-guy', 'Vodka and fresh orange juice stirred over ice in a highball, with Galliano floated on top and an orange slice and cherry.', 'A Screwdriver with a float of Galliano, the Harvey Wallbanger became a 1970s craze largely thanks to George Bednar of McKesson, Galliano''s US importer, who built a campaign around it in 1969 and 1970. The first print recipes date to about 1971. Donato ''Duke'' Antone later claimed he made it in 1952 at Duke''s Blackwatch Bar, but that story is unverified.

Method: Stir the vodka and orange juice with ice in the glass, then float the Galliano on top.', 'Highball', 'Cubes', 'Build'),
    ('lemon-drop', 'Lemon Drop', 1970, true, 'sidecar', 'crusta', true, 'Vodka with lemon and sugar, sugared rim; modern spec adds triple sec', 'norman.hobday', ARRAY[]::text[], 'henryafricas.sf', 'https://en.wikipedia.org/wiki/Lemon_drop_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('bloody-maria', 'Bloody Maria', 1971, true, 'highball', 'bloody-mary', false, 'Tequila for vodka', NULL, ARRAY[]::text[], NULL, 'https://barrypopik.com/blog/bloody_maria_cocktail', 'Tequila and tomato juice with lemon, Tabasco and celery salt, served over ice in a highball with a lemon slice.', 'Swap the vodka in a Bloody Mary for tequila and you have the Bloody Maria. Barry Popik found the name first printed in 1961 for a light-rum version in a Ronrico promotion, while a 1961 ''Tequila Sangrita'' already mixed tequila and tomato without the name. The earliest tequila Bloody Maria by name is a 1971 Frontera Tequila ad, though earlier use is likely.

Method: Build the tequila, tomato juice, lemon, Tabasco and celery salt over ice, stir and add a lemon slice.', 'Highball', 'Cubes', 'Build'),
    ('frozen-margarita', 'Frozen Margarita', 1971, false, 'sidecar', 'margarita', false, 'Blended with ice into a slush; made by machine from 1971', 'mariano.martinez', ARRAY[]::text[], 'marianos.dallas', 'https://www.smithsonianmag.com/smithsonian-institution/uniquely-texas-origins-frozen-margarita-180969339/', 'Blanco tequila, lime, Cointreau and rich syrup blended with ice into a slush, poured into a glass with an optional salt rim.', 'Dallas restaurateur Mariano Martinez built the first frozen margarita machine and switched it on at Mariano''s Mexican Cuisine on 11 May 1971; the machine is now in the Smithsonian. Blender margaritas already existed, so 1971 marks the machine-made slush rather than the first frozen Margarita. A steady, fast frozen pour made it a fixture of Tex-Mex restaurants across the country.

Method: Blend briefly on low and then on high with the tea ice cubes, and pour into a glass rimmed with salt if you like.', NULL, NULL, 'Blitz'),
    ('painkiller', 'Painkiller', 1971, true, 'tiki', 'pina-colada', false, 'Navy-style dark rum, orange juice added, nutmeg on top, served on the rocks', 'george.myrick', ARRAY['marie.myrick', 'daphne.henderson']::text[], 'soggydollarbar', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-378', 'Rum shaken with pineapple, orange juice and cream of coconut, poured over crushed ice and finished with plenty of grated nutmeg.', 'The Painkiller comes from the Soggy Dollar Bar on Jost Van Dyke in the British Virgin Islands. George and Marie Myrick, who ran the bar (first called the Sandcastle) from 1970 to 1980, said they made it in 1971; Pusser''s credits Daphne Henderson in the early 1980s, and it reached print around 1981, so the inventor is disputed. It is a Piña Colada cousin with orange juice and nutmeg, served on the rocks. Pusser''s trademarked the name in 1989.

Method: Shake without ice, pour into a snifter, top with crushed ice and grate nutmeg over the top.', NULL, 'Crushed', 'Shake'),
    ('bombardino', 'Bombardino', 1972, true, 'flip', 'nog', true, 'Hot egg liqueur (Vov) with brandy under whipped cream, an Alpine ski drink', 'aldo.delbo', ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Bombardino', 'Hot egg liqueur (Vov or advocaat) mixed with brandy, served in a warm mug under a thick cap of whipped cream.', 'The Bombardino is the Alpine ski-hut warmer. One story, from the 1970s and sometimes dated to 1972, comes from Aldo Del Bò''s mountain refuge at Livigno, where his manager Erich Ciapponi heated Vov egg liqueur, added Scotch and topped it with cream for frozen skiers, one of whom called it a bomb. A rival tale credits a Genoese keeper of the Mottolino hut. It is a hot, boozy relative of eggnog.

Method: Heat the egg liqueur and brandy together, pour into a warm mug and top with whipped cream.

No measures have been published for this one.', NULL, NULL, 'Build'),
    ('kalimotxo', 'Kalimotxo', 1972, false, 'highball', 'tinto-de-verano', false, 'Cola instead of lemon soda', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Kalimotxo', 'Equal parts red wine and cola poured over plenty of ice in a highball, with an optional lemon slice.', 'Red wine and cola were mixed in the Basque Country before anyone named it, but the Kalimotxo got its name at a 1972 festival in Algorta, joining the nicknames of two of its makers, Kalimero and Motxongo. Using cola where the Tinto de Verano uses lemon soda makes it darker and sweeter. It is now a fixture of Spanish fiestas and student parties.

Method: Fill the glass with ice, add the wine, top with an equal amount of cola and stir gently.', 'Highball', 'Cubes', 'Build'),
    ('long-island-iced-tea', 'Long Island Iced Tea', 1972, true, 'highball', 'collins', true, 'Five white spirits as a Collins, topped with a splash of cola for colour', 'robert.butt', ARRAY[]::text[], 'oakbeachinn', 'https://en.wikipedia.org/wiki/Long_Island_iced_tea', 'Vodka, gin, white rum, tequila and Cointreau with lemon and syrup, built over ice in a highball and topped with a splash of cola.', 'Robert ''Rosebud'' Butt says he created the Long Island Iced Tea at the Oak Beach Inn on Long Island in the early 1970s (the bar''s owner says 1973), and it first appears in the press in 1976. Five white spirits, lemon and sugar make it a Collins at heart, with just enough cola for an iced-tea colour. A different 1961 cookbook recipe shares the name, and a Prohibition-era story from Kingsport, Tennessee, is undocumented.

Method: Build everything over ice in a highball, top with cola and stir gently.', 'Highball', 'Cubes', 'Build'),
    ('negroni-sbagliato', 'Sbagliato', 1972, true, 'negroni', 'negroni', false, 'Sparkling wine poured in place of gin (''wrong'' Negroni)', 'mirko.stocchetto', ARRAY[]::text[], 'barbasso.milano', 'https://boothby.com.au/negroni-sbagliato', NULL, NULL, NULL, NULL, NULL),
    ('tequila-sunrise', 'Tequila Sunrise', 1972, true, 'highball', 'screwdriver', false, 'Tequila for vodka, grenadine sunk to make the ''sunrise''', 'bobby.lozoff', ARRAY['billy.rice']::text[], 'thetrident.sausalito', 'https://en.wikipedia.org/wiki/Tequila_sunrise', 'Tequila and fresh orange juice built over ice in a highball, with grenadine poured in to sink and bleed upward like a sunrise.', 'Bobby Lozoff and Billy Rice made the modern Tequila Sunrise in the early 1970s at the Trident in Sausalito: tequila and orange juice, a Screwdriver with a new spirit, with grenadine sunk to the bottom. The Rolling Stones took it up at a 1972 tour party and made it famous. An older, different Tequila Sunrise of tequila, cassis, lime and soda is credited to Gene Sulit at the Arizona Biltmore in the 1930s or 1940s, on weak evidence.

Method: Pour the tequila and orange juice over ice, then add the grenadine so it sinks; do not stir.', 'Highball', 'Cubes', 'Build'),
    ('jungle-bird', 'Jungle Bird', 1973, false, 'tiki', 'tiki', true, 'Dark rum with Campari, pineapple, lime and demerara', 'jeffrey.ong', ARRAY[]::text[], 'aviarybar.klhilton', 'https://en.wikipedia.org/wiki/Jungle_Bird', NULL, NULL, NULL, NULL, NULL),
    ('amaretto-sour', 'Amaretto Sour', 1974, false, 'sour', 'sour', true, 'Use amaretto as the base, usually with sour mix', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Amaretto_sour', 'Amaretto shaken with fresh lemon, egg white and a dash of Angostura, served over ice in a rocks glass with a lemon wheel and cherry.', 'The Amaretto Sour was introduced in 1974 at the behest of the US importer of what was then called Amaretto di Saronno, as two parts amaretto to one of lemon. By its 1980s peak most bars made it with commercial sour mix, which earned it a sugary reputation. Fresh lemon and egg white restore the balance, and Jeffrey Morgenthaler''s 2012 version, with cask-strength bourbon, helped bring it back.

Method: Shake with ice, strain back into the shaker, dry shake without ice and fine strain over fresh ice.', 'Rocks', 'Cubes', 'dry shake and shake'),
    ('rosita', 'Rosita', 1974, false, 'negroni', 'negroni', false, 'Tequila base, split sweet and dry vermouth, a dash of Angostura', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/cocktail-recipe/rosita/', 'Reposado tequila stirred with Campari and equal parts sweet and dry vermouth plus a dash of Angostura, served over ice with a twist.', 'The Rosita first appears in the 1974 Mr. Boston Official Bartender''s Guide: tequila with Campari and both sweet and dry vermouth, the ''perfect'' split borrowed from the Manhattan family. Gary Regan took it from the 1988 Mr. Boston, added more tequila and a dash of bitters, and printed it in The Bartender''s Bible (1991). His version is the one that spread, and today it reads as a tequila Negroni.

Method: Stir with ice and strain into an ice-filled old-fashioned glass; express a grapefruit twist over it.', 'Rocks', 'Cubes', 'Stir'),
    ('bushwacker', 'Bushwacker', 1975, false, 'flip', 'white-russian', false, 'Frozen: coffee liqueur, crème de cacao, cream of coconut and milk; rum in the Gulf Coast version', 'angie.conigliaro', ARRAY[]::text[], 'shipsstore.stthomas', 'https://en.wikipedia.org/wiki/Bushwacker_(cocktail)', 'Dark rum, coffee liqueur, dark crème de cacao, cream of coconut and milk blended with ice into a frozen, milkshake-like drink.', 'Angie Conigliaro made the first Bushwacker in 1975 at the Ship''s Store & Sapphire Pub on St. Thomas in the US Virgin Islands; bar manager Tom Brokamp says he suggested it while on a White Russian kick. It began as a frozen mix of coffee liqueur, crème de cacao, cream of coconut and milk. Linda Murphy (later Taylor) took it to the Sandshaker on Pensacola Beach in the late 1970s and added rum, the version loved along the Gulf Coast.

Method: Blend everything with a cup of ice and pour into a hurricane glass.', NULL, 'Crushed', 'Blitz'),
    ('mudslide', 'Mudslide', 1975, true, 'flip', 'white-russian', false, 'Irish cream replaces cream; often blended with ice cream', NULL, ARRAY[]::text[], 'rumpoint.wreckbar', 'https://www.tastingtable.com/1218496/the-1970s-ingredient-swap-that-created-the-mudslide-cocktail', 'Vodka, coffee liqueur and Irish cream blended with vanilla ice cream and crushed ice, served in a tall glass with crumbled chocolate.', 'The Mudslide is said to have been born in the 1970s at the Wreck Bar at Rum Point on Grand Cayman, when a guest asked for a White Russian and the bar, out of cream, reached for Irish cream instead. Tasting Table names the bartender as ''Old Judd''. It is legend rather than record, and even the bar allows it may have started elsewhere. Served over ice it is a White Russian cousin; blended with ice cream it becomes dessert.

Method: Blend everything with crushed ice, pour into a chilled hurricane glass and crumble chocolate over the top.', NULL, 'Crushed', 'Blitz'),
    ('spanish-coffee', 'Spanish Coffee', 1975, false, 'flip', 'irish-coffee', false, 'Overproof rum and triple sec flamed in a sugared glass, coffee liqueur, coffee, whipped cream', NULL, ARRAY[]::text[], 'hubers.pdx', 'https://www.wweek.com/restaurants/2016/12/20/hubers-historic-spanish-coffee-is-an-institution-but-not-as-old-as-you-might-think/', 'Overproof rum and triple sec flamed in a mug, put out with coffee liqueur, topped with hot coffee, whipped cream and nutmeg.', 'Huber''s, Portland''s oldest restaurant, made the Spanish Coffee famous but did not invent it: in 1975 owner Jim Louie adapted it from the Fernwood Inn in nearby Milwaukie, which had picked it up from a bar in Mexico. What Huber''s added was the tableside show of flaming overproof rum and triple sec in a sugared glass, then coffee liqueur, coffee poured from a height, and cream. Credit for that show is shared within the Louie family.

Method: Ignite the rum and triple sec in a tempered mug, put out the flame with the coffee liqueur, top with hot coffee, then float whipped cream and dust with nutmeg.', NULL, NULL, 'Build'),
    ('french-connection', 'French Connection', 1976, true, 'flip', 'godfather', false, 'Cognac replaces Scotch', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Godfather_(cocktail)', 'Cognac and amaretto stirred and served over ice in a rocks glass with a lemon twist.', 'The French Connection is the Godfather with cognac in place of Scotch, named for the 1971 film. It appears in Brian Rea''s 1976 guide and other 1970s bar books, usually at two parts brandy to one of amaretto. The almond and apricot notes of the liqueur sit easily with brandy, though the cream-topped Godchild has since taken much of its place.

Method: Stir with ice and strain into an ice-filled old-fashioned glass; express a lemon twist over it.', 'Rocks', 'Cubes', 'Stir'),
    ('godfather', 'Godfather', 1976, true, 'flip', 'rusty-nail', false, 'Amaretto replaces Drambuie', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Godfather_(cocktail)', 'Blended Scotch and amaretto stirred and served over a large ice cube in a rocks glass with an orange twist.', 'Amaretto takes the place of Drambuie in this Rusty Nail cousin, named after the 1972 film. Its earliest print appearance is Brian F. Rea''s Brian''s Booze Guide (1976). Stories that it was Marlon Brando''s drink, or that Duke Antone invented it, are unverified. Ratios run from two to one up to equal parts.

Method: Stir with ice and strain over a large cube; express an orange twist over it.', 'Rocks', 'Large Cube', 'Stir'),
    ('godmother', 'Godmother', 1976, true, 'flip', 'godfather', false, 'Vodka replaces Scotch', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Godfather_(cocktail)', 'Vodka and amaretto in equal measure, poured over ice in a rocks glass and stirred gently.', 'The Godmother swaps vodka in for the Godfather''s Scotch and sits beside its sibling in Brian Rea''s 1976 guide. Without the whisky the amaretto leads, so it drinks softer and sweeter. Add cream and it becomes the Godchild, also called the Goddaughter.

Method: Pour both into an ice-filled old-fashioned glass and stir gently.', 'Rocks', 'Cubes', 'Build'),
    ('kamikaze', 'Kamikaze', 1976, true, 'sidecar', 'margarita', false, 'Vodka in place of tequila, no salt; often served as a shot', NULL, ARRAY[]::text[], NULL, 'https://amp.firstwefeast.com/drink/2014/04/david-wondrich-history-of-shots', 'Equal parts vodka, triple sec and fresh lime juice shaken with ice and served straight up, or poured as a shot.', 'Vodka with triple sec and lime, a Margarita without the tequila or salt, the Kamikaze was a mid-1970s American disco-era drink; David Wondrich dates it to 1976. The Oxford Companion notes that early versions were closer to a Gimlet, made with vodka and Rose''s lime. It soon became one of the first great shooters. A story placing its birth in postwar Japan is undocumented.

Method: Shake with ice and strain into a chilled cocktail glass.', 'Coupe', NULL, 'Shake'),
    ('b-52', 'B-52', 1977, false, 'flip', 'pousse-cafe', false, 'Three-layer shot: coffee liqueur, Irish cream, Grand Marnier', 'peter.fich', ARRAY[]::text[], 'banffsprings', 'https://www.traveldistilled.com/history-of-the-b-52-cocktail/', 'Coffee liqueur, Irish cream and Grand Marnier layered in equal measures in a shot glass, poured slowly over the back of a spoon.', 'Peter Fich, head bartender at the Banff Springs Hotel in Alberta, is credited with the B-52 in 1977; he often named drinks after favourite bands, here the B-52s rather than the bomber. Three neat layers make it a pousse-café for the shooter age. Wikipedia calls its origins poorly documented and links the 1977 date to the Keg in Calgary, while claims for Alice''s Restaurant in Malibu (1972) and Maxwell''s Plum in New York are unsupported.

Method: Pour the coffee liqueur into a shot glass, then layer the Irish cream and Grand Marnier over the back of a bar spoon.', NULL, NULL, 'Build'),
    ('brave-bull', 'Brave Bull', 1977, true, 'flip', 'black-russian', false, 'Tequila with coffee liqueur over ice', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/23029/brave-bull', 'Tequila and coffee liqueur stirred and served over ice in a rocks glass with a lemon twist.', 'The Brave Bull is tequila and coffee liqueur on ice, the tequila answer to the Black Russian, and it emerged in the 1970s on the back of that drink. The earliest book found is Jones'' Complete Barguide (1977). A 1972 Trader Vic printing and a story tying the name to a 1950s film are both unverified.

Method: Stir with ice and strain into an ice-filled old-fashioned glass; express a lemon twist over it.', 'Rocks', 'Cubes', 'Stir'),
    ('cadillac-margarita', 'Cadillac Margarita', 1979, false, 'sidecar', 'margarita', false, 'Premium (usually reposado) tequila with a Grand Marnier float', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/not-a-margarita-its-grand-marnier-patron-cadillac-margarita/', 'Reposado tequila shaken with lime, Grand Marnier and agave, served over ice in a rocks glass with a lime wheel.', 'A ''Gold Cadillac Margarita'' was served at Carrousel''s Cantina in Cincinnati in 1968, spec unknown, and the name first reaches print in the Playboy Bartender''s Guide in 1979, oddly with cranberry liqueur. The version people know, premium tequila with Grand Marnier, grew out of El Torito: its Margarita Especial in 1983, then a Grand Marnier float credited to the Woodland Hills branch in 1987. A Cadillac Bar origin in Nuevo Laredo is unconfirmed.

Method: Shake with ice and strain over fresh ice in a rocks glass; garnish with lime.', 'Rocks', 'Cubes', 'Shake'),
    ('fernet-con-coca', 'Fernet con Coca', 1980, true, 'highball', 'cuba-libre', false, 'Fernet-Branca for rum, no lime, lots of cola', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Fernet_con_coca', 'Fernet-Branca topped with plenty of cola over ice, poured down a tilted glass to keep the fizz.', 'Fernet con coca is Argentina''s unofficial national drink, and it took hold in the city of Córdoba in the 1980s. Fratelli Branca pushed it nationwide from the late 1980s, with official Coca-Cola co-branding from 1994 to 1997. It is a Cuba Libre turned bitter: Fernet-Branca in place of rum, no lime and lots of cola. Claims of a 1950s origin, or of Oscar Becerra in the 1970s, are undocumented.

Method: Pour the Fernet over ice and top with cola, tilting the glass so the foam settles.', 'Highball', 'Cubes', 'Build'),
    ('sea-breeze', 'Sea Breeze', 1981, true, 'highball', 'cape-codder', false, 'Split the juice between cranberry and grapefruit', NULL, ARRAY[]::text[], NULL, 'https://barrypopik.com/blog/sea_breeze_cocktail', 'Vodka with cranberry and grapefruit juice built over ice in a highball and garnished with lime.', 'Earlier Sea Breezes, from 1915 and the 1930s, used gin and grenadine and are unrelated. The modern one is a Cape Codder with grapefruit sharing the juice: Barry Popik finds the name defined as vodka, grapefruit and cranberry in a 1981 Seattle Times ad, and an unnamed mix of the same three in 1965. Ocean Spray''s push for cranberry juice made it a 1980s staple.

Method: Build everything over ice in a highball and garnish with lime.', 'Highball', 'Cubes', 'Build'),
    ('espresso-martini', 'Espresso Martini', 1983, true, 'flip', 'black-russian', false, 'Fresh espresso joins vodka and coffee liqueur, shaken hard and served up', 'dick.bradsell', ARRAY[]::text[], 'sohobrasserie.london', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-307', NULL, NULL, NULL, NULL, NULL),
    ('bramble', 'Bramble', 1984, false, 'sour', 'gin-sour', false, 'Serve over crushed ice and drizzle blackberry liqueur over the top', 'dick.bradsell', ARRAY[]::text[], 'fredsclub.london', 'https://en.wikipedia.org/wiki/Bramble_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('japanese-slipper', 'Japanese Slipper', 1984, false, 'sidecar', 'daisy', true, 'Equal parts Midori, Cointreau and lemon: melon liqueur takes the base role', 'jeanpaul.bourguignon', ARRAY[]::text[], 'miettas.melbourne', 'https://en.wikipedia.org/wiki/Japanese_slipper', 'Equal parts Midori, Cointreau and fresh lemon juice shaken and served straight up, garnished with a slice of honeydew melon.', 'Jean-Paul Bourguignon created the Japanese Slipper in 1984 at Mietta''s, the Melbourne restaurant that has since closed. Equal parts Midori, Cointreau and lemon put the bright green melon liqueur in the base role of a liqueur-sweetened sour, with no known model drink behind it. It became an Australian modern classic.

Method: Shake with ice and strain into a chilled cocktail glass; garnish with honeydew.', 'Coupe', NULL, 'Shake'),
    ('dukes-martini', 'Dukes Martini', 1985, true, 'martini', 'martini', false, 'Gin straight from the freezer poured over a vermouth-rinsed frozen glass, no stirring or dilution', 'salvatore.calabrese', ARRAY[]::text[], 'dukeslondon', 'https://punchdrink.com/articles/frozen-freezer-martini-history/', 'Freezer-cold gin or vodka poured into a frozen glass seasoned with dry vermouth, unstirred, finished with lemon peel or an olive.', 'Salvatore Calabrese, who ran DUKES Bar in London from 1982, began pouring Martinis straight from the freezer into a frozen, vermouth-seasoned glass around 1985 (other records say 1987). With no stirring there is no dilution, so the drink is dense, very cold and strong. Harry''s Bar in Venice kept Martinis in the freezer earlier, but DUKES made the method famous, and Gilberto Preti and Alessandro Palazzi carried it on.

Method: Dash the vermouth into a frozen glass, pour in the frozen gin or vodka without stirring and garnish.', 'Martini', NULL, 'Build'),
    ('cosmopolitan', 'Cosmopolitan', 1988, false, 'sidecar', 'kamikaze', false, 'Citrus vodka, Cointreau and fresh lime with cranberry for colour', 'toby.cecchini', ARRAY[]::text[], 'theodeon.nyc', 'https://en.wikipedia.org/wiki/Cosmopolitan_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('tommys-margarita', 'Tommy''s Margarita', 1988, true, 'sidecar', 'margarita', false, 'Drop the orange liqueur, sweeten with agave syrup, 100% agave tequila', 'julio.bermejo', ARRAY[]::text[], 'tommysmexican', 'https://vinepair.com/cocktail-recipe/the-tommys-margarita/', NULL, NULL, NULL, NULL, NULL),
    ('whiskey-smash', 'Whiskey Smash', 1988, true, 'oldfashioned', 'brandy-smash', false, 'Bourbon base and muddled lemon wedges', 'kingcocktail', ARRAY[]::text[], 'rainbowroom.nyc', 'https://kindredcocktails.com/cocktail/whiskey-smash', 'Bourbon shaken with muddled lemon, mint, water and simple syrup, strained over crushed ice in a rocks glass with a mint sprig.', 'Dale DeGroff put the Whiskey Smash on the menu at the Rainbow Room in New York, building it on the old Brandy Smash with bourbon and muddled lemon. One account dates his version to 1988, another to 1999, and a third to about 1998. The muddled lemon pulls it toward the Whiskey Sour, while mint and crushed ice keep it in the Smash and Julep line.

Method: Muddle the syrup, water, lemon and mint, add bourbon, shake with ice and strain over crushed ice.', 'Rocks', 'Crushed', 'muddle and shake'),
    ('fitzgerald', 'Fitzgerald', 1990, true, 'sour', 'gin-sour', false, 'Add Angostura bitters, served up', 'kingcocktail', ARRAY[]::text[], 'rainbowroom.nyc', 'https://kindredcocktails.com/cocktail/fitzgerald', NULL, NULL, NULL, NULL, NULL),
    ('jasmine', 'Jasmine', 1990, true, 'sidecar', 'pegu-club', false, 'Campari replaces the Angostura, lemon replaces lime', 'paul.harrington', ARRAY[]::text[], 'townhouse.emeryville', 'https://punchdrink.com/recipes/jasmine/', 'Gin shaken with fresh lemon, Cointreau and a little Campari, strained into a chilled cocktail glass with a lemon twist.', 'Paul Harrington made the Jasmine in the early 1990s at the Townhouse Bar & Grill in Emeryville, California, naming it for his friend Matt Jasmin (the spelling slipped). He built it from the Pegu Club, using lemon for lime and a little Campari in place of the bitters. It spread through his 1998 book Cocktail, and many drinkers say it tastes oddly like grapefruit juice.

Method: Shake with ice and strain into a chilled cocktail glass; garnish with a lemon twist.', 'Coupe', NULL, 'Shake'),
    ('spumoni', 'Spumoni', 1990, true, 'negroni', 'garibaldi', false, 'Grapefruit juice for orange, topped with tonic', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/big-in-japan-spumoni-aperitivo-cocktail-recipe/', 'Campari and pink grapefruit juice stirred in a Collins glass over ice and topped with tonic water, with a grapefruit wedge.', 'The Spumoni sounds Italian but is a Japanese bar staple: a Garibaldi-style Campari highball with grapefruit in place of orange and a tonic top. Ben Rojo places it in Roppongi or Ginza around the late 1980s or early 1990s, and Italian experts do not know it. Suntory sold a canned version for a while before dropping it. It reached New York through Bar Pisellino in 2019.

Method: Stir the Campari and grapefruit in the glass, fill with ice and top with tonic.', 'Collins', 'Cubes', 'Build'),
    ('lychee-martini', 'Lychee Martini', 1993, true, 'martini', 'vodka-martini', false, 'Lychee liqueur or syrup with vodka, a splash of dry vermouth or none', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/lychee-vodka-martini-cocktail-so-1993-nyc/', 'Vodka stirred with lychee liqueur, lychee juice, dry vermouth and a touch of lychee syrup, served up with a skewered lychee.', 'The Lychee Martini took hold in New York in the 1990s, and who poured it first is disputed. Decibel, the East Village sake bar opened in 1993, has the earliest firm claim; Vong (1993), Edward Lee''s Clay on Mott Street, and Indochine, with an earlier Lychee Saketini, are all named too. It is a Vodka Martini with lychee taking over from most of the vermouth. Many specs adapt Clay''s.

Method: Stir with ice and fine strain into a chilled martini glass; garnish with a lychee.', 'Martini', NULL, 'Stir'),
    ('ancient-mariner', 'Ancient Mariner', 1994, false, 'tiki', 'navy-grog', false, 'Re-creation of Trader Vic''s Navy Grog with allspice dram, no honey', 'jeff.berry', ARRAY[]::text[], NULL, 'https://cold-glass.com/2013/04/02/rum-fruit-and-spice-the-ancient-mariner/', 'Two rums shaken with lime, grapefruit, rich syrup and allspice dram, strained over crushed ice with a lime wedge and mint.', 'Jeff ''Beachbum'' Berry created the Ancient Mariner in Los Angeles in 1994 as his re-creation of Trader Vic''s Navy Grog, using allspice dram and leaving out the honey. He published it in his Grog Log (1998). The drink marks the start of the modern tiki revival, which Berry''s books did much to drive.

Method: Shake with ice and strain into a double old-fashioned glass filled with crushed ice.', 'Rocks', 'Crushed', 'Shake'),
    ('seelbach', 'Seelbach', 1995, false, 'highball', 'champagne-cocktail', true, 'Bourbon, Cointreau and heavy Angostura and Peychaud''s under champagne', 'adam.seger', ARRAY[]::text[], 'seelbachhilton', 'https://www.malaymail.com/news/eat-drink/2016/11/02/that-historic-cocktail-turns-out-its-a-fake/1241039', 'Bourbon, Cointreau and Angostura and Peychaud''s bitters in a chilled flute, topped with champagne and an orange twist.', 'For years the Seelbach was sold as a lost pre-Prohibition house cocktail of Louisville''s Seelbach Hotel, rediscovered in 1995. In 2016 Adam Seger, the hotel''s bar manager at the time, told the New York Times he had invented both the drink and its backstory in 1995. The tale of champagne spilled into a Manhattan was part of the fiction, but the drink, bourbon and Cointreau with heavy bitters under champagne, stands on its own.

Method: Pour the bourbon, Cointreau and bitters into a chilled flute and top with champagne.', 'Flute', NULL, 'Build'),
    ('appletini', 'Appletini', 1996, false, 'martini', 'vodka-martini', false, 'Sour apple schnapps (often with lemon or Cointreau) in place of vermouth, shaken', NULL, ARRAY[]::text[], 'lolas.weho', 'https://en.wikipedia.org/wiki/Appletini', 'Vodka shaken with sour apple schnapps and Cointreau, strained into a chilled cocktail glass with an apple slice.', 'The Appletini began in 1996 at Lola''s in West Hollywood as the Adam''s Apple Martini, named for the bartender who made it, known only as Adam. Apple schnapps does the job vermouth would in a Vodka Martini, giving it its green colour and candy-apple tang. It became the emblem of the late-1990s flavoured ''tini'' era.

Method: Shake with ice and strain into a chilled cocktail glass; garnish with an apple slice.', 'Martini', NULL, 'Shake'),
    ('breakfast-martini', 'Breakfast Martini', 1996, false, 'sidecar', 'white-lady', false, 'A spoon of orange marmalade shaken in', 'salvatore.calabrese', ARRAY[]::text[], 'librarybar.lanesborough', 'https://en.wikipedia.org/wiki/Breakfast_martini', 'Gin shaken with Cointreau, fresh lemon and a spoonful of orange marmalade, strained into a chilled cocktail glass with a twist.', 'Salvatore Calabrese created the Breakfast Martini in 1996 at the Library Bar of the Lanesborough hotel in London. A spoonful of orange marmalade shaken into a White Lady mix of gin, Cointreau and lemon gives it a bittersweet, toast-and-jam edge. It echoes the Marmalade Cocktail in the Savoy Cocktail Book (1930), and despite the name it is a sour, not a Martini.

Method: Shake with ice and strain into a chilled cocktail glass; garnish with a lemon twist.', 'Martini', NULL, 'Shake'),
    ('cable-car', 'Cable Car', 1996, false, 'sidecar', 'sidecar', false, 'Spiced rum base, orange curaçao, cinnamon-sugar rim', 'tony.abouganim', ARRAY[]::text[], 'starlightroom.sf', 'https://vinepair.com/cocktail-recipe/cable-car/', 'Spiced rum, orange curaçao and lemon shaken with a little syrup and egg white, served in a coupe with a cinnamon-sugar rim.', 'Tony Abou-Ganim created the Cable Car in 1996 at Harry Denton''s Starlight Room in San Francisco, in a commission for Captain Morgan, and named it after the city''s cable cars. Spiced rum, orange curaçao and lemon make it a Sidecar riff, though some point to the Brandy Crusta for its sugared rim. There is also a disputed claim for Cory Reistad.

Method: Rim a chilled coupe with cinnamon sugar, shake with ice, dry shake without ice and fine strain.', 'Coupe', NULL, 'dry shake and shake'),
    ('quill', 'Quill', 1996, false, 'negroni', 'negroni', false, 'Add absinthe (rinse or dash)', 'frank.payne', ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/5064/quill', 'Gin, Campari and sweet vermouth stirred with a little absinthe and served over a large ice cube with an orange twist.', 'The Quill is a Negroni with a touch of absinthe. It first appears in the 1996 edition of Harry''s ABC of Mixing Cocktails, added by Andrew and Duncan MacElhone and credited to Frank C. Payne of New York. Payne was a theatrical press agent whose union published a magazine called The Quill from 1930, which hints the drink is older than its first printing, though no source confirms it was named for the magazine.

Method: Stir with ice and strain over a large cube in an old-fashioned glass; express an orange twist over it.', 'Rocks', 'Large Cube', 'Stir'),
    ('mexican-carajillo', 'Carajillo 43', 1998, true, 'flip', 'carajillo', false, 'Licor 43 and espresso over ice, shaken or layered', NULL, ARRAY[]::text[], NULL, 'https://expansion.mx/empresas/2019/06/18/el-carajillo-multiplica-las-ventas-de-licor-43', 'Licor 43 poured over ice with fresh espresso floated on top (or shaken in), served in a rocks glass with coffee beans.', 'Spain''s Carajillo is coffee with a shot of spirit; Mexico rebuilt it around Licor 43, the Spanish vanilla and citrus liqueur, served over ice with fresh espresso either shaken in or layered on top. The liqueur''s own account dates the Mexican serve to 1998. It boomed in Mexico from about 2015 and has since travelled back to Spain.

Method: Pour the Licor 43 over ice and carefully float the espresso on top; garnish with coffee beans.', 'Rocks', 'Cubes', 'Build'),
    ('ranch-water', 'Ranch Water', 1998, true, 'highball', 'gin-rickey', false, 'Drop the grapefruit soda for lime and Topo Chico mineral water: a tequila rickey', 'kevin.williamson', ARRAY[]::text[], 'ranch616', 'https://en.wikipedia.org/wiki/Ranch_water', 'Blanco tequila with lime, a little orange liqueur and agave, built over ice in a Collins glass and topped with sparkling mineral water.', 'Ranch Water is a tequila Rickey: tequila, lime and salty Topo Chico with no sugar in its plainest form. It is often traced to Kevin Williamson''s Ranch 616 in Austin, which he says has served it since opening in 1998 (Community Impact puts the opening in 1999), and he says he first mixed it on hunting trips. The Gage Hotel in Marathon and Marfa also claim it. Texas versions often add orange liqueur and agave, as this one does.

Method: Stir the tequila, lime, liqueur and agave in a Collins glass, add the mineral water and fill with ice.', 'Collins', 'Cubes', 'Build'),
    ('treacle', 'Treacle', 1998, true, 'oldfashioned', 'rum-old-fashioned', false, 'Dark Jamaican rum Old Fashioned with a float of clear apple juice', 'dick.bradsell', ARRAY[]::text[], 'flamingobar.london', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-437', 'Jamaican rum stirred down with sugar syrup and Angostura over ice, finished with a float of clear apple juice and a lemon twist.', 'Dick Bradsell created the Treacle in London in the late 1990s: a dark Jamaican rum Old Fashioned finished with a float of clear apple juice, which softens the rum into something like treacle. The Oxford Companion places it at the Flamingo Bar, another lists El Camino, so the venue is disputed.

Method: Stir half the rum with the syrup and bitters over a little ice, add the rest of the rum and more ice, stir again and float the apple juice.', 'Rocks', 'Cubes', 'Stir'),
    ('paloma', 'Paloma', 1999, true, 'highball', 'highball', true, 'Tequila, lime and grapefruit soda, salted rim', NULL, ARRAY[]::text[], NULL, 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-379', NULL, NULL, NULL, NULL, NULL),
    ('gin-gin-mule', 'Gin Gin Mule', 2000, false, 'highball', 'moscow-mule', false, 'Gin for vodka, muddled mint and homemade ginger beer: a Mule crossed with a Mojito', 'audreysaunders', ARRAY[]::text[], 'beacon.nyc', 'https://vinepair.com/cocktail-recipe/gin-gin-mule-recipe', 'Gin shaken with muddled mint, lime, simple syrup and ginger beer, strained over ice in a highball and garnished with mint.', 'Audrey Saunders created the Gin-Gin Mule in 2000 at Beacon in New York (one database says 2001), crossing a Moscow Mule with a Mojito: gin in place of vodka, her own ginger beer, lime and muddled mint. It later became a signature at her Pegu Club, which opened in 2005, and one of the drinks that defined New York''s cocktail revival.

Method: Muddle the lime, syrup and mint, add gin, ginger beer and ice, shake and strain over ice in a highball.', 'Highball', 'Cubes', 'muddle and shake'),
    ('gold-rush', 'Gold Rush', 2000, true, 'sour', 'whiskey-sour', false, 'Honey syrup instead of sugar, no egg white, bourbon on the rocks', 'tj.siegal', ARRAY[]::text[], 'milkandhoney.nyc', 'https://vinepair.com/cocktail-recipe/the-gold-rush-recipe/', NULL, NULL, NULL, NULL, NULL),
    ('spanish-gin-tonic', 'Spanish Gin Tonic', 2000, true, 'highball', 'gin-and-tonic', false, 'Served in a balloon glass with lots of ice and botanical garnishes', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/balloon-glass-copa-de-balon-gin-tonic-cocktail/', 'Gin and tonic over plenty of ice in a balloon glass, with Angostura and aromatic garnishes such as juniper, citrus peel or rosemary.', 'The Spanish gintonic, served in a big copa de balón packed with ice and aromatic garnishes, emerged in the early 2000s as the after-hours drink of Michelin-starred chefs in Catalonia and the Basque Country. Rafael García Santos''s gastronomic meetings in San Sebastián helped spread it. There is no single creator or city, and the US fashion for balloon glasses, via Fever-Tree, came later, around 2007.

Method: Fill the glass with ice, add the tonic, gin and bitters, stir gently and add your garnishes.', 'Wine', 'Cubes', 'Build'),
    ('trident', 'Trident', 2000, true, 'negroni', 'negroni', false, 'Aquavit for gin, Cynar for Campari, dry sherry for sweet vermouth, peach bitters', 'robert.hess', ARRAY[]::text[], NULL, 'https://punchdrink.com/recipes/trident/', 'Aquavit, Cynar and fino sherry stirred with peach bitters and strained into a chilled coupe with a lemon peel.', 'Robert Hess created the Trident in Seattle around 2000 (some say 2002) by turning the Negroni inside out: aquavit for gin, Cynar for Campari, dry sherry for sweet vermouth, plus peach bitters. It was long a staple at Zig Zag Café. Hess later added a dash of orange bitters and says he prefers amontillado to fino.

Method: Stir with ice and strain into a chilled coupe; garnish with a lemon peel.', 'Coupe', NULL, 'Stir'),
    ('bourbon-renewal', 'Bourbon Renewal', 2001, true, 'sour', 'whiskey-sour', false, 'Add creme de cassis and Angostura, serve on crushed ice', 'jeffmorgen', ARRAY[]::text[], 'belami.eugene', 'https://vinepair.com/cocktail-recipe/bourbon-renewal/', 'Bourbon shaken with lemon, crème de cassis, simple syrup and Angostura, strained over fresh ice in a rocks glass.', 'Jeffrey Morgenthaler created the Bourbon Renewal in 2001 or 2002 in Eugene, Oregon, while working at Bel Ami. It is a Whiskey Sour deepened with crème de cassis and a dash of Angostura, fruity but still tart. It later became a fixture on the Clyde Common menu in Portland.

Method: Shake with ice and strain over fresh ice; garnish with a lemon wedge or fresh currants.', 'Rocks', 'Cubes', 'Shake'),
    ('enzoni', 'Enzoni', 2001, true, 'negroni', 'negroni', false, 'Muddled green grapes replace sweet vermouth, lemon and sugar added, shaken', 'vincenzo.errico', ARRAY[]::text[], 'matchbar.london', 'https://vinepair.com/cocktail-recipe/enzoni/', 'Gin and Campari shaken with muddled green grapes, lemon and simple syrup, double strained over ice in a rocks glass.', 'Vincenzo Errico created the Enzoni at Match Bar in London around 2001, then refined it at Milk & Honey in New York under Sasha Petraske (some sources date it to Milk & Honey in 2003). Muddled green grapes stand in for the sweet vermouth of a Negroni, with lemon and sugar added and the whole thing shaken, so it drinks like a bitter sour.

Method: Muddle the grapes, add the rest, shake with ice and double strain over ice.', 'Rocks', 'Cubes', 'muddle and shake'),
    ('old-cuban', 'Old Cuban', 2001, false, 'tiki', 'mojito', false, 'Aged rum, Angostura, served up and topped with champagne', 'audreysaunders', ARRAY[]::text[], 'beacon.nyc', 'https://classbarmag.com/news/fullstory.php/aid/1257/Modern_classics:_The_Old_Cuban.html', 'Aged rum shaken with muddled mint, lime, simple syrup and Angostura, strained into a coupe and topped with champagne.', 'Audrey Saunders began the Old Cuban at Beacon in New York, finished it at Tonic and launched it at Bemelmans Bar in 2001. It is a Mojito dressed for evening: aged rum, lime, mint and Angostura, shaken and served up, then crowned with champagne in the manner of a French 75. It later became a staple at Pegu Club.

Method: Muddle the lime, syrup and mint, add rum, bitters and ice, shake, strain into a cocktail glass and top with champagne.', 'Coupe', NULL, 'shake and top'),
    ('white-negroni', 'White Negroni', 2001, false, 'negroni', 'negroni', false, 'French swaps: Suze for Campari, Lillet Blanc for sweet vermouth', 'wayne.collins', ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/white-negroni-became-modern-classic-suze-cocktail-recipe/', NULL, NULL, NULL, NULL, NULL),
    ('porn-star-martini', 'Porn Star Martini', 2002, false, 'sour', 'sour', true, 'Vanilla vodka sour with passion fruit, Passoa and vanilla sugar, served with a shot of champagne on the side', 'douglas.ankrah', ARRAY[]::text[], 'townhouse.knightsbridge', 'https://en.wikipedia.org/wiki/Pornstar_martini', NULL, NULL, NULL, NULL, NULL),
    ('chartreuse-swizzle', 'Chartreuse Swizzle', 2003, false, 'tiki', 'swizzle', true, 'Green Chartreuse as base with pineapple, lime and falernum', 'marcovaldo.dionysos', ARRAY[]::text[], 'starlightroom.sf', 'https://en.wikipedia.org/wiki/Chartreuse_swizzle', 'Green Chartreuse with pineapple, lime and Velvet Falernum, shaken and served over ice in a tall glass with lime and pineapple.', 'Marcovaldo Dionysos won a 2003 Chartreuse-sponsored competition in San Francisco with this drink (one account says 2002), taking green Chartreuse into tiki territory with pineapple, lime and Velvet Falernum. It went on the menu at Harry Denton''s Starlight Room without much fuss, then took off on Clock Bar''s opening menu in 2008 and at Smuggler''s Cove from 2010. It became an IBA official cocktail in 2024.

Method: Shake with ice and strain over ice in a pint or Collins glass; garnish with lime and pineapple.', 'Collins', 'Cubes', 'Shake'),
    ('1794', '1794', 2004, false, 'negroni', 'boulevardier', false, 'High-proof rye for bourbon', 'dominic.venegas', ARRAY[]::text[], 'range.sf', 'https://cold-glass.com/2010/09/15/1794-cocktail-the-boulevardier-comes-to-manhattan/', 'Rye whiskey stirred with sweet vermouth and Campari (plus optional mole bitters), served up in a coupe with a flamed orange twist.', 'Dominic Venegas created the 1794 at Range in San Francisco in 2004: a Boulevardier made with high-proof rye in place of bourbon. The name recalls the Whiskey Rebellion of 1794. His original had no bitters; the dash of mole bitters came later.

Method: Stir with ice and strain into a chilled coupe; flame an orange twist over it.', 'Coupe', NULL, 'Stir'),
    ('eastside', 'Eastside', 2004, false, 'sour', 'southside', false, 'Add muddled cucumber, lime for lemon', 'george.delgado', ARRAY[]::text[], 'libation.nyc', 'https://vinepair.com/cocktail-recipe/eastside/', 'Gin shaken with muddled cucumber, mint, lime and syrup, fine strained into a chilled coupe with a splash of soda and a cucumber slice.', 'George Delgado created the Eastside at Libation in New York in 2004, first as a long drink: a Southside with muddled cucumber and lime. The straight-up version took shape at Milk & Honey, through Christy Pope or Chad Solomon. In Regarding Cocktails (2016) Pope credits Solomon''s Eastside Fizz at Milk & Honey instead, so the origin is disputed.

Method: Muddle the cucumber, bruise the mint, add gin, lime and syrup, shake with ice, fine strain into a chilled coupe and top with soda.', 'Coupe', NULL, 'muddle and shake'),
    ('red-hook', 'Red Hook', 2004, true, 'martini', 'brooklyn', false, 'Punt e Mes replaces the dry vermouth and Amer Picon; keep the maraschino', 'vincenzo.errico', ARRAY[]::text[], 'milkandhoney.nyc', 'https://barrypopik.com/blog/red_hook_cocktail', NULL, NULL, NULL, NULL, NULL),
    ('revolver', 'Revolver', 2004, false, 'oldfashioned', 'old-fashioned', false, 'Coffee liqueur as the sweetener, orange bitters, flamed orange', 'jon.santer', ARRAY[]::text[], 'brunos.sf', 'https://vinepair.com/cocktail-recipe/revolver/', 'Bourbon stirred with coffee liqueur and orange bitters, strained into a chilled coupe and finished with a flamed orange peel.', 'Jon Santer created the Revolver in 2004 at Bruno''s in San Francisco (one source says 2003): bourbon sweetened with coffee liqueur and sharpened with orange bitters, finished with a flamed orange peel. Some call it a Manhattan riff because it is served up with a liqueur where vermouth would go, though its build of spirit, sweetener and bitters is an Old Fashioned. It spread through Bourbon & Branch from 2006.

Method: Stir with ice, strain into a chilled coupe and flame an orange peel over the top.', 'Coupe', NULL, 'Stir'),
    ('black-manhattan', 'Black Manhattan', 2005, false, 'martini', 'manhattan', false, 'Amaro Averna in place of sweet vermouth', 'todd.smith', ARRAY[]::text[], 'bourbonandbranch', 'https://kindredcocktails.com/cocktail/black-manhattan', 'Rye whiskey stirred with Amaro Averna, Angostura and orange bitters, served up in a cocktail glass with a cherry.', 'Todd Smith made the Black Manhattan in San Francisco in 2005, putting Amaro Averna where the sweet vermouth goes. Several accounts say he first served it at Cortez, with bourbon, half an ounce of Averna and house bitters, then took it to Bourbon & Branch when that bar opened in 2006; many simply credit Bourbon & Branch. The amaro gives it a darker, more bitter depth.

Method: Stir with ice and strain into a cocktail glass; garnish with a cherry.', 'Coupe', NULL, 'Stir'),
    ('chet-baker', 'Chet Baker', 2005, false, 'oldfashioned', 'rum-old-fashioned', false, 'Honey for sugar, a little sweet vermouth', 'sam.ross', ARRAY[]::text[], 'milkandhoney.nyc', 'https://kindredcocktails.com/cocktail/chet-baker', 'Rum stirred with Punt e Mes, honey syrup and Angostura, strained over ice in a rocks glass.', 'Sam Ross created the Chet Baker at Milk & Honey in New York in 2005 when Sasha Petraske asked for a stirred drink for summer. It is a rum Old Fashioned sweetened with honey, with a little sweet vermouth that nods to the Manhattan. The name honours the jazz trumpeter.

Method: Stir with ice and strain over ice in a rocks glass.', 'Rocks', 'Cubes', 'Stir'),
    ('chocolate-negroni', 'Chocolate Negroni', 2005, true, 'negroni', 'negroni', false, 'Punt e Mes for sweet vermouth, plus dark crème de cacao and chocolate bitters', 'naren.young', ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/cocktails/recipe/5852/chocolate-negroni', 'Gin, Punt e Mes and Campari stirred with dark crème de cacao and chocolate bitters, served over ice with an orange wedge and grated chocolate.', 'Naren Young devised the Chocolate Negroni in New York in the 2000s; the year and first bar are uncertain. Punt e Mes takes the place of sweet vermouth, and a little dark crème de cacao and chocolate bitters bring cocoa to the bitter core. Punch now lists it under Dante, where Young later worked.

Method: Stir with ice and strain over fresh ice; garnish with an orange wedge and grated chocolate.', 'Rocks', 'Cubes', 'Stir'),
    ('earl-grey-martini', 'Earl Grey MarTEAni', 2005, true, 'sour', 'gin-sour', false, 'Earl Grey-infused gin and egg white, half sugar rim', 'audreysaunders', ARRAY[]::text[], 'pegu.club.nyc', 'https://punchdrink.com/recipes/earl-grey-marteani/', 'Earl Grey-infused gin shaken with lemon, simple syrup and egg white, strained into a chilled glass half-rimmed with sugar.', 'Audrey Saunders created the Earl Grey MarTEAni: gin infused with Earl Grey tea, shaken with lemon, sugar and egg white and served in a glass half-rimmed with sugar. It became a signature at Pegu Club after it opened in 2005, though it may date from her time at Bemelmans in the early 2000s. Despite the name it is a gin sour, not a Martini.

Method: Shake hard with ice and strain into a chilled martini glass half-rimmed with sugar; garnish with a lemon twist.', 'Martini', NULL, 'Shake'),
    ('fitty-fitty', 'Fitty-Fitty', 2005, false, 'martini', 'fifty-fifty', false, 'Fifty-Fifty with a blend of two orange bitters (''Feegan''s'')', 'audreysaunders', ARRAY[]::text[], 'pegu.club.nyc', 'https://robertsimonson.substack.com/p/audrey-saunders-talks-gin', 'Equal parts gin and dry vermouth stirred with orange bitters, strained into a chilled coupe with a lemon peel.', 'Audrey Saunders made the Fitty-Fitty for the 2005 opening of Pegu Club in New York: the old Fifty-Fifty of equal gin and dry vermouth, with a dash each of Regans'' and Fee Brothers orange bitters. She treats it as a study in calibration, matching bold gins with bolder vermouths. Some put an earlier Saunders version around 2003.

Method: Stir with ice and strain into a chilled coupe; garnish with a lemon peel.', 'Coupe', NULL, 'Stir'),
    ('hugo', 'Hugo', 2005, false, 'highball', 'spritz', true, 'Elderflower (originally lemon balm) syrup, mint and lime replace the bitter', 'roland.gruber', ARRAY[]::text[], 'sanzeno.naturns', 'https://classbarmag.com/news/fullstory.php/aid/2056/Neo_classic:_the_story_behind_the_Hugo.html', 'Prosecco and soda with elderflower liqueur and fresh mint, built over ice in a wine glass and garnished with lime and mint.', 'Roland Gruber created the Hugo in 2005 at San Zeno Bar in Naturns, South Tyrol, as a lighter alternative to the bitter Spritz. He first sweetened it with lemon balm syrup before elderflower took over, with mint and lime to finish. It spread across the Alps and German-speaking Europe by about 2012.

Method: Add mint to a chilled wine glass, fill with ice, add the rest and stir briefly.', 'Wine', 'Cubes', 'Build'),
    ('kentucky-maid', 'Kentucky Maid', 2005, false, 'sour', 'eastside', false, 'Bourbon in a cucumber-mint lime sour, served on the rocks', 'sam.ross', ARRAY[]::text[], 'milkandhoney.nyc', 'https://www.diffordsguide.com/cocktails/recipe/14930/kentucky-maid', 'Bourbon shaken with muddled cucumber, mint, lime and syrup, fine strained over ice in a rocks glass with a cucumber slice.', 'Sam Ross created the Kentucky Maid at Milk & Honey in New York in 2005 (or between 2004 and 2007). It takes the Eastside''s cucumber, mint and lime sour, sets it on bourbon and serves it on the rocks.

Method: Muddle the cucumber, add the rest, shake with ice and fine strain over ice.', 'Rocks', 'Cubes', 'muddle and shake'),
    ('little-italy', 'Little Italy', 2005, false, 'martini', 'manhattan', false, 'Cynar in place of the bitters', 'audreysaunders', ARRAY[]::text[], 'pegu.club.nyc', 'https://vinepair.com/cocktail-recipe/little-italy/', NULL, NULL, NULL, NULL, NULL),
    ('penicillin', 'Penicillin', 2005, false, 'sour', 'gold-rush', false, 'Blended Scotch for bourbon, add ginger to the honey syrup and an Islay float', 'sam.ross', ARRAY[]::text[], 'milkandhoney.nyc', 'https://en.wikipedia.org/wiki/Penicillin_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('bensonhurst', 'Bensonhurst', 2006, false, 'martini', 'red-hook', false, 'Back to dry vermouth and maraschino, Cynar in place of Amer Picon', 'chad.solomon', ARRAY[]::text[], 'milkandhoney.nyc', 'https://punchdrink.com/recipes/bensonhurst/', 'Rye whiskey stirred with dry vermouth, maraschino liqueur and a touch of Cynar, strained into a chilled Nick & Nora glass.', 'Chad Solomon created the Bensonhurst in 2006, one of the Brooklyn-neighbourhood riffs that followed the Red Hook. It goes back to the Brooklyn''s dry vermouth and maraschino and uses Cynar where the original had Amer Picon. Accounts place it at Milk & Honey or at Pegu Club; Solomon worked at both.

Method: Stir with ice and strain into a Nick & Nora glass.', 'Nick & Nora', NULL, 'Stir'),
    ('contessa', 'Contessa', 2006, true, 'negroni', 'negroni', false, 'Aperol for Campari, dry vermouth for sweet', 'john.gertsen', ARRAY[]::text[], 'no9park.boston', 'https://drinkboston.com/2006/08/31/try-a-little-bitterness-no-9-park/', 'Equal parts gin, Aperol and dry vermouth stirred and served over ice with an orange twist.', 'The Contessa is a lighter Negroni, Aperol for Campari and dry vermouth for sweet, named for the Count''s wife. A 2006 account credits Ryan McGrale and John Gertsen at No. 9 Park in Boston, while others credit Gertsen at Drink, the Boston bar where he later worked.

Method: Stir with ice and strain over ice in an old-fashioned glass; express an orange twist over it.', 'Rocks', 'Large Cube', 'Stir'),
    ('greenpoint', 'Greenpoint', 2006, false, 'martini', 'red-hook', false, 'Yellow Chartreuse and sweet vermouth in place of Punt e Mes and maraschino', 'michael.mcilroy', ARRAY[]::text[], 'milkandhoney.nyc', 'https://bar-vademecum.eu/greenpoint/', 'Rye whiskey stirred with yellow Chartreuse, sweet vermouth, Angostura and orange bitters, served up.', 'Michael McIlroy created the Greenpoint at Milk & Honey in New York in 2006 after tasting the Red Hook, another Brooklyn riff. He used yellow Chartreuse and sweet vermouth in place of the Red Hook''s maraschino and Punt e Mes, and chose yellow Chartreuse over green on purpose.

Method: Stir with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Stir'),
    ('siesta', 'Siesta', 2006, true, 'sour', 'hemingway-daiquiri', false, 'Tequila for rum, Campari for maraschino', 'katie.stipe', ARRAY[]::text[], 'flatironlounge', 'https://punchdrink.com/recipes/siesta/', 'Blanco tequila shaken with lime, grapefruit, simple syrup and a little Campari, strained into a chilled coupe with a lime wheel.', 'Katie Stipe created the Siesta at Flatiron Lounge in New York around 2006. It is a slightly bitter spin on the Hemingway Daiquiri: tequila replaces the rum and Campari takes the place of the maraschino, alongside lime and grapefruit.

Method: Shake with ice and strain into a chilled coupe; garnish with a lime wheel.', 'Coupe', NULL, 'Shake'),
    ('bentons-old-fashioned', 'Benton''s Old Fashioned', 2007, true, 'oldfashioned', 'old-fashioned', false, 'Bacon-fat-washed bourbon and maple syrup', 'don.lee', ARRAY[]::text[], 'pdtnyc', 'https://punchdrink.com/articles/this-is-how-fat-washing-happened-pdt-speakeasy-bar-nyc/', 'Bacon fat-washed bourbon stirred with maple syrup and Angostura, served over a large ice cube with an orange peel.', 'Don Lee created Benton''s Old Fashioned at PDT in New York in 2007 (some sources say 2008), washing bourbon with fat from Benton''s Tennessee bacon and sweetening it with grade B maple syrup. Smoky, savoury and sweet, it made fat-washing a mainstream bar technique.

Method: Stir with ice and strain over a large cube in a rocks glass; garnish with an orange peel.', 'Rocks', 'Large Cube', 'Stir'),
    ('elder-fashion', 'Elder Fashion', 2007, false, 'oldfashioned', 'old-fashioned', false, 'Gin base, St-Germain as the sweetener, orange bitters', 'phil.ward', ARRAY[]::text[], 'deathandcompany', 'https://www.deathandcompanymarket.com/blogs/recipes/elder-fashion', 'Gin and elderflower liqueur stirred with orange bitters over ice, finished with a grapefruit twist.', 'Phil Ward put this on the Death & Co menu in New York around 2007, turning the Old Fashioned into a floral gin drink by letting St-Germain do the sweetening instead of sugar. Orange bitters and a grapefruit twist keep the elderflower from turning cloying. It is one of the simplest drinks from the early Death & Co years and one of the easiest to copy at home. Specs differ on the liqueur: some give half an ounce, others three quarters.

Method: Build in an ice-filled rocks glass, stir, and express a grapefruit twist over the top.', 'Rocks', 'Cubes', 'Build'),
    ('final-ward', 'Final Ward', 2007, true, 'sidecar', 'last-word', false, 'Rye for gin, lemon for lime', 'phil.ward', ARRAY[]::text[], 'deathandcompany', 'https://en.wikipedia.org/wiki/Last_Word_(cocktail)', 'Rye, green Chartreuse, maraschino and lemon shaken in equal parts and served up in a coupe.', 'Phil Ward built the Final Ward at Death & Co in New York around 2007 by taking the equal-parts Last Word and swapping two pieces: rye for gin and lemon for lime. The result keeps the herbal punch of Chartreuse but gains a spicier, rounder backbone. It became one of the best known Last Word riffs and helped make the four-way equal-parts template a bartender favourite.

Method: Shake with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake'),
    ('juliet-and-romeo', 'Juliet and Romeo', 2007, true, 'sour', 'eastside', false, 'Add rose water and Angostura to a cucumber-mint gin sour', 'toby.maloney', ARRAY[]::text[], 'violethourchicago', 'https://kindredcocktails.com/cocktail/juliet-romeo', 'Gin shaken with lime, sugar, muddled cucumber, mint and a pinch of salt, served up with drops of rose water and Angostura on top.', 'Toby Maloney made the Juliet and Romeo around the 2007 opening of The Violet Hour in Chicago. It starts as a cucumber and mint gin sour in the Eastside mould, then adds a pinch of salt in the shaker and a garnish of rose water and Angostura dropped on a floating mint leaf. The aromatics hit first, so the drink smells floral and spiced before it tastes fresh and green.

Method: Muddle the cucumber with the salt, add the rest, shake with ice and strain into a chilled coupe; float a mint leaf topped with the rose water and dot the bitters around it.', 'Coupe', NULL, 'muddle and shake'),
    ('left-hand', 'Left Hand', 2007, false, 'negroni', 'boulevardier', false, 'Add mole bitters, cherry garnish, served up', 'sam.ross', ARRAY[]::text[], 'milkandhoney.nyc', 'https://vinepair.com/cocktail-recipe/left-hand/', 'Bourbon, Campari and sweet vermouth stirred with mole bitters and served up with a brandied cherry.', 'Sam Ross made the Left Hand at Milk & Honey in New York in 2007 (one source says 2006) as the bourbon twin to Michael McIlroy''s rum-based Right Hand. It is a Boulevardier with a heavier hand of whiskey and a couple of dashes of chocolate mole bitters, served up rather than on the rocks. Ross describes it as somewhere between a Negroni and a Manhattan.

Method: Stir with ice, strain into a chilled coupe or Nick & Nora and garnish with a brandied cherry.', 'Coupe', NULL, 'Stir'),
    ('oaxaca-old-fashioned', 'Oaxaca Old Fashioned', 2007, true, 'oldfashioned', 'old-fashioned', false, 'Reposado tequila and mezcal split base, agave syrup', 'phil.ward', ARRAY[]::text[], 'deathandcompany', 'https://punchdrink.com/articles/oaxaca-old-fashioned-became-modern-classic-mezcal-cocktail-recipe/', NULL, NULL, NULL, NULL, NULL),
    ('rapscallion', 'Rapscallion', 2007, true, 'martini', 'rob-roy', false, 'Peated single malt with PX sherry in place of vermouth, pastis rinse', 'craig.harper', ARRAY['adeline.shepherd']::text[], 'rubycph', 'https://bar-vademecum.eu/rapscallion/', 'Talisker single malt stirred with Pedro Ximenez sherry and served up in a pastis-rinsed Nick & Nora with a lemon twist.', 'The Rapscallion began in Edinburgh with Johnnie Walker Black and sherry, then took its lasting form at Ruby in Copenhagen, where Craig Harper and Adeline Shepherd switched to Talisker 10 and Pedro Ximenez. Shepherd dates that version to 2005, Punch to 2007. It reads like a Rob Roy where sweet sherry replaces the vermouth, with a pastis rinse borrowed from the Sazerac, and the PDT Cocktail Book spread it widely in 2011.

Method: Rinse a chilled Nick & Nora with pastis, stir the whisky and sherry with ice, strain in and garnish with a lemon twist.', 'Nick & Nora', NULL, 'Stir'),
    ('right-hand', 'Right Hand', 2007, false, 'negroni', 'boulevardier', false, 'Aged rum base, chocolate (mole) bitters', 'michael.mcilroy', ARRAY[]::text[], 'milkandhoney.nyc', 'https://kindredcocktails.com/cocktail/right-hand', 'Aged rum, sweet vermouth and Campari stirred with chocolate bitters and served up with an orange twist.', 'Michael McIlroy created the Right Hand at Milk & Honey in New York in 2007, prompted by the arrival of Bittermens Xocolatl Mole bitters. It is a rum take on the spirit-heavy Boulevardier ratio, and the chocolate bitters bridge the molasses of the rum and the bitterness of the Campari. Sam Ross answered it with the bourbon-based Left Hand.

Method: Stir with ice, strain into a coupe and garnish with an orange twist.', 'Coupe', NULL, 'Stir'),
    ('agavoni', 'Agavoni', 2008, true, 'negroni', 'negroni', false, 'Blanco tequila for gin, orange bitters', 'bastian.heuser', ARRAY[]::text[], NULL, 'https://cold-glass.com/2012/05/24/tequila-and-mezcal-messing-with-the-negroni/', 'Blanco tequila, sweet vermouth and Campari in equal parts, stirred over ice with orange bitters and a grapefruit twist.', 'German bartender Bastian Heuser formulated the Agavoni for a tequila issue of Mixology Magazine, dated 2008 by some sources and 2009 by others; Robert Hess was the first to print the name. It is a straight tequila Negroni, with orange bitters and a grapefruit peel to lift the agave. The older Rosita had already paired tequila with Campari and vermouth, but the Agavoni is the version most bars now mean by a tequila Negroni.

Method: Stir with ice in a rocks glass and garnish with a grapefruit twist.', 'Rocks', 'Cubes', 'Stir'),
    ('art-of-choke', 'Art of Choke', 2008, false, 'negroni', 'aperitivo', true, 'Cynar and white rum split base, green Chartreuse, a touch of lime and demerara, stirred with mint', 'kyle.davidson', ARRAY[]::text[], 'violethourchicago', 'https://vinepair.com/cocktail-recipe/art-of-choke/', 'White rum and Cynar stirred with green Chartreuse, a little lime and demerara syrup, served over ice with a mint sprig.', 'Kyle Davidson created the Art of Choke at The Violet Hour in Chicago in 2008, the same bar and era that produced the Bitter Giuseppe. Cynar shares the base with white rum, a quarter ounce of green Chartreuse adds herbal heat, and teaspoons of lime and demerara syrup balance it like an Old Fashioned. Its family is debated: it is often grouped with vermouth-and-bitter aperitivos but is built more like an amaro Old Fashioned.

Method: Stir with ice, strain into a rocks glass over fresh ice and garnish with a mint sprig.', 'Rocks', 'Cubes', 'Stir'),
    ('carroll-gardens', 'Carroll Gardens', 2008, true, 'martini', 'red-hook', false, 'Amaro Nardini and Punt e Mes with a touch of maraschino', 'joaquin.simo', ARRAY[]::text[], 'deathandcompany', 'https://www.diffordsguide.com/encyclopedia/138/cocktails/brooklyn-recipes-and-riffs-named-after-neighbourhoods', 'Rye stirred with Punt e Mes, Amaro Nardini and a touch of maraschino, served up with an expressed lemon peel.', 'Joaquín Simó created the Carroll Gardens at Death & Co in Manhattan in 2008 or 2009 and named it for his own Brooklyn neighbourhood. Like the Red Hook before it, it reworks the Brooklyn cocktail, here with bittersweet Punt e Mes, the minty Amaro Nardini and a scant teaspoon of maraschino. It belongs to the run of Brooklyn-neighbourhood Manhattans that New York bartenders traded in the late 2000s.

Method: Stir with ice, strain into a chilled coupe and express a lemon peel over the top.', 'Coupe', NULL, 'Stir'),
    ('conference', 'Conference', 2008, false, 'oldfashioned', 'old-fashioned', false, 'Four-way split base: rye, bourbon, calvados, cognac, with mole bitters', 'brian.miller', ARRAY[]::text[], 'deathandcompany', 'https://www.deathandcompanymarket.com/blogs/recipes/conference', 'Rye, bourbon, calvados and cognac in a four-way split, stirred with demerara syrup and two kinds of bitters over a large cube.', 'Brian Miller created the Conference at Death & Co in New York; the bar dates it to 2008, another says August 2007. It is an Old Fashioned built on four spirits at once (rye, bourbon, apple brandy and cognac), and Avery Glasser of Bittermens suggested the dash of mole bitters. The split base became a signature Death & Co move.

Method: Stir with ice, strain over one large cube in a chilled double rocks glass and garnish with an orange twist and a lemon disc.', 'Rocks', 'Large Cube', 'Stir'),
    ('gin-basil-smash', 'Gin Basil Smash', 2008, false, 'oldfashioned', 'whiskey-smash', false, 'Gin base, basil instead of mint, lemon juice', 'jorg.meyer', ARRAY[]::text[], 'barlelion', 'https://en.wikipedia.org/wiki/Gin_basil_smash', 'Gin shaken hard with lemon, sugar syrup and a big handful of basil, fine strained and served chilled.', 'Jörg Meyer created this at Le Lion, Bar de Paris in Hamburg in 2008, first selling it as the Gin Pesto and publishing it on the bar''s blog on 10 July that year. He was inspired by Dale DeGroff''s Whiskey Smash, which he tasted at Pegu Club, and swapped whiskey for gin and mint for basil. It spread fast across Europe and was later adopted by the IBA.

Method: Muddle the basil with the lemon and syrup, add gin, shake with ice and fine strain into a chilled glass (or over ice); garnish with basil.', 'Coupe', NULL, 'muddle and shake'),
    ('mulata-daisy', 'Mulata Daisy', 2008, false, 'sidecar', 'mulata-daiquiri', false, 'Adds Galliano, muddled fennel seed and a chocolate rim to the rum, lime and crème de cacao daiquiri', 'agostino.perrone', ARRAY[]::text[], 'connaughtbar', 'https://classbarmag.com/news/fullstory.php/aid/1684/Modern_classics:_Mulata_Daisy_.html', 'White rum shaken with lime, dark crème de cacao, Galliano and muddled fennel seed, served up in a chocolate-rimmed coupe.', 'Agostino Perrone created the Mulata Daisy in 2008 for the Bacardi Legacy competition (sources disagree on whether he competed in 2008, 2009 or 2010) and served it at the Connaught Bar in London. It builds on the Mulata Daiquiri of 1930s Havana, rum, lime and chocolate liqueur, adding anise from Galliano and fennel seed plus a cocoa rim. The result tastes like a chocolate liquorice daiquiri.

Method: Muddle the fennel seeds, stir in the lime and sugar to dissolve, add the rest, shake with ice and fine strain into a chilled, cocoa-rimmed coupe.', 'Coupe', NULL, 'muddle and shake'),
    ('paper-plane', 'Paper Plane', 2008, false, 'sidecar', 'last-word', false, 'Keep the equal-parts frame, swap every ingredient: bourbon, Aperol, Amaro Nonino, lemon', 'sam.ross', ARRAY[]::text[], 'violethourchicago', 'https://en.wikipedia.org/wiki/Paper_plane_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('trinidad-sour', 'Trinidad Sour', 2008, true, 'sour', 'whiskey-sour', false, 'Invert the sour: Angostura bitters as the base, rye as the modifier, orgeat to sweeten', 'giuseppe.gonzalez', ARRAY[]::text[], 'cloverclubny', 'https://punchdrink.com/recipes/trinidad-sour/', NULL, NULL, NULL, NULL, NULL),
    ('barrel-aged-negroni', 'Barrel-Aged Negroni', 2009, false, 'negroni', 'negroni', false, 'Batched and rested for weeks in a small used oak barrel', 'jeffmorgen', ARRAY[]::text[], 'clydecommon', 'https://bevinfogroup.com/2011/07/18/trends-aged-to-perfection/', 'A batched Negroni of gin, sweet vermouth and Campari rested for weeks in a small oak barrel, served over ice with orange peel.', 'Jeffrey Morgenthaler began aging cocktails in one-gallon used whiskey barrels at Clyde Common in Portland in 2009 (some bios say 2010), after seeing Tony Conigliaro''s glass-aged Manhattan at 69 Colebrooke Row in London. His Negroni rested about six weeks, which softened the edges and added vanilla and spice from the wood. It launched a bar trend for barrel-aged cocktails worldwide.

Method: Batch equal parts, rest in a small used oak barrel for about six weeks, then stir with ice and serve over ice with an orange peel.

No measures have been published for this one.', 'Rocks', 'Cubes', 'Stir'),
    ('bitter-giuseppe', 'Bitter Giuseppe', 2009, true, 'negroni', 'milano-torino', false, 'Cynar becomes the base with sweet vermouth, plus lemon juice and lots of orange bitters', 'stephen.cole', ARRAY[]::text[], 'violethourchicago', 'https://kindredcocktails.com/cocktail/bitter-giuseppe', 'Cynar and sweet vermouth stirred with lemon juice and a heavy dose of orange bitters, served over a large cube with a lemon twist.', 'Stephen Cole made the Bitter Giuseppe at The Violet Hour in Chicago; sources date it to 2009 or 2007. It puts the artichoke amaro Cynar in the base spirit''s seat, paired with sweet vermouth like a Milano-Torino, and builds it like a low-proof reverse Manhattan. A quarter ounce of lemon and six dashes of orange bitters keep it bright.

Method: Stir with ice and strain into a rocks glass over one large cube; garnish with a lemon twist.', 'Rocks', 'Large Cube', 'Stir'),
    ('cobble-hill', 'Cobble Hill', 2009, false, 'martini', 'red-hook', false, 'Dry vermouth and Amaro Montenegro with muddled cucumber', 'sam.ross', ARRAY[]::text[], 'milkandhoney.nyc', 'https://www.diffordsguide.com/encyclopedia/138/cocktails/brooklyn-recipes-and-riffs-named-after-neighbourhoods', 'Rye stirred with dry vermouth, Amaro Montenegro and gently muddled cucumber, served up with a lemon twist.', 'Sam Ross created the Cobble Hill at Milk & Honey in New York in 2009 and called it a summertime Manhattan. Named for the Brooklyn neighbourhood, it follows the Red Hook in reworking the Brooklyn, using dry vermouth, the floral Amaro Montenegro and muddled cucumber for a lighter, cooler drink. Specs vary a little on the amount of vermouth and cucumber.

Method: Gently muddle the cucumber, add the rest, stir with ice, strain into a coupe and garnish with a lemon twist.', 'Coupe', NULL, 'Stir'),
    ('division-bell', 'Division Bell', 2009, false, 'sidecar', 'last-word', false, 'Mezcal base, Aperol replaces Chartreuse, less maraschino', 'phil.ward', ARRAY[]::text[], 'mayahuel.nyc', 'https://punchdrink.com/recipes/division-bell/', NULL, NULL, NULL, NULL, NULL),
    ('kentucky-buck', 'Kentucky Buck', 2009, true, 'highball', 'buck', true, 'Bourbon buck with muddled strawberry, lemon and Angostura', 'erick.castro', ARRAY[]::text[], 'rickhouse.sf', 'https://www.saveur.com/article/recipes/kentucky-buck-cocktail', 'Bourbon shaken with muddled strawberry, lemon, ginger syrup and Angostura, topped with soda over ice in a Collins.', 'Erick Castro created the Kentucky Buck; some date it to Rickhouse in San Francisco around 2009, while Punch and others tie it to his later bar Polite Provisions in San Diego, opened in 2013. It is a bourbon buck that swaps bottled ginger beer for ginger syrup and soda, with a muddled strawberry and bitters for fruit and spice. It became a modern bar staple.

Method: Muddle the strawberry with the ginger syrup, add lemon, bourbon and bitters, shake with ice, double strain over ice, top with soda and garnish with a lemon wheel.', 'Collins', 'Cubes', 'shake and top'),
    ('kingston-negroni', 'Kingston Negroni', 2009, false, 'negroni', 'negroni', false, 'Funky overproof Jamaican rum (Smith & Cross) for gin', 'joaquin.simo', ARRAY[]::text[], 'deathandcompany', 'https://vinepair.com/cocktail-recipe/kingston-negroni/', 'Funky Jamaican rum, Campari and sweet vermouth in equal parts, stirred and served over a large cube with an orange peel.', 'Joaquín Simó made the Kingston Negroni at Death & Co in New York in 2009, on the spot, when importer Eric Seed brought in Smith & Cross Jamaican rum. He used Phil Ward''s Mr. Potato Head method of swapping one spirit for another in a classic, and the drink went on the menu in spring 2010. The overproof, high-ester rum stands up to Campari in a way most rums cannot.

Method: Stir with ice, strain over a large cube in a rocks glass and garnish with a long orange peel.', 'Rocks', 'Large Cube', 'Stir'),
    ('mezcal-negroni', 'Mezcal Negroni', 2009, true, 'negroni', 'negroni', false, 'Mezcal for gin', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/mezcal-negronis-world-cocktail-recipe/', 'Mezcal, Campari and sweet vermouth in equal parts, stirred over ice with an orange twist.', 'The Mezcal Negroni has no single inventor. A 2022 Punch investigation found it grew up in the late 2000s around New York bars such as Death & Co and Mayahuel, where Phil Ward and Joaquín Simó were championing mezcal, and Misty Kalkofen, sometimes named as its creator, denies it. Swapping gin for smoky mezcal turned out to suit Campari so well that it is now on menus everywhere.

Method: Build in an ice-filled rocks glass, stir, and garnish with an orange twist.', 'Rocks', 'Cubes', 'Build'),
    ('slope', 'Slope', 2009, true, 'martini', 'red-hook', false, 'Punt e Mes with apricot liqueur in place of maraschino', 'julie.reiner', ARRAY[]::text[], 'cloverclubny', 'https://punchdrink.com/recipes/the-slope/', 'Rye stirred with Punt e Mes, a little apricot liqueur and Angostura, served up.', 'Julie Reiner created The Slope in 2009 as the house Manhattan on the opening menu of Clover Club in Brooklyn, naming it for Park Slope. It follows the Red Hook template, with Punt e Mes as the vermouth, but uses apricot liqueur where the Red Hook uses maraschino. The result is a rich, slightly fruity Manhattan.

Method: Stir with ice and strain into a chilled cocktail glass.', 'Coupe', NULL, 'Stir'),
    ('death-in-venice', 'Death in Venice', 2010, false, 'highball', 'champagne-cocktail', true, 'Campari and grapefruit bitters in place of sugar and Angostura, prosecco', 'tony.conigliaro', ARRAY[]::text[], '69colebrookerow', 'https://www.diffordsguide.com/cocktails/recipe/2923/death-in-venice', 'Campari and grapefruit bitters topped with dry prosecco in a flute, finished with an orange twist.', 'Tony Conigliaro created Death in Venice at 69 Colebrooke Row in London in 2010; 2009, sometimes quoted, is the year the bar opened. It follows the Champagne Cocktail pattern of bitters and a modifier topped with sparkling wine, but replaces the sugar cube and Angostura with Campari and grapefruit bitters. The name nods to Thomas Mann''s novella.

Method: Pour the Campari and bitters into a chilled flute, top with prosecco and express an orange twist over it.', 'Flute', NULL, 'Build'),
    ('monte-cassino', 'Monte Cassino', 2010, false, 'sidecar', 'last-word', false, 'Rye, Bénédictine and yellow Chartreuse with lemon, equal parts', 'damon.dyer', ARRAY[]::text[], 'louis649.nyc', 'https://www.diffordsguide.com/cocktails/recipe/2994/monte-cassino', 'Rye, Bénédictine, yellow Chartreuse and lemon shaken in equal parts and served up with a lemon twist.', 'Damon Dyer created the Monte Cassino in 2010 at Louis 649 in New York, and it won the competition marking Bénédictine''s 500th anniversary. It follows the equal-parts Last Word template but replaces gin, green Chartreuse, maraschino and lime with rye, Bénédictine, yellow Chartreuse and lemon, which makes it softer and honeyed. The name refers to the Benedictine abbey in Italy.

Method: Shake with ice and fine strain into a chilled coupe; garnish with a lemon twist.', 'Coupe', NULL, 'Shake'),
    ('haitian-divorce', 'Haitian Divorce', 2011, false, 'oldfashioned', 'rum-old-fashioned', false, 'Split base of Haitian rum and mezcal, PX sherry as the sweetener', 'tom.richter', ARRAY[]::text[], 'thebeagle.nyc', 'https://kindredcocktails.com/cocktail/haitian-divorce', 'Haitian rum and mezcal stirred with Pedro Ximenez sherry and Angostura, served over a large cube with orange and lime peels.', 'Tom Richter created the Haitian Divorce at The Beagle in New York in 2011; it is sometimes misremembered as a Death & Co drink. It is a rum Old Fashioned with a split base of aged Haitian rum and smoky mezcal, sweetened with PX sherry instead of sugar. Expressed orange and lime peels finish it.

Method: Stir with ice and strain over a large cube in a rocks glass (or build in the glass); express orange and lime peels over it.', 'Rocks', 'Large Cube', 'Stir'),
    ('industry-sour', 'Industry Sour', 2011, false, 'sidecar', 'last-word', false, 'Fernet-Branca and green Chartreuse as co-bases, lime and simple syrup in equal parts', 'ted.kilgore', ARRAY[]::text[], 'tastebyniche', 'https://kindredcocktails.com/cocktail/industry-sour', 'Fernet-Branca and green Chartreuse shaken in equal parts with lime and simple syrup, served up.', 'Ted Kilgore created the Industry Sour in St. Louis and first published it in 2011; sources place it at Taste by Niche. It follows the equal-parts structure of the Last Word with two bartender favourites, Fernet-Branca and green Chartreuse, as co-bases, which made it a quick hit with people who work behind the bar. Some later specs cut the proportions and add egg white.

Method: Shake with ice and strain into a chilled coupe.', 'Coupe', NULL, 'Shake'),
    ('naked-and-famous', 'Naked and Famous', 2011, false, 'sidecar', 'paper-plane', false, 'Mezcal for bourbon, yellow Chartreuse for Nonino, lime for lemon', 'joaquin.simo', ARRAY[]::text[], 'deathandcompany', 'https://en.wikipedia.org/wiki/Naked_and_famous_(cocktail)', NULL, NULL, NULL, NULL, NULL),
    ('sharpie-mustache', 'Sharpie Mustache', 2011, true, 'negroni', 'boulevardier', false, 'Split rye and gin base, Amaro Meletti for Campari, Bonal quinquina for vermouth, tiki bitters', 'chris.elford', ARRAY[]::text[], 'amoryamargo', 'https://punchdrink.com/recipes/sharpie-mustache/', 'Gin, rye, Amaro Meletti and Bonal stirred with tiki bitters, served in a chilled rocks glass with an orange twist.', 'Chris Elford created the Sharpie Mustache at Amor y Amargo, New York''s all-bitters bar, in 2011 or 2012, while he was exploring Amaro Meletti. It is built like a Boulevardier with a split gin and rye base, Meletti in place of Campari and the quinquina Bonal in place of vermouth, plus tiki bitters. Specs vary on proportions and later versions change the quinquina.

Method: Stir with ice, strain into a chilled rocks glass and garnish with an expressed orange twist.', 'Rocks', NULL, 'Stir'),
    ('unusual-negroni', 'Unusual Negroni', 2011, true, 'negroni', 'negroni', false, 'Hendrick''s gin, Aperol for Campari, Lillet Blanc for sweet vermouth', 'charlotte.voisey', ARRAY[]::text[], NULL, 'https://kindredcocktails.com/cocktail/unusual-negroni', 'Gin, Aperol and Lillet Blanc in equal parts, stirred and served over ice with an orange twist.', 'Some credit Charlotte Voisey with the Unusual Negroni in the US around 2011, others say it first appeared in a Hendrick''s Gin field guide around 2005, so its origin is unclear. Built for Hendrick''s, it swaps Campari for gentler Aperol and sweet vermouth for Lillet Blanc. The result is lighter, more orange-led and less bitter than the classic.

Method: Stir with ice, strain into an ice-filled rocks glass and garnish with an orange twist.', 'Rocks', 'Cubes', 'Stir'),
    ('morgenthaler-amaretto-sour', 'Amaretto Sour (Morgenthaler)', 2012, false, 'sour', 'amaretto-sour', false, 'Back the amaretto with cask-strength bourbon, fresh lemon, rich syrup and egg white', 'jeffmorgen', ARRAY[]::text[], 'clydecommon', 'https://en.wikipedia.org/wiki/Amaretto_sour', 'Amaretto and cask-strength bourbon shaken with lemon, rich syrup and egg white, served over ice with a lemon peel.', 'Jeffrey Morgenthaler published his Amaretto Sour in 2012, during his years at Clyde Common in Portland, to rescue a drink known for sour mix and syrupy sweetness. He backs the amaretto with cask-strength bourbon, uses fresh lemon and a little rich syrup, and adds egg white for texture. It became the version most craft bars now serve.

Method: Dry shake (or blend) to froth the egg white, shake with ice, strain over fresh ice and garnish with a lemon peel and brandied cherries if you like.', 'Rocks', 'Cubes', 'dry shake and shake'),
    ('picante', 'Picante de la Casa', 2012, false, 'sidecar', 'spicy-margarita', false, 'Agave-sweetened spicy margarita with fresh red chili and coriander, no orange liqueur', 'chris.ojeda', ARRAY[]::text[], 'sohohouse.weho', 'https://www.sohohouse.com/en-us/house-notes/issue-006/food-and-drink/ever-wondered-where-our-picante-came-from', 'Reposado tequila shaken with lime, agave, muddled red chilli and coriander, served over ice with a chilli top.', 'The Picante de la Casa grew out of the Margarita Picante that Chris Hudnall served at Soho Beach House Miami from 2011, a version with cucumber and hot sauce. Chris Ojeda of Soho House West Hollywood simplified it to tequila, lime, agave, fresh chilli and coriander, and in 2012 Soho House made it a house cocktail at every location. Without orange liqueur it sits closer to a spicy Tommy''s Margarita.

Method: Muddle the chilli, add the clapped coriander and the rest, shake with ice and double strain into an ice-filled rocks glass; garnish with the chilli top.', 'Rocks', 'Cubes', 'muddle and shake'),
    ('pina-verde', 'Piña Verde', 2012, false, 'tiki', 'pina-colada', false, 'Green Chartreuse becomes the base spirit', 'erick.castro', ARRAY[]::text[], 'politeprovisions', 'https://vinepair.com/cocktail-college/pina-verde/', 'Green Chartreuse shaken with pineapple, cream of coconut and lime, served over pebble ice with a mint sprig.', 'Erick Castro had been floating green Chartreuse on Piña Coladas in San Francisco from about 2009, and in 2012 he put the full version on the menu at Polite Provisions in San Diego. The Piña Verde makes Chartreuse the base spirit of a Piña Colada, so the herbal liqueur takes over from rum. It is lower in volume but just as strong and much greener in flavour.

Method: Shake with ice and strain over pebble ice in a rocks glass; garnish with a mint sprig.', 'Rocks', 'Pebble', 'Shake'),
    ('dead-rabbit-irish-coffee', 'Dead Rabbit Irish Coffee', 2013, false, 'flip', 'irish-coffee', false, 'Richer demerara syrup, a specific whiskey and stiffer hand-whipped cream, served in volume', 'jack.mcgarry', ARRAY['sean.muldoon']::text[], 'thedeadrabbitny', 'https://vinepair.com/cocktail-recipe/dead-rabbit-irish-coffee-recipe', 'Irish whiskey, rich demerara syrup and hot Sumatra coffee in a small glass, crowned with lightly whipped cream and nutmeg.', 'The Dead Rabbit in New York, opened by Jack McGarry and Sean Muldoon in 2013, served Irish Coffee from day one and became famous for it. In January 2016 the team reworked it with Dale DeGroff, moving to rich demerara syrup, a little less whiskey and cream whipped just enough to pour and float. The whiskey has changed over time (Powers Gold, then Clontarf; some specs use Bushmills).

Method: Pour the coffee and syrup into a warmed 6 oz glass with the whiskey, leave room at the top, float the whipped cream and grate nutmeg over it.', NULL, NULL, 'Build'),
    ('frozen-negroni', 'Frozen Negroni', 2013, true, 'negroni', 'negroni', false, 'Diluted and frozen in a slush machine, often with citrus juice', NULL, ARRAY[]::text[], 'parsons.chicago', 'https://www.dnainfo.com/new-york/20130904/fort-greene/chicagos-negroni-slushy-craze-makes-its-way-brooklyn/', 'Gin, Campari, sweet vermouth and orange juice blended with ice into a slush, served with an orange twist.', 'The Negroni slushy took off at Parson''s Chicken & Fish in Chicago, whose original ran gin, Luxardo Bitter, sweet vermouth and lemon juice through a slush machine. Splitty in Brooklyn followed in 2013 with Campari and orange juice, and Joe Campanale''s Alta Linea in New York made it a summer staple in 2015. Diluting and freezing a Negroni makes it lighter and dangerously easy to drink.

Method: Blend everything with 4 cups of ice until smooth (serves 6 to 8) and garnish each glass with an orange twist.', 'Rocks', NULL, 'Blitz'),
    ('lost-lake', 'Lost Lake', 2015, true, 'tiki', 'tiki', true, 'Jamaican rum with passion fruit, pineapple, maraschino and a bitter touch of Campari', 'paul.mcgee', ARRAY[]::text[], 'lostlakechicago', 'https://punchdrink.com/recipes/lost-lake/', 'Jamaican rum shaken with lime, pineapple, passion fruit syrup, maraschino and Campari, served over crushed ice in a Collins.', 'Paul McGee made the Lost Lake the house drink of his Chicago tiki bar of the same name, which opened around 2015. It follows Don the Beachcomber''s tropical blueprint of rum, lime and fruit syrups, but adds maraschino and a quarter ounce of Campari for a bitter edge. It became one of the best known new tiki drinks of the decade.

Method: Shake with crushed ice, pour into a Collins glass, top with more crushed ice and garnish with pineapple fronds, a flower and an umbrella.', 'Collins', 'Crushed', 'Shake'),
    ('last-of-the-oaxacans', 'Last of the Oaxacans', 2016, false, 'sidecar', 'last-word', false, 'Mezcal in place of gin', 'rick.dobbs', ARRAY[]::text[], 'lastword.livermore', 'https://www.diffordsguide.com/cocktails/recipe/9733/last-of-the-oaxacans', 'Mezcal, maraschino, green Chartreuse and lime shaken in equal parts, served up with a cherry.', 'Rick Dobbs created the Last of the Oaxacans in 2016 at The Last Word, a bar in Livermore, California. It is a Last Word with mezcal in place of gin, so smoke runs under the herbal Chartreuse and cherry notes. The same swap is also served elsewhere as the Closing Argument, which differs only in garnish.

Method: Shake with ice, fine strain into a chilled coupe and garnish with a skewered cherry.', 'Coupe', NULL, 'Shake'),
    ('negroni-bianco', 'Negroni Bianco', 2016, true, 'negroni', 'white-negroni', false, 'Italian clear bitter (Luxardo Bitter Bianco) and bianco or dry vermouth instead of Suze and Lillet', NULL, ARRAY[]::text[], NULL, 'https://vinepair.com/articles/how-a-luxardo-family-recipe-sparked-the-bianco-negroni', 'Gin, bianco vermouth and Luxardo Bitter Bianco in equal parts, lightly stirred and served on ice with a grapefruit twist.', 'The Negroni Bianco dates to 2016, after Luxardo revived Bitter Bianco from a family recipe book thought lost when the original distillery in Zara was bombed in the Second World War. Where the White Negroni uses Suze and Lillet, this version keeps an Italian clear bitter and sweet bianco vermouth. Other bars, such as Trick Dog, made related drinks, so no single creator is credited.

Method: Lightly stir with ice, strain into a chilled rocks glass and garnish with a grapefruit twist.', 'Rocks', 'Large Cube', 'Stir'),
    ('basil-gimlet', 'Basil Gimlet', NULL, true, 'sour', 'gimlet', false, 'Muddle or shake fresh basil into a fresh-lime gimlet', 'greg.lindgren', ARRAY[]::text[], 'rye.sf', 'https://punchdrink.com/recipes/basil-gimlet/', 'Gin shaken with lime, simple syrup and muddled basil, fine strained into a coupe with a basil leaf.', 'Greg Lindgren of Rye in San Francisco is credited; he adapted a vodka Basil Gimlet his wife had at Via Matta in Boston and switched it to gin. It is a fresh-lime Gimlet with basil muddled in, and it spread across San Francisco bars. No creation year is recorded.

Method: Muddle the basil, add the rest with ice, shake about 15 seconds and fine strain into a chilled coupe; garnish with a basil leaf.', 'Coupe', NULL, 'muddle and shake'),
    ('bitter-mai-tai', 'Bitter Mai Tai', NULL, false, 'tiki', 'mai-tai', false, 'Campari becomes the main spirit, Jamaican rum the modifier', 'jeremy.oertel', ARRAY[]::text[], 'dram.brooklyn', 'https://punchdrink.com/recipes/bitter-mai-tai/', NULL, NULL, NULL, NULL, NULL),
    ('boston-sour', 'Boston Sour', NULL, true, 'sour', 'whiskey-sour', false, 'Add egg white for a silky foam', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Whiskey_sour', 'Bourbon shaken with lemon, rich sugar syrup and egg white for a silky foam, served up with a lemon twist.', 'A Boston Sour is a Whiskey Sour with egg white; the white is optional in a Whiskey Sour but defines this one. The name''s origin is unknown. A claim that it first appeared in Schmidt''s The Flowing Bowl (1892) does not hold up, since that book contains no Boston Sour.

Method: Shake with ice, strain back into the shaker, dry shake, then fine strain into a chilled coupe and express a lemon twist over it.', 'Coupe', NULL, 'dry shake and shake'),
    ('bourbon-milk-punch', 'Bourbon Milk Punch', NULL, false, 'tiki', 'brandy-milk-punch', false, 'Bourbon instead of brandy', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Milk_punch', 'Bourbon shaken hard with milk, cream and vanilla syrup, strained into a coupe and dusted with nutmeg.', 'Milk punch goes back to 17th-century Britain, but New Orleans made the cold brandy or bourbon version a brunch and Christmas habit across the Deep South. Bourbon replaces the brandy of the Brennan''s classic, shaken with milk, cream, sugar and vanilla. It is served cold with plenty of nutmeg.

Method: Shake with ice, strain into a coupe or wine glass with no ice and grate nutmeg over the top.', 'Coupe', NULL, 'Shake'),
    ('caffe-corretto', 'Caffè Corretto', NULL, true, 'flip', 'spiked-coffee', true, 'Espresso ''corrected'' with grappa, sambuca or brandy, no sugar or cream needed', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Caff%C3%A8_corretto', 'A shot of espresso corrected with a splash of grappa, sambuca or brandy, served in an espresso cup.', 'Caffè corretto means corrected coffee: an Italian bar habit of adding a few drops of spirit, usually grappa, to an espresso, or serving the spirit alongside to pour in. No origin or date is documented. In the Veneto, rexentìn means rinsing the empty cup with the leftover spirit.

Method: Pull an espresso and add a splash of grappa (or serve the spirit on the side).

No measures have been published for this one.', NULL, NULL, 'Build'),
    ('caipiroska', 'Caipiroska', NULL, false, 'tiki', 'caipirinha', false, 'Vodka instead of cachaça', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Caipiroska', 'Vodka with muddled lime wedges and sugar, stirred and served over crushed ice.', 'The Caipiroska is the Caipirinha with vodka in place of cachaça. It is popular in Brazil, Paraguay, Uruguay and Argentina, and has no recorded creator or date. Muddle lightly: pressing the rind too hard turns it bitter.

Method: Muddle the lime and sugars in the glass, add vodka and stir to dissolve, then fill with crushed ice and stir again.', 'Rocks', 'Crushed', 'Build'),
    ('campari-spritz', 'Campari Spritz', NULL, false, 'highball', 'aperol-spritz', false, 'Campari for Aperol: drier and more bitter', NULL, ARRAY[]::text[], NULL, 'https://en.ilsole24ore.com/art/storia-spritz-e-sue-varianti-amari-secolari--AB4s0ykB', 'Campari, prosecco and a splash of soda built over ice in a wine glass with an orange slice.', 'Spritzes began as Austrian-style wine and soda in the Veneto, and bitter liqueurs joined later; Il Sole 24 Ore traces the first printed bitter spritz recipe to 1979. The Campari Spritz uses Campari as the bitter, making it drier and more bitter than the Aperol version. It is more a sibling of the Aperol Spritz than a descendant.

Method: Fill a wine glass with ice, add the Campari, prosecco and soda, stir gently and garnish with an orange slice.', 'Wine', 'Cubes', 'Build'),
    ('carajillo', 'Carajillo', NULL, true, 'flip', 'spiked-coffee', true, 'Espresso with a measure of brandy or rum, Spanish style', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Carajillo', 'Licor 43 shaken hard with fresh espresso and strained over a large ice cube.', 'The Carajillo is a Spanish coffee with brandy or rum, and its origin is folklore: stories place it with Spanish troops in colonial Cuba, Barcelona transport workers, or the Catalan cremat. In Mexico the drink became espresso with Licor 43, the vanilla citrus liqueur launched in 1946, often shaken and served on ice as in this spec. The hot Spanish version is still common.

Method: Shake hard with ice and strain over a large cube in a rocks glass.', 'Rocks', 'Large Cube', 'Shake'),
    ('coquito', 'Coquito', NULL, true, 'flip', 'nog', true, 'Coconut cream and canned milks with rum; usually no egg in modern versions', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.com/wiki/Coquito', 'Puerto Rican holiday punch of white rum blended with cream of coconut, condensed and evaporated milk and spices, served cold.', 'Coquito is Puerto Rico''s Christmas drink, a coconut cousin of eggnog. No creator or date is known, and the modern recipe depends on canned milks and Coco López (introduced in 1948), so it likely took its current form in the mid 20th century. Most current versions skip egg.

Method: Simmer the coconut water with the spices, strain and cool, blend with the rest, chill at least 4 hours, then shake without ice and serve with cinnamon (makes about 12).', 'Rocks', NULL, 'Blitz'),
    ('cosmonaut', 'Cosmonaut', NULL, true, 'sour', 'gin-sour', false, 'Raspberry jam as the sweetener', 'sasha.petraske', ARRAY[]::text[], 'milkandhoney.nyc', 'https://cocktailsdistilled.com/recipe/cosmonaut/', 'Gin shaken with lemon juice and raspberry jam, fine strained into a chilled coupe.', 'Sasha Petraske created the Cosmonaut at Milk & Honey in New York; Michael Madrusan recalls that the name was a jab at the Cosmopolitan. It is a gin sour sweetened with raspberry jam, and it is printed in Sasha Petraske: Regarding Cocktails (2016). The original reportedly used one heaping spoon of jam, while some specs use three barspoons.

Method: Stir the jam into the gin and lemon to dissolve, shake with ice and fine strain into a chilled coupe.', 'Coupe', NULL, 'Shake'),
    ('dark-n-stormy', 'Dark ''n Stormy', NULL, false, 'highball', 'buck', true, 'Dark Bermudian rum floated on ginger beer, lime', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Dark_%27n%27_stormy', 'Ginger beer over ice with dark Bermudian rum floated on top and a lime wedge.', 'The Dark ''n Stormy comes from Bermuda; Gosling''s says it was first mixed shortly after the First World War, pairing its Black Seal rum with ginger beer. Gosling Brothers hold the name as a trademark (registered in the US since 1991), so the official version calls for their rum. It is a buck in all but name.

Method: Fill a highball with ice, pour in the ginger beer, float the rum on top and garnish with a lime wedge.', 'Highball', 'Cubes', 'Build'),
    ('garibaldi', 'Garibaldi', NULL, false, 'negroni', 'campari-soda', false, 'Orange juice in place of soda; the modern ''fluffy'' version aerates fresh juice', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/dante-nyc-garibaldi-campari-cocktail-fever/', 'Campari with freshly squeezed orange juice blended until fluffy, served over ice in a highball with an orange wedge.', 'Campari and orange is an old Italian aperitivo, named for Giuseppe Garibaldi; the idea that the red and orange stand for northern and southern Italy is a story, not history, and no origin date is known. Naren Young revived it at Dante in New York after its 2015 relaunch by aerating fresh juice until fluffy, which made it a modern staple. It is the Campari Soda with orange juice instead of soda.

Method: Press and strain the juice, blend it without ice until fluffy, stir the Campari, syrup and half the juice over ice, then top with the rest.', 'Highball', 'Cubes', 'Build'),
    ('hot-toddy', 'Hot Toddy', NULL, false, 'oldfashioned', 'toddy', true, 'Modern form: whisky, honey and lemon in hot water', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Hot_toddy', 'Whiskey and honey stirred with hot water in a mug, garnished with a lemon wheel and cinnamon stick.', 'Toddy took its name from an Indian palm-sap drink, and from 1786 it meant spirit with sugar and hot water. The familiar sickbed version with whisky, honey and lemon is a later habit with no firm date; in Ireland it is called a hot whiskey. Any dark spirit works.

Method: Add the spirit and honey to a mug, top with hot water, stir to dissolve and garnish with a lemon wheel and a cinnamon stick.', NULL, NULL, 'Build'),
    ('kir-royale', 'Kir Royale', NULL, false, 'highball', 'kir', false, 'Champagne or crémant instead of still wine', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Kir_(cocktail)', 'Crème de cassis topped with Champagne in a flute.', 'The Kir began as blanc-cassis in Burgundy and took the name of Félix Kir, the postwar mayor of Dijon who served it to visiting delegations. The Royale replaces the still white wine with Champagne. Its origin is undocumented, and the name is recorded in American English by 1974.

Method: Pour the cassis into a flute and top with Champagne.', 'Flute', NULL, 'Build'),
    ('mezcal-margarita', 'Mezcal Margarita', NULL, false, 'sidecar', 'margarita', false, 'Mezcal for some or all of the tequila; often sal de gusano rim', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/recipes/mayahuel-mezcal-margarita/', 'Mezcal shaken with Cointreau and lime, served up or over a large cube, with an optional salt rim.', 'The Mezcal Margarita has no credited inventor; it is simply the Margarita with mezcal for some or all of the tequila, often with a sal de gusano rim. A noted spec is from Mayahuel in New York (now closed), one of the first bars to champion mezcal. The smoke makes it richer and savoury.

Method: Shake with ice and strain into a chilled coupe or over a large cube in a rocks glass; garnish with a lime wedge and an optional salt rim.', 'Coupe', NULL, 'Shake'),
    ('midori-sour', 'Midori Sour', NULL, true, 'sour', 'sour', true, 'Melon liqueur as the base', NULL, ARRAY[]::text[], NULL, 'https://tastingtable.com/1226050/how-the-midori-sour-cocktail-defined-the-1980s', 'Midori and vodka stirred with lemon and lime over ice, topped with soda in a Collins.', 'Suntory''s Midori melon liqueur, sold in Japan since 1964, reached the US in 1978, and the Midori Sour became one of the bright green signatures of the 1980s. No creator or bar is credited. The early versions used sour mix; modern ones use fresh lemon and lime.

Method: Build the Midori, vodka and citrus in an ice-filled Collins, stir, top with soda and garnish with a lemon wheel.', 'Collins', 'Cubes', 'Build'),
    ('negroski', 'Negroski', NULL, false, 'negroni', 'negroni', false, 'Vodka for gin', NULL, ARRAY[]::text[], NULL, 'https://www.scattidigusto.it/negroni-ricetta-varianti-cocktail-italiano-famoso-mondo', 'Vodka, Campari and sweet vermouth in equal parts, stirred and served up or over a large cube with an orange twist.', 'The Negroski is the Negroni with vodka in place of gin. It has no documented creator or date; Food Republic ran a Sobieski version around 2011, and a credit to Mauro Mahjoub in Munich has not been confirmed. Without the gin''s botanicals, the Campari and vermouth do all the talking.

Method: Stir with ice for about 30 seconds and strain into a coupe or over a large cube in a rocks glass; garnish with an orange twist.', 'Rocks', 'Large Cube', 'Stir'),
    ('perfect-manhattan', 'Perfect Manhattan', NULL, true, 'martini', 'manhattan', false, 'Split the vermouth evenly between sweet and dry', NULL, ARRAY[]::text[], NULL, 'https://www.diffordsguide.com/g/1221/manhattan-cocktail/history', 'Rye or bourbon stirred with equal parts sweet and dry vermouth and Angostura, served up with a cherry or lemon twist.', 'A Perfect Manhattan splits the vermouth evenly between sweet and dry. Calling split vermouth perfect is an early 20th-century bar usage with no firm first date, and some of the earliest Manhattans already used French vermouth. The dry half makes it leaner and less sweet than the standard.

Method: Stir with ice, strain into a chilled coupe and garnish with a brandied cherry or a lemon twist.', 'Coupe', NULL, 'Stir'),
    ('reverse-martini', 'Reverse Martini', NULL, true, 'martini', 'fifty-fifty', false, 'Flip the ratio: vermouth leads, gin supports', NULL, ARRAY[]::text[], NULL, 'https://culinaryhistorians.org/fdrs-reverse-martini/', 'Extra-dry vermouth with a little gin, stirred and served up with a lemon twist.', 'The Reverse Martini flips the classic: vermouth leads and gin supports, roughly five parts to one. Julia and Paul Child drank it before dinner, and Julia liked to say you could have two of them. No source gives an origin, creator or first date for the name.

Method: Stir the vermouth and gin with ice, strain into a chilled coupe and twist a strip of lemon over it.

No measures have been published for this one.', 'Coupe', NULL, 'Stir'),
    ('rossini', 'Rossini', NULL, false, 'highball', 'bellini', false, 'Strawberry purée for peach', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Bellini_(cocktail)', 'Strawberry purée topped with prosecco in a flute.', 'The Rossini is the Bellini made with strawberry instead of white peach, and the IBA lists it as a Bellini variant. Blogs credit Giuseppe Cipriani in 1948 or the 1950s without evidence, so no date is reliable. It is named after the composer Gioachino Rossini.

Method: Pour the purée into a chilled flute, slowly add the prosecco and stir gently.', 'Flute', NULL, 'Build'),
    ('royal-fizz', 'Royal Fizz', NULL, false, 'highball', 'gin-fizz', false, 'Add a whole egg', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Gin_fizz', 'Gin shaken with lemon, sugar and a whole egg, topped with soda for a rich, frothy fizz.', 'A Royal Fizz is a Gin Fizz with a whole egg shaken in (the white alone makes a Silver Fizz, the yolk a Golden Fizz). It dates to the late 19th century, when fizzes were a bar staple, but no first printing has been found. The whole egg gives it a custardy body.

Method: Dry shake, then shake with ice and strain into a chilled glass; top with soda.', 'Fizz', NULL, 'shake and top'),
    ('rum-old-fashioned', 'Rum Old Fashioned', NULL, false, 'oldfashioned', 'old-fashioned', false, 'Aged rum replaces whiskey', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Old_fashioned_(cocktail)', 'Aged rum stirred with a little overproof rum, falernum, rich syrup and Angostura over a large cube with an orange twist.', 'The Rum Old Fashioned is a template rather than an invention: aged rum in place of whiskey, with sugar and bitters. It has no single origin and is the parent of many modern rum riffs. This spec, adapted from Gonçalo de Sousa Monteiro in Berlin (2009), adds overproof rum and falernum.

Method: Stir with ice and strain over a large cube in a chilled rocks glass; express an orange (or lime) twist over it.', 'Rocks', 'Large Cube', 'Stir'),
    ('rum-punch', 'Rum Punch', NULL, false, 'tiki', 'punch', true, 'Island punch for one: rum, lime, sugar, water, bitters and nutmeg', NULL, ARRAY[]::text[], NULL, 'https://charlestoncitypaper.com/the-fruity-rum-drink-known-as-planters-punch-goes-way-back-in-time/', 'Dark rum, lime, sugar syrup and water in the island 1-2-3-4 ratio, served over ice with Angostura and nutmeg.', 'Rum Punch is a family of Caribbean drinks rather than one recipe, built on the rhyme of one sour, two sweet, three strong and four weak. The earliest verse version found is a Planter''s Punch printed in the London magazine Fun in 1878. Barbados finishes it with Angostura and nutmeg, and it overlaps heavily with the Planter''s Punch.

Method: Dissolve the sugar into syrup, combine with the lime, rum and water, and serve over plenty of ice with a dash of bitters and grated nutmeg.

No measures have been published for this one.', 'Highball', 'Cubes', 'Build'),
    ('sgroppino', 'Sgroppino', NULL, true, 'highball', 'champagne-cocktail', true, 'Lemon sorbetto whisked with vodka and prosecco', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Sgroppino', 'Lemon sorbet whisked with prosecco and vodka into a slushy Venetian after-dinner drink, served in a flute.', 'The Sgroppino comes from Venice, where it is served between courses or after dinner. Blog claims that it dates to the 1500s are unsourced and describe a plain sorbet; the version with prosecco and vodka is later and undated. It is a spoonable relative of sparkling wine cocktails.

Method: Whisk the sorbet with half the prosecco until smooth, whisk in the vodka and remaining prosecco, and pour into a flute.', 'Flute', NULL, 'Whip'),
    ('spicy-margarita', 'Spicy Margarita', NULL, false, 'sidecar', 'margarita', false, 'Chili heat from muddled jalapeño or chili-infused tequila, often agave-sweetened', NULL, ARRAY[]::text[], NULL, 'https://punchdrink.com/articles/spicy-margarita-is-the-drink-of-our-times/', 'Blanco tequila shaken with Cointreau, lime, agave and muddled fresh chilli, served over ice in a Tajín-rimmed glass.', 'The Spicy Margarita has no single inventor. Punch traces it to San Francisco in the early 2000s, when Julio Bermejo infused habanero tequila at Tommy''s, and to 2005, when David Nepove''s muddled-jalapeño Sweet Heat and the Southern Heat at Central 214 in Dallas appeared. From there the trend spread through Texas and beyond in the 2010s.

Method: Rim the glass with Tajín, muddle the chilli and coriander, add the rest, shake with ice and fine strain into the ice-filled glass; garnish with a lime wedge.', 'Rocks', 'Cubes', 'muddle and shake'),
    ('business', 'The Business', NULL, true, 'sour', 'bees-knees', false, 'Lime instead of lemon', 'sasha.petraske', ARRAY[]::text[], 'milkandhoney.nyc', 'https://www.diffordsguide.com/cocktails/recipe/3088/the-business', 'Gin shaken with lime and honey syrup, fine strained into a coupe with a lime twist.', 'The Business is credited to Sasha Petraske at Milk & Honey in New York, and the recipe is printed in Sasha Petraske: Regarding Cocktails (2016). It is the Bee''s Knees with lime in place of lemon, which makes it sharper and greener. No creation year is recorded.

Method: Shake with ice, fine strain into a chilled coupe and express a lime twist over it.', 'Coupe', NULL, 'Shake'),
    ('ti-punch', 'Ti'' Punch', NULL, false, 'tiki', 'punch', true, 'Smallest punch: rhum agricole, a coin of lime, cane syrup, no ice or dilution', NULL, ARRAY[]::text[], NULL, 'https://en.wikipedia.org/wiki/Ti%27_Punch', NULL, NULL, NULL, NULL, NULL),
    ('tia-mia', 'Tia Mia', NULL, false, 'tiki', 'mai-tai', false, 'Split base of mezcal and Jamaican rum', 'ivy.mix', ARRAY[]::text[], 'lanikai.nyc', 'https://en.wikipedia.org/wiki/Ivy_Mix', 'Mezcal and Jamaican rum shaken with lime, orgeat and dry curaçao, served over crushed ice with lime and mint.', 'Ivy Mix created the Tia Mia around 2010 at Lani Kai, Julie Reiner''s short-lived Manhattan tiki bar, starting from Reiner''s Mai Tai and replacing its rhum agricole with mezcal. The exact year is not recorded. It later went on the opening menu of Mix''s own bar, Leyenda in Brooklyn, in 2015, and is one of the best known split-base agave tiki drinks.

Method: Shake with ice and strain over crushed ice in a double rocks glass; garnish with a lime wheel, mint or pineapple frond and an orchid.', 'Rocks', 'Crushed', 'Shake'),
    ('undead-gentleman', 'Undead Gentleman', NULL, false, 'tiki', 'zombie', false, 'Zombie served up in an absinthe-rinsed coupe with cinnamon and grapefruit', 'martin.cate', ARRAY[]::text[], 'smugglerscovesf', 'https://kindredcocktails.com/cocktail/undead-gentleman', 'Jamaican and overproof demerara rums shaken with grapefruit, lime, cinnamon syrup and falernum, served up in an absinthe-rinsed glass.', 'Martin Cate created the Undead Gentleman at Smuggler''s Cove in San Francisco, which opened in 2009; the exact year is unknown and it may date back to his Forbidden Island days. It distils the Zombie into a smaller, stronger drink served up in an absinthe-rinsed glass, keeping the grapefruit, cinnamon and falernum. Twisted grapefruit and lime peels finish it.

Method: Shake with ice, strain into an absinthe-rinsed coupe, then twist grapefruit and lime peels together over it and drop them in.', 'Coupe', NULL, 'Shake');

UPDATE "ft_drinks" f SET "item_id" = i.id FROM "public"."items" i WHERE i.is_catalog AND lower(i.name) = lower(f.name);

INSERT INTO "public"."items" ("name", "item_type", "origin", "is_catalog")
SELECT f.name, 'cocktail', 'Classic', true FROM "ft_drinks" f WHERE f.item_id IS NULL;

UPDATE "ft_drinks" f SET "item_id" = i.id FROM "public"."items" i WHERE f.item_id IS NULL AND i.is_catalog AND lower(i.name) = lower(f.name);

-- Year, family, what changed and the parent. The researched year replaces an older guess.
UPDATE "public"."items" i SET
    "origin_year" = coalesce(f.year, i.origin_year)::smallint,
    "origin_year_approx" = CASE WHEN f.year IS NULL THEN i.origin_year_approx ELSE f.approx END,
    "lineage_family" = f.family,
    "lineage_note" = f.note,
    "lineage_parent_id" = CASE WHEN f.parent_is_style THEN NULL ELSE pf.item_id END,
    "lineage_style_id" = CASE WHEN f.parent_is_style THEN s.id END
FROM "ft_drinks" f
LEFT JOIN "ft_drinks" pf ON pf.key = f.parent AND NOT f.parent_is_style
LEFT JOIN "public"."drink_styles" s ON s.key = f.parent AND f.parent_is_style
WHERE i.id = f.item_id;

-- What it is and its story, only where there's none yet. Glass and ice too.
UPDATE "public"."items" i SET
    "description" = coalesce(i.description, f.description),
    "notes" = coalesce(i.notes, f.notes),
    "glassware_id" = coalesce(i.glassware_id, (SELECT g.id FROM "public"."items" g WHERE g.item_type = 'glassware' AND g.bar_id IS NULL AND lower(g.name) = lower(f.glass) ORDER BY g.created_at LIMIT 1)),
    "ice_id" = coalesce(i.ice_id, (SELECT c.id FROM "public"."items" c WHERE c.item_type = 'ice' AND c.bar_id IS NULL AND lower(c.name) = lower(f.ice) ORDER BY c.created_at LIMIT 1))
FROM "ft_drinks" f
WHERE i.id = f.item_id AND (f.description IS NOT NULL OR f.notes IS NOT NULL OR f.glass IS NOT NULL OR f.ice IS NOT NULL);

INSERT INTO "public"."item_methods" ("item_id", "method_item_id", "sort_order")
SELECT f.item_id, m.id, 0
FROM "ft_drinks" f
JOIN LATERAL (SELECT x.id FROM "public"."items" x WHERE x.item_type = 'method' AND x.bar_id IS NULL AND lower(x.name) = lower(f.method) ORDER BY x.created_at LIMIT 1) m ON true
WHERE f.method IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."item_methods" x WHERE x.item_id = f.item_id);

-- Specs, only for classics with none. Measures were read off the cited page;
-- ingredient-only lines where a source names ingredients but no measures.
-- Ingredients reuse a shared one with the same name key (or alias); new names
-- are added out of ingredient search, like the signature drinks seed.
CREATE TEMP TABLE "ft_lines" ("key" text, "pos" int, "amount" numeric, "unit" text, "ingredient" text, "prep" text, "optional" boolean);
INSERT INTO "ft_lines" VALUES
    ('rompope', 0, NULL, NULL, 'Milk', NULL, false),
    ('rompope', 1, NULL, NULL, 'Egg', NULL, false),
    ('rompope', 2, NULL, NULL, 'Vanilla', NULL, false),
    ('rompope', 3, NULL, NULL, 'Rum', NULL, false),
    ('rompope', 4, NULL, NULL, 'Cinnamon', NULL, true),
    ('milk-punch', 0, NULL, NULL, 'Brandy', 'infused with orange and lemon peel', false),
    ('milk-punch', 1, NULL, NULL, 'Orange Juice', NULL, false),
    ('milk-punch', 2, NULL, NULL, 'Lemon Juice', NULL, false),
    ('milk-punch', 3, NULL, NULL, 'Sugar', NULL, false),
    ('milk-punch', 4, NULL, NULL, 'Milk', 'whole, for clarifying', false),
    ('negus', 0, 1.67, 'oz', 'Ruby Port', NULL, false),
    ('negus', 1, 0.33, 'oz', 'Lemon Juice', 'fresh', false),
    ('negus', 2, 0.25, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('negus', 3, 3.5, 'oz', 'Water', 'boiling', false),
    ('negus', 4, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('fish-house-punch', 0, 1, 'oz', 'Cognac', NULL, false),
    ('fish-house-punch', 1, 1, 'oz', 'Rum', 'light gold', false),
    ('fish-house-punch', 2, 0.67, 'oz', 'Peach Liqueur', 'crème de pêche', false),
    ('fish-house-punch', 3, 1, 'oz', 'Black Tea', 'cold', false),
    ('fish-house-punch', 4, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('fish-house-punch', 5, 0.33, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('sangaree', 0, 2.5, 'oz', 'Tawny Port', 'chilled', false),
    ('sangaree', 1, 3, 'bsp', 'Sugar', 'powdered', false),
    ('sangaree', 2, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('grog', 0, 2, 'oz', 'Rum', 'navy rum, about 55% ABV', false),
    ('grog', 1, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('grog', 2, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('grog', 3, 1.5, 'oz', 'Water', 'chilled', false),
    ('grog', 4, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('gin-sling', 0, 1, 'bsp', 'Caster Sugar', NULL, false),
    ('gin-sling', 1, NULL, NULL, 'Water', 'a splash', false),
    ('gin-sling', 2, 2, 'oz', 'Genever', NULL, false),
    ('gin-sling', 3, NULL, NULL, 'Nutmeg', 'grated', true),
    ('tom-and-jerry', 0, 1.5, 'oz', 'Cognac', NULL, false),
    ('tom-and-jerry', 1, 0.5, 'oz', 'Aged Rum', 'Caribbean blend, 6 to 10 years', false),
    ('tom-and-jerry', 2, 2, 'tbsp', 'Tom and Jerry Batter', 'yolks and stiff whites beaten with sugar, Jamaican rum and spices', false),
    ('tom-and-jerry', 3, NULL, 'top', 'Water', 'boiling', false),
    ('tom-and-jerry', 4, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('draque', 0, NULL, NULL, 'Aguardiente', 'cane', false),
    ('draque', 1, NULL, NULL, 'Sugar', NULL, false),
    ('draque', 2, NULL, NULL, 'Lime Juice', NULL, false),
    ('draque', 3, NULL, NULL, 'Mint', NULL, false),
    ('sherry-cobbler', 0, 3.5, 'oz', 'Amontillado Sherry', NULL, false),
    ('sherry-cobbler', 1, 0.5, 'oz', 'Simple Syrup', '1:1', false),
    ('sherry-cobbler', 2, 2, 'slice', 'Orange', NULL, false),
    ('brandy-smash', 0, 7, 'leaf', 'Mint', 'fresh', false),
    ('brandy-smash', 1, 2, 'oz', 'Cognac', NULL, false),
    ('brandy-smash', 2, 0.25, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('chatham-artillery-punch', 0, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('chatham-artillery-punch', 1, 1, 'oz', 'Demerara Syrup', NULL, false),
    ('chatham-artillery-punch', 2, 1, 'oz', 'Bourbon', 'or rye', false),
    ('chatham-artillery-punch', 3, 1, 'oz', 'Cognac', NULL, false),
    ('chatham-artillery-punch', 4, 1, 'oz', 'Jamaican Rum', 'dark', false),
    ('chatham-artillery-punch', 5, 2, 'oz', 'Champagne', NULL, false),
    ('chatham-artillery-punch', 6, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('pink-gin', 0, 2, 'oz', 'Gin', 'preferably Plymouth', false),
    ('pink-gin', 1, 4, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('prescription-julep', 0, 1.5, 'oz', 'Cognac', NULL, false),
    ('prescription-julep', 1, 0.5, 'oz', 'Rye Whiskey', NULL, false),
    ('prescription-julep', 2, 0.75, 'oz', 'Simple Syrup', '1:1', false),
    ('prescription-julep', 3, 2, 'dash', 'Orange Bitters', NULL, false),
    ('prescription-julep', 4, 5, 'leaf', 'Mint', NULL, false),
    ('black-velvet', 0, 3, 'oz', 'Beer', 'Guinness stout', false),
    ('black-velvet', 1, 3, 'oz', 'Champagne', NULL, false),
    ('baltimore-egg-nogg', 0, 1, 'oz', 'Cognac', NULL, false),
    ('baltimore-egg-nogg', 1, 1, 'oz', 'Dark Rum', NULL, false),
    ('baltimore-egg-nogg', 2, 0.5, 'oz', 'Rainwater Madeira', NULL, false),
    ('baltimore-egg-nogg', 3, 1, 'each', 'Egg', 'whole', false),
    ('baltimore-egg-nogg', 4, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('baltimore-egg-nogg', 5, 0.5, 'oz', 'Heavy Cream', 'whipping cream', false),
    ('baltimore-egg-nogg', 6, 0.5, 'oz', 'Milk', 'whole', false),
    ('blue-blazer', 0, 4, 'oz', 'Blended Scotch', 'warmed', false),
    ('blue-blazer', 1, 4, 'oz', 'Water', 'boiling', false),
    ('blue-blazer', 2, 1, 'bsp', 'Sugar', 'powdered, to taste', false),
    ('blue-blazer', 3, 1, 'peel', 'Lemon Peel', 'to garnish', false),
    ('brandy-cocktail', 0, 2, 'oz', 'Cognac', NULL, false),
    ('brandy-cocktail', 1, 0.25, 'oz', 'Curaçao', 'dry', false),
    ('brandy-cocktail', 2, 0.08, 'oz', 'Gomme Syrup', NULL, false),
    ('brandy-cocktail', 3, 2, 'dash', 'Aromatic Bitters', 'Boker''s style', false),
    ('brandy-cocktail', 4, 1, 'peel', 'Lemon Twist', 'to garnish', false),
    ('brandy-flip', 0, 2, 'oz', 'Cognac', NULL, false),
    ('brandy-flip', 1, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('brandy-flip', 2, 1, 'each', 'Egg', 'whole', false),
    ('brandy-milk-punch', 0, 1.5, 'oz', 'Cognac', NULL, false),
    ('brandy-milk-punch', 1, 1.83, 'oz', 'Milk', 'whole', false),
    ('brandy-milk-punch', 2, 0.33, 'oz', 'Vanilla Syrup', NULL, false),
    ('brandy-milk-punch', 3, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('brandy-sour', 0, 1.67, 'oz', 'Cognac', NULL, false),
    ('brandy-sour', 1, 0.75, 'oz', 'Lemon Juice', 'fresh', false),
    ('brandy-sour', 2, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('brandy-sour', 3, 0.5, 'oz', 'Egg White', NULL, false),
    ('brandy-sour', 4, 3, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('fancy-brandy-cocktail', 0, 2, 'oz', 'Cognac', NULL, false),
    ('fancy-brandy-cocktail', 1, 0.17, 'oz', 'Curaçao', 'dry', false),
    ('fancy-brandy-cocktail', 2, 0.17, 'oz', 'Gomme Syrup', NULL, false),
    ('fancy-brandy-cocktail', 3, 0.17, 'oz', 'Water', 'chilled; omit with wet ice', true),
    ('fancy-brandy-cocktail', 4, 1, 'dash', 'Aromatic Bitters', 'Boker''s style', false),
    ('general-harrisons-egg-nogg', 0, 1, 'each', 'Egg', 'whole', false),
    ('general-harrisons-egg-nogg', 1, 20, 'ml', 'Simple Syrup', NULL, false),
    ('general-harrisons-egg-nogg', 2, 100, 'ml', 'Cider', 'raw, hard', false),
    ('georgia-mint-julep', 0, NULL, 'leaf', 'Mint', 'several, fresh', false),
    ('georgia-mint-julep', 1, 1, 'tsp', 'Sugar', NULL, false),
    ('georgia-mint-julep', 2, 1, 'dash', 'Water', NULL, false),
    ('georgia-mint-julep', 3, 2, 'oz', 'Cognac', 'or other brandy', false),
    ('georgia-mint-julep', 4, 1, 'oz', 'Eau-de-vie', 'peach brandy', false),
    ('gin-cocktail', 0, 2, 'oz', 'Genever', 'oude', false),
    ('gin-cocktail', 1, 0.33, 'oz', 'Curaçao', 'dry', false),
    ('gin-cocktail', 2, 0.17, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('gin-cocktail', 3, 2, 'dash', 'Aromatic Bitters', 'Boker''s style', false),
    ('gin-cocktail', 4, 1, 'peel', 'Lemon Twist', 'to garnish', false),
    ('gin-flip', 0, 2, 'oz', 'Gin', NULL, false),
    ('gin-flip', 1, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('gin-flip', 2, 1, 'each', 'Egg', 'whole', false),
    ('gin-flip', 3, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('gin-sour', 0, 2, 'oz', 'Old Tom Gin', NULL, false),
    ('gin-sour', 1, 1, 'oz', 'Lemon Juice', 'fresh', false),
    ('gin-sour', 2, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('gin-sour', 3, 0.5, 'oz', 'Egg White', NULL, true),
    ('gin-sour', 4, 3, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('gin-sour', 5, 3, 'drop', 'Saline Solution', NULL, true),
    ('hot-apple-toddy', 0, 4, 'oz', 'Apple Brandy', NULL, false),
    ('hot-apple-toddy', 1, 1, 'tbsp', 'Sugar', NULL, false),
    ('hot-apple-toddy', 2, 1, 'each', 'Apple', 'cored and baked; one quarter per mug', false),
    ('hot-apple-toddy', 3, NULL, 'top', 'Water', 'boiling', false),
    ('hot-apple-toddy', 4, NULL, NULL, 'Nutmeg', 'grated', false),
    ('hot-buttered-rum', 0, 1, 'tbsp', 'Hot Buttered Rum Batter', 'butter, brown sugar, honey, vanilla ice cream and spices', false),
    ('hot-buttered-rum', 1, 2, 'oz', 'Dark Rum', '1 oz each of two, such as Old Monk and English Harbour', false),
    ('hot-buttered-rum', 2, 4, 'oz', 'Black Tea', 'hot, preferably lapsang souchong, in two pours', false),
    ('hot-buttered-rum', 3, 1, 'each', 'Star Anise', 'to garnish', false),
    ('japanese-cocktail', 0, 2, 'peel', 'Lemon Peel', NULL, false),
    ('japanese-cocktail', 1, 2, 'oz', 'Cognac', NULL, false),
    ('japanese-cocktail', 2, 0.33, 'oz', 'Orgeat', NULL, false),
    ('japanese-cocktail', 3, 0.33, 'oz', 'Water', 'chilled; omit with wet ice', true),
    ('japanese-cocktail', 4, 3, 'dash', 'Aromatic Bitters', 'Boker''s style', false),
    ('port-wine-flip', 0, 60, 'ml', 'Port', NULL, false),
    ('port-wine-flip', 1, 1, 'each', 'Egg', 'whole', false),
    ('port-wine-flip', 2, 20, 'ml', 'Simple Syrup', NULL, false),
    ('port-wine-flip', 3, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('pousse-cafe', 0, 0.25, 'oz', 'Grenadine', NULL, false),
    ('pousse-cafe', 1, 0.25, 'oz', 'Coffee Liqueur', NULL, false),
    ('pousse-cafe', 2, 0.25, 'oz', 'Crème de Menthe', NULL, false),
    ('pousse-cafe', 3, 0.25, 'oz', 'Triple Sec', NULL, false),
    ('pousse-cafe', 4, 0.25, 'oz', 'Bourbon', NULL, false),
    ('pousse-cafe', 5, 0.25, 'oz', 'Overproof Rum', 'unaged Jamaican', false),
    ('rum-flip', 0, 2, 'oz', 'Rum', NULL, false),
    ('rum-flip', 1, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('rum-flip', 2, 1, 'each', 'Egg', 'whole', false),
    ('rum-flip', 3, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('rum-sour', 0, 1.67, 'oz', 'Aged Rum', 'Caribbean blend, 6 to 10 years', false),
    ('rum-sour', 1, 0.83, 'oz', 'Orange Juice', 'fresh', false),
    ('rum-sour', 2, 0.83, 'oz', 'Lime Juice', 'fresh', false),
    ('rum-sour', 3, 0.42, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('rum-sour', 4, 0.5, 'oz', 'Egg White', NULL, false),
    ('sherry-flip', 0, 2, 'oz', 'Oloroso Sherry', NULL, false),
    ('sherry-flip', 1, 0.5, 'oz', 'Simple Syrup', '1:1', false),
    ('sherry-flip', 2, 1, 'each', 'Egg', 'whole', false),
    ('sherry-flip', 3, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('stone-fence', 0, 2, 'oz', 'Rye Whiskey', '100 proof', false),
    ('stone-fence', 1, NULL, 'top', 'Cider', 'medium dry', false),
    ('whiskey-cocktail', 0, 2, 'oz', 'Rye Whiskey', 'or bourbon', false),
    ('whiskey-cocktail', 1, 1, 'bsp', 'Gomme Syrup', 'or simple syrup; up to 2', false),
    ('whiskey-cocktail', 2, 1, 'dash', 'Aromatic Bitters', 'up to 2', false),
    ('whiskey-cocktail', 3, 1, 'peel', 'Lemon Twist', 'to garnish', false),
    ('whiskey-flip', 0, 2, 'oz', 'Whiskey', NULL, false),
    ('whiskey-flip', 1, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('whiskey-flip', 2, 1, 'each', 'Egg', 'whole', false),
    ('whiskey-flip', 3, NULL, NULL, 'Nutmeg', 'grated, to garnish', false),
    ('whiskey-skin', 0, 1, 'tsp', 'Sugar', NULL, false),
    ('whiskey-skin', 1, 2, 'oz', 'Single Malt Scotch', NULL, false),
    ('whiskey-skin', 2, 2, 'oz', 'Water', 'boiling; up to 3', false),
    ('whiskey-skin', 3, 1, 'peel', 'Lemon Peel', NULL, false),
    ('canchanchara', 0, 2, 'oz', 'Rum', 'light gold', false),
    ('canchanchara', 1, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('canchanchara', 2, 0.67, 'oz', 'Rich Honey Syrup', '3:1', false),
    ('gin-and-tonic', 0, 1.67, 'oz', 'London Dry Gin', NULL, false),
    ('gin-and-tonic', 1, 4, 'oz', 'Tonic Water', NULL, false),
    ('john-collins', 0, 2, 'oz', 'London Dry Gin', NULL, false),
    ('john-collins', 1, 0.83, 'oz', 'Lemon Juice', 'fresh', false),
    ('john-collins', 2, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('john-collins', 3, 1.67, 'oz', 'Soda Water', NULL, false),
    ('pharisaer', 0, NULL, NULL, 'Coffee', 'strong, hot', false),
    ('pharisaer', 1, NULL, NULL, 'Sugar', 'cubes', false),
    ('pharisaer', 2, 40, 'ml', 'Dark Rum', 'about', false),
    ('pharisaer', 3, NULL, NULL, 'Heavy Cream', 'whipped', false),
    ('absinthe-frappe', 0, 1, 'oz', 'Absinthe', NULL, false),
    ('absinthe-frappe', 1, 0.33, 'oz', 'Anisette', NULL, false),
    ('absinthe-frappe', 2, 1, 'oz', 'Water', 'chilled', false),
    ('absinthe-frappe', 3, 0.17, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('brandy-daisy', 0, 1.5, 'oz', 'Cognac', NULL, false),
    ('brandy-daisy', 1, 0.67, 'oz', 'Yellow Chartreuse', NULL, false),
    ('brandy-daisy', 2, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('brandy-daisy', 3, 0.33, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('brandy-daisy', 4, 0.33, 'oz', 'Soda Water', NULL, false),
    ('gin-daisy', 0, 1.5, 'oz', 'Genever', 'oude', false),
    ('gin-daisy', 1, 0.5, 'oz', 'Orange Liqueur', 'cognac-based, such as Grand Marnier', false),
    ('gin-daisy', 2, 0.75, 'oz', 'Lemon Juice', 'fresh', false),
    ('gin-daisy', 3, 0.25, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('gin-daisy', 4, 3, 'drop', 'Saline Solution', NULL, true),
    ('gin-daisy', 5, 0.5, 'oz', 'Soda Water', 'chilled', false),
    ('gin-fizz', 0, 1.67, 'oz', 'London Dry Gin', NULL, false),
    ('gin-fizz', 1, 0.75, 'oz', 'Lemon Juice', 'fresh', false),
    ('gin-fizz', 2, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('gin-fizz', 3, 4, 'oz', 'Soda Water', 'chilled', false),
    ('improved-brandy-cocktail', 0, 1.67, 'oz', 'Cognac', NULL, false),
    ('improved-brandy-cocktail', 1, 0.17, 'oz', 'Gomme Syrup', NULL, false),
    ('improved-brandy-cocktail', 2, 0.08, 'oz', 'Maraschino Liqueur', NULL, false),
    ('improved-brandy-cocktail', 3, 2, 'dash', 'Aromatic Bitters', 'Boker''s style', false),
    ('improved-brandy-cocktail', 4, 1, 'dash', 'Absinthe', NULL, false),
    ('improved-brandy-cocktail', 5, 1, 'peel', 'Lemon Twist', NULL, false),
    ('improved-gin-cocktail', 0, 2, 'oz', 'Genever', 'oude', false),
    ('improved-gin-cocktail', 1, 0.04, 'oz', 'Maraschino Liqueur', NULL, false),
    ('improved-gin-cocktail', 2, 0.04, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('improved-gin-cocktail', 3, 0.04, 'oz', 'Absinthe', NULL, false),
    ('improved-gin-cocktail', 4, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('improved-gin-cocktail', 5, 1, 'peel', 'Lemon Twist', 'to garnish', false),
    ('improved-whiskey-cocktail', 0, 1, 'oz', 'Rye Whiskey', '100 proof', false),
    ('improved-whiskey-cocktail', 1, 1, 'oz', 'Bourbon', NULL, false),
    ('improved-whiskey-cocktail', 2, 0.17, 'oz', 'Maraschino Liqueur', NULL, false),
    ('improved-whiskey-cocktail', 3, 0.08, 'oz', 'Absinthe', NULL, false),
    ('improved-whiskey-cocktail', 4, 0.25, 'oz', 'Gomme Syrup', NULL, false),
    ('improved-whiskey-cocktail', 5, 1, 'dash', 'Aromatic Bitters', 'Boker''s style', false),
    ('improved-whiskey-cocktail', 6, 1, 'peel', 'Lemon Twist', 'to garnish', false),
    ('whiskey-daisy', 0, 1.5, 'oz', 'Bourbon', NULL, false),
    ('whiskey-daisy', 1, 0.5, 'oz', 'Orange Liqueur', 'cognac-based, such as Grand Marnier', false),
    ('whiskey-daisy', 2, 0.5, 'oz', 'Rich Honey Syrup', '3:1', false),
    ('whiskey-daisy', 3, 0.67, 'oz', 'Lemon Juice', 'fresh', false),
    ('whiskey-daisy', 4, 1, 'oz', 'Soda Water', NULL, false),
    ('golden-fizz', 0, 2, 'oz', 'London Dry Gin', NULL, false),
    ('golden-fizz', 1, 1, 'oz', 'Lemon Juice', 'fresh', false),
    ('golden-fizz', 2, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('golden-fizz', 3, 1, 'each', 'Egg Yolk', NULL, false),
    ('golden-fizz', 4, NULL, 'top', 'Soda Water', NULL, false),
    ('morning-glory-fizz', 0, 2, 'oz', 'Blended Scotch', NULL, false),
    ('morning-glory-fizz', 1, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('morning-glory-fizz', 2, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('morning-glory-fizz', 3, 0.5, 'oz', 'Simple Syrup', '1:1', false),
    ('morning-glory-fizz', 4, 1, 'each', 'Egg White', NULL, false),
    ('morning-glory-fizz', 5, 3, 'dash', 'Absinthe', NULL, false),
    ('morning-glory-fizz', 6, NULL, 'top', 'Soda Water', NULL, false),
    ('silver-fizz', 0, 2, 'oz', 'London Dry Gin', NULL, false),
    ('silver-fizz', 1, 1, 'oz', 'Lemon Juice', 'fresh; or lime', false),
    ('silver-fizz', 2, 0.67, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('silver-fizz', 3, 0.67, 'oz', 'Egg White', NULL, false),
    ('silver-fizz', 4, 8, 'drop', 'Bitters', 'ginseng', true),
    ('silver-fizz', 5, 2, 'oz', 'Soda Water', 'chilled', false),
    ('joe-rickey', 0, 0.5, 'each', 'Lime', 'juiced', false),
    ('joe-rickey', 1, 1.5, 'oz', 'Bourbon', NULL, false),
    ('joe-rickey', 2, NULL, 'top', 'Soda Water', NULL, false),
    ('adonis', 0, 2, 'oz', 'Fino Sherry', NULL, false),
    ('adonis', 1, 1, 'oz', 'Sweet Vermouth', NULL, false),
    ('adonis', 2, 2, 'dash', 'Orange Bitters', NULL, false),
    ('rock-and-rye', 0, NULL, NULL, 'Rye Whiskey', NULL, false),
    ('rock-and-rye', 1, NULL, NULL, 'Sugar', 'rock candy', false),
    ('rock-and-rye', 2, NULL, NULL, 'Fruit', NULL, true),
    ('coffee-cocktail', 0, 2, 'oz', 'Tawny Port', NULL, false),
    ('coffee-cocktail', 1, 1, 'oz', 'Cognac', NULL, false),
    ('coffee-cocktail', 2, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('coffee-cocktail', 3, 1, 'each', 'Egg', 'whole', false),
    ('saratoga', 0, 1, 'oz', 'Cognac', NULL, false),
    ('saratoga', 1, 1, 'oz', 'Rye Whiskey', '100 proof', false),
    ('saratoga', 2, 1, 'oz', 'Sweet Vermouth', NULL, false),
    ('saratoga', 3, 1, 'dash', 'Aromatic Bitters', 'Boker''s style', true),
    ('fourth-regiment', 0, 1.5, 'oz', 'Rye Whiskey', '100 proof', false),
    ('fourth-regiment', 1, 1.5, 'oz', 'Sweet Vermouth', NULL, false),
    ('fourth-regiment', 2, 2, 'dash', 'Creole Bitters', 'Peychaud''s', false),
    ('fourth-regiment', 3, 2, 'dash', 'Orange Bitters', NULL, false),
    ('fourth-regiment', 4, 2, 'dash', 'Celery Bitters', NULL, false),
    ('fourth-regiment', 5, 2, 'drop', 'Saline Solution', NULL, false),
    ('fourth-regiment', 6, 1, 'peel', 'Lemon Twist', 'to garnish', false),
    ('cafe-brulot', 0, NULL, NULL, 'Cognac', 'or brandy', false),
    ('cafe-brulot', 1, NULL, 'peel', 'Orange Peel', 'one long spiral', false),
    ('cafe-brulot', 2, NULL, 'peel', 'Lemon Peel', 'strips', false),
    ('cafe-brulot', 3, NULL, NULL, 'Sugar', NULL, false),
    ('cafe-brulot', 4, NULL, NULL, 'Clove', NULL, false),
    ('cafe-brulot', 5, NULL, NULL, 'Cinnamon', NULL, false),
    ('cafe-brulot', 6, NULL, NULL, 'Coffee', 'hot, strong, black', false),
    ('pisco-punch', 0, 2, 'each', 'Clove', 'dried', false),
    ('pisco-punch', 1, 1.67, 'oz', 'Pisco', NULL, false),
    ('pisco-punch', 2, 1, 'oz', 'Pineapple Juice', 'chilled', false),
    ('pisco-punch', 3, 0.5, 'oz', 'Orange Juice', 'fresh', false),
    ('pisco-punch', 4, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('pisco-punch', 5, 0.5, 'oz', 'Gomme Syrup', NULL, false),
    ('pisco-punch', 6, 0.67, 'oz', 'Champagne', 'or other brut sparkling wine', false),
    ('whisky-highball', 0, 1.5, 'oz', 'Blended Scotch', NULL, false),
    ('whisky-highball', 1, 3, 'oz', 'Soda Water', NULL, false),
    ('gin-rickey', 0, 1.5, 'oz', 'London Dry Gin', NULL, false),
    ('gin-rickey', 1, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('gin-rickey', 2, 0.33, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('gin-rickey', 3, 0.5, 'oz', 'Soda Water', NULL, false),
    ('harvard', 0, 2, 'oz', 'Cognac', NULL, false),
    ('harvard', 1, 1, 'oz', 'Sweet Vermouth', NULL, false),
    ('harvard', 2, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('harvard', 3, 1, 'oz', 'Soda Water', NULL, false),
    ('harvard', 4, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('horses-neck', 0, 2, 'oz', 'Bourbon', NULL, false),
    ('horses-neck', 1, 3, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('horses-neck', 2, NULL, 'top', 'Ginger Ale', 'or soda', false),
    ('horses-neck', 3, 1, 'peel', 'Lemon Peel', 'garnish, one long spiral', false),
    ('liberal', 0, 45, 'ml', 'Rye Whiskey', NULL, false),
    ('liberal', 1, 30, 'ml', 'Sweet Vermouth', NULL, false),
    ('liberal', 2, 2.5, 'ml', 'Amer Picon', NULL, false),
    ('liberal', 3, 1, 'dash', 'Orange Bitters', NULL, false),
    ('liberal', 4, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('metropole', 0, 40, 'ml', 'Cognac', NULL, false),
    ('metropole', 1, 30, 'ml', 'Dry Vermouth', NULL, false),
    ('metropole', 2, 2.5, 'ml', 'Gomme Syrup', NULL, false),
    ('metropole', 3, 2, 'dash', 'Creole Bitters', 'Peychaud''s', false),
    ('metropole', 4, 1, 'dash', 'Orange Bitters', NULL, false),
    ('metropole', 5, 1, 'each', 'Maraschino Cherry', 'garnish', false),
    ('gibson', 0, 2, 'oz', 'Gin', NULL, false),
    ('gibson', 1, 1, 'oz', 'Dry Vermouth', NULL, false),
    ('gibson', 2, 1, 'each', 'Pickled Onion', 'garnish, cocktail onion', false),
    ('marguerite', 0, 45, 'ml', 'Gin', NULL, false),
    ('marguerite', 1, 45, 'ml', 'Dry Vermouth', NULL, false),
    ('marguerite', 2, 1.25, 'ml', 'Curaçao', 'orange', false),
    ('marguerite', 3, 2, 'dash', 'Orange Bitters', NULL, false),
    ('marguerite', 4, 1, 'peel', 'Orange Twist', 'garnish, or lemon', false),
    ('mamie-taylor', 0, 2, 'oz', 'Scotch', NULL, false),
    ('mamie-taylor', 1, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('mamie-taylor', 2, 4, 'oz', 'Ginger Beer', NULL, false),
    ('bronx', 0, 30, 'ml', 'Gin', NULL, false),
    ('bronx', 1, 15, 'ml', 'Sweet Vermouth', NULL, false),
    ('bronx', 2, 10, 'ml', 'Dry Vermouth', NULL, false),
    ('bronx', 3, 15, 'ml', 'Orange Juice', NULL, false),
    ('bronx', 4, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('cuba-libre', 0, 2, 'oz', 'Rum', 'white or golden', false),
    ('cuba-libre', 1, 1, 'each', 'Lime', 'halved and squeezed', false),
    ('cuba-libre', 2, NULL, 'top', 'Cola', NULL, false),
    ('cuba-libre', 3, 1, 'slice', 'Lime', 'garnish', false),
    ('diamond-fizz', 0, 60, 'ml', 'Gin', NULL, false),
    ('diamond-fizz', 1, 30, 'ml', 'Lemon Juice', NULL, false),
    ('diamond-fizz', 2, 15, 'ml', 'Rich Simple Syrup', NULL, false),
    ('diamond-fizz', 3, NULL, 'top', 'Champagne', 'brut', false),
    ('green-swizzle', 0, 1.5, 'oz', 'Rum', NULL, false),
    ('green-swizzle', 1, 1, 'oz', 'Falernum', NULL, false),
    ('green-swizzle', 2, 1, 'bsp', 'Wormwood Bitters', NULL, false),
    ('ponche-crema', 0, NULL, NULL, 'Milk', NULL, false),
    ('ponche-crema', 1, NULL, NULL, 'Egg', NULL, false),
    ('ponche-crema', 2, NULL, NULL, 'Sugar', NULL, false),
    ('ponche-crema', 3, NULL, NULL, 'Rum', NULL, false),
    ('ponche-crema', 4, NULL, NULL, 'Vanilla', NULL, false),
    ('ponche-crema', 5, NULL, NULL, 'Nutmeg', NULL, false),
    ('ponche-crema', 6, NULL, NULL, 'Cinnamon', NULL, false),
    ('ponche-crema', 7, NULL, NULL, 'Lemon Peel', 'rind', false),
    ('puritan', 0, 2, 'oz', 'London Dry Gin', NULL, false),
    ('puritan', 1, 0.5, 'oz', 'Dry Vermouth', NULL, false),
    ('puritan', 2, 0.25, 'oz', 'Yellow Chartreuse', NULL, false),
    ('puritan', 3, 2, 'dash', 'Orange Bitters', NULL, false),
    ('puritan', 4, 1, 'peel', 'Lemon Twist', 'garnish', false),
    ('sloe-gin-fizz', 0, 0.75, 'oz', 'Sloe Gin', NULL, false),
    ('sloe-gin-fizz', 1, 0.75, 'oz', 'Gin', NULL, false),
    ('sloe-gin-fizz', 2, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('sloe-gin-fizz', 3, 0.5, 'oz', 'Simple Syrup', NULL, false),
    ('sloe-gin-fizz', 4, 1, 'each', 'Egg White', NULL, true),
    ('sloe-gin-fizz', 5, NULL, 'top', 'Soda Water', NULL, false),
    ('turf', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('turf', 1, 1.5, 'oz', 'Dry Vermouth', NULL, false),
    ('turf', 2, 1, 'bsp', 'Maraschino Liqueur', NULL, false),
    ('turf', 3, 3, 'dash', 'Orange Bitters', NULL, false),
    ('turf', 4, NULL, NULL, 'Absinthe', 'to rinse the glass', false),
    ('turf', 5, 1, 'peel', 'Lemon Peel', 'garnish', false),
    ('dirty-martini', 0, 60, 'ml', 'Gin', NULL, false),
    ('dirty-martini', 1, 22.5, 'ml', 'Dry Vermouth', NULL, false),
    ('dirty-martini', 2, 15, 'ml', 'Olive Brine', NULL, false),
    ('dirty-martini', 3, 8, 'drop', 'Ginseng Bitters', NULL, true),
    ('dirty-martini', 4, 1, 'each', 'Olive', 'garnish, skewered green olives', false),
    ('perfect-martini', 0, 45, 'ml', 'Gin', NULL, false),
    ('perfect-martini', 1, 22.5, 'ml', 'Dry Vermouth', NULL, false),
    ('perfect-martini', 2, 22.5, 'ml', 'Sweet Vermouth', NULL, false),
    ('perfect-martini', 3, 1, 'dash', 'Orange Bitters', NULL, false),
    ('perfect-martini', 4, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('coronation', 0, 1.5, 'oz', 'Dry Vermouth', NULL, false),
    ('coronation', 1, 0.75, 'oz', 'Fino Sherry', NULL, false),
    ('coronation', 2, 1, 'bsp', 'Maraschino Liqueur', NULL, false),
    ('coronation', 3, 2, 'dash', 'Orange Bitters', NULL, false),
    ('gin-buck', 0, 60, 'ml', 'Gin', NULL, false),
    ('gin-buck', 1, 10, 'ml', 'Lime Juice', NULL, false),
    ('gin-buck', 2, 120, 'ml', 'Ginger Ale', NULL, false),
    ('kir', 0, 10, 'ml', 'Crème de Cassis', NULL, false),
    ('kir', 1, 90, 'ml', 'White Wine', 'dry, such as Bourgogne Aligoté', false),
    ('ward-8', 0, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('ward-8', 1, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('ward-8', 2, 0.5, 'oz', 'Orange Juice', 'fresh', false),
    ('ward-8', 3, 1, 'tsp', 'Grenadine', NULL, false),
    ('ward-8', 4, 1, 'each', 'Maraschino Cherry', 'garnish', true),
    ('affinity', 0, 30, 'ml', 'Scotch', NULL, false),
    ('affinity', 1, 30, 'ml', 'Sweet Vermouth', 'vermouth amaro, such as Cocchi', false),
    ('affinity', 2, 30, 'ml', 'Dry Vermouth', NULL, false),
    ('affinity', 3, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('affinity', 4, 1, 'peel', 'Lemon Twist', 'garnish', false),
    ('casino', 0, 1.5, 'oz', 'Old Tom Gin', NULL, false),
    ('casino', 1, 0.5, 'oz', 'Maraschino Liqueur', NULL, false),
    ('casino', 2, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('casino', 3, 2, 'dash', 'Orange Bitters', NULL, false),
    ('casino', 4, 1, 'each', 'Maraschino Cherry', 'garnish', false),
    ('pimms-cup', 0, 2, 'oz', 'Pimm''s No. 1', NULL, false),
    ('pimms-cup', 1, 0.5, 'oz', 'Lemon Juice', NULL, false),
    ('pimms-cup', 2, 0.25, 'oz', 'Simple Syrup', NULL, false),
    ('pimms-cup', 3, 2, 'dash', 'Aromatic Bitters', 'Angostura', true),
    ('pimms-cup', 4, NULL, 'top', 'Ginger Ale', NULL, false),
    ('pimms-cup', 5, 1, 'slice', 'Cucumber', 'garnish', false),
    ('pimms-cup', 6, 1, 'sprig', 'Mint Sprig', 'garnish', false),
    ('pimms-cup', 7, NULL, NULL, 'Strawberry', 'garnish, seasonal berries and citrus', true),
    ('pink-lady', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('pink-lady', 1, 0.5, 'oz', 'Applejack', 'bonded', false),
    ('pink-lady', 2, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('pink-lady', 3, 0.25, 'oz', 'Grenadine', NULL, false),
    ('pink-lady', 4, 1, 'each', 'Egg White', NULL, false),
    ('pink-lady', 5, 1, 'each', 'Cherry', 'garnish, brandied', false),
    ('southside', 0, 2, 'oz', 'Gin', NULL, false),
    ('southside', 1, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('southside', 2, 0.75, 'oz', 'Simple Syrup', NULL, false),
    ('southside', 3, 6, 'leaf', 'Mint', '6 to 8 leaves', false),
    ('southside', 4, 1, 'dash', 'Orange Bitters', NULL, false),
    ('southside', 5, 1, 'sprig', 'Mint Sprig', 'garnish', false),
    ('bacardi-cocktail', 0, 60, 'ml', 'White Rum', 'Bacardi', false),
    ('bacardi-cocktail', 1, 15, 'ml', 'Lime Juice', NULL, false),
    ('bacardi-cocktail', 2, 7.5, 'ml', 'Grenadine', NULL, false),
    ('bacardi-cocktail', 3, 5, 'ml', 'Rich Simple Syrup', NULL, false),
    ('bacardi-cocktail', 4, 1, 'each', 'Maraschino Cherry', 'garnish', false),
    ('emerald', 0, 2, 'oz', 'Irish Whiskey', NULL, false),
    ('emerald', 1, 1, 'oz', 'Sweet Vermouth', NULL, false),
    ('emerald', 2, 1, 'dash', 'Orange Bitters', NULL, false),
    ('emerald', 3, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('campari-soda', 0, 2, 'oz', 'Campari', 'chilled', false),
    ('campari-soda', 1, 0.5, 'tsp', 'Lemon Juice', 'chilled', false),
    ('campari-soda', 2, 6.5, 'oz', 'Soda Water', 'scant, very effervescent, chilled', false),
    ('el-presidente', 0, 1.5, 'oz', 'Rum', 'gold', false),
    ('el-presidente', 1, 0.75, 'oz', 'Dry Vermouth', NULL, false),
    ('el-presidente', 2, 0.25, 'oz', 'Curaçao', 'orange', false),
    ('el-presidente', 3, 0.5, 'tsp', 'Grenadine', NULL, false),
    ('el-presidente', 4, 1, 'peel', 'Orange Peel', 'garnish, or lemon', false),
    ('singapore-sling', 0, 30, 'ml', 'Gin', NULL, false),
    ('singapore-sling', 1, 15, 'ml', 'Cherry Liqueur', NULL, false),
    ('singapore-sling', 2, 7.5, 'ml', 'Triple Sec', 'Cointreau', false),
    ('singapore-sling', 3, 7.5, 'ml', 'Bénédictine', NULL, false),
    ('singapore-sling', 4, 120, 'ml', 'Pineapple Juice', 'fresh', false),
    ('singapore-sling', 5, 15, 'ml', 'Lime Juice', 'fresh', false),
    ('singapore-sling', 6, 10, 'ml', 'Grenadine', NULL, false),
    ('singapore-sling', 7, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('singapore-sling', 8, 1, 'each', 'Pineapple', 'garnish, wedge', false),
    ('singapore-sling', 9, 1, 'each', 'Maraschino Cherry', 'garnish', false),
    ('alexander', 0, 45, 'ml', 'Gin', NULL, false),
    ('alexander', 1, 22.5, 'ml', 'White Crème de Cacao', NULL, false),
    ('alexander', 2, 22.5, 'ml', 'Cream', NULL, false),
    ('alexander', 3, 10, 'ml', 'Egg White', NULL, true),
    ('alexander', 4, 1, 'pinch', 'Nutmeg', 'garnish, freshly grated', false),
    ('chrysanthemum', 0, 50, 'ml', 'Dry Vermouth', NULL, false),
    ('chrysanthemum', 1, 15, 'ml', 'Bénédictine', NULL, false),
    ('chrysanthemum', 2, 4, 'dash', 'Absinthe', NULL, false),
    ('chrysanthemum', 3, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('creole', 0, 37.5, 'ml', 'Rye Whiskey', NULL, false),
    ('creole', 1, 37.5, 'ml', 'Sweet Vermouth', NULL, false),
    ('creole', 2, 10, 'ml', 'Amer Picon', NULL, false),
    ('creole', 3, 7.5, 'ml', 'Bénédictine', NULL, false),
    ('creole', 4, 1, 'peel', 'Lemon Twist', 'garnish', false),
    ('tipperary', 0, 30, 'ml', 'Irish Whiskey', NULL, false),
    ('tipperary', 1, 25, 'ml', 'Sweet Vermouth', NULL, false),
    ('tipperary', 2, 10, 'ml', 'Green Chartreuse', NULL, false),
    ('tipperary', 3, 1, 'each', 'Maraschino Cherry', 'garnish', false),
    ('grasshopper', 0, 30, 'ml', 'Crème de Menthe', 'green', false),
    ('grasshopper', 1, 30, 'ml', 'White Crème de Cacao', NULL, false),
    ('grasshopper', 2, 30, 'ml', 'Cream', NULL, false),
    ('select-spritz', 0, 3, 'oz', 'Prosecco', NULL, false),
    ('select-spritz', 1, 2, 'oz', 'Select', 'aperitivo', false),
    ('select-spritz', 2, NULL, 'top', 'Soda Water', 'a splash', false),
    ('select-spritz', 3, 1, 'each', 'Olive', 'garnish, green', false),
    ('tinto-de-verano', 0, 3, 'oz', 'Red Wine', 'full-bodied and dry', false),
    ('tinto-de-verano', 1, 1, 'oz', 'Lemon Cordial', 'lemon syrup: equal parts lemon juice and sugar', false),
    ('tinto-de-verano', 2, NULL, 'top', 'Soda Water', NULL, false),
    ('tinto-de-verano', 3, 1, 'slice', 'Lemon', 'garnish, or orange or seasonal fruit', false),
    ('bucks-fizz', 0, 50, 'ml', 'Orange Juice', NULL, false),
    ('bucks-fizz', 1, 100, 'ml', 'Champagne', NULL, false),
    ('bucks-fizz', 2, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('camerons-kick', 0, 30, 'ml', 'Scotch', NULL, false),
    ('camerons-kick', 1, 30, 'ml', 'Irish Whiskey', NULL, false),
    ('camerons-kick', 2, 10, 'ml', 'Orgeat', NULL, false),
    ('camerons-kick', 3, 15, 'ml', 'Lemon Juice', NULL, false),
    ('camerons-kick', 4, 15, 'ml', 'Egg White', NULL, true),
    ('camerons-kick', 5, 3, 'drop', 'Saline Solution', NULL, false),
    ('camerons-kick', 6, 1, 'peel', 'Lemon Twist', 'garnish', false),
    ('toronto', 0, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('toronto', 1, 0.25, 'oz', 'Fernet', 'Fernet-Branca', false),
    ('toronto', 2, 0.25, 'oz', 'Demerara Syrup', NULL, false),
    ('toronto', 3, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('toronto', 4, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('monkey-gland', 0, 45, 'ml', 'Gin', NULL, false),
    ('monkey-gland', 1, 45, 'ml', 'Orange Juice', NULL, false),
    ('monkey-gland', 2, 1, 'tbsp', 'Absinthe', NULL, false),
    ('monkey-gland', 3, 1, 'tbsp', 'Grenadine', NULL, false),
    ('scofflaw', 0, 45, 'ml', 'Rye Whiskey', NULL, false),
    ('scofflaw', 1, 30, 'ml', 'Dry Vermouth', NULL, false),
    ('scofflaw', 2, 20, 'ml', 'Lemon Juice', NULL, false),
    ('scofflaw', 3, 20, 'ml', 'Grenadine', NULL, false),
    ('scofflaw', 4, 1, 'dash', 'Orange Bitters', NULL, false),
    ('scofflaw', 5, 1, 'peel', 'Lemon Twist', 'garnish', false),
    ('champs-elysees', 0, 45, 'ml', 'Cognac', NULL, false),
    ('champs-elysees', 1, 10, 'ml', 'Green Chartreuse', NULL, false),
    ('champs-elysees', 2, 20, 'ml', 'Lemon Juice', NULL, false),
    ('champs-elysees', 3, 15, 'ml', 'Rich Simple Syrup', NULL, false),
    ('champs-elysees', 4, 7.5, 'ml', 'Water', 'chilled', false),
    ('champs-elysees', 5, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('champs-elysees', 6, 2, 'drop', 'Saline Solution', NULL, false),
    ('champs-elysees', 7, 1, 'peel', 'Lemon Twist', 'garnish', false),
    ('mimosa', 0, 75, 'ml', 'Champagne', NULL, false),
    ('mimosa', 1, 75, 'ml', 'Orange Juice', NULL, false),
    ('mimosa', 2, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('barbary-coast', 0, 30, 'ml', 'Scotch', NULL, false),
    ('barbary-coast', 1, 15, 'ml', 'Gin', NULL, false),
    ('barbary-coast', 2, 22.5, 'ml', 'White Crème de Cacao', NULL, false),
    ('barbary-coast', 3, 22.5, 'ml', 'Cream', NULL, false),
    ('barbary-coast', 4, 1, 'pinch', 'Nutmeg', 'garnish, freshly grated', false),
    ('old-pal', 0, 1, 'oz', 'Rye Whiskey', NULL, false),
    ('old-pal', 1, 1, 'oz', 'Campari', NULL, false),
    ('old-pal', 2, 1, 'oz', 'Dry Vermouth', NULL, false),
    ('old-pal', 3, 1, 'peel', 'Lemon Peel', 'garnish, or orange', false),
    ('lucien-gaudin', 0, 1.5, 'oz', 'London Dry Gin', NULL, false),
    ('lucien-gaudin', 1, 0.5, 'oz', 'Campari', NULL, false),
    ('lucien-gaudin', 2, 0.5, 'oz', 'Dry Vermouth', NULL, false),
    ('lucien-gaudin', 3, 0.5, 'oz', 'Triple Sec', 'Cointreau', false),
    ('lucien-gaudin', 4, 1, 'peel', 'Orange Peel', 'garnish', false),
    ('army-and-navy', 0, 2, 'oz', 'Gin', NULL, false),
    ('army-and-navy', 1, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('army-and-navy', 2, 0.75, 'oz', 'Orgeat', NULL, false),
    ('army-and-navy', 3, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('between-the-sheets', 0, 1, 'oz', 'Cognac', NULL, false),
    ('between-the-sheets', 1, 1, 'oz', 'White Rum', NULL, false),
    ('between-the-sheets', 2, 1, 'oz', 'Triple Sec', NULL, false),
    ('between-the-sheets', 3, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('between-the-sheets', 4, 1, 'peel', 'Orange Twist', 'garnish, or lemon', false),
    ('blood-and-sand', 0, 1, 'oz', 'Blended Scotch', NULL, false),
    ('blood-and-sand', 1, 1, 'oz', 'Cherry Liqueur', 'preferably Cherry Heering', false),
    ('blood-and-sand', 2, 1, 'oz', 'Sweet Vermouth', NULL, false),
    ('blood-and-sand', 3, 1, 'oz', 'Orange Juice', 'freshly squeezed', false),
    ('brandy-alexander', 0, 1, 'oz', 'Brandy', 'VSOP', false),
    ('brandy-alexander', 1, 1, 'oz', 'Crème de Cacao', NULL, false),
    ('brandy-alexander', 2, 1, 'oz', 'Cream', NULL, false),
    ('brandy-alexander', 3, 1, 'pinch', 'Nutmeg', 'garnish, freshly grated', false),
    ('corpse-reviver-1', 0, 45, 'ml', 'Cognac', NULL, false),
    ('corpse-reviver-1', 1, 22.5, 'ml', 'Calvados', NULL, false),
    ('corpse-reviver-1', 2, 22.5, 'ml', 'Sweet Vermouth', NULL, false),
    ('corpse-reviver-1', 3, 1, 'dash', 'Orange Bitters', NULL, false),
    ('corpse-reviver-1', 4, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('fifty-fifty', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('fifty-fifty', 1, 1.5, 'oz', 'Dry Vermouth', NULL, false),
    ('fifty-fifty', 2, 1, 'dash', 'Orange Bitters', NULL, false),
    ('hotel-nacional', 0, 2, 'oz', 'White Rum', NULL, false),
    ('hotel-nacional', 1, 0.5, 'oz', 'Apricot Liqueur', NULL, false),
    ('hotel-nacional', 2, 1, 'oz', 'Pineapple Juice', NULL, false),
    ('hotel-nacional', 3, 0.5, 'oz', 'Lime Juice', NULL, false),
    ('hotel-nacional', 4, 0.25, 'oz', 'Cane Syrup', NULL, false),
    ('hotel-nacional', 5, 1, 'dash', 'Aromatic Bitters', 'Angostura, on top', false),
    ('maidens-prayer', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('maidens-prayer', 1, 1, 'oz', 'Triple Sec', 'Cointreau', false),
    ('maidens-prayer', 2, 0.5, 'oz', 'Lemon Juice', NULL, false),
    ('maidens-prayer', 3, 0.5, 'oz', 'Orange Juice', NULL, false),
    ('palmetto', 0, 45, 'ml', 'Aged Rum', NULL, false),
    ('palmetto', 1, 45, 'ml', 'Sweet Vermouth', NULL, false),
    ('palmetto', 2, 2, 'dash', 'Orange Bitters', NULL, false),
    ('palmetto', 3, 1, 'peel', 'Orange Twist', 'garnish', false),
    ('rattlesnake', 0, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('rattlesnake', 1, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('rattlesnake', 2, 0.75, 'oz', 'Simple Syrup', NULL, false),
    ('rattlesnake', 3, 2, 'dash', 'Absinthe', NULL, false),
    ('rattlesnake', 4, 1, 'each', 'Egg White', NULL, false),
    ('rattlesnake', 5, NULL, NULL, 'Aromatic Bitters', 'garnish, Angostura swirl', false),
    ('corn-n-oil', 0, 2, 'oz', 'Aged Rum', 'Barbados, or blackstrap rum', false),
    ('corn-n-oil', 1, 0.5, 'oz', 'Falernum', 'Velvet Falernum', false),
    ('corn-n-oil', 2, 0.5, 'oz', 'Lime Juice', NULL, false),
    ('corn-n-oil', 3, 3, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('corn-n-oil', 4, 1, 'each', 'Lime Wedge', 'garnish', false),
    ('rum-collins', 0, 60, 'ml', 'Aged Rum', NULL, false),
    ('rum-collins', 1, 22.5, 'ml', 'Lemon Juice', NULL, false),
    ('rum-collins', 2, 15, 'ml', 'Rich Simple Syrup', NULL, false),
    ('rum-collins', 3, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('rum-collins', 4, 60, 'ml', 'Soda Water', NULL, false),
    ('rum-collins', 5, 1, 'slice', 'Lemon', 'garnish', false),
    ('rum-collins', 6, 1, 'each', 'Maraschino Cherry', 'garnish', false),
    ('rum-swizzle', 0, 30, 'ml', 'Rum', 'light gold', false),
    ('rum-swizzle', 1, 30, 'ml', 'Dark Rum', NULL, false),
    ('rum-swizzle', 2, 22.5, 'ml', 'Falernum', NULL, false),
    ('rum-swizzle', 3, 30, 'ml', 'Pineapple Juice', NULL, false),
    ('rum-swizzle', 4, 30, 'ml', 'Orange Juice', NULL, false),
    ('rum-swizzle', 5, 15, 'ml', 'Grapefruit Juice', 'pink', false),
    ('rum-swizzle', 6, 15, 'ml', 'Lime Juice', NULL, false),
    ('rum-swizzle', 7, 7.5, 'ml', 'Lemon Juice', NULL, false),
    ('rum-swizzle', 8, 2, 'dash', 'Aromatic Bitters', NULL, false),
    ('rum-swizzle', 9, 1, 'each', 'Pineapple', 'garnish, wedge', false),
    ('rum-swizzle', 10, 1, 'each', 'Maraschino Cherry', 'garnish', false),
    ('brown-derby', 0, 1.5, 'oz', 'Bourbon', NULL, false),
    ('brown-derby', 1, 0.75, 'oz', 'Grapefruit Juice', NULL, false),
    ('brown-derby', 2, 0.75, 'oz', 'Rich Honey Syrup', '2:1 honey to water', false),
    ('brown-derby', 3, 1, 'peel', 'Grapefruit Twist', 'garnish', false),
    ('presbyterian', 0, 45, 'ml', 'Scotch', NULL, false),
    ('presbyterian', 1, 45, 'ml', 'Soda Water', NULL, false),
    ('presbyterian', 2, NULL, 'top', 'Ginger Ale', NULL, false),
    ('presbyterian', 3, 1, 'slice', 'Lemon', 'garnish', false),
    ('blinker', 0, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('blinker', 1, 0.5, 'oz', 'Grapefruit Juice', 'fresh', false),
    ('blinker', 2, 1, 'bsp', 'Raspberry Syrup', NULL, false),
    ('blinker', 3, 1, 'peel', 'Grapefruit Twist', 'garnish', false),
    ('daiquiri-no-3', 0, 2, 'oz', 'White Rum', NULL, false),
    ('daiquiri-no-3', 1, 0.5, 'oz', 'Rich Simple Syrup', NULL, false),
    ('daiquiri-no-3', 2, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('daiquiri-no-3', 3, 1, 'tsp', 'Grapefruit Juice', NULL, false),
    ('daiquiri-no-3', 4, 1, 'tsp', 'Maraschino Liqueur', NULL, false),
    ('floridita-daiquiri', 0, 2, 'oz', 'White Rum', NULL, false),
    ('floridita-daiquiri', 1, 1, 'oz', 'Lime Juice', 'fresh', false),
    ('floridita-daiquiri', 2, 0.5, 'oz', 'Maraschino Liqueur', NULL, false),
    ('floridita-daiquiri', 3, 2, 'tbsp', 'Sugar', NULL, false),
    ('zombie', 0, 22.5, 'ml', 'Lime Juice', 'fresh', false),
    ('zombie', 1, 15, 'ml', 'Falernum', NULL, false),
    ('zombie', 2, 45, 'ml', 'Aged Rum', 'gold Puerto Rican', false),
    ('zombie', 3, 45, 'ml', 'Jamaican Rum', 'gold', false),
    ('zombie', 4, 30, 'ml', 'Overproof Rum', '151-proof demerara', false),
    ('zombie', 5, 1, 'tsp', 'Grenadine', NULL, false),
    ('zombie', 6, 6, 'drop', 'Absinthe', NULL, false),
    ('zombie', 7, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('zombie', 8, 15, 'ml', 'Don''s Mix', NULL, false),
    ('zombie', 9, 1, 'sprig', 'Mint', 'garnish', false),
    ('death-in-the-afternoon', 0, 1.5, 'oz', 'Absinthe', NULL, false),
    ('death-in-the-afternoon', 1, NULL, 'top', 'Champagne', 'chilled', false),
    ('muddled-old-fashioned', 0, 2, 'each', 'Maraschino Cherry', NULL, false),
    ('muddled-old-fashioned', 1, 0.5, 'slice', 'Orange', NULL, false),
    ('muddled-old-fashioned', 2, 0.5, 'slice', 'Lemon', NULL, false),
    ('muddled-old-fashioned', 3, 2.5, 'oz', 'Bourbon', NULL, false),
    ('muddled-old-fashioned', 4, 0.25, 'oz', 'Maraschino Syrup', NULL, false),
    ('muddled-old-fashioned', 5, 0.25, 'oz', 'Rich Simple Syrup', NULL, false),
    ('muddled-old-fashioned', 6, 2, 'dash', 'Aromatic Bitters', NULL, false),
    ('queens-park-swizzle', 0, 2, 'oz', 'Demerara Rum', NULL, false),
    ('queens-park-swizzle', 1, 1, 'oz', 'Simple Syrup', NULL, false),
    ('queens-park-swizzle', 2, 1, 'oz', 'Lime Juice', 'fresh', false),
    ('queens-park-swizzle', 3, 1, 'sprig', 'Mint', 'large', false),
    ('queens-park-swizzle', 4, 4, 'dash', 'Aromatic Bitters', 'on top', false),
    ('vodka-martini', 0, 2, 'oz', 'Vodka', NULL, false),
    ('vodka-martini', 1, 0.5, 'oz', 'Dry Vermouth', NULL, false),
    ('vodka-martini', 2, 1, 'dash', 'Orange Bitters', NULL, false),
    ('vodka-martini', 3, 1, 'each', 'Lemon Twist', 'garnish', false),
    ('gin-and-it', 0, 1.75, 'oz', 'Gin', NULL, false),
    ('gin-and-it', 1, 0.75, 'oz', 'Sweet Vermouth', NULL, false),
    ('gin-and-it', 2, 1, 'dash', 'Orange Bitters', NULL, false),
    ('gin-and-it', 3, 1, 'each', 'Lemon Twist', 'garnish', false),
    ('tequila-daisy', 0, 1.5, 'oz', 'Blanco Tequila', NULL, false),
    ('tequila-daisy', 1, 0.5, 'oz', 'Curaçao', 'orange', false),
    ('tequila-daisy', 2, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('tequila-daisy', 3, 0.25, 'oz', 'Grenadine', NULL, false),
    ('tequila-daisy', 4, 3, 'drop', 'Saline Solution', NULL, false),
    ('tequila-daisy', 5, 0.5, 'oz', 'Soda Water', NULL, false),
    ('b-and-b', 0, 1.33, 'oz', 'Cognac', NULL, false),
    ('b-and-b', 1, 0.83, 'oz', 'Bénédictine', NULL, false),
    ('b-and-b', 2, 1, 'each', 'Lemon Twist', 'garnish', false),
    ('chancellor', 0, 1.5, 'oz', 'Blended Scotch', NULL, false),
    ('chancellor', 1, 1, 'oz', 'Tawny Port', NULL, false),
    ('chancellor', 2, 0.25, 'oz', 'Dry Vermouth', NULL, false),
    ('chancellor', 3, 0.25, 'oz', 'Bianco Vermouth', NULL, false),
    ('chancellor', 4, 1, 'dash', 'Creole Bitters', NULL, false),
    ('chancellor', 5, 1, 'each', 'Orange Twist', 'garnish', false),
    ('cobras-fang', 0, 1.5, 'oz', 'Overproof Rum', '151-proof demerara', false),
    ('cobras-fang', 1, 1, 'tsp', 'Falernum', NULL, false),
    ('cobras-fang', 2, 0.5, 'oz', 'Passion Fruit Syrup', NULL, false),
    ('cobras-fang', 3, 0.5, 'oz', 'Orange Juice', NULL, false),
    ('cobras-fang', 4, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('cobras-fang', 5, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('cobras-fang', 6, 2, 'dash', 'Absinthe', NULL, false),
    ('cobras-fang', 7, 1, 'pinch', 'Cinnamon', 'garnish', false),
    ('de-la-louisiane', 0, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('de-la-louisiane', 1, 0.75, 'oz', 'Bénédictine', NULL, false),
    ('de-la-louisiane', 2, 0.75, 'oz', 'Sweet Vermouth', NULL, false),
    ('de-la-louisiane', 3, 3, 'dash', 'Absinthe', NULL, false),
    ('de-la-louisiane', 4, 3, 'dash', 'Creole Bitters', NULL, false),
    ('de-la-louisiane', 5, 3, 'each', 'Maraschino Cherry', 'brandied, garnish', false),
    ('lions-tail', 0, 2, 'oz', 'Bourbon', NULL, false),
    ('lions-tail', 1, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('lions-tail', 2, 0.5, 'oz', 'Allspice Dram', NULL, false),
    ('lions-tail', 3, 1, 'tsp', 'Simple Syrup', NULL, false),
    ('lions-tail', 4, 2, 'dash', 'Aromatic Bitters', NULL, false),
    ('missionarys-downfall', 0, 1, 'oz', 'White Rum', NULL, false),
    ('missionarys-downfall', 1, 0.5, 'oz', 'Peach Liqueur', NULL, false),
    ('missionarys-downfall', 2, 1, 'oz', 'Honey Syrup', '1:1', false),
    ('missionarys-downfall', 3, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('missionarys-downfall', 4, 3, 'each', 'Pineapple', 'chunks', false),
    ('missionarys-downfall', 5, 12, 'leaf', 'Mint', NULL, false),
    ('missionarys-downfall', 6, 1, 'sprig', 'Mint Sprig', 'garnish', false),
    ('mizuwari', 0, 2, 'oz', 'Whiskey', NULL, false),
    ('mizuwari', 1, 5, 'oz', 'Water', 'cold', false),
    ('nui-nui', 0, 2, 'oz', 'Aged Rum', NULL, false),
    ('nui-nui', 1, 1, 'oz', 'Orange Juice', 'fresh', false),
    ('nui-nui', 2, 0.75, 'oz', 'Cinnamon Syrup', NULL, false),
    ('nui-nui', 3, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('nui-nui', 4, 0.25, 'oz', 'Vanilla Syrup', NULL, false),
    ('nui-nui', 5, 0.25, 'oz', 'Allspice Dram', NULL, false),
    ('nui-nui', 6, 2, 'dash', 'Aromatic Bitters', 'on top', false),
    ('pearl-diver', 0, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('pearl-diver', 1, 0.5, 'oz', 'Orange Juice', NULL, false),
    ('pearl-diver', 2, 0.5, 'oz', 'Gardenia Mix', NULL, false),
    ('pearl-diver', 3, 0.5, 'oz', 'Demerara Rum', NULL, false),
    ('pearl-diver', 4, 1.5, 'oz', 'Aged Rum', 'gold Cuban or Puerto Rican', false),
    ('pearl-diver', 5, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('picador', 0, 1.5, 'oz', 'Reposado Tequila', NULL, false),
    ('picador', 1, 0.75, 'oz', 'Triple Sec', NULL, false),
    ('picador', 2, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('qb-cooler', 0, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('qb-cooler', 1, 1, 'oz', 'Orange Juice', NULL, false),
    ('qb-cooler', 2, 1, 'oz', 'Soda Water', NULL, false),
    ('qb-cooler', 3, 0.5, 'oz', 'Honey Syrup', NULL, false),
    ('qb-cooler', 4, 0.25, 'oz', 'Falernum', NULL, false),
    ('qb-cooler', 5, 0.5, 'tsp', 'Ginger Syrup', NULL, false),
    ('qb-cooler', 6, 0.5, 'oz', 'Demerara Rum', NULL, false),
    ('qb-cooler', 7, 1, 'oz', 'Jamaican Rum', NULL, false),
    ('qb-cooler', 8, 1, 'oz', 'Rum', 'Puerto Rican', false),
    ('qb-cooler', 9, 2, 'dash', 'Aromatic Bitters', NULL, false),
    ('qb-cooler', 10, 1, 'sprig', 'Mint', 'garnish', false),
    ('rusty-nail', 0, 1.5, 'oz', 'Blended Scotch', NULL, false),
    ('rusty-nail', 1, 0.75, 'oz', 'Drambuie', NULL, false),
    ('rusty-nail', 2, 1, 'each', 'Lemon Twist', 'garnish', true),
    ('scorpion', 0, 2, 'oz', 'White Rum', NULL, false),
    ('scorpion', 1, 1, 'oz', 'Brandy', NULL, false),
    ('scorpion', 2, 0.5, 'oz', 'Overproof Rum', NULL, true),
    ('scorpion', 3, 2, 'oz', 'Orange Juice', NULL, false),
    ('scorpion', 4, 0.5, 'oz', 'Orgeat', NULL, false),
    ('scorpion', 5, 1.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('scorpion', 6, 1, 'each', 'Orange Wedge', 'garnish', false),
    ('toreador', 0, 1.5, 'oz', 'Blanco Tequila', NULL, false),
    ('toreador', 1, 0.75, 'oz', 'Apricot Liqueur', NULL, false),
    ('toreador', 2, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('toreador', 3, 1, 'tsp', 'Rich Simple Syrup', NULL, false),
    ('toreador', 4, 2, 'drop', 'Saline Solution', NULL, false),
    ('twentieth-century', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('twentieth-century', 1, 0.5, 'oz', 'Crème de Cacao', NULL, false),
    ('twentieth-century', 2, 0.75, 'oz', 'Quinquina', 'Lillet', false),
    ('twentieth-century', 3, 0.75, 'oz', 'Lemon Juice', 'fresh', false),
    ('daisy-de-santiago', 0, 2, 'oz', 'White Rum', NULL, false),
    ('daisy-de-santiago', 1, 1, 'oz', 'Lime Juice', 'fresh', false),
    ('daisy-de-santiago', 2, 0.5, 'oz', 'Simple Syrup', NULL, false),
    ('daisy-de-santiago', 3, 0.5, 'oz', 'Yellow Chartreuse', NULL, false),
    ('daisy-de-santiago', 4, NULL, 'top', 'Soda Water', NULL, false),
    ('daisy-de-santiago', 5, 1, 'sprig', 'Mint Sprig', 'garnish', false),
    ('fog-cutter', 0, 60, 'ml', 'Lemon Juice', 'fresh', false),
    ('fog-cutter', 1, 60, 'ml', 'White Rum', 'light Puerto Rican', false),
    ('fog-cutter', 2, 30, 'ml', 'Orange Juice', NULL, false),
    ('fog-cutter', 3, 30, 'ml', 'Brandy', NULL, false),
    ('fog-cutter', 4, 15, 'ml', 'Orgeat', NULL, false),
    ('fog-cutter', 5, 15, 'ml', 'Gin', NULL, false),
    ('fog-cutter', 6, NULL, NULL, 'Sherry', 'float', false),
    ('fog-cutter', 7, 1, 'sprig', 'Mint', 'garnish', false),
    ('hurricane', 0, 4, 'oz', 'Jamaican Rum', 'aged', false),
    ('hurricane', 1, 2, 'oz', 'Passion Fruit Syrup', NULL, false),
    ('hurricane', 2, 2, 'oz', 'Lemon Juice', 'fresh', false),
    ('mulata-daiquiri', 0, 2, 'oz', 'Aged Rum', NULL, false),
    ('mulata-daiquiri', 1, 0.25, 'oz', 'Crème de Cacao', 'dark', false),
    ('mulata-daiquiri', 2, 0.25, 'oz', 'White Crème de Cacao', NULL, false),
    ('mulata-daiquiri', 3, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('mulata-daiquiri', 4, 0.25, 'oz', 'Rich Simple Syrup', NULL, false),
    ('mulata-daiquiri', 5, 3, 'drop', 'Saline Solution', NULL, false),
    ('navy-grog', 0, 1, 'oz', 'Demerara Rum', 'gold', false),
    ('navy-grog', 1, 1, 'oz', 'Jamaican Rum', 'dark', false),
    ('navy-grog', 2, 1, 'oz', 'White Rum', 'Cuban or Puerto Rican', false),
    ('navy-grog', 3, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('navy-grog', 4, 0.75, 'oz', 'Grapefruit Juice', 'white', false),
    ('navy-grog', 5, 0.75, 'oz', 'Soda Water', NULL, false),
    ('navy-grog', 6, 1, 'oz', 'Honey Syrup', '1:1', false),
    ('air-mail', 0, 1.5, 'oz', 'Aged Rum', 'light gold', false),
    ('air-mail', 1, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('air-mail', 2, 0.5, 'oz', 'Honey Syrup', NULL, false),
    ('air-mail', 3, 1.67, 'oz', 'Sparkling Wine', 'brut', false),
    ('fancy-free', 0, 2, 'oz', 'Bourbon', NULL, false),
    ('fancy-free', 1, 0.5, 'oz', 'Maraschino Liqueur', NULL, false),
    ('fancy-free', 2, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('fancy-free', 3, 1, 'dash', 'Orange Bitters', NULL, false),
    ('fancy-free', 4, 1, 'each', 'Orange Twist', 'garnish', false),
    ('red-snapper', 0, 2, 'oz', 'Gin', NULL, false),
    ('red-snapper', 1, 4, 'oz', 'Tomato Juice', NULL, false),
    ('red-snapper', 2, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('red-snapper', 3, 0.25, 'oz', 'Rich Simple Syrup', NULL, false),
    ('red-snapper', 4, 4, 'dash', 'Worcestershire Sauce', NULL, false),
    ('red-snapper', 5, 7, 'drop', 'Hot Sauce', NULL, false),
    ('red-snapper', 6, 2, NULL, 'Black Pepper', 'grinds', false),
    ('red-snapper', 7, 2, 'pinch', 'Celery Salt', NULL, false),
    ('royal-bermuda-yacht-club', 0, 2, 'oz', 'Aged Rum', NULL, false),
    ('royal-bermuda-yacht-club', 1, 0.5, 'oz', 'Falernum', NULL, false),
    ('royal-bermuda-yacht-club', 2, 0.25, 'oz', 'Curaçao', 'orange', false),
    ('royal-bermuda-yacht-club', 3, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('test-pilot', 0, 1.5, 'oz', 'Jamaican Rum', 'dark', false),
    ('test-pilot', 1, 0.75, 'oz', 'White Rum', 'light Puerto Rican', false),
    ('test-pilot', 2, 0.5, 'oz', 'Orange Liqueur', 'Cointreau', false),
    ('test-pilot', 3, 0.5, 'oz', 'Falernum', NULL, false),
    ('test-pilot', 4, 0.25, 'oz', 'Lime Juice', 'fresh', false),
    ('test-pilot', 5, 6, 'drop', 'Pastis', NULL, false),
    ('test-pilot', 6, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('test-pilot', 7, 1, 'each', 'Maraschino Cherry', 'garnish', false),
    ('suffering-bastard', 0, 1, 'oz', 'London Dry Gin', NULL, false),
    ('suffering-bastard', 1, 1, 'oz', 'Brandy', NULL, false),
    ('suffering-bastard', 2, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('suffering-bastard', 3, 0.25, 'oz', 'Demerara Syrup', NULL, false),
    ('suffering-bastard', 4, 2, 'dash', 'Aromatic Bitters', NULL, false),
    ('suffering-bastard', 5, 4, 'oz', 'Ginger Beer', NULL, false),
    ('suffering-bastard', 6, 1, 'sprig', 'Mint Sprig', 'garnish', false),
    ('three-dots-and-a-dash', 0, 1.5, 'oz', 'Rhum Agricole', 'aged', false),
    ('three-dots-and-a-dash', 1, 0.5, 'oz', 'Aged Rum', NULL, false),
    ('three-dots-and-a-dash', 2, 0.25, 'oz', 'Falernum', NULL, false),
    ('three-dots-and-a-dash', 3, 0.25, 'oz', 'Allspice Dram', NULL, false),
    ('three-dots-and-a-dash', 4, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('three-dots-and-a-dash', 5, 0.5, 'oz', 'Orange Juice', NULL, false),
    ('three-dots-and-a-dash', 6, 0.5, 'oz', 'Honey Syrup', NULL, false),
    ('three-dots-and-a-dash', 7, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('irish-coffee', 0, 2, 'each', 'Sugar', 'cubes', false),
    ('irish-coffee', 1, 4, 'oz', 'Coffee', 'hot', false),
    ('irish-coffee', 2, 1.5, 'oz', 'Irish Whiskey', NULL, false),
    ('irish-coffee', 3, NULL, NULL, 'Heavy Cream', 'lightly whipped', false),
    ('batida', 0, 60, 'ml', 'Cachaça', NULL, false),
    ('batida', 1, 15, 'ml', 'Lime Juice', 'fresh', false),
    ('batida', 2, 30, 'ml', 'Coconut Cream', NULL, false),
    ('batida', 3, 30, 'ml', 'Coconut Milk', NULL, false),
    ('batida', 4, 7, 'ml', 'Passion Fruit Purée', NULL, false),
    ('cape-codder', 0, 1.5, 'oz', 'Vodka', NULL, false),
    ('cape-codder', 1, 6, 'oz', 'Cranberry Juice', NULL, false),
    ('cape-codder', 2, 1, 'each', 'Lime Wedge', 'garnish', false),
    ('greyhound', 0, 2, 'oz', 'Vodka', NULL, false),
    ('greyhound', 1, 4, 'oz', 'Grapefruit Juice', 'fresh', false),
    ('greyhound', 2, 1, 'each', 'Grapefruit Twist', 'garnish', false),
    ('pink-squirrel', 0, 0.75, 'oz', 'Crème de Noyaux', NULL, false),
    ('pink-squirrel', 1, 0.75, 'oz', 'White Crème de Cacao', NULL, false),
    ('pink-squirrel', 2, 1.5, 'oz', 'Heavy Cream', NULL, false),
    ('pink-squirrel', 3, NULL, NULL, 'Nutmeg', 'grated, garnish', false),
    ('wisconsin-brandy-old-fashioned', 0, 1, 'each', 'Orange Wedge', NULL, false),
    ('wisconsin-brandy-old-fashioned', 1, 1, 'each', 'Maraschino Cherry', NULL, false),
    ('wisconsin-brandy-old-fashioned', 2, 1, 'tsp', 'Brown Sugar Syrup', NULL, false),
    ('wisconsin-brandy-old-fashioned', 3, 2, 'dash', 'Aromatic Bitters', NULL, false),
    ('wisconsin-brandy-old-fashioned', 4, 2, 'oz', 'Brandy', NULL, false),
    ('brooklynite', 0, 2, 'oz', 'Jamaican Rum', NULL, false),
    ('brooklynite', 1, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('brooklynite', 2, 0.5, 'oz', 'Honey Syrup', NULL, false),
    ('brooklynite', 3, 1, 'dash', 'Aromatic Bitters', NULL, true),
    ('brooklynite', 4, 1, 'each', 'Lime Wedge', 'garnish', false),
    ('honeysuckle', 0, 2, 'oz', 'Aged Rum', 'light gold', false),
    ('honeysuckle', 1, 0.67, 'oz', 'Lemon Juice', 'fresh', false),
    ('honeysuckle', 2, 0.5, 'oz', 'Orange Juice', NULL, false),
    ('honeysuckle', 3, 0.67, 'oz', 'Honey Syrup', NULL, false),
    ('monte-carlo', 0, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('monte-carlo', 1, 0.5, 'oz', 'Bénédictine', NULL, false),
    ('monte-carlo', 2, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('monte-carlo', 3, 1, 'each', 'Lemon Twist', 'garnish', false),
    ('royal-hawaiian', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('royal-hawaiian', 1, 1, 'oz', 'Pineapple Juice', NULL, false),
    ('royal-hawaiian', 2, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('royal-hawaiian', 3, 0.25, 'oz', 'Orgeat', NULL, false),
    ('snowball', 0, 3.5, 'oz', 'Lemonade', NULL, false),
    ('snowball', 1, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('snowball', 2, 2, 'oz', 'Advocaat', NULL, false),
    ('black-russian', 0, 2, 'oz', 'Vodka', NULL, false),
    ('black-russian', 1, 0.75, 'oz', 'Coffee Liqueur', NULL, false),
    ('screwdriver', 0, 50, 'ml', 'Vodka', NULL, false),
    ('screwdriver', 1, 100, 'ml', 'Orange Juice', NULL, false),
    ('screwdriver', 2, 1, 'slice', 'Orange', 'garnish', false),
    ('cardinale', 0, 1, 'oz', 'Gin', NULL, false),
    ('cardinale', 1, 1, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('cardinale', 2, 1, 'oz', 'Dry Vermouth', NULL, false),
    ('cardinale', 3, 1, 'each', 'Lemon Twist', 'garnish', false),
    ('vodka-gimlet', 0, 2, 'oz', 'Vodka', NULL, false),
    ('vodka-gimlet', 1, 1, 'oz', 'Lime Juice', 'fresh', false),
    ('vodka-gimlet', 2, 1, 'oz', 'Simple Syrup', NULL, false),
    ('vodka-gimlet', 3, 1, 'each', 'Lime Wedge', 'garnish', false),
    ('bull-shot', 0, 2, 'oz', 'Vodka', NULL, false),
    ('bull-shot', 1, 4, 'oz', 'Beef Bouillon', NULL, false),
    ('bull-shot', 2, 0.5, 'oz', 'Lemon Juice', 'fresh', false),
    ('bull-shot', 3, 3, 'dash', 'Worcestershire Sauce', NULL, false),
    ('bull-shot', 4, 3, 'dash', 'Hot Sauce', NULL, false),
    ('bull-shot', 5, 1, 'pinch', 'Salt', NULL, false),
    ('bull-shot', 6, 1, NULL, 'Black Pepper', 'grind', false),
    ('golden-cadillac', 0, 1, 'oz', 'Galliano', NULL, false),
    ('golden-cadillac', 1, 1, 'oz', 'White Crème de Cacao', NULL, false),
    ('golden-cadillac', 2, 1, 'oz', 'Cream', NULL, false),
    ('golden-cadillac', 3, NULL, NULL, 'Dark Chocolate', 'shaved, garnish', false),
    ('japanese-highball', 0, 2, 'oz', 'Japanese Whisky', NULL, false),
    ('japanese-highball', 1, NULL, 'top', 'Soda Water', NULL, false),
    ('japanese-highball', 2, 1, 'peel', 'Lemon Peel', 'expressed', false),
    ('royal-hawaiian-mai-tai', 0, 1, 'oz', 'Orange Juice', NULL, false),
    ('royal-hawaiian-mai-tai', 1, 1, 'oz', 'Pineapple Juice', NULL, false),
    ('royal-hawaiian-mai-tai', 2, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('royal-hawaiian-mai-tai', 3, 0.25, 'oz', 'Lemon Juice', 'fresh', false),
    ('royal-hawaiian-mai-tai', 4, 0.25, 'oz', 'Orgeat', NULL, false),
    ('royal-hawaiian-mai-tai', 5, 0.25, 'oz', 'Simple Syrup', NULL, false),
    ('royal-hawaiian-mai-tai', 6, 0.25, 'oz', 'Curaçao', 'orange', false),
    ('royal-hawaiian-mai-tai', 7, 1, 'oz', 'Demerara Rum', NULL, false),
    ('royal-hawaiian-mai-tai', 8, 1, 'oz', 'Jamaican Rum', 'dark', false),
    ('royal-hawaiian-mai-tai', 9, 1, 'oz', 'White Rum', 'light', false),
    ('blue-hawaii', 0, 20, 'ml', 'White Rum', NULL, false),
    ('blue-hawaii', 1, 20, 'ml', 'Vodka', NULL, false),
    ('blue-hawaii', 2, 15, 'ml', 'Blue Curaçao', NULL, false),
    ('blue-hawaii', 3, 90, 'ml', 'Pineapple Juice', 'unsweetened', false),
    ('blue-hawaii', 4, 30, 'ml', 'Sour Mix', NULL, false),
    ('rudesheimer-kaffee', 0, 125, 'ml', 'Coffee', 'hot, black', false),
    ('rudesheimer-kaffee', 1, 3, 'each', 'Sugar', 'cubes', false),
    ('rudesheimer-kaffee', 2, 40, 'ml', 'Brandy', 'Asbach Uralt', false),
    ('rudesheimer-kaffee', 3, NULL, NULL, 'Cream', 'whipped with vanilla sugar', false),
    ('rudesheimer-kaffee', 4, NULL, NULL, 'Dark Chocolate', 'shavings', false),
    ('jet-pilot', 0, 0.5, 'oz', 'Lime Juice', 'fresh', false),
    ('jet-pilot', 1, 0.5, 'oz', 'Grapefruit Juice', NULL, false),
    ('jet-pilot', 2, 0.5, 'oz', 'Cinnamon Syrup', NULL, false),
    ('jet-pilot', 3, 0.5, 'oz', 'Falernum', NULL, false),
    ('jet-pilot', 4, 1, 'oz', 'Jamaican Rum', 'dark', false),
    ('jet-pilot', 5, 0.75, 'oz', 'Aged Rum', 'gold Puerto Rican', false),
    ('jet-pilot', 6, 0.75, 'oz', 'Overproof Rum', '151-proof demerara', false),
    ('jet-pilot', 7, 1, 'dash', 'Aromatic Bitters', NULL, false),
    ('jet-pilot', 8, 6, 'drop', 'Absinthe', NULL, false),
    ('agua-de-valencia', 0, 2.5, 'oz', 'Cava', NULL, false),
    ('agua-de-valencia', 1, 1, 'oz', 'Gin', NULL, false),
    ('agua-de-valencia', 2, 1, 'oz', 'Vodka', NULL, false),
    ('agua-de-valencia', 3, 1, 'oz', 'Orange Juice', NULL, false),
    ('agua-de-valencia', 4, 2, 'tsp', 'Rich Simple Syrup', NULL, false),
    ('campari-shakerato', 0, 2.5, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('campari-shakerato', 1, 2, 'dash', 'Saline Solution', NULL, false),
    ('campari-shakerato', 2, 2, 'drop', 'Orange Blossom Water', NULL, false),
    ('campari-shakerato', 3, 1, 'each', 'Orange Twist', 'garnish', false),
    ('golden-dream', 0, 20, 'ml', 'Galliano', NULL, false),
    ('golden-dream', 1, 20, 'ml', 'Triple Sec', NULL, false),
    ('golden-dream', 2, 20, 'ml', 'Orange Juice', 'fresh', false),
    ('golden-dream', 3, 10, 'ml', 'Cream', NULL, false),
    ('michelada', 0, 0.42, 'oz', 'Lime Juice', 'fresh', false),
    ('michelada', 1, 2, 'dash', 'Hot Sauce', NULL, false),
    ('michelada', 2, 1, 'tsp', 'Worcestershire Sauce', NULL, false),
    ('michelada', 3, 5, 'oz', 'Lager', 'dark', false),
    ('batanga', 0, 1, 'pinch', 'Salt', NULL, false),
    ('batanga', 1, 0.42, 'oz', 'Lime Juice', 'fresh', false),
    ('batanga', 2, 2, 'oz', 'Blanco Tequila', NULL, false),
    ('batanga', 3, 3.5, 'oz', 'Cola', 'Mexican', false),
    ('port-light', 0, 1.5, 'oz', 'Bourbon', NULL, false),
    ('port-light', 1, 1, 'oz', 'Lemon Juice', 'fresh', false),
    ('port-light', 2, 0.5, 'oz', 'Passion Fruit Syrup', NULL, false),
    ('port-light', 3, 0.25, 'oz', 'Grenadine', NULL, false),
    ('port-light', 4, 1, 'sprig', 'Mint Sprig', 'garnish', false),
    ('salty-dog', 0, 1.67, 'oz', 'Vodka', NULL, false),
    ('salty-dog', 1, 1.67, 'oz', 'Grapefruit Juice', 'pink, fresh', false),
    ('salty-dog', 2, 0.17, 'oz', 'Rich Simple Syrup', NULL, false),
    ('salty-dog', 3, 4, 'drop', 'Grapefruit Bitters', NULL, true),
    ('salty-dog', 4, 4, 'drop', 'Saline Solution', NULL, true),
    ('salty-dog', 5, NULL, NULL, 'Salt', 'for the rim', false),
    ('vodka-collins', 0, 2, 'oz', 'Vodka', NULL, false),
    ('vodka-collins', 1, 0.83, 'oz', 'Lemon Juice', 'fresh', false),
    ('vodka-collins', 2, 0.5, 'oz', 'Rich Simple Syrup', NULL, false),
    ('vodka-collins', 3, 1.67, 'oz', 'Soda Water', NULL, false),
    ('white-russian', 0, 50, 'ml', 'Vodka', NULL, false),
    ('white-russian', 1, 20, 'ml', 'Coffee Liqueur', NULL, false),
    ('white-russian', 2, 30, 'ml', 'Cream', 'fresh', false),
    ('saturn', 0, 1.25, 'oz', 'Gin', NULL, false),
    ('saturn', 1, 0.5, 'oz', 'Lemon Juice', NULL, false),
    ('saturn', 2, 0.5, 'oz', 'Passion Fruit Syrup', NULL, false),
    ('saturn', 3, 0.25, 'oz', 'Falernum', NULL, false),
    ('saturn', 4, 0.25, 'oz', 'Orgeat', NULL, false),
    ('caesar', 0, 1.5, 'oz', 'Vodka', NULL, false),
    ('caesar', 1, 6, 'oz', 'Clamato', NULL, false),
    ('caesar', 2, 2, 'dash', 'Hot Sauce', NULL, false),
    ('caesar', 3, 4, 'dash', 'Worcestershire Sauce', NULL, false),
    ('caesar', 4, NULL, NULL, 'Celery Salt', 'for the rim', false),
    ('caesar', 5, NULL, NULL, 'Black Pepper', 'freshly ground', false),
    ('caesar', 6, 1, 'each', 'Lime Wedge', NULL, false),
    ('caesar', 7, 1, 'each', 'Celery', 'crisp stalk', false),
    ('harvey-wallbanger', 0, 45, 'ml', 'Vodka', NULL, false),
    ('harvey-wallbanger', 1, 90, 'ml', 'Orange Juice', 'fresh', false),
    ('harvey-wallbanger', 2, 15, 'ml', 'Herbal Liqueur', 'Galliano, floated', false),
    ('bloody-maria', 0, 1, 'oz', 'Tequila', NULL, false),
    ('bloody-maria', 1, 2, 'oz', 'Tomato Juice', NULL, false),
    ('bloody-maria', 2, 1, 'dash', 'Lemon Juice', NULL, false),
    ('bloody-maria', 3, 1, 'dash', 'Hot Sauce', 'Tabasco', false),
    ('bloody-maria', 4, 1, 'dash', 'Celery Salt', NULL, false),
    ('bloody-maria', 5, 1, 'slice', 'Lemon', NULL, false),
    ('frozen-margarita', 0, 1.5, 'oz', 'Blanco Tequila', NULL, false),
    ('frozen-margarita', 1, 1, 'oz', 'Lime Juice', '3:1 Persian to Key lime', false),
    ('frozen-margarita', 2, 0.5, 'oz', 'Triple Sec', 'Cointreau', false),
    ('frozen-margarita', 3, 0.5, 'oz', 'Rich Simple Syrup', NULL, false),
    ('frozen-margarita', 4, NULL, NULL, 'Black Tea', 'weak tea frozen into ice cubes, half a cup', false),
    ('frozen-margarita', 5, NULL, NULL, 'Salt', 'for the rim', true),
    ('painkiller', 0, 1.5, 'oz', 'Rum', 'Virgin Islands', false),
    ('painkiller', 1, 1.5, 'oz', 'Pineapple Juice', 'fresh', false),
    ('painkiller', 2, 0.5, 'oz', 'Orange Juice', 'fresh', false),
    ('painkiller', 3, 0.75, 'oz', 'Cream of Coconut', NULL, false),
    ('painkiller', 4, NULL, NULL, 'Nutmeg', 'freshly grated', false),
    ('bombardino', 0, NULL, NULL, 'Advocaat', 'or Vov, hot', false),
    ('bombardino', 1, NULL, NULL, 'Brandy', NULL, false),
    ('bombardino', 2, NULL, NULL, 'Cream', 'whipped', false),
    ('kalimotxo', 0, 4, 'oz', 'Red Wine', NULL, false),
    ('kalimotxo', 1, 4, 'oz', 'Cola', NULL, false),
    ('kalimotxo', 2, 1, 'slice', 'Lemon', NULL, true),
    ('long-island-iced-tea', 0, 15, 'ml', 'Tequila', NULL, false),
    ('long-island-iced-tea', 1, 15, 'ml', 'Vodka', NULL, false),
    ('long-island-iced-tea', 2, 15, 'ml', 'White Rum', NULL, false),
    ('long-island-iced-tea', 3, 15, 'ml', 'Triple Sec', 'Cointreau', false),
    ('long-island-iced-tea', 4, 15, 'ml', 'Gin', NULL, false),
    ('long-island-iced-tea', 5, 25, 'ml', 'Lemon Juice', NULL, false),
    ('long-island-iced-tea', 6, 30, 'ml', 'Simple Syrup', NULL, false),
    ('long-island-iced-tea', 7, NULL, 'top', 'Cola', NULL, false),
    ('long-island-iced-tea', 8, 1, 'slice', 'Lemon', NULL, true),
    ('tequila-sunrise', 0, 45, 'ml', 'Tequila', NULL, false),
    ('tequila-sunrise', 1, 90, 'ml', 'Orange Juice', 'fresh', false),
    ('tequila-sunrise', 2, 15, 'ml', 'Grenadine', NULL, false),
    ('amaretto-sour', 0, 2, 'oz', 'Amaretto', NULL, false),
    ('amaretto-sour', 1, 1, 'oz', 'Lemon Juice', 'fresh', false),
    ('amaretto-sour', 2, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('amaretto-sour', 3, 0.5, 'oz', 'Egg White', 'pasteurised', false),
    ('rosita', 0, 1.5, 'oz', 'Reposado Tequila', NULL, false),
    ('rosita', 1, 0.5, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('rosita', 2, 0.5, 'oz', 'Dry Vermouth', NULL, false),
    ('rosita', 3, 0.5, 'oz', 'Sweet Vermouth', NULL, false),
    ('rosita', 4, 1, 'dash', 'Aromatic Bitters', 'Angostura', true),
    ('rosita', 5, 2, 'drop', 'Saline Solution', NULL, true),
    ('bushwacker', 0, 1, 'oz', 'Dark Rum', NULL, false),
    ('bushwacker', 1, 1, 'oz', 'Coffee Liqueur', 'Kahlúa', false),
    ('bushwacker', 2, 1, 'oz', 'Crème de Cacao', 'dark', false),
    ('bushwacker', 3, 2, 'oz', 'Cream of Coconut', NULL, false),
    ('bushwacker', 4, 2, 'oz', 'Milk', 'or half and half', false),
    ('mudslide', 0, 1.5, 'oz', 'Irish Cream Liqueur', NULL, false),
    ('mudslide', 1, 1.5, 'oz', 'Vodka', NULL, false),
    ('mudslide', 2, 1.5, 'oz', 'Coffee Liqueur', NULL, false),
    ('mudslide', 3, 3, 'each', 'Vanilla Ice Cream', 'scoops', false),
    ('spanish-coffee', 0, 0.75, 'oz', 'Overproof Rum', '151 proof', false),
    ('spanish-coffee', 1, 0.5, 'oz', 'Triple Sec', NULL, false),
    ('spanish-coffee', 2, 2, 'oz', 'Coffee Liqueur', 'Kahlúa', false),
    ('spanish-coffee', 3, 3, 'oz', 'Coffee', 'hot', false),
    ('spanish-coffee', 4, NULL, NULL, 'Cream', 'whipped', false),
    ('spanish-coffee', 5, 1, 'pinch', 'Nutmeg', NULL, false),
    ('french-connection', 0, 1.5, 'oz', 'Cognac', NULL, false),
    ('french-connection', 1, 0.75, 'oz', 'Amaretto', NULL, false),
    ('godfather', 0, 2, 'oz', 'Blended Scotch', NULL, false),
    ('godfather', 1, 0.67, 'oz', 'Amaretto', NULL, false),
    ('godfather', 2, 2, 'drop', 'Bitters', 'Boker''s', true),
    ('godmother', 0, 1, 'oz', 'Vodka', NULL, false),
    ('godmother', 1, 1, 'oz', 'Amaretto', NULL, false),
    ('kamikaze', 0, 30, 'ml', 'Vodka', NULL, false),
    ('kamikaze', 1, 30, 'ml', 'Triple Sec', NULL, false),
    ('kamikaze', 2, 30, 'ml', 'Lime Juice', NULL, false),
    ('b-52', 0, 20, 'ml', 'Coffee Liqueur', NULL, false),
    ('b-52', 1, 20, 'ml', 'Irish Cream Liqueur', NULL, false),
    ('b-52', 2, 20, 'ml', 'Orange Liqueur', 'Grand Marnier', false),
    ('brave-bull', 0, 1.5, 'oz', 'Reposado Tequila', '100% agave', false),
    ('brave-bull', 1, 0.75, 'oz', 'Coffee Liqueur', NULL, false),
    ('brave-bull', 2, 6, 'drop', 'Bitters', 'Difford''s Daiquiri Bitters', false),
    ('brave-bull', 3, 2, 'drop', 'Saline Solution', NULL, true),
    ('cadillac-margarita', 0, 2, 'oz', 'Reposado Tequila', NULL, false),
    ('cadillac-margarita', 1, 1, 'oz', 'Lime Juice', NULL, false),
    ('cadillac-margarita', 2, 0.5, 'oz', 'Orange Liqueur', 'Grand Marnier', false),
    ('cadillac-margarita', 3, 0.5, 'oz', 'Agave Nectar', NULL, false),
    ('fernet-con-coca', 0, 50, 'ml', 'Fernet', 'Fernet-Branca', false),
    ('fernet-con-coca', 1, NULL, 'top', 'Cola', NULL, false),
    ('sea-breeze', 0, 40, 'ml', 'Vodka', NULL, false),
    ('sea-breeze', 1, 120, 'ml', 'Cranberry Juice', NULL, false),
    ('sea-breeze', 2, 30, 'ml', 'Grapefruit Juice', NULL, false),
    ('japanese-slipper', 0, 30, 'ml', 'Melon Liqueur', 'Midori', false),
    ('japanese-slipper', 1, 30, 'ml', 'Triple Sec', 'Cointreau', false),
    ('japanese-slipper', 2, 30, 'ml', 'Lemon Juice', NULL, false),
    ('dukes-martini', 0, 3, 'dash', 'Dry Vermouth', NULL, false),
    ('dukes-martini', 1, 4, 'oz', 'Gin', 'or vodka, frozen', false),
    ('whiskey-smash', 0, 1.5, 'oz', 'Bourbon', NULL, false),
    ('whiskey-smash', 1, 1, 'oz', 'Water', NULL, false),
    ('whiskey-smash', 2, 0.75, 'oz', 'Simple Syrup', NULL, false),
    ('whiskey-smash', 3, 0.25, 'each', 'Lemon', 'cut in two', false),
    ('whiskey-smash', 4, 3, 'leaf', 'Mint', NULL, false),
    ('jasmine', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('jasmine', 1, 0.75, 'oz', 'Lemon Juice', 'fresh', false),
    ('jasmine', 2, 0.25, 'oz', 'Triple Sec', 'Cointreau', false),
    ('jasmine', 3, 0.25, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('spumoni', 0, 1, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('spumoni', 1, 1.5, 'oz', 'Grapefruit Juice', 'ruby red', false),
    ('spumoni', 2, 3, 'oz', 'Tonic Water', 'chilled', false),
    ('lychee-martini', 0, 1.5, 'oz', 'Vodka', NULL, false),
    ('lychee-martini', 1, 0.5, 'oz', 'Lychee Liqueur', NULL, false),
    ('lychee-martini', 2, 0.5, 'oz', 'Lychee Juice', NULL, false),
    ('lychee-martini', 3, 0.5, 'oz', 'Dry Vermouth', NULL, false),
    ('lychee-martini', 4, 0.17, 'oz', 'Lychee Syrup', NULL, false),
    ('ancient-mariner', 0, 1, 'oz', 'Aged Rum', 'Caribbean blend, 6 to 10 years', false),
    ('ancient-mariner', 1, 1, 'oz', 'Dark Rum', 'dark or blackstrap', false),
    ('ancient-mariner', 2, 0.25, 'oz', 'Allspice Dram', NULL, false),
    ('ancient-mariner', 3, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('ancient-mariner', 4, 0.5, 'oz', 'Grapefruit Juice', 'pink, fresh', false),
    ('ancient-mariner', 5, 0.5, 'oz', 'Rich Simple Syrup', NULL, false),
    ('seelbach', 0, 1, 'oz', 'Bourbon', NULL, false),
    ('seelbach', 1, 0.5, 'oz', 'Triple Sec', 'Cointreau', false),
    ('seelbach', 2, 2, 'dash', 'Creole Bitters', 'Peychaud''s', false),
    ('seelbach', 3, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('seelbach', 4, NULL, 'top', 'Champagne', 'brut', false),
    ('appletini', 0, 1.5, 'oz', 'Vodka', NULL, false),
    ('appletini', 1, 0.5, 'oz', 'Apple Schnapps', 'sour apple', false),
    ('appletini', 2, 0.5, 'oz', 'Triple Sec', 'Cointreau', false),
    ('breakfast-martini', 0, 50, 'ml', 'Gin', NULL, false),
    ('breakfast-martini', 1, 18.75, 'ml', 'Triple Sec', 'Cointreau', false),
    ('breakfast-martini', 2, 18.75, 'ml', 'Lemon Juice', 'fresh', false),
    ('breakfast-martini', 3, 1, 'bsp', 'Marmalade', 'orange', false),
    ('cable-car', 0, 1.5, 'oz', 'Spiced Rum', NULL, false),
    ('cable-car', 1, 0.75, 'oz', 'Curaçao', 'dry', false),
    ('cable-car', 2, 1, 'oz', 'Lemon Juice', 'fresh', false),
    ('cable-car', 3, 0.33, 'oz', 'Rich Simple Syrup', NULL, false),
    ('cable-car', 4, 0.33, 'oz', 'Egg White', 'pasteurised', false),
    ('cable-car', 5, NULL, NULL, 'Sugar', 'mixed with cinnamon, for the rim', false),
    ('cable-car', 6, NULL, NULL, 'Cinnamon', 'for the rim', false),
    ('quill', 0, 1, 'oz', 'London Dry Gin', NULL, false),
    ('quill', 1, 1, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('quill', 2, 1, 'oz', 'Sweet Vermouth', NULL, false),
    ('quill', 3, 0.17, 'oz', 'Absinthe', NULL, false),
    ('mexican-carajillo', 0, 1.5, 'oz', 'Licor 43', NULL, false),
    ('mexican-carajillo', 1, 1.5, 'oz', 'Espresso', 'fresh', false),
    ('ranch-water', 0, 1.5, 'oz', 'Blanco Tequila', NULL, false),
    ('ranch-water', 1, 1, 'oz', 'Lime Juice', NULL, false),
    ('ranch-water', 2, 0.5, 'oz', 'Triple Sec', NULL, false),
    ('ranch-water', 3, 0.5, 'oz', 'Agave Syrup', NULL, false),
    ('ranch-water', 4, 3, 'oz', 'Soda Water', 'sparkling mineral water such as Topo Chico', false),
    ('treacle', 0, 0.83, 'oz', 'Jamaican Rum', 'first half', false),
    ('treacle', 1, 0.17, 'oz', 'Rich Simple Syrup', NULL, false),
    ('treacle', 2, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('treacle', 3, 0.83, 'oz', 'Jamaican Rum', 'second half', false),
    ('treacle', 4, 0.67, 'oz', 'Apple Juice', 'clear, floated', false),
    ('gin-gin-mule', 0, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('gin-gin-mule', 1, 1, 'oz', 'Simple Syrup', NULL, false),
    ('gin-gin-mule', 2, 6, 'sprig', 'Mint', NULL, false),
    ('gin-gin-mule', 3, 1.5, 'oz', 'Gin', 'Tanqueray', false),
    ('gin-gin-mule', 4, 1, 'oz', 'Ginger Beer', NULL, false),
    ('spanish-gin-tonic', 0, 4, 'oz', 'Tonic Water', NULL, false),
    ('spanish-gin-tonic', 1, 2, 'oz', 'Gin', NULL, false),
    ('spanish-gin-tonic', 2, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('spanish-gin-tonic', 3, NULL, NULL, 'Juniper Berries', 'or grapefruit, lemon twist, flowers or rosemary, to garnish', true),
    ('trident', 0, 1, 'oz', 'Aquavit', NULL, false),
    ('trident', 1, 1, 'oz', 'Carciofo', 'Cynar', false),
    ('trident', 2, 1, 'oz', 'Fino Sherry', NULL, false),
    ('trident', 3, 2, 'dash', 'Peach Bitters', NULL, false),
    ('bourbon-renewal', 0, 2, 'oz', 'Bourbon', NULL, false),
    ('bourbon-renewal', 1, 1, 'oz', 'Lemon Juice', NULL, false),
    ('bourbon-renewal', 2, 0.5, 'oz', 'Crème de Cassis', NULL, false),
    ('bourbon-renewal', 3, 0.5, 'oz', 'Simple Syrup', NULL, false),
    ('bourbon-renewal', 4, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('enzoni', 0, 5, 'each', 'Grape', 'green, seedless', false),
    ('enzoni', 1, 1, 'oz', 'London Dry Gin', NULL, false),
    ('enzoni', 2, 1, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('enzoni', 3, 0.75, 'oz', 'Lemon Juice', 'fresh', false),
    ('enzoni', 4, 0.5, 'oz', 'Simple Syrup', NULL, false),
    ('old-cuban', 0, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('old-cuban', 1, 1, 'oz', 'Simple Syrup', NULL, false),
    ('old-cuban', 2, 6, 'leaf', 'Mint', NULL, false),
    ('old-cuban', 3, 1.5, 'oz', 'Aged Rum', 'Bacardi 8', false),
    ('old-cuban', 4, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('old-cuban', 5, 2, 'oz', 'Champagne', NULL, false),
    ('chartreuse-swizzle', 0, 1.25, 'oz', 'Green Chartreuse', NULL, false),
    ('chartreuse-swizzle', 1, 0.5, 'oz', 'Falernum', 'Velvet Falernum', false),
    ('chartreuse-swizzle', 2, 1, 'oz', 'Pineapple Juice', NULL, false),
    ('chartreuse-swizzle', 3, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('1794', 0, 1.5, 'oz', 'Rye Whiskey', '100 proof', false),
    ('1794', 1, 0.75, 'oz', 'Sweet Vermouth', NULL, false),
    ('1794', 2, 0.75, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('1794', 3, 1, 'dash', 'Mole Bitters', NULL, true),
    ('eastside', 0, 2, 'slice', 'Cucumber', 'fresh', false),
    ('eastside', 1, 8, 'leaf', 'Mint', NULL, false),
    ('eastside', 2, 2, 'oz', 'London Dry Gin', NULL, false),
    ('eastside', 3, 0.75, 'oz', 'Lime Juice', 'fresh', false),
    ('eastside', 4, 0.5, 'oz', 'Rich Simple Syrup', NULL, false),
    ('eastside', 5, 0.5, 'oz', 'Soda Water', NULL, false),
    ('revolver', 0, 2, 'oz', 'Bourbon', NULL, false),
    ('revolver', 1, 0.5, 'oz', 'Coffee Liqueur', NULL, false),
    ('revolver', 2, 2, 'dash', 'Orange Bitters', NULL, false),
    ('black-manhattan', 0, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('black-manhattan', 1, 1, 'oz', 'Amaro', 'Averna', false),
    ('black-manhattan', 2, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('black-manhattan', 3, 1, 'dash', 'Orange Bitters', NULL, false),
    ('black-manhattan', 4, 1, 'each', 'Maraschino Cherry', NULL, false),
    ('chet-baker', 0, 2, 'oz', 'Rum', NULL, false),
    ('chet-baker', 1, 0.5, 'oz', 'Sweet Vermouth', 'Punt e Mes', false),
    ('chet-baker', 2, 0.5, 'oz', 'Honey Syrup', NULL, false),
    ('chet-baker', 3, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('chocolate-negroni', 0, 1, 'oz', 'Gin', NULL, false),
    ('chocolate-negroni', 1, 0.75, 'oz', 'Sweet Vermouth', 'Punt e Mes', false),
    ('chocolate-negroni', 2, 0.75, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('chocolate-negroni', 3, 0.25, 'oz', 'Crème de Cacao', 'dark', false),
    ('chocolate-negroni', 4, 3, 'dash', 'Chocolate Bitters', NULL, false),
    ('earl-grey-martini', 0, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('earl-grey-martini', 1, 1, 'oz', 'Simple Syrup', NULL, false),
    ('earl-grey-martini', 2, 1.5, 'oz', 'Gin', 'Earl Grey tea-infused', false),
    ('earl-grey-martini', 3, 1, 'each', 'Egg White', NULL, false),
    ('earl-grey-martini', 4, NULL, NULL, 'Sugar', 'half rim', false),
    ('fitty-fitty', 0, 1.5, 'oz', 'Gin', NULL, false),
    ('fitty-fitty', 1, 1.5, 'oz', 'Dry Vermouth', NULL, false),
    ('fitty-fitty', 2, 2, 'dash', 'Orange Bitters', 'one each of Regans'' and Fee Brothers', false),
    ('hugo', 0, 8, 'leaf', 'Mint', NULL, false),
    ('hugo', 1, 1.33, 'oz', 'Elderflower Liqueur', NULL, false),
    ('hugo', 2, 2, 'oz', 'Soda Water', NULL, false),
    ('hugo', 3, 2, 'oz', 'Prosecco', 'extra dry', false),
    ('kentucky-maid', 0, 4, 'slice', 'Cucumber', 'fresh', false),
    ('kentucky-maid', 1, 6, 'leaf', 'Mint', NULL, false),
    ('kentucky-maid', 2, 2, 'oz', 'Bourbon', NULL, false),
    ('kentucky-maid', 3, 1, 'oz', 'Lime Juice', 'fresh', false),
    ('kentucky-maid', 4, 0.67, 'oz', 'Rich Simple Syrup', NULL, false),
    ('bensonhurst', 0, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('bensonhurst', 1, 1, 'oz', 'Dry Vermouth', NULL, false),
    ('bensonhurst', 2, 2, 'tsp', 'Maraschino Liqueur', NULL, false),
    ('bensonhurst', 3, 1, 'tsp', 'Carciofo', 'Cynar', false),
    ('contessa', 0, 1, 'oz', 'London Dry Gin', NULL, false),
    ('contessa', 1, 1, 'oz', 'Bittersweet Orange Aperitivo', 'Aperol', false),
    ('contessa', 2, 1, 'oz', 'Dry Vermouth', NULL, false),
    ('greenpoint', 0, 60, 'ml', 'Rye Whiskey', NULL, false),
    ('greenpoint', 1, 15, 'ml', 'Yellow Chartreuse', NULL, false),
    ('greenpoint', 2, 15, 'ml', 'Sweet Vermouth', NULL, false),
    ('greenpoint', 3, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('greenpoint', 4, 1, 'dash', 'Orange Bitters', NULL, false),
    ('siesta', 0, 1.5, 'oz', 'Blanco Tequila', NULL, false),
    ('siesta', 1, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('siesta', 2, 0.5, 'oz', 'Grapefruit Juice', NULL, false),
    ('siesta', 3, 0.75, 'oz', 'Simple Syrup', NULL, false),
    ('siesta', 4, 0.25, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('bentons-old-fashioned', 0, 2, 'oz', 'Bourbon', 'Benton''s bacon fat-washed', false),
    ('bentons-old-fashioned', 1, 0.25, 'oz', 'Maple Syrup', 'grade B', false),
    ('bentons-old-fashioned', 2, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('elder-fashion', 0, 2, 'oz', 'London Dry Gin', NULL, false),
    ('elder-fashion', 1, 0.75, 'oz', 'Elderflower Liqueur', 'St-Germain', false),
    ('elder-fashion', 2, 2, 'dash', 'Orange Bitters', NULL, false),
    ('final-ward', 0, 0.75, 'oz', 'Rye Whiskey', NULL, false),
    ('final-ward', 1, 0.75, 'oz', 'Herbal Liqueur', 'green Chartreuse', false),
    ('final-ward', 2, 0.75, 'oz', 'Maraschino Liqueur', NULL, false),
    ('final-ward', 3, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('juliet-and-romeo', 0, 2, 'oz', 'London Dry Gin', 'Beefeater', false),
    ('juliet-and-romeo', 1, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('juliet-and-romeo', 2, 0.75, 'oz', 'Simple Syrup', NULL, false),
    ('juliet-and-romeo', 3, 3, 'slice', 'Cucumber', NULL, false),
    ('juliet-and-romeo', 4, 1, 'sprig', 'Mint', NULL, false),
    ('juliet-and-romeo', 5, 1, 'pinch', 'Salt', NULL, false),
    ('juliet-and-romeo', 6, 1, 'dash', 'Rose Water', 'on the mint leaf', false),
    ('juliet-and-romeo', 7, 3, 'dash', 'Aromatic Bitters', 'Angostura, on top', false),
    ('left-hand', 0, 1.5, 'oz', 'Bourbon', NULL, false),
    ('left-hand', 1, 0.75, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('left-hand', 2, 0.75, 'oz', 'Sweet Vermouth', 'Carpano Antica', false),
    ('left-hand', 3, 2, 'dash', 'Chocolate Bitters', 'mole', false),
    ('rapscallion', 0, 40, 'ml', 'Single Malt Scotch', 'Talisker 10', false),
    ('rapscallion', 1, 20, 'ml', 'Pedro Ximénez Sherry', NULL, false),
    ('rapscallion', 2, NULL, NULL, 'Pastis', 'Ricard, to rinse the glass', false),
    ('right-hand', 0, 1.75, 'oz', 'Aged Rum', NULL, false),
    ('right-hand', 1, 0.75, 'oz', 'Sweet Vermouth', NULL, false),
    ('right-hand', 2, 0.75, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('right-hand', 3, 2, 'dash', 'Chocolate Bitters', NULL, false),
    ('agavoni', 0, 0.75, 'oz', 'Blanco Tequila', NULL, false),
    ('agavoni', 1, 0.75, 'oz', 'Sweet Vermouth', NULL, false),
    ('agavoni', 2, 0.75, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('agavoni', 3, 2, 'dash', 'Orange Bitters', NULL, false),
    ('art-of-choke', 0, 1, 'oz', 'White Rum', NULL, false),
    ('art-of-choke', 1, 1, 'oz', 'Carciofo', 'Cynar', false),
    ('art-of-choke', 2, 0.75, 'tsp', 'Lime Juice', NULL, false),
    ('art-of-choke', 3, 0.75, 'tsp', 'Rich Demerara Syrup', '2:1', false),
    ('art-of-choke', 4, 0.25, 'oz', 'Herbal Liqueur', 'green Chartreuse', false),
    ('carroll-gardens', 0, 2, 'oz', 'Rye Whiskey', 'Rittenhouse', false),
    ('carroll-gardens', 1, 0.5, 'oz', 'Sweet Vermouth', 'Punt e Mes', false),
    ('carroll-gardens', 2, 0.5, 'oz', 'Amaro', 'Nardini', false),
    ('carroll-gardens', 3, 1, 'tsp', 'Maraschino Liqueur', 'scant', false),
    ('conference', 0, 0.5, 'oz', 'Bourbon', 'Buffalo Trace', false),
    ('conference', 1, 0.5, 'oz', 'Rye Whiskey', 'Rittenhouse', false),
    ('conference', 2, 0.5, 'oz', 'Calvados', NULL, false),
    ('conference', 3, 0.5, 'oz', 'Cognac', NULL, false),
    ('conference', 4, 1, 'tsp', 'Demerara Syrup', NULL, false),
    ('conference', 5, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('conference', 6, 1, 'dash', 'Chocolate Bitters', 'Bittermens Xocolatl Mole', false),
    ('gin-basil-smash', 0, 60, 'ml', 'Gin', NULL, false),
    ('gin-basil-smash', 1, 22.5, 'ml', 'Lemon Juice', NULL, false),
    ('gin-basil-smash', 2, 22.5, 'ml', 'Simple Syrup', NULL, false),
    ('gin-basil-smash', 3, 10, 'leaf', 'Basil', 'Genovese', false),
    ('mulata-daisy', 0, 1, 'bsp', 'Fennel Seed', NULL, false),
    ('mulata-daisy', 1, 1, 'bsp', 'Sugar', 'powdered', false),
    ('mulata-daisy', 2, 0.67, 'oz', 'Lime Juice', NULL, false),
    ('mulata-daisy', 3, 1.67, 'oz', 'White Rum', NULL, false),
    ('mulata-daisy', 4, 0.33, 'oz', 'Herbal Liqueur', 'Galliano L''Autentico', false),
    ('mulata-daisy', 5, 0.5, 'oz', 'Crème de Cacao', 'dark', false),
    ('barrel-aged-negroni', 0, NULL, NULL, 'London Dry Gin', 'Beefeater', false),
    ('barrel-aged-negroni', 1, NULL, NULL, 'Sweet Vermouth', 'Cinzano Rosso', false),
    ('barrel-aged-negroni', 2, NULL, NULL, 'Bitter Aperitivo', 'Campari', false),
    ('bitter-giuseppe', 0, 2, 'oz', 'Carciofo', 'Cynar', false),
    ('bitter-giuseppe', 1, 1, 'oz', 'Sweet Vermouth', 'Carpano Antica Formula', false),
    ('bitter-giuseppe', 2, 0.25, 'oz', 'Lemon Juice', NULL, false),
    ('bitter-giuseppe', 3, 6, 'dash', 'Orange Bitters', 'Regans''', false),
    ('cobble-hill', 0, 2, 'slice', 'Cucumber', NULL, false),
    ('cobble-hill', 1, 2, 'oz', 'Rye Whiskey', NULL, false),
    ('cobble-hill', 2, 0.5, 'oz', 'Dry Vermouth', NULL, false),
    ('cobble-hill', 3, 0.5, 'oz', 'Amaro', 'Montenegro', false),
    ('kentucky-buck', 0, 2, 'oz', 'Bourbon', NULL, false),
    ('kentucky-buck', 1, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('kentucky-buck', 2, 0.75, 'oz', 'Ginger Syrup', NULL, false),
    ('kentucky-buck', 3, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('kentucky-buck', 4, 1, 'each', 'Strawberry', NULL, false),
    ('kentucky-buck', 5, NULL, 'top', 'Soda Water', NULL, false),
    ('kingston-negroni', 0, 1, 'oz', 'Jamaican Rum', 'Smith & Cross', false),
    ('kingston-negroni', 1, 1, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('kingston-negroni', 2, 1, 'oz', 'Sweet Vermouth', 'Carpano Antica', false),
    ('mezcal-negroni', 0, 1, 'oz', 'Mezcal', 'Del Maguey Vida', false),
    ('mezcal-negroni', 1, 1, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('mezcal-negroni', 2, 1, 'oz', 'Sweet Vermouth', NULL, false),
    ('slope', 0, 2.5, 'oz', 'Rye Whiskey', NULL, false),
    ('slope', 1, 0.75, 'oz', 'Sweet Vermouth', 'Punt e Mes', false),
    ('slope', 2, 0.25, 'oz', 'Apricot Liqueur', NULL, false),
    ('slope', 3, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('death-in-venice', 0, 0.33, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('death-in-venice', 1, 3, 'drop', 'Grapefruit Bitters', NULL, false),
    ('death-in-venice', 2, 4.5, 'oz', 'Prosecco', 'extra dry', false),
    ('monte-cassino', 0, 0.75, 'oz', 'Rye Whiskey', '100 proof', false),
    ('monte-cassino', 1, 0.75, 'oz', 'Herbal Liqueur', 'Bénédictine', false),
    ('monte-cassino', 2, 0.75, 'oz', 'Herbal Liqueur', 'yellow Chartreuse', false),
    ('monte-cassino', 3, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('monte-cassino', 4, 0.33, 'oz', 'Water', 'chilled, omit if using wet ice', true),
    ('haitian-divorce', 0, 1.5, 'oz', 'Aged Rum', 'Haitian, Barbancourt 8', false),
    ('haitian-divorce', 1, 0.75, 'oz', 'Mezcal', 'Del Maguey Vida', false),
    ('haitian-divorce', 2, 0.5, 'oz', 'Pedro Ximénez Sherry', NULL, false),
    ('haitian-divorce', 3, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('industry-sour', 0, 1, 'oz', 'Fernet', 'Fernet-Branca', false),
    ('industry-sour', 1, 1, 'oz', 'Herbal Liqueur', 'green Chartreuse', false),
    ('industry-sour', 2, 1, 'oz', 'Lime Juice', NULL, false),
    ('industry-sour', 3, 1, 'oz', 'Simple Syrup', NULL, false),
    ('sharpie-mustache', 0, 0.75, 'oz', 'Gin', 'Rutte', false),
    ('sharpie-mustache', 1, 0.75, 'oz', 'Rye Whiskey', 'Rittenhouse', false),
    ('sharpie-mustache', 2, 0.75, 'oz', 'Amaro', 'Meletti', false),
    ('sharpie-mustache', 3, 0.75, 'oz', 'Quinquina', 'Bonal Gentiane-Quina', false),
    ('sharpie-mustache', 4, 1, 'dash', 'Tiki Bitters', 'Bittermens ''Elemakule', false),
    ('unusual-negroni', 0, 1, 'oz', 'London Dry Gin', NULL, false),
    ('unusual-negroni', 1, 1, 'oz', 'Bittersweet Orange Aperitivo', 'Aperol', false),
    ('unusual-negroni', 2, 1, 'oz', 'Quinquina', 'Lillet Blanc', false),
    ('morgenthaler-amaretto-sour', 0, 1.5, 'oz', 'Amaretto', NULL, false),
    ('morgenthaler-amaretto-sour', 1, 0.75, 'oz', 'Bourbon', 'cask proof', false),
    ('morgenthaler-amaretto-sour', 2, 1, 'oz', 'Lemon Juice', NULL, false),
    ('morgenthaler-amaretto-sour', 3, 1, 'tsp', 'Rich Simple Syrup', '2:1', false),
    ('morgenthaler-amaretto-sour', 4, 0.5, 'oz', 'Egg White', 'lightly beaten', false),
    ('picante', 0, NULL, NULL, 'Chilli', 'red, a small piece about 1/4 inch', false),
    ('picante', 1, 10, 'leaf', 'Cilantro', 'with stem', false),
    ('picante', 2, 2, 'oz', 'Reposado Tequila', NULL, false),
    ('picante', 3, 1, 'oz', 'Lime Juice', NULL, false),
    ('picante', 4, 0.75, 'oz', 'Agave Nectar', NULL, false),
    ('pina-verde', 0, 1.5, 'oz', 'Herbal Liqueur', 'green Chartreuse', false),
    ('pina-verde', 1, 1.5, 'oz', 'Pineapple Juice', NULL, false),
    ('pina-verde', 2, 0.75, 'oz', 'Cream of Coconut', 'Coco López', false),
    ('pina-verde', 3, 0.5, 'oz', 'Lime Juice', NULL, false),
    ('dead-rabbit-irish-coffee', 0, 1, 'oz', 'Irish Whiskey', 'Bushmills Original', false),
    ('dead-rabbit-irish-coffee', 1, 0.625, 'oz', 'Rich Demerara Syrup', '2:1', false),
    ('dead-rabbit-irish-coffee', 2, 3.25, 'oz', 'Coffee', 'hot, Sumatra', false),
    ('dead-rabbit-irish-coffee', 3, NULL, NULL, 'Heavy Cream', 'freshly whipped, to float', false),
    ('frozen-negroni', 0, 12, 'oz', 'Orange Juice', NULL, false),
    ('frozen-negroni', 1, 4, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('frozen-negroni', 2, 4, 'oz', 'Gin', NULL, false),
    ('frozen-negroni', 3, 4, 'oz', 'Sweet Vermouth', NULL, false),
    ('lost-lake', 0, 2, 'oz', 'Jamaican Rum', 'Appleton Signature Blend', false),
    ('lost-lake', 1, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('lost-lake', 2, 0.5, 'oz', 'Pineapple Juice', NULL, false),
    ('lost-lake', 3, 0.75, 'oz', 'Passion Fruit Syrup', NULL, false),
    ('lost-lake', 4, 0.25, 'oz', 'Maraschino Liqueur', 'Luxardo', false),
    ('lost-lake', 5, 0.25, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('last-of-the-oaxacans', 0, 0.75, 'oz', 'Mezcal', 'Del Maguey Vida', false),
    ('last-of-the-oaxacans', 1, 0.75, 'oz', 'Maraschino Liqueur', 'Luxardo', false),
    ('last-of-the-oaxacans', 2, 0.75, 'oz', 'Herbal Liqueur', 'green Chartreuse', false),
    ('last-of-the-oaxacans', 3, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('negroni-bianco', 0, 1, 'oz', 'Bitter Bianco', 'Luxardo', false),
    ('negroni-bianco', 1, 1, 'oz', 'London Dry Gin', 'Luxardo', false),
    ('negroni-bianco', 2, 1, 'oz', 'Bianco Vermouth', NULL, false),
    ('basil-gimlet', 0, 2, 'oz', 'Gin', 'Junipero', false),
    ('basil-gimlet', 1, 1, 'oz', 'Lime Juice', NULL, false),
    ('basil-gimlet', 2, 0.5, 'oz', 'Simple Syrup', '1:1', false),
    ('basil-gimlet', 3, 5, 'leaf', 'Basil', NULL, false),
    ('boston-sour', 0, 2, 'oz', 'Bourbon', NULL, false),
    ('boston-sour', 1, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('boston-sour', 2, 0.5, 'oz', 'Rich Simple Syrup', '2:1', false),
    ('boston-sour', 3, 0.5, 'oz', 'Egg White', NULL, false),
    ('bourbon-milk-punch', 0, 2, 'oz', 'Milk', NULL, false),
    ('bourbon-milk-punch', 1, 2, 'oz', 'Cream', NULL, false),
    ('bourbon-milk-punch', 2, 1.5, 'oz', 'Bourbon', 'or brandy', false),
    ('bourbon-milk-punch', 3, 1.5, 'oz', 'Vanilla Syrup', 'vanilla bean infused simple syrup', false),
    ('caffe-corretto', 0, NULL, NULL, 'Espresso', 'one shot', false),
    ('caffe-corretto', 1, NULL, NULL, 'Grappa', 'a few drops, or sambuca or brandy', false),
    ('caipiroska', 0, 2, 'oz', 'Vodka', NULL, false),
    ('caipiroska', 1, 0.5, 'each', 'Lime', 'cut into wedges', false),
    ('caipiroska', 2, 1, 'tsp', 'Brown Sugar', NULL, false),
    ('caipiroska', 3, 1, 'tsp', 'Demerara Sugar', 'raw or turbinado', false),
    ('campari-spritz', 0, 2, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('campari-spritz', 1, 4, 'oz', 'Prosecco', NULL, false),
    ('campari-spritz', 2, 1, 'oz', 'Soda Water', NULL, false),
    ('carajillo', 0, 2, 'oz', 'Liqueur', 'Licor 43', false),
    ('carajillo', 1, 1, 'oz', 'Espresso', 'freshly pulled', false),
    ('coquito', 0, 8, 'oz', 'White Rum', '1 cup, plus more to serve', false),
    ('coquito', 1, 8, 'oz', 'Coconut Water', '1 cup', false),
    ('coquito', 2, 15, 'oz', 'Cream of Coconut', 'one can', false),
    ('coquito', 3, 15, 'oz', 'Condensed Milk', 'sweetened, one can', false),
    ('coquito', 4, 15, 'oz', 'Evaporated Milk', 'one can', false),
    ('coquito', 5, 2, 'each', 'Cinnamon', 'sticks', false),
    ('coquito', 6, 0.75, 'tsp', 'Nutmeg', 'ground', false),
    ('cosmonaut', 0, 2, 'oz', 'London Dry Gin', NULL, false),
    ('cosmonaut', 1, 0.75, 'oz', 'Lemon Juice', NULL, false),
    ('cosmonaut', 2, 3, 'bsp', 'Raspberry Jam', NULL, false),
    ('dark-n-stormy', 0, 60, 'ml', 'Dark Rum', 'Gosling''s Black Seal', false),
    ('dark-n-stormy', 1, 100, 'ml', 'Ginger Beer', NULL, false),
    ('garibaldi', 0, 1.5, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('garibaldi', 1, 0.5, 'tsp', 'Rich Simple Syrup', '2:1', false),
    ('garibaldi', 2, 4, 'oz', 'Orange Juice', 'freshly squeezed, blended until fluffy', false),
    ('hot-toddy', 0, 1.5, 'oz', 'Whiskey', 'bourbon or rye, or another dark spirit', false),
    ('hot-toddy', 1, 0.75, 'oz', 'Honey', 'or maple syrup', false),
    ('hot-toddy', 2, 4, 'oz', 'Water', 'hot, 4 to 5 oz', false),
    ('kir-royale', 0, 0.25, 'oz', 'Crème de Cassis', NULL, false),
    ('kir-royale', 1, NULL, 'top', 'Champagne', NULL, false),
    ('mezcal-margarita', 0, 2, 'oz', 'Mezcal', 'Vida', false),
    ('mezcal-margarita', 1, 1, 'oz', 'Triple Sec', 'Cointreau', false),
    ('mezcal-margarita', 2, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('midori-sour', 0, 2, 'oz', 'Melon Liqueur', 'Midori', false),
    ('midori-sour', 1, 1, 'oz', 'Vodka', NULL, false),
    ('midori-sour', 2, 0.5, 'oz', 'Lemon Juice', NULL, false),
    ('midori-sour', 3, 0.5, 'oz', 'Lime Juice', NULL, false),
    ('midori-sour', 4, NULL, 'top', 'Soda Water', NULL, false),
    ('negroski', 0, 1, 'oz', 'Bitter Aperitivo', 'Campari', false),
    ('negroski', 1, 1, 'oz', 'Vodka', 'Sobieski', false),
    ('negroski', 2, 1, 'oz', 'Sweet Vermouth', NULL, false),
    ('perfect-manhattan', 0, 2, 'oz', 'Rye Whiskey', 'or bourbon', false),
    ('perfect-manhattan', 1, 0.5, 'oz', 'Sweet Vermouth', NULL, false),
    ('perfect-manhattan', 2, 0.5, 'oz', 'Dry Vermouth', NULL, false),
    ('perfect-manhattan', 3, 2, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('reverse-martini', 0, NULL, NULL, 'Dry Vermouth', '5 parts, extra dry', false),
    ('reverse-martini', 1, NULL, NULL, 'Gin', '1 part', false),
    ('rossini', 0, 1, 'oz', 'Strawberry Purée', NULL, false),
    ('rossini', 1, 3, 'oz', 'Prosecco', NULL, false),
    ('royal-fizz', 0, 50, 'ml', 'Gin', NULL, false),
    ('royal-fizz', 1, 30, 'ml', 'Lemon Juice', NULL, false),
    ('royal-fizz', 2, 10, 'ml', 'Simple Syrup', NULL, false),
    ('royal-fizz', 3, 1, 'each', 'Egg', 'whole', false),
    ('royal-fizz', 4, NULL, 'top', 'Soda Water', NULL, false),
    ('rum-old-fashioned', 0, 1.67, 'oz', 'Aged Rum', 'Caribbean blend, 6 to 10 years', false),
    ('rum-old-fashioned', 1, 0.33, 'oz', 'Overproof Rum', 'unaged Jamaican', false),
    ('rum-old-fashioned', 2, 0.25, 'oz', 'Falernum', NULL, false),
    ('rum-old-fashioned', 3, 0.5, 'tsp', 'Rich Simple Syrup', '2:1', false),
    ('rum-old-fashioned', 4, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('rum-punch', 0, NULL, NULL, 'Lime Juice', '1 measure', false),
    ('rum-punch', 1, NULL, NULL, 'Simple Syrup', '2 measures', false),
    ('rum-punch', 2, NULL, NULL, 'Dark Rum', '3 measures, aged Caribbean', false),
    ('rum-punch', 3, NULL, NULL, 'Water', '4 measures', false),
    ('rum-punch', 4, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('rum-punch', 5, NULL, NULL, 'Nutmeg', 'freshly grated', false),
    ('sgroppino', 0, 3, 'oz', 'Lemon Sorbet', NULL, false),
    ('sgroppino', 1, 2, 'oz', 'Prosecco', NULL, false),
    ('sgroppino', 2, 0.5, 'oz', 'Vodka', 'chilled', false),
    ('spicy-margarita', 0, 1, 'slice', 'Chilli', 'red, jalapeño or fresno, deseeded', false),
    ('spicy-margarita', 1, 3, 'sprig', 'Cilantro', NULL, true),
    ('spicy-margarita', 2, 1.5, 'oz', 'Blanco Tequila', NULL, false),
    ('spicy-margarita', 3, 0.75, 'oz', 'Triple Sec', 'Cointreau', false),
    ('spicy-margarita', 4, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('spicy-margarita', 5, 1, 'tsp', 'Agave Syrup', NULL, false),
    ('spicy-margarita', 6, 2, 'drop', 'Saline Solution', NULL, true),
    ('business', 0, 2, 'oz', 'London Dry Gin', NULL, false),
    ('business', 1, 1, 'oz', 'Lime Juice', NULL, false),
    ('business', 2, 0.67, 'oz', 'Rich Honey Syrup', '3 honey to 1 water', false),
    ('tia-mia', 0, 1, 'oz', 'Mezcal', 'Del Maguey Vida', false),
    ('tia-mia', 1, 1, 'oz', 'Jamaican Rum', 'Appleton Estate Reserve', false),
    ('tia-mia', 2, 0.5, 'oz', 'Orgeat', 'toasted almond', false),
    ('tia-mia', 3, 0.5, 'oz', 'Curaçao', 'dry, Pierre Ferrand', false),
    ('tia-mia', 4, 0.75, 'oz', 'Lime Juice', NULL, false),
    ('undead-gentleman', 0, 1.5, 'oz', 'Jamaican Rum', 'aged Appleton', false),
    ('undead-gentleman', 1, 1, 'oz', 'Overproof Rum', 'demerara, Lemon Hart 151', false),
    ('undead-gentleman', 2, 0.5, 'oz', 'Grapefruit Juice', NULL, false),
    ('undead-gentleman', 3, 0.5, 'oz', 'Lime Juice', NULL, false),
    ('undead-gentleman', 4, 0.5, 'oz', 'Cinnamon Syrup', NULL, false),
    ('undead-gentleman', 5, 0.5, 'oz', 'Falernum', NULL, false),
    ('undead-gentleman', 6, 1, 'dash', 'Aromatic Bitters', 'Angostura', false),
    ('undead-gentleman', 7, NULL, NULL, 'Absinthe', 'blanc, to rinse the glass', false);

CREATE TEMP TABLE "ft_ing" AS SELECT DISTINCT "ingredient" AS "name", public.ingredient_key("ingredient") AS "key", NULL::uuid AS "item_id" FROM "ft_lines";
UPDATE "ft_ing" n SET "item_id" = (
    SELECT i.id FROM "public"."items" i
    WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND public.ingredient_key(i.name) = n.key
    ORDER BY i.is_core DESC, i.created_at LIMIT 1);
UPDATE "ft_ing" n SET "item_id" = a.item_id FROM "public"."ingredient_aliases" a WHERE n.item_id IS NULL AND a.key = n.key;
INSERT INTO "public"."items" ("name", "item_type", "hide_from_search")
SELECT DISTINCT ON (n.key) n.name, 'ingredient', true FROM "ft_ing" n WHERE n.item_id IS NULL AND n.key IS NOT NULL ORDER BY n.key, n.name;
UPDATE "ft_ing" n SET "item_id" = (
    SELECT i.id FROM "public"."items" i
    WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND public.ingredient_key(i.name) = n.key
    ORDER BY i.is_core DESC, i.created_at LIMIT 1)
WHERE n.item_id IS NULL;

INSERT INTO "public"."recipes" ("recipe_item_id", "ingredient_item_id", "amount", "unit", "preparation_notes", "is_optional", "sort_order")
SELECT f.item_id, n.item_id, l.amount, l.unit, l.prep, l.optional, l.pos
FROM "ft_lines" l
JOIN "ft_drinks" f ON f.key = l.key
JOIN "ft_ing" n ON n.name = l.ingredient AND n.item_id IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM "public"."recipes" r WHERE r.recipe_item_id = f.item_id);

-- --- 4. Credits ---

UPDATE "public"."items" i SET
    "creator_profile_id" = coalesce(i.creator_profile_id, cp.id),
    "origin_bar_profile_id" = coalesce(i.origin_bar_profile_id, bp.id)
FROM "ft_drinks" f
LEFT JOIN "public"."profiles" cp ON cp.handle = f.creator AND cp.kind = 'person'
LEFT JOIN "public"."profiles" bp ON bp.handle = f.bar AND bp.kind = 'bar'
WHERE i.id = f.item_id AND (cp.id IS NOT NULL OR bp.id IS NOT NULL)
  AND (i.creator_profile_id IS NULL OR i.origin_bar_profile_id IS NULL);

INSERT INTO "public"."item_co_creators" ("item_id", "profile_id")
SELECT f.item_id, p.id
FROM "ft_drinks" f
CROSS JOIN LATERAL unnest(f.co) AS c(handle)
JOIN "public"."profiles" p ON p.handle = c.handle AND p.kind = 'person'
JOIN "public"."items" i ON i.id = f.item_id
WHERE p.id IS DISTINCT FROM i.creator_profile_id
ON CONFLICT DO NOTHING;

-- --- 5. Sources ---

INSERT INTO "public"."sources" ("key", "kind", "title", "rights", "url")
SELECT v.key, 'web', v.title, 'facts_only', v.url
FROM (VALUES
    ('web-5ea84559a8a4', 'Wikipedia: Rompope', 'https://en.wikipedia.org/wiki/Rompope'),
    ('web-bef23f5fc749', 'Wikipedia: Milk Punch', 'https://en.wikipedia.org/wiki/Milk_punch'),
    ('web-1f973e8f3223', 'Wikipedia: Negus', 'https://en.wikipedia.org/wiki/Negus_(drink)'),
    ('web-1e69f50ce109', 'Wikipedia: Fish House Punch', 'https://en.wikipedia.org/wiki/Fish_House_Punch'),
    ('web-279715b5b035', 'spiritsanddistilling.com: Sangaree', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-407'),
    ('web-ac9ed4299b42', 'Wikipedia: Grog', 'https://en.wikipedia.org/wiki/Grog'),
    ('web-1da80b319eb9', 'Wikipedia: Gin Sling', 'https://en.wikipedia.org/wiki/Gin_sling'),
    ('web-ff4d279ca07f', 'Wikipedia: Mint Julep', 'https://en.wikipedia.org/wiki/Mint_julep'),
    ('web-bf5c28bca359', 'Wikipedia: Tom and Jerry', 'https://en.wikipedia.org/wiki/Tom_and_Jerry_(drink)'),
    ('web-c2ecb8c94701', 'Difford''s Guide: El Draque', 'https://www.diffordsguide.com/g/1228/mojito-cocktail/mojito-cocktail-history'),
    ('web-e66321949dac', 'Wikipedia: Sherry Cobbler', 'https://en.wikipedia.org/wiki/Cobbler_(drink)'),
    ('web-759142fc1c8e', 'Imbibe: Brandy Smash', 'https://imbibemagazine.com/?p=11809'),
    ('web-36caff62aeac', 'Wikipedia: Chatham Artillery Punch', 'https://en.wikipedia.org/wiki/Chatham_Artillery_Punch'),
    ('web-2792b851b7df', 'Wikipedia: Pink Gin', 'https://en.wikipedia.org/wiki/Pink_gin'),
    ('web-f9e291b6561d', 'spiritsanddistilling.com: Caipirinha', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-275'),
    ('web-32c97cf8acb9', 'library.cocktailkingdom.com: Prescription Julep', 'https://library.cocktailkingdom.com/exh.essential-drinks.julep.html'),
    ('web-8fa0137a982d', 'classbarmag.com: Milano Torino', 'https://classbarmag.com/news/fullstory.php/aid/2150/Classic_cocktails:_the_tale_of_the_Milano_Torino.html'),
    ('web-a37c25cb177a', 'Wikipedia: Black Velvet', 'https://en.wikipedia.org/wiki/Black_Velvet_(cocktail)'),
    ('web-9d1b726002bf', 'blogs.loc.gov: Baltimore Egg Nogg', 'https://blogs.loc.gov/loc/2024/12/lift-a-glass-to-holiday-drinks-gone-by/'),
    ('web-ac714abd6d5a', 'Wikipedia: Blue Blazer', 'https://en.wikipedia.org/wiki/Jerry_Thomas_(bartender)'),
    ('web-6e508d452c5e', 'library.cocktailkingdom.com: Brandy Cocktail', 'https://library.cocktailkingdom.com/exh.essential-drinks.improved_cocktail.html'),
    ('web-a9a8eeb5bb32', 'Wikipedia: Brandy Crusta', 'https://en.wikipedia.org/wiki/Brandy_Crusta'),
    ('web-dc07cfca26bf', 'Wikipedia: Brandy Flip', 'https://en.wikipedia.org/wiki/Flip_(cocktail)'),
    ('web-125395160ba4', 'library.cocktailkingdom.com: Brandy Milk Punch', 'https://library.cocktailkingdom.com/exh.essential-drinks.milk_punch.html'),
    ('web-52f4b7e51a29', 'Difford''s Guide: Brandy Sour', 'https://www.diffordsguide.com/g/1133/sour-cocktails/history'),
    ('web-900258632267', 'Difford''s Guide: General Harrison''s Egg Nogg', 'https://www.diffordsguide.com/en-au/cocktails/recipe/3280/general-harrisons-nogg'),
    ('web-5ba84025e0e3', 'forgottencocktails.com: Georgia Mint Julep', 'https://www.forgottencocktails.com/the-georgia-mint-julep'),
    ('web-669ac79fe872', 'library.cocktailkingdom.com: Hot Apple Toddy', 'https://library.cocktailkingdom.com/exh.essential-drinks.hot_spiced_rum.html'),
    ('web-d4cddd1ef12c', 'spiritsanddistilling.com: Hot Buttered Rum', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-340'),
    ('web-4cd489988235', 'Difford''s Guide: Japanese Cocktail', 'https://www.diffordsguide.com/cocktails/search?s=japanese+cocktail'),
    ('web-76163c582ef2', 'library.cocktailkingdom.com: Pousse Café', 'https://library.cocktailkingdom.com/exh.figures.santini_joe.html'),
    ('web-138ab782471a', 'thefoodhistorian.com: Stone Fence', 'https://www.thefoodhistorian.com/blog/food-history-happy-hour-episode-22-stone-fence-cocktail-19th-century'),
    ('web-6ac4ccc8288d', 'Wikipedia: Whiskey Cocktail', 'https://en.wikipedia.org/wiki/Old_fashioned_(cocktail)'),
    ('web-23ec8e10912e', 'archive.org: Whiskey Skin', 'https://archive.org/download/bartendersguide01thom/bartendersguide01thom_djvu.txt'),
    ('web-8bc142be5d1f', 'Wikipedia: Whiskey Sour', 'https://en.wikipedia.org/wiki/Whiskey_sour'),
    ('web-67f7bf3f8e95', 'Punch: Canchánchara', 'https://punchdrink.com/articles/original-cuban-cocktail-canchanchara-recipe/'),
    ('web-bffcca09fd8d', 'Wikipedia: Gin and Tonic', 'https://en.wikipedia.org/wiki/Gin_and_tonic'),
    ('web-9514f2a8f4a8', 'Wikipedia: John Collins', 'https://en.wikipedia.org/wiki/John_Collins_(cocktail)'),
    ('web-e48c142012f0', 'Wikipedia: Pharisäer', 'https://en.wikipedia.org/wiki/Nordstrand,_Germany'),
    ('web-39d99f21b178', 'spiritsanddistilling.com: Absinthe Frappe', 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-212'),
    ('web-df7bc3262d2c', 'Wikipedia: Brandy Daisy', 'https://en.wikipedia.org/wiki/Daisy_(cocktail)'),
    ('web-11eec4e36389', 'Wikipedia: Gin Fizz', 'https://en.wikipedia.org/wiki/Gin_fizz'),
    ('web-8334f9feb1cb', 'Wikipedia: Tom Collins', 'https://en.wikipedia.org/wiki/Tom_Collins'),
    ('web-e22be8fc2088', 'copenhagendistillery.com: Manhattan', 'https://www.copenhagendistillery.com/articles/the-history-of-the-manhattan'),
    ('web-d0e930cca907', 'vinepair.com: Morning Glory Fizz', 'https://vinepair.com/cocktail-recipe/morning-glory-fizz'),
    ('web-d550686c81cb', 'spiritsanddistilling.com: Pompier', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-439'),
    ('web-daec277ca240', 'Wikipedia: Joe Rickey', 'https://en.wikipedia.org/wiki/Rickey_(cocktail)'),
    ('web-78437ebaf65f', 'barrypopik.com: New York Sour', 'https://barrypopik.com/blog/new_york_sour'),
    ('web-d87beec133b6', 'Wikipedia: Adonis', 'https://en.wikipedia.org/wiki/Adonis_(cocktail)'),
    ('web-d989117b5d54', 'bar-vademecum.eu: Martinez', 'https://bar-vademecum.eu/the-martini-cocktail-part-4-the-martinez-cocktail/'),
    ('web-bb0aeb80df5e', 'Wikipedia: Rock and Rye', 'https://en.wikipedia.org/wiki/Rock_and_rye'),
    ('web-feda4fc4e656', 'Wikipedia: Americano', 'https://en.wikipedia.org/wiki/Americano_(cocktail)'),
    ('web-173a30a9df9a', 'Difford''s Guide: Bamboo', 'https://www.diffordsguide.com/cocktails/recipe/18976/bamboo-diffords-classic-recipe'),
    ('web-85e84d094343', 'cold-glass.com: Saratoga', 'https://cold-glass.com/2010/09/30/saratoga-cocktail/'),
    ('web-782fd54682c8', 'Wikipedia: Martini', 'https://en.wikipedia.org/wiki/Martini_(cocktail)'),
    ('web-67dd474342b9', 'Difford''s Guide: Ramos Gin Fizz', 'https://www.diffordsguide.com/encyclopedia/2890/people/henry-c-ramos'),
    ('web-8c01015b30a3', 'Difford''s Guide: Fourth Regiment', 'https://www.diffordsguide.com/cocktails/recipe/11200/fourth-regiment'),
    ('web-c6025bcb443c', 'frenchquarter.com: Café Brûlot', 'https://www.frenchquarter.com/tradition-cafe-brulot/'),
    ('web-04f7d1b42ba4', 'Wikipedia: Sazerac', 'https://en.wikipedia.org/wiki/Sazerac'),
    ('web-9ddd40ee11cb', 'Wikipedia: Stinger', 'https://en.wikipedia.org/wiki/Stinger_(cocktail)'),
    ('web-46be82822b91', 'Wikipedia: Pisco Punch', 'https://en.wikipedia.org/wiki/Pisco_punch'),
    ('web-5fb27e8accd1', 'Wikipedia: Rob Roy', 'https://en.wikipedia.org/wiki/Rob_Roy_(cocktail)'),
    ('web-8fd4e86c27b0', 'vinepair.com: Whisky Highball', 'https://vinepair.com/articles/the-history-of-the-highball-soda-cocktail'),
    ('web-d3eeb7be9ab1', 'cold-glass.com: Harvard', 'https://cold-glass.com/2012/12/19/the-harvard-cocktail/'),
    ('web-ecfb655d149e', 'Wikipedia: Horse''s Neck', 'https://en.wikipedia.org/wiki/Horse%27s_neck'),
    ('web-daf174895159', 'Difford''s Guide: Liberal', 'https://www.diffordsguide.com/cocktails/recipe/13420/liberal'),
    ('web-e115437e7766', 'cold-glass.com: Metropole', 'https://cold-glass.com/2011/11/16/the-metropole-cocktail/'),
    ('web-eac75fb9a3a2', 'Wikipedia: Daiquiri', 'https://en.wikipedia.org/wiki/Daiquiri'),
    ('web-2157419e122c', 'spiritsanddistilling.com: Gibson', 'https://spiritsanddistilling.com/dictionary/id/acref-9780199311132-e-323'),
    ('web-7fe617a8b449', 'Difford''s Guide: Marguerite', 'https://www.diffordsguide.com/encyclopedia/1083/cocktails/martini-cocktail-and-its-evolution'),
    ('web-0cf1d8828c2a', 'barrypopik.com: Mamie Taylor', 'https://barrypopik.com/blog/mamie_taylor_cocktail'),
    ('web-9b5fbf17793f', 'Wikipedia: Bijou', 'https://en.wikipedia.org/wiki/Bijou_(cocktail)'),
    ('web-ec1ac58f8d93', 'Wikipedia: Bronx', 'https://en.wikipedia.org/wiki/Bronx_(cocktail)'),
    ('web-060f3bf42ed6', 'Wikipedia: Cuba Libre', 'https://en.wikipedia.org/wiki/Rum_and_Coke'),
    ('web-c117972b83cf', 'Wikipedia: Diamond Fizz', 'https://en.wikipedia.org/wiki/Fizz_(cocktail)'),
    ('web-4d35c7839c8c', 'Wikipedia: Green Swizzle', 'https://en.wikipedia.org/wiki/Green_Swizzle'),
    ('web-af72ae44a239', 'Wikipedia: Ponche Crema', 'https://en.wikipedia.org/wiki/Ponche_crema'),
    ('web-c10834e93d31', 'Punch: Puritan', 'https://punchdrink.com/articles/puritan-chartreuse-martini-alaska-cocktail-recipe/'),
    ('web-6b633c4a3ec4', 'vinepair.com: Sloe Gin Fizz', 'https://vinepair.com/cocktail-recipe/sloe-gin-fizz'),
    ('web-83b9c6844465', 'tuxedono2.com: Turf', 'https://tuxedono2.com/turf-cocktail-recipe'),
    ('web-bdcb5cefe25f', 'Wikipedia: Tuxedo', 'https://en.wikipedia.org/wiki/Tuxedo_(cocktail)'),
    ('web-827d93cff514', 'Wikipedia: Clover Club', 'https://en.wikipedia.org/wiki/Clover_Club_cocktail'),
    ('web-a1764a290eb9', 'vinepair.com: Dirty Martini', 'https://vinepair.com/articles/history-martini-olives-superstition'),
    ('web-49e0611909ca', 'spiritsanddistilling.com: Perfect Martini', 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-1394'),
    ('web-af93bb1b5705', 'Punch: Coronation', 'https://punchdrink.com/recipes/coronation-no-1/'),
    ('web-066351f1e4a3', 'bar-vademecum.eu: Gin Buck', 'https://bar-vademecum.eu/gin-buck/'),
    ('web-b0f626d849f5', 'spiritsanddistilling.com: Kir', 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-351'),
    ('web-00b882c6e070', 'Wikipedia: Jack Rose', 'https://en.wikipedia.org/wiki/Jack_Rose_(cocktail)'),
    ('web-f56801d57f26', 'Wikipedia: Ward 8', 'https://en.wikipedia.org/wiki/Ward_8_(cocktail)'),
    ('web-9fc6c63ee2a2', 'Difford''s Guide: Affinity', 'https://www.diffordsguide.com/en-au/cocktails/recipe/19/affinity'),
    ('web-134c66fc9577', 'robertsimonson.substack.com: Brooklyn', 'https://robertsimonson.substack.com/p/a-brief-history-of-brooklyn-cocktails'),
    ('web-b82171b44fe5', 'vinepair.com: Casino', 'https://vinepair.com/cocktail-recipe/the-casino'),
    ('web-eaae5cf888ee', 'spiritsanddistilling.com: Pimm''s Cup', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-381'),
    ('web-f1194affcd0a', 'cold-glass.com: Alaska', 'https://cold-glass.com/2023/03/19/a-martini-with-something-in-it-the-alaska-cocktail/'),
    ('web-0725838119de', 'Difford''s Guide: Bobby Burns', 'https://www.diffordsguide.com/encyclopedia/1075/cocktails/bobby-burns'),
    ('web-42e67786a1f1', 'Wikipedia: Pink Lady', 'https://en.wikipedia.org/wiki/Pink_lady_(cocktail)'),
    ('web-0a07b40579a0', 'tastingtable.com: Southside', 'https://www.tastingtable.com/1562873/history-southside-cocktail/'),
    ('web-dd7f42de9505', 'Wikipedia: Bacardi Cocktail', 'https://en.wikipedia.org/wiki/Bacardi_cocktail'),
    ('web-a23b9ecaeb5e', 'vinepair.com: Emerald', 'https://vinepair.com/cocktail-recipe/the-emerald/'),
    ('web-91765fa17a91', 'wallpaper.com: Campari Soda', 'https://www.wallpaper.com/architecture/campari-soda-bottle-design-history'),
    ('web-cd0576fc8bee', 'Wikipedia: El Presidente', 'https://en.wikipedia.org/wiki/El_Presidente_(cocktail)'),
    ('web-468230599a55', 'Wikipedia: Singapore Sling', 'https://en.wikipedia.org/wiki/Singapore_sling'),
    ('web-c20d1f5d47f8', 'spiritsanddistilling.com: Alexander', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-234'),
    ('web-f6491de060fb', 'Wikipedia: Aviation', 'https://en.wikipedia.org/wiki/Aviation_(cocktail)'),
    ('web-3c99c8f5ba0d', 'Wikipedia: Chrysanthemum', 'https://en.wikipedia.org/wiki/Chrysanthemum_(cocktail)'),
    ('web-6d56e4183601', 'cold-glass.com: Creole', 'https://cold-glass.com/2017/12/01/the-creole-cocktail-four-ways/'),
    ('web-84a1ecd93b8d', 'Wikipedia: Last Word', 'https://en.wikipedia.org/wiki/Last_Word_(cocktail)'),
    ('web-f5fe9577082a', 'Wikipedia: Pisco Sour', 'https://en.wikipedia.org/wiki/Pisco_sour'),
    ('web-d7f17a31f194', 'cigaraficionado.com: Tipperary', 'https://www.cigaraficionado.com/article/the-tipperary-cocktail-for-st-patrick-s-day'),
    ('web-370f1e222260', 'Wikipedia: Grasshopper', 'https://en.wikipedia.org/wiki/Grasshopper_(cocktail)'),
    ('web-5ac59f1dc45e', 'wsetglobal.com: Negroni', 'https://www.wsetglobal.com/knowledge-centre/blog/2025/the-disputed-regional-roots-of-the-negroni'),
    ('web-83ea8a580247', 'Wikipedia: White Lady', 'https://en.wikipedia.org/wiki/White_Lady_(cocktail)'),
    ('web-dddd34afa4af', 'Wikipedia: Select Spritz', 'https://en.wikipedia.org/wiki/Select_(ap%C3%A9ritif)'),
    ('web-95fc39a77706', 'Wikipedia: Tinto de Verano', 'https://en.wikipedia.org/wiki/Tinto_de_verano'),
    ('web-1307d7842f91', 'Wikipedia: Buck''s Fizz', 'https://en.wikipedia.org/wiki/Buck%27s_fizz'),
    ('web-511594ca9b45', 'archive.org: Cameron''s Kick', 'https://archive.org/download/savoycocktailboo0000vari/savoycocktailboo0000vari_djvu.txt'),
    ('web-209b6fd7be99', 'Kindred Cocktails: Gimlet', 'https://kindredcocktails.com/review/gimlet'),
    ('web-e1ee305c75bd', 'Wikipedia: Sidecar', 'https://en.wikipedia.org/wiki/Sidecar_(cocktail)'),
    ('web-e99190120740', 'Wikipedia: Toronto', 'https://en.wikipedia.org/wiki/Toronto_(cocktail)'),
    ('web-a8b9df1a6c51', 'Wikipedia: Monkey Gland', 'https://en.wikipedia.org/wiki/Monkey_Gland'),
    ('web-717cf4835bba', 'Wikipedia: Pegu Club', 'https://en.wikipedia.org/wiki/Pegu_Club_(cocktail)'),
    ('web-87483c579411', 'australianbartender.com.au: Scofflaw', 'https://australianbartender.com.au/2010/01/31/the-scofflaw-cocktail/'),
    ('web-f0dff48701c3', 'Difford''s Guide: Champs-Élysées', 'https://www.diffordsguide.com/cocktails/recipe/396/champs-elysees'),
    ('web-0e40c9a0eadf', 'Wikipedia: Hanky Panky', 'https://en.wikipedia.org/wiki/Hanky_panky_(cocktail)'),
    ('web-04f1db587cf4', 'spiritsanddistilling.com: Mimosa', 'https://spiritsanddistilling.com/dictionary/id/acref-9780199311132-e-365'),
    ('web-bbc2b8a8f2b5', 'alcoholinfusions.com: Barbary Coast', 'https://alcoholinfusions.com/?p=1731'),
    ('web-f5320197e3da', 'Wikipedia: Boulevardier', 'https://en.wikipedia.org/wiki/Boulevardier_(cocktail)'),
    ('web-a3c976819df1', 'Wikipedia: French 75', 'https://en.wikipedia.org/wiki/French_75_(cocktail)'),
    ('web-faf95196b1ff', 'cold-glass.com: Old Pal', 'https://cold-glass.com/2013/03/05/the-mystery-of-the-old-pal-cocktail/'),
    ('web-27d2efe61d66', 'Wikipedia: Bee''s Knees', 'https://en.wikipedia.org/wiki/Bee%27s_knees'),
    ('web-7c57355f36df', 'cold-glass.com: Lucien Gaudin', 'https://cold-glass.com/2014/12/05/the-lucien-gaudin-cocktail/'),
    ('web-6433f3a31ec3', 'library.cocktailkingdom.com: Mojito', 'https://library.cocktailkingdom.com/exh.essential-drinks.mojito.html'),
    ('web-058b5b82fd0d', 'Punch: Army and Navy', 'https://punchdrink.com/recipes/army-navy/'),
    ('web-a17c8261fd7e', 'Wikipedia: Between the Sheets', 'https://en.wikipedia.org/wiki/Between_the_sheets_(cocktail)'),
    ('web-d4e7df836a60', 'Wikipedia: Blood and Sand', 'https://en.wikipedia.org/wiki/Blood_and_Sand_(cocktail)'),
    ('web-d719a84662df', 'pastemagazine.com: Brandy Alexander', 'https://www.pastemagazine.com/drink/happy-hour-history-the-brandy-alexander'),
    ('web-6c99e0be2bab', 'Wikipedia: Corpse Reviver #1', 'https://en.wikipedia.org/wiki/Corpse_Reviver'),
    ('web-adb574ed27ab', 'vinepair.com: Fifty-Fifty', 'https://vinepair.com/cocktail-recipe/50-50-martini/'),
    ('web-9493c6c317af', 'Difford''s Guide: Hotel Nacional Special', 'https://www.diffordsguide.com/cocktails/recipe/1383/hotel-nacional'),
    ('web-5e7b671b554a', 'Kindred Cocktails: Maiden''s Prayer', 'https://kindredcocktails.com/cocktail/maidens-prayer'),
    ('web-9312b90c59d7', 'Difford''s Guide: Palmetto', 'https://www.diffordsguide.com/cocktails/recipe/3298/palmetto-cocktail'),
    ('web-3ed37478c0ec', 'spiritsandcocktails.community: Corn ''n'' Oil', 'https://spiritsandcocktails.community/t/corn-n-oil-and-falernum/1019'),
    ('web-388848640a29', 'spiritsanddistilling.com: Rum Collins', 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-435'),
    ('web-aaed18387bef', 'smithsonianmag.com: Rum Swizzle', 'https://www.smithsonianmag.com/travel/story-behind-bermudas-rum-swizzle-cocktail-180971701/'),
    ('web-cf8fbc699931', 'spiritsanddistilling.com: Brown Derby', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-271'),
    ('web-101e159c7ad6', 'Kindred Cocktails: Presbyterian', 'https://kindredcocktails.com/cocktail/presbyterian'),
    ('web-4685e7bfb92a', 'Punch: Blinker', 'https://punchdrink.com/articles/blinker-cocktail-rye-whiskey/'),
    ('web-3fc461854df2', 'Difford''s Guide: Daiquiri No. 3', 'https://www.diffordsguide.com/cocktails/recipe/2367/daiquiri-no-3'),
    ('web-bfdaac1f94a8', 'pbs.org: Floridita Daiquiri', 'https://www.pbs.org/food/stories/ernest-hemingway'),
    ('web-6edd1916abcb', 'Wikipedia: Zombie', 'https://en.wikipedia.org/wiki/Zombie_(cocktail)'),
    ('web-d76b62e7e5a7', 'Wikipedia: Death in the Afternoon', 'https://en.wikipedia.org/wiki/Death_in_the_Afternoon_(cocktail)'),
    ('web-b0ddf0b2e757', 'spiritsanddistilling.com: Queen''s Park Swizzle', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-394'),
    ('web-5921245ce71e', 'vinepair.com: Vodka Martini', 'https://vinepair.com/articles/kangaroo-kicker-cocktail-history/'),
    ('web-fc9a5542f627', 'Difford''s Guide: Gin and It', 'https://www.diffordsguide.com/cocktails/recipe/833/gin-and-it'),
    ('web-a10999a0fd44', 'barrypopik.com: Tequila Daisy', 'https://barrypopik.com/blog/tequila_daisy'),
    ('web-8df4dde637dd', 'Wikipedia: B&B', 'https://en.wikipedia.org/wiki/B%C3%A9n%C3%A9dictine'),
    ('web-caba36d111b2', 'Difford''s Guide: Chancellor', 'https://www.diffordsguide.com/cocktails/recipe/577/chancellor'),
    ('web-2b456f773d4c', 'Wikipedia: Cobra''s Fang', 'https://en.wikipedia.org/wiki/Cobra%27s_fang'),
    ('web-6dcd5f19d079', 'gumbopages.com: De La Louisiane', 'https://gumbopages.com/food/beverages/cocktail-louisiane.html'),
    ('web-65dfd7d1d183', 'wnyc.org: Hemingway Daiquiri', 'https://wnyc.org/story/the-cocktail-king-of-cuba-the-man-who-invented-hemingways-favorite-daiquiri/'),
    ('web-1a1ae053330d', 'Punch: Lion''s Tail', 'https://punchdrink.com/articles/resurgence-lions-tail-prohibition-cocktail-recipe/'),
    ('web-295c8b7a3d6c', 'vinepair.com: Missionary''s Downfall', 'https://vinepair.com/cocktail-recipe/missionarys-downfall/'),
    ('web-ea0092774a14', 'thereviewmag.co.uk: Mizuwari', 'https://www.thereviewmag.co.uk/suntory-whisky/'),
    ('web-413488243387', 'Kindred Cocktails: Nui Nui', 'https://kindredcocktails.com/cocktail/nui-nui'),
    ('web-120a4dd5d5b1', 'beachbumberry.com: Pearl Diver', 'https://beachbumberry.com/recipe-pearldiver.html'),
    ('web-1aedf87de182', 'thenibble.com: Picador', 'https://thenibble.com/REVIEWS/MAIN/cocktails/margarita-recipe.asp'),
    ('web-dca34db53756', 'Wikipedia: Q.B. Cooler', 'https://en.wikipedia.org/wiki/Q.B._Cooler'),
    ('web-8f96645038a3', 'pastemagazine.com: Rusty Nail', 'https://www.pastemagazine.com/drink/happy-hour-history-the-rusty-nail'),
    ('web-667cbaa83843', 'Kindred Cocktails: Scorpion', 'https://kindredcocktails.com/cocktail/scorpion'),
    ('web-04429b96b68b', 'boothby.com.au: Toreador', 'https://boothby.com.au/toreador-cocktail-tequila-apricot-brandy'),
    ('web-f60e8700951c', 'Wikipedia: Twentieth Century', 'https://en.wikipedia.org/wiki/20th_century_(cocktail)'),
    ('web-88e3f029d3fd', 'bar-vademecum.eu: Vieux Carré', 'https://bar-vademecum.eu/vieux-carre/'),
    ('web-ac6e0eb7f60d', 'Wikipedia: Bloody Mary', 'https://en.wikipedia.org/wiki/Bloody_Mary_(cocktail)'),
    ('web-2664b8e0dbee', 'vinepair.com: Daisy de Santiago', 'https://vinepair.com/cocktail-recipe/daisy-de-santiago/'),
    ('web-8b68fb480b33', 'Wikipedia: Remember the Maine', 'https://en.wikipedia.org/wiki/Remember_the_Maine_(cocktail)'),
    ('web-f3853822d8a2', 'spiritsanddistilling.com: Fog Cutter', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-316'),
    ('web-14a7bfbcb1c3', 'Wikipedia: Hurricane', 'https://en.wikipedia.org/wiki/Hurricane_(cocktail)'),
    ('web-65e4ac4da72a', 'spiritsanddistilling.com: Mulata Daiquiri', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-372'),
    ('web-a997f40c0c25', 'Wikipedia: Navy Grog', 'https://en.wikipedia.org/wiki/Navy_Grog'),
    ('web-4a0833d04a68', 'Wikipedia: Air Mail', 'https://en.wikipedia.org/wiki/Airmail_(cocktail)'),
    ('web-94ae71d9e290', 'Punch: Fancy Free', 'https://punchdrink.com/articles/bring-back-the-fancy-free/'),
    ('web-a627b2cff2e6', 'Wikipedia: Moscow Mule', 'https://en.wikipedia.org/wiki/Moscow_mule'),
    ('web-a290399ae307', 'Difford''s Guide: Red Snapper', 'https://www.diffordsguide.com/encyclopedia/496/cocktails/the-history-of-the-bloody-mary'),
    ('web-cacc321a2a37', 'cold-glass.com: Royal Bermuda Yacht Club', 'https://cold-glass.com/2015/05/23/the-royal-bermuda-yacht-club-cocktail/'),
    ('web-a9a193047ad4', 'vinepair.com: Test Pilot', 'https://vinepair.com/cocktail-recipe/test-pilot/'),
    ('web-fae45f6877a1', 'alcoholprofessor.com: Suffering Bastard', 'https://alcoholprofessor.com/blog/2017/09/12/classic-cocktails-in-history-suffering-bastard'),
    ('web-777671cb5ebc', 'vinepair.com: Three Dots and a Dash', 'https://vinepair.com/cocktail-college/three-dots-and-a-dash/'),
    ('web-c4e940b38304', '7x7.com: Irish Coffee', 'https://www.7x7.com/drink-up-sf-history-how-irish-coffee-came-to-america-1787160730.html'),
    ('web-819c94e1d37c', 'spiritsanddistilling.com: Batida', 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-246'),
    ('web-8b97a06ef8d7', 'Wikipedia: Mai Tai', 'https://en.wikipedia.org/wiki/Mai_Tai'),
    ('web-3a89b4b7d2be', 'Wikipedia: Cape Codder', 'https://en.wikipedia.org/wiki/Cape_Codder_(cocktail)'),
    ('web-217ddb5562fd', 'Wikipedia: Greyhound', 'https://en.wikipedia.org/wiki/Greyhound_(cocktail)'),
    ('web-6a97c4d645fc', 'Wikipedia: Pink Squirrel', 'https://en.wikipedia.org/wiki/Pink_Squirrel'),
    ('web-e0dd32daab70', 'wuwm.com: Wisconsin Brandy Old Fashioned', 'https://www.wuwm.com/post/real-story-behind-why-wisconsinites-drink-brandy-old-fashioneds'),
    ('web-f62693007e1c', 'Kindred Cocktails: Brooklynite', 'https://kindredcocktails.com/cocktail/brooklynite'),
    ('web-3606fdbde825', 'Alcademics: El Diablo', 'https://alcademics.com/'),
    ('web-49b939b85933', 'eataly.com: Bellini', 'https://www.eataly.com/us_en/magazine/culture-and-tradition/history-bellini-cocktail'),
    ('web-8499e57e303e', 'Difford''s Guide: Honeysuckle', 'https://www.diffordsguide.com/cocktails/recipe/970/honeysuckle-daiquiri'),
    ('web-75523d5857a0', 'Kindred Cocktails: Monte Carlo', 'https://kindredcocktails.com/cocktail/monte-carlo'),
    ('web-a07c21d26bf3', 'Kindred Cocktails: Royal Hawaiian', 'https://kindredcocktails.com/cocktail/royal-hawaiian'),
    ('web-3245a134f807', 'britishfoodhistory.com: Snowball', 'https://britishfoodhistory.com/2019/12/24/the-snowball/'),
    ('web-4e96faa4c485', 'barrypopik.com: Black Russian', 'https://barrypopik.com/blog/black_russian_cocktail'),
    ('web-57982bed540b', 'Wikipedia: Screwdriver', 'https://en.wikipedia.org/wiki/Screwdriver_(cocktail)'),
    ('web-c7999c19f699', 'vinepair.com: Aperol Spritz', 'https://vinepair.com/articles/history-aperol-spritz/'),
    ('web-e77a0c288737', 'vice.com: Cardinale', 'https://www.vice.com/it/article/cardinale-cocktail-storia/'),
    ('web-bbcc4c8ddc38', 'vinepair.com: Vodka Gimlet', 'https://vinepair.com/cocktail-recipe/vodka-gimlet/'),
    ('web-e57744b8af7e', 'vinepair.com: Bull Shot', 'https://vinepair.com/articles/bullshot-cocktail-origin-story/'),
    ('web-2b3040ecbc25', 'Alcademics: Golden Cadillac', 'https://alcademics.com/?p=3383'),
    ('web-1b6de85027e7', 'Wikipedia: Japanese Highball', 'https://en.wikipedia.org/wiki/Highball'),
    ('web-b37181a76bf2', 'Wikipedia: Vesper', 'https://en.wikipedia.org/wiki/Vesper_(cocktail)'),
    ('web-f98e80233304', 'Difford''s Guide: Piña Colada', 'https://www.diffordsguide.com/encyclopedia/2014-07-08/469/cocktails/pina-colada-cocktail'),
    ('web-f0cd6172a739', 'Wikipedia: Blue Hawaii', 'https://en.wikipedia.org/wiki/Blue_Hawaii_(cocktail)'),
    ('web-2590e3069367', 'de.wikipedia.org: Rüdesheimer Kaffee', 'https://de.wikipedia.org/wiki/R%C3%BCdesheimer_Kaffee'),
    ('web-012492c6141a', 'cold-glass.com: Jet Pilot', 'https://cold-glass.com/2016/06/05/classic-tiki-the-jet-pilot/'),
    ('web-cba9852f4ad8', 'Wikipedia: Agua de Valencia', 'https://en.wikipedia.org/wiki/Agua_de_Valencia'),
    ('web-a0f2ccc7bc12', 'campariacademy.com: Campari Shakerato', 'https://campariacademy.com/en-us/inspiration/trends/the-shakerato'),
    ('web-7c402c104194', 'Wikipedia: Golden Dream', 'https://en.wikipedia.org/wiki/Golden_dream_(cocktail)'),
    ('web-f1d02638f183', 'Wikipedia: Michelada', 'https://en.wikipedia.org/wiki/Michelada'),
    ('web-5f72e4735707', 'gardenandgun.com: Batanga', 'https://gardenandgun.com/recipe/the-ultimate-tequila-cocktail-from-tequila-mexico'),
    ('web-033f0ccf3879', 'Kindred Cocktails: Port Light', 'https://kindredcocktails.com/cocktail/port-light'),
    ('web-5c8e061643c2', 'Wikipedia: White Russian', 'https://en.wikipedia.org/wiki/White_Russian_(cocktail)'),
    ('web-975042d50333', 'Kindred Cocktails: Saturn', 'https://kindredcocktails.com/cocktail/saturn'),
    ('web-4fefaa8fa48e', 'Wikipedia: Caesar', 'https://en.wikipedia.org/wiki/Caesar_(cocktail)'),
    ('web-954183c1616b', 'culinarylore.com: Harvey Wallbanger', 'https://culinarylore.com/drinks:was-the-harvey-wallbanger-named-after-a-real-guy'),
    ('web-b8bdc8b23977', 'Wikipedia: Lemon Drop', 'https://en.wikipedia.org/wiki/Lemon_drop_(cocktail)'),
    ('web-75cc74c74d3e', 'barrypopik.com: Bloody Maria', 'https://barrypopik.com/blog/bloody_maria_cocktail'),
    ('web-05ed4221ea4e', 'smithsonianmag.com: Frozen Margarita', 'https://www.smithsonianmag.com/smithsonian-institution/uniquely-texas-origins-frozen-margarita-180969339/'),
    ('web-92cab24259e9', 'spiritsanddistilling.com: Painkiller', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-378'),
    ('web-852a3ead8c80', 'Wikipedia: Bombardino', 'https://en.wikipedia.org/wiki/Bombardino'),
    ('web-0a2e86137eb6', 'Wikipedia: Kalimotxo', 'https://en.wikipedia.org/wiki/Kalimotxo'),
    ('web-dd3560035f65', 'Wikipedia: Long Island Iced Tea', 'https://en.wikipedia.org/wiki/Long_Island_iced_tea'),
    ('web-5390509d74fe', 'boothby.com.au: Sbagliato', 'https://boothby.com.au/negroni-sbagliato'),
    ('web-97d7e66bdd4e', 'Wikipedia: Tequila Sunrise', 'https://en.wikipedia.org/wiki/Tequila_sunrise'),
    ('web-e19dfc151170', 'Wikipedia: Jungle Bird', 'https://en.wikipedia.org/wiki/Jungle_Bird'),
    ('web-02fc76d815bb', 'Wikipedia: Amaretto Sour', 'https://en.wikipedia.org/wiki/Amaretto_sour'),
    ('web-f18568467ae1', 'vinepair.com: Rosita', 'https://vinepair.com/cocktail-recipe/rosita/'),
    ('web-11e84072b01e', 'Wikipedia: Bushwacker', 'https://en.wikipedia.org/wiki/Bushwacker_(cocktail)'),
    ('web-ccd62b7c1d6c', 'tastingtable.com: Mudslide', 'https://www.tastingtable.com/1218496/the-1970s-ingredient-swap-that-created-the-mudslide-cocktail'),
    ('web-609618b957bc', 'wweek.com: Spanish Coffee', 'https://www.wweek.com/restaurants/2016/12/20/hubers-historic-spanish-coffee-is-an-institution-but-not-as-old-as-you-might-think/'),
    ('web-5216413f8bab', 'Wikipedia: French Connection', 'https://en.wikipedia.org/wiki/Godfather_(cocktail)'),
    ('web-f1435f15ed3e', 'amp.firstwefeast.com: Kamikaze', 'https://amp.firstwefeast.com/drink/2014/04/david-wondrich-history-of-shots'),
    ('web-78ae593dbce3', 'traveldistilled.com: B-52', 'https://www.traveldistilled.com/history-of-the-b-52-cocktail/'),
    ('web-6aa248a686f5', 'Difford''s Guide: Brave Bull', 'https://www.diffordsguide.com/cocktails/recipe/23029/brave-bull'),
    ('web-07c196dfd5a7', 'Punch: Cadillac Margarita', 'https://punchdrink.com/articles/not-a-margarita-its-grand-marnier-patron-cadillac-margarita/'),
    ('web-28b750de39c2', 'Wikipedia: Fernet con Coca', 'https://en.wikipedia.org/wiki/Fernet_con_coca'),
    ('web-20c025ade47d', 'barrypopik.com: Sea Breeze', 'https://barrypopik.com/blog/sea_breeze_cocktail'),
    ('web-a6aa252a239b', 'spiritsanddistilling.com: Espresso Martini', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-307'),
    ('web-035ec94db23c', 'Wikipedia: Bramble', 'https://en.wikipedia.org/wiki/Bramble_(cocktail)'),
    ('web-6417aa6b8e40', 'Wikipedia: Japanese Slipper', 'https://en.wikipedia.org/wiki/Japanese_slipper'),
    ('web-e306983b3c24', 'Punch: Dukes Martini', 'https://punchdrink.com/articles/frozen-freezer-martini-history/'),
    ('web-a5054408f419', 'Wikipedia: Cosmopolitan', 'https://en.wikipedia.org/wiki/Cosmopolitan_(cocktail)'),
    ('web-05c35ae6e4c2', 'vinepair.com: Tommy''s Margarita', 'https://vinepair.com/cocktail-recipe/the-tommys-margarita/'),
    ('web-5406546b87d9', 'Kindred Cocktails: Whiskey Smash', 'https://kindredcocktails.com/cocktail/whiskey-smash'),
    ('web-ae18dec1535c', 'Kindred Cocktails: Fitzgerald', 'https://kindredcocktails.com/cocktail/fitzgerald'),
    ('web-42fd54be2e21', 'Punch: Jasmine', 'https://punchdrink.com/recipes/jasmine/'),
    ('web-3ef5b85e80c3', 'Punch: Spumoni', 'https://punchdrink.com/articles/big-in-japan-spumoni-aperitivo-cocktail-recipe/'),
    ('web-07e1ee41787d', 'Punch: Lychee Martini', 'https://punchdrink.com/articles/lychee-vodka-martini-cocktail-so-1993-nyc/'),
    ('web-a21d5996dbee', 'cold-glass.com: Ancient Mariner', 'https://cold-glass.com/2013/04/02/rum-fruit-and-spice-the-ancient-mariner/'),
    ('web-b527ea4ba7fc', 'malaymail.com: Seelbach', 'https://www.malaymail.com/news/eat-drink/2016/11/02/that-historic-cocktail-turns-out-its-a-fake/1241039'),
    ('web-742eb12326ad', 'Wikipedia: Appletini', 'https://en.wikipedia.org/wiki/Appletini'),
    ('web-d15988c71d68', 'Wikipedia: Breakfast Martini', 'https://en.wikipedia.org/wiki/Breakfast_martini'),
    ('web-bcf209a1b4bb', 'vinepair.com: Cable Car', 'https://vinepair.com/cocktail-recipe/cable-car/'),
    ('web-08ba30111f35', 'Difford''s Guide: Quill', 'https://www.diffordsguide.com/cocktails/recipe/5064/quill'),
    ('web-64095cdde4ed', 'expansion.mx: Carajillo 43', 'https://expansion.mx/empresas/2019/06/18/el-carajillo-multiplica-las-ventas-de-licor-43'),
    ('web-caf782c04f94', 'Wikipedia: Ranch Water', 'https://en.wikipedia.org/wiki/Ranch_water'),
    ('web-9bfc65d2ddda', 'spiritsanddistilling.com: Treacle', 'https://www.spiritsanddistilling.com/dictionary/acref-9780199311132-e-437'),
    ('web-3a9ac8aff136', 'spiritsanddistilling.com: Paloma', 'https://spiritsanddistilling.com/dictionary/acref-9780199311132-e-379'),
    ('web-f792ff278edc', 'vinepair.com: Gin Gin Mule', 'https://vinepair.com/cocktail-recipe/gin-gin-mule-recipe'),
    ('web-0493acf26087', 'vinepair.com: Gold Rush', 'https://vinepair.com/cocktail-recipe/the-gold-rush-recipe/'),
    ('web-353757bc67d9', 'Punch: Spanish Gin Tonic', 'https://punchdrink.com/articles/balloon-glass-copa-de-balon-gin-tonic-cocktail/'),
    ('web-a642eef5f175', 'Punch: Trident', 'https://punchdrink.com/recipes/trident/'),
    ('web-84b64b09806c', 'vinepair.com: Bourbon Renewal', 'https://vinepair.com/cocktail-recipe/bourbon-renewal/'),
    ('web-b8722658d940', 'vinepair.com: Enzoni', 'https://vinepair.com/cocktail-recipe/enzoni/'),
    ('web-424f589947b8', 'classbarmag.com: Old Cuban', 'https://classbarmag.com/news/fullstory.php/aid/1257/Modern_classics:_The_Old_Cuban.html'),
    ('web-0d903615d906', 'Punch: White Negroni', 'https://punchdrink.com/articles/white-negroni-became-modern-classic-suze-cocktail-recipe/'),
    ('web-0c8e0c1fcffc', 'Wikipedia: Porn Star Martini', 'https://en.wikipedia.org/wiki/Pornstar_martini'),
    ('web-ca1a2502015e', 'Wikipedia: Chartreuse Swizzle', 'https://en.wikipedia.org/wiki/Chartreuse_swizzle'),
    ('web-1dd05018cad8', 'cold-glass.com: 1794', 'https://cold-glass.com/2010/09/15/1794-cocktail-the-boulevardier-comes-to-manhattan/'),
    ('web-438fdab0beec', 'vinepair.com: Eastside', 'https://vinepair.com/cocktail-recipe/eastside/'),
    ('web-7311d72b6cda', 'barrypopik.com: Red Hook', 'https://barrypopik.com/blog/red_hook_cocktail'),
    ('web-670a31a7ead6', 'vinepair.com: Revolver', 'https://vinepair.com/cocktail-recipe/revolver/'),
    ('web-a738fe1b8117', 'Kindred Cocktails: Black Manhattan', 'https://kindredcocktails.com/cocktail/black-manhattan'),
    ('web-b590418fa4d9', 'Kindred Cocktails: Chet Baker', 'https://kindredcocktails.com/cocktail/chet-baker'),
    ('web-48ce725b777f', 'Difford''s Guide: Chocolate Negroni', 'https://www.diffordsguide.com/cocktails/recipe/5852/chocolate-negroni'),
    ('web-fca345606a45', 'Punch: Earl Grey MarTEAni', 'https://punchdrink.com/recipes/earl-grey-marteani/'),
    ('web-47736481fd42', 'robertsimonson.substack.com: Fitty-Fitty', 'https://robertsimonson.substack.com/p/audrey-saunders-talks-gin'),
    ('web-03277bba3706', 'classbarmag.com: Hugo', 'https://classbarmag.com/news/fullstory.php/aid/2056/Neo_classic:_the_story_behind_the_Hugo.html'),
    ('web-a030fd1030c6', 'Difford''s Guide: Kentucky Maid', 'https://www.diffordsguide.com/cocktails/recipe/14930/kentucky-maid'),
    ('web-1c2432638f4a', 'vinepair.com: Little Italy', 'https://vinepair.com/cocktail-recipe/little-italy/'),
    ('web-7090088a9137', 'Wikipedia: Penicillin', 'https://en.wikipedia.org/wiki/Penicillin_(cocktail)'),
    ('web-814a9554fadd', 'Punch: Bensonhurst', 'https://punchdrink.com/recipes/bensonhurst/'),
    ('web-d1b5f37c38c1', 'drinkboston.com: Contessa', 'https://drinkboston.com/2006/08/31/try-a-little-bitterness-no-9-park/'),
    ('web-b8edfbb015a0', 'bar-vademecum.eu: Greenpoint', 'https://bar-vademecum.eu/greenpoint/'),
    ('web-cc1a2071d038', 'Punch: Siesta', 'https://punchdrink.com/recipes/siesta/'),
    ('web-8c7fb90c9f57', 'Punch: Benton''s Old Fashioned', 'https://punchdrink.com/articles/this-is-how-fat-washing-happened-pdt-speakeasy-bar-nyc/'),
    ('web-1dcdf6a059e7', 'deathandcompanymarket.com: Elder Fashion', 'https://www.deathandcompanymarket.com/blogs/recipes/elder-fashion'),
    ('web-1b4d5b37a674', 'Kindred Cocktails: Juliet and Romeo', 'https://kindredcocktails.com/cocktail/juliet-romeo'),
    ('web-ebd4a0697c8e', 'vinepair.com: Left Hand', 'https://vinepair.com/cocktail-recipe/left-hand/'),
    ('web-c0b7f69d7696', 'Punch: Oaxaca Old Fashioned', 'https://punchdrink.com/articles/oaxaca-old-fashioned-became-modern-classic-mezcal-cocktail-recipe/'),
    ('web-2917eef317a8', 'bar-vademecum.eu: Rapscallion', 'https://bar-vademecum.eu/rapscallion/'),
    ('web-8a1a16691da8', 'Kindred Cocktails: Right Hand', 'https://kindredcocktails.com/cocktail/right-hand'),
    ('web-b61d4c0046dd', 'cold-glass.com: Agavoni', 'https://cold-glass.com/2012/05/24/tequila-and-mezcal-messing-with-the-negroni/'),
    ('web-299f01ad23ab', 'vinepair.com: Art of Choke', 'https://vinepair.com/cocktail-recipe/art-of-choke/'),
    ('web-bc0412877cfe', 'Difford''s Guide: Carroll Gardens', 'https://www.diffordsguide.com/encyclopedia/138/cocktails/brooklyn-recipes-and-riffs-named-after-neighbourhoods'),
    ('web-f569a1a24a0d', 'deathandcompanymarket.com: Conference', 'https://www.deathandcompanymarket.com/blogs/recipes/conference'),
    ('web-ddbf530264c5', 'Wikipedia: Gin Basil Smash', 'https://en.wikipedia.org/wiki/Gin_basil_smash'),
    ('web-233e56521e2a', 'classbarmag.com: Mulata Daisy', 'https://classbarmag.com/news/fullstory.php/aid/1684/Modern_classics:_Mulata_Daisy_.html'),
    ('web-53d6e90c7941', 'Wikipedia: Paper Plane', 'https://en.wikipedia.org/wiki/Paper_plane_(cocktail)'),
    ('web-b336d8149528', 'Punch: Trinidad Sour', 'https://punchdrink.com/recipes/trinidad-sour/'),
    ('web-87eea6d261c4', 'bevinfogroup.com: Barrel-Aged Negroni', 'https://bevinfogroup.com/2011/07/18/trends-aged-to-perfection/'),
    ('web-73b24e93f43a', 'Kindred Cocktails: Bitter Giuseppe', 'https://kindredcocktails.com/cocktail/bitter-giuseppe'),
    ('web-3d08781c0667', 'Punch: Division Bell', 'https://punchdrink.com/recipes/division-bell/'),
    ('web-fc7fb0f66e84', 'saveur.com: Kentucky Buck', 'https://www.saveur.com/article/recipes/kentucky-buck-cocktail'),
    ('web-3dbc2e376ba1', 'vinepair.com: Kingston Negroni', 'https://vinepair.com/cocktail-recipe/kingston-negroni/'),
    ('web-6599e0e6ac9c', 'Punch: Mezcal Negroni', 'https://punchdrink.com/articles/mezcal-negronis-world-cocktail-recipe/'),
    ('web-ec070a5a3de7', 'Punch: Slope', 'https://punchdrink.com/recipes/the-slope/'),
    ('web-0cbb98f4c6fe', 'Difford''s Guide: Death in Venice', 'https://www.diffordsguide.com/cocktails/recipe/2923/death-in-venice'),
    ('web-4e5d6d56155f', 'Difford''s Guide: Monte Cassino', 'https://www.diffordsguide.com/cocktails/recipe/2994/monte-cassino'),
    ('web-99c4a163c4b9', 'Kindred Cocktails: Haitian Divorce', 'https://kindredcocktails.com/cocktail/haitian-divorce'),
    ('web-73b454ac3c60', 'Kindred Cocktails: Industry Sour', 'https://kindredcocktails.com/cocktail/industry-sour'),
    ('web-8c9a572d1e82', 'Wikipedia: Naked and Famous', 'https://en.wikipedia.org/wiki/Naked_and_famous_(cocktail)'),
    ('web-e6f180d8f2a8', 'Punch: Sharpie Mustache', 'https://punchdrink.com/recipes/sharpie-mustache/'),
    ('web-bd77a9490b8d', 'Kindred Cocktails: Unusual Negroni', 'https://kindredcocktails.com/cocktail/unusual-negroni'),
    ('web-e102d3e84ab4', 'sohohouse.com: Picante de la Casa', 'https://www.sohohouse.com/en-us/house-notes/issue-006/food-and-drink/ever-wondered-where-our-picante-came-from'),
    ('web-bbfda61de478', 'vinepair.com: Piña Verde', 'https://vinepair.com/cocktail-college/pina-verde/'),
    ('web-4bc60b93904c', 'vinepair.com: Dead Rabbit Irish Coffee', 'https://vinepair.com/cocktail-recipe/dead-rabbit-irish-coffee-recipe'),
    ('web-918bc7aa137b', 'dnainfo.com: Frozen Negroni', 'https://www.dnainfo.com/new-york/20130904/fort-greene/chicagos-negroni-slushy-craze-makes-its-way-brooklyn/'),
    ('web-01f852b24b2f', 'Punch: Lost Lake', 'https://punchdrink.com/recipes/lost-lake/'),
    ('web-82ed33a7c9f5', 'Difford''s Guide: Last of the Oaxacans', 'https://www.diffordsguide.com/cocktails/recipe/9733/last-of-the-oaxacans'),
    ('web-7fb113627794', 'vinepair.com: Negroni Bianco', 'https://vinepair.com/articles/how-a-luxardo-family-recipe-sparked-the-bianco-negroni'),
    ('web-8fba78bf54e0', 'Punch: Basil Gimlet', 'https://punchdrink.com/recipes/basil-gimlet/'),
    ('web-53cd491f74bb', 'Punch: Bitter Mai Tai', 'https://punchdrink.com/recipes/bitter-mai-tai/'),
    ('web-688458194177', 'Wikipedia: Caffè Corretto', 'https://en.wikipedia.org/wiki/Caff%C3%A8_corretto'),
    ('web-724365d5c4c5', 'Wikipedia: Caipiroska', 'https://en.wikipedia.org/wiki/Caipiroska'),
    ('web-bb8b307883af', 'en.ilsole24ore.com: Campari Spritz', 'https://en.ilsole24ore.com/art/storia-spritz-e-sue-varianti-amari-secolari--AB4s0ykB'),
    ('web-1602735f01ce', 'Wikipedia: Carajillo', 'https://en.wikipedia.org/wiki/Carajillo'),
    ('web-0749fd83c166', 'en.wikipedia.com: Coquito', 'https://en.wikipedia.com/wiki/Coquito'),
    ('web-dde7db5ddc0e', 'cocktailsdistilled.com: Cosmonaut', 'https://cocktailsdistilled.com/recipe/cosmonaut/'),
    ('web-f4febf78e335', 'Wikipedia: Dark ''n Stormy', 'https://en.wikipedia.org/wiki/Dark_%27n%27_stormy'),
    ('web-c6490b578043', 'Punch: Garibaldi', 'https://punchdrink.com/articles/dante-nyc-garibaldi-campari-cocktail-fever/'),
    ('web-77bb0aab2dee', 'Wikipedia: Hot Toddy', 'https://en.wikipedia.org/wiki/Hot_toddy'),
    ('web-2299af220286', 'Wikipedia: Kir Royale', 'https://en.wikipedia.org/wiki/Kir_(cocktail)'),
    ('web-b20f18d908e2', 'Punch: Mezcal Margarita', 'https://punchdrink.com/recipes/mayahuel-mezcal-margarita/'),
    ('web-4dfba5a8e7ad', 'tastingtable.com: Midori Sour', 'https://tastingtable.com/1226050/how-the-midori-sour-cocktail-defined-the-1980s'),
    ('web-ab6bea183172', 'scattidigusto.it: Negroski', 'https://www.scattidigusto.it/negroni-ricetta-varianti-cocktail-italiano-famoso-mondo'),
    ('web-7b1859f8f552', 'Difford''s Guide: Perfect Manhattan', 'https://www.diffordsguide.com/g/1221/manhattan-cocktail/history'),
    ('web-831494a0ee3a', 'culinaryhistorians.org: Reverse Martini', 'https://culinaryhistorians.org/fdrs-reverse-martini/'),
    ('web-73fdb1d2e56c', 'Wikipedia: Rossini', 'https://en.wikipedia.org/wiki/Bellini_(cocktail)'),
    ('web-33fea7696b8e', 'charlestoncitypaper.com: Rum Punch', 'https://charlestoncitypaper.com/the-fruity-rum-drink-known-as-planters-punch-goes-way-back-in-time/'),
    ('web-98e63947a890', 'Wikipedia: Sgroppino', 'https://en.wikipedia.org/wiki/Sgroppino'),
    ('web-0ac46aaaa2d8', 'Punch: Spicy Margarita', 'https://punchdrink.com/articles/spicy-margarita-is-the-drink-of-our-times/'),
    ('web-789c88e64484', 'Difford''s Guide: The Business', 'https://www.diffordsguide.com/cocktails/recipe/3088/the-business'),
    ('web-17bbb4848f5d', 'Wikipedia: Ti'' Punch', 'https://en.wikipedia.org/wiki/Ti%27_Punch'),
    ('web-9844d9b92c13', 'Wikipedia: Tia Mia', 'https://en.wikipedia.org/wiki/Ivy_Mix'),
    ('web-ea8ffee4676b', 'Kindred Cocktails: Undead Gentleman', 'https://kindredcocktails.com/cocktail/undead-gentleman')
) AS v("key", "title", "url")
WHERE NOT EXISTS (SELECT 1 FROM "public"."sources" s WHERE s.key = v.key OR s.url = v.url);

INSERT INTO "public"."source_recipes" ("source_id", "item_id", "printed_name", "relation")
SELECT s.id, f.item_id, f.name, 'first_print'
FROM "ft_drinks" f
JOIN "public"."sources" s ON s.url = f.src
WHERE f.src IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "public"."source_recipes" r WHERE r.item_id = f.item_id);

-- --- 6. Bars' drinks of the same name become versions of the classic ---

CREATE TEMP TABLE "ft_names" ("lname" text PRIMARY KEY, "key" text NOT NULL);
INSERT INTO "ft_names" VALUES
    ('rompope', 'rompope'),
    ('mexican eggnog', 'rompope'),
    ('milk punch', 'milk-punch'),
    ('clarified milk punch', 'milk-punch'),
    ('english milk punch', 'milk-punch'),
    ('negus', 'negus'),
    ('fish house punch', 'fish-house-punch'),
    ('philadelphia fish house punch', 'fish-house-punch'),
    ('sangaree', 'sangaree'),
    ('port sangaree', 'sangaree'),
    ('sangree', 'sangaree'),
    ('grog', 'grog'),
    ('gin sling', 'gin-sling'),
    ('hot gin sling', 'gin-sling'),
    ('mint julep', 'mint-julep'),
    ('kentucky julep', 'mint-julep'),
    ('brandy julep', 'mint-julep'),
    ('whiskey julep', 'mint-julep'),
    ('tom and jerry', 'tom-and-jerry'),
    ('tom & jerry', 'tom-and-jerry'),
    ('el draque', 'draque'),
    ('draque', 'draque'),
    ('draquecito', 'draque'),
    ('sherry cobbler', 'sherry-cobbler'),
    ('brandy smash', 'brandy-smash'),
    ('smash', 'brandy-smash'),
    ('chatham artillery punch', 'chatham-artillery-punch'),
    ('pink gin', 'pink-gin'),
    ('gin and bitters', 'pink-gin'),
    ('caipirinha', 'caipirinha'),
    ('prescription julep', 'prescription-julep'),
    ('milano torino', 'milano-torino'),
    ('milano-torino', 'milano-torino'),
    ('mi-to', 'milano-torino'),
    ('torino-milano', 'milano-torino'),
    ('black velvet', 'black-velvet'),
    ('bismarck', 'black-velvet'),
    ('baltimore egg nogg', 'baltimore-egg-nogg'),
    ('baltimore eggnog', 'baltimore-egg-nogg'),
    ('blue blazer', 'blue-blazer'),
    ('brandy cocktail', 'brandy-cocktail'),
    ('brandy crusta', 'brandy-crusta'),
    ('crusta', 'brandy-crusta'),
    ('brandy flip', 'brandy-flip'),
    ('cold brandy flip', 'brandy-flip'),
    ('hot brandy flip', 'brandy-flip'),
    ('brandy milk punch', 'brandy-milk-punch'),
    ('new orleans milk punch', 'brandy-milk-punch'),
    ('brandy sour', 'brandy-sour'),
    ('fancy brandy cocktail', 'fancy-brandy-cocktail'),
    ('fancy whiskey cocktail', 'fancy-brandy-cocktail'),
    ('general harrison''s egg nogg', 'general-harrisons-egg-nogg'),
    ('general harrison''s nogg', 'general-harrisons-egg-nogg'),
    ('georgia mint julep', 'georgia-mint-julep'),
    ('real georgia mint julep', 'georgia-mint-julep'),
    ('gin cocktail', 'gin-cocktail'),
    ('holland gin cocktail', 'gin-cocktail'),
    ('gin flip', 'gin-flip'),
    ('cold gin flip', 'gin-flip'),
    ('gin sour', 'gin-sour'),
    ('hot apple toddy', 'hot-apple-toddy'),
    ('hot buttered rum', 'hot-buttered-rum'),
    ('hot spiced rum', 'hot-buttered-rum'),
    ('japanese cocktail', 'japanese-cocktail'),
    ('port wine flip', 'port-wine-flip'),
    ('port flip', 'port-wine-flip'),
    ('pousse café', 'pousse-cafe'),
    ('santina''s pousse café', 'pousse-cafe'),
    ('rum flip', 'rum-flip'),
    ('hot rum flip', 'rum-flip'),
    ('colonial flip', 'rum-flip'),
    ('rum sour', 'rum-sour'),
    ('santa cruz sour', 'rum-sour'),
    ('sherry flip', 'sherry-flip'),
    ('sherry wine flip', 'sherry-flip'),
    ('stone fence', 'stone-fence'),
    ('whiskey cocktail', 'whiskey-cocktail'),
    ('bourbon cocktail', 'whiskey-cocktail'),
    ('whiskey flip', 'whiskey-flip'),
    ('whisky flip', 'whiskey-flip'),
    ('whiskey skin', 'whiskey-skin'),
    ('scotch whiskey skin', 'whiskey-skin'),
    ('whiskey sour', 'whiskey-sour'),
    ('whisky sour', 'whiskey-sour'),
    ('bourbon sour', 'whiskey-sour'),
    ('canchánchara', 'canchanchara'),
    ('canchanchara', 'canchanchara'),
    ('gin and tonic', 'gin-and-tonic'),
    ('g&t', 'gin-and-tonic'),
    ('john collins', 'john-collins'),
    ('pharisäer', 'pharisaer'),
    ('pharisee', 'pharisaer'),
    ('absinthe frappe', 'absinthe-frappe'),
    ('brandy daisy', 'brandy-daisy'),
    ('gin daisy', 'gin-daisy'),
    ('gin fizz', 'gin-fizz'),
    ('gin fiz', 'gin-fizz'),
    ('improved brandy cocktail', 'improved-brandy-cocktail'),
    ('improved gin cocktail', 'improved-gin-cocktail'),
    ('improved holland gin cocktail', 'improved-gin-cocktail'),
    ('improved whiskey cocktail', 'improved-whiskey-cocktail'),
    ('tom collins', 'tom-collins'),
    ('whiskey daisy', 'whiskey-daisy'),
    ('old fashioned', 'old-fashioned'),
    ('old-fashioned whiskey cocktail', 'old-fashioned'),
    ('golden fizz', 'golden-fizz'),
    ('manhattan', 'manhattan'),
    ('manhattan cocktail', 'manhattan'),
    ('morning glory fizz', 'morning-glory-fizz'),
    ('pompier', 'pompier'),
    ('vermouth cassis', 'pompier'),
    ('vermouth-cassis', 'pompier'),
    ('silver fizz', 'silver-fizz'),
    ('gin silver fizz', 'silver-fizz'),
    ('joe rickey', 'joe-rickey'),
    ('bourbon rickey', 'joe-rickey'),
    ('rickey', 'joe-rickey'),
    ('new york sour', 'new-york-sour'),
    ('continental sour', 'new-york-sour'),
    ('southern whiskey sour', 'new-york-sour'),
    ('brunswick sour', 'new-york-sour'),
    ('claret snap', 'new-york-sour'),
    ('adonis', 'adonis'),
    ('martinez', 'martinez'),
    ('martinez cocktail', 'martinez'),
    ('rock and rye', 'rock-and-rye'),
    ('americano', 'americano'),
    ('bamboo', 'bamboo'),
    ('bamboo cocktail', 'bamboo'),
    ('coffee cocktail', 'coffee-cocktail'),
    ('saratoga', 'saratoga'),
    ('saratoga cocktail', 'saratoga'),
    ('martini', 'martini'),
    ('dry martini', 'martini'),
    ('gin martini', 'martini'),
    ('classic martini', 'martini'),
    ('house martini', 'martini'),
    ('olive martini', 'martini'),
    ('ramos gin fizz', 'ramos-gin-fizz'),
    ('new orleans fizz', 'ramos-gin-fizz'),
    ('fourth regiment', 'fourth-regiment'),
    ('café brûlot', 'cafe-brulot'),
    ('café brûlot diabolique', 'cafe-brulot'),
    ('sazerac', 'sazerac'),
    ('stinger', 'stinger'),
    ('the judge', 'stinger'),
    ('pisco punch', 'pisco-punch'),
    ('rob roy', 'rob-roy'),
    ('scotch manhattan', 'rob-roy'),
    ('whisky highball', 'whisky-highball'),
    ('scotch and soda', 'whisky-highball'),
    ('scotch highball', 'whisky-highball'),
    ('gin rickey', 'gin-rickey'),
    ('harvard', 'harvard'),
    ('harvard cocktail', 'harvard'),
    ('horse''s neck', 'horses-neck'),
    ('horse''s neck with a kick', 'horses-neck'),
    ('liberal', 'liberal'),
    ('metropole', 'metropole'),
    ('daiquiri', 'daiquiri'),
    ('gibson', 'gibson'),
    ('marguerite', 'marguerite'),
    ('marguerite cocktail', 'marguerite'),
    ('mamie taylor', 'mamie-taylor'),
    ('mamie taylor highball', 'mamie-taylor'),
    ('bijou', 'bijou'),
    ('bijou cocktail', 'bijou'),
    ('bronx', 'bronx'),
    ('bronx cocktail', 'bronx'),
    ('cuba libre', 'cuba-libre'),
    ('rum and coke', 'cuba-libre'),
    ('diamond fizz', 'diamond-fizz'),
    ('royal gin fizz (champagne)', 'diamond-fizz'),
    ('green swizzle', 'green-swizzle'),
    ('ponche crema', 'ponche-crema'),
    ('puritan', 'puritan'),
    ('sloe gin fizz', 'sloe-gin-fizz'),
    ('turf', 'turf'),
    ('turf cocktail', 'turf'),
    ('tuxedo', 'tuxedo'),
    ('tuxedo no. 2', 'tuxedo'),
    ('tuxedo cocktail', 'tuxedo'),
    ('clover club', 'clover-club'),
    ('dirty martini', 'dirty-martini'),
    ('filthy martini', 'dirty-martini'),
    ('perfect martini', 'perfect-martini'),
    ('coronation', 'coronation'),
    ('coronation no. 1', 'coronation'),
    ('coronation cocktail', 'coronation'),
    ('gin buck', 'gin-buck'),
    ('kir', 'kir'),
    ('blanc-cassis', 'kir'),
    ('jack rose', 'jack-rose'),
    ('royal smile', 'jack-rose'),
    ('ward 8', 'ward-8'),
    ('ward eight', 'ward-8'),
    ('affinity', 'affinity'),
    ('brooklyn', 'brooklyn'),
    ('brooklyn cocktail', 'brooklyn'),
    ('casino', 'casino'),
    ('casino cocktail', 'casino'),
    ('pimm''s cup', 'pimms-cup'),
    ('pimm''s no. 1 cup', 'pimms-cup'),
    ('alaska', 'alaska'),
    ('alaska cocktail', 'alaska'),
    ('bobby burns', 'bobby-burns'),
    ('robert burns', 'bobby-burns'),
    ('pink lady', 'pink-lady'),
    ('pink shimmy', 'pink-lady'),
    ('southside', 'southside'),
    ('south side', 'southside'),
    ('bacardi cocktail', 'bacardi-cocktail'),
    ('emerald', 'emerald'),
    ('irish manhattan', 'emerald'),
    ('rory o''more', 'emerald'),
    ('campari soda', 'campari-soda'),
    ('campari seltz', 'campari-soda'),
    ('campari and soda', 'campari-soda'),
    ('el presidente', 'el-presidente'),
    ('presidente', 'el-presidente'),
    ('singapore sling', 'singapore-sling'),
    ('straits sling', 'singapore-sling'),
    ('alexander', 'alexander'),
    ('gin alexander', 'alexander'),
    ('aviation', 'aviation'),
    ('chrysanthemum', 'chrysanthemum'),
    ('creole', 'creole'),
    ('creole cocktail', 'creole'),
    ('last word', 'last-word'),
    ('the last word', 'last-word'),
    ('pisco sour', 'pisco-sour'),
    ('tipperary', 'tipperary'),
    ('grasshopper', 'grasshopper'),
    ('negroni', 'negroni'),
    ('white lady', 'white-lady'),
    ('chelsea sidecar', 'white-lady'),
    ('delilah', 'white-lady'),
    ('select spritz', 'select-spritz'),
    ('spritz veneziano', 'select-spritz'),
    ('venetian spritz', 'select-spritz'),
    ('tinto de verano', 'tinto-de-verano'),
    ('un vargas', 'tinto-de-verano'),
    ('buck''s fizz', 'bucks-fizz'),
    ('cameron''s kick', 'camerons-kick'),
    ('gimlet', 'gimlet'),
    ('gin gimlet', 'gimlet'),
    ('sidecar', 'sidecar'),
    ('side-car', 'sidecar'),
    ('toronto', 'toronto'),
    ('fernet cocktail', 'toronto'),
    ('monkey gland', 'monkey-gland'),
    ('pegu club', 'pegu-club'),
    ('scofflaw', 'scofflaw'),
    ('champs-élysées', 'champs-elysees'),
    ('champs elysees', 'champs-elysees'),
    ('hanky panky', 'hanky-panky'),
    ('mimosa', 'mimosa'),
    ('champagne orange', 'mimosa'),
    ('barbary coast', 'barbary-coast'),
    ('boulevardier', 'boulevardier'),
    ('bourbon negroni', 'boulevardier'),
    ('french 75', 'french-75'),
    ('soixante-quinze', 'french-75'),
    ('75', 'french-75'),
    ('old pal', 'old-pal'),
    ('my old pal', 'old-pal'),
    ('bee''s knees', 'bees-knees'),
    ('bees knees', 'bees-knees'),
    ('lucien gaudin', 'lucien-gaudin'),
    ('mojito', 'mojito'),
    ('mojo de ron', 'mojito'),
    ('army and navy', 'army-and-navy'),
    ('army & navy', 'army-and-navy'),
    ('between the sheets', 'between-the-sheets'),
    ('blood and sand', 'blood-and-sand'),
    ('brandy alexander', 'brandy-alexander'),
    ('alexander no. 2', 'brandy-alexander'),
    ('corpse reviver #1', 'corpse-reviver-1'),
    ('corpse reviver no. 1', 'corpse-reviver-1'),
    ('corpse reviver #2', 'corpse-reviver-2'),
    ('corpse reviver no. 2', 'corpse-reviver-2'),
    ('fifty-fifty', 'fifty-fifty'),
    ('50/50 martini', 'fifty-fifty'),
    ('wet martini', 'fifty-fifty'),
    ('half and half', 'fifty-fifty'),
    ('hotel nacional special', 'hotel-nacional'),
    ('hotel nacional', 'hotel-nacional'),
    ('maiden''s prayer', 'maidens-prayer'),
    ('palmetto', 'palmetto'),
    ('rum manhattan', 'palmetto'),
    ('rattlesnake', 'rattlesnake'),
    ('corn ''n'' oil', 'corn-n-oil'),
    ('corning oil', 'corn-n-oil'),
    ('rum collins', 'rum-collins'),
    ('ron collins', 'rum-collins'),
    ('rum swizzle', 'rum-swizzle'),
    ('bermuda rum swizzle', 'rum-swizzle'),
    ('brown derby', 'brown-derby'),
    ('de rigueur', 'brown-derby'),
    ('presbyterian', 'presbyterian'),
    ('press', 'presbyterian'),
    ('blinker', 'blinker'),
    ('daiquiri no. 3', 'daiquiri-no-3'),
    ('maidique style daiquiri', 'daiquiri-no-3'),
    ('floridita daiquiri', 'floridita-daiquiri'),
    ('daiquiri no. 4', 'floridita-daiquiri'),
    ('frozen daiquiri', 'floridita-daiquiri'),
    ('daiquiri floridita', 'floridita-daiquiri'),
    ('zombie', 'zombie'),
    ('zombie punch', 'zombie'),
    ('death in the afternoon', 'death-in-the-afternoon'),
    ('hemingway champagne', 'death-in-the-afternoon'),
    ('muddled fruit old fashioned', 'muddled-old-fashioned'),
    ('post-prohibition old fashioned', 'muddled-old-fashioned'),
    ('queen''s park swizzle', 'queens-park-swizzle'),
    ('queens park swizzle', 'queens-park-swizzle'),
    ('vodka martini', 'vodka-martini'),
    ('kangaroo', 'vodka-martini'),
    ('kangaroo kicker', 'vodka-martini'),
    ('vodkatini', 'vodka-martini'),
    ('gin and it', 'gin-and-it'),
    ('sweet martini', 'gin-and-it'),
    ('martini rosso', 'gin-and-it'),
    ('tequila daisy', 'tequila-daisy'),
    ('b&b', 'b-and-b'),
    ('b and b', 'b-and-b'),
    ('brandy and benedictine', 'b-and-b'),
    ('chancellor', 'chancellor'),
    ('cobra''s fang', 'cobras-fang'),
    ('de la louisiane', 'de-la-louisiane'),
    ('cocktail a la louisiane', 'de-la-louisiane'),
    ('la louisiane', 'de-la-louisiane'),
    ('hemingway daiquiri', 'hemingway-daiquiri'),
    ('papa doble', 'hemingway-daiquiri'),
    ('e. hemingway special', 'hemingway-daiquiri'),
    ('hemingway special', 'hemingway-daiquiri'),
    ('lion''s tail', 'lions-tail'),
    ('missionary''s downfall', 'missionarys-downfall'),
    ('mizuwari', 'mizuwari'),
    ('whisky and water', 'mizuwari'),
    ('nui nui', 'nui-nui'),
    ('pearl diver', 'pearl-diver'),
    ('pearl diver''s punch', 'pearl-diver'),
    ('picador', 'picador'),
    ('q.b. cooler', 'qb-cooler'),
    ('qb cooler', 'qb-cooler'),
    ('rusty nail', 'rusty-nail'),
    ('b.i.f.', 'rusty-nail'),
    ('little club no. 1', 'rusty-nail'),
    ('scorpion', 'scorpion'),
    ('scorpion bowl', 'scorpion'),
    ('toreador', 'toreador'),
    ('twentieth century', 'twentieth-century'),
    ('20th century', 'twentieth-century'),
    ('vieux carré', 'vieux-carre'),
    ('vieux carre', 'vieux-carre'),
    ('bloody mary', 'bloody-mary'),
    ('daisy de santiago', 'daisy-de-santiago'),
    ('remember the maine', 'remember-the-maine'),
    ('fog cutter', 'fog-cutter'),
    ('hurricane', 'hurricane'),
    ('mulata daiquiri', 'mulata-daiquiri'),
    ('mulata', 'mulata-daiquiri'),
    ('navy grog', 'navy-grog'),
    ('air mail', 'air-mail'),
    ('airmail', 'air-mail'),
    ('fancy free', 'fancy-free'),
    ('moscow mule', 'moscow-mule'),
    ('smirnoff mule', 'moscow-mule'),
    ('red snapper', 'red-snapper'),
    ('royal bermuda yacht club', 'royal-bermuda-yacht-club'),
    ('test pilot', 'test-pilot'),
    ('suffering bastard', 'suffering-bastard'),
    ('suffering bar-steward', 'suffering-bastard'),
    ('three dots and a dash', 'three-dots-and-a-dash'),
    ('irish coffee', 'irish-coffee'),
    ('buena vista irish coffee', 'irish-coffee'),
    ('batida', 'batida'),
    ('mai tai', 'mai-tai'),
    ('trader vic''s mai tai', 'mai-tai'),
    ('cape codder', 'cape-codder'),
    ('vodka cranberry', 'cape-codder'),
    ('red devil', 'cape-codder'),
    ('greyhound', 'greyhound'),
    ('pink squirrel', 'pink-squirrel'),
    ('wisconsin brandy old fashioned', 'wisconsin-brandy-old-fashioned'),
    ('brandy old fashioned', 'wisconsin-brandy-old-fashioned'),
    ('brooklynite', 'brooklynite'),
    ('el diablo', 'el-diablo'),
    ('mexican el diablo', 'el-diablo'),
    ('bellini', 'bellini'),
    ('honeysuckle', 'honeysuckle'),
    ('monte carlo', 'monte-carlo'),
    ('royal hawaiian', 'royal-hawaiian'),
    ('snowball', 'snowball'),
    ('black russian', 'black-russian'),
    ('screwdriver', 'screwdriver'),
    ('aperol spritz', 'aperol-spritz'),
    ('spritz', 'aperol-spritz'),
    ('cardinale', 'cardinale'),
    ('cardinal', 'cardinale'),
    ('vodka gimlet', 'vodka-gimlet'),
    ('bull shot', 'bull-shot'),
    ('bullshot', 'bull-shot'),
    ('golden cadillac', 'golden-cadillac'),
    ('japanese highball', 'japanese-highball'),
    ('kaku highball', 'japanese-highball'),
    ('haibōru', 'japanese-highball'),
    ('margarita', 'margarita'),
    ('classic margarita', 'margarita'),
    ('royal hawaiian mai tai', 'royal-hawaiian-mai-tai'),
    ('hawaiian mai tai', 'royal-hawaiian-mai-tai'),
    ('mai tai (hawaiian style)', 'royal-hawaiian-mai-tai'),
    ('vesper', 'vesper'),
    ('vesper martini', 'vesper'),
    ('piña colada', 'pina-colada'),
    ('pina colada', 'pina-colada'),
    ('blue hawaii', 'blue-hawaii'),
    ('rüdesheimer kaffee', 'rudesheimer-kaffee'),
    ('jet pilot', 'jet-pilot'),
    ('agua de valencia', 'agua-de-valencia'),
    ('campari shakerato', 'campari-shakerato'),
    ('shakerato', 'campari-shakerato'),
    ('golden dream', 'golden-dream'),
    ('michelada', 'michelada'),
    ('chelada', 'michelada'),
    ('batanga', 'batanga'),
    ('port light', 'port-light'),
    ('salty dog', 'salty-dog'),
    ('vodka collins', 'vodka-collins'),
    ('joe collins', 'vodka-collins'),
    ('white russian', 'white-russian'),
    ('saturn', 'saturn'),
    ('caesar', 'caesar'),
    ('bloody caesar', 'caesar'),
    ('harvey wallbanger', 'harvey-wallbanger'),
    ('lemon drop', 'lemon-drop'),
    ('lemon drop martini', 'lemon-drop'),
    ('bloody maria', 'bloody-maria'),
    ('frozen margarita', 'frozen-margarita'),
    ('blended margarita', 'frozen-margarita'),
    ('painkiller', 'painkiller'),
    ('bombardino', 'bombardino'),
    ('kalimotxo', 'kalimotxo'),
    ('calimocho', 'kalimotxo'),
    ('long island iced tea', 'long-island-iced-tea'),
    ('sbagliato', 'negroni-sbagliato'),
    ('negroni sbagliato', 'negroni-sbagliato'),
    ('tequila sunrise', 'tequila-sunrise'),
    ('jungle bird', 'jungle-bird'),
    ('amaretto sour', 'amaretto-sour'),
    ('rosita', 'rosita'),
    ('bushwacker', 'bushwacker'),
    ('mudslide', 'mudslide'),
    ('spanish coffee', 'spanish-coffee'),
    ('huber''s spanish coffee', 'spanish-coffee'),
    ('french connection', 'french-connection'),
    ('godfather', 'godfather'),
    ('godmother', 'godmother'),
    ('kamikaze', 'kamikaze'),
    ('b-52', 'b-52'),
    ('brave bull', 'brave-bull'),
    ('cadillac margarita', 'cadillac-margarita'),
    ('top shelf margarita', 'cadillac-margarita'),
    ('fernet con coca', 'fernet-con-coca'),
    ('fernet and coke', 'fernet-con-coca'),
    ('fernando', 'fernet-con-coca'),
    ('sea breeze', 'sea-breeze'),
    ('espresso martini', 'espresso-martini'),
    ('vodka espresso', 'espresso-martini'),
    ('pharmaceutical stimulant', 'espresso-martini'),
    ('bramble', 'bramble'),
    ('japanese slipper', 'japanese-slipper'),
    ('dukes martini', 'dukes-martini'),
    ('direct martini', 'dukes-martini'),
    ('freezer martini', 'dukes-martini'),
    ('cosmopolitan', 'cosmopolitan'),
    ('cosmo', 'cosmopolitan'),
    ('tommy''s margarita', 'tommys-margarita'),
    ('tommy''s', 'tommys-margarita'),
    ('whiskey smash', 'whiskey-smash'),
    ('fitzgerald', 'fitzgerald'),
    ('jasmine', 'jasmine'),
    ('spumoni', 'spumoni'),
    ('lychee martini', 'lychee-martini'),
    ('lychee-tini', 'lychee-martini'),
    ('lycheetini', 'lychee-martini'),
    ('ancient mariner', 'ancient-mariner'),
    ('seelbach', 'seelbach'),
    ('appletini', 'appletini'),
    ('apple martini', 'appletini'),
    ('adam''s apple martini', 'appletini'),
    ('sour apple martini', 'appletini'),
    ('breakfast martini', 'breakfast-martini'),
    ('cable car', 'cable-car'),
    ('quill', 'quill'),
    ('carajillo 43', 'mexican-carajillo'),
    ('mexican carajillo', 'mexican-carajillo'),
    ('carajillo (shakeado or puesto)', 'mexican-carajillo'),
    ('ranch water', 'ranch-water'),
    ('treacle', 'treacle'),
    ('paloma', 'paloma'),
    ('gin gin mule', 'gin-gin-mule'),
    ('gin-gin mule', 'gin-gin-mule'),
    ('gold rush', 'gold-rush'),
    ('spanish gin tonic', 'spanish-gin-tonic'),
    ('gin tonic', 'spanish-gin-tonic'),
    ('gintonic de copa', 'spanish-gin-tonic'),
    ('trident', 'trident'),
    ('bourbon renewal', 'bourbon-renewal'),
    ('enzoni', 'enzoni'),
    ('old cuban', 'old-cuban'),
    ('el cubano', 'old-cuban'),
    ('white negroni', 'white-negroni'),
    ('negroni bianco (sometimes)', 'white-negroni'),
    ('porn star martini', 'porn-star-martini'),
    ('pornstar martini', 'porn-star-martini'),
    ('passion fruit martini', 'porn-star-martini'),
    ('chartreuse swizzle', 'chartreuse-swizzle'),
    ('1794', '1794'),
    ('1794 cocktail', '1794'),
    ('eastside', 'eastside'),
    ('east side', 'eastside'),
    ('red hook', 'red-hook'),
    ('revolver', 'revolver'),
    ('black manhattan', 'black-manhattan'),
    ('chet baker', 'chet-baker'),
    ('chocolate negroni', 'chocolate-negroni'),
    ('earl grey marteani', 'earl-grey-martini'),
    ('earl grey martini', 'earl-grey-martini'),
    ('fitty-fitty', 'fitty-fitty'),
    ('fitty-fitty martini', 'fitty-fitty'),
    ('hugo', 'hugo'),
    ('hugo spritz', 'hugo'),
    ('kentucky maid', 'kentucky-maid'),
    ('little italy', 'little-italy'),
    ('penicillin', 'penicillin'),
    ('bensonhurst', 'bensonhurst'),
    ('contessa', 'contessa'),
    ('greenpoint', 'greenpoint'),
    ('siesta', 'siesta'),
    ('benton''s old fashioned', 'bentons-old-fashioned'),
    ('elder fashion', 'elder-fashion'),
    ('final ward', 'final-ward'),
    ('juliet and romeo', 'juliet-and-romeo'),
    ('juliet & romeo', 'juliet-and-romeo'),
    ('left hand', 'left-hand'),
    ('oaxaca old fashioned', 'oaxaca-old-fashioned'),
    ('oaxacan old fashioned', 'oaxaca-old-fashioned'),
    ('rapscallion', 'rapscallion'),
    ('hallion', 'rapscallion'),
    ('right hand', 'right-hand'),
    ('agavoni', 'agavoni'),
    ('tequila negroni', 'agavoni'),
    ('tegroni', 'agavoni'),
    ('art of choke', 'art-of-choke'),
    ('carroll gardens', 'carroll-gardens'),
    ('conference', 'conference'),
    ('gin basil smash', 'gin-basil-smash'),
    ('gin pesto', 'gin-basil-smash'),
    ('mulata daisy', 'mulata-daisy'),
    ('paper plane', 'paper-plane'),
    ('trinidad sour', 'trinidad-sour'),
    ('barrel-aged negroni', 'barrel-aged-negroni'),
    ('bitter giuseppe', 'bitter-giuseppe'),
    ('cobble hill', 'cobble-hill'),
    ('division bell', 'division-bell'),
    ('kentucky buck', 'kentucky-buck'),
    ('kingston negroni', 'kingston-negroni'),
    ('rum negroni', 'kingston-negroni'),
    ('mezcal negroni', 'mezcal-negroni'),
    ('oaxacan negroni', 'mezcal-negroni'),
    ('slope', 'slope'),
    ('the slope', 'slope'),
    ('park slope', 'slope'),
    ('death in venice', 'death-in-venice'),
    ('monte cassino', 'monte-cassino'),
    ('haitian divorce', 'haitian-divorce'),
    ('industry sour', 'industry-sour'),
    ('naked and famous', 'naked-and-famous'),
    ('sharpie mustache', 'sharpie-mustache'),
    ('unusual negroni', 'unusual-negroni'),
    ('amaretto sour (morgenthaler)', 'morgenthaler-amaretto-sour'),
    ('jeffrey morgenthaler''s amaretto sour', 'morgenthaler-amaretto-sour'),
    ('picante de la casa', 'picante'),
    ('picante', 'picante'),
    ('piña verde', 'pina-verde'),
    ('pina verde', 'pina-verde'),
    ('dead rabbit irish coffee', 'dead-rabbit-irish-coffee'),
    ('frozen negroni', 'frozen-negroni'),
    ('negroni slushy', 'frozen-negroni'),
    ('lost lake', 'lost-lake'),
    ('last of the oaxacans', 'last-of-the-oaxacans'),
    ('closing argument', 'last-of-the-oaxacans'),
    ('negroni bianco', 'negroni-bianco'),
    ('bianco negroni', 'negroni-bianco'),
    ('basil gimlet', 'basil-gimlet'),
    ('bitter mai tai', 'bitter-mai-tai'),
    ('boston sour', 'boston-sour'),
    ('whiskey sour with egg white', 'boston-sour'),
    ('bourbon milk punch', 'bourbon-milk-punch'),
    ('caffè corretto', 'caffe-corretto'),
    ('caipiroska', 'caipiroska'),
    ('caipivodka', 'caipiroska'),
    ('caipirodka', 'caipiroska'),
    ('campari spritz', 'campari-spritz'),
    ('carajillo', 'carajillo'),
    ('coquito', 'coquito'),
    ('cosmonaut', 'cosmonaut'),
    ('dark ''n stormy', 'dark-n-stormy'),
    ('dark and stormy', 'dark-n-stormy'),
    ('garibaldi', 'garibaldi'),
    ('campari orange', 'garibaldi'),
    ('campari and orange', 'garibaldi'),
    ('hot toddy', 'hot-toddy'),
    ('hot whiskey', 'hot-toddy'),
    ('kir royale', 'kir-royale'),
    ('kir royal', 'kir-royale'),
    ('mezcal margarita', 'mezcal-margarita'),
    ('midori sour', 'midori-sour'),
    ('negroski', 'negroski'),
    ('negrosky', 'negroski'),
    ('vodka negroni', 'negroski'),
    ('perfect manhattan', 'perfect-manhattan'),
    ('reverse martini', 'reverse-martini'),
    ('upside down martini', 'reverse-martini'),
    ('upside-down martini', 'reverse-martini'),
    ('rossini', 'rossini'),
    ('royal fizz', 'royal-fizz'),
    ('rum old fashioned', 'rum-old-fashioned'),
    ('rum punch', 'rum-punch'),
    ('bajan rum punch', 'rum-punch'),
    ('caribbean rum punch', 'rum-punch'),
    ('sgroppino', 'sgroppino'),
    ('sgropin', 'sgroppino'),
    ('spicy margarita', 'spicy-margarita'),
    ('jalapeño margarita', 'spicy-margarita'),
    ('the business', 'business'),
    ('business', 'business'),
    ('ti'' punch', 'ti-punch'),
    ('ti punch', 'ti-punch'),
    ('petit punch', 'ti-punch'),
    ('tia mia', 'tia-mia'),
    ('undead gentleman', 'undead-gentleman');

-- Labelled a version, like the earlier links (20260930950000).
UPDATE "public"."items" i SET
    "riff_of_id" = f.item_id,
    "origin" = CASE WHEN i.origin = 'Original' THEN 'Varient' ELSE i.origin END
FROM "ft_names" n
JOIN "ft_drinks" f ON f.key = n.key
WHERE i.item_type = 'cocktail' AND NOT i.is_catalog AND i.riff_of_id IS NULL
  AND lower(btrim(i.name)) = n.lname
  AND (i.bar_id IS NOT NULL OR i.created_by IS NULL)
  AND i.id <> f.item_id;

-- --- No paid AI: drop the flavour jobs these inserts queued ---

DELETE FROM "private"."item_flavor_jobs" j
USING "ft_drinks" f
WHERE j.item_id = f.item_id AND NOT EXISTS (SELECT 1 FROM "ft_jobs_before" b WHERE b.item_id = j.item_id);

DROP TABLE "ft_names", "ft_lines", "ft_ing", "ft_drinks", "ft_jobs_before";
