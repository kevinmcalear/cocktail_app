import { CurrentMenuList } from "@/components/CurrentMenuList";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MenusScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (

        <ThemedView style={styles.container}>
            <CurrentMenuList
                ListHeaderComponent={
                    <View>
                        <View style={{ paddingTop: insets.top + 10 }} />

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => router.push("/menus/previous")}
                            >
                                <GlassView style={styles.actionContent} intensity={40}>
                                    <IconSymbol name="clock.arrow.circlepath" size={20} color={Colors.dark.text} />
                                    <ThemedText style={styles.actionText}>Previous Menus</ThemedText>
                                </GlassView>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => router.push("/menus/create")}
                            >
                                <GlassView style={styles.actionContent} intensity={40}>
                                    <IconSymbol name="plus.circle" size={20} color={Colors.dark.text} />
                                    <ThemedText style={styles.actionText}>Create Menu</ThemedText>
                                </GlassView>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.sectionHeader}>
                            <ThemedText type="subtitle">Current Menu</ThemedText>
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
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        zIndex: 10,
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
    content: {
        flex: 1,
    },
    actions: {
        flexDirection: "row",
        gap: 15,
        paddingHorizontal: 20,
        marginTop: 20,
    },
    actionButton: {
        flex: 1,
    },
    actionContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        borderRadius: 15,
        gap: 8,
        backgroundColor: "rgba(255,255,255,0.05)"
    },
    actionText: {
        fontWeight: "600",
        color: Colors.dark.text
    },
    sectionHeader: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10
    },
    listWrapper: {
        flex: 1,
    }
});
