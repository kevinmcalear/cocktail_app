import { CurrentMenuList, MenuItem, MenuSection } from '@/components/CurrentMenuList';
import { NotionCover } from '@/components/menu/NotionCover';
import { TemplatePicker } from '@/components/menu/TemplatePicker';
import { capitalize, handleCapitalizedChange } from '@/lib/stringUtils';
import { useMemo } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    TextInput,
    useWindowDimensions,
} from 'react-native';
import { Text, XStack, YStack, useTheme } from 'tamagui';

type Template = { id: string; name: string; description?: string | null };

interface MenuNotionEditorProps {
    menuName: string;
    onMenuNameChange: (v: string) => void;
    coverUrl: string | null;
    coverPosition: number;
    onCoverPositionChange: (pos: number) => void;
    onPickCover: () => void;
    uploadingCover?: boolean;
    templates: Template[];
    selectedTemplateId: string | null;
    onTemplateSelect: (id: string) => void;
    sections: MenuSection[];
    venueName?: string | null;
    headerRight?: React.ReactNode;
    onRemoveItem: (sectionId: string, itemId: string) => void;
    onAddToSection: (sectionId: string) => void;
    onItemPress?: (item: MenuItem) => void;
    /** Extra top inset when not under app chrome (standalone create route) */
    topInset?: number;
}

/** Always-editing Notion-style menu page (create + edit). */
export function MenuNotionEditor({
    menuName,
    onMenuNameChange,
    coverUrl,
    coverPosition,
    onCoverPositionChange,
    onPickCover,
    uploadingCover,
    templates,
    selectedTemplateId,
    onTemplateSelect,
    sections,
    venueName,
    headerRight,
    onRemoveItem,
    onAddToSection,
    onItemPress,
    topInset = 0,
}: MenuNotionEditorProps) {
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 768;
    const padH = 15;
    const coverMax = isWide ? 280 : 220;

    const header = useMemo(
        () => (
            <YStack>
                {coverUrl ? (
                    <NotionCover
                        uri={coverUrl}
                        position={coverPosition}
                        maxHeight={coverMax}
                        editing
                        onPositionChange={onCoverPositionChange}
                        onChangeCover={onPickCover}
                    />
                ) : (
                    <Pressable
                        onPress={onPickCover}
                        style={[styles.addCover, { maxHeight: coverMax }]}
                    >
                        {uploadingCover ? (
                            <ActivityIndicator color={theme.color8?.get() as string} />
                        ) : (
                            <Text color="$color11" fontWeight="600">
                                Add cover
                            </Text>
                        )}
                    </Pressable>
                )}

                <XStack
                    paddingHorizontal={padH}
                    paddingTop={24}
                    paddingBottom={4}
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap="$3"
                >
                    <YStack flex={1} gap="$1" minWidth={0}>
                        <TextInput
                            value={menuName}
                            onChangeText={(val) =>
                                handleCapitalizedChange(val, menuName, onMenuNameChange)
                            }
                            onBlur={() => onMenuNameChange(capitalize(menuName))}
                            placeholder="Untitled menu"
                            placeholderTextColor={theme.color11?.get() as string}
                            style={{
                                fontSize: isWide ? 40 : 28,
                                lineHeight: isWide ? 46 : 34,
                                fontFamily: 'IBMPlexSansItalic',
                                fontStyle: 'italic',
                                color: theme.color?.get() as string,
                                padding: 0,
                            }}
                        />
                        {venueName ? (
                            <Text fontSize={14} color="$color11" numberOfLines={1}>
                                {venueName}
                            </Text>
                        ) : null}
                    </YStack>

                    <XStack alignItems="center" gap="$2" flexShrink={0}>
                        <TemplatePicker
                            templates={templates}
                            selectedId={selectedTemplateId}
                            onSelect={onTemplateSelect}
                        />
                        {headerRight}
                    </XStack>
                </XStack>

                {!selectedTemplateId ? (
                    <YStack paddingHorizontal={padH} paddingTop={32} paddingBottom={16}>
                        <Text color="$color11" fontSize={15}>
                            Pick a template to start adding drinks.
                        </Text>
                    </YStack>
                ) : null}
            </YStack>
        ),
        [
            coverUrl,
            coverPosition,
            coverMax,
            onCoverPositionChange,
            onPickCover,
            uploadingCover,
            theme,
            menuName,
            onMenuNameChange,
            isWide,
            venueName,
            templates,
            selectedTemplateId,
            onTemplateSelect,
            headerRight,
        ]
    );

    return (
        <YStack flex={1} backgroundColor="$background" paddingTop={topInset}>
            <CurrentMenuList
                sections={sections}
                ListHeaderComponent={header}
                isEditing
                onRemoveItem={onRemoveItem}
                onAddToSection={onAddToSection}
                onItemPress={onItemPress}
            />
        </YStack>
    );
}

const styles = StyleSheet.create({
    addCover: {
        width: '100%',
        aspectRatio: 5 / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(127,127,127,0.3)',
        backgroundColor: 'rgba(127,127,127,0.08)',
    },
});
