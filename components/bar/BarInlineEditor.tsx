import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Button, Card, Input, Label, ScrollView, Text, XStack, YStack, useTheme } from 'tamagui';

import { GlassView } from '@/components/ui/GlassView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBarEditor } from '@/hooks/useBarEditor';
import type { EditorChromeState } from '@/lib/editorChrome';

interface BarInlineEditorProps {
    barId: string;
    onClose?: () => void;
    onChromeState?: (state: EditorChromeState | null) => void;
    /** Skip own ScrollView when nested in a parent scroller (e.g. Settings). */
    embedded?: boolean;
}

function getRoleName(level: number) {
    if (level >= 40) return 'Admin / Owner';
    if (level >= 35) return 'Drink Creator';
    if (level >= 30) return 'Manager';
    if (level >= 20) return 'Bartender';
    return 'Viewer';
}

function ColorSwatchPicker({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    const display = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#888888';

    if (Platform.OS === 'web' && !disabled) {
        return (
            <View style={styles.colorSwatchWrap}>
                <View style={[styles.colorSwatch, { backgroundColor: display }]} />
                <input
                    type="color"
                    value={display}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label="Pick color"
                    style={styles.colorSwatchInput}
                />
            </View>
        );
    }

    return (
        <View
            style={[
                styles.colorSwatch,
                { backgroundColor: display, opacity: disabled ? 0.5 : 1 },
            ]}
        />
    );
}

function ColorField({
    label,
    value,
    onChange,
    disabled,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    return (
        <YStack gap="$2">
            <Label color="$color11" marginLeft="$2">{label}</Label>
            <XStack alignItems="center" gap="$3">
                <ColorSwatchPicker value={value} onChange={onChange} disabled={disabled} />
                <Input
                    flex={1}
                    value={value}
                    onChangeText={onChange}
                    placeholder="#RRGGBB"
                    autoCapitalize="none"
                    readOnly={disabled}
                    backgroundColor="$background"
                    borderColor="$borderColor"
                    focusStyle={{ borderColor: '$color8' }}
                />
            </XStack>
        </YStack>
    );
}

export function BarInlineEditor({ barId, onClose, onChromeState, embedded = false }: BarInlineEditorProps) {
    const theme = useTheme();
    const editor = useBarEditor(barId);
    const saveRef = useRef(editor.handleSave);
    const discardRef = useRef(editor.discardChanges);
    const onCloseRef = useRef(onClose);

    saveRef.current = editor.handleSave;
    discardRef.current = editor.discardChanges;
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!onChromeState || editor.loading) return;
        onChromeState({
            save: async () => {
                await saveRef.current();
            },
            cancel: () => {
                discardRef.current();
                onCloseRef.current?.();
            },
            saving: editor.saving,
            isDirty: editor.isDirty,
        });
        return () => onChromeState(null);
    }, [onChromeState, editor.loading, editor.saving, editor.isDirty]);

    if (editor.loading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center">
                <ActivityIndicator size="large" color={theme.color?.get() as string} />
            </YStack>
        );
    }

    const logoPreview = editor.localLogoUri || editor.logoUrl;

    const renderPills = (label: string, value: string, setValue: (v: string) => void) => (
        <YStack gap="$2" marginBottom="$4">
            <Label color="$color11" marginLeft="$2">{label}</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
                <XStack gap="$2">
                    {editor.roleOptions.map((opt) => (
                        <Button
                            key={opt.value}
                            size="$3"
                            borderRadius="$10"
                            disabled={!editor.canEdit}
                            backgroundColor={value === opt.value ? theme.color8?.get() as string : '$background'}
                            borderColor={value === opt.value ? theme.color8?.get() as string : '$borderColor'}
                            borderWidth={1}
                            onPress={() => setValue(opt.value)}
                        >
                            <Text
                                color={value === opt.value ? theme.backgroundStrong?.get() as string : theme.color?.get() as string}
                                fontWeight={value === opt.value ? 'bold' : 'normal'}
                            >
                                {opt.name}
                            </Text>
                        </Button>
                    ))}
                </XStack>
            </ScrollView>
        </YStack>
    );

    const body = (
        <YStack gap="$4">
            <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                <YStack gap="$4" alignItems="center">
                    <TouchableOpacity
                        onPress={editor.pickLogo}
                        disabled={!editor.canEdit}
                        activeOpacity={editor.canEdit ? 0.8 : 1}
                    >
                        <View style={[styles.logoBox, { borderColor: theme.borderColor?.get() as string }]}>
                            {logoPreview ? (
                                <Image
                                    source={{ uri: logoPreview }}
                                    cacheKey={logoPreview ?? 'no-logo'}
                                    style={styles.logoImage}
                                    contentFit="cover"
                                />
                            ) : (
                                <YStack alignItems="center" gap="$2">
                                    <IconSymbol name="building.2.fill" size={32} color={theme.color11?.get() as string} />
                                    <Text color="$color11" fontSize={12}>No logo</Text>
                                </YStack>
                            )}
                        </View>
                    </TouchableOpacity>
                    {editor.canEdit && (
                        <Text color="$color8" fontSize={12} fontWeight="600">
                            {editor.extractingColors ? 'Analyzing logo colors…' : 'Tap to upload logo'}
                        </Text>
                    )}
                </YStack>
            </Card>

            <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                <YStack gap="$3">
                    <Label color="$color11">Venue Name</Label>
                    <Input
                        value={editor.name}
                        onChangeText={editor.setName}
                        readOnly={!editor.canEdit}
                        backgroundColor="$background"
                        borderColor="$borderColor"
                        focusStyle={{ borderColor: '$color8' }}
                    />
                </YStack>
            </Card>

            <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                <YStack gap="$4">
                    <Text fontSize={14} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
                        Brand Colors
                    </Text>
                    <ColorField
                        label="Primary"
                        value={editor.primaryColor}
                        onChange={editor.setPrimaryColor}
                        disabled={!editor.canEdit}
                    />
                    <ColorField
                        label="Secondary"
                        value={editor.secondaryColor}
                        onChange={editor.setSecondaryColor}
                        disabled={!editor.canEdit}
                    />
                    {(editor.primaryColor || editor.secondaryColor) && (
                        <XStack gap="$2" marginTop="$1">
                            {editor.primaryColor ? (
                                <View style={[styles.colorPreviewBar, { backgroundColor: editor.primaryColor, flex: 1 }]} />
                            ) : null}
                            {editor.secondaryColor ? (
                                <View style={[styles.colorPreviewBar, { backgroundColor: editor.secondaryColor, flex: 1 }]} />
                            ) : null}
                        </XStack>
                    )}
                </YStack>
            </Card>

            <GlassView style={styles.card} intensity={10}>
                <XStack alignItems="center" gap="$3">
                    <IconSymbol name="person.circle.fill" size={24} color={theme.color8?.get() as string} />
                    <YStack>
                        <Text fontSize={11} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
                            Your Access Level
                        </Text>
                        <Text fontSize={15} fontWeight="bold" color="$color">
                            {getRoleName(editor.roleLevel)}
                        </Text>
                        {!editor.canEdit && (
                            <Text fontSize={12} color="$color11" marginTop="$1">
                                Drink Creator role or above required to edit venue settings.
                            </Text>
                        )}
                    </YStack>
                </XStack>
            </GlassView>

            <Card bordered padding="$4" backgroundColor="$backgroundStrong" borderRadius="$4">
                <YStack gap="$0" paddingTop="$2">
                    <Text fontSize={14} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5} marginBottom="$3">
                        Progressive Disclosure Defaults
                    </Text>
                    {renderPills('General Visibility', editor.visibilityLevel, editor.setVisibilityLevel)}
                    {renderPills('Generic Ingredients', editor.genericLevel, editor.setGenericLevel)}
                    {renderPills('Specific Brands', editor.specificLevel, editor.setSpecificLevel)}
                    {renderPills('Measurements', editor.measurementLevel, editor.setMeasurementLevel)}
                    {renderPills('Prep Instructions', editor.prepLevel, editor.setPrepLevel)}
                </YStack>
            </Card>

            <YStack gap="$3">
                <Text fontSize={14} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
                    Members ({editor.members.length})
                </Text>
                {editor.members.length > 0 ? (
                    editor.members.map((member: any) => (
                        <Card key={member.user_id} padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
                            <XStack justifyContent="space-between" alignItems="center">
                                <Text fontSize={14} fontWeight="600" color="$color">{member.email}</Text>
                                <Text fontSize={12} color="$color11">{getRoleName(member.role_level)}</Text>
                            </XStack>
                        </Card>
                    ))
                ) : (
                    <Text color="$color11" fontStyle="italic" fontSize={13}>No members found.</Text>
                )}
            </YStack>

            <YStack gap="$3">
                <Text fontSize={14} fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
                    Assigned Items ({editor.items.length})
                </Text>
                {editor.items.length > 0 ? (
                    editor.items.map((item: any) => (
                        <Card key={item.id} padding="$3" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" borderRadius={12}>
                            <Text fontWeight="600" color="$color">{item.name}</Text>
                            <Text color="$color11" fontSize={12} textTransform="capitalize">{item.item_type}</Text>
                        </Card>
                    ))
                ) : (
                    <Text color="$color11" fontStyle="italic" fontSize={13}>No items assigned to this venue yet.</Text>
                )}
            </YStack>
        </YStack>
    );

    if (embedded) {
        return <YStack padding="$2">{body}</YStack>;
    }

    return (
        <YStack flex={1}>
            <ScrollView flex={1} contentContainerStyle={{ padding: 24, gap: 20 }} showsVerticalScrollIndicator={false}>
                {body}
            </ScrollView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    logoBox: {
        width: 120,
        height: 120,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    colorSwatch: {
        width: 36,
        height: 36,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    colorSwatchWrap: {
        position: 'relative',
        width: 36,
        height: 36,
    },
    colorSwatchInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0,
        cursor: 'pointer',
        border: 'none',
        padding: 0,
        margin: 0,
    } as any,
    colorPreviewBar: {
        height: 8,
        borderRadius: 4,
    },
});
