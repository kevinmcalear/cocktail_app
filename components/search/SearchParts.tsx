import { useRouter } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, DrinkImage, DsText, GlassSurface, Headline, MatchText, PopoverMenu, PressableScale, RowScore, scoreWords, useDs, usePopover } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { withAlpha } from '@/lib/color';
import { foldName } from '@/lib/discover';
import { STYLES } from '@/lib/drinkStyles';
import { showOptions, type SearchScope, type SearchShow, type ShowCounts } from '@/lib/searchScope';

/**
 * "Little Rye ⌄": where the search looks, in glass at the head of the row over
 * the bottom field. A tap opens the places as a menu (search-starts-here):
 * the venue or your drinks, This area from Discover, and Everywhere.
 */
export function ScopeToken({ options, scope, onScope }: { options: { value: SearchScope; label: string; detail?: string }[]; scope: SearchScope; onScope: (scope: SearchScope) => void }) {
  const ds = useDs();
  const menu = usePopover();
  const token = useRef<ComponentRef<typeof View>>(null);
  const label = options.find((o) => o.value === scope)?.label ?? 'Everywhere';
  const items = options.map((o) => ({ label: o.label, detail: o.detail, checked: o.value === scope, onPress: () => onScope(o.value) }));
  return (
    <View ref={token} collapsable={false}>
      <PressableScale role="button" aria-expanded={!!menu.anchor} accessibilityLabel={`Searching ${label}. Change where to search`} onPress={() => menu.open(token.current)}>
        <GlassSurface interactive tint={menu.anchor ? withAlpha(ds.accentText, 0.25) : undefined} style={styles.token}>
          <DsText variant="label" color={ds.accentText} numberOfLines={1} style={styles.tokenText}>
            {label}
          </DsText>
          <IconSymbol name="chevron.down" size={12} color={ds.accentText} />
        </GlassSurface>
      </PressableScale>
      <PopoverMenu anchor={menu.anchor} label="Where to search" onClose={menu.close} sections={[{ title: 'Search in', items }]} />
    </View>
  );
}

/**
 * All, Drinks 4, Ingredients 2, Menus 1: what the results show, in one glass
 * track as Discover's map layers are. Nothing when only one kind found anything.
 */
export function ShowChips({ show, onShow, counts }: { show: SearchShow; onShow: (show: SearchShow) => void; counts: ShowCounts }) {
  const options = showOptions(counts);
  if (!options.length) return null;
  const picked = options.some((o) => o.value === show) ? show : 'all';
  return (
    <GlassSurface interactive style={styles.track}>
      <View role="radiogroup" accessibilityLabel="Show" style={styles.trackChips}>
        {options.map((o) => (
          <Chip key={o.value} look="glass" label={o.label} count={o.count} selected={picked === o.value} onPress={() => onShow(o.value)} />
        ))}
      </View>
    </GlassSurface>
  );
}

/** The typed word finished ("negr" + "oni"): a tap searches the whole name. */
export function Completions({ query, names, onPick }: { query: string; names: readonly string[]; onPick: (name: string) => void }) {
  const ds = useDs();
  if (!names.length) return null;
  const typed = foldName(query).length;
  return (
    <View role="list" accessibilityLabel="Suggestions">
      {names.map((n) => (
        <PressableScale key={n} role="button" accessibilityLabel={`Search ${n}`} onPress={() => onPick(n)} style={styles.completion}>
          <IconSymbol name="magnifyingglass" size={18} color={ds.c.muted} />
          <DsText variant="body" color={ds.c.muted} style={styles.flex} numberOfLines={1}>
            {n.slice(0, typed)}
            <DsText variant="body" style={styles.strong}>
              {n.slice(typed)}
            </DsText>
          </DsText>
          <IconSymbol name="arrow.up.right" size={16} color={ds.c.muted} />
        </PressableScale>
      ))}
    </View>
  );
}

interface TopHitProps {
  name: string;
  itemId: string;
  imageUrl: string | null;
  glass: string | null;
  caption?: string;
  /** Its ingredients, in spec order. */
  line?: string;
  score?: number;
  query: string;
  onPress: () => void;
}

/** The best match, first and bigger: its drawing, why it's here, its spec line and its score (search-typing). */
export function TopHit({ name, itemId, imageUrl, glass, caption, line, score, query, onPress }: TopHitProps) {
  const ds = useDs();
  const said = scoreWords(score);
  return (
    <View style={styles.group}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        Top hit
      </Caption>
      <PressableScale
        role="link"
        accessibilityLabel={[name, caption, line, said].filter(Boolean).join('. ')}
        onPress={onPress}
        style={[styles.hit, { backgroundColor: ds.c.raised }]}
      >
        <View style={styles.hitThumb}>
          <DrinkImage thumb sketchDetail="thumb" source={imageUrl} glass={glass} itemId={itemId} accessibilityLabel={name} radius="control" />
        </View>
        <View style={styles.flex}>
          <Headline numberOfLines={2}>
            <MatchText text={name} query={query} />
          </Headline>
          {caption ? <Caption tone="muted">{caption}</Caption> : null}
          {line ? (
            <Caption tone="muted" numberOfLines={1}>
              {line}
            </Caption>
          ) : null}
        </View>
        <RowScore score={score} />
      </PressableScale>
    </View>
  );
}

const TILES = ['negroni', 'sour', 'martini', 'highball'];

/** Browse by style: four drawn tiles, each opening Discover on that style (search-start). */
export function StyleTiles() {
  const ds = useDs();
  const router = useRouter();
  const { data: classics } = useDrinkLists();
  const tiles = TILES.flatMap((id) => STYLES.filter((s) => s.id === id)).map((s) => ({
    ...s,
    drawing: classics?.find((c) => foldName(c.name) === foldName(s.classics[0] ?? '')),
  }));
  return (
    <View style={styles.group}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        Browse by style
      </Caption>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <PressableScale
            key={t.id}
            role="link"
            accessibilityLabel={`${t.label}, browse the style`}
            onPress={() => router.push(`/discover?kind=${encodeURIComponent(t.id)}` as never)}
            style={[styles.tile, { backgroundColor: ds.c.paper }]}
          >
            <View style={styles.tileArt}>
              <DrinkImage thumb sketchDetail="thumb" source={t.drawing?.imageUrl ?? null} glass={null} itemId={t.drawing?.id} accessibilityLabel="" radius={0} />
            </View>
            <DsText variant="body" color={ds.c.sketchInk} style={styles.tileLabel}>
              {t.label}
            </DsText>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  // As tall as the chips' track beside it.
  token: { flexDirection: 'row', alignItems: 'center', gap: space.xs, height: layout.minTapTarget, maxWidth: 240, paddingHorizontal: space.md, borderRadius: radius.pill },
  tokenText: { flexShrink: 1, fontFamily: fontFamilies.bodyMedium },
  // 36-point chips in a 4-point track: a 44-point target (disc-desk-browse).
  track: { padding: space.xs },
  trackChips: { flexDirection: 'row', gap: space.xs + 2 },
  completion: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  group: { gap: space.sm },
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
  hit: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  hitThumb: { width: 72 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, flexBasis: '45%', height: 104, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end', padding: space.md },
  tileArt: { position: 'absolute', right: -6, top: 4, width: 96, pointerEvents: 'none' },
  tileLabel: { fontFamily: fontFamilies.bodySemiBold },
});
