import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, PopoverMenu, PressableScale, Segmented, usePopover, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import { MAKES, SPEC_VIEWS, type Makes, type SpecView } from '@/lib/specView';

interface SpecControlsProps {
  view: SpecView;
  onView: (view: SpecView) => void;
  makes: Makes;
  onMakes: (makes: Makes) => void;
  /** "A batch…": opens the Batch sheet. Left out where a batch makes no sense (nothing measured). */
  onBatch?: () => void;
}

/**
 * Where "Spec" was: the Ingredients | Steps switch, and beside it the Makes
 * pill (Makes 1, 2, 3, A batch…). Shown only to people who see amounts; the
 * caller decides that (useSpecAccess). Boards Decided-who-bartender,
 * -bartender-menu and -bartender-2 on the 2027 canvas.
 */
export function SpecControls({ view, onView, makes, onMakes, onBatch }: SpecControlsProps) {
  const ds = useDs();
  const pill = useRef<ComponentRef<typeof View>>(null);
  const menu = usePopover();
  const pick = (n: Makes) => () => {
    onMakes(n);
    menu.close();
  };
  const sections = [
    { items: MAKES.map((n) => ({ label: `Makes ${n}`, checked: n === makes, onPress: pick(n) })) },
    ...(onBatch
      ? [
          {
            items: [
              {
                label: 'A batch…',
                onPress: () => {
                  menu.close();
                  onBatch();
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
