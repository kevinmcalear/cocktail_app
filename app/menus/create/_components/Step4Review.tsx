import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "tamagui";

interface Props {
    template: any;
    name: string;
    sections: any[];
    selections: Record<string, string[]>;
    onPublish: () => void;
    saving: boolean;
}

export const Step4Review = ({ template, name, sections, selections, onPublish, saving }: Props) => {
    
    const getTotalDrinks = () => {
        let total = 0;
        Object.values(selections).forEach(arr => {
            total += arr.length;
        });
        return total;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Review & Publish</Text>
                <Text style={styles.subtitle}>Almost done! Review your menu details below.</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <GlassView style={styles.summaryCard} intensity={25}>
                    <View style={styles.summaryRow}>
                        <View>
                            <Text style={styles.label}>Menu Name</Text>
                            <Text style={styles.value}>{name}</Text>
                        </View>
                        <IconSymbol name="menucard" size={32} color={Colors.dark.tint} />
                    </View>
                    
                    <View style={styles.divider} />
                    
                    <View style={styles.summaryRow}>
                        <View>
                            <Text style={styles.label}>Template</Text>
                            <Text style={styles.value}>{template?.name}</Text>
                        </View>
                        <IconSymbol name="doc.plaintext" size={32} color={Colors.dark.icon} />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.summaryRow}>
                        <View>
                            <Text style={styles.label}>Total Drinks</Text>
                            <Text style={styles.value}>{getTotalDrinks()} across {sections.length} sections</Text>
                        </View>
                        <IconSymbol name="wineglass" size={32} color={Colors.dark.icon} />
                    </View>
                </GlassView>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 34,
        fontWeight: "bold",
        color: Colors.dark.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.icon,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    summaryCard: {
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    label: {
        fontSize: 14,
        color: Colors.dark.icon,
        marginBottom: 4,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    value: {
        fontSize: 22,
        fontWeight: "bold",
        color: Colors.dark.text,
    },
    divider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.1)",
        marginVertical: 20,
    }
});
