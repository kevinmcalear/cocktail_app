-- The people behind The World's 50 Best Bars 2025, and the drinks they made.
--
-- 1. profile_positions: a person's job at a bar, both as profiles ("Bar
--    director at Handshake"). It works before either side has claimed,
--    which user_bars (app access for signed-in staff) can't. Anyone who can
--    see both profiles sees it; the person, the bar's publishers or a
--    moderator can change or remove it.
--
-- 2. Public, unclaimed person profiles for the owners, founders, bar and
--    drinks directors and head bartenders each bar or the drinks press names,
--    checked by hand. Each claims their own through profile_claims, like the
--    bars. Professional details only, written in our words, and no photos:
--    avatars stay initials until they claim and add their own. People who
--    have left a bar keep the position, marked former.
--
-- 3. Their best-known drinks as shared drinks, credited to them and the bar
--    where they were first made, at 'suggested' until the creator claims or a
--    moderator verifies. Names and a line on each, no specs. A drink made
--    by several people credits the first-named creator on the drink and the
--    rest in item_co_creators.
--
-- 4. Locale Firenze's and Maybe Sammy's bios named people who have since
--    left; they now name who runs the bar today.
--
-- 5. app_item_presentation gains creator_profile_id, so the Library leaves
--    out drinks credited to a person with no venue behind them (the Bywater,
--    Speak Low), as it already does for bars' signatures.
--
-- Idempotent: a handle that's taken is skipped, and a drink with the same
-- name and credit isn't added twice.

-- --- Who works where ---

-- A person's job at a bar, both as profiles, so it works before either has
-- claimed: "Bar director at Handshake". Separate from user_bars, which is
-- app access for signed-in staff at venues on Cocktail.
-- ponytail: one title per row and a current flag, no dates. Start and end
-- dates are the upgrade if careers become a feature.
CREATE TABLE "public"."profile_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() PRIMARY KEY,
    "person_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "bar_profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "title" "text" NOT NULL CHECK (char_length(btrim("title")) BETWEEN 1 AND 60),
    "is_current" boolean DEFAULT true NOT NULL,
    -- Where a moderator can check it.
    "source_url" "text" CHECK ("source_url" ~ '^https?://'),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    UNIQUE ("person_profile_id", "bar_profile_id", "title")
);

CREATE INDEX "profile_positions_bar_profile_id_idx" ON "public"."profile_positions" ("bar_profile_id");

CREATE FUNCTION "private"."guard_profile_position"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.person_profile_id AND kind = 'person') THEN
        RAISE EXCEPTION 'A position belongs to a person''s profile.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.bar_profile_id AND kind = 'bar') THEN
        RAISE EXCEPTION 'A position is at a bar''s profile.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_profile_position" BEFORE INSERT OR UPDATE OF "person_profile_id", "bar_profile_id" ON "public"."profile_positions"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_profile_position"();

REVOKE EXECUTE ON FUNCTION "private"."guard_profile_position"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."profile_positions" ENABLE ROW LEVEL SECURITY;

-- Visible when you can see both profiles (profiles' own RLS decides).
CREATE POLICY "profile_positions_select" ON "public"."profile_positions" FOR SELECT TO "anon", "authenticated"
    USING (
        EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "person_profile_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "b" WHERE "b"."id" = "bar_profile_id")
    );
-- The person, the bar's publishers, or a moderator. Either side can take a
-- wrong one down.
CREATE POLICY "profile_positions_write" ON "public"."profile_positions" FOR ALL TO "authenticated"
    USING (
        "private"."is_app_admin"()
        OR "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    )
    WITH CHECK (
        "private"."is_app_admin"()
        OR "person_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
        OR "bar_profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "bar_id" IN (SELECT "private"."bars_with_capability"('publish')))
    );

-- --- Drinks made by more than one person ---

-- items.creator_profile_id is the first-named creator; the rest go here, so a
-- drink three bartenders built together credits all three.
-- ponytail: no credit status of their own; they share the drink's. Moderators
-- (and SQL) add them, and a co-creator can take themselves off. Letting the
-- creator add their own collaborators is the upgrade.
CREATE TABLE "public"."item_co_creators" (
    "item_id" "uuid" NOT NULL REFERENCES "public"."items"("id") ON DELETE CASCADE,
    "profile_id" "uuid" NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    PRIMARY KEY ("item_id", "profile_id")
);

CREATE INDEX "item_co_creators_profile_id_idx" ON "public"."item_co_creators" ("profile_id");

CREATE FUNCTION "private"."guard_item_co_creator"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.profile_id AND kind = 'person') THEN
        RAISE EXCEPTION 'A drink''s co-creator must be a person''s profile.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "guard_item_co_creator" BEFORE INSERT OR UPDATE ON "public"."item_co_creators"
    FOR EACH ROW EXECUTE FUNCTION "private"."guard_item_co_creator"();

REVOKE EXECUTE ON FUNCTION "private"."guard_item_co_creator"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."item_co_creators" ENABLE ROW LEVEL SECURITY;

-- Readable with the drink (items RLS decides) and the profile.
CREATE POLICY "item_co_creators_select" ON "public"."item_co_creators" FOR SELECT TO "authenticated"
    USING (
        EXISTS (SELECT 1 FROM "public"."items" "i" WHERE "i"."id" = "item_id")
        AND EXISTS (SELECT 1 FROM "public"."profiles" "p" WHERE "p"."id" = "profile_id")
    );
CREATE POLICY "item_co_creators_insert" ON "public"."item_co_creators" FOR INSERT TO "authenticated"
    WITH CHECK ("private"."is_app_admin"());
CREATE POLICY "item_co_creators_delete" ON "public"."item_co_creators" FOR DELETE TO "authenticated"
    USING (
        "private"."is_app_admin"()
        OR "profile_id" IN (SELECT "id" FROM "public"."profiles" WHERE "user_id" = (SELECT "auth"."uid"()))
    );

-- --- The people ---

-- Public and unclaimed, like the bars: each claims their own through
-- profile_claims. Professional details only, and no photos: avatars are
-- initials until they claim and add their own.
INSERT INTO "public"."profiles" ("kind", "handle", "display_name", "bio", "website", "is_public", "city")
SELECT 'person', v.handle, v.name, v.bio, v.website, true, v.city
FROM (VALUES
    ('justin.shunwah', 'Justin Shun Wah', 'Co-founder and co-owner of Bar Leone alongside Lorenzo Antinori. Public coverage names him as a partner in the business but says little about his hands-on role behind the bar.', NULL, 'Hong Kong'),
    ('lorenzo.antinori', 'Lorenzo Antinori', 'Bartender who built his career in London, Seoul and Hong Kong before opening Bar Leone in 2023 as a tribute to Rome''s everyday neighbourhood bars. His approach favours simple, well-executed classics over lab technique. In 2025 he also opened Montana, a Cuban-inspired Hong Kong bar, with Simone Caporale.', 'https://www.barleonehk.com/', 'Hong Kong'),
    ('eric.vanbeek', 'Eric van Beek', 'Bartender who won the 2018 Bacardi Legacy global final, moved to Mexico City in 2019 and joined Handshake as partner and drinks director in 2021. He runs its in-house lab, which leans on kitchen techniques such as fat-washing, clarification and long sous-vide cordials.', 'https://handshake.bar/', 'Mexico City'),
    ('marcos.dibattista', 'Marcos Di Battista', 'Hospitality entrepreneur who co-founded Handshake Speakeasy in 2019. He has since grown the brand with Tunki Rooftop by Handshake and Bambuco by Handshake, and makes his own line of vermouth and bitters.', 'https://handshake.bar/', 'Mexico City'),
    ('rodrigo.urraca', 'Rodrigo Urraca', 'Co-founder of Handshake Speakeasy, which he started in 2019 with Marcos Di Battista before Eric van Beek joined. A former spirits brand ambassador, he handles much of the bar''s public side and has since helped launch the group''s sister venue Ahorita Cantina.', 'https://handshake.bar/', 'Mexico City'),
    ('marc.alvarez', 'Marc Álvarez', 'Barcelona bartender who spent about eight years with Albert Adrià''s elBarri group, starting at 41º and going on to run drinks for its restaurants, before founding the consultancy Drinks Atelier. He co-founded Sips with Simone Caporale in 2021.', 'https://sips.barcelona/', 'Barcelona'),
    ('simone.caporale', 'Simone Caporale', 'Bartender who spent five years at Artesian in London during its run of four World''s Best Bar titles, then co-founded Sips in Barcelona in 2021. He also runs Esencia inside Sips, owns the historic Boadas, and co-founded the P(our) symposium.', 'https://sips.barcelona/', 'Barcelona'),
    ('giacomo.giannotti', 'Giacomo Giannotti', 'Bartender who worked in London and at Barcelona hotel bars before opening Paradiso in 2015 behind a pastrami shop. He leads its creative menus and Paradiso Lab, and has expanded the brand to Dubai and Ibiza alongside Galileo and Monk.', 'https://paradiso.cat/', 'Barcelona'),
    ('margarita.sader', 'Margarita Sáder', 'Co-founder of Paradiso, opened in 2015. A fashion designer by training, she runs MS Bartrends, which makes uniforms for leading bars, and is associated with Paradiso''s Women & Hospitality event.', NULL, 'Barcelona'),
    ('alex.kratena', 'Alex Kratena', 'Bartender who led Artesian at The Langham through four straight World''s Best Bar titles, left in 2015, and co-founded Tayēr + Elementary with Monica Berg in 2019. He also co-founded P(our), Muyu liqueurs, Tayēr RTDs and Tayēr Studios, and opened Kyara in Barcelona in 2025.', 'https://alexkratena.com/', 'London'),
    ('monica.berg', 'Monica Berg', 'Bartender who worked in Oslo and London before co-founding Tayēr + Elementary with Alex Kratena in 2019. She co-founded the P(our) symposium and the Back of House reporting platform, co-created Muyu liqueurs, and in 2025 opened Kyara in Barcelona with Kratena.', 'https://www.monica-berg.com/', 'London'),
    ('agostino.perrone', 'Agostino Perrone', 'Bartender who moved to London in 2003 and has led the Connaught Bar since it opened in 2008, making its tableside Martini trolley famous. He co-founded the Italian bar network Bartender.it and co-wrote the Connaught Bar cocktail book.', 'https://www.agoperrone.com/', 'London'),
    ('giorgio.bargiani', 'Giorgio Bargiani', 'Bartender who joined the Connaught Bar as a barback in 2014, became head mixologist in 2019 and assistant director of mixology in 2022. He co-wrote the bar''s cocktail book and launched a Bar/Giani glassware range with Nude in 2025.', NULL, 'London'),
    ('maura.milia', 'Maura Milia', 'Spent about a decade at the Connaught Bar, rising from cocktail waitress to bar manager in 2022, and co-wrote its cocktail book. She left in 2024 to co-found venues in Mexico City and Oaxaca, then returned to London as general manager of Eagle Bar at The Chancery Rosewood.', NULL, NULL),
    ('giovanni.allario', 'Giovanni Allario', 'Bartender who worked in Paris, helped open Danico and became bar director at Le Syndicat before taking over the Moebius bar in 2022. He works closely with the kitchen on seasonal drinks and has led the bar from its first 50 Best listing to No. 7.', NULL, 'Milan'),
    ('lorenzo.querci', 'Lorenzo Querci', 'Law graduate who switched to hospitality and founded Moebius in Milan in 2019. He shaped it as a multi-room venue with a cocktail bar, bistro, fine-dining restaurant and record shop, and leads its guest shifts and collaborations with bars abroad.', 'https://moebiusmilano.it/', 'Milan'),
    ('dimitris.dafopoulos', 'Dimitris Dafopoulos', 'Co-founder of the Greek premium mixer brand Three Cents, who created Line in Athens with The Clumsies'' Vasilis Kyritsis and Nikos Bakoulis. 50 Best lists him first among the bar''s founders.', 'https://lineathens.gr/', 'Athens'),
    ('nikos.bakoulis', 'Nikos Bakoulis', 'Co-founder of The Clumsies in Athens who opened Line in 2022 with Vasilis Kyritsis and Dimitris Dafopoulos. He is also involved with the Greek mixer brand Three Cents and has a strong interest in wine.', 'https://lineathens.gr/', 'Athens'),
    ('vasilis.kyritsis', 'Vasilis Kyritsis', 'Athens bartender who co-founded The Clumsies, then opened Line in 2022 with Nikos Bakoulis and Dimitris Dafopoulos. He drove the bar''s house fermentation programme, including its fruit wines called Why-ins, and favours presenting experimental work simply.', 'https://lineathens.gr/', 'Athens'),
    ('aki.eguchi', 'Aki Eguchi', 'Bartender who joined Jigger & Pony as bar manager in 2013 and now oversees cocktail programmes and bartender training across the group''s bars.', NULL, 'Singapore'),
    ('guoyi.gan', 'Guoyi Gan', 'Co-founder and managing director of the Jigger & Pony Group, which she started in 2012 after a hospitality career with Singapore Airlines. She was the founding president of the Singapore Cocktail Bar Association.', 'https://www.jiggerandponygroup.com/', 'Singapore'),
    ('indra.kantono', 'Indra Kantono', 'Former consultant and equity manager who co-founded Jigger & Pony in Singapore in 2012 and now co-runs the group, leading business development. He co-chairs the Tales of the Cocktail Foundation''s education advisory committee and has mentored the group''s bartenders.', 'https://www.jiggerandponygroup.com/', 'Singapore'),
    ('uno.jang', 'Uno Jang', 'Bartender who arrived in Singapore in 2015, started at Orgo and joined Jigger & Pony in 2017 as principal bartender. He became creative director of the group in early 2024 and was voted the world''s favourite bartender by his peers in 2025.', NULL, 'Singapore'),
    ('charly.aguinsky', 'Charly Aguinsky', 'Business economics graduate and former Monkey Shoulder brand ambassador who co-founded Tres Monos in 2019. He drives the bar''s work with Argentine producers on house-label whiskey, sake, liqueur and wine.', NULL, 'Buenos Aires'),
    ('gus.vocke', 'Gustavo Vocke', 'Third partner in Tres Monos, who joined Charly Aguinsky and Sebastián Atienza shortly after the bar opened in June 2019. 50 Best lists him among the owners.', NULL, 'Buenos Aires'),
    ('lucila.calichio', 'Lucila Calichio', 'Joined Tres Monos in its second month in 2019 and rose to head bartender by 2023 and bar manager by 2025. She came to the bar after bartending courses and work at other Buenos Aires cocktail bars.', NULL, 'Buenos Aires'),
    ('sebastian.atienza', 'Sebastián Atienza', 'Former Campari brand ambassador who co-founded Tres Monos in Palermo, Buenos Aires, in 2019. He is the voice of its hospitality-first philosophy, and the bar''s education and consultancy arms sit alongside the bar itself.', NULL, 'Buenos Aires'),
    ('jean.trinh', 'Jean Trinh', 'Bartender and operator who moved to Colombia in 2013, ran pop-up bars from 2014 and opened Alquímico in Cartagena in 2016. He built the bar around Colombian produce, a team farm in Filandia, Quindío, and partnerships with local farming and music projects.', 'https://alquimico.com/', 'Cartagena'),
    ('greg.boehm', 'Greg Boehm', 'New York drinks entrepreneur and bar partner behind Katana Kitten and Mace, and a partner in Superbueno with Nacho Jimenez.', NULL, 'New York'),
    ('nacho.jimenez', 'Ignacio ''Nacho'' Jimenez', 'New York bartender who led the bar programs at The Daily and Ghost Donkey before opening Superbueno in the East Village in 2023 with Greg Boehm. His menu channels Mexican-American flavours through classic New York cocktail craft.', 'https://www.superbuenonyc.com/', 'New York'),
    ('kip.moffitt', 'Kip Moffitt', 'Head bartender at Superbueno who works with Nacho Jimenez on building the bar''s cocktail menu.', NULL, 'New York'),
    ('alejandra.leon', 'Alejandra León', 'Runs the bar and floor at Lady Bee and develops new drinks with Alonso Palomino. She returned to Lima from Washington DC to join the project.', NULL, 'Lima'),
    ('alonso.palomino', 'Alonso Palomino', 'Bartender, pisco sommelier and educator who co-founded Lady Bee in 2021. He leads the drinks, working closely with Peruvian farmers and producers, and earlier ran the Aprende Cocteleando training workshop.', 'https://ladybee.bar/', 'Lima'),
    ('gabriela.leon', 'Gabriela León', 'Chef and co-founder of Lady Bee, trained at Le Cordon Bleu Lima with a stage at Noma, who led a hotel kitchen in Puerto Maldonado in the Peruvian Amazon before opening the bar.', NULL, 'Lima'),
    ('maros.dzurus', 'Maroš Dzurus', 'Bartender who joined Himkok as a barback in 2015, rose to head bartender and became bar manager in 2021, steering it into the top 10 of The World''s 50 Best Bars. He left in March 2026 to lead bars at Advocatuur, Rosewood Amsterdam.', NULL, NULL),
    ('taln.rojanavanich', 'Sudarat ''Taln'' Rojanavanich', 'Product designer turned self-taught bartender who, with Aum Sawaengsupt, ran a Bangkok backpacker hostel from 2016, then opened the Messenger Service drinking room and Bar Us, known for savoury, course-by-course cocktails.', 'https://www.us-bar.com/', 'Bangkok'),
    ('aum.sawaengsupt', 'Veerach ''Aum'' Sawaengsupt', 'Interior designer turned self-taught bartender and co-founder of Bar Us and Messenger Service in Bangkok, whose design background shows in the bar''s black, lab-like room.', NULL, 'Bangkok'),
    ('demie.kim', 'Dohyung ''Demie'' Kim', 'Seoul bartender who started at Woo Bar in the W Hotel and was head bartender at Alice before co-founding Zest in December 2020. He champions Korean produce and spirits and a low-waste approach to cocktails.', NULL, 'Seoul'),
    ('hadrien.moudoulaud', 'Hadrien Moudoulaud', 'Paris bartender who started in a Champs-Élysées brasserie and worked at Little Red Door, Bonhomie and Mezcaleria, plus 18 months at Artesian in London, before co-founding Bar Nouveau in 2023.', NULL, 'Paris'),
    ('marc.puzzuoli', 'Marc Puzzuoli', 'Bartender and co-founder of Bar Nouveau in Paris, previously at Swift in London.', NULL, 'Paris'),
    ('remy.savage', 'Rémy Savage', 'Bartender who made his name as head bartender of Little Red Door in Paris, then ran menus at Artesian in London. He co-founded A Bar with Shapes for a Name in London and Bordeaux, and Bar Nouveau in Paris, each built around an art movement.', NULL, 'Paris'),
    ('sara.moudoulaud', 'Sara Moudoulaud', 'Paris-trained bartender who worked at Bespoke, then Little Red Door and Artesian alongside Rémy Savage, before co-founding Bar Nouveau with her twin Hadrien in 2023. Known for putting hospitality ahead of technique.', 'https://barnouveau.fr/', 'Paris'),
    ('hiroyasu.kayama', 'Hiroyasu Kayama', 'Tokyo bartender who began as a barback at the Hotel Okura and opened Bar Benfiddich in 2013. He rebuilds spirits and liqueurs such as Campari, amaro and absinthe from herbs he grows in Chichibu, often working without a set menu.', 'https://benfiddich.tokyo/', 'Tokyo'),
    ('darren.leaney', 'Darren Leaney', 'Bartender at Caretaker''s Cottage in Melbourne. Created Mr Blonde, No. 6 on Boothby''s 50 best drinks in Australia for 2025, and was one of the three behind Doublethink, its Drink of the Year.', NULL, 'Melbourne'),
    ('eddie.goddard', 'Eddie Goddard', 'On the team at Caretaker''s Cottage in Melbourne.', NULL, 'Melbourne'),
    ('kitty.gardner', 'Kitty Gardner', 'Bartender at Caretaker''s Cottage in Melbourne. One of the three behind Doublethink, Boothby''s Drink of the Year 2025, and co-creator of Mr Blonde, No. 6 on the same list.', NULL, 'Melbourne'),
    ('matt.stirling', 'Matt Stirling', 'Melbourne operator who managed Black Pearl during its award-winning years and worked at the Lincoln Hotel before co-founding Fancy Free, Caretaker''s Cottage and Three Horses. Known for the Cottage''s ''see you tomorrow'' style of hospitality.', NULL, 'Melbourne'),
    ('rob.libecans', 'Rob Libecans', 'Bartender with more than 20 years in pubs and bars across Europe and Australia. A Black Pearl alumnus, he joined the opening team of White Lyan in London in 2013 before co-founding Fancy Free, Caretaker''s Cottage (2022) and Three Horses (2025) in Melbourne. His freezer House Martini is the Cottage''s signature.', 'https://www.caretakerscottage.bar/', 'Melbourne'),
    ('ryan.noreiks', 'Ryan Noreiks', 'Bartender who ran The Lark in Brisbane, led The Alchemist in Shanghai from 2010 and won Diageo World Class in China, then worked at Romeo Lane and Black Pearl in Melbourne. He co-owns Caretaker''s Cottage and Three Horses and designs the Cottage''s monthly menus.', NULL, 'Melbourne'),
    ('tom.mchugh', 'Tom McHugh', 'Former bar manager at Caretaker''s Cottage in Melbourne, and one of the three behind Doublethink, Boothby''s Drink of the Year 2025.', NULL, NULL),
    ('hugo.gallou', 'Hugo Gallou', 'Co-founder of The Cambridge, who lived and worked in London with Hyacinthe Lescoët before they opened the Paris cocktail pub in 2019. He also launched the group''s consulting arm and co-owns Little Red Door.', NULL, 'Paris'),
    ('hyacinthe.lescoet', 'Hyacinthe Lescoët', 'Bartender who worked at 69 Colebrooke Row in London and Mary Celeste in Paris before opening The Cambridge with Hugo Gallou in 2019. He leads the group''s sustainability work and consultancy, and co-bought Little Red Door in 2024.', 'https://www.thecambridge.paris/', 'Paris'),
    ('ollie.sagerstromblom', 'Jan Oliver Sagerström Blom', 'Bar manager at Satan''s Whiskers as of 2025, having earlier worked the bar there as a bartender. Creator of the Heartbreaker, a rye and cherry soda highball featured by BARTENDER.com.', NULL, 'London'),
    ('kevin.armstrong', 'Kevin Armstrong', 'London bartender who co-founded Satan''s Whiskers in Bethnal Green in 2013 and still runs it. Before that he tended bar at Milk & Honey London and Trailer Happiness. Co-author, with Daniel Waddy, of the bartending-method book Roundbuilding.', 'https://www.satanswhiskers.com/', 'London'),
    ('alessandro.mengoni', 'Alessandro Mengoni', 'Bartender at Locale Firenze who shaped the bar''s identity alongside Fabio Fanni for about five years and took over as its lead bar manager in September 2026. Known for seasonal menus built around a few local ingredients.', NULL, 'Florence'),
    ('fabio.fanni', 'Fabio Fanni', 'Bartender who led the bar at Locale Firenze for about five years, first as deputy to Matteo Di Ienno from 2021 and then as bar manager from late 2023. He ran the low-waste, lab-driven programme that took Locale to No. 22 in the world, and left in September 2026.', NULL, NULL),
    ('faramarz.poosty', 'Faramarz Poosty', 'Hospitality manager behind the idea for Locale Firenze and its general manager since it opened in Palazzo Concini around 2015. He earlier ran the dining room at Cestello restaurant in Florence, where he pushed for a bigger role for cocktails.', NULL, 'Florence'),
    ('matteo.diienno', 'Matteo Di Ienno', 'Bartender who led the bar at Locale Firenze from its early years and built its in-house lab for liqueurs, distillates and ferments. Left in 2023 to focus on Fermenthinks, a Florence distillery he co-founded.', NULL, NULL),
    ('bernardo.serna', 'Bernardo Serna', 'Co-founder and partner of Tlecān in Mexico City, where he speaks for the bar''s sourcing from small agave producers and communities that use traditional methods.', NULL, 'Mexico City'),
    ('eli.martinez.bello', 'Eli Martínez Bello', 'Bartender who co-founded Tlecān, an agave bar in Mexico City, and leads its bar. She previously ran the beverage programme at Pujol for five years and also consults on drinks programmes and staff training.', NULL, 'Mexico City'),
    ('caio.carvalhaes', 'Caio Carvalhaes', 'Head bartender at Tan Tan, where he writes the story behind each annual cocktail menu, including Pour-Hibition. He first worked with Thiago Bañares at a burger restaurant and learned his craft at a São Paulo cocktail bar before joining Tan Tan around 2022.', NULL, 'São Paulo'),
    ('thiago.banares', 'Thiago Bañares', 'Chef who founded Tan Tan in São Paulo in 2015, first planned as a noodle bar before a cocktail bar was added. He develops drinks with the head bartender and also runs the restaurant Kotori and The Liquor Store in São Paulo.', 'https://www.tantan.com.br/tantan', 'São Paulo'),
    ('peter.marcina', 'Peter Marcina', 'Bartender who created the current Mirror Bar concept and has managed the bar in Bratislava''s Carlton hotel since its 2019 relaunch, building it around local artists, craftspeople and botanicals.', 'https://www.mirrorbarcarlton.com/', 'Bratislava'),
    ('stanislav.harcinik', 'Stanislav Harciník', 'Bartender, educator and author who is Mirror Bar''s global ambassador and shapes the bar''s direction with Peter Marcina. Known for his work in bartender education and building the Slovak bar community.', NULL, 'Bratislava'),
    ('ines.delossantos', 'Inés de los Santos', 'Bartender with three decades in Buenos Aires bars who opened CoChinChina in Palermo in 2020. She also created Kōnā Corner with chef Narda Lepes, runs drinks at Costa 7070 and Kotchi in São Paulo, and makes her own vermouth, Cantieri Navali.', NULL, 'Buenos Aires'),
    ('thanos.prunarus', 'Thanos Prunarus', 'Bartender who opened Baba au Rum in Athens in 2009 and helped build the city''s modern cocktail scene. He trains the whole team himself and is known as a rum specialist. He is also one of the bartenders behind the tsipouro brand O/PURIST.', 'https://www.babaaurum.com/', 'Athens'),
    ('evis.cali', 'Evis Cali', 'Co-founder of Nouvelle Vague in Tirana''s Blloku district, open since 2012.', 'https://nouvellevaguetirana.com/', 'Tirana'),
    ('mariol.djata', 'Mariol Djata', 'Head bartender at Nouvelle Vague, where he leads the drinks programme, including the Origin''al menu built on Albanian ingredients and small-producer raki.', NULL, 'Tirana'),
    ('sofokli.cali', 'Sofokli Cali', 'Co-founder of Nouvelle Vague, the Tirana cocktail bar opened in 2012 and named after French New Wave cinema.', 'https://nouvellevaguetirana.com/', 'Tirana'),
    ('andrew.ho', 'Andrew Ho', 'Bar owner who trained in Switzerland and worked in luxury hotels before co-founding Hope & Sesame in Guangzhou in 2016. He also runs SanYou and DSK Cocktail Club in Guangzhou and the consultancy Spirits Architects, and mentors young bartenders across Asia.', 'https://hopeandsesame.cn/', 'Guangzhou'),
    ('bastien.ciocca', 'Bastien Ciocca', 'Co-founder of Hope & Sesame in Guangzhou, which he has led with Andrew Ho since it opened in March 2016.', 'https://hopeandsesame.cn/', 'Guangzhou'),
    ('corentin.gaudin', 'Corentin Gaudin', 'Bar manager at Danico, who went with Nico de Soto on the 12-day research trip to Peru for the bar''s Peru edition of its Xplorer menu series.', NULL, 'Paris'),
    ('nico.desoto', 'Nico de Soto', 'Bartender who started in Paris in 2005 and worked at Experimental Cocktail Club and 69 Colebrooke Row before opening Mace in New York (2015) and Danico in Paris (2016). Known for travel-themed menus, reviving clarified milk punch and championing pandan, which led to his pandan liqueur Kota.', 'https://nicodesoto.com/', 'Paris'),
    ('andy.loudon', 'Andy Loudon', 'Bartender who runs the drinks programme across Rosewood London''s three bars, Scarfes included. He came up in Manchester and London before leading bars for the Tippling Club group in Singapore, then spent a few years consulting on bar concepts in Asia. His first Scarfes menu, Long Drawn Out Sip, launched in 2025.', NULL, 'London'),
    ('martin.siska', 'Martin Siska', 'Co-led Scarfes Bar for about eight years, taking it through its tenth anniversary and onto The World''s 50 Best Bars list, before moving to Atlantis Dubai.', NULL, NULL),
    ('yann.bouvignies', 'Yann Bouvignies', 'Co-led Scarfes Bar for about eight years as its head bartender, then moved to Rosewood Amsterdam.', NULL, NULL),
    ('carmine.dimarino', 'Carmine Di Marino', 'Bartender who leads the bar team at Svanen, where he has worked since the early days. Known for balanced drinks built on unusual ingredients, and nominated for Best Bartender in Norway at the Bartenders'' Choice Awards 2026.', NULL, 'Oslo'),
    ('karel.varga', 'Karel Varga', 'Bartender who has been with Svanen since it opened in 2019 and runs its operations and bar team alongside owner Yunus Yildiz. Nominated for Best Bartender in Norway at the Bartenders'' Choice Awards 2026.', NULL, 'Oslo'),
    ('diego.macedo', 'Diego Macedo', 'Bartender who trained as an actor, then spent some twenty years behind bars on cruise ships, in Los Angeles and in Madrid before opening Sastrería Martinez in Lima in 2022. He directs a menu built on ingredients from Peru''s coast, Andes and Amazon.', NULL, 'Lima'),
    ('iain.mcpherson', 'Iain McPherson', 'Edinburgh bartender and bar owner who opened Panda & Sons in 2013. He is known for sub-zero methods such as freeze distillation, freeze drying and his ''switching'' technique, and studied ice cream science, which led to the boozy ice cream brand Señor Scoop.', NULL, 'Edinburgh'),
    ('nicky.craig', 'Nicky Craig', 'Part of the leadership team at Panda & Sons, which won Best International Bar Team and World''s Best Cocktail Menu at the 2025 Spirited Awards.', NULL, 'Edinburgh'),
    ('sean.moggach', 'Sean Moggach', 'Bartender and part of the leadership team at Panda & Sons in Edinburgh, and a regular public voice for the city''s bar scene.', NULL, 'Edinburgh'),
    ('erik.andersson', 'Erik Andersson', 'Bartender who co-led the upstairs cocktail bar at Röda Huset and helped open Facit Bar in Umeå. In 2026 he left to run Dopp, a new cocktail bar from Restaurang Hantverket in Stockholm.', NULL, NULL),
    ('hampus.thunholm', 'Hampus Thunholm', 'Bartender who spent more than a decade running drinks at Fäviken, Magnus Nilsson''s remote restaurant in Jämtland, before opening Röda Huset in Stockholm in November 2021. He shapes the bar''s seasonal drinks around Swedish produce.', NULL, 'Stockholm'),
    ('hanna.oscarsson', 'Hanna Oscarsson', 'Leads the 18-seat upstairs cocktail room at Röda Huset, which serves a seasonal tasting menu of drinks built on preserved Swedish produce. Repeated Best Bartender nominee at Sweden''s Bartenders'' Choice Awards.', NULL, 'Stockholm'),
    ('manja.stankovic', 'Manja Stankovic', 'Bar leader who joined RIKAS in late 2020 and opened Mimi Kakushi in March 2021, building its Osaka-in-the-1920s drinks programme. Creator of the bar''s ice-block frozen martini and a WSET Level 3 holder, with more than a decade running bar programmes internationally.', NULL, 'Dubai'),
    ('rizwan.kassim', 'Rizwan Kassim', 'Restaurateur who founded La Cantine du Faubourg in Paris before moving to Dubai, where he built RIKAS Hospitality Group. The group owns Mimi Kakushi alongside concepts such as Ninive and Lana Lusa.', 'https://rikasgroup.com/', 'Dubai'),
    ('diego.cabrera', 'Diego Cabrera', 'Bartender who moved to Spain in 2001 and worked his way through every bar job before opening Le Cabrera in Madrid in 2008. He opened Salmon Guru in 2016 and later Guru Lab, with outposts in Dubai and Milan.', NULL, 'Madrid'),
    ('jay.khan', 'Jay Khan', 'Bartender who worked up from restaurants, nightclubs and a stint in Melbourne to the opening team of Lily & Bloom before opening COA in 2017. The agave bar has been named Asia''s best bar three times, and he co-founded the Mezcal Mission charity tastings.', 'https://www.instagram.com/jaykhan313/', 'Hong Kong'),
    ('ben.yabrow', 'Ben Yabrow', 'New York bartender who opened Sip & Guzzle as head bartender of the downstairs Sip room, where his Tomato Tree became the best-selling drink. He previously worked at Double Chicken Please and The SG Club, and left in April 2026 to open his own bar in New York.', NULL, NULL),
    ('shingo.gokan', 'Shingo Gokan', 'Bartender who spent about ten years at Angel''s Share in New York, won the 2012 Bacardi Legacy global final with his Speak Low, and went on to open bars in Shanghai and Tokyo. He co-founded Sip & Guzzle in 2024 and oversees the downstairs Sip room.', NULL, 'New York'),
    ('steve.schneider', 'Steve Schneider', 'Bartender who rose from apprentice to principal bartender and bar manager at Employees Only in New York, then helped take the brand to Singapore and opened The Strangers Club in Panama City. He co-founded Sip & Guzzle with Shingo Gokan and runs the upstairs Guzzle bar.', NULL, 'New York'),
    ('patrick.pistolesi', 'Patrick Pistolesi', 'Bartender who built his name at Barnum, co-founded The Gin Corner at Hotel Adriano and helped make Caffè Propaganda a cocktail destination before opening Drink Kong in Monti in 2018. His menus lean on pared-back, Japanese-influenced modern classics.', NULL, 'Rome'),
    ('faye.chen', 'Faye Chen', 'Bartender who began in Taipei, including flair bartending, and in 2014 moved to Shanghai to help open Speak Low with Shingo Gokan. She co-founded Double Chicken Please with GN Chan, first as a roving pop-up and since 2020 as a bar in New York.', 'https://doublechickenplease.com/', 'New York'),
    ('gn.chan', 'GN Chan', 'Bartender with an industrial design background who started out in Taipei and later trained at Angel''s Share in New York. With Faye Chen he ran a travelling cocktail pop-up from a VW minibus from 2017 before opening Double Chicken Please on the Lower East Side in 2020, known for drinks built to taste like dishes.', 'https://doublechickenplease.com/', 'New York'),
    ('andrea.gualdi', 'Andrea Gualdi', 'Bartender who co-founded Maybe Sammy and led the Maybe Group''s creative drinks direction. He later ran food and beverage for Ovolo Hotels in Australia and in late 2023 became group beverage manager at Merivale.', NULL, NULL),
    ('luca.goffredo', 'Luca Goffredo', 'Head bartender at Maybe Sammy, co-developing drinks for the Showtime menu with Paolo Maffietti. Known for pairing classic Italian flavours with the bar''s theatrical presentation.', NULL, 'Sydney'),
    ('martin.hudak', 'Martin Hudak', 'Bartender and coffee specialist who spent over three years at the American Bar at The Savoy in London before helping open Maybe Sammy in 2019, later serving as its creative director. By mid-2024 he had left Australia to consult from Slovakia.', NULL, NULL),
    ('paolo.maffietti', 'Paolo Maffietti', 'Long-serving Maybe Sammy bartender who was bar manager by 2023 and now oversees the Maybe Group''s bars as director of bars. He has led development of the bar''s recent themed menus, including Showtime.', NULL, 'Sydney'),
    ('stefano.catino', 'Stefano Catino', 'Hospitality operator who moved to Australia and co-founded the Maybe Group, starting with Maybe Frank in 2015 and then Maybe Sammy in 2019. He is the public face of the bar''s service-first style and its themed menus, most recently the film-inspired Showtime list.', 'https://www.maybesammy.com/', 'Sydney'),
    ('vince.lombardo', 'Vince Lombardo', 'Co-founder and director of the Maybe Group alongside Stefano Catino, behind Maybe Sammy, Maybe Frank and El Primo Sanchez in Sydney. He led the group''s move to run its venues independently in 2024.', 'https://www.maybesammy.com/', 'Sydney'),
    ('benjamin.cavagna', 'Benjamin Cavagna', 'Lombardy bartender who studied philosophy in Milan and joined Flavio Angiolillo''s team through summer shifts at Mag on the Naviglio. Now a Farmily partner running 1930, he oversaw the 2025 move and its culinary 1930 A La Carte menu.', NULL, 'Milan'),
    ('flavio.angiolillo', 'Flavio Angiolillo', 'Bartender and entrepreneur who trained in French restaurant kitchens and dining rooms before moving to Milan. With Marco Russo he opened Mag Cafe in 2011 and 1930 in 2013, and built the Farmily Group of bars plus its Farmily Spirits line.', 'https://www.farmilygroup.com/', 'Milan'),
    ('chris.hannah', 'Chris Hannah', 'New Orleans bartender who spent over 14 years running the French 75 Bar at Arnaud''s, where he revived local classics and created the Bywater. He co-founded Jewel of the South in 2019 and leads its drinks, which won the 2024 James Beard Award for Outstanding Bar Program.', 'https://www.jewelnola.com/', 'New Orleans'),
    ('john.stubbs', 'John Stubbs', 'Managing partner of Jewel of the South, involved since the bar''s 2019 opening with Chris Hannah.', 'https://www.jewelnola.com/', 'New Orleans'),
    ('victoria.espinel', 'Victoria Espinel', 'Partner at Jewel of the South, listed by the bar for community engagement and named by 50 Best as one of its owners.', NULL, 'New Orleans'),
    ('keith.motsi', 'Keith Motsi', 'Bartender who worked in Leeds and at Soho House London before a run of Four Seasons bars: opening Equis in Beijing and leading Charles H. in Seoul. He took over Virtu in Tokyo in 2022 and runs the hotel''s wider beverage operations.', 'https://www.fourseasons.com/otemachi/dining/restaurants/virtu/', 'Tokyo'),
    ('harrison.ginsberg', 'Harrison Ginsberg', 'New York bartender who worked at The Dorrance in Providence and The Dawson in Chicago, then The Dead Rabbit and BlackTail in New York. He joined Crown Shy in 2019 and built the Overstory drinks program from its 2021 opening until leaving in August 2026 to lead the bar at Crane Club''s Bar CC.', NULL, NULL),
    ('jeff.katz', 'Jeff Katz', 'Restaurateur who rose from manager to general manager at Del Posto, then partnered with chef James Kent to open Crown Shy, Saga and Overstory at 70 Pine Street. He has since moved on and is managing partner of Crane Club in New York.', NULL, NULL),
    ('alexandros.tselepis', 'Alexandros Tselepis', 'Athens bartender who co-founded The Bar in Front of the Bar in July 2021 and its sister bar Rumble in the Jungle. Before that he and Konstantinos Theodorakopoulos sold takeaway cocktails from a shop on Ermou Street during lockdown.', 'https://thebarinfrontofthebar.gr/', 'Athens'),
    ('konstantinos.theodorakopoulos', 'Konstantinos Theodorakopoulos', 'Athens bartender and co-founder of The Bar in Front of the Bar and Rumble in the Jungle, whose zero-waste approach turns the back bar''s prep leftovers into a daily changing street-side list.', 'https://thebarinfrontofthebar.gr/', 'Athens'),
    ('symeon.papanikolaou', 'Symeon Papanikolaou', 'Co-founder of The Bar in Front of the Bar and Rumble in the Jungle on Petraki Street in Athens, part of the three-person team behind the bar''s World''s 50 Best debut in 2025.', 'https://thebarinfrontofthebar.gr/', 'Athens'),
    ('atsushi.suzuki', 'Atsushi Suzuki', 'Tokyo bartender who worked at Angel''s Share in New York and bars in London and Toronto, then became head bartender of Speak Low in Shanghai and won the 2017 Chivas Masters global final. He returned to Tokyo as SG Group manager and opened The Bellwood in Shibuya in 2020.', NULL, 'Tokyo'),
    ('yumi.yoshinocheng', 'Yumi Yoshino-Cheng', 'Head bartender at The Bellwood, where she and Atsushi Suzuki built the kaiseki-style menu that draws on Japanese food and drinking history.', NULL, 'Tokyo'),
    ('chunyanuch.yodsuwan', 'Chunyanuch Yodsuwan', 'Head bartender at BKK Social Club in Bangkok, known as Ning, working under Philip Bischoff on the bar''s Mexico City themed menu.', NULL, 'Bangkok'),
    ('dheeradon.dissara', 'Dheeradon Dissara', 'Manager at BKK Social Club in Bangkok, known as Gotji, part of the service team behind the bar''s World''s 50 Best ranking.', NULL, 'Bangkok'),
    ('philip.bischoff', 'Philip Bischoff', 'Berlin bartender who worked at Amano and Le Lion Bar de Paris before running Manhattan at Regent Singapore, which topped Asia''s 50 Best Bars in 2017 and 2018. He moved to Bangkok to open BKK Social Club in 2020 and leads its Latin American themed programme.', 'https://www.fourseasons.com/bangkok/dining/lounges/bkk-social-club/', 'Bangkok'),
    ('colin.chia', 'Colin Chia', 'Singapore drinks veteran and former Asia-Pacific commercial lead for Diageo Reserve who opened Nutmeg & Clove on Ann Siang Hill in 2014 to tell the city''s stories through cocktails. His Nutmeg Collective also runs Last Word, Draft Land, Tess Bar & Kitchen and Chuan by Nutmeg.', 'https://www.nutmegclove.com/', 'Singapore')
) AS v ("handle", "name", "bio", "website", "city")
ON CONFLICT ("handle") DO NOTHING;

-- --- Where they work ---

INSERT INTO "public"."profile_positions" ("person_profile_id", "bar_profile_id", "title", "is_current", "source_url")
SELECT p.id, b.id, v.title, v.is_current, v.source_url
FROM (VALUES
    ('justin.shunwah', 'barleonehk', 'Co-founder and co-owner', true, 'https://www.the50.com/stories/News/bar-leone-asias-50-best-bars-2025-recipes.html'),
    ('lorenzo.antinori', 'barleonehk', 'Founder and head bartender', true, 'https://www.the50.com/bars/the-list/bar-leone.html'),
    ('eric.vanbeek', 'handshake_bar', 'Drinks director and partner', true, 'https://www.the50.com/bars/the-list/handshake-speakeasy.html'),
    ('marcos.dibattista', 'handshake_bar', 'Co-founder and co-owner', true, 'https://www.the50.com/stories/News/handshake-speakeasy-the-best-bar-in-north-america-2025.html'),
    ('rodrigo.urraca', 'handshake_bar', 'Co-founder and co-owner', true, 'https://www.the50.com/stories/News/handshake-speakeasy-the-best-bar-in-north-america-2025.html'),
    ('marc.alvarez', 'sips.barcelona', 'Co-founder and beverage director', true, 'https://sips.barcelona/bio/'),
    ('simone.caporale', 'sips.barcelona', 'Co-founder and head bartender', true, 'https://sips.barcelona/bio/'),
    ('giacomo.giannotti', 'paradiso_barcelona', 'Founder and owner', true, 'https://paradiso.cat/en/about/'),
    ('margarita.sader', 'paradiso_barcelona', 'Co-founder', true, 'https://www.thespiritsbusiness.com/2025/05/paradiso-reveals-all-star-women-hospitality-lineup/'),
    ('alex.kratena', 'tayer_elementary', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/best-in-the-world/the-list/tayer-elementary.html'),
    ('monica.berg', 'tayer_elementary', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/best-in-the-world/the-list/tayer-elementary.html'),
    ('monica.berg', 'himkok.oslo', 'Drinks creative lead (2017 ''Flavours of Norway'' menu)', false, 'https://punchdrink.com/articles/behind-himkok-norway-menu-best-cocktail-bars-oslo/'),
    ('agostino.perrone', 'connaughtbar', 'Director of mixology', true, 'https://www.the50.com/bars/the-list/connaught-bar.html'),
    ('giorgio.bargiani', 'connaughtbar', 'Assistant director of mixology', true, 'https://www.the50.com/bars/best-in-europe/awards/bartenders-bartender.html'),
    ('maura.milia', 'connaughtbar', 'Bar manager', false, 'https://drinksint.com/news/fullstory.php/aid/11025/Maura_Milia_to_leave_Connaught_Bar.html'),
    ('giovanni.allario', 'moebiusmilano', 'Head bartender and bar manager', true, 'https://www.the50.com/bars/the-list/moebius-milano.html'),
    ('lorenzo.querci', 'moebiusmilano', 'Founder and owner', true, 'https://www.the50.com/bars/the-list/moebius-milano.html'),
    ('dimitris.dafopoulos', 'line.athens', 'Co-founder and owner', true, 'https://www.the50.com/bars/the-list/line.html'),
    ('nikos.bakoulis', 'line.athens', 'Co-founder', true, 'https://www.the50.com/bars/the-list/line.html'),
    ('vasilis.kyritsis', 'line.athens', 'Co-founder', true, 'https://www.the50.com/bars/the-list/line.html'),
    ('aki.eguchi', 'jiggerandponysg', 'Bar programme director, Jigger & Pony Group', true, 'https://www.jiggerandponygroup.com/about'),
    ('guoyi.gan', 'jiggerandponysg', 'Co-founder and managing director', true, 'https://www.the50.com/bars/the-list/jigger-pony.html'),
    ('indra.kantono', 'jiggerandponysg', 'Co-founder and managing director', true, 'https://www.the50.com/bars/the-list/jigger-pony.html'),
    ('uno.jang', 'jiggerandponysg', 'Creative director and partner, Jigger & Pony Group', true, 'https://www.the50.com/stories/News/uno-jang-bartenders-bartender-the-worlds-50-best-bars-2025.html'),
    ('charly.aguinsky', '3monosbar', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/the-list/tres-monos.html'),
    ('gus.vocke', '3monosbar', 'Partner and co-owner', true, 'https://www.the50.com/bars/the-list/tres-monos.html'),
    ('lucila.calichio', '3monosbar', 'Bar manager', true, 'https://lecocktailconnoisseur.com/2025/08/25/lucila-calichio-tres-monos-buenos-aires/'),
    ('sebastian.atienza', '3monosbar', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/the-list/tres-monos.html'),
    ('jean.trinh', 'alquimicocartagena', 'Founder and owner', true, 'https://www.the50.com/bars/best-in-the-world/the-list/alquimico.html'),
    ('greg.boehm', 'superbuenonyc', 'Partner', true, 'https://www.the50.com/stories/News/superbueno-highest-new-entry-north-americas-50-best-bars-2024.html'),
    ('nacho.jimenez', 'superbuenonyc', 'Co-founder, owner and head bartender', true, 'https://www.the50.com/bars/best-in-the-world/the-list/superbueno.html'),
    ('kip.moffitt', 'superbuenonyc', 'Head bartender', true, 'https://www.the50.com/bars/best-in-the-world/the-list/superbueno.html'),
    ('alejandra.leon', 'ladybee.lima', 'Bar manager / head bartender', true, 'https://www.thespiritsbusiness.com/2025/01/cocktail-chat-limas-lady-bee/'),
    ('alonso.palomino', 'ladybee.lima', 'Co-founder and bartender', true, 'https://www.the50.com/bars/best-in-the-world/the-list/lady-bee.html'),
    ('gabriela.leon', 'ladybee.lima', 'Co-founder and chef', true, 'https://www.the50.com/bars/best-in-the-world/the-list/lady-bee.html'),
    ('maros.dzurus', 'himkok.oslo', 'Bar manager', false, 'https://www.the50.com/bars/best-in-the-world/the-list/himkok.html'),
    ('taln.rojanavanich', 'bar.us.bkk', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/bar-us.html'),
    ('aum.sawaengsupt', 'bar.us.bkk', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/bar-us.html'),
    ('demie.kim', 'zest.seoul', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/zest.html'),
    ('hadrien.moudoulaud', 'barnouveau', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/bar-nouveau.html'),
    ('marc.puzzuoli', 'barnouveau', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/bar-nouveau.html'),
    ('remy.savage', 'barnouveau', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/bar-nouveau.html'),
    ('sara.moudoulaud', 'barnouveau', 'Co-founder and owner', true, 'https://www.the50.com/bars/best-in-the-world/the-list/bar-nouveau.html'),
    ('hiroyasu.kayama', 'benfiddich_tokyo', 'Owner and bartender', true, 'https://www.the50.com/bars/best-in-the-world/the-list/bar-benfiddich.html'),
    ('darren.leaney', 'caretakers.cottage', 'Bartender', true, 'https://www.boothby.com.au/doublethink-from-caretakers-cottage/'),
    ('eddie.goddard', 'caretakers.cottage', 'Bar manager', true, NULL),
    ('kitty.gardner', 'caretakers.cottage', 'Bartender', true, 'https://www.boothby.com.au/doublethink-from-caretakers-cottage/'),
    ('matt.stirling', 'caretakers.cottage', 'Co-owner and operator', true, 'https://www.the50.com/bars/best-in-the-world/the-list/caretakers-cottage.html'),
    ('rob.libecans', 'caretakers.cottage', 'Co-owner, director and bartender', true, 'https://www.the50.com/bars/best-in-the-world/the-list/caretakers-cottage.html'),
    ('ryan.noreiks', 'caretakers.cottage', 'Co-owner; menu and graphic design', true, 'https://www.the50.com/bars/best-in-the-world/the-list/caretakers-cottage.html'),
    ('tom.mchugh', 'caretakers.cottage', 'Bar manager', false, 'https://www.boothby.com.au/doublethink-from-caretakers-cottage/'),
    ('hugo.gallou', 'thecambridge_paris', 'Co-founder', true, 'https://www.the50.com/stories/News/the-cambridge-public-house-highest-climber-the-worlds-50-best-bars-2024.html'),
    ('hyacinthe.lescoet', 'thecambridge_paris', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/the-cambridge-public-house.html'),
    ('ollie.sagerstromblom', 'satans_whiskers', 'Bar manager', true, 'https://bartender.com/bars/featured-bar-may-2025-satans-whiskers-east-london-uk/'),
    ('kevin.armstrong', 'satans_whiskers', 'Co-founder and owner', true, 'https://www.the50.com/bars/the-list/satans-whiskers.html'),
    ('alessandro.mengoni', 'localefirenze', 'Bar manager', true, 'https://www.ilforchettiere.it/locale-santabar-firenze-bancone/'),
    ('fabio.fanni', 'localefirenze', 'Bar manager', false, 'https://www.the50.com/bars/the-list/locale-firenze.html'),
    ('faramarz.poosty', 'localefirenze', 'Founder and general manager', true, 'https://blog.mtmagazine.it/en/local-yesterday-today-and-tomorrow-face-to-face-with-the-general-manager-faramarz-poosty/'),
    ('matteo.diienno', 'localefirenze', 'Bar manager', false, 'https://www.ilforchettiere.it/mixology-matteo-di-ienno-locale-firenze/'),
    ('bernardo.serna', 'tlecan', 'Co-founder and partner', true, 'https://www.chomp-magazine.com/post/tlec%C4%81n-north-americas-best-bars'),
    ('eli.martinez.bello', 'tlecan', 'Co-founder, co-owner and head bartender', true, 'https://www.the50.com/bars/the-list/tlecan.html'),
    ('caio.carvalhaes', 'tantannb', 'Head bartender', true, 'https://www.the50.com/bars/the-list/tan-tan.html'),
    ('thiago.banares', 'tantannb', 'Founder and owner', true, 'https://www.the50.com/bars/the-list/tan-tan.html'),
    ('peter.marcina', 'mirrorbarcarlton', 'Bar manager', true, 'https://www.the50.com/stories/News/mirror-bar-art-of-hospitality-europes-50-best-bars-2026.html'),
    ('stanislav.harcinik', 'mirrorbarcarlton', 'Global bar ambassador', true, 'https://www.the50.com/bars/the-list/mirror-bar.html'),
    ('ines.delossantos', 'cochinchina.bar', 'Founder and owner', true, 'https://www.the50.com/bars/the-list/cochinchina.html'),
    ('thanos.prunarus', 'baba_au_rum', 'Founder and owner', true, 'https://www.the50.com/bars/the-list/baba-au-rum.html'),
    ('evis.cali', 'nouvellevague_tirana', 'Co-founder', true, 'https://www.the50.com/bars/the-list/nouvelle-vague.html'),
    ('mariol.djata', 'nouvellevague_tirana', 'Head bartender', true, 'https://www.the50.com/bars/the-list/nouvelle-vague.html'),
    ('sofokli.cali', 'nouvellevague_tirana', 'Co-founder', true, 'https://www.the50.com/bars/the-list/nouvelle-vague.html'),
    ('andrew.ho', 'hopeandsesame', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/hope-sesame.html'),
    ('bastien.ciocca', 'hopeandsesame', 'Co-founder', true, 'https://www.the50.com/bars/best-in-the-world/the-list/hope-sesame.html'),
    ('corentin.gaudin', 'danicoparis', 'Bar manager', true, 'https://www.thespiritsbusiness.com/2025/05/inside-danico-latest-globetrotting-menu/'),
    ('nico.desoto', 'danicoparis', 'Founder and owner', true, 'https://www.the50.com/bars/the-list/danico.html'),
    ('andy.loudon', 'scarfesbar', 'Director of Bars, Rosewood London', true, 'https://www.the50.com/bars/the-list/scarfes-bar.html'),
    ('martin.siska', 'scarfesbar', 'Bar Manager (co-led the bar with Yann Bouvignies)', false, 'https://classbarmag.com/news/fullstory.php/aid/1618/Scarfes_Recast:_Andy_Loudon_on_his_plans_for_Scarfes_Bar.html'),
    ('yann.bouvignies', 'scarfesbar', 'Head Bartender (co-led the bar with Martin Siska)', false, 'https://classbarmag.com/news/fullstory.php/aid/1618/Scarfes_Recast:_Andy_Loudon_on_his_plans_for_Scarfes_Bar.html'),
    ('carmine.dimarino', 'svanen.oslo', 'Head Bartender', true, 'https://www.falstaff.com/en/news/oslos-top-5-cocktail-bars'),
    ('karel.varga', 'svanen.oslo', 'Operations Manager / Bar Manager', true, 'https://www.the50.com/bars/best-in-the-world/the-list/svanen.html'),
    ('diego.macedo', 'sastreriamartinezlima', 'Founder and Owner', true, 'https://www.thespiritsbusiness.com/2025/07/sastreria-martinez-unveils-new-cocktail-menu/'),
    ('iain.mcpherson', 'pandaandsons', 'Founder and Owner', true, 'https://www.the50.com/bars/the-list/panda-and-sons.html'),
    ('nicky.craig', 'pandaandsons', 'Venue Manager (leadership team)', true, 'https://sltn.co.uk/2025/08/01/huge-tales-of-the-cocktail-spirited-awards-win-for-panda-sons/'),
    ('sean.moggach', 'pandaandsons', 'Assistant Manager (leadership team)', true, 'https://sltn.co.uk/2025/08/01/huge-tales-of-the-cocktail-spirited-awards-win-for-panda-sons/'),
    ('erik.andersson', 'rodahusetsthlm', 'Head Bartender / Bar Manager', false, 'https://www.the50.com/bars/the-list/roda-huset.html'),
    ('hampus.thunholm', 'rodahusetsthlm', 'Co-founder and Co-owner', true, 'https://www.the50.com/bars/the-list/roda-huset.html'),
    ('hanna.oscarsson', 'rodahusetsthlm', 'Head Bartender, Röda Huset Cocktail Bar', true, 'https://www.the50.com/bars/the-list/roda-huset.html'),
    ('manja.stankovic', 'mimikakushi', 'Beverage Manager (Group Bar Manager, RIKAS)', true, 'https://www.thespiritsbusiness.com/2025/04/cocktail-stories-shadrach-mimi-kakushi/'),
    ('rizwan.kassim', 'mimikakushi', 'Founder, RIKAS Hospitality Group (owner)', true, 'https://rikasgroup.com/about/'),
    ('diego.cabrera', 'salmonguru', 'Founder and Owner', true, 'https://www.the50.com/bars/the-list/salmon-guru.html'),
    ('jay.khan', 'coahongkong', 'Founder and Owner', true, 'https://www.the50.com/bars/the-list/coa.html'),
    ('ben.yabrow', 'sipandguzzlenyc', 'Head Bartender, Sip', false, 'https://www.thespiritsbusiness.com/2024/01/sip-guzzle-opens-in-new-york/'),
    ('shingo.gokan', 'sipandguzzlenyc', 'Co-founder; leads Sip', true, 'https://www.the50.com/bars/the-list/sip-guzzle.html'),
    ('steve.schneider', 'sipandguzzlenyc', 'Co-founder; leads Guzzle', true, 'https://www.the50.com/bars/the-list/sip-guzzle.html'),
    ('patrick.pistolesi', 'drinkkongbar', 'Founder and Partner', true, 'https://www.the50.com/bars/the-list/drink-kong.html'),
    ('faye.chen', 'doublechickenpleasenyc', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/the-list/double-chicken-please.html'),
    ('gn.chan', 'doublechickenpleasenyc', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/the-list/double-chicken-please.html'),
    ('andrea.gualdi', 'maybe_sammy_sydney', 'Co-founder and former Creative Director', false, 'https://theshout.com.au/andrea-gualdi-appointed-as-merivale-group-beverage-manager/'),
    ('luca.goffredo', 'maybe_sammy_sydney', 'Head Bartender', true, 'https://australianbartender.com.au/2025/11/13/disaronno-turns-500-maybe-group-unveils-disaronno-limited-edition-bottles-and-cocktails/'),
    ('martin.hudak', 'maybe_sammy_sydney', 'Co-founder and former Creative Director', false, 'https://thepouringtales.com/martin-hudak/'),
    ('paolo.maffietti', 'maybe_sammy_sydney', 'Director of Bars, Maybe Group (previously Bar Manager, Maybe', true, 'https://www.broadsheet.com.au/sydney/food-and-drink/article/maybe-sammy-showtime-new-cocktail-menu'),
    ('stefano.catino', 'maybe_sammy_sydney', 'Co-founder', true, 'https://www.broadsheet.com.au/sydney/food-and-drink/article/maybe-sammy-showtime-new-cocktail-menu'),
    ('vince.lombardo', 'maybe_sammy_sydney', 'Co-founder, Maybe Group', true, 'https://www.timeout.com/sydney/news/this-glam-sydney-bar-was-just-named-in-the-worlds-50-best-bars-2025-100925'),
    ('benjamin.cavagna', '1930cocktailbar', 'Co-owner and head bartender / bar manager', true, 'https://www.the50.com/bars/the-list/1930.html'),
    ('flavio.angiolillo', '1930cocktailbar', 'Co-founder and co-owner (Farmily Group founder)', true, 'https://airmail.news/arts-intel/venues/1930'),
    ('chris.hannah', 'jewelnola', 'Co-founder, Partner and Beverage Director', true, 'https://www.jewelnola.com/team-member/chris-hannah/'),
    ('john.stubbs', 'jewelnola', 'Managing Partner', true, 'https://www.jewelnola.com/about/'),
    ('victoria.espinel', 'jewelnola', 'Partner (community engagement)', true, 'https://www.jewelnola.com/about/'),
    ('keith.motsi', 'virtutokyo', 'Head Bartender and Beverage Operations', true, 'https://press.fourseasons.com/otemachi/hotel-team/keith-motsi.html'),
    ('harrison.ginsberg', 'overstory', 'Founding Bar Director (also beverage lead for Saga and Crown', false, 'https://www.thespiritsbusiness.com/2026/08/new-yorks-overstory-loses-harrison-ginsberg/'),
    ('jeff.katz', 'overstory', 'Co-founder and former partner', false, 'https://www.leadersmag.com/issues/2025.3_Jul/HOS/LEADERS_Katz-Rodriguez_Crane_Club.html'),
    ('alexandros.tselepis', 'the.bar.in.front.of.the.bar', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/the-list/the-bar-in-front-of-the-bar.html'),
    ('konstantinos.theodorakopoulos', 'the.bar.in.front.of.the.bar', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/the-list/the-bar-in-front-of-the-bar.html'),
    ('symeon.papanikolaou', 'the.bar.in.front.of.the.bar', 'Co-founder and co-owner', true, 'https://www.the50.com/bars/the-list/the-bar-in-front-of-the-bar.html'),
    ('atsushi.suzuki', 'the_bellwood', 'Founder and head bartender', true, 'https://www.timeout.com/tokyo/bars-and-pubs/the-bellwood'),
    ('yumi.yoshinocheng', 'the_bellwood', 'Head Bartender', true, 'https://www.the50.com/discovery/Establishments/Japan/Tokyo/The-Bellwood.html'),
    ('chunyanuch.yodsuwan', 'bkksocialclub', 'Head Bartender', true, 'https://www.the50.com/bars/the-list/bkk-social-club.html'),
    ('dheeradon.dissara', 'bkksocialclub', 'Bar Manager', true, 'https://www.the50.com/bars/the-list/bkk-social-club.html'),
    ('philip.bischoff', 'bkksocialclub', 'Beverage Manager (opened and leads the bar)', true, 'https://press.fourseasons.com/bangkok/hotel-news/2025/bkk-social-club-worlds-best-bars/'),
    ('colin.chia', 'nutmegandclove', 'Founder', true, 'https://www.the50.com/bars/the-list/nutmeg-clove.html')
) AS v ("person", "bar", "title", "is_current", "source_url")
JOIN "public"."profiles" p ON p.handle = v.person AND p.kind = 'person'
JOIN "public"."profiles" b ON b.handle = v.bar AND b.kind = 'bar'
ON CONFLICT DO NOTHING;

-- --- Their drinks ---

-- Shared drinks with credit left at 'suggested' until the creator claims it
-- or a moderator verifies it. Names and a line on why each matters, no specs:
-- ponytail: specs need matching every ingredient to the ingredient list; the
-- creator adds theirs after claiming, or a catalog admin fills them in.
-- The image worker flag stops these inserts queueing paid sketches.
SET "app.image_worker" = 'on';

-- A bar's drink that's already here with no creator gets its creator.
UPDATE "public"."items" i
SET creator_profile_id = c.id, origin_year = COALESCE(i.origin_year, v.year), credit_status = 'suggested'
FROM (VALUES
    ('Leone Martini', 'House Martini with Italian gin, marsala and orange blossom, garnished with an almond-stuffed olive; Antinori calls it an homage to his Italian roots.', 'Original', 2023, 'lorenzo.antinori', 'barleonehk'),
    ('Olive Oil Sour', 'Bar Leone''s best-known signature: bourbon, Vecchia Romagna brandy, oloroso and Sicilian banana wine, textured with olive oil and egg white. A riff on the Oliveto.', 'Original', NULL, NULL, 'barleonehk'),
    ('Yuzu Negroni', 'A Negroni twist with gentian aperitif and yuzu liqueur that 50 Best published as one of the bar''s signatures.', 'Original', NULL, NULL, 'barleonehk'),
    ('Fig Martini', 'On the menu since Handshake opened in its current home; dry gin with Cinzano and a 48-hour sous-vide fig leaf cordial.', 'Original', 2021, NULL, 'handshake_bar'),
    ('Mexi-Thai', 'Coconut-fat-washed tequila, makrut lime leaf distillate and clarified tomato cordial, inspired by Eric van Beek''s love of tom yum.', 'Original', NULL, NULL, 'handshake_bar'),
    ('Nixtamil', 'Named by 50 Best as a Sips highlight: red fruit reduction, bourbon, corn and a miso distillate.', 'Original', NULL, NULL, 'sips.barcelona'),
    ('Mediterranean Treasure', 'Served in a seashell inside a treasure chest; part of the drinks that won Giannotti Diageo World Class Spain in 2014, the year before Paradiso opened.', 'Original', 2014, 'giacomo.giannotti', 'paradiso_barcelona'),
    ('Supercool Martini', 'Paradiso''s house Martini with fennel-and-oregano-infused gin and mustard-seed dry vermouth.', 'Original', NULL, NULL, 'paradiso_barcelona'),
    ('One Sip Martini', 'Elementary''s signature mini Martini served with a Gorgonzola-stuffed olive, the bar''s calling card.', 'Original', NULL, 'monica.berg', 'tayer_elementary'),
    ('Connaught Martini', 'Made tableside from a trolley with a house blend of vermouths and the guest''s choice of spirit and house bitters.', 'Original', 2008, NULL, 'connaughtbar'),
    ('Mulata Daisy', 'Chocolate-and-fennel riff on the Mulata Daiquiri that won the first Bacardi Legacy global final and is now a modern classic.', 'Original', 2008, 'agostino.perrone', 'connaughtbar'),
    ('Pesto Martini', 'Allario''s signature: vodka fat-washed with house pesto, a nod to his home city of Genoa, served ice-cold with Parmigiano on the side.', 'Original', NULL, 'giovanni.allario', 'moebiusmilano'),
    ('Delusional Margarita', 'Reposado tequila with mustard, ketchup, potato water and spices; 50 Best credits it jointly to Kyritsis and Bakoulis.', 'Original', NULL, 'vasilis.kyritsis', 'line.athens'),
    ('Korean Boilermaker', 'Highball of soju, American whiskey, hops, pear and passionfruit that Jang calls a return to his Korean roots.', 'Original', NULL, 'uno.jang', 'jiggerandponysg'),
    ('Red Revival', 'Beetroot, smoky house-roasted coffee, tequila and strawberry; named by 50 Best as a current highlight.', 'Original', NULL, NULL, 'jiggerandponysg'),
    ('Chimi Hendrix', 'Calichio''s signature highball: house whisky with peated malt, honey, pineapple and chimichurri, topped with ginger.', 'Original', NULL, 'lucila.calichio', '3monosbar'),
    ('Julep de D10S', 'Built on the house Licor del Norte (three Argentine herbs) with amaros, strawberry miso and grapefruit.', 'Original', NULL, NULL, '3monosbar'),
    ('Misticollins', 'Collins built on the bar''s own koji-rice sake with gin, aloe vera, cucumber, brine and tonic.', 'Original', NULL, NULL, '3monosbar'),
    ('Mango', 'Featured on the 2025 50 Best listing: tequila with house mango vermouth and a hop maceration.', 'Original', NULL, NULL, 'alquimicocartagena'),
    ('Green Mango Martini', 'Superbueno''s signature: a tequila Martini with green mango, Sauternes and a drop of chile oil, inspired by New York subway mango vendors.', 'Original', 2023, 'nacho.jimenez', 'superbuenonyc'),
    ('Mole Negroni', 'Negroni riff with mole fat-washed mezcal, amari, sweet vermouth and chocolate bitters.', 'Original', NULL, NULL, 'superbuenonyc'),
    ('Salted Plum & Tamarind Milk Punch', 'Milk punch with charanda, salted plum, tamarind and tea, listed on the 2025 50 Best page.', 'Original', NULL, NULL, 'superbuenonyc'),
    ('Vodka y Soda', 'Bestselling highball of pasilla-infused vodka and clarified guava, inspired by Boing! guava nectar.', 'Original', 2023, 'nacho.jimenez', 'superbuenonyc'),
    ('Bee''s Knees (Amazon twist)', 'Permanent menu item using mandarin-lime and honey from native stingless bees.', 'Original', NULL, NULL, 'ladybee.lima'),
    ('Oca Mashua', 'Built on an Andean distillate of red oca from a Cusco producer, with mashua and pickled tubers.', 'Original', NULL, NULL, 'ladybee.lima'),
    ('Three Sips Martini', 'Lady Bee''s best-known drink: a Peruvian gin, sherry and extra-dry vermouth Martini served with olive, sea lettuce and trout caviar on reclaimed Amazon wood.', 'Original', NULL, NULL, 'ladybee.lima'),
    ('Zombee', 'Zombie riff with rum, bee falernum and citrus, named for the bar''s stingless-bee theme.', 'Original', NULL, NULL, 'ladybee.lima'),
    ('Beetroot (Reindeer Moss Martini)', 'Vodka Martini built on a vacuum-distilled beetroot spirit with fino, mezcal and a reindeer moss reduction.', 'Original', 2023, 'maros.dzurus', 'himkok.oslo'),
    ('Birch', 'House Old Tom gin with meadowsweet and birch sap, served with a blue cheese olive.', 'Original', NULL, NULL, 'himkok.oslo'),
    ('Brunost cocktail', 'Early Himkok signature using Norwegian brown cheese syrup, aquavit and Armagnac.', 'Original', 2017, 'monica.berg', 'himkok.oslo'),
    ('Softis', 'Aquavit, amaretto, white cacao and fino topped with soft-serve, from the 2025 50 Best listing.', 'Original', NULL, NULL, 'himkok.oslo'),
    ('Satay', 'Savoury drink of masala-spice vodka distillate fat-washed with Thai chilli oil, pickled ginger brine, macadamia and shallot, finished tableside with chilli oil.', 'Original', 2024, NULL, 'bar.us.bkk'),
    ('City Bee''s Knees', 'Gin, second-flush citrus and honey from Seoul urban beekeepers.', 'Original', NULL, NULL, 'zest.seoul'),
    ('Jeju Garibaldi', 'Signature built on fresh hallabong (Jeju orange) juice; the peels go into the house gin and the pulp into cordial and sauerkraut.', 'Original', NULL, NULL, 'zest.seoul'),
    ('Pulp Sauerkraut', 'Uses fermented hallabong pulp left over from the Jeju Garibaldi, part of the bar''s zero-waste chain.', 'Original', NULL, NULL, 'zest.seoul'),
    ('Z&T (Zest & Tonic)', 'House-distilled seasonal gin with foraged botanicals and house tonic.', 'Original', NULL, NULL, 'zest.seoul'),
    ('Gustave', 'Tribute to Klimt: a cheese-forward agave old fashioned with olive-oil vodka, chamomile eau de vie and raicilla.', 'Original', 2023, NULL, 'barnouveau'),
    ('Sarbacane', 'Opening-menu drink of vodka, awamori and banana liqueur with salt.', 'Original', 2023, NULL, 'barnouveau'),
    ('Farm-fresh Julep', 'Julep with fennel and mint from his Chichibu farm, served through a century-old pewter straw.', 'Original', NULL, 'hiroyasu.kayama', 'benfiddich_tokyo'),
    ('House Campari (made from scratch)', 'His best-known party piece: a Campari rebuilt at the counter with herbs and cochineal for colour.', 'Original', NULL, 'hiroyasu.kayama', 'benfiddich_tokyo'),
    ('Doublethink', 'Boothby Drink of the Year 2025 (No. 1 of Australia''s 50 best drinks), inspired by a crème caramel and passionfruit dessert.', 'Original', 2025, 'kitty.gardner', 'caretakers.cottage'),
    ('Frantic Atlantic', 'House drink of pisco, elderflower, grapefruit and lemon reviewed by Time Out.', 'Original', NULL, NULL, 'caretakers.cottage'),
    ('Home Comforts', 'The bar''s homage to the Sgroppino: house limoncello, passionfruit sorbet and local sparkling cuvée.', 'Original', 2023, NULL, 'caretakers.cottage'),
    ('House Martini', 'The Cottage''s permanent signature, poured bracingly cold from the freezer; about 24,000 served a year. Ranked in Boothby''s top 50 drinks of Australia in 2022 (No. 12), 2023 (No. 2) and 2024 (No. 8).', 'Original', 2022, 'rob.libecans', 'caretakers.cottage'),
    ('June Bug Milk Punch', 'The bar''s 2024 clarified milk punch: coconut rum, banana, house ''Cottage'' melon liqueur, pineapple, lime and salt.', 'Original', 2024, NULL, 'caretakers.cottage'),
    ('Mr Blonde', 'No. 6 on Boothby''s 2025 list: Scotch, coffee liqueur, filter coffee, New York tea and doughnut cream.', 'Original', 2025, 'darren.leaney', 'caretakers.cottage'),
    ('Carrot Cake', 'Shaken with carrot cake cordial, cognac and whisky.', 'Original', NULL, NULL, 'thecambridge_paris'),
    ('Cigarette After Sex', 'On the menu since opening day: mezcal, sloe gin, agua de Jamaica, French honey and verjus.', 'Original', 2019, NULL, 'thecambridge_paris'),
    ('Pimm''s (house reinterpretation)', 'A running series (6th version by 2024) of wine-based Pimm''s riffs, one made with Alsatian wine, St-Germain and gin.', 'Original', NULL, NULL, 'thecambridge_paris'),
    ('Silent Sky', 'Cognac drink with mustard, golden turnip, Riesling and honey.', 'Original', NULL, NULL, 'thecambridge_paris'),
    ('Heartbreaker', 'A rye, Rubino vermouth and cherry soda highball, featured as the bar''s recipe in BARTENDER.com''s May 2025 profile.', 'Original', NULL, 'ollie.sagerstromblom', 'satans_whiskers'),
    ('Satan''s Manhattan', 'The house Manhattan, singled out by 50 Best as one of the best versions around.', 'Original', NULL, NULL, 'satans_whiskers'),
    ('Foglia', 'Gin sour with mint, basil and hemp, highlighted by 50 Best in 2025.', 'Original', NULL, NULL, 'localefirenze'),
    ('Green Fizz', 'A fizz made with Italian butter and sage, highlighted by 50 Best in 2025.', 'Original', NULL, NULL, 'localefirenze'),
    ('Locatini', 'The house martini: a briny mix of olive distillate, fino sherry and salt.', 'Original', NULL, NULL, 'localefirenze'),
    ('Seasonal Margarita', 'Tequila with acidified celery, chestnut honey and a sweet white vinegar, showing Locale''s kitchen-led approach.', 'Original', 2024, 'fabio.fanni', 'localefirenze'),
    ('Paloma Blanca', 'A clarified, carbonated Paloma with mezcal and volcanic salt, the bar''s best-known serve.', 'Original', NULL, NULL, 'tlecan'),
    ('Pulque Colada', 'Piña colada riff with pulque, pineapple milk punch, coconut water and coconut-fat-washed espadín mezcal.', 'Original', NULL, NULL, 'tlecan'),
    ('Tascalate Sour', 'Mezcal sour finished with fermented cacao, based on tascalate, a pre-Hispanic maize and cacao drink; the subject of a Punch feature.', 'Original', NULL, NULL, 'tlecan'),
    ('Dirty Collins', 'An early Tan Tan signature of white cachaça, tequila, olive and Tahiti lime, refined over the years.', 'Original', NULL, NULL, 'tantannb'),
    ('Cerebro of AI', 'Presented as the bar''s first cocktail designed end to end by AI, from ingredients to presentation.', 'Original', 2024, NULL, 'mirrorbarcarlton'),
    ('Lantern of Infinity', 'Clarified rum drink with goji, rosehip and red miso butter caramel, served in a mirrored cube, from the Essence of Design menu.', 'Original', NULL, NULL, 'mirrorbarcarlton'),
    ('Lux', 'Signature drink, a gin and passion fruit take on the Pornstar Martini topped with prosecco and served under a bonsai, with service pieces by designer Fero Tóth.', 'Original', NULL, NULL, 'mirrorbarcarlton'),
    ('Blend De Los Buenos', 'A long drink of her own Cantieri Navali vermouth with soda and capers.', 'Original', NULL, 'ines.delossantos', 'cochinchina.bar'),
    ('Dry Umami', 'Martini-style drink of three gins (one with shiitake, one with seaweed) and seaweed vermouth, created with bartender Lucas Rothchild.', 'Original', NULL, 'ines.delossantos', 'cochinchina.bar'),
    ('La Vida Que Me Merezco', 'The bar''s best-seller: a margarita balanced with pineapple, lemon and vanilla.', 'Original', NULL, 'ines.delossantos', 'cochinchina.bar'),
    ('Beatnik Paloma', 'The bar''s Paloma with tequila, mezcal, beetroot and black cardamom.', 'Original', NULL, NULL, 'baba_au_rum'),
    ('Supremus n°58', 'Ti'' Punch riff with a rum blend, falernum, tea and summer fruits, highlighted by 50 Best in 2025.', 'Original', NULL, NULL, 'baba_au_rum'),
    ('Black Sabah', 'Based on the Albanian morning habit of coffee with raki.', 'Original', NULL, NULL, 'nouvellevague_tirana'),
    ('C''est Rum', 'Tropical rum drink with pineapple and passion fruit. The bar says it has been the best-seller since opening night.', 'Original', 2012, NULL, 'nouvellevague_tirana'),
    ('Deviated Negroni', 'Negroni made with juniper raki and fortified Kallmet wine.', 'Original', NULL, NULL, 'nouvellevague_tirana'),
    ('Nou Whey', 'From the Origin''al menu: hazelnut milk, tonka, elderflower and pear raki.', 'Original', NULL, NULL, 'nouvellevague_tirana'),
    ('Domingo al Chifa', 'Peru menu tribute to Chinese-Peruvian chifa cooking: duck-fat-washed rum, sweet vermouth, Campari and hoisin.', 'Original', 2025, NULL, 'danicoparis'),
    ('Leche de Tigre', 'From the Peru Xplorer menu: a ceviche distillate with gin, coconut, lime, agave and ají amarillo. 50 Best says the menu was developed by de Soto and his team.', 'Original', 2025, 'nico.desoto', 'danicoparis'),
    ('Retail Therapy', 'Highlighted by The World''s 50 Best from the Long Drawn Out Sip menu: gin, basil, yuzu, clarified almond and champagne.', 'Original', 2025, NULL, 'scarfesbar'),
    ('Toothless Grin', 'Cognac, medjool date, evaporated beetroot and citra hops, served with a goat''s cheese and lemon curd bite; featured by The World''s 50 Best.', 'Original', 2025, NULL, 'scarfesbar'),
    ('Stolen Apples', 'Signature highlighted by The World''s 50 Best: rum, gin, green apple, lapsang souchong tea, ginger and shiso.', 'Original', NULL, NULL, 'svanen.oslo'),
    ('Cochinilla', 'Featured by The World''s 50 Best: rum with desert red prickly pear, Amazonian cocona, beetroot liqueur and sanky cordial.', 'Original', NULL, NULL, 'sastreriamartinezlima'),
    ('Huaca Pietra', 'Featured by The World''s 50 Best: wine and vermouth with coca leaf, passion fruit, yacon honey and limón sidra.', 'Original', NULL, NULL, 'sastreriamartinezlima'),
    ('Mr. Martinez', 'House signature; the 2023 version paired cheesecake-infused Johnnie Walker Gold with thyme blanco vermouth, bergamot, quinine and cacao pulp.', 'Original', 2023, NULL, 'sastreriamartinezlima'),
    ('Coconut Daiquiri', 'Uses his ''switching'' technique, replacing the water in the rum with roasted coconut milk; on the Transcend 2.0 menu.', 'Original', NULL, 'iain.mcpherson', 'pandaandsons'),
    ('Red Panda 2.0 (Bloody Mary)', 'Punch called it the best Bloody Mary in the UK: cryo-concentrated tomato, cucumber and makrut lime gin and a Guinness foam. The original dates from the 2013 opening; version 2.0 by 2023.', 'Original', 2013, 'iain.mcpherson', 'pandaandsons'),
    ('Apple & Hops', 'Long-running menu drink of late-harvest Swedish apples, Swedish hops and whisky, re-tuned as apple varieties and hop strains change.', 'Original', NULL, NULL, 'rodahusetsthlm'),
    ('Plums From Dreyer In Höör', 'Featured by The World''s 50 Best: sweet and sour plums rested with vodka and eau-de-vie.', 'Original', NULL, NULL, 'rodahusetsthlm'),
    ('Sweet Vernal Grass with Good Cream', 'Won Best Signature Cocktail in Sweden twice at the Bartenders'' Choice Awards: Danish cream, Granny Smith apple juice, house vernal grass liqueur and Galliano.', 'Original', NULL, NULL, 'rodahusetsthlm'),
    ('Shadrach (Kori Kakushi Martini)', 'Frozen ume martini served at about -20°C and carved out of a block of ice at the table; The World''s 50 Best calls it the Kori Kakushi Martini.', 'Original', NULL, 'manja.stankovic', 'mimikakushi'),
    ('Jardín de Dos Mundos', 'Two drinks in a heart-shaped double vessel, a pickled onion and fried quinoa dirty martini beside a pisco and pesto gimlet; developed at Guru Lab.', 'Original', NULL, NULL, 'salmonguru'),
    ('Old School Funny', 'Iberian negroni aged about five years in a solera; singled out by The World''s 50 Best.', 'Original', NULL, NULL, 'salmonguru'),
    ('Bloody Beef Maria', 'Bloody Mary riff with mezcal and tequila, beef stock, Sichuan pepper and Mexican chillies.', 'Original', NULL, NULL, 'coahongkong'),
    ('La Paloma de Oaxaca', 'Grapefruit, mezcal and tequila; on the menu since the bar opened.', 'Original', 2017, NULL, 'coahongkong'),
    ('Pepper Smash', 'Named by The World''s 50 Best 2025 as a COA signature.', 'Original', NULL, NULL, 'coahongkong'),
    ('Smacked Cucumber', 'Smoky mezcal and tequila with cucumber and a soy-forward Chinese salad dressing.', 'Original', NULL, NULL, 'coahongkong'),
    ('Miami Vice Negroni', 'Guzzle signature: a negroni with strawberry and coconut, over clear ice.', 'Original', NULL, NULL, 'sipandguzzlenyc'),
    ('Tomato Tree', 'Most popular drink in Sip since opening week and kept on the menu by demand; each ingredient stands for a part of a tree.', 'Original', 2024, 'ben.yabrow', 'sipandguzzlenyc'),
    ('Canova', 'A gimlet with a sea-evoking Mediterranean cordial, named after the neoclassical sculptor to signal the bar''s ''modern classics'' aim; on every menu.', 'Original', NULL, 'patrick.pistolesi', 'drinkkongbar'),
    ('Gaijin', 'Japanese whisky with miso cordial, a tribute to Japan that stays on every menu.', 'Original', NULL, 'patrick.pistolesi', 'drinkkongbar'),
    ('Cold Pizza', 'Signature Coop drink that turns a margherita pizza into a savoury margarita with parmesan tequila, burnt toast, tomato and basil.', 'Original', NULL, 'gn.chan', 'doublechickenpleasenyc'),
    ('Japanese Cold Noodle', 'Early Coop menu drink of rum, pineapple, cucumber, coconut and sesame oil built to echo a cold noodle dish.', 'Original', NULL, NULL, 'doublechickenpleasenyc'),
    ('Key Lime Pie', 'Dessert-in-a-glass Coop drink with gin, plum spirit, winter melon, cream and egg white; featured by StarChefs as the pair''s signature.', 'Original', NULL, 'gn.chan', 'doublechickenpleasenyc'),
    ('The Good, The Bad and The Ugly', 'Western-themed tequila highball from the Showtime menu, carbonated with smoked rooibos soda.', 'Original', 2025, 'paolo.maffietti', 'maybe_sammy_sydney'),
    ('The Grand Budapest Hotel', 'Showtime menu gin drink with watermelon and pink ginger cordial, coconut water, coffee and pandan, served in a lobby-boy cup.', 'Original', 2025, 'paolo.maffietti', 'maybe_sammy_sydney'),
    ('Parmigiano Colada', 'Pina colada twist with aged Parmigiano Reggiano foam, black truffle and Jamaican rum.', 'Original', 2025, NULL, '1930cocktailbar'),
    ('Tortellini in Brodo', 'Boulevardier riff with nutmeg-infused whiskey served hot in chicken broth, from the 1930 A La Carte menu.', 'Original', 2025, NULL, '1930cocktailbar'),
    ('Jewel Sazerac', 'House Sazerac variation with rye, Madeira, dry wine, aniseed liqueur and bitters.', 'Original', NULL, NULL, 'jewelnola'),
    ('Mellow Amer Negroni', 'Negroni variation with Japanese gin, white peach liqueur and Chartreuse.', 'Original', NULL, NULL, 'virtutokyo'),
    ('Smoked Ume Fashioned', 'Japanese whisky with hinoki bitters and house-made brandy umeshu; a signature of the French-Japanese menu.', 'Original', NULL, NULL, 'virtutokyo'),
    ('Salty Dog', 'House Salty Dog with gin, grapefruit, yuzu kosho and shio koji, highlighted by North America''s 50 Best 2026.', 'Original', NULL, NULL, 'overstory'),
    ('Terroir Old Fashioned', 'The bar''s signature: palo santo reposado tequila with vin jaune, yellow Chartreuse and salt the team harvests at Fort Tilden.', 'Original', NULL, 'harrison.ginsberg', 'overstory'),
    ('Her Scent', 'Gimlet-style house signature that has run since the bar''s early days.', 'Original', 2021, NULL, 'the.bar.in.front.of.the.bar'),
    ('Kafeneio', 'Recurring house drink named after the traditional Greek coffee house.', 'Original', NULL, NULL, 'the.bar.in.front.of.the.bar'),
    ('The Yellow House', 'Tequila and mezcal with tepache, Dijon mustard and black garlic.', 'Original', NULL, NULL, 'the.bar.in.front.of.the.bar'),
    ('Ne(w)groni', 'Negroni riff with distilled Tabasco and a strawberry-juice vermouth.', 'Original', NULL, 'atsushi.suzuki', 'the_bellwood'),
    ('Yakiniku Bloody', 'Savoury drink of smoked vodka, wagyu fat, yellow tomato and black garlic from the ''grilled'' course.', 'Original', NULL, NULL, 'the_bellwood'),
    ('Yama no Highball', 'Highball with black cardamom, a tree-sap spirit and roasted bay leaf.', 'Original', NULL, 'atsushi.suzuki', 'the_bellwood'),
    ('Hand of God', 'Tequila, malbec and Campari blend served from 750 ml or three-litre bottles.', 'Original', 2025, NULL, 'bkksocialclub'),
    ('Mezcal Negroni', 'Mexico City menu Negroni with pineapple Campari, coffee vermouth and olive saline.', 'Original', 2025, NULL, 'bkksocialclub'),
    ('Alamak', 'Singapore Sling take with Roku gin, soursop, passion fruit, pineapple and pomegranate, from the Singlish menu.', 'Original', 2026, NULL, 'nutmegandclove'),
    ('Dirty Kopi', 'Rum with cold brew from a heritage kopi roaster, cherry and warm sesame foam.', 'Original', 2025, NULL, 'nutmegandclove'),
    ('Kid Me Not', 'Sparkling highball with sarsaparilla, hawthorn and five-spice that recalls 1970s and 80s mama shops.', 'Original', 2025, NULL, 'nutmegandclove'),
    ('Nutmeg & Clove', 'The namesake ''Hall of Fame'' drink: rum with gula Melaka, lemon and ginger beer.', 'Original', NULL, NULL, 'nutmegandclove'),
    ('Bywater', 'Modern New Orleans classic: a rum cousin of the Brooklyn with amaro, green Chartreuse and falernum.', 'Original', 2007, 'chris.hannah', NULL),
    ('Cariño', 'Won the 2018 Bacardi Legacy global final: Bacardi Reserva Ocho, yellow Chartreuse, Greek yoghurt, vanilla syrup and lemon.', 'Original', 2018, 'eric.vanbeek', NULL),
    ('East 8 Hold-Up', 'Modern classic of vodka, Aperol and pineapple, named after Armstrong''s E8 postcode. 50 Best calls it a neo-classic he invented, and it is served at Satan''s Whiskers.', 'Original', 2010, 'kevin.armstrong', NULL),
    ('Magdalena', 'Her Bacardi Legacy 2020 competition drink, built around Proust''s madeleine and minimal ingredients.', 'Original', 2019, 'sara.moudoulaud', NULL),
    ('Perennial Gimlet', 'Green gimlet of vodka, green apple, wheatgrass, vetiver and fino, featured by StarChefs as his signature.', 'Original', NULL, 'harrison.ginsberg', NULL),
    ('Red Eye Gravy', 'Whiskey, coffee butter and wild mushroom drink from the road-trip pop-up years before the bar opened.', 'Original', NULL, 'gn.chan', NULL),
    ('Speak Low', 'Won the 2012 Bacardi Legacy global final; rum whisked with matcha in a nod to the tea ceremony. It later gave its name to his Shanghai bar.', 'Original', 2012, 'shingo.gokan', NULL)
) AS v ("name", "description", "origin", "year", "creator", "bar")
JOIN "public"."profiles" c ON c.handle = v.creator AND c.kind = 'person'
JOIN "public"."profiles" b ON b.handle = v.bar AND b.kind = 'bar'
WHERE lower(i.name) = lower(v.name) AND i.bar_id IS NULL AND i.origin_bar_profile_id = b.id AND i.creator_profile_id IS NULL;

INSERT INTO "public"."items" ("name", "item_type", "description", "origin", "origin_year", "creator_profile_id", "origin_bar_profile_id", "credit_status")
SELECT v.name, 'cocktail', v.description, v.origin, v.year, c.id, b.id, 'suggested'
FROM (VALUES
    ('Leone Martini', 'House Martini with Italian gin, marsala and orange blossom, garnished with an almond-stuffed olive; Antinori calls it an homage to his Italian roots.', 'Original', 2023, 'lorenzo.antinori', 'barleonehk'),
    ('Olive Oil Sour', 'Bar Leone''s best-known signature: bourbon, Vecchia Romagna brandy, oloroso and Sicilian banana wine, textured with olive oil and egg white. A riff on the Oliveto.', 'Original', NULL, NULL, 'barleonehk'),
    ('Yuzu Negroni', 'A Negroni twist with gentian aperitif and yuzu liqueur that 50 Best published as one of the bar''s signatures.', 'Original', NULL, NULL, 'barleonehk'),
    ('Fig Martini', 'On the menu since Handshake opened in its current home; dry gin with Cinzano and a 48-hour sous-vide fig leaf cordial.', 'Original', 2021, NULL, 'handshake_bar'),
    ('Mexi-Thai', 'Coconut-fat-washed tequila, makrut lime leaf distillate and clarified tomato cordial, inspired by Eric van Beek''s love of tom yum.', 'Original', NULL, NULL, 'handshake_bar'),
    ('Nixtamil', 'Named by 50 Best as a Sips highlight: red fruit reduction, bourbon, corn and a miso distillate.', 'Original', NULL, NULL, 'sips.barcelona'),
    ('Mediterranean Treasure', 'Served in a seashell inside a treasure chest; part of the drinks that won Giannotti Diageo World Class Spain in 2014, the year before Paradiso opened.', 'Original', 2014, 'giacomo.giannotti', 'paradiso_barcelona'),
    ('Supercool Martini', 'Paradiso''s house Martini with fennel-and-oregano-infused gin and mustard-seed dry vermouth.', 'Original', NULL, NULL, 'paradiso_barcelona'),
    ('One Sip Martini', 'Elementary''s signature mini Martini served with a Gorgonzola-stuffed olive, the bar''s calling card.', 'Original', NULL, 'monica.berg', 'tayer_elementary'),
    ('Connaught Martini', 'Made tableside from a trolley with a house blend of vermouths and the guest''s choice of spirit and house bitters.', 'Original', 2008, NULL, 'connaughtbar'),
    ('Mulata Daisy', 'Chocolate-and-fennel riff on the Mulata Daiquiri that won the first Bacardi Legacy global final and is now a modern classic.', 'Original', 2008, 'agostino.perrone', 'connaughtbar'),
    ('Pesto Martini', 'Allario''s signature: vodka fat-washed with house pesto, a nod to his home city of Genoa, served ice-cold with Parmigiano on the side.', 'Original', NULL, 'giovanni.allario', 'moebiusmilano'),
    ('Delusional Margarita', 'Reposado tequila with mustard, ketchup, potato water and spices; 50 Best credits it jointly to Kyritsis and Bakoulis.', 'Original', NULL, 'vasilis.kyritsis', 'line.athens'),
    ('Korean Boilermaker', 'Highball of soju, American whiskey, hops, pear and passionfruit that Jang calls a return to his Korean roots.', 'Original', NULL, 'uno.jang', 'jiggerandponysg'),
    ('Red Revival', 'Beetroot, smoky house-roasted coffee, tequila and strawberry; named by 50 Best as a current highlight.', 'Original', NULL, NULL, 'jiggerandponysg'),
    ('Chimi Hendrix', 'Calichio''s signature highball: house whisky with peated malt, honey, pineapple and chimichurri, topped with ginger.', 'Original', NULL, 'lucila.calichio', '3monosbar'),
    ('Julep de D10S', 'Built on the house Licor del Norte (three Argentine herbs) with amaros, strawberry miso and grapefruit.', 'Original', NULL, NULL, '3monosbar'),
    ('Misticollins', 'Collins built on the bar''s own koji-rice sake with gin, aloe vera, cucumber, brine and tonic.', 'Original', NULL, NULL, '3monosbar'),
    ('Mango', 'Featured on the 2025 50 Best listing: tequila with house mango vermouth and a hop maceration.', 'Original', NULL, NULL, 'alquimicocartagena'),
    ('Green Mango Martini', 'Superbueno''s signature: a tequila Martini with green mango, Sauternes and a drop of chile oil, inspired by New York subway mango vendors.', 'Original', 2023, 'nacho.jimenez', 'superbuenonyc'),
    ('Mole Negroni', 'Negroni riff with mole fat-washed mezcal, amari, sweet vermouth and chocolate bitters.', 'Original', NULL, NULL, 'superbuenonyc'),
    ('Salted Plum & Tamarind Milk Punch', 'Milk punch with charanda, salted plum, tamarind and tea, listed on the 2025 50 Best page.', 'Original', NULL, NULL, 'superbuenonyc'),
    ('Vodka y Soda', 'Bestselling highball of pasilla-infused vodka and clarified guava, inspired by Boing! guava nectar.', 'Original', 2023, 'nacho.jimenez', 'superbuenonyc'),
    ('Bee''s Knees (Amazon twist)', 'Permanent menu item using mandarin-lime and honey from native stingless bees.', 'Original', NULL, NULL, 'ladybee.lima'),
    ('Oca Mashua', 'Built on an Andean distillate of red oca from a Cusco producer, with mashua and pickled tubers.', 'Original', NULL, NULL, 'ladybee.lima'),
    ('Three Sips Martini', 'Lady Bee''s best-known drink: a Peruvian gin, sherry and extra-dry vermouth Martini served with olive, sea lettuce and trout caviar on reclaimed Amazon wood.', 'Original', NULL, NULL, 'ladybee.lima'),
    ('Zombee', 'Zombie riff with rum, bee falernum and citrus, named for the bar''s stingless-bee theme.', 'Original', NULL, NULL, 'ladybee.lima'),
    ('Beetroot (Reindeer Moss Martini)', 'Vodka Martini built on a vacuum-distilled beetroot spirit with fino, mezcal and a reindeer moss reduction.', 'Original', 2023, 'maros.dzurus', 'himkok.oslo'),
    ('Birch', 'House Old Tom gin with meadowsweet and birch sap, served with a blue cheese olive.', 'Original', NULL, NULL, 'himkok.oslo'),
    ('Brunost cocktail', 'Early Himkok signature using Norwegian brown cheese syrup, aquavit and Armagnac.', 'Original', 2017, 'monica.berg', 'himkok.oslo'),
    ('Softis', 'Aquavit, amaretto, white cacao and fino topped with soft-serve, from the 2025 50 Best listing.', 'Original', NULL, NULL, 'himkok.oslo'),
    ('Satay', 'Savoury drink of masala-spice vodka distillate fat-washed with Thai chilli oil, pickled ginger brine, macadamia and shallot, finished tableside with chilli oil.', 'Original', 2024, NULL, 'bar.us.bkk'),
    ('City Bee''s Knees', 'Gin, second-flush citrus and honey from Seoul urban beekeepers.', 'Original', NULL, NULL, 'zest.seoul'),
    ('Jeju Garibaldi', 'Signature built on fresh hallabong (Jeju orange) juice; the peels go into the house gin and the pulp into cordial and sauerkraut.', 'Original', NULL, NULL, 'zest.seoul'),
    ('Pulp Sauerkraut', 'Uses fermented hallabong pulp left over from the Jeju Garibaldi, part of the bar''s zero-waste chain.', 'Original', NULL, NULL, 'zest.seoul'),
    ('Z&T (Zest & Tonic)', 'House-distilled seasonal gin with foraged botanicals and house tonic.', 'Original', NULL, NULL, 'zest.seoul'),
    ('Gustave', 'Tribute to Klimt: a cheese-forward agave old fashioned with olive-oil vodka, chamomile eau de vie and raicilla.', 'Original', 2023, NULL, 'barnouveau'),
    ('Sarbacane', 'Opening-menu drink of vodka, awamori and banana liqueur with salt.', 'Original', 2023, NULL, 'barnouveau'),
    ('Farm-fresh Julep', 'Julep with fennel and mint from his Chichibu farm, served through a century-old pewter straw.', 'Original', NULL, 'hiroyasu.kayama', 'benfiddich_tokyo'),
    ('House Campari (made from scratch)', 'His best-known party piece: a Campari rebuilt at the counter with herbs and cochineal for colour.', 'Original', NULL, 'hiroyasu.kayama', 'benfiddich_tokyo'),
    ('Doublethink', 'Boothby Drink of the Year 2025 (No. 1 of Australia''s 50 best drinks), inspired by a crème caramel and passionfruit dessert.', 'Original', 2025, 'kitty.gardner', 'caretakers.cottage'),
    ('Frantic Atlantic', 'House drink of pisco, elderflower, grapefruit and lemon reviewed by Time Out.', 'Original', NULL, NULL, 'caretakers.cottage'),
    ('Home Comforts', 'The bar''s homage to the Sgroppino: house limoncello, passionfruit sorbet and local sparkling cuvée.', 'Original', 2023, NULL, 'caretakers.cottage'),
    ('House Martini', 'The Cottage''s permanent signature, poured bracingly cold from the freezer; about 24,000 served a year. Ranked in Boothby''s top 50 drinks of Australia in 2022 (No. 12), 2023 (No. 2) and 2024 (No. 8).', 'Original', 2022, 'rob.libecans', 'caretakers.cottage'),
    ('June Bug Milk Punch', 'The bar''s 2024 clarified milk punch: coconut rum, banana, house ''Cottage'' melon liqueur, pineapple, lime and salt.', 'Original', 2024, NULL, 'caretakers.cottage'),
    ('Mr Blonde', 'No. 6 on Boothby''s 2025 list: Scotch, coffee liqueur, filter coffee, New York tea and doughnut cream.', 'Original', 2025, 'darren.leaney', 'caretakers.cottage'),
    ('Carrot Cake', 'Shaken with carrot cake cordial, cognac and whisky.', 'Original', NULL, NULL, 'thecambridge_paris'),
    ('Cigarette After Sex', 'On the menu since opening day: mezcal, sloe gin, agua de Jamaica, French honey and verjus.', 'Original', 2019, NULL, 'thecambridge_paris'),
    ('Pimm''s (house reinterpretation)', 'A running series (6th version by 2024) of wine-based Pimm''s riffs, one made with Alsatian wine, St-Germain and gin.', 'Original', NULL, NULL, 'thecambridge_paris'),
    ('Silent Sky', 'Cognac drink with mustard, golden turnip, Riesling and honey.', 'Original', NULL, NULL, 'thecambridge_paris'),
    ('Heartbreaker', 'A rye, Rubino vermouth and cherry soda highball, featured as the bar''s recipe in BARTENDER.com''s May 2025 profile.', 'Original', NULL, 'ollie.sagerstromblom', 'satans_whiskers'),
    ('Satan''s Manhattan', 'The house Manhattan, singled out by 50 Best as one of the best versions around.', 'Original', NULL, NULL, 'satans_whiskers'),
    ('Foglia', 'Gin sour with mint, basil and hemp, highlighted by 50 Best in 2025.', 'Original', NULL, NULL, 'localefirenze'),
    ('Green Fizz', 'A fizz made with Italian butter and sage, highlighted by 50 Best in 2025.', 'Original', NULL, NULL, 'localefirenze'),
    ('Locatini', 'The house martini: a briny mix of olive distillate, fino sherry and salt.', 'Original', NULL, NULL, 'localefirenze'),
    ('Seasonal Margarita', 'Tequila with acidified celery, chestnut honey and a sweet white vinegar, showing Locale''s kitchen-led approach.', 'Original', 2024, 'fabio.fanni', 'localefirenze'),
    ('Paloma Blanca', 'A clarified, carbonated Paloma with mezcal and volcanic salt, the bar''s best-known serve.', 'Original', NULL, NULL, 'tlecan'),
    ('Pulque Colada', 'Piña colada riff with pulque, pineapple milk punch, coconut water and coconut-fat-washed espadín mezcal.', 'Original', NULL, NULL, 'tlecan'),
    ('Tascalate Sour', 'Mezcal sour finished with fermented cacao, based on tascalate, a pre-Hispanic maize and cacao drink; the subject of a Punch feature.', 'Original', NULL, NULL, 'tlecan'),
    ('Dirty Collins', 'An early Tan Tan signature of white cachaça, tequila, olive and Tahiti lime, refined over the years.', 'Original', NULL, NULL, 'tantannb'),
    ('Cerebro of AI', 'Presented as the bar''s first cocktail designed end to end by AI, from ingredients to presentation.', 'Original', 2024, NULL, 'mirrorbarcarlton'),
    ('Lantern of Infinity', 'Clarified rum drink with goji, rosehip and red miso butter caramel, served in a mirrored cube, from the Essence of Design menu.', 'Original', NULL, NULL, 'mirrorbarcarlton'),
    ('Lux', 'Signature drink, a gin and passion fruit take on the Pornstar Martini topped with prosecco and served under a bonsai, with service pieces by designer Fero Tóth.', 'Original', NULL, NULL, 'mirrorbarcarlton'),
    ('Blend De Los Buenos', 'A long drink of her own Cantieri Navali vermouth with soda and capers.', 'Original', NULL, 'ines.delossantos', 'cochinchina.bar'),
    ('Dry Umami', 'Martini-style drink of three gins (one with shiitake, one with seaweed) and seaweed vermouth, created with bartender Lucas Rothchild.', 'Original', NULL, 'ines.delossantos', 'cochinchina.bar'),
    ('La Vida Que Me Merezco', 'The bar''s best-seller: a margarita balanced with pineapple, lemon and vanilla.', 'Original', NULL, 'ines.delossantos', 'cochinchina.bar'),
    ('Beatnik Paloma', 'The bar''s Paloma with tequila, mezcal, beetroot and black cardamom.', 'Original', NULL, NULL, 'baba_au_rum'),
    ('Supremus n°58', 'Ti'' Punch riff with a rum blend, falernum, tea and summer fruits, highlighted by 50 Best in 2025.', 'Original', NULL, NULL, 'baba_au_rum'),
    ('Black Sabah', 'Based on the Albanian morning habit of coffee with raki.', 'Original', NULL, NULL, 'nouvellevague_tirana'),
    ('C''est Rum', 'Tropical rum drink with pineapple and passion fruit. The bar says it has been the best-seller since opening night.', 'Original', 2012, NULL, 'nouvellevague_tirana'),
    ('Deviated Negroni', 'Negroni made with juniper raki and fortified Kallmet wine.', 'Original', NULL, NULL, 'nouvellevague_tirana'),
    ('Nou Whey', 'From the Origin''al menu: hazelnut milk, tonka, elderflower and pear raki.', 'Original', NULL, NULL, 'nouvellevague_tirana'),
    ('Domingo al Chifa', 'Peru menu tribute to Chinese-Peruvian chifa cooking: duck-fat-washed rum, sweet vermouth, Campari and hoisin.', 'Original', 2025, NULL, 'danicoparis'),
    ('Leche de Tigre', 'From the Peru Xplorer menu: a ceviche distillate with gin, coconut, lime, agave and ají amarillo. 50 Best says the menu was developed by de Soto and his team.', 'Original', 2025, 'nico.desoto', 'danicoparis'),
    ('Retail Therapy', 'Highlighted by The World''s 50 Best from the Long Drawn Out Sip menu: gin, basil, yuzu, clarified almond and champagne.', 'Original', 2025, NULL, 'scarfesbar'),
    ('Toothless Grin', 'Cognac, medjool date, evaporated beetroot and citra hops, served with a goat''s cheese and lemon curd bite; featured by The World''s 50 Best.', 'Original', 2025, NULL, 'scarfesbar'),
    ('Stolen Apples', 'Signature highlighted by The World''s 50 Best: rum, gin, green apple, lapsang souchong tea, ginger and shiso.', 'Original', NULL, NULL, 'svanen.oslo'),
    ('Cochinilla', 'Featured by The World''s 50 Best: rum with desert red prickly pear, Amazonian cocona, beetroot liqueur and sanky cordial.', 'Original', NULL, NULL, 'sastreriamartinezlima'),
    ('Huaca Pietra', 'Featured by The World''s 50 Best: wine and vermouth with coca leaf, passion fruit, yacon honey and limón sidra.', 'Original', NULL, NULL, 'sastreriamartinezlima'),
    ('Mr. Martinez', 'House signature; the 2023 version paired cheesecake-infused Johnnie Walker Gold with thyme blanco vermouth, bergamot, quinine and cacao pulp.', 'Original', 2023, NULL, 'sastreriamartinezlima'),
    ('Coconut Daiquiri', 'Uses his ''switching'' technique, replacing the water in the rum with roasted coconut milk; on the Transcend 2.0 menu.', 'Original', NULL, 'iain.mcpherson', 'pandaandsons'),
    ('Red Panda 2.0 (Bloody Mary)', 'Punch called it the best Bloody Mary in the UK: cryo-concentrated tomato, cucumber and makrut lime gin and a Guinness foam. The original dates from the 2013 opening; version 2.0 by 2023.', 'Original', 2013, 'iain.mcpherson', 'pandaandsons'),
    ('Apple & Hops', 'Long-running menu drink of late-harvest Swedish apples, Swedish hops and whisky, re-tuned as apple varieties and hop strains change.', 'Original', NULL, NULL, 'rodahusetsthlm'),
    ('Plums From Dreyer In Höör', 'Featured by The World''s 50 Best: sweet and sour plums rested with vodka and eau-de-vie.', 'Original', NULL, NULL, 'rodahusetsthlm'),
    ('Sweet Vernal Grass with Good Cream', 'Won Best Signature Cocktail in Sweden twice at the Bartenders'' Choice Awards: Danish cream, Granny Smith apple juice, house vernal grass liqueur and Galliano.', 'Original', NULL, NULL, 'rodahusetsthlm'),
    ('Shadrach (Kori Kakushi Martini)', 'Frozen ume martini served at about -20°C and carved out of a block of ice at the table; The World''s 50 Best calls it the Kori Kakushi Martini.', 'Original', NULL, 'manja.stankovic', 'mimikakushi'),
    ('Jardín de Dos Mundos', 'Two drinks in a heart-shaped double vessel, a pickled onion and fried quinoa dirty martini beside a pisco and pesto gimlet; developed at Guru Lab.', 'Original', NULL, NULL, 'salmonguru'),
    ('Old School Funny', 'Iberian negroni aged about five years in a solera; singled out by The World''s 50 Best.', 'Original', NULL, NULL, 'salmonguru'),
    ('Bloody Beef Maria', 'Bloody Mary riff with mezcal and tequila, beef stock, Sichuan pepper and Mexican chillies.', 'Original', NULL, NULL, 'coahongkong'),
    ('La Paloma de Oaxaca', 'Grapefruit, mezcal and tequila; on the menu since the bar opened.', 'Original', 2017, NULL, 'coahongkong'),
    ('Pepper Smash', 'Named by The World''s 50 Best 2025 as a COA signature.', 'Original', NULL, NULL, 'coahongkong'),
    ('Smacked Cucumber', 'Smoky mezcal and tequila with cucumber and a soy-forward Chinese salad dressing.', 'Original', NULL, NULL, 'coahongkong'),
    ('Miami Vice Negroni', 'Guzzle signature: a negroni with strawberry and coconut, over clear ice.', 'Original', NULL, NULL, 'sipandguzzlenyc'),
    ('Tomato Tree', 'Most popular drink in Sip since opening week and kept on the menu by demand; each ingredient stands for a part of a tree.', 'Original', 2024, 'ben.yabrow', 'sipandguzzlenyc'),
    ('Canova', 'A gimlet with a sea-evoking Mediterranean cordial, named after the neoclassical sculptor to signal the bar''s ''modern classics'' aim; on every menu.', 'Original', NULL, 'patrick.pistolesi', 'drinkkongbar'),
    ('Gaijin', 'Japanese whisky with miso cordial, a tribute to Japan that stays on every menu.', 'Original', NULL, 'patrick.pistolesi', 'drinkkongbar'),
    ('Cold Pizza', 'Signature Coop drink that turns a margherita pizza into a savoury margarita with parmesan tequila, burnt toast, tomato and basil.', 'Original', NULL, 'gn.chan', 'doublechickenpleasenyc'),
    ('Japanese Cold Noodle', 'Early Coop menu drink of rum, pineapple, cucumber, coconut and sesame oil built to echo a cold noodle dish.', 'Original', NULL, NULL, 'doublechickenpleasenyc'),
    ('Key Lime Pie', 'Dessert-in-a-glass Coop drink with gin, plum spirit, winter melon, cream and egg white; featured by StarChefs as the pair''s signature.', 'Original', NULL, 'gn.chan', 'doublechickenpleasenyc'),
    ('The Good, The Bad and The Ugly', 'Western-themed tequila highball from the Showtime menu, carbonated with smoked rooibos soda.', 'Original', 2025, 'paolo.maffietti', 'maybe_sammy_sydney'),
    ('The Grand Budapest Hotel', 'Showtime menu gin drink with watermelon and pink ginger cordial, coconut water, coffee and pandan, served in a lobby-boy cup.', 'Original', 2025, 'paolo.maffietti', 'maybe_sammy_sydney'),
    ('Parmigiano Colada', 'Pina colada twist with aged Parmigiano Reggiano foam, black truffle and Jamaican rum.', 'Original', 2025, NULL, '1930cocktailbar'),
    ('Tortellini in Brodo', 'Boulevardier riff with nutmeg-infused whiskey served hot in chicken broth, from the 1930 A La Carte menu.', 'Original', 2025, NULL, '1930cocktailbar'),
    ('Jewel Sazerac', 'House Sazerac variation with rye, Madeira, dry wine, aniseed liqueur and bitters.', 'Original', NULL, NULL, 'jewelnola'),
    ('Mellow Amer Negroni', 'Negroni variation with Japanese gin, white peach liqueur and Chartreuse.', 'Original', NULL, NULL, 'virtutokyo'),
    ('Smoked Ume Fashioned', 'Japanese whisky with hinoki bitters and house-made brandy umeshu; a signature of the French-Japanese menu.', 'Original', NULL, NULL, 'virtutokyo'),
    ('Salty Dog', 'House Salty Dog with gin, grapefruit, yuzu kosho and shio koji, highlighted by North America''s 50 Best 2026.', 'Original', NULL, NULL, 'overstory'),
    ('Terroir Old Fashioned', 'The bar''s signature: palo santo reposado tequila with vin jaune, yellow Chartreuse and salt the team harvests at Fort Tilden.', 'Original', NULL, 'harrison.ginsberg', 'overstory'),
    ('Her Scent', 'Gimlet-style house signature that has run since the bar''s early days.', 'Original', 2021, NULL, 'the.bar.in.front.of.the.bar'),
    ('Kafeneio', 'Recurring house drink named after the traditional Greek coffee house.', 'Original', NULL, NULL, 'the.bar.in.front.of.the.bar'),
    ('The Yellow House', 'Tequila and mezcal with tepache, Dijon mustard and black garlic.', 'Original', NULL, NULL, 'the.bar.in.front.of.the.bar'),
    ('Ne(w)groni', 'Negroni riff with distilled Tabasco and a strawberry-juice vermouth.', 'Original', NULL, 'atsushi.suzuki', 'the_bellwood'),
    ('Yakiniku Bloody', 'Savoury drink of smoked vodka, wagyu fat, yellow tomato and black garlic from the ''grilled'' course.', 'Original', NULL, NULL, 'the_bellwood'),
    ('Yama no Highball', 'Highball with black cardamom, a tree-sap spirit and roasted bay leaf.', 'Original', NULL, 'atsushi.suzuki', 'the_bellwood'),
    ('Hand of God', 'Tequila, malbec and Campari blend served from 750 ml or three-litre bottles.', 'Original', 2025, NULL, 'bkksocialclub'),
    ('Mezcal Negroni', 'Mexico City menu Negroni with pineapple Campari, coffee vermouth and olive saline.', 'Original', 2025, NULL, 'bkksocialclub'),
    ('Alamak', 'Singapore Sling take with Roku gin, soursop, passion fruit, pineapple and pomegranate, from the Singlish menu.', 'Original', 2026, NULL, 'nutmegandclove'),
    ('Dirty Kopi', 'Rum with cold brew from a heritage kopi roaster, cherry and warm sesame foam.', 'Original', 2025, NULL, 'nutmegandclove'),
    ('Kid Me Not', 'Sparkling highball with sarsaparilla, hawthorn and five-spice that recalls 1970s and 80s mama shops.', 'Original', 2025, NULL, 'nutmegandclove'),
    ('Nutmeg & Clove', 'The namesake ''Hall of Fame'' drink: rum with gula Melaka, lemon and ginger beer.', 'Original', NULL, NULL, 'nutmegandclove'),
    ('Bywater', 'Modern New Orleans classic: a rum cousin of the Brooklyn with amaro, green Chartreuse and falernum.', 'Original', 2007, 'chris.hannah', NULL),
    ('Cariño', 'Won the 2018 Bacardi Legacy global final: Bacardi Reserva Ocho, yellow Chartreuse, Greek yoghurt, vanilla syrup and lemon.', 'Original', 2018, 'eric.vanbeek', NULL),
    ('East 8 Hold-Up', 'Modern classic of vodka, Aperol and pineapple, named after Armstrong''s E8 postcode. 50 Best calls it a neo-classic he invented, and it is served at Satan''s Whiskers.', 'Original', 2010, 'kevin.armstrong', NULL),
    ('Magdalena', 'Her Bacardi Legacy 2020 competition drink, built around Proust''s madeleine and minimal ingredients.', 'Original', 2019, 'sara.moudoulaud', NULL),
    ('Perennial Gimlet', 'Green gimlet of vodka, green apple, wheatgrass, vetiver and fino, featured by StarChefs as his signature.', 'Original', NULL, 'harrison.ginsberg', NULL),
    ('Red Eye Gravy', 'Whiskey, coffee butter and wild mushroom drink from the road-trip pop-up years before the bar opened.', 'Original', NULL, 'gn.chan', NULL),
    ('Speak Low', 'Won the 2012 Bacardi Legacy global final; rum whisked with matcha in a nod to the tea ceremony. It later gave its name to his Shanghai bar.', 'Original', 2012, 'shingo.gokan', NULL)
) AS v ("name", "description", "origin", "year", "creator", "bar")
LEFT JOIN "public"."profiles" c ON c.handle = v.creator AND c.kind = 'person'
LEFT JOIN "public"."profiles" b ON b.handle = v.bar AND b.kind = 'bar'
WHERE (c.id IS NOT NULL OR b.id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "public"."items" i
    WHERE lower(i.name) = lower(v.name) AND i.bar_id IS NULL
      AND (i.creator_profile_id = c.id OR i.origin_bar_profile_id = b.id)
  );

-- Everyone else who made it.
INSERT INTO "public"."item_co_creators" ("item_id", "profile_id")
SELECT i.id, co.id
FROM (VALUES
    ('Delusional Margarita', 'vasilis.kyritsis', 'nikos.bakoulis'),
    ('Doublethink', 'kitty.gardner', 'darren.leaney'),
    ('Doublethink', 'kitty.gardner', 'tom.mchugh'),
    ('Mr Blonde', 'darren.leaney', 'kitty.gardner'),
    ('Cold Pizza', 'gn.chan', 'faye.chen'),
    ('Key Lime Pie', 'gn.chan', 'faye.chen'),
    ('The Good, The Bad and The Ugly', 'paolo.maffietti', 'luca.goffredo'),
    ('The Grand Budapest Hotel', 'paolo.maffietti', 'luca.goffredo')
) AS v ("name", "creator", "co")
JOIN "public"."profiles" c ON c.handle = v.creator AND c.kind = 'person'
JOIN "public"."items" i ON lower(i.name) = lower(v.name) AND i.bar_id IS NULL AND i.creator_profile_id = c.id
JOIN "public"."profiles" co ON co.handle = v.co AND co.kind = 'person'
ON CONFLICT DO NOTHING;

RESET "app.image_worker";

-- --- Two bar bios that went out of date ---

-- Locale's bar manager left in September 2026, and one of Maybe Sammy's
-- co-founders left in 2023. Only touched while the bio is still ours, so a
-- bar that has claimed and rewritten its own keeps it.
UPDATE "public"."profiles"
SET "bio" = 'Bar and restaurant inside the medieval Palazzo Concini, with a vaulted basement lab. Founded by Faramarz Poosty, with Alessandro Mengoni leading the bar since September 2026, it reworks familiar classics with modern techniques and a low-waste approach, often drawing on the kitchen and seasonal produce. No. 22 on The World''s 50 Best Bars 2025.'
WHERE "handle" = 'localefirenze' AND "kind" = 'bar'
  AND "bio" = 'Bar and restaurant inside the medieval Palazzo Concini, with a vaulted basement lab. The bar team, led by bar manager Fabio Fanni, reworks familiar classics with modern techniques and a low-waste approach, often drawing on the kitchen and seasonal produce. No. 22 on The World''s 50 Best Bars 2025.';

UPDATE "public"."profiles"
SET "bio" = 'Cocktail bar in The Rocks styled as a 1950s hotel bar without the hotel, all pink velvet and old Hollywood glamour. Opened in 2019 by the team behind Maybe Frank and run by co-founders Stefano Catino and Vince Lombardo, with Paolo Maffietti directing the bars. No. 42 on The World''s 50 Best Bars 2025.'
WHERE "handle" = 'maybe_sammy_sydney' AND "kind" = 'bar'
  AND "bio" = 'Cocktail bar in The Rocks styled as a 1950s hotel bar without the hotel, all pink velvet and old Hollywood glamour. Opened in 2019 by Stefano Catino, Vince Lombardo and Andrea Gualdi, the team behind Maybe Frank. No. 42 on The World''s 50 Best Bars 2025.';

-- --- The Library leaves out drinks credited to a person, too ---

-- app_item_presentation gains creator_profile_id (at the end, nothing else
-- changes), so a drink credited to someone with no venue behind it stays on
-- their profile instead of every Library, like a bar's signatures.
CREATE OR REPLACE VIEW "public"."app_item_presentation" WITH ("security_invoker" = true) AS
 SELECT c.id,
    c.name,
    c.item_type,
    c.description,
    c.created_at,
    c.glassware_id,
    c.family_id,
    c.ice_id,
    c.notes,
    c.origin,
    c.price,
    c.status,
    c.brand_maker,
    c.abv,
    c.bar_id,
    c.icon_key,
    c.icon_url,
    c.hide_from_search,
    c.origin_bar_profile_id,
    c.created_by,
    c.creator_profile_id
   FROM public.items c
     LEFT JOIN public.bars b ON c.bar_id = b.id
     LEFT JOIN public.user_bars ub ON ub.bar_id = c.bar_id AND ub.user_id = auth.uid()
  WHERE c.bar_id IS NULL OR public.effective_bar_role(ub.role_level) >= COALESCE(c.override_visibility_level, b.default_visibility_level);
