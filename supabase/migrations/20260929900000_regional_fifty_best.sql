-- Asia's 50 Best Bars 2026 and North America's 50 Best Bars 2026: every bar
-- on both lists, its place on the list, and its signature drinks.
--
-- 1. The 70 bars that weren't here yet, as public, unclaimed venue
--    profiles, same rules as the World's 50 Best seed: a bar already here
--    (same name within 150 m, or the handle taken) is left alone, and each bar
--    claims its profile the usual way. Bios are ours and end with the bar's
--    place on the list. Map points are the venue's OpenStreetMap entry or its
--    street address, checked in September 2026.
-- 2. Each bar's 2026 place on its list, and the list's named awards (Best Bar
--    in <country>, Best New Opening...), for all 100 bars, including the ones
--    that were already here.
-- 3. Each new bar's best-known drinks, credited to the bar, same as the
--    signature-drinks seed: our own description and notes, ingredients where
--    a menu or article lists them, and measures only where a real spec is
--    published, each checked against the source's own text.
--
-- Safe to re-run: bars, awards and drinks already present are left alone.

-- --- The bars ---

INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "locality", "address_line",
                                 "postcode", "city", "region", "country_code", "latitude", "longitude")
SELECT 'bar', v.handle, v.name, v.bio, v.website, true, v.locality, v.address_line,
       v.postcode::text, v.city, v.region::text, v.country_code, v.latitude, v.longitude
FROM (VALUES
    ('aquabarbangkok', 'AQUA Bar', 'Courtyard bar in the garden of the Anantara Siam Bangkok Hotel on Rajadamri Road, a fixture of the hotel for more than two decades. Its current identity is built around Quill the Duck, a nod to the ducks that once lived in the courtyard ponds, and a Potions of the Garden menu led by head mixologist Ryan Germino that leans into heat, spice and umami. No. 48 on Asia''s 50 Best Bars 2026.', 'https://www.aquabangkok.com/', 'Pathum Wan', 'Anantara Siam Bangkok Hotel, 155 Rajadamri Road', '10330', 'Bangkok', NULL, 'TH', 13.74117, 100.54043),
    ('barspiritforward.blr', 'Bar Spirit Forward', 'Lavelle Road bar on the ground floor of Hotel Southern Star, opened in the second half of 2023 by drinks veteran Arijit Bose, formerly of Countertop India, with the team behind Goa''s Tesouro. Around 60 seats face a long teak and granite counter, and the list favours precise, boozy classics such as a frozen, pre-diluted Vesper, backed by a shadow list of classics made on request. No. 30 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/barspiritforward.blr/', 'Ashok Nagar', 'Ground Floor, Hotel Southern Star, 40/2 Lavelle Road', '560001', 'Bengaluru', 'Karnataka', 'IN', 12.97467, 77.59934),
    ('barkumiko', 'Kumiko', 'Japanese dining bar in Chicago''s West Loop opened on New Year''s Eve 2018 by Julia Momosé with Noah and Cara Sandoval of Oriole. Named after a Japanese woodworking technique, it pairs seasonal cocktails, sake and shochu with a full list of spirit-free drinks, and its service is built on omotenashi. No. 11 on North America''s 50 Best Bars 2026, where it also won the Michter''s Art of Hospitality Award.', 'https://www.barkumiko.com/', 'West Loop', '630 W Lake St', '60661', 'Chicago', 'Illinois', 'US', 41.88587, -87.64406),
    ('smoke.bitters', 'Smoke & Bitters', 'Open-air bar and smokehouse in a coconut grove on Pehebiya Beach, Hiriketiya, opened in 2020 by London-raised bartender Don Ranasinghe and his childhood friend, chef Lahiru ''Lalla'' Perera. Drinks take a tiki-rooted approach built on Sri Lankan arrack, local gins and house-made bitters and syrups, while the kitchen cooks over native woods. No. 29 on Asia''s 50 Best Bars 2026 and winner of its Michter''s Art of Hospitality Award.', 'https://www.smokeandbitters.com/', 'Hiriketiya', 'Pehebiya Road', '81200', 'Hiriketiya', 'Southern Province', 'LK', 5.96136, 80.70135),
    ('threexco_kl', 'Three X Co', 'Speakeasy behind a barbershop front on the third floor of Bangsar Shopping Centre, opened in late 2017 by friends Wong Wai Hung, Eugene Yeoh and Daniel Gunawan with bartender David Hans. The chinoiserie room, watched over by a mural of a Chinese opera diva, is known for twisted classics with Malaysian and Chinese flavours, and its IndiVDuality menus tie each drink to a persona. No. 32 on Asia''s 50 Best Bars 2026 and The Best Bar in Malaysia.', 'https://www.threexco.com/', 'Bangsar', 'Level 3, Bangsar Shopping Center, 285 Jalan Maarof', '59000', 'Kuala Lumpur', 'Federal Territory of Kuala Lumpur', 'MY', 3.1431, 101.66733),
    ('kaitodelvalle', 'Kaito del Valle', 'Izakaya-style cocktail bar co-founded in 2016 by bartender Claudia Cabrera as Latin America''s first bar run entirely by women, named after Japan''s female pearl divers. In 2025 it moved from Del Valle to a larger space in Colonia Juárez entered through a vending-machine door, with a karaoke room upstairs and a seasonal menu of Japanese-inflected cocktails. No. 25 on North America''s 50 Best Bars 2026.', 'https://www.kaitodelvalle.com/', 'Juárez', 'Hamburgo 70B', '06600', 'Mexico City', 'Ciudad de México', 'MX', 19.42707, -99.16244),
    ('angelssharenyc', 'Angel''s Share', 'Japanese-style cocktail bar opened by Tony Yoshida in 1993 in a second-floor East Village room, one of the first places in New York to show off Japanese precision bartending, carved ice and strict house rules. It closed in 2022 and reopened in June 2023 on Grove Street in the West Village under his daughter Erina Yoshida, with the original cherub mural brought along. No. 31 on North America''s 50 Best Bars 2026.', 'https://www.angelssharenyc.com/', 'West Village', '45 Grove St', '10014', 'New York', 'New York', 'US', 40.73301, -74.00433),
    ('alice_cheongdam', 'Alice Cheongdam', 'Alice in Wonderland themed bar that Terry Kim opened in April 2015 in Seoul''s Cheongdam-dong, reached by following white rabbit signs down a flight of stairs and through a hidden door in a flower shop. Kim and joint head bartender Mason Park run a wood-panelled room serving playful seasonal cocktails built on fresh fruit and house syrups, bitters and jellies, plus a deep list of spirits and Korean soju. No. 13 on Asia''s 50 Best Bars 2026.', 'https://www.alicecheongdam.com/', 'Cheongdam-dong', 'B1, 47 Dosan-daero 55-gil, Gangnam-gu', '06014', 'Seoul', NULL, 'KR', 37.52668, 127.04094),
    ('thehanjiapairingdinner', 'The Han-Jia Pairing Dinner', 'Bar and dining room on Ximen Road in Tainan, near the Blueprint Culture and Creative Park, opened in 2020 by Nono Yu, a former magician who won World Class Taiwan in 2022. Whisky anchors the back bar, film-themed cocktails lean on Taiwanese fruit, herbs and tea, and the kitchen cooks French-leaning plates meant for pairing. The name borrows a Taiwanese Hokkien phrase for rare food and carefree feasting. No. 41 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/thehanjiapairingdinner/', 'South District', 'No. 669, Section 1, Ximen Road', '702', 'Tainan', NULL, 'TW', 22.98658, 120.19734),
    ('mothercocktailbar', 'Mother', 'Queen Street West cocktail bar near Trinity Bellwoods Park, opened in 2019 by Massimo Zitti, whose cellar fermentorium turns out the lacto-ferments, kombuchas and cultures behind its drinks; the name refers to a fermentation starter. The list mixes long-running house classics, barrel-aged cocktails and paired alcoholic and spirit-free versions of the same ingredients. No. 22 on North America''s 50 Best Bars 2026.', 'https://motherdrinks.co/', 'Trinity Bellwoods', '874 Queen St West', 'M6J 1G3', 'Toronto', 'Ontario', 'CA', 43.6452, -79.4144),
    ('barsathorn', 'Bar Sathorn', 'Cocktail lounge inside The House on Sathorn, an 1889 mansion on North Sathorn Road that has been a merchant''s home, the Hotel Royal and the Soviet embassy, and is now part of W Bangkok. Milan-born bar manager Marco Dognini arranges the menu by the mansion''s eras, reworking classics with Thai ingredients. No. 17 on Asia''s 50 Best Bars 2026.', 'https://www.barsathorn.com/', 'Silom, Bang Rak', 'The House on Sathorn, 106 North Sathorn Road', '10500', 'Bangkok', NULL, 'TH', 13.72211, 100.52892),
    ('soka_blr', 'Soka', 'Indiranagar cocktail bar opened around the end of 2023 by chef Sombir Choudhary and bartender Avinash Kapoli, whose names give it SO and KA. The small, izakaya-like room is dressed in copper and sculpture by Goan artist Siddharth Kerkar, and its story-driven drinks lean on Indian flavours alongside hearty bar plates. No. 18 on Asia''s 50 Best Bars 2026.', 'https://www.sokabar.com/', 'Indiranagar', 'No. 210, A Cross, 1st Main Road, 2nd Stage Indiranagar, Domlur', '560071', 'Bengaluru', 'Karnataka', 'IN', 12.96504, 77.63838),
    ('boilermaker.goa', 'Boilermaker', 'Siolim neighbourhood bar opened in late 2024 by craft brewer Nakul Bhonsle of Great State Aleworks and Pankaj Balachandran, co-founder of Bar Tesouro. The laid-back, dive-style room of corrugated metal and open-air seating pairs a dozen taps of Great State beer with easy-drinking cocktails and beer-and-shot pairings. Named The Best Bar in India 2026. No. 8 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/boilermaker.goa/', 'Siolim', 'Church, Vaddi Siolim, en route to Thalassa, opposite Vailanka Wine Store', '403517', 'Siolim', 'Goa', 'IN', 15.61717, 73.76301),
    ('bandistahouston', 'Bandista', 'Hidden 20-seat lounge behind a bookcase in the Four Seasons Hotel Houston, opened in February 2022 by the hotel''s beverage manager Johnathan Jones. The concept nods to the tequileros who smuggled agave spirits across the border during Prohibition, and the drinks lean on lab techniques such as vacuum distillation, with playful touches like made-to-order dipping dots. No. 47 on North America''s 50 Best Bars 2026.', 'https://www.bandistahouston.com/', 'Downtown', 'Four Seasons Hotel Houston, 1300 Lamar St', '77010', 'Houston', 'Texas', 'US', 29.75407, -95.36279),
    ('daisy.losangeles', 'Daisy Margarita Bar', 'Sherman Oaks cantina opened in April 2025 by Matt Egan and beverage director Max Reis, the team behind Mírate. Named for the Spanish meaning of margarita, it pours a dozen or so versions of the drink on private-batch tequilas, from classics to centrifuged and clarified savoury styles, each salted inside the glass rather than on the rim. No. 44 on North America''s 50 Best Bars 2026.', 'https://www.daisyla.com/', 'Sherman Oaks', '14633 Ventura Blvd', '91403', 'Los Angeles', 'California', 'US', 34.15177, -118.45214),
    ('limantourmx', 'Licorería Limantour', 'Roma Norte bar that opened in April 2011 and is widely credited with starting Mexico City''s modern cocktail scene; a Polanco branch followed in 2013. Bar director José Luis León, there since day one, keeps the Margarita al Pastor on every menu while newer lists poke fun at guilty-pleasure drinks. It received the Legend of the List award in 2025. No. 20 on North America''s 50 Best Bars 2026.', 'https://limantour.tv/', 'Roma Norte', 'Av. Álvaro Obregón 106', '06700', 'Mexico City', 'Ciudad de México', 'MX', 19.41813, -99.15941),
    ('barmadonnabk', 'Bar Madonna', 'Williamsburg cocktail bar opened in April 2024 by New York bartender Eric Madonna and former Carbone manager Ray Rando to update the Italian-American neighbourhood hangout. A KidSuper painting hangs over the long bar, the kitchen serves red-sauce comfort food, and drinks like the clarified Limoncello Milk Punch give Italian flavours a modern turn. No. 36 on North America''s 50 Best Bars 2026.', 'https://barmadonna.com/', 'Williamsburg, Brooklyn', '367 Metropolitan Ave', '11211', 'New York', 'New York', 'US', 40.71425, -73.95567),
    ('bar.cham', 'Bar Cham', 'Oak-lined bar in a hanok in Seoul''s Seochon neighbourhood, run by owner-bartender Lim Byung-jin (BJ). It was one of the first in the city to build its menu around traditional Korean spirits and regional ingredients, naming drinks after places such as Wonju and Chungju. Lim also runs nearby Pomme, an apple-focused bar. No. 33 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/bar.cham/', 'Tongin-dong, Jongno-gu', '34 Jahamun-ro 7-gil', NULL, 'Seoul', NULL, 'KR', 37.57922, 126.97029),
    ('infinitybeyond_tw', 'To Infinity & Beyond', 'Space-themed bar in Taipei''s Da''an district opened in December 2019 by owner-bartender Mars Chang, the 2021 World Class Taiwan champion. Guests enter through automatic spaceship-style doors, and the menu sorts drinks by texture (creamy, clarified, carbonated) rather than by style, using distillation and centrifugation. No. 35 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/infinitybeyond_tw/', 'Da''an District', 'No. 13, Lane 160, Section 1, Dunhua South Road', '106', 'Taipei', NULL, 'TW', 25.04364, 121.54786),
    ('botanistdining', 'Botanist Bar', 'Cocktail bar and lab inside Botanist at the Fairmont Pacific Rim, opened in spring 2017 under creative beverage director Grant Sceney. Seasonal menus draw on foraged Pacific Northwest ingredients and lab gear such as a rotary evaporator and centrifuge, with the Botanist Marine Martini its best-known drink. It won the Michter''s Art of Hospitality Award in 2023. No. 38 on North America''s 50 Best Bars 2026.', 'https://www.botanistrestaurant.com/bar/', 'Coal Harbour, Downtown', 'Fairmont Pacific Rim, 1038 Canada Pl', 'V6C 0B9', 'Vancouver', 'British Columbia', 'CA', 49.28829, -123.11667),
    ('drywavecocktailstudio', 'Dry Wave Cocktail Studio', 'Thonglor cocktail bar opened in January 2024 by Supawit ''Palm'' Muttarattana, formerly of Vesper and Backstage, with his wife and co-creator Niwarin ''Ae'' Phlainoi. Its Super Classics menu fuses two classic cocktails from different eras into one drink, served at a curving marble bar in a wave-patterned room. No. 4 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/drywavecocktailstudio/', 'Thong Lo, Khlong Tan Nuea, Watthana', '2nd Floor, 263 Thong Lo 13 Alley', '10110', 'Bangkok', NULL, 'TH', 13.73371, 100.58067),
    ('cmyk.china', 'CMYK', 'Changsha bar opened in 2021 by award-winning bartender Ethan Liu in an old house by historic Chaozong Street. Named after the four printing inks (and the tagline Countless Memories You Keep), it spreads over several rooms with a playful, technically minded list that reuses ingredients across drinks. No. 27 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/cmyk.china/', 'Kaifu District (Chaozong Street area)', '388 Zhongshan West Road', NULL, 'Changsha', 'Hunan', 'CN', 28.2041, 112.96743),
    ('librarybytheseagc', 'Library by the Sea', 'Literary-themed bar in the lobby of the Kimpton Seafire Resort + Spa on Seven Mile Beach, launched in mid-2023 by beverage director Jim Wrigley and fellow London bartender Andrew Copsey. Every drink on the illustrated menu is built from a book, and a back bar of vintage spirits powers period-correct pours. No. 49 on North America''s 50 Best Bars 2026.', 'https://www.librarybythesea.com/', 'Seven Mile Beach', 'Kimpton Seafire Resort + Spa, 60 Tanager Way', 'KY1-1303', 'Grand Cayman', NULL, 'KY', 19.3515, -81.38308),
    ('carrots.jakarta', 'Carrots', 'Basement cocktail bar beneath SCBD''s Fairgrounds, open since 2023 and run by co-founders Alvin Sung Jaya and Monica Jonan with creative partner Anthony Luis. Fourteen seats centre on a communal bar in a smoke-free room, and the culinary-minded menu, I Drink, Therefore I Am, charts each drink by flavour and strength. No. 21 on Asia''s 50 Best Bars 2026.', 'https://www.bar-carrots.com/', 'SCBD, Senayan', 'Basement Level, Fairgrounds SCBD Lot 14, Jl. Jenderal Sudirman', '12190', 'Jakarta', 'DKI Jakarta', 'ID', -6.22667, 106.80718),
    ('stregisbar_macao', 'The St. Regis Bar Macao', 'Hotel bar on the second floor of The St. Regis Macao at The Londoner in Cotai, pairing the brand''s New York heritage with gilded turn-of-the-century decor and a mural of Macau behind the bar. Taipei-born mixologist Kevin Lai, who joined in November 2022, writes New York-themed menus alongside Maria do Leste, the hotel''s Macanese Bloody Mary. No. 45 on Asia''s 50 Best Bars 2026.', 'https://www.thestregisbarmacao.com/', 'Cotai', '2nd Floor, The St. Regis Macao, The Londoner Macao, Estrada do Istmo, s/n', NULL, 'Macau', NULL, 'MO', 22.14695, 113.56572),
    ('mirate.losangeles', 'Mírate', 'Multi-level, plant-filled Mexican restaurant and bar on Vermont Avenue in Los Feliz, where beverage director Max Reis builds cocktails around agave spirits, pre-Hispanic ferments such as pulque and tepache, and bottlings he sources directly from Mexican producers. Its aguachile-inspired El Guero margarita has been the top seller since day one. No. 28 on North America''s 50 Best Bars 2026.', 'https://www.mirate.la/', 'Los Feliz', '1712 N Vermont Ave', '90027', 'Los Angeles', 'California', 'US', 34.1022, -118.29164),
    ('selvaoaxaca', 'Selva', 'Mid-century-styled cocktail bar off Oaxaca''s Macedonio Alcalá pedestrian street, led by Italian-born co-founder and beverage director Alexandra Purcaru. Drinks centre on mezcal and Oaxacan ingredients such as hoja santa and pasilla mixe, each tied to a local market, plant or community, with food from Los Danzantes and a courtyard full of cats. No. 43 on North America''s 50 Best Bars 2026.', 'https://www.selvaoaxaca.com/', 'Centro', 'C. Macedonio Alcalá #403, int. 6, Ruta Independencia', '68000', 'Oaxaca', 'Oaxaca', 'MX', 17.06514, -96.72398),
    ('mms_maltmixologyspace', 'M+MS', 'Malt + Mixology Space, the experimental Dosan sibling of Le Chamber, the Cheongdam speakeasy JJ Lim and Louis Eom opened in 2014. In a raw-concrete room with a red lacquered bar and DJ booth that opened in 2022, it runs as a cafe from 2pm, brews its own beer and pours fermentation-led cocktails. No. 42 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/mms_maltmixologyspace/', 'Sinsa-dong (Dosan), Gangnam-gu', '32-1 Dosan-daero 49-gil', NULL, 'Seoul', NULL, 'KR', 37.52427, 127.03721),
    ('barlibre_ikebukuro', 'Bar Libre', 'Signless basement bar in Nishi-Ikebukuro, opened in 2011 and run by owner Yujiro Kiyosaki with manager Kizuaki Nagao. The 17-seat room plays mellow jazz, and a menu that climbs from low to high strength folds Japanese ingredients such as shiso kombucha, yuzu and soba tea into classics, served in vessels from ceramics to flower vases. No. 39 on Asia''s 50 Best Bars 2026.', 'https://www.bar-libre.jp/', 'Nishi-Ikebukuro, Toshima', 'Somaya Building B1F, 3-25-8 Nishi-Ikebukuro', '171-0021', 'Tokyo', 'Tokyo', 'JP', 35.73027, 139.70743),
    ('juneoncambie', 'June on Cambie', 'Brasserie and cocktail bar on Cambie Street opened in April 2025 by the team behind Chinatown''s Keefer Bar, with bar director Amber Bruce, bar manager Satoshi Yonemori and head bartender Riley Maggs writing the list. Martinis are poured from the freezer at a blush-pink bar designed by Hector Esrawe, and Lala, a basement vinyl bar, opens later at night. No. 17 on North America''s 50 Best Bars 2026.', 'https://juneoncambie.com/', 'Cambie Village', '3305 Cambie St.', 'V5Z 2W6', 'Vancouver', 'British Columbia', 'CA', 49.25578, -123.11536),
    ('god_bkk', 'G.O.D', 'Chinatown bar opened in April 2024 by the YOLO Group team behind Teens of Thailand, with Niks Anuman-Rajadhon and Attaporn De-Silva running the drinks. Two old shophouses were fused into a candlelit, graffitied room with stained glass and a live pianist, and every cocktail comes with a paired bite, from uni to oysters. The name stands for Genius On Drugs. No. 31 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/god_bkk/', 'Pom Prap', '25, 27 Soi Rammaitree', '10100', 'Bangkok', NULL, 'TH', 13.7398, 100.51437),
    ('ralphsbarchengdu', 'Ralph''s Bar', 'Ralph Lauren''s bar and restaurant above the brand''s flagship store in Chengdu''s Sino-Ocean Taikoo Li, dressed as a clubby New York tavern in dark timber, leather and brass and serving Polo Bar-style American food. Its cocktail list, created with Guangzhou''s Hope & Sesame, is themed on the landscapes of the American West. It is the first Chengdu bar ever to make the list. No. 28 on Asia''s 50 Best Bars 2026.', 'https://www.ralphlauren.co.uk/en/global/ralphs-bar-chengdu/7136', 'Jinjiang District', '3F, Building 15, Chengdu Taikoo Li, 8 Central Shamao Street', NULL, 'Chengdu', 'Sichuan', 'CN', 30.65576, 104.0813),
    ('elgalloaltanero', 'El Gallo Altanero', 'Agave bar in Guadalajara''s Colonia Americana opened in 2018 by Swedish bartender Freddy Andreasson and Australian partner Nick Reid. Guests walk through Cafe Fitzroy''s courtyard and up a stair to a 13-seat square bar beneath a stained-glass agave window, where the backbar favours small independent tequila, raicilla and mezcal makers and the short cocktail list changes often. No. 10 on North America''s 50 Best Bars 2026.', 'https://www.instagram.com/elgalloaltanero/', 'Colonia Americana', 'Calle Marsella 126', '44160', 'Guadalajara', 'Jalisco', 'MX', 20.67408, -103.37065),
    ('cosmopony.jkt', 'Cosmo Pony', 'Cocktail bar on the fourth floor of the Grand Hyatt Jakarta, opened on 10 July 2024 as the first overseas bar from Singapore''s Jigger & Pony Group, in partnership with Jakarta''s The Union Group. The mid-century lounge looks out over the Bundaran HI roundabout, and its illustrated menuzines tell Jakarta stories through local fruit and reworked classics. No. 15 on Asia''s 50 Best Bars 2026.', 'https://www.cosmopony.com/en', 'Menteng', 'Grand Hyatt Jakarta, 4th Floor, Jl. M.H. Thamrin Kav. 28-30', '10350', 'Jakarta', 'DKI Jakarta', 'ID', -6.1938, 106.82245),
    ('problemchild_ph', 'Problem Child', 'Makati cocktail bar opened in late 2025 by Kevin Corales, Wendy Esteban and Patrick Leyble behind an unsigned entrance off Jupiter Street. A wall-sized light panel shifts the room''s colour to match a menu rebuilt around a single colour every three months, spanning inventive originals and tropical takes on classics. It was named the Best Bar in the Philippines 2026. No. 44 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/problemchild_ph/', 'Bel-Air', 'Unit 107 G/F, 369 Executive Building, Jupiter', NULL, 'Makati', 'Metro Manila', 'PH', 14.56157, 121.02831),
    ('cafelatrovamiami', 'Café La Trova', 'Little Havana bar and restaurant on Calle Ocho, opened in 2019 by Cuban cantinero Julio Cabrera and James Beard Award-winning chef Michelle Bernstein. Bartenders in dinner jackets work in the theatrical Havana cantinero style, throwing and shaking Cuban classics while a live son band plays. Cabrera was named Industry Icon at North America''s 50 Best Bars in 2023. No. 42 on North America''s 50 Best Bars 2026.', 'https://www.cafelatrova.com/', 'Little Havana', '971 SW 8th Street', '33130', 'Miami', 'FL', 'US', 25.76618, -80.21047),
    ('pch_sf', 'Pacific Cocktail Haven', 'Kevin Diedrich''s bar where Union Square meets Nob Hill, opened in 2016 and known by its pineapple symbol of hospitality. The long menu, sorted by spirit, plugs Asian and Pacific ingredients such as pandan, calamansi and ube into classic structures, reflecting Diedrich''s Filipino heritage. It was named Best American Cocktail Bar at the 2020 Spirited Awards and moved nearby after a fire. No. 41 on North America''s 50 Best Bars 2026.', 'https://www.pacificcocktailsf.com/', 'Union Square', '550 Sutter Street', '94102', 'San Francisco', 'CA', 'US', 37.78934, -122.40953),
    ('ponyupshanghai', 'Pony Up', 'Neighbourhood bar on Shanghai''s Jinxian Road opened in November 2023 by Dre Yang, formerly head bartender at The Odd Couple. Walnut panelling and orange velvet diner booths fill a compact room with two bars: easygoing twists on classics from 1pm, then a night menu drawn as a cartoon theme park map, with American bar food given an Asian spin. No. 19 on Asia''s 50 Best Bars 2026.', 'https://www.ponyupshanghai.com/', 'Huangpu District', '230 Jinxian Road', '200041', 'Shanghai', NULL, 'CN', 31.22313, 121.45318),
    ('punchroomtokyo', 'Punch Room Tokyo', 'Bar on the second floor of The Tokyo EDITION, Ginza, opened in 2024 as the Tokyo outpost of EDITION''s Punch Room concept, in a Kengo Kuma room of walnut and jewel-toned velvet modelled on 19th-century London clubs. Head bartender Yasuhiro Kawakubo''s Wonderland menus tell Japanese stories through punch''s five pillars, and a drink ordered by two or more arrives in a silver bowl. No. 23 on Asia''s 50 Best Bars 2026.', 'https://www.editionhotels.com/tokyo-ginza/restaurants-and-bars/punch-room/', 'Ginza', 'The Tokyo EDITION, Ginza 2F, 2-8-13 Ginza, Chuo-ku', '104-0061', 'Tokyo', 'Tokyo', 'JP', 35.67272, 139.76764),
    ('prophecybar', 'Prophecy', 'Subterranean cocktail bar under Vancouver''s Rosewood Hotel Georgia, opened in 2024 in the 1927 building''s former beer hall and club space, led by beverage director Jeff Savage, World Class Canada Bartender of the Year 2019. The illustrated menu groups drinks by stories from myth, music and art and plots each on a flavour chart, with live music, DJs and a changing digital art wall. No. 32 on North America''s 50 Best Bars 2026.', 'https://www.prophecybar.com/', 'Downtown', '801 W Georgia St', 'V6C 1P7', 'Vancouver', 'BC', 'CA', 49.2835, -123.11888),
    ('lennons.bkk', 'Lennon''s', 'Speakeasy and vinyl bar on the 30th floor of Rosewood Bangkok, opened in 2019 and styled after a mid-century home recording studio, entered through a record shop of some 6,000 LPs. Bar director KT Lam, formerly of DarkSide in Hong Kong, runs a Thai-food-inspired signature list alongside golden-era classics and a deep whisky library. No. 7 on Asia''s 50 Best Bars 2026.', 'https://www.rosewoodhotels.com/en/bangkok/dining/lennons', 'Lumphini, Pathum Wan', '30th Floor, Rosewood Bangkok, 1041/38 Phloen Chit Road', '10330', 'Bangkok', NULL, 'TH', 13.74347, 100.54899),
    ('fancycocktailbar', 'Best Intentions', 'Logan Square neo-dive opened in 2015 by brothers Calvin and Chris Marty in the old Marble Bar, with wood panelling, arcade games and a tongue-in-cheek ''fancy cocktail bar'' sign. Cheap beer shares the rail with carefully made classics, Angostura on draft and the frozen Wondermint Malted. No. 16 on North America''s 50 Best Bars 2026.', 'https://www.bestintentionschicago.com/', 'Logan Square', '3281 W Armitage Ave', '60647', 'Chicago', 'Illinois', 'US', 41.91725, -87.71014),
    ('mecenasbar', 'Mecenas', 'Colonia Americana bar in a converted garage, led by José Luis Hinostroza (of Arca, Tulum) with head bartender Arturo Santos and named after the Roman arts patron Maecenas. It works without brands: liqueurs are made in house on a cane-spirit base, fortified wines come from Valle de Guadalupe, and spirits from local distilleries. No. 18 on North America''s 50 Best Bars 2026.', 'https://www.mecenasbar.com/', 'Americana', 'Av. de la Paz 2133', '44150', 'Guadalajara', 'Jalisco', 'MX', 20.67201, -103.3712),
    ('modernhausjkt', 'Modernhaus', 'Senopati cocktail bar opened in May 2024 by bartender Mirwansyah ''Bule'' and The Union Group, set above Bouchon in a mid-century-style living room built around a communal island counter. The name puns on ''haus'', Indonesian for thirsty; the menu follows the parts of a plant (root, fruit, leaf, flower) using local botanicals, ferments and upcycled citrus. No. 11 on Asia''s 50 Best Bars 2026.', 'https://uniongroupjakarta.com/brands/modernhaus/modernhaus-senopati', 'Selong, Kebayoran Baru', 'Jl. Senopati No.79', '12190', 'Jakarta', 'Jakarta', 'ID', -6.23289, 106.81212),
    ('baltrabar', 'Baltra Bar', 'Condesa cocktail lounge opened in 2015 by the team behind Licorería Limantour, named after the Galápagos island Darwin visited and filled with botanical prints and curios. Under beverage director José Luis León it pours some of the city''s most admired Martinis and changes its travel-themed menu seasonally. No. 48 on North America''s 50 Best Bars 2026.', 'https://baltra.bar/', 'Condesa', 'Iztaccíhuatl 36D', '06100', 'Mexico City', 'Ciudad de México', 'MX', 19.40952, -99.16884),
    ('viceversamiami', 'Viceversa', 'Italian aperitivo bar opened in June 2024 by Roman bartender Valentino Longo with the team behind Jaguar Sun, off the lobby of the Elser Hotel in downtown Miami. Drinks inspired by the Italian Futurists sit beside a house Milano-Torino blend that anchors its Negronis, plus crudo and neo-Neapolitan pizza from chef Justin Flit. No. 46 on North America''s 50 Best Bars 2026.', 'https://viceversamia.com/', 'Downtown', 'Elser Hotel, 398 NE 5th St', '33132', 'Miami', 'Florida', 'US', 25.77879, -80.18925),
    ('truelaurelsf', 'True Laurel', 'Mission District cocktail bar from Lazy Bear chef David Barzelay and bar director Nicolas Torres, known for drinks built on foraged California plants such as bay laurel and redwood, plus ferments, distillates and near-zero waste. It won the Ketel One Sustainable Bar Award in 2024 and serves bar food from chef Te''sean Glass. No. 14 on North America''s 50 Best Bars 2026.', 'https://truelaurelsf.com/', 'Mission District', '753 Alabama St', '94110', 'San Francisco', 'California', 'US', 37.7595, -122.41149),
    ('mobarshenzhen', 'MO Bar Shenzhen', 'Rooftop bar on the 79th floor of Mandarin Oriental, Shenzhen, with an industrial-chic room and terrace views over Futian. Taipei-born head bartender Tiger Chang builds menus on Chinese culture, from movable-type printing to Colours of China, a list tied to traditional pigments, crafts and the 24 solar terms. No. 5 on Asia''s 50 Best Bars 2026.', 'https://www.mandarinoriental.com/en/shenzhen/futian/dine/mo-bar', 'Futian District', '79/F, Mandarin Oriental, Block A UpperHills, 5001 Huanggang Road', NULL, 'Shenzhen', 'Guangdong', 'CN', 22.56022, 114.06674),
    ('barpompette_to', 'Bar Pompette', 'French-accented neighbourhood bar on College Street in Little Italy, opened in 2021 as the offshoot of Restaurant Pompette by Maxime Hoerth, Martine and Jonathan Bauer, with chef-turned-bartender Hugo Togni. Walk-in only, it pairs rotovap distillates and Ontario farm produce with bistro hospitality. Winner of the 2025 Art of Hospitality Award. No. 8 on North America''s 50 Best Bars 2026.', 'https://www.pompette.ca/barpompette', 'Little Italy', '607 College St', 'M6G 1B5', 'Toronto', 'Ontario', 'CA', 43.655, -79.41435),
    ('thekeeferbar', 'The Keefer Bar', 'Apothecary-themed cocktail bar in Vancouver''s Chinatown, a fixture for more than 15 years, inspired by the neighbourhood''s old herbal shops. Beverage director Amber Bruce runs a menu of ''prescriptions'' built with house bitters, tinctures and Chinese medicinal ingredients, alongside dim sum and live music. Named The Best Bar in Canada 2026. No. 7 on North America''s 50 Best Bars 2026.', 'https://thekeeferbar.com/', 'Chinatown', '135 Keefer St', 'V6A 1X3', 'Vancouver', 'British Columbia', 'CA', 49.27962, -123.10133),
    ('opm.bkk', 'Opium', 'Chinatown cocktail bar on the top two floors of a 120-year-old shophouse above Restaurant Potong, opened in early 2022 by Arnon ''KK'' Hoontrakul with Sardinian head bartender Matteo Cadeddu. The fourth floor once hid an opium den; today the ''liquid surreality'' list runs to about 50 drinks, with four house gins and food from the Potong kitchen. No. 25 on Asia''s 50 Best Bars 2026.', 'https://www.opiumbarbangkok.com/', 'Samphanthawong (Chinatown)', '422 Vanich 1 Rd', '10100', 'Bangkok', NULL, 'TH', 13.73922, 100.50848),
    ('bisouschicago', 'Bisous', 'Fulton Market cocktail lounge opened in January 2024 by veteran Chicago barman Peter Vestinos (Sparrow) with Footman Hospitality, styled as a 1960s Paris lounge with orb lights, velvet booths and floral wallpaper. It is known for its martini list, from freezer martinis to updated Tuxedos and Vespers, plus brandy drinks and French wines. No. 30 on North America''s 50 Best Bars 2026.', 'https://www.bisouschicago.com/', 'Fulton Market (West Loop)', '938 W Fulton Market', '60607', 'Chicago', 'Illinois', 'US', 41.88688, -87.65133),
    ('hudsonroomshanoi', 'The Hudson Rooms', 'Rooftop bar and oyster room at Capella Hanoi, near the Opera House, themed on 1920s New York and Grand Central Terminal. The cocktail list is laid out as train journeys out of New York to New Orleans, Miami and Los Angeles, there are whisky and oyster pairings, and an invitation-only hidden bar, Track 61, sits behind it. No. 46 on Asia''s 50 Best Bars 2026.', 'https://capellahotels.com/en/capella-hanoi/dining/hudson-rooms', 'Hoan Kiem (French Quarter)', 'Capella Hanoi, 11 Le Phung Hieu', NULL, 'Hanoi', NULL, 'VN', 21.02573, 105.85681),
    ('thegoldentoothbar', 'The Golden Tooth', 'Third-floor bar on Jalan Adityawarman in South Jakarta, opened in March 2023 by head bartender Kenny Soetomo and his partners under the motto ''cocktails and chats''. The room is a concrete New York-style loft under a long skylight, and Soetomo''s drinks trade on flavour memory, from apple pie to barbecue to bubble gum. No. 40 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/thegoldentoothbar/', 'Melawai, Kebayoran Baru', 'Jl. Adityawarman No.71 (3rd floor)', '12160', 'Jakarta', 'DKI Jakarta', 'ID', -6.24483, 106.80481),
    ('barmauromx', 'Bar Mauro', 'Roma Norte aperitivo bar opened in October 2024 by brothers Ricardo and Eduardo Nava, named after their grandfather Mauro Mendoza and dressed like a 1970s Milan apartment with shelves of vermouth and amari. It won the One To Watch award at The World''s 50 Best Bars 2025, and its best seller is the sparkling Maurito. No. 2 on North America''s 50 Best Bars 2026, and The Best Bar in Mexico.', 'https://www.instagram.com/barmauromx/', 'Roma Norte, Cuauhtémoc', 'Tabasco 149', '06700', 'Mexico City', 'Ciudad de México', 'MX', 19.41937, -99.15932),
    ('bonvivantsbahamas', 'Bon Vivants', 'Sandyport cafe and cocktail bar opened in 2019 by Kyle Jones, a New York bartender who moved to Nassau in 2012, with importer Will Young: coffee from April, cocktails from July. Styled ''tropical meets classy'' around Bahamian history and Ernest Hemingway, it calls itself the country''s first craft cocktail bar and stocks more than 400 bottles. No. 50 on North America''s 50 Best Bars 2026.', 'https://bonvivantsbahamas.com/', 'Sandyport', '401 Sea Skye Lane', NULL, 'Nassau', 'New Providence', 'BS', 25.0765, -77.42834),
    ('lafactoriapr', 'La Factoría', 'Old San Juan bar opened in 2013 by bartenders Roberto Berdecía and Leslie Cofresí with Pablo Rodríguez, in the unsigned corner room that was once Café Hijos de Borinquen. It has grown into a warren of rooms, from the front bar to a salsa room, a wine bar and a ten-seat candlelit bar, and it helped spark Puerto Rico''s cocktail revival. No. 26 on North America''s 50 Best Bars 2026, and The Best Bar in the Caribbean.', 'https://lafactoriavsj.com/', 'Old San Juan', '148 Calle San Sebastián', '00901', 'San Juan', NULL, 'PR', 18.46724, -66.1174),
    ('obsidianbar_sz', 'Obsidian Bar', 'Steampunk-styled, multi-level bar in Shenzhen''s Ping An Finance Centre, opened in 2019 by Fano Group, with a dining floor around an open kitchen and an upstairs whisky room with skyline views. Beverage director Paul Hsu and Chris Wu, formerly of Shanghai''s Speak Low, run a menu that recently routed Victorian afternoon tea and banquets through Asian ingredients. No. 10 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/obsidianbar_sz/', 'Futian', 'L4, South Tower, Ping An Finance Center, 16 Fuhua 4th Road', NULL, 'Shenzhen', 'Guangdong', 'CN', 22.53473, 114.05062),
    ('civwrksto', 'Civil Works', 'Art Deco mezzanine bar above the Waterworks Food Hall, in a restored 1932 pipe factory, opened in 2024 by Nick Kennedy and the team behind Civil Liberties, with bar manager Élise Hanson. Its debut menu tied each drink to the building''s history and won Best Cocktail Menu at North America''s 50 Best Bars 2025, and it re-mineralises tap water to mimic famous waters. No. 29 on North America''s 50 Best Bars 2026.', 'https://www.waterworksfoodhall.com/restaurants/civil-works', 'Wellington Place (King West)', '50 Brant St, Second Level, Unit 21', 'M5V 3G9', 'Toronto', 'Ontario', 'CA', 43.64673, -79.39923),
    ('pressclubcocktailbar', 'Press Club', 'Basement record bar and cocktail lounge in Dupont Circle, opened in late 2024 by Will Patton, beverage director of Hive Hospitality, and DC native Devin Kennedy, formerly of Pouring Ribbons. Full albums spin on the turntables, menus come as record sleeves, and the dry, culinary drinks often use wine or sherry as modifiers, served with Japanese-leaning snacks. No. 34 on North America''s 50 Best Bars 2026.', 'https://www.pressclubdc.com/', 'Dupont Circle', '1506 19th St NW', '20036', 'Washington', 'District of Columbia', 'US', 38.91066, -77.04367),
    ('tiao_beijing', 'TIAO', 'Two-storey cocktail bar in Mandarin Oriental Qianmen, opened in May 2024 in the Caochang hutongs near Qianmen and named after Shitiao, the tenth alley. Bar and beverage manager Miranda Xu and head bartender Matt Guo write story-led menus; the current one, Worlds Apart, pairs moments from the hutong''s 450-year history with events elsewhere in the world. No. 50 on Asia''s 50 Best Bars 2026.', 'https://www.mandarinoriental.com/en/beijing/qianmen/dine/tiao', 'Qianmen, Dongcheng District', 'No. 1 Caochang Alley 10 (Caochang Shitiao), Mandarin Oriental Qianmen', '100005', 'Beijing', NULL, 'CN', 39.89461, 116.4035),
    ('gus_sipanddip', 'Gus'' Sip & Dip', 'River North tavern from Lettuce Entertain You that opened in late 2024 on the Hubbard Street site of Gus'' Good Food, a restaurant that ran from 1906 to 1966. Beverage director Kevin Beary and bar manager Scott Kitsmiller, both from Three Dots and a Dash and The Bamboo Room, pour 30 reworked classics at one flat price, walk-in only, beside dipped sandwiches from chef Bob Broskey. No. 27 on North America''s 50 Best Bars 2026.', 'https://gussipanddip.com/', 'River North', '51 W. Hubbard St., Suite 100', '60654', 'Chicago', 'Illinois', 'US', 41.88987, -87.63003),
    ('workshop14.hanoi', 'Workshop14', 'West Lake bar opened in early 2025 by architect Hieu Long, Cuong Nguyen and beverage director Rich McDonough (69 Colebrooke Row, Bar Termini) in a former architect''s studio in the old Nghi Tam weaving village; it calls itself Hanoi''s 14th craft village. A short list uses Vietnamese produce and lab techniques such as vacuum distillation and clarification. No. 34 on Asia''s 50 Best Bars 2026.', 'https://www.instagram.com/workshop14.hanoi/', 'Tay Ho', '6 Alley 5, Tu Hoa Street, Tay Ho District', NULL, 'Hanoi', NULL, 'VN', 21.05825, 105.83245),
    ('bartrigona', 'Bar Trigona', 'Bar in the Four Seasons Hotel Kuala Lumpur, opened in 2019 and named after the stingless bee whose kelulut honey runs through the menu. Beverage manager Rohan Matmary works with Malaysian farmers on a farm-to-glass programme, and the 2026 menu, Nectar of Time, moves from bright early-evening drinks to after-dark nightcaps. No. 38 on Asia''s 50 Best Bars 2026.', 'https://www.fourseasons.com/kualalumpur/dining/lounges/bar-trigona/', 'KLCC', 'Four Seasons Place, 145 Jalan Ampang', '50450', 'Kuala Lumpur', 'Federal Territory of Kuala Lumpur', 'MY', 3.15809, 101.71368),
    ('fomabar.mx', 'Form + Matter', 'Roma Norte bar opened in late 2024 by Handshake Speakeasy alumni David Rocha and José Olivas with restaurateur Po Tsai. A glass-walled lab with rotovap and centrifuge handles clarifications, fat washes and byproduct reuse, and custom steel stations let bartenders work facing guests; the menu is sorted by flavour and place rather than base spirit. No. 13 on North America''s 50 Best Bars 2026.', 'https://www.fomabar.com/', 'Roma Norte', 'San Luis Potosí 37 (entrance on Mérida)', '06700', 'Mexico City', NULL, 'MX', 19.41481, -99.15647),
    ('curenola', 'Cure', 'Freret Street bar opened in 2009 by Neal Bodenheimer, a New Orleans native who came home from New York after Hurricane Katrina; it is widely credited with starting the city''s modern craft cocktail revival and anchoring the street''s recovery. Seasonal menus credit each drink to its bartender, and it won the 2018 James Beard Award for Outstanding Bar Program. No. 21 on North America''s 50 Best Bars 2026.', 'https://www.curenola.com/', 'Uptown (Freret)', '4905 Freret St', '70115', 'New Orleans', 'Louisiana', 'US', 29.93502, -90.10748),
    ('bekeb_sma', 'Bekeb', 'San Miguel de Allende bar founded in 2019 by Jalisco-born bartender Fabiola Padilla, formerly of Cosme in New York; the name comes from the Tzotzil word for seed. Drinks are built on Mexican agave spirits, herbs, flowers and roots, and in 2025 the bar moved from a downtown terrace into the Live Aqua hotel, where its menu explores Mexican herbalism. No. 24 on North America''s 50 Best Bars 2026.', 'https://www.bekebsma.com/', 'Zona Centro', 'Calzada de la Presa 85, inside Hotel Live Aqua', '37700', 'San Miguel de Allende', 'Guanajuato', 'MX', 20.91982, -100.73922),
    ('venderbar', 'Vender', 'Taichung bar opened in 2019 by Summer Chen and Darren Lim after years bartending in Singapore. Guests insert a coin in a vending machine to open the door, get a mini Singapore Sling on arrival and choose from cocktails named after vending machines and built on Singaporean and Malaysian flavours such as kaya, durian and Milo. No. 14 on Asia''s 50 Best Bars 2026, also named The Best Bar in Taiwan.', 'https://www.instagram.com/venderbar/', 'West District', 'No. 118, Wuquan West 4th St', '403', 'Taichung', NULL, 'TW', 24.13557, 120.6625),
    ('librarybartoronto', 'Library Bar', 'Bar in the Fairmont Royal York, opened in the early 1970s in the room that once held the hotel''s guest library. It is known for the Birdbath Martini, thrown and poured ice cold at the table with house Quill gin or vodka. Director of beverage James Grant''s menu Lights draws each drink from Michael Ondaatje''s Toronto novel In the Skin of a Lion. No. 19 on North America''s 50 Best Bars 2026.', 'https://www.librarybartoronto.com/', 'Financial District', '100 Front St W, Fairmont Royal York', 'M5J 1E3', 'Toronto', 'Ontario', 'CA', 43.64558, -79.38203),
    ('servicebardc', 'Service Bar', 'U Street neighbourhood bar opened in 2016 by DC bartenders Chad Spangler and Glendon Hartley as a relaxed, affordable alternative to the city''s more formal cocktail rooms. It pairs a long, playful list of original drinks and a cheap weekday happy hour with a kitchen known for its fried chicken. No. 39 on North America''s 50 Best Bars 2026.', 'https://www.servicebardc.com/', 'U Street', '926-928 U St NW', '20001', 'Washington', 'District of Columbia', 'US', 38.91683, -77.02503)
) AS v("handle", "name", "bio", "website", "locality", "address_line", "postcode", "city", "region", "country_code",
       "latitude", "longitude")
-- Not a second copy of a bar someone already added (add_venue's rule).
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."profiles" p
    WHERE p.kind = 'bar' AND p.latitude BETWEEN v.latitude - 0.002 AND v.latitude + 0.002
      AND private.venue_name_key(p.display_name) = private.venue_name_key(v.name)
      AND private.distance_km(v.latitude, v.longitude, p.latitude, p.longitude) <= 0.15
)
ON CONFLICT ("handle") DO NOTHING;

-- --- Their places and awards ---

INSERT INTO "public"."profile_awards" ("profile_id", "award", "year", "position", "title", "source_url")
SELECT p.id, v.award, v.year::smallint, v.position::smallint, v.title::text, v.source_url
FROM (VALUES
    ('hopeandsesame', 'Asia''s 50 Best Bars', 2026, 1, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('zest.seoul', 'Asia''s 50 Best Bars', 2026, 2, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('barleonehk', 'Asia''s 50 Best Bars', 2026, 3, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('drywavecocktailstudio', 'Asia''s 50 Best Bars', 2026, 4, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('mobarshenzhen', 'Asia''s 50 Best Bars', 2026, 5, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('bar.us.bkk', 'Asia''s 50 Best Bars', 2026, 6, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('lennons.bkk', 'Asia''s 50 Best Bars', 2026, 7, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('boilermaker.goa', 'Asia''s 50 Best Bars', 2026, 8, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('jiggerandponysg', 'Asia''s 50 Best Bars', 2026, 9, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('obsidianbar_sz', 'Asia''s 50 Best Bars', 2026, 10, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('modernhausjkt', 'Asia''s 50 Best Bars', 2026, 11, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('nutmegandclove', 'Asia''s 50 Best Bars', 2026, 12, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('alice_cheongdam', 'Asia''s 50 Best Bars', 2026, 13, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('venderbar', 'Asia''s 50 Best Bars', 2026, 14, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('cosmopony.jkt', 'Asia''s 50 Best Bars', 2026, 15, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('offtrack.sg', 'Asia''s 50 Best Bars', 2026, 16, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('barsathorn', 'Asia''s 50 Best Bars', 2026, 17, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('soka_blr', 'Asia''s 50 Best Bars', 2026, 18, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('ponyupshanghai', 'Asia''s 50 Best Bars', 2026, 19, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('bkksocialclub', 'Asia''s 50 Best Bars', 2026, 20, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('carrots.jakarta', 'Asia''s 50 Best Bars', 2026, 21, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('gokan.hk', 'Asia''s 50 Best Bars', 2026, 22, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('punchroomtokyo', 'Asia''s 50 Best Bars', 2026, 23, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('coahongkong', 'Asia''s 50 Best Bars', 2026, 24, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('opm.bkk', 'Asia''s 50 Best Bars', 2026, 25, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('virtutokyo', 'Asia''s 50 Best Bars', 2026, 26, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('cmyk.china', 'Asia''s 50 Best Bars', 2026, 27, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('ralphsbarchengdu', 'Asia''s 50 Best Bars', 2026, 28, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('smoke.bitters', 'Asia''s 50 Best Bars', 2026, 29, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('barspiritforward.blr', 'Asia''s 50 Best Bars', 2026, 30, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('god_bkk', 'Asia''s 50 Best Bars', 2026, 31, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('threexco_kl', 'Asia''s 50 Best Bars', 2026, 32, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('bar.cham', 'Asia''s 50 Best Bars', 2026, 33, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('workshop14.hanoi', 'Asia''s 50 Best Bars', 2026, 34, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('infinitybeyond_tw', 'Asia''s 50 Best Bars', 2026, 35, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('mius.hongkong', 'Asia''s 50 Best Bars', 2026, 36, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('argobarhk', 'Asia''s 50 Best Bars', 2026, 37, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('bartrigona', 'Asia''s 50 Best Bars', 2026, 38, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('barlibre_ikebukuro', 'Asia''s 50 Best Bars', 2026, 39, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('thegoldentoothbar', 'Asia''s 50 Best Bars', 2026, 40, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('thehanjiapairingdinner', 'Asia''s 50 Best Bars', 2026, 41, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('mms_maltmixologyspace', 'Asia''s 50 Best Bars', 2026, 42, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('originbarsg', 'Asia''s 50 Best Bars', 2026, 43, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('problemchild_ph', 'Asia''s 50 Best Bars', 2026, 44, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('stregisbar_macao', 'Asia''s 50 Best Bars', 2026, 45, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('hudsonroomshanoi', 'Asia''s 50 Best Bars', 2026, 46, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('montanabarhk', 'Asia''s 50 Best Bars', 2026, 47, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('aquabarbangkok', 'Asia''s 50 Best Bars', 2026, 48, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('penicillin_bar', 'Asia''s 50 Best Bars', 2026, 49, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('tiao_beijing', 'Asia''s 50 Best Bars', 2026, 50, NULL, 'https://www.the50.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html'),
    ('sipandguzzlenyc', 'North America''s 50 Best Bars', 2026, 1, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('barmauromx', 'North America''s 50 Best Bars', 2026, 2, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('barsnack.nyc', 'North America''s 50 Best Bars', 2026, 3, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('schmuck.ny', 'North America''s 50 Best Bars', 2026, 4, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('tlecan', 'North America''s 50 Best Bars', 2026, 5, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('jewelnola', 'North America''s 50 Best Bars', 2026, 6, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('thekeeferbar', 'North America''s 50 Best Bars', 2026, 7, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('barpompette_to', 'North America''s 50 Best Bars', 2026, 8, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('superbuenonyc', 'North America''s 50 Best Bars', 2026, 9, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('elgalloaltanero', 'North America''s 50 Best Bars', 2026, 10, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('barkumiko', 'North America''s 50 Best Bars', 2026, 11, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('handshake_bar', 'North America''s 50 Best Bars', 2026, 12, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('fomabar.mx', 'North America''s 50 Best Bars', 2026, 13, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('truelaurelsf', 'North America''s 50 Best Bars', 2026, 14, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('theclementebar', 'North America''s 50 Best Bars', 2026, 15, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('fancycocktailbar', 'North America''s 50 Best Bars', 2026, 16, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('juneoncambie', 'North America''s 50 Best Bars', 2026, 17, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('mecenasbar', 'North America''s 50 Best Bars', 2026, 18, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('librarybartoronto', 'North America''s 50 Best Bars', 2026, 19, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('limantourmx', 'North America''s 50 Best Bars', 2026, 20, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('curenola', 'North America''s 50 Best Bars', 2026, 21, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('mothercocktailbar', 'North America''s 50 Best Bars', 2026, 22, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('martinys_nyc', 'North America''s 50 Best Bars', 2026, 23, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('bekeb_sma', 'North America''s 50 Best Bars', 2026, 24, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('kaitodelvalle', 'North America''s 50 Best Bars', 2026, 25, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('lafactoriapr', 'North America''s 50 Best Bars', 2026, 26, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('gus_sipanddip', 'North America''s 50 Best Bars', 2026, 27, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('mirate.losangeles', 'North America''s 50 Best Bars', 2026, 28, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('civwrksto', 'North America''s 50 Best Bars', 2026, 29, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('bisouschicago', 'North America''s 50 Best Bars', 2026, 30, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('angelssharenyc', 'North America''s 50 Best Bars', 2026, 31, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('prophecybar', 'North America''s 50 Best Bars', 2026, 32, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('overstory', 'North America''s 50 Best Bars', 2026, 33, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('pressclubcocktailbar', 'North America''s 50 Best Bars', 2026, 34, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('doublechickenpleasenyc', 'North America''s 50 Best Bars', 2026, 35, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('barmadonnabk', 'North America''s 50 Best Bars', 2026, 36, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('attaboy134', 'North America''s 50 Best Bars', 2026, 37, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('botanistdining', 'North America''s 50 Best Bars', 2026, 38, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('servicebardc', 'North America''s 50 Best Bars', 2026, 39, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('maisonpremiere', 'North America''s 50 Best Bars', 2026, 40, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('pch_sf', 'North America''s 50 Best Bars', 2026, 41, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('cafelatrovamiami', 'North America''s 50 Best Bars', 2026, 42, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('selvaoaxaca', 'North America''s 50 Best Bars', 2026, 43, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('daisy.losangeles', 'North America''s 50 Best Bars', 2026, 44, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('employeesonlyny', 'North America''s 50 Best Bars', 2026, 45, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('viceversamiami', 'North America''s 50 Best Bars', 2026, 46, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('bandistahouston', 'North America''s 50 Best Bars', 2026, 47, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('baltrabar', 'North America''s 50 Best Bars', 2026, 48, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('librarybytheseagc', 'North America''s 50 Best Bars', 2026, 49, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('bonvivantsbahamas', 'North America''s 50 Best Bars', 2026, 50, NULL, 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('hopeandsesame', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Asia', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('hopeandsesame', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Mainland China', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('zest.seoul', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Korea', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('barleonehk', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Hong Kong', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('jiggerandponysg', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Singapore', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('drywavecocktailstudio', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Thailand', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('punchroomtokyo', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Japan', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('venderbar', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Taiwan', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('boilermaker.goa', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in India', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('modernhausjkt', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Indonesia', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('threexco_kl', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Malaysia', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('smoke.bitters', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in Sri Lanka', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('problemchild_ph', 'Asia''s 50 Best Bars', 2026, NULL, 'The Best Bar in the Philippines', 'https://www.theworlds50best.com/bars/best-in-asia/awards/destination-awards.html'),
    ('mius.hongkong', 'Asia''s 50 Best Bars', 2026, NULL, 'Bartenders'' Bartender Award (Shelley Tai)', 'https://www.theworlds50best.com/bars/best-in-asia/awards/bartenders-bartender.html'),
    ('smoke.bitters', 'Asia''s 50 Best Bars', 2026, NULL, 'Art of Hospitality Award', 'https://www.theworlds50best.com/bars/best-in-asia/awards/art-of-hospitality-award.html'),
    ('kinsman.hk', 'Asia''s 50 Best Bars', 2026, NULL, 'Best Cocktail Menu Award', 'https://www.theworlds50best.com/bars/best-in-asia/awards/best-cocktail-menu.html'),
    ('mius.hongkong', 'Asia''s 50 Best Bars', 2026, NULL, 'Best Bar Design Award', 'https://www.theworlds50best.com/bars/best-in-asia/awards/best-bar-design.html'),
    ('workshop14.hanoi', 'Asia''s 50 Best Bars', 2026, NULL, 'Best New Opening Award', 'https://www.theworlds50best.com/bars/best-in-asia/awards/best-new-opening.html'),
    ('jiggerandponysg', 'Asia''s 50 Best Bars', 2026, NULL, 'Industry Icon Award (Indra Kantono)', 'https://www.theworlds50best.com/bars/best-in-asia/awards/industry-icon.html'),
    ('lennons.bkk', 'Asia''s 50 Best Bars', 2026, NULL, 'Highest New Entry Award', 'https://www.theworlds50best.com/bars/best-in-asia/awards/highest-new-entry-award.html'),
    ('barsathorn', 'Asia''s 50 Best Bars', 2026, NULL, 'Highest Climber Award', 'https://www.theworlds50best.com/bars/best-in-asia/awards/highest-climber-award.html'),
    ('coahongkong', 'Asia''s 50 Best Bars', 2026, NULL, 'Legend of the List Award', 'https://www.theworlds50best.com/bars/best-in-asia/awards/legend-of-the-list.html'),
    ('bar.us.bkk', 'Asia''s 50 Best Bars', 2026, NULL, 'Sustainable Bar Award', 'https://www.theworlds50best.com/bars/best-in-asia/awards/sustainable-bar-award.html'),
    ('sipandguzzlenyc', 'North America''s 50 Best Bars', 2026, NULL, 'The Best Bar in North America', 'https://www.theworlds50best.com/stories/News/north-americas-50-best-bars-2026-the-list.html'),
    ('sipandguzzlenyc', 'North America''s 50 Best Bars', 2026, NULL, 'The Best Bar in Northeast USA', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/destination-awards.html'),
    ('barmauromx', 'North America''s 50 Best Bars', 2026, NULL, 'The Best Bar in Mexico', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/destination-awards.html'),
    ('jewelnola', 'North America''s 50 Best Bars', 2026, NULL, 'The Best Bar in South USA', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/destination-awards.html'),
    ('truelaurelsf', 'North America''s 50 Best Bars', 2026, NULL, 'The Best Bar in West USA', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/destination-awards.html'),
    ('lafactoriapr', 'North America''s 50 Best Bars', 2026, NULL, 'The Best Bar in the Caribbean', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/destination-awards.html'),
    ('barkumiko', 'North America''s 50 Best Bars', 2026, NULL, 'The Best Bar in Midwest USA', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/destination-awards.html'),
    ('thekeeferbar', 'North America''s 50 Best Bars', 2026, NULL, 'The Best Bar in Canada', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/destination-awards.html'),
    ('elgalloaltanero', 'North America''s 50 Best Bars', 2026, NULL, 'Bartenders'' Bartender Award (Freddy Andreasson)', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/bartenders-bartender.html'),
    ('barkumiko', 'North America''s 50 Best Bars', 2026, NULL, 'Art of Hospitality Award', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/art-of-hospitality.html'),
    ('curenola', 'North America''s 50 Best Bars', 2026, NULL, 'Highest Climber Award', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/highest-climber.html'),
    ('barsnack.nyc', 'North America''s 50 Best Bars', 2026, NULL, 'Highest New Entry Award', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/highest-new-entry.html'),
    ('librarybartoronto', 'North America''s 50 Best Bars', 2026, NULL, 'Sustainable Bar Award', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/sustainable-bar.html'),
    ('schmuck.ny', 'North America''s 50 Best Bars', 2026, NULL, 'Best New Opening Award', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/best-new-opening.html'),
    ('jewelnola', 'North America''s 50 Best Bars', 2026, NULL, 'Industry Icon Award (Chris Hannah)', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/industry-icon.html'),
    ('handshake_bar', 'North America''s 50 Best Bars', 2026, NULL, 'Legend of the List Award', 'https://www.theworlds50best.com/bars/best-in-north-america/awards/legend-of-the-list.html')
) AS v("handle", "award", "year", "position", "title", "source_url")
JOIN "public"."profiles" p ON p.handle = v.handle AND p.kind = 'bar'
-- Same award already there under slightly different wording ("The Best Bar
-- in X" vs "Best Bar in X", with or without "Award").
WHERE v.title IS NULL OR NOT EXISTS (
    SELECT 1 FROM "public"."profile_awards" x
    WHERE x.profile_id = p.id AND x.award = v.award AND x.year = v.year::smallint
      AND regexp_replace(lower(x.title), '^the | award$', '', 'g') = regexp_replace(lower(v.title), '^the | award$', '', 'g')
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
    ('aquabarbangkok', NULL, 'Off The Duck''s Back', 'Palo santo-infused The Botanist gin with rosemary, matcha, bergamot and a soda-tonic top.', 'One of the late-night drinks on the Potions of the Garden menu, which is framed around the courtyard''s duck mascot. It layers woodsy smoke from palo santo with grassy matcha, and 50 Best notes it comes with crispy duck skin, a savoury wink at its name.

Sources: https://www.aquabangkok.com/our-menu, https://www.theworlds50best.com/bars/best-in-asia/the-list/aqua-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('aquabarbangkok', NULL, 'Pomelo''s Embrace', 'Phraya Gold rum with ruby pomelo, a Thai salad syrup, fresh lime and coconut milk.', 'A deliberately local drink built on Thai rum and pomelo, pitched by the bar as a morning ritual in a glass. 50 Best singles out the savoury pairing of fiery Esan sausage served alongside it.

Sources: https://www.aquabangkok.com/our-menu, https://www.theworlds50best.com/bars/best-in-asia/the-list/aqua-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('aquabarbangkok', NULL, 'Quill''s Midnight Spell', 'Altos tequila and mezcal with coconut cream, pineapple, chipotle mayo, Wild Honey No. 4 honey and lime.', 'The menu''s nightcap, named after the bar''s duck mascot: smoky agave softened by coconut and given gentle heat by chipotle mayo. It is served with spiced golden street-corn elote, echoing its flavours on the plate.

Sources: https://www.aquabangkok.com/our-menu, https://www.theworlds50best.com/bars/best-in-asia/the-list/aqua-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('aquabarbangkok', NULL, 'Dew Drop Whisper', 'Roku gin, elderflower liqueur and fresh lime, served in duck-footed glassware.', 'The lightest drink on the list, a crisp daytime sipper. Its glass, which stands on little duck feet, was made specifically for the drink and is the menu''s most photographed piece of theatre.

Sources: https://www.aquabangkok.com/our-menu, https://www.theworlds50best.com/bars/best-in-asia/the-list/aqua-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('aquabarbangkok', NULL, 'The Frog Prince''s Cup', 'Kakubin Japanese whisky with Malibu, pineapple, cucumber, shio koji and sesame oil.', 'A tropical highball-style drink that uses shio koji and sesame oil to add savoury depth, typical of the menu''s umami bent. The bar features it among its four headline signatures.

Sources: https://www.aquabangkok.com/our-menu', NULL, NULL, NULL, NULL, NULL),
    ('barspiritforward.blr', NULL, '3 Gin Vesper Martini', 'A Vesper built on three gins with its other spirits, pre-diluted, frozen and poured from an ice-cold bottle, finished with blue cheese olives.', 'The bar''s calling card: batching and freezing the whole drink means it reaches the glass at a temperature and dilution a stirred drink cannot match. 50 Best, Time Out and The Federal all single it out.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/bar-spirit-forward.html, https://www.the50.com/discovery/Establishments/India/Bangalore/Bar-Spirit-Forward.html', 'Vesper', NULL, NULL, NULL, NULL),
    ('barspiritforward.blr', NULL, 'Southern Star', 'Blanco tequila with bloom-fermented plum and guava, citrus and pickled jalapeno.', 'Named after the hotel it sits in and inspired by the Hotel Nacional, it swaps that drink''s rum and apricot for tequila and fermented fruit. The ferment and jalapeno give it a gentle, savoury heat.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/bar-spirit-forward.html, https://www.the50.com/discovery/Establishments/India/Bangalore/Bar-Spirit-Forward.html', NULL, NULL, NULL, NULL, NULL),
    ('barspiritforward.blr', NULL, 'Old Cuban', 'Rum, mint and citrus topped with prosecco.', 'The bar''s take on the modern classic that sits between a Mojito and a French 75. Critics count it among the comfort drinks the team executes with particular precision.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/bar-spirit-forward.html, https://www.timeout.com/bengaluru/bars-and-pubs/bar-spirit-forward', NULL, NULL, NULL, NULL, NULL),
    ('barkumiko', NULL, 'Bright One', 'Spirit-free sour of yuzu and lemon juice, honey syrup and a non-alcoholic botanical spirit, topped with ginger beer.', 'A long-running entry on Kumiko''s ''Spiritfrees'' list, the name Momosé uses for alcohol-free drinks she builds with the same care as cocktails. She shared a home version in 2026; the bar''s menu version uses Seedlip Spice 94 and Fever-Tree ginger beer.

Created by Julia Momosé.

Method: Shake lemon, yuzu, Seedlip and honey syrup with ice. Strain into a chilled coupe and top with ginger beer.
Honey syrup: Stir 2 tbsp clover or acacia honey into 1 tbsp hot water until dissolved.

Spec from Cornellians (Cornell alumni magazine) (https://alumni.cornell.edu/cornellians/momose-kumiko/).', NULL, NULL, 'Coupette', NULL, 'shake and top'),
    ('barkumiko', NULL, 'Protea', 'Spirit-free drink of adzuki bean syrup, purple sweet potato vinegar syrup, Seedlip Spice 94 and verjus rouge, topped with soda and tonic.', 'Shows how Momosé builds depth without alcohol: red bean paste gives body and the Japanese purple sweet potato vinegar (benimosu) gives acidity and colour. Still on the current Spiritfrees list.

Created by Julia Momosé.

Method: Shake Seedlip, verjus and both syrups with ice. Strain into a chilled coupe and top with club soda and tonic.
Adzuki syrup: Blend 400 g red bean paste and 200 g sugar with 200 g water until smooth.
Benimosu syrup: Blend 100 g purple sweet potato vinegar and 400 g sugar with 300 g water until smooth.

Spec adapted from Vitamix (adapted by StarChefs) (https://www.vitamix.com/ca/en_us/articles/julia-momose-of-kumiko-chicago).', NULL, NULL, 'Coupette', NULL, 'shake and top'),
    ('barkumiko', NULL, 'Julia Momosé''s Highball', 'Japanese pure malt whisky highball with mango brandy, mango vinegar and black cardamom-infused Sauternes, topped with soda.', 'Punch published it as an example of Momosé''s ingredient-led approach at Kumiko: a few quarter-measures of mango and spiced sweet wine reshape a classic Japanese highball. The cardamom Sauternes is a quick five-to-ten-minute infusion.

Created by Julia Momosé in 2018.

Method: Build everything except the soda in a Collins glass over cracked ice, then top with soda water.
Black cardamom Sauternes: Crack 5 g black cardamom pods, toast lightly, and while warm pour over a 375 ml bottle of room-temperature Sauternes. Steep 5 to 10 minutes, fine strain and refrigerate; keeps a week.

Spec from Punch (https://punchdrink.com/recipes/julia-momoses-highball/).', NULL, 2018, 'Highball', NULL, 'Build'),
    ('barkumiko', NULL, 'Sea Grape Martini', 'Roku gin with Albarino, Okinawan sea grapes and Kumiko''s shio-koji cucumber olive brine.', 'Kumiko''s answer to the dirty Martini: brine made with shio koji and cucumber, plus Okinawan sea grapes (umibudo), give salinity with a fruity edge instead of plain olive juice.

Sources: https://www.barkumiko.com/dining-room-and-bar', 'Martini', NULL, NULL, NULL, NULL),
    ('barkumiko', NULL, 'Yamazaki Vieux Carré', 'Yamazaki 12 year single malt with armagnac, 20-year oloroso sherry, Cocchi Vermouth di Torino, Benedictine and Peychaud''s and Angostura bitters.', 'A Japanese-whisky rebuild of the New Orleans classic, with oloroso sherry adding nutty depth. One of the premium signatures on the current dining room and bar list.

Sources: https://www.barkumiko.com/dining-room-and-bar', 'Vieux Carré', NULL, NULL, NULL, NULL),
    ('smoke.bitters', NULL, 'No. 23', 'Tequila with naarang (Sri Lankan sour citrus), falernum, passion fruit liqueur, Ceylon and kaffir lime bitters and a mezcal spray.', 'The bar''s signature, built around naarang, a local citrus somewhere between calamansi and lime that the team juices daily. Tropical spice from house falernum and a mezcal mist tie it to the bar''s tiki and smoke themes.

Sources: https://www.smokeandbitters.com/, https://www.the50.com/stories/News/smoke-and-bitters-art-of-hospitality-asias-50-best-bars-2026.html', NULL, NULL, NULL, NULL, NULL),
    ('smoke.bitters', NULL, 'Pamuditha''s Punch', 'A rum blend with Halmilla-wood arrack, absinthe, naarang, falernum, coconut Angostura bitters and bay leaf bitters.', 'A tiki-style punch that puts Sri Lankan coconut arrack alongside rum and uses local sour citrus and house bitters. 50 Best highlights it as a showcase of the bar''s local-first approach.

Sources: https://www.smokeandbitters.com/, https://www.theworlds50best.com/bars/best-in-asia/the-list/smoke-and-bitters.html', NULL, NULL, NULL, NULL, NULL),
    ('smoke.bitters', NULL, 'Pepper Pots', 'Gin with pineapple, spiced orgeat, cumin, pepper, chilli and spiced bitters.', 'A deliberately fiery drink that channels Sri Lankan spice-box flavours through a tiki template. Singled out by 50 Best in 2026 for its heat.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/smoke-and-bitters.html', NULL, NULL, NULL, NULL, NULL),
    ('smoke.bitters', NULL, 'Mai Chai', 'Chai-infused rum with triple sec, spiced orgeat, chai syrup and Elemakule tiki bitters.', 'A play on the Mai Tai that swaps in Ceylon tea spice: chai goes into both the rum and the syrup. It sits among the signatures on the bar''s own site and in Drinks International''s 2025 menu feature.

Sources: https://www.smokeandbitters.com/, https://drinksint.com/news/fullstory.php/aid/11604/Menu_of_the_month:_Smoke___Bitters.html', 'Mai Tai', NULL, NULL, NULL, NULL),
    ('smoke.bitters', NULL, 'Bananarama', 'Halmilla-wood arrack with smoked wild bee honey, banana peel, falernum, passion fruit and smoked hellfire bitters.', 'Uses wild honey from Sri Lanka''s jungles, smoked in-house, with banana peel to add fruit without waste. A good example of the bar pairing arrack with smoke.

Sources: https://www.smokeandbitters.com/', NULL, NULL, NULL, NULL, NULL),
    ('threexco_kl', NULL, 'Mellow Michel', 'Rye and bourbon with macadamia, sesame oil, oyster sauce, lemon and peanut candy.', 'From the Individuality 2.0 menu, where each drink is tied to a persona. It pushes a whiskey sour-style base toward savoury, nutty territory with oyster sauce and sesame oil, flavours from Malaysian Chinese home cooking.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/Three-X-Co.html, https://www.threexco.com/menu', NULL, NULL, NULL, NULL, NULL),
    ('threexco_kl', NULL, 'Naughty Nana', 'Bourbon with kokuto (Okinawan black sugar), banana liqueur, citrus, egg white and cocoa and aromatic bitters.', 'A playful banana-and-chocolate take on a whiskey sour, sweetened with kokuto rather than simple syrup. One of the personas highlighted by 50 Best from Individuality 2.0.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/Three-X-Co.html', 'Whiskey Sour', NULL, NULL, NULL, NULL),
    ('threexco_kl', NULL, 'Smokey Sierra', 'Mezcal and sloe gin with Campari, sweet vermouth, caramelised grapefruit and rosemary.', 'A smoky, fruit-led Negroni variation from the Individuality 2.0 menu, splitting the base between mezcal and sloe gin and adding caramelised grapefruit.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/Three-X-Co.html', 'Negroni', NULL, NULL, NULL, NULL),
    ('threexco_kl', NULL, 'Burung Malaya', 'Dark rum with house-made Guinness amaro, pineapple, lemon and honey.', 'A Malaysian twist on the Malaysian-born Jungle Bird: the team replaced Campari with a Guinness reduction for a chocolatey bitterness.

Sources: https://foodforthought.com.my/three-x-co-review/', 'Jungle Bird', NULL, NULL, NULL, NULL),
    ('threexco_kl', NULL, 'Balik Pulau', 'Nutmeg-infused Hendrick''s gin, clarified milk, lemon and saline, served with a Thai basil leaf filled with ginger, mace and nutmeg.', 'A clarified milk punch named after the Penang district famous for nutmeg, built to evoke Penang''s nutmeg juice. Guests sip, eat the stuffed basil leaf, then sip again.

Sources: https://foodforthought.com.my/three-x-co-review/', NULL, NULL, NULL, NULL, NULL),
    ('kaitodelvalle', NULL, 'Geisha', 'Tequila with Aperol, sake, grapefruit, strawberry, vanilla, pink peppercorn and citrus, finished with miso salt.', 'A headline signature from The Rising Sun Journal menu, cited by 50 Best in 2026. Miso salt adds a savoury Japanese note to a bright, fruity tequila drink.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/kaito-del-valle.html', NULL, NULL, NULL, NULL, NULL),
    ('kaitodelvalle', NULL, 'Tokyo Garibaldi', 'A Japanese twist on the Garibaldi made with sake and matcha.', 'Part of Kaito''s list of reworked classics, which swaps the Italian aperitivo''s usual profile for Japanese ingredients. 50 Best singles it out as an example of the twisted-classics section.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/kaito-del-valle.html', NULL, NULL, NULL, NULL, NULL),
    ('kaitodelvalle', NULL, 'Margarita Neko', 'Cristalino tequila with Cointreau, yuzu, kaffir lime, sencha, whey and green tea salt.', 'Named after the lucky cat that serves as the bar''s mascot, it reworks the Margarita with yuzu, green tea and whey for a softer, rounder texture.

Sources: https://www.eluniversal.com.mx/menu/kaito-del-valle-cocteleria-dirigida-solo-por-mujeres-llega-a-la-juarez/', 'Margarita', NULL, NULL, NULL, NULL),
    ('kaitodelvalle', NULL, 'Happosai', 'Espadín mezcal with Italicus, sake, Cocchi Americano, eucalyptus, palo santo and bergamot.', 'A signature from the post-move menu that pairs Mexican mezcal with sake and aromatic bergamot, reflecting the bar''s mix of Japanese culture and Mexican spirits.

Sources: https://www.eluniversal.com.mx/menu/kaito-del-valle-cocteleria-dirigida-solo-por-mujeres-llega-a-la-juarez/', NULL, NULL, NULL, NULL, NULL),
    ('angelssharenyc', NULL, 'Smoke Gets In Your Eyes', 'Bourbon stirred with sherry, Benedictine and bitters, served under a dome of woodsmoke.', 'A stalwart from the bar''s early years that returned with the reopening. The stirred, Old Fashioned-style drink arrives under a dome of woodsmoke, so the aroma hits before the first sip.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/Angels-share.html, https://timeout.com/newyork/bars/angels-share', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('angelssharenyc', NULL, 'Flirtibird', 'Barley shochu shaken with shiso leaf, yuzu juice and agave nectar, served with a plum salt rim over a large hand-cut cube.', 'Often credited with introducing shochu cocktails to New York. Punch described the result as something like a boozy salted plum soda, and it showcases the Japanese ingredients the bar made familiar long before they were common.

Sources: https://punchdrink.com/articles/review-angels-share-nyc-cocktail-bar-24-years-later/, https://en.wikipedia.org/wiki/Angel%27s_Share', NULL, NULL, NULL, NULL, NULL),
    ('angelssharenyc', NULL, 'Dirty Dancing', 'Gin with shiso-infused shochu, house-made pickle juice and Chinese onion essence.', 'A newer creation from the reopened bar that has built its own following. It plays on the savoury, briny idea of a dirty drink using pickle juice and allium rather than olive brine.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/Angels-share.html', NULL, NULL, NULL, NULL, NULL),
    ('angelssharenyc', NULL, 'Take You There', 'Butter fat-washed whiskey with pineapple, apple-spiced agave, coconut water, lemon, aquafaba and curry powder.', 'An example of the new menu''s technique-heavy style: fat washing for richness, aquafaba for foam and a dusting of curry for aroma. Time Out called it odd but completely logical.

Sources: https://timeout.com/newyork/bars/angels-share', NULL, NULL, NULL, NULL, NULL),
    ('alice_cheongdam', NULL, 'Hippity Hoppity', 'The current version mixes gin, ice wine, kiwi, camellia and dill; earlier versions of vodka, elderflower and aloe came in a rabbit-shaped tiki mug.', 'The bar''s long-running white rabbit drink, reworked with the seasons. The rabbit mug became one of Alice''s signature images, and 50 Best cites the 2026 version as a menu highlight.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/alice.html, https://www.the50.com/discovery/Establishments/South-Korea/Seoul/Alice-Cheongdam.html', NULL, NULL, NULL, NULL, NULL),
    ('alice_cheongdam', NULL, 'Did I Melt?', 'Vodka with grappa, coffee, tomato and chicory.', 'A Wonderland-themed drink that pairs coffee and chicory bitterness with savoury tomato, typical of the menu''s playful but technical style. Highlighted by 50 Best in 2026.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/alice.html', NULL, NULL, NULL, NULL, NULL),
    ('alice_cheongdam', NULL, 'Don Spectre', 'Jalapeño-infused reposado tequila stirred with mezcal, agave syrup and celeriac bitters, finished with pine needle smoke.', 'Owner Terry Kim''s own recipe, shared with The Pouring Tales: a spicy, smoky agave Old Fashioned with a vegetal edge from celeriac bitters.

Created by Terry Kim.

Method: Stir with ice and strain into a tumbler over ice.
Jalapeño-infused tequila: Infuse 3 sliced jalapeños in a bottle of reposado tequila.

Spec from The Pouring Tales (https://thepouringtales.com/don-spectre/).', 'Oaxaca Old Fashioned', NULL, 'Rocks', NULL, 'Stir'),
    ('thehanjiapairingdinner', NULL, 'Goat Mei-Mei', 'Kaoliang with goat''s cheese, strawberry, yoghurt, white cacao and white truffle.', 'Nono Yu''s stagecraft method in a glass: he pictures the finished drink first and works backwards. Strawberry and truffle share aroma compounds, so white truffle oil added at the table turns a strawberry cheesecake-like drink into something earthier.

Created by Nono Yu.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/the-han-jia.html, https://tutufoodaholic.tw/the-han-jia-pairing-dinner/', NULL, NULL, NULL, NULL, NULL),
    ('thehanjiapairingdinner', NULL, 'Long Island Iced Water', 'The bar''s playful take on a Long Island Iced Tea, garnished with a cola gummy clipped to the glass.', 'Shows the house sense of humour: the cola that normally tops a Long Island arrives as a gummy sweet instead. 50 Best mentions it as the bar''s idea of a garnish.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/the-han-jia.html', NULL, NULL, NULL, NULL, NULL),
    ('thehanjiapairingdinner', NULL, 'Platform 9 3/4', 'Whisky with elderflower, pear and grapefruit under a hop foam, inspired by Harry Potter''s butterbeer.', 'Originally a competition drink by the bar''s team, it riffs on the wizarding world''s butterbeer: hop foam gives a creamy, beer-like head, elderflower nods to wand wood and grapefruit adds the bitterness of beer.

Sources: https://tutufoodaholic.tw/the-han-jia-pairing-dinner/', NULL, NULL, NULL, NULL, NULL),
    ('mothercocktailbar', NULL, 'Toasted Chai Piña Colada', 'Lemongrass rum with toasted chai cream, caramelised yoghurt, pineapple juice, coconut sorbet and lacto-fermented pineapple and ginger.', 'One of Mother''s original hits, still listed among the drinks the bar calls part of its DNA. Fermented pineapple and caramelised yoghurt give it tang rather than plain sweetness; the 2019 opening menu already carried a lassi-inspired Piña Colada.

Created by Massimo Zitti.

Sources: https://motherdrinks.co/drinks, https://www.theworlds50best.com/bars/best-in-north-america/the-list/mother.html', 'Piña Colada', NULL, NULL, NULL, NULL),
    ('mothercocktailbar', NULL, 'Honey +', 'Reposado tequila and espadín mezcal with Ontario bee pollen, salted lavender honey and fresh citrus.', 'Listed first among Mother''s iconic house drinks. Local bee pollen and salted lavender honey give floral, savoury depth to a smoky agave sour.

Sources: https://motherdrinks.co/drinks', NULL, NULL, NULL, NULL, NULL),
    ('mothercocktailbar', NULL, 'Negroni Ristretto', 'Barrel-aged Canadian gin with an Italian vermouth blend, an Italian bitter blend and seasonal lacto-fermented fruit, infused with Colombian coffee beans.', 'From the barrel-aged section, where classics rest for up to six weeks. Coffee and fermented fruit turn it into a bittersweet coffee Negroni.

Sources: https://motherdrinks.co/drinks', 'Negroni', NULL, NULL, NULL, NULL),
    ('mothercocktailbar', NULL, 'Fading Silhouette', 'Spirit-free drink of plum and black cardamom with kombucha fizz and amaretto flavour.', 'Part of the Mirror Mirror menu, where alcoholic and alcohol-free drinks share the same hero ingredients. The house kombucha reflects the bar''s fermentation focus, and 50 Best cites it as one of the newer creations.

Sources: https://motherdrinks.co/drinks, https://www.theworlds50best.com/bars/best-in-north-america/the-list/mother.html', NULL, NULL, NULL, NULL, NULL),
    ('mothercocktailbar', NULL, 'Woodland Old Fashioned', 'American rye and smoky Islay Scotch with a sherry and port reduction, house woodland bitters, lacto-fermented Ontario grapes and cedar.', 'An early Mother signature that put local fermented fruit and forest aromatics into an Old Fashioned. It is no longer on the current list.

Sources: https://www.blogto.com/bars/mother-cocktail-bar-toronto/', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('barsathorn', NULL, 'Bangkok Brunch', 'Bloody Mary twist on mezcal and tequila with pad krapow flavours (bacon, Thai basil, chilli, pepper), salted tomato water and rice vinegar, chilled by a frozen tomato.', 'The bar''s most famous and most photographed drink: instead of ice, a whole frozen tomato sits in the glass and keeps it cold. It folds the flavours of Thailand''s everyday pad krapow into a savoury, clarified-style Bloody Mary, and the spent tomatoes go to compost for W Bangkok''s rooftop garden.

Ingredients from Bar Sathorn menu (https://www.barsathorn.com/menus). No measures have been published.', 'Bloody Mary', NULL, NULL, NULL, NULL),
    ('barsathorn', NULL, 'Staro Sbagliato', 'Two-tone Sbagliato of Campari, cardamom and Mancino Secco vermouth topped with sweet basil wine, carbonation and a caper and lemon sorbet.', 'Named for Madame Staro, the Italian who turned the mansion into the Hotel Royal in the 1920s. The sorbet of caper and lemon adds a savoury, herbal edge to the bittersweet classic and is singled out by 50 Best as an example of the bar''s archive-raiding approach.

Ingredients from Bar Sathorn menu (https://www.barsathorn.com/menus). No measures have been published.', 'Sbagliato', NULL, NULL, NULL, NULL),
    ('barsathorn', NULL, 'The Consular Sip', 'Hot-and-cold take on the Bullshot: Dewar''s 12 whisky with hot tom kha broth under a cold coconut and coriander foam.', 'A nod to the decades when the house was the Soviet, later Russian, embassy. Swapping beef bouillon for Thai tom kha soup and serving it hot beneath a chilled foam makes it the standout of the Embassy Row section, according to The Star''s review.

Ingredients from Bar Sathorn menu (https://www.barsathorn.com/menus). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('barsathorn', NULL, 'The Pina', 'Lighter Piña Colada built on Rémy Martin VSOP cognac with pickled pineapple and coconut hard seltzer, carbonated.', 'Replaces rum and cream with cognac, pickled pineapple and a coconut hard seltzer, turning the heavy tropical classic into a bright, fizzy serve. 50 Best calls it out as the pick for high rollers.

Ingredients from Bar Sathorn menu (https://www.barsathorn.com/menus). No measures have been published.', 'Piña Colada', NULL, NULL, NULL, NULL),
    ('barsathorn', NULL, 'Skyline Drift', 'Paper Plane riff of Maker''s Mark bourbon, Aperol, the bar''s own Apsara Thai amaro and kalamansi.', 'Uses Apsara, a Thai amaro made for Bar Sathorn, in place of Amaro Nonino, with kalamansi for the citrus. It sits in The Present section of the menu, which reworks modern classics with local ingredients.

Ingredients from Bar Sathorn menu (https://www.barsathorn.com/menus). No measures have been published.', 'Paper Plane', NULL, NULL, NULL, NULL),
    ('soka_blr', NULL, 'Mofo Don', 'Spicy tequila drink tinted pink with red cabbage and served with a cilantro-dusted rim.', 'A tongue-in-cheek tribute to the bar''s cabbage supplier, and one of the drinks on Soka''s opening list that is still singled out by 50 Best. The red cabbage gives it its colour as well as a vegetal note against the chilli heat.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/soka.html, https://www.inter-bev.com/bangalore-unveils-soka-an-artistic-haven-for-all-your-senses/', NULL, NULL, NULL, NULL, NULL),
    ('soka_blr', NULL, 'Soap & Jack', 'Mezcal with makrut lime, green smoked guava, curry leaves, chilli vinegar and lemon oil.', 'Pulls South Indian pantry staples (curry leaf, chilli vinegar, smoked guava) into a smoky mezcal sour-style drink, and is one of the two cocktails 50 Best highlights on the 2026 list.

Ingredients from Asia''s 50 Best Bars (ingredient list) (https://www.theworlds50best.com/bars/best-in-asia/the-list/soka.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('soka_blr', NULL, 'Made in Heaven', 'Tropical mix of aged rum and coconut rum with frozen strawberries, coconut milk, pineapple and acids.', 'A launch-menu tribute to famous partnerships, fitting for a bar named after its two founders. It uses acid adjustment rather than straight citrus to keep a creamy coconut and strawberry base bright.

Ingredients from Inter-Bev (launch menu) (https://www.inter-bev.com/bangalore-unveils-soka-an-artistic-haven-for-all-your-senses/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('soka_blr', NULL, 'Sakkath Martini', 'Martini of Bulldog gin, extra dry vermouth and Choya ume liqueur with a touch of herb tincture.', 'Billed at launch as the bar''s ''next-gen'' Martini, with a local-slang name. A splash of Japanese plum liqueur and an herbal tincture soften and perfume the dry classic.

Ingredients from Inter-Bev (launch menu) (https://www.inter-bev.com/bangalore-unveils-soka-an-artistic-haven-for-all-your-senses/). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('boilermaker.goa', NULL, 'Why Did The Onion Blush?', 'Gin with lychee, red onion, green chilli and yoghurt.', 'A savoury, clean-tasting drink that 50 Best picks out as an example of the bar''s complex-but-easy style: red onion and green chilli give it a chaat-like bite against sweet lychee and a soft yoghurt texture.

Ingredients from Asia''s 50 Best Bars (ingredient list) (https://www.theworlds50best.com/bars/best-in-asia/the-list/boilermaker.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('boilermaker.goa', NULL, 'Apple Of My Eye', 'Whisky highball made with red apples and bajra (pearl millet) soda.', 'Lengthens a fruity whisky highball with soda made from bajra (pearl millet), a traditional Indian grain. It is the second drink 50 Best names from the current list.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/boilermaker.html', NULL, NULL, NULL, NULL, NULL),
    ('boilermaker.goa', NULL, 'Midnight Brekkie', 'Smashable cocktail built on clarified watermelon juice, carried over from Bar Tesouro.', 'A crowd favourite brought across from Balachandran''s Bar Tesouro, and important enough to the new bar that a commissioned painting of it hangs on Boilermaker''s wall.

Sources: https://thenodmag.com/content/boilermaker-new-restaurant-bar-goa, https://www.thelabmagofficial.com/boilermaker-goas-hottest-new-bar/', NULL, NULL, NULL, NULL, NULL),
    ('boilermaker.goa', NULL, 'Siolim Salsa', 'Spicy sour of tequila, grapefruit, pineapple, gochujang and jalapeño.', 'Listed among the ''Sessionables'' on the opening menu, the savoury half of the list. Korean chilli paste and jalapeño turn a Paloma-like base into something closer to a salsa, named for the bar''s village.

Ingredients from The Nod Mag (ingredient list) (https://thenodmag.com/content/boilermaker-new-restaurant-bar-goa). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bandistahouston', NULL, 'Menage a Trois', 'Cognac with crème de cacao, coffee liqueur, local cream and cacao butter, served with made-to-order dipping dots.', 'The drink 50 Best uses to show off Bandista''s lab side: the team makes the frozen dipping dots to order, giving a dessert-like cognac drink a playful, textural side serve.

Ingredients from North America''s 50 Best Bars (ingredient list) (https://www.theworlds50best.com/bars/northamerica/the-list/bandista.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bandistahouston', NULL, 'Almost Famous', 'Mezcal with roasted pineapple, Mexican tea-infused génépy and Japanese amaro, served with a Polaroid.', 'An agave drink in keeping with the tequilero theme. Its listed final ingredient, ''paparazzi'', turns out to be a bartender taking the guest''s Polaroid, the kind of light touch the bar balances against serious technique.

Ingredients from North America''s 50 Best Bars (ingredient list) (https://www.theworlds50best.com/bars/northamerica/the-list/bandista.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bandistahouston', NULL, 'Dulce Far Niente', 'Tiramisu-inspired dessert cocktail finished with a mascarpone mousse.', 'Named by Secret Houston as one of the menu''s standouts, it turns the Italian dessert into a drink with a spoonable mascarpone topping.

Sources: https://secrethouston.com/bandista-htx-best-bars-na-2026/', NULL, NULL, NULL, NULL, NULL),
    ('bandistahouston', NULL, 'Writer''s Block 27', 'Bright gin drink with absinthe, pineapple, lime and cucumber.', 'The other standout Secret Houston names: a fresh, green gin sour lifted by a touch of absinthe.

Sources: https://secrethouston.com/bandista-htx-best-bars-na-2026/', NULL, NULL, NULL, NULL, NULL),
    ('daisy.losangeles', NULL, 'Guacamole Frozen Margarita', 'Frozen margarita of avocado, clarified Clamato, El Tesoro blanco tequila, damiana and lime.', 'The bar''s savoury slushie: clarified Clamato gives it salinity and a silky texture, and it belongs to the Salsa Bar section where Reis uses centrifuges and clarification. It is the drink press most often pictures.

Ingredients from Daisy menu (https://www.daisyla.com/cocteles). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('daisy.losangeles', NULL, 'Baja Slaw Margarita', 'Purple margarita of red cabbage, Mal Bien x Mírate espadín mezcal, Oaxacan fruit liqueur, pulque vinegar, lime and fish sauce.', 'Built to taste like a Baja fish taco with its cabbage slaw, down to a hit of fish sauce, and the most talked-about of the Salsa Bar margaritas. Its colour comes from the cabbage.

Ingredients from Daisy menu (https://www.daisyla.com/cocteles). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('daisy.losangeles', NULL, 'Mangoneada Margarita', 'Mango margarita with pasilla mixe chile, Derrumbes Cenizo mezcal, Oaxacan mango brandy, lime and chamoy, topped with mango boba.', 'Reis''s answer to guests who want a fruity margarita: it leans all the way into the mangonada street snack, with smoky chile, chamoy and popping mango boba.

Ingredients from Daisy menu (https://www.daisyla.com/cocteles). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('daisy.losangeles', NULL, 'Dirty Shirley Margarita', 'Tart cherry with a house ''Sprite'' cordial, Sonajero ponche, Granada Vallet and blanco tequila.', 'A margarita take on the viral Dirty Shirley, using a house lemon-lime style cordial and Mexican pomegranate liqueur in place of grenadine.

Ingredients from Daisy menu (https://www.daisyla.com/cocteles). No measures have been published.', 'Margarita', NULL, NULL, NULL, NULL),
    ('daisy.losangeles', NULL, 'Tommy''s Margarita', 'Tommy''s of Tromba blanco tequila (or Mal Bien x Mírate mezcal), lime and ''nogave'', a house agave-syrup substitute.', 'Guests who ask for a skinny margarita are steered here. Reis''s nogave sweetener replaces agave syrup, which he considers less sustainably made.

Ingredients from Daisy menu (https://www.daisyla.com/cocteles). No measures have been published.', 'Tommy''s Margarita', NULL, NULL, NULL, NULL),
    ('limantourmx', NULL, 'Margarita al Pastor', 'Tequila, Cointreau and lime with a ''taco mix'' of pineapple juice, serrano-infused agave, cilantro, mint and basil, in a cilantro-salt-rimmed glass.', 'Limantour''s signature and one of Mexico City''s most famous drinks, always on the menu and sold by the thousand. It translates the pineapple, herbs and chile of a taco al pastor into a savoury margarita.

Method: Rim a rocks glass with cilantro salt. Shake all ingredients with ice and strain into the glass over ice.
Taco Mix: Blend 1500 ml pineapple juice, 450 ml serrano chile-infused agave, 300 ml water, 90 g cilantro, 60 g mint and 60 g basil until smooth, then fine-strain.
Serrano chile-infused agave: Steep 60 g chopped green serrano in 200 ml water for 10 minutes, fine-strain, then mix with 660 g agave syrup. Keeps 3 days refrigerated.

Spec from PUNCH (recipe by José Luis León) (https://punchdrink.com/recipes/margarita-al-pastor/).', 'Margarita', NULL, 'Rocks', 'Cubes', 'Shake'),
    ('limantourmx', NULL, 'Orégano', 'Mezcal with Ancho Reyes chile liqueur, black tea, oregano and pineapple juice over a large cube, with a mint bouquet.', 'A long-standing house classic and León''s own favourite, according to the Aspen Times. It looks clear and simple like a Martini but drinks like an herb garden, with smoke from the mezcal and heat from the ancho liqueur.

Ingredients from Aspen Times (ingredient list) (https://www.aspentimes.com/news/bar-talk-licoreria-limantour/). No measures have been published.', NULL, NULL, NULL, 'Large Cube', NULL),
    ('barmadonnabk', NULL, 'Limoncello Milk Punch', 'Clarified milk punch of limoncello, Fords gin and Mijenta tequila with genmaicha and shiso.', 'The drink both 50 Best write-ups use to sum up the bar. Eric Madonna has said the Japanese tea and shiso are not Italian but the drink is, conceptually: a digestif rebuilt as a silky, clarified punch.

Method: Milk-clarified punch

Ingredients from Bar Madonna menu (https://barmadonna.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('barmadonnabk', NULL, 'Nonna''s Half & Half', 'Martini split between Bombay Sapphire gin and Altamura vodka, with Gran Basso and Bordiga Bianco vermouths.', 'The house Martini, named for a grandmother and built half gin, half vodka. 50 Best and Resy both single it out.

Ingredients from Bar Madonna menu (https://barmadonna.com/menu). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('barmadonnabk', NULL, 'Puttanesca Martini', 'Savoury Martini of Beefeater gin with olive, tomato, capers and anchovy.', 'Turns the classic pasta sauce into a dirty-Martini variation, a direct expression of the bar''s Italian-American theme.

Ingredients from Bar Madonna menu (https://barmadonna.com/menu). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('barmadonnabk', NULL, 'Don Fanucci', 'Michter''s bourbon and cognac with Faccia Alpino, olive oil, thyme and apricot.', 'Pairs American whiskey with French brandy and an Italian alpine liqueur, rounded with olive oil, thyme and apricot, in keeping with the bar''s Italian-American theme.

Ingredients from Bar Madonna menu (https://barmadonna.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bar.cham', NULL, 'Wonju', 'Mowallin rice spirit and mezcal with corn cream, corn silk, black pepper and egg yolk.', 'Named for the city where mowallin, an organic rice distillate, is made. 50 Best uses it to show how the bar joins Korean spirits with a new-world style, here a rich, peppery corn flip.

Ingredients from Asia''s 50 Best Bars (ingredient list) (https://www.theworlds50best.com/bars/asia/the-list/cham-bar.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bar.cham', NULL, 'Chungju Gimbap', 'Soju and makgeolli-wasabi shrub with cucumber, lemon and a drop of sesame oil.', 'Tastes like a seaweed rice roll in a glass: savoury, umami and bright. It is a long-running favourite that writers mention on return visits.

Ingredients from Barstalker (ingredient list) (https://barstalker.de/en/bar-cham/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bar.cham', NULL, 'Hamyang', 'Ghee-washed damsol rice spirit with Korean apple brandy, lemon, ginger and a peated Islay whisky.', 'Named for Hamyang county, it brings Scotch peat into a Korean rice-spirit sour, with ghee fat-washing for body.

Ingredients from Whisky Magazine (ingredient list) (https://whiskymag.com/articles/bar-guide-top-cocktail-spots-in-seoul-south-korea/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('infinitybeyond_tw', NULL, '(EARTH)²⁰²⁵', 'Signature built around pine needles, pink peppercorn and palo santo to evoke soil and forest.', 'One of the two signatures 50 Best names in 2026. It uses woody, resinous botanicals to capture the idea of Mother Earth within the bar''s planetary menu.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/to-infinity-and-beyond.html', NULL, NULL, NULL, NULL, NULL),
    ('infinitybeyond_tw', NULL, 'Σ(stars) = GALAXY', 'Red guava and jasmine-scented tea, served backlit to look like the night sky.', 'A visual showpiece: lighting from below makes the drink glow like a galaxy, matching the bar''s spaceship interior.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/to-infinity-and-beyond.html', NULL, NULL, NULL, NULL, NULL),
    ('infinitybeyond_tw', NULL, 'Comet', 'Miso, rose geranium and apricot with guava foam, topped with liquid-nitrogen ice cream.', 'Mixes savoury miso with floral and stone-fruit notes, finished with ice cream frozen tableside in liquid nitrogen. Cited by 50 Best Discovery as an example of the bar''s high-tech drinks.

Sources: https://www.the50.com/discovery/Establishments/Taiwan/Taipei/To-Infinity-and-Beyond.html', NULL, NULL, NULL, NULL, NULL),
    ('infinitybeyond_tw', NULL, 'Neptune', 'Yuzu and jasmine with clarified watermelon soda under a coconut air.', 'Part of a series named after the planets, pairing a clarified, carbonated watermelon soda with citrus, floral jasmine and a light coconut air.

Sources: https://www.the50.com/discovery/Establishments/Taiwan/Taipei/To-Infinity-and-Beyond.html', NULL, NULL, NULL, NULL, NULL),
    ('botanistdining', NULL, 'Botanist Marine Martini', 'Extra-dry Martini of a gin blend and house vermouth with kombu, chive oil and sea asparagus.', 'The bar''s signature, inspired by Vancouver''s wet weather: an extra-dry, briny Martini that tastes of the nearby coast through kelp and foraged sea asparagus, with a green drop of chive oil.

Ingredients from Botanist menu (https://www.botanistrestaurant.com/menu/cocktails/). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('botanistdining', NULL, 'Duck Duck Goose', 'Foie gras fat-washed Japanese whisky with sweet vermouth, pear, date, saline and bitters.', 'The priciest drink on the current list: fat-washing with foie gras gives a Manhattan-style stirred drink a rich, savoury texture, with pear and date for fruit.

Ingredients from Botanist menu (https://www.botanistrestaurant.com/menu/cocktails/). No measures have been published.', 'Manhattan', NULL, NULL, NULL, NULL),
    ('botanistdining', NULL, 'Carrot Boulevardier', 'Rye, Campari and vermouth with carrot cordial and nigella seed.', 'A garden take on the Boulevardier from the ''orchard and field'' section, where carrot cordial softens the bitter and nigella adds an oniony spice.

Ingredients from Botanist menu (https://www.botanistrestaurant.com/menu/cocktails/). No measures have been published.', 'Boulevardier', NULL, NULL, NULL, NULL),
    ('botanistdining', NULL, 'Beekeeper', 'Canadian rye with honey, lemon, candy cap mushrooms and yellow Chartreuse.', 'Opens the ''mountain and meadow'' section: candy cap mushrooms bring a maple-like sweetness to a honeyed rye sour, finished with herbal yellow Chartreuse.

Ingredients from Botanist menu (https://www.botanistrestaurant.com/menu/cocktails/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('drywavecocktailstudio', NULL, '1806-1988', 'A Super Classic that merges a bourbon Old Fashioned with a Cosmopolitan, with Kyoho grape liqueur softening the bourbon.', 'The bar''s flagship: 1806 marks the first printed definition of ''cocktail'' and 1988 the film Cocktail, so the name bookends two eras. It is the drink 50 Best and the press use to explain the Super Classics idea of combining two classics into a ''third wave''.

Created by Supawit ''Palm'' Muttarattana in 2024.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/dry-wave-cocktail-studio.html, https://www.theworlds50best.com/stories/News/dry-wave-one-to-watch-asias-50-best-bars-2024.html', 'Old Fashioned', 2024, NULL, NULL, NULL),
    ('drywavecocktailstudio', NULL, 'Morning Tijuana', 'A mezcal Margarita crossed with a Breakfast Martini, with a strawberry and bell pepper jam.', 'BK Magazine called it the bestselling underdog of the opening menu. The marmalade idea of the Breakfast Martini is swapped for a savoury-sweet strawberry and pepper jam against smoky mezcal.

Created by Supawit ''Palm'' Muttarattana in 2024.

Sources: https://www.theworlds50best.com/stories/News/dry-wave-one-to-watch-asias-50-best-bars-2024.html, https://www.bkmagazine.com/nightlife/dry-wave-serves-two-one-classics-crowd-loves-cocktails/', 'Margarita', 2024, NULL, NULL, NULL),
    ('drywavecocktailstudio', NULL, 'Love Birds in Venice', 'A Paloma and Bellini hybrid: tequila and grapefruit meet peach and prosecco.', 'One of the opening Super Classics, pairing a Mexican highball with a Venetian aperitivo so grapefruit and peach carry the drink. BK Magazine lists it as Love Bird in Venice; 50 Best as Love Birds in Venice.

Created by Supawit ''Palm'' Muttarattana in 2024.

Sources: https://www.theworlds50best.com/stories/News/dry-wave-one-to-watch-asias-50-best-bars-2024.html, https://www.bkmagazine.com/nightlife/dry-wave-serves-two-one-classics-crowd-loves-cocktails/', NULL, 2024, NULL, NULL, NULL),
    ('drywavecocktailstudio', NULL, 'Ready! Aim! Fire!', 'Blended malt Scotch with habanero, grapefruit, pomegranate, rue berry, pickle brine and egg white.', 'From the second Super Classics menu, it fuses a Pickleback Sour with a Mexican Firing Squad. 50 Best singled it out in the 2026 list write-up as proof of the bar''s bold reworking of familiar drinks.

Created by Supawit ''Palm'' Muttarattana in 2025.

Sources: https://www.chomp-magazine.com/post/super-classic-vol-2-dry-wave-cocktail-studio, https://www.theworlds50best.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html', NULL, 2025, NULL, NULL, NULL),
    ('drywavecocktailstudio', NULL, 'Newton''s Law', 'Scotch whisky with apricot, almond, fresh apple, oregano and tonka bean.', 'A Godfather crossed with an Apple Gimlet on the Vol. 2 menu. In 2026 the bar also turned it into an ice cream with Montagne, which 50 Best highlighted.

Created by Supawit ''Palm'' Muttarattana in 2025.

Sources: https://www.chomp-magazine.com/post/super-classic-vol-2-dry-wave-cocktail-studio, https://www.theworlds50best.com/bars/best-in-asia/the-list/dry-wave-cocktail-studio.html', NULL, 2025, NULL, NULL, NULL),
    ('cmyk.china', NULL, 'Smooth Operator', 'Bourbon with salted egg, pineapple, peanut butter, honey, sesame oil and lemon.', 'The drink 50 Best uses to show CMYK''s approach: rich, savoury Chinese pantry flavours such as salted egg and sesame oil turned into an easy-drinking sour.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/CMYK.html', NULL, NULL, NULL, NULL, NULL),
    ('librarybytheseagc', NULL, 'B612, for Consuelo', 'Gin with cacao distillate, rose water, hibiscus, Italicus, oloroso sherry, goat kefir and Cocchi di Torino.', 'Inspired by The Little Prince and named after Saint-Exupery''s wife, it is served in a handmade asteroid-shaped vessel. 50 Best named it one of 50 incredible cocktails to try worldwide and recommends it on the bar''s list page.

Created by Jim Wrigley and team.

Sources: https://www.theworlds50best.com/bars/northamerica/the-list/library-by-the-sea.html, https://www.theworlds50best.com/stories/News/50-incredible-cocktails-to-try-around-the-world.html', NULL, NULL, NULL, NULL, NULL),
    ('librarybytheseagc', NULL, 'E. Hemingway Special', 'A Hemingway Daiquiri made with 1930s rum and 1930s maraschino, fresh lime and grapefruit, in vintage glassware.', 'A 275 US dollar Rare & First Editions serve that uses vintage bottles to taste as the drink would have in Hemingway''s day. It arrives with a 1952 copy of Life magazine, which first printed The Old Man and the Sea.

Created by Jim Wrigley in 2023.

Sources: https://www.theworlds50best.com/bars/northamerica/the-list/library-by-the-sea.html, https://www.insidehook.com/cocktails/library-by-the-sea-cayman-cocktail-bar', 'Hemingway Daiquiri', 2023, NULL, NULL, NULL),
    ('librarybytheseagc', NULL, 'From Cayman, With Love', 'Martini-style drink of island-botanical sugarcane spirit, sea-mineral vermouth and a house tropical cordial.', 'A Bond nod honouring Quarrel, the Caymanian fisherman in Ian Fleming''s novels. Poured from a glass vessel into a ceramic oyster shell, with a Champagne-vinegar agar pearl onion; head bartender Max Wolff calls it the bar''s love letter to Cayman.

Sources: https://www.timeout.com/caribbean/hotels/this-exclusive-library-by-the-sea-on-grand-cayman-serves-cocktails-inspired-by-books, https://www.insidehook.com/cocktails/library-by-the-sea-cayman-cocktail-bar', 'Martini', 2023, NULL, NULL, NULL),
    ('carrots.jakarta', NULL, 'Kretek', 'Cacao and clove Wild Turkey 81 bourbon, cacao nib smoked Cinzano Rosso, tobacco bitters, chocolate and cloves.', 'Named after Indonesia''s clove cigarettes, it gives the smoky, spiced aroma of kretek without any smoke, fitting the bar''s smoke-free rule. 50 Best recommends it in the 2026 list; the menu files it under the Negroni style.

Sources: https://www.bar-carrots.com/menu, https://www.theworlds50best.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html', 'Negroni', NULL, NULL, NULL, NULL),
    ('carrots.jakarta', NULL, 'Baba Daiquiri', 'Vanilla Havana Club Anejo 3 Anos rum with lime, passion fruit and toasted milk.', 'A ''favourite from version 1'' of the signature menu, it shows the culinary side of the bar: toasted milk gives a silky, baked note to a classic Daiquiri frame.

Sources: https://www.bar-carrots.com/menu, https://www.theworlds50best.com/bars/best-in-asia/the-list/carrots-bar.html', 'Daiquiri', NULL, NULL, NULL, NULL),
    ('carrots.jakarta', NULL, 'Zen Chapel', 'Sencha-infused Malfy con Limone gin, salted fino sherry and apple cordial.', 'A tea-led take on the Bamboo style, one of the early favourites kept on the current menu.

Sources: https://www.bar-carrots.com/menu', 'Bamboo', NULL, NULL, NULL, NULL),
    ('carrots.jakarta', NULL, 'No Big Dill', 'Altos Plata tequila with dill, sweet potato, salted egg, lacto-fermented cucumber foam, fino sherry and carbonation.', 'A savoury, umami fizz from the Signatures 2.0 list that leans on Indo-Chinese kitchen ingredients such as salted egg, a thread 50 Best highlights in the bar''s R&D.

Sources: https://www.bar-carrots.com/menu, https://www.theworlds50best.com/bars/best-in-asia/the-list/carrots-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('stregisbar_macao', NULL, 'Maria do Leste', 'The hotel''s Bloody Mary with chorizo, pink peppercorn, piri piri and Chinese black vinegar, served with a mini egg tart.', 'Every St. Regis makes its own version of the Bloody Mary, which the brand traces to the King Cole Bar in New York in 1934; Macau''s mixes Portuguese and Chinese flavours to reflect the city''s east-meets-west culture. 50 Best calls it the drink regulars and first-timers alike order.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/the-st-regis-bar-macau.html, https://www.thestregisbarmacao.com/', 'Bloody Mary', NULL, NULL, NULL, NULL),
    ('stregisbar_macao', NULL, 'Garnet Sour', 'Rye whiskey, fig leaf, Cointreau, lemon, aloe vera and ruby port.', 'A New York Sour twist where ruby port takes the place of the red wine float, nodding to Portuguese immigration to the northeastern United States in the late 1940s.

Created by Kevin Lai.

Sources: https://thestregismacao.qrd.by/theartofconcoctionmenu, https://www.theworlds50best.com/bars/best-in-asia/the-list/the-st-regis-bar-macau.html', 'New York Sour', NULL, NULL, NULL, NULL),
    ('stregisbar_macao', NULL, 'Modern Art', 'Speyside gin, elderflower liqueur, fino sherry, guava shrub and lime.', 'A bright, sherry-dry sour inspired by New York''s Museum of Modern Art, named by 50 Best as one of the bar''s referential signatures.

Created by Kevin Lai.

Sources: https://thestregismacao.qrd.by/theartofconcoctionmenu, https://www.theworlds50best.com/bars/best-in-asia/the-list/the-st-regis-bar-macau.html', NULL, NULL, NULL, NULL, NULL),
    ('stregisbar_macao', NULL, 'Macao Egg Tart', 'Dark rum with toasted bread, caramel, advocaat, condensed milk, cream and milk washing.', 'A liquid version of Macau''s Portuguese egg tart, clarified with milk and garnished with a flower-shaped sweet crisp.

Created by Kevin Lai.

Sources: https://thestregismacao.qrd.by/theartofconcoctionmenu', NULL, NULL, NULL, NULL, NULL),
    ('stregisbar_macao', NULL, 'Disco Sazerac', 'Cognac, rye, Champagne syrup, absinthe, peach bitters and edible glitter.', 'A Studio 54-themed take on the Sazerac from the New York, New York menu, adding Champagne and peach to the classic''s cognac-rye base.

Sources: https://thestregismacao.qrd.by/nynymenu', 'Sazerac', NULL, NULL, NULL, NULL),
    ('mirate.losangeles', NULL, 'El Guero', 'A margarita with aguachile, nopal granita, coconut and avocado-washed Don Fulano Fuerte tequila.', 'Named after the Mariscos El Guero stand in Ensenada, it turns a seafood aguachile into a margarita and has been the most popular drink since opening. 50 Best calls it the fan favourite, garnished with cucumber-kelp caviar; the spec keeps evolving.

Created by Max Reis.

Sources: https://www.mirate.la/bebida, https://www.theworlds50best.com/bars/northamerica/the-list/Mirate.html', 'Margarita', NULL, NULL, NULL, NULL),
    ('mirate.losangeles', NULL, 'Tu Compa', 'A carbonated Paloma of Cascahuín tequila, pulque, Nami junmai ginjo sake, Granada Vallet and house ''Squirt'', in a glass half-painted with pulque.', 'A three-day batch that rebuilds Squirt soda from centrifuged grapefruit, carbonates the whole drink and paints the glass with salted pulque. VinePair called it a revelation, and it is also sold canned.

Created by Max Reis.

Squirt cordial: Blend clarified grapefruit juice with an equal weight of sugar, citric and malic acid and salt, then cook sous vide at 135F for 2 hours with grapefruit peel; strain.
Grapefruit spray: Dilute grapefruit essential oil in 200-proof ethanol (1:9 by weight) in an atomiser.
Pulque paint: Blend pulque with titanium dioxide and salt, then thicken with Ultra-Tex 8; keep refrigerated.

Ingredients from StarChefs (https://www.starchefs.com/recipes/tu-compa). No measures have been published.', 'Paloma', NULL, 'Highball', 'Spear', NULL),
    ('mirate.losangeles', NULL, 'El Tocayo', 'An Oaxaca Old Fashioned of El Tesoro x Mírate reposado and Mal Bien x Mírate espadín with house mole bitters, ''nogave'' and sal de chapulín.', 'Shows the bar''s sourcing: both spirits are Mírate-exclusive bottlings, and ''nogave'' is Reis''s more sustainable agave-nectar substitute. Imbibe featured it in its menu profile.

Created by Max Reis.

Sources: https://www.mirate.la/bebida, https://imbibemagazine.com/on-the-menu-mirate-los-angeles/', 'Oaxaca Old Fashioned', NULL, NULL, NULL, NULL),
    ('mirate.losangeles', NULL, 'El Caminante', 'Alambique Serrano x Mírate rum blend with tepache perfume, Mexican red bitter, lime cordial and blackstrap molasses.', 'The menu frames it as its Jungle Bird, swapping Campari for a Mexican red bitter and scenting the drink with fermented pineapple tepache.

Created by Max Reis.

Sources: https://www.mirate.la/bebida', 'Jungle Bird', NULL, NULL, NULL, NULL),
    ('mirate.losangeles', NULL, 'La Tóxica', 'An espresso-martini-style drink with mazapán-washed Sierra Norte red corn whiskey, cold brew, pasita, crema de sotol, Fernet Vallet and Mexican Coke.', 'Reworks the Espresso Martini with Mexican spirits and sweets, including mazapán fat-washing, as Imbibe noted.

Created by Max Reis.

Sources: https://www.mirate.la/bebida, https://imbibemagazine.com/on-the-menu-mirate-los-angeles/', 'Espresso Martini', NULL, NULL, NULL, NULL),
    ('selvaoaxaca', NULL, 'Selva', 'Alipús Santa Ana mezcal with hoja santa, lemon, agave syrup, Ancho Reyes Verde, juniper bitters, and a quesillo and basil element.', 'The bar''s namesake, billed as ''Selva in a glass'' among the Selva Icons that never left the menu. Oaxacan string cheese and hoja santa make it taste of the region.

Created by Alexandra Purcaru.

Sources: https://selvaoaxaca.com/s/26-SELVA-MENU-KIT.pdf', NULL, NULL, NULL, NULL, NULL),
    ('selvaoaxaca', NULL, 'Miahuatlán', 'Alipús San Andrés mezcal, oloroso sherry, Cynar and shiitake mushroom.', 'Named after the mountain town in southern Oaxaca, it pairs earthy mushroom with bitter artichoke amaro. 50 Best uses it to illustrate the bar''s place-based menu.

Sources: https://selvaoaxaca.com/s/26-SELVA-MENU-KIT.pdf, https://www.theworlds50best.com/bars/northamerica/the-list/selva.html', NULL, NULL, NULL, NULL, NULL),
    ('selvaoaxaca', NULL, 'Virgen de Guadalupe', 'Selva tomato juice with celery cordial, lemon, chilli tincture and garum from Labo Fermento, with mezcal, vodka, gin or no alcohol.', 'A savoury Selva Icon that builds its umami from a local ferment lab''s garum; it can be ordered alcohol-free.

Sources: https://selvaoaxaca.com/s/26-SELVA-MENU-KIT.pdf', 'Bloody Mary', NULL, NULL, NULL, NULL),
    ('selvaoaxaca', NULL, 'Star Martini', 'Siete Misterios Doba-Yej mezcal with passion fruit, lemon, agave honey and prosecco.', 'A mezcal take on the Porn Star Martini, kept on the menu as one of the Selva Icons.

Sources: https://selvaoaxaca.com/s/26-SELVA-MENU-KIT.pdf', 'Porn Star Martini', NULL, NULL, NULL, NULL),
    ('selvaoaxaca', NULL, 'Tropical', 'Johnnie Walker Black Label with Mexican agricultural rum, Italian mint liqueur, banana liqueur, rice vinegar and corn miso.', 'Created by Italian-born, French-educated Alexandra Purcaru to reflect her mixed roots, with each ingredient''s origin (Mexico, Italy, Asia) named in the spec; the full recipe ran in Revista Central in 2024.

Created by Alexandra Purcaru.

Spec from Revista Central (https://www.revistacentral.com.mx/comida/alexandra-purcaru-rompe-barreras-genero-y-llega-a-los-50-best-nuevo).', NULL, NULL, NULL, NULL, NULL),
    ('mms_maltmixologyspace', NULL, 'Yama', 'A carbonated sour built on sour kimchi broth with tuna fish sauce, fermented kiwi and anchovy soup.', 'The bar''s boldest ferment-driven drink and the one 50 Best tells you to toast with; it turns Korean kitchen staples into a sparkling cocktail.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/MMS-bar.html, https://www.theworlds50best.com/stories/News/asias-50-best-bars-2026-the-list-revealed.html', NULL, NULL, NULL, NULL, NULL),
    ('mms_maltmixologyspace', NULL, 'Mogwa Atteseo?', 'A martini of quince from the tree in the bar''s garden, house-fermented pear and wild kiwi wine, and koji.', 'An all-time favourite that uses fruit grown on site and the team''s own ferments in place of vermouth.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/MMS-bar.html', 'Martini', NULL, NULL, NULL, NULL),
    ('mms_maltmixologyspace', NULL, 'Heliot Emil', 'A drink modelled on a Copenhagen smoked salmon sandwich, with soy, dill and wasabi.', 'Part of the experimental side of the list that translates dishes from other cities into cocktails.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/MMS-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('mms_maltmixologyspace', NULL, '032C', 'Sausage-washed Jägermeister with turmeric and orange custard, a dessert take on Berlin currywurst.', 'Named after the Berlin magazine and its BTS RM cover, it fat-washes Jägermeister with sausage.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/MMS-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('mms_maltmixologyspace', NULL, 'Green Fro ''Gang''', 'A cocktail fermented like a beer, landing between wine and lager.', 'Shows the ''malt'' half of the concept: the drink itself is brewed rather than mixed.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/MMS-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('barlibre_ikebukuro', NULL, 'Samurai Penicillin', 'Johnnie Walker Blue Label with shiso kombucha and honey.', 'A Japanese rework of the modern classic Penicillin, swapping ginger heat for fermented shiso; 50 Best cites it as an example of the menu''s Japanese twists.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/bar-libre.html', 'Penicillin', NULL, NULL, NULL, NULL),
    ('barlibre_ikebukuro', NULL, 'Soba Tea Screwdriver', 'The bar''s twist on the Screwdriver made with toasted soba tea.', '50 Best picked out this toasty, native-ingredient take on the most basic of highballs when the bar entered the list in 2025.

Sources: https://www.theworlds50best.com/stories/News/asias-50-best-bars-2025-the-list-revealed.html', NULL, NULL, NULL, NULL, NULL),
    ('barlibre_ikebukuro', NULL, 'Mr D', 'Scotch whisky, Disaronno, amaro, lemon, honey and muddled fresh ginger, stirred.', 'Created by owner Yuujirou Kiyosaki for the 2021 Disaronno Bar Tag fundraiser with 50 Best; a herbal, stirred cousin of the Penicillin.

Created by Yuujirou Kiyosaki in 2021.

Method: Muddle the ginger and honey in a mixing glass, add ice and the remaining ingredients, stir until chilled and strain.

Spec from The World''s 50 Best Bars (https://www.theworlds50best.com/stories/News/disaronno-bar-tag.html).', 'Penicillin', 2021, 'Rocks', NULL, 'muddle and shake'),
    ('juneoncambie', NULL, 'Burnt Gibson', 'A freezer Gibson of Beefeater gin and dry vermouth with persimmon mignonette and an Islay whisky mist.', 'The drink that made June''s name: an oyster-bar mignonette and peated Scotch make the Gibson savoury and smoky. 50 Best calls it an instant viral classic; it is poured straight from the freezer.

Created by Amber Bruce, Satoshi Yonemori and Riley Maggs in 2025.

Sources: https://juneoncambie.com/menu/, https://www.theworlds50best.com/bars/northamerica/the-list/june-on-cambie.html', 'Martini', 2025, NULL, NULL, NULL),
    ('juneoncambie', NULL, 'Buck Naked', 'A Naked and Famous riff with tart house-made sea buckthorn liqueur, served at the basement bar Lala.', '50 Best highlights it as the kind of drink the hidden cocktail lab behind Lala''s wall produces.

Sources: https://www.theworlds50best.com/bars/northamerica/the-list/june-on-cambie.html', 'Naked and Famous', NULL, NULL, NULL, NULL),
    ('juneoncambie', NULL, 'Sunflower Punch', 'Pernod, fino sherry, tarragon, sunflower seed and lemon, clarified with milk and carbonated.', 'A bright, anise-led milk punch that is clarified and then carbonated, also poured in a smaller happy-hour size. Scout Magazine tried a sunflower drink, the Sunflower Mauresque, at opening.

Sources: https://juneoncambie.com/menu/, https://scoutmagazine.ca/inside-june-cambies-coolest-new-brasserie-delivers-bold-cocktails-big-talent-and-seriously-good-food/', NULL, 2025, NULL, NULL, NULL),
    ('juneoncambie', NULL, 'ABC Sour', 'Disaronno, Canadian Club 100% rye, Frangelico, barley corn hojicha, maple, lemon and egg white.', 'An amaretto sour built out with nutty roasted-tea and maple notes, one of the drinks on the opening list.

Sources: https://juneoncambie.com/menu/, https://scoutmagazine.ca/inside-june-cambies-coolest-new-brasserie-delivers-bold-cocktails-big-talent-and-seriously-good-food/', NULL, 2025, NULL, NULL, NULL),
    ('juneoncambie', NULL, 'Executive Martini', 'Parmesan and Comté-washed Grey Goose vodka with gordal olive brine, served with Caesar chips.', 'A cheese-washed dirty martini served with Caesar chips, one of the richer serves on the current list.

Sources: https://juneoncambie.com/menu/', 'Martini', NULL, NULL, NULL, NULL),
    ('god_bkk', NULL, 'Uni Martini', 'An ice-cold, pre-batched freezer Martini served with a scoop of bafun uni on the back of the hand and a hay-smoked olive.', 'It opened the bar''s uni chapter and the menu itself calls it an excessive way to take a Martini. The batch lives in the freezer so it lands almost slushy, and the menu scripts the order: uni, sip, smoked olive, sip again.

Sources: https://thedotmagazine.com/g-o-d-bar-bangkok-is-the-work-of-genius-on-drugs/, https://www.theworlds50best.com/bars/best-in-asia/the-list/god-bangkok.html', 'Martini', 2024, NULL, NULL, NULL),
    ('god_bkk', NULL, 'Oyster Martini', 'A Martini paired with a Fine de Claire No. 2 oyster dressed in coconut and dill vinaigrette, with a slice of coppa.', 'Leads the oyster chapter of the menu, where each drink is built around a matched oyster bite rather than a garnish, a pairing format that defines G.O.D.

Sources: https://thedotmagazine.com/g-o-d-bar-bangkok-is-the-work-of-genius-on-drugs/, https://www.theworlds50best.com/bars/best-in-asia/the-list/god-bangkok.html', 'Martini', 2024, NULL, NULL, NULL),
    ('god_bkk', NULL, 'Salted Cacao Negroni', 'A Negroni of cacao nib distillate, Campari and a cacao juice vermouth, served with a bite of chocolate, uni and black charcoal salt.', 'The chocolate note is built into the drink twice, through a clear cacao distillate and a vermouth made with cacao juice, then echoed by an unlikely chocolate and sea urchin pairing.

Sources: https://www.chomp-magazine.com/post/bangkok-bar-g-o-d, https://thedotmagazine.com/g-o-d-bar-bangkok-is-the-work-of-genius-on-drugs/', 'Negroni', 2024, NULL, NULL, NULL),
    ('god_bkk', NULL, 'The Only Vesper Martini', 'A Vesper of vintage vodka distilled with peach stem and Lillet Sauvage, paired with bafun uni on a rice pillow filled with ikura.', 'Part of the uni pairing chapter, it reworks the Vesper with a house-distilled vodka and a rice, roe and ponzu bite to set the creamy uni against the crisp drink.

Sources: https://www.chomp-magazine.com/post/bangkok-bar-g-o-d', 'Vesper', 2024, NULL, NULL, NULL),
    ('god_bkk', NULL, 'Rice & Shrine', 'Thai tea gin with mandarin saccharum, citric acid, banana vinegar and coffee.', 'Named by 50 Best as a highlight of the ''excessive is necessary'' chapter in 2026, it shows the bar''s habit of taming loud ingredients like banana vinegar into a balanced drink, alongside its matched bite.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/god-bangkok.html, https://thedotmagazine.com/g-o-d-bar-bangkok-is-the-work-of-genius-on-drugs/', NULL, NULL, NULL, NULL, NULL),
    ('ralphsbarchengdu', NULL, 'The Canyon', 'Cardamom-infused Michter''s bourbon with tawny port, Campari and Mr Black coffee liqueur.', 'A bittersweet, coffee-edged bourbon stirrer from the American West menu Hope & Sesame built for the bar; 50 Best singles it out first among the signatures.

Created by Ralph''s Bar with Hope & Sesame.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/ralphs-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('ralphsbarchengdu', NULL, 'Frontier Oak', 'Michter''s bourbon made earthy with sandalwood, bay leaf and black walnut.', 'Uses the same bourbon base as the Canyon but pushes it toward woody, warm aromatics, a showcase of Hope & Sesame''s layered style applied to a tavern menu.

Created by Ralph''s Bar with Hope & Sesame.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/ralphs-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('ralphsbarchengdu', NULL, 'Whispering Pine', 'Torres 10-year brandy with pine, honey, raspberry and cherry bitters.', 'The brandy entry on the West-themed list, pairing forest pine with red fruit; 50 Best calls it the menu''s case for brandy.

Created by Ralph''s Bar with Hope & Sesame.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/ralphs-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('ralphsbarchengdu', NULL, 'Ol'' Pal', 'Michter''s rye with Suze, Aperol and dry vermouth.', 'A bittersweet take on the rye, dry vermouth and bitter-aperitif Old Pal template, swapping in Suze and Aperol for a lighter, gentian-driven profile.

Created by Ralph''s Bar with Hope & Sesame.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/ralphs-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('elgalloaltanero', NULL, 'Jalisco Old Fashioned', 'Tequila and mezcal stirred with agave nectar and cacao bitters.', 'One of the few fixtures on a menu that otherwise changes constantly, it is the bar''s house take on the split-base agave Old Fashioned and a showcase for its independent tequila and mezcal bottlings.

Sources: https://www.theworlds50best.com/bars/northamerica/the-list/el-gallo-altanero.html', 'Oaxaca Old Fashioned', NULL, NULL, NULL, NULL),
    ('elgalloaltanero', NULL, 'Fandango', 'Reposado tequila stirred with fino sherry, dry vermouth and a touch of agave syrup, garnished with olive or lemon peel.', 'Freddy Andreasson''s tequila take on the Bamboo: meant as a low-proof aperitif, it ended up stronger, with fino and vermouth keeping the reposado dry and saline. Guests choose olive or lemon peel to tilt it salty or bright.

Created by Freddy Andreasson.

Method: Stir with ice, strain into a chilled glass and add your chosen garnish.

Spec from Decanter (https://www.decanter.com/spirits/distilled-us-whiskey-news-and-how-to-make-a-fandango-cocktail/).', 'Bamboo', NULL, 'Nick & Nora', NULL, 'Stir'),
    ('cosmopony.jkt', NULL, 'Tequila Vesper', 'A Vesper with tequila in place of vodka, plus fortified wine, coconut water and smoked Nocellara olives.', 'Flagship of the second menu, Cocktail Power, and the drink the bar''s own site leads with. Coconut water and smoked olives give the stirred classic a Jakarta accent.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/cosmo-pony.html, https://www.cosmopony.com/en', 'Vesper', NULL, NULL, NULL, NULL),
    ('cosmopony.jkt', NULL, 'Ugly Bananas', 'A whisky sour built on whisky infused with overripe bananas, with jasmine tea and a baked banana-peel jelly garnish.', 'A waste-conscious drink that uses bananas too black to sell, nodding to Indonesia''s huge banana crop. The peels are baked into a caramel-toned jelly that mimics the fruit''s dark spots; it is a Jakarta cousin of Jigger & Pony''s tomato-based sour.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/cosmo-pony.html, https://88bamboo.co/blogs/escapades/cosmo-pony-opens-its-doors-in-jakarta-what-to-expect-at-this-convivial-bar-with-cosmopolitan-soul', 'Whiskey Sour', 2024, NULL, NULL, NULL),
    ('cosmopony.jkt', NULL, 'Tequila Cosmo', 'A Cosmopolitan reworked with Don Julio Blanco tequila, Cointreau, lime and roselle, finished as an oat milk punch with smoked orange.', 'The bar''s namesake opening signature: local roselle stands in for cranberry and a smoked orange finish salutes Dale DeGroff''s flamed-zest version.

Sources: https://88bamboo.co/blogs/escapades/cosmo-pony-opens-its-doors-in-jakarta-what-to-expect-at-this-convivial-bar-with-cosmopolitan-soul, https://www.thespiritsbusiness.com/2024/07/cosmo-pony-opens-in-jakarta/', 'Cosmopolitan', 2024, NULL, NULL, NULL),
    ('cosmopony.jkt', NULL, 'Mithai', 'A Brandy Alexander riff of Martell cognac, shochu, toasted coconut cream and pistachio.', 'Named for Indian celebration sweets, it honours India''s cultural influence on Jakarta, with shochu adding a lychee-like lift to a rich dessert drink.

Sources: https://88bamboo.co/blogs/escapades/cosmo-pony-opens-its-doors-in-jakarta-what-to-expect-at-this-convivial-bar-with-cosmopolitan-soul, https://www.spiritedasia.com/2025/05/drink-cosmo-pony-jakarta/', NULL, 2024, NULL, NULL, NULL),
    ('problemchild_ph', NULL, 'Melon Martini', 'A Martini-style drink of Tanqueray No. 10, aloe vera, cucumber, an alternative acid and orange bitters, with no melon in it.', 'A flavour illusion from the first, orange-themed menu: aloe, cucumber and tuned acids trick the palate into tasting melon. Two local publications called it the standout drink.

Sources: https://primer.com.ph/food/restaurant-type/bar-and-resto/problem-child/, https://dailydrinkmag.com/problem-child-makati/', NULL, NULL, NULL, NULL, NULL),
    ('problemchild_ph', NULL, 'Twin Popsies', 'Mezcal, tequila, Campari and orange, washed with vanilla ice cream.', 'Recreates a childhood orange popsicle as a grown-up drink, using a vanilla ice cream wash to add creamy texture to a smoky, bitter agave base.

Sources: https://primer.com.ph/food/restaurant-type/bar-and-resto/problem-child/', NULL, NULL, NULL, NULL, NULL),
    ('problemchild_ph', NULL, 'Green Sticks', 'Rum with wakame distillate and salsa verde.', 'A savoury highlight named by 50 Best, pairing a clear seaweed distillate''s umami with the green herbs of salsa verde.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/problem-child.html, https://www.philstar.com/lifestyle/food-and-leisure/2026/07/29/2545574/new-makati-bar-problem-child-claims-philippine-title-asias-50-best-bars-debut', NULL, NULL, NULL, NULL, NULL),
    ('problemchild_ph', NULL, 'Serene', 'Japanese whisky aromatised with green tea, jasmine and oolong, with orange bitters, served carbonated.', 'A crisp, sparkling tea-driven whisky drink that 50 Best singles out among the bar''s rotating originals.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/problem-child.html, https://www.philstar.com/lifestyle/food-and-leisure/2026/07/29/2545574/new-makati-bar-problem-child-claims-philippine-title-asias-50-best-bars-debut', NULL, NULL, NULL, NULL, NULL),
    ('cafelatrovamiami', NULL, 'Daiquiri Clásico', 'White rum shaken with fresh lime juice and white granulated sugar, served up.', 'The house Daiquiri, made the Cuban way with granulated sugar instead of syrup, which Cabrera says keeps it cleaner and less diluted. He calls it the drink to test any bartender with.

Created by Julio Cabrera.

Method: Shake all ingredients with ice for 15 seconds and strain into a coupe.

Spec from PUNCH (https://punchdrink.com/recipes/daiquiri-clasico/).', 'Daiquiri', NULL, 'Coupette', NULL, 'Shake'),
    ('cafelatrovamiami', NULL, 'Greta Garbo', 'A classic Daiquiri with a few dashes of absinthe added before shaking.', 'A forgotten Cuban riff Cabrera rescued for the La Trova menu; he rates it above the Clasico because the anise adds an aperitif edge.

Method: Shake all ingredients with ice for 15 seconds and strain into a coupe.

Spec from PUNCH (https://punchdrink.com/recipes/greta-garbo/).', 'Daiquiri', NULL, 'Coupette', NULL, 'Shake'),
    ('cafelatrovamiami', NULL, 'Hotel Nacional', 'Pineapple rum shaken with apricot liqueur, pineapple juice and lime juice.', 'A Havana hotel classic that 50 Best describes the team tossing through the air in cantinero style; it sits in the menu''s Cuban classics section.

Sources: https://www.theworlds50best.com/bars/northamerica/the-list/cafe-la-trova.html, https://www.cafelatrova.com/menus/', NULL, NULL, NULL, NULL, NULL),
    ('cafelatrovamiami', NULL, 'Buenavista', 'Gin with muddled cucumber and mint, elderflower liqueur, lime juice and sugar, served up.', 'Cabrera''s best-known original, created at Sra. Martinez in Miami''s Design District and still billed on the La Trova menu as the award winner. Today''s menu version uses Bombay Sapphire gin.

Created by Julio Cabrera.

Method: Muddle cucumber, mint, simple syrup and lime juice in a mixing glass. Add elderflower liqueur, gin and vodka, add ice and shake. Strain into a martini glass.

Spec adapted from Edible South Florida (https://ediblesouthflorida.ediblecommunities.com/recipe/recipes-buenavista/).', NULL, NULL, 'Martini', NULL, 'muddle and shake'),
    ('pch_sf', NULL, 'Leeward Negroni', 'A Negroni of Campari, pandan cordial and overproof Sipsmith VJOP gin over a tiki-bitters rinse, garnished with a pandan leaf.', 'Diedrich''s signature and a widely copied drink that helped put pandan on American bar menus. The pandan cordial lends a nutty, tropical sweetness to the bitter base, and today''s menu version uses coconut-washed Campari.

Created by Kevin Diedrich.

Method: Dash tiki bitters into a rocks glass, swirl to coat and discard the excess. Stir the remaining ingredients over ice and strain into the glass over a large ice cube.
Pandan cordial: Knot 5 pandan leaves and steep them in 8 oz Everclear in a sealed container for 2 days. Strain, then stir in 12 oz 1:1 simple syrup.

Spec from PUNCH (https://punchdrink.com/recipes/leeward-negroni/).', 'Negroni', NULL, 'Rocks', 'Large Cube', 'Stir'),
    ('pch_sf', NULL, 'Thrilla in Manila', 'Bourbon with shiso, calamansi, pineapple, coconut, absinthe and li hing mui.', 'A creamy, savoury tropical sour that FSR names alongside the Leeward Negroni as a signature of Diedrich''s Filipino-inspired style.

Created by Kevin Diedrich.

Sources: https://www.fsrmagazine.com/feature/best-american-bartender-kevin-diedrich-on-blending-identity-and-innovation-at-pacific-cocktail-haven/, https://www.pacificcocktailsf.com/menu', NULL, NULL, NULL, NULL, NULL),
    ('pch_sf', NULL, 'Rice, Rice Baby', 'Rum with toasted brown rice, rice milk, mango and nori.', 'A tropical drink that tastes creamy without dairy, built from toasted rice and rice milk; 50 Best picks it as an example of the menu''s Asian Pacific ingredients.

Created by Tina Nagase in 2025.

Sources: https://www.theworlds50best.com/bars/northamerica/the-list/pacific-cocktail-haven.html, https://www.pacificcocktailsf.com/menu', NULL, 2025, NULL, NULL, NULL),
    ('pch_sf', NULL, 'Kinako Sidecar', 'Hine cognac with anko (sweet red bean), Licor 43, citrus and a dusting of kinako.', 'A Sidecar reimagined with Japanese confectionery flavours, red bean paste and roasted soybean flour, typical of how the bar maps Asian ingredients onto classic structures.

Sources: https://www.pacificcocktailsf.com/menu', 'Sidecar', NULL, NULL, NULL, NULL),
    ('ponyupshanghai', NULL, 'Jurassic Gone Wrong', 'Gin with rose beancurd, cacao, pecan, camellia and bianco vermouth.', 'A floral, nutty stirred drink from the night menu''s Land Expeditions chapter, where drinks are drawn as theme park rides; 50 Best calls it roaringly floral. Fermented rose beancurd is a distinctly Chinese pantry ingredient.

Created by Dre Yang.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/pony-up.html, https://www.ponyupshanghai.com/menus', NULL, NULL, NULL, NULL, NULL),
    ('ponyupshanghai', NULL, 'Sunset Cruise', 'Highland Park 12 Scotch with masala chai, pineapple, lemongrass and asparagus juice.', 'A wind-down drink from the Aquatic Adventures chapter that 50 Best recommends to end the night, pairing spiced tea and pineapple with a green, vegetal asparagus note.

Created by Dre Yang.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/pony-up.html, https://www.ponyupshanghai.com/menus', NULL, NULL, NULL, NULL, NULL),
    ('ponyupshanghai', NULL, 'Cuppa Negroni', 'Bruichladdich 12 Scotch with black cacao, Campari, Tio Pepe fino sherry and jasmine tea.', 'A tea-scented Scotch Negroni from the Jinxian Street section of the menu, named for the bar''s street, with fino and jasmine lightening the smoky base.

Created by Dre Yang.

Sources: https://www.ponyupshanghai.com/menus', 'Negroni', NULL, NULL, NULL, NULL),
    ('ponyupshanghai', NULL, 'Saucy Margarita', 'Olmeca Altos tequila with Hakka orange sauce, Worcestershire, pineapple and lime.', 'A savoury Margarita built on a Hakka-style orange sauce and Worcestershire, the kind of playful, food-driven twist the bar is known for.

Created by Dre Yang.

Sources: https://www.ponyupshanghai.com/menus', 'Margarita', NULL, NULL, NULL, NULL),
    ('punchroomtokyo', NULL, 'Kappa & Yuzu', 'Tequila with doburoku (unfiltered farmhouse sake), yuzu, cucumber and vanilla, served highball-style.', 'The crowd favourite, a tribute to the kappa water spirit of Japanese folklore, whose favourite food, cucumber, finishes the glass. Doburoku gives it a cloudy, rice-rich body.

Created by Yasuhiro Kawakubo.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/punch-room-tokyo.html, https://www.tokyoweekender.com/food-and-drink/restaurants-and-bars/punch-room-tokyo-edition-hotel-ginza-cocktail-menu/', NULL, NULL, NULL, NULL, NULL),
    ('punchroomtokyo', NULL, 'Bamboo Katana Martini', 'A cross between a Bamboo and a wet Martini with Roku gin, sherry, vermouth and kumazasa bamboo-leaf tea, with green peach compote on a mini katana.', 'Merges two cocktails with Japanese ties, the 19th-century Bamboo and the Martini, and brings in kumazasa tea for a gentle, grassy aroma; 50 Best mentions the bamboo-leaf tea Martini in 2026.

Created by Yasuhiro Kawakubo.

Sources: https://www.tokyoweekender.com/food-and-drink/restaurants-and-bars/punch-room-tokyo-edition-hotel-ginza-cocktail-menu/, https://www.theworlds50best.com/bars/best-in-asia/the-list/punch-room-tokyo.html', 'Martini', NULL, NULL, NULL, NULL),
    ('punchroomtokyo', NULL, 'Wasabi Sonic', 'A gin sonic (gin with half tonic, half soda) lifted with sencha tea and fresh wasabi root.', 'Takes Tokyo''s favourite highball and adds wasabi for an aromatic rather than hot spice; Tokyo Weekender says it is one of the bar''s most popular drinks.

Created by Yasuhiro Kawakubo.

Sources: https://www.tokyoweekender.com/food-and-drink/restaurants-and-bars/punch-room-tokyo-edition-hotel-ginza-cocktail-menu/, https://www.thedrinkjournal.com/journal/punch-room-tokyo-tokyo', NULL, NULL, NULL, NULL, NULL),
    ('punchroomtokyo', NULL, 'Revenge of Taiyaki-kun', 'An Espresso Martini with a togarashi kick and a hint of passion fruit.', 'Inspired by Japan''s best-selling single, a children''s song about a runaway taiyaki fish cake, it imagines the cake''s sweet and spicy revenge.

Created by Yasuhiro Kawakubo.

Sources: https://www.tokyoweekender.com/food-and-drink/restaurants-and-bars/punch-room-tokyo-edition-hotel-ginza-cocktail-menu/', 'Espresso Martini', NULL, NULL, NULL, NULL),
    ('punchroomtokyo', NULL, 'Korakuen & Matcha', 'An Old Fashioned made with matcha and flavoured with peach.', 'One of three drinks honouring Japan''s Three Great Gardens, inspired by a tea ceremony held at Okayama''s Korakuen for the Zen priest Eisai.

Created by Yasuhiro Kawakubo.

Sources: https://www.tokyoweekender.com/food-and-drink/restaurants-and-bars/punch-room-tokyo-edition-hotel-ginza-cocktail-menu/', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('prophecybar', NULL, 'Souvenir 26', 'Hay- and beeswax-washed Alberta Premium Canadian whisky with Lagavulin 8, pasilla mixe chile and smoke, served inside a matryoshka doll.', 'A conversation-piece serve named by 50 Best: the nested-doll presentation fits its theme of the things we bring home from travel, and the double wash gives the whisky a soft, honeyed, smoky texture.

Created by Jeff Savage.

Sources: https://www.theworlds50best.com/bars/northamerica/the-list/prophecy.html, https://www.prophecybar.com/cocktails', NULL, NULL, NULL, NULL, NULL),
    ('prophecybar', NULL, 'Cavalier Martini', 'Belvedere 10 vodka infused with chive, white pepper and crème fraîche, stirred with dry vermouth, with a 10 g caviar service.', 'A savoury luxury Martini honouring the Cavalier Room, the hotel''s famous Prohibition-era haunt and, per the menu, the first place in Vancouver to legally serve a drink after Prohibition.

Created by Jeff Savage.

Sources: https://www.prophecybar.com/cocktails, https://canadas100best.com/stories/jeff-savage-prophecy-vancouver/', 'Martini', NULL, NULL, NULL, NULL),
    ('prophecybar', NULL, 'Wabi Sabi Martini', 'Matcha-redistilled Tanqueray No. Ten with Cocchi Americano, hinoki bitters and saline, garnished with lime zest.', 'Savage rotovaps ceremonial-grade matcha with gin for a clear, silky Martini that still tastes of tea, a homage to tea master Sen no Rikyu and the idea of beauty in simplicity.

Created by Jeff Savage.

Method: Combine gin, Cocchi Americano, bitters and saline in a mixing glass, add ice and stir until chilled and diluted. Strain into a martini glass.
Matcha redistilled gin: Ceremonial-grade matcha is combined with Tanqueray No. Ten and redistilled on a rotary evaporator; the source gives no quantities.

Spec from ELLE Gourmet (https://ellegourmet.ca/prophecys-wabi-sabi-martini/).', 'Martini', NULL, 'Martini', NULL, 'Stir'),
    ('prophecybar', NULL, 'Kelpie', 'Aquavit with nori-infused fino sherry, bitter bianco, almond, celery, lime and spirulina, naturally blue.', 'A tribute to the shape-shifting Scottish water spirit, coloured blue by spirulina and served in hand-blown glass moulded to a piece of driftwood.

Created by Jeff Savage.

Sources: https://canadas100best.com/stories/jeff-savage-prophecy-vancouver/, https://www.prophecybar.com/cocktails', NULL, NULL, NULL, NULL, NULL),
    ('lennons.bkk', NULL, 'Mando-Tini', 'Martini-style serve of The Botanist Islay gin with coconut oil, dried mango, marian plum and bianco vermouth.', 'A liquid take on mango sticky rice and the drink bar director KT Lam personally recommends from the Bangkok Beats menu. It opens a list where each name hides a note of the sol-fa scale (here ''do''), fitting the bar''s recording-studio theme.

Created by KT Lam in 2026.

Sources: https://www.rosewoodhotels.com/content/dam/rosewoodhotels/property/bangkok/en/documents/lennon%27s/RWBKK_Dinning_Lennon%27s_Signature%20Cocktail%20Menu_Bangkok%20Beats.pdf, https://www.rosewoodhotels.com/en/bangkok/media-hub/introducing-lennons-bangkok-beats-signature-cocktail-menu', 'Martini', 2026, NULL, NULL, NULL),
    ('lennons.bkk', NULL, 'Fad Thai Sour', 'Wild Turkey bourbon sour with peanut butter, chives, tamarind, orgeat, calamansi, lime and egg white.', 'Translates pad Thai into a whiskey sour: peanut, chive and tamarind stand in for the noodle dish''s garnishes and sauce. 50 Best singles it out as a menu highlight.

Created by KT Lam in 2026.

Sources: https://www.rosewoodhotels.com/content/dam/rosewoodhotels/property/bangkok/en/documents/lennon%27s/RWBKK_Dinning_Lennon%27s_Signature%20Cocktail%20Menu_Bangkok%20Beats.pdf, https://www.theworlds50best.com/bars/best-in-asia/the-list/lennons.html', 'Whiskey Sour', 2026, NULL, NULL, NULL),
    ('lennons.bkk', NULL, 'Sol Tum', 'Tito''s vodka with papaya, coriander, tomato, calamansi, tamarind, lime and chili.', 'Built to taste like som tum, Thailand''s green papaya salad, balancing sour, sweet and chili heat. KT Lam names it alongside the Mando-Tini as his pick from the menu.

Created by KT Lam in 2026.

Sources: https://www.rosewoodhotels.com/content/dam/rosewoodhotels/property/bangkok/en/documents/lennon%27s/RWBKK_Dinning_Lennon%27s_Signature%20Cocktail%20Menu_Bangkok%20Beats.pdf, https://www.rosewoodhotels.com/en/bangkok/media-hub/introducing-lennons-bangkok-beats-signature-cocktail-menu', NULL, 2026, NULL, NULL, NULL),
    ('lennons.bkk', NULL, 'Sagoregroni', 'Negroni twist on Matusalem Platino rum with longan, rosso vermouth, pandan, Campari, Ratafia Rossi and sago.', 'Swaps gin for white rum and threads in Thai dessert flavours (longan, pandan, sago pearls) while keeping the Campari backbone. It carries the ''re'' syllable in the menu''s musical naming scheme.

Created by KT Lam in 2026.

Sources: https://www.rosewoodhotels.com/content/dam/rosewoodhotels/property/bangkok/en/documents/lennon%27s/RWBKK_Dinning_Lennon%27s_Signature%20Cocktail%20Menu_Bangkok%20Beats.pdf', 'Negroni', 2026, NULL, NULL, NULL),
    ('fancycocktailbar', NULL, 'Wondermint Malted', 'Frozen, dairy-based mint shake of Death''s Door Wondermint schnapps, Broker''s gin and Luxardo Angioletto hazelnut liqueur.', 'The bar''s calling card since opening day: a boozy take on the Grasshopper poured from a frozen-drink machine so it comes out at a consistent, ice-cold temperature. Calvin Marty calls it perhaps the best drink they have made, and 50 Best names it the order to get.

Created by Calvin and Chris Marty in 2015.

Sources: https://www.the50.com/bars/best-in-north-america/the-list/Best-intentions.html, http://chibbqking.blogspot.com/2023/09/best-intentions.html', NULL, 2015, NULL, NULL, NULL),
    ('fancycocktailbar', NULL, 'Angostura Shot', 'A straight shot of Angostura aromatic bitters poured from a tap.', 'Best Intentions says it was the first bar in the world to put Angostura bitters on draft, and a cheap shot of it is the house shot. The press routinely lists it next to the Wondermint as a reason to visit.

Sources: https://voyagechicago.com/interview/meet-calvin-marty-best-intentions-logan-squarehumboldt-park/, https://www.timeout.com/chicago/news/this-chicago-bar-was-just-named-one-of-the-best-in-all-of-the-u-s-052126', NULL, NULL, NULL, NULL, NULL),
    ('fancycocktailbar', NULL, 'Horchata Margarita', 'A margarita built with horchata, the cinnamon rice drink.', 'A long-running house signature that shows the bar''s approach: familiar, affordable drinks with one playful twist. Guides and reviews consistently name it alongside the Wondermint Malted.

Sources: https://www.chiveg.com/2018/11/09/best-intentions-a-divey-ish-bar-i-can-handle/, https://www.chicocktailcompass.com/bars/best-intentions', 'Margarita', NULL, NULL, NULL, NULL),
    ('mecenasbar', NULL, 'Jardín de Giverny', 'Highball of house bay leaf spirit and house crème de lavande topped with sparkling water.', 'Shows the Mecenas idea in its simplest form: two in-house products and soda, floral and dry. 50 Best names it as a standout of the menu.

Sources: https://www.mecenasbar.com/s/mecenas-menu-2026-en_compressed.pdf, https://www.the50.com/bars/best-in-north-america/the-list/mecenas.html', NULL, NULL, NULL, NULL, NULL),
    ('mecenasbar', NULL, 'Monje', 'Pineapple eau de vie with green Chartreuse and lemongrass oil.', 'A short, herbal drink that puts a clear fruit spirit next to Chartreuse, with lemongrass oil for aroma. It is one of the two drinks 50 Best highlights.

Sources: https://www.mecenasbar.com/s/mecenas-menu-2026-en_compressed.pdf, https://www.the50.com/bars/best-in-north-america/the-list/mecenas.html', NULL, NULL, NULL, NULL, NULL),
    ('mecenasbar', NULL, 'Lemon Up', 'Carbonated highball of lemongrass spirit and Raicilla Armando Solís with sparkling water.', 'Pairs a mono-botanical lemongrass spirit, the kind Mecenas develops with Guadalajara distillers, with a single-producer raicilla from Jalisco.

Sources: https://www.mecenasbar.com/s/mecenas-menu-2026-en_compressed.pdf, https://www.the50.com/bars/best-in-north-america/the-list/mecenas.html', NULL, NULL, NULL, NULL, NULL),
    ('mecenasbar', NULL, 'Melomanía', 'Clarified mix of Raicilla Benito Salcedo, house crème de menthe and honeydew melon.', 'A light, clarified drink that uses the bar''s own mint liqueur instead of a branded one and shows off another small-batch raicilla.

Sources: https://www.mecenasbar.com/s/mecenas-menu-2026-en_compressed.pdf', NULL, NULL, NULL, NULL, NULL),
    ('modernhausjkt', NULL, 'Pohpohan', 'Juniper-mint liqueur with champagne lactic, fresh pohpohan leaves, limeade cordial and methylcellulose.', 'Bule''s own pick as the house signature: pohpohan is a Javanese salad leaf, and methylcellulose gives the drink a thick, creamy body. It sits in the menu''s leaf section.

Created by Mirwansyah ''Bule''.

Sources: https://uniongroupjakarta.com/storage/1427/MODERN-HAUS-SEPT''25.pdf, https://foodies.id/modernhaus-a-contemporary-re-interpretation-of-drinking-at-home/', NULL, NULL, NULL, NULL, NULL),
    ('modernhausjkt', NULL, 'Betel', 'Betel-leaf rum with coconut water, umeshu, lemon verbena Cocchi Bianco and a pickled betel leaf.', 'Built on betel, a leaf chewed across Indonesia, both infused into the rum and pickled as garnish. 50 Best describes it as a vegetal drink that could only come from Indonesia.

Created by Mirwansyah ''Bule''.

Sources: https://uniongroupjakarta.com/storage/1427/MODERN-HAUS-SEPT''25.pdf, https://www.the50.com/bars/best-in-asia/the-list/modernhaus.html', NULL, NULL, NULL, NULL, NULL),
    ('modernhausjkt', NULL, 'Purple Yam', 'Spirit-forward mix of purple yam arrack, elderflower liqueur, clarified rice wine and vetiver tincture.', 'The root-section drink 50 Best recommends pairing with the bar''s snacks: a local arrack infused with purple yam, softened with rice wine.

Created by Mirwansyah ''Bule''.

Sources: https://uniongroupjakarta.com/storage/1427/MODERN-HAUS-SEPT''25.pdf, https://www.the50.com/bars/best-in-asia/the-list/modernhaus.html', NULL, NULL, NULL, NULL, NULL),
    ('modernhausjkt', NULL, 'Kenanga', 'Ylang-ylang (kenanga) pisco with Empirical''s The Plum, I Suppose, Cocchi Rosa and Supersour.', 'The pisco is cooked sous vide with kenanga flowers, and Supersour is made from lemons left over from garnishes, part of the bar''s low-waste approach. Bule named it his favourite at the time.

Created by Mirwansyah ''Bule''.

Sources: https://uniongroupjakarta.com/storage/1427/MODERN-HAUS-SEPT''25.pdf, https://foodies.id/modernhaus-a-contemporary-re-interpretation-of-drinking-at-home/', NULL, NULL, NULL, NULL, NULL),
    ('baltrabar', NULL, 'Dry Martini', 'Classic dry gin Martini, the drink regulars and off-duty bartenders order.', '50 Best calls the Martini Baltra''s must-try drink, and local bartenders name it the best in the city. Its reputation made the bar the industry''s Tuesday-night meeting point.

Sources: https://www.the50.com/stories/News/10-essential-bars-mexico-city.html, https://www.the50.com/stories/News/50-best-bartenders-reveal-their-hidden-gem-cocktail-spots.html', 'Martini', NULL, NULL, NULL, NULL),
    ('baltrabar', NULL, 'Plan Z', 'Gin with cassis, chai, fig and mascarpone.', 'From the ''Beber es un Viaje'' menu about the annoyances of air travel: it is the drink for a delayed flight, treating the wait as time for one more round.

Sources: https://www.the50.com/bars/best-in-north-america/the-list/Baltra-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('baltrabar', NULL, 'Modo Avión', 'Tequila with vermouth, pickles and a watermelon sangrita.', 'The same travel menu''s cure for lost luggage, a savoury, sangrita-led drink that shows León''s playful side after the more experimental Limantour.

Sources: https://www.the50.com/bars/best-in-north-america/the-list/Baltra-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('baltrabar', NULL, 'Permanecer Aquí', 'Espadín mezcal with Cocchi Rosa, Campari, basil and strawberry.', 'Written for the traveller who has fallen for the city and wants to stay. The menu was developed by head bartender Estefany Palma under José Luis León.

Created by Estefany Palma in 2025.

Sources: https://www.eluniversal.com.mx/menu/guia-de-cocteleria-para-viajeros-lo-nuevo-de-baltra-bar/', NULL, 2025, NULL, NULL, NULL),
    ('viceversamiami', NULL, 'Little Toni.Co', 'Highball of sherry en rama, Bordiga Bianco, white port, St-Germain and olive brine, topped with Mediterranean tonic.', 'Reworks a dirty Martini as a long, low-proof aperitivo highball, and it is the drink 50 Best uses to describe the bar''s knack for contrasting flavours. Its name plays on ''tonico''.

Created by Valentino Longo in 2025.

Method: Build everything except the tonic in a highball glass with ice and stir. Top with tonic.

Spec from Appetito (https://appetitomagazine.com/news/miamis-viceversas-new-futurist-cocktails-recipe).', 'Martini', 2025, 'Highball', 'Cubes', 'Stir'),
    ('viceversamiami', NULL, 'Forza!', 'Old Forester bourbon with Italicus bergamot, Cocchi Dopo Teatro, oloroso sherry and blackcurrant.', 'Billed on the menu as half Manhattan, half Everglades: an Italian-leaning stirred digestif with a Florida accent. 50 Best names it among the bar''s contrast-driven drinks.

Created by Valentino Longo in 2025.

Sources: https://viceversamia.com/wp-content/uploads/2025/11/VV-Drink-List-2025-PRINT.pdf, https://www.the50.com/bars/best-in-north-america/the-list/viceversa.html', 'Manhattan', 2025, NULL, NULL, NULL),
    ('viceversamiami', NULL, 'Martini alla Puttanesca', 'Grey Goose vodka and Noilly Prat with olive oil, caper leaf and Castelvetrano olive brine.', 'A ''dirty Martini 2.0'' that borrows the olive and caper flavours of the Neapolitan pasta sauce, from the menu''s martini-ish section.

Created by Valentino Longo in 2025.

Sources: https://viceversamia.com/wp-content/uploads/2025/11/VV-Drink-List-2025-PRINT.pdf, https://appetitomagazine.com/news/miamis-viceversas-new-futurist-cocktails-recipe', 'Martini', 2025, NULL, NULL, NULL),
    ('viceversamiami', NULL, 'ViceVersa Negroni', 'Bombay Sapphire gin with the bar''s house Mi-To blend of Campari and vermouths.', 'The house Milano-Torino blend is the base of the whole Negroni family and several signatures, reflecting Longo''s Roman aperitivo roots.

Created by Valentino Longo.

Sources: https://viceversamia.com/wp-content/uploads/2025/11/VV-Drink-List-2025-PRINT.pdf, https://viceversamia.com/menu/', 'Negroni', NULL, NULL, NULL, NULL),
    ('truelaurelsf', NULL, 'In the Pines, Under the Palms', 'Toasted-coconut rye and gin with vermouth, maraschino and arak, bottled with a young redwood sprig.', 'A perennial staple and the bar''s best-known drink: a Martinez variation where the coconut-fat-washed rye rests on a redwood tip until it tastes like a walk in the Presidio''s groves. It is poured tableside from a small bottle.

Created by Nicolas Torres.

Sources: https://truelaurelsf.com/menus/cocktails.pdf, https://vinepair.com/articles/techniques-community-driven-cocktails-true-laurel/', 'Martinez', NULL, NULL, NULL, NULL),
    ('truelaurelsf', NULL, 'Laurel Martini', 'Juniper-forward gins and dry vermouths with quinquina and a California bay laurel tincture, finished with Meyer lemon.', 'Uses a tincture of native California bay laurel, sharper and more eucalyptus-like than sweet bay, to give a classic Martini a sense of place. Torres frames it as a way to express the Bay Area in a glass.

Created by Nicolas Torres.

Method: Stir all ingredients with ice in a mixing glass until very cold and strain. Express a Meyer lemon peel over the top and add one more drop of tincture.
Bay tincture: Macerate about 1 cup of fresh California bay laurel leaves (not sweet bay) in 6 oz vodka for at least a week, then strain out the leaves.

Spec from Imbibe (https://imbibemagazine.com/recipe/laurel-martini-from-true-laurel/).', 'Martini', NULL, 'Martini', NULL, 'Stir'),
    ('truelaurelsf', NULL, 'Quinine Cobbler', 'Cocchi Americano, Contratto Bianco and amontillado sherry with house grenadine, finished with plenty of Angostura.', 'A low-proof cobbler that leans on quinine-bittered aperitif wines and a house grenadine made from fresh pomegranate juice with a touch of rose water.

Created by Nicolas Torres.

Method: Combine all ingredients in a Hurricane glass.
House grenadine: Dissolve 6 cups of sugar in 2 quarts of pomegranate juice over heat, bring briefly to a boil, then simmer at about 160-180F for 12 to 20 minutes until it tastes cooked. Cool and add 1 oz rose water per 2 quarts of syrup.

Spec from Chilled Magazine (https://chilledmagazine.com/must-mix-3-seasonal-sips-true-laurel-san-francisco/).', NULL, NULL, NULL, NULL, NULL),
    ('truelaurelsf', NULL, 'TL Carajillo', 'Shaken mix of Licor 43, cold brew concentrate, Mr Black coffee liqueur and Highland Park 12 with a pinch of salt.', 'A house version of the Spanish coffee-and-Licor 43 drink, deepened with a peated-leaning Scotch and seasoned with salt.

Created by Nicolas Torres.

Method: Shake all ingredients with ice and strain into a coupe.
Cold brew coffee concentrate: Combine 1 part ground coffee with 4 parts water and rest in the fridge for 12 to 24 hours, then strain.

Spec from Chilled Magazine (https://chilledmagazine.com/must-mix-3-seasonal-sips-true-laurel-san-francisco/).', NULL, NULL, 'Coupette', NULL, 'Shake'),
    ('truelaurelsf', NULL, 'Freezer Sazerac', 'Bonded rye and brandy with Peychaud''s bitters and arak, served straight from the freezer.', 'Pre-batched and frozen so it arrives at the table very cold without dilution from stirring, a modern take on the New Orleans classic.

Sources: https://truelaurelsf.com/menus/cocktails.pdf', 'Sazerac', NULL, NULL, NULL, NULL),
    ('mobarshenzhen', NULL, 'Solar', 'Altamura vodka and Tabb baijiu with osmanthus and vanilla, apricot, lactic acid and Bi Luo Chun green tea soda.', 'Opens the weaving chapter of Colours of China 2.0, pairing a light baijiu with osmanthus and one of China''s famous green teas as a sparkling lengthener.

Created by Tiger Chang.

Sources: https://cdn-assets-dynamic.frontify.com/4001946/eyJhc3NldF9pZCI6NTk1NDksInNjb3BlIjoiYXNzZXQ6dmlldyJ9:mandarin-oriental-hotel-group:YDamf3mS-U2BYRxGXCZ_-qhDqNRGgxUakx0u8F9-dyY, https://www.mandarinoriental.com/en/shenzhen/futian/dine/mo-bar', NULL, NULL, NULL, NULL, NULL),
    ('mobarshenzhen', NULL, 'Bloom', 'Torres 10 brandy with Sichuan beef tallow, cherry tomato, guava and buffalo mozzarella.', 'A savoury, fat-washed style drink that brings Sichuan hotpot richness and a caprese-like tomato and mozzarella note into a brandy base.

Created by Tiger Chang.

Sources: https://cdn-assets-dynamic.frontify.com/4001946/eyJhc3NldF9pZCI6NTk1NDksInNjb3BlIjoiYXNzZXQ6dmlldyJ9:mandarin-oriental-hotel-group:YDamf3mS-U2BYRxGXCZ_-qhDqNRGgxUakx0u8F9-dyY', NULL, NULL, NULL, NULL, NULL),
    ('mobarshenzhen', NULL, 'Lutinus', 'Tomato-forward cocktail of house tomato vodka with smoky whisky.', 'The spring drink of the first Colours of China menu, which 50 Best uses to illustrate the list''s savoury, story-led style.

Created by Tiger Chang in 2025.

Sources: https://www.the50.com/bars/best-in-asia/the-list/mo-bar-shenzhen.html, https://nowshenzhen.com/blog/mandarin-oriental-shenzhen-unveils-colours-of-china-at-mo-bar/', NULL, 2025, NULL, NULL, NULL),
    ('mobarshenzhen', NULL, 'Turquoise', 'Tabb baijiu with Empirical''s The Plum, I Suppose, cucumber, verjuice and whey.', 'A cooling summer drink from the solar-terms menu that shows baijiu in a light, savoury frame.

Created by Tiger Chang in 2025.

Sources: https://www.drinkcollectiv.com/2025/01/31/mo-bars-new-cocktail-menu-is-worth-the-trip-to-shenzhen-this-february/, https://nowshenzhen.com/blog/mandarin-oriental-shenzhen-unveils-colours-of-china-at-mo-bar/', NULL, 2025, NULL, NULL, NULL),
    ('barpompette_to', NULL, 'Cornichon', 'Gin Martini with a dill-pickle distillate, finished with a drop of dill oil in place of an olive.', 'One of the bar''s permanent signatures: the pickle flavour is captured with a rotary evaporator so the drink stays crystal clear, and the dill-oil bead is a visual joke on the olive garnish.

Created by Hugo Togni.

Sources: https://www.the50.com/stories/News/north-america-highest-new-entry-2023-bar-pompette.html, https://www.the50.com/bars/best-in-north-america/the-list/Bar-pompette.html', 'Martini', NULL, NULL, NULL, NULL),
    ('barpompette_to', NULL, 'Nitro Colada', 'On-tap Piña Colada of coconut-oil-washed rum, clarified pineapple and coconut water, curry leaf and house falernum, charged with nitrogen.', 'The first drink the team created and still a staple. Pineapple is clarified in a centrifuge and the rum fat-washed with coconut oil, giving a lighter, less sweet colada with a creamy nitro head.

Created by Hugo Togni.

Sources: https://foodism.ca/eat-drink/bars-restaurants/bar-pompette-toronto/, https://www.thealchemistmagazine.ca/2024/07/19/getting-tipsy-with-bar-pompette/', 'Piña Colada', NULL, NULL, NULL, NULL),
    ('barpompette_to', NULL, '11 a.m. in Marseille', 'Sour of beeswax-infused pastis with roasted almond orgeat, citrus and egg white.', 'On the menu since day one and Togni''s tribute to the southern French pastis habit, a play on the Mauresque. Ontario beeswax softens the anise and the dark-roasted orgeat recalls the peanuts served in French bars.

Created by Hugo Togni.

Sources: https://www.the50.com/stories/News/north-america-highest-new-entry-2023-bar-pompette.html, https://foodism.ca/eat-drink/bars-restaurants/bar-pompette-toronto/', NULL, NULL, NULL, NULL, NULL),
    ('barpompette_to', NULL, 'Paloma Quemada', 'Tequila and mezcal with nettle, whey and lime, finished with burnt grapefruit.', 'One of the bar''s most popular tap cocktails and one of the five staples 50 Best lists, a smoky, savoury rethink of the Paloma.

Created by Hugo Togni.

Sources: https://www.the50.com/bars/best-in-north-america/the-list/Bar-pompette.html, https://www.blogto.com/bars/bar-pompette-toronto/', 'Paloma', NULL, NULL, NULL, NULL),
    ('barpompette_to', NULL, 'Spiritual Stimulant', 'Espresso Martini twist with toasted kombu syrup, dill umami bitters and sesame oil.', 'Takes the Espresso Martini in a savoury, East Asian direction; 50 Best picked it for its list of 50 cocktails to try around the world.

Sources: https://www.the50.com/stories/News/50-incredible-cocktails-to-try-around-the-world.html', 'Espresso Martini', NULL, NULL, NULL, NULL),
    ('thekeeferbar', NULL, 'Antidote', 'Forty Creek Canadian whisky with yuzu sake, lemon and Nin Jiom herbal syrup.', 'A long-running ''Alumni'' greatest hit that leans hardest into the apothecary idea: Nin Jiom is a traditional Chinese herbal cough remedy. 50 Best names it as a must-order.

Sources: https://www.the50.com/bars/best-in-north-america/the-list/The-keefer-bar.html, https://thekeeferbar.com/menu-bar/', NULL, NULL, NULL, NULL, NULL),
    ('thekeeferbar', NULL, 'Forager''s Martini', 'Botanist gin and dry vermouth with a borage and musk willow hydrosol, poured from the freezer with a choice of garnishes.', 'Served at about minus 20 degrees with house-pickled vegetables among the garnish options, it is the bar''s show-piece Martini and one 50 Best singles out.

Sources: https://thekeeferbar.com/menu-bar/, https://www.the50.com/bars/best-in-north-america/the-list/The-keefer-bar.html', 'Martini', NULL, NULL, NULL, NULL),
    ('thekeeferbar', NULL, 'Rosemary Gimlet', 'Gin shaken with a house rosemary and lime cordial.', 'One of the bar''s most popular drinks for years and one of the few signatures it sells as a bottled mix so guests can make it at home.

Method: Shake with ice and strain over fresh ice in a tumbler.

Spec from The Keefer Bar (https://thekeeferbar.com/recipes/).', 'Gimlet', NULL, 'Rocks', NULL, 'Shake'),
    ('thekeeferbar', NULL, 'Chinatown Sour', 'Reifel rye with Fernet-Branca, lemon, astragalus and orgeat.', 'A herbal, bitter whisky sour that uses astragalus, a root long used in Chinese medicine, which the bar has worked with since its early days.

Sources: https://thekeeferbar.com/menu-bar/, https://www.straight.com/food/cocktail-culture-shakes-it', 'Whiskey Sour', NULL, NULL, NULL, NULL),
    ('opm.bkk', NULL, 'Campfire', 'Dark chocolate-infused Michter''s bourbon with apple vinegar reduction, local coffee flower honey and mulled wine, served with fire.', 'Built to take the drinker from a Bangkok street to a mountaintop campfire: it arrives with a basket of aromatics and a flame. 50 Best singles it out as one of the bar''s most theatrical serves, and it is still on the 2026 Expression Cocktails menu.

Ingredients from Opium Bar menu (https://www.opiumbarbangkok.com/s/Opium-Menu-2026-PDF-5mxz.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('opm.bkk', NULL, 'Opium Martini', 'House martini of Pokun gin, Tio Pepe fino sherry and L''Ermitage Green.', 'The bar''s namesake martini is tinted green to match Opium''s signature colour and lighting. Fino sherry in place of vermouth keeps it bone-dry and saline.

Ingredients from Opium Bar menu (https://www.opiumbarbangkok.com/s/Opium-Menu-2026-PDF-5mxz.pdf). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('opm.bkk', NULL, 'Four-Way Martini', 'Frozen Botanist gin martini with Cocchi Extra Dry vermouth and red shiso hydrosol, over-poured into a hinoki masu.', 'Served sosogi-koboshi style: a mini martini glass is filled until it overflows into the wooden masu beneath, Japanese sake-bar fashion. It comes with four different garnishes so the drinker can change the flavour as they go.

Method: Frozen; over-poured into a mini martini glass set in a hinoki masu.

Ingredients from Opium Bar menu (https://www.opiumbarbangkok.com/s/Opium-Menu-2026-PDF-5mxz.pdf). No measures have been published.', 'Martini', NULL, 'Martini', NULL, 'Build'),
    ('opm.bkk', NULL, 'Negroni Pyrolyzed', 'Negroni of gin and white vermouth with Campari that has been slow-cooked at 70C until it takes on amaro notes.', 'Matteo Cadeddu first made it for Negroni Week in Bangkok and guests kept ordering it. Heating the Campari concentrates and darkens it, so white vermouth is used to rebalance the drink.

Created by Matteo Cadeddu.

Ingredients from Flavors and Senses (https://flavorsandsenses.com/en/opiumbar/). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('bisouschicago', NULL, 'Olivette', 'Savoury house martini of olive leaf-infused gin and Stray Dog gin with Cartron vermouth and saline.', 'The bar''s own martini, singled out by 50 Best as the savoury pick on a menu built around martinis. Olive leaf infusion and a saline hit give the olive character without brine.

Ingredients from Bisous menu (https://www.bisouschicago.com/menu). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('bisouschicago', NULL, 'The Tuxedo No. 2.1', 'Tuxedo update with Citadelle Vive le Cornichon gin, Dolin Blanc vermouth and maraschino in an absinthe-rinsed glass.', 'One of the vintage martini variations Bisous brings up to date; the bar''s own copy calls out its absinthe-kissed Tuxedo. A pickle-accented gin adds a briny edge to the classic''s anise and cherry notes.

Ingredients from Bisous menu (https://www.bisouschicago.com/menu). No measures have been published.', 'Tuxedo', NULL, NULL, NULL, NULL),
    ('bisouschicago', NULL, 'The French Seventy-Five', 'French 75 made with a blend of gins and brandies, citrus and sparkling wine.', 'Peter Vestinos splits the base between gin and brandy, a pairing he takes from 19th-century cocktail books, rather than choosing one side of the old gin-versus-cognac argument. It sits under Signatures on the menu.

Created by Peter Vestinos.

Ingredients from Bisous menu (https://www.bisouschicago.com/menu). No measures have been published.', 'French 75', NULL, NULL, NULL, NULL),
    ('bisouschicago', NULL, 'L''Jardine', 'Freezer martini of Aqua Perfecta basil brandy, CH vodka and Cocchi Americano.', 'Poured straight from the freezer, it is Chicago Magazine''s suggested first drink at Bisous. Basil eau de vie gives a garden-herb lift to a vodka martini.

Method: Batched and served from the freezer.

Ingredients from Bisous menu (https://www.bisouschicago.com/menu). No measures have been published.', 'Martini', NULL, NULL, NULL, 'Build'),
    ('bisouschicago', NULL, 'Pink Squirrel', 'Blended dessert drink of almond and cocoa liqueurs with a house-made rum cream, dusted with orange.', 'A revival of the mid-century Midwestern ice-cream drink, recommended by Chicago Magazine as a nightcap. Bisous swaps ice cream for its own rum cream.

Method: Blended.

Ingredients from Bisous menu (https://www.bisouschicago.com/menu). No measures have been published.', NULL, NULL, NULL, NULL, 'Blitz'),
    ('hudsonroomshanoi', NULL, 'Marco Polo', 'Tequila sour with celery and eucalyptus liqueur, rhubarb bitters and acid, served with salted jelly and a drop of ca cuong essence.', 'The signature of the Explorer series in Track 61, the hidden bar inside The Hudson Rooms. The single drop of ca cuong, the giant water bug essence prized in northern Vietnamese cooking, is a rare local ingredient in a cocktail.

Ingredients from DrinkCollectiv (https://www.drinkcollectiv.com/2026/02/23/where-to-drink-in-hanoi-the-hudson-rooms-and-track-61-at-capella-hanoi/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('hudsonroomshanoi', NULL, '61 Martini', 'Martini made with pineapple and coconut fat-washed vermouth, served with a deep-fried mortadella-stuffed olive.', 'The standout of Track 61''s classics section, pairing a tropical fat-washed vermouth with a fried, meat-stuffed olive garnish.

Ingredients from DrinkCollectiv (https://www.drinkcollectiv.com/2026/02/23/where-to-drink-in-hanoi-the-hudson-rooms-and-track-61-at-capella-hanoi/). No measures have been published.', 'Martini', NULL, NULL, NULL, NULL),
    ('hudsonroomshanoi', NULL, 'The Golden Dollar', 'Brown butter-washed bourbon fizz with maraschino, citrus, Vietnamese king orange, orange bitters, egg white and soda.', 'Part of ''The Southerner'' leg of the rail-journey menu, nodding to New Orleans. Brown butter bourbon and local king orange give a rich, citrusy take on a fizz.

Ingredients from The Hudson Rooms menu (https://capellahotels.com/assets/docs/hanoi/The_Hudson_Rooms_Main_Bar_Menu.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('hudsonroomshanoi', NULL, 'The Turquoise Rooms', 'Bacon fat-washed pisco with green Chartreuse, fino sherry, pea stock, citrus and Angostura bitters.', 'From the ''Santa Fe Super Chief'' section honouring the Los Angeles train of Hollywood stars. Bacon fat-washing and a pea stock make it a savoury, green-edged sour.

Ingredients from The Hudson Rooms menu (https://capellahotels.com/assets/docs/hanoi/The_Hudson_Rooms_Main_Bar_Menu.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('thegoldentoothbar', NULL, 'Robusta Negroni', 'Negroni with a split base of reposado tequila and gin, vermouth and Campari, sharpened with robusta coffee.', 'Named by 50 Best as the strongest example of the house style and listed by NOW! Jakarta among the bar''s trademark drinks. Local robusta coffee adds a bold, bitter roast to the classic.

Created by Kenny Soetomo.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-asia/the-list/the-golden-tooth.html). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('thegoldentoothbar', NULL, 'Snow White', 'Apple pie in a glass: gin and white rum with apple yoghurt and gingerbread.', 'Asia''s 50 Best calls it an apple-pie martini; it shows Soetomo''s approach of rebuilding a familiar taste memory rather than showing off technique.

Created by Kenny Soetomo.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-asia/the-list/the-golden-tooth.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('thegoldentoothbar', NULL, 'Smokey Highball', 'Johnnie Walker Black Label with agave and sparkling lapsang souchong tea.', 'Designed to taste of barbecue bacon without any bacon: the smoke comes from blended Scotch and pine-smoked lapsang tea, lengthened into a highball.

Created by Kenny Soetomo.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-asia/the-list/the-golden-tooth.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('thegoldentoothbar', NULL, 'Hubba Hubba', 'Bubble gum flavour built from blood orange gin, Solerno blood orange liqueur, peach and vanilla.', 'Another of the menu''s flavour-memory drinks, recreating the taste of bubble gum from fruit and vanilla instead of candy.

Created by Kenny Soetomo.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-asia/the-list/the-golden-tooth.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('barmauromx', NULL, 'Maurito', 'Clear, bubbly mix of mezcal, Lillet Blanc, Tío Pepe fino sherry and guava.', 'The house signature and best seller, named for the grandfather who inspired the bar. It fuses Mexican mezcal and guava with European aromatised and fortified wines in a light, carbonated, lower-alcohol aperitivo, and press call it the drink that draws the crowds.

Created by Ricardo and Eduardo Nava.

Method: Carbonated.

Ingredients from Mex Best (https://mex-best.mx/bar-mauro/). No measures have been published.', NULL, NULL, NULL, NULL, 'Build'),
    ('barmauromx', NULL, 'Negroni 1929', 'Negroni of gin, red vermouth and Campari with cacao nibs and strawberry.', 'The bar''s take on the aperitivo classic that anchors the menu, recommended by Ricardo Nava himself; cacao and strawberry soften the bitterness.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-north-america/the-list/bar-mauro.html). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('barmauromx', NULL, 'Basilico', 'Tequila with rosé vermouth, basil and peach.', 'Named by 50 Best as an example of how the bar builds originals from Italian aperitivo ingredients around a Mexican spirit.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-north-america/the-list/bar-mauro.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('barmauromx', NULL, 'Mango Salad', 'Clear, light drink of tequila, vanilla, tomato and mango.', 'One of the menu''s ''legendary flavours'' that the owners tie to personal memories; Time Out describes it as transparent, light and a little dangerous.

Ingredients from Mex Best (https://mex-best.mx/bar-mauro/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bonvivantsbahamas', NULL, 'The Long Surrender', 'Fiery margarita of Cascahuin blanco tequila, Pierre Ferrand dry curaçao, Scrappy''s Firewater tincture, Chinola passion fruit liqueur, lime and agave.', 'The house signature 50 Best names on the bar''s page. It comes as a single serve or in a cactus-shaped sharing bowl, and the habanero tincture gives it real heat.

Ingredients from Bon Vivants menu (https://bonvivantsbahamas.com/wp-content/uploads/Bar-Menu.pdf). No measures have been published.', 'Margarita', NULL, 'Custom', NULL, NULL),
    ('bonvivantsbahamas', NULL, 'Funky Nassau', 'Sazerac riff on fried plantain sous-vide Hennessy VS and Michter''s rye with Scrappy''s Orleans bitters, simple syrup and cerasee essence.', 'Named after the Bahamian funk hit, it moves the New Orleans classic to the islands: fried plantain is infused into cognac sous vide, and cerasee, a bitter Bahamian bush-tea herb, stands in for the absinthe note. Fitting for a bar founded by a self-described Sazerac fanatic.

Ingredients from Bon Vivants menu (https://bonvivantsbahamas.com/wp-content/uploads/Bar-Menu.pdf). No measures have been published.', 'Sazerac', NULL, NULL, NULL, NULL),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 'Clarified take on the Bahamian Gully Wash with Coconut Cartel and OFTD rums, Ford''s gin, allspice dram, walnut liqueur, coconut, chamomile and grapefruit.', 'Flips the Gully Wash, a local gin, coconut water and condensed milk drink, into a milk punch with more depth and concentration, from the menu''s Locals section celebrating Bahamian flavours.

Method: Milk punch.

Ingredients from Bon Vivants menu (https://bonvivantsbahamas.com/wp-content/uploads/Bar-Menu.pdf). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('bonvivantsbahamas', NULL, 'Meet Me in the Morning', 'Coffee Negroni of Hayman''s London Dry gin, Mr. Black coffee liqueur, Cocchi Vermouth di Torino and Nux Alpina walnut liqueur.', 'A long-running pick from the bar''s page of Negroni riffs, featured by Imbibe; coffee and walnut liqueurs take the place of Campari for a darker, late-night version.

Ingredients from Bon Vivants menu (https://bonvivantsbahamas.com/wp-content/uploads/Bar-Menu.pdf). No measures have been published.', 'Negroni', NULL, NULL, NULL, NULL),
    ('lafactoriapr', NULL, 'Lavender Mule', 'Moscow Mule spin of vodka, lemon, a toasted-spice lavender syrup and fresh spiced ginger tea, served tall.', 'Leslie Cofresí stumbled on it when Moscow Mule ingredients ran low and he mixed the ginger with the lavender-spice infusion from another drink. It became the bar''s signature: Cofresí says it sells thousands a month, and lavender drinks have spread to bars across the island.

Created by Leslie Cofresí.

Method: Shake with ice for 12 to 15 seconds and strain over fresh ice.
Lavender and dry spice syrup: Toast allspice, cloves and cinnamon sticks, simmer in water, add dried culinary lavender and simmer 15 minutes more, then dissolve raw sugar in it, cool and strain.
Ginger tea: Juice fresh ginger and keep the fibres. Toast allspice, cloves and cinnamon, simmer in water with lemon peel, add the ginger fibres off the heat, cool, add the ginger juice and strain, pressing the solids.

Spec from Liquor.com (https://www.liquor.com/lavender-mule-cocktail-recipe-8412231).', 'Moscow Mule', NULL, 'Highball', NULL, 'Shake'),
    ('lafactoriapr', NULL, 'Peligroso', 'Shaken rum sour with Campari, Averna, lime, Angostura and a house allspice, clove and cinnamon syrup.', 'Its name means dangerous, a nod to how easily the bittersweet mix goes down. The bar shared the spec with Imbibe, and Difford''s traces it to La Factoría in 2019.

Method: Shake all ingredients with ice and strain.
Spiced syrup: Simmer 4 cups water with 20 allspice berries, 10 cloves and a cinnamon stick for 20 minutes, dissolve in 4 cups sugar in two additions, cool and strain. Keeps 2 weeks refrigerated.

Spec from Imbibe Magazine (https://imbibemagazine.com/recipe/peligroso-from-la-factoria/).', NULL, 2019, 'Coupette', NULL, 'Shake'),
    ('lafactoriapr', NULL, 'Guanabana Punch', 'Milk-clarified grog of soursop-infused rum and chai.', 'Singled out by 50 Best as the drink for a night of dancing in the salsa room. Clarifying with milk gives the tropical soursop and spice a silky, clear finish.

Method: Milk-clarified punch.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-north-america/the-list/la-factoria.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('lafactoriapr', NULL, 'Spiced Old Fashioned', 'Old Fashioned built on aged rum with spiced bitters.', 'A long-standing house staple that shows the bar''s habit of reworking classics with Puerto Rican rum.

Ingredients from Wikipedia (https://en.wikipedia.org/wiki/La_Factor%C3%ADa_(bar)). No measures have been published.', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('lafactoriapr', NULL, 'Coquito', 'Puerto Rico''s holiday coconut punch of Don Q rums, condensed and evaporated milk, coconut cream, vanilla, cinnamon and nutmeg.', 'The bar batches its own coquito every holiday season and pours it free for guests; La Factoría shared its family-style recipe with Life & Thyme.

Method: Blend everything, bottle and rest in the fridge overnight. Shake before serving.

Spec from Life & Thyme (https://lifeandthyme.com/recipes/coquito-puerto-rico-cocktail/).', NULL, NULL, NULL, NULL, 'Blitz'),
    ('obsidianbar_sz', NULL, 'Into the Forest', 'Scotch whisky with citrus jam, agave and lemon verbena, topped with a Dancong oolong tea foam.', 'From the Victorian afternoon-tea menu: a whisky sour-style drink where the foam carries fragrant Dancong oolong instead of egg white alone.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-asia/the-list/obsidian.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('obsidianbar_sz', NULL, 'Black Manhattan', 'Bourbon and Italian vermouth with smoked plum, black garlic, bohea tea and black vinegar.', 'A darkly savoury Manhattan that leans on Chinese pantry ingredients: black garlic, smoked plum and black vinegar give umami and acidity, and bohea (Wuyi black) tea adds tannin.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-asia/the-list/obsidian.html). No measures have been published.', 'Manhattan', NULL, NULL, NULL, NULL),
    ('obsidianbar_sz', NULL, 'Morning Glory', 'Recreation of an 1887 drink with calvados, Irish whiskey, Earl Grey, amaro and absinthe.', 'Part of the menu''s Forgotten Cocktails section, which revives drinks from period sources; this one is drawn from Jerry Thomas''s 1887 Bartender''s Guide and reinterpreted with Earl Grey tea.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-asia/the-list/obsidian.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('civwrksto', NULL, 'Woolnough', 'Low-ABV smoky riff on a Perfect Manhattan with Cocchi Rosa, vermouth, peated Scotch, haskap berry cordial and vetiver-sandalwood tincture.', 'Named after J.J. Woolnough, the architect of the Waterworks building, and Nick Kennedy''s must-order. It flips Manhattan proportions so aromatised wines lead and the peated whisky is the accent, with foraged Canadian haskap berries for tartness.

Created by Élise Hanson in 2024.

Method: Shake hard with ice for 10 to 15 seconds and strain.
Haskap berry cordial: Macerate 1 cup frozen haskap berries (or other berries) with 1 cup white sugar at room temperature for 24 hours until the sugar dissolves, then strain. Keeps 2 weeks refrigerated.
Vetiver and sandalwood tinctures: Steep 20 per cent dried vetiver (or dried sandalwood) in vodka at room temperature for a week.

Spec from Foodism Toronto (https://foodism.ca/eat-drink/bars-restaurants/civil-works/).', 'Manhattan', 2024, 'Coupette', NULL, 'Shake'),
    ('civwrksto', NULL, 'Overhead Tonnage', 'Ramos Gin Fizz-style drink built with a hand blender for a tall pillar of foam.', 'Named after the cranes of the old Waterworks building. Swapping the famously long Ramos shake for a hand blender tames the drink for service while keeping the towering head.

Created by Élise Hanson.

Sources: https://foodism.ca/eat-drink/bars-restaurants/civil-works/, https://www.the50.com/stories/News/civil-works-toronto-best-cocktail-menu-north-americas-50-best-bars-2025.html', 'Ramos Gin Fizz', NULL, NULL, NULL, NULL),
    ('civwrksto', NULL, 'Pounding Sand', 'An al pastor taco in a glass: corn husk-infused mezcal, lacto-fermented pineapple, house achiote cordial and masa foam.', 'Élise Hanson''s savoury showpiece: every part of the taco has a liquid stand-in, down to a masa foam for the tortilla.

Created by Élise Hanson.

Ingredients from Foodism Toronto (https://foodism.ca/eat-drink/bars-restaurants/civil-works/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('civwrksto', NULL, 'Playdate', 'Cognac and madeira with carrot-coffee cream, foam and fizz.', 'From the playground-themed follow-up menu inspired by St. Andrew''s Playground next door, and highlighted by 50 Best in 2026.

Ingredients from The World''s 50 Best Bars (https://www.the50.com/bars/best-in-north-america/the-list/civil-works.html). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 'Pair of dueling mini martinis: vodka, junmai daiginjo sake, blanco vermouth and shiso, against gin, palo cortado sherry, blanco vermouth and grapefruit.', 'Patton and Kennedy each created a martini for the opening menu and, instead of choosing, serve both side by side for the guest to judge. Patton''s leans floral and umami, Kennedy''s brighter and citrusy; it is still on the menu and 50 Best calls it the signature.

Created by Will Patton and Devin Kennedy in 2024.

Ingredients from Press Club menu (https://www.pressclubdc.com/menus/). No measures have been published.', 'Martini', 2024, 'Martini', NULL, NULL),
    ('pressclubcocktailbar', NULL, 'Roses', 'Red gin and aged rum with Thai pepper, rose, pineapple and ginger.', 'Named for the Outkast track, it shows the bar''s habit of naming drinks as songs on an album; 50 Best picks it out of the current track list.

Ingredients from Press Club menu (https://www.pressclubdc.com/menus/). No measures have been published.', NULL, NULL, NULL, NULL, NULL),
    ('pressclubcocktailbar', NULL, 'Nights Over Egypt', 'Yogurt-washed bourbon and Calvados with seasonal fruit syrup and Bordeaux, served with a granola cookie.', 'Patton''s deconstructed New York Sour rebuilt to look and taste like a parfait: the spirits are washed with yogurt, the wine float stands in for the classic''s claret, and a granola cookie comes on the side.

Created by Will Patton in 2024.

Method: Shaken.

Ingredients from Washingtonian (https://washingtonian.com/2024/10/29/press-club-cocktail-lounge-and-record-bar-opening-soon-in-dupont-circle/). No measures have been published.', 'New York Sour', 2024, NULL, NULL, 'Shake'),
    ('pressclubcocktailbar', NULL, 'Imaginary Players', 'White Negroni of shochu and gin with blanc vermouth, strawberry sherry and raspberry eau de vie, with a strawberry paint in the glass.', 'From the opening track list''s boozier side: a fruit-forward white Negroni where a swipe of strawberry painted inside the glass adds colour and flavour.

Ingredients from Washingtonian (https://washingtonian.com/2024/10/29/press-club-cocktail-lounge-and-record-bar-opening-soon-in-dupont-circle/). No measures have been published.', 'White Negroni', 2024, NULL, NULL, NULL),
    ('tiao_beijing', NULL, 'Caochang Hutong', 'Michter''s American whiskey and Wuliangye baijiu with jasmine, green Sichuan peppercorn, passion fruit, peach, Guizhou sour soup and soda.', 'The bar''s signature, named for the alley it sits on. 50 Best describes jasmine-infused baijiu with frozen green Sichuan peppercorns and a fermented sour note taken from Guizhou sour-soup hotpot, a way of making baijiu approachable for newcomers.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/tiao.html, https://cdn-assets-dynamic.frontify.com/4001946/eyJhc3NldF9pZCI6NTg1NTYsInNjb3BlIjoiYXNzZXQ6dmlldyJ9:mandarin-oriental-hotel-group:BedR5hMiMR5AAwckaiv0ozhgihvJGdxyxSFg4YgyJlI', NULL, NULL, NULL, NULL, NULL),
    ('tiao_beijing', NULL, 'Dancing Notes', 'Black Tot rum with shrimp oil, Thai green tea, tom yum extract, cilantro bitters and green papaya.', 'On the Worlds Apart menu it stands for Mozart''s Symphony No. 40 (1788) and looks to Southeast Asia, using a savoury tom yum extraction and shrimp oil to give a rum drink an umami edge.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/tiao.html, https://cdn-assets-dynamic.frontify.com/4001946/eyJhc3NldF9pZCI6NTg1NTYsInNjb3BlIjoiYXNzZXQ6dmlldyJ9:mandarin-oriental-hotel-group:BedR5hMiMR5AAwckaiv0ozhgihvJGdxyxSFg4YgyJlI', NULL, NULL, NULL, NULL, NULL),
    ('tiao_beijing', NULL, 'Newton''s Drop', 'Christian Drouin Calvados, Absolut Raspberry vodka and Black Tot rum with cold brew coffee, maple syrup and miso salted cream.', 'Worlds Apart drink themed on the falling apple of 1665, so Calvados leads; a salted miso cream sits on a coffee and maple base.

Sources: https://cdn-assets-dynamic.frontify.com/4001946/eyJhc3NldF9pZCI6NTg1NTYsInNjb3BlIjoiYXNzZXQ6dmlldyJ9:mandarin-oriental-hotel-group:BedR5hMiMR5AAwckaiv0ozhgihvJGdxyxSFg4YgyJlI', NULL, NULL, NULL, NULL, NULL),
    ('tiao_beijing', NULL, 'Undercurrent', 'Gin, St-Germain elderflower liqueur, black tea, hibiscus and tangerine peel shrub and olive lemonade.', 'A crowd favourite from the bar''s first menu, inspired by the guild halls of Alley 7 where merchants and performers did business. Floral and vinegary, with the shrub and olive lemonade doing the sour work.

Sources: https://www.drinkcollectiv.com/2025/06/07/unwind-in-beijing-sip-and-sightsee-with-tiao-at-mandarin-oriental-qianmen/', NULL, NULL, NULL, NULL, NULL),
    ('tiao_beijing', NULL, 'Walnut', 'Martell Noblige cognac with pomegranate vinegar, walnut, lime and orange bitters, served with sesame crackers.', 'Named after a 60-year-old walnut tree in the hotel''s Yan Garden restaurant; a Sidecar twist from the first menu where vinegar replaces some of the citrus and walnut adds a nutty depth.

Sources: https://www.drinkcollectiv.com/2025/06/07/unwind-in-beijing-sip-and-sightsee-with-tiao-at-mandarin-oriental-qianmen/', 'Sidecar', NULL, NULL, NULL, NULL),
    ('gus_sipanddip', NULL, 'Dirty Martini', 'Ketel One vodka, house olive brine and dry vermouth, frozen and served over shaved ice with blue cheese stuffed olives.', 'The brine is made from Gordal olives with salt solution and distilled vinegar, then spun in a centrifuge until crystal clear. The batch is kept in the freezer and poured over slivers from a Japanese ice shaver to mimic the ice chips of a hard-shaken martini.

Created by Kevin Beary.

Sources: https://gussipanddip.com/, https://www.lettuce.com/blog/chicagos-new-cocktail-go-to-gus-sip-dip/', 'Martini', NULL, NULL, NULL, NULL),
    ('gus_sipanddip', NULL, 'Gin Martini', 'Tanqueray No. Ten with a house blend of three vermouths and orange bitters.', 'Kevin Beary modelled it on his favourite martini, the one at London''s Connaught Bar. Tanqueray No. Ten is the only exception to the bar''s one-brand-per-spirit rule, and the same premix becomes the base of the house Martini and Tonic.

Created by Kevin Beary.

Sources: https://gussipanddip.com/, https://www.lettuce.com/blog/chicagos-new-cocktail-go-to-gus-sip-dip/', 'Martini', NULL, NULL, NULL, NULL),
    ('gus_sipanddip', NULL, 'Brandy Wisconsin Old Fashioned', 'Peyrat cognac with orange, cherry and 7-Up.', 'A polished take on the Midwest''s muddled, soda-topped brandy Old Fashioned, singled out by 50 Best as the bar''s nod to a regional favourite.

Sources: https://gussipanddip.com/, https://www.theworlds50best.com/bars/best-in-north-america/the-list/gus-sip-dip.html', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('gus_sipanddip', NULL, 'Breakfast Martini', 'Earl Grey tea-infused Tanqueray gin, orange liqueur and house orange marmalade syrup, with a honey-buttered toast point.', 'Gus'' version of the 1990s London modern classic infuses the gin with Rare Tea Cellars Earl Grey and swaps jam for a marmalade syrup for a bigger orange hit. It can also be made zero-proof.

Sources: https://gussipanddip.com/, https://www.lettuce.com/blog/chicagos-new-cocktail-go-to-gus-sip-dip/', NULL, NULL, NULL, NULL, NULL),
    ('gus_sipanddip', NULL, 'Gin Gimlet', 'Tanqueray London Dry gin with house lime cordial and a drop of absinthe.', 'A staff favourite that replaces the usual bottled lime juice with a house cordial; the drop of absinthe opens up the aroma.

Sources: https://gussipanddip.com/, https://www.chicagomag.com/chicago-magazine/may-2025/the-new-cocktail-spot-for-elevated-classics-and-a-ham-sandwich/', 'Gimlet', NULL, NULL, NULL, NULL),
    ('workshop14.hanoi', NULL, 'Can''t Stand the Heat', 'A Margarita built with a vacuum re-distillate of Vietnamese chilli.', 'Vacuum distillation captures the fruity aroma of local chilli while leaving the burn behind, so the drink tastes of chilli without the heat.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/workshop14.html', 'Margarita', NULL, NULL, NULL, NULL),
    ('workshop14.hanoi', NULL, 'Terry''s Chocolate Orange', 'Cognac pressure-infused with Marou cacao nibs, then milk-clarified.', 'Uses Vietnamese bean-to-bar Marou cacao; pressure infusion pulls the chocolate into the cognac fast and milk clarification leaves it silky and clear.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/workshop14.html', NULL, NULL, NULL, NULL, NULL),
    ('workshop14.hanoi', NULL, 'Stormy Weather', 'Monsoon rum highball with a green peppercorn vacuum distillate and clarified Dong Du guava cordial.', 'A local take on the rum-and-spice highball: peppercorn heat from a lab distillate and a clarified guava cordial for fruit.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/workshop14.html', NULL, NULL, NULL, NULL, NULL),
    ('workshop14.hanoi', NULL, 'Barry Galdi', 'Local pineapple, Campari and mezcal, served on nitro.', 'The pineapple is run through a rotor-stator homogenizer down to about five microns, giving a creamy texture without dairy; poured on nitro, it drinks slightly bitter and smoky.

Sources: https://www.theworlds50best.com/stories/News/workshop14-hanoi-asias-50-best-bars-2025.html', NULL, NULL, NULL, NULL, NULL),
    ('workshop14.hanoi', NULL, 'Is One Un Oeuf?', 'A cross between an Espresso Martini and Hanoi''s egg coffee.', 'Named after Rich McDonough''s favourite dad joke, it folds the city''s famous whipped-egg coffee into a modern classic.

Sources: https://www.theworlds50best.com/stories/News/workshop14-hanoi-asias-50-best-bars-2025.html', 'Espresso Martini', NULL, NULL, NULL, NULL),
    ('bartrigona', NULL, 'Trigona Bee''s Knees', 'Gin, Trigona kelulut honey, My Liberica coffee from Kulai, Johor, and fresh lemon, shaken at the table.', 'Two years in development. Raw stingless-bee honey brings a woody depth in place of floral honey, and the local Liberica coffee adds honey, chocolate and liquorice notes; the tableside shake makes a ceremony of it.

Created by Rohan Matmary.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/bar-trigona.html, https://www.imfirstclass.com/en/stories/2696/', 'Bee''s Knees', NULL, NULL, NULL, NULL),
    ('bartrigona', NULL, 'Cacao XII', 'Gin made with wild-foraged Himalayan juniper, cacao nibs, Campari, vermouth and cacao balsamic, served with a chocolate bonbon.', 'The rich after-dark close to the Nectar of Time menu, a chocolate-leaning bitter aperitivo structure.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/bar-trigona.html', 'Negroni', NULL, NULL, NULL, NULL),
    ('bartrigona', NULL, 'Açar Martini', 'A dirty-style martini seasoned with Nyonya açar pickle and Sarawak pineapple tuak.', 'Swaps olives for açar, the spiced Peranakan pickle of daikon, carrot, cucumber and red chilli, and adds pineapple tuak rice wine from Bad Cat Borneo in Kuching.

Sources: https://www.imfirstclass.com/en/stories/2696/', 'Martini', NULL, NULL, NULL, NULL),
    ('bartrigona', NULL, 'Trigona Penicillin', 'Michter''s bourbon, Trigona honey, Bentong ginger, lemon and a cascara-infused Islay malt.', 'A Malaysian Penicillin: local Bentong ginger and kelulut honey replace the usual honey-ginger syrup, and the smoky Islay float is infused with cascara, the coffee cherry husk.

Sources: https://houseofcoco.net/four-seasons-kuala-lumpur-yun-house-bar-trigona/', 'Penicillin', NULL, NULL, NULL, NULL),
    ('bartrigona', NULL, 'Kampot Pepper Old Fashioned', 'Mezcal stirred with kelulut honey infused with torched red Kampot peppercorns and cardamom bitters.', 'Created by Rohan Matmary for DrinkCollectiv''s Ingredients series. Raw Trigona honey turns the drink slightly cloudy on contact with water, and the Cambodian pepper leads the aroma over the mezcal.

Created by Rohan Matmary in 2025.

Method: Mix the mezcal with the pepper-infused honey, then stir in a mixing glass with the bitters and ice until well chilled. Pour over a block of ice in a rocks glass.
Kampot pepper-infused kelulut honey: Torch 1 tbsp red Kampot peppercorns for a few seconds, muddle, add at least 2 tbsp kelulut honey and infuse for 1 to 2 minutes.

Spec from DrinkCollectiv (https://www.drinkcollectiv.com/2025/05/31/ingredients-kuala-lumpurs-bar-trigona-crafts-an-old-fashioned-using-kampot-pepper-from-cambodia/).', 'Old Fashioned', 2025, 'Rocks', 'Large Cube', 'Stir'),
    ('fomabar.mx', NULL, 'Patagonia Fizz', 'Apostoles gin, pomelo, yerba mate and Branca Menta, carbonated.', 'A fizzy tribute to Argentina: 50 Best describes gin with mint-infused amaro, cold-brewed yerba mate and grapefruit, evoking Buenos Aires nights.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/form-matter.html, https://drive.google.com/file/d/1Z9ehW6fbdsBCm5uVlb9_Tkq91AK6wYGr/view', NULL, NULL, NULL, NULL, NULL),
    ('fomabar.mx', NULL, 'Lychee Martini Again?!', 'Don Julio Blanco tequila, fino sherry, lychee, matcha and vanilla.', 'A knowing revival of the early-2000s Lychee Martini, rebuilt on tequila and fino and topped with a soft lychee-vanilla foam.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/form-matter.html, https://drive.google.com/file/d/1Z9ehW6fbdsBCm5uVlb9_Tkq91AK6wYGr/view', NULL, NULL, NULL, NULL, NULL),
    ('fomabar.mx', NULL, 'White Chocolate Negroni', 'Tanqueray gin, Suze, Carpano Bianco and Luxardo Bitter with white chocolate.', 'A gentian-led White Negroni given a chocolatey, velvety texture; listed under Western Europe on the flavour-and-place menu.

Sources: https://drive.google.com/file/d/1Z9ehW6fbdsBCm5uVlb9_Tkq91AK6wYGr/view', 'White Negroni', NULL, NULL, NULL, NULL),
    ('fomabar.mx', NULL, 'Good Sex', 'Tanqueray No. Ten, olive oil, olive brine, Carpano Bianco and chili oil.', 'The bar''s wet, dirty and spicy Mediterranean martini, using olive oil and chili oil for texture and heat.

Sources: https://drive.google.com/file/d/1Z9ehW6fbdsBCm5uVlb9_Tkq91AK6wYGr/view', 'Martini', NULL, NULL, NULL, NULL),
    ('curenola', NULL, 'Cure''s Sazerac', 'Sazerac rye, rich Demerara syrup and Peychaud''s bitters in a glass misted with Herbsaint.', 'Refined since before the bar opened; bitters go in by medicine dropper (23 drops, about three dashes) for consistency, and the Herbsaint is sprayed from an atomizer. It took second place in Punch''s 2024 Sazerac blind tasting.

Created by Neal Bodenheimer.

Method: Spritz the Herbsaint into a chilled double Old-Fashioned glass. Stir the rye, syrup and bitters with ice and strain into the glass.
Rich Demerara syrup: Two parts Demerara sugar to one part water.

Spec from Punch (https://punchdrink.com/recipes/cures-sazerac/).', 'Sazerac', NULL, NULL, NULL, 'Stir'),
    ('curenola', NULL, 'Fun Fact', 'Toasted pink peppercorns, vanilla and soursop in an easy-drinking seasonal cocktail.', 'A Liz Kelley creation that 50 Best singles out from the current seasonal list, where every drink is printed with the name of the bartender who made it.

Created by Liz Kelley.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/Cure.html', NULL, NULL, NULL, NULL, NULL),
    ('curenola', NULL, 'The End Is Nigh', 'Rittenhouse rye, Bonal Gentiane Quina and Amaro Sibilla with Angostura bitters and an orange peel.', 'A bitter, spirit-forward Bodenheimer original built around two French and Italian bittersweet aperitifs, originally shared through Varnelli, the maker of Amaro Sibilla.

Created by Neal Bodenheimer.

Spec adapted from Kindred Cocktails (citing Varnelli) (https://kindredcocktails.com/node/7558).', NULL, NULL, NULL, NULL, NULL),
    ('curenola', NULL, 'Keep Your Dreams A Burnin''', 'Manzanilla sherry, Smith & Cross Jamaican rum, orgeat and Angostura over crushed ice with a tiki-style garnish.', 'Kirk Estopinal''s Sherry Cobbler riff: shaking the drink with lemon peels gives oil without juice, while funky rum and almond syrup push the bone-dry manzanilla toward tiki.

Created by Kirk Estopinal.

Method: Shake all ingredients, including the lemon peels, with ice and strain over crushed ice.

Spec from Punch (https://punchdrink.com/recipes/keep-your-dreams-a-burnin/).', NULL, NULL, 'Julep Cup', 'Crushed', 'Shake'),
    ('curenola', NULL, 'Once Over #2', 'A frozen blend of Aperol, lime, orgeat, tequila and mint with a mezcal float.', 'Ryan Gannon made it for an agave pop-up at Cure as a boozier frozen follow-up to the bar''s low-proof Once Over sour.

Created by Ryan Gannon.

Method: Blend everything except the mezcal with two cups of ice until smooth. Pour and float the mezcal on top.

Spec from Punch (https://punchdrink.com/recipes/once-over-2/).', NULL, NULL, NULL, NULL, 'Blitz'),
    ('bekeb_sma', NULL, 'Maguey', 'Reposado tequila with cooked blue agave must, pepper liqueur and bitters.', 'Shows Padilla''s love of agave by pairing the spirit with the cooked agave it comes from, for a deep, roasted agave flavour.

Created by Fabiola Padilla.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/bekeb.html', NULL, NULL, NULL, NULL, NULL),
    ('bekeb_sma', NULL, 'Tepache', 'Raicilla with house tepache, spices and piloncillo.', 'From the classics section: the ancient fermented pineapple drink rebuilt on raicilla, a wild agave spirit from coastal Jalisco.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/bekeb.html', NULL, NULL, NULL, NULL, NULL),
    ('bekeb_sma', NULL, 'Bekeb', 'Mezcal and sotol with elderflower liqueur, pineapple and lemon verbena, served in Oaxacan black clay.', 'The bar''s namesake flagship, combining two agave-family spirits and served in a barro negro vessel from Oaxaca.

Created by Fabiola Padilla.

Sources: https://www.pendulummag.com/travel/2023/2/20/bekeb-bar-50-best-discovery-recognizes-bekebs-author-artisanal-mixology-proposal', NULL, NULL, NULL, NULL, NULL),
    ('bekeb_sma', NULL, 'Lavender Sour', 'Mexican gin, aromatized wine, locally grown lavender, violet liqueur and aquafaba in a bird-shaped glass.', 'Billed as the first cocktail in Mexico with an augmented reality layer: scanning a QR code shows virtual flowers and butterflies around the glass.

Sources: https://www.pendulummag.com/travel/2023/2/20/bekeb-bar-50-best-discovery-recognizes-bekebs-author-artisanal-mixology-proposal', NULL, NULL, NULL, NULL, NULL),
    ('venderbar', NULL, 'Milo Dinosaur', 'Hazelnut and yoghurt-washed whisky with apple, inspired by the Milo Dinosaur chocolate malt drink.', 'Turns the Singaporean and Malaysian childhood favourite, an iced Milo heaped with extra Milo powder, into a clear dessert-style whisky drink.

Sources: https://www.theworlds50best.com/bars/best-in-asia/the-list/vender.html, https://www.thedrinkjournal.com/journal/vender-bar-taichung', NULL, NULL, NULL, NULL, NULL),
    ('venderbar', NULL, 'Kaya Toast', 'Beach Bum rum milk-washed with pandan and coconut, with hazelnut and Champagne.', 'Recreates Singapore''s kaya toast breakfast: milk washing carries the pandan and coconut of kaya jam, and it comes with a house biscuit and pandan cream on the side.

Sources: https://barstalker.de/en/vender-taichung/', NULL, NULL, NULL, NULL, NULL),
    ('venderbar', NULL, 'Durian Ice Cream', 'Spanish brandy, PX sherry and chocolate mint schnapps, garnished with fresh durian between waffles.', 'A bittersweet drink nodding to the durian ice-cream sandwiches sold on Singapore''s streets.

Sources: https://barstalker.de/en/vender-taichung/', NULL, NULL, NULL, NULL, NULL),
    ('venderbar', NULL, 'Cigar Vending Machine', 'Dark rum, red wine syrup, lemon, egg white, aromatised wine and chocolate bitters, smoked with Taiwanese cypress chips.', 'A rich sour whose smoke comes from local cypress wood rather than tobacco, named like every signature after a type of vending machine.

Sources: https://www.thedrinkjournal.com/journal/vender-bar-taichung', NULL, NULL, NULL, NULL, NULL),
    ('librarybartoronto', NULL, 'Birdbath Martini', 'House Quill gin or vodka with a house vermouth blend, house orange bitters and lemon oil, with olives and pickled onions.', 'The bar''s famous signature, mixed tableside, thrown from a height and served from a hand-blown carafe. James Grant developed Quill gin and vodka with Dillon''s Small Batch Distillers in Niagara for it; a Luxe version adds an olive oil and butter spirit, pretzel and sturgeon caviar.

Sources: https://www.librarybartoronto.com/menus/, https://foodism.ca/eat-drink/bars-restaurants/library-bar/', 'Martini', NULL, NULL, NULL, NULL),
    ('librarybartoronto', NULL, 'Belly of the Beast', 'Bearface Canadian whisky, Appleton 12 rum and Metaxa with mace, pecan, sea buckthorn, grapefruit and blood bitters, in a porcelain lion.', 'Tiki drink from the Lights menu, for the novel''s Macedonian immigrant Nicholas Temelcoff. The whisky is infused with pecan and washed with brown butter, and the lion vessel echoes the lions outside the hotel.

Sources: https://www.librarybartoronto.com/menus/, https://foodism.ca/eat-drink/bars-restaurants/library-bar/', NULL, NULL, NULL, NULL, NULL),
    ('librarybartoronto', NULL, 'The Builder', 'Belvedere vodka, Calvados, quinquina, crème de cacao, fino sherry, peach and olive, served with edible concrete.', 'Based on the 20th Century cocktail and named for public works commissioner R.C. Harris. The concrete is a black pepper and olive meringue dyed grey with black sesame.

Sources: https://www.librarybartoronto.com/menus/, https://foodism.ca/eat-drink/bars-restaurants/library-bar/', NULL, NULL, NULL, NULL, NULL),
    ('librarybartoronto', NULL, 'Missing Millionaire', 'Macallan 12, Michter''s bourbon and coconut-washed Lot No. 40 rye with Benedictine and Cocchi Torino vermouth.', 'Inspired by the real disappearance of Toronto millionaire Ambrose Small. Three whiskies are fat-washed together with coconut oil so the drink reads like a Rob Roy or Manhattan but is richer underneath.

Sources: https://www.librarybartoronto.com/menus/, https://foodism.ca/eat-drink/bars-restaurants/library-bar/', 'Manhattan', NULL, NULL, NULL, NULL),
    ('librarybartoronto', NULL, 'Midnight Snow', 'Raspberry-infused Citadelle gin with elderflower liqueur, blueberry, lime, espresso and salt.', 'A lighter, fruitier Espresso Martini inspired by a secret performance in the novel, balancing coffee with berries and elderflower.

Created by James Grant.

Method: Shake all ingredients with ice and strain into your preferred glass.
Raspberry-infused gin: Blend equal volumes of fresh raspberries and gin for 10 seconds, then pour through a coffee filter into a clean bottle.

Spec from Foodism Toronto (https://foodism.ca/eat-drink/bars-restaurants/library-bar/).', 'Espresso Martini', NULL, NULL, NULL, 'Shake'),
    ('servicebardc', NULL, 'Suffering Bastard', 'Wild Turkey 81 bourbon and Fords gin with fresh ginger, mint, lime and bitters.', 'The house take on the 1940s Cairo hotel-bar classic splits bourbon and gin and uses fresh ginger; 50 Best picks it out as one of the bar''s more complex drinks.

Sources: https://www.servicebardc.com/menu, https://www.theworlds50best.com/bars/best-in-north-america/the-list/service-bar.html', NULL, NULL, NULL, NULL, NULL),
    ('servicebardc', NULL, 'Celery Martini', 'Fords gin, celery, Yzaguirre blanco vermouth, Old Bay, brine and curry leaf oil.', 'A savoury martini that works the Chesapeake seasoning Old Bay and a curry leaf oil into a clean gin base.

Sources: https://www.servicebardc.com/menu', 'Martini', NULL, NULL, NULL, NULL),
    ('servicebardc', NULL, 'SB Old Fashioned', 'Wild Turkey 81 bourbon and Lustau Spanish brandy with turbinado sugar and Angostura bitters.', 'The house Old Fashioned splits bourbon with Spanish brandy and is one of the drinks on the famously cheap weekday happy hour.

Sources: https://www.servicebardc.com/menu', 'Old Fashioned', NULL, NULL, NULL, NULL),
    ('servicebardc', NULL, 'Sweater Weather', 'Whisky with chai, apple, honey, sherry and Angostura bitters.', 'An autumnal spiced drink that 50 Best cites as typical of the bar''s whimsical but serious originals.

Sources: https://www.theworlds50best.com/bars/best-in-north-america/the-list/service-bar.html', NULL, NULL, NULL, NULL, NULL);

INSERT INTO "seed_lines" VALUES
    ('barkumiko', NULL, 'Bright One', 0, 0.5, 'oz', 'Lemon Juice', NULL, 'fresh', false),
    ('barkumiko', NULL, 'Bright One', 1, 1, 'oz', 'Yuzu Juice', NULL, NULL, false),
    ('barkumiko', NULL, 'Bright One', 2, 0.5, 'oz', 'Seedlip Garden 108', 'Non-alcoholic Botanical Spirit', NULL, false),
    ('barkumiko', NULL, 'Bright One', 3, 0.75, 'oz', 'Honey Syrup', NULL, 'chilled', false),
    ('barkumiko', NULL, 'Bright One', 4, NULL, 'top', 'Ginger Beer', NULL, 'a splash', false),
    ('barkumiko', NULL, 'Bright One', 5, NULL, NULL, 'Mint sprig hooked through a lemon peel on the rim', NULL, 'garnish', false),
    ('barkumiko', NULL, 'Protea', 0, 0.75, 'oz', 'Seedlip Spice 94', 'Non-alcoholic Spirit', NULL, false),
    ('barkumiko', NULL, 'Protea', 1, 0.75, 'oz', 'Verjus Rouge', NULL, NULL, false),
    ('barkumiko', NULL, 'Protea', 2, 0.75, 'oz', 'Adzuki Syrup', NULL, 'house-made', false),
    ('barkumiko', NULL, 'Protea', 3, 0.75, 'oz', 'Benimosu (purple Sweet Potato Vinegar) Syrup', NULL, 'house-made', false),
    ('barkumiko', NULL, 'Protea', 4, NULL, 'top', 'Soda', NULL, NULL, false),
    ('barkumiko', NULL, 'Protea', 5, NULL, 'top', 'Indian Tonic Water', NULL, NULL, false),
    ('barkumiko', NULL, 'Protea', 6, NULL, NULL, 'Grated white chocolate and grated nutmeg', NULL, 'garnish', false),
    ('barkumiko', NULL, 'Julia Momosé''s Highball', 0, 0.25, 'tsp', 'Huilerie Beaujolaise', 'Mango Vinegar', NULL, false),
    ('barkumiko', NULL, 'Julia Momosé''s Highball', 1, 0.25, 'oz', 'Rhine Hall Mango Brandy', 'Mango Brandy', NULL, false),
    ('barkumiko', NULL, 'Julia Momosé''s Highball', 2, 0.25, 'oz', 'Black Cardamom Sauternes', NULL, 'house-made', false),
    ('barkumiko', NULL, 'Julia Momosé''s Highball', 3, 1.5, 'oz', 'Nikka Taketsuru Pure Malt Japanese Whisky', 'Japanese Whisky', NULL, false),
    ('barkumiko', NULL, 'Julia Momosé''s Highball', 4, NULL, 'top', 'Fever-Tree', 'Soda', NULL, false),
    ('barkumiko', NULL, 'Julia Momosé''s Highball', 5, NULL, NULL, 'Manicured orange twist', NULL, 'garnish', false),
    ('alice_cheongdam', NULL, 'Don Spectre', 0, 4.5, 'cl', 'Reposado Tequila', NULL, 'jalapeño-infused', false),
    ('alice_cheongdam', NULL, 'Don Spectre', 1, 2.25, 'cl', 'Mezcal', NULL, NULL, false),
    ('alice_cheongdam', NULL, 'Don Spectre', 2, 1, 'bsp', 'Agave Syrup', NULL, NULL, false),
    ('alice_cheongdam', NULL, 'Don Spectre', 3, 1, 'dash', 'Celeriac Bitters', NULL, NULL, false),
    ('alice_cheongdam', NULL, 'Don Spectre', 4, NULL, NULL, 'Rosemary and pine needle smoke', NULL, 'garnish', false),
    ('barsathorn', NULL, 'Bangkok Brunch', 0, NULL, NULL, 'Creyente Mezcal Joven', 'Mezcal', NULL, false),
    ('barsathorn', NULL, 'Bangkok Brunch', 1, NULL, NULL, '1800 Blanco Tequila Reserva', 'Tequila', NULL, false),
    ('barsathorn', NULL, 'Bangkok Brunch', 2, NULL, NULL, 'Pad Krapow', NULL, 'pork bacon, Thai basil, chilli, black pepper', false),
    ('barsathorn', NULL, 'Bangkok Brunch', 3, NULL, NULL, 'Salted Tomato Water', NULL, NULL, false),
    ('barsathorn', NULL, 'Bangkok Brunch', 4, NULL, NULL, 'Rice Vinegar', NULL, NULL, false),
    ('barsathorn', NULL, 'Bangkok Brunch', 5, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('barsathorn', NULL, 'Bangkok Brunch', 6, NULL, NULL, 'Whole frozen tomato (in place of ice)', NULL, 'garnish', false),
    ('barsathorn', NULL, 'Staro Sbagliato', 0, NULL, NULL, 'Campari', 'Bitter Aperitivo', NULL, false),
    ('barsathorn', NULL, 'Staro Sbagliato', 1, NULL, NULL, 'Cardamom', NULL, NULL, false),
    ('barsathorn', NULL, 'Staro Sbagliato', 2, NULL, NULL, 'Mancino Secco Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('barsathorn', NULL, 'Staro Sbagliato', 3, NULL, NULL, 'Sweet Basil Wine', NULL, NULL, false),
    ('barsathorn', NULL, 'Staro Sbagliato', 4, NULL, NULL, 'Caper and Lemon Sorbet', NULL, NULL, false),
    ('barsathorn', NULL, 'Staro Sbagliato', 5, NULL, NULL, 'CO2', NULL, 'carbonation', false),
    ('barsathorn', NULL, 'The Consular Sip', 0, NULL, NULL, 'Dewar''s 12 Year Old Blended Scotch', 'Blended Scotch Whisky', NULL, false),
    ('barsathorn', NULL, 'The Consular Sip', 1, NULL, NULL, 'Tom Kha Broth', NULL, 'served hot', false),
    ('barsathorn', NULL, 'The Consular Sip', 2, NULL, NULL, 'Coconut and Coriander Foam', NULL, 'served cold', false),
    ('barsathorn', NULL, 'The Pina', 0, NULL, NULL, 'Rémy Martin VSOP Cognac', 'Cognac', NULL, false),
    ('barsathorn', NULL, 'The Pina', 1, NULL, NULL, 'Pickled Pineapple', NULL, NULL, false),
    ('barsathorn', NULL, 'The Pina', 2, NULL, NULL, 'Coconut Hard Seltzer', NULL, NULL, false),
    ('barsathorn', NULL, 'The Pina', 3, NULL, NULL, 'CO2', NULL, 'carbonation', false),
    ('barsathorn', NULL, 'Skyline Drift', 0, NULL, NULL, 'Maker''s Mark Bourbon', 'Bourbon', NULL, false),
    ('barsathorn', NULL, 'Skyline Drift', 1, NULL, NULL, 'Aperol', 'Aperitivo', NULL, false),
    ('barsathorn', NULL, 'Skyline Drift', 2, NULL, NULL, 'Apsara Bar Sathorn Thai Amaro', 'Thai Amaro', NULL, false),
    ('barsathorn', NULL, 'Skyline Drift', 3, NULL, NULL, 'Kalamansi', NULL, NULL, false),
    ('soka_blr', NULL, 'Soap & Jack', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('soka_blr', NULL, 'Soap & Jack', 1, NULL, NULL, 'Makrut Lime', NULL, NULL, false),
    ('soka_blr', NULL, 'Soap & Jack', 2, NULL, NULL, 'Green Smoked Guava', NULL, NULL, false),
    ('soka_blr', NULL, 'Soap & Jack', 3, NULL, NULL, 'Curry Leaves', NULL, NULL, false),
    ('soka_blr', NULL, 'Soap & Jack', 4, NULL, NULL, 'Chilli Vinegar', NULL, NULL, false),
    ('soka_blr', NULL, 'Soap & Jack', 5, NULL, NULL, 'Lemon Oil', NULL, NULL, false),
    ('soka_blr', NULL, 'Made in Heaven', 0, NULL, NULL, 'Aged Rum', NULL, NULL, false),
    ('soka_blr', NULL, 'Made in Heaven', 1, NULL, NULL, 'Coconut Rum', NULL, NULL, false),
    ('soka_blr', NULL, 'Made in Heaven', 2, NULL, NULL, 'Frozen Strawberries', NULL, NULL, false),
    ('soka_blr', NULL, 'Made in Heaven', 3, NULL, NULL, 'Coconut Milk', NULL, NULL, false),
    ('soka_blr', NULL, 'Made in Heaven', 4, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('soka_blr', NULL, 'Made in Heaven', 5, NULL, NULL, 'Acids', NULL, NULL, false),
    ('soka_blr', NULL, 'Sakkath Martini', 0, NULL, NULL, 'Bulldog Gin', 'Gin', NULL, false),
    ('soka_blr', NULL, 'Sakkath Martini', 1, NULL, NULL, 'Extra Dry Vermouth', NULL, NULL, false),
    ('soka_blr', NULL, 'Sakkath Martini', 2, NULL, NULL, 'Choya', 'Ume Liqueur', NULL, false),
    ('soka_blr', NULL, 'Sakkath Martini', 3, NULL, NULL, 'Herb Tincture', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Why Did The Onion Blush?', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Why Did The Onion Blush?', 1, NULL, NULL, 'Lychee', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Why Did The Onion Blush?', 2, NULL, NULL, 'Red Onion', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Why Did The Onion Blush?', 3, NULL, NULL, 'Green Chilli', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Why Did The Onion Blush?', 4, NULL, NULL, 'Yoghurt', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Siolim Salsa', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Siolim Salsa', 1, NULL, NULL, 'Grapefruit', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Siolim Salsa', 2, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Siolim Salsa', 3, NULL, NULL, 'Gochujang', NULL, NULL, false),
    ('boilermaker.goa', NULL, 'Siolim Salsa', 4, NULL, NULL, 'Jalapeño', NULL, NULL, false),
    ('bandistahouston', NULL, 'Menage a Trois', 0, NULL, NULL, 'Cognac', NULL, NULL, false),
    ('bandistahouston', NULL, 'Menage a Trois', 1, NULL, NULL, 'Crème de Cacao', NULL, NULL, false),
    ('bandistahouston', NULL, 'Menage a Trois', 2, NULL, NULL, 'Coffee Liqueur', NULL, NULL, false),
    ('bandistahouston', NULL, 'Menage a Trois', 3, NULL, NULL, 'Cream', NULL, 'local', false),
    ('bandistahouston', NULL, 'Menage a Trois', 4, NULL, NULL, 'Cacao Butter', NULL, NULL, false),
    ('bandistahouston', NULL, 'Menage a Trois', 5, NULL, NULL, 'Made-to-order dipping dots', NULL, 'garnish', false),
    ('bandistahouston', NULL, 'Almost Famous', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('bandistahouston', NULL, 'Almost Famous', 1, NULL, NULL, 'Roasted Pineapple', NULL, NULL, false),
    ('bandistahouston', NULL, 'Almost Famous', 2, NULL, NULL, 'Génépy', NULL, 'infused with Mexican tea', false),
    ('bandistahouston', NULL, 'Almost Famous', 3, NULL, NULL, 'Japanese Amaro', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Guacamole Frozen Margarita', 0, NULL, NULL, 'Avocado', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Guacamole Frozen Margarita', 1, NULL, NULL, 'Clarified Clamato', NULL, '''clearmato''', false),
    ('daisy.losangeles', NULL, 'Guacamole Frozen Margarita', 2, NULL, NULL, 'El Tesoro Blanco Tequila', 'Blanco Tequila', NULL, false),
    ('daisy.losangeles', NULL, 'Guacamole Frozen Margarita', 3, NULL, NULL, 'Damiana Liqueur', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Guacamole Frozen Margarita', 4, NULL, NULL, 'Lime', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Baja Slaw Margarita', 0, NULL, NULL, 'Purple Cabbage', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Baja Slaw Margarita', 1, NULL, NULL, 'Mal Bien x Mírate Mezcal', 'Mezcal Espadín', NULL, false),
    ('daisy.losangeles', NULL, 'Baja Slaw Margarita', 2, NULL, NULL, 'Oaxacan Fruit Liqueur', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Baja Slaw Margarita', 3, NULL, NULL, 'Güey', NULL, 'as listed on the menu', false),
    ('daisy.losangeles', NULL, 'Baja Slaw Margarita', 4, NULL, NULL, 'Pulque Vinegar', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Baja Slaw Margarita', 5, NULL, NULL, 'Lime', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Baja Slaw Margarita', 6, NULL, NULL, 'Fish Sauce', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Mangoneada Margarita', 0, NULL, NULL, 'Mango', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Mangoneada Margarita', 1, NULL, NULL, 'Pasilla Mixe Chile', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Mangoneada Margarita', 2, NULL, NULL, 'Derrumbes Cenizo Mezcal', 'Mezcal', NULL, false),
    ('daisy.losangeles', NULL, 'Mangoneada Margarita', 3, NULL, NULL, 'Mango Brandy', NULL, 'Oaxacan', false),
    ('daisy.losangeles', NULL, 'Mangoneada Margarita', 4, NULL, NULL, 'Lime', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Mangoneada Margarita', 5, NULL, NULL, 'Chamoy', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Mangoneada Margarita', 6, NULL, NULL, 'Mango boba', NULL, 'garnish', false),
    ('daisy.losangeles', NULL, 'Dirty Shirley Margarita', 0, NULL, NULL, 'Tart Cherry', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Dirty Shirley Margarita', 1, NULL, NULL, 'Lemon-lime Cordial', NULL, 'house ''Sprite'' cordial', false),
    ('daisy.losangeles', NULL, 'Dirty Shirley Margarita', 2, NULL, NULL, 'Sonajero', 'Ponche', NULL, false),
    ('daisy.losangeles', NULL, 'Dirty Shirley Margarita', 3, NULL, NULL, 'Granada Vallet', 'Pomegranate Liqueur', NULL, false),
    ('daisy.losangeles', NULL, 'Dirty Shirley Margarita', 4, NULL, NULL, 'G4 Blanco Tequila', 'Blanco Tequila', NULL, false),
    ('daisy.losangeles', NULL, 'Tommy''s Margarita', 0, NULL, NULL, 'Tromba Blanco Tequila', 'Blanco Tequila', 'or Mal Bien x Mírate mezcal', false),
    ('daisy.losangeles', NULL, 'Tommy''s Margarita', 1, NULL, NULL, 'Lime', NULL, NULL, false),
    ('daisy.losangeles', NULL, 'Tommy''s Margarita', 2, NULL, NULL, 'Nogave', NULL, 'house agave-syrup substitute', false),
    ('limantourmx', NULL, 'Margarita al Pastor', 0, 1.75, 'oz', 'Tequila', NULL, 'scant', false),
    ('limantourmx', NULL, 'Margarita al Pastor', 1, 1.5, 'oz', 'Taco Mix', NULL, 'heavy; house-made, see preps', false),
    ('limantourmx', NULL, 'Margarita al Pastor', 2, 0.75, 'oz', 'Cointreau', 'Orange Liqueur', 'scant', false),
    ('limantourmx', NULL, 'Margarita al Pastor', 3, 0.75, 'oz', 'Lime Juice', NULL, 'heavy', false),
    ('limantourmx', NULL, 'Margarita al Pastor', 4, NULL, NULL, 'Cilantro salt rim (10:9 sea salt to powdered cilantro), pineapple wedge', NULL, 'garnish', false),
    ('limantourmx', NULL, 'Orégano', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('limantourmx', NULL, 'Orégano', 1, NULL, NULL, 'Ancho Reyes', 'Chile Liqueur', NULL, false),
    ('limantourmx', NULL, 'Orégano', 2, NULL, NULL, 'Black Tea', NULL, NULL, false),
    ('limantourmx', NULL, 'Orégano', 3, NULL, NULL, 'Oregano', NULL, NULL, false),
    ('limantourmx', NULL, 'Orégano', 4, NULL, NULL, 'Pineapple Juice', NULL, NULL, false),
    ('limantourmx', NULL, 'Orégano', 5, NULL, NULL, 'Mint bouquet', NULL, 'garnish', false),
    ('barmadonnabk', NULL, 'Limoncello Milk Punch', 0, NULL, NULL, 'Limoncello', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Limoncello Milk Punch', 1, NULL, NULL, 'Fords Gin', 'Gin', NULL, false),
    ('barmadonnabk', NULL, 'Limoncello Milk Punch', 2, NULL, NULL, 'Mijenta Tequila', 'Tequila', NULL, false),
    ('barmadonnabk', NULL, 'Limoncello Milk Punch', 3, NULL, NULL, 'Genmaicha', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Limoncello Milk Punch', 4, NULL, NULL, 'Shiso', NULL, 'syrup, per Spaced Magazine', false),
    ('barmadonnabk', NULL, 'Limoncello Milk Punch', 5, NULL, NULL, 'Milk', NULL, 'for clarification', false),
    ('barmadonnabk', NULL, 'Nonna''s Half & Half', 0, NULL, NULL, 'Bombay Sapphire Gin', 'Gin', NULL, false),
    ('barmadonnabk', NULL, 'Nonna''s Half & Half', 1, NULL, NULL, 'Altamura Vodka', 'Vodka', NULL, false),
    ('barmadonnabk', NULL, 'Nonna''s Half & Half', 2, NULL, NULL, 'Gran Basso Vermouth', 'Vermouth', NULL, false),
    ('barmadonnabk', NULL, 'Nonna''s Half & Half', 3, NULL, NULL, 'Bordiga Bianco Vermouth', 'Bianco Vermouth', NULL, false),
    ('barmadonnabk', NULL, 'Puttanesca Martini', 0, NULL, NULL, 'Beefeater Gin', 'Gin', NULL, false),
    ('barmadonnabk', NULL, 'Puttanesca Martini', 1, NULL, NULL, 'Olive', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Puttanesca Martini', 2, NULL, NULL, 'Tomato', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Puttanesca Martini', 3, NULL, NULL, 'Capers', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Puttanesca Martini', 4, NULL, NULL, 'Anchovy', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Don Fanucci', 0, NULL, NULL, 'Michter''s Bourbon', 'Bourbon', NULL, false),
    ('barmadonnabk', NULL, 'Don Fanucci', 1, NULL, NULL, 'Cognac', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Don Fanucci', 2, NULL, NULL, 'Faccia Alpino', 'Alpine Liqueur', NULL, false),
    ('barmadonnabk', NULL, 'Don Fanucci', 3, NULL, NULL, 'Olive Oil', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Don Fanucci', 4, NULL, NULL, 'Thyme', NULL, NULL, false),
    ('barmadonnabk', NULL, 'Don Fanucci', 5, NULL, NULL, 'Apricot', NULL, NULL, false),
    ('bar.cham', NULL, 'Wonju', 0, NULL, NULL, 'Mowallin', 'Rice Spirit', NULL, false),
    ('bar.cham', NULL, 'Wonju', 1, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('bar.cham', NULL, 'Wonju', 2, NULL, NULL, 'Corn Cream', NULL, NULL, false),
    ('bar.cham', NULL, 'Wonju', 3, NULL, NULL, 'Corn Silk', NULL, NULL, false),
    ('bar.cham', NULL, 'Wonju', 4, NULL, NULL, 'Black Pepper', NULL, NULL, false),
    ('bar.cham', NULL, 'Wonju', 5, NULL, NULL, 'Egg Yolk', NULL, NULL, false),
    ('bar.cham', NULL, 'Chungju Gimbap', 0, NULL, NULL, 'Tokki Soju', 'Soju', NULL, false),
    ('bar.cham', NULL, 'Chungju Gimbap', 1, NULL, NULL, 'Makgeolli-wasabi Shrub', NULL, NULL, false),
    ('bar.cham', NULL, 'Chungju Gimbap', 2, NULL, NULL, 'Cucumber', NULL, NULL, false),
    ('bar.cham', NULL, 'Chungju Gimbap', 3, NULL, NULL, 'Lemon', NULL, NULL, false),
    ('bar.cham', NULL, 'Chungju Gimbap', 4, NULL, NULL, 'Sesame Oil', NULL, 'a single drop', false),
    ('bar.cham', NULL, 'Hamyang', 0, NULL, NULL, 'Damsol', 'Rice Spirit', 'ghee butter-washed', false),
    ('bar.cham', NULL, 'Hamyang', 1, NULL, NULL, 'Apple Brandy', NULL, 'Korean', false),
    ('bar.cham', NULL, 'Hamyang', 2, NULL, NULL, 'Lemon', NULL, NULL, false),
    ('bar.cham', NULL, 'Hamyang', 3, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('bar.cham', NULL, 'Hamyang', 4, NULL, NULL, 'Islay Scotch Whisky', NULL, NULL, false),
    ('botanistdining', NULL, 'Botanist Marine Martini', 0, NULL, NULL, 'Gin', NULL, 'dry gin blend', false),
    ('botanistdining', NULL, 'Botanist Marine Martini', 1, NULL, NULL, 'Vermouth', NULL, 'house-made', false),
    ('botanistdining', NULL, 'Botanist Marine Martini', 2, NULL, NULL, 'Kombu', NULL, NULL, false),
    ('botanistdining', NULL, 'Botanist Marine Martini', 3, NULL, NULL, 'Chive Oil', NULL, NULL, false),
    ('botanistdining', NULL, 'Botanist Marine Martini', 4, NULL, NULL, 'Sea Asparagus', NULL, NULL, false),
    ('botanistdining', NULL, 'Duck Duck Goose', 0, NULL, NULL, 'Japanese Whisky', NULL, 'fat-washed with foie gras', false),
    ('botanistdining', NULL, 'Duck Duck Goose', 1, NULL, NULL, 'Sweet Vermouth', NULL, NULL, false),
    ('botanistdining', NULL, 'Duck Duck Goose', 2, NULL, NULL, 'Pear', NULL, NULL, false),
    ('botanistdining', NULL, 'Duck Duck Goose', 3, NULL, NULL, 'Date', NULL, NULL, false),
    ('botanistdining', NULL, 'Duck Duck Goose', 4, NULL, NULL, 'Saline', NULL, NULL, false),
    ('botanistdining', NULL, 'Duck Duck Goose', 5, NULL, NULL, 'Bitters', NULL, NULL, false),
    ('botanistdining', NULL, 'Carrot Boulevardier', 0, NULL, NULL, 'Rye Whiskey', NULL, NULL, false),
    ('botanistdining', NULL, 'Carrot Boulevardier', 1, NULL, NULL, 'Campari', 'Bitter Aperitivo', NULL, false),
    ('botanistdining', NULL, 'Carrot Boulevardier', 2, NULL, NULL, 'Vermouth', NULL, NULL, false),
    ('botanistdining', NULL, 'Carrot Boulevardier', 3, NULL, NULL, 'Carrot Cordial', NULL, NULL, false),
    ('botanistdining', NULL, 'Carrot Boulevardier', 4, NULL, NULL, 'Nigella Seed', NULL, NULL, false),
    ('botanistdining', NULL, 'Beekeeper', 0, NULL, NULL, 'Canadian Rye Whisky', NULL, '100% rye', false),
    ('botanistdining', NULL, 'Beekeeper', 1, NULL, NULL, 'Honey', NULL, NULL, false),
    ('botanistdining', NULL, 'Beekeeper', 2, NULL, NULL, 'Lemon', NULL, NULL, false),
    ('botanistdining', NULL, 'Beekeeper', 3, NULL, NULL, 'Candy Cap Mushrooms', NULL, NULL, false),
    ('botanistdining', NULL, 'Beekeeper', 4, NULL, NULL, 'Yellow Chartreuse', 'Herbal Liqueur', NULL, false),
    ('mirate.losangeles', NULL, 'Tu Compa', 0, NULL, NULL, 'Cascahuín 48 Plata Tequila', 'Tequila', 'batch recipe; source prints 2 liters', false),
    ('mirate.losangeles', NULL, 'Tu Compa', 1, NULL, NULL, 'Pulque', NULL, 'batch recipe; source prints 1 liter', false),
    ('mirate.losangeles', NULL, 'Tu Compa', 2, NULL, NULL, 'Nami Junmai Ginjo Sake', 'Junmai Ginjo Sake', 'batch recipe; source prints 1 liter', false),
    ('mirate.losangeles', NULL, 'Tu Compa', 3, NULL, NULL, 'Granada Vallet', 'Pomegranate Liqueur', 'batch recipe', false),
    ('mirate.losangeles', NULL, 'Tu Compa', 4, NULL, NULL, 'Squirt Cordial', NULL, 'house-made; source prints 2 liters', false),
    ('mirate.losangeles', NULL, 'Tu Compa', 5, NULL, NULL, 'Water', NULL, 'source prints 9 liters', false),
    ('mirate.losangeles', NULL, 'Tu Compa', 6, NULL, NULL, 'Pulque Paint', NULL, 'house-made, for the half rim', false),
    ('mirate.losangeles', NULL, 'Tu Compa', 7, NULL, NULL, 'Grapefruit Spray', NULL, 'house-made', false),
    ('mirate.losangeles', NULL, 'Tu Compa', 8, NULL, NULL, 'Pulque paint half rim, grapefruit spray', NULL, 'garnish', false),
    ('selvaoaxaca', NULL, 'Tropical', 0, 22, 'ml', 'Johnnie Walker Black Label Scotch', 'Scotch Whisky', NULL, false),
    ('selvaoaxaca', NULL, 'Tropical', 1, 7, 'ml', 'Agricultural Rum', NULL, 'Mexican', false),
    ('selvaoaxaca', NULL, 'Tropical', 2, 7, 'ml', 'Mint Liqueur', NULL, 'Italian', false),
    ('selvaoaxaca', NULL, 'Tropical', 3, 22, 'ml', 'Banana Liqueur', NULL, 'Mexican', false),
    ('selvaoaxaca', NULL, 'Tropical', 4, 7, 'ml', 'Rice Vinegar', NULL, NULL, false),
    ('selvaoaxaca', NULL, 'Tropical', 5, NULL, NULL, 'Corn Miso', NULL, 'amount not given', false),
    ('barlibre_ikebukuro', NULL, 'Mr D', 0, 30, 'ml', 'Scotch Whisky', NULL, NULL, false),
    ('barlibre_ikebukuro', NULL, 'Mr D', 1, 20, 'ml', 'Disaronno', 'Amaretto', NULL, false),
    ('barlibre_ikebukuro', NULL, 'Mr D', 2, 10, 'ml', 'Amaro', NULL, NULL, false),
    ('barlibre_ikebukuro', NULL, 'Mr D', 3, 10, 'ml', 'Lemon Juice', NULL, 'fresh', false),
    ('barlibre_ikebukuro', NULL, 'Mr D', 4, 10, 'ml', 'Honey', NULL, NULL, false),
    ('barlibre_ikebukuro', NULL, 'Mr D', 5, 1, 'slice', 'Ginger', NULL, 'fresh', false),
    ('barlibre_ikebukuro', NULL, 'Mr D', 6, NULL, NULL, 'Lemon and a mint sprig', NULL, 'garnish', false),
    ('elgalloaltanero', NULL, 'Fandango', 0, 30, 'ml', 'Cascahuin Reposado Tequila', 'Reposado Tequila', NULL, false),
    ('elgalloaltanero', NULL, 'Fandango', 1, 30, 'ml', 'Fino Sherry', NULL, NULL, false),
    ('elgalloaltanero', NULL, 'Fandango', 2, 30, 'ml', 'Dolin Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('elgalloaltanero', NULL, 'Fandango', 3, 1, 'bsp', 'Agave Syrup', NULL, 'a small barspoon', false),
    ('elgalloaltanero', NULL, 'Fandango', 4, NULL, NULL, 'Olive or lemon peel', NULL, 'garnish', false),
    ('cafelatrovamiami', NULL, 'Daiquiri Clásico', 0, 2, 'oz', 'Planteray 3 Stars White Rum', 'White Rum', 'Punch''s recipe page names Planteray 3 Stars; the article and current menu use Bacardi Superior', false),
    ('cafelatrovamiami', NULL, 'Daiquiri Clásico', 1, 0.75, 'oz', 'Lime Juice', NULL, 'fresh', false),
    ('cafelatrovamiami', NULL, 'Daiquiri Clásico', 2, 0.5, 'tbsp', 'White Granulated Sugar', NULL, NULL, false),
    ('cafelatrovamiami', NULL, 'Greta Garbo', 0, 2, 'oz', 'White Rum', NULL, NULL, false),
    ('cafelatrovamiami', NULL, 'Greta Garbo', 1, 3, 'dash', 'Absinthe', NULL, NULL, false),
    ('cafelatrovamiami', NULL, 'Greta Garbo', 2, 0.75, 'oz', 'Lime Juice', NULL, 'fresh', false),
    ('cafelatrovamiami', NULL, 'Greta Garbo', 3, 0.5, 'tbsp', 'White Granulated Sugar', NULL, NULL, false),
    ('cafelatrovamiami', NULL, 'Buenavista', 0, NULL, NULL, 'Cucumber', NULL, NULL, false),
    ('cafelatrovamiami', NULL, 'Buenavista', 1, 1, 'sprig', 'Mint', NULL, NULL, false),
    ('cafelatrovamiami', NULL, 'Buenavista', 2, 0.5, 'oz', 'Simple Syrup', NULL, NULL, false),
    ('cafelatrovamiami', NULL, 'Buenavista', 3, 0.5, 'oz', 'Lime Juice', NULL, NULL, false),
    ('cafelatrovamiami', NULL, 'Buenavista', 4, 0.5, 'oz', 'St-Germain', 'Elderflower Liqueur', NULL, false),
    ('cafelatrovamiami', NULL, 'Buenavista', 5, 0.75, 'oz', 'Hendrick''s Gin', 'Gin', NULL, false),
    ('cafelatrovamiami', NULL, 'Buenavista', 6, 0.75, 'oz', 'Finlandia Vodka', 'Vodka', NULL, false),
    ('cafelatrovamiami', NULL, 'Buenavista', 7, NULL, NULL, 'Cucumber slice and mint', NULL, 'garnish', false),
    ('pch_sf', NULL, 'Leeward Negroni', 0, NULL, NULL, 'Bittermens ''Elemakule Tiki Bitters', 'Tiki Bitters', 'rinse the glass', false),
    ('pch_sf', NULL, 'Leeward Negroni', 1, 1, 'oz', 'Campari', NULL, 'current menu uses coconut-washed Campari', false),
    ('pch_sf', NULL, 'Leeward Negroni', 2, 0.75, 'oz', 'Pandan Cordial', NULL, 'house-made', false),
    ('pch_sf', NULL, 'Leeward Negroni', 3, 0.5, 'oz', 'Sipsmith VJOP Gin', 'Gin', NULL, false),
    ('pch_sf', NULL, 'Leeward Negroni', 4, NULL, NULL, 'Fresh pandan leaf', NULL, 'garnish', false),
    ('prophecybar', NULL, 'Wabi Sabi Martini', 0, 2, 'oz', 'Tanqueray No. Ten Gin', 'Gin', 'redistilled with ceremonial-grade matcha', false),
    ('prophecybar', NULL, 'Wabi Sabi Martini', 1, 0.5, 'oz', 'Cocchi Americano', NULL, NULL, false),
    ('prophecybar', NULL, 'Wabi Sabi Martini', 2, 1, 'dash', 'The Japanese Bitters', 'Hinoki Bitters', NULL, false),
    ('prophecybar', NULL, 'Wabi Sabi Martini', 3, 1, 'dash', 'Saline Tincture', NULL, '5:1 water to salt', false),
    ('prophecybar', NULL, 'Wabi Sabi Martini', 4, NULL, NULL, 'Lime zest', NULL, 'garnish', false),
    ('viceversamiami', NULL, 'Little Toni.Co', 0, 0.5, 'oz', 'Sherry', NULL, 'en rama', false),
    ('viceversamiami', NULL, 'Little Toni.Co', 1, 0.5, 'oz', 'Bordiga Bianco Vermouth', 'Bianco Vermouth', NULL, false),
    ('viceversamiami', NULL, 'Little Toni.Co', 2, 0.5, 'oz', 'White Port', NULL, NULL, false),
    ('viceversamiami', NULL, 'Little Toni.Co', 3, 0.5, 'oz', 'St-Germain', 'Elderflower Liqueur', NULL, false),
    ('viceversamiami', NULL, 'Little Toni.Co', 4, 0.5, 'oz', 'Olive Brine', NULL, NULL, false),
    ('viceversamiami', NULL, 'Little Toni.Co', 5, 2, 'oz', 'Mediterranean Tonic Water', NULL, NULL, false),
    ('viceversamiami', NULL, 'Little Toni.Co', 6, NULL, NULL, 'One or two olives on a skewer', NULL, 'garnish', false),
    ('truelaurelsf', NULL, 'Laurel Martini', 0, 1.5, 'oz', 'Fords and The Botanist Gin', 'Gin', 'juniper and citrus-forward; the bar uses a mix of the two', false),
    ('truelaurelsf', NULL, 'Laurel Martini', 1, 1.5, 'oz', 'Dolin Dry and Berto Dry Vermouth', 'Dry Vermouth', 'the bar uses a mix of the two', false),
    ('truelaurelsf', NULL, 'Laurel Martini', 2, 0.25, 'oz', 'Quinquina', NULL, NULL, false),
    ('truelaurelsf', NULL, 'Laurel Martini', 3, 0.75, 'tsp', 'Bay Tincture', NULL, 'house-made', false),
    ('truelaurelsf', NULL, 'Laurel Martini', 4, NULL, NULL, 'Meyer lemon peel (expressed), 1 drop bay tincture, California bay leaf', NULL, 'garnish', false),
    ('truelaurelsf', NULL, 'Quinine Cobbler', 0, 0.75, 'oz', 'Cocchi Americano', 'Americano Aperitif Wine', NULL, false),
    ('truelaurelsf', NULL, 'Quinine Cobbler', 1, 0.75, 'oz', 'Contratto Bianco Vermouth', 'Bianco Vermouth', NULL, false),
    ('truelaurelsf', NULL, 'Quinine Cobbler', 2, 1, 'oz', 'Napoleon Amontillado Sherry', 'Amontillado Sherry', 'source lists ''Sherry-Amontillado Napoleon split''', false),
    ('truelaurelsf', NULL, 'Quinine Cobbler', 3, 0.5, 'oz', 'Grenadine', NULL, 'house-made', false),
    ('truelaurelsf', NULL, 'TL Carajillo', 0, 0.75, 'oz', 'Mr Black', 'Brew Coffee Liqueur', NULL, false),
    ('truelaurelsf', NULL, 'TL Carajillo', 1, 0.5, 'oz', 'Highland Park 12 Year Scotch', 'Scotch Whisky', NULL, false),
    ('truelaurelsf', NULL, 'TL Carajillo', 2, 1.25, 'oz', 'Licor 43', NULL, NULL, false),
    ('truelaurelsf', NULL, 'TL Carajillo', 3, 1, 'oz', 'Brew Coffee Concentrate', NULL, 'house-made', false),
    ('truelaurelsf', NULL, 'TL Carajillo', 4, NULL, NULL, 'Salt', NULL, 'to taste', false),
    ('thekeeferbar', NULL, 'Rosemary Gimlet', 0, 2, 'oz', 'Gin', NULL, NULL, false),
    ('thekeeferbar', NULL, 'Rosemary Gimlet', 1, 2, 'oz', 'Rosemary Gimlet Mix', NULL, 'made with The Keefer Bar', false),
    ('thekeeferbar', NULL, 'Rosemary Gimlet', 2, NULL, NULL, 'Fresh rosemary', NULL, 'garnish', false),
    ('opm.bkk', NULL, 'Campfire', 0, NULL, NULL, 'Michter''s Bourbon', 'Bourbon', 'infused with dark chocolate', false),
    ('opm.bkk', NULL, 'Campfire', 1, NULL, NULL, 'Apple Vinegar Reduction', NULL, NULL, false),
    ('opm.bkk', NULL, 'Campfire', 2, NULL, NULL, 'Coffee Flower Honey', NULL, 'local', false),
    ('opm.bkk', NULL, 'Campfire', 3, NULL, NULL, 'Mulled Wine', NULL, NULL, false),
    ('opm.bkk', NULL, 'Campfire', 4, NULL, NULL, 'Fire; served with a basket of aromatics', NULL, 'garnish', false),
    ('opm.bkk', NULL, 'Opium Martini', 0, NULL, NULL, 'Pokun Gin', 'Gin', NULL, false),
    ('opm.bkk', NULL, 'Opium Martini', 1, NULL, NULL, 'Tio Pepe Fino Sherry', 'Fino Sherry', NULL, false),
    ('opm.bkk', NULL, 'Opium Martini', 2, NULL, NULL, 'L''Ermitage Green', NULL, NULL, false),
    ('opm.bkk', NULL, 'Four-Way Martini', 0, NULL, NULL, 'Botanist Gin', 'Gin', NULL, false),
    ('opm.bkk', NULL, 'Four-Way Martini', 1, NULL, NULL, 'Cocchi Extra Dry Vermouth', 'Dry Vermouth', NULL, false),
    ('opm.bkk', NULL, 'Four-Way Martini', 2, NULL, NULL, 'Red Shiso Hydrosol', NULL, NULL, false),
    ('opm.bkk', NULL, 'Four-Way Martini', 3, NULL, NULL, 'Four different garnishes', NULL, 'garnish', false),
    ('opm.bkk', NULL, 'Negroni Pyrolyzed', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('opm.bkk', NULL, 'Negroni Pyrolyzed', 1, NULL, NULL, 'Campari', NULL, 'pyrolyzed: cooked at 70C', false),
    ('opm.bkk', NULL, 'Negroni Pyrolyzed', 2, NULL, NULL, 'White Vermouth', NULL, NULL, false),
    ('bisouschicago', NULL, 'Olivette', 0, NULL, NULL, 'Gin', NULL, 'olive leaf infused', false),
    ('bisouschicago', NULL, 'Olivette', 1, NULL, NULL, 'Stray Dog Gin', 'Gin', NULL, false),
    ('bisouschicago', NULL, 'Olivette', 2, NULL, NULL, 'Cartron Vermouth', 'Vermouth', NULL, false),
    ('bisouschicago', NULL, 'Olivette', 3, NULL, NULL, 'Saline', NULL, NULL, false),
    ('bisouschicago', NULL, 'The Tuxedo No. 2.1', 0, NULL, NULL, 'Absinthe', NULL, 'rinse', false),
    ('bisouschicago', NULL, 'The Tuxedo No. 2.1', 1, NULL, NULL, 'Citadelle Vive le Cornichon Gin', 'Gin', NULL, false),
    ('bisouschicago', NULL, 'The Tuxedo No. 2.1', 2, NULL, NULL, 'Dolin Blanc Vermouth', 'Blanc Vermouth', NULL, false),
    ('bisouschicago', NULL, 'The Tuxedo No. 2.1', 3, NULL, NULL, 'Maraschino Liqueur', NULL, NULL, false),
    ('bisouschicago', NULL, 'The French Seventy-Five', 0, NULL, NULL, 'Sparkling Wine', NULL, NULL, false),
    ('bisouschicago', NULL, 'The French Seventy-Five', 1, NULL, NULL, 'Gin', NULL, 'blend of gins', false),
    ('bisouschicago', NULL, 'The French Seventy-Five', 2, NULL, NULL, 'Brandy', NULL, 'blend of brandies', false),
    ('bisouschicago', NULL, 'The French Seventy-Five', 3, NULL, NULL, 'Citrus', NULL, NULL, false),
    ('bisouschicago', NULL, 'L''Jardine', 0, NULL, NULL, 'Aqua Perfecta Basil Brandy', 'Basil Brandy', NULL, false),
    ('bisouschicago', NULL, 'L''Jardine', 1, NULL, NULL, 'CH Vodka', 'Vodka', NULL, false),
    ('bisouschicago', NULL, 'L''Jardine', 2, NULL, NULL, 'Cocchi', NULL, NULL, false),
    ('bisouschicago', NULL, 'Pink Squirrel', 0, NULL, NULL, 'Almond Liqueur', NULL, NULL, false),
    ('bisouschicago', NULL, 'Pink Squirrel', 1, NULL, NULL, 'Cocoa Liqueur', NULL, NULL, false),
    ('bisouschicago', NULL, 'Pink Squirrel', 2, NULL, NULL, 'Rum Cream', NULL, 'house-made', false),
    ('bisouschicago', NULL, 'Pink Squirrel', 3, NULL, NULL, 'Orange dust', NULL, 'garnish', false),
    ('hudsonroomshanoi', NULL, 'Marco Polo', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'Marco Polo', 1, NULL, NULL, 'Celery and Eucalyptus Liqueur', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'Marco Polo', 2, NULL, NULL, 'Rhubarb Bitters', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'Marco Polo', 3, NULL, NULL, 'Acid', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'Marco Polo', 4, NULL, NULL, 'Ca Cuong (giant Water Bug) Essence', NULL, 'a tiny drop', false),
    ('hudsonroomshanoi', NULL, 'Marco Polo', 5, NULL, NULL, 'Salted jelly', NULL, 'garnish', false),
    ('hudsonroomshanoi', NULL, '61 Martini', 0, NULL, NULL, 'Vermouth', NULL, 'pineapple and coconut fat-washed', false),
    ('hudsonroomshanoi', NULL, '61 Martini', 1, NULL, NULL, 'Deep-fried mortadella-stuffed olive', NULL, 'garnish', false),
    ('hudsonroomshanoi', NULL, 'The Golden Dollar', 0, NULL, NULL, 'Bourbon', NULL, 'brown butter washed', false),
    ('hudsonroomshanoi', NULL, 'The Golden Dollar', 1, NULL, NULL, 'Maraschino Liqueur', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Golden Dollar', 2, NULL, NULL, 'Citrus', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Golden Dollar', 3, NULL, NULL, 'King Orange', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Golden Dollar', 4, NULL, NULL, 'Orange Bitters', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Golden Dollar', 5, NULL, NULL, 'Egg White', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Golden Dollar', 6, NULL, NULL, 'Soda', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Turquoise Rooms', 0, NULL, NULL, 'Pisco', NULL, 'bacon fat washed', false),
    ('hudsonroomshanoi', NULL, 'The Turquoise Rooms', 1, NULL, NULL, 'Chartreuse', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Turquoise Rooms', 2, NULL, NULL, 'Fino Sherry', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Turquoise Rooms', 3, NULL, NULL, 'Pea Stock', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Turquoise Rooms', 4, NULL, NULL, 'Citrus', NULL, NULL, false),
    ('hudsonroomshanoi', NULL, 'The Turquoise Rooms', 5, NULL, NULL, 'Angostura', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Robusta Negroni', 0, NULL, NULL, 'Reposado Tequila', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Robusta Negroni', 1, NULL, NULL, 'Gin', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Robusta Negroni', 2, NULL, NULL, 'Vermouth', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Robusta Negroni', 3, NULL, NULL, 'Campari', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Robusta Negroni', 4, NULL, NULL, 'Robusta Coffee', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Snow White', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Snow White', 1, NULL, NULL, 'White Rum', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Snow White', 2, NULL, NULL, 'Apple Yoghurt', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Snow White', 3, NULL, NULL, 'Gingerbread', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Smokey Highball', 0, NULL, NULL, 'Johnnie Walker Black Label Blended Scotch', 'Blended Scotch Whisky', NULL, false),
    ('thegoldentoothbar', NULL, 'Smokey Highball', 1, NULL, NULL, 'Agave Syrup', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Smokey Highball', 2, NULL, NULL, 'Sparkling Lapsang Souchong Tea', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Hubba Hubba', 0, NULL, NULL, 'Blood Orange Gin', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Hubba Hubba', 1, NULL, NULL, 'Solerno', 'Blood Orange Liqueur', NULL, false),
    ('thegoldentoothbar', NULL, 'Hubba Hubba', 2, NULL, NULL, 'Peach', NULL, NULL, false),
    ('thegoldentoothbar', NULL, 'Hubba Hubba', 3, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('barmauromx', NULL, 'Maurito', 0, NULL, NULL, 'Mezcal', NULL, NULL, false),
    ('barmauromx', NULL, 'Maurito', 1, NULL, NULL, 'Lillet', NULL, NULL, false),
    ('barmauromx', NULL, 'Maurito', 2, NULL, NULL, 'Tío Pepe Fino Sherry', 'Fino Sherry', NULL, false),
    ('barmauromx', NULL, 'Maurito', 3, NULL, NULL, 'Guava', NULL, NULL, false),
    ('barmauromx', NULL, 'Negroni 1929', 0, NULL, NULL, 'Gin', NULL, NULL, false),
    ('barmauromx', NULL, 'Negroni 1929', 1, NULL, NULL, 'Red Vermouth', NULL, NULL, false),
    ('barmauromx', NULL, 'Negroni 1929', 2, NULL, NULL, 'Campari', NULL, NULL, false),
    ('barmauromx', NULL, 'Negroni 1929', 3, NULL, NULL, 'Cacao Nibs', NULL, NULL, false),
    ('barmauromx', NULL, 'Negroni 1929', 4, NULL, NULL, 'Strawberry', NULL, NULL, false),
    ('barmauromx', NULL, 'Basilico', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('barmauromx', NULL, 'Basilico', 1, NULL, NULL, 'Rosé Vermouth', NULL, NULL, false),
    ('barmauromx', NULL, 'Basilico', 2, NULL, NULL, 'Basil', NULL, NULL, false),
    ('barmauromx', NULL, 'Basilico', 3, NULL, NULL, 'Peach', NULL, NULL, false),
    ('barmauromx', NULL, 'Mango Salad', 0, NULL, NULL, 'Tequila', NULL, NULL, false),
    ('barmauromx', NULL, 'Mango Salad', 1, NULL, NULL, 'Vanilla', NULL, NULL, false),
    ('barmauromx', NULL, 'Mango Salad', 2, NULL, NULL, 'Tomato', NULL, NULL, false),
    ('barmauromx', NULL, 'Mango Salad', 3, NULL, NULL, 'Mango', NULL, NULL, false),
    ('bonvivantsbahamas', NULL, 'The Long Surrender', 0, NULL, NULL, 'Cascahuin Blanco Tequila', 'Blanco Tequila', NULL, false),
    ('bonvivantsbahamas', NULL, 'The Long Surrender', 1, NULL, NULL, 'Pierre Ferrand', 'Dry Curaçao', NULL, false),
    ('bonvivantsbahamas', NULL, 'The Long Surrender', 2, NULL, NULL, 'Firewater Tincture', NULL, 'made with Scrappy''s', false),
    ('bonvivantsbahamas', NULL, 'The Long Surrender', 3, NULL, NULL, 'Chinola', 'Passion Fruit Liqueur', NULL, false),
    ('bonvivantsbahamas', NULL, 'The Long Surrender', 4, NULL, NULL, 'Lime', NULL, NULL, false),
    ('bonvivantsbahamas', NULL, 'The Long Surrender', 5, NULL, NULL, 'Agave Syrup', NULL, NULL, false),
    ('bonvivantsbahamas', NULL, 'Funky Nassau', 0, NULL, NULL, 'Hennessy VS Cognac', 'Cognac', 'fried plantain infused sous vide', false),
    ('bonvivantsbahamas', NULL, 'Funky Nassau', 1, NULL, NULL, 'Michter''s US*1 Rye', 'Rye Whiskey', NULL, false),
    ('bonvivantsbahamas', NULL, 'Funky Nassau', 2, NULL, NULL, 'Scrappy''s', 'Orleans Bitters', NULL, false),
    ('bonvivantsbahamas', NULL, 'Funky Nassau', 3, NULL, NULL, 'Simple Syrup', NULL, NULL, false),
    ('bonvivantsbahamas', NULL, 'Funky Nassau', 4, NULL, NULL, 'Cerasee Essence', NULL, NULL, false),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 0, NULL, NULL, 'Coconut Cartel Rum', 'Rum', NULL, false),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 1, NULL, NULL, 'Planteray OFTD Overproof Rum', 'Overproof Rum', NULL, false),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 2, NULL, NULL, 'Ford''s Gin', 'Gin', NULL, false),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 3, NULL, NULL, 'St. Elizabeth', 'Allspice Dram', NULL, false),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 4, NULL, NULL, 'Nux Alpina', 'Walnut Liqueur', NULL, false),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 5, NULL, NULL, 'Coconut', NULL, NULL, false),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 6, NULL, NULL, 'Chamomile', NULL, NULL, false),
    ('bonvivantsbahamas', NULL, 'Gully Creeper Milk Punch', 7, NULL, NULL, 'Grapefruit', NULL, NULL, false),
    ('bonvivantsbahamas', NULL, 'Meet Me in the Morning', 0, NULL, NULL, 'Hayman''s London Dry Gin', 'London Dry Gin', NULL, false),
    ('bonvivantsbahamas', NULL, 'Meet Me in the Morning', 1, NULL, NULL, 'Mr. Black', 'Coffee Liqueur', NULL, false),
    ('bonvivantsbahamas', NULL, 'Meet Me in the Morning', 2, NULL, NULL, 'Cocchi Vermouth di Torino', 'Sweet Vermouth', NULL, false),
    ('bonvivantsbahamas', NULL, 'Meet Me in the Morning', 3, NULL, NULL, 'Nux Alpina', 'Walnut Liqueur', NULL, false),
    ('lafactoriapr', NULL, 'Lavender Mule', 0, 1.5, 'oz', 'Vodka', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Lavender Mule', 1, 0.5, 'oz', 'Lemon Juice', NULL, 'freshly squeezed', false),
    ('lafactoriapr', NULL, 'Lavender Mule', 2, 0.75, 'oz', 'Lavender and Dry Spice Syrup', NULL, 'house-made', false),
    ('lafactoriapr', NULL, 'Lavender Mule', 3, 0.75, 'oz', 'Ginger Tea', NULL, 'house-made', false),
    ('lafactoriapr', NULL, 'Lavender Mule', 4, NULL, NULL, 'Lime wheel; fresh lavender sprig (optional)', NULL, 'garnish', false),
    ('lafactoriapr', NULL, 'Peligroso', 0, 1.5, 'oz', 'Rum', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Peligroso', 1, 0.5, 'oz', 'Campari', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Peligroso', 2, 0.5, 'oz', 'Averna', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Peligroso', 3, 0.75, 'oz', 'Lime Juice', NULL, 'fresh', false),
    ('lafactoriapr', NULL, 'Peligroso', 4, 0.75, 'oz', 'Spiced Syrup', NULL, 'house-made', false),
    ('lafactoriapr', NULL, 'Peligroso', 5, 2, 'dash', 'Angostura', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Guanabana Punch', 0, NULL, NULL, 'Rum', NULL, 'soursop infused', false),
    ('lafactoriapr', NULL, 'Guanabana Punch', 1, NULL, NULL, 'Chai', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Spiced Old Fashioned', 0, NULL, NULL, 'Aged Rum', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Spiced Old Fashioned', 1, NULL, NULL, 'Spiced Bitters', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Coquito', 0, 6, 'oz', 'Don Q Cristal White Rum', 'White Rum', NULL, false),
    ('lafactoriapr', NULL, 'Coquito', 1, 4, 'oz', 'Don Q Añejo 7 Años Aged Rum', 'Aged Rum', NULL, false),
    ('lafactoriapr', NULL, 'Coquito', 2, 14, 'oz', 'Sweetened Condensed Milk', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Coquito', 3, 12, 'oz', 'Evaporated Milk', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Coquito', 4, 8.5, 'oz', 'Coconut Cream', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Coquito', 5, 1, 'tsp', 'Vanilla Extract', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Coquito', 6, 1, 'tsp', 'Ground Cinnamon', NULL, NULL, false),
    ('lafactoriapr', NULL, 'Coquito', 7, NULL, NULL, 'Nutmeg', NULL, 'a grating', false),
    ('obsidianbar_sz', NULL, 'Into the Forest', 0, NULL, NULL, 'Scotch Whisky', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Into the Forest', 1, NULL, NULL, 'Citrus Jam', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Into the Forest', 2, NULL, NULL, 'Agave Syrup', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Into the Forest', 3, NULL, NULL, 'Lemon Verbena', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Into the Forest', 4, NULL, NULL, 'Dancong Oolong Tea Foam', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Black Manhattan', 0, NULL, NULL, 'Bourbon', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Black Manhattan', 1, NULL, NULL, 'Italian Vermouth', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Black Manhattan', 2, NULL, NULL, 'Smoked Plum', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Black Manhattan', 3, NULL, NULL, 'Black Garlic', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Black Manhattan', 4, NULL, NULL, 'Bohea Tea', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Black Manhattan', 5, NULL, NULL, 'Black Vinegar', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Morning Glory', 0, NULL, NULL, 'Calvados', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Morning Glory', 1, NULL, NULL, 'Irish Whiskey', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Morning Glory', 2, NULL, NULL, 'Earl Grey Tea', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Morning Glory', 3, NULL, NULL, 'Amaro', NULL, NULL, false),
    ('obsidianbar_sz', NULL, 'Morning Glory', 4, NULL, NULL, 'Absinthe', NULL, NULL, false),
    ('civwrksto', NULL, 'Woolnough', 0, 1.25, 'oz', 'Cocchi Rosa', 'Aromatised Wine', 'or other aromatised wine', false),
    ('civwrksto', NULL, 'Woolnough', 1, 1.25, 'oz', 'Vermouth', NULL, 'dry or sweet', false),
    ('civwrksto', NULL, 'Woolnough', 2, 0.5, 'oz', 'Scotch Whisky', NULL, 'peated single malt such as Talisker 10 in the bar''s version', false),
    ('civwrksto', NULL, 'Woolnough', 3, 0.75, 'oz', 'Berry Cordial', NULL, 'haskap; source prints 3/4 to 1 oz and names raspberry cordial as an alternative', false),
    ('civwrksto', NULL, 'Woolnough', 4, 4, 'dash', 'Salted Vetiver and Sandalwood Tinctures', NULL, 'or Angostura bitters', false),
    ('civwrksto', NULL, 'Woolnough', 5, NULL, NULL, 'Lemon zest', NULL, 'garnish', false),
    ('civwrksto', NULL, 'Pounding Sand', 0, NULL, NULL, 'Mezcal', NULL, 'corn husk infused', false),
    ('civwrksto', NULL, 'Pounding Sand', 1, NULL, NULL, 'Pineapple', NULL, 'lacto-fermented', false),
    ('civwrksto', NULL, 'Pounding Sand', 2, NULL, NULL, 'Achiote Cordial', NULL, 'house-made', false),
    ('civwrksto', NULL, 'Pounding Sand', 3, NULL, NULL, 'Masa Foam', NULL, NULL, false),
    ('civwrksto', NULL, 'Playdate', 0, NULL, NULL, 'Cognac', NULL, NULL, false),
    ('civwrksto', NULL, 'Playdate', 1, NULL, NULL, 'Madeira', NULL, NULL, false),
    ('civwrksto', NULL, 'Playdate', 2, NULL, NULL, 'Carrot-coffee Cream', NULL, NULL, false),
    ('civwrksto', NULL, 'Playdate', 3, NULL, NULL, 'Foam', NULL, NULL, false),
    ('civwrksto', NULL, 'Playdate', 4, NULL, NULL, 'Soda', NULL, 'fizz', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 0, NULL, NULL, 'Vodka', NULL, 'martini 1', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 1, NULL, NULL, 'Junmai Daiginjo Sake', NULL, 'martini 1', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 2, NULL, NULL, 'Blanco Vermouth', NULL, 'martini 1', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 3, NULL, NULL, 'Shiso', NULL, 'martini 1', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 4, NULL, NULL, 'Gin', NULL, 'martini 2', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 5, NULL, NULL, 'Palo Cortado Sherry', NULL, 'martini 2', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 6, NULL, NULL, 'Blanco Vermouth', NULL, 'martini 2', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 7, NULL, NULL, 'Grapefruit', NULL, 'martini 2', false),
    ('pressclubcocktailbar', NULL, 'In A Cadillac', 8, NULL, NULL, 'Served with lime-zested Marcona almonds (opening menu)', NULL, 'garnish', false),
    ('pressclubcocktailbar', NULL, 'Roses', 0, NULL, NULL, 'Red Gin', NULL, 'gin rouge', false),
    ('pressclubcocktailbar', NULL, 'Roses', 1, NULL, NULL, 'Aged Rum', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Roses', 2, NULL, NULL, 'Thai Pepper', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Roses', 3, NULL, NULL, 'Rose', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Roses', 4, NULL, NULL, 'Pineapple', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Roses', 5, NULL, NULL, 'Ginger', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Nights Over Egypt', 0, NULL, NULL, 'Bourbon', NULL, 'yogurt and fruit-syrup washed', false),
    ('pressclubcocktailbar', NULL, 'Nights Over Egypt', 1, NULL, NULL, 'Calvados', NULL, 'yogurt and fruit-syrup washed', false),
    ('pressclubcocktailbar', NULL, 'Nights Over Egypt', 2, NULL, NULL, 'Bordeaux', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Nights Over Egypt', 3, NULL, NULL, 'Seasonal Fruit Syrup', NULL, 'strawberry in summer, plum in autumn', false),
    ('pressclubcocktailbar', NULL, 'Nights Over Egypt', 4, NULL, NULL, 'Granola cookie on the side', NULL, 'garnish', false),
    ('pressclubcocktailbar', NULL, 'Imaginary Players', 0, NULL, NULL, 'Shochu', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Imaginary Players', 1, NULL, NULL, 'Gin', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Imaginary Players', 2, NULL, NULL, 'Blanc Vermouth', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Imaginary Players', 3, NULL, NULL, 'Strawberry Sherry', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Imaginary Players', 4, NULL, NULL, 'Raspberry Eau de Vie', NULL, NULL, false),
    ('pressclubcocktailbar', NULL, 'Imaginary Players', 5, NULL, NULL, 'Strawberry ''paint'' in the glass', NULL, 'garnish', false),
    ('bartrigona', NULL, 'Kampot Pepper Old Fashioned', 0, 60, 'ml', 'Mezcal', NULL, NULL, false),
    ('bartrigona', NULL, 'Kampot Pepper Old Fashioned', 1, 20, 'ml', 'Kampot Pepper-infused Kelulut Honey', NULL, 'house prep', false),
    ('bartrigona', NULL, 'Kampot Pepper Old Fashioned', 2, 5, 'ml', 'Fernet Hunter', 'Fernet', 'listed in the ingredients but not mentioned in the method', false),
    ('bartrigona', NULL, 'Kampot Pepper Old Fashioned', 3, 3, 'dash', 'Cardamom Bitters', NULL, NULL, false),
    ('bartrigona', NULL, 'Kampot Pepper Old Fashioned', 4, NULL, NULL, 'Honeycomb block and at least three Kampot peppercorns', NULL, 'garnish', false),
    ('curenola', NULL, 'Cure''s Sazerac', 0, 4, 'spray', 'Herbsaint', NULL, 'from an atomizer', false),
    ('curenola', NULL, 'Cure''s Sazerac', 1, 2, 'oz', 'Sazerac Rye', 'Rye Whiskey', NULL, false),
    ('curenola', NULL, 'Cure''s Sazerac', 2, 0.25, 'oz', 'Rich Demerara Syrup', NULL, '2:1', false),
    ('curenola', NULL, 'Cure''s Sazerac', 3, 23, 'drop', 'Peychaud''s Bitters', NULL, 'about 3 dashes', false),
    ('curenola', NULL, 'Cure''s Sazerac', 4, NULL, NULL, 'Lemon peel', NULL, 'garnish', false),
    ('curenola', NULL, 'The End Is Nigh', 0, 1.5, 'oz', 'Rittenhouse Rye', 'Rye Whiskey', NULL, false),
    ('curenola', NULL, 'The End Is Nigh', 1, 1, 'oz', 'Bonal Gentiane Quina', 'Quinquina', NULL, false),
    ('curenola', NULL, 'The End Is Nigh', 2, 0.25, 'oz', 'Amaro Sibilla', 'Amaro', NULL, false),
    ('curenola', NULL, 'The End Is Nigh', 3, 2, 'dash', 'Angostura Bitters', NULL, NULL, false),
    ('curenola', NULL, 'The End Is Nigh', 4, 1, NULL, 'Orange Peel', NULL, 'twist', false),
    ('curenola', NULL, 'The End Is Nigh', 5, NULL, NULL, 'Orange twist', NULL, 'garnish', false),
    ('curenola', NULL, 'Keep Your Dreams A Burnin''', 0, 2.5, 'oz', 'Manzanilla Sherry', NULL, NULL, false),
    ('curenola', NULL, 'Keep Your Dreams A Burnin''', 1, 0.5, 'oz', 'Smith & Cross Jamaican Rum', 'Jamaican Rum', NULL, false),
    ('curenola', NULL, 'Keep Your Dreams A Burnin''', 2, 0.5, 'oz', 'Orgeat', NULL, NULL, false),
    ('curenola', NULL, 'Keep Your Dreams A Burnin''', 3, 2, 'dash', 'Angostura Bitters', NULL, NULL, false),
    ('curenola', NULL, 'Keep Your Dreams A Burnin''', 4, 2, NULL, 'Lemon Peel', NULL, 'shaken with the drink', false),
    ('curenola', NULL, 'Keep Your Dreams A Burnin''', 5, NULL, NULL, 'Three half lemon wheels, a cinnamon stick, a dusting of powdered sugar and two…', NULL, 'garnish', false),
    ('curenola', NULL, 'Once Over #2', 0, 1.5, 'oz', 'Aperol', NULL, NULL, false),
    ('curenola', NULL, 'Once Over #2', 1, 0.75, 'oz', 'Lime Juice', NULL, NULL, false),
    ('curenola', NULL, 'Once Over #2', 2, 0.75, 'oz', 'Orgeat', NULL, NULL, false),
    ('curenola', NULL, 'Once Over #2', 3, 0.5, 'oz', 'Tequila', NULL, NULL, false),
    ('curenola', NULL, 'Once Over #2', 4, 5, 'leaf', 'Mint', NULL, NULL, false),
    ('curenola', NULL, 'Once Over #2', 5, 0.25, 'oz', 'Mezcal', NULL, 'to float', false),
    ('curenola', NULL, 'Once Over #2', 6, NULL, NULL, 'Mint bouquet and a mezcal float', NULL, 'garnish', false),
    ('librarybartoronto', NULL, 'Midnight Snow', 0, 1.5, 'oz', 'Raspberry-infused Gin', NULL, 'made with Citadelle Rouge; house prep', false),
    ('librarybartoronto', NULL, 'Midnight Snow', 1, 0.5, 'oz', 'St-Germain', 'Elderflower Liqueur', NULL, false),
    ('librarybartoronto', NULL, 'Midnight Snow', 2, 0.5, 'oz', 'Blueberry Syrup', NULL, 'store-bought', false),
    ('librarybartoronto', NULL, 'Midnight Snow', 3, 0.25, 'tsp', 'Lime Juice', NULL, NULL, false),
    ('librarybartoronto', NULL, 'Midnight Snow', 4, 1, 'oz', 'Espresso', NULL, NULL, false),
    ('librarybartoronto', NULL, 'Midnight Snow', 5, NULL, NULL, 'Fleur de sel and freeze-dried raspberry powder', NULL, 'garnish', false);


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

