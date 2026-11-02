import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, font, radius, space, STATUS } from '@/constants/tokens';
import type { ListAsk, OffTonight } from '@/hooks/useListAsks';
import type { ListRow } from '@/hooks/useLivingList';
import { readableAccent, withAlpha } from '@/lib/color';
import type { MenuDrink } from '@/types/menus';

import type { Act, ActKind } from './liveList';
import { MenuDrawing, type MenuInk } from './MenuDrawing';

export interface PageRowView {
  drink: MenuDrink;
  /** The line under the name: what's in it, or a bartender's method. */
  line: string;
  /** The price this menu prints, Ready / Need limes at home, or nothing (a past menu, for guests). */
  end: string | null;
  endTone: 'ink' | 'green' | 'amber';
  /** Under the end: "19% cost", "since 1 Oct". */
  sub: string | null;
  /** A small mark after the name: "Egg" (a guest's allergy), "On now" (on a past menu), "Waiting", "New". */
  flag: { label: string; tone: 'green' | 'amber' | 'quiet' } | null;
  /** The floor's allergen chips (lib/menuLens allergenChips): an empty list reads "No allergens", so only a checked drink may have one. Null: none shown. */
  chips: string[] | null;
  talkingPoint: string | null;
  ink: MenuInk;
  /** Taken off today: struck through, its picture faded. */
  struck?: boolean;
  /** Off for tonight: its name quieter, its picture faded. */
  faded?: boolean;
  /** The menu team's buttons under the row (Swap, Take off, Approve, Undo). */
  acts?: Act[];
  /** Its place on the living list, for the acts. */
  listRow?: ListRow;
  /** The ask it stands for (a bartender's change, or one waiting for the menu team). */
  ask?: ListAsk;
  /** Off for tonight: the row that says so, to put it back. */
  offTonight?: OffTonight;
}

interface MenuPageRowProps {
  row: PageRowView;
  /** Nothing to open: the row stays a plain row (a drink kept private). */
  onPress?: () => void;
  /** A bartender's spec, or the menu team's actions, open under the row. */
  open?: boolean;
  /** Show the row's acts (a tapped row on a live list, or a change waiting). */
  showActs?: boolean;
  onAct?: (kind: ActKind) => void;
  /** The chevron that says the row opens in place (a bartender's spec). */
  chevron?: boolean;
  children?: React.ReactNode;
}

/**
 * A drink on a menu page, as a ruled row: its drawing, its name in the
 * bar's face, what's in it, the price at the end, and what the person
 * looking adds (Menu-page rows). Tap opens it; a bartender's tap opens the
 * spec in place, the menu team's on a live list its Swap and Take off
 * (Menu-l-swap).
 */
export function MenuPageRow({ row, onPress, open, showActs, onAct, chevron, children }: MenuPageRowProps) {
  const ds = useDs();
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  const green = readableAccent(STATUS.success, ds.c.ground);
  const tone = { ink: ds.c.ink, green, amber, quiet: ds.c.muted };
  const flagBg = { green: withAlpha(STATUS.success, 0.16), amber: withAlpha(STATUS.warning, 0.18), quiet: ds.c.raised };
  const { drink } = row;
  const label = [drink.name, row.struck ? 'taken off today' : null, row.line, row.end, row.flag?.label, row.chips ? row.chips.join(', ') || 'No allergens' : null].filter(Boolean).join(', ');
  const acts = showActs && row.acts?.length ? row.acts : null;
  return (
    <View style={[styles.wrap, { borderTopColor: ds.c.lineStrong }]}>
      <PressableScale role={onPress ? 'button' : undefined} aria-expanded={open} accessibilityLabel={label} onPress={onPress} disabled={!onPress} style={styles.row}>
        <View style={row.struck ? styles.struckPic : undefined}>
          <MenuDrawing itemId={drink.id} size="menuRow" ink={row.ink} fallback={{ imageUrl: drink.imageUrl, glass: drink.glass }} />
        </View>
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Headline
              numberOfLines={2}
              color={row.struck || row.faded ? ds.c.muted : undefined}
              style={[styles.name, { fontFamily: displayFaces[ds.displayFace].regular }, row.struck && styles.struck]}
            >
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
                <View key={c} style={[styles.chip, row.chips!.length ? { backgroundColor: flagBg.amber } : { borderColor: ds.c.lineStrong, borderWidth: StyleSheet.hairlineWidth }]}>
                  <Caption color={row.chips!.length ? amber : ds.c.muted} style={styles.flagText}>
                    {c.toUpperCase()}
                  </Caption>
                </View>
              ))}
            </View>
          ) : null}
          {row.talkingPoint ? (
            <DsText variant="body" italic style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
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
          {chevron ? <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={14} color={ds.c.muted} /> : null}
        </View>
      </PressableScale>
      {acts ? (
        <View style={styles.acts}>
          {acts.map((a, i) => {
            // The first is the tonal one (Swap, Approve, Ask to put it on); a quiet row's (Undo, Withdraw, Keep it on, Back on) are outlined.
            const tonal = i === 0 && a.kind !== 'undo' && a.kind !== 'keep' && a.kind !== 'backOn' && a.label !== 'Withdraw';
            return (
              <PressableScale
                key={a.kind + a.label}
                role="button"
                accessibilityLabel={`${a.label} ${drink.name}`}
                onPress={() => onAct?.(a.kind)}
                style={[styles.act, tonal ? { backgroundColor: ds.c.raised } : { borderColor: ds.c.lineStrong, borderWidth: StyleSheet.hairlineWidth }]}
              >
                <DsText variant="label" style={font.semiBold}>
                  {a.label}
                </DsText>
              </PressableScale>
            );
          })}
        </View>
      ) : null}
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
  struck: { textDecorationLine: 'line-through' },
  struckPic: { opacity: 0.5 },
  flag: { paddingHorizontal: space.xs + 2, paddingVertical: 1, borderRadius: radius.mark },
  flagText: { letterSpacing: 0.8, ...font.medium },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  chip: { paddingHorizontal: space.xs + 2, paddingVertical: 1, borderRadius: radius.mark },
  end: { alignItems: 'flex-end', gap: 2, minWidth: 44 },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingLeft: 56 + space.md, paddingBottom: space.md },
  act: { minHeight: 36, paddingHorizontal: space.md + 2, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
