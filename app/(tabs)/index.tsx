import { CurrentMenuList } from "@/components/CurrentMenuList";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Dummy data: Oldest first, newest last.
const mockMenus = [
    { id: '4', name: 'Spring 2024', month: 'Sep 2024' },
    { id: '3', name: 'Summer 24/25', month: 'Dec 2024' },
    { id: '2', name: 'Autumn 2025', month: 'Apr 2025' },
    { id: '1', name: 'Winter 2025', month: 'Jul 2025' },
];

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // Most recent menu selected by default.
    const [selectedMenuId, setSelectedMenuId] = useState(mockMenus[mockMenus.length - 1].id);
    const scrollViewRef = useRef<ScrollView>(null);

    // Scroll to the end so the selected menu is visible on load
    useEffect(() => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 100);
    }, []);

    return (
        <ThemedView style={styles.container}>
            <CurrentMenuList
                ListHeaderComponent={
                    <View>
                        <View style={{ paddingTop: insets.top + 10 }} />

                        <ScrollView 
                            ref={scrollViewRef}
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.pillsContainer}
                        >
                            {mockMenus.map((menu) => {
                                const isSelected = selectedMenuId === menu.id;
                                return (
                                    <TouchableOpacity
                                        key={menu.id}
                                        style={[styles.pill, isSelected && styles.pillSelected]}
                                        onPress={() => setSelectedMenuId(menu.id)}
                                    >
                                        <ThemedText style={[styles.pillTitle, isSelected && styles.pillTextSelected]}>
                                            {menu.name}
                                        </ThemedText>
                                    </TouchableOpacity>
                                );
                            })}
                            
                            <TouchableOpacity
                                style={[styles.pill, styles.pillCreate]}
                                onPress={() => router.push("/menus/create")}
                            >
                                <IconSymbol name="plus" size={20} color={Colors.dark.text} />
                                <ThemedText style={styles.pillCreateText}>Create Menu</ThemedText>
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.sectionHeader}>
                            <ThemedText type="subtitle">
                                {mockMenus.find(m => m.id === selectedMenuId)?.name || "Current Menu"} Cocktails
                            </ThemedText>
                        </View>
                    </View>
                }
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    pillsContainer: {
        paddingHorizontal: 15,
        gap: 10,
        marginTop: 20,
        alignItems: "center"
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        justifyContent: "center",
        alignItems: "center"
    },
    pillSelected: {
        backgroundColor: Colors.dark.tint,
        borderColor: Colors.dark.tint,
    },
    pillTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.dark.text,
    },
    pillTextSelected: {
        color: "#000", // Dark text on tinted background
    },
    pillCreate: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderStyle: "dashed",
        paddingVertical: 14 // Make it match height relatively
    },
    pillCreateText: {
        fontSize: 15,
        fontWeight: "600",
        color: Colors.dark.text,
    },
    sectionHeader: {
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 10
    },
});
