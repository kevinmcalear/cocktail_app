import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useFirstRound } from '@/hooks/useFirstRound';
import type { RoundStep } from '@/lib/firstRound';

/** The round's progress as short bars, one per step: done ones lit. */
export function RoundBars({ done, total, width = 60 }: { done: number; total: number; width?: number }) {
  const ds = useDs();
  return (
    <View aria-hidden style={[styles.bars, { width }]}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.bar, { backgroundColor: i < done ? ds.c.ink : ds.c.lineStrong }]} />
      ))}
    </View>
  );
}

/** "First round · 1 of 3 done". */
export const progressLine = (done: number, total: number) => `First round · ${done} of ${total} done`;

/** "Next: put it on a menu". */
export const nextLine = (step: RoundStep) => `Next: ${step.title.charAt(0).toLowerCase()}${step.title.slice(1)}`;

/** The numbered steps, the one that's up ringed in the accent, with its Skip. */
export function RoundStepList({ steps, currentKey, onSkip }: { steps: (RoundStep & { done: boolean })[]; currentKey: string | null; onSkip: () => void }) {
  const ds = useDs();
  return (
    <View role="list">
      {steps.map((s, i) => {
        const current = s.key === currentKey;
        const quiet = !current && !s.done;
        return (
          <View key={s.key} role="listitem" style={[styles.step, i < steps.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ds.c.line }]}>
            <View aria-hidden style={[styles.number, { borderColor: current ? ds.accentText : ds.c.lineStrong, borderWidth: current ? 1.5 : 1, backgroundColor: s.done ? ds.c.lineStrong : 'transparent' }]}>
              {s.done ? (
                <IconSymbol name="checkmark" size={14} color={ds.c.ink} />
              ) : (
                <DsText variant="caption" tone={current ? 'accent' : 'muted'} style={styles.mono}>
                  {String(i + 1)}
                </DsText>
              )}
            </View>
            <View style={styles.stepText}>
              <Body tone={quiet ? 'muted' : 'ink'} style={styles.medium}>
                {s.title}
              </Body>
              <Caption tone="muted">{s.detail}</Caption>
            </View>
            {current ? (
              <PressableScale role="button" accessibilityLabel="Skip this step" onPress={onSkip} style={styles.skip}>
                <DsText variant="label" tone="muted">
                  Skip
                </DsText>
              </PressableScale>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const isOldFashioned = (name: string) => name.trim().toLowerCase() === 'old fashioned';

/**
 * Does the step that's up. Making the Old Fashioned yours opens the add-drink
 * wizard started from the catalog's Old Fashioned, at Review; the others open
 * their tab.
 */
export function useRoundGo() {
  const router = useRouter();
  const { venue, done } = useFirstRound();
  const classics = useDrinkLists().data ?? [];
  return (step: RoundStep | null) => {
    if (!step || !venue) return;
    if (step.key === 'house_spec') {
      const from = classics.find((c) => isOldFashioned(c.name))?.id;
      router.push({ pathname: '/add-cocktail', params: { barId: venue.id, name: 'Old Fashioned', round: '1', ...(from ? { from } : {}) } });
    } else if (step.opens === 'menus') {
      // A staff member's step is opening Menus: done first, so its tab is there to open (a hidden native tab may not be).
      if (step.key === 'open_menu') done('open_menu');
      router.navigate('/menus');
    }    else if (step.opens === 'discover') router.navigate('/discover');
  };
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', gap: space.xs },
  bar: { flex: 1, height: space.xs, borderRadius: radius.mark },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  number: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: fontFamilies.mono },
  stepText: { flex: 1, gap: 2 },
  medium: { fontFamily: fontFamilies.bodyMedium },
  skip: { minHeight: 44, paddingHorizontal: space.sm, justifyContent: 'center' },
});
