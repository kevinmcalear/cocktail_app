import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Image, StyleSheet, View } from 'react-native';

export default function MenuScreen() {
    const colorScheme = useColorScheme();

    const menuItems = [
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

    return (
        <ParallaxScrollView
            headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
            headerImage={
                <IconSymbol
                    size={310}
                    color="#808080"
                    name="list.bullet"
                    style={styles.headerImage}
                />
            }>
            <ThemedView style={styles.titleContainer}>
                <ThemedText type="title">Caretaker's Cottage</ThemedText>
            </ThemedView>
            <ThemedText style={styles.subtitle}>Melbourne • Established 2022</ThemedText>

            <View style={styles.menuContainer}>
                {menuItems.map((item, index) => (
                    <ThemedView key={index} style={styles.menuItem}>
                        <View style={styles.itemContent}>
                            <View style={styles.textContainer}>
                                <View style={styles.menuHeader}>
                                    <ThemedText type="subtitle">{item.name}</ThemedText>
                                    <ThemedText style={styles.price}>{item.price}</ThemedText>
                                </View>
                                <ThemedText style={styles.description}>{item.description}</ThemedText>
                                <ThemedText style={styles.ingredients}>{item.ingredients}</ThemedText>
                            </View>
                            <Image source={item.image} style={styles.cocktailImage} />
                        </View>
                        {index < menuItems.length - 1 && <View style={[styles.separator, { backgroundColor: Colors[colorScheme ?? 'light'].icon }]} />}
                    </ThemedView>
                ))}
            </View>
        </ParallaxScrollView>
    );
}

const styles = StyleSheet.create({
    headerImage: {
        color: '#808080',
        bottom: -90,
        left: -35,
        position: 'absolute',
    },
    titleContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    subtitle: {
        fontSize: 16,
        opacity: 0.7,
        marginBottom: 16,
    },
    menuContainer: {
        gap: 24,
    },
    menuItem: {
        gap: 16,
    },
    itemContent: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'flex-start',
    },
    textContainer: {
        flex: 1,
        gap: 4,
    },
    cocktailImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#ccc',
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    price: {
        fontSize: 16,
        fontWeight: '600',
        opacity: 0.8,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 4,
    },
    ingredients: {
        fontSize: 12,
        opacity: 0.6,
        fontStyle: 'italic',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        width: '100%',
        marginTop: 8,
        marginBottom: 0,
        opacity: 0.3,
    },
});
