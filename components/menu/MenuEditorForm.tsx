import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
    Button,
    Card,
    Input,
    Label,
    ScrollView,
    Text,
    XStack,
    YStack,
    useTheme,
} from 'tamagui';

import { Step4Drinks } from '@/app/menus/create/_components/Step4Drinks';
import type { SearchItem } from '@/components/SearchList';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBars } from '@/hooks/useBars';
import { handleCapitalizedChange } from '@/lib/stringUtils';

interface MenuEditorFormProps {
    embedded?: boolean;
    skipVenueStep: boolean;
    barId: string | null;
    onBarIdChange: (id: string) => void;
    templates: any[];
    selectedTemplateId: string | null;
    onTemplateSelect: (id: string) => void;
    menuName: string;
    onMenuNameChange: (val: string) => void;
    onMenuNameBlur: () => void;
    coverUrl: string | null;
    uploadingCover: boolean;
    onPickCover: () => void;
    onClearCover: () => void;
    activeSections: any[];
    selections: Record<string, string[]>;
    setSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
    menuDraftId: string | null;
    onInitSections: () => void;
    canPublish: boolean;
    saving: boolean;
    onPublish: () => void;
    onCreateDrinkPress?: (params: {
        query: string;
        barId: string;
        menuDraftId?: string;
        menuSectionId?: string;
    }) => void;
    onOpenDrink?: (drink: SearchItem) => void;
}

function SectionLabel({ children }: { children: string }) {
    return (
        <Text
            fontSize={14}
            fontWeight="bold"
            color="$color11"
            textTransform="uppercase"
            letterSpacing={0.5}
            marginBottom="$3"
        >
            {children}
        </Text>
    );
}

export function MenuEditorForm({
    embedded = false,
    skipVenueStep,
    barId,
    onBarIdChange,
    templates,
    selectedTemplateId,
    onTemplateSelect,
    menuName,
    onMenuNameChange,
    onMenuNameBlur,
    coverUrl,
    uploadingCover,
    onPickCover,
    onClearCover,
    activeSections,
    selections,
    setSelections,
    menuDraftId,
    onInitSections,
    canPublish,
    saving,
    onPublish,
    onCreateDrinkPress,
    onOpenDrink,
}: MenuEditorFormProps) {
    const theme = useTheme();
    const router = useRouter();
    const { data: userBars, isLoading: loadingBars } = useBars();

    useEffect(() => {
        if (selectedTemplateId) onInitSections();
    }, [selectedTemplateId]);

    const bars = (userBars || []).map((ub: any) => ub.bars).filter(Boolean);
    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

    const totalDrinks = Object.values(selections).reduce((sum, arr) => sum + arr.length, 0);

    return (
        <ScrollView
            flex={1}
            contentContainerStyle={{
                padding: embedded ? 20 : 24,
                paddingBottom: embedded ? 32 : 48,
                gap: 20,
            }}
            showsVerticalScrollIndicator={false}
        >
            {!skipVenueStep && (
                <Card borderWidth={1} borderColor="$borderColor" padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                    <SectionLabel>Venue</SectionLabel>
                    {loadingBars ? (
                        <ActivityIndicator color={theme.color8?.get() as string} />
                    ) : bars.length === 0 ? (
                        <Text color="$color11" fontSize={13}>
                            No venues found. You must be assigned to a venue to create a menu.
                        </Text>
                    ) : (
                        <XStack flexWrap="wrap" gap="$2">
                            {bars.map((bar: any) => {
                                const selected = barId === bar.id;
                                return (
                                    <Button
                                        key={bar.id}
                                        size="$3"
                                        borderRadius="$10"
                                        backgroundColor={selected ? (theme.color8?.get() as string) : '$background'}
                                        borderColor={selected ? (theme.color8?.get() as string) : '$borderColor'}
                                        borderWidth={1}
                                        onPress={() => onBarIdChange(bar.id)}
                                    >
                                        <Text
                                            color={selected ? (theme.backgroundStrong?.get() as string) : '$color'}
                                            fontWeight={selected ? 'bold' : 'normal'}
                                        >
                                            {bar.name}
                                        </Text>
                                    </Button>
                                );
                            })}
                        </XStack>
                    )}
                </Card>
            )}

            <Card borderWidth={1} borderColor="$borderColor" padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                <SectionLabel>Template</SectionLabel>
                <YStack gap="$2">
                    {templates.map((template) => {
                        const selected = selectedTemplateId === template.id;
                        return (
                            <TouchableOpacity
                                key={template.id}
                                activeOpacity={0.7}
                                onPress={() => onTemplateSelect(template.id)}
                            >
                                <XStack
                                    padding="$3"
                                    borderRadius={12}
                                    borderWidth={1.5}
                                    borderColor={selected ? (theme.color8?.get() as string) : '$borderColor'}
                                    backgroundColor={selected ? '$background' : 'transparent'}
                                    alignItems="center"
                                    justifyContent="space-between"
                                    gap="$3"
                                >
                                    <YStack flex={1} gap="$1">
                                        <Text fontWeight="bold" color={selected ? '$color' : '$color11'}>
                                            {template.name}
                                        </Text>
                                        {template.description ? (
                                            <Text fontSize={12} color="$color11" numberOfLines={2}>
                                                {template.description}
                                            </Text>
                                        ) : null}
                                    </YStack>
                                    <XStack alignItems="center" gap="$2">
                                        <TouchableOpacity
                                            onPress={(e) => {
                                                e.stopPropagation?.();
                                                router.push({
                                                    pathname: '/menus/create-template',
                                                    params: { id: template.id },
                                                });
                                            }}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <IconSymbol
                                                name="pencil.circle"
                                                size={22}
                                                color={theme.color11?.get() as string}
                                            />
                                        </TouchableOpacity>
                                        {selected ? (
                                            <IconSymbol
                                                name="checkmark.circle.fill"
                                                size={22}
                                                color={theme.color8?.get() as string}
                                            />
                                        ) : null}
                                    </XStack>
                                </XStack>
                            </TouchableOpacity>
                        );
                    })}
                    <TouchableOpacity
                        onPress={() => router.push('/menus/create-template')}
                        style={[styles.dashedBtn, { borderColor: theme.borderColor?.get() as string }]}
                    >
                        <IconSymbol name="plus.circle" size={20} color={theme.color11?.get() as string} />
                        <Text color="$color11" fontWeight="600">
                            Create New Template
                        </Text>
                    </TouchableOpacity>
                </YStack>
            </Card>

            <Card borderWidth={1} borderColor="$borderColor" padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                <YStack gap="$3">
                    <Label color="$color11">Menu Name *</Label>
                    <Input
                        value={menuName}
                        onChangeText={(val) => handleCapitalizedChange(val, menuName, onMenuNameChange)}
                        onBlur={onMenuNameBlur}
                        placeholder="e.g. Winter 2026"
                        placeholderTextColor="$color11"
                        size="$4"
                        backgroundColor="$background"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                    <YStack gap="$2">
                        <Label color="$color11">Cover Image</Label>
                        <TouchableOpacity onPress={onPickCover} activeOpacity={0.8} disabled={uploadingCover}>
                            <View style={[styles.coverBox, { borderColor: theme.borderColor?.get() as string }]}>
                                {uploadingCover ? (
                                    <ActivityIndicator color={theme.color8?.get() as string} />
                                ) : coverUrl ? (
                                    <Image
                                        source={{ uri: coverUrl }}
                                        style={styles.coverImage}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <YStack alignItems="center" gap="$2">
                                        <IconSymbol name="camera.fill" size={28} color={theme.color11?.get() as string} />
                                        <Text color="$color11" fontSize={12}>
                                            Tap to upload cover
                                        </Text>
                                    </YStack>
                                )}
                            </View>
                        </TouchableOpacity>
                        {coverUrl && !uploadingCover ? (
                            <TouchableOpacity onPress={onClearCover} hitSlop={8}>
                                <Text color="$color8" fontSize={12} fontWeight="600">
                                    Remove cover
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                    </YStack>
                </YStack>
            </Card>

            {selectedTemplateId && activeSections.length > 0 && (
                <Card borderWidth={1} borderColor="$borderColor" padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                    <SectionLabel>Drinks</SectionLabel>
                    <View style={styles.drinksEmbed}>
                        <Step4Drinks
                            embedded
                            sections={activeSections}
                            selections={selections}
                            setSelections={setSelections}
                            barId={barId}
                            menuDraftId={menuDraftId}
                            onCreateDrinkPress={onCreateDrinkPress}
                            onOpenDrink={onOpenDrink}
                        />
                    </View>
                </Card>
            )}

            {selectedTemplateId && menuName.trim() && (
                <Card borderWidth={1} borderColor="$borderColor" padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                    <SectionLabel>Summary</SectionLabel>
                    <YStack gap="$3">
                        <XStack justifyContent="space-between">
                            <Text color="$color11" fontSize={13}>
                                Template
                            </Text>
                            <Text fontWeight="600" color="$color">
                                {selectedTemplate?.name}
                            </Text>
                        </XStack>
                        <XStack justifyContent="space-between">
                            <Text color="$color11" fontSize={13}>
                                Sections
                            </Text>
                            <Text fontWeight="600" color="$color">
                                {activeSections.length}
                            </Text>
                        </XStack>
                        <XStack justifyContent="space-between">
                            <Text color="$color11" fontSize={13}>
                                Total drinks
                            </Text>
                            <Text fontWeight="600" color="$color">
                                {totalDrinks}
                            </Text>
                        </XStack>
                    </YStack>
                </Card>
            )}

            <Button
                size="$5"
                borderRadius="$10"
                backgroundColor={theme.color8?.get() as string}
                opacity={canPublish && !saving ? 1 : 0.4}
                disabled={!canPublish || saving}
                onPress={onPublish}
                marginTop="$2"
            >
                {saving ? (
                    <ActivityIndicator size="small" color={theme.backgroundStrong?.get() as string} />
                ) : (
                    <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold" fontSize={16}>
                        Publish Menu
                    </Text>
                )}
            </Button>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    dashedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginTop: 4,
    },
    drinksEmbed: {
        marginHorizontal: -4,
    },
    coverBox: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
});
