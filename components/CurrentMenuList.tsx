import { ThemedText } from "@/components/themed-text";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { Image } from "expo-image";
import { FlatList, StyleSheet, View } from "react-native";

interface MenuItem {
    name: string;
    description: string;
    ingredients: string;
    price: string;
    image: any;
}

export const menuItems: MenuItem[] = [
    {
        name: "House Martini",
        description: "Four Pillars & Caretaker's Cottage House Gin, house dry vermouth. Needs to be freezing.",
        ingredients: "Gin, Dry Vermouth, Lemon Twist/Olive/Onion",
        price: "$26",
        image: require('@/assets/images/cocktails/house_martini.png'),
    },
    {
        name: "Champagne Piña Colada",
        description: "A decadent blend of tropical flavors and sparkling wine.",
        ingredients: "White Rum, Archie Rose White Cane, Pineapple, Coconut Sorbet, Sparkling Wine",
        price: "$26",
        image: require('@/assets/images/cocktails/champagne_pina_colada.png'),
    },
    {
        name: "Nod to Nothing",
        description: "Floral and fruity with a sophisticated tea note.",
        ingredients: "House Gin, Osmanthus Aromatised Wine, Apricot, Jasmine Tea, Lemon",
        price: "$24",
        image: require('@/assets/images/cocktails/nod_to_nothing.png'),
    },
    {
        name: "Midori Splice",
        description: "A modern twist on a retro classic. Creamy and fruity.",
        ingredients: "Cottage Melon Liqueur, Pisco, Pineapple, Passionfruit, Lime, Fig Leaf Creaming Soda",
        price: "$25",
        image: require('@/assets/images/cocktails/midori_splice.png'),
    },
    {
        name: "Champ Stamp",
        description: "Smoky, spicy, and tart with a fresh strawberry kick.",
        ingredients: "Mezcal, Strawberry Two-Ways, Bell Pepper, Yuzu, Lemon",
        price: "$25",
        image: require('@/assets/images/cocktails/champ_stamp.png'),
    },
    {
        name: "Bolo Tie",
        description: "Sophisticated herbal and citrus notes with a whiskey base.",
        ingredients: "Michter's Rye Whiskey, Marionette Elderflower, Lemon Sorrel Sorbet, White Port, Olive Oil, Lime",
        price: "$26",
        image: require('@/assets/images/cocktails/bolo_tie.png'),
    },
    {
        name: "Mulholland Drive",
        description: "Rich and complex with deep coffee and caramel flavors.",
        ingredients: "Johnnie Walker Gold Label, Stout Caramel, Chamomile Vermouth, Coffee Madeira, Cottage Bitters",
        price: "$25",
        image: require('@/assets/images/cocktails/mulholland_drive.png'),
    },
    {
        name: "Mr Blonde Milk Punch",
        description: "Clarified punch with smooth texture and complex flavors.",
        ingredients: "Scotch, Coffee, Vanilla Tea, Doughnut Milk",
        price: "$26",
        image: require('@/assets/images/cocktails/mr_blonde_milk_punch.png'),
    }
];

interface CurrentMenuListProps {
    scrollEnabled?: boolean;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
}

export function CurrentMenuList({ scrollEnabled = true, ListHeaderComponent }: CurrentMenuListProps) {
    return (
        <FlatList
            data={menuItems}
            keyExtractor={(item) => item.name}
            contentContainerStyle={styles.listContent}
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={ListHeaderComponent}
            renderItem={({ item }) => (
                <GlassView style={styles.itemCard} intensity={20}>
                    <View style={styles.itemRow}>
                        <View style={styles.textContainer}>
                            <View style={styles.titleRow}>
                                <ThemedText type="subtitle" style={styles.itemName} numberOfLines={1}>{item.name}</ThemedText>
                                <ThemedText style={styles.itemPrice}>{item.price}</ThemedText>
                            </View>
                            <ThemedText style={styles.itemDescription} numberOfLines={2}>
                                {item.description}
                            </ThemedText>
                            <ThemedText style={styles.itemIngredients} numberOfLines={1}>
                                {item.ingredients}
                            </ThemedText>
                        </View>
                        <Image
                            source={item.image}
                            style={styles.itemImage}
                            contentFit="cover"
                            transition={500}
                        />
                    </View>
                </GlassView>
            )}
        />
    );
}

const styles = StyleSheet.create({
    listContent: {
        paddingHorizontal: 15,
        gap: 12,
        paddingBottom: 120, // Keep padding for bottom nav
        paddingTop: 10,
    },
    itemCard: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        height: 110, // Slightly taller to fit price/desc/ingredients
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 12,
        gap: 4,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemName: {
        fontSize: 20,
        fontWeight: "700",
        color: Colors.dark.text,
        flex: 1, // Allow text to take space
        marginRight: 8
    },
    itemPrice: {
        fontSize: 16,
        fontWeight: "bold",
        color: Colors.dark.tint,
    },
    itemDescription: {
        fontSize: 15,
        color: Colors.dark.icon,
        lineHeight: 20,
    },
    itemIngredients: {
        fontSize: 13,
        color: Colors.dark.icon,
        fontStyle: 'italic',
        opacity: 0.8
    },
    itemImage: {
        width: 76,
        height: 76,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
    },
});
