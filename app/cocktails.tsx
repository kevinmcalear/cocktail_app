import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { cocktails } from "@/data/cocktails";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Keyboard, Platform, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CocktailsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState("");


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

    const handleCocktailPress = (cocktail: any) => {
        // Implement navigation or other action when a cocktail is pressed
        console.log("Cocktail pressed:", cocktail.name);
        // Example: router.push(`/cocktail/${cocktail.id}`);
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
                                <ThemedText type="title" style={styles.title}>Caretaker's{"\n"}Cottage</ThemedText>
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                        </GlassView>

                        <View style={styles.subHeader}>
                            <ThemedText type="subtitle" style={styles.subtitle}>Cocktails</ThemedText>
                        </View>
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
                                style={styles.itemContent}
                                onPress={() => handleCocktailPress(item)}
                            >
                                <View style={styles.row}>
                                    <ThemedText type="subtitle" style={styles.itemName}>{item.name}</ThemedText>
                                    <ThemedText style={styles.itemPrice}>{item.price}</ThemedText>
                                </View>
                                <ThemedText style={styles.itemDescription}>{item.description}</ThemedText>
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
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerTitleContainer: {
        // acts as a button to go home
    },
    title: {
        fontSize: 24,
        lineHeight: 28,
    },
    subHeader: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    subtitle: {
        fontSize: 32,
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

    searchBar: {
        // search bar styles managed by component + container padding
    },

});
