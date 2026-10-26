import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Sheet, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSetWashLine, type BarGlass } from '@/hooks/useBarGlassware';
import { washLine, WASH_LINE_SHARE } from '@/lib/glassFill';

/** The wash line fact on a venue glass's page: "150 ml", "About 155 ml, from its 170 ml capacity", or not said. */
export function washLineValue(glass: BarGlass): string {
  const line = washLine(glass);
  if (!line) return 'Not said yet';
  return line.said ? `${line.ml} ml` : `About ${line.ml} ml, from its ${Math.round(line.brimMl!)} ml capacity`;
}

/**
 * Change a venue glass's wash line (Fit it to the glass, QA Q38): the
 * volume its drinks are filled to, just under the rim. Clearing it reads it
 * from the glass's capacity again.
 */
export function WashLineSheet({ barId, glass, name, onClose }: { barId: string; glass: BarGlass; name: string; onClose: () => void }) {
  const set = useSetWashLine(barId);
  const line = washLine(glass);
  const [text, setText] = useState(glass.wash_line_ml ? String(glass.wash_line_ml) : '');
  const ml = text.trim() ? Number(text.trim()) : null;
  const brim = glass.capacity_ml;
  const problem = ml === null ? null : !(ml >= 10 && ml < 5000) ? 'Somewhere from 10 ml up.' : brim && ml > brim ? `At most its ${Math.round(brim)} ml to the brim.` : null;
  const save = (value: number | null) => set.mutate({ id: glass.id, ml: value }, { onSuccess: onClose });
  return (
    <Sheet visible onClose={onClose} accessibilityLabel={`Wash line, ${name}`} keyboard>
      <View style={styles.body}>
        <Caption tone="muted">Wash line</Caption>
        <Title>{name}</Title>
        <Body tone="muted">What a drink should fill it to, just under the rim. The drink page and the editor say when a spec comes short of it or goes over, and Fit it scales the spec to land on it.</Body>
        <Field
          label="Fills to (ml)"
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder={line ? String(line.ml) : '150'}
          hint={line && !line.said ? `Not said, it reads as about ${Math.round(WASH_LINE_SHARE * 100)}% of its ${Math.round(line.brimMl!)} ml: ${line.ml} ml.` : undefined}
          error={problem ?? undefined}
        />
        <Button label={set.isPending ? 'Saving…' : 'Save'} disabled={set.isPending || !!problem || ml === null} onPress={() => save(ml)} />
        {glass.wash_line_ml ? <Button label="Read it from the capacity" variant="ghost" disabled={set.isPending} onPress={() => save(null)} /> : null}
        {set.error ? <Caption tone="accent">Couldn’t save that. Check your connection and try again.</Caption> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.md },
});
