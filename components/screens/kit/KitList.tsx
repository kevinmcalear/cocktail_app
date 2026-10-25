import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Surface, useDs } from '@/components/ds';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';

/** One thing in the kit: its drawing, its name, and where it comes from in one line. */
export interface KitEntry {
  id: string;
  name: string;
  line: string;
  thumb: ReactNode;
  /** Instead of the chevron: what tapping it does ("Add", "Match"). */
  action?: string;
}

export interface KitListProps {
  /** Sections only when they help (Ice: in the glass, then blocks and slabs). */
  sections: { title?: string; entries: KitEntry[] }[];
  /** The one open beside the list on a wide screen. */
  openId?: string | null;
  onOpen: (id: string) => void;
  /** "Add a glass"; none for a list of things to add (What next). */
  addLabel?: string;
  onAdd?: () => void;
  empty: string;
}

/**
 * Kit: Glassware, Ice and Tools look the same (Kit and ice, step 1): a list
 * that draws what you have, each with where it comes from in one line, and
 * one Add button.
 */
export function KitList({ sections, openId, onOpen, addLabel, onAdd, empty }: KitListProps) {
  const shown = sections.filter((s) => s.entries.length);
  return (
    <View style={styles.list}>
      {shown.length ? (
        shown.map((s) => (
          <View key={s.title ?? 'all'} style={styles.section}>
            {s.title ? <SectionHeading>{s.title}</SectionHeading> : null}
            <Surface style={styles.card}>
              <View role="list">
                {s.entries.map((e, i) => (
                  <KitRow key={e.id} entry={e} first={i === 0} open={e.id === openId} onPress={() => onOpen(e.id)} />
                ))}
              </View>
            </Surface>
          </View>
        ))
      ) : (
        <Body tone="muted">{empty}</Body>
      )}
      {!addLabel ? null : onAdd ? (
        <Button label={addLabel} icon="plus" onPress={onAdd} style={styles.add} />
      ) : (
        <Caption tone="muted">You can look, but changing the kit needs Prep at this venue.</Caption>
      )}
    </View>
  );
}

function KitRow({ entry, first, open, onPress }: { entry: KitEntry; first: boolean; open: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <View role="listitem" style={first ? null : { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }}>
      <PressableScale
        role="button"
        aria-current={open ? 'page' : undefined}
        accessibilityLabel={entry.line ? `${entry.name}. ${entry.line}` : entry.name}
        onPress={onPress}
        style={[styles.row, open ? { backgroundColor: ds.c.raised } : null]}
      >
        {entry.thumb}
        <View style={styles.flex}>
          <Body numberOfLines={1}>{entry.name}</Body>
          {entry.line ? (
            <Caption tone="muted" numberOfLines={2}>
              {entry.line}
            </Caption>
          ) : null}
        </View>
        {entry.action ? <Caption color={ds.accentText}>{entry.action}</Caption> : <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  section: { gap: space.sm },
  card: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.xs },
  flex: { flex: 1, minWidth: 0 },
  add: { alignSelf: 'flex-start' },
});
