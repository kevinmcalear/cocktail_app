import { BottomSearchBar } from "@/components/BottomSearchBar";
import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    ScrollView,
    StyleSheet,
    TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useDropdowns } from "@/hooks/useDropdowns";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme } from "tamagui";

interface RecipeItem {
    id?: string;
    ingredient_id: string;
    name: string;
    bsp: string;
    ml: string;
    dash: string;
    amount: string;
    is_top: boolean;
}

interface Menu {
    id: string;
    name: string;
}

export default function AddCocktailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();

    const methods = dropdowns?.methods || [];
    const glassware = dropdowns?.glassware || [];
    const families = dropdowns?.families || [];
    const iceTypes = dropdowns?.iceTypes || [];
    const allIngredients = dropdowns?.ingredients || [];
    const menus = dropdowns?.menus || [];

    const loading = loadingDropdowns;
    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [garnish, setGarnish] = useState("");
    const [notes, setNotes] = useState("");
    const [spec, setSpec] = useState("");

    // Checkbox/Selection State (IDs)
    const [methodId, setMethodId] = useState<string | null>(null);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);


    // Recipe State
    const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
    const [showIngredientPicker, setShowIngredientPicker] = useState(false);
    const [ingredientSearch, setIngredientSearch] = useState("");

    const theme = useTheme();
    const pickerSheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['80%'], []);

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

    useEffect(() => {
        if (showIngredientPicker) {
            pickerSheetRef.current?.present();
        } else {
            pickerSheetRef.current?.dismiss();
            setIngredientSearch("");
        }
    }, [showIngredientPicker]);

    // Image State (Local only for creation)
    const [localImages, setLocalImages] = useState<{ id: string, url: string }[]>([]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "We need access to your photos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled) {
            const newImages = result.assets.map(asset => ({
                id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                url: asset.uri,
            }));
            setLocalImages(prev => [...prev, ...newImages]);
        }
    };



    const uploadImage = async (uri: string, cocktailId: string): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1);
            const fileName = `cocktails/${cocktailId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage
                .from('drinks')
                .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

            if (uploadError) return null;

            const { data: publicUrlData } = supabase.storage.from('drinks').getPublicUrl(fileName);
            
            const { data: imgData, error: imgError } = await supabase
                .from('images')
                .insert({ url: publicUrlData.publicUrl })
                .select()
                .single();

            if (imgError || !imgData) return null;
            return imgData.id;
        } catch (error) {
            console.error("Image upload exception:", error);
            return null;
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }
        setSaving(true);
        try {
            // 1. Create Cocktail
            const { data: cocktail, error: cocktailError } = await supabase
                .from('cocktails')
                .insert({
                    name,
                    description,
                    origin: origin || null,
                    garnish_1: garnish || null,
                    notes: notes || null,
                    spec: spec || null,
                    method_id: methodId,
                    glassware_id: glasswareId,
                    family_id: familyId,
                    ice_id: iceId,
                })
                .select()
                .single();

            if (cocktailError || !cocktail) throw cocktailError;

            const cocktailId = cocktail.id;

            // 2. Upload & Link Images
            for (let i = 0; i < localImages.length; i++) {
                const imgId = await uploadImage(localImages[i].url, cocktailId);
                if (imgId) {
                    await supabase.from('cocktail_images').insert({
                        cocktail_id: cocktailId,
                        image_id: imgId,
                        sort_order: i
                    });
                }
            }

            // 3. Save Recipes
            for (const item of recipeItems) {
                await supabase.from('recipes').insert({
                    cocktail_id: cocktailId,
                    ingredient_id: item.ingredient_id,
                    ingredient_bsp: parseFloat(item.bsp) || null,
                    ingredient_ml: parseFloat(item.ml) || null,
                    ingredient_dash: parseFloat(item.dash) || null,
                    ingredient_amount: parseFloat(item.amount) || null,
                    is_top: item.is_top || false,
                });
            }



            Alert.alert("Success", "Cocktail created!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error("Creation error:", error);
            Alert.alert("Error", "Failed to create cocktail.");
        } finally {
            setSaving(false);
        }
    };


    return (
        <YStack style={styles.container} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <XStack
                paddingTop={20}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">New Cocktail</Text>
                <Button 
                    onPress={handleSave} 
                    disabled={saving}
                    size="$3"
                    chromeless
                >
                    {saving ? <ActivityIndicator size="small" color={Colors.dark.tint} /> : <Text color={Colors.dark.tint} fontWeight="bold">Save</Text>}
                </Button>
            </XStack>

            {loading ? (
                <YStack flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator size="large" color={Colors.dark.tint} />
                </YStack>
            ) : (
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
                {/* Image List */}
                <SortableImageList 
                    images={localImages}
                    onReorder={(newOrder) => {
                        const typedOrder = newOrder.map(item => ({
                            id: item.id || `recovered-${Date.now()}-${Math.random()}`,
                            url: item.url
                        }));
                        setLocalImages(typedOrder);
                    }}
                    onRemove={(index) => setLocalImages(prev => prev.filter((_, i) => i !== index))}
                    onAdd={pickImage}
                />

                {/* Main Info */}
                <YStack gap="$2">
                    <Label color="$color11">Name *</Label>
                    <Input
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="$color11"
                        placeholder="e.g. Negroni"
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Description</Label>
                    <TextArea
                        value={description}
                        onChangeText={setDescription}
                        numberOfLines={4}
                        placeholderTextColor="$color11"
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                {/* Drink Specs Dropdowns */}
                <YStack gap="$2">
                    <Label color="$color11">Method</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {methods.map(m => (
                                <Button
                                    key={m.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={methodId === m.id ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                    borderColor={methodId === m.id ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                    borderWidth={1}
                                    onPress={() => setMethodId(m.id)}
                                >
                                    <Text color={methodId === m.id ? "#000" : Colors.dark.text} fontWeight={methodId === m.id ? "bold" : "normal"}>{m.name}</Text>
                                </Button>
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Glassware</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {glassware.map(g => (
                                <Button
                                    key={g.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={glasswareId === g.id ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                    borderColor={glasswareId === g.id ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                    borderWidth={1}
                                    onPress={() => setGlasswareId(g.id)}
                                >
                                    <Text color={glasswareId === g.id ? "#000" : Colors.dark.text} fontWeight={glasswareId === g.id ? "bold" : "normal"}>{g.name}</Text>
                                </Button>
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Family</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {families.map(f => (
                                <Button
                                    key={f.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={familyId === f.id ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                    borderColor={familyId === f.id ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                    borderWidth={1}
                                    onPress={() => setFamilyId(f.id)}
                                >
                                    <Text color={familyId === f.id ? "#000" : Colors.dark.text} fontWeight={familyId === f.id ? "bold" : "normal"}>{f.name}</Text>
                                </Button>
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Ice</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <XStack gap="$2">
                            {iceTypes.map(i => (
                                <Button
                                    key={i.id}
                                    size="$3"
                                    borderRadius="$10"
                                    backgroundColor={iceId === i.id ? Colors.dark.tint : "rgba(255,255,255,0.05)"}
                                    borderColor={iceId === i.id ? Colors.dark.tint : "rgba(255,255,255,0.1)"}
                                    borderWidth={1}
                                    onPress={() => setIceId(iceId === i.id ? null : i.id)}
                                >
                                    <Text color={iceId === i.id ? "#000" : Colors.dark.text} fontWeight={iceId === i.id ? "bold" : "normal"}>{i.name}</Text>
                                </Button>
                            ))}
                        </XStack>
                    </ScrollView>
                </YStack>

                {/* Ingredients */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.label}>Ingredients</Text>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(true)}>
                            <Text style={styles.addText}>+ Add</Text>
                        </TouchableOpacity>
                    </View>

                    {recipeItems.map((item, index) => (
                        <View key={index} style={styles.recipeRow}>
                            <Text style={styles.recipeName}>{item.name}</Text>
                            <View style={[styles.recipeInputs, { flexWrap: 'wrap', justifyContent: 'flex-end', flex: 2, gap: 4 }]}>
                                <Button
                                    size="$2"
                                    backgroundColor={item.is_top ? Colors.dark.tint : 'rgba(255,255,255,0.05)'}
                                    onPress={() => {
                                        const newItems = [...recipeItems];
                                        newItems[index].is_top = !newItems[index].is_top;
                                        setRecipeItems(newItems);
                                    }}
                                >
                                    <Text color={item.is_top ? '#000' : '#fff'} fontSize={12}>Top</Text>
                                </Button>
                                <Input
                                    size="$2"
                                    width={60}
                                    placeholder="bsp"
                                    keyboardType="numeric"
                                    backgroundColor="rgba(255,255,255,0.05)"
                                    borderColor="rgba(255,255,255,0.1)"
                                    value={item.bsp}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].bsp = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
                                <Input
                                    size="$2"
                                    width={60}
                                    placeholder="ml"
                                    keyboardType="numeric"
                                    backgroundColor="rgba(255,255,255,0.05)"
                                    borderColor="rgba(255,255,255,0.1)"
                                    value={item.ml}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].ml = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
                                <Input
                                    size="$2"
                                    width={60}
                                    placeholder="dash"
                                    keyboardType="numeric"
                                    backgroundColor="rgba(255,255,255,0.05)"
                                    borderColor="rgba(255,255,255,0.1)"
                                    value={item.dash}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].dash = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
                                <Input
                                    size="$2"
                                    width={60}
                                    placeholder="amt"
                                    keyboardType="numeric"
                                    backgroundColor="rgba(255,255,255,0.05)"
                                    borderColor="rgba(255,255,255,0.1)"
                                    value={item.amount}
                                    onChangeText={(v) => {
                                        const newItems = [...recipeItems];
                                        newItems[index].amount = v;
                                        setRecipeItems(newItems);
                                    }}
                                />
                                <TouchableOpacity onPress={() => setRecipeItems(recipeItems.filter((_, i) => i !== index))}>
                                    <IconSymbol name="trash" size={20} color="#ff4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Extra Details */}
                <YStack gap="$2">
                    <Label color="$color11">Origin</Label>
                    <Input 
                        value={origin} 
                        onChangeText={setOrigin} 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Garnish</Label>
                    <Input 
                        value={garnish} 
                        onChangeText={setGarnish} 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Notes</Label>
                    <TextArea 
                        value={notes} 
                        onChangeText={setNotes} 
                        multiline 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2">
                    <Label color="$color11">Spec</Label>
                    <TextArea 
                        value={spec} 
                        onChangeText={setSpec} 
                        multiline 
                        placeholderTextColor="$color11" 
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

            </ScrollView>
            )}

            {/* Ingredient Picker Bottom Sheet */}
            <BottomSheetModal
                ref={pickerSheetRef}
                index={0}
                snapPoints={snapPoints}
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: theme.background?.get() as string }}
                handleIndicatorStyle={{ backgroundColor: theme.borderColor?.get() as string }}
                onDismiss={() => setShowIngredientPicker(false)}
            >
                <BottomSheetView style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: theme.color?.get() as string }]}>Select Ingredient</Text>
                        <TouchableOpacity onPress={() => setShowIngredientPicker(false)}>
                            <IconSymbol name="xmark" size={24} color={theme.color11?.get() as string} />
                        </TouchableOpacity>
                    </View>
                    <BottomSearchBar
                        placeholder="Search ingredients..."
                        value={ingredientSearch}
                        onChangeText={setIngredientSearch}
                        style={{ marginBottom: 16 }}
                    />
                    <FlatList
                        data={allIngredients.filter(i => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.ingredientOption}
                                onPress={() => {
                                    setRecipeItems([...recipeItems, { ingredient_id: item.id, name: item.name, bsp: "", ml: "", dash: "", amount: "", is_top: false }]);
                                    setShowIngredientPicker(false);
                                }}
                            >
                                <Text style={styles.ingredientText}>{item.name}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </BottomSheetView>
            </BottomSheetModal>



        </YStack>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
        gap: 24,
    },
    section: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#888',
        marginLeft: 4,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    selectButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pillContainer: {
        flexDirection: 'row',
    },
    pill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pillActive: {
        backgroundColor: Colors.dark.tint,
        borderColor: Colors.dark.tint,
    },
    pillText: {
        color: '#ccc',
        fontSize: 14,
    },
    pillTextActive: {
        color: '#000',
        fontWeight: 'bold',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    addText: {
        color: Colors.dark.tint,
        fontWeight: 'bold',
        fontSize: 14,
    },
    recipeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: 10,
        borderRadius: 10,
        marginBottom: 8
    },
    recipeName: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        paddingRight: 8
    },
    recipeInputs: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center'
    },
    smallInput: {
        width: 44,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 8,
        color: '#fff',
        textAlign: 'center',
        justifyContent: 'center',
        fontSize: 14
    },
    modalContent: {
        flex: 1,
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff'
    },
    searchInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 12,
        color: '#fff',
        marginBottom: 10
    },
    ingredientOption: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    ingredientText: {
        color: '#ccc',
        fontSize: 16
    },

});
