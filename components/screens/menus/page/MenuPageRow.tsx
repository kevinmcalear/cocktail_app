import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, radius, space, STATUS } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';
import type { MenuDrink } from '@/types/menus';

import type { Anchor } from '../RowMenu';

import { MenuDrawing, type MenuInk } from './MenuDrawing';

export interface PageRowView {
  drink: MenuDrink;
  /** The line under the name: what's in it, or a bartender's method. */
  line: string;
  /** The price this menu prints, Ready / Need limes at home, or nothing (a past menu, for guests). */
  end: string | null;
  endTone: 'ink' | 'green' | 'amber';
  /** Under the end: "19% cost". */
  sub: string | null;
  /** A small mark after the name: "Egg" (a guest's allergy), "On now" (on a past menu), "On from Fri" (planned). */
  flag: { label: string; tone: 'green' | 'amber' | 'quiet' } | null;
  /** The floor's allergen chips; an empty list reads "No allergens". Null: none shown. */
  chips: string[] | null;
  talkingPoint: string | null;
  ink: MenuInk;
}

/**
 * A drink on a menu page, as a ruled row: its drawing, its name in the
 * bar's face, what's in it, the price at the end, and what the person
 * looking adds (Menu-page rows). Tap opens it, or for a bartender opens the
 * spec in place (`open`, `onToggle`).
 */
export function MenuPageRow({ row, onPress, open, onMore, children }: { row: PageRowView; onPress: () => void; open?: boolean; onMore?: (anchor: Anchor) => void; children?: React.ReactNode }) {
  const ds = useDs();
  const more = useRef<ComponentRef<typeof View>>(null);
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  const green = readableAccent(STATUS.success, ds.c.ground);
  const tone = { ink: ds.c.ink, green, amber, quiet: ds.c.muted };
  const flagBg = { green: withAlpha(STATUS.success, 0.16), amber: withAlpha(STATUS.warning, 0.18), quiet: ds.c.raised };
  const { drink } = row;
  const label = [drink.name, row.line, row.end, row.flag?.label].filter(Boolean).join(', ');
  return (
    <View style={[styles.wrap, { borderTopColor: ds.c.lineStrong }]}>
      <PressableScale role="button" aria-expanded={open} accessibilityLabel={label} onPress={onPress} style={styles.row}>
        <MenuDrawing itemId={drink.id} size="row" ink={row.ink} fallback={{ imageUrl: drink.imageUrl, glass: drink.glass }} />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Headline numberOfLines={2} style={[styles.name, { fontFamily: displayFaces[ds.displayFace].regular }]}>
              {drink.name}
            </Headline>
            {row.flag ? (
              <View style={[styles.flag, { backgroundColor: flagBg[row.flag.tone] }]}>
                <Caption color={tone[row.flag.tone]} style={styles.flagText}>
                  {row.flag.label.toUpperCase()}
                </Caption>
              </View>
            ) : null}
          </View>
          {row.line ? (
            <Caption tone="muted" numberOfLines={3}>
              {row.line}
            </Caption>
          ) : null}
          {row.chips ? (
            <View style={styles.chips}>
              {(row.chips.length ? row.chips : ['No allergens']).map((c) => (
                <View
                  key={c}
                  style={[styles.chip, row.chips!.length ? { backgroundColor: flagBg.amber } : { borderColor: ds.c.lineStrong, borderWidth: StyleSheet.hairlineWidth }]}
                >
                  <Caption color={row.chips!.length ? amber : ds.c.muted} style={styles.flagText}>
                    {c.toUpperCase()}
                  </Caption>
                </View>
              ))}
            </View>
          ) : null}
          {row.talkingPoint ? (
            <DsText variant="caption" italic tone="muted" style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
              {row.talkingPoint}
            </DsText>
          ) : null}
        </View>
        <View style={styles.end}>
          {row.end ? (
            <DsText variant="label" color={tone[row.endTone]} style={font.figuresMedium}>
              {row.end}
            </DsText>
          ) : null}
          {row.sub ? (
            <Caption tone="muted" style={font.figures}>
              {row.sub}
            </Caption>
          ) : null}
          {open !== undefined ? <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={14} color={ds.c.muted} /> : null}
        </View>
        {onMore ? (
          <View ref={more} collapsable={false}>
            <PressableScale
              accessibilityLabel={`Change ${drink.name}: swap or take off`}
              aria-haspopup="menu"
              onPress={() => more.current?.measureInWindow((x, y, width, height) => onMore({ x, y, width, height }))}
              style={styles.more}
            >
              <IconSymbol name="ellipsis" size={16} color={ds.c.muted} />
            </PressableScale>
          </View>
        ) : null}
      </PressableScale>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, alignItems: 'flex-start' },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  name: { flexShrink: 1 },
  flag: { paddingHorizontal: space.xs + 2, paddingVertical: 1, borderRadius: radius.mark },
  flagText: { letterSpacing: 0.8, ...font.medium },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  chip: { paddingHorizontal: space.xs + 2, paddingVertical: 1, borderRadius: radius.mark },
  end: { alignItems: 'flex-end', gap: 2, minWidth: 44 },
  more: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
});
