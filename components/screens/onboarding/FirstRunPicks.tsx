import type { Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, DrinkDrawingFor, DsText, GlassButton, Head, PressableScale, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space } from '@/constants/tokens';
import { useFirstRunDrinks, type FirstRunDrink } from '@/hooks/useFirstRunDrinks';
import { withAlpha } from '@/lib/color';
import { useSaveSwipes, useWantDeck } from '@/hooks/useWantDeck';
import { flavourWords, methodWord, pairsFor, PICKS, SWIPES, tasteFrom } from '@/lib/firstRun';

import { COPY } from './onboardingCopy';
import { SwipeCard } from './TenSwipes';
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
  const [stage, setStage] = useState<'five' | 'pairs' | 'swipes' | 'taste'>('five');
  const byId = useMemo(() => new Map((chosen?.picks ?? []).map((d) => [d.id, d])), [chosen]);
  // The ten swipes: drinks they haven't picked, each answered Want (true) or Not for me.
  const pickedIds = useMemo(() => (chosen?.picks ?? []).map((d) => d.id), [chosen]);
  const deck = useWantDeck(SWIPES, pickedIds, !!chosen);
  const [answers, setAnswers] = useState<{ id: string; want: boolean }[]>([]);
  const saveSwipes = useSaveSwipes();
  const wanted = useMemo(() => answers.filter((a) => a.want).map((a) => deck.drinks.find((d) => d.id === a.id)?.profile ?? null), [answers, deck.drinks]);
  const noDeck = !!deck.error || (deck.ready && !deck.drinks.length);

  if ((stage === 'taste' || (stage === 'swipes' && noDeck)) && chosen)
    return (
      <YourTasteStep
        picks={chosen.picks}
        winners={winners}
        wanted={wanted}
        home={home}
        pending={pending}
        error={finishError}
        onDone={onDone}
      />
    );
  if (stage === 'pairs' && chosen) {
    const at = winners.length;
    const [a, b] = chosen.pairs[at] ?? [];
    const back = () => (at ? setWinners((w) => w.slice(0, -1)) : setStage('five'));
    const choose = (id: string) => {
      setWinners((w) => [...w, id]);
      if (at + 1 < chosen.pairs.length) return;
      setAnswers([]);
      setStage('swipes');
    };
    const left = a ? byId.get(a) : undefined;
    const right = b ? byId.get(b) : undefined;
    return (
      <FirstRunPage onBack={back} title="Which do you like more?" sub="Three of these and your taste is set." size="title">
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
  if (stage === 'swipes' && chosen) {
    const at = answers.length;
    const card = deck.drinks[at];
    const back = () => (at ? setAnswers((a) => a.slice(0, -1)) : (setWinners((w) => w.slice(0, -1)), setStage('pairs')));
    const answer = (want: boolean) => {
      if (!card) return;
      const next = [...answers, { id: card.id, want }];
      setAnswers(next);
      if (next.length < deck.drinks.length) return;
      // Kept as they go on to Your taste: a miss here costs the deck, not their taste.
      saveSwipes.mutate({ wants: next.filter((a) => a.want).map((a) => a.id), passes: next.filter((a) => !a.want).map((a) => a.id) });
      setStage('taste');
    };
    return (
      <FirstRunPage onBack={back} barTitle={`${Math.min(at + 1, deck.drinks.length)} of ${deck.drinks.length || SWIPES}`}>
        {card ? <SwipeCard key={card.id} drink={card} taste={tasteFrom(chosen.picks, winners, wanted)} onAnswer={answer} /> : <Caption tone="muted">One moment…</Caption>}
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
      onNext={next}
      nextReady={full}
      size="head"
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

/**
 * The board's page for these steps: a glass Back, the round Next when there is
 * one (drawn filled even before it can go, as the board draws it), the title
 * and its line, left. The board's 38 and 36 titles take the nearest type
 * steps: head (40) and title (34).
 */
function FirstRunPage({
  onBack,
  onNext,
  nextReady,
  size = 'title',
  barTitle,
  title,
  sub,
  children,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextReady?: boolean;
  size?: 'head' | 'title';
  /** The top bar's own title ("3 of 10"), for a page with no big title. */
  barTitle?: string;
  title?: string;
  sub?: string;
  children: ReactNode;
}) {
  const Heading = size === 'head' ? Head : Title;
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
              {barTitle ? (
                <DsText variant="headline" role="heading" align="center" pointerEvents="none" style={styles.barTitle}>
                  {barTitle}
                </DsText>
              ) : null}
              {onNext ? (
                <PressableScale role="button" accessibilityLabel="Next" aria-disabled={!nextReady} onPress={onNext} style={[styles.next, { backgroundColor: ds.accentFill.fill }]}>
                  <IconSymbol name="checkmark" size={20} color={ds.accentFill.text} />
                </PressableScale>
              ) : null}
            </View>
            {title ? (
              <View style={styles.head}>
                <Heading>{title}</Heading>
                {sub ? <Body tone="muted">{sub}</Body> : null}
              </View>
            ) : null}
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
      accessibilityLabel={drink.label}
      onPress={onPress}
      style={[styles.tile, { backgroundColor: bg, borderColor: on ? ds.accentText : ds.c.line, borderWidth: on ? 2 : StyleSheet.hairlineWidth }]}
    >
      <View style={styles.tileArt}>
        <View style={{ transform: [{ scale: TILE_ART / 160 }] }}>
          <DrinkDrawingFor itemId={drink.id} size="tile" pour={false} />
        </View>
      </View>
      <DsText variant="label" align="center" numberOfLines={1} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
        {drink.label}
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
      accessibilityLabel={`${drink.label}${words ? `. ${words}` : ''}`}
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
          {drink.label}
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
  barTitle: { position: 'absolute', left: 0, right: 0 },
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
