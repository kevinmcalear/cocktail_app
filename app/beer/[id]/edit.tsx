import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet, TouchableOpacity
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { GenerateImageButton } from "@/components/GenerateImageButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useBeer } from "@/hooks/useBeers";
import { supabase } from "@/lib/supabase";
import { BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme, View } from "tamagui";
import { CategoryPickerModal } from "@/components/CategoryPickerModal";
import { useDropdowns } from "@/hooks/useDropdowns";

export default function EditBeerScreen() {
    const { id } = useLocalSearchParams();
    // Safely unprefix id if necessary
    const safeId = (id as string)?.replace('beer-', '');

    const router = useRouter();
    const insets = useSafeAreaInsets();

    const { data: beer, isLoading } = useBeer(safeId);
    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [brewery, setBrewery] = useState("");
    const [abv, setAbv] = useState("");
    const [price, setPrice] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const { data: dropdowns } = useDropdowns();
    const categoryPickerRef = React.useRef<BottomSheetModal>(null);
    const theme = useTheme();

    const [localImages, setLocalImages] = useState<{ id?: string, url: string, isNew?: boolean }[]>([]);

    useEffect(() => {
        if (beer) {
            setName(beer.name || "");
            setDescription(beer.description || "");
            setBrewery(beer.brand_maker || "");
            setAbv(beer.abv?.toString() || "");
            setPrice(beer.price?.toString() || "");

            if (beer.item_categories) {
                setSelectedCategories(beer.item_categories.map((ic: any) => ic.category_id));
            }

            // Populate existing images
            if (beer.item_images) {
                const sortedImages = beer.item_images.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
                const fetchedImages = sortedImages.map((bi: any) => ({
                    id: bi.images.id,
                    url: bi.images.url,
                    isNew: false
                }));
                setLocalImages(fetchedImages);
            }
        }
    }, [beer]);

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
                url: asset.uri,
                isNew: true
            }));
            setLocalImages(prev => [...prev, ...newImages]);
        }
    };

    const uploadAndLinkImage = async (uri: string): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1);
            const fileName = `beers/${safeId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage
                .from('drinks')
                .upload(fileName, arrayBuffer, {
                    contentType: `image/${ext}`,
                    upsert: false
                });

            if (uploadError) return null;

            const { data: publicUrlData } = supabase.storage
                .from('drinks')
                .getPublicUrl(fileName);

            const { data: imgData, error: imgError } = await supabase
                .from('images')
                .insert({ url: publicUrlData.publicUrl })
                .select()
                .single();

            if (imgError || !imgData) return null;

            return imgData.id;
        } catch (error) {
            console.error("Image upload flow exception:", error);
            return null;
        }
    };

    const handleSave = async () => {
        if (!name?.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return;
        }

        setSaving(true);
        try {
            // 1. Handle Images
            const finalImageIds: string[] = [];
            for (const img of localImages) {
                if (img.isNew) {
                    const newId = await uploadAndLinkImage(img.url);
                    if (!newId) throw new Error("Failed to upload image");
                    finalImageIds.push(newId);
                } else if (img.id) {
                    finalImageIds.push(img.id);
                }
            }

            // Sync item_images
            const { data: existingLinks } = await supabase
                .from('item_images')
                .select('image_id')
                .eq('item_id', safeId);

            const existingIds = existingLinks?.map(l => l.image_id) || [];
            const idsToDelete = existingIds.filter(eid => !finalImageIds.includes(eid));

            if (idsToDelete.length > 0) {
                 await supabase
                    .from('item_images')
                    .delete()
                    .eq('item_id', safeId)
                    .in('image_id', idsToDelete);
            }

            for (let i = 0; i < finalImageIds.length; i++) {
                await supabase
                    .from('item_images')
                    .upsert({
                        item_id: safeId, 
                        image_id: finalImageIds[i],
                        sort_order: i
                    }, { onConflict: 'item_id,image_id' });
            }

            // 2. Update metadata
            const updates = {
                name,
                description,
                brand_maker: brewery || null,
                abv: abv ? parseFloat(abv) : null,
                price: price ? parseFloat(price) : null,
            };

            const { error } = await supabase
                .from('items')
                .update(updates)
                .eq('id', safeId);

            if (error) throw error;

            // Sync item_categories
            const { data: existingCatLinks } = await supabase
                .from('item_categories')
                .select('category_id')
                .eq('item_id', safeId);

            const existingCatIds = existingCatLinks?.map(l => l.category_id) || [];
            const catIdsToDelete = existingCatIds.filter(eid => !selectedCategories.includes(eid));
            const catIdsToAdd = selectedCategories.filter(eid => !existingCatIds.includes(eid));

            if (catIdsToDelete.length > 0) {
                 await supabase
                    .from('item_categories')
                    .delete()
                    .eq('item_id', safeId)
                    .in('category_id', catIdsToDelete);
            }

            for (const catId of catIdsToAdd) {
                await supabase
                    .from('item_categories')
                    .upsert({
                        item_id: safeId,
                        category_id: catId,
                        is_primary: true
                    }, { onConflict: 'item_id,category_id' });
            }

            queryClient.invalidateQueries({ queryKey: ['beer', safeId] });
            queryClient.invalidateQueries({ queryKey: ['beers'] });

            Alert.alert("Success", "Beer updated!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error("Update error:", error);
            Alert.alert("Error", "Failed to update beer.");
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
                <ActivityIndicator size="large" color={theme.color8?.get() as string} />
            </YStack>
        );
    }

    return (
        <BottomSheetModalProvider>
        <YStack style={styles.container} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false }} />

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
                <Text fontSize="$5" fontWeight="bold">Edit Beer</Text>
                <Button 
                    onPress={handleSave} 
                    disabled={saving}
                    size="$3"
                    chromeless
                >
                    {saving ? <ActivityIndicator size="small" color={theme.color8?.get() as string} /> : <Text color={theme.color8?.get() as string} fontWeight="bold">Save</Text>}
                </Button>
            </XStack>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                <SortableImageList 
                    images={localImages}
                    onReorder={setLocalImages}
                    onRemove={(index) => {
                        const newImages = localImages.filter((_, i) => i !== index);
                        setLocalImages(newImages);
                    }}
                    onAdd={pickImage}
                    generateComponent={<GenerateImageButton type="beer" id={safeId} variant="tile" />}
                />

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Name *</Label>
                    <Input
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="$color11"
                        placeholder="e.g. Cottage Lager"
                        size="$4"
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Brewery / Brand</Label>
                    <Input
                        value={brewery}
                        onChangeText={setBrewery}
                        placeholderTextColor="$color11"
                        placeholder="e.g. Bellwoods"
                        size="$4"
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <XStack justifyContent="space-between" alignItems="center">
                        <Label color="$color11">Tags (Style, Region)</Label>
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

                <XStack gap="$3" marginBottom="$4">
                    <YStack flex={1} gap="$2">
                        <Label color="$color11">ABV (%)</Label>
                        <Input
                            value={abv}
                            onChangeText={setAbv}
                            keyboardType="numeric"
                            placeholderTextColor="$color11"
                            placeholder="e.g. 5.0"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>
                    <YStack flex={1} gap="$2">
                        <Label color="$color11">Price ($)</Label>
                        <Input
                            value={price}
                            onChangeText={setPrice}
                            keyboardType="numeric"
                            placeholderTextColor="$color11"
                            placeholder="e.g. 8.00"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>
                </XStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Description / Notes</Label>
                    <TextArea
                        value={description}
                        onChangeText={setDescription}
                        numberOfLines={4}
                        placeholderTextColor="$color11"
                        size="$4"
                        backgroundColor="$backgroundStrong"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>

            </ScrollView>
            
            <CategoryPickerModal 
                ref={categoryPickerRef}
                domains={['beer']}
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
    }
});
