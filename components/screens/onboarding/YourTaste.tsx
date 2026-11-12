import { getLocales } from 'expo-localization';
import type { Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, DrinkDrawingFor, Head, Headline, PressableScale, useDs, useGutter } from '@/components/ds';
import { TonightSky } from '@/components/screens/tonight/TonightParts';
import { BarMark } from '@/components/screens/home/BarMark';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, space } from '@/constants/tokens';
import { useBestNear } from '@/hooks/useDiscoverHome';
import { useSaveTasteAnswers } from '@/hooks/useFlavor';
import type { FirstRunDrink } from '@/hooks/useFirstRunDrinks';
import { STYLES } from '@/lib/drinkStyles';
import { tasteFrom, tasteLine } from '@/lib/firstRun';
import { formatDistance, nearMeArea, usesMiles } from '@/lib/nearMe';
import { useLastPlace } from '@/store/useLastPlace';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Bars the board lists under the line. */
const BARS = 3;

/**
 * Your taste (canvas Prod-first 5): the drink you liked most under its sky,
 * "You like it bitter and stirred.", the bars near you that do that well
 * (Discover's Best near you for its style, near where this device was last
 * found, else anywhere: first run never asks for location), and Start. Start
 * saves the taste (user_prefs.taste_answers, what the old questions saved)
 * and, with no unit picked yet, takes oz where the phone's region measures in
 * miles and ml elsewhere (units are asked later, when they matter).
 */
type Props = {
  picks: readonly FirstRunDrink[];
  winners: readonly string[];
  /** Home bartenders get a unit from their region; bartenders follow their bar's. */
  home: boolean;
  /** Setup is finishing, and what went wrong if it didn't. */
  pending: boolean;
  error?: string;
  onDone: (to?: Href) => void;
};

export function YourTasteStep(props: Props) {
  return (
    <BackbarTheme>
      <Page {...props} />
    </BackbarTheme>
  );
}

function Page({ picks, winners, home, pending, error, onDone }: Props) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const save = useSaveTasteAnswers();
  const taste = useMemo(() => tasteFrom(picks, winners), [picks, winners]);
  // The drinks liked more, most-chosen first: the hero is the favourite, the sky their colours.
  const liked = useMemo(() => {
    const count = (id: string) => winners.filter((w) => w === id).length;
    return picks.filter((p) => count(p.id)).sort((a, b) => count(b.id) - count(a.id));
  }, [picks, winners]);
  const top = liked[0] ?? picks[0];
  const line = tasteLine(taste, winners.map((id) => picks.find((p) => p.id === id)?.method ?? null)) ?? 'Your taste is set.';
  const last = useLastPlace((s) => s.place);
  const area = useMemo(() => (last ? nearMeArea(last) : { kind: 'anywhere' as const }), [last]);
  const style = STYLES.find((s) => top && s.classics.includes(top.name))?.id ?? 'martini';
  const best = useBestNear(area, style, !!top);
  const miles = usesMiles(getLocales()[0]);
  const bars = (
    best.rows.length
      ? best.rows.map((r) => ({ id: r.barId, handle: r.barHandle, name: r.barName, drink: r.name, away: r.distanceKm !== null ? formatDistance(r.distanceKm, miles) : null }))
      : best.onMenus.map((r) => ({ id: r.barId, handle: r.barHandle, name: r.barName, drink: r.name, away: r.distanceM !== null ? formatDistance(r.distanceM / 1000, miles) : r.place }))
  ).slice(0, BARS);

  const units = useSettingsStore((s) => s.units);
  const setUnits = useSettingsStore((s) => s.setUnits);
  // One tap ends setup: Start and a bar row can't both run it, nor one twice.
  const [started, setStarted] = useState(false);
  const busy = save.isPending || pending || (started && !error);
  const start = (to?: Href) => {
    if (busy) return;
    setStarted(true);
    if (home && !units) setUnits(miles ? 'oz' : 'ml');
    // A taste that won't save is no reason to hold them here: You's taste page asks again.
    if (Object.keys(taste).length) save.mutate(taste, { onSettled: () => onDone(to) });
    else onDone(to);
  };

  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <TonightSky ids={liked.slice(0, 3).map((d) => d.id)} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter }}>
        <View style={styles.column}>
          <View style={styles.hero}>{top ? <DrinkDrawingFor itemId={top.id} size="tile" /> : null}</View>
          <View style={styles.head}>
            <Head align="center" aria-level={1}>
              {line}
            </Head>
            <Body tone="muted" align="center" style={styles.sub}>
              {bars.length
                ? `Here ${bars.length === 1 ? 'is a bar' : bars.length === 2 ? 'are two bars' : 'are three bars'}${last ? ' near you' : ''} that do${bars.length === 1 ? 'es' : ''} that well. Rank a drink there and this gets sharper.`
                : 'Rank a drink at a bar and this gets sharper.'}
            </Body>
          </View>
          {bars.length ? (
            <View>
              {bars.map((b) => (
                <PressableScale
                  key={b.id}
                  role="link"
                  accessibilityLabel={`${b.name}. ${[b.drink, b.away].filter(Boolean).join(', ')}`}
                  disabled={busy}
                  onPress={() => start(`/p/${b.handle}` as Href)}
                  style={[styles.row, { borderBottomColor: ds.c.line }]}
                >
                  <BarMark name={b.name} profileId={b.id} size={40} />
                  <View style={styles.flex}>
                    <Headline numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
                      {b.name}
                    </Headline>
                    <Caption tone="muted" numberOfLines={1}>
                      {[b.drink, b.away].filter(Boolean).join(' · ')}
                    </Caption>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
                </PressableScale>
              ))}
            </View>
          ) : null}
          <Button label={busy ? 'Saving…' : 'Start'} variant="ink" size="lg" disabled={busy} onPress={() => start()} />
          {error ? (
            <Caption tone="accent" align="center">
              {error}
            </Caption>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: space.lg },
  // The board's hero: 220 tall, the drawing 30 from its top, in the middle.
  hero: { height: 220, paddingTop: 30, alignItems: 'center' },
  head: { gap: space.md, alignItems: 'center', paddingBottom: space.md },
  sub: { maxWidth: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2, paddingVertical: space.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
});
