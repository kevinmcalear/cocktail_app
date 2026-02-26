import { Colors } from '@/constants/theme';
import { useAuth } from '@/ctx/AuthContext';
import { BlurView } from 'expo-blur';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Input, Text, XStack, YStack } from 'tamagui';

export default function SignUp() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { signUp } = useAuth();

    const handleSignUp = async () => {
        setLoading(true);
        const { data, error } = await signUp(email, password);
        setLoading(false);

        if (error) {
            Alert.alert('Sign Up Failed', error.message);
        } else if (!data.session) {
            // If no session, email verification is likely required
            Alert.alert('Success', 'Please check your inbox for email verification!');
            router.replace('/auth/login');
        }
        // If session exists, RootLayout will handle the redirect to tabs
    };

    return (
        <ImageBackground
            source={require('../../assets/images/cocktail-bg.png')}
            resizeMode="cover"
            style={styles.container}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}>
                <StatusBar style="light" />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.glassContainer}>
                        <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                            <Text fontSize="$8" fontWeight="bold" color="$color" marginBottom="$2">Create Account</Text>
                            <Text fontSize="$4" color="$icon" marginBottom="$6" textAlign="center">Join us and discover liquid art</Text>

                            <YStack width="100%" gap="$4" marginBottom="$4">
                                <Input
                                    size="$4"
                                    placeholder="Email"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    backgroundColor="rgba(255, 255, 255, 0.05)"
                                    borderColor="rgba(255, 255, 255, 0.1)"
                                />

                                <Input
                                    size="$4"
                                    placeholder="Password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    backgroundColor="rgba(255, 255, 255, 0.05)"
                                    borderColor="rgba(255, 255, 255, 0.1)"
                                />
                            </YStack>

                            <Button
                                size="$4"
                                width="100%"
                                backgroundColor={Colors.dark.tint}
                                onPress={handleSignUp}
                                disabled={loading}
                                opacity={loading ? 0.7 : 1}
                            >
                                <Text color="white" fontSize="$5" fontWeight="bold">
                                    {loading ? 'Creating account...' : 'Sign Up'}
                                </Text>
                            </Button>

                            <XStack marginTop="$6" alignItems="center">
                                <Text color="$icon" fontSize="$3">Already have an account? </Text>
                                <Link href="/auth/login" asChild>
                                    <Text color="$tint" fontWeight="bold" fontSize="$3" pressStyle={{ opacity: 0.7 }}>Sign In</Text>
                                </Link>
                            </XStack>
                        </BlurView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    glassContainer: {
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.dark.glass.border,
    },
    blurContainer: {
        padding: 30,
        alignItems: 'center',
        // backgroundColor: Colors.dark.glass.background,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.dark.icon,
        marginBottom: 40,
        textAlign: 'center',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    input: {
        width: '100%',
        padding: 15,
        color: Colors.dark.text,
        fontSize: 16,
    },
    button: {
        width: '100%',
        backgroundColor: '#1E362D', // Paisley Green
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        marginTop: 30,
    },
    footerText: {
        color: Colors.dark.icon,
        fontSize: 14,
    },
    linkText: {
        color: Colors.dark.tint,
        fontWeight: 'bold',
        fontSize: 14,
    },
});
