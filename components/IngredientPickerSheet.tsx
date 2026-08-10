import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Text, useTheme, XStack, YStack } from "tamagui";

import { SearchBar } from "@/components/SearchBar";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { calculateDraftProgress } from "@/lib/draftProgress";
import { capitalize } from "@/lib/stringUtils";

export type IngredientPickerItem = {
    id: string;
    name: string;
};

type IngredientPickerSheetProps = {
    visible: boolean;
    onClose: () => void;
    ingredients: IngredientPickerItem[];
    onSelect: (item: IngredientPickerItem) => void;
    /** Exclude this id (e.g. self when editing a complex ingredient). */
    excludeId?: string | null;
    drafts?: any[];
    dropdowns?: any;
    onCreate?: (searchQuery: string) => void | Promise<void>;
    title?: string;
};

export function IngredientPickerSheet({
    visible,
    onClose,
    ingredients,
    onSelect,
    excludeId,
    drafts,
    dropdowns,
    onCreate,
    title = "Select Ingredient",
}: IngredientPickerSheetProps) {
    const theme = useTheme();
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return ingredients.filter((i) => {
            if (excludeId && i.id === excludeId) return false;
            return i.name.toLowerCase().includes(q);
        });
    }, [ingredients, search, excludeId]);

    const handleClose = () => {
        setSearch("");
        onClose();
    };

    return (
        <AdaptiveSheetModal visible={visible} onClose={handleClose} title={title} maxHeight="80%">
            <View style={{ paddingHorizontal: 24 }}>
                {/* key remounts so autoFocus runs each open */}
                {visible ? (
                    <SearchBar
                        key="ingredient-picker-search"
                        placeholder="Search ingredients..."
                        value={search}
                        onChangeText={setSearch}
                        autoFocus
                        style={{ marginBottom: 16 }}
                    />
                ) : null}
            </View>
            <FlatList
                style={{ maxHeight: 420 }}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                data={filtered}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                    const childDraft = drafts?.find(
                        (d: any) => d.id === item.id && d.entity_type === "ingredient"
                    );
                    const childProgress = childDraft
                        ? calculateDraftProgress(childDraft, drafts ?? [], dropdowns)
                        : null;
                    return (
                        <TouchableOpacity
                            style={[styles.option, { borderBottomColor: theme.borderColor?.get() as string }]}
                            onPress={() => {
                                onSelect(item);
                                setSearch("");
                                onClose();
                            }}
                        >
                            <XStack gap="$2" alignItems="center" flexShrink={1}>
                                <Text color="$color" fontSize={16}>
                                    {capitalize(item.name)}
                                </Text>
                                {childProgress ? (
                                    <View
                                        style={[
                                            styles.draftBadge,
                                            {
                                                backgroundColor: childProgress.badgeBg,
                                                borderColor: childProgress.color,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.draftBadgeText, { color: childProgress.badgeText }]}>
                                            {childProgress.label} ({childProgress.percentage}%)
                                        </Text>
                                    </View>
                                ) : null}
                            </XStack>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <YStack padding="$4" alignItems="center" gap="$4" marginTop="$8">
                        <IconSymbol name="magnifyingglass" size={48} color={theme.color11?.get() as string} />
                        <Text color="$color11" textAlign="center" fontSize={16} fontWeight="bold">
                            No results found
                        </Text>
                        {onCreate ? (
                            <Button
                                marginTop="$4"
                                backgroundColor="$color5"
                                pressStyle={{ scale: 0.97 }}
                                onPress={async () => {
                                    const q = search;
                                    setSearch("");
                                    onClose();
                                    await onCreate(q);
                                }}
                            >
                                <Text color="$color" fontWeight="600">
                                    Create ingredient
                                </Text>
                            </Button>
                        ) : null}
                    </YStack>
                }
            />
        </AdaptiveSheetModal>
    );
}

const styles = StyleSheet.create({
    option: {
        padding: 16,
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    draftBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
    },
    draftBadgeText: {
        fontSize: 11,
        fontWeight: "600",
    },
});
