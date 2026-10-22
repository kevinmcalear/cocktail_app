import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DrinkImage, PressableScale, TextLink, useDs } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { DrinkList } from '@/hooks/useDiscover';
import { useAddClassics, useBarClassics, useTopClassics } from '@/hooks/useWhatNext';
import { CLASSIC_COUNT, classicsToAdd } from '@/lib/whatNext';

import { StepFooter } from './GlassesStep';

const FIRST = 6;

/** One classic, ticked to add; one the bar already has shows a fixed tick and says so. */
function ClassicRow({ classic, ticked, have, onToggle }: { classic: DrinkList; ticked: boolean; have: boolean; onToggle: () => void }) {
  const ds = useDs();
  const on = ticked || have;
  return (
    <PressableScale
      role="checkbox"
      aria-checked={on}
      aria-disabled={have}
      disabled={have}
      accessibilityLabel={have ? `${classic.name}, already in your Library` : classic.name}
      onPress={onToggle}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <DrinkImage itemId={classic.id} accessibilityLabel={classic.name} radius="control" thumb sketchDetail="thumb" style={styles.drawing} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{classic.name}</Body>
        {have ? <Caption tone="muted">In your Library</Caption> : null}
      </View>
      <View style={[styles.box, on ? { backgroundColor: have ? ds.c.lineStrong : ds.accentFill.fill } : { borderColor: ds.c.lineStrong, borderWidth: 2 }]}>
        {on ? <IconSymbol name="checkmark" size={14} color={have ? ds.c.ink : ds.accentFill.text} /> : null}
      </View>
    </PressableScale>
  );
}

/**
 * Step 3, your menu: bring in what's on now (Bring in), or start from the 20
 * most ranked classics as the bar's own copies, each one untickable. A
 * classic the bar already has is shown as in, and never added twice.
 */
export function MenuStep({ barId, step, onBack, onDone, onSkip, onBringIn }: { barId: string; step: string; onBack: () => void; onDone: () => void; onSkip: () => void; onBringIn: () => void }) {
  const ds = useDs();
  const chrome = useSetupChrome();
  const { classics, isLoading, error } = useTopClassics();
  const have = new Set(useBarClassics(barId, classics).data ?? []);
  const add = useAddClassics(barId);
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [all, setAll] = useState(false);
  const adding = classicsToAdd(classics, unticked, have);
  const toggle = (id: string) =>
    setUnticked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const label = add.isPending
    ? `Adding ${Math.min(add.done + 1, add.variables?.length ?? 1)} of ${add.variables?.length ?? 1}…`
    : adding.length
      ? `Add ${adding.length === 1 ? 'one classic' : `${adding.length} classics`}`
      : 'Next';

  return (
    <SetupChromeProvider value={{ ...chrome, title: 'What are you pouring now?', intro: undefined, mark: undefined, eyebrow: null, progress: null, topLabel: step, noBack: false, onBack }}>
      <SetupPage
        footer={
          <StepFooter
            skip="Skip"
            onSkip={onSkip}
            label={label}
            disabled={add.isPending || isLoading}
            onPress={() => (adding.length ? add.mutate(adding, { onSuccess: onDone }) : onDone())}
          />
        }
      >
        <PressableScale role="button" accessibilityLabel="Bring in your current menu. A photo, a PDF or a link." onPress={onBringIn} style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
          <Body style={styles.strong}>Bring in your current menu</Body>
          <Caption tone="muted">A photo, a PDF or a link. We read it, you check it.</Caption>
        </PressableScale>
        <View role="group" aria-label={`Start with ${CLASSIC_COUNT} classics`} style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.accentText }]}>
          <Body style={styles.strong}>{`Start with ${CLASSIC_COUNT} classics`}</Body>
          <Caption tone="muted">Your own copies, ready to change. Untick any you don’t make.</Caption>
          {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
          {error ? <Caption tone="muted">Couldn’t load the classics. Check your connection and try again.</Caption> : null}
          <View>
            {(all ? classics : classics.slice(0, FIRST)).map((c) => (
              <ClassicRow key={c.id} classic={c} have={have.has(c.id)} ticked={!unticked.has(c.id)} onToggle={() => toggle(c.id)} />
            ))}
          </View>
          {classics.length > FIRST ? <TextLink label={all ? 'Show fewer' : `See all ${classics.length}`} onPress={() => setAll((a) => !a)} /> : null}
        </View>
        {add.error ? (
          <Caption tone="accent" role="alert">
            {add.done ? `${add.done} added. The rest didn’t go in: check your connection and try again.` : 'Couldn’t add the classics. Check your connection and try again.'}
          </Caption>
        ) : null}
      </SetupPage>
    </SetupChromeProvider>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  drawing: { width: 40, height: 40 },
  flex: { flex: 1, minWidth: 0 },
  box: { width: 24, height: 24, borderRadius: radius.mark, alignItems: 'center', justifyContent: 'center' },
});
