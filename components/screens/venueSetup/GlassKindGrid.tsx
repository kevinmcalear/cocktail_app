import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, PressableScale, useDs } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { SETUP_KINDS, type GlassKind } from '@/lib/glassKinds';

/**
 * "What do you pour into? Tap all that apply" (owner-setup step 6): the
 * kinds, three across, each drawn, with a tick on the ones on the list, and
 * Something else to name your own.
 */
export function GlassKindGrid({ on, fixed, onToggle, onOther }: { on: (k: GlassKind) => boolean; fixed?: (k: GlassKind) => boolean; onToggle: (k: GlassKind) => void; onOther: () => void }) {
  return (
    <View role="group" aria-label="What do you pour into?" style={styles.grid}>
      {SETUP_KINDS.map((k) => (
        <Tile key={k.key} label={k.label} on={on(k)} hint={fixed?.(k) ? 'On your list as a real glass. Kit › Glassware takes it off.' : undefined} onPress={() => onToggle(k)}>
          <GlassThumb glass={k.glass} variant={k.variant} size={44} />
        </Tile>
      ))}
      <Tile label="Something else" on={false} onPress={onOther} plain>
        <PlusMark />
      </Tile>
    </View>
  );
}

function Tile({ label, on, hint, onPress, plain, children }: { label: string; on: boolean; hint?: string; onPress: () => void; plain?: boolean; children: ReactNode }) {
  const ds = useDs();
  return (
    <PressableScale
      role="button"
      aria-pressed={plain ? undefined : on}
      accessibilityLabel={plain ? 'Something else: name your own' : label}
      accessibilityHint={hint}
      disabled={!!hint}
      onPress={onPress}
      style={[styles.tile, on ? { backgroundColor: withAlpha(ds.accentText, 0.14), borderColor: ds.accentText, borderWidth: 1.5 } : { backgroundColor: ds.c.raised, borderColor: 'transparent', borderWidth: 1 }]}
    >
      {on ? (
        <View style={styles.tick} aria-hidden>
          <IconSymbol name="checkmark" size={16} color={ds.accentText} />
        </View>
      ) : null}
      {children}
      <Body numberOfLines={2} style={styles.label}>
        {label}
      </Body>
    </PressableScale>
  );
}

function PlusMark() {
  const ds = useDs();
  return (
    <View style={styles.plus} aria-hidden>
      <IconSymbol name="plus" size={26} color={ds.c.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Three across: a third of the row less its two gaps.
  tile: { flexBasis: '30%', flexGrow: 1, minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.xs, borderRadius: radius.control, borderCurve: 'continuous' },
  tick: { position: 'absolute', top: 6, right: 6 },
  label: { textAlign: 'center' },
  plus: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
