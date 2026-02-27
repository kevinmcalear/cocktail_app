import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { Text } from 'tamagui';
import { GlassView } from './ui/GlassView';
import { IconSymbol } from './ui/icon-symbol';

interface GenerateImageButtonProps {
    type: 'cocktail' | 'ingredient' | 'beer' | 'wine';
    id: string;
    name?: string;
    subIngredients?: string[];
    style?: any;
    variant?: 'default' | 'placeholder' | 'tile';
}

export function GenerateImageButton({ type, id, name, subIngredients = [], style, variant = 'default' }: GenerateImageButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const queryClient = useQueryClient();

    const handlePress = async () => {
        if (isGenerating) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsGenerating(true);

        try {
            const functionName = `generate-${type}-image`;
            let body: any = {};

            switch (type) {
                case 'cocktail':
                    body = { cocktail_id: id };
                    break;
                case 'beer':
                    body = { beer_id: id };
                    break;
                case 'wine':
                    body = { wine_id: id };
                    break;
                case 'ingredient':
                    if (!name) throw new Error("Ingredient name is required");
                    body = { ingredient_id: id, ingredient_name: name, sub_ingredients: subIngredients };
                    break;
            }

            const { data, error } = await supabase.functions.invoke(functionName, { body });

            if (error) {
                 throw new Error(error.message || "Failed to generate image.");
            }

            // Success, vibrate
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Invalidate the cache right away so the UI fetches the new image
            queryClient.invalidateQueries({ queryKey: [type, id] });

        } catch (err: any) {
            console.error("Generation Error:", err);
            Alert.alert("Generation Failed", err.message || "Something went wrong.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Simple floating animation for the sparkles
    const floatAnim = useSharedValue(0);
    const glowAnim = useSharedValue(0.3);

    React.useEffect(() => {
        if (variant === 'placeholder') {
            floatAnim.value = withRepeat(
                withSequence(
                    withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
                ),
                -1, // Infinite
                true // reverse
            );
            
            glowAnim.value = withRepeat(
                withSequence(
                    withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        }
    }, [variant]);

    const animatedSparkles = useAnimatedStyle(() => ({
        transform: [{ translateY: floatAnim.value }],
        opacity: glowAnim.value,
        shadowColor: Colors.dark.tint,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: glowAnim.value,
        shadowRadius: 10,
    }));

    if (variant === 'placeholder') {
        return (
            <TouchableOpacity 
                onPress={handlePress} 
                activeOpacity={0.8} 
                disabled={isGenerating}
                style={[styles.placeholderContainer, style]}
            >
                {/* Subtle magical noise/gradient layer could go here if we had an asset, 
                    for now relying on dark background and glow */}
                {isGenerating ? (
                    <View style={styles.loadingContainerCol}>
                        <ActivityIndicator size="large" color={Colors.dark.tint} />
                        <Text style={styles.placeholderText}>Consulting the spirits...</Text>
                    </View>
                ) : (
                    <View style={styles.placeholderContent}>
                        <Animated.View style={animatedSparkles}>
                            <IconSymbol name="sparkles" size={42} color={Colors.dark.tint} style={{ marginBottom: 16 }} />
                        </Animated.View>
                        <Text style={styles.placeholderText}>Generate Image</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    }

    if (variant === 'tile') {
        return (
            <TouchableOpacity 
                onPress={handlePress} 
                activeOpacity={0.8} 
                disabled={isGenerating}
                style={[styles.tileContainer, style]}
            >
                {isGenerating ? (
                    <View style={styles.loadingContainerCol}>
                        <ActivityIndicator size="small" color={Colors.dark.tint} />
                        <Text style={[styles.tileText, { marginTop: 8 }]}>Generating...</Text>
                    </View>
                ) : (
                    <View style={styles.tileContent}>
                        <IconSymbol name="sparkles" size={24} color={Colors.dark.tint} />
                        <Text style={styles.tileText}>Generate</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    }

    return (
        <View style={[styles.container, style]}>
            <TouchableOpacity onPress={handlePress} activeOpacity={0.8} disabled={isGenerating}>
                <GlassView intensity={40} style={[styles.glass, isGenerating && styles.glassLoading]}>
                    {isGenerating ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                            <Text style={styles.loadingText}>Generating...</Text>
                        </View>
                    ) : (
                        <IconSymbol name="sparkles" size={24} color="#FFFFFF" />
                    )}
                </GlassView>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        right: 20,
        zIndex: 50,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    glass: {
        height: 48,
        width: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    glassLoading: {
        width: 'auto',
        paddingHorizontal: 16,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    loadingContainerCol: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    placeholderContainer: {
        flex: 1,
        backgroundColor: '#0A0A0C', // Even darker, more magical void
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    placeholderContent: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30, // Increase hit area essentially
    },
    placeholderText: {
        color: Colors.dark.tint,
        fontSize: 12, 
        fontFamily: 'IBMPlexSansItalic',
        opacity: 0.4,
    },
    tileContainer: {
        width: 100,
        height: 125,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.tint,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        marginRight: 12,
    },
    tileContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    tileText: {
        fontSize: 14,
        color: Colors.dark.tint,
        fontWeight: '600',
    }
});
