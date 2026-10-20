import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, IngredientThumb, MatchText, PressableScale, RowScore, scoreWords, Tag, useDs, type IconName, type MatchTextProps } from '@/components/ds';
import { BarMark, type BarBrand } from '@/components/screens/home/BarMark';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { barDrinksLine, closedLabel, type DiscoverBar } from '@/lib/discoverDrinks';
import { groupLabel, moreCount, moreLabel, PER_GROUP } from '@/lib/searchScope';

import { useSearchNavRow } from './searchNav';

const THUMB = 56;

interface ResultRowProps {
  title: string;
  caption?: string;
  /** An icon tile (ingredients, menus, recents), or a round avatar for people; `bar` makes it the bar's mark, in its own colours. */
  icon?: IconName;
  /** The icon in the accent, not muted: the flavor map's target (prep-flavor-entry). */
  accentIcon?: boolean;
  avatar?: { uri: string | null; bar?: { profileId: string; brand?: BarBrand | null } };
  /** An ingredient's drawing in place of the icon. A null id draws from the title (drafts). */
  ingredient?: { id: string | null };
  /** A short label after the caption ("Closed 2019"); the avatar fades with it. */
  tag?: string;
  /** At the end: a score (RowScore). Say it in `label` too. */
  trailing?: ReactNode;
  /** What was searched: its words are lit in the title. */
  query?: string;
  matchLook?: MatchTextProps['look'];
  /** What a screen reader hears, when it should say more than the title, caption and tag. */
  label?: string;
  onPress: () => void;
  /** Discover: resting on the row shows this bar on the map. Leaving cancels that. */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}

/** A search result that isn't a drink: the same row as DrinkRow, with an icon or avatar. */
export function ResultRow({ title, caption, icon, accentIcon, avatar, ingredient, tag, trailing, query, matchLook, label, onPress, onHoverIn, onHoverOut }: ResultRowProps) {
  const ds = useDs();
  // In the ⌘K palette: the row the arrow keys are on, which Return opens.
  const nav = useSearchNavRow();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={label ?? [title, caption, tag].filter(Boolean).join('. ')}
      onPress={onPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      nativeID={nav.nativeID}
      style={[styles.row, { borderBottomColor: ds.c.line }, nav.active && [styles.active, { backgroundColor: withAlpha(ds.accentText, 0.14) }]]}
    >
      <View style={[styles.thumb, !avatar && !ingredient && { backgroundColor: ds.c.surface }, tag ? styles.faded : null]}>
        {ingredient ? (
          <IngredientThumb id={ingredient.id} name={title} size={THUMB} />
        ) : avatar?.bar ? (
          <BarMark name={title} logoUrl={avatar.uri} profileId={avatar.bar.profileId} brand={avatar.bar.brand} size={THUMB - space.sm} filled />
        ) : avatar ? (
          <UserAvatar uri={avatar.uri} name={title} size={THUMB - space.sm} />
        ) : (
          <IconSymbol name={icon ?? 'magnifyingglass'} size={22} color={accentIcon ? ds.accentText : ds.c.muted} />
        )}
      </View>
      <View style={styles.text}>
        <Headline numberOfLines={1}>
          <MatchText text={title} query={query} look={matchLook} />
        </Headline>
        <View style={styles.captionRow}>
          {caption ? (
            <Caption tone="muted" numberOfLines={2} style={styles.shrink}>
              {caption}
            </Caption>
          ) : null}
          {tag ? <Tag label={tag} /> : null}
        </View>
      </View>
      {trailing}
      {nav.active ? <Caption tone="muted">Open ↵</Caption> : null}
    </PressableScale>
  );
}

const place = (b: DiscoverBar) => [b.locality, b.city].filter(Boolean).join(', ');

/**
 * A bar, opening its page: where it is (and how far, in an area), how many
 * of its drinks match, and its bar score at the end (b02). A closed one says
 * when it shut, so nobody plans a night around it.
 */
export function BarResultRow({ bar, score, away, query, matchLook, onShowBar }: { bar: DiscoverBar; score?: number; away?: string | null; query?: string; matchLook?: MatchTextProps['look']; /** Hovering opens this bar on the map. */ onShowBar?: (barId: string | null) => void }) {
  const router = useRouter();
  // "Fitzroy · 14 drinks on now" (nav-search-home).
  const caption = [bar.locality || bar.city, away, barDrinksLine(bar)].filter(Boolean).join(' · ') || place(bar) || undefined;
  const said = scoreWords(score, score !== undefined ? 'bar score' : null);
  return (
    <ResultRow
      title={bar.name}
      caption={caption}
      avatar={{ uri: bar.logo, bar: { profileId: bar.id, brand: bar.brand } }}
      tag={bar.closed ? closedLabel(bar.closedYear) : undefined}
      trailing={bar.closed ? null : <RowScore score={score} detail={score !== undefined ? 'bar' : null} />}
      query={query}
      matchLook={matchLook}
      label={said ? [bar.name, caption, said].filter(Boolean).join('. ') : undefined}
      onPress={() => router.push(`/p/${bar.handle || bar.id}`)}
      onHoverIn={onShowBar ? () => onShowBar(bar.id) : undefined}
      onHoverOut={onShowBar ? () => onShowBar(null) : undefined}
    />
  );
}

interface ResultGroupProps<T> {
  label: string;
  /** False when the label already says how many ("Everywhere has 1 classic"). */
  counted?: boolean;
  items: readonly T[];
  render: (item: T) => ReactNode;
  /** A button at the heading's end: Recent's Clear. */
  action?: { label: string; onPress: () => void };
}

/** "Search everywhere for “negroni”" in the ⌘K palette: a slim outlined row with a globe, one the arrow keys reach. */
export function EverywhereRow({ label, onPress }: { label: string; onPress: () => void }) {
  const ds = useDs();
  const nav = useSearchNavRow();
  return (
    <PressableScale
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      nativeID={nav.nativeID}
      style={[styles.everywhere, { borderColor: ds.c.lineStrong }, nav.active && { backgroundColor: withAlpha(ds.accentText, 0.14) }]}
    >
      <IconSymbol name="globe" size={16} color={ds.c.muted} />
      <Caption style={[styles.moreText, styles.shrink]} numberOfLines={1}>
        {label}
      </Caption>
      {nav.active ? <Caption tone="muted">Open ↵</Caption> : null}
    </PressableScale>
  );
}

/**
 * "Nothing at Little Rye called “paloma”": one quiet card with what to do
 * about it, so the results from everywhere can follow right under it (search-miss).
 */
export function MissCard({ title, detail, action }: { title: string; detail: string; action?: { label: string; onPress: () => void } }) {
  const ds = useDs();
  return (
    <View style={[styles.miss, { backgroundColor: ds.c.raised }]}>
      <View style={[styles.missIcon, { backgroundColor: ds.c.ground }]}>
        <IconSymbol name="magnifyingglass" size={20} color={ds.c.muted} />
      </View>
      <View style={styles.missText}>
        <Body role="heading" style={styles.missTitle}>
          {title}
        </Body>
        <Caption tone="muted">{detail}</Caption>
        {action ? (
          <PressableScale role="button" accessibilityLabel={action.label} onPress={action.onPress} style={[styles.missAction, { borderColor: ds.c.lineStrong }]}>
            <IconSymbol name="plus" size={16} color={ds.accentText} />
            <DsText variant="label" style={styles.moreText}>
              {action.label}
            </DsText>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

/** "All 18 ›": flush left, ink, with a chevron, as the search boards draw it. */
function MoreLink({ label, onPress }: { label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={label} onPress={onPress} style={styles.more}>
      <Body style={styles.moreText}>{label}</Body>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** "Drinks · 12": the first few, then the rest behind "All 12", a page at a time. Nothing when empty. */
export function ResultGroup<T>({ label, counted = true, items, render, action }: ResultGroupProps<T>) {
  const [count, setCount] = useState(PER_GROUP);
  if (!items.length) return null;
  const shown = items.slice(0, count);
  const more = moreLabel(items.length, shown.length);
  return (
    <View style={styles.group}>
      <View style={styles.head}>
        <Caption tone="muted" role="heading" style={styles.cap}>
          {counted ? groupLabel(label, items.length) : label}
        </Caption>
        {action ? (
          <PressableScale role="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.headAction}>
            <DsText variant="label" style={styles.moreText}>
              {action.label}
            </DsText>
          </PressableScale>
        ) : null}
      </View>
      <View role="list">{shown.map(render)}</View>
      {more ? <MoreLink label={more} onPress={() => setCount(moreCount(items.length, shown.length))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shrink: { flexShrink: 1 },
  faded: { opacity: 0.5 },
  active: { borderRadius: radius.control, paddingHorizontal: space.sm, marginHorizontal: -space.sm, borderBottomColor: 'transparent' },
  group: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headAction: { minHeight: 32, justifyContent: 'center' },
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
  more: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget },
  moreText: { fontFamily: fontFamilies.bodyMedium },
  miss: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  missIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  missText: { flex: 1, minWidth: 0, gap: space.xs },
  missTitle: { fontFamily: fontFamilies.bodySemiBold },
  missAction: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40, marginTop: space.xs, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.pill },
  forget: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', marginRight: -space.md },
  everywhere: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.control },
});

/** The x on a Recent row: forgets it. */
export function ForgetButton({ title, onPress }: { title: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`Remove ${title} from Recent`} onPress={onPress} style={styles.forget}>
      <IconSymbol name="xmark" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}
