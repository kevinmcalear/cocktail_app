import fs from 'fs';

const rawData = [
  ["Grey Goose", "Vodka", "40% ABV from picardi in cognac france.\nsoft winter wheat"],
  ["Belvedere", "Vodka", "40% ABV\nBelvedere is one of the longest operating Polish distilleries, producing vodka since 1910\nFull and round with medium body and a naturally smooth, rich and velvety texture. Light vanilla notes sway between sweet and savory, with a hint of black pepper and spice."],
  ["Beefeater", "Gin", "40% ABV\nbold juniper, strong citrus.\nonly historic dry gin distilled in heart of london, 200 years of history, worlds most awarded gin"],
  ["Furneaux Untamed gin", "Gin", "42% ABV\nForaged botanicals, Native fennel, native rosemary"],
  ["Never Never triple juniper", "Gin", "43% ABV\njuniper infused 3 ways, vapor, maceration and in still.\nFrom SA\nest 2016 uses all trad botanicals except pepperberry"],
  ["Never Never Oyster shell", "Gin", "42% ABV\nmade in collab with Society restaurant in Melbourne\noyster shells from Kangaroo island,\nwaxflower, salt bush, grapefruit, seaweed. round mint + coastal mint."],
  ["Never Never Beeswax & Olive", "Gin", "41% ABV\nmade in collab with Mybe Sammy in NSW.\nlaguaian beeswax and raw honey from Kangaroo island.\nolive brine, bay leaf, almond."],
  ["Never Never Southern Strength", "Gin", "52% ABV\nsame botanicals as the triple juniper, just differing ratios.\nviscous, earthy notes of coriander and angelica"],
  ["Four Pillars Rare dry", "Gin", "41.8% ABV\nHealsville Vic,\n2013 est\norange, lemon myrtle, green cardamon, cassia bark, star anise, lavender, pepperberry\n\nclassic dry style gin, juniper with citrus"],
  ["Four Pillars yuzu", "Gin", "41.8% ABV\nVictorian mountain yuzu, based in Beachworth.\nginger, genmaicha, turmeric, finger lime, dried apple."],
  ["Four Pillars Leaf", "Gin", "43.8 ABV\nolive leaf tea, bay leaf, olive oil, macadamia,"],
  ["Four Pillars Bloody Shiraz 2023", "Gin", "38.7% ABV\nrare dry as a base with cool climate shiraz macerated."],
  ["Ester dry", "Gin", "43% ABV\nclassic elegant style.\nFelix & Corina from Sydney, started distilling at the back a cafe they owned.\nwell balanced, finger lime and maderine."],
  ["Ester strong", "Gin", "57% ABV\nformer worlds best navy strength gin.\nintense, bright with pine forest notes.\ntaz pepperberry"],
  ["Jinzu", "Gin", "41.3% ABV\ncreated by a bartender Dee Davies, won a Diageo comp and set up a business.\nHead in Britain and heart in Japan.\nyuzu, sake, cherry blossom"],
  ["Hendricks", "Gin", "41.4% ABV\ndistilled in Scotland\nest 1886\ncucumber and rose petals added post distillation."],
  ["Plymouth", "Gin", "41.2% ABV\nsince 1793\ndry style, known for big body and cut with dartmoor water.\nNo longer protected they are the only distillery to still use the Plymouth style."],
  ["Plymouth sloe", "Gin", "26% ABV\nsteeped in sloe berries (common pest in England) sweetened post. With juice also added.\ncut with hard Dartmoor water."],
  ["Jung One", "Gin", "47% ABV\nFirst Single Malt spirit from Korea, located 30km north of Seoul.\nGrows own barley and malts in house.\n11 unique botanicals including pine, lavender, baby ginseng, chopi, perilla\nAll botanicals locally sourced, no more than 50km radius from distillery"],
  ["Boatyard Double Gin", "Gin", "46% ABV\nWheat spirit\n8 botanicals\nFrom Ireland"],
  ["Havana 3yr", "White Rum", "40% ABV\n3 yr old, late 19th century distillery\n\nhint of oak, grassy, cirtusy, light fruit"],
  ["Wrey & Nephew", "White Rum", "63% ABV\npunchy, fruity, dry, estery\nKingston distillery, bi-centenary 2025"],
  ["El Amparo", "White Rum", "60% ABV\nEcuador, aguadiente"],
  ["Plantation Dark", "Dark Rum", "40% ABV\nliquids from Barbados and Jamacia\nexotic fruits, spicey and sweet\nFrench owned and bottled in france. Maison Ferand"],
  ["Diplomatico Ex Reserva", "Dark Rum", "40% ABV\nVenezuela aged up to 12yrs\noak and vanilla, long lasting flavor and body"],
  ["Gosling black seal", "Dark Rum", "40% ABV\nBermuda\n1857 est\naged in charred american oak\nsweet spices, stewed fruit, vanilla"],
  ["Ratu 5yr spiced rum", "Dark Rum", "40% ABV\nFiji located\n100% column still, aged in aged bourbon barrels with mocha oak chips\nvanilla, star anise, candied orange"],
  ["Glenfarclas 10yr", "Scotch", "40% abv\nSpeyside\n100% oloroso cask\nlight, dried fruit, vanilla, cinnamon and cloves"],
  ["Tullibardine 225", "Scotch", "43% ABV\nHighland\n225L Sauternes cask finish\nTropical pineapple, orange zest, creamy finish"],
  ["The Balvenie Double Wood", "Scotch", "40% ABV\nSpeyside\nWhisky oak and Sherry oak\nHoney, vanilla, cinnamon"],
  ["Laphroaig Oak Select", "Scotch", "40% ABV\nIslay\n5 cask blend: oloroso, px and ex-bourbon barrels\nFinished in new American oak\nMedicinal peat, seaweed, red fruit, lime, floral"],
  ["Lagavulin 8", "Scotch", "48% ABV\nIslay\nLight texture, minty, dark chocolate, salty, smoky\nInitially released as a special edition for 200th anniversary of distillery, but added to core range due to popular demand"],
  ["Jonny Walker Blue label", "Scotch", "40% ABV\nchocolate, grass and malt.\nBest malts in diageo portfolio. over 25 distilleries make up the bulk of the blend"],
  ["Compass Box Nectarosity", "Scotch", "46% ABV\nCompass Box don't consider themselves distillers, but they are also not Blenders. They refer to themselves as \"Whiskymakers\"\nBlending room in Richmond, London\nA blend of grain whisky and malt whisky\nHoney, lychee, pineapple, apricot, toffee and vanilla"],
  ["Thompson Bro's Orkney", "Scotch", "54% ABV\n10YO 2011\nEarthy peat, toffee, almond paste, black pepper, smoked bacon, oily"],
  ["Michters Rye", "American", "42.4% ABV\npeppery, citrus, oak"],
  ["Del Bac Classic", "American", "46% ABV\nArizona (Tucson) Single Malt, Sonoran desert\n100% new American oak\nSweet caramel and oak\nEvery part of distilling process done on site"],
  ["Whistle Pig Piggyback Bourbon", "American", "50% ABV\nShoreham, Vermont\nHigh Corn mashbill\nMaple and vanilla, creamy mouthfeel"],
  ["Willet Pot Still Reserve", "American", "47% ABV\ncaramel, villa, spice, citrus\nBottle release 2008\npot still shaped bottle using the blueprints of the still\n1936 established"],
  ["Basil Haydens cask", "American", "40% ABV finished in California red wine casks\nSweeeeeeet Ambrosia, from Jim Beam distillery"],
  ["Michters Bourbon", "American", "45.7% ABV Caramel, vanilla, stone fruits"],
  ["Michters 10 year Straight Rye", "American", "46.4% ABV\nVanilla, toffee, cinnamon, crushed pepper, orange citrus"],
  ["Furneaux Peated", "Australian", "47.9 ABV\nPeat from Flinders island\nMade on flinders island, maritime climate, crystal clear water"],
  ["Cape Byron", "Australian", "47% ABV\nVanilla, macadamia, biscotti, creme brulee\nCo created Jim McCuan from Bruchladdie distillery in Islay"],
  ["King Lake Distillery", "Australian", "46% ABV\nuse of 4 different malts\n3 Malts from NSW\n1 from Scotland -\nHeavy oily spirit, repurposed barrels, recoopered in Aus"],
  ["Fernaux Smoky Wedding", "Australian", "46.2% ABV\nMalt from flinders Island and from Scotland\nSpice, smoke"],
  ["Ocho Plata tequila", "Tequila", "40% ABV\nOcho due to links to number 8\n1. made in 2008\n2. average age of agave plant\n3. 8kg of agave makes 1L of tequila\nSingle estate, highlands of Jalisco\ngrassy, earthy notes, soft sweetness"],
  ["Arette Blanco", "Tequila", "38% ABV Jalisco\n100% independently owned\nfrom Mex trade\none of the oldest distilleries in the region.\nnamed after Arette the horse, 1st gold medal in 1948 Olympics.\nPeach, apricot, cirus"],
  ["Arette repo sauve", "Tequila", "38% ABV jalisco\nrested in ex bourbon barrels"],
  ["Forteleza Blanco", "Tequila", "40% ABV\n150 yr old history, 5 generations of distillers. Jalisco\nAgave tohona crushed fruits, hand blown bottles, pina corks are hand crafted,\ncooked agave, basil, olive, lime"],
  ["Tapatio Blanco", "Tequila", "40% ABV\nProduced at La Altena Distillery in the highlands of Arandas in Jalisco,Mexico.\nButter, butterscotch, hint of pepper"],
  ["Union Mezcal", "Mezcal", "40% ABV\ncombination of Espadin & Cirial agave plants\nMinty, herbal, soft smoke\nOaxaca"],
  ["Ofrenda (Bat & Hummingbird)", "Mezcal", "44% ABV\nbottled in 2022 for the Cinco de Mayo festival with marrigold flowers.\nbat and hummingbird pictured as they are the primary pollinators of agave in the area\nBought in oaxaca in 2024"],
  ["Origin Raiz - Madrecuixe", "Mezcal", "48% ABV\nOaxacan\nwild ferment, open wooden\npinas are cooked underground with volcanic stones\nbrand is a marriage of 2 brands, darungan and oaxacan.\nripe strawberry, violet, green herbs, campari (esq) finish"],
  ["Dixeebe", "Mezcal", "50% ABV - 4th edition\n100% Espadin\ndixeebe is a sacred word for giving thanks\ncloves, baked, agave, cacao"],
  ["In Situ", "Mezcal", "46% ABV\n2018 bottling\nagave takes up to 25 years to mature\nbought direct from bottler in oaxaca in 2024"],
  ["Mayalen Borrego", "Mezcal", "49% ABV\nGuerro agave\npachuga style\nduring 3rd didstilation, leg of lamb in suspended in the still."],
  ["Derumbas Michoacan", "Mezcal", "47.7% ABV\nTzitzio, Michocan territory\nHot terroir\nTropical and funky"],
  ["5 Sentidos Espadin Capon", "Mezcal", "49% ABV\nMade with Espadin Capon agave, up to 15 year maturity\nDouble distilled in Claypot\nTastes like sweet cream, candy apple, cinnamon and minerality"],
  ["Toki", "Japanese Whisky", "• 40% ABV\n• blended Irish whiskey, aged a minimum of 4 years\n• Est. 1780 in Dublin. Production now in Midleton, cork county\n• Spicy, nutty, vanilla"],
  ["Takesuru pure malt", "Japanese Whisky", "43% ABV\nblend of spirits from 2 distilleries\n70% Yoiochi coastal malt, slight smoke.\nsmooth mouth feel, rich balance"],
  ["Nikka Days", "Japanese Whisky", "40% ABV\nA blend of grain and lightly peated malt whiskies\nsilky mouthfeel and fruity flavours"],
  ["Jameson", "Irish Whiskey", "• 40% ABV\n• blended Irish whiskey, aged a minimum of 4 years\n• Est. 1780 in Dublin. Production now in Midleton, cork county\n• Spicy, nutty, vanilla"],
  ["Green Spot Chateau Montelena", "Irish Whiskey", "46% ABV\naged 10 years\nFinished for 12 months in French oak Zinfadel barrels from Napa Valley\nRipe orchard fruit, zesty citrus, red berries, touch of marzipan"],
  ["Stauning Rye", "World", "48% ABV\n3-4 yrs aged\nDanish distillery\n100% locally sourced ingredients\nRye and barley is floor malted\nrye bread, peppery oak, cherry & dried fruit. finished in american oak"],
  ["Ichiros Malt & Grain", "World", "46.5% ABV\nChicbu distillery, Saitama preficture (state) 100km from Tokyo\ncreated by Ichiro Akuto 2008 family of Sake brewers.\nSpirit from Japanese, American, Irish and Scottish. Then aged 1-3yrs extra in Japan"],
  ["Infrequent Flyers Braeval distillery", "independant", "62.5% ABV\nSpeyside\n13 years old, cask strength\nFinished in Valpolicella hogshead\nMalty, spice, bittersweet chocolate\nAlistair Walker, Indie bottler specialising in lesser known distillers"],
  ["Ardnamurchan CK.475", "independant", "59.2% ABV\nSpecial Bottling for Whisky and Alement\nWest Highlands, ets 2014\nBlue bottle signifies single cask"],
  ["Thompson Bro's Linkwood", "independant", "55.7% ABV\nSpeyside\n2011 Vintage\nAged 10 years\nAustralian Exclusive\nThompson Bro's is indie bottler from Dornoch distillery est. 2016"],
  ["Thompson Bro's Inchgower", "independant", "50% ABV\nSpeyside\n2010 Vintage\nAged 11 years\nRefill hogshead, finished for 6 months in stout cask\nThompson Bro's is indie bottler from Dornoch distillery est. 2016"],
  ["Blind Summit Lochindaal", "independant", "50% Bottled\n36 bottles in global distribution\nheavily peated\n1/8th of cask ever sold\nBruchladdie short age\nlife savings of a friends father."],
  ["Ono Sotol", "Sotol", "45% ABV not an agave plant, dasylirion plant (desert spoon)\ndistant relative to agave\nHarvested properly, can regenerate unlike agave.\nRipe fruits and earthy notes"],
  ["La Venenosa tabernas 3rd Ed", "raicillia", "44.5% ABV\nopen distilling house.\n2 agaves, maximilliana + chico aguaiar\nJalisco, DOP 2019. 2011 brand, estoban morales (chef and maestro)\nsmoke, sweet agave, citric fruits, earth"],
  ["La Venenosa costa Jalisco (green)", "raicillia", "45.2% ABV\n700m above sea level distilled\ncoastal agaves\namarillo + chico aguiar\ncoriander, menthol, spice, lemongrass"],
  ["Amaro Nonino", "Amaro", "• 35% ABV\n• Friuli, Italy\n• Grape distillate (grappa distillery)\n• Elegant, balanced, herbaceous"],
  ["Amaro Montenegro", "Amaro", "• 23% ABV\n• Est. 1885, Bologna, Italy\n• 40 botanicals\n• Sweet citrus, butter and herbaceous\n• Named after Princess Elena of Montenegro, who married future King Victor Emmanuel III of Italy"],
  ["Campari", "Amaro", "• 25% ABV\n• Milan, Italy\n• Complex herbal, orange, floral, bitter\n• Originally coloured with carmine dye (crushed cochineal insects). Stopped using the dye in 2006"],
  ["Cynar", "Amaro", "• 16.5% ABV\n• Venice, Italy\n• Comprised of 13 herbs and spices, predominantly artichoke\n• Bittersweet flavour"],
  ["Aperol", "Amaro", "• 11% ABV\n• Venice, Italy\n• Gentian, rhubarb and cinchona are key ingredients\n• Herbal, bittersweet"],
  ["Braulio", "Amaro", "• 21% ABV\n• Bormio, northern Italy\n• Est. 1875\n• Alpine amaro, 100% mountain ingredients\n• Balsamic, robust, herbal"],
  ["Averna", "Amaro", "• 29% ABV\n• Sicily, Italy\n• Est. 1868\n• Bitter orange, sweet, spicy, Mediterranean herbs"],
  ["Picon Biere", "Amaro", "• 18% ABV\n• 1837 product conception\n• Oranges and gentian\n• Rich, spicy, fruity"],
  ["Fernet Branca", "Amaro", "• 39% ABV\n• Milan, Italy\n• Est. 1845\n• Recipe has never changed\n• Aged 12 months in oak barrels\n• Woody, tannic, balsamic, minty"],
  ["Branca Menta", "Amaro", "• 28% ABV\n• Minted version of fernet branca\n• More sugar and peppermint oil\n• First released in the 1960s"],
  ["Lairds Applejack 86", "brandy(ish)", "• 43% ABV\n• New Jersey, USA\n• \"First American Spirit\"\n• 17 pounds of fresh apples to produce 1 bottle"],
  ["Barsol Quebranta", "brandy(ish)", "• 41.3% ABV\n• Ica, Peru\n• Pear/apple, nutty, citrus, dark chocolate, cereal\n• Only 8 varieties of grapes can be used in Pisco production. Quebranta is a non-aromatic varietal, and predominant style of Pisco made"],
  ["Martel VS", "Brandy", "• 40% ABV\n• Est. 1715, over 300 years of history\n• Intense fruit, smooth"],
  ["Lillet Blanc", "Fortified", "17% ABV\nFrench aperitif\nlight, crisp, delicate citrus\nPrimarily semillion and Sauvingon Blanc\nAged in oak barrels\nVEGAN!"],
  ["Valdespino Fino Sherry", "Fortified", "15% ABV\n6 centuries of sherry production\nsolera\nMatured under flor for 8 years\ndry, fresh, full, complex fruit"],
  ["Lustau Amontillado", "Fortified", "18.5% ABV\nPalomino grapes\nRich, nutty flavour\nAged for equal periods under flor and with oxygen contact\nsince 1896"],
  ["Barbadillo Oloroso", "Fortified", "18% ABV\nNo flor\nAged 5 years\nRich palate, toffee notes\n1821 Sanclur De Barrameda (costal town)"],
  ["Dolin Dry Vermouth", "Fortified", "17.5% ABV\n15 unique botanicals, Ugni Blanc\nSlightly sweet, almond, citrus, balsamic"],
  ["Cinzano Rosso Vermouth", "Fortified", "14.4% ABV\nHint of sweetness opens to spices and complex bitterness before a botanical finish of artemisia\n1757"]
];

function generateMarkdown() {
  let md = "# Caretakers Cottage Ingredients Review\n\n";
  md += "| Generated Name | Original Name | Type | Description |\n";
  md += "| --- | --- | --- | --- |\n";

  for (const [name, type, descText] of rawData) {
    // Determine combined name
    let combinedName = name;
    const typeLower = type.toLowerCase();
    const nameLower = name.toLowerCase();
    
    // If the name doesn't already end with the type, or include it, we append it.
    // E.g. "Boatyard Double Gin" has "Gin", so we don't append "Gin".
    if (!nameLower.includes(typeLower)) {
      combinedName = `${name} ${type}`;
    } else {
      // Fix instances like "Furneaux Untamed gin" by Title Casing the gin
      combinedName = name.replace(/gin$/i, "Gin").replace(/rum$/i, "Rum");
    }

    // Prepare description
    // Replace newlines with <br> for table friendliness
    let descLine = descText.replace(/\n/g, "<br>");
    descLine += "<br><br>***Caretakers Cottage back bar***";

    md += `| ${combinedName} | ${name} | ${type} | ${descLine} |\n`;
  }

  return md;
}

const tableMd = generateMarkdown();
fs.writeFileSync('/Users/kevinmcalear/.gemini/antigravity/brain/888208e5-c04c-4c3f-aa75-754e80192751/ingredients_to_review.md', tableMd);
console.log('Markdown table written!');
