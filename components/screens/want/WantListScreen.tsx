import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Display, GlassButton, Switch, useDs, useGutter } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { SignInCard } from '@/components/screens/published/SignInCard';
import { BlockLabel, CardGroup } from '@/components/screens/rankings/ScoreRows';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useCollection, type CollectedDrink } from '@/hooks/useCollection';
import { useOnNearYou, useSetWantAlerts, useWantAlerts, useWantMatches } from '@/hooks/useWant';
import { splitNear, wantCount, wantRowLine, type NearBar } from '@/lib/want';

/** The column a phone shows, centred on wider screens. */
const COLUMN = 600;
const ALERTS = 'Tell me when one’s on near you';

/**
 * Want (Loop-want, Next-phone "wantlist"): the drinks on your Want list,
 * those on a menu near you now first (where, and your match), then the rest;
 * the switch for hearing when one comes on near you; and more to swipe.
 */
export function WantListScreen() {
  return (
    <BackbarTheme>
      <WantPage />
    </BackbarTheme>
  );
}

function WantPage() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const signedIn = useSignedIn();
  const { data, isLoading, error } = useCollection();
  const drinks = data?.drinks ?? [];
  const ids = drinks.flatMap((d) => (d.itemId ? [d.itemId] : []));
  const { matchFor } = useWantMatches(ids);
  const near = useOnNearYou(drinks.flatMap((d) => (d.itemId ? [{ itemId: d.itemId, name: d.name }] : [])));
  const { on, notYet } = splitNear(drinks, near.byItem);
  const alerts = useWantAlerts();
  const setAlerts = useSetWantAlerts();

  const row = (d: CollectedDrink, bar: NearBar | undefined) => {
    const caption = wantRowLine(bar, d.itemId ? matchFor(d.itemId) : null);
    return (
      <DrinkRow
        key={d.id}
        name={d.name}
        itemId={d.itemId}
        imageUrl={d.imageUrl}
        glass={null}
        displayName
        href={d.itemId ? `/cocktail/${d.itemId}` : undefined}
        caption={caption || undefined}
        trailing={<IconSymbol name="chevron.right" size={14} color={ds.c.faint} />}
      />
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.lg, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.column}>
          <View>
            {signedIn && data ? (
              <Caption tone="muted" style={styles.eyebrow}>
                {wantCount(drinks.length)}
              </Caption>
            ) : null}
            <Display>Want</Display>
          </View>
          {!signedIn ? (
            <SignInCard title="Your Want list" text="Sign in to keep the drinks you want to try, and hear when one is on near you." replace />
          ) : error ? (
            <Body tone="muted">Couldn’t load your Want list. Try again in a moment.</Body>
          ) : isLoading ? (
            <ActivityIndicator style={styles.loading} color={ds.c.muted} accessibilityLabel="Loading your Want list" />
          ) : (
            <>
              {!drinks.length ? <Body tone="muted">Nothing on your Want list yet. Swipe through a few drinks to start it.</Body> : null}
              {on.length ? (
                <View>
                  <BlockLabel>On near you</BlockLabel>
                  <View role="list">{on.map((d) => row(d, near.byItem[d.itemId!]?.[0]))}</View>
                </View>
              ) : null}
              {notYet.length ? (
                <View>
                  {near.known ? <BlockLabel>Not on near you yet</BlockLabel> : null}
                  <View role="list">{notYet.map((d) => row(d, undefined))}</View>
                  {near.known ? null : (
                    <Caption tone="muted" style={styles.hint}>
                      Use Near me in Discover once to see which of these are on near you.
                    </Caption>
                  )}
                </View>
              ) : null}
              <CardGroup>
                <View style={styles.switchRow}>
                  <IconSymbol name="bell" size={18} color={ds.c.muted} />
                  <Body style={styles.flex}>{ALERTS}</Body>
                  <Switch label={ALERTS} value={!!alerts.data} disabled={!alerts.isSuccess} onValueChange={(v) => setAlerts.mutate(v)} />
                </View>
              </CardGroup>
              <Button label="Swipe some more" variant="secondary" onPress={() => router.push('/want/swipe')} />
            </>
          )}
        </View>
      </ScrollView>
      <View style={[styles.top, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  column: { width: '100%', maxWidth: COLUMN, alignSelf: 'center', gap: space.lg },
  eyebrow: { textTransform: 'uppercase', letterSpacing: 1.2 },
  loading: { marginTop: space.xxxl },
  hint: { marginTop: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  flex: { flex: 1, minWidth: 0 },
  top: { position: 'absolute' },
});
