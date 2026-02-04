import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

const templates = [
    { id: '1', name: 'Standard Season', description: '12 cocktails, balanced categories' },
    { id: '2', name: 'Special Event', description: 'Short list, 6 signature drinks' },
    { id: '3', name: 'Testing Menu', description: 'Blank canvas for R&D' },
];

export default function CreateMenuScreen() {
    const router = useRouter();
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    return (
        <ThemedView style={styles.container}>
            <GlassView style={styles.header} intensity={80}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <ThemedText type="title" style={styles.title}>Create Menu</ThemedText>
                </View>
                <ThemedText style={styles.subtitle}>Select a template to get started</ThemedText>
            </GlassView>

            <ScrollView contentContainerStyle={styles.content}>
                {templates.map((template) => {
                    const isSelected = selectedTemplate === template.id;
                    return (
                        <TouchableOpacity
                            key={template.id}
                            onPress={() => setSelectedTemplate(template.id)}
                        >
                            <GlassView
                                style={[styles.card, isSelected && styles.selectedCard]}
                                intensity={isSelected ? 60 : 30}
                            >
                                <View style={styles.cardHeader}>
                                    <ThemedText type="subtitle" style={styles.cardTitle}>{template.name}</ThemedText>
                                    {isSelected && <IconSymbol name="checkmark.circle.fill" size={24} color={Colors.dark.tint} />}
                                </View>
                                <ThemedText style={styles.cardDesc}>{template.description}</ThemedText>
                            </GlassView>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.createButton, !selectedTemplate && styles.disabledButton]}
                    disabled={!selectedTemplate}
                    onPress={() => {
                        // Logic to create menu would go here
                        router.back();
                    }}
                >
                    <ThemedText style={styles.createButtonText}>Create Menu</ThemedText>
                </TouchableOpacity>
            </View>
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
        gap: 15,
        marginBottom: 8
    },
    backButton: {
        padding: 5
    },
    title: {
        fontSize: 34,
        color: Colors.dark.text
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.icon,
        marginLeft: 4,
    },
    content: {
        padding: 20,
        gap: 15
    },
    card: {
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "transparent"
    },
    selectedCard: {
        borderColor: Colors.dark.tint,
        backgroundColor: "rgba(255,255,255,0.1)"
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8
    },
    cardTitle: {
        fontSize: 20
    },
    cardDesc: {
        color: Colors.dark.icon,
        fontSize: 16
    },
    footer: {
        padding: 20,
        paddingBottom: 40
    },
    createButton: {
        backgroundColor: Colors.dark.tint,
        padding: 18,
        borderRadius: 15,
        alignItems: "center"
    },
    disabledButton: {
        opacity: 0.5
    },
    createButtonText: {
        color: "#000",
        fontWeight: "bold",
        fontSize: 18
    }
});
