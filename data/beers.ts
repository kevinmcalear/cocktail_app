export interface Beer {
    id: string;
    name: string;
    description: string;
    price: string;
    status: "Current" | "Future" | "Previous";
    image?: any;
}

export const beers: Beer[] = [
    // Current Beers
    {
        id: "1",
        name: "Cottage Lager",
        description: "Clean, crisp, and refreshing. The perfect knock-off beer.",
        price: "$10",
        status: "Current",
        image: require("@/assets/images/beers/cottage_lager.png"),
    },
    {
        id: "2",
        name: "Hazy IPA",
        description: "Juicy tropical fruit notes with low bitterness.",
        price: "$12",
        status: "Current",
        image: require("@/assets/images/beers/hazy_ipa.png"),
    },
    {
        id: "3",
        name: "Oatmeal Stout",
        description: "Rich and creamy with notes of coffee and chocolate.",
        price: "$11",
        status: "Current",
        image: require("@/assets/images/beers/oatmeal_stout.png"),
    },

    // Future Beers
    {
        id: "4",
        name: "Sour Ale",
        description: "Tart and fruity, brewed with seasonal berries.",
        price: "$12",
        status: "Future",
        image: require("@/assets/images/beers/sour_ale.png"),
    },
    {
        id: "5",
        name: "Double IPA",
        description: "Big, bold, and hoppy. Not for the faint of heart.",
        price: "$14",
        status: "Future",
        image: require("@/assets/images/beers/double_ipa.png"),
    },

    // Previous Beers
    {
        id: "6",
        name: "Pacific Ale",
        description: "Easy drinking with passionfruit aromas.",
        price: "$11",
        status: "Previous",
        image: require("@/assets/images/beers/pacific_ale.png"),
    },
    {
        id: "7",
        name: "Amber Ale",
        description: "Malty and balanced with a caramel finish.",
        price: "$10",
        status: "Previous",
        image: require("@/assets/images/beers/amber_ale.png"),
    },
];
