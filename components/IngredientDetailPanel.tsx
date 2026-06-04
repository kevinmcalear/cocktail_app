import React, { useEffect } from "react";
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Paragraph, ScrollView, Text, XStack, YStack, useTheme, Card } from "tamagui";
import { useRouter } from "expo-router";

import { useIngredient } from "@/hooks/useIngredients";
import { useBars } from "@/hooks/useBars";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface IngredientDetailPanelProps {
    id: string;
    onClose?: () => void;
    onLoadRecipeStatus?: (hasRecipe: boolean) => void;
}

export function IngredientDetailPanel({ id, onClose, onLoadRecipeStatus }: IngredientDetailPanelProps) {
    const router = useRouter();
    const theme = useTheme();
    const { isEditModeEnabled } = useSettingsStore();

    const selectedBarId = useAppStore((state) => state.selectedBarId);
    const { data: bars } = useBars();
    const currentBarRole = bars?.find((b) => b.bar_id === selectedBarId)?.role_level || 10;
    const canEdit = currentBarRole > 30; // Admin (40) can see complex ingredient details and edit them.

    const { data, isLoading, error } = useIngredient(id);
    const ingredient = data?.ingredient;
    const recipe = data?.recipe || [];

    useEffect(() => {
        if (!isLoading && data) {
            onLoadRecipeStatus?.(recipe.length > 0);
        }
    }, [isLoading, data, recipe.length, onLoadRecipeStatus]);

    if (isLoading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$backgroundStrong">
                <ActivityIndicator size="large" color={theme.color8?.get() as string} />
                <Text color="$color11" marginTop="$2">Loading ingredient details...</Text>
            </YStack>
        );
    }

    if (error || !ingredient) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$backgroundStrong">
                <IconSymbol name="exclamationmark.triangle.fill" size={32} color="$red10" style={{ opacity: 0.5 }} />
                <Text color="$color11" marginTop="$2">Failed to load ingredient details.</Text>
            </YStack>
        );
    }

    const onEditPress = canEdit ? () => {
        router.push(`/ingredient/${id}/edit`);
    } : undefined;

    return (
        <YStack flex={1} backgroundColor="$backgroundStrong" borderLeftWidth={1} borderLeftColor="$borderColor">
            {/* Header */}
            <XStack 
                paddingVertical="$4" 
                paddingHorizontal="$6" 
                borderBottomWidth={1} 
                borderBottomColor="$borderColor" 
                justifyContent="space-between" 
                alignItems="center"
                backgroundColor="$backgroundStrong"
            >
                <YStack flex={1} marginRight="$2">
                    <Text fontSize={20} fontWeight="bold" color="$color" numberOfLines={1}>
                        {ingredient.name}
                    </Text>
                </YStack>
                
                <XStack alignItems="center" gap="$2">
                    {onEditPress && isEditModeEnabled && (
                        <TouchableOpacity 
                            onPress={onEditPress} 
                            style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.05)" }]}
                        >
                            <IconSymbol name="ellipsis" size={16} color={theme.color?.get() as string} />
                        </TouchableOpacity>
                    )}
                    {onClose && (
                        <TouchableOpacity 
                            onPress={onClose} 
                            style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.05)" }]}
                        >
                            <IconSymbol name="xmark" size={16} color={theme.color?.get() as string} />
                        </TouchableOpacity>
                    )}
                </XStack>
            </XStack>

            <ScrollView flex={1} contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
                {/* Batch Indicator Badge */}
                {recipe.length > 0 && (
                    <XStack 
                        backgroundColor="rgba(0,122,255,0.1)" 
                        borderColor="rgba(0,122,255,0.2)"
                        borderWidth={1}
                        paddingHorizontal="$3" 
                        paddingVertical="$1.5" 
                        borderRadius={8} 
                        alignSelf="flex-start"
                        alignItems="center"
                        gap="$2"
                    >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.color8?.get() as string }} />
                        <Text color="$color8" fontSize={11} fontWeight="bold" letterSpacing={0.5} textTransform="uppercase">
                            Batch Recipe Attached
                        </Text>
                    </XStack>
                )}

                {/* About Card */}
                {ingredient.description && (
                    <GlassView style={styles.card} intensity={10}>
                        <View style={styles.cardHeader}>
                            <IconSymbol name="info.circle" size={18} color={theme.color?.get() as string} />
                            <Text style={[styles.cardTitle, { color: theme.color?.get() as string }]}>About</Text>
                        </View>
                        <Paragraph style={[styles.description, { color: theme.color?.get() as string, opacity: 0.8 }]}>
                            {ingredient.description}
                        </Paragraph>
                    </GlassView>
                )}

                {/* Recipe Section (Build Spec) */}
                {recipe.length > 0 ? (
                    <GlassView style={styles.card} intensity={10}>
                        <View style={styles.cardHeader}>
                            <IconSymbol name="flask" size={18} color={theme.color?.get() as string} />
                            <Text style={[styles.cardTitle, { color: theme.color?.get() as string }]}>Build Spec</Text>
                        </View>
                        
                        <View style={styles.recipeList}>
                            {recipe.map((item: any, index: number) => (
                                <View key={item.id} style={[styles.recipeRow, index !== recipe.length - 1 && styles.recipeBorder]}>
                                    <Text style={[styles.recipeName, { color: theme.color?.get() as string }]} numberOfLines={2}>
                                        {item.ingredient?.name || "Unknown"}
                                    </Text>
                                    <View style={styles.amounts}>
                                        {item.amount && <Text style={[styles.amountText, { color: theme.color?.get() as string }]}>{item.amount}</Text>}
                                        {item.unit && <Text style={[styles.amountText, { color: theme.color?.get() as string }]}>{item.unit}</Text>}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </GlassView>
                ) : (
                    <Card padding="$4" backgroundColor="rgba(255,255,255,0.02)" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
                        <Text color="$color11" fontStyle="italic" textAlign="center">
                            No batch build spec recipe.
                        </Text>
                    </Card>
                )}
            </ScrollView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    actionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
    },
    card: {
        borderRadius: 16,
        padding: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
        overflow: "hidden",
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        gap: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "bold",
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
    },
    recipeList: {
        gap: 10,
    },
    recipeRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 2,
    },
    recipeBorder: {
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.05)",
        paddingBottom: 10,
        marginBottom: 2,
    },
    recipeName: {
        fontSize: 14,
        fontWeight: "500",
        flex: 1,
        paddingRight: 10,
    },
    amounts: {
        flexDirection: "row",
        gap: 4,
        alignItems: "center",
    },
    amountText: {
        fontSize: 13,
        fontWeight: "600",
        opacity: 0.8,
    },
});
