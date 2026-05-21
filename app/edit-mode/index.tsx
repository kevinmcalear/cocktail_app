import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack, useTheme, Button } from 'tamagui';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CustomIcon } from '@/components/ui/CustomIcons';
import { useDrafts } from '@/hooks/useDrafts';
import { useBars } from '@/hooks/useBars';
import { useAuth } from '@/ctx/AuthContext';
import { useDropdowns } from '@/hooks/useDropdowns';
import { calculateDraftProgress } from '@/lib/draftProgress';
import { capitalize } from '@/lib/stringUtils';

export default function EditModeDashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const theme = useTheme();
    const { user } = useAuth();
    const { drafts, isLoading, deleteDraft } = useDrafts();
    const { data: userBars } = useBars();
    const { data: dropdowns } = useDropdowns();

    const getBarName = (barId: string) => {
        if (barId === 'personal') return 'Personal Drafts';
        const bar = userBars?.find((b: any) => b.bar_id === barId);
        return bar?.bars?.name || 'Unknown Bar';
    };

    const draftsByBar = drafts.reduce((acc: any, draft: any) => {
        const barId = draft.bar_id || 'personal';
        if (!acc[barId]) acc[barId] = [];
        acc[barId].push(draft);
        return acc;
    }, {});
    const options = [
        { label: 'Cocktail', icon: 'TabDrinks', route: '/add-cocktail' },
        { label: 'Ingredient', icon: 'TabIngredients', route: '/add-ingredient' },
        { label: 'Beer', icon: 'Beer', route: '/add-beer' }, 
        { label: 'Wine', icon: 'Wine', route: '/add-wine' }, 
        { label: 'Menu', icon: 'TabMenus', route: '/menus/create' },
    ];

    const handleDeleteDraft = (id: string) => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm("Are you sure you want to discard this draft?");
            if (confirmed) {
                deleteDraft(id);
            }
        } else {
            Alert.alert(
                "Delete Draft",
                "Are you sure you want to discard this draft?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteDraft(id) }
                ]
            );
        }
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
                <YStack gap="$4" marginBottom="$6">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600">
                        Works in Progress
                    </Text>
                    {isLoading ? (
                        <Text color="$color11">Loading drafts...</Text>
                    ) : drafts.length === 0 ? (
                        <Text color="$color11">No active drafts.</Text>
                    ) : (
                        Object.keys(draftsByBar).map((barId) => (
                            <YStack key={barId} gap="$3" width="100%">
                                <Text fontSize={12} color="$color11" fontWeight="bold">
                                    {getBarName(barId)}
                                </Text>
                                <XStack flexWrap="wrap" gap="$3" width="100%">
                                    {draftsByBar[barId].map((draft: any) => {
                                        const date = new Date(draft.updated_at);
                                        const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const authorName = draft.user_id === user?.id 
                                            ? "You" 
                                            : (draft.draft_data?.last_editor_email || "Another Member");
                                        
                                        const progressInfo = calculateDraftProgress(draft, drafts, dropdowns);

                                        return (
                                            <YStack
                                                key={draft.id}
                                                backgroundColor="$backgroundStrong"
                                                borderRadius="$4"
                                                borderWidth={1.5}
                                                borderColor={progressInfo.color}
                                                padding="$3"
                                                gap="$3"
                                                width="100%"
                                                $gtSm={{ width: '48.5%' }}
                                                $gtMd={{ width: '32%' }}
                                                $gtLg={{ width: '23.8%' }}
                                            >
                                                <XStack alignItems="center" justifyContent="space-between" width="100%">
                                                    <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => handleResumeDraft(draft)}>
                                                        <View style={styles.iconContainer}>
                                                            <CustomIcon name={getIconForType(draft.entity_type)} size={24} color={theme.color?.get() as string} />
                                                        </View>
                                                        <YStack marginLeft="$3" flex={1} gap="$1">
                                                            <XStack alignItems="center" gap="$2" flexWrap="wrap">
                                                                <Text fontSize={16} fontWeight="bold" color="$color" numberOfLines={1} style={{ flexShrink: 1 }}>
                                                                    {draft.draft_data?.name || draft.draft_data?.menuName || `Untitled ${draft.entity_type}`}
                                                                </Text>
                                                                <View style={[styles.statusBadge, { backgroundColor: progressInfo.badgeBg, borderColor: progressInfo.color, borderWidth: 1 }]}>
                                                                    <Text style={[styles.statusBadgeText, { color: progressInfo.badgeText }]}>
                                                                        {progressInfo.label}
                                                                    </Text>
                                                                </View>
                                                            </XStack>
                                                        </YStack>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => handleDeleteDraft(draft.id)} style={{ padding: 8 }}>
                                                        <IconSymbol name="trash" size={20} color="#ff4444" />
                                                    </TouchableOpacity>
                                                </XStack>

                                                {/* Visual Progress Bar */}
                                                <YStack width="100%" gap="$1">
                                                    <View style={styles.progressBarTrack}>
                                                        <View style={[styles.progressBarFill, { width: `${progressInfo.percentage}%`, backgroundColor: progressInfo.color }]} />
                                                    </View>
                                                    <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
                                                        <Text fontSize={10} color="$color11" fontWeight="600">
                                                            {progressInfo.percentage}% complete
                                                        </Text>
                                                        <Text fontSize={10} color="$color11" style={{ flexShrink: 1, textAlign: 'right', marginLeft: 8 }} numberOfLines={1}>
                                                            Edited by {authorName} • {dateString}
                                                        </Text>
                                                    </XStack>
                                                </YStack>

                                                {/* Child Draft Sub-dependencies */}
                                                {progressInfo.innerDrafts && progressInfo.innerDrafts.length > 0 && (
                                                    <YStack gap="$2" borderTopWidth={1} borderTopColor="rgba(255, 255, 255, 0.08)" paddingTop="$2.5">
                                                        <Text fontSize={9} color="$color11" fontWeight="bold" letterSpacing={0.5} textTransform="uppercase">
                                                            Contains Draft Dependencies:
                                                        </Text>
                                                        <YStack gap="$1.5">
                                                            {progressInfo.innerDrafts.map((childDraft: any) => {
                                                                const childProgress = calculateDraftProgress(childDraft, drafts, dropdowns);
                                                                return (
                                                                    <TouchableOpacity
                                                                        key={childDraft.id}
                                                                        onPress={() => handleResumeDraft(childDraft)}
                                                                        style={{
                                                                            flexDirection: 'row',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                                                            paddingVertical: 6,
                                                                            paddingHorizontal: 8,
                                                                            borderRadius: 6,
                                                                        }}
                                                                        activeOpacity={0.7}
                                                                    >
                                                                        <XStack alignItems="center" gap="$2" flex={1}>
                                                                            <CustomIcon
                                                                                name={getIconForType(childDraft.entity_type)}
                                                                                size={14}
                                                                                color={theme.color11?.get() as string}
                                                                            />
                                                                            <Text fontSize={12} color="$color" fontWeight="500" numberOfLines={1} style={{ flex: 1 }}>
                                                                                {capitalize(childDraft.draft_data?.name || `Untitled ${childDraft.entity_type}`)}
                                                                            </Text>
                                                                        </XStack>
                                                                        <View
                                                                            style={{
                                                                                backgroundColor: childProgress.badgeBg,
                                                                                borderColor: childProgress.color,
                                                                                borderWidth: 1,
                                                                                borderRadius: 4,
                                                                                paddingHorizontal: 4,
                                                                                paddingVertical: 1,
                                                                                marginLeft: 6,
                                                                            }}
                                                                        >
                                                                            <Text
                                                                                style={{
                                                                                    color: childProgress.badgeText,
                                                                                    fontSize: 8,
                                                                                    fontWeight: 'bold',
                                                                                }}
                                                                            >
                                                                                {childProgress.percentage}%
                                                                            </Text>
                                                                        </View>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </YStack>
                                                    </YStack>
                                                )}
                                            </YStack>
                                        );
                                    })}
                                </XStack>
                            </YStack>
                        ))
                    )}
                </YStack>

                {/* Create New Section */}
                <YStack gap="$3">
                    <Text fontSize={14} color="$color11" textTransform="uppercase" letterSpacing={1} fontWeight="600">
                        Create New
                    </Text>
                    <XStack flexWrap="wrap" gap="$3" justifyContent="flex-start">
                        {options.map((option, index) => (
                            <Button
                                key={index}
                                width="48%"
                                $gtSm={{ width: '31.5%' }}
                                $gtMd={{ width: '23.5%' }}
                                $gtLg={{ width: '18.8%' }}
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
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    progressBarTrack: {
        height: 4,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    }
});
