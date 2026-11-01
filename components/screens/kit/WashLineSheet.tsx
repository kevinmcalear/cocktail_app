import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Sheet, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSetWashLine, type BarGlass } from '@/hooks/useBarGlassware';
import { brimOf, presetMl, WASH_LINE_PRESETS } from '@/lib/glassFill';

/** The wash line fact on a venue glass's page: "150 ml", or not set. It's optional (jam dec-24). */
export function washLineValue(glass: BarGlass): string {
  return glass.wash_line_ml ? `${Number(glass.wash_line_ml)} ml` : 'Not set';
}

/**
 * Change a venue glass's wash line (Fit it to the glass, QA Q38), for venues
 * with Advanced options on. Optional, never advised (jam dec-24): pick one of
 * a few lines worked out from the glass's size, or type the ml; No wash line
 * clears it, and then nothing checks the drinks against one.
 */
export function WashLineSheet({ barId, glass, name, onClose }: { barId: string; glass: BarGlass; name: string; onClose: () => void }) {
  const set = useSetWashLine(barId);
  const [text, setText] = useState(glass.wash_line_ml ? String(glass.wash_line_ml) : '');
  const ml = text.trim() ? Number(text.trim()) : null;
  const brim = brimOf(glass);
  const problem = ml === null ? null : !(ml >= 10 && ml < 5000) ? 'Somewhere from 10 ml up.' : brim && ml > brim ? `At most its ${Math.round(brim)} ml to the brim.` : null;
  const save = (value: number | null) => set.mutate({ id: glass.id, ml: value }, { onSuccess: onClose });
  return (
    <Sheet visible onClose={onClose} accessibilityLabel={`Wash line, ${name}`} keyboard>
      <View style={styles.body}>
        <Caption tone="muted">Wash line</Caption>
        <Title>{name}</Title>
        <Body tone="muted">Optional. What your drinks fill this glass to. With one set, the drink page and the editor say when a spec comes short of it or goes over, and Fit it scales the spec to land on it.</Body>
        {brim ? (
          <View role="radiogroup" accessibilityLabel="Pick a wash line" style={styles.presets}>
            {WASH_LINE_PRESETS.map((p) => {
              const value = presetMl(brim, p.share);
              return <Chip key={p.label} label={p.label} count={`${value} ml`} selected={ml === value} onPress={() => setText(String(value))} />;
            })}
          </View>
        ) : null}
        <Field
          label="Fills to (ml)"
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder="150"
          hint={brim ? undefined : 'Add the glass’s size to pick from a few lines instead.'}
          error={problem ?? undefined}
        />
        <Button label={set.isPending ? 'Saving…' : 'Save'} disabled={set.isPending || !!problem || ml === null} onPress={() => save(ml)} />
        {glass.wash_line_ml ? <Button label="No wash line" variant="ghost" disabled={set.isPending} onPress={() => save(null)} /> : null}
        {set.error ? <Caption tone="accent">Couldn’t save that. Check your connection and try again.</Caption> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.md },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
