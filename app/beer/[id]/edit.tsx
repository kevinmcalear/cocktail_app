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
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useBeer } from "@/hooks/useBeers";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label, Text, TextArea, XStack, YStack } from "tamagui";

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
    const [style, setStyle] = useState("");
    const [brewery, setBrewery] = useState("");
    const [location, setLocation] = useState("");
    const [abv, setAbv] = useState("");
    const [price, setPrice] = useState("");
    const [localImages, setLocalImages] = useState<{ id?: string, url: string, isNew?: boolean }[]>([]);

    useEffect(() => {
        if (beer) {
            setName(beer.name || "");
            setDescription(beer.description || "");
            setStyle(beer.style || "");
            setBrewery(beer.brewery || "");
            setLocation(beer.location || "");
            setAbv(beer.abv?.toString() || "");
            setPrice(beer.price?.toString() || "");

            // Populate existing images
            if (beer.beer_images) {
                const sortedImages = beer.beer_images.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
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

            // Sync beer_images
            const { data: existingLinks } = await supabase
                .from('beer_images')
                .select('image_id')
                .eq('beer_id', safeId);

            const existingIds = existingLinks?.map(l => l.image_id) || [];
            const idsToDelete = existingIds.filter(eid => !finalImageIds.includes(eid));

            if (idsToDelete.length > 0) {
                 await supabase
                    .from('beer_images')
                    .delete()
                    .eq('beer_id', safeId)
                    .in('image_id', idsToDelete);
            }

            for (let i = 0; i < finalImageIds.length; i++) {
                await supabase
                    .from('beer_images')
                    .upsert({
                        beer_id: safeId, 
                        image_id: finalImageIds[i],
                        sort_order: i
                    }, { onConflict: 'beer_id,image_id' });
            }

            // 2. Update Beer metadata
            const updates = {
                name,
                description,
                style: style || null,
                brewery: brewery || null,
                location: location || null,
                abv: abv ? parseFloat(abv) : null,
                price: price ? parseFloat(price) : null,
            };

            const { error } = await supabase
                .from('beers')
                .update(updates)
                .eq('id', safeId);

            if (error) throw error;

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
            <YStack style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.dark.tint} />
            </YStack>
        );
    }

    return (
        <YStack style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <XStack
                paddingTop={20}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="xmark" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">Edit Beer</Text>
                <Button 
                    onPress={handleSave} 
                    disabled={saving}
                    size="$3"
                    chromeless
                >
                    {saving ? <ActivityIndicator size="small" color={Colors.dark.tint} /> : <Text color={Colors.dark.tint} fontWeight="bold">Save</Text>}
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
                />

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Name *</Label>
                    <Input
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="$color11"
                        placeholder="e.g. Cottage Lager"
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Brewery</Label>
                    <Input
                        value={brewery}
                        onChangeText={setBrewery}
                        placeholderTextColor="$color11"
                        placeholder="e.g. Bellwoods"
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Style</Label>
                    <Input
                        value={style}
                        onChangeText={setStyle}
                        placeholderTextColor="$color11"
                        placeholder="e.g. IPA"
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>
                
                <YStack gap="$2" marginBottom="$4">
                    <Label color="$color11">Location</Label>
                    <Input
                        value={location}
                        onChangeText={setLocation}
                        placeholderTextColor="$color11"
                        placeholder="e.g. Toronto, ON"
                        size="$4"
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
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
                            backgroundColor="rgba(255,255,255,0.05)"
                            borderColor="rgba(255,255,255,0.1)"
                            focusStyle={{ borderColor: Colors.dark.tint }}
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
                            backgroundColor="rgba(255,255,255,0.05)"
                            borderColor="rgba(255,255,255,0.1)"
                            focusStyle={{ borderColor: Colors.dark.tint }}
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
                        backgroundColor="rgba(255,255,255,0.05)"
                        borderColor="rgba(255,255,255,0.1)"
                        focusStyle={{ borderColor: Colors.dark.tint }}
                    />
                </YStack>

            </ScrollView>
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
