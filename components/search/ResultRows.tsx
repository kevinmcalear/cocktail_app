import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, IngredientThumb, MatchText, PressableScale, RowScore, scoreWords, Tag, useDs, type IconName, type MatchTextProps } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { closedLabel, drinkCount, type DiscoverBar } from '@/lib/discoverDrinks';
import { groupLabel, moreCount, moreLabel, PER_GROUP } from '@/lib/searchScope';

import { useSearchNavRow } from './searchNav';

const THUMB = 56;

interface ResultRowProps {
  title: string;
  caption?: string;
  /** An icon tile (ingredients, menus, recents), or a round avatar for bars and people. */
  icon?: IconName;
  avatar?: { uri: string | null };
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
}

/** A search result that isn't a drink: the same row as DrinkRow, with an icon or avatar. */
export function ResultRow({ title, caption, icon, avatar, ingredient, tag, trailing, query, matchLook, label, onPress }: ResultRowProps) {
  const ds = useDs();
  // In the ⌘K palette: the row the arrow keys are on, which Return opens.
  const nav = useSearchNavRow();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={label ?? [title, caption, tag].filter(Boolean).join('. ')}
      onPress={onPress}
      nativeID={nav.nativeID}
      style={[styles.row, { borderBottomColor: ds.c.line }, nav.active && [styles.active, { backgroundColor: withAlpha(ds.accentText, 0.14) }]]}
    >
      <View style={[styles.thumb, !avatar && !ingredient && { backgroundColor: ds.c.surface }, tag ? styles.faded : null]}>
        {ingredient ? (
          <IngredientThumb id={ingredient.id} name={title} size={THUMB} />
        ) : avatar ? (
          <UserAvatar uri={avatar.uri} name={title} size={THUMB - space.sm} />
        ) : (
          <IconSymbol name={icon ?? 'magnifyingglass'} size={22} color={ds.c.muted} />
        )}
      </View>
      <View style={styles.text}>
        <Headline numberOfLines={1}>
          <MatchText text={title} query={query} look={matchLook} />
        </Headline>
        <View style={styles.captionRow}>
          {caption ? (
            <Caption tone="muted" numberOfLines={1} style={styles.shrink}>
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
export function BarResultRow({ bar, score, away, query, matchLook }: { bar: DiscoverBar; score?: number; away?: string | null; query?: string; matchLook?: MatchTextProps['look'] }) {
  const router = useRouter();
  const caption = [bar.locality || bar.city, away, bar.drinks ? drinkCount(bar.drinks) : null].filter(Boolean).join(' · ') || place(bar) || undefined;
  const said = scoreWords(score, score !== undefined ? 'bar score' : null);
  return (
    <ResultRow
      title={bar.name}
      caption={caption}
      avatar={{ uri: bar.logo }}
      tag={bar.closed ? closedLabel(bar.closedYear) : undefined}
      trailing={bar.closed ? null : <RowScore score={score} detail={score !== undefined ? 'bar' : null} />}
      query={query}
      matchLook={matchLook}
      label={said ? [bar.name, caption, said].filter(Boolean).join('. ') : undefined}
      onPress={() => router.push(`/p/${bar.handle || bar.id}`)}
    />
  );
}

interface ResultGroupProps<T> {
  label: string;
  items: readonly T[];
  render: (item: T) => ReactNode;
}

/** "Drinks · 12": the first few, then the rest behind "All 12", a page at a time. Nothing when empty. */
export function ResultGroup<T>({ label, items, render }: ResultGroupProps<T>) {
  const [count, setCount] = useState(PER_GROUP);
  if (!items.length) return null;
  const shown = items.slice(0, count);
  const more = moreLabel(items.length, shown.length);
  return (
    <View style={styles.group}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        {groupLabel(label, items.length)}
      </Caption>
      <View role="list">{shown.map(render)}</View>
      {more ? <Button label={more} variant="ghost" onPress={() => setCount(moreCount(items.length, shown.length))} style={styles.more} /> : null}
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
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
  more: { alignSelf: 'flex-start' },
});
