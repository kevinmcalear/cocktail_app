import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack, useTheme, Button } from 'tamagui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { useDrafts } from '@/hooks/useDrafts';
import { formatDistanceToNow } from 'date-fns'; // Using standard date formatting if available, otherwise fallback to simple date string. Wait, maybe date-fns is not installed? Let me check package.json. Let's just use JS Date for safety.

export default function EditModeDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const { drafts, isLoading, deleteDraft } = useDrafts();

    const options = [
        { label: 'Cocktail', icon: 'TabDrinks', route: '/add-cocktail' },
        { label: 'Ingredient', icon: 'TabIngredients', route: '/add-ingredient' },
        { label: 'Beer', icon: 'Beer', route: '/add-beer' }, 
        { label: 'Wine', icon: 'Wine', route: '/add-wine' }, 
        { label: 'Menu', icon: 'TabMenus', route: '/menus/create' },
    ];

    const handleDeleteDraft = (id: string) => {
        Alert.alert(
            "Delete Draft",
            "Are you sure you want to discard this draft?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteDraft(id) }
            ]
        );
    };

    const handleResumeDraft = (draft: any) => {
        let route = '';
        switch(draft.entity_type) {
            case 'cocktail': route = '/add-cocktail'; break;
            case 'ingredient': route = '/add-ingredient'; break;
            case 'beer': route = '/add-beer'; break;
            case 'wine': route = '/add-wine'; break;
            case 'menu': route = '/menus/create'; break;
        }
        if (route) {
            router.push(`${route}?draftId=${draft.id}` as any);
        }
    };

    const getIconForType = (type: string) => {
        switch(type) {
            case 'cocktail': return 'TabDrinks';
            case 'ingredient': return 'TabIngredients';
            case 'beer': return 'Beer';
            case 'wine': return 'Wine';
            case 'menu': return 'TabMenus';
            default: return 'TabDrinks';
        }
    };

    return (
        <YStack flex={1} backgroundColor="$background">
            <Stack.Screen options={{ headerShown: false }} />
            
            <XStack
                paddingTop={insets.top + 20}
                paddingHorizontal="$4"
                paddingBottom="$4"
                alignItems="center"
                zIndex={10}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={theme.color?.get() as string} />
                </TouchableOpacity>
                <Text fontSize="$5" fontWeight="bold" marginLeft="$2">Creator Hub</Text>
            </XStack>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
                {/* Works in Progress Section */}
                <YStack gap="$3" marginBottom="$6">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600">
                        Works in Progress
                    </Text>
                    {isLoading ? (
                        <Text color="$color11">Loading drafts...</Text>
                    ) : drafts.length === 0 ? (
                        <Text color="$color11">No active drafts.</Text>
                    ) : (
                        drafts.map((draft: any) => {
                            const date = new Date(draft.updated_at);
                            const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                                <XStack
                                    key={draft.id}
                                    backgroundColor="$backgroundStrong"
                                    borderRadius="$4"
                                    borderWidth={1}
                                    borderColor="$borderColor"
                                    padding="$3"
                                    alignItems="center"
                                    justifyContent="space-between"
                                >
                                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleResumeDraft(draft)}>
                                        <View style={styles.iconContainer}>
                                            <CustomIcon name={getIconForType(draft.entity_type)} size={24} color={theme.color?.get() as string} />
                                        </View>
                                        <YStack marginLeft="$3" flex={1}>
                                            <Text fontSize={16} fontWeight="bold" color="$color" numberOfLines={1}>
                                                {draft.draft_data?.name || `Untitled ${draft.entity_type}`}
                                            </Text>
                                            <Text fontSize={12} color="$color11">Last edited: {dateString}</Text>
                                        </YStack>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteDraft(draft.id)} style={{ padding: 8 }}>
                                        <IconSymbol name="trash" size={20} color="#ff4444" />
                                    </TouchableOpacity>
                                </XStack>
                            );
                        })
                    )}
                </YStack>

                {/* Create New Section */}
                <YStack gap="$3">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600">
                        Create New
                    </Text>
                    <XStack flexWrap="wrap" gap="$3" justifyContent="space-between">
                        {options.map((option, index) => (
                            <Button
                                key={index}
                                width="48%"
                                height={100}
                                backgroundColor="$backgroundStrong"
                                pressStyle={{ opacity: 0.8 }}
                                justifyContent="center"
                                alignItems="center"
                                flexDirection="column"
                                gap="$2"
                                borderWidth={1}
                                borderColor="$borderColor"
                                borderRadius="$4"
                                onPress={() => router.push(option.route as any)}
                            >
                                <CustomIcon name={option.icon} size={32} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={14} fontWeight="500">{option.label}</Text>
                            </Button>
                        ))}
                    </XStack>
                </YStack>

            </ScrollView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    content: {
        padding: 20,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
