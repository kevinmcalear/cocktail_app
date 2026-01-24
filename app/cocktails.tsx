import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Image, Keyboard, Platform, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CocktailsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState("");

    type CocktailListItem = {
        id: string;
        name: string;
        cocktail_images?: {
            images: {
                url: string;
            }
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
                console.log(`Fetched ${data.length} cocktails from Supabase.`);
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

    const handleCocktailPress = (cocktail: CocktailListItem) => {
        router.push(`/cocktail/${cocktail.id}`);
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
                            <TouchableOpacity onPress={() => router.push("/")} style={styles.headerTitleContainer}>
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
                    contentContainerStyle={[styles.listContent, { paddingBottom: 220 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <GlassView style={styles.itemCard} intensity={40}>
                            <TouchableOpacity
                                style={styles.cardContainer}
                                onPress={() => handleCocktailPress(item)}
                            >
                                <Image
                                    source={
                                        item.cocktail_images?.[0]?.images?.url
                                            ? { uri: item.cocktail_images[0].images.url }
                                            : require('@/assets/images/cocktails/house_martini.png')
                                    }
                                    style={styles.cardImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.cardFooter}>
                                    <ThemedText type="subtitle" style={styles.cardTitle}>{item.name}</ThemedText>
                                </View>
                            </TouchableOpacity>
                        </GlassView>
                    )}
                />
            </View>

            {/* Controls Layer - Animated */}
            <Animated.View
                style={[
                    styles.controlsLayer,
                    {
                        paddingBottom: insets.bottom + 10,
                        transform: [{ translateY }]
                    }
                ]}
                pointerEvents="box-none"
            >


                {/* Search Bar */}
                <BottomSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchBar}
                    placeholder="Find your cocktail..."
                />
            </Animated.View>
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
        paddingHorizontal: 20,
        gap: 15,
        paddingTop: 10,
    },
    controlsLayer: {
        position: 'absolute', // Use absolute to easier stick to bottom and animate
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: "flex-end",
        paddingHorizontal: 20,
        gap: 15,
    },

    itemCard: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 8,
    },
    cardContainer: {
        // Container behavior
    },
    cardImage: {
        width: '100%',
        height: 250,
    },
    cardFooter: {
        padding: 16,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    searchBar: {
        // search bar styles managed by component + container padding
    },
});
