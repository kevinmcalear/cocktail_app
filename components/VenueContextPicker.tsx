import { IconSymbol } from '@/components/ui/icon-symbol';
import { useBars } from '@/hooks/useBars';
import { contextLabel, PERSONAL_CONTEXT } from '@/lib/barContextFilter';
import { useAppStore } from '@/store/useAppStore';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Separator, Text, XStack, YStack, useTheme } from 'tamagui';

type Option = {
  id: string;
  label: string;
  logoUrl?: string | null;
};

type Anchor = { x: number; y: number; width: number; height: number };

const MENU_WIDTH = 260;
const MENU_GAP = 6;
const MENU_EST_HEIGHT = 280;

function barRecord(b: any) {
  return Array.isArray(b.bars) ? b.bars[0] : b.bars;
}

function ContextIcon({
  option,
  size,
  color,
}: {
  option: Option;
  size: number;
  color: string;
}) {
  if (option.id === PERSONAL_CONTEXT) {
    return <IconSymbol name="person.circle.fill" size={size} color={color} />;
  }
  if (option.logoUrl) {
    return (
      <Image
        source={{ uri: option.logoUrl }}
        style={{ width: size, height: size, borderRadius: size / 4 }}
        contentFit="cover"
      />
    );
  }
  return <IconSymbol name="building.2" size={size} color={color} />;
}

/** Multi-select: Personal + venues. Drives catalog context. */
export function VenueContextPicker() {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { data: bars } = useBars();
  const selectedContextIds = useAppStore((s) => s.selectedContextIds);
  const toggleContextId = useAppStore((s) => s.toggleContextId);
  const setSelectedContextIds = useAppStore((s) => s.setSelectedContextIds);
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const muted = theme.color11?.get() as string;
  const color = theme.color?.get() as string;
  const border = theme.borderColor?.get() as string;
  const surface = theme.backgroundStrong?.get() as string;

  const venueOptions = useMemo(
    () =>
      (bars || []).map((b: any) => {
        const bar = barRecord(b);
        return {
          bar_id: b.bar_id as string,
          name: bar?.name || 'Venue',
          logo_url: (bar?.logo_url as string | null) || null,
        };
      }),
    [bars]
  );

  const options: Option[] = useMemo(
    () => [
      { id: PERSONAL_CONTEXT, label: 'Personal' },
      ...venueOptions.map((v) => ({
        id: v.bar_id,
        label: v.name,
        logoUrl: v.logo_url,
      })),
    ],
    [venueOptions]
  );

  const label = contextLabel(
    selectedContextIds,
    venueOptions.map((v) => ({ bar_id: v.bar_id, name: v.name }))
  );
  const allIds = options.map((o) => o.id);
  const allSelected = allIds.every((id) => selectedContextIds.includes(id));

  // Logo only when exactly one venue is selected; multi → generic building
  const triggerOption: Option = useMemo(() => {
    if (selectedContextIds.length === 1) {
      return options.find((o) => o.id === selectedContextIds[0]) || {
        id: PERSONAL_CONTEXT,
        label: 'Personal',
      };
    }
    return { id: 'multi', label };
  }, [selectedContextIds, options, label]);

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
      : {
          bottom: windowHeight - anchor.y + MENU_GAP,
          left: menuLeft,
        }
    : null;

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={`Contexts: ${label}. Opens multi-select.`}
          style={styles.trigger}
        >
          <XStack alignItems="center" gap={6}>
            <ContextIcon option={triggerOption} size={14} color={muted} />
            <Text fontSize={13} color="$color11" fontWeight="500">
              {label}
            </Text>
            <IconSymbol name="chevron.down" size={11} color={muted} />
          </XStack>
        </Pressable>
      </View>

      <Modal transparent visible={open} animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.overlay} onPress={closeMenu}>
          {menuStyle && (
            <Pressable
              style={[
                styles.menu,
                menuStyle,
                { backgroundColor: surface, borderColor: border },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <YStack>
                <Pressable
                  onPress={() => {
                    setSelectedContextIds(allSelected ? [PERSONAL_CONTEXT] : allIds);
                  }}
                  style={styles.row}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allSelected }}
                >
                  <Text fontSize={14} fontWeight="600" color="$color" flex={1}>
                    Select all
                  </Text>
                  {allSelected && (
                    <IconSymbol name="checkmark" size={16} color={color} />
                  )}
                </Pressable>

                <Separator borderColor="$borderColor" />

                {options.map((opt) => {
                  const checked = selectedContextIds.includes(opt.id);
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => toggleContextId(opt.id)}
                      style={styles.row}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      accessibilityLabel={opt.label}
                    >
                      <XStack alignItems="center" gap={10} flex={1}>
                        <ContextIcon option={opt} size={18} color={muted} />
                        <Text fontSize={14} color="$color" fontWeight={checked ? '600' : '400'}>
                          {opt.label}
                        </Text>
                      </XStack>
                      {checked && <IconSymbol name="checkmark" size={16} color={color} />}
                    </Pressable>
                  );
                })}
              </YStack>
            </Pressable>
          )}
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
