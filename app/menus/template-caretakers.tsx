import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

type MenuSlot = {
    id: string;
    label: string;
};

const slots: MenuSlot[] = [
    { id: "house-martini", label: "House Martini" },
    { id: "modern-riff-1", label: "Modern Riff 1" },
    { id: "modern-riff-2", label: "Modern Riff 2" },
    { id: "modern-riff-3", label: "Modern Riff 3" },
    { id: "classic-riff-1", label: "Classic Riff 1" },
    { id: "classic-riff-2", label: "Classic Riff 2" },
    { id: "classic-riff-3", label: "Classic Riff 3" },
    { id: "milk-punch", label: "Milk Punch" },
];

export default function CaretakersCottageTemplateScreen() {
    const router = useRouter();
    const [entries, setEntries] = useState<Record<string, string>>({});

    const filledCount = useMemo(
        () => slots.filter((slot) => (entries[slot.id] ?? "").trim().length > 0).length,
        [entries]
    );
    const totalCount = slots.length;
    const progress = totalCount === 0 ? 0 : filledCount / totalCount;
    const progressLabel = `${filledCount}/${totalCount} filled`;

    return (
        <ThemedView style={styles.container}>
            <GlassView style={styles.header} intensity={80}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <View>
                        <ThemedText type="title" style={styles.title}>Caretaker&apos;s Cottage</ThemedText>
                        <ThemedText style={styles.subtitle}>Monthly Menu Template</ThemedText>
                    </View>
                </View>

                <View style={styles.progressRow}>
                    <ThemedText style={styles.progressText}>Progress</ThemedText>
                    <ThemedText style={styles.progressText}>{progressLabel}</ThemedText>
                </View>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
            </GlassView>

            <ScrollView contentContainerStyle={styles.content}>
                {slots.map((slot) => (
                    <GlassView key={slot.id} style={styles.card} intensity={40}>
                        <ThemedText type="subtitle" style={styles.cardTitle}>{slot.label}</ThemedText>
                        <TextInput
                            style={styles.input}
                            value={entries[slot.id] ?? ""}
                            onChangeText={(text) => setEntries((prev) => ({ ...prev, [slot.id]: text }))}
                            placeholder="Add cocktail name"
                            placeholderTextColor="#666"
                        />
                    </GlassView>
                ))}
            </ScrollView>
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
        gap: 12,
        marginBottom: 16,
    },
    backButton: {
        padding: 5,
    },
    title: {
        fontSize: 28,
        color: Colors.dark.text,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.dark.icon,
        marginTop: 2,
    },
    progressRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    progressText: {
        color: Colors.dark.icon,
        fontSize: 14,
    },
    progressBar: {
        height: 8,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 999,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: Colors.dark.tint,
        borderRadius: 999,
    },
    content: {
        padding: 20,
        gap: 14,
        paddingBottom: 40,
    },
    card: {
        padding: 18,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.05)",
    },
    cardTitle: {
        fontSize: 18,
        marginBottom: 10,
    },
    input: {
        backgroundColor: "rgba(0,0,0,0.3)",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: Colors.dark.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
});
