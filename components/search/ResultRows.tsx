import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, IngredientThumb, PressableScale, Tag, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { closedLabel, type DiscoverBar } from '@/lib/discoverDrinks';
import { groupLabel, PER_GROUP } from '@/lib/searchScope';

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
  onPress: () => void;
}

/** A search result that isn't a drink: the same row as DrinkRow, with an icon or avatar. */
export function ResultRow({ title, caption, icon, avatar, ingredient, tag, onPress }: ResultRowProps) {
  const ds = useDs();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[title, caption, tag].filter(Boolean).join('. ')}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
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
        <Headline numberOfLines={1}>{title}</Headline>
        <View style={styles.captionRow}>
          {caption ? (
            <Caption tone="muted" numberOfLines={1} style={styles.shrink}>
              {caption}
            </Caption>
          ) : null}
          {tag ? <Tag label={tag} /> : null}
        </View>
      </View>
    </PressableScale>
  );
}

const place = (b: DiscoverBar) => [b.locality, b.city].filter(Boolean).join(', ');

/** A bar, opening its page. A closed one says when it shut, so nobody plans a night around it. */
export function BarResultRow({ bar }: { bar: DiscoverBar }) {
  const router = useRouter();
  return (
    <ResultRow
      title={bar.name}
      caption={place(bar) || undefined}
      avatar={{ uri: bar.logo }}
      tag={bar.closed ? closedLabel(bar.closedYear) : undefined}
      onPress={() => router.push(`/p/${bar.handle || bar.id}`)}
    />
  );
}

interface ResultGroupProps<T> {
  label: string;
  items: readonly T[];
  render: (item: T) => ReactNode;
}

/** "Drinks · 12": the first few, then the rest behind "All 12". Nothing when empty. */
export function ResultGroup<T>({ label, items, render }: ResultGroupProps<T>) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, PER_GROUP);
  return (
    <View style={styles.group}>
      <Caption tone="muted" role="heading">
        {groupLabel(label, items.length)}
      </Caption>
      <View role="list">{shown.map(render)}</View>
      {items.length > shown.length ? <Button label={`All ${items.length}`} variant="ghost" onPress={() => setAll(true)} style={styles.more} /> : null}
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
  group: { gap: space.xs },
  more: { alignSelf: 'flex-start' },
});
