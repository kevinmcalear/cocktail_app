import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import React from 'react';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, useTheme } from 'tamagui';

export function OfflineBanner() {
    const netInfo = useNetInfo();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    // Default to connected so it doesn't flash when app starts
    const isOffline = netInfo.isConnected === false;

    if (!isOffline) return null;

    return (
        <Animated.View
            entering={SlideInUp.duration(400)}
            exiting={SlideOutUp.duration(400)}
            // Centred, so it clears the floating back button on the left.
            style={{
                position: 'absolute',
                top: Math.max(insets.top, 8),
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 9999,
                pointerEvents: 'none',
            }}
        >
            <View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                backgroundColor="$backgroundStrong"
                borderColor="$borderColor"
                borderWidth={1}
                flexDirection="row"
                alignItems="center"
                paddingVertical="$2"
                paddingHorizontal="$3.5"
                borderRadius={999}
                gap="$2"
                shadowColor="#000"
                shadowOpacity={0.15}
                shadowRadius={8}
                shadowOffset={{ width: 0, height: 2 }}
            >
                <MaterialCommunityIcons name="wifi-off" size={16} color={theme.warningText?.get() as string} />
                <Text color="$color" fontSize={13} fontWeight="600">
                    Offline · showing saved data
                </Text>
            </View>
        </Animated.View>
    );
}
