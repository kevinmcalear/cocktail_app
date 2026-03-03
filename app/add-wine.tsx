import { IconSymbol } from "@/components/ui/icon-symbol";
import { Stack, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Text, YStack, useTheme } from "tamagui";

export default function AddWineScreen() {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const handleClose = () => {
        router.back();
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.background?.get() as string }}>
            <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
            
            <View style={{ paddingTop: insets.top, paddingHorizontal: 16 }}>
                <View style={{ height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text fontSize={20} fontWeight="600" color="$color">Add Wine</Text>
                    <Button
                        size="$3"
                        circular
                        backgroundColor="transparent"
                        pressStyle={{ opacity: 0.5 }}
                        onPress={handleClose}
                        icon={<IconSymbol name="xmark.circle.fill" size={28} color={theme.color11?.get() as string} />}
                    />
                </View>
            </View>

            <YStack flex={1} padding={24} justifyContent="center" alignItems="center" gap="$4">
                <IconSymbol name="wineglass.fill" size={80} color={theme.color11?.get() as string} />
                <Text fontSize={24} fontWeight="bold" color="$color">Coming Soon</Text>
                <Text fontSize={16} color="$color11" textAlign="center">
                    The Wine creation interface is currently under development.
                </Text>
            </YStack>
        </View>
    );
}
