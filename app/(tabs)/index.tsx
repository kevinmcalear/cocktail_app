import { CurrentMenuList } from "@/components/CurrentMenuList";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useMenuDetails } from "@/hooks/useMenuDetails";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    const { data: dropdowns, isLoading: loadingMenus, refetch } = useDropdowns();
    const menus = dropdowns?.menus || [];

    const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
    const scrollViewRef = useRef<ScrollView>(null);

    // Initial selection
    useFocusEffect(
        useCallback(() => {
            refetch(); // Ensure we have the latest menus when focusing back
        }, [])
    );

    useEffect(() => {
        if (menus.length > 0 && !selectedMenuId) {
            // Select the last menu created
            const firstMenu = menus[menus.length - 1];
            setSelectedMenuId(firstMenu.id);
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: false });
            }, 500);
        }
    }, [menus, selectedMenuId]);

    const { data: menuDetails, isLoading: loadingDetails } = useMenuDetails(selectedMenuId);

    const selectedMenuName = menus.find(m => m.id === selectedMenuId)?.name || "Menu";

    return (
        <ThemedView style={styles.container}>
            <CurrentMenuList
                sections={menuDetails?.sections || []}
                ListHeaderComponent={
                    <View>
                        <View style={{ paddingTop: insets.top + 10 }} />

                        {loadingMenus ? (
                            <ActivityIndicator color={Colors.dark.tint} style={{ marginVertical: 20 }} />
                        ) : (
                            <ScrollView 
                                ref={scrollViewRef}
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.pillsContainer}
                            >
                                {menus.map((menu) => {
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
                        )}

                        <View style={styles.sectionHeader}>
                            {loadingDetails && <ActivityIndicator color={Colors.dark.tint} size="small" />}
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
    },
    pillCreateText: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.dark.text,
    },
    sectionHeader: {
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center"
    },
});
