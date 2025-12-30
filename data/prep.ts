export interface PrepMethod {
    id: string;
    name: string;
    description: string;
    price: string; // Maybe not relevant for prep, but keeping schema consistent for now
    status: "Current" | "Future" | "Previous";
    image?: any;
}

export const prep: PrepMethod[] = [
    // Current Prep
    {
        id: "1",
        name: "House-Made Orgeat",
        description: "Almonds blanched and roasted, blended with rose water and sugar.",
        price: "Batch",
        status: "Current",
    },
    {
        id: "2",
        name: "Clear Ice",
        description: "Directionally frozen ice blocks, cut by hand daily.",
        price: "Daily",
        status: "Current",
    },
    {
        id: "3",
        name: "Dried Citrus Wheels",
        description: "Dehydrated lime, lemon, and orange wheels for garnish.",
        price: "Batch",
        status: "Current",
    },

    // Future Prep
    {
        id: "4",
        name: "Fermented Honey",
        description: "Raw honey fermented with garlic and chilli for new spicy cocktail.",
        price: "Batch",
        status: "Future",
    },
    {
        id: "5",
        name: "Clarified Milk Punch Base",
        description: "Starting the 3-day clarification process for the weekend menu.",
        price: "Batch",
        status: "Future",
    },

    // Previous Prep
    {
        id: "6",
        name: "Spiced Pumpkin Syrup",
        description: "Seasonal syrup for the autumn menu.",
        price: "Batch",
        status: "Previous",
    },
    {
        id: "7",
        name: "Pickled Watermelon Rind",
        description: "Zero-waste garnish from summer menu.",
        price: "Batch",
        status: "Previous",
    },
];
