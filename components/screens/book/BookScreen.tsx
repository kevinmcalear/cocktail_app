import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Headline, PressableScale, Tag, Title, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useBook } from '@/hooks/useDrinkHistory';
import { RELATION_LABEL, RIGHTS_LABEL, sourceByline } from '@/lib/drinkHistory';

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
  const { key } = useLocalSearchParams<{ key: string }>();
  const { data, isLoading, error } = useBook(key);
  const source = data?.source;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter },
        ]}
      >
        {error ? <Body>{`Couldn't load this book: ${error.message}`}</Body> : null}
        {!isLoading && !error && !source ? <Body>{"This book isn't here."}</Body> : null}
        {source ? (
          <>
            <View style={styles.header}>
              <Caption tone="muted" style={styles.eyebrow}>
                {[source.kind === 'book' ? 'Book' : source.kind === 'bar' ? 'Bar' : 'Source', source.year, source.city].filter(Boolean).join(' · ').toUpperCase()}
              </Caption>
              <Title>{source.title}</Title>
              {sourceByline(source) ? <Body tone="muted">{sourceByline(source)}</Body> : null}
              <View style={styles.tags}>
                <Tag label={RIGHTS_LABEL[source.rights]} />
              </View>
            </View>
            <View style={styles.actions}>
              {source.euvs_url ? <Button label="Read it in the EUVS library" icon="book" onPress={() => void Linking.openURL(source.euvs_url!)} /> : null}
              {source.archive_url ? (
                <Button label="Read a clean public-domain copy" variant="secondary" onPress={() => void Linking.openURL(source.archive_url!)} />
              ) : null}
              {source.url ? <Button label="Read the source" variant="secondary" onPress={() => void Linking.openURL(source.url!)} /> : null}
            </View>
            {source.rights === 'facts_only' ? (
              <Caption tone="muted">This book is still in copyright, so we show its ingredients, never its words.</Caption>
            ) : null}
            <Headline role="heading">Drinks in this book</Headline>
            <View role="list">
              {(data?.drinks ?? []).map((d) => (
                <PressableScale
                  key={d.id}
                  role="link"
                  disabled={!d.item}
                  accessibilityLabel={`${d.printed_name ?? d.item?.name ?? ''}. ${RELATION_LABEL[d.relation]}${d.item ? `. Open the ${d.item.name}` : ''}`}
                  onPress={() => d.item && router.push(`/cocktail/${d.item.id}` as Href)}
                  style={[styles.row, { borderTopColor: ds.c.line }]}
                >
                  <View style={styles.flex}>
                    <Body>{d.printed_name ?? d.item?.name}</Body>
                    <Caption tone="muted">
                      {[RELATION_LABEL[d.relation], d.item && d.printed_name !== d.item.name ? `the ${d.item.name}` : null, d.page_label ? `page ${d.page_label}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Caption>
                  </View>
                </PressableScale>
              ))}
            </View>
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
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: space.lg },
  header: { gap: space.sm },
  eyebrow: { letterSpacing: 1.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  actions: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, paddingVertical: space.sm, borderTopWidth: 1 },
  flex: { flex: 1, minWidth: 0 },
  back: { position: 'absolute' },
});
