import { CurrentMenuList } from "@/components/CurrentMenuList";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { StyleSheet } from "react-native";

export default function MenuScreen() {
    const colorScheme = useColorScheme();

    return (
        <ThemedView style={styles.container}>
            <GlassView style={styles.header} intensity={80}>
                <ThemedText type="title" style={styles.title}>Menu</ThemedText>
                <ThemedText style={styles.subtitle}>Current Selections</ThemedText>
            </GlassView>

            <CurrentMenuList />
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
        marginBottom: 10
    },
    title: {
        fontSize: 34,
        color: Colors.dark.text
    },
    subtitle: {
        color: Colors.dark.icon,
        fontSize: 16
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 120,
        gap: 15
    },
    menuItem: {
        flexDirection: "row",
        padding: 12,
        borderRadius: 20,
        gap: 12,
        alignItems: "center"
    },
    image: {
        width: 80,
        height: 80,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.1)"
    },
    details: {
        flex: 1,
        gap: 4
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    name: {
        fontSize: 18,
        flex: 1
    },
    price: {
        fontSize: 16,
        fontWeight: "bold",
        color: Colors.dark.tint
    },
    description: {
        fontSize: 14,
        color: Colors.dark.text,
        opacity: 0.9
    },
    ingredients: {
        fontSize: 12,
        color: Colors.dark.icon,
        fontStyle: "italic"
    }
});
