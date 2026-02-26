import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Input, Label, Separator, Text, YStack } from 'tamagui';

export default function Settings() {
    const { user, updateProfile } = useAuth();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.user_metadata) {
            setFirstName(user.user_metadata.first_name || '');
            setLastName(user.user_metadata.last_name || '');
            setAvatarUrl(user.user_metadata.avatar_url || null);
        }
    }, [user]);

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true, // Request base64 for direct upload if needed, or use uri
            });

            if (!result.canceled) {
                setLocalAvatarUri(result.assets[0].uri);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadAvatar = async (uri: string): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1);
            const fileName = `${user?.id}/${Date.now()}.${ext}`;
            const formData = new FormData();

            // React Native's FormData handling requires this specific object structure for files
            formData.append('file', {
                uri,
                name: fileName,
                type: `image/${ext}`,
            } as any);

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, formData, {
                    upsert: true,
                    contentType: `image/${ext}`,
                });

            if (uploadError) {
                console.error('Upload Error detected:', uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error: any) {
            console.error('Upload catch:', error);
            // If bucket doesn't exist or permissions fail
            Alert.alert('Upload Failed', error.message || 'Could not upload image. Please check storage configuration.');
            return null;
        }
    };

    const handleSave = async () => {
        if (password && password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            let finalAvatarUrl = avatarUrl;

            if (localAvatarUri) {
                const uploadedUrl = await uploadAvatar(localAvatarUri);
                if (uploadedUrl) {
                    finalAvatarUrl = uploadedUrl;
                } else {
                    setLoading(false);
                    return; // Stop if upload failed
                }
            }

            const { error } = await updateProfile({
                firstName,
                lastName,
                password: password || undefined,
                avatarUrl: finalAvatarUrl || undefined,
            });

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert('Success', 'Profile updated successfully');
                setPassword('');
                setConfirmPassword('');
                setLocalAvatarUri(null);
                setAvatarUrl(finalAvatarUrl);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                title: 'Settings',
                headerStyle: { backgroundColor: Colors.dark.background },
                headerTintColor: Colors.dark.text,
                headerShadowVisible: false,
            }} />

            <View style={styles.background}>
                {/* Decorative background elements if needed, or just solid/gradient */}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.avatarContainer}>
                    <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                        <View style={styles.avatarWrapper}>
                            {localAvatarUri || avatarUrl ? (
                                <Image source={{ uri: localAvatarUri || avatarUrl || undefined }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <IconSymbol name="person.fill" size={60} color="rgba(255,255,255,0.3)" />
                                </View>
                            )}
                            <View style={styles.editBadge}>
                                <IconSymbol name="pencil" size={16} color="white" />
                            </View>
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.emailText}>{user?.email}</Text>
                </View>

                <YStack backgroundColor="rgba(255, 255, 255, 0.05)" borderRadius={16} padding="$4" gap="$4">
                    <Text fontSize="$5" fontWeight="600" color="$color">Profile Information</Text>

                    <YStack gap="$2">
                        <Label color="$color11">First Name</Label>
                        <Input
                            size="$4"
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="First Name"
                            backgroundColor="rgba(0,0,0,0.3)"
                            borderColor="rgba(255,255,255,0.1)"
                        />
                    </YStack>

                    <YStack gap="$2">
                        <Label color="$color11">Last Name</Label>
                        <Input
                            size="$4"
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Last Name"
                            backgroundColor="rgba(0,0,0,0.3)"
                            borderColor="rgba(255,255,255,0.1)"
                        />
                    </YStack>

                    <Separator borderColor="rgba(255,255,255,0.1)" marginVertical="$2" />
                    
                    <Text fontSize="$5" fontWeight="600" color="$color">Change Password</Text>

                    <YStack gap="$2">
                        <Label color="$color11">New Password</Label>
                        <Input
                            size="$4"
                            value={password}
                            onChangeText={setPassword}
                            placeholder="New Password"
                            secureTextEntry
                            backgroundColor="rgba(0,0,0,0.3)"
                            borderColor="rgba(255,255,255,0.1)"
                        />
                    </YStack>

                    <YStack gap="$2">
                        <Label color="$color11">Confirm Password</Label>
                        <Input
                            size="$4"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm New Password"
                            secureTextEntry
                            backgroundColor="rgba(0,0,0,0.3)"
                            borderColor="rgba(255,255,255,0.1)"
                        />
                    </YStack>

                    <Button
                        size="$4"
                        marginTop="$2"
                        backgroundColor={Colors.dark.tint}
                        onPress={handleSave}
                        disabled={loading}
                        opacity={loading ? 0.7 : 1}
                    >
                        {loading ? <ActivityIndicator color="white" /> : <Text color="white" fontWeight="600">Save Changes</Text>}
                    </Button>
                </YStack>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.dark.background, // Ensure background is dark
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    avatarWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        position: 'relative',
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#333',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    editBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: Colors.dark.tint,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.dark.background,
    },
    emailText: {
        color: Colors.dark.text,
        marginTop: 12,
        fontSize: 14,
        opacity: 0.6,
    },
    formContainer: {
        padding: 20,
        borderRadius: 24,
        gap: 20,
    },
    sectionTitle: {
        color: Colors.dark.text,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 5,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        color: Colors.dark.text,
        fontSize: 14,
        opacity: 0.8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 12,
        padding: 16,
        color: 'white',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 10,
    },
    saveButton: {
        backgroundColor: Colors.dark.tint,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    disabledButton: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
