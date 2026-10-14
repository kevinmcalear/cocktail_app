-- Australian bottles, second pass: the producers whose shop sites
-- rate-limited or blocked the first checks (20261017500000 and the beer and
-- wine load), checked again slowly on their own pages, or on an Australian
-- retailer's page where the site still refused. Step 6a and 6b of the bottle
-- catalog plan: https://claude.ai/artifact/Vu6seuSNtN42nKYb2nDCVR
--
--   * 110 producers retried: 83 distilleries and 27 breweries, cideries and
--     wineries (Seppeltsfield, Brown Brothers, Manly Spirits, Mountain Monk
--     and others). The core range of each, by the same rules as the first
--     loads: no limited, single-cask, vintage-dated or seasonal releases.
--   * Rows the first loads already have are left out, so this only adds
--     what they missed; a producer that already has a page keeps it.
--   * Styles as before: Australian gin, Australian Cane Spirit for cane
--     spirits sold as such or aged under two years, Australian fortified
--     styles (never Port or Sherry). An Australian spirit labelled
--     "bourbon" files as whiskey, since bourbon is a US product.
--   * Left out: a brewery whose site carries injected spam (an unsafe
--     source), and a cask-numbered single-cask release.
--   * Every fact keeps the page it was checked on in item_sources, dated
--     2026-10-14.
--   * An independent check of 100 random rows found 8 wrong facts in 526
--     (1.5%), all style calls or a missing word in a name. Every correction
--     is taken.
--
-- Matched by name key; rows that don't exist are skipped and a second run
-- changes nothing more. Venue ingredients, styles and house preps aren't
-- touched.


SET "app.image_worker" = 'on';
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE FUNCTION pg_temp.shared(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT public.resolve_ingredient(p_name);
$$;
CREATE FUNCTION pg_temp.style(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT i.id FROM public.items i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role = 'generic'
       AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
     ORDER BY i.is_core DESC, i.created_at LIMIT 1;
$$;
-- Whether p_id sits under p_style (up to four levels down).
CREATE FUNCTION pg_temp.under(p_id uuid, p_style uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
    WITH RECURSIVE up AS (
        SELECT i.generic_id AS id, 1 AS d FROM public.items i WHERE i.id = p_id
        UNION ALL
        SELECT i.generic_id, up.d + 1 FROM up JOIN public.items i ON i.id = up.id WHERE up.d < 4
    )
    SELECT p_style IS NOT NULL AND EXISTS (SELECT 1 FROM up WHERE up.id = p_style);
$$;

-- ---------------------------------------------------------------------------
-- Styles
-- ---------------------------------------------------------------------------

-- The styles bottles file under here, and the style each is a kind of. Made
-- when missing; one that exists stays where it is.
CREATE TEMP TABLE style_in (ord int PRIMARY KEY, name text NOT NULL, kind_of text);
INSERT INTO style_in VALUES
(0, $q$London Dry Gin$q$, $q$Gin$q$),
(1, $q$Old Tom Gin$q$, $q$Gin$q$),
(2, $q$Navy Strength Gin$q$, $q$Gin$q$),
(3, $q$Aged Gin$q$, $q$Gin$q$),
(4, $q$Pink Gin$q$, $q$Gin$q$),
(5, $q$Flavoured Gin$q$, $q$Gin$q$),
(6, $q$Australian Gin$q$, $q$Gin$q$),
(7, $q$Gin$q$, $q$Spirit$q$),
(8, $q$Vodka$q$, $q$Spirit$q$),
(9, $q$Flavoured Vodka$q$, $q$Vodka$q$),
(10, $q$Citron Vodka$q$, $q$Flavoured vodka$q$),
(11, $q$Vanilla Vodka$q$, $q$Flavoured vodka$q$),
(12, $q$Cucumber Vodka$q$, $q$Flavoured vodka$q$),
(13, $q$Rye Vodka$q$, $q$Vodka$q$),
(14, $q$Wheat Vodka$q$, $q$Vodka$q$),
(15, $q$Australian Vodka$q$, $q$Vodka$q$),
(16, $q$Single Malt Whisky$q$, $q$Malt whisky$q$),
(17, $q$Rye Whiskey$q$, $q$Whiskey$q$),
(18, $q$Wheat Whiskey$q$, $q$American whiskey$q$),
(19, $q$Corn Whiskey$q$, $q$American whiskey$q$),
(20, $q$Bourbon$q$, $q$American whiskey$q$),
(21, $q$Whiskey$q$, $q$Spirit$q$),
(22, $q$Rhum Agricole Blanc$q$, $q$Rhum agricole$q$),
(23, $q$Aged Rhum Agricole$q$, $q$Rhum agricole$q$),
(24, $q$Rhum Agricole$q$, $q$Rum$q$),
(25, $q$Clairin$q$, $q$Rum$q$),
(26, $q$Charanda$q$, $q$Rum$q$),
(27, $q$Jamaican Rum$q$, $q$Rum$q$),
(28, $q$Aged Jamaican Rum$q$, $q$Jamaican rum$q$),
(29, $q$Overproof Jamaican Rum$q$, $q$Jamaican rum$q$),
(30, $q$Demerara Rum$q$, $q$Rum$q$),
(31, $q$Navy Rum$q$, $q$Dark rum$q$),
(32, $q$Blackstrap Rum$q$, $q$Dark rum$q$),
(33, $q$Overproof Rum$q$, $q$Rum$q$),
(34, $q$Spiced Rum$q$, $q$Rum$q$),
(35, $q$Pineapple Rum$q$, $q$Rum$q$),
(36, $q$Coconut Rum$q$, $q$Rum$q$),
(37, $q$White Rum$q$, $q$Rum$q$),
(38, $q$Gold Rum$q$, $q$Rum$q$),
(39, $q$Dark Rum$q$, $q$Rum$q$),
(40, $q$Aged Rum$q$, $q$Rum$q$),
(41, $q$White Cachaça$q$, $q$Cachaça$q$),
(42, $q$Aged Cachaça$q$, NULL),
(43, $q$Cachaça$q$, $q$Spirit$q$),
(44, $q$Rum$q$, $q$Spirit$q$),
(45, $q$Cognac$q$, $q$Brandy$q$),
(46, $q$Armagnac$q$, $q$Brandy$q$),
(47, $q$Blanche d'Armagnac$q$, $q$Armagnac$q$),
(48, $q$Calvados$q$, $q$Apple brandy$q$),
(49, $q$Applejack$q$, $q$Apple brandy$q$),
(50, $q$Apple Brandy$q$, $q$Brandy$q$),
(51, $q$Poire Williams$q$, $q$Pear brandy$q$),
(52, $q$Pear Brandy$q$, $q$Brandy$q$),
(53, $q$Kirsch$q$, $q$Eau-de-vie$q$),
(54, $q$Plum Brandy$q$, $q$Eau-de-vie$q$),
(55, $q$Raspberry Eau de Vie$q$, $q$Eau-de-vie$q$),
(56, $q$Quince Eau De Vie$q$, $q$Eau-de-vie$q$),
(57, $q$Grape Eau de Vie$q$, $q$Eau-de-vie$q$),
(58, $q$Eau-de-vie$q$, $q$Brandy$q$),
(59, $q$Grappa$q$, $q$Brandy$q$),
(60, $q$Acholado Pisco$q$, $q$Pisco$q$),
(61, $q$Pisco$q$, $q$Brandy$q$),
(62, $q$Singani$q$, $q$Brandy$q$),
(63, $q$Brandy de Jerez$q$, $q$Spanish brandy$q$),
(64, $q$Spanish Brandy$q$, $q$Brandy$q$),
(65, $q$American Brandy$q$, $q$Brandy$q$),
(66, $q$Greek Brandy$q$, $q$Brandy$q$),
(67, $q$Italian Brandy$q$, $q$Brandy$q$),
(68, $q$Brandy$q$, $q$Spirit$q$),
(69, $q$Blanco Tequila$q$, $q$Tequila$q$),
(70, $q$Joven Tequila$q$, $q$Tequila$q$),
(71, $q$Reposado Tequila$q$, $q$Tequila$q$),
(72, $q$Añejo Tequila$q$, $q$Tequila$q$),
(73, $q$Extra Añejo Tequila$q$, $q$Tequila$q$),
(74, $q$Cristalino Tequila$q$, $q$Tequila$q$),
(75, $q$Espadín Mezcal$q$, $q$Mezcal$q$),
(76, $q$Tobalá Mezcal$q$, $q$Mezcal$q$),
(77, $q$Cupreata Mezcal$q$, $q$Mezcal$q$),
(78, $q$Salmiana Mezcal$q$, $q$Mezcal$q$),
(79, $q$Ensamble Mezcal$q$, $q$Mezcal$q$),
(80, $q$Mezcal$q$, $q$Agave spirit$q$),
(81, $q$Raicilla$q$, $q$Agave spirit$q$),
(82, $q$Bacanora$q$, $q$Agave spirit$q$),
(83, $q$Agave Spirit$q$, $q$Spirit$q$),
(84, $q$Sotol$q$, $q$Spirit$q$),
(85, $q$Absinthe$q$, $q$Spirit$q$),
(86, $q$Absinthe Verte$q$, $q$Absinthe$q$),
(87, $q$Blanche Absinthe$q$, $q$Absinthe$q$),
(88, $q$Aquavit$q$, $q$Spirit$q$),
(89, $q$Genever$q$, $q$Spirit$q$),
(90, $q$Pastis$q$, $q$Spirit$q$),
(91, $q$Ouzo$q$, $q$Spirit$q$),
(92, $q$Neutral Grain Spirit$q$, $q$Spirit$q$),
(93, $q$Rice Spirit$q$, $q$Spirit$q$),
(94, $q$Shochu$q$, $q$Spirit$q$),
(95, $q$Soju$q$, $q$Spirit$q$),
(96, $q$Poitín$q$, $q$Spirit$q$),
(97, $q$Herbal Spirit$q$, $q$Spirit$q$),
(98, $q$Arrack$q$, $q$Spirit$q$),
(99, $q$Spirit$q$, NULL),
(100, $q$Acorn (Bellota) Liqueur$q$, $q$Liqueur$q$),
(101, $q$Acqua di Cedro$q$, $q$Liqueur$q$),
(102, $q$Advocaat$q$, $q$Liqueur$q$),
(103, $q$Aged Umeshu$q$, $q$Umeshu$q$),
(104, $q$Allspice Dram$q$, $q$Liqueur$q$),
(105, $q$Almond Liqueur$q$, $q$Liqueur$q$),
(106, $q$Alpine Liqueur$q$, $q$Herbal liqueur$q$),
(107, $q$Amaretto$q$, $q$Liqueur$q$),
(108, $q$Ancho Liqueur$q$, $q$Chile liqueur$q$),
(109, $q$Ancho Reyes + Poblano$q$, $q$Chile liqueur$q$),
(110, $q$Anisette$q$, $q$Liqueur$q$),
(111, $q$Apple Aperitif$q$, $q$Apple liqueur$q$),
(112, $q$Apple Liqueur$q$, $q$Liqueur$q$),
(113, $q$Apple Schnapps$q$, $q$Schnapps$q$),
(114, $q$Apricot Liqueur$q$, $q$Liqueur$q$),
(115, $q$Aronia Berry Liqueur$q$, $q$Berry liqueur$q$),
(116, $q$Banana Liqueur$q$, $q$Liqueur$q$),
(117, $q$Basil Liqueur$q$, $q$Herbal liqueur$q$),
(118, $q$Bergamot Liqueur$q$, $q$Liqueur$q$),
(119, $q$Berry Liqueur$q$, $q$Liqueur$q$),
(120, $q$Biscotti Liqueur$q$, $q$Liqueur$q$),
(121, $q$Biscuit Liqueur$q$, $q$Biscotti liqueur$q$),
(122, $q$Bitter Cherry Liqueur$q$, $q$Cherry liqueur$q$),
(123, $q$Bitter Strawberry Liqueur$q$, $q$Strawberry liqueur$q$),
(124, $q$Black Raspberry Liqueur$q$, $q$Liqueur$q$),
(125, $q$Black Tea Liqueur$q$, $q$Liqueur$q$),
(126, $q$Blood Orange & Hibiscus Liqueur$q$, $q$Blood orange liqueur$q$),
(127, $q$Blood Orange Liqueur$q$, $q$Orange liqueur$q$),
(128, $q$Blue Curaçao$q$, $q$Curaçao$q$),
(129, $q$Blueberry Liqueur$q$, $q$Liqueur$q$),
(130, $q$Botanical Liqueur$q$, $q$Herbal liqueur$q$),
(131, $q$Brandy Umeshu$q$, $q$Umeshu$q$),
(132, $q$Butterscotch Liqueur$q$, $q$Liqueur$q$),
(133, $q$Butterscotch Schnapps$q$, $q$Schnapps$q$),
(134, $q$Cacao White$q$, $q$Crème de cacao$q$),
(135, $q$Cactus Liqueur$q$, $q$Liqueur$q$),
(136, $q$Café de Olla Liqueur$q$, $q$Coffee liqueur$q$),
(137, $q$Calamansi Liqueur$q$, $q$Citrus liqueur$q$),
(138, $q$Camomile Liqueur$q$, $q$Herbal liqueur$q$),
(139, $q$Caraway Liqueur$q$, $q$Kümmel$q$),
(140, $q$Cardamom Liqueur$q$, $q$Liqueur$q$),
(141, $q$Cedro Lemon Liqueur$q$, $q$Citron liqueur$q$),
(142, $q$Cedro Liqueur$q$, $q$Citron liqueur$q$),
(143, $q$Centerbe$q$, $q$Herbal liqueur$q$),
(144, $q$Chamomile Liqueur$q$, $q$Herbal liqueur$q$),
(145, $q$Cherry Blossom Liqueur$q$, $q$Liqueur$q$),
(146, $q$Cherry Brandy$q$, $q$Cherry liqueur$q$),
(147, $q$Cherry Liqueur$q$, $q$Liqueur$q$),
(148, $q$Cherry Liqueurs$q$, $q$Cherry liqueur$q$),
(149, $q$Cherry Ratafia$q$, $q$Ratafia$q$),
(150, $q$Chile Liqueur$q$, $q$Liqueur$q$),
(151, $q$Chinotto Liqueur$q$, $q$Liqueur$q$),
(152, $q$Chocolate Liqueur$q$, $q$Liqueur$q$),
(153, $q$Chocolate Mint Schnapps$q$, $q$Schnapps$q$),
(154, $q$Cinnamon Liqueur$q$, $q$Liqueur$q$),
(155, $q$Cinnamon Myrtle Liqueur$q$, $q$Herbal liqueur$q$),
(156, $q$Cinnamon Whisky$q$, $q$Whiskey liqueur$q$),
(157, $q$Citron Liqueur$q$, $q$Liqueur$q$),
(158, $q$Citrus Liqueur$q$, $q$Liqueur$q$),
(159, $q$Citrus Liqueurs$q$, $q$Citrus liqueur$q$),
(160, $q$Coconut Liqueur$q$, $q$Liqueur$q$),
(161, $q$Coffee Liqueur$q$, $q$Liqueur$q$),
(162, $q$Cognac Orange Liqueur$q$, $q$Orange liqueur$q$),
(163, $q$Corn Liqueur$q$, $q$Liqueur$q$),
(164, $q$Cranberry Liqueur$q$, $q$Liqueur$q$),
(165, $q$Cream Liqueur$q$, $q$Liqueur$q$),
(166, $q$Crème de Cacao$q$, $q$Liqueur$q$),
(167, $q$Crème de Cassis$q$, $q$Liqueur$q$),
(168, $q$Crème De Flora$q$, $q$Liqueur$q$),
(169, $q$Creme de Framboise$q$, $q$Raspberry liqueur$q$),
(170, $q$Crème de Menthe$q$, $q$Liqueur$q$),
(171, $q$Crème de Menthe Green$q$, $q$Crème de menthe$q$),
(172, $q$Crème de Mûre$q$, $q$Liqueur$q$),
(173, $q$Crème de Noyaux$q$, $q$Liqueur$q$),
(174, $q$Crème de Pêche$q$, $q$Peach liqueur$q$),
(175, $q$Crème de Violette$q$, $q$Liqueur$q$),
(176, $q$Cucumber Liqueur$q$, $q$Liqueur$q$),
(177, $q$Curaçao$q$, $q$Orange liqueur$q$),
(178, $q$Currant Cassis$q$, $q$Crème de cassis$q$),
(179, $q$Damiana Liqueur$q$, $q$Herbal liqueur$q$),
(180, $q$Dark Crème de Cacao$q$, $q$Crème de cacao$q$),
(181, $q$Dragonfruit Liqueur$q$, $q$Liqueur$q$),
(182, $q$Dry Curacao Liqueur$q$, $q$Curaçao$q$),
(183, $q$Dry Triple Sec$q$, $q$Triple sec$q$),
(184, $q$Egg Liqueur$q$, $q$Liqueur$q$),
(185, $q$Egg Yolk Liqueur$q$, $q$Advocaat$q$),
(186, $q$Elderflower Liqueur$q$, $q$Liqueur$q$),
(187, $q$Elisir Di Prugna$q$, $q$Plum liqueur$q$),
(188, $q$Espresso Liqueur$q$, $q$Coffee liqueur$q$),
(189, $q$Falernum$q$, $q$Liqueur$q$),
(190, $q$Fig Liqueur$q$, $q$Liqueur$q$),
(191, $q$Finocchietto$q$, $q$Herbal liqueur$q$),
(192, $q$Finocchietto Fennel Liqueur$q$, $q$Herbal liqueur$q$),
(193, $q$Finochietto$q$, $q$Herbal liqueur$q$),
(194, $q$Floral Liqueur$q$, $q$Liqueur$q$),
(195, $q$Framboise$q$, $q$Raspberry liqueur$q$),
(196, $q$French Herbal Liqueur$q$, $q$Herbal liqueur$q$),
(197, $q$Fruit Whisky Liqueur$q$, $q$Whiskey liqueur$q$),
(198, $q$Genepy$q$, $q$Herbal liqueur$q$),
(199, $q$Ginger Liqueur$q$, $q$Liqueur$q$),
(200, $q$Gingerbread Liqueur$q$, $q$Liqueur$q$),
(201, $q$Grape Liqueur$q$, $q$Liqueur$q$),
(202, $q$Green Chile Liqueur$q$, $q$Chile liqueur$q$),
(203, $q$Green Tea Liqueur$q$, $q$Liqueur$q$),
(204, $q$Green Tea Ume-Shu$q$, $q$Umeshu$q$),
(205, $q$Hazelnut Liqueur$q$, $q$Liqueur$q$),
(206, $q$Herbal Liqueur$q$, $q$Liqueur$q$),
(207, $q$Hibiscus Liqueur$q$, $q$Liqueur$q$),
(208, $q$Hierba Luisa Liqueur$q$, $q$Herbal liqueur$q$),
(209, $q$Hojicha Liqueur$q$, $q$Green tea liqueur$q$),
(210, $q$Honey Ginger Liqueur$q$, $q$Ginger liqueur$q$),
(211, $q$Honey Liqueur$q$, $q$Liqueur$q$),
(212, $q$Irish Cream Liqueur$q$, $q$Cream liqueur$q$),
(213, $q$Irish Whisky Liqueur$q$, $q$Whiskey liqueur$q$),
(214, $q$Italian Bergamot Liqueur$q$, $q$Bergamot liqueur$q$),
(215, $q$Japanese Yomogi Herb Liqueur$q$, $q$Herbal liqueur$q$),
(216, $q$Jasmine Liqueur$q$, $q$Liqueur$q$),
(217, $q$Kiwi Liqueur$q$, $q$Liqueur$q$),
(218, $q$Kümmel$q$, $q$Liqueur$q$),
(219, $q$Kumquat Liqueur$q$, $q$Citrus liqueur$q$),
(220, $q$Li-Chi Liqueur$q$, $q$Lychee liqueur$q$),
(221, $q$Limoncello$q$, $q$Liqueur$q$),
(222, $q$Lingonberry Liqueur$q$, $q$Berry liqueur$q$),
(223, $q$Liqueur de Pomme Verte$q$, $q$Apple liqueur$q$),
(224, $q$Liquorice Liqueur$q$, $q$Liqueur$q$),
(225, $q$Lychee Liqueur$q$, $q$Liqueur$q$),
(226, $q$Mandarin Liqueur$q$, $q$Citrus liqueur$q$),
(227, $q$Mandarin Triple Sec$q$, $q$Triple sec$q$),
(228, $q$Mandarino$q$, $q$Citrus liqueur$q$),
(229, $q$Mango Liqueur$q$, $q$Liqueur$q$),
(230, $q$Maraschino Liqueur$q$, $q$Liqueur$q$),
(231, $q$Mastica$q$, $q$Mastiha$q$),
(232, $q$Mastiha$q$, $q$Liqueur$q$),
(233, $q$Matcha Liqueur$q$, $q$Liqueur$q$),
(234, $q$Mediterranean Herb Liqueur$q$, $q$Herbal liqueur$q$),
(235, $q$Melon Liqueur$q$, $q$Liqueur$q$),
(236, $q$Milk Liqueur$q$, $q$Cream liqueur$q$),
(237, $q$Mure$q$, $q$Crème de mûre$q$),
(238, $q$Muscat Liqueur$q$, $q$Liqueur$q$),
(239, $q$Nocino$q$, $q$Liqueur$q$),
(240, $q$Orange Bitter Liqueur$q$, $q$Orange liqueur$q$),
(241, $q$Orange Liqueur$q$, $q$Liqueur$q$),
(242, $q$Pacharán$q$, $q$Liqueur$q$),
(243, $q$Pamplemousse Liqueur$q$, $q$Liqueur$q$),
(244, $q$Pandan Liqueur$q$, $q$Liqueur$q$),
(245, $q$Parfait Amour$q$, $q$Liqueur$q$),
(246, $q$Pasita$q$, $q$Liqueur$q$),
(247, $q$Passion Fruit Liqueur$q$, $q$Liqueur$q$),
(248, $q$Passionfruit Liquor$q$, $q$Passion fruit liqueur$q$),
(249, $q$Peach Aperitif$q$, $q$Peach liqueur$q$),
(250, $q$Peach Liqueur$q$, $q$Liqueur$q$),
(251, $q$Peach Liquor$q$, $q$Peach liqueur$q$),
(252, $q$Peach Schnapps Liqueur$q$, $q$Peach liqueur$q$),
(253, $q$Pear Liqueur$q$, $q$Liqueur$q$),
(254, $q$Pear Liquor$q$, $q$Pear liqueur$q$),
(255, $q$Peppermint Schnapps$q$, $q$Schnapps$q$),
(256, $q$Pineapple Liqueur$q$, $q$Liqueur$q$),
(257, $q$Pistacchio Cream Liqueur$q$, $q$Cream liqueur$q$),
(258, $q$Pistachio Liqueur$q$, $q$Liqueur$q$),
(259, $q$Plum Liqueur$q$, $q$Liqueur$q$),
(260, $q$Pomegranate Aperitif$q$, $q$Pomegranate liqueur$q$),
(261, $q$Pomegranate Liqueur$q$, $q$Liqueur$q$),
(262, $q$Pumpkin Liqueur$q$, $q$Liqueur$q$),
(263, $q$Quince Liqueur$q$, $q$Liqueur$q$),
(264, $q$Raspberry Liqueur$q$, $q$Liqueur$q$),
(265, $q$Ratafia$q$, $q$Liqueur$q$),
(266, $q$Ratafia Barbera$q$, $q$Ratafia$q$),
(267, $q$Rhubarb Liqueur$q$, $q$Liqueur$q$),
(268, $q$Root Beer Liqueur$q$, $q$Liqueur$q$),
(269, $q$Rose Liqueur$q$, $q$Liqueur$q$),
(270, $q$Rosemary Liqueur$q$, $q$Herbal liqueur$q$),
(271, $q$Rosolio di Bergamotto$q$, $q$Bergamot liqueur$q$),
(272, $q$Ruby Cacao$q$, $q$Crème de cacao$q$),
(273, $q$Salted Caramel Irish Cream$q$, $q$Cream liqueur$q$),
(274, $q$Sambuca$q$, $q$Liqueur$q$),
(275, $q$Sardinian Mirto$q$, $q$Liqueur$q$),
(276, $q$Schnapps$q$, $q$Liqueur$q$),
(277, $q$Scotch Liqueur$q$, $q$Whiskey liqueur$q$),
(278, $q$Sea Buckthorn Liqueur$q$, $q$Liqueur$q$),
(279, $q$Shiso Liqueur$q$, $q$Herbal liqueur$q$),
(280, $q$Sloe Gin$q$, $q$Liqueur$q$),
(281, $q$Smoked Pineapple Liqueur$q$, $q$Pineapple liqueur$q$),
(282, $q$Smoked Tea Liqueur$q$, $q$Black tea liqueur$q$),
(283, $q$Sour Apple Liqueur$q$, $q$Apple liqueur$q$),
(284, $q$Sour Orange Liqueur$q$, $q$Orange liqueur$q$),
(285, $q$Spice Liqueur$q$, $q$Liqueur$q$),
(286, $q$Spiced Dram$q$, $q$Allspice dram$q$),
(287, $q$Spiced Pear Liqueur$q$, $q$Pear liqueur$q$),
(288, $q$Strawberry Liqueur$q$, $q$Liqueur$q$),
(289, $q$Swedish Punsch$q$, $q$Liqueur$q$),
(290, $q$Sweet Potato Liqueur$q$, $q$Liqueur$q$),
(291, $q$Thyme Liqueur$q$, $q$Herbal liqueur$q$),
(292, $q$Triple Sec$q$, $q$Orange liqueur$q$),
(293, $q$Umeshu$q$, $q$Liqueur$q$),
(294, $q$Vanilla Liqueur$q$, $q$Liqueur$q$),
(295, $q$Vanilla-Anise Liqueur$q$, $q$Herbal liqueur$q$),
(296, $q$Verbena Liqueur$q$, $q$Herbal liqueur$q$),
(297, $q$Wakayama Plum Liqueur$q$, $q$Umeshu$q$),
(298, $q$Watermelon Liqueur$q$, $q$Melon liqueur$q$),
(299, $q$Whiskey Liqueur$q$, $q$Liqueur$q$),
(300, $q$White Chocolate Liqueur$q$, $q$Chocolate liqueur$q$),
(301, $q$White Crème de Cacao$q$, $q$Crème de cacao$q$),
(302, $q$White Peach Liqueur$q$, $q$Peach liqueur$q$),
(303, $q$Wild Fennel Liqueur$q$, $q$Herbal liqueur$q$),
(304, $q$Xtabentún$q$, $q$Anisette$q$),
(305, $q$Yogurt Liqueur$q$, $q$Cream liqueur$q$),
(306, $q$Yolixpa$q$, $q$Herbal liqueur$q$),
(307, $q$Yubari Melon Liqueur$q$, $q$Melon liqueur$q$),
(308, $q$Yuzu Sake$q$, $q$Yuzushu$q$),
(309, $q$Yuzucello$q$, $q$Citrus liqueur$q$),
(310, $q$Yuzushu$q$, $q$Liqueur$q$),
(311, $q$Liqueur$q$, NULL),
(312, $q$Amaro$q$, $q$Liqueur$q$),
(313, $q$Fernet$q$, $q$Amaro$q$),
(314, $q$Rabarbaro$q$, $q$Amaro$q$),
(315, $q$Amaro Alpino$q$, $q$Amaro$q$),
(316, $q$Artichoke Amaro$q$, $q$Amaro$q$),
(317, $q$Fruit Amaro$q$, $q$Amaro$q$),
(318, $q$Bitter Aperitivo$q$, $q$Liqueur$q$),
(319, $q$Bittersweet Orange Aperitivo$q$, $q$Bitter aperitivo$q$),
(320, $q$Bitter Bianco$q$, $q$Bitter aperitivo$q$),
(321, $q$Gentian Aperitif$q$, $q$Liqueur$q$),
(322, $q$Vermouth$q$, $q$Aromatised wine$q$),
(323, $q$Sweet Vermouth$q$, $q$Vermouth$q$),
(324, $q$Dry Vermouth$q$, $q$Vermouth$q$),
(325, $q$Bianco Vermouth$q$, $q$Vermouth$q$),
(326, $q$Rosé Vermouth$q$, $q$Vermouth$q$),
(327, $q$Ambrato Vermouth$q$, $q$Bianco vermouth$q$),
(328, $q$Quinquina$q$, $q$Aromatised wine$q$),
(329, $q$Chinato$q$, $q$Quinquina$q$),
(330, $q$Americano Aperitif Wine$q$, $q$Aromatised wine$q$),
(331, $q$Vino Amaro$q$, $q$Aromatised wine$q$),
(332, $q$Aromatised Wine$q$, NULL),
(333, $q$Absinthe Bitters$q$, $q$Bitters$q$),
(334, $q$Almond Bitters$q$, $q$Bitters$q$),
(335, $q$Alpine Bitters$q$, $q$Bitters$q$),
(336, $q$Apple Bitters$q$, $q$Bitters$q$),
(337, $q$Aromatic and Chocolate Bitter$q$, $q$Bitters$q$),
(338, $q$Aromatic Bitters$q$, $q$Bitters$q$),
(339, $q$Barbecue Bitters$q$, $q$Bitters$q$),
(340, $q$Barrel-Aged Bitters$q$, $q$Aromatic bitters$q$),
(341, $q$Bay Leaf Bitters$q$, $q$Bitters$q$),
(342, $q$Black Hazelnut Bitters$q$, $q$Bitters$q$),
(343, $q$Black Lemon Bitters$q$, $q$Lemon bitters$q$),
(344, $q$Black Walnut Bitters$q$, $q$Bitters$q$),
(345, $q$Cacao & Macadamia Bitters$q$, $q$Chocolate bitters$q$),
(346, $q$Cardamom Bitters$q$, $q$Bitters$q$),
(347, $q$Caribbean Bitters$q$, $q$Bitters$q$),
(348, $q$Celery Bitters$q$, $q$Bitters$q$),
(349, $q$Celery Shrub Bitters$q$, $q$Celery bitters$q$),
(350, $q$Celery-Lime Bitters$q$, $q$Celery bitters$q$),
(351, $q$Cherry Bitters$q$, $q$Bitters$q$),
(352, $q$Cherry-Vanilla Bitters$q$, $q$Cherry bitters$q$),
(353, $q$Chicory Pecan Bitters$q$, $q$Bitters$q$),
(354, $q$Chocolate & Walnut Bitters$q$, $q$Chocolate bitters$q$),
(355, $q$Chocolate Bitters$q$, $q$Bitters$q$),
(356, $q$Chocolate Chili Bitters$q$, $q$Chocolate bitters$q$),
(357, $q$Cilantro Bitters$q$, $q$Bitters$q$),
(358, $q$Cinnamon Bitters$q$, $q$Bitters$q$),
(359, $q$Citrus Bitters$q$, $q$Bitters$q$),
(360, $q$Clementine Bitter$q$, $q$Citrus bitters$q$),
(361, $q$Coffee Bitters$q$, $q$Bitters$q$),
(362, $q$Cola Bitters$q$, $q$Bitters$q$),
(363, $q$Coriander Bitters$q$, $q$Bitters$q$),
(364, $q$Cranberry Bitters$q$, $q$Bitters$q$),
(365, $q$Creole Bitters$q$, $q$Bitters$q$),
(366, $q$Cucumber Bitters$q$, $q$Bitters$q$),
(367, $q$Grand Bitters$q$, $q$Bitters$q$),
(368, $q$Grapefruit Bitters$q$, $q$Bitters$q$),
(369, $q$Habanero Bitters$q$, $q$Bitters$q$),
(370, $q$Herbal Bitters$q$, $q$Bitters$q$),
(371, $q$Hibiscus Bitters$q$, $q$Bitters$q$),
(372, $q$Hinoki Bitters$q$, $q$Bitters$q$),
(373, $q$Hot Bitters$q$, $q$Spicy bitters$q$),
(374, $q$Jalapeño Bitters$q$, $q$Spicy bitters$q$),
(375, $q$Japanese Bitters$q$, $q$Bitters$q$),
(376, $q$Jasmine Bitters$q$, $q$Bitters$q$),
(377, $q$Jerk Bitters$q$, $q$Bitters$q$),
(378, $q$Juniper Bitters$q$, $q$Bitters$q$),
(379, $q$Lapsang Bitters$q$, $q$Bitters$q$),
(380, $q$Lavender Bitters$q$, $q$Bitters$q$),
(381, $q$Lemon Bitters$q$, $q$Citrus bitters$q$),
(382, $q$Lime Bitters$q$, $q$Citrus bitters$q$),
(383, $q$Liquorice Bitters$q$, $q$Bitters$q$),
(384, $q$Mandarin Bitters$q$, $q$Bitters$q$),
(385, $q$Maraschino Bitters$q$, $q$Cherry bitters$q$),
(386, $q$Margarita Bitters$q$, $q$Bitters$q$),
(387, $q$Marmalade Bitters$q$, $q$Orange bitters$q$),
(388, $q$Matcha Bitters$q$, $q$Bitters$q$),
(389, $q$Mint Bitters$q$, $q$Bitters$q$),
(390, $q$Mole Negro Bitters$q$, $q$Chocolate bitters$q$),
(391, $q$N.A. Bitters$q$, $q$Bitters$q$),
(392, $q$Non-Alcoholic White Flower Bitters$q$, $q$N.A. bitters$q$),
(393, $q$Olive Bitters$q$, $q$Bitters$q$),
(394, $q$Orange Bitter$q$, $q$Orange bitters$q$),
(395, $q$Orange Bitters$q$, $q$Bitters$q$),
(396, $q$Orange Blossom Bitters$q$, $q$Bitters$q$),
(397, $q$Patisserie Bitters$q$, $q$Bitters$q$),
(398, $q$Peach Bitters$q$, $q$Bitters$q$),
(399, $q$Pear Bitters$q$, $q$Bitters$q$),
(400, $q$Peppermint Bitters$q$, $q$Bitters$q$),
(401, $q$Pine Bitters$q$, $q$Bitters$q$),
(402, $q$Plum Bitter$q$, $q$Plum bitters$q$),
(403, $q$Plum Bitters$q$, $q$Bitters$q$),
(404, $q$Rhubarb Bitters$q$, $q$Bitters$q$),
(405, $q$Root Beer Bitters$q$, $q$Bitters$q$),
(406, $q$Rye Bitters$q$, $q$Bitters$q$),
(407, $q$Saffron Bitters$q$, $q$Bitters$q$),
(408, $q$Sakura Bitters$q$, $q$Bitters$q$),
(409, $q$Salted Olive Bitters$q$, $q$Olive bitters$q$),
(410, $q$Scrappy's Orleans Bitters$q$, $q$Creole bitters$q$),
(411, $q$Sea Salt Bitters$q$, $q$Bitters$q$),
(412, $q$Shiso Bitter$q$, $q$Bitters$q$),
(413, $q$Shiso Bitters$q$, $q$Bitters$q$),
(414, $q$Sichuan Bitters$q$, $q$Spicy bitters$q$),
(415, $q$Smoky Bitters$q$, $q$Bitters$q$),
(416, $q$Spiced Bitters$q$, $q$Bitters$q$),
(417, $q$Spiced Cherry Bitters$q$, $q$Cherry bitters$q$),
(418, $q$Spicy Bitters$q$, $q$Bitters$q$),
(419, $q$Spicy Ginger Bitters$q$, $q$Bitters$q$),
(420, $q$Spicy Jerk Bitters$q$, $q$Jerk bitters$q$),
(421, $q$Strawberry Bitters$q$, $q$Bitters$q$),
(422, $q$Thai Bitters$q$, $q$Bitters$q$),
(423, $q$Tiki Bitters$q$, $q$Bitters$q$),
(424, $q$Toasted Almond Bitters$q$, $q$Almond bitters$q$),
(425, $q$Tobacco Bitters$q$, $q$Bitters$q$),
(426, $q$Tonka Bitters$q$, $q$Bitters$q$),
(427, $q$Transatlantic Bitters$q$, $q$Bitters$q$),
(428, $q$Umami Bitters$q$, $q$Bitters$q$),
(429, $q$Vanilla Bitters$q$, $q$Bitters$q$),
(430, $q$Wattle Seed Bitters$q$, $q$Bitters$q$),
(431, $q$Wattleseed Bitters$q$, $q$Bitters$q$),
(432, $q$Wormwood Bitters$q$, $q$Bitters$q$),
(433, $q$Yuzu Bitters$q$, $q$Bitters$q$),
(434, $q$Bitters$q$, NULL),
(435, $q$Alcohol-Free Botanical Distillate$q$, $q$Non-alcoholic botanical spirit$q$),
(436, $q$Dealcoholized Tequila$q$, $q$Non-alcoholic agave spirit$q$),
(437, $q$Dealcoholized Whiskey$q$, $q$Non-alcoholic whiskey$q$),
(438, $q$N.A. Bourbon$q$, $q$Non-alcoholic whiskey$q$),
(439, $q$N.A. Coffee Liqueur$q$, $q$Non-alcoholic spirit$q$),
(440, $q$N.A. Rum$q$, $q$Non-alcoholic spirit$q$),
(441, $q$Non Alc Pineapple Spirit$q$, $q$Non-alcoholic spirit$q$),
(442, $q$Non-Alcoholic Agave Spirit$q$, $q$Non-alcoholic spirit$q$),
(443, $q$Non-Alcoholic Amaretto$q$, $q$Non-alcoholic spirit$q$),
(444, $q$Non-Alcoholic Amaro$q$, $q$Non-alcoholic spirit$q$),
(445, $q$Non-Alcoholic Aperitif$q$, $q$Non-alcoholic spirit$q$),
(446, $q$Non-Alcoholic Bitter$q$, $q$Non-alcoholic aperitif$q$),
(447, $q$Non-alcoholic Botanical Spirit$q$, $q$Non-alcoholic spirit$q$),
(448, $q$Non-Alcoholic Cherry Amaro$q$, $q$Non-alcoholic amaro$q$),
(449, $q$Non-Alcoholic Dark Cane Spirit$q$, $q$N.A. rum$q$),
(450, $q$Non-Alcoholic Falernum$q$, $q$Non-alcoholic spirit$q$),
(451, $q$Non-alcoholic Gin$q$, $q$Non-alcoholic spirit$q$),
(452, $q$Non-Alcoholic Hemp Spirit$q$, $q$Non-alcoholic spirit$q$),
(453, $q$Non-Alcoholic Malt Spirit$q$, $q$Non-alcoholic whiskey$q$),
(454, $q$Non-Alcoholic Peach Amaro$q$, $q$Non-alcoholic amaro$q$),
(455, $q$Non-Alcoholic Rosso Aperitif$q$, $q$Non-alcoholic aperitif$q$),
(456, $q$Non-Alcoholic Tequila$q$, $q$Non-alcoholic agave spirit$q$),
(457, $q$Non-Alcoholic Tobala Agave Distillate$q$, $q$Non-alcoholic agave spirit$q$),
(458, $q$Non-Alcoholic Vermouth$q$, $q$Non-alcoholic aperitif$q$),
(459, $q$Non-Alcoholic Whiskey$q$, $q$Non-alcoholic spirit$q$),
(460, $q$Spirit-Free Amaro$q$, $q$Non-alcoholic amaro$q$),
(461, $q$Zero Proof Gin$q$, $q$Non-alcoholic gin$q$),
(462, $q$Zero Proof Tequila$q$, $q$Non-alcoholic agave spirit$q$),
(463, $q$Non-alcoholic Spirit$q$, $q$Non-alcoholic drink$q$),
(464, $q$Australian Cane Spirit$q$, $q$Rum$q$),
(465, $q$Non-alcoholic Vodka$q$, $q$Non-alcoholic Spirit$q$);

CREATE TEMP TABLE "made_now" ("id" uuid PRIMARY KEY);
DO $$
DECLARE s record; v uuid;
BEGIN
    FOR s IN SELECT * FROM style_in ORDER BY ord LOOP
        IF pg_temp.style(s.name) IS NULL AND pg_temp.shared(s.name) IS NULL THEN
            INSERT INTO public.items (name, item_type, ingredient_role, hide_from_search)
            VALUES (s.name, 'ingredient', 'generic', false) RETURNING id INTO v;
            INSERT INTO made_now VALUES (v);
            -- A new name can pick up a core suffix as its kind; set it as meant.
            UPDATE public.items SET generic_id = pg_temp.style(s.kind_of)
             WHERE id = v AND generic_id IS DISTINCT FROM pg_temp.style(s.kind_of);
        END IF;
    END LOOP;
END $$;

-- Place styles a bottle already filed under keeps, when the check gives only
-- the catch-all style.
CREATE TEMP TABLE place_in (name text PRIMARY KEY);
INSERT INTO place_in VALUES
($q$Australian Whisky$q$),
($q$Tasmanian Whisky$q$),
($q$Australian Gin$q$),
($q$Australian Vodka$q$),
($q$Australian Rum$q$),
($q$Tasmanian Aquavit$q$),
($q$Australian Aperitivo$q$),
($q$Pink Gin$q$),
($q$London Dry Gin$q$),
($q$Flavoured Gin$q$),
($q$Oyster Shell Gin$q$),
($q$Navy Strength Gin$q$),
($q$Old Tom Gin$q$),
($q$Aged Gin$q$);

-- ---------------------------------------------------------------------------
-- Maker pages
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, part_of text);
INSERT INTO maker_in VALUES
($q$Adams Distillery$q$, $q$adams.distillery$q$, $q$https://www.adamsdistillery.com.au$q$, $q$AU$q$, NULL),
($q$Bancroft Bay Distillery$q$, $q$bancroft.bay.distillery$q$, $q$https://www.bancroftbaydistillery.com/$q$, $q$AU$q$, NULL),
($q$Beachtree Distilling Co.$q$, $q$beachtree.distilling.co$q$, $q$https://www.beachtree.com.au$q$, $q$AU$q$, NULL),
($q$Burly$q$, $q$burly$q$, NULL, $q$AU$q$, NULL),
($q$Cabarita Spirits Co$q$, $q$cabarita.spirits.co$q$, $q$https://www.cabaritaspirits.com$q$, $q$AU$q$, NULL),
($q$Callington Mill Distillery$q$, $q$callington.mill.distillery$q$, $q$https://callingtonmilldistillery.com$q$, $q$AU$q$, NULL),
($q$Capricorn Distilling Co.$q$, $q$capricorn.distilling.co$q$, $q$https://www.capricorndistilling.com$q$, $q$AU$q$, NULL),
($q$Cauldron Distillery$q$, $q$cauldron.distillery$q$, $q$https://www.cauldrondistillery.com.au$q$, $q$AU$q$, NULL),
($q$Causes & Cures$q$, $q$causes.cures$q$, NULL, $q$AU$q$, NULL),
($q$Clyde Mill Distillery$q$, $q$clyde.mill.distillery$q$, $q$https://clydemill.com.au$q$, $q$AU$q$, NULL),
($q$DNA Distillery$q$, $q$dna.distillery$q$, $q$https://www.dnadistillery.com$q$, $q$AU$q$, NULL),
($q$Darwin Distilling Co.$q$, $q$darwin.distilling.co$q$, $q$https://darwindistillingco.com.au$q$, $q$AU$q$, NULL),
($q$FNQ Spirits$q$, $q$fnq.spirits$q$, $q$https://crocpiss.com.au$q$, $q$AU$q$, NULL),
($q$Falls Creek Distillery$q$, $q$falls.creek.distillery$q$, $q$https://fallscreekdistillery.com.au/$q$, $q$AU$q$, NULL),
($q$Foxdog Distillery$q$, $q$foxdog.distillery$q$, $q$https://www.foxdogdistillery.com.au$q$, $q$AU$q$, NULL),
($q$Goodradigbee Distillers$q$, $q$goodradigbee.distillers$q$, $q$https://www.goodradigbee.com$q$, $q$AU$q$, NULL),
($q$Grada$q$, $q$grada$q$, NULL, $q$AU$q$, NULL),
($q$Grainshaker$q$, $q$grainshaker$q$, $q$https://shop.grainshaker.com.au$q$, $q$AU$q$, NULL),
($q$Haiver Spirits$q$, $q$haiver.spirits$q$, $q$https://www.haiverspirits.com.au$q$, $q$AU$q$, NULL),
($q$Herding Cats$q$, $q$herding.cats$q$, $q$https://tamburlaine.com.au/collections/herding-cats$q$, $q$AU$q$, NULL),
($q$Hermetica$q$, $q$hermetica$q$, $q$https://hermeticadistillery.com/$q$, $q$AU$q$, NULL),
($q$Hillman Bros.$q$, $q$hillman.bros$q$, $q$https://www.hillmanbros.com.au$q$, $q$AU$q$, NULL),
($q$Hunnington Distillery$q$, $q$hunnington.distillery$q$, $q$https://hunningtondistillery.com.au$q$, $q$AU$q$, NULL),
($q$Iniquity$q$, $q$iniquity$q$, $q$https://www.tinsheddistillingco.com.au$q$, $q$AU$q$, NULL),
($q$Ladbroken Distilling Co.$q$, $q$ladbroken.distilling.co$q$, $q$https://ladbroken.com.au$q$, $q$AU$q$, NULL),
($q$Lake Meran Brewery & Distillery$q$, $q$lake.meran.brewery.distillery$q$, $q$https://www.lakemeranbrewery.com.au$q$, $q$AU$q$, NULL),
($q$Lily Fields Distilling Co$q$, $q$lily.fields.distilling.co$q$, NULL, $q$AU$q$, NULL),
($q$Loam Distillery$q$, $q$loam.distillery$q$, $q$https://www.loamdistillery.com.au$q$, $q$AU$q$, NULL),
($q$Manly Spirits Co.$q$, $q$manly.spirits.co$q$, $q$https://www.manlyspirits.com.au$q$, $q$AU$q$, NULL),
($q$Mrs Baker's Still House$q$, $q$mrs.baker.s.still.house$q$, $q$https://www.mrsbakers.com.au/$q$, $q$AU$q$, NULL),
($q$Naturi Vermouth$q$, $q$naturi.vermouth$q$, NULL, $q$AU$q$, NULL),
($q$Newy Distillery$q$, $q$newy.distillery$q$, $q$https://newydistillery.com.au$q$, $q$AU$q$, NULL),
($q$Nuvé$q$, $q$nuve$q$, $q$https://nuvevodka.com.au$q$, $q$AU$q$, NULL),
($q$Old Kempton Distillery$q$, $q$old.kempton.distillery$q$, $q$https://oldkemptondistillery.com.au$q$, $q$AU$q$, NULL),
($q$Old Young's$q$, $q$old.young.s$q$, $q$https://oldyoungs.com.au$q$, $q$AU$q$, NULL),
($q$Otter Craft Distilling$q$, $q$otter.craft.distilling$q$, $q$https://ocdistilling.com$q$, $q$AU$q$, NULL),
($q$Penni Ave Distillery$q$, $q$penni.ave.distillery$q$, $q$https://www.penniave.com.au$q$, $q$AU$q$, NULL),
($q$Pluto Spirits$q$, $q$pluto.spirits$q$, $q$https://www.plutospirits.com$q$, $q$AU$q$, NULL),
($q$Polka$q$, $q$polka$q$, $q$https://polkadrops.com.au$q$, $q$AU$q$, NULL),
($q$Pomona Distilling Co.$q$, $q$pomona.distilling.co$q$, $q$https://www.pomonadistilling.com.au$q$, $q$AU$q$, NULL),
($q$Port Phillip Distillery$q$, $q$port.phillip.distillery$q$, $q$https://portphillipdistillery.com/$q$, $q$AU$q$, NULL),
($q$Reform Distilling$q$, $q$reform.distilling$q$, $q$https://rfrm.com.au/$q$, $q$AU$q$, NULL),
($q$Running With Thieves$q$, $q$running.with.thieves$q$, $q$https://runningwiththieves.com$q$, $q$AU$q$, NULL),
($q$SOLLOS$q$, $q$sollos$q$, $q$https://sollosagave.com.au$q$, $q$AU$q$, NULL),
($q$Saltbeard Distillery$q$, $q$saltbeard.distillery$q$, $q$https://www.saltbeard.com.au$q$, $q$AU$q$, NULL),
($q$Sanyou$q$, $q$sanyou$q$, $q$https://sanyou.com.au$q$, $q$AU$q$, NULL),
($q$Sarina Sugar Shed$q$, $q$sarina.sugar.shed$q$, $q$https://www.sarinasugarshed.com.au$q$, $q$AU$q$, NULL),
($q$Seven Seasons$q$, $q$seven.seasons$q$, NULL, $q$AU$q$, NULL),
($q$Side Hustle Distillery$q$, $q$side.hustle.distillery$q$, $q$https://www.sheppartonbrewery.com.au/collections/side-hustle-distillery$q$, $q$AU$q$, NULL),
($q$Solbevi$q$, $q$solbevi$q$, $q$https://www.solbevi.com$q$, $q$AU$q$, NULL),
($q$Soltera Rum$q$, $q$soltera.rum$q$, $q$https://www.cabaritaspirits.com$q$, $q$AU$q$, NULL),
($q$Spirit of Little Things$q$, $q$spirit.of.little.things$q$, NULL, $q$AU$q$, NULL),
($q$Storytellers Distillery$q$, $q$storytellers.distillery$q$, $q$https://www.storytellersdistillery.com.au$q$, $q$AU$q$, NULL),
($q$The Canberra Distillery$q$, $q$the.canberra.distillery$q$, $q$https://thecanberradistillery.com.au$q$, $q$AU$q$, NULL),
($q$The Grove Distillery$q$, $q$the.grove.distillery$q$, $q$https://thegrovedistillery.com.au$q$, $q$AU$q$, NULL),
($q$The Spirit Collective$q$, $q$the.spirit.collective$q$, $q$https://www.spiritcollective.com.au$q$, $q$AU$q$, NULL),
($q$Three Chain Road$q$, $q$three.chain.road$q$, $q$https://bullerwines.com.au/pages/three-chain-road-distillery$q$, $q$AU$q$, NULL),
($q$Tin Shed Distilling Co$q$, $q$tin.shed.distilling.co$q$, $q$https://www.tinsheddistillingco.com.au$q$, $q$AU$q$, NULL),
($q$Two Cats Distillery$q$, $q$two.cats.distillery$q$, $q$https://www.twocatsdistillery.com.au$q$, $q$AU$q$, NULL),
($q$Vodka O$q$, $q$vodka.o$q$, NULL, $q$AU$q$, NULL),
($q$Wandering Distillery$q$, $q$wandering.distillery$q$, $q$https://www.wanderingdistillery.com.au$q$, $q$AU$q$, NULL),
($q$Western Queensland Spirit$q$, $q$western.queensland.spirit$q$, $q$https://www.westernqueenslandspirit.com$q$, $q$AU$q$, NULL),
($q$White Possum$q$, $q$white.possum$q$, $q$https://whitepossum.com.au$q$, $q$AU$q$, NULL),
($q$Winston Quinn$q$, $q$winston.quinn$q$, $q$https://www.winstonquinn.com.au/$q$, $q$AU$q$, NULL),
($q$Wolfsbane$q$, $q$wolfsbane$q$, $q$https://wolfsbane.com.au$q$, $q$AU$q$, NULL);

-- A page per producer, unclaimed, public. A handle someone already uses is
-- left alone (that producer's bottles then name no maker).
INSERT INTO public.profiles (kind, handle, display_name, website, country_code, makes, is_public)
SELECT 'maker', m.handle, m.name, m.website, m.country, ARRAY[$q$bottles$q$], true
  FROM maker_in m
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = m.handle)
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name));

CREATE FUNCTION pg_temp.maker(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT p.id FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(p_name) LIMIT 1;
$$;

-- A maker page made by an earlier load that now makes bottles here too.
UPDATE public.profiles p SET makes = array_append(p.makes, $q$bottles$q$)
  FROM maker_in m
 WHERE p.id = pg_temp.maker(m.name) AND NOT ($q$bottles$q$ = ANY (p.makes));

UPDATE public.profiles p SET part_of_profile_id = pg_temp.maker(m.part_of)
  FROM maker_in m
 WHERE p.id = pg_temp.maker(m.name) AND m.part_of IS NOT NULL AND pg_temp.maker(m.part_of) IS NOT NULL
   AND p.part_of_profile_id IS DISTINCT FROM pg_temp.maker(m.part_of);

-- ---------------------------------------------------------------------------
-- Bottles
-- ---------------------------------------------------------------------------

-- catalog_name: the row we already have for this bottle, when there is one.
CREATE TEMP TABLE bottle_in (
    label_name text NOT NULL, catalog_name text, style text NOT NULL, producer text NOT NULL,
    abv numeric, country text, gi text, url text NOT NULL, kind text NOT NULL
);
INSERT INTO bottle_in VALUES
($q$Adams Tasmanian Barrel Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Adams Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.adamsdistillery.com.au/collections/shop-gin-collection$q$, $q$producer$q$),
($q$Adams Tasmanian Blueberry & Lavender Gin$q$, NULL, $q$Berry Liqueur$q$, $q$Adams Distillery$q$, 32, $q$AU$q$, NULL, $q$https://www.adamsdistillery.com.au/collections/shop-gin-collection$q$, $q$producer$q$),
($q$Adams Tasmanian Coffee Whisky Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Adams Distillery$q$, 20, $q$AU$q$, NULL, $q$https://www.adamsdistillery.com.au/collections/shop-whisky-collection$q$, $q$producer$q$),
($q$Adams Tasmanian Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Adams Distillery$q$, 45, $q$AU$q$, NULL, $q$https://www.adamsdistillery.com.au/collections/shop-gin-collection$q$, $q$producer$q$),
($q$Adams Tasmanian Single Malt Whisky Signature Series 42%$q$, NULL, $q$Single Malt Whisky$q$, $q$Adams Distillery$q$, 42, $q$AU$q$, NULL, $q$https://www.adamsdistillery.com.au/collections/shop-whisky-collection$q$, $q$producer$q$),
($q$Adams Tasmanian Single Malt Whisky Signature Series 59%$q$, NULL, $q$Single Malt Whisky$q$, $q$Adams Distillery$q$, 59, $q$AU$q$, NULL, $q$https://www.adamsdistillery.com.au/collections/shop-whisky-collection$q$, $q$producer$q$),
($q$Adams Tasmanian Sloe Gin$q$, NULL, $q$Sloe Gin$q$, $q$Adams Distillery$q$, 32, $q$AU$q$, NULL, $q$https://www.adamsdistillery.com.au/collections/shop-gin-collection$q$, $q$producer$q$),
($q$Adams Tasmanian Turbo Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Adams Distillery$q$, 58, $q$AU$q$, NULL, $q$https://www.adamsdistillery.com.au/collections/shop-gin-collection$q$, $q$producer$q$),
($q$Bancroft Bay Orange Blossom Honey Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Bancroft Bay Pear & Walnut Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Bancroft Bay Red Gum Honey Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Boxes Creek Blood Orange Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Caffè Cherry Coffee Cherry Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Chinamans Creek Asian Inspired Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Mosquito Point Añejo Agave Spirit$q$, NULL, $q$Agave Spirit$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Mosquito Point Blanco Agave Spirit$q$, NULL, $q$Agave Spirit$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Mosquito Point Reposado Agave Spirit$q$, NULL, $q$Agave Spirit$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Shaving Point East Gippsland Gin$q$, NULL, $q$Australian Gin$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/products/shaving-point-east-gippsland-gin$q$, $q$producer$q$),
($q$Stirling Limoncello$q$, NULL, $q$Limoncello$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$The Barrier Citrus Vodka$q$, NULL, $q$Citron Vodka$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$The Commodore Navy Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Bancroft Bay Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://bancroftbaydistillery.com/collections/our-range$q$, $q$producer$q$),
($q$Beachtree Barrel Aged Native Plum & Sloe Gin$q$, NULL, $q$Sloe Gin$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Gang Gang Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Native Plum & Sloe Gin$q$, NULL, $q$Sloe Gin$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Organic Cask Aged Australian Rum$q$, NULL, $q$Aged Rum$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Organic Certified Vodka$q$, NULL, $q$Vodka$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Organic Koala Native Citrus Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all/products/organic-koala-gin-australian-citrus$q$, $q$producer$q$),
($q$Beachtree Organic Lemon Myrtle Vodka Liqueur$q$, NULL, $q$Liqueur$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Organic Native Skippy Gin$q$, NULL, $q$Australian Gin$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Organic Quokka Native Berry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Organic Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Beachtree Twilight Blue Gin Liqueur$q$, NULL, $q$Liqueur$q$, $q$Beachtree Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://beachtree.com.au/collections/all$q$, $q$producer$q$),
($q$Burly Citrus Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Burly$q$, 42, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_231607/burly-citrus-gin-700ml$q$, $q$retailer$q$),
($q$Burly Cucumber Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Burly$q$, 42, $q$AU$q$, NULL, $q$https://bws.com.au/product/231605/burly-cucumber-gin-700ml$q$, $q$retailer$q$),
($q$Northern Rivers Pure Single Rum$q$, NULL, $q$Rum$q$, $q$Cabarita Spirits Co$q$, NULL, $q$AU$q$, NULL, $q$https://www.cabaritaspirits.com/collections/soltera-rum$q$, $q$producer$q$),
($q$Northern Rivers Vodka$q$, NULL, $q$Vodka$q$, $q$Cabarita Spirits Co$q$, NULL, $q$AU$q$, NULL, $q$https://www.cabaritaspirits.com/collections/soltera-rum$q$, $q$producer$q$),
($q$Callington Mill El Sol Tasmanian Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Callington Mill Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://callingtonmilldistillery.com/collections/classic-collection$q$, $q$producer$q$),
($q$Callington Mill Enigma Tasmanian Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Callington Mill Distillery$q$, 40, $q$AU$q$, NULL, $q$https://callingtonmilldistillery.com/products/enigma-tasmanian-single-malt-whisky$q$, $q$producer$q$),
($q$Callington Mill Fusion Tasmanian Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Callington Mill Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://callingtonmilldistillery.com/collections/classic-collection$q$, $q$producer$q$),
($q$Callington Mill Invicta Tasmanian Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Callington Mill Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://callingtonmilldistillery.com/collections/classic-collection$q$, $q$producer$q$),
($q$Callington Mill Oloroso Tasmanian Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Callington Mill Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://callingtonmilldistillery.com/collections/classic-collection$q$, $q$producer$q$),
($q$Callington Mill Pedro Ximenez Tasmanian Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Callington Mill Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://callingtonmilldistillery.com/collections/classic-collection$q$, $q$producer$q$),
($q$Poltergeist Barrel Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Callington Mill Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://callingtonmilldistillery.com/collections/gin$q$, $q$producer$q$),
($q$Poltergeist Unfiltered Gin$q$, NULL, $q$Australian Gin$q$, $q$Callington Mill Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://callingtonmilldistillery.com/collections/gin$q$, $q$producer$q$),
($q$Capricorn Coffee Rum$q$, NULL, $q$Rum$q$, $q$Capricorn Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://capricorndistilling.com/$q$, $q$producer$q$),
($q$Capricorn Oak Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Capricorn Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://capricorndistilling.com/$q$, $q$producer$q$),
($q$Capricorn Old Tom Gin$q$, NULL, $q$Old Tom Gin$q$, $q$Capricorn Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://capricorndistilling.com/$q$, $q$producer$q$),
($q$Capricorn Pineapple Rum$q$, NULL, $q$Pineapple Rum$q$, $q$Capricorn Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://capricorndistilling.com/$q$, $q$producer$q$),
($q$Capricorn Reserve Barrel Rum$q$, NULL, $q$Aged Rum$q$, $q$Capricorn Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://capricorndistilling.com/$q$, $q$producer$q$),
($q$Capricorn Salted Caramel Rum Liqueur$q$, NULL, $q$Liqueur$q$, $q$Capricorn Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://capricorndistilling.com/$q$, $q$producer$q$),
($q$Capricorn Spiced Rum$q$, NULL, $q$Spiced Rum$q$, $q$Capricorn Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://capricorndistilling.com/$q$, $q$producer$q$),
($q$Capricorn Strawberry Fields Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Capricorn Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://capricorndistilling.com/$q$, $q$producer$q$),
($q$Capricorn Summer Gin$q$, NULL, $q$Australian Gin$q$, $q$Capricorn Distilling Co.$q$, 42, $q$AU$q$, NULL, $q$https://capricorndistilling.com/products/capricorn-summer-gin$q$, $q$producer$q$),
($q$Cauldron Blanco (Lime, Chilli & Saltbush) Australian Agave Spirit$q$, NULL, $q$Agave Spirit$q$, $q$Cauldron Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/collections/australian-agave/products/blanco-lime-chilli-saltbush-australian-agave$q$, $q$producer$q$),
($q$Cauldron Citrus Fusion Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Cauldron Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/products/citrus-fusion-vodka$q$, $q$producer$q$),
($q$Cauldron Coastal Navy Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Cauldron Distillery$q$, 57, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/products/525-gin-700ml$q$, $q$producer$q$),
($q$Cauldron Mediterranean Gin$q$, NULL, $q$Australian Gin$q$, $q$Cauldron Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/products/mediterranean-gin$q$, $q$producer$q$),
($q$Cauldron Mountain Gin$q$, NULL, $q$Australian Gin$q$, $q$Cauldron Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/products/mountain-gin-700ml$q$, $q$producer$q$),
($q$Cauldron Queensland Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Cauldron Distillery$q$, 45, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/products/queensland-single-malt-whisky$q$, $q$producer$q$),
($q$Cauldron Reposado Australian Agave Spirit$q$, NULL, $q$Agave Spirit$q$, $q$Cauldron Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/collections/australian-agave/products/reposado-australian-agave-spirit$q$, $q$producer$q$),
($q$Cauldron Sambuca Della Montagna$q$, NULL, $q$Sambuca$q$, $q$Cauldron Distillery$q$, 38, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/products/sambuca-della-montagna$q$, $q$producer$q$),
($q$Cauldron Sunset Gin$q$, NULL, $q$Australian Gin$q$, $q$Cauldron Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.cauldrondistillery.com.au/products/five-to-five-sunset-gin$q$, $q$producer$q$),
($q$Causes & Cures Semi Dry White Vermouth$q$, NULL, $q$Vermouth$q$, $q$Causes & Cures$q$, 17, $q$AU$q$, NULL, $q$https://lucacollections.com.au/products/causes-cures-semi-dry-white-vermouth$q$, $q$retailer$q$),
($q$Clyde Mill Mill Pond Citrus Gin$q$, NULL, $q$Australian Gin$q$, $q$Clyde Mill Distillery$q$, 40, $q$AU$q$, NULL, $q$https://clydemill.com.au/product/abv-40-vol-700ml-highland-gin-mill-pond-citrus/$q$, $q$producer$q$),
($q$Clyde Mill Mill Pond Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Clyde Mill Distillery$q$, 40, $q$AU$q$, NULL, $q$https://clydemill.com.au/product/abv-40-vol-700ml-highland-gin-millpond-dry/$q$, $q$producer$q$),
($q$Clyde Mill Mill Pond Raspberry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Clyde Mill Distillery$q$, 40, $q$AU$q$, NULL, $q$https://clydemill.com.au/product/abv-40-vol-700ml-highland-gin-mill-pond-raspberry-gin/$q$, $q$producer$q$),
($q$DNA Distillery Classic Rakija$q$, NULL, $q$Grape Eau de Vie$q$, $q$DNA Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.dnadistillery.com/products/rakija-classic$q$, $q$producer$q$),
($q$DNA Distillery Gold Rakija$q$, NULL, $q$Brandy$q$, $q$DNA Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.dnadistillery.com$q$, $q$producer$q$),
($q$DNA Distillery Pear Rakija$q$, NULL, $q$Pear Brandy$q$, $q$DNA Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.dnadistillery.com$q$, $q$producer$q$),
($q$DNA Distillery Plum Rakija$q$, NULL, $q$Plum Brandy$q$, $q$DNA Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.dnadistillery.com$q$, $q$producer$q$),
($q$Darwin Distilling Co. Salty Plum Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Darwin Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://darwindistillingco.com.au/collections/all$q$, $q$producer$q$),
($q$Darwin Distilling Co. Tropical Monsoon Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Darwin Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://darwindistillingco.com.au/collections/all$q$, $q$producer$q$),
($q$Darwin Signature Gin$q$, NULL, $q$Australian Gin$q$, $q$Darwin Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://darwindistillingco.com.au/products/darwin-gin$q$, $q$producer$q$),
($q$Lady of The North Navy Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Darwin Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://darwindistillingco.com.au/collections/all$q$, $q$producer$q$),
($q$The Alice Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Darwin Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://darwindistillingco.com.au/collections/all$q$, $q$producer$q$),
($q$Croc Coffee Espresso Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$FNQ Spirits$q$, 20.6, $q$AU$q$, NULL, $q$https://crocpiss.com.au/product/croc-coffee-700ml/$q$, $q$producer$q$),
($q$Croc Piss Clear$q$, NULL, $q$Spirit$q$, $q$FNQ Spirits$q$, 37, $q$AU$q$, NULL, $q$https://crocpiss.com.au/product/croc-piss-clear-700ml/$q$, $q$producer$q$),
($q$Croc Piss Original$q$, NULL, $q$Spirit$q$, $q$FNQ Spirits$q$, 37, $q$AU$q$, NULL, $q$https://crocpiss.com.au/product/croc-piss-original/$q$, $q$producer$q$),
($q$Croc Vodka$q$, NULL, $q$Vodka$q$, $q$FNQ Spirits$q$, 37, $q$AU$q$, NULL, $q$https://crocpiss.com.au/product/croc-vodka/$q$, $q$producer$q$),
($q$Falls Creek Gin$q$, NULL, $q$Australian Gin$q$, $q$Falls Creek Distillery$q$, 39, $q$AU$q$, NULL, $q$https://fallscreekdistillery.com.au/products/falls-creek-gin$q$, $q$producer$q$),
($q$Falls Creek Vodka$q$, NULL, $q$Vodka$q$, $q$Falls Creek Distillery$q$, 39, $q$AU$q$, NULL, $q$https://fallscreekdistillery.com.au/products/falls-creek-vodka$q$, $q$producer$q$),
($q$Foxdog Mandarin Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Foxdog Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.foxdogdistillery.com.au/products/mandarin-gin$q$, $q$producer$q$),
($q$Foxdog Navy Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Foxdog Distillery$q$, 58, $q$AU$q$, NULL, $q$https://www.foxdogdistillery.com.au/products/navy-strength-gin$q$, $q$producer$q$),
($q$Foxdog Rosella Pink Gin$q$, NULL, $q$Pink Gin$q$, $q$Foxdog Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.foxdogdistillery.com.au/products/rosella-gin$q$, $q$producer$q$),
($q$Foxdog Samphire Gin$q$, NULL, $q$Australian Gin$q$, $q$Foxdog Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.foxdogdistillery.com.au/products/samphire-gin$q$, $q$producer$q$),
($q$Foxdog Signature Gin$q$, NULL, $q$Australian Gin$q$, $q$Foxdog Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.foxdogdistillery.com.au/products/signature-gin$q$, $q$producer$q$),
($q$Foxdog Signature Vodka$q$, NULL, $q$Vodka$q$, $q$Foxdog Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.foxdogdistillery.com.au/products/signature-vodka$q$, $q$producer$q$),
($q$Foxdog Vanilla Vodka$q$, NULL, $q$Vanilla Vodka$q$, $q$Foxdog Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.foxdogdistillery.com.au/products/vanilla-vodka$q$, $q$producer$q$),
($q$Goodradigbee Blackwood Aged Rum$q$, NULL, $q$Aged Rum$q$, $q$Goodradigbee Distillers$q$, 44, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/blackwood-aged-goodradigbee-rum$q$, $q$producer$q$),
($q$Goodradigbee Blackwood Aged Spiced Rum$q$, NULL, $q$Spiced Rum$q$, $q$Goodradigbee Distillers$q$, 44, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/blackwood-aged-spiced-rum$q$, $q$producer$q$),
($q$Goodradigbee Coastal Spice Gin$q$, NULL, $q$Australian Gin$q$, $q$Goodradigbee Distillers$q$, 43, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/coastal-spice-gin$q$, $q$producer$q$),
($q$Goodradigbee Dawn to Dusk Malt Whisky$q$, NULL, $q$Whiskey$q$, $q$Goodradigbee Distillers$q$, 48, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/dawn-to-dusk-malt$q$, $q$producer$q$),
($q$Goodradigbee Finger Lime Cello$q$, NULL, $q$Citrus Liqueur$q$, $q$Goodradigbee Distillers$q$, 30, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/finger-lime-cello$q$, $q$producer$q$),
($q$Goodradigbee Freshwater Blush Gin$q$, NULL, $q$Pink Gin$q$, $q$Goodradigbee Distillers$q$, 43, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/freshwater-blush-gin$q$, $q$producer$q$),
($q$Goodradigbee Freshwater Gin$q$, NULL, $q$Australian Gin$q$, $q$Goodradigbee Distillers$q$, 43, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/freshwater-gin$q$, $q$producer$q$),
($q$Goodradigbee Grey Gum Vodka$q$, NULL, $q$Vodka$q$, $q$Goodradigbee Distillers$q$, 40, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/grey-gum-vodka$q$, $q$producer$q$),
($q$Goodradigbee Ironbark Red Whisky$q$, NULL, $q$Whiskey$q$, $q$Goodradigbee Distillers$q$, 47.5, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/ironbark-red-whisky$q$, $q$producer$q$),
($q$Goodradigbee Ironbark Smoked Whisky$q$, NULL, $q$Whiskey$q$, $q$Goodradigbee Distillers$q$, 48, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/ironbark-smoked-whisky$q$, $q$producer$q$),
($q$Goodradigbee Limoncello$q$, NULL, $q$Limoncello$q$, $q$Goodradigbee Distillers$q$, 30, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/limoncello$q$, $q$producer$q$),
($q$Goodradigbee Orchard Rd Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Goodradigbee Distillers$q$, 41, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/orchard-rd-dry-gin$q$, $q$producer$q$),
($q$Goodradigbee Purpleheart Malt Whisky$q$, NULL, $q$Whiskey$q$, $q$Goodradigbee Distillers$q$, 46, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/purpleheart-malt$q$, $q$producer$q$),
($q$Goodradigbee Red Winter Gin$q$, NULL, $q$Aged Gin$q$, $q$Goodradigbee Distillers$q$, 41, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/red-winter-gin$q$, $q$producer$q$),
($q$Goodradigbee Sweetwater Gin$q$, NULL, $q$Aged Gin$q$, $q$Goodradigbee Distillers$q$, 43, $q$AU$q$, NULL, $q$https://www.goodradigbee.com/products/sweetwater-gin$q$, $q$producer$q$),
($q$Grada Specialty Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Grada$q$, 16, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_6040678/grada-specialty-coffee-liqueur-700ml$q$, $q$retailer$q$),
($q$Grainshaker Citrus Vodka$q$, NULL, $q$Citron Vodka$q$, $q$Grainshaker$q$, NULL, $q$AU$q$, NULL, $q$https://shop.grainshaker.com.au/$q$, $q$producer$q$),
($q$Grainshaker Corn Vodka$q$, NULL, $q$Vodka$q$, $q$Grainshaker$q$, NULL, $q$AU$q$, NULL, $q$https://shop.grainshaker.com.au/$q$, $q$producer$q$),
($q$Grainshaker Raspberry Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Grainshaker$q$, NULL, $q$AU$q$, NULL, $q$https://shop.grainshaker.com.au/$q$, $q$producer$q$),
($q$Grainshaker Rye Vodka$q$, NULL, $q$Rye Vodka$q$, $q$Grainshaker$q$, NULL, $q$AU$q$, NULL, $q$https://shop.grainshaker.com.au/$q$, $q$producer$q$),
($q$Grainshaker Wheat Vodka$q$, NULL, $q$Wheat Vodka$q$, $q$Grainshaker$q$, NULL, $q$AU$q$, NULL, $q$https://shop.grainshaker.com.au/$q$, $q$producer$q$),
($q$Haiver Spirits Botanical Gin$q$, NULL, $q$Australian Gin$q$, $q$Haiver Spirits$q$, 40, $q$AU$q$, NULL, $q$https://www.haiverspirits.com.au/collections/frontpage$q$, $q$producer$q$),
($q$Haiver Spirits Butterscotch Schnapps$q$, NULL, $q$Butterscotch Schnapps$q$, $q$Haiver Spirits$q$, 18, $q$AU$q$, NULL, $q$https://www.haiverspirits.com.au/collections/frontpage$q$, $q$producer$q$),
($q$Haiver Spirits Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Haiver Spirits$q$, 23, $q$AU$q$, NULL, $q$https://www.haiverspirits.com.au/collections/frontpage$q$, $q$producer$q$),
($q$Haiver Spirits Daily Gin$q$, NULL, $q$Australian Gin$q$, $q$Haiver Spirits$q$, 37.5, $q$AU$q$, NULL, $q$https://www.haiverspirits.com.au/collections/frontpage$q$, $q$producer$q$),
($q$Haiver Spirits Double Distilled Vodka$q$, NULL, $q$Vodka$q$, $q$Haiver Spirits$q$, 37.5, $q$AU$q$, NULL, $q$https://www.haiverspirits.com.au/collections/frontpage$q$, $q$producer$q$),
($q$Haiver Spirits Modern Classic Gin$q$, NULL, $q$Australian Gin$q$, $q$Haiver Spirits$q$, 40, $q$AU$q$, NULL, $q$https://www.haiverspirits.com.au/collections/frontpage$q$, $q$producer$q$),
($q$Haiver Spirits Peach Schnapps$q$, NULL, $q$Peach Schnapps Liqueur$q$, $q$Haiver Spirits$q$, 18, $q$AU$q$, NULL, $q$https://www.haiverspirits.com.au/collections/frontpage$q$, $q$producer$q$),
($q$Herding Cats Gin Double Dutch$q$, NULL, $q$Australian Gin$q$, $q$Herding Cats$q$, 45, $q$AU$q$, NULL, $q$https://tamburlaine.com.au/collections/herding-cats/products/herding-cats-gin-double-dutch-700ml-1$q$, $q$producer$q$),
($q$Herding Cats Gin Juiced-up Gin Junkie$q$, NULL, $q$Australian Gin$q$, $q$Herding Cats$q$, NULL, $q$AU$q$, NULL, $q$https://tamburlaine.com.au/collections/herding-cats$q$, $q$producer$q$),
($q$Herding Cats Gin Sunday Bloody Sunday$q$, NULL, $q$Flavoured Gin$q$, $q$Herding Cats$q$, NULL, $q$AU$q$, NULL, $q$https://tamburlaine.com.au/collections/herding-cats$q$, $q$producer$q$),
($q$Herding Cats Gin That's Amore$q$, NULL, $q$Australian Gin$q$, $q$Herding Cats$q$, NULL, $q$AU$q$, NULL, $q$https://tamburlaine.com.au/collections/herding-cats$q$, $q$producer$q$),
($q$Herding Cats Vodka Beachcomber$q$, NULL, $q$Flavoured Vodka$q$, $q$Herding Cats$q$, NULL, $q$AU$q$, NULL, $q$https://tamburlaine.com.au/collections/herding-cats$q$, $q$producer$q$),
($q$Hermetica Bourbon Cask Whisky$q$, NULL, $q$Whiskey$q$, $q$Hermetica$q$, NULL, $q$AU$q$, NULL, $q$https://hermeticadistillery.com/$q$, $q$producer$q$),
($q$Hermetica Pine Needle Gin$q$, NULL, $q$Australian Gin$q$, $q$Hermetica$q$, NULL, $q$AU$q$, NULL, $q$https://hermeticadistillery.com/$q$, $q$producer$q$),
($q$Hermetica Repasado Agave$q$, NULL, $q$Agave Spirit$q$, $q$Hermetica$q$, NULL, $q$AU$q$, NULL, $q$https://hermeticadistillery.com/$q$, $q$producer$q$),
($q$Hermetica Rum$q$, NULL, $q$Rum$q$, $q$Hermetica$q$, NULL, $q$AU$q$, NULL, $q$https://hermeticadistillery.com/$q$, $q$producer$q$),
($q$Hermetica Shiraz Cask Whisky$q$, NULL, $q$Whiskey$q$, $q$Hermetica$q$, NULL, $q$AU$q$, NULL, $q$https://hermeticadistillery.com/$q$, $q$producer$q$),
($q$Hermetica White Agave$q$, NULL, $q$Agave Spirit$q$, $q$Hermetica$q$, 37, $q$AU$q$, NULL, $q$https://hermeticadistillery.com/products/hermetica-white-agave$q$, $q$producer$q$),
($q$Hillman Bros. Good Gin$q$, NULL, $q$Australian Gin$q$, $q$Hillman Bros.$q$, NULL, $q$AU$q$, NULL, $q$https://hillmanbros.com.au/product/good-gin/$q$, $q$producer$q$),
($q$Hillman Bros. Jam Makers Gin$q$, NULL, $q$Aged Gin$q$, $q$Hillman Bros.$q$, NULL, $q$AU$q$, NULL, $q$https://hillmanbros.com.au/product/jam-makers-gin/$q$, $q$producer$q$),
($q$Hillman Bros. Modern Australian Gin$q$, NULL, $q$Australian Gin$q$, $q$Hillman Bros.$q$, NULL, $q$AU$q$, NULL, $q$https://hillmanbros.com.au/product/modern-australian-gin/$q$, $q$producer$q$),
($q$Hillman Bros. Signature Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Hillman Bros.$q$, NULL, $q$AU$q$, NULL, $q$https://hillmanbros.com.au/product/signature-dry-gin/$q$, $q$producer$q$),
($q$Hillman Bros. The Long Game$q$, NULL, $q$Bitter Aperitivo$q$, $q$Hillman Bros.$q$, NULL, $q$AU$q$, NULL, $q$https://hillmanbros.com.au/product/the-long-game/$q$, $q$producer$q$),
($q$Deadman's Point Navy Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Hunnington Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://hunningtondistillery.com.au$q$, $q$producer$q$),
($q$Hunnington Fresh Chilli Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Hunnington Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://hunningtondistillery.com.au$q$, $q$producer$q$),
($q$Hunnington Real Coffee Bean Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Hunnington Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://hunningtondistillery.com.au$q$, $q$producer$q$),
($q$Hunnington Tasmania Sloe Gin$q$, NULL, $q$Sloe Gin$q$, $q$Hunnington Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://hunningtondistillery.com.au$q$, $q$producer$q$),
($q$Hunnington Vapour Infused Gin$q$, NULL, $q$Australian Gin$q$, $q$Hunnington Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://hunningtondistillery.com.au/products/coffee-bean-vodka$q$, $q$producer$q$),
($q$Hunnington Whisky Barrel Aged Coffee Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Hunnington Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://hunningtondistillery.com.au$q$, $q$producer$q$),
($q$Iniquity Thrappledouser$q$, NULL, $q$Whiskey Liqueur$q$, $q$Iniquity$q$, NULL, $q$AU$q$, NULL, $q$https://tinsheddistillingco.com.au/collections/iniquity-whisky$q$, $q$producer$q$),
($q$Iniquity Whisky Gold$q$, NULL, $q$Whiskey$q$, $q$Iniquity$q$, NULL, $q$AU$q$, NULL, $q$https://tinsheddistillingco.com.au/collections/iniquity-whisky$q$, $q$producer$q$),
($q$Iniquity Whisky Silver$q$, NULL, $q$Whiskey$q$, $q$Iniquity$q$, NULL, $q$AU$q$, NULL, $q$https://tinsheddistillingco.com.au/collections/iniquity-whisky$q$, $q$producer$q$),
($q$Iniquity Whisky Talamara$q$, NULL, $q$Whiskey$q$, $q$Iniquity$q$, NULL, $q$AU$q$, NULL, $q$https://tinsheddistillingco.com.au/collections/iniquity-whisky$q$, $q$producer$q$),
($q$Ladbroken Apple Pie Liqueur$q$, NULL, $q$Apple Liqueur$q$, $q$Ladbroken Distilling Co.$q$, 28, $q$AU$q$, NULL, $q$https://ladbroken.com.au/products/apple-pie-liqueur$q$, $q$producer$q$),
($q$Ladbroken Eliksir Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Ladbroken Distilling Co.$q$, 40, $q$AU$q$, NULL, $q$https://ladbroken.com.au/products/coming-soon-eliksir-signature-gin$q$, $q$producer$q$),
($q$Ladbroken Hazelnut Liqueur$q$, NULL, $q$Hazelnut Liqueur$q$, $q$Ladbroken Distilling Co.$q$, 28, $q$AU$q$, NULL, $q$https://ladbroken.com.au/products/hazelnut-liqueur$q$, $q$producer$q$),
($q$Ladbroken Limoncello$q$, NULL, $q$Limoncello$q$, $q$Ladbroken Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://ladbroken.com.au/products/limoncello$q$, $q$producer$q$),
($q$Ladbroken Writers Gin$q$, NULL, $q$Australian Gin$q$, $q$Ladbroken Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://ladbroken.com.au/products/writers-gin$q$, $q$producer$q$),
($q$Lake Meran All-Grain Vodka$q$, NULL, $q$Vodka$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lake Meran Aromatic Bitters$q$, NULL, $q$Aromatic Bitters$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lake Meran Crème de Mûre$q$, NULL, $q$Crème de Mûre$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lake Meran Grapefruit Bitters$q$, NULL, $q$Grapefruit Bitters$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lake Meran London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lake Meran Mediterranean Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lake Meran Signature Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lake Meran Smoky Tea Bitters$q$, NULL, $q$Smoky Bitters$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lake Meran Sunset Aperitivo$q$, NULL, $q$Bitter Aperitivo$q$, $q$Lake Meran Brewery & Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.lakemeranbrewery.com.au/shop/spirits-liqueurs-bitters/RUGVYNNQCFTXGMEGS3S643LR$q$, $q$producer$q$),
($q$Lily Fields Juniper Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Lily Fields Distilling Co$q$, 48, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_ER_2000005050_JUN700/lily-fields-distilling-co-juniper-dry-gin-700ml$q$, $q$retailer$q$),
($q$Lily Fields Sydney Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Lily Fields Distilling Co$q$, 41, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_ER_2000005050_SYD700/lily-fields-distilling-co-sydney-dry-gin-700ml$q$, $q$retailer$q$),
($q$Loam Rutherglen Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Loam Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://loamdistillery.com.au/collections/shop-all/products/rutherglen-dry-gin$q$, $q$producer$q$),
($q$Manly Spirits 6YO Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Manly Spirits Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/single-malt-whisky-6yo-46abv-700$q$, $q$producer$q$),
($q$Manly Spirits Australian Pure Vodka$q$, NULL, $q$Vodka$q$, $q$Manly Spirits Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/australian-pure-vodka$q$, $q$producer$q$),
($q$Manly Spirits Cold Brew Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Manly Spirits Co.$q$, 25, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/cold-brew-coffee-liqueur$q$, $q$producer$q$),
($q$Manly Spirits Elderflower Liqueur$q$, NULL, $q$Elderflower Liqueur$q$, $q$Manly Spirits Co.$q$, 20, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/elderflower-liqueur$q$, $q$producer$q$),
($q$Manly Spirits Limontivo Sugar Free Aperitivo$q$, NULL, $q$Bitter Aperitivo$q$, $q$Manly Spirits Co.$q$, 11, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/limontivo-sugar-free-aperitivo$q$, $q$producer$q$),
($q$Manly Spirits Mandarin Triple Sec$q$, NULL, $q$Mandarin Triple Sec$q$, $q$Manly Spirits Co.$q$, 20, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/mandarin-triple-sec$q$, $q$producer$q$),
($q$Manly Spirits North Head Navy Strength Gin$q$, $q$Manly Spirits North Head Navy Strength Gin$q$, $q$Navy Strength Gin$q$, $q$Manly Spirits Co.$q$, 58, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/north-head-dry-gin-navy-strength$q$, $q$producer$q$),
($q$Manly Spirits Single Malt Whisky$q$, NULL, $q$Single Malt Whisky$q$, $q$Manly Spirits Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/single-malt-whisky-41-6abv-700$q$, $q$producer$q$),
($q$Manly Spirits Spicy Triple Sec$q$, NULL, $q$Triple Sec$q$, $q$Manly Spirits Co.$q$, 20, $q$AU$q$, NULL, $q$https://www.manlyspirits.com.au/products/spicy-triple-sec$q$, $q$producer$q$),
($q$Mrs Baker's Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Mrs Baker's Still House$q$, NULL, $q$AU$q$, NULL, $q$https://www.mrsbakers.com.au/store/c3/Liqueurs_%26_Spirits.html$q$, $q$producer$q$),
($q$Mrs Baker's Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Mrs Baker's Still House$q$, NULL, $q$AU$q$, NULL, $q$https://www.mrsbakers.com.au/store/c2/Gins.html$q$, $q$producer$q$),
($q$Mrs Baker's Fennel Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Mrs Baker's Still House$q$, NULL, $q$AU$q$, NULL, $q$https://www.mrsbakers.com.au/store/c2/Gins.html$q$, $q$producer$q$),
($q$Mrs Baker's Limoncello$q$, NULL, $q$Limoncello$q$, $q$Mrs Baker's Still House$q$, NULL, $q$AU$q$, NULL, $q$https://www.mrsbakers.com.au/store/c3/Liqueurs_%26_Spirits.html$q$, $q$producer$q$),
($q$Mrs Baker's Pepperberry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Mrs Baker's Still House$q$, NULL, $q$AU$q$, NULL, $q$https://www.mrsbakers.com.au/store/c2/Gins.html$q$, $q$producer$q$),
($q$Mrs Baker's Shiraz Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Mrs Baker's Still House$q$, NULL, $q$AU$q$, NULL, $q$https://www.mrsbakers.com.au/store/c2/Gins.html$q$, $q$producer$q$),
($q$Mrs Baker's Very Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Mrs Baker's Still House$q$, NULL, $q$AU$q$, NULL, $q$https://www.mrsbakers.com.au/store/c2/Gins.html$q$, $q$producer$q$),
($q$Mrs Baker's Vodka$q$, NULL, $q$Vodka$q$, $q$Mrs Baker's Still House$q$, NULL, $q$AU$q$, NULL, $q$https://www.mrsbakers.com.au/store/c3/Liqueurs_%26_Spirits.html$q$, $q$producer$q$),
($q$Naturi Per Spritz Vermouth$q$, NULL, $q$Vermouth$q$, $q$Naturi Vermouth$q$, 19, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_ER_2000005346_19369998429483/naturi-vermouth-per-spritz-750ml$q$, $q$retailer$q$),
($q$Naturi Rosso Vermouth$q$, NULL, $q$Sweet Vermouth$q$, $q$Naturi Vermouth$q$, 19, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_ER_2000005346_19369999097018/naturi-vermouth-rosso-vermouth-750ml$q$, $q$retailer$q$),
($q$Newy Australiana Gin$q$, NULL, $q$Australian Gin$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Berry Pink Gin$q$, NULL, $q$Pink Gin$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Bourbon Barrel Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Newy Distillery$q$, 45, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Caramel Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://newydistillery.com.au$q$, $q$producer$q$),
($q$Newy Chocolate Liqueur$q$, NULL, $q$Chocolate Liqueur$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://newydistillery.com.au$q$, $q$producer$q$),
($q$Newy Coal Miner Strength Gin$q$, NULL, $q$Australian Gin$q$, $q$Newy Distillery$q$, 55, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Honeycomb Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://newydistillery.com.au$q$, $q$producer$q$),
($q$Newy Mandarin Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Musk Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://newydistillery.com.au$q$, $q$producer$q$),
($q$Newy Passionfruit Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Port Barrel Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Newy Distillery$q$, 45, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Raspberry Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://newydistillery.com.au$q$, $q$producer$q$),
($q$Newy Signature Gin$q$, NULL, $q$Australian Gin$q$, $q$Newy Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.newydistillery.com.au/collections/shop-gin$q$, $q$producer$q$),
($q$Newy Signature Vodka$q$, NULL, $q$Vodka$q$, $q$Newy Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://newydistillery.com.au$q$, $q$producer$q$),
($q$Nuvé Vodka$q$, NULL, $q$Vodka$q$, $q$Nuvé$q$, 40, $q$AU$q$, NULL, $q$https://nuvevodka.com.au/product/nuve-vodka-700ml$q$, $q$producer$q$),
($q$Old Kempton Apple Liqueur$q$, NULL, $q$Apple Liqueur$q$, $q$Old Kempton Distillery$q$, 25, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/collections/shop-all$q$, $q$producer$q$),
($q$Old Kempton Ellis Reserve Gin$q$, NULL, $q$Aged Gin$q$, $q$Old Kempton Distillery$q$, 40, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/products/gin-ellis-reserve-40-700ml$q$, $q$producer$q$),
($q$Old Kempton Embezzler Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Old Kempton Distillery$q$, 40, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/collections/shop-all$q$, $q$producer$q$),
($q$Old Kempton Lavender Malt Liqueur$q$, NULL, $q$Floral Liqueur$q$, $q$Old Kempton Distillery$q$, 33, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/products/liqueur-lavender-malt-33-700ml$q$, $q$producer$q$),
($q$Old Kempton Pinot Classic Cask$q$, NULL, $q$Single Malt Whisky$q$, $q$Old Kempton Distillery$q$, 46, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/collections/shop-all$q$, $q$producer$q$),
($q$Old Kempton Six Shillings Australian Gin$q$, NULL, $q$Australian Gin$q$, $q$Old Kempton Distillery$q$, 40, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/collections/shop-all$q$, $q$producer$q$),
($q$Old Kempton Solera Cask$q$, NULL, $q$Single Malt Whisky$q$, $q$Old Kempton Distillery$q$, 49, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/collections/shop-all$q$, $q$producer$q$),
($q$Old Kempton The Coach House$q$, NULL, $q$Single Malt Whisky$q$, $q$Old Kempton Distillery$q$, 60, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/collections/shop-all$q$, $q$producer$q$),
($q$Old Kempton The Old Stables$q$, NULL, $q$Single Malt Whisky$q$, $q$Old Kempton Distillery$q$, 40.5, $q$AU$q$, NULL, $q$https://oldkemptondistillery.com.au/collections/shop-all$q$, $q$producer$q$),
($q$Old Young's 1829 Gin$q$, NULL, $q$Australian Gin$q$, $q$Old Young's$q$, 42, $q$AU$q$, NULL, $q$https://oldyoungs.com.au/products/1829-gin$q$, $q$producer$q$),
($q$Old Young's Common Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Old Young's$q$, 57.5, $q$AU$q$, NULL, $q$https://oldyoungs.com.au/products/common-gin$q$, $q$producer$q$),
($q$Old Young's Gingin Gin$q$, NULL, $q$London Dry Gin$q$, $q$Old Young's$q$, 46, $q$AU$q$, NULL, $q$https://oldyoungs.com.au/products/gingin-gin$q$, $q$producer$q$),
($q$Old Young's Old B.A.G.$q$, NULL, $q$Aged Gin$q$, $q$Old Young's$q$, 41, $q$AU$q$, NULL, $q$https://oldyoungs.com.au/products/old-b-a-g$q$, $q$producer$q$),
($q$Old Young's Pavlova Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Old Young's$q$, 40, $q$AU$q$, NULL, $q$https://oldyoungs.com.au/products/pavlova-vodka$q$, $q$producer$q$),
($q$Old Young's Pure No. 1 Vodka$q$, NULL, $q$Vodka$q$, $q$Old Young's$q$, 40, $q$AU$q$, NULL, $q$https://oldyoungs.com.au/products/pure-no-1-vodka$q$, $q$producer$q$),
($q$Old Young's Six Seasons Gin$q$, NULL, $q$Australian Gin$q$, $q$Old Young's$q$, 44, $q$AU$q$, NULL, $q$https://oldyoungs.com.au/products/six-seasons-gin$q$, $q$producer$q$),
($q$Old Young's Smoked Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Old Young's$q$, 40, $q$AU$q$, NULL, $q$https://oldyoungs.com.au/products/smoked-vodka$q$, $q$producer$q$),
($q$Mary St Acai Gin Liqueur$q$, NULL, $q$Berry Liqueur$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/mary-st-acai-gin-liqueur$q$, $q$producer$q$),
($q$Mary St Citrus Gin$q$, NULL, $q$Australian Gin$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/mary-st-citrus-gin$q$, $q$producer$q$),
($q$Mary St Coffee Gin Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/mary-st-coffee-gin-liqueur$q$, $q$producer$q$),
($q$Mary St Raspberry Gin Liqueur$q$, NULL, $q$Raspberry Liqueur$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/mary-st-raspberry-gin-liqueur-2$q$, $q$producer$q$),
($q$Mary St Shiraz Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/mary-st-shiraz-gin$q$, $q$producer$q$),
($q$Mary St Sydney Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/mary-st-gin$q$, $q$producer$q$),
($q$OCD Cocoa Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/ocd-vodka-cocoa$q$, $q$producer$q$),
($q$OCD Lemon Drop Vodka$q$, NULL, $q$Citron Vodka$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/ocd-vodka-lemon-myrtle$q$, $q$producer$q$),
($q$OCD Pure Vodka$q$, NULL, $q$Vodka$q$, $q$Otter Craft Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://ocdistilling.com/products/ocd-vodka$q$, $q$producer$q$),
($q$Penni Ave 16th Beach Sea Celery & Salt Bush Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Penni Ave Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.penniave.com.au/product/700ml-16th-beach-sea-celery-salt-bush-vodka/132$q$, $q$producer$q$),
($q$Penni Ave Lemon Myrtle and Kakadu Plum Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Penni Ave Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.penniave.com.au/product/700ml-lemon-myrtle-and-kakadu-plum-vodka/127$q$, $q$producer$q$),
($q$Penni Ave Wattleseed and Burnt Honey Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Penni Ave Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.penniave.com.au/product/700ml-wattleseed-and-burnt-honey-vodka/82$q$, $q$producer$q$),
($q$Pluto Gin$q$, NULL, $q$Australian Gin$q$, $q$Pluto Spirits$q$, NULL, $q$AU$q$, NULL, $q$https://www.plutospirits.com/collections/all$q$, $q$producer$q$),
($q$Pluto Gold Rum$q$, NULL, $q$Australian Cane Spirit$q$, $q$Pluto Spirits$q$, NULL, $q$AU$q$, NULL, $q$https://www.plutospirits.com/collections/all$q$, $q$producer$q$),
($q$Pluto Spiced Rum$q$, NULL, $q$Spiced Rum$q$, $q$Pluto Spirits$q$, NULL, $q$AU$q$, NULL, $q$https://www.plutospirits.com/collections/all$q$, $q$producer$q$),
($q$Pluto Vodka$q$, NULL, $q$Vodka$q$, $q$Pluto Spirits$q$, NULL, $q$AU$q$, NULL, $q$https://www.plutospirits.com/collections/all$q$, $q$producer$q$),
($q$Pluto White Rum$q$, NULL, $q$White Rum$q$, $q$Pluto Spirits$q$, NULL, $q$AU$q$, NULL, $q$https://www.plutospirits.com/collections/all$q$, $q$producer$q$),
($q$Polka Non-Alc Botanical Spirit$q$, NULL, $q$Non-alcoholic Botanical Spirit$q$, $q$Polka$q$, NULL, $q$AU$q$, NULL, $q$https://www.polkadrops.com.au/collections/spirits$q$, $q$producer$q$),
($q$Polka Non-Alc Italian Aperitif$q$, NULL, $q$Non-Alcoholic Aperitif$q$, $q$Polka$q$, NULL, $q$AU$q$, NULL, $q$https://www.polkadrops.com.au/collections/spirits$q$, $q$producer$q$),
($q$Pomona Kakadu Plum Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Lemon Myrtle Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Lilly Pilly Liqueur$q$, NULL, $q$Berry Liqueur$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Native Davidson Plum & Fingerlime Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Pink Peppercorn Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Pomelocello Liqueur$q$, NULL, $q$Citrus Liqueur$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Signature Blue Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Signature Chilli Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Signature Coconut Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Signature Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au/products/pomona-signature-dry-gin$q$, $q$producer$q$),
($q$Pomona Signature Navy Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Signature Orange Citrus Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Signature Pink Gin$q$, NULL, $q$Pink Gin$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Pomona Signature Vodka$q$, NULL, $q$Vodka$q$, $q$Pomona Distilling Co.$q$, NULL, $q$AU$q$, NULL, $q$https://www.pomonadistilling.com.au$q$, $q$producer$q$),
($q$Port Phillip Distillery Fury Naval Strength Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Port Phillip Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://portphillipdistillery.com/products/fury-naval-strength-gin$q$, $q$producer$q$),
($q$Port Phillip Distillery Hell's Bells London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Port Phillip Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://portphillipdistillery.com/products/hells-bells-london-dry-gin$q$, $q$producer$q$),
($q$Port Phillip Distillery Insanity Modern Australian Gin$q$, NULL, $q$Australian Gin$q$, $q$Port Phillip Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://portphillipdistillery.com/products/insanity-modern-australian-gin$q$, $q$producer$q$),
($q$Port Phillip Distillery Vodka$q$, NULL, $q$Vodka$q$, $q$Port Phillip Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://portphillipdistillery.com/products/port-phillip-distillery-vodka$q$, $q$producer$q$),
($q$Reform Bright Lights Gin$q$, NULL, $q$Australian Gin$q$, $q$Reform Distilling$q$, 42, $q$AU$q$, NULL, $q$https://rfrm.com.au/collections/all/products/bright-lights-gin$q$, $q$producer$q$),
($q$Reform Grenache Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Reform Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://rfrm.com.au/collections/all$q$, $q$producer$q$),
($q$Reform High Rise Gin$q$, NULL, $q$Australian Gin$q$, $q$Reform Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://rfrm.com.au/collections/all$q$, $q$producer$q$),
($q$Reform Hills Harvest Gin$q$, NULL, $q$Australian Gin$q$, $q$Reform Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://rfrm.com.au/collections/all$q$, $q$producer$q$),
($q$Reform Limoncello$q$, NULL, $q$Limoncello$q$, $q$Reform Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://rfrm.com.au/collections/all$q$, $q$producer$q$),
($q$Reform Old Town Gin (Quince)$q$, NULL, $q$Flavoured Gin$q$, $q$Reform Distilling$q$, NULL, $q$AU$q$, NULL, $q$https://rfrm.com.au/collections/all$q$, $q$producer$q$),
($q$RWT Bourbon$q$, NULL, $q$Whiskey$q$, $q$Running With Thieves$q$, NULL, $q$AU$q$, NULL, $q$https://runningwiththieves.com/collections/spirits$q$, $q$producer$q$),
($q$RWT Whisky$q$, NULL, $q$Whiskey$q$, $q$Running With Thieves$q$, NULL, $q$AU$q$, NULL, $q$https://runningwiththieves.com/collections/spirits$q$, $q$producer$q$),
($q$Running With Thieves Botanical Gin$q$, NULL, $q$Australian Gin$q$, $q$Running With Thieves$q$, NULL, $q$AU$q$, NULL, $q$https://runningwiththieves.com/collections/spirits/products/gin-001-botanical$q$, $q$producer$q$),
($q$Running With Thieves Chardonnay Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Running With Thieves$q$, NULL, $q$AU$q$, NULL, $q$https://runningwiththieves.com/collections/spirits$q$, $q$producer$q$),
($q$Running With Thieves Pink Gin$q$, NULL, $q$Pink Gin$q$, $q$Running With Thieves$q$, NULL, $q$AU$q$, NULL, $q$https://runningwiththieves.com/collections/spirits$q$, $q$producer$q$),
($q$Running With Thieves Vodka$q$, NULL, $q$Vodka$q$, $q$Running With Thieves$q$, NULL, $q$AU$q$, NULL, $q$https://runningwiththieves.com/collections/spirits$q$, $q$producer$q$),
($q$SOLLOS Whitsundays Blanco$q$, NULL, $q$Agave Spirit$q$, $q$SOLLOS$q$, NULL, $q$AU$q$, NULL, $q$https://sollosagave.com.au/$q$, $q$producer$q$),
($q$Saltbeard Founder's Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Saltbeard Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.saltbeard.com.au/collections/all/products/founders-dry-gin$q$, $q$producer$q$),
($q$Saltbeard Grapefruit Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Saltbeard Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.saltbeard.com.au/collections/all$q$, $q$producer$q$),
($q$Saltbeard Limoncello$q$, NULL, $q$Limoncello$q$, $q$Saltbeard Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.saltbeard.com.au/collections/all$q$, $q$producer$q$),
($q$Saltbeard Quince Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Saltbeard Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.saltbeard.com.au/collections/all$q$, $q$producer$q$),
($q$Saltbeard Vodka$q$, NULL, $q$Vodka$q$, $q$Saltbeard Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.saltbeard.com.au/collections/all$q$, $q$producer$q$),
($q$Sanyou Baijiu Aged 5 Years$q$, NULL, $q$Spirit$q$, $q$Sanyou$q$, NULL, $q$AU$q$, NULL, $q$https://sanyou.com.au/products/sanyou-baijiu-aged-5-years$q$, $q$producer$q$),
($q$Sarina Sugar Shed Butterscotch Schnapps Liqueur$q$, NULL, $q$Butterscotch Schnapps$q$, $q$Sarina Sugar Shed$q$, NULL, $q$AU$q$, NULL, $q$https://shop.sarinasugarshed.com.au/collections/alcohol$q$, $q$producer$q$),
($q$Sarina Sugar Shed Coconut Liqueur$q$, NULL, $q$Coconut Liqueur$q$, $q$Sarina Sugar Shed$q$, NULL, $q$AU$q$, NULL, $q$https://shop.sarinasugarshed.com.au/collections/alcohol$q$, $q$producer$q$),
($q$Sarina Sugar Shed Lime NOI (Nice Over Ice)$q$, NULL, $q$Citrus Liqueur$q$, $q$Sarina Sugar Shed$q$, NULL, $q$AU$q$, NULL, $q$https://shop.sarinasugarshed.com.au/collections/alcohol$q$, $q$producer$q$),
($q$Sarina Sugar Shed Liqueur$q$, NULL, $q$Liqueur$q$, $q$Sarina Sugar Shed$q$, NULL, $q$AU$q$, NULL, $q$https://shop.sarinasugarshed.com.au/collections/alcohol$q$, $q$producer$q$),
($q$Sarina Sugar Shed Turkish Delight Liqueur$q$, NULL, $q$Liqueur$q$, $q$Sarina Sugar Shed$q$, NULL, $q$AU$q$, NULL, $q$https://shop.sarinasugarshed.com.au/collections/alcohol$q$, $q$producer$q$),
($q$Sugar Shed Rum$q$, NULL, $q$Rum$q$, $q$Sarina Sugar Shed$q$, NULL, $q$AU$q$, NULL, $q$https://www.sarinasugarshed.com.au/Distillery/Our-liqueurs-and-rum$q$, $q$producer$q$),
($q$Seven Seasons Green Ant Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Seven Seasons$q$, 42, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_660917/seven-seasons-green-ant-gin-700ml$q$, $q$retailer$q$),
($q$The Busking Hustle Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Side Hustle Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.sheppartonbrewery.com.au/collections/side-hustle-distillery$q$, $q$producer$q$),
($q$The Casino Hustle Savoury Spice Gin$q$, NULL, $q$Australian Gin$q$, $q$Side Hustle Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.sheppartonbrewery.com.au/collections/side-hustle-distillery$q$, $q$producer$q$),
($q$The Late Night Hustle Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$Side Hustle Distillery$q$, 20, $q$AU$q$, NULL, $q$https://www.sheppartonbrewery.com.au/collections/side-hustle-distillery$q$, $q$producer$q$),
($q$The Lemonade Hustle Gin Summer Fruit Cup$q$, NULL, $q$Liqueur$q$, $q$Side Hustle Distillery$q$, 25, $q$AU$q$, NULL, $q$https://www.sheppartonbrewery.com.au/collections/side-hustle-distillery$q$, $q$producer$q$),
($q$The Three Card Hustle Citrus Vodka$q$, NULL, $q$Citron Vodka$q$, $q$Side Hustle Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.sheppartonbrewery.com.au/collections/side-hustle-distillery$q$, $q$producer$q$),
($q$The Tupperware Hustle Settle Petal Gin$q$, NULL, $q$Australian Gin$q$, $q$Side Hustle Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.sheppartonbrewery.com.au/collections/side-hustle-distillery$q$, $q$producer$q$),
($q$Solbevi Limoncello$q$, NULL, $q$Limoncello$q$, $q$Solbevi$q$, 20, $q$AU$q$, NULL, $q$https://www.solbevi.com/products/limoncello$q$, $q$producer$q$),
($q$Soltera Blanco Lightly Spiced Cane Spirit$q$, NULL, $q$Australian Cane Spirit$q$, $q$Soltera Rum$q$, NULL, $q$AU$q$, NULL, $q$https://www.cabaritaspirits.com/collections/soltera-rum$q$, $q$producer$q$),
($q$Soltera Oro Barrel-Aged Cane Spirit$q$, NULL, $q$Australian Cane Spirit$q$, $q$Soltera Rum$q$, NULL, $q$AU$q$, NULL, $q$https://www.cabaritaspirits.com/collections/soltera-rum$q$, $q$producer$q$),
($q$Spirit of Little Things Australian Botanical Gin$q$, NULL, $q$Australian Gin$q$, $q$Spirit of Little Things$q$, 43, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_111249/spirit-of-little-things-australian-botanical-gin-700ml$q$, $q$retailer$q$),
($q$Spirit of Little Things Australian Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Spirit of Little Things$q$, 40, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_111244/spirit-of-little-things-australian-dry-gin700ml$q$, $q$retailer$q$),
($q$Storytellers FWAH! GRASS! Australian Lemon Scented Grass Gin$q$, NULL, $q$Australian Gin$q$, $q$Storytellers Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.storytellersdistillery.com.au/collections/staple-releases$q$, $q$producer$q$),
($q$Storytellers Volume 1: Australian Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Storytellers Distillery$q$, 43, $q$AU$q$, NULL, $q$https://www.storytellersdistillery.com.au/products/volume-1-australian-dry-gin-copy$q$, $q$producer$q$),
($q$Storytellers Volume 3: Tickled Pink Strawberry Gin$q$, NULL, $q$Pink Gin$q$, $q$Storytellers Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.storytellersdistillery.com.au/collections/staple-releases$q$, $q$producer$q$),
($q$The Canberra Distillery Blood Orange Gin$q$, NULL, $q$Flavoured Gin$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Butterscotch Schnapps$q$, NULL, $q$Butterscotch Schnapps$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery French Earl Grey Gin$q$, NULL, $q$Flavoured Gin$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Gin$q$, NULL, $q$London Dry Gin$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all/products/gin$q$, $q$producer$q$),
($q$The Canberra Distillery Lakoona Whisky$q$, NULL, $q$Whiskey$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Limoncello$q$, NULL, $q$Limoncello$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Musk Liqueur$q$, NULL, $q$Liqueur$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Old George Reserve Rum$q$, NULL, $q$Aged Rum$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Old George Reserve Whisky$q$, NULL, $q$Whiskey$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Spiced Rum$q$, NULL, $q$Spiced Rum$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Summer Gin$q$, NULL, $q$Australian Gin$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Vodka$q$, NULL, $q$Vodka$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Whisky Liqueur$q$, NULL, $q$Whiskey Liqueur$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Canberra Distillery Winter Gin$q$, NULL, $q$Australian Gin$q$, $q$The Canberra Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thecanberradistillery.com.au/collections/all$q$, $q$producer$q$),
($q$The Grove Absinthe$q$, NULL, $q$Absinthe$q$, $q$The Grove Distillery$q$, 50, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/organic-absinthe$q$, $q$producer$q$),
($q$The Grove Butterscotch Liqueur$q$, NULL, $q$Butterscotch Liqueur$q$, $q$The Grove Distillery$q$, 20, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fpbutterscotch500ml$q$, $q$producer$q$),
($q$The Grove Chilli Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$The Grove Distillery$q$, 40, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fpvodkachilli500ml$q$, $q$producer$q$),
($q$The Grove Coconut Grove Rum$q$, NULL, $q$Coconut Rum$q$, $q$The Grove Distillery$q$, 40, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fprumcoconut500ml$q$, $q$producer$q$),
($q$The Grove Coconut Liqueur$q$, NULL, $q$Coconut Liqueur$q$, $q$The Grove Distillery$q$, 20, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fpcoconutliqueur500ml$q$, $q$producer$q$),
($q$The Grove Coffee Liqueur$q$, NULL, $q$Coffee Liqueur$q$, $q$The Grove Distillery$q$, 25, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fpcoffeeliqueur500ml$q$, $q$producer$q$),
($q$The Grove Corn Mash Whiskey Traditional$q$, NULL, $q$Corn Whiskey$q$, $q$The Grove Distillery$q$, 40, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fpcmwtraditional40$q$, $q$producer$q$),
($q$The Grove Dark Rum$q$, NULL, $q$Dark Rum$q$, $q$The Grove Distillery$q$, 40, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fprumdark500ml$q$, $q$producer$q$),
($q$The Grove Lemoncello$q$, NULL, $q$Limoncello$q$, $q$The Grove Distillery$q$, 25, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fplemoncello500ml$q$, $q$producer$q$),
($q$The Grove Limecello$q$, NULL, $q$Citrus Liqueur$q$, $q$The Grove Distillery$q$, 25, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/limecello-liqueur-500ml$q$, $q$producer$q$),
($q$The Grove London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$The Grove Distillery$q$, 37, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fpgin500ml$q$, $q$producer$q$),
($q$The Grove Macadamia Liqueur$q$, NULL, $q$Liqueur$q$, $q$The Grove Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/macadamia-liqueur-500ml$q$, $q$producer$q$),
($q$The Grove Strawberry Gin$q$, NULL, $q$Flavoured Gin$q$, $q$The Grove Distillery$q$, 37, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fpginstrawberry500ml$q$, $q$producer$q$),
($q$The Grove Vodka$q$, NULL, $q$Vodka$q$, $q$The Grove Distillery$q$, 40, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fpvodkaplain500ml$q$, $q$producer$q$),
($q$The Grove White Rum$q$, NULL, $q$White Rum$q$, $q$The Grove Distillery$q$, 40, $q$AU$q$, NULL, $q$https://thegrovedistillery.com.au/products/fprumwhite500ml$q$, $q$producer$q$),
($q$The Spirit Collective Gin #1 Origin$q$, NULL, $q$Australian Gin$q$, $q$The Spirit Collective$q$, NULL, $q$AU$q$, NULL, $q$https://www.spiritcollective.com.au/$q$, $q$producer$q$),
($q$The Spirit Collective Gin #2 Raspberry$q$, NULL, $q$Flavoured Gin$q$, $q$The Spirit Collective$q$, NULL, $q$AU$q$, NULL, $q$https://www.spiritcollective.com.au/$q$, $q$producer$q$),
($q$The Spirit Collective Rum #1 Old Grog$q$, NULL, $q$Rum$q$, $q$The Spirit Collective$q$, NULL, $q$AU$q$, NULL, $q$https://www.spiritcollective.com.au/$q$, $q$producer$q$),
($q$The Spirit Collective Rum #2 Old Grog Spiced$q$, NULL, $q$Spiced Rum$q$, $q$The Spirit Collective$q$, NULL, $q$AU$q$, NULL, $q$https://www.spiritcollective.com.au/$q$, $q$producer$q$),
($q$The Spirit Collective Vodka #1$q$, NULL, $q$Vodka$q$, $q$The Spirit Collective$q$, NULL, $q$AU$q$, NULL, $q$https://www.spiritcollective.com.au/$q$, $q$producer$q$),
($q$Three Chain Road Double Distilled Vodka$q$, NULL, $q$Vodka$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$Three Chain Road Elderflower Gin$q$, NULL, $q$Old Tom Gin$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$Three Chain Road Finger Lime Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$Three Chain Road Heathcote Shiraz Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$Three Chain Road Premium Dry Gin$q$, NULL, $q$Australian Gin$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$Three Chain Road Premium Orange Liqueur$q$, NULL, $q$Orange Liqueur$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$Three Chain Road Rare Cask Aged Whisky$q$, NULL, $q$Whiskey$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$Three Chain Road Rare Muscat Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$Three Chain Road Southern Citrus Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Three Chain Road$q$, NULL, $q$AU$q$, NULL, $q$https://bullerwines.com.au/collections/three-chain-road$q$, $q$producer$q$),
($q$TSD Barrel Aged Gin$q$, NULL, $q$Aged Gin$q$, $q$Tin Shed Distilling Co$q$, NULL, $q$AU$q$, NULL, $q$https://tinsheddistillingco.com.au/collections/tsd-spirits$q$, $q$producer$q$),
($q$TSD Nairne Gin$q$, NULL, $q$Australian Gin$q$, $q$Tin Shed Distilling Co$q$, NULL, $q$AU$q$, NULL, $q$https://tinsheddistillingco.com.au/collections/tsd-spirits$q$, $q$producer$q$),
($q$TSD Nairne Whisky$q$, NULL, $q$Whiskey$q$, $q$Tin Shed Distilling Co$q$, NULL, $q$AU$q$, NULL, $q$https://www.tinsheddistillingco.com.au$q$, $q$producer$q$),
($q$TSD The Icebreaker Gin$q$, NULL, $q$London Dry Gin$q$, $q$Tin Shed Distilling Co$q$, NULL, $q$AU$q$, NULL, $q$https://tinsheddistillingco.com.au/collections/tsd-spirits$q$, $q$producer$q$),
($q$Two Cats Aristocat$q$, NULL, $q$Coffee Liqueur$q$, $q$Two Cats Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/aristocat/30$q$, $q$producer$q$),
($q$Two Cats Cat o' Nine Tails$q$, NULL, $q$Navy Strength Gin$q$, $q$Two Cats Distillery$q$, 58, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/catoninetails/2$q$, $q$producer$q$),
($q$Two Cats Catnip$q$, NULL, $q$Pink Gin$q$, $q$Two Cats Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/catnippinkgin/15$q$, $q$producer$q$),
($q$Two Cats Maine Coon London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Two Cats Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/maine-coon-london-dry-gin/40$q$, $q$producer$q$),
($q$Two Cats Old Tom Cat$q$, NULL, $q$Old Tom Gin$q$, $q$Two Cats Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/old-tom-cat/G27D73XKR6MGT6BC53PMSIHI$q$, $q$producer$q$),
($q$Two Cats Sour Cat Limoncello$q$, NULL, $q$Limoncello$q$, $q$Two Cats Distillery$q$, 30, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/Sourcatlimoncello/19$q$, $q$producer$q$),
($q$Two Cats The Cat's Tail Lemon & Lime Vodka$q$, NULL, $q$Citron Vodka$q$, $q$Two Cats Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/thecatstail/16$q$, $q$producer$q$),
($q$Two Cats The Cat's Tail Orange Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Two Cats Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/thecatstail/16$q$, $q$producer$q$),
($q$Two Cats The Cat's Tail Spiced Vodka$q$, NULL, $q$Flavoured Vodka$q$, $q$Two Cats Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/thecatstail/16$q$, $q$producer$q$),
($q$Two Cats The Distiller's Cat$q$, NULL, $q$London Dry Gin$q$, $q$Two Cats Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.twocatsdistillery.com.au/product/Thedistillerscat/1$q$, $q$producer$q$),
($q$Vodka O$q$, $q$Vodka O$q$, $q$Vodka$q$, $q$Vodka O$q$, 37.5, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_905114/vodka-o-vodka-700ml$q$, $q$retailer$q$),
($q$Wandering Distillery Naval Gazing$q$, NULL, $q$Navy Strength Gin$q$, $q$Wandering Distillery$q$, 57.6, $q$AU$q$, NULL, $q$https://www.wanderingdistillery.com.au/products/naval-gazing$q$, $q$producer$q$),
($q$Wandering Distillery Nomad Gin$q$, NULL, $q$Australian Gin$q$, $q$Wandering Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.wanderingdistillery.com.au/products/nomad$q$, $q$producer$q$),
($q$Wandering Distillery Odyssey Gin$q$, NULL, $q$Australian Gin$q$, $q$Wandering Distillery$q$, 40, $q$AU$q$, NULL, $q$https://www.wanderingdistillery.com.au/products/odyssey$q$, $q$producer$q$),
($q$Wandering Distillery Signature Gin$q$, NULL, $q$London Dry Gin$q$, $q$Wandering Distillery$q$, 43, $q$AU$q$, NULL, $q$https://www.wanderingdistillery.com.au/products/wandering-distillery-signature-gin$q$, $q$producer$q$),
($q$Wandering Distillery Wandering Star$q$, NULL, $q$Australian Gin$q$, $q$Wandering Distillery$q$, NULL, $q$AU$q$, NULL, $q$https://www.wanderingdistillery.com.au/products/wandering-star$q$, $q$producer$q$),
($q$Western Queensland Spirit Outback Gin$q$, NULL, $q$Australian Gin$q$, $q$Western Queensland Spirit$q$, NULL, $q$AU$q$, NULL, $q$https://www.gardenstreet.com.au/blogs/gin-blog/october-2025-western-queensland-spirit-desert-oasis-gin$q$, $q$retailer$q$),
($q$Western Queensland Spirit Stagecoach Gin$q$, NULL, $q$Australian Gin$q$, $q$Western Queensland Spirit$q$, NULL, $q$AU$q$, NULL, $q$https://www.gardenstreet.com.au/blogs/gin-blog/october-2025-western-queensland-spirit-desert-oasis-gin$q$, $q$retailer$q$),
($q$Western Queensland Spirit Western Skies Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Western Queensland Spirit$q$, NULL, $q$AU$q$, NULL, $q$https://www.gardenstreet.com.au/blogs/gin-blog/october-2025-western-queensland-spirit-desert-oasis-gin$q$, $q$retailer$q$),
($q$White Possum Banana Liqueur$q$, NULL, $q$Banana Liqueur$q$, $q$White Possum$q$, NULL, $q$AU$q$, NULL, $q$https://whitepossum.com.au/collections/liqueurs$q$, $q$producer$q$),
($q$White Possum Dark Cacao$q$, NULL, $q$Dark Crème de Cacao$q$, $q$White Possum$q$, NULL, $q$AU$q$, NULL, $q$https://whitepossum.com.au/collections/liqueurs$q$, $q$producer$q$),
($q$White Possum Hazelnut Liqueur$q$, NULL, $q$Hazelnut Liqueur$q$, $q$White Possum$q$, NULL, $q$AU$q$, NULL, $q$https://whitepossum.com.au/collections/liqueurs$q$, $q$producer$q$),
($q$White Possum Lychee Liqueur$q$, NULL, $q$Lychee Liqueur$q$, $q$White Possum$q$, NULL, $q$AU$q$, NULL, $q$https://whitepossum.com.au/collections/liqueurs$q$, $q$producer$q$),
($q$White Possum Maraschino$q$, NULL, $q$Maraschino Liqueur$q$, $q$White Possum$q$, NULL, $q$AU$q$, NULL, $q$https://whitepossum.com.au/collections/liqueurs$q$, $q$producer$q$),
($q$White Possum Oak Aged Amaretto$q$, NULL, $q$Amaretto$q$, $q$White Possum$q$, NULL, $q$AU$q$, NULL, $q$https://whitepossum.com.au/collections/liqueurs$q$, $q$producer$q$),
($q$White Possum Scarletta$q$, NULL, $q$Bitter Aperitivo$q$, $q$White Possum$q$, 26, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_ER_1000005536_WPP-NSC/white-possum-scarletta-500ml$q$, $q$retailer$q$),
($q$Winston Quinn Double Denim Gin$q$, NULL, $q$Navy Strength Gin$q$, $q$Winston Quinn$q$, NULL, $q$AU$q$, NULL, $q$https://www.winstonquinn.com.au/$q$, $q$producer$q$),
($q$Winston Quinn Dry Cut Gin$q$, NULL, $q$London Dry Gin$q$, $q$Winston Quinn$q$, 40, $q$AU$q$, NULL, $q$https://www.winstonquinn.com.au/collections/gins/products/dry-cut$q$, $q$producer$q$),
($q$Winston Quinn Pink Fit Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Winston Quinn$q$, NULL, $q$AU$q$, NULL, $q$https://www.winstonquinn.com.au/$q$, $q$producer$q$),
($q$Winston Quinn Skinny Jeans Gin$q$, NULL, $q$Australian Gin$q$, $q$Winston Quinn$q$, NULL, $q$AU$q$, NULL, $q$https://www.winstonquinn.com.au/$q$, $q$producer$q$),
($q$Winston Quinn Slim Crop Gin$q$, NULL, $q$Flavoured Gin$q$, $q$Winston Quinn$q$, NULL, $q$AU$q$, NULL, $q$https://www.winstonquinn.com.au/$q$, $q$producer$q$),
($q$White Fae Allure London Dry Gin$q$, NULL, $q$London Dry Gin$q$, $q$Wolfsbane$q$, NULL, $q$AU$q$, NULL, $q$https://wolfsbane.com.au/collections/all$q$, $q$producer$q$),
($q$White Fae Azure Botanical Gin$q$, NULL, $q$Australian Gin$q$, $q$Wolfsbane$q$, NULL, $q$AU$q$, NULL, $q$https://wolfsbane.com.au/collections/all$q$, $q$producer$q$),
($q$Wolfsbane Blue Label Vodka$q$, NULL, $q$Wheat Vodka$q$, $q$Wolfsbane$q$, NULL, $q$AU$q$, NULL, $q$https://wolfsbane.com.au/collections/all$q$, $q$producer$q$),
($q$Wolfsbane Limoncello$q$, NULL, $q$Limoncello$q$, $q$Wolfsbane$q$, NULL, $q$AU$q$, NULL, $q$https://wolfsbane.com.au/collections/all$q$, $q$producer$q$),
($q$Wolfsbane Premium Rye Vodka$q$, NULL, $q$Rye Vodka$q$, $q$Wolfsbane$q$, NULL, $q$AU$q$, NULL, $q$https://wolfsbane.com.au/collections/all$q$, $q$producer$q$),
($q$Wolfsbane Premium Vodka$q$, NULL, $q$Vodka$q$, $q$Wolfsbane$q$, NULL, $q$AU$q$, NULL, $q$https://wolfsbane.com.au/collections/all$q$, $q$producer$q$),
($q$Wolfsbane Yuzucello$q$, NULL, $q$Yuzucello$q$, $q$Wolfsbane$q$, NULL, $q$AU$q$, NULL, $q$https://wolfsbane.com.au/collections/all$q$, $q$producer$q$);

-- Which row each bottle is: the catalog's row (by its name or an alias), else
-- one already called by the label name. A style or a house prep by that name
-- isn't a bottle, so it's left alone. Two checks that land on one row keep the
-- producer's own page.
CREATE TEMP TABLE bottle_row AS
SELECT DISTINCT ON (COALESCE(x.id::text, public.ingredient_key(x.label_name))) x.*
  FROM (SELECT b.*, COALESCE(pg_temp.shared(b.catalog_name), pg_temp.shared(b.label_name)) AS id FROM bottle_in b) x
 ORDER BY COALESCE(x.id::text, public.ingredient_key(x.label_name)), (x.kind = 'producer') DESC, (x.abv IS NOT NULL) DESC,
          length(x.label_name) DESC, x.label_name;
DELETE FROM bottle_row b USING public.items i
 WHERE i.id = b.id AND (i.ingredient_role IN ('generic', 'prep') OR i.is_core OR i.bar_id IS NOT NULL);

-- New bottles.
WITH ins AS (
    INSERT INTO public.items (name, item_type, ingredient_role, hide_from_search, generic_id, brand_maker, abv, origin_country, gi, maker_profile_id)
    SELECT DISTINCT ON (public.ingredient_key(b.label_name))
           b.label_name, 'ingredient', 'product', false, pg_temp.style(b.style), b.producer, b.abv, b.country, b.gi, pg_temp.maker(b.producer)
      FROM bottle_row b
     WHERE b.id IS NULL AND pg_temp.style(b.style) IS NOT NULL
    RETURNING id, name
)
UPDATE bottle_row r SET id = ins.id FROM ins WHERE r.id IS NULL AND public.ingredient_key(r.label_name) = public.ingredient_key(ins.name);

-- The style each bottle we had files under: the checked one, unless the row
-- already sits under it (a narrower style) or under a place style and the
-- check gave only the catch-all.
ALTER TABLE bottle_row ADD COLUMN style_id uuid;
UPDATE bottle_row b SET style_id = CASE
    WHEN pg_temp.under(b.id, pg_temp.style(b.style)) THEN (SELECT i.generic_id FROM public.items i WHERE i.id = b.id)
    WHEN b.style IN ($q$Gin$q$, $q$Whiskey$q$, $q$Vodka$q$, $q$Rum$q$, $q$Spirit$q$, $q$Liqueur$q$, $q$Australian Gin$q$, $q$Single Malt Whisky$q$) AND EXISTS (
         SELECT 1 FROM public.items i JOIN public.items g ON g.id = i.generic_id JOIN place_in p ON public.ingredient_key(p.name) = public.ingredient_key(g.name)
          WHERE i.id = b.id) THEN (SELECT i.generic_id FROM public.items i WHERE i.id = b.id)
    ELSE pg_temp.style(b.style) END
 WHERE b.id IS NOT NULL;

-- Bottles we had: a bottle, its checked style, and what was missing.
UPDATE public.items i SET
    ingredient_role = 'product',
    made_from_id = NULL,
    generic_id = b.style_id,
    brand_maker = COALESCE(NULLIF(btrim(i.brand_maker), ''), b.producer),
    abv = COALESCE(i.abv, b.abv),
    origin_country = COALESCE(i.origin_country, b.country),
    gi = COALESCE(i.gi, b.gi),
    maker_profile_id = COALESCE(i.maker_profile_id, pg_temp.maker(b.producer))
  FROM bottle_row b
 WHERE i.id = b.id AND b.style_id IS NOT NULL
   AND (i.ingredient_role IS DISTINCT FROM 'product' OR i.made_from_id IS NOT NULL
        OR i.generic_id IS DISTINCT FROM b.style_id
        OR (i.abv IS NULL AND b.abv IS NOT NULL) OR (i.origin_country IS NULL AND b.country IS NOT NULL)
        OR (i.gi IS NULL AND b.gi IS NOT NULL) OR (i.maker_profile_id IS NULL AND pg_temp.maker(b.producer) IS NOT NULL)
        OR NULLIF(btrim(i.brand_maker), '') IS NULL);

-- The label name, brand first; the old name stays an alias. Skipped when
-- another shared row already has it.
SET "app.ingredient_merge" = 'on';
CREATE TEMP TABLE "renamed" AS
SELECT DISTINCT ON (b.id) b.id, i.name AS old_name, b.label_name AS new_name
  FROM bottle_row b JOIN public.items i ON i.id = b.id
 WHERE public.ingredient_key(i.name) <> public.ingredient_key(b.label_name)
   AND NOT EXISTS (
       SELECT 1 FROM public.items o
        WHERE o.item_type = 'ingredient' AND o.bar_id IS NULL AND o.id <> b.id
          AND public.ingredient_key(o.name) = public.ingredient_key(b.label_name));
UPDATE public.items i SET name = r.new_name FROM renamed r WHERE i.id = r.id;
DELETE FROM public.ingredient_aliases a USING renamed r WHERE a.key = public.ingredient_key(r.new_name);
INSERT INTO public.ingredient_aliases (key, item_id)
SELECT public.ingredient_key(r.old_name), r.id FROM renamed r
ON CONFLICT (key) DO UPDATE SET item_id = EXCLUDED.item_id;
RESET "app.ingredient_merge";

-- Where each fact was checked.
INSERT INTO public.item_sources (item_id, field, url, kind, checked_on)
SELECT DISTINCT b.id, f.field, b.url, b.kind, DATE '2026-10-14'
  FROM bottle_row b
 CROSS JOIN LATERAL (VALUES ('exists', true), ('name', true), ('style', true), ('maker', true),
                            ('abv', b.abv IS NOT NULL), ('origin', b.country IS NOT NULL), ('gi', b.gi IS NOT NULL)) AS f(field, has)
 WHERE b.id IS NOT NULL AND f.has
ON CONFLICT ON CONSTRAINT "item_sources_one_per_page" DO NOTHING;

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;
DROP TABLE "flavor_jobs_before";

DROP TABLE "style_in", "made_now", "place_in", "maker_in", "bottle_in", "bottle_row", "renamed";
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.under(uuid, uuid);
DROP FUNCTION pg_temp.maker(text);
RESET "app.image_worker";


SET "app.image_worker" = 'on';
CREATE TEMP TABLE "flavor_jobs_before" AS SELECT * FROM "private"."item_flavor_jobs";

CREATE FUNCTION pg_temp.shared(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT public.resolve_ingredient(p_name);
$$;
CREATE FUNCTION pg_temp.style(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT i.id FROM public.items i
     WHERE i.item_type = 'ingredient' AND i.bar_id IS NULL AND i.ingredient_role = 'generic'
       AND public.ingredient_key(i.name) = public.ingredient_key(p_name)
     ORDER BY i.is_core DESC, i.created_at LIMIT 1;
$$;
-- Whether p_id sits under p_style (up to four levels down).
CREATE FUNCTION pg_temp.under(p_id uuid, p_style uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
    WITH RECURSIVE up AS (
        SELECT i.generic_id AS id, 1 AS d FROM public.items i WHERE i.id = p_id
        UNION ALL
        SELECT i.generic_id, up.d + 1 FROM up JOIN public.items i ON i.id = up.id WHERE up.d < 4
    )
    SELECT p_style IS NOT NULL AND EXISTS (SELECT 1 FROM up WHERE up.id = p_style);
$$;

-- ---------------------------------------------------------------------------
-- Styles
-- ---------------------------------------------------------------------------

-- The styles bottles file under here, and the style each is a kind of. Made
-- when missing; one that exists stays where it is.
CREATE TEMP TABLE style_in (ord int PRIMARY KEY, name text NOT NULL, kind_of text);
INSERT INTO style_in VALUES
(0, $q$Lager$q$, $q$Beer$q$),
(1, $q$Pilsner$q$, $q$Lager$q$),
(2, $q$Blond Lager$q$, $q$Lager$q$),
(3, $q$Pale Ale$q$, $q$Beer$q$),
(4, $q$IPA$q$, $q$Beer$q$),
(5, $q$Wheat Beer$q$, $q$Beer$q$),
(6, $q$Stout$q$, $q$Beer$q$),
(7, $q$Imperial Stout$q$, $q$Stout$q$),
(8, $q$Milk Stout$q$, $q$Stout$q$),
(9, $q$Porter$q$, $q$Beer$q$),
(10, $q$Sour Beer$q$, $q$Beer$q$),
(11, $q$Ale$q$, $q$Beer$q$),
(12, $q$Scotch Ale$q$, $q$Ale$q$),
(13, $q$Beer$q$, NULL),
(14, $q$Cider$q$, NULL),
(15, $q$Sparkling Cider$q$, $q$Cider$q$),
(16, $q$Perry$q$, $q$Cider$q$),
(17, $q$Non-alcoholic Beer$q$, $q$Non-alcoholic drink$q$),
(18, $q$Non-alcoholic IPA$q$, $q$Non-alcoholic Beer$q$),
(19, $q$Australian Sparkling Wine$q$, $q$Sparkling Wine$q$),
(20, $q$Sparkling Rosé$q$, $q$Sparkling Wine$q$),
(21, $q$Sparkling Shiraz$q$, $q$Sparkling Wine$q$),
(22, $q$Sparkling Natural Wine$q$, $q$Sparkling Wine$q$),
(23, $q$Blanc De Blancs$q$, $q$Sparkling Wine$q$),
(24, $q$Sparkling Wine$q$, $q$Wine$q$),
(25, $q$Apera$q$, $q$Sherry$q$),
(26, $q$Australian Tawny$q$, $q$Fortified Wine$q$),
(27, $q$Rutherglen Muscat$q$, $q$Fortified Wine$q$),
(28, $q$Rutherglen Topaque$q$, $q$Fortified Wine$q$),
(29, $q$Fortified Wine$q$, $q$Wine$q$),
(30, $q$Non-alcoholic Sparkling Wine$q$, $q$Non-alcoholic Wine$q$),
(31, $q$Alcohol Free White Wine$q$, $q$Non-alcoholic Wine$q$),
(32, $q$Alcohol Free Rosé Wine$q$, $q$Non-alcoholic Wine$q$),
(33, $q$Non-alcoholic Shiraz$q$, $q$Non-alcoholic Wine$q$),
(34, $q$Non-alcoholic Wine$q$, $q$Non-alcoholic drink$q$),
(35, $q$Red Wine$q$, $q$Wine$q$),
(36, $q$White Wine$q$, $q$Wine$q$),
(37, $q$Rosé Wine$q$, $q$Wine$q$),
(38, $q$Orange Wine$q$, $q$Wine$q$);

CREATE TEMP TABLE "made_now" ("id" uuid PRIMARY KEY);
DO $$
DECLARE s record; v uuid;
BEGIN
    FOR s IN SELECT * FROM style_in ORDER BY ord LOOP
        IF pg_temp.style(s.name) IS NULL AND pg_temp.shared(s.name) IS NULL THEN
            INSERT INTO public.items (name, item_type, ingredient_role, hide_from_search)
            VALUES (s.name, 'ingredient', 'generic', false) RETURNING id INTO v;
            INSERT INTO made_now VALUES (v);
            -- A new name can pick up a core suffix as its kind; set it as meant.
            UPDATE public.items SET generic_id = pg_temp.style(s.kind_of)
             WHERE id = v AND generic_id IS DISTINCT FROM pg_temp.style(s.kind_of);
        END IF;
    END LOOP;
END $$;

-- Place styles a bottle already filed under keeps, when the check gives only
-- the catch-all style.
CREATE TEMP TABLE place_in (name text PRIMARY KEY);
INSERT INTO place_in VALUES
($q$Australian Sparkling Wine$q$),
($q$Apera$q$);

-- ---------------------------------------------------------------------------
-- Maker pages
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE maker_in (name text PRIMARY KEY, handle text NOT NULL, website text, country text, part_of text);
INSERT INTO maker_in VALUES
($q$Andrew Garrett$q$, $q$andrew.garrett$q$, $q$https://www.andrewgarrett.com.au$q$, $q$AU$q$, NULL),
($q$Brown Brothers$q$, $q$brown.brothers$q$, $q$https://www.brownbrothers.com.au/$q$, $q$AU$q$, NULL),
($q$Croser$q$, $q$croser$q$, $q$https://croser.com.au/$q$, $q$AU$q$, NULL),
($q$Inner North Brewing Co.$q$, $q$inner.north.brewing.co$q$, $q$https://www.innernorthbrewing.com.au/$q$, $q$AU$q$, NULL),
($q$Land & Sea Brewery$q$, $q$land.sea.brewery$q$, $q$https://www.landandseabrewery.com/$q$, $q$AU$q$, NULL),
($q$Matso's$q$, $q$matso.s$q$, $q$https://matsos.com.au/$q$, $q$AU$q$, NULL),
($q$Mountain Monk Brewers$q$, $q$mountain.monk.brewers$q$, $q$https://mountainmonkbrewers.com.au/$q$, $q$AU$q$, NULL),
($q$Phat Brew Club$q$, $q$phat.brew.club$q$, $q$https://www.phatbrewclub.com/$q$, $q$AU$q$, NULL),
($q$Polka$q$, $q$polka$q$, NULL, $q$AU$q$, NULL),
($q$Seppeltsfield$q$, $q$seppeltsfield$q$, $q$https://seppeltsfield.com.au/$q$, $q$AU$q$, NULL);

-- A page per producer, unclaimed, public. A handle someone already uses is
-- left alone (that producer's bottles then name no maker).
INSERT INTO public.profiles (kind, handle, display_name, website, country_code, makes, is_public)
SELECT 'maker', m.handle, m.name, m.website, m.country, ARRAY[$q$bottles$q$], true
  FROM maker_in m
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = m.handle)
   AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(m.name));

CREATE FUNCTION pg_temp.maker(p_name text) RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT p.id FROM public.profiles p WHERE p.kind = 'maker' AND lower(p.display_name) = lower(p_name) LIMIT 1;
$$;

-- A maker page made by an earlier load that now makes bottles here too.
UPDATE public.profiles p SET makes = array_append(p.makes, $q$bottles$q$)
  FROM maker_in m
 WHERE p.id = pg_temp.maker(m.name) AND NOT ($q$bottles$q$ = ANY (p.makes));

UPDATE public.profiles p SET part_of_profile_id = pg_temp.maker(m.part_of)
  FROM maker_in m
 WHERE p.id = pg_temp.maker(m.name) AND m.part_of IS NOT NULL AND pg_temp.maker(m.part_of) IS NOT NULL
   AND p.part_of_profile_id IS DISTINCT FROM pg_temp.maker(m.part_of);

-- ---------------------------------------------------------------------------
-- Bottles
-- ---------------------------------------------------------------------------

-- catalog_name: the row we already have for this bottle, when there is one.
CREATE TEMP TABLE bottle_in (
    label_name text NOT NULL, catalog_name text, style text NOT NULL, producer text NOT NULL,
    abv numeric, country text, gi text, url text NOT NULL, kind text NOT NULL
);
INSERT INTO bottle_in VALUES
($q$Andrew Garrett Sparkling Shiraz$q$, NULL, $q$Sparkling Shiraz$q$, $q$Andrew Garrett$q$, 13, $q$AU$q$, NULL, $q$https://bws.com.au/product/65867/andrew-garrett-sparkling-shiraz$q$, $q$retailer$q$),
($q$Brown Brothers Australian Tawny$q$, NULL, $q$Australian Tawny$q$, $q$Brown Brothers$q$, NULL, $q$AU$q$, NULL, $q$https://brownfamilywines.com.au/collections/fortified-dessert$q$, $q$producer$q$),
($q$Brown Brothers Cellar Collection Grand Muscadelle$q$, NULL, $q$Fortified Wine$q$, $q$Brown Brothers$q$, NULL, $q$AU$q$, NULL, $q$https://brownfamilywines.com.au/collections/fortified-dessert$q$, $q$producer$q$),
($q$Brown Brothers Classic Prosecco$q$, NULL, $q$Australian Sparkling Wine$q$, $q$Brown Brothers$q$, NULL, $q$AU$q$, NULL, $q$https://brownfamilywines.com.au/collections/sparkling-brands-brown-brothers$q$, $q$producer$q$),
($q$Brown Brothers Prosecco Mid Strength$q$, NULL, $q$Australian Sparkling Wine$q$, $q$Brown Brothers$q$, 7, $q$AU$q$, NULL, $q$https://www.brownbrothers.com.au/our-wines/varietals-prosecco$q$, $q$producer$q$),
($q$Croser NV$q$, NULL, $q$Australian Sparkling Wine$q$, $q$Croser$q$, NULL, $q$AU$q$, $q$South Eastern Australia$q$, $q$https://croser.com.au/products/croser-nv-sparkling-3$q$, $q$producer$q$),
($q$Croser NV Blanc De Blancs$q$, NULL, $q$Blanc De Blancs$q$, $q$Croser$q$, NULL, $q$AU$q$, $q$South Eastern Australia$q$, $q$https://croser.com.au/products/croser-nv-blanc-de-blancs-new$q$, $q$producer$q$),
($q$Inner North Big Red$q$, NULL, $q$Ale$q$, $q$Inner North Brewing Co.$q$, 7.0, $q$AU$q$, NULL, $q$https://www.innernorthbrewing.com.au/product/big-red-375ml-cans/OZ4GUUFVT3B3L44CPOGEF26L$q$, $q$producer$q$),
($q$Inner North Flipside Pilsner$q$, NULL, $q$Pilsner$q$, $q$Inner North Brewing Co.$q$, 4.2, $q$AU$q$, NULL, $q$https://www.innernorthbrewing.com.au/product/flipside-pilsner-375ml-cans/K6TG5RSFXEWAPMQVX3T75WZ2$q$, $q$producer$q$),
($q$Inner North Hamster Wheel Didactics Hazy IPA$q$, NULL, $q$IPA$q$, $q$Inner North Brewing Co.$q$, 5.6, $q$AU$q$, NULL, $q$https://www.innernorthbrewing.com.au/product/hamster-wheel-didactics-hazy-ipa-375ml-cans/BOPJH4W5M4ZTGOEKEBGQYZHC$q$, $q$producer$q$),
($q$Inner North Nitro Irish Stout$q$, NULL, $q$Stout$q$, $q$Inner North Brewing Co.$q$, 5.0, $q$AU$q$, NULL, $q$https://www.innernorthbrewing.com.au/product/nitro-irish-stout-375ml-cans/TSG2NLVJ4KWIVSZ7DGRGYLDW$q$, $q$producer$q$),
($q$Inner North The Frenchy Pale$q$, NULL, $q$Pale Ale$q$, $q$Inner North Brewing Co.$q$, 5.5, $q$AU$q$, NULL, $q$https://www.innernorthbrewing.com.au/product/the-frenchy-pale-375ml-cans/TGE7MRKXQQML7X3JRV6LBKG5$q$, $q$producer$q$),
($q$Inner North When Life Gives You Lemongrass$q$, NULL, $q$Ale$q$, $q$Inner North Brewing Co.$q$, 4.3, $q$AU$q$, NULL, $q$https://www.innernorthbrewing.com.au/product/when-life-gives-you-lemongrass-375ml-cans/ZVO4EYHSI4GFZHNSBILR4JK4$q$, $q$producer$q$),
($q$Land & Sea First Point Pale Ale$q$, NULL, $q$Pale Ale$q$, $q$Land & Sea Brewery$q$, 4.5, $q$AU$q$, NULL, $q$https://www.landandseabrewery.com/beer-selection$q$, $q$producer$q$),
($q$Land & Sea Hazy Pale Ale$q$, NULL, $q$Pale Ale$q$, $q$Land & Sea Brewery$q$, 4, $q$AU$q$, NULL, $q$https://www.landandseabrewery.com/beer-selection$q$, $q$producer$q$),
($q$Land & Sea Japanese Rice Lager$q$, NULL, $q$Lager$q$, $q$Land & Sea Brewery$q$, 4.4, $q$AU$q$, NULL, $q$https://www.landandseabrewery.com/beer-selection$q$, $q$producer$q$),
($q$Land & Sea Little Cove Lager$q$, NULL, $q$Lager$q$, $q$Land & Sea Brewery$q$, 4.8, $q$AU$q$, NULL, $q$https://www.landandseabrewery.com/beer-selection$q$, $q$producer$q$),
($q$Land & Sea Middy$q$, NULL, $q$Pale Ale$q$, $q$Land & Sea Brewery$q$, 3.5, $q$AU$q$, NULL, $q$https://www.landandseabrewery.com/beer-selection$q$, $q$producer$q$),
($q$Land & Sea The Juicebox IPA$q$, NULL, $q$IPA$q$, $q$Land & Sea Brewery$q$, 6.5, $q$AU$q$, NULL, $q$https://www.landandseabrewery.com/beer-selection$q$, $q$producer$q$),
($q$Matso's Ginger Beer$q$, NULL, $q$Beer$q$, $q$Matso's$q$, NULL, $q$AU$q$, NULL, $q$https://matsos.com.au/drinks/ginger-beer/$q$, $q$producer$q$),
($q$Matso's Mango Beer$q$, NULL, $q$Beer$q$, $q$Matso's$q$, NULL, $q$AU$q$, NULL, $q$https://matsos.com.au/drinks/mango-beer/$q$, $q$producer$q$),
($q$Matso's Mr Matsumoto Premium Japanese Style Lager$q$, NULL, $q$Lager$q$, $q$Matso's$q$, NULL, $q$AU$q$, NULL, $q$https://matsos.com.au/drinks/mr-matsumoto-premium-japanese-style-lager/$q$, $q$producer$q$),
($q$Mountain Monk Cold IPA$q$, NULL, $q$IPA$q$, $q$Mountain Monk Brewers$q$, 6, $q$AU$q$, NULL, $q$https://mountainmonkbrewers.com.au/brews?filter=core$q$, $q$producer$q$),
($q$Mountain Monk Dark Ale$q$, NULL, $q$Ale$q$, $q$Mountain Monk Brewers$q$, 4, $q$AU$q$, NULL, $q$https://mountainmonkbrewers.com.au/brews?filter=core$q$, $q$producer$q$),
($q$Mountain Monk Ekuanot IPA$q$, NULL, $q$IPA$q$, $q$Mountain Monk Brewers$q$, 6.7, $q$AU$q$, NULL, $q$https://mountainmonkbrewers.com.au/brews?filter=core$q$, $q$producer$q$),
($q$Mountain Monk Hazy Pale Mid$q$, NULL, $q$Pale Ale$q$, $q$Mountain Monk Brewers$q$, 3.5, $q$AU$q$, NULL, $q$https://mountainmonkbrewers.com.au/brews?filter=core$q$, $q$producer$q$),
($q$Mountain Monk Holy Lager!$q$, NULL, $q$Lager$q$, $q$Mountain Monk Brewers$q$, 4.5, $q$AU$q$, NULL, $q$https://mountainmonkbrewers.com.au/brews?filter=core$q$, $q$producer$q$),
($q$Mountain Monk Pale Ale$q$, NULL, $q$Pale Ale$q$, $q$Mountain Monk Brewers$q$, 4.5, $q$AU$q$, NULL, $q$https://mountainmonkbrewers.com.au/brews?filter=core$q$, $q$producer$q$),
($q$Mountain Monk Raspberry Sour$q$, NULL, $q$Sour Beer$q$, $q$Mountain Monk Brewers$q$, 4.5, $q$AU$q$, NULL, $q$https://mountainmonkbrewers.com.au/brews?filter=core$q$, $q$producer$q$),
($q$Phat Brew Club Culture of Good Times$q$, NULL, $q$IPA$q$, $q$Phat Brew Club$q$, NULL, $q$AU$q$, NULL, $q$https://www.phatbrewclub.com/beers$q$, $q$producer$q$),
($q$Phat Brew Club Hazy Mid$q$, NULL, $q$Pale Ale$q$, $q$Phat Brew Club$q$, NULL, $q$AU$q$, NULL, $q$https://www.phatbrewclub.com/beers$q$, $q$producer$q$),
($q$Phat Brew Club OG Pale Ale$q$, NULL, $q$Pale Ale$q$, $q$Phat Brew Club$q$, NULL, $q$AU$q$, NULL, $q$https://www.phatbrewclub.com/beers$q$, $q$producer$q$),
($q$Phat Brew Club Phubba Bubba$q$, NULL, $q$Sour Beer$q$, $q$Phat Brew Club$q$, NULL, $q$AU$q$, NULL, $q$https://www.phatbrewclub.com/beers$q$, $q$producer$q$),
($q$Phat Brew Club Risky Business$q$, NULL, $q$IPA$q$, $q$Phat Brew Club$q$, NULL, $q$AU$q$, NULL, $q$https://www.phatbrewclub.com/beers$q$, $q$producer$q$),
($q$Phat Brew Club West Is Best Lager$q$, NULL, $q$Lager$q$, $q$Phat Brew Club$q$, NULL, $q$AU$q$, NULL, $q$https://www.phatbrewclub.com/beers$q$, $q$producer$q$),
($q$Phat Brew Club Xtra Phat Ale$q$, NULL, $q$Pale Ale$q$, $q$Phat Brew Club$q$, NULL, $q$AU$q$, NULL, $q$https://www.phatbrewclub.com/beers$q$, $q$producer$q$),
($q$Polka Lilly Pilly De-Alc Sparkling$q$, NULL, $q$Non-alcoholic Sparkling Wine$q$, $q$Polka$q$, NULL, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_6035547/polka-lilly-pilly-de-alc-sparkling$q$, $q$retailer$q$),
($q$Polka Non-Alc Davidson Plum Sparkling Rosé$q$, NULL, $q$Non-alcoholic Sparkling Wine$q$, $q$Polka$q$, NULL, $q$AU$q$, NULL, $q$https://www.danmurphys.com.au/product/DM_6081841/polka-non-alc-davidson-plum-sparkling-ros-$q$, $q$retailer$q$),
($q$Seppeltsfield 100 Year Old Para Vintage Tawny$q$, NULL, $q$Australian Tawny$q$, $q$Seppeltsfield$q$, NULL, $q$AU$q$, NULL, $q$https://seppeltsfield.com.au/shop/centennial-collection/$q$, $q$producer$q$),
($q$Seppeltsfield 21 Year Old Para Tawny$q$, NULL, $q$Australian Tawny$q$, $q$Seppeltsfield$q$, NULL, $q$AU$q$, NULL, $q$https://seppeltsfield.com.au/fortified-wines/$q$, $q$producer$q$),
($q$Seppeltsfield Para Grand Tawny$q$, NULL, $q$Australian Tawny$q$, $q$Seppeltsfield$q$, NULL, $q$AU$q$, NULL, $q$https://seppeltsfield.com.au/fortified-wines/$q$, $q$producer$q$),
($q$Seppeltsfield Para Rare Tawny$q$, NULL, $q$Australian Tawny$q$, $q$Seppeltsfield$q$, NULL, $q$AU$q$, NULL, $q$https://seppeltsfield.com.au/fortified-wines/$q$, $q$producer$q$);

-- Which row each bottle is: the catalog's row (by its name or an alias), else
-- one already called by the label name. A style or a house prep by that name
-- isn't a bottle, so it's left alone. Two checks that land on one row keep the
-- producer's own page.
CREATE TEMP TABLE bottle_row AS
SELECT DISTINCT ON (COALESCE(x.id::text, public.ingredient_key(x.label_name))) x.*
  FROM (SELECT b.*, COALESCE(pg_temp.shared(b.catalog_name), pg_temp.shared(b.label_name)) AS id FROM bottle_in b) x
 ORDER BY COALESCE(x.id::text, public.ingredient_key(x.label_name)), (x.kind = 'producer') DESC, (x.abv IS NOT NULL) DESC,
          length(x.label_name) DESC, x.label_name;
DELETE FROM bottle_row b USING public.items i
 WHERE i.id = b.id AND (i.ingredient_role IN ('generic', 'prep') OR i.is_core OR i.bar_id IS NOT NULL);

-- New bottles.
WITH ins AS (
    INSERT INTO public.items (name, item_type, ingredient_role, hide_from_search, generic_id, brand_maker, abv, origin_country, gi, maker_profile_id)
    SELECT DISTINCT ON (public.ingredient_key(b.label_name))
           b.label_name, 'ingredient', 'product', false, pg_temp.style(b.style), b.producer, b.abv, b.country, b.gi, pg_temp.maker(b.producer)
      FROM bottle_row b
     WHERE b.id IS NULL AND pg_temp.style(b.style) IS NOT NULL
    RETURNING id, name
)
UPDATE bottle_row r SET id = ins.id FROM ins WHERE r.id IS NULL AND public.ingredient_key(r.label_name) = public.ingredient_key(ins.name);

-- The style each bottle we had files under: the checked one, unless the row
-- already sits under it (a narrower style) or under a place style and the
-- check gave only the catch-all.
ALTER TABLE bottle_row ADD COLUMN style_id uuid;
UPDATE bottle_row b SET style_id = CASE
    WHEN pg_temp.under(b.id, pg_temp.style(b.style)) THEN (SELECT i.generic_id FROM public.items i WHERE i.id = b.id)
    WHEN b.style IN ($q$Beer$q$, $q$Cider$q$, $q$Sparkling Wine$q$, $q$Fortified Wine$q$, $q$Wine$q$) AND EXISTS (
         SELECT 1 FROM public.items i JOIN public.items g ON g.id = i.generic_id JOIN place_in p ON public.ingredient_key(p.name) = public.ingredient_key(g.name)
          WHERE i.id = b.id) THEN (SELECT i.generic_id FROM public.items i WHERE i.id = b.id)
    ELSE pg_temp.style(b.style) END
 WHERE b.id IS NOT NULL;

-- Bottles we had: a bottle, its checked style, and what was missing.
UPDATE public.items i SET
    ingredient_role = 'product',
    made_from_id = NULL,
    generic_id = b.style_id,
    brand_maker = COALESCE(NULLIF(btrim(i.brand_maker), ''), b.producer),
    abv = COALESCE(i.abv, b.abv),
    origin_country = COALESCE(i.origin_country, b.country),
    gi = COALESCE(i.gi, b.gi),
    maker_profile_id = COALESCE(i.maker_profile_id, pg_temp.maker(b.producer))
  FROM bottle_row b
 WHERE i.id = b.id AND b.style_id IS NOT NULL
   AND (i.ingredient_role IS DISTINCT FROM 'product' OR i.made_from_id IS NOT NULL
        OR i.generic_id IS DISTINCT FROM b.style_id
        OR (i.abv IS NULL AND b.abv IS NOT NULL) OR (i.origin_country IS NULL AND b.country IS NOT NULL)
        OR (i.gi IS NULL AND b.gi IS NOT NULL) OR (i.maker_profile_id IS NULL AND pg_temp.maker(b.producer) IS NOT NULL)
        OR NULLIF(btrim(i.brand_maker), '') IS NULL);

-- The label name, brand first; the old name stays an alias. Skipped when
-- another shared row already has it.
SET "app.ingredient_merge" = 'on';
CREATE TEMP TABLE "renamed" AS
SELECT DISTINCT ON (b.id) b.id, i.name AS old_name, b.label_name AS new_name
  FROM bottle_row b JOIN public.items i ON i.id = b.id
 WHERE public.ingredient_key(i.name) <> public.ingredient_key(b.label_name)
   AND NOT EXISTS (
       SELECT 1 FROM public.items o
        WHERE o.item_type = 'ingredient' AND o.bar_id IS NULL AND o.id <> b.id
          AND public.ingredient_key(o.name) = public.ingredient_key(b.label_name));
UPDATE public.items i SET name = r.new_name FROM renamed r WHERE i.id = r.id;
DELETE FROM public.ingredient_aliases a USING renamed r WHERE a.key = public.ingredient_key(r.new_name);
INSERT INTO public.ingredient_aliases (key, item_id)
SELECT public.ingredient_key(r.old_name), r.id FROM renamed r
ON CONFLICT (key) DO UPDATE SET item_id = EXCLUDED.item_id;
RESET "app.ingredient_merge";

-- Where each fact was checked.
INSERT INTO public.item_sources (item_id, field, url, kind, checked_on)
SELECT DISTINCT b.id, f.field, b.url, b.kind, DATE '2026-10-14'
  FROM bottle_row b
 CROSS JOIN LATERAL (VALUES ('exists', true), ('name', true), ('style', true), ('maker', true),
                            ('abv', b.abv IS NOT NULL), ('origin', b.country IS NOT NULL), ('gi', b.gi IS NOT NULL)) AS f(field, has)
 WHERE b.id IS NOT NULL AND f.has
ON CONFLICT ON CONSTRAINT "item_sources_one_per_page" DO NOTHING;

-- --- Put the flavour job queue back ---
DELETE FROM "private"."item_flavor_jobs" j
WHERE NOT EXISTS (SELECT 1 FROM "flavor_jobs_before" o WHERE o.item_id = j.item_id);
UPDATE "private"."item_flavor_jobs" j SET
    "status" = o.status, "revision" = o.revision, "attempts" = o.attempts, "run_after" = o.run_after,
    "lease_until" = o.lease_until, "last_error" = o.last_error, "updated_at" = o.updated_at
FROM "flavor_jobs_before" o
WHERE j.item_id = o.item_id AND j.revision <> o.revision;
DROP TABLE "flavor_jobs_before";

DROP TABLE "style_in", "made_now", "place_in", "maker_in", "bottle_in", "bottle_row", "renamed";
DROP FUNCTION pg_temp.shared(text);
DROP FUNCTION pg_temp.style(text);
DROP FUNCTION pg_temp.under(uuid, uuid);
DROP FUNCTION pg_temp.maker(text);
RESET "app.image_worker";
