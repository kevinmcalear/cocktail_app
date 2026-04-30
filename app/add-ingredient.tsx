import { BottomSheetBackdrop, BottomSheetModal, BottomSheetModalProvider, BottomSheetView, BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Platform,
    KeyboardAvoidingView,
    Modal
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SearchBar } from "@/components/SearchBar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme, View } from "tamagui";
import { CategoryPickerModal } from "@/components/CategoryPickerModal";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    amount: string;
    unit: string;
}

export default function AddIngredientScreen() {
    const router = useRouter();
    const { barId } = useLocalSearchParams<{ barId?: string }>();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [brandMaker, setBrandMaker] = useState("");
    const [abv, setAbv] = useState("");

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const categoryPickerRef = useRef<BottomSheetModal>(null);

    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [ingredientSearch, setIngredientSearch] = useState("");
    const bottomSheetModalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%'], []);

    const { data: dropdowns } = useDropdowns();
    const allIngredients = dropdowns?.ingredients || [];

    const handlePresentModalPress = useCallback(() => {
        bottomSheetModalRef.current?.present();
    }, []);

    const handleDismissModalPress = useCallback(() => {
        bottomSheetModalRef.current?.dismiss();
    }, []);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }
        setSaving(true);
        try {
            // 1. Create Ingredient
            const { data: ingredient, error: ingredientError } = await supabase
                .from('items')
                .insert({
                    name: name.trim(),
                    description: description.trim() || null,
                    item_type: 'ingredient',
                    brand_maker: brandMaker.trim() || null,
                    abv: abv ? parseFloat(abv) : null,
                    bar_id: barId || null
                })
                .select()
                .single();

            if (ingredientError || !ingredient) throw ingredientError;

            const ingredientId = ingredient.id;

            // Categories
            for (const catId of selectedCategories) {
                await supabase
                    .from('item_categories')
                    .upsert({
                        item_id: ingredientId,
                        category_id: catId,
                        is_primary: true
                    }, { onConflict: 'item_id,category_id' });
            }

            if (recipeItems.length > 0) {
                const recipeInserts = recipeItems.map(item => ({
                    recipe_item_id: ingredientId,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                }));

                const { error: recipeError } = await supabase
                    .from('recipes')
                    .insert(recipeInserts);

                if (recipeError) throw recipeError;
            }

            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
            if (barId) {
                queryClient.invalidateQueries({ queryKey: ['bar', barId] });
            }

            Alert.alert("Success", "Ingredient created!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error: any) {
            console.error("Creation error:", error);
            Alert.alert("Error", error.message || "Failed to create ingredient.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <BottomSheetModalProvider>
        <YStack style={styles.container} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
            
            <XStack
                paddingTop={Platform.OS === 'ios' ? 20 : insets.top + 20}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="xmark" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">New Ingredient</Text>
                <Button 
                    onPress={handleSave} 
                    disabled={saving}
                    size="$3"
                    chromeless
                >
                    {saving ? <ActivityIndicator size="small" color={theme.color8?.get() as string} /> : <Text color={theme.color8?.get() as string} fontWeight="bold">Save</Text>}
                </Button>
            </XStack>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                    
                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">Name *</Label>
                        <Input
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="$color11"
                            placeholder="e.g. Rich Simple Syrup"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">Brand / Maker</Label>
                        <Input
                            value={brandMaker}
                            onChangeText={setBrandMaker}
                            placeholderTextColor="$color11"
                            placeholder="e.g. Campari, Buffalo Trace"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">ABV (%)</Label>
                        <Input
                            value={abv}
                            onChangeText={setAbv}
                            keyboardType="numeric"
                            placeholderTextColor="$color11"
                            placeholder="e.g. 40"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    <YStack gap="$2" marginBottom="$4">
                        <XStack justifyContent="space-between" alignItems="center">
                            <Label color="$color11">Spirit Tags</Label>
                            <TouchableOpacity onPress={() => categoryPickerRef.current?.present()}>
                                <Text color={theme.color8?.get() as string} fontWeight="bold">+ Add</Text>
                            </TouchableOpacity>
                        </XStack>
                        <XStack flexWrap="wrap" gap="$2">
                            {selectedCategories.length === 0 ? (
                                <Text color="$color11" fontStyle="italic">No tags selected</Text>
                            ) : (
                                selectedCategories.map(catId => {
                                    const cat = dropdowns?.categories?.find((c: any) => c.id === catId);
                                    if (!cat) return null;
                                    return (
                                        <XStack key={catId} backgroundColor="$backgroundStrong" paddingHorizontal={12} paddingVertical={6} borderRadius={16}>
                                            <Text color="$color">{cat.name}</Text>
                                        </XStack>
                                    );
                                })
                            )}
                        </XStack>
                    </YStack>

                    <YStack gap="$2" marginBottom="$4">
                        <Label color="$color11">Description / Notes</Label>
                        <TextArea
                            value={description}
                            onChangeText={setDescription}
                            numberOfLines={4}
                            placeholderTextColor="$color11"
                            placeholder="Optional description..."
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    {/* Ingredients / Recipe */}
                    <YStack gap="$2" marginBottom="$4">
                        <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                            <Label color="$color11">Recipe (for Complex Ingredients)</Label>
                            <TouchableOpacity onPress={handlePresentModalPress}>
                                <Text color={theme.color8?.get() as string} fontWeight="bold">+ Add</Text>
                            </TouchableOpacity>
                        </XStack>

                        {recipeItems.length === 0 && (
                            <Text color="$color11" fontSize={14} fontStyle="italic" marginBottom="$2">
                                Add ingredients here if this is a pre-batched item (e.g. syrups, infusions). 
                                Leave empty for raw ingredients.
                            </Text>
                        )}

                        {recipeItems.map((item, index) => (
                            <XStack key={index} alignItems="center" justifyContent="space-between" backgroundColor="$backgroundStrong" padding="$3" borderRadius="$3" marginBottom="$2">
                                <Text flex={1} color="$color" fontSize={16}>{item.name}</Text>
                                <XStack gap="$2" alignItems="center">
                                    <Input
                                        width={60}
                                        size="$3"
                                        placeholder="amt"
                                        placeholderTextColor="$color11"
                                        keyboardType="numeric"
                                        value={item.amount}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].amount = v;
                                            setRecipeItems(newItems);
                                        }}
                                        backgroundColor="$background"
                                        borderColor="transparent"
                                        textAlign="center"
                                    />
                                    <Input
                                        width={60}
                                        size="$3"
                                        placeholder="oz"
                                        placeholderTextColor="$color11"
                                        value={item.unit}
                                        onChangeText={(v) => {
                                            const newItems = [...recipeItems];
                                            newItems[index].unit = v;
                                            setRecipeItems(newItems);
                                        }}
                                        backgroundColor="$background"
                                        borderColor="transparent"
                                        textAlign="center"
                                    />
                                    <TouchableOpacity onPress={() => setRecipeItems(recipeItems.filter((_, i) => i !== index))}>
                                        <IconSymbol name="trash" size={20} color={theme.red10?.get() as string || "#ff4444"} />
                                    </TouchableOpacity>
                                </XStack>
                            </XStack>
                        ))}
                    </YStack>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* Native Modal for adding ingredients avoiding gorhom issues */}
            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={handleDismissModalPress}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1 }}
                >
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleDismissModalPress} />
                        <View style={[styles.fullSheetModalContent, { backgroundColor: theme.background?.get() as string, paddingBottom: insets.bottom }]}>
                            <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                                <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
                                    <Text fontSize={20} fontWeight="bold" color="$color">Select Ingredient</Text>
                                    <TouchableOpacity onPress={handleDismissModalPress}>
                                        <IconSymbol name="xmark" size={24} color={theme.color11?.get() as string} />
                                    </TouchableOpacity>
                                </XStack>
                                <SearchBar
                                    placeholder="Search ingredients..."
                                    value={ingredientSearch}
                                    onChangeText={setIngredientSearch}
                                    style={{ marginBottom: 16 }}
                                />
                            </View>
                            <FlatList
                                style={{ flex: 1 }}
                                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                                data={allIngredients.filter((i: any) => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))}
                                keyExtractor={item => item.id}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                        onPress={() => {
                                            setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, amount: "", unit: "" }]);
                                            handleDismissModalPress();
                                            setIngredientSearch("");
                                        }}
                                    >
                                        <Text color="$color11" fontSize={16}>{item.name}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <CategoryPickerModal 
                ref={categoryPickerRef}
                domains={['spirit']}
                selectedCategoryIds={selectedCategories}
                onToggleCategory={(cat) => {
                    if (selectedCategories.includes(cat.id)) {
                        setSelectedCategories(prev => prev.filter(id => id !== cat.id));
                    } else {
                        setSelectedCategories(prev => [...prev, cat.id]);
                    }
                }}
            />

        </YStack>
        </BottomSheetModalProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    fullSheetModalContent: {
        borderTopLeftRadius: 48,
        borderTopRightRadius: 48,
        borderCurve: 'continuous',
        height: '80%'
    }
});
