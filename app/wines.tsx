import { BottomSearchBar } from "@/components/BottomSearchBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { wines } from "@/data/wines";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Keyboard, Platform, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WinesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [filter, setFilter] = useState<"Current" | "Future" | "Previous">("Current");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredWines = wines.filter((wine) =>
        wine.status === filter &&
        wine.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                            <TouchableOpacity onPress={() => router.back()} style={styles.headerTitleContainer}>
                                <IconSymbol name="chevron.left" size={28} color={Colors.dark.text} />
                            </TouchableOpacity>
                            <ThemedText type="title" style={styles.title}>Wines</ThemedText>
                            <View style={{ width: 40 }} />
                        </GlassView>
                    </View>
                </TouchableWithoutFeedback>

                <FlatList
                    data={filteredWines}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { paddingBottom: 220 + insets.bottom }]}
                    showsVerticalScrollIndicator={false}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <GlassView style={styles.itemCard} intensity={20}>
                            <View style={styles.itemRow}>
                                <View style={styles.textContainer}>
                                    <View style={styles.headerRow}>
                                        <ThemedText type="subtitle" style={styles.itemName} numberOfLines={1}>{item.name}</ThemedText>
                                    </View>
                                    <ThemedText style={styles.itemDescription} numberOfLines={2}>{item.description}</ThemedText>
                                </View>
                                {/* Placeholder Image/Icon area since wines usually didn't have images in previous code */}
                                <View style={styles.iconContainer}>
                                    <IconSymbol name="wineglass.fill" size={32} color={Colors.dark.tint} />
                                </View>
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
                <GlassView style={styles.searchBarContainer} intensity={80}>
                    <BottomSearchBar
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Find your wine..."
                    />
                </GlassView>
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
        height: 90, // Compact height
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: 10,
        gap: 4,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemName: {
        fontSize: 20, // Increased from 18
        fontWeight: "700",
        color: Colors.dark.text,
        flex: 1,
    },

    itemDescription: {
        fontSize: 15, // Increased from 13
        color: Colors.dark.icon,
        lineHeight: 20,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.05)",
        alignItems: 'center',
        justifyContent: 'center',
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
    searchBarContainer: {
        borderRadius: 25,
        overflow: 'hidden',
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
