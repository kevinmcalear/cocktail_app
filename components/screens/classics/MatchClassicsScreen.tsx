import { useRouter } from 'expo-router';
import { FlatList, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Headline, Tag, Title, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useClassicSuggestions, useLinkClassic, type ClassicSuggestion } from '@/hooks/useClassics';

/** Editors link a venue's drinks to catalog classics in one pass, so they appear in "best Martini" lists. */
export function MatchClassicsScreen() {
  return (
    <BackbarTheme>
      <MatchClassicsPage />
    </BackbarTheme>
  );
}

function SuggestionRow({ s, onLink, busy }: { s: ClassicSuggestion; onLink: () => void; busy: boolean }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{s.drink.name}</Headline>
        <View style={styles.match}>
          <Caption tone="muted">{`Version of the ${s.match.classic.name}`}</Caption>
          <Tag label={s.match.exact ? 'Same name' : 'Guess'} tone={s.match.exact ? 'success' : 'default'} />
        </View>
      </View>
      <Button label="Link" variant="secondary" disabled={busy} onPress={onLink} />
    </View>
  );
}

function MatchClassicsPage() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { active } = useActiveVenue();
  const editor = (active?.roleLevel ?? 0) > 30;
  const { suggestions, unmatched, isLoading, error } = useClassicSuggestions(editor ? active?.id : null);
  const link = useLinkClassic();
  const exact = suggestions.filter((s) => s.match.exact);
  const linkAll = () => link.mutate(exact.map((s) => ({ itemId: s.drink.id, classicId: s.match.classic.id })), { onError: () => {} });

  let note: string | null = null;
  if (!active) note = 'Choose a venue first.';
  else if (!editor) note = `Only editors at ${active.name} can link drinks to classics.`;
  else if (error) note = `Couldn't load your drinks: ${error.message}`;
  else if (!isLoading && !suggestions.length) note = 'Every drink that looks like a classic is linked.';

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={note ? [] : suggestions}
        keyExtractor={(s) => s.drink.id}
        contentContainerStyle={[styles.page, { paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Caption tone="muted">{active?.name ?? 'Your venue'}</Caption>
            <Title>Match to classics</Title>
            <Body tone="muted">
              {"Link each drink to the classic it's a version of, so it shows up when guests look for the best Martini or Negroni. Only the link changes; your spec stays yours."}
            </Body>
            {note ? <Body>{note}</Body> : null}
            {!note && exact.length > 1 ? (
              <Button label={`Link all ${exact.length} same-name matches`} disabled={link.isPending} onPress={linkAll} />
            ) : null}
            {link.error ? <Caption tone="accent">{`Couldn't save: ${link.error.message}`}</Caption> : null}
          </View>
        }
        renderItem={({ item: s }) => (
          <SuggestionRow
            s={s}
            busy={link.isPending}
            onLink={() => link.mutate([{ itemId: s.drink.id, classicId: s.match.classic.id }], { onError: () => {} })}
          />
        )}
        ListFooterComponent={
          editor && unmatched > 0 && !isLoading ? (
            <Caption tone="muted" style={styles.footer}>
              {`${unmatched} other ${unmatched === 1 ? "drink doesn't" : "drinks don't"} look like a catalog classic. Open one and use Version of to choose.`}
            </Caption>
          ) : undefined
        }
      />
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
  page: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { gap: space.sm, paddingBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  match: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  footer: { paddingTop: space.lg },
  back: { position: 'absolute' },
});
