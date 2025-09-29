export interface Cocktail {
  id: string;
  name: string;
  description: string;
  ingredients: string[];
  instructions: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  prepTime: string;
  image?: string;
}

export const cocktails: Cocktail[] = [
  {
    id: "1",
    name: "Caretaker's Classic Old Fashioned",
    description:
      "A timeless whiskey cocktail with a Caretaker's twist - muddled with fresh orange and a hint of maple syrup.",
    image: "old-fashioned",
    ingredients: [
      "2 oz Bourbon Whiskey",
      "1/2 oz Maple Syrup",
      "2 dashes Angostura Bitters",
      "Orange peel",
      "Cherry for garnish",
    ],
    instructions:
      "Muddle orange peel with maple syrup in a glass. Add whiskey and bitters with ice. Stir well and strain over fresh ice. Garnish with orange peel and cherry.",
    category: "Classic",
    difficulty: "Easy",
    prepTime: "5 minutes",
  },
  {
    id: "2",
    name: "Garden Party Gin Fizz",
    description:
      "A refreshing gin cocktail featuring fresh herbs from the cottage garden.",
    image: "gin-fizz",
    ingredients: [
      "2 oz Gin",
      "1 oz Fresh Lemon Juice",
      "1/2 oz Simple Syrup",
      "Fresh Basil Leaves",
      "Soda Water",
      "Egg White (optional)",
    ],
    instructions:
      "Shake gin, lemon juice, simple syrup, and basil with ice. Double strain into a highball glass with fresh ice. Top with soda water and garnish with fresh basil.",
    category: "Garden Fresh",
    difficulty: "Easy",
    prepTime: "4 minutes",
  },
  {
    id: "3",
    name: "Smoky Maple Manhattan",
    description:
      "A sophisticated Manhattan with smoky undertones and Caretaker's signature maple finish.",
    image: "manhattan",
    ingredients: [
      "2 oz Rye Whiskey",
      "1 oz Sweet Vermouth",
      "1/4 oz Maple Syrup",
      "2 dashes Orange Bitters",
      "Smoked Cherry for garnish",
    ],
    instructions:
      "Stir all ingredients with ice in a mixing glass. Strain into a chilled coupe glass. Garnish with a smoked cherry.",
    category: "Classic",
    difficulty: "Medium",
    prepTime: "6 minutes",
  },
  {
    id: "4",
    name: "Cottage Sunset Margarita",
    description:
      "A tropical margarita with fresh citrus and a beautiful sunset gradient.",
    image: "margarita",
    ingredients: [
      "2 oz Tequila",
      "1 oz Fresh Lime Juice",
      "1/2 oz Orange Liqueur",
      "1/2 oz Agave Syrup",
      "Grenadine for color",
      "Salt rim",
    ],
    instructions:
      "Rim glass with salt. Shake tequila, lime juice, orange liqueur, and agave with ice. Strain into glass. Slowly pour grenadine for sunset effect.",
    category: "Tropical",
    difficulty: "Easy",
    prepTime: "5 minutes",
  },
  {
    id: "5",
    name: "Heritage Whiskey Sour",
    description:
      "A traditional whiskey sour elevated with Caretaker's house-made simple syrup.",
    image: "whiskey-sour",
    ingredients: [
      "2 oz Bourbon",
      "1 oz Fresh Lemon Juice",
      "3/4 oz Simple Syrup",
      "1 Egg White",
      "Angostura Bitters",
      "Lemon wheel for garnish",
    ],
    instructions:
      "Dry shake egg white with lemon juice and simple syrup. Add whiskey and ice, shake again. Double strain into a rocks glass. Add bitters on top and garnish with lemon wheel.",
    category: "Classic",
    difficulty: "Medium",
    prepTime: "7 minutes",
  },
  {
    id: "6",
    name: "Cottage Garden Spritz",
    description:
      "A light and refreshing spritz featuring seasonal herbs and flowers.",
    image: "spritz",
    ingredients: [
      "1.5 oz Aperol",
      "3 oz Prosecco",
      "1 oz Soda Water",
      "Fresh Mint",
      "Edible Flowers",
      "Orange Slice",
    ],
    instructions:
      "Fill wine glass with ice. Add Aperol, then top with Prosecco and soda water. Gently stir. Garnish with mint, flowers, and orange slice.",
    category: "Garden Fresh",
    difficulty: "Easy",
    prepTime: "3 minutes",
  },
  {
    id: "7",
    name: "Maple Bourbon Smash",
    description:
      "A seasonal smash cocktail perfect for autumn evenings at the cottage.",
    image: "bourbon-smash",
    ingredients: [
      "2 oz Bourbon",
      "1/2 oz Maple Syrup",
      "1/2 oz Fresh Lemon Juice",
      "Fresh Thyme",
      "Apple Slices",
      "Club Soda",
    ],
    instructions:
      "Muddle apple slices and thyme in a shaker. Add bourbon, maple syrup, and lemon juice. Shake with ice. Strain over fresh ice and top with club soda.",
    category: "Seasonal",
    difficulty: "Easy",
    prepTime: "5 minutes",
  },
  {
    id: "8",
    name: "Cottage Negroni",
    description:
      "The classic Italian cocktail with Caretaker's artisxanal twist.",
    image: "negroni",
    ingredients: [
      "1 oz Gin",
      "1 oz Campari",
      "1 oz Sweet Vermouth",
      "Orange Peel",
      "Ice",
    ],
    instructions:
      "Stir all ingredients with ice in a mixing glass. Strain over fresh ice in a rocks glass. Express orange peel over the drink and use as garnish.",
    category: "Classic",
    difficulty: "Easy",
    prepTime: "4 minutes",
  },
  // Club Bauhaus inspired cocktails
  {
    id: "9",
    name: "Bauhaus Martini",
    description:
      "A minimalist martini with geometric precision - clean lines, perfect balance, and architectural elegance.",
    image: "bauhaus-martini",
    ingredients: [
      "2.5 oz Premium Gin",
      "0.5 oz Dry Vermouth",
      "2 dashes Orange Bitters",
      "Lemon twist",
      "Ice",
    ],
    instructions:
      "Stir gin and vermouth with ice in a mixing glass for 30 seconds. Strain into a chilled coupe glass. Express lemon twist over the drink and discard. Serve immediately.",
    category: "Classic",
    difficulty: "Medium",
    prepTime: "4 minutes",
  },
  {
    id: "10",
    name: "Constructivist Cosmo",
    description:
      "A deconstructed cosmopolitan that celebrates form and function - bold, structured, and visually striking.",
    image: "cosmo",
    ingredients: [
      "2 oz Vodka",
      "1 oz Cranberry Juice",
      "0.5 oz Cointreau",
      "0.5 oz Fresh Lime Juice",
      "Lime wheel",
      "Ice",
    ],
    instructions:
      "Shake all ingredients with ice in a shaker. Double strain into a chilled martini glass. Garnish with lime wheel. Serve immediately.",
    category: "Classic",
    difficulty: "Easy",
    prepTime: "3 minutes",
  },
  {
    id: "11",
    name: "Minimalist Mule",
    description:
      "A stripped-down Moscow Mule that embodies the 'less is more' philosophy - pure, simple, and effective.",
    image: "mule",
    ingredients: [
      "2 oz Vodka",
      "0.5 oz Fresh Lime Juice",
      "4 oz Ginger Beer",
      "Fresh Mint",
      "Lime wedge",
      "Ice",
    ],
    instructions:
      "Fill copper mug with ice. Add vodka and lime juice. Top with ginger beer. Stir gently. Garnish with mint and lime wedge.",
    category: "Classic",
    difficulty: "Easy",
    prepTime: "2 minutes",
  },
  {
    id: "12",
    name: "Geometric Gimlet",
    description:
      "A perfectly balanced gimlet with sharp angles and clean edges - the essence of Bauhaus design in liquid form.",
    image: "gimlet",
    ingredients: [
      "2 oz Gin",
      "0.75 oz Fresh Lime Juice",
      "0.75 oz Simple Syrup",
      "Lime wheel",
      "Ice",
    ],
    instructions:
      "Shake gin, lime juice, and simple syrup with ice. Strain into a chilled coupe glass. Garnish with lime wheel.",
    category: "Classic",
    difficulty: "Easy",
    prepTime: "3 minutes",
  },
  {
    id: "13",
    name: "Functional Fizz",
    description:
      "A highball that serves its purpose with maximum efficiency - refreshing, bubbly, and perfectly proportioned.",
    image: "fizz",
    ingredients: [
      "2 oz Gin",
      "1 oz Fresh Lemon Juice",
      "0.5 oz Simple Syrup",
      "Soda Water",
      "Lemon twist",
      "Ice",
    ],
    instructions:
      "Fill highball glass with ice. Add gin, lemon juice, and simple syrup. Top with soda water. Stir gently. Garnish with lemon twist.",
    category: "Classic",
    difficulty: "Easy",
    prepTime: "2 minutes",
  },
  {
    id: "14",
    name: "Modular Manhattan",
    description:
      "A structured Manhattan built on modular principles - each component serves a specific function in the whole.",
    image: "manhattan",
    ingredients: [
      "2 oz Rye Whiskey",
      "1 oz Sweet Vermouth",
      "2 dashes Angostura Bitters",
      "Maraschino Cherry",
      "Ice",
    ],
    instructions:
      "Stir whiskey, vermouth, and bitters with ice. Strain into a chilled coupe glass. Garnish with cherry.",
    category: "Classic",
    difficulty: "Medium",
    prepTime: "4 minutes",
  },
];

export const categories = [
  "All",
  "Classic",
  "Garden Fresh",
  "Tropical",
  "Seasonal",
];
