import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space, type } from '@/constants/tokens';

/**
 * "Recipes stay with the bar": where a spec would be, on a drink (or a bar's
 * page of drinks) whose bar keeps its specs back. Says why, lists what goes
 * in the drink without amounts when the bar shares that (ppl-drink-menu-level),
 * and, for an unclaimed bar, carries the claim action.
 */
export function SpecLockPanel({ note, ingredients, action }: { note: string; ingredients?: string | null; action?: ReactNode }) {
  const ds = useDs();
  return (
    <Surface style={[styles.panel, { borderColor: ds.c.line }]}>
      <View style={[styles.ring, { borderColor: ds.c.ink }]} aria-hidden>
        <IconSymbol name="lock.fill" size={20} color={ds.c.ink} />
      </View>
      <DsText variant="body" role="heading" align="center" style={styles.title}>
        Recipes stay with the bar
      </DsText>
      <Body tone="muted" align="center" style={styles.note}>
        {note}
      </Body>
      {ingredients ? (
        <View style={[styles.ingredients, { borderTopColor: ds.c.line }]}>
          <Caption tone="muted" role="heading" aria-level={3} style={styles.cap}>
            What goes in it
          </Caption>
          <Body>{ingredients}</Body>
        </View>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  // As drawn (ppl-bar-unclaimed): 20 in, a 17 on 22 semibold title, the note at 15 on 22.
  panel: { alignItems: 'center', gap: space.sm, borderWidth: StyleSheet.hairlineWidth, padding: space.lg + space.xs },
  title: { fontFamily: fontFamilies.bodySemiBold, lineHeight: 22 },
  note: { fontSize: type.label.fontSize, lineHeight: 22 },
  ring: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ingredients: { alignSelf: 'stretch', gap: space.xs, marginTop: space.xs, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  action: { marginTop: space.xs, alignSelf: 'stretch', alignItems: 'center' },
});
