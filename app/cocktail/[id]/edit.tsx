import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { DatabaseCocktail } from "@/types/types";

export default function EditCocktailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();

    const [loading, setLoading] = useState(true);
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

    // Dropdown Data
    const [methods, setMethods] = useState<{ id: string, name: string }[]>([]);
    const [glassware, setGlassware] = useState<{ id: string, name: string }[]>([]);
    const [families, setFamilies] = useState<{ id: string, name: string }[]>([]);

    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageChanged, setImageChanged] = useState(false);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch dropdown options
            const [methodsRes, glasswareRes, familiesRes] = await Promise.all([
                supabase.from('methods').select('*'),
                supabase.from('glassware').select('*'),
                supabase.from('families').select('*')
            ]);

            if (methodsRes.data) setMethods(methodsRes.data);
            if (glasswareRes.data) setGlassware(glasswareRes.data);
            if (familiesRes.data) setFamilies(familiesRes.data);

            // Fetch Cocktail Data
            const { data, error } = await supabase
                .from('cocktails')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            if (data) {
                const c = data as DatabaseCocktail;
                setName(c.name || "");
                setDescription(c.description || "");
                setOrigin(c.origin || "");
                setGarnish(c.garnish || "");
                setNotes(c.notes || "");
                setSpec(c.spec || "");

                setMethodId(c.method_id);
                setGlasswareId(c.glassware_id);
                setFamilyId(c.family_id);

                setImageUri(c.image);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert("Error", "Failed to load cocktail details");
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "We need access to your photos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            setImageChanged(true);
        }
    };

    const uploadImage = async (uri: string): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1);
            const fileName = `cocktails/${id}/${Date.now()}.${ext}`;
            const formData = new FormData();

            formData.append('file', {
                uri,
                name: fileName,
                type: `image/${ext}`
            } as any);

            const { data, error } = await supabase.storage
                .from('drinks')
                .upload(fileName, formData);

            if (error) {
                console.error("Storage upload error:", error);
                throw error;
            }

            const { data: publicUrlData } = supabase.storage
                .from('drinks')
                .getPublicUrl(fileName);

            return publicUrlData.publicUrl;

        } catch (error) {
            console.error("Image upload failed:", error);
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
            let finalImageUrl = imageUri;

            if (imageChanged && imageUri && !imageUri.startsWith('http')) {
                // Upload new image
                const uploadedUrl = await uploadImage(imageUri);
                if (uploadedUrl) {
                    finalImageUrl = uploadedUrl;
                } else {
                    Alert.alert("Error", "Failed to upload image.");
                    setSaving(false);
                    return;
                }
            }

            const updates: Partial<DatabaseCocktail> = {
                name,
                description,
                origin: origin || null,
                garnish: garnish || null,
                notes: notes || null,
                spec: spec || null,
                method_id: methodId,
                glassware_id: glasswareId,
                family_id: familyId,
                image: finalImageUrl
            };

            const { error } = await supabase
                .from('cocktails')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            Alert.alert("Success", "Cocktail updated!", [
                { text: "OK", onPress: () => router.back() }
            ]);

        } catch (error) {
            console.error("Update error:", error);
            Alert.alert("Error", "Failed to update cocktail.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.dark.tint} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <GlassView style={[styles.header, { paddingTop: insets.top + 10 }]} intensity={80}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle">Edit Cocktail</ThemedText>
                <View style={styles.headerBtn} />
            </GlassView>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>

                {/* Image Picker */}
                <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                    {imageUri ? (
                        <ExpoImage source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <IconSymbol name="camera" size={40} color={Colors.dark.icon} />
                            <ThemedText>Add Photo</ThemedText>
                        </View>
                    )}
                    <GlassView intensity={30} style={styles.editIconBadge}>
                        <IconSymbol name="pencil" size={16} color="#fff" />
                    </GlassView>
                </TouchableOpacity>

                {/* Text Fields */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Name *</ThemedText>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholderTextColor="#666"
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Description</ThemedText>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                        placeholderTextColor="#666"
                    />
                </View>

                {/* Dropdowns (Simulated with horizontal scroll for now) */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Method</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                        {methods.map(m => (
                            <TouchableOpacity
                                key={m.id}
                                style={[styles.pill, methodId === m.id && styles.pillActive]}
                                onPress={() => setMethodId(m.id)}
                            >
                                <ThemedText style={[styles.pillText, methodId === m.id && styles.pillTextActive]}>{m.name}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Glassware</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                        {glassware.map(g => (
                            <TouchableOpacity
                                key={g.id}
                                style={[styles.pill, glasswareId === g.id && styles.pillActive]}
                                onPress={() => setGlasswareId(g.id)}
                            >
                                <ThemedText style={[styles.pillText, glasswareId === g.id && styles.pillTextActive]}>{g.name}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Family</ThemedText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillContainer}>
                        {families.map(f => (
                            <TouchableOpacity
                                key={f.id}
                                style={[styles.pill, familyId === f.id && styles.pillActive]}
                                onPress={() => setFamilyId(f.id)}
                            >
                                <ThemedText style={[styles.pillText, familyId === f.id && styles.pillTextActive]}>{f.name}</ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* More Details */}
                <View style={styles.section}>
                    <ThemedText style={styles.label}>Origin</ThemedText>
                    <TextInput
                        style={styles.input}
                        value={origin}
                        onChangeText={setOrigin}
                        placeholderTextColor="#666"
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Garnish</ThemedText>
                    <TextInput
                        style={styles.input}
                        value={garnish}
                        onChangeText={setGarnish}
                        placeholderTextColor="#666"
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Notes</ThemedText>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        placeholderTextColor="#666"
                    />
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.label}>Spec</ThemedText>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={spec}
                        onChangeText={setSpec}
                        multiline
                        placeholderTextColor="#666"
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </ThemedView>
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
    imagePicker: {
        width: '100%',
        height: 300,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 10,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        alignItems: 'center',
        gap: 10
    },
    editIconBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
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
    saveButton: {
        backgroundColor: Colors.dark.tint,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
    }
});
