import { useBars } from "@/hooks/useBars";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { XStack, YStack, Text, Button, useTheme, Card, ScrollView } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TouchableOpacity } from "react-native";

export default function BarManagementScreen() {
    const { data: userBars, isLoading } = useBars();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    return (
        <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
            <Stack.Screen options={{ headerShown: false }} />
            
            <XStack
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                justifyContent="space-between"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: 'center' }}>
                    <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold">Bar Management</Text>
                <View style={{ width: 40 }} />
            </XStack>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                {isLoading ? (
                    <Text textAlign="center" color="$color11" marginTop="$4">Loading...</Text>
                ) : userBars?.length === 0 ? (
                    <YStack alignItems="center" marginTop="$8" gap="$4">
                        <IconSymbol name="building.2" size={48} color={theme.color11?.get() as string} />
                        <Text color="$color11" textAlign="center">You aren't a member of any bars yet.</Text>
                    </YStack>
                ) : (
                    <YStack gap="$4">
                        {userBars?.map((ub) => (
                            <TouchableOpacity key={ub.bar_id} onPress={() => router.push(`/settings/bar/${ub.bar_id}`)}>
                                <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                                    <XStack justifyContent="space-between" alignItems="center">
                                        <YStack>
                                            <Text fontWeight="bold" fontSize={18} color="$color">{ub.bars?.name}</Text>
                                            <Text color="$color11" fontSize={14} marginTop="$1">Your Role Level: {ub.role_level}</Text>
                                        </YStack>
                                        <IconSymbol name="chevron.right" size={20} color={theme.color11?.get() as string} />
                                    </XStack>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </YStack>
                )}

                <Button 
                    marginTop="$6" 
                    backgroundColor="$color8" 
                    color="$backgroundStrong" 
                    fontWeight="bold"
                    icon={<IconSymbol name="plus" size={16} color={theme.backgroundStrong?.get() as string} />}
                    onPress={() => router.push('/settings/create-bar')}
                >
                    Create New Bar
                </Button>
            </ScrollView>
        </YStack>
    );
}
import { View } from "react-native";
