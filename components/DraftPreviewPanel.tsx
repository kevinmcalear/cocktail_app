import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Paragraph, ScrollView, Text, XStack, YStack, useTheme, Card } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { useDropdowns } from "@/hooks/useDropdowns";
import { useDrafts } from "@/hooks/useDrafts";
import { calculateDraftProgress } from "@/lib/draftProgress";
import { capitalize } from "@/lib/stringUtils";

interface DraftPreviewPanelProps {
    draft: any;
    onIngredientPress?: (ingredientId: string) => void;
    selectedIngredientId?: string | null;
    onResume?: () => void;
    onDiscard?: () => void;
}

export function DraftPreviewPanel({ 
    draft, 
    onIngredientPress, 
    selectedIngredientId,
    onResume,
    onDiscard
}: DraftPreviewPanelProps) {
    const theme = useTheme();
    const { drafts } = useDrafts();
    const { data: dropdowns } = useDropdowns();

    if (!draft) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor="$background">
                <IconSymbol name="plus.circle" size={48} color={theme.color11?.get() as string} style={{ opacity: 0.3 }} />
                <Text color="$color11" fontSize={16} fontWeight="500" marginTop="$4" textAlign="center">
                    Select a draft to view details and options.
                </Text>
            </YStack>
        );
    }

    const data = draft.draft_data || {};
    const type = draft.entity_type;
    const progressInfo = calculateDraftProgress(draft, drafts, dropdowns);

    const date = new Date(draft.updated_at);
    const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Resolvers
    const getMethodName = (id: string) => dropdowns?.methods?.find((m: any) => m.id === id)?.name;
    const getGlasswareName = (id: string) => dropdowns?.glassware?.find((g: any) => g.id === id)?.name;
    const getIceName = (id: string) => dropdowns?.iceTypes?.find((i: any) => i.id === id)?.name;
    const getFamilyName = (id: string) => dropdowns?.families?.find((f: any) => f.id === id)?.name;

    const getIngredientName = (id: string) => {
        const standard = dropdowns?.ingredients?.find((i: any) => i.id === id);
        if (standard) return standard.name;
        const draftIng = drafts.find((d: any) => d.id === id && d.entity_type === 'ingredient');
        if (draftIng) return `[Draft] ${draftIng.draft_data?.name || 'Untitled Ingredient'}`;
        return 'Unknown Ingredient';
    };

    return (
        <YStack flex={1} backgroundColor="$background">
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
                <YStack flex={1} marginRight="$4" gap="$1">
                    <XStack alignItems="center" gap="$2" flexWrap="wrap">
                        <Text fontSize={20} fontWeight="bold" color="$color" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {data.name || data.menuName || `Untitled ${capitalize(type)}`}
                        </Text>
                        <View style={[styles.typeBadge, { backgroundColor: theme.color5?.get() as string }]}>
                            <Text fontSize={9} fontWeight="bold" color="$color11" textTransform="uppercase">
                                {type}
                            </Text>
                        </View>
                    </XStack>
                </YStack>

                <XStack alignItems="center" gap="$2.5">
                    {onResume && (
                        <TouchableOpacity 
                            onPress={onResume} 
                            style={[styles.actionButton, { backgroundColor: theme.color8?.get() as string }]}
                        >
                            <XStack alignItems="center" gap="$1" paddingHorizontal="$3" paddingVertical="$1.5">
                                <IconSymbol name="play.fill" size={12} color={theme.backgroundStrong?.get() as string} />
                                <Text fontSize={12} fontWeight="bold" color="$backgroundStrong">Resume</Text>
                            </XStack>
                        </TouchableOpacity>
                    )}
                    {onDiscard && (
                        <TouchableOpacity 
                            onPress={onDiscard} 
                            style={[styles.actionButton, { backgroundColor: "rgba(255, 68, 68, 0.1)", borderColor: "rgba(255, 68, 68, 0.2)", borderWidth: 1 }]}
                        >
                            <XStack alignItems="center" gap="$1" paddingHorizontal="$3" paddingVertical="$1.5">
                                <IconSymbol name="trash" size={12} color="#ff4444" />
                                <Text fontSize={12} fontWeight="bold" color="#ff4444">Discard</Text>
                            </XStack>
                        </TouchableOpacity>
                    )}
                </XStack>
            </XStack>

            <ScrollView flex={1} contentContainerStyle={{ padding: 24, gap: 20 }} showsVerticalScrollIndicator={false}>
                
                {/* Progress bar */}
                <YStack gap="$2" backgroundColor="$backgroundStrong" padding="$4" borderRadius={14} borderWidth={1} borderColor="$borderColor">
                    <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize={12} fontWeight="bold" color="$color">Progress Check</Text>
                        <View style={{ backgroundColor: progressInfo.badgeBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: progressInfo.color }}>
                            <Text fontSize={9} fontWeight="bold" color={progressInfo.badgeText} textTransform="uppercase">
                                {progressInfo.label}
                            </Text>
                        </View>
                    </XStack>
                    <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${progressInfo.percentage}%`, backgroundColor: progressInfo.color }]} />
                    </View>
                    <XStack justifyContent="space-between" alignItems="center">
                        <Text fontSize={10} color="$color11" fontWeight="600">{progressInfo.percentage}% complete</Text>
                        <Text fontSize={10} color="$color11">Edited {dateString}</Text>
                    </XStack>
                </YStack>

                {/* Cocktail Draft Details */}
                {type === "cocktail" && (
                    <YStack gap="$4">
                        {/* Specs Badges */}
                        <XStack flexWrap="wrap" gap="$3" justifyContent="flex-start" alignItems="center">
                            {data.methodId && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <CustomIcon name={getMethodName(data.methodId) || ""} size={16} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={11} fontWeight="500">{getMethodName(data.methodId)}</Text>
                                </XStack>
                            )}
                            {data.glasswareId && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <CustomIcon name={getGlasswareName(data.glasswareId) || ""} size={16} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={11} fontWeight="500">{getGlasswareName(data.glasswareId)}</Text>
                                </XStack>
                            )}
                            {data.iceId && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <CustomIcon name={getIceName(data.iceId) || ""} size={16} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={11} fontWeight="500">{getIceName(data.iceId)}</Text>
                                </XStack>
                            )}
                            {data.familyId && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <CustomIcon name={getFamilyName(data.familyId) || ""} size={16} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={11} fontWeight="500">{getFamilyName(data.familyId)}</Text>
                                </XStack>
                            )}
                        </XStack>

                        {/* Description */}
                        {data.description && (
                            <YStack gap="$1.5">
                                <Text fontSize={13} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>Description</Text>
                                <Paragraph color="$color" fontSize={14} lineHeight={20}>{data.description}</Paragraph>
                            </YStack>
                        )}

                        {/* Ingredients */}
                        <YStack gap="$2.5">
                            <Text fontSize={13} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>Recipe Ingredients</Text>
                            {data.recipeItems && data.recipeItems.length > 0 ? (
                                <YStack gap="$2">
                                    {data.recipeItems.map((recipe: any, index: number) => {
                                        const ingredientId = recipe.ingredient_id;
                                        const isIngSelected = selectedIngredientId === ingredientId;
                                        const measurementParts = [];
                                        if (recipe.amount) measurementParts.push(recipe.amount);
                                        if (recipe.unit) measurementParts.push(recipe.unit);
                                        const measurement = measurementParts.join(" ");

                                        return (
                                            <TouchableOpacity 
                                                key={index}
                                                activeOpacity={0.8}
                                                onPress={() => ingredientId && onIngredientPress?.(ingredientId)}
                                            >
                                                <Card 
                                                    flexDirection="row" 
                                                    alignItems="center" 
                                                    padding="$3" 
                                                    gap="$4"
                                                    borderWidth={1}
                                                    borderColor={isIngSelected ? "$color8" : "rgba(255,255,255,0.05)"}
                                                    backgroundColor={isIngSelected ? "rgba(0,122,255,0.08)" : "$backgroundStrong"}
                                                    borderRadius={10}
                                                >
                                                    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" }}>
                                                        <IconSymbol name="drop.fill" size={14} color={theme.color?.get() as string} style={{ opacity: 0.2 }} />
                                                    </View>
                                                    <YStack flex={1} gap="$0.5">
                                                        {measurement ? (
                                                            <Text color={isIngSelected ? "$color8" : "$color"} fontSize={10} opacity={0.6} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                                                                {measurement}
                                                            </Text>
                                                        ) : null}
                                                        <Text color="$color" fontSize={14} fontWeight="500">
                                                            {getIngredientName(ingredientId)}
                                                        </Text>
                                                    </YStack>
                                                    {isIngSelected && (
                                                        <IconSymbol name="chevron.right" size={14} color={theme.color8?.get() as string} />
                                                    )}
                                                </Card>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </YStack>
                            ) : (
                                <Text color="$color11" fontStyle="italic" fontSize={13}>No ingredients added yet.</Text>
                            )}
                        </YStack>
                    </YStack>
                )}

                {/* Ingredient Draft Details */}
                {type === "ingredient" && (
                    <YStack gap="$4">
                        <XStack flexWrap="wrap" gap="$2">
                            {data.brandMaker && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <IconSymbol name="building.2.fill" size={12} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={12} fontWeight="500">{data.brandMaker}</Text>
                                </XStack>
                            )}
                            {data.abv != null && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <IconSymbol name="percent" size={12} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={12} fontWeight="500">{data.abv}% ABV</Text>
                                </XStack>
                            )}
                        </XStack>

                        {/* Batch Build Spec */}
                        <YStack gap="$2.5">
                            <Text fontSize={13} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>Batch Build Spec</Text>
                            {data.recipeItems && data.recipeItems.length > 0 ? (
                                <Card padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
                                    <YStack gap="$2.5">
                                        {data.recipeItems.map((recipe: any, index: number) => {
                                            const name = getIngredientName(recipe.ingredient_id);
                                            const measurementParts = [];
                                            if (recipe.amount) measurementParts.push(recipe.amount);
                                            if (recipe.unit) measurementParts.push(recipe.unit);
                                            const measurement = measurementParts.join(" ");

                                            return (
                                                <XStack key={index} justifyContent="space-between" alignItems="center" paddingVertical="$1">
                                                    <Text color="$color" fontSize={14} fontWeight="500" flex={1} paddingRight="$2">{name}</Text>
                                                    <Text color="$color11" fontSize={13} fontWeight="600">{measurement}</Text>
                                                </XStack>
                                            );
                                        })}
                                    </YStack>
                                </Card>
                            ) : (
                                <Text color="$color11" fontStyle="italic" fontSize={13}>No batch ingredients specified.</Text>
                            )}
                        </YStack>
                    </YStack>
                )}

                {/* Beer / Wine Draft Details */}
                {(type === "beer" || type === "wine") && (
                    <YStack gap="$4">
                        <XStack flexWrap="wrap" gap="$2">
                            {(data.brewery || data.vintner) && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <IconSymbol name="building.2.fill" size={12} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={12} fontWeight="500">{data.brewery || data.vintner}</Text>
                                </XStack>
                            )}
                            {data.abv != null && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <IconSymbol name="percent" size={12} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={12} fontWeight="500">{data.abv}% ABV</Text>
                                </XStack>
                            )}
                            {data.price != null && (
                                <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                    <IconSymbol name="dollarsign.circle.fill" size={12} color={theme.color?.get() as string} />
                                    <Text color="$color" fontSize={12} fontWeight="500">${data.price}</Text>
                                </XStack>
                            )}
                        </XStack>
                        
                        {data.description && (
                            <YStack gap="$1.5">
                                <Text fontSize={13} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>Description</Text>
                                <Paragraph color="$color" fontSize={14} lineHeight={20}>{data.description}</Paragraph>
                            </YStack>
                        )}
                    </YStack>
                )}

                {/* Menu Draft Details */}
                {type === "menu" && (
                    <YStack gap="$4">
                        {data.selectedTemplateId && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10" alignSelf="flex-start">
                                <IconSymbol name="doc.plaintext" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">
                                    Template: {dropdowns?.menuTemplates?.find((t: any) => t.id === data.selectedTemplateId)?.name || 'Custom'}
                                </Text>
                            </XStack>
                        )}

                        <YStack gap="$3">
                            <Text fontSize={13} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>Selections</Text>
                            {data.selections && Object.keys(data.selections).length > 0 ? (
                                <YStack gap="$3">
                                    {Object.keys(data.selections).map((sectionId: string) => {
                                        const drinkIds = data.selections[sectionId] || [];
                                        const sectionName = dropdowns?.templateSections?.find((s: any) => s.id === sectionId)?.name || 'Custom Section';
                                        if (drinkIds.length === 0) return null;

                                        return (
                                            <YStack key={sectionId} gap="$1.5">
                                                <Text fontSize={12} fontWeight="bold" color="$color">{sectionName}</Text>
                                                <Card padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" borderRadius={10}>
                                                    <YStack gap="$1.5">
                                                        {drinkIds.map((drinkId: string) => {
                                                            let cleanId = drinkId;
                                                            let cleanType = 'cocktail';
                                                            if (drinkId.startsWith('beer-')) {
                                                                cleanId = drinkId.replace('beer-', '');
                                                                cleanType = 'beer';
                                                            } else if (drinkId.startsWith('wine-')) {
                                                                cleanId = drinkId.replace('wine-', '');
                                                                cleanType = 'wine';
                                                            }
                                                            
                                                            const draftDrink = drafts.find((d: any) => d.id === cleanId && d.entity_type === cleanType);
                                                            const name = draftDrink 
                                                                ? `[Draft] ${draftDrink.draft_data?.name || `Untitled ${cleanType}`}`
                                                                : `Standard ${cleanType} (ID: ${cleanId})`; // Real resolution is handled dynamically, let's keep it simple

                                                            return (
                                                                <Text key={drinkId} color="$color" fontSize={13} opacity={0.9}>
                                                                    • {name}
                                                                </Text>
                                                            );
                                                        })}
                                                    </YStack>
                                                </Card>
                                            </YStack>
                                        );
                                    })}
                                </YStack>
                            ) : (
                                <Text color="$color11" fontStyle="italic" fontSize={13}>No selections made.</Text>
                            )}
                        </YStack>
                    </YStack>
                )}

            </ScrollView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    actionButton: {
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    typeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 5,
    },
    progressBarTrack: {
        height: 6,
        width: "100%",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderRadius: 3,
        overflow: "hidden",
    },
    progressBarFill: {
        height: "100%",
        borderRadius: 3,
    },
});
