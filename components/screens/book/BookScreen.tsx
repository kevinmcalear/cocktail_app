import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePageFrame } from '@/components/nav/PageFrame';
import { BackbarTheme, Body, Button, Caption, GlassButton, Headline, PressableScale, RowScore, scoreWords, Title, useDs, useGutter } from '@/components/ds';
import { familyHues, fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { useBook } from '@/hooks/useDrinkHistory';
import { useDrinkSources } from '@/hooks/useDrinkSources';
import { useItemScores } from '@/hooks/useFlavor';
import { RELATION_LABEL } from '@/lib/drinkHistory';

/** "Bar-Tender's Guide" from "How to Mix Drinks, or The Bon-Vivant's Companion (Bar-Tender's Guide)": the name it goes by, as the board prints it. */
export function shortTitle(title: string): string {
  return title.match(/\(([^)]+)\)\s*$/)?.[1] ?? title;
}

/** One of the old cocktail books (or another source): where to read it, and the drinks printed in it. */
export function BookScreen() {
  return (
    <BackbarTheme>
      <BookPage />
    </BackbarTheme>
  );
}

function BookPage() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { column } = usePageFrame();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { data, isLoading, error } = useBook(key);
  const source = data?.source;
  const drinks = data?.drinks ?? [];
  // Each drink's score and how many bars pour a version of it (b02).
  const itemIds = drinks.flatMap((d) => (d.item ? [d.item.id] : []));
  const { data: scores } = useItemScores(itemIds);
  const { data: sources } = useDrinkSources(itemIds);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          column,
          { paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter },
        ]}
      >
        {error ? <Body>{`Couldn't load this book: ${error.message}`}</Body> : null}
        {!isLoading && !error && !source ? <Body>{"This book isn't here."}</Body> : null}
        {source ? (
          <>
            <View style={styles.top}>
              {/* The drawn cover (prep-hist-book): its short title and year on a bound board. */}
              <View aria-hidden style={[styles.cover, { backgroundColor: withAlpha(familyHues[ds.scheme].oldfashioned, 0.45), borderColor: ds.c.lineStrong }]}>
                <Caption numberOfLines={3} style={styles.coverTitle}>
                  {shortTitle(source.title)}
                </Caption>
                {source.year ? <Caption style={styles.mono}>{String(source.year)}</Caption> : null}
              </View>
              <View style={[styles.header, styles.flex]}>
                <Caption tone="muted" style={styles.eyebrow}>
                  {[source.kind === 'book' ? 'Book' : source.kind === 'bar' ? 'Bar' : 'Source', source.year, source.city].filter(Boolean).join(' · ').toUpperCase()}
                </Caption>
                <Title accessibilityLabel={source.title}>{shortTitle(source.title)}</Title>
                <Caption tone="muted">{[source.author, source.rights === 'public_domain' ? 'public domain' : 'still in copyright'].filter(Boolean).join(' · ')}</Caption>
              </View>
            </View>
            {source.summary ? <Body tone="muted">{source.summary}</Body> : null}
            <View style={styles.actions}>
              {source.euvs_url ? <Button label="Read it on EUVS" variant="secondary" onPress={() => void Linking.openURL(source.euvs_url!)} style={[styles.action, { backgroundColor: ds.c.raised }]} /> : null}
              {source.archive_url ? (
                <Button label="Cleaner copy: Internet Archive" variant="secondary" onPress={() => void Linking.openURL(source.archive_url!)} style={[styles.action, { backgroundColor: ds.c.raised }]} />
              ) : null}
              {source.url ? <Button label="Read the source" variant="secondary" onPress={() => void Linking.openURL(source.url!)} style={[styles.action, { backgroundColor: ds.c.raised }]} /> : null}
            </View>
            {source.rights === 'facts_only' ? (
              <Caption tone="muted">This book is still in copyright, so we show its ingredients, never its words.</Caption>
            ) : null}
            <View role="list" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
              <Headline role="heading">{drinks.length ? `Drinks in this book · ${drinks.length} here` : 'Drinks in this book'}</Headline>
              {drinks.map((d) => {
                const score = d.item ? scores?.[d.item.id] : undefined;
                const versions = d.item ? (sources?.[d.item.id]?.versions ?? 0) : 0;
                const caption = [
                  RELATION_LABEL[d.relation],
                  d.item && d.printed_name !== d.item.name ? `the ${d.item.name}` : null,
                  versions ? `${versions} bar ${versions === 1 ? 'version' : 'versions'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <PressableScale
                    key={d.id}
                    role="link"
                    disabled={!d.item}
                    accessibilityLabel={[d.printed_name ?? d.item?.name ?? '', caption, d.page_label ? `page ${d.page_label}` : null, scoreWords(score), d.item ? `Open the ${d.item.name}` : null].filter(Boolean).join('. ')}
                    onPress={() => d.item && router.push(`/cocktail/${d.item.id}` as Href)}
                    style={[styles.row, { borderTopColor: ds.c.line }]}
                  >
                    <View style={styles.flex}>
                      <Body>{d.printed_name ?? d.item?.name}</Body>
                      <Caption tone="muted">{caption}</Caption>
                    </View>
                    {d.page_label ? <Caption tone="muted" style={styles.mono}>{`p. ${d.page_label}`}</Caption> : null}
                    <View style={styles.score}>
                      <RowScore score={score} />
                    </View>
                  </PressableScale>
                );
              })}
            </View>
            {source.rights === 'public_domain' ? (
              <Caption tone="muted">Recipes are transcribed by us from the public-domain text and linked to the page they come from.</Caption>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <View style={[styles.back, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.lg },
  header: { gap: space.sm },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  cover: { width: 84, height: 112, padding: space.sm, gap: space.xs, justifyContent: 'space-between', borderRadius: radius.mark, borderWidth: StyleSheet.hairlineWidth },
  coverTitle: { fontFamily: fontFamilies.instrument, fontSize: type.body.fontSize - 2, lineHeight: type.body.lineHeight - 4 },
  card: { paddingHorizontal: space.lg, paddingVertical: space.md + 2, gap: space.xs, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  action: { alignSelf: 'flex-start', borderWidth: 0 },
  score: { minWidth: space.xxl, alignItems: 'flex-end' },
  mono: { fontFamily: fontFamilies.mono },
  actions: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, paddingVertical: space.sm, borderTopWidth: 1 },
  flex: { flex: 1, minWidth: 0 },
  back: { position: 'absolute' },
});
