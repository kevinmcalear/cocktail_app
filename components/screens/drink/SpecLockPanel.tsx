import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Headline, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';

/**
 * "Recipes stay with the bar": where a spec would be, on a drink (or a bar's
 * page of drinks) whose bar keeps its specs back. Says why and, for an
 * unclaimed bar, carries the claim action.
 */
export function SpecLockPanel({ note, action }: { note: string; action?: ReactNode }) {
  const ds = useDs();
  return (
    <Surface style={[styles.panel, { borderColor: ds.c.line }]}>
      <View style={[styles.ring, { borderColor: ds.c.ink }]} aria-hidden>
        <IconSymbol name="lock.fill" size={20} color={ds.c.ink} />
      </View>
      <Headline role="heading" align="center">
        Recipes stay with the bar
      </Headline>
      <Body tone="muted" align="center">
        {note}
      </Body>
      {action ? <View style={styles.action}>{action}</View> : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: space.sm, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  ring: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  action: { marginTop: space.xs, alignSelf: 'stretch', alignItems: 'center' },
});
