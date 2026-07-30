import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
    Button,
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
import { CocktailPhotoPlaceholder } from '@/components/cocktail/CocktailPhotoPlaceholder';
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
            fontSize={12}
            fontWeight="bold"
            color="$color11"
            textTransform="uppercase"
            letterSpacing={0.5}
            marginBottom="$2"
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

    return (
        <ScrollView
            flex={1}
            contentContainerStyle={{
                padding: embedded ? 20 : 24,
                paddingBottom: embedded ? 32 : 48,
                gap: 24,
            }}
            showsVerticalScrollIndicator={false}
        >
            <XStack gap="$4" alignItems="flex-start">
                <YStack width={140} gap="$2">
                    <View style={styles.coverFrame}>
                        {uploadingCover ? (
                            <View style={styles.coverCenter}>
                                <ActivityIndicator color={theme.color8?.get() as string} />
                            </View>
                        ) : coverUrl ? (
                            <TouchableOpacity
                                onPress={onPickCover}
                                activeOpacity={0.85}
                                style={StyleSheet.absoluteFill}
                            >
                                <Image
                                    source={{ uri: coverUrl }}
                                    style={styles.coverImage}
                                    contentFit="cover"
                                />
                            </TouchableOpacity>
                        ) : (
                            <CocktailPhotoPlaceholder onPress={onPickCover} />
                        )}
                    </View>
                    {coverUrl && !uploadingCover ? (
                        <TouchableOpacity onPress={onClearCover} hitSlop={8}>
                            <Text color="$color8" fontSize={12} fontWeight="600">
                                Remove photo
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </YStack>

                <YStack flex={1} gap="$3" minWidth={0} paddingTop="$1">
                    <YStack gap="$2">
                        <Label color="$color11">Name</Label>
                        <Input
                            value={menuName}
                            onChangeText={(val) => handleCapitalizedChange(val, menuName, onMenuNameChange)}
                            onBlur={onMenuNameBlur}
                            placeholder="e.g. Winter 2026"
                            placeholderTextColor="$color11"
                            size="$4"
                            backgroundColor="$backgroundStrong"
                            borderColor="$borderColor"
                            focusStyle={{ borderColor: '$color8' }}
                        />
                    </YStack>

                    {!skipVenueStep ? (
                        <YStack gap="$2">
                            <Label color="$color11">Venue</Label>
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
                                                backgroundColor={
                                                    selected
                                                        ? (theme.color8?.get() as string)
                                                        : '$backgroundStrong'
                                                }
                                                borderColor={
                                                    selected
                                                        ? (theme.color8?.get() as string)
                                                        : '$borderColor'
                                                }
                                                borderWidth={1}
                                                onPress={() => onBarIdChange(bar.id)}
                                            >
                                                <Text
                                                    color={
                                                        selected
                                                            ? (theme.backgroundStrong?.get() as string)
                                                            : '$color'
                                                    }
                                                    fontWeight={selected ? 'bold' : 'normal'}
                                                >
                                                    {bar.name}
                                                </Text>
                                            </Button>
                                        );
                                    })}
                                </XStack>
                            )}
                        </YStack>
                    ) : null}
                </YStack>
            </XStack>

            <YStack gap="$2">
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
                                    backgroundColor="$backgroundStrong"
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
                                    {selected ? (
                                        <IconSymbol
                                            name="checkmark.circle.fill"
                                            size={22}
                                            color={theme.color8?.get() as string}
                                        />
                                    ) : null}
                                </XStack>
                            </TouchableOpacity>
                        );
                    })}
                    <TouchableOpacity onPress={() => router.push('/menus/create-template')} hitSlop={8}>
                        <Text color="$color8" fontSize={13} fontWeight="600" paddingVertical="$2">
                            Manage templates
                        </Text>
                    </TouchableOpacity>
                </YStack>
            </YStack>

            {selectedTemplateId && activeSections.length > 0 ? (
                <YStack gap="$2">
                    <SectionLabel>Drinks</SectionLabel>
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
                </YStack>
            ) : null}

            <Button
                size="$5"
                borderRadius="$10"
                backgroundColor={theme.color8?.get() as string}
                opacity={canPublish && !saving ? 1 : 0.4}
                disabled={!canPublish || saving}
                onPress={onPublish}
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
    coverFrame: {
        width: 140,
        aspectRatio: 1,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    coverCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(127,127,127,0.08)',
        borderRadius: 24,
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
});
