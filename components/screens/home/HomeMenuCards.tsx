import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, DsText, Headline, PressableScale, TextLink, Title, useDs } from '@/components/ds';
import { menuHref } from '@/components/screens/menus/MenuRows';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { useMenu } from '@/hooks/useMenus';
import { withAlpha } from '@/lib/color';
import { dateTile, daysAway, nightLong, type ShelfReady } from '@/lib/collectionMenus';
import { plural } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

const LINES = 3;

/** The paper card's ink, a little softer for the second lines. */
function usePaperInk() {
  const ds = useDs();
  return { ink: ds.c.sketchInk, soft: withAlpha(ds.c.sketchInk, 0.78), rule: withAlpha(ds.c.sketchInk, 0.35) };
}

/**
 * A dated home menu as a paper menu card (home-collection-menus, option A):
 * the night, its name, the first drinks with what's in them, their drawings;
 * under it the date tile, how far off, guests, and how much your shelf makes.
 * `compact` drops the ingredient lines and drawings (the desktop grid).
 */
export function PaperMenuCard({ menu, ready, now, compact }: { menu: MenuSummary; ready: ShelfReady; now: number; compact?: boolean }) {
  const ds = useDs();
  const paper = usePaperInk();
  const router = useRouter();
  const detail = useMenu(menu.id).data;
  const drinks = detail?.sections.flatMap((s) => s.drinks) ?? [];
  const count = new Set(menu.itemIds).size;
  const more = count - LINES;
  const tile = dateTile(menu.menuDate!);
  const soon = daysAway(menu.menuDate!, now);
  const guests = [menu.guestCount ? plural(menu.guestCount, 'guest') : null, count ? plural(count, 'drink') : null].filter(Boolean).join(' · ');
  const pct = ready.total ? ready.ready / ready.total : 0;
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[menu.name, nightLong(menu.menuDate!), soon, guests, ready.total ? `${ready.ready} of ${ready.total} ready` : null, ready.shop].filter(Boolean).join('. ')}
      onPress={() => router.push(menuHref(menu.id))}
      style={styles.card}
    >
      <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
        <View style={[styles.frame, compact && styles.frameCompact, { borderColor: paper.rule }]}>
          <DsText variant="caption" color={paper.ink} style={styles.when} align="center">
            {nightLong(menu.menuDate!).toUpperCase()}
          </DsText>
          <Title italic color={paper.ink} align="center" role={undefined}>
            {menu.name}
          </Title>
          {/* The ornament under the title: a line, a diamond, a line. */}
          <View style={styles.ornament} aria-hidden>
            <View style={[styles.rule, { backgroundColor: paper.rule }]} />
            <View style={[styles.diamond, { borderColor: paper.soft }]} />
            <View style={[styles.rule, { backgroundColor: paper.rule }]} />
          </View>
          {drinks.slice(0, LINES).map((d) => (
            <View key={d.id} style={styles.drink}>
              <DsText variant="caption" color={paper.ink} style={styles.drinkName} align="center">
                {d.name.toUpperCase()}
              </DsText>
              {!compact && d.line ? (
                <DsText variant="body" color={paper.soft} align="center" numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
                  {d.line}
                </DsText>
              ) : null}
            </View>
          ))}
          {count ? null : (
            <DsText variant="body" color={paper.soft} align="center" style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
              No drinks on it yet. Open it to pick some.
            </DsText>
          )}
          {more > 0 ? (
            <DsText variant="caption" color={paper.soft}>
              {`and ${more} more`}
            </DsText>
          ) : null}
          {!compact && menu.pictures.length ? (
            <View style={styles.pics} aria-hidden>
              {menu.pictures.slice(0, LINES).map((p) => (
                <View key={p.id} style={styles.pic}>
                  <DrinkImage thumb sketchDetail="thumb" source={p.imageUrl} glass={null} itemId={p.id} accessibilityLabel={p.name} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.under}>
        <View style={[styles.tile, { backgroundColor: ds.c.raised }]} aria-hidden>
          <Caption tone="muted">{tile.mon}</Caption>
          <DsText variant="spec">{tile.day}</DsText>
        </View>
        <View style={styles.flex}>
          {soon ? <DsText variant="body" style={styles.soon}>{soon}</DsText> : null}
          {guests ? <Caption tone="muted">{guests}</Caption> : null}
        </View>
      </View>
      {/* Always there, empty for a menu with no drinks yet, so cards side by side keep their paper the same height. */}
      <View style={styles.ready}>
        <View style={[styles.track, { backgroundColor: ds.c.raised }]}>
          <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: ds.accentText }]} />
        </View>
        <View style={styles.readyRow}>
          <Caption tone={ready.total ? 'ink' : 'muted'}>{ready.total ? `${ready.ready} of ${ready.total} ready` : 'Nothing to make yet'}</Caption>
          {ready.shop ? <Caption tone="muted">{ready.shop}</Caption> : null}
        </View>
      </View>
    </PressableScale>
  );
}

/** An undated home menu, still building: a dashed row (or a dashed card in the desktop grid) with Pick a night. */
export function BuildingMenu({ menu, ready, onPickNight, card }: { menu: MenuSummary; ready: ShelfReady; onPickNight: () => void; card?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const count = new Set(menu.itemIds).size;
  const line = [count ? plural(count, 'drink') : 'No drinks yet', count ? `${ready.ready} of ${count} ready` : null].filter(Boolean);
  const open = () => router.push(menuHref(menu.id));
  if (card) {
    return (
      <View style={styles.card}>
        <PressableScale role="link" accessibilityLabel={[menu.name, 'No date yet', ...line].join('. ')} onPress={open} style={[styles.dashedCard, { borderColor: ds.c.lineStrong }]}>
          <Caption tone="muted" style={styles.when}>
            NO DATE YET
          </Caption>
          <Title italic align="center" role={undefined}>
            {menu.name}
          </Title>
          <Caption tone="muted" align="center">
            {['Still building', ...line].join(' · ')}
          </Caption>
        </PressableScale>
        <TextLink label="Pick a night" onPress={onPickNight} />
      </View>
    );
  }
  return (
    <View style={[styles.dashedRow, { borderColor: ds.c.lineStrong }]}>
      <PressableScale role="link" accessibilityLabel={[menu.name, ...line, 'no date yet'].join('. ')} onPress={open} style={styles.flex}>
        <Headline numberOfLines={1}>{menu.name}</Headline>
        <Caption tone="muted">{[...line, 'no date yet'].join(' · ')}</Caption>
      </PressableScale>
      <TextLink label="Pick a night" onPress={onPickNight} />
    </View>
  );
}

/** A past night: a small paper card with its name and date, how many drinks and guests under it. */
export function PastNight({ menu }: { menu: MenuSummary }) {
  const ds = useDs();
  const paper = usePaperInk();
  const router = useRouter();
  const tile = dateTile(menu.menuDate!);
  const count = new Set(menu.itemIds).size;
  const note = [count ? plural(count, 'drink') : null, menu.guestCount ? plural(menu.guestCount, 'guest') : null].filter(Boolean).join(' · ');
  return (
    <PressableScale role="link" accessibilityLabel={[menu.name, `${tile.day} ${tile.mon}`, note].filter(Boolean).join('. ')} onPress={() => router.push(menuHref(menu.id))} style={styles.past}>
      <View style={[styles.pastPaper, { backgroundColor: ds.c.paper }]}>
        <View style={[styles.pastFrame, { borderColor: paper.rule }]}>
          <DsText variant="headline" color={paper.ink} align="center" numberOfLines={3} style={{ fontFamily: displayFaces[ds.displayFace].italic }}>
            {menu.name}
          </DsText>
          <DsText variant="caption" color={paper.ink} style={styles.when}>{`${tile.day} ${tile.mon}`}</DsText>
        </View>
      </View>
      {note ? <Caption tone="muted">{note}</Caption> : null}
    </PressableScale>
  );
}

/** The desktop grid's last card: start a new menu. */
export function NewMenuTile({ onPress }: { onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="New menu" onPress={onPress} style={[styles.dashedCard, styles.newTile, { borderColor: ds.c.lineStrong }]}>
      <IconSymbol name="plus" size={22} color={ds.c.ink} />
      <DsText variant="body" style={styles.soon}>
        New menu
      </DsText>
      <Caption tone="muted" align="center">
        Pick a night and the drinks, or start from a bar’s menu
      </Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Cards side by side in a rail stand as tall as the tallest, so an empty menu's paper still matches.
  card: { flex: 1, gap: space.sm + 2 },
  paper: { flex: 1, borderRadius: radius.mark, padding: space.sm + 2 },
  frame: { flex: 1, borderWidth: 1, borderRadius: radius.mark, paddingTop: space.xl, paddingBottom: space.lg, paddingHorizontal: space.lg, alignItems: 'center', gap: space.md, minHeight: 380 },
  frameCompact: { minHeight: 320, paddingTop: space.lg + 4 },
  when: { letterSpacing: 2 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rule: { width: 40, height: StyleSheet.hairlineWidth },
  diamond: { width: 6, height: 6, borderWidth: 1, transform: [{ rotate: '45deg' }] },
  drink: { alignSelf: 'stretch', gap: 2 },
  drinkName: { letterSpacing: 1.6 },
  pics: { flexDirection: 'row', gap: space.sm + 2, marginTop: 'auto' },
  pic: { width: 44, height: 56 },
  under: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  tile: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  soon: { fontFamily: fontFamilies.bodySemiBold },
  ready: { gap: space.xs + 2 },
  track: { height: 4, borderRadius: radius.mark, overflow: 'hidden' },
  fill: { height: 4 },
  readyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  dashedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, borderWidth: 1, borderStyle: 'dashed' },
  dashedCard: { minHeight: 336, borderRadius: radius.mark, borderWidth: 1, borderStyle: 'dashed', padding: space.xl, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  newTile: { gap: space.sm + 2 },
  past: { width: 132, gap: space.sm },
  pastPaper: { height: 168, borderRadius: radius.mark, padding: space.xs + 2 },
  pastFrame: { flex: 1, borderWidth: 1, borderRadius: radius.mark, alignItems: 'center', justifyContent: 'center', gap: space.xs + 2, padding: space.sm },
});
