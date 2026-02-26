import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/ctx/AuthContext";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Separator, Text, XStack, YStack, useTheme } from "tamagui";

export default function ProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, signOut } = useAuth();
    const theme = useTheme();

    const avatarUrl = user?.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80";

    const handleNavigation = (path: string) => {
        router.push(path as any);
    };

    const handleSignOut = async () => {
        await signOut();
    };

    return (
        <YStack flex={1} paddingTop={insets.top} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false }} />
            
            <YStack flex={1} paddingHorizontal="$4">
                <YStack alignItems="center" marginBottom="$6" marginTop="$4">
                    <Image 
                        source={{ uri: avatarUrl }} 
                        style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 16, borderWidth: 2, borderColor: theme.color11?.get() as string }} 
                    />
                    <Text fontSize={24} fontWeight="bold" color="$color">
                        {user?.user_metadata?.full_name || user?.email || "User"}
                    </Text>
                </YStack>

                <YStack backgroundColor="$backgroundStrong" borderRadius="$4" overflow="hidden" borderWidth={1} borderColor="$borderColor">
                    <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        paddingVertical="$4"
                        paddingHorizontal="$4"
                        pressStyle={{ opacity: 0.7 }}
                        onPress={() => handleNavigation('/settings')}
                    >
                        <XStack alignItems="center" gap="$3">
                            <IconSymbol name="pencil" size={24} color={theme.color?.get() as string} />
                            <Text fontSize="$5" color="$color" fontWeight="500">Edit Profile</Text>
                        </XStack>
                        <IconSymbol name="chevron.right" size={20} color={theme.color11?.get() as string} />
                    </XStack>

                    <Separator borderColor="$borderColor" marginLeft={60} />

                    <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        paddingVertical="$4"
                        paddingHorizontal="$4"
                        pressStyle={{ opacity: 0.7 }}
                        onPress={() => handleNavigation('/add-cocktail')}
                    >
                        <XStack alignItems="center" gap="$3">
                            <IconSymbol name="plus.circle" size={24} color={theme.color?.get() as string} />
                            <Text fontSize="$5" color="$color" fontWeight="500">Create Cocktail</Text>
                        </XStack>
                        <IconSymbol name="chevron.right" size={20} color={theme.color11?.get() as string} />
                    </XStack>

                    <Separator borderColor="$borderColor" marginLeft={60} />

                    <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        paddingVertical="$4"
                        paddingHorizontal="$4"
                        pressStyle={{ opacity: 0.7 }}
                        onPress={() => handleNavigation('/settings')}
                    >
                        <XStack alignItems="center" gap="$3">
                            <IconSymbol name="gear" size={24} color={theme.color?.get() as string} />
                            <Text fontSize="$5" color="$color" fontWeight="500">Settings</Text>
                        </XStack>
                        <IconSymbol name="chevron.right" size={20} color={theme.color11?.get() as string} />
                    </XStack>

                    <Separator borderColor="$borderColor" marginLeft={60} />

                    <XStack
                        alignItems="center"
                        justifyContent="space-between"
                        paddingVertical="$4"
                        paddingHorizontal="$4"
                        pressStyle={{ opacity: 0.7 }}
                        onPress={handleSignOut}
                    >
                        <XStack alignItems="center" gap="$3">
                            <IconSymbol name="rectangle.portrait.and.arrow.right" size={24} color="#FF6B6B" />
                            <Text fontSize="$5" color="#FF6B6B" fontWeight="500">Log Out</Text>
                        </XStack>
                    </XStack>
                </YStack>
            </YStack>
        </YStack>
    );
}
