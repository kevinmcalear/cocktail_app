import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';
import { decode } from "base64-arraybuffer";
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, Input, Text, XStack, YStack, useTheme } from 'tamagui';

export default function EditProfile() {
    const { user, updateProfile } = useAuth();
    const router = useRouter();
    const theme = useTheme();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Initial avatar url or placeholder
    const defaultAvatar = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80";
    const [avatarUrl, setAvatarUrl] = useState<string>(user?.user_metadata?.avatar_url || defaultAvatar);
    const [localImageUri, setLocalImageUri] = useState<string | null>(null);
    const [localImageBase64, setLocalImageBase64] = useState<string | null>(null);

    const pickImage = async (useCamera: boolean = false) => {
        let result;
        const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        };

        if (useCamera) {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permission to access camera is required!");
                return;
            }
            result = await ImagePicker.launchCameraAsync(options);
        } else {
            result = await ImagePicker.launchImageLibraryAsync(options);
        }

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setLocalImageUri(result.assets[0].uri);
            setLocalImageBase64(result.assets[0].base64 || null);
        }
    };

    const handleSave = async () => {
        // Validation
        if (password || confirmPassword) {
            if (password !== confirmPassword) {
                Alert.alert("Passwords do not match");
                return;
            }
            if (password.length < 6) {
                Alert.alert("Password must be at least 6 characters");
                return;
            }
        }

        setLoading(true);

        let newAvatarUrl = avatarUrl; // Keep existing by default

        // Upload image if a new local image was selected
        if (localImageUri && localImageBase64) {
            try {
                const ext = localImageUri.split('.').pop()?.toLowerCase() || 'jpeg';
                const fileName = `${user?.id}/${Date.now()}.${ext}`;

                const arrayBuffer = decode(localImageBase64);

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });

                if (uploadError) {
                    console.error("Upload error:", uploadError);
                    Alert.alert("Error uploading image", uploadError.message);
                    setLoading(false);
                    return;
                }

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                newAvatarUrl = publicUrl;
                setAvatarUrl(publicUrl); // Update local state immediately
            } catch (error: any) {
                console.error("Image upload exception:", error);
                Alert.alert("Failed to upload image.");
                setLoading(false);
                return;
            }
        }

        // Call update profile
        const { error } = await updateProfile({
            password: password ? password : undefined,
            avatarUrl: newAvatarUrl !== defaultAvatar ? newAvatarUrl : undefined,
        });

        setLoading(false);

        if (error) {
            Alert.alert("Error updating profile", error.message);
        } else {
            router.back();
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <YStack flex={1} backgroundColor="$background">
                <Stack.Screen options={{ headerShown: false }} />

                {/* Header Navbar */}
                <XStack alignItems="center" justifyContent="space-between" padding="$4" borderBottomWidth={1} borderColor="$borderColor">
                    <Button size="$3" variant="outlined" onPress={() => router.back()} backgroundColor="$background" borderColor="$borderColor">
                        <Text color="$color11">Cancel</Text>
                    </Button>
                    <Text fontSize={18} fontWeight="bold" color="$color">Edit Profile</Text>
                    <Button size="$3" onPress={handleSave} disabled={loading} backgroundColor="$color">
                        {loading ? <ActivityIndicator color={theme.background?.get() as string} /> : <Text color="$background" fontWeight="bold">Save</Text>}
                    </Button>
                </XStack>

                <ScrollView>
                    <YStack padding="$4" gap="$6">
                        {/* Avatar Section */}
                        <YStack alignItems="center" gap="$3">
                            <YStack position="relative">
                                <Image
                                    source={{ uri: localImageUri || avatarUrl }}
                                    style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: theme.color11?.get() as string }}
                                />
                                <Button
                                    size="$3"
                                    circular
                                    position="absolute"
                                    bottom={0}
                                    right={0}
                                    backgroundColor="$color"
                                    onPress={() => pickImage(false)}
                                    icon={<IconSymbol name="pencil" size={16} color={theme.background?.get() as string} />}
                                />
                            </YStack>
                            <XStack gap="$3">
                                <Button size="$3" variant="outlined" onPress={() => pickImage(false)} borderColor="$borderColor">
                                    <Text color="$color">Choose Photo</Text>
                                </Button>
                                <Button size="$3" variant="outlined" onPress={() => pickImage(true)} borderColor="$borderColor">
                                    <View>
                                        <Text color="$color">Take Photo</Text>
                                    </View>
                                </Button>
                            </XStack>
                        </YStack>

                        <YStack gap="$4">
                            <Text fontSize={18} fontWeight="bold" color="$color">Change Password</Text>
                            <YStack gap="$2">
                                <Text color="$color11" fontSize={14}>New Password</Text>
                                <Input
                                    size="$4"
                                    placeholder="Enter new password"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                    backgroundColor="$backgroundStrong"
                                    borderColor="$borderColor"
                                    color="$color"
                                />
                            </YStack>
                            <YStack gap="$2">
                                <Text color="$color11" fontSize={14}>Confirm New Password</Text>
                                <Input
                                    size="$4"
                                    placeholder="Confirm new password"
                                    secureTextEntry
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    backgroundColor="$backgroundStrong"
                                    borderColor="$borderColor"
                                    color="$color"
                                />
                            </YStack>
                        </YStack>
                    </YStack>
                </ScrollView>
            </YStack>
        </KeyboardAvoidingView>
    );
}
