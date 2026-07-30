import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Separator, Text, XStack, YStack, useTheme } from 'tamagui';

type Template = { id: string; name: string; description?: string | null };

type Anchor = { x: number; y: number; width: number; height: number };

const MENU_WIDTH = 280;
const MENU_GAP = 6;
const MENU_EST_HEIGHT = 320;

/** Single-select template menu — same chrome language as VenueContextPicker. */
export function TemplatePicker({
    templates,
    selectedId,
    onSelect,
}: {
    templates: Template[];
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    const theme = useTheme();
    const router = useRouter();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const triggerRef = useRef<View>(null);
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState<Anchor | null>(null);

    const muted = theme.color11?.get() as string;
    const color = theme.color?.get() as string;
    const border = theme.borderColor?.get() as string;
    const surface = theme.backgroundStrong?.get() as string;

    const selected = templates.find((t) => t.id === selectedId);
    const label = selected?.name || 'Template';

    const openMenu = () => {
        triggerRef.current?.measureInWindow((x, y, width, height) => {
            setAnchor({ x, y, width, height });
            setOpen(true);
        });
    };

    const closeMenu = () => {
        setOpen(false);
        setAnchor(null);
    };

    const menuLeft = anchor
        ? Math.max(16, Math.min(anchor.x + anchor.width - MENU_WIDTH, windowWidth - MENU_WIDTH - 16))
        : 0;
    const fitsBelow =
        !!anchor && anchor.y + anchor.height + MENU_GAP + MENU_EST_HEIGHT < windowHeight - 16;
    const menuStyle = anchor
        ? fitsBelow
            ? { top: anchor.y + anchor.height + MENU_GAP, left: menuLeft }
            : { bottom: windowHeight - anchor.y + MENU_GAP, left: menuLeft }
        : null;

    return (
        <>
            <View ref={triggerRef} collapsable={false}>
                <Pressable
                    onPress={openMenu}
                    accessibilityRole="button"
                    accessibilityLabel={`Template: ${label}`}
                    style={styles.trigger}
                >
                    <XStack alignItems="center" gap={6}>
                        <IconSymbol name="square.grid.2x2" size={14} color={muted} />
                        <Text fontSize={13} color="$color11" fontWeight="500" numberOfLines={1} maxWidth={160}>
                            {label}
                        </Text>
                        <IconSymbol name="chevron.down" size={11} color={muted} />
                    </XStack>
                </Pressable>
            </View>

            <Modal transparent visible={open} animationType="fade" onRequestClose={closeMenu}>
                <Pressable style={styles.overlay} onPress={closeMenu}>
                    {menuStyle ? (
                        <Pressable
                            style={[styles.menu, menuStyle, { backgroundColor: surface, borderColor: border }]}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <YStack>
                                {templates.map((t) => {
                                    const checked = t.id === selectedId;
                                    return (
                                        <Pressable
                                            key={t.id}
                                            onPress={() => {
                                                onSelect(t.id);
                                                closeMenu();
                                            }}
                                            style={styles.row}
                                            accessibilityRole="menuitem"
                                        >
                                            <YStack flex={1} gap={2}>
                                                <Text fontSize={14} color="$color" fontWeight={checked ? '600' : '400'}>
                                                    {t.name}
                                                </Text>
                                                {t.description ? (
                                                    <Text fontSize={12} color="$color11" numberOfLines={1}>
                                                        {t.description}
                                                    </Text>
                                                ) : null}
                                            </YStack>
                                            {checked ? (
                                                <IconSymbol name="checkmark" size={16} color={color} />
                                            ) : null}
                                        </Pressable>
                                    );
                                })}

                                <Separator borderColor="$borderColor" />

                                <Pressable
                                    onPress={() => {
                                        closeMenu();
                                        router.push('/menus/create-template');
                                    }}
                                    style={styles.row}
                                >
                                    <IconSymbol name="plus" size={16} color={muted} />
                                    <Text fontSize={14} color="$color" fontWeight="600" flex={1} marginLeft={10}>
                                        New template
                                    </Text>
                                </Pressable>
                            </YStack>
                        </Pressable>
                    ) : null}
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    trigger: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    menu: {
        position: 'absolute',
        width: MENU_WIDTH,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        maxHeight: MENU_EST_HEIGHT,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
});
