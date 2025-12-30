import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { beers } from "@/data/beers";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Keyboard, Platform, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BeersScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [filter, setFilter] = useState<"Current" | "Future" | "Previous">("Current");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredBeers = beers.filter((beer) =>
        beer.status === filter &&
        beer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            (e) => {
                Animated.timing(translateY, {
                    toValue: -(e.endCoordinates.height - insets.bottom),
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
                            <ThemedText type="subtitle" style={styles.subtitle}>Beers</ThemedText>
                        </View>
                    </View>
                </TouchableWithoutFeedback>

                <FlatList
                    data={filteredBeers}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingBottom: 220 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <GlassView style={styles.itemCard} intensity={40}>
                            <View style={styles.itemContent}>
                                <View style={styles.row}>
                                    <ThemedText type="subtitle" style={styles.itemName}>{item.name}</ThemedText>
                                    <ThemedText style={styles.itemPrice}>{item.price}</ThemedText>
                                </View>
                                <ThemedText style={styles.itemDescription}>{item.description}</ThemedText>
                            </View>
                        </GlassView>
                    )}
                />
            </View>

            {/* Controls Layer */}
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
                {/* Filter Tabs */}
                <GlassView style={styles.filterTabs} intensity={70}>
                    {(["Current", "Future", "Previous"] as const).map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabButton, filter === tab && styles.activeTabObject]}
                            onPress={() => setFilter(tab)}
                        >
                            <ThemedText style={[styles.tabText, filter === tab && styles.activeTabText]}>
                                {tab.toUpperCase()}
                            </ThemedText>
                        </TouchableOpacity>
                    ))}
                </GlassView>

                {/* Search Bar */}
                <BottomSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchBar}
                    placeholder="Find your beer..."
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
        padding: 20,
        gap: 15,
        paddingTop: 10,
    },
    itemCard: {
        padding: 16,
        borderRadius: 20,
    },
    itemContent: {
        gap: 8,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    itemName: {
        fontSize: 20,
        flex: 1,
    },
    itemPrice: {
        fontSize: 18,
        fontWeight: "600",
        color: Colors.dark.tint,
    },
    itemDescription: {
        fontSize: 16,
        color: Colors.dark.text,
        opacity: 0.8,
    },
    controlsLayer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: "flex-end",
        paddingHorizontal: 20,
        gap: 15,
    },
    filterTabs: {
        flexDirection: "row",
        justifyContent: "space-evenly",
        borderRadius: 30,
        padding: 5,
    },
    searchBar: {
    },
    tabButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        flex: 1,
        alignItems: 'center',
    },
    activeTabObject: {
        backgroundColor: "rgba(255,255,255,0.1)",
    },
    tabText: {
        fontSize: 12,
        fontWeight: "bold",
        letterSpacing: 1,
        color: Colors.dark.icon,
    },
    activeTabText: {
        color: Colors.dark.tint,
    },
});
