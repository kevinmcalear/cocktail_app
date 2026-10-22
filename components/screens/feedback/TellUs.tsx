import { createContext, use, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { FeedbackPlace } from '@/lib/feedback';

import { FeedbackSheet } from './FeedbackSheet';

interface TellUsFlow {
  /** The flow it sits in ("Adding a drink"), before the step's own name. */
  flow: string | null;
  subject?: string | null;
  barId?: string | null;
  barName?: string | null;
}

/** Set by a flow (the add-drink wizard) so every Tell us inside it knows the drink and the bar. */
export const TellUsPlace = createContext<TellUsFlow>({ flow: null });

/** Where a Tell us on this step was opened: "Adding a drink › Ice", the drink (or what's given), the bar. */
export function useTellUsPlace(step: string, subject?: string | null): FeedbackPlace {
  const { flow, ...rest } = use(TellUsPlace);
  return { ...rest, screen: flow ? `${flow} › ${step}` : step, subject: subject ?? rest.subject };
}

/** "Doing something different? Tell us / We'll add your ice to the app.", as the board draws it under a list. */
export function TellUsRow({ what, onPress }: { what: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`Doing something different? Tell us. We’ll add your ${what} to the app.`}
      onPress={onPress}
      style={[styles.row, { borderColor: ds.accentText, backgroundColor: withAlpha(ds.accentText, 0.08) }]}
    >
      <IconSymbol name="bubble.left" size={20} color={ds.accentText} />
      <View style={styles.flex}>
        <Body style={styles.title}>Doing something different? Tell us</Body>
        <Caption tone="muted">{`We’ll add your ${what} to the app.`}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/** The row and its sheet, for a list on the page (the ice and method steps). */
export function TellUs({ step, what }: { step: string; what: string }) {
  const [open, setOpen] = useState(false);
  const place = useTellUsPlace(step);
  return (
    <>
      <TellUsRow what={what} onPress={() => setOpen(true)} />
      <FeedbackSheet visible={open} onClose={() => setOpen(false)} mode="different" place={place} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.sm, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  flex: { flex: 1 },
  title: { fontFamily: fontFamilies.bodySemiBold },
});
