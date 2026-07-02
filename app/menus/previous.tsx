import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, YStack } from "tamagui";

const previousMenus = [
    { id: "1", name: "Winter 2025", date: "July 2025 - September 2025", items: 12 },
    { id: "2", name: "Autumn 2025", date: "April 2025 - June 2025", items: 10 },
    { id: "3", name: "Summer 2024/25", date: "December 2024 - March 2025", items: 14 },
    { id: "4", name: "Spring 2024", date: "September 2024 - November 2024", items: 11 },
];

export default function PreviousMenusScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme];
    const isDark = colorScheme === "dark";

    const styles = useMemo(
        () =>
            StyleSheet.create({
                container: { flex: 1, backgroundColor: colors.background },
                header: {
                    paddingTop: 60,
                    paddingHorizontal: 20,
                    paddingBottom: 20,
                    borderBottomLeftRadius: 30,
                    borderBottomRightRadius: 30,
                    marginBottom: 10,
                },
                headerRow: { flexDirection: "row", alignItems: "center", gap: 15 },
                backButton: { padding: 5 },
                title: { fontSize: 34, color: colors.text },
                listContent: { padding: 20, gap: 15 },
                menuItem: {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 20,
                    borderRadius: 20,
                },
                name: { fontSize: 18, marginBottom: 4, color: colors.text },
                date: { fontSize: 14, color: colors.icon },
                badge: {
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                },
                badgeText: { fontSize: 12, fontWeight: "bold", color: colors.tint },
            }),
        [colors, isDark],
    );

    return (
        <YStack style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { fontSize: 34, fontWeight: "bold" }]}>Previous Menus</Text>
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
                                <Text style={[styles.name, { fontWeight: "bold" }]}>{item.name}</Text>
                                <Text style={styles.date}>{item.date}</Text>
                            </View>
                            <GlassView style={styles.badge} intensity={20}>
                                <Text style={styles.badgeText}>{item.items} items</Text>
                            </GlassView>
                        </GlassView>
                    </TouchableOpacity>
                )}
            />
        </YStack>
    );
}
