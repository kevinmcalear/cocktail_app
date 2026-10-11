import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DrinkImage, Headline, PressableScale, RowScore, scoreWords, useDs, type MatchTextProps } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { DrinkAtBarRow, type DrinkScores } from '@/components/screens/home/DrinksAtBars';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, radius, space } from '@/constants/tokens';
import type { SpecMatchRow } from '@/hooks/useSpecMatches';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { itemHref } from '@/lib/itemRoutes';
import { specNoteText, variationSummary, type ServedBar } from '@/lib/servedAt';

interface ClassicRowProps {
  classic: { id: string; name: string; imageUrl: string | null };
  /** Its ingredients in spec order. */
  line?: string;
  /** The bars in the results pouring it as it is. */
  served?: ServedBar[];
  /** The bars' variations of it in the results, gathered under it. */
  variations?: DiscoverDrink[];
  matches?: Record<string, SpecMatchRow>;
  score?: number;
  scores?: DrinkScores;
  query: string;
  matchLook?: MatchTextProps['look'];
}

/**
 * A classic in search: "Classic · gin, Campari, sweet vermouth · served at
 * 7 bars", its score at the end, then the bars' variations of it in one line
 * ("4 variations: The Lantern Room uses mezcal, Ferro adds cold brew, Pale
 * Moth +1") that Show opens (nav-search-everywhere).
 */
export function ClassicRow({ classic, line, served, variations = [], matches, score, scores, query, matchLook }: ClassicRowProps) {
  const [open, setOpen] = useState(false);
  const n = served?.length ?? 0;
  const caption = ['Classic', line || null, n ? `served at ${n} ${n === 1 ? 'bar' : 'bars'}` : null].filter(Boolean).join(' · ');
  const said = scoreWords(score);
  const summary = variationSummary(variations.map((v) => ({ bar: v.bar.name, change: specNoteText(matches?.[v.id]?.notes) })));
  return (
    <View>
      <DrinkRow
        name={classic.name}
        href={itemHref('Cocktail', classic.id)}
        itemId={classic.id}
        imageUrl={classic.imageUrl}
        glass={null}
        caption={caption}
        query={query}
        matchLook={matchLook}
        trailing={<RowScore score={score} />}
        label={said ? [classic.name, caption, said].filter(Boolean).join('. ') : undefined}
      />
      {variations.length ? (
        <View style={styles.variations}>
          <View style={styles.flex}>
            <Body>{`${variations.length} ${variations.length === 1 ? 'variation' : 'variations'}`}</Body>
            <Caption tone="muted" numberOfLines={open ? undefined : 2}>
              {summary}
            </Caption>
          </View>
          <Button label={open ? 'Hide' : 'Show'} variant="secondary" accessibilityLabel={`${open ? 'Hide' : 'Show'} the ${variations.length} variations of the ${classic.name}`} onPress={() => setOpen(!open)} />
        </View>
      ) : null}
      {open ? variations.map((v) => <DrinkAtBarRow key={v.id} drink={v} scores={scores} query={query} matchLook={matchLook} />) : null}
    </View>
  );
}

/**
 * "Martinis, the style": the first thing a search for a style shows on
 * Discover, with its drawing, how many are near and what it takes in
 * (disc-search-typing). Picking it filters Discover to the style.
 */
export function StyleCard({ label, count, where, takesIn, drawingId, onPress }: { label: string; count: number; where: string; takesIn: string; drawingId?: string; onPress: () => void }) {
  const ds = useDs();
  const caption = [count ? `${count} ${where}` : null, takesIn].filter(Boolean).join(' · ');
  return (
    <PressableScale role="button" accessibilityLabel={`${label}, the style. ${caption}`} onPress={onPress} style={[styles.card, { borderColor: ds.c.lineStrong }]}>
      <View style={styles.thumb}>
        <DrinkImage thumb sketchDetail="thumb" itemId={drawingId} glass={null} accessibilityLabel={label} radius="control" />
      </View>
      <View style={styles.flex}>
        <View style={styles.styleName}>
          <Headline style={{ fontFamily: displayFaces[ds.displayFace].regular }}>{label}</Headline>
          <Caption tone="muted">the style</Caption>
        </View>
        <Caption tone="muted">{caption}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** "Browse": the style and the ingredient a search names, as chips (nav-search-everywhere). */
export function BrowseChips({ style, ingredient }: { style?: { id: string; label: string }; ingredient?: { id: string; name: string } }) {
  const router = useRouter();
  if (!style && !ingredient) return null;
  return (
    <View style={styles.browse}>
      <Caption tone="muted" role="heading" style={styles.cap}>
        Browse
      </Caption>
      {style ? <Chip label={`${style.label} the style`} selected={false} onPress={() => router.push(`/discover?kind=${encodeURIComponent(style.id)}` as never)} /> : null}
      {ingredient ? <Chip label={ingredient.name} selected={false} onPress={() => router.push(itemHref('Ingredient', ingredient.id) as never)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  variations: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: 56 + space.md, paddingVertical: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  thumb: { width: 56 },
  styleName: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  browse: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  cap: { letterSpacing: 0.8, textTransform: 'uppercase' },
});
