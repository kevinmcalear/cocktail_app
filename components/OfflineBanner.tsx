import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { MotiView } from 'moti';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View } from 'tamagui';

export function OfflineBanner() {
    const netInfo = useNetInfo();
    const insets = useSafeAreaInsets();
    
    // Default to connected so it doesn't flash when app starts
    const isOffline = netInfo.isConnected === false;

    if (!isOffline) return null;

    return (
        <MotiView
            from={{ translateY: -100, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: -100, opacity: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={{
                position: 'absolute',
                top: insets.top - 8, // Shifted slightly above flush with the inset
                left: 16, // Move to the left with some padding
                zIndex: 9999,
                pointerEvents: 'none', // Ensure it doesn't block touches below if it's just an indicator
            }}
        >
            <View
                backgroundColor="rgba(220, 38, 38, 0.85)" // Softer, somewhat transparent red
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                paddingVertical="$2"
                paddingHorizontal="$4"
                borderRadius={999} // Squircle / Pill shape
                gap="$1.5"
            >
                <MaterialCommunityIcons name="wifi-off" size={18} color="white" />
                <Text color="white" fontSize="$3" fontWeight="bold">
                    Offline Mode
                </Text>
            </View>
        </MotiView>
    );
}
