import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Headline, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { groupLabel, PER_GROUP } from '@/lib/searchScope';

const THUMB = 56;

interface ResultRowProps {
  title: string;
  caption?: string;
  /** An icon tile (ingredients, menus, recents), or a round avatar for bars and people. */
  icon?: IconName;
  avatar?: { uri: string | null };
  onPress: () => void;
}

/** A search result that isn't a drink: the same row as DrinkRow, with an icon or avatar. */
export function ResultRow({ title, caption, icon, avatar, onPress }: ResultRowProps) {
  const ds = useDs();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[title, caption].filter(Boolean).join('. ')}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <View style={[styles.thumb, !avatar && { backgroundColor: ds.c.surface }]}>
        {avatar ? <UserAvatar uri={avatar.uri} name={title} size={THUMB - space.sm} /> : <IconSymbol name={icon ?? 'magnifyingglass'} size={22} color={ds.c.muted} />}
      </View>
      <View style={styles.text}>
        <Headline numberOfLines={1}>{title}</Headline>
        {caption ? (
          <Caption tone="muted" numberOfLines={1}>
            {caption}
          </Caption>
        ) : null}
      </View>
    </PressableScale>
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
  group: { gap: space.xs },
  more: { alignSelf: 'flex-start' },
});
