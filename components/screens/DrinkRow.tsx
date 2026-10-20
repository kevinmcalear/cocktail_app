import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, Headline, MatchText, PressableScale, Tag, useDs, type MatchTextProps, type TagTone } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { useSearchNavRow } from '@/components/search/searchNav';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { usePrefetchCocktail } from '@/hooks/useCocktails';
import { withAlpha } from '@/lib/color';
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
  /** With `profileId` (the bar page) a logo-less bar shows its initials in its venue's colours. */
  logo?: { uri: string | null; name: string; profileId?: string };
  /** Drawn in place of the logo's picture: a bar's monogram in its colours (What to make). */
  mark?: ReactNode;
  /** A list of many short rows (What to make): the name a size down, as the canvas draws those. */
  compact?: boolean;
  /** Discover's rows (disc-list, disc-desk-browse): compact's name, a 72-point picture. */
  dense?: boolean;
  /** A small pill after the caption: "Past · Mar 2024 to Jan 2025", or in the accent, a mixed list's "New". */
  tag?: string;
  tagTone?: TagTone;
  /** A second, longer line: a note of your own. */
  note?: string;
  /** Under the note: more about the drink (My Bar's "✓ Woodford ✓ lemon" checklist). Say it in `label` too. */
  below?: ReactNode;
  /** At the end of the row: a score (`RowScore` from components/ds). Say it in `caption` or `label` too, for screen readers. */
  trailing?: ReactNode;
  /** What was searched: its words are lit in the name and the note. */
  query?: string;
  /** How the searched words are lit (MatchText): accent on the search page, tint on Discover. */
  matchLook?: MatchTextProps['look'];
  /** The name in the venue's display face, as its own menu sets it (Tonight). */
  displayName?: boolean;
  /** What a screen reader hears, when it should say more than the name, caption and note. */
  label?: string;
  /** Discover: resting the pointer or keyboard focus on the row shows its bar on the map. Leaving cancels that. */
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}

/** The caption's bar logo: one line of caption text tall. */
const LOGO = 18;

/** A drink in a list: thumbnail and name, opening the drink page. */
export function DrinkRow({ name, href, onPress, imageUrl, glass, itemId, caption, logo, mark, compact: small, dense, tag, tagTone, note, below, trailing, label, query, matchLook, displayName, onHoverIn, onHoverOut }: DrinkRowProps) {
  const ds = useDs();
  const router = useRouter();
  const compact = small || dense;
  // A drink page starts loading on press, ahead of the tap.
  const prefetch = usePrefetchCocktail();
  const drinkId = onPress ? null : drinkIdFromHref(href);
  // In the ⌘K palette: the row the arrow keys are on, which Return opens.
  const nav = useSearchNavRow(itemId ? { itemId, name, imageUrl: imageUrl ?? null, glass: glass ?? null, caption } : undefined);
  // The logo sits on the caption's first line and the caption wraps beside it, never under it.
  const byline = logo || mark ? (
    <View style={styles.byline}>
      {mark ?? (logo ? <BarMark name={logo.name} logoUrl={logo.uri} profileId={logo.profileId} size={LOGO} filled /> : null)}
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
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onFocus={onHoverIn}
      onBlur={onHoverOut}
      nativeID={nav.nativeID}
      style={[styles.row, dense ? styles.dense : null, { borderBottomColor: ds.c.line }, nav.active && [styles.active, { backgroundColor: withAlpha(ds.accentText, 0.14) }]]}
    >
      <View style={dense ? styles.denseThumb : styles.thumb}>
        <DrinkImage thumb sketchDetail="thumb" source={imageUrl} glass={glass} itemId={itemId} accessibilityLabel={name} radius="control" />
      </View>
      <View style={styles.text}>
        {compact ? (
          <Body numberOfLines={1} style={styles.compactName}>
            <MatchText text={name} query={query} look={matchLook} />
          </Body>
        ) : (
          <Headline numberOfLines={1} style={displayName ? { fontFamily: displayFaces[ds.displayFace].regular } : null}>
            <MatchText text={name} query={query} look={matchLook} />
          </Headline>
        )}
        {tag ? (
          <View style={styles.captionRow}>
            {byline}
            <Tag label={tag} tone={tagTone} />
          </View>
        ) : (
          byline
        )}
        {note ? (
          <Caption numberOfLines={2}>
            <MatchText text={note} query={query} look={matchLook} />
          </Caption>
        ) : null}
        {below}
      </View>
      {trailing}
      {nav.active ? <Caption tone="muted">Open ↵</Caption> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  active: { borderRadius: radius.control, paddingHorizontal: space.sm, marginHorizontal: -space.sm, borderBottomColor: 'transparent' },
  thumb: { width: 56 },
  dense: { minHeight: 64, paddingVertical: space.sm },
  denseThumb: { width: 72 },
  text: { flex: 1, gap: 2 },
  byline: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  compactName: { fontFamily: fontFamilies.bodyMedium },
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
});
