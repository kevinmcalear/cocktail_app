import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Text } from "tamagui";
import { useBars } from "@/hooks/useBars";

interface Props {
    selectedId: string | null;
    onSelect: (id: string) => void;
    onNext: () => void;
}

export const Step1Venue = ({ selectedId, onSelect, onNext }: Props) => {
    const { data: userBars, isLoading } = useBars();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.dark.tint} />
            </View>
        );
    }

    const bars = userBars || [];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Select a Venue</Text>
                <Text style={styles.subtitle}>Choose the venue that this menu belongs to.</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {bars.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <IconSymbol name="exclamationmark.triangle" size={48} color={Colors.dark.icon} />
                        <Text style={styles.emptyText}>No venues found.</Text>
                        <Text style={styles.emptySubtext}>You must be assigned to a venue to create a menu.</Text>
                    </View>
                ) : (
                    bars.map((ub: any) => {
                        const bar = ub.bars;
                        if (!bar) return null;
                        const isSelected = selectedId === bar.id;
                        return (
                            <TouchableOpacity
                                key={bar.id}
                                onPress={() => onSelect(bar.id)}
                                activeOpacity={0.7}
                                style={styles.cardWrapper}
                            >
                                <GlassView
                                    style={[styles.card, isSelected && styles.selectedCard]}
                                    intensity={isSelected ? 60 : 30}
                                >
                                    <View style={styles.cardHeader}>
                                        <Text style={[styles.cardTitle, isSelected && { color: Colors.dark.tint }]}>
                                            {bar.name}
                                        </Text>
                                        {isSelected && <IconSymbol name="checkmark.circle.fill" size={24} color={Colors.dark.tint} />}
                                    </View>
                                </GlassView>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
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
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: Colors.dark.text,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: "bold",
        color: Colors.dark.text,
    },
    emptySubtext: {
        fontSize: 16,
        color: Colors.dark.icon,
        textAlign: "center",
        paddingHorizontal: 20,
    }
});
