import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "tamagui";

interface Props {
    templates: any[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onNext: () => void;
}

export const Step1Template = ({ templates, selectedId, onSelect, onNext }: Props) => {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Choose a Template</Text>
                <Text style={styles.subtitle}>Select a starting point for your menu.</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {templates.map((template) => {
                    const isSelected = selectedId === template.id;
                    return (
                        <TouchableOpacity
                            key={template.id}
                            onPress={() => onSelect(template.id)}
                            activeOpacity={0.7}
                            style={styles.cardWrapper}
                        >
                            <GlassView
                                style={[styles.card, isSelected && styles.selectedCard]}
                                intensity={isSelected ? 60 : 30}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1}}>
                                        <Text style={[styles.cardTitle, isSelected && { color: Colors.dark.tint }]}>
                                            {template.name}
                                        </Text>
                                        <TouchableOpacity 
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                router.push({ pathname: "/menus/create-template", params: { id: template.id } });
                                            }}
                                            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                                        >
                                            <IconSymbol name="pencil.circle" size={24} color={Colors.dark.icon} />
                                        </TouchableOpacity>
                                    </View>
                                    {isSelected && <IconSymbol name="checkmark.circle.fill" size={24} color={Colors.dark.tint} />}
                                </View>
                                <Text style={styles.cardDesc}>{template.description}</Text>
                            </GlassView>
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity 
                    style={styles.createNewTemplateBtn}
                    onPress={() => router.push("/menus/create-template")}
                >
                    <IconSymbol name="plus.circle" size={24} color={Colors.dark.icon} />
                    <Text style={styles.createNewTemplateText}>Create New Template</Text>
                </TouchableOpacity>
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
        gap: 15,
    },
    cardWrapper: {
        marginBottom: 10,
    },
    card: {
        padding: 24,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: "transparent",
    },
    selectedCard: {
        borderColor: Colors.dark.tint,
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: Colors.dark.text,
    },
    cardDesc: {
        color: Colors.dark.icon,
        fontSize: 16,
        lineHeight: 22,
    },
    createNewTemplateBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 10,
        padding: 20,
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "rgba(255,255,255,0.2)",
    },
    createNewTemplateText: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: "600",
    }
});
