export interface Wine {
    id: string;
    name: string;
    description: string;
    price: string;
    status: "Current" | "Future" | "Previous";
    image?: any;
}

export const wines: Wine[] = [
    // Current Wines
    {
        id: "1",
        name: "House Red",
        description: "A bold and fruity red blend, perfect for sipping by the fire.",
        price: "$14",
        status: "Current",
    },
    {
        id: "2",
        name: "Crisp White",
        description: "Refreshing and dry with notes of citrus and green apple.",
        price: "$14",
        status: "Current",
    },
    {
        id: "3",
        name: "Pet Nat",
        description: "Fun, fizzy, and unfiltered. A natural sparkling wine full of life.",
        price: "$16",
        status: "Current",
    },

    // Future Wines
    {
        id: "4",
        name: "Reserve Pinot Noir",
        description: "Elegant and complex, aged in French oak. Coming soon.",
        price: "$18",
        status: "Future",
    },
    {
        id: "5",
        name: "Summer Rosé",
        description: "The perfect summer patio wine. Light, floral, and dry.",
        price: "$15",
        status: "Future",
    },

    // Previous Wines
    {
        id: "6",
        name: "Vintage Shiraz",
        description: "A heavy hitter from the Barossa Valley. Deep, dark, and spicy.",
        price: "$16",
        status: "Previous",
    },
    {
        id: "7",
        name: "Orange Wine",
        description: "Skin-contact white wine with texture and grip.",
        price: "$15",
        status: "Previous",
    },
];
