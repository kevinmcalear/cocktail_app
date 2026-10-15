import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Tag, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { MenuLayoutTemplate } from '@/hooks/useMenuMutations';
import { menuDateLine, menuStatus, plural } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { MenuVisual } from './MenuVisual';
import { MonoLabel } from './ReviewParts';
import type { Start } from './useNewMenu';

export type StartKind = 'photo' | 'saved' | 'paste' | 'blank';

interface Tile {
  kind: StartKind;
  label: string;
  detail: string;
  icon: IconName;
}

/**
 * How a new menu starts, as tiles two across. On a phone (venue-menus-new P1)
 * a tap goes straight on, so nothing stays picked: Snap the menu, A menu you
 * saved (when there is one), Paste a list, Blank.
 */
export function StartTiles({ saved, onPick }: { saved: string | null; onPick: (kind: StartKind) => void }) {
  const ds = useDs();
  const tiles: Tile[] = [
    { kind: 'photo', label: 'Snap the menu', detail: 'A printed one. We read it.', icon: 'camera' },
    ...(saved ? [{ kind: 'saved' as const, label: 'A menu you saved', detail: saved, icon: 'doc.on.doc' as const }] : []),
    { kind: 'paste', label: 'Paste a list', detail: 'Drink names, one a line', icon: 'list.bullet' },
    { kind: 'blank', label: 'Blank', detail: 'One section to fill', icon: 'plus' },
  ];
  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <PressableScale
          key={t.kind}
          role="button"
          accessibilityLabel={`${t.label}. ${t.detail}`}
          onPress={() => onPick(t.kind)}
          style={[styles.tile, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}
        >
          <View style={[styles.icon, { backgroundColor: ds.c.raised }]} aria-hidden>
            <IconSymbol name={t.icon} size={20} color={ds.c.ink} />
          </View>
          <View>
            <DsText variant="body" style={{ fontFamily: fontFamilies.bodySemiBold }}>
              {t.label}
            </DsText>
            <Caption tone="muted">{t.detail}</Caption>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

/**
 * Which menu to start from (venue-menus-new P2): the venue's menus, each with
 * its drinks' pictures, how many and when it ran, then its saved layouts. A
 * tap picks it and goes on.
 */
export function WhichMenu({ menus, layouts, now, onPick }: { menus: MenuSummary[]; layouts: MenuLayoutTemplate[]; now: number; onPick: (start: Start) => void }) {
  return (
    <View style={styles.list}>
      {menus.map((m) => {
        const on = menuStatus(m, now) === 'on';
        const when = menuDateLine(m, now, undefined, true);
        return (
          <Row key={m.id} label={m.name} detail={[plural(m.itemIds.length, 'drink'), when].filter(Boolean).join(' · ')} onPress={() => onPick({ kind: 'copy', menuId: m.id })} tag={on ? 'On now' : null}>
            <MenuVisual name={m.name} coverUrl={m.coverUrl} coverPosition={m.coverPosition} pictures={m.pictures.slice(0, 1)} height={56} />
          </Row>
        );
      })}
      {layouts.length ? <MonoLabel>Saved layouts</MonoLabel> : null}
      {layouts.map((l) => (
        <Row key={l.id} label={l.name} detail={`${plural(l.sections.length, 'section')}, no drinks`} onPress={() => onPick({ kind: 'layout', layoutId: l.id })}>
          <LayoutMark />
        </Row>
      ))}
    </View>
  );
}

function Row({ label, detail, tag, onPress, children }: { label: string; detail: string; tag?: string | null; onPress: () => void; children: ReactNode }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`${label}. ${detail}`} onPress={onPress} style={[styles.row, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={[styles.thumb, { backgroundColor: ds.c.paper }]} aria-hidden>
        {children}
      </View>
      <View style={styles.flex}>
        <DsText variant="headline" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {label}
        </DsText>
        <Caption tone="muted" numberOfLines={1}>
          {detail}
        </Caption>
      </View>
      {tag ? <Tag label={tag} tone="success" dot /> : <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />}
    </PressableScale>
  );
}

/** A saved layout has no drinks: three ruled lines on paper. */
function LayoutMark() {
  const ds = useDs();
  return (
    <View style={styles.layout}>
      {[28, 22, 28].map((w, i) => (
        <View key={i} style={{ width: w, height: 1.5, backgroundColor: withAlpha(ds.c.sketchInk, 0.45) }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 2 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 148, padding: space.lg, gap: space.sm + 2, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderCurve: 'continuous' },
  icon: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, paddingRight: space.md, borderRadius: radius.card - 4, borderWidth: StyleSheet.hairlineWidth, borderCurve: 'continuous' },
  thumb: { width: 56, height: 56, borderRadius: radius.control, overflow: 'hidden', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  layout: { alignItems: 'center', gap: space.xs + 1 },
});
