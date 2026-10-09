import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, Headline, PressableScale, Tag, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { usePrefetchCocktail } from '@/hooks/useCocktails';
import { drinkIdFromHref } from '@/lib/itemRoutes';

export interface DrinkRowProps {
  name: string;
  /** Opens this page, unless onPress does something else. */
  href?: string;
  onPress?: () => void;
  imageUrl: string | null;
  /** CustomIcons glass key for the placeholder, until the drink has a drawing. */
  glass: string | null;
  /** The drink's id, so a drink with no photo shows its drawn sketch. */
  itemId?: string | null;
  caption?: string;
  /** A small logo before the caption, for the bar that pours the drink (initials when it has none). */
  logo?: { uri: string | null; name: string };
  /** A small pill after the caption: "Past · Mar 2024 to Jan 2025". */
  tag?: string;
  /** A second, longer line: a note of your own. */
  note?: string;
  /** At the end of the row: a score. Say it in `caption` or `label` too, for screen readers. */
  trailing?: ReactNode;
  /** What a screen reader hears, when it should say more than the name, caption and note. */
  label?: string;
}

/** The caption's bar logo: one line of caption text tall. */
const LOGO = 18;

/** A drink in a list: thumbnail and name, opening the drink page. */
export function DrinkRow({ name, href, onPress, imageUrl, glass, itemId, caption, logo, tag, note, trailing, label }: DrinkRowProps) {
  const ds = useDs();
  const router = useRouter();
  // A drink page starts loading on press, ahead of the tap.
  const prefetch = usePrefetchCocktail();
  const drinkId = onPress ? null : drinkIdFromHref(href);
  // The logo sits on the caption's first line and the caption wraps beside it, never under it.
  const byline = logo ? (
    <View style={styles.byline}>
      <UserAvatar uri={logo.uri} name={logo.name} size={LOGO} />
      {caption ? (
        <Caption tone="muted" style={styles.shrink}>
          {caption}
        </Caption>
      ) : null}
    </View>
  ) : caption ? (
    <Caption tone="muted">{caption}</Caption>
  ) : null;
  return (
    <PressableScale
      accessibilityLabel={`${label ?? [name, caption, tag, note].filter(Boolean).join('. ')}, open`}
      onPressIn={drinkId ? () => prefetch(drinkId, { name, imageUrl }) : undefined}
      onPress={onPress ?? (() => href && router.push(href as never))}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.thumb}>
        <DrinkImage thumb sketchDetail="thumb" source={imageUrl} glass={glass} itemId={itemId} accessibilityLabel={name} radius="control" hideTag />
      </View>
      <View style={styles.text}>
        <Headline numberOfLines={1}>{name}</Headline>
        {tag ? (
          <View style={styles.captionRow}>
            {byline}
            <Tag label={tag} />
          </View>
        ) : (
          byline
        )}
        {note ? (
          <Caption numberOfLines={2}>
            {note}
          </Caption>
        ) : null}
      </View>
      {trailing}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56 },
  text: { flex: 1, gap: 2 },
  byline: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
});
