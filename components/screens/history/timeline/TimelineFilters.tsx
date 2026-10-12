import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { FAMILIES, type TreeNode } from '@/lib/drinkTree';
import { SPIRITS } from '@/lib/drinkStyles';
import { placeOptions, type TimelineFilter } from '@/lib/timeline';

type Menu = 'family' | 'spirit' | 'place' | null;

/** One filter pill: dark when it narrows the timeline; a chevron when it opens a menu. */
function Pill({ label, on, menu, onPress, aria }: { label: string; on: boolean; menu: boolean; onPress: () => void; aria: string }) {
  const ds = useDs();
  return (
    <PressableScale
      role="button"
      aria-pressed={menu ? undefined : on}
      aria-haspopup={menu ? 'menu' : undefined}
      accessibilityLabel={aria}
      onPress={onPress}
      style={[styles.pill, on ? { backgroundColor: ds.c.ink, borderColor: ds.c.ink } : { borderColor: ds.c.lineStrong }]}
    >
      <Caption numberOfLines={1} color={on ? ds.c.ground : ds.c.ink}>
        {label}
      </Caption>
      {menu ? <IconSymbol name="chevron.down" size={12} color={on ? ds.c.ground : ds.c.muted} /> : null}
    </PressableScale>
  );
}

/**
 * The timeline's filters as drawn: Family, Spirit and Bar or city open a menu
 * each; Styles shows or hides the historic styles.
 */
export function TimelineFilters({ nodes, filter, onChange }: { nodes: readonly TreeNode[]; filter: TimelineFilter; onChange: (f: TimelineFilter) => void }) {
  const [menu, setMenu] = useState<Menu>(null);
  const family = FAMILIES.find((f) => f.key === filter.family);
  const spirit = SPIRITS.find((s) => s.id === filter.spirit);
  const places = menu === 'place' ? placeOptions(nodes) : [];
  const set = (change: Partial<TimelineFilter>) => {
    onChange({ ...filter, ...change });
    setMenu(null);
  };
  const title = menu === 'family' ? 'Family' : menu === 'spirit' ? 'Spirit' : 'Bar or city';

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pill label={family?.name ?? 'Family'} on={!!family} menu onPress={() => setMenu('family')} aria={`Family: ${family?.name ?? 'every family'}`} />
        <Pill label={spirit?.label ?? 'Spirit'} on={!!spirit} menu onPress={() => setMenu('spirit')} aria={`Spirit: ${spirit?.label ?? 'any'}`} />
        <Pill label={filter.place ?? 'Bar or city'} on={!!filter.place} menu onPress={() => setMenu('place')} aria={`Bar or city: ${filter.place ?? 'anywhere'}`} />
        <Pill label="Styles" on={filter.styles} menu={false} onPress={() => onChange({ ...filter, styles: !filter.styles })} aria="Show historic styles" />
      </ScrollView>
      <MenuSheet visible={!!menu} onClose={() => setMenu(null)} title={title}>
        <View role="radiogroup" accessibilityLabel={title} style={styles.choices}>
          {menu === 'family' ? (
            <>
              <Choice label="Every family" selected={!filter.family} onPress={() => set({ family: null })} />
              {FAMILIES.map((f) => (
                <Choice key={f.key} label={f.name} selected={filter.family === f.key} onPress={() => set({ family: f.key })} />
              ))}
            </>
          ) : menu === 'spirit' ? (
            <>
              <Choice label="Any spirit" selected={!filter.spirit} onPress={() => set({ spirit: null })} />
              {SPIRITS.map((s) => (
                <Choice key={s.id} label={s.label} selected={filter.spirit === s.id} onPress={() => set({ spirit: s.id })} />
              ))}
            </>
          ) : menu === 'place' ? (
            <>
              <Choice label="Anywhere" selected={!filter.place} onPress={() => set({ place: null })} />
              {places.map((p) => (
                <Choice
                  key={`${p.kind}:${p.name}`}
                  label={p.name}
                  detail={`${p.kind === 'city' ? 'City' : 'Bar'} · ${p.count} drink${p.count === 1 ? '' : 's'}`}
                  selected={filter.place === p.name}
                  onPress={() => set({ place: p.name })}
                />
              ))}
            </>
          ) : null}
        </View>
      </MenuSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg },
  pill: {
    minHeight: layout.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
