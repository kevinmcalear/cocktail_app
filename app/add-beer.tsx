import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet, TouchableOpacity,
    Platform, KeyboardAvoidingView, Modal
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDrafts } from "@/hooks/useDrafts";

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { BottomSheetModal, BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack, useTheme, View } from "tamagui";
import { CategoryPickerModal } from "@/components/CategoryPickerModal";
import { useDropdowns } from "@/hooks/useDropdowns";
import { BarAssignmentAccordion } from "@/components/BarAssignmentAccordion";

export default function AddBeerScreen() {
    const router = useRouter();
    const { barId: initialBarId, draftId } = useLocalSearchParams<{ barId?: string, draftId?: string }>();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    const [saving, setSaving] = useState(false);
    const queryClient = useQueryClient();

    const { drafts, saveDraft, deleteDraft, isFetching } = useDrafts();
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);

    const [showExitModal, setShowExitModal] = useState(false);
    const pendingNavigationActionRef = React.useRef<any>(null);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [brewery, setBrewery] = useState("");
    const [abv, setAbv] = useState("");
    const [price, setPrice] = useState("");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [localImages, setLocalImages] = useState<{ id?: string, url: string, isNew?: boolean }[]>([]);
    
    // Bar Assignment and Overrides
    const [barId, setBarId] = useState<string | null>(initialBarId || null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);

    const { data: dropdowns } = useDropdowns();
    const categoryPickerRef = React.useRef<BottomSheetModal>(null);

    const draftLoadedRef = React.useRef<string | null>(null);
    const currentStateStr = JSON.stringify({ name, description, brewery, abv, price, selectedCategories, localImages, barId, overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep });
    const cleanStateStrRef = React.useRef<string>(currentStateStr);
    const [needsCleanMark, setNeedsCleanMark] = useState(false);

    React.useEffect(() => {
        if (needsCleanMark) {
            cleanStateStrRef.current = currentStateStr;
            setNeedsCleanMark(false);
        }
    }, [needsCleanMark, currentStateStr]);

    React.useEffect(() => {
        if (currentDraftId && drafts.length > 0 && draftLoadedRef.current !== currentDraftId) {
            if (isFetching) return;
            
            const draft = drafts.find((d: any) => d.id === currentDraftId);
            if (draft && draft.draft_data) {
                draftLoadedRef.current = currentDraftId;
                const data = draft.draft_data;
                setName(data.name || "");
                setDescription(data.description || "");
                setBrewery(data.brewery || "");
                setAbv(data.abv || "");
                setPrice(data.price || "");
                setSelectedCategories(data.selectedCategories || []);
                setLocalImages(data.localImages || []);
                setBarId(data.barId || initialBarId || null);
                setOverrideVisibility(data.overrideVisibility || null);
                setOverrideGeneric(data.overrideGeneric || null);
                setOverrideSpecific(data.overrideSpecific || null);
                setOverrideMeasurement(data.overrideMeasurement || null);
                setOverridePrep(data.overridePrep || null);
                setNeedsCleanMark(true);
            } else {
                draftLoadedRef.current = currentDraftId;
            }
        }
    }, [currentDraftId, drafts, isFetching]);

    const handleSaveDraft = async () => {
        try {
            setSaving(true);
            const draftData = { name, description, brewery, abv, price, selectedCategories, localImages, barId, overrideVisibility, overrideGeneric, overrideSpecific, overrideMeasurement, overridePrep };
            const result = await saveDraft({ id: currentDraftId || undefined, entityType: 'beer', draftData });
            
            if (!currentDraftId && result && result.id) {
                setCurrentDraftId(result.id);
                router.setParams({ draftId: result.id });
            }
            
            if (Platform.OS === 'web') {
                window.alert("Draft saved successfully!");
            } else {
                Alert.alert("Success", "Draft saved successfully!");
            }
            setNeedsCleanMark(true);
        } catch (error) {
            console.error("Draft error:", error);
            if (Platform.OS === 'web') {
                window.alert("Failed to save draft.");
            } else {
                Alert.alert("Error", "Failed to save draft.");
            }
        } finally {
            setSaving(false);
        }
    };

    React.useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            const isDirty = currentStateStr !== cleanStateStrRef.current;
            if (!isDirty) {
                return;
            }
            e.preventDefault();
            pendingNavigationActionRef.current = e.data.action;
            setShowExitModal(true);
        });

        return unsubscribe;
    }, [navigation, currentStateStr]);

    const confirmExit = async (shouldSave: boolean) => {
        setShowExitModal(false);
        if (shouldSave) {
            await handleSaveDraft();
        }
        if (pendingNavigationActionRef.current) {
            navigation.dispatch(pendingNavigationActionRef.current);
        }
    };

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
            setSaving(true);
            try {
                const newImages: { id?: string, url: string, isNew?: boolean }[] = [];
                for (const asset of result.assets) {
                    const ext = asset.uri.substring(asset.uri.lastIndexOf('.') + 1) || 'jpg';
                    const fileName = `drafts/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
                    const arrayBuffer = decode(base64);

                    const { error: uploadError } = await supabase.storage
                        .from('drinks')
                        .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

                    if (!uploadError) {
                        const { data: publicUrlData } = supabase.storage.from('drinks').getPublicUrl(fileName);
                        
                        const { data: imgData, error: imgError } = await supabase
                            .from('images')
                            .insert({ url: publicUrlData.publicUrl })
                            .select()
                            .single();
                            
                        if (!imgError && imgData) {
                            newImages.push({
                                id: imgData.id,
                                url: publicUrlData.publicUrl,
                                isNew: false
                            });
                        }
                    }
                }
                setLocalImages(prev => [...prev, ...newImages]);
            } catch (error) {
                console.error("Error uploading drafted image", error);
                Alert.alert("Error", "Failed to upload image");
            } finally {
                setSaving(false);
            }
        }
    };

    const uploadAndLinkImage = async (uri: string, itemId: string): Promise<string | null> => {
        try {
            if (uri.startsWith('http')) {
                const { data: imgData, error: imgError } = await supabase
                    .from('images')
                    .select('id')
                    .eq('url', uri)
                    .limit(1)
                    .single();
                if (imgData && !imgError) return imgData.id;
                
                const { data: newImgData, error: newImgError } = await supabase
                    .from('images')
                    .insert({ url: uri })
                    .select()
                    .single();
                if (!newImgError && newImgData) return newImgData.id;
                return null;
            }

            const ext = uri.substring(uri.lastIndexOf('.') + 1) || 'jpg';
            const fileName = `beers/${itemId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

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
            // 1. Update metadata (insert beer)
            const updates = {
                item_type: 'beer',
                name,
                description,
                brand_maker: brewery || null,
                abv: abv ? parseFloat(abv) : null,
                price: price ? parseFloat(price) : null,
                bar_id: barId || null,
                override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                override_prep_level: overridePrep ? parseInt(overridePrep) : null,
            };

            const { data: newBeer, error: insertError } = await supabase
                .from('items')
                .insert(updates)
                .select()
                .single();

            if (insertError || !newBeer) throw insertError;
            const newBeerId = newBeer.id;

            // 2. Handle Images
            const finalImageIds: string[] = [];
            for (const img of localImages) {
                if (img.isNew) {
                    const newId = await uploadAndLinkImage(img.url, newBeerId);
                    if (!newId) throw new Error("Failed to upload image");
                    finalImageIds.push(newId);
                } else if (img.id) {
                    finalImageIds.push(img.id);
                }
            }

            if (finalImageIds.length > 0) {
                const imageInserts = finalImageIds.map((imgId, index) => ({
                    item_id: newBeerId,
                    image_id: imgId,
                    sort_order: index
                }));
                const { error: insertError } = await supabase
                    .from('item_images')
                    .insert(imageInserts);
                if (insertError) throw insertError;
            }

            for (const catId of selectedCategories) {
                await supabase
                    .from('item_categories')
                    .upsert({
                        item_id: newBeerId,
                        category_id: catId,
                        is_primary: true
                    }, { onConflict: 'item_id,category_id' });
            }

            queryClient.invalidateQueries({ queryKey: ['beers'] });
            await queryClient.invalidateQueries({ queryKey: ['dropdowns_v2'] });
            if (currentDraftId) {
                await deleteDraft(currentDraftId);
            }
            if (barId) {
                queryClient.invalidateQueries({ queryKey: ['bar', barId] });
            }

            Alert.alert("Success", "Beer created!", [
                { text: "OK", onPress: () => {
                    cleanStateStrRef.current = currentStateStr;
                    router.back();
                } }
            ]);

        } catch (error: any) {
            console.error("Creation error:", error);
            Alert.alert("Error", error.message || "Failed to create beer.");
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
                <Text fontSize="$5" fontWeight="bold">Add Beer</Text>
                <XStack gap="$2" alignItems="center">
                    <Button 
                        onPress={handleSaveDraft} 
                        disabled={saving}
                        size="$3"
                        chromeless
                    >
                        <Text color="$color11" fontWeight="500">Save Draft</Text>
                    </Button>
                    <Button 
                        onPress={handleSave} 
                        disabled={saving}
                        size="$3"
                        chromeless
                    >
                        {saving ? <ActivityIndicator size="small" color={theme.color8?.get() as string} /> : <Text color={theme.color8?.get() as string} fontWeight="bold">Save</Text>}
                    </Button>
                </XStack>
            </XStack>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                    <SortableImageList 
                        images={localImages}
                        onReorder={setLocalImages}
                        onRemove={(index) => {
                            const newImages = localImages.filter((_, i) => i !== index);
                            setLocalImages(newImages);
                        }}
                        onAdd={pickImage}
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

                    <BarAssignmentAccordion
                        barId={barId} setBarId={setBarId}
                        overrideVisibility={overrideVisibility} setOverrideVisibility={setOverrideVisibility}
                        overrideGeneric={overrideGeneric} setOverrideGeneric={setOverrideGeneric}
                        overrideSpecific={overrideSpecific} setOverrideSpecific={setOverrideSpecific}
                        overrideMeasurement={overrideMeasurement} setOverrideMeasurement={setOverrideMeasurement}
                        overridePrep={overridePrep} setOverridePrep={setOverridePrep}
                    />

                </ScrollView>
            </KeyboardAvoidingView>
            
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

            {/* Custom Exit Modal */}
            <Modal
                visible={showExitModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowExitModal(false)}
            >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
                    <YStack 
                        backgroundColor="$backgroundStrong" 
                        padding="$5" 
                        borderRadius="$4" 
                        width="85%" 
                        maxWidth={400}
                        borderWidth={1}
                        borderColor="$borderColor"
                        gap="$4"
                    >
                        <Text fontSize="$6" fontWeight="bold" color="$color">Unsaved Changes</Text>
                        <Text fontSize="$4" color="$color11">You have unsaved changes. Do you want to save your draft before leaving?</Text>
                        
                        <XStack justifyContent="flex-end" gap="$3" marginTop="$2">
                            <Button size="$3" chromeless onPress={() => setShowExitModal(false)}>
                                <Text color="$color11">Cancel</Text>
                            </Button>
                            <Button size="$3" backgroundColor="#ff4444" onPress={() => confirmExit(false)}>
                                <Text color="white" fontWeight="bold">Discard</Text>
                            </Button>
                            <Button size="$3" backgroundColor={theme.color8?.get() as string} onPress={() => confirmExit(true)}>
                                <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold">Save</Text>
                            </Button>
                        </XStack>
                    </YStack>
                </View>
            </Modal>
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
