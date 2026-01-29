import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Keyboard, Platform, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CocktailsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState("");

    type CocktailListItem = {
        id: string;
        name: string;
        description?: string;
        cocktail_images?: {
            images: {
                url: string;
            }
        }[];
        recipes?: {
            ingredients: {
                name: string;
            } | null;
        }[];
    };

    const [cocktails, setCocktails] = useState<CocktailListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCocktails();
    }, []);

    const fetchCocktails = async () => {
        console.log("Fetching cocktails from Supabase...");
        try {
            const { data, error } = await supabase
                .from('cocktails')
                .select(`
                    id,
                    name,
                    description,
                    recipes (
                        ingredients (
                            name
                        )
                    ),
                    cocktail_images (
                        images (
                            url
                        )
                    )
                `)
                .order('name', { ascending: true });

            if (error) {
                console.error('Error fetching cocktails:', error);
            }

            if (data) {
                console.log("Fetched " + data.length + " cocktails from Supabase.");
                setCocktails(data as unknown as CocktailListItem[]);
            } else {
                console.log("No data returned from Supabase.");
            }
        } catch (error) {
            console.error('Error fetching cocktails:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCocktails = cocktails.filter((cocktail) =>
        cocktail.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            (e) => {
                Animated.timing(translateY, {
                    toValue: -(e.endCoordinates.height - insets.bottom),
                    // User requested faster animation. Multiplying by 0.7 to make it snappy.
                    duration: (e.duration || 250) * 0.7,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }).start();
            }
        );
        const hideSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
            (e) => {
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: (e.duration || 250) * 0.7,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }).start();
            }
        );

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [insets.bottom, translateY]);

    const getImage = (item: CocktailListItem) => {
        if (item.cocktail_images && item.cocktail_images.length > 0) {
            return { uri: item.cocktail_images[0].images.url };
        }
        return require("@/assets/images/cocktails/house_martini.png");
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Content Layer */}
            <View style={StyleSheet.absoluteFill}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View>
                        {/* Header */}
                        <GlassView style={[styles.header, { paddingTop: insets.top + 10 }]} intensity={80}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.headerTitleContainer}>
                                <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                            </TouchableOpacity>
                            <ThemedText type="title" style={styles.title}>Cocktails</ThemedText>
                            <View style={{ width: 40 }} />
                        </GlassView>
                    </View>
                </TouchableWithoutFeedback>

                <FlatList
                    data={filteredCocktails}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => router.push("/cocktail/" + item.id)}
                            activeOpacity={0.7}
                        >
                            <GlassView style={styles.itemCard} intensity={20}>
                                <View style={styles.itemRow}>
                                    <View style={styles.textContainer}>
                                        <ThemedText type="subtitle" style={styles.itemName} numberOfLines={1}>{item.name}</ThemedText>
                                        <ThemedText style={styles.itemDescription} numberOfLines={2}>
                                            {item.recipes?.map(r => r.ingredients?.name).filter(Boolean).join(", ") || item.description || "No ingredients listed"}
                                        </ThemedText>
                                    </View>
                                    <Image
                                        source={getImage(item)}
                                        style={styles.itemImage}
                                        contentFit="cover"
                                        transition={500}
                                    />
                                </View>
                            </GlassView>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* Search Bar Layer */}
            <GlassView style={[styles.searchBarContainer, { paddingBottom: insets.bottom + 10 }]} intensity={80}>
                <BottomSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Find a cocktail..."
                />
            </GlassView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerTitleContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        lineHeight: 36,
        fontWeight: "bold",
    },
    listContent: {
        paddingHorizontal: 15,
        gap: 12,
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
        height: 100, // Fixed height for consistency
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 12,
        gap: 4,
    },
    itemName: {
        fontSize: 20, // Increased from 18
        fontWeight: "700",
        color: Colors.dark.text,
    },
    itemDescription: {
        fontSize: 15, // Increased from 13
        color: Colors.dark.icon,
        lineHeight: 20, // Increased line height
    },
    itemImage: {
        width: 76,
        height: 76,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    searchBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.1)",
    },
});
