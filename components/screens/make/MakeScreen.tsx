import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider, Button, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useLearnYield, type PrepCardData } from '@/hooks/usePrepCard';
import { allergenLabel } from '@/lib/allergens';
import { initials, stepParts, timerFromText, useByDate } from '@/lib/makeSteps';
import { toQuantity } from '@/lib/quantity';
import { factorForLine, scaledYield, scaleRecipe, type RecipeLine } from '@/lib/scale';

import { MakeDone, shareLabel, type BatchLabel } from './MakeDone';
import { MakeHowMuch, type MakeMode } from './MakeHowMuch';
import { MakeGather, MakeStep } from './MakeSteps';

interface MakeScreenProps {
  itemId: string;
  name: string;
  recipe: RecipeLine[];
  card: PrepCardData;
  accent?: string;
  /** The size picked on the page, as a factor of one batch. */
  startFactor: number;
  /** Open on "What I have" (the page's chip). */
  startMode?: 'have';
  /** The viewer can change the prep card, so a real yield is saved. */
  canLearn: boolean;
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

function Make({ itemId, name, recipe, card, startFactor, startMode, canLearn }: MakeScreenProps) {
  useKeepAwake();
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const prep = card.prep;
  const yieldQ = toQuantity(prep?.yield_amount, prep?.yield_unit);
  const canFill = yieldQ?.kind === 'ml';
  const startBatches = [0.5, 1, 2, 3, 4, 6].includes(startFactor) ? startFactor : 1;
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
  const learn = useLearnYield(itemId);
  const me = useMyProfile().data;
  const allergens = useDrinkAllergens(itemId).data;

  const line = recipe.find((l) => l.id === haveLine) ?? null;
  const factor =
    mode === 'batches'
      ? batches
      : mode === 'fill' && yieldQ
        ? fill / yieldQ.value
        : line
          ? factorForLine(line, toQuantity(have, line.unit))
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
  };

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
    at === -2 ? { label: 'Start', disabled: factor === null } : at === -1 ? { label: n ? 'Step 1' : 'Done', disabled: false } : at < n - 1 ? { label: 'Next', disabled: false } : at === n - 1 ? { label: 'Done, label it', disabled: false } : null;

  let screen;
  if (at === -2) {
    const hint = mode === 'have' && have && factor === null ? `Enter the amount in ${line?.unit ?? 'the same unit'}.` : null;
    screen = (
      <MakeHowMuch
        name={name} mode={mode} onMode={setMode} canFill={canFill}
        batches={batches} onBatches={setBatches} fill={fill} onFill={setFill}
        lines={recipe} haveLine={haveLine} onHaveLine={setHaveLine} have={have} onHave={setHave} haveUnit={line?.unit ?? ''}
        scaled={scaled} makes={makes} hint={hint}
      />
    );
  } else if (at === -1) {
    screen = <MakeGather lines={scaled} got={got} onToggle={(id) => setGot((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))} />;
  } else if (at < n) {
    const s = steps[at];
    const timer = s.timer_seconds ?? timerFromText(s.body);
    screen = <MakeStep index={at} total={n} name={name} parts={stepParts(s.body, named)} timer={timer} suggested={!s.timer_seconds} next={at + 1 < n ? steps[at + 1].body : null} />;
  } else {
    screen = <MakeDone label={label} made={yieldQ ? madeValue : null} onMade={setMade} madeUnit={yieldQ?.unit ?? null} />;
  }

  // Gather, each step, then done: the bar along the top (nothing lit on "How much?").
  const total = n + 2;
  const progress = at + 1;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm }]}>
      <View style={[styles.top, { paddingHorizontal: gutter }]}>
        <GlassButton accessibilityLabel={at === n ? 'Close' : 'Stop making'} icon="xmark" onPress={close} />
        <View style={styles.bars} aria-label={progress < 0 ? `${total} parts to go` : `Part ${progress + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.bar, { backgroundColor: i <= progress ? ds.c.ink : ds.c.lineStrong }]} />
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter }, wide && styles.wide]} keyboardShouldPersistTaps="handled">
        {screen}
      </ScrollView>
      <View style={[styles.footer, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.md }, wide && styles.wide]}>
        {at > -2 && at < n ? <Button label="Back" variant="secondary" size="lg" onPress={back} /> : null}
        {forward ? (
          <Button label={forward.label} size="lg" disabled={forward.disabled} onPress={next} style={styles.grow} />
        ) : (
          <>
            <Button label="Print or share label" variant="secondary" size="lg" onPress={() => void shareLabel(label)} style={styles.grow} />
            <Button label="Done" size="lg" onPress={close} style={styles.grow} />
          </>
        )}
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
  footer: { flexDirection: 'row', gap: space.sm, paddingTop: space.md },
  grow: { flex: 1 },
});
