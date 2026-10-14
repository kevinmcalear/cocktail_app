import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider, Button, Caption, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useToolsFor } from '@/hooks/useBarKit';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useLearnYield, type PrepCardData } from '@/hooks/usePrepCard';
import { allergenLabel } from '@/lib/allergens';
import { initials, stepParts, timerFromText, useByDate } from '@/lib/makeSteps';
import { siteOrigin } from '@/lib/venueLink';
import { toQuantity } from '@/lib/quantity';
import { factorForLine, scaledYield, scaleRecipe, type RecipeLine } from '@/lib/scale';

import { copyForTape, MakeDone, shareLabel, type BatchLabel } from './MakeDone';
import { BATCHES, FILLS, MakeHowMuch, type MakeMode } from './MakeHowMuch';
import { makeKit, missingKit, splitHint } from './makeLogic';
import { MakeGather, MakeStep } from './MakeSteps';
import { useMakeSpot } from './useMakeSpot';

interface MakeScreenProps {
  itemId: string;
  name: string;
  /** The recipe's lines; `ingredientId` draws each line's picture. */
  recipe: (RecipeLine & { ingredientId?: string | null })[];
  card: PrepCardData;
  accent?: string;
  /** The size picked on the page, as a factor of one batch. */
  startFactor: number;
  /** Open on "What I have" (the page's chip). */
  startMode?: 'have';
  /** The viewer can change the prep card, so a real yield is saved. */
  canLearn: boolean;
  /** Whose kit the tools are checked against: a venue (its id and name), or null for your own at home. */
  kitVenue: { id: string; name: string } | null;
}

/**
 * Making a prep, a screen at a time, in the light prep theme: how much, get it
 * all out, each step with its amounts and timer, then the label. The screen
 * stays awake throughout.
 */
export function MakeScreen(props: MakeScreenProps) {
  return (
    <BackbarTheme scheme="light">
      <BrandProvider accent={props.accent}>
        <Make {...props} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function Make({ itemId, name, recipe, card, startFactor, startMode, canLearn, kitVenue }: MakeScreenProps) {
  useKeepAwake();
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const prep = card.prep;
  const yieldQ = toQuantity(prep?.yield_amount, prep?.yield_unit);
  const canFill = yieldQ?.kind === 'ml';
  // The four tiles, plus a bigger whole-batch size the page asked for (4, 6).
  const batchOptions: number[] = BATCHES.includes(startFactor as (typeof BATCHES)[number]) || !Number.isInteger(startFactor) ? [...BATCHES] : [...BATCHES, startFactor];
  const startBatches = batchOptions.includes(startFactor) ? startFactor : 1;
  const [mode, setMode] = useState<MakeMode>(startMode ?? (canFill && !Number.isInteger(startFactor * 2) ? 'fill' : 'batches'));
  const [batches, setBatches] = useState(startBatches);
  const [fill, setFill] = useState(canFill && yieldQ ? nearestFill(startFactor * yieldQ.value) : 750);
  const [haveLine, setHaveLine] = useState(recipe[0]?.id ?? '');
  const [have, setHave] = useState('');
  // -2 how much, -1 gather, 0..n-1 the steps, n done.
  const [at, setAt] = useState(-2);
  const [got, setGot] = useState<string[]>([]);
  const [made, setMade] = useState<string | null>(null);
  const [madeAt] = useState(() => new Date());
  const [copied, setCopied] = useState(false);
  const spot = useMakeSpot(itemId);
  const learn = useLearnYield(itemId);
  const tools = useToolsFor(kitVenue?.id ?? null, kitVenue?.name ?? null);
  const me = useMyProfile().data;
  const allergens = useDrinkAllergens(itemId).data;

  const line = recipe.find((l) => l.id === haveLine) ?? null;
  // "What I have" opens on the line's own amount: one batch.
  const haveValue = have || (line?.amount != null ? String(line.amount) : '');
  const factor =
    mode === 'batches'
      ? batches
      : mode === 'fill' && yieldQ
        ? fill / yieldQ.value
        : line
          ? factorForLine(line, toQuantity(haveValue, line.unit))
          : null;
  const f = factor ?? 1;
  const scaled = scaleRecipe(recipe, f);
  const makes = scaledYield(prep?.yield_amount ?? null, prep?.yield_unit ?? null, f);
  const steps = card.steps;
  const n = steps.length;
  const named = scaled.map((l) => ({ name: l.name, amount: l.scaled }));
  const expected = yieldQ ? yieldQ.value * f : null;
  const madeValue = made ?? (expected !== null ? String(Math.round(expected)) : null);

  const label: BatchLabel = {
    name,
    made: madeAt,
    useBy: useByDate(madeAt, prep?.shelf_life_hours ?? null),
    by: initials(me?.displayName),
    amount: makes,
    storage: prep?.storage ?? null,
    allergens: allergens ? (allergens.allergens.length ? allergens.allergens.map((a) => allergenLabel(a.allergen)).join(', ') : 'No allergens') : '',
    url: `${siteOrigin()}/ingredient/${itemId}`,
  };
  const container = mode === 'fill' ? (FILLS.find((x) => x.ml === fill)?.container ?? null) : null;

  const close = () => {
    // A batch that came out different teaches the recipe its real yield.
    const real = Number(madeValue);
    if (at === n && canLearn && yieldQ && expected && real > 0 && Math.abs(real - expected) / expected > 0.02) {
      learn.mutate({ amount: Math.round((real / f) * 10) / 10, unit: yieldQ.unit });
    }
    if (router.canGoBack()) router.back();
    else router.replace(`/ingredient/${itemId}`);
  };

  const next = () => setAt((a) => Math.min(n, a + 1));
  const back = () => setAt((a) => Math.max(-2, a - 1));
  const forward =
    at === -2 ? { label: n ? `Start · ${n} ${n === 1 ? 'step' : 'steps'}` : 'Start', disabled: factor === null } : at === -1 ? { label: n ? 'Step 1' : 'Done', disabled: false } : at < n - 1 ? { label: 'Next', disabled: false } : at === n - 1 ? { label: 'Done, label it', disabled: false } : null;

  let screen;
  if (at === -2) {
    const hint = mode === 'have' && haveValue && factor === null ? `Enter the amount in ${line?.unit ?? 'the same unit'}.` : null;
    screen = (
      <MakeHowMuch
        name={name} mode={mode} onMode={setMode} canFill={canFill}
        batchOptions={batchOptions} batches={batches} onBatches={setBatches} fill={fill} onFill={setFill}
        lines={recipe} haveLine={haveLine} onHaveLine={(id) => { setHaveLine(id); setHave(''); }} have={haveValue} onHave={setHave} haveUnit={line?.unit ?? ''}
        scaled={scaled} makes={makes} hint={hint}
      />
    );
  } else if (at === -1) {
    const kit = makeKit(scaled, steps.map((s) => s.body), container);
    screen = (
      <MakeGather
        lines={scaled}
        got={got}
        onToggle={(id) => setGot((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))}
        kit={kit}
        missing={tools ? { label: tools.label, items: missingKit(kit, tools.have) } : null}
      />
    );
  } else if (at < n) {
    const s = steps[at];
    const timer = s.timer_seconds ?? timerFromText(s.body);
    const { main, hint } = splitHint(s.body);
    screen = <MakeStep index={at} total={n} name={name} size={makes} parts={stepParts(main, named)} hint={hint} timer={timer} next={at + 1 < n ? steps[at + 1].body : null} />;
  } else {
    screen = <MakeDone label={label} goesIn={spot ?? prep?.storage ?? null} made={yieldQ ? madeValue : null} onMade={setMade} madeUnit={yieldQ?.unit ?? null} onClose={close} />;
  }

  // Gather and each step: the bar along the top (none on "How much?" or the label, as drawn).
  const total = n + 1;
  const lit = at + 1;
  const mono = [styles.mono, { color: ds.c.muted }];
  let top;
  if (at === -2) {
    top = (
      <>
        <Caption style={[mono, styles.grow]} numberOfLines={1}>{`MAKE · ${name.toUpperCase()}`}</Caption>
        <GlassButton accessibilityLabel="Stop making" icon="xmark" onPress={close} />
      </>
    );
  } else if (at < n) {
    top = (
      <>
        {at === -1 ? <GlassButton accessibilityLabel="Back to how much" icon="chevron.left" onPress={back} /> : <GlassButton accessibilityLabel="Stop making" icon="xmark" onPress={close} />}
        <View style={styles.bars} aria-label={`Part ${lit + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i <= lit ? ds.c.ink : ds.c.lineStrong }]} />
          ))}
        </View>
        {/* The size while getting it out, as a pill; "2 of 3" on a step. */}
        {at === -1 ? (makes ? <Caption style={[styles.mono, styles.pill, { backgroundColor: ds.c.raised }]}>{makes}</Caption> : null) : <Caption style={mono}>{`${at + 1} of ${n}`}</Caption>}
      </>
    );
  }
  const onStep = at >= 0 && at < n;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm }]}>
      {top ? <View style={[styles.top, { paddingHorizontal: gutter }, wide && styles.wide]}>{top}</View> : null}
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter }, wide && styles.wide]} keyboardShouldPersistTaps="handled">
        {/* A step goes on with a tap anywhere, for a wet hand. */}
        {onStep ? (
          <Pressable accessible={false} onPress={next}>
            {screen}
          </Pressable>
        ) : (
          screen
        )}
      </ScrollView>
      <View style={[styles.foot, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.md }, wide && styles.wide]}>
        {at === -1 ? <Caption tone="muted" style={styles.center}>{`${got.length} of ${recipe.length} out`}</Caption> : null}
        {forward ? (
          <View style={styles.footerRow}>
            {onStep ? <Button label="Back" variant="secondary" size="lg" onPress={back} /> : null}
            <Button label={forward.label} variant="ink" size="lg" disabled={forward.disabled} onPress={next} style={styles.grow} />
          </View>
        ) : (
          <>
            <Button label="Print or share label" variant="ink" size="lg" onPress={() => void shareLabel(label)} />
            <View style={styles.footerRow}>
              <Button
                label={copied ? 'Copied' : 'Copy for tape'}
                variant="secondary"
                size="lg"
                onPress={() => void copyForTape(label).then(setCopied)}
                style={styles.grow}
              />
              <Button label="Done" variant="secondary" size="lg" onPress={close} style={styles.grow} />
            </View>
          </>
        )}
        {onStep ? <Caption tone="muted" style={styles.center}>Tap anywhere with a wet hand for the next step</Caption> : null}
      </View>
    </View>
  );
}

/** The fill closest to what the page asked for, so "Fill a 750 ml bottle" opens on it. */
function nearestFill(ml: number): number {
  return [500, 750, 1000, 2000].reduce((best, v) => (Math.abs(v - ml) < Math.abs(best - ml) ? v : best), 750);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bars: { flex: 1, flexDirection: 'row', gap: space.xs },
  bar: { flex: 1, height: 4, borderRadius: radius.mark },
  body: { paddingTop: space.xl, paddingBottom: space.xxxl },
  wide: { maxWidth: 640, width: '100%', alignSelf: 'flex-start' },
  foot: { gap: space.sm, paddingTop: space.md },
  grow: { flex: 1 },
  footerRow: { flexDirection: 'row', gap: space.sm },
  center: { textAlign: 'center' },
  mono: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
  pill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, overflow: 'hidden', letterSpacing: 0 },
});
