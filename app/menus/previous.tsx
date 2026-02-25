import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";

// Dummy data for previous menus
const previousMenus = [
    { id: '1', name: 'Winter 2025', date: 'July 2025 - September 2025', items: 12 },
    { id: '2', name: 'Autumn 2025', date: 'April 2025 - June 2025', items: 10 },
    { id: '3', name: 'Summer 2024/25', date: 'December 2024 - March 2025', items: 14 },
    { id: '4', name: 'Spring 2024', date: 'September 2024 - November 2024', items: 11 },
];

export default function PreviousMenusScreen() {
    const router = useRouter();

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <ThemedText type="title" style={styles.title}>Previous Menus</ThemedText>
                </View>
            </View>

            <FlatList
                data={previousMenus}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity>
                        <GlassView style={styles.menuItem} intensity={40}>
                            <View>
                                <ThemedText type="subtitle" style={styles.name}>{item.name}</ThemedText>
                                <ThemedText style={styles.date}>{item.date}</ThemedText>
                            </View>
                            <GlassView style={styles.badge} intensity={20}>
                                <ThemedText style={styles.badgeText}>{item.items} items</ThemedText>
                            </GlassView>
                        </GlassView>
                    </TouchableOpacity>
                )}
            />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 10,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 15
    },
    backButton: {
        padding: 5
    },
    title: {
        fontSize: 34,
        color: Colors.dark.text
    },
    listContent: {
        padding: 20,
        gap: 15
    },
    menuItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        borderRadius: 20,
    },
    name: {
        fontSize: 18,
        marginBottom: 4
    },
    date: {
        fontSize: 14,
        color: Colors.dark.icon
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.1)"
    },
    badgeText: {
        fontSize: 12,
        fontWeight: "bold",
        color: Colors.dark.tint
    }
});
