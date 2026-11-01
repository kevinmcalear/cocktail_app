import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, PopoverMenu, PressableScale, Segmented, usePopover, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import { SPEC_VIEWS, type SpecView } from '@/lib/specView';

export interface SpecControlsProps {
  view: SpecView;
  onView: (view: SpecView) => void;
  /** After "Makes" on the pill: "1" for a drink, "1 L" for a house-made. */
  makes: string;
  /** The menu's sizes ("Makes 2", "Makes 750 ml"); the picked one is checked. */
  sizes: { key: string; label: string }[];
  picked: string;
  onPick: (key: string) => void;
  /** Its own group under the sizes: "A batch…" (the Batch sheet), "From what I have…" (Make mode). */
  more?: { label: string; onPress: () => void };
}

/**
 * Where "Spec" was: the Ingredients | Steps switch, and beside it the Makes
 * pill (Makes 1, 2, 3, A batch…; a house-made's Makes 1 L ⌄). Shown only to
 * people who see amounts; the caller decides that (useSpecAccess). Boards
 * Decided-who-bartender, -bartender-menu and -bartender-2, Item-page.
 */
export function SpecControls({ view, onView, makes, sizes, picked, onPick, more }: SpecControlsProps) {
  const ds = useDs();
  const pill = useRef<ComponentRef<typeof View>>(null);
  const menu = usePopover();
  const pick = (key: string) => () => {
    onPick(key);
    menu.close();
  };
  const sections = [
    { items: sizes.map((s) => ({ label: s.label, checked: s.key === picked, onPress: pick(s.key) })) },
    ...(more
      ? [
          {
            items: [
              {
                label: more.label,
                onPress: () => {
                  menu.close();
                  more.onPress();
                },
              },
            ],
          },
        ]
      : []),
  ];
  return (
    <View style={styles.row}>
      <Segmented options={SPEC_VIEWS} value={view} onChange={onView} accessibilityLabel="Show the spec as" variant="pill" />
      <View ref={pill} collapsable={false}>
        <PressableScale
          role="button"
          aria-haspopup="menu"
          aria-expanded={!!menu.anchor}
          accessibilityLabel={`Makes ${makes}. Change how many`}
          onPress={() => menu.open(pill.current)}
          style={[styles.pill, { backgroundColor: ds.c.raised }]}
        >
          <DsText variant="label" style={font.figuresMedium}>
            Makes {makes}
          </DsText>
          <IconSymbol name="chevron.down" size={18} color={ds.c.muted} />
        </PressableScale>
      </View>
      <PopoverMenu anchor={menu.anchor} label="Makes" sections={sections} onClose={menu.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  pill: { minHeight: layout.minTapTarget - space.xs, paddingHorizontal: space.md, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
