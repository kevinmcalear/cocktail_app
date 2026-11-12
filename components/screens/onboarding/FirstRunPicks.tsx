import type { Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, DrinkDrawingFor, DsText, GlassButton, PressableScale, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space } from '@/constants/tokens';
import { useFirstRunDrinks, type FirstRunDrink } from '@/hooks/useFirstRunDrinks';
import { withAlpha } from '@/lib/color';
import { flavourWords, methodWord, pairsFor, PICKS } from '@/lib/firstRun';

import { COPY } from './onboardingCopy';
import { YourTasteStep } from './YourTaste';

/** The board's tile drawing, 86 tall, from the 160 tile drawing. */
const TILE_ART = 86;

/**
 * First run's taste, in place of the old questions (canvas Prod-first 3 to 5,
 * decided 31 Oct): Which have you had? (pick five), Which do you like more?
 * (three pairs from the five), then Your taste. Back steps through them, and
 * from the first leaves for the step before. The five and their pairs are
 * fixed at Next, so nothing that loads later moves a pair under them.
 */
export function FirstRunTaste({
  home,
  onBack,
  onDone,
  pending,
  error: finishError,
}: {
  home: boolean;
  onBack?: () => void;
  onDone: (to?: Href) => void;
  pending: boolean;
  error?: string;
}) {
  const { drinks, ready, isLoading, error, refetch } = useFirstRunDrinks();
  const [picked, setPicked] = useState<string[]>([]);
  const [winners, setWinners] = useState<string[]>([]);
  const [chosen, setChosen] = useState<{ picks: FirstRunDrink[]; pairs: [string, string][] } | null>(null);
  const [stage, setStage] = useState<'five' | 'pairs' | 'taste'>('five');
  const byId = useMemo(() => new Map((chosen?.picks ?? []).map((d) => [d.id, d])), [chosen]);

  if (stage === 'taste' && chosen)
    return (
      <YourTasteStep
        picks={chosen.picks}
        winners={winners}
        home={home}
        pending={pending}
        error={finishError}
        onBack={() => (setWinners((w) => w.slice(0, -1)), setStage('pairs'))}
        onDone={onDone}
      />
    );
  if (stage === 'pairs' && chosen) {
    const at = winners.length;
    const [a, b] = chosen.pairs[at] ?? [];
    const back = () => (at ? setWinners((w) => w.slice(0, -1)) : setStage('five'));
    const choose = (id: string) => {
      setWinners((w) => [...w, id]);
      if (at + 1 >= chosen.pairs.length) setStage('taste');
    };
    const left = a ? byId.get(a) : undefined;
    const right = b ? byId.get(b) : undefined;
    return (
      <FirstRunPage onBack={back} title="Which do you like more?" sub="Three of these and your taste is set.">
        {left && right ? (
          <View style={styles.pair}>
            <PairCard drink={left} onPress={() => choose(left.id)} />
            <PairCard drink={right} onPress={() => choose(right.id)} />
            <OrDisc />
          </View>
        ) : null}
      </FirstRunPage>
    );
  }
  const full = picked.length >= PICKS && ready;
  const next = () => {
    if (!full) return;
    const picks = drinks.filter((d) => picked.includes(d.id));
    setChosen({ picks, pairs: pairsFor(picks) });
    setWinners([]);
    setStage('pairs');
  };
  // Not enough of the nine to pick from (offline, or the catalog lacks them): setup still ends.
  const stuck = !!error || (!isLoading && drinks.length < PICKS);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= PICKS ? p : [...p, id]));
  return (
    <FirstRunPage
      onBack={onBack}
      onNext={full ? next : undefined}
      title={COPY.taste.title}
      sub={COPY.taste.intro ?? ''}
    >
      {error ? <Button label="Try again" variant="secondary" onPress={() => void refetch()} /> : null}
      {isLoading ? <Caption tone="muted">One moment…</Caption> : null}
      <View style={styles.grid}>
        {drinks.map((d) => (
          <PickTile key={d.id} drink={d} on={picked.includes(d.id)} onPress={() => toggle(d.id)} />
        ))}
      </View>
      <Button label={full ? 'Next' : `${picked.length} of ${PICKS}`} variant={full ? 'ink' : 'secondary'} size="lg" disabled={!full} onPress={next} />
      {stuck ? <Button label={pending ? 'Saving…' : 'Not now'} variant="ghost" disabled={pending} onPress={() => onDone()} /> : null}
      {stuck && finishError ? <Caption tone="accent">{finishError}</Caption> : null}
    </FirstRunPage>
  );
}

/** The board's page for these steps: a glass Back, the round Next when there is one, the title and its line, left. */
function FirstRunPage({ onBack, onNext, title, sub, children }: { onBack?: () => void; onNext?: () => void; title: string; sub: string; children: ReactNode }) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  return (
    <BackbarTheme>
      <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xxl, paddingHorizontal: gutter }}>
          <View style={styles.column}>
            <View style={styles.top}>
              {onBack ? <GlassButton accessibilityLabel="Back" icon="chevron.left" onPress={onBack} /> : <View />}
              {onNext ? (
                <PressableScale role="button" accessibilityLabel="Next" onPress={onNext} style={[styles.next, { backgroundColor: ds.accentFill.fill }]}>
                  <IconSymbol name="checkmark" size={20} color={ds.accentFill.text} />
                </PressableScale>
              ) : null}
            </View>
            <View style={styles.head}>
              <Title role="heading">{title}</Title>
              <Body tone="muted">{sub}</Body>
            </View>
            {children}
          </View>
        </ScrollView>
      </View>
    </BackbarTheme>
  );
}

/** One of the nine: its drawing and name; picked, on its own colour, ringed, with a check. */
function PickTile({ drink, on, onPress }: { drink: FirstRunDrink; on: boolean; onPress: () => void }) {
  const ds = useDs();
  const bg = on && drink.tint ? withAlpha(drink.tint, ds.scheme === 'dark' ? 0.28 : 0.2) : ds.c.surface;
  return (
    <PressableScale
      role="checkbox"
      aria-checked={on}
      accessibilityLabel={drink.name}
      onPress={onPress}
      style={[styles.tile, { backgroundColor: bg, borderColor: on ? ds.accentText : ds.c.line, borderWidth: on ? 2 : StyleSheet.hairlineWidth }]}
    >
      <View style={styles.tileArt}>
        <View style={{ transform: [{ scale: TILE_ART / 160 }] }}>
          <DrinkDrawingFor itemId={drink.id} size="tile" pour={false} />
        </View>
      </View>
      <DsText variant="label" align="center" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        {drink.name}
      </DsText>
      {on ? (
        <View style={[styles.check, { backgroundColor: ds.accentFill.fill }]}>
          <IconSymbol name="checkmark" size={14} color={ds.accentFill.text} />
        </View>
      ) : null}
    </PressableScale>
  );
}

/** A tall card for one of the pair: the drawing on its colour, then Stirred, the name and its two flavours. */
function PairCard({ drink, onPress }: { drink: FirstRunDrink; onPress: () => void }) {
  const ds = useDs();
  const how = methodWord(drink.method);
  const words = flavourWords(drink.profile);
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`${drink.name}${words ? `. ${words}` : ''}`}
      onPress={onPress}
      style={[styles.card, { borderColor: ds.c.line, backgroundColor: drink.tint ? withAlpha(drink.tint, ds.scheme === 'dark' ? 0.28 : 0.2) : ds.c.surface }]}
    >
      <View style={styles.cardArt}>
        <DrinkDrawingFor itemId={drink.id} size="tile" pour={false} />
      </View>
      <View style={styles.cardText}>
        {how ? (
          <Caption tone="muted" style={styles.caps}>
            {how}
          </Caption>
        ) : null}
        <DsText variant="headline" numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {drink.name}
        </DsText>
        {words ? <Caption tone="muted">{words}</Caption> : null}
      </View>
    </PressableScale>
  );
}

/** "or", on the seam between the two cards. */
function OrDisc() {
  const ds = useDs();
  return (
    <View pointerEvents="none" style={[styles.or, { backgroundColor: ds.c.ground, borderColor: ds.c.line }]}>
      <DsText variant="headline" italic tone="muted" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        or
      </DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: space.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: layout.minTapTarget },
  next: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  head: { gap: space.md, paddingTop: space.xl, paddingBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm + 2 },
  tile: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: space.xs + 2, paddingTop: space.sm, paddingBottom: space.sm + 2, paddingHorizontal: space.xs, borderRadius: radius.card },
  tileArt: { width: '100%', height: TILE_ART, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  check: { position: 'absolute', right: space.sm, top: space.sm, width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pair: { flexDirection: 'row', gap: space.sm + 2 },
  card: { flex: 1, height: 330, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', justifyContent: 'flex-end' },
  cardArt: { position: 'absolute', left: '6%', top: '4%', width: '88%', height: '62%', alignItems: 'center', justifyContent: 'center' },
  cardText: { gap: space.xs, paddingHorizontal: space.md + 2, paddingBottom: space.lg },
  caps: { textTransform: 'uppercase', letterSpacing: 1.1 },
  or: { position: 'absolute', left: '50%', top: '42%', width: 40, height: 40, marginLeft: -20, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
