import { useDeferredValue, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Title, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { typedUnit } from '@/lib/drinkWizard';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { readSpec, type SpecRow } from '@/lib/specPaste';
import { techniqueById } from '@/lib/techniques';
import { amountText } from '@/lib/units';
import { getPreferredUnit } from '@/store/useSettingsStore';

import type { CatalogIngredient } from './IngredientSearch';

interface PasteSpecPanelProps {
  onClose: () => void;
  drinkName: string;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  coreIds?: ReadonlySet<string>;
  /** The back bar's (or shelf's) bottles: a wash starts from one of these first. */
  have?: ReadonlySet<string>;
  haveLabel: string;
  onAdd: (rows: SpecRow[]) => void;
}

/**
 * A whole spec pasted at once, in place of the ingredients step while it's
 * open (canvas make-create-finish-oil, step 4): each line read the way a typed one is and
 * shown before anything is added. The drink's name, the method and the glass
 * are skipped; drops and "on top" go to the finish; a house line is marked,
 * and asks once it's in. ponytail: not a Sheet, because on iOS the keyboard
 * rising in a sheet over the wizard trips Reanimated's layout-animation assert
 * (debug build, 23 Oct); a sheet can come back once that's fixed.
 */
export function PasteSpecPanel({ onClose, drinkName, ingredients, aliases, coreIds, have, haveLabel, onAdd }: PasteSpecPanelProps) {
  const ds = useDs();
  const [text, setText] = useState('');
  // Read behind the typing: each line is matched against the whole catalog.
  const reading = useDeferredValue(text);
  const rows = useMemo(() => readSpec(reading, ingredients, { aliases, coreIds, have, drinkName }), [reading, ingredients, aliases, coreIds, have, drinkName]);
  const n = rows.filter((r) => r.kind !== 'skip').length;
  const tag = (r: SpecRow) => {
    if (r.kind === 'skip') return r.note ?? 'Skipped';
    if (r.kind === 'finish') return 'Finish';
    if (r.house) return `Make it house: ${techniqueById(r.house.technique)?.name.toLowerCase() ?? 'house prep'}`;
    return r.pick.id ? (have?.has(r.pick.id) ? haveLabel : 'In the catalog') : 'New, added when you save';
  };
  return (
    <View role="group" aria-label="Paste the spec" style={[styles.panel, { backgroundColor: ds.c.surface }]}>
      <Title role="heading">Paste the spec</Title>
      <Field
        label="The spec"
        value={text}
        onChangeText={setText}
        minLines={5}
        autoFocus
        autoCorrect={false}
        placeholder={'2 oz coconut fat-washed Bacardi\n1 oz lime juice\n3 drops mint oil on top'}
      />
      {!text.trim() ? (
        <Body tone="muted">A line each, the way you’d write it. Each one is read and shown here before it’s added.</Body>
      ) : (
        <View style={styles.read}>
          <Caption tone="accent">HERE’S WHAT I READ</Caption>
          <View role="list">
            {rows.map((r) => (
              <ReadRow key={r.key} row={r} tag={tag(r)} />
            ))}
          </View>
        </View>
      )}
      <View style={styles.buttons}>
        <Button
          label={n ? `Add ${n} ${n === 1 ? 'line' : 'lines'}` : 'Add the lines'}
          disabled={!n}
          onPress={() => {
            onAdd(rows);
            onClose();
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </View>
  );
}

/** One pasted line: as pasted, then what it becomes. */
function ReadRow({ row, tag }: { row: SpecRow; tag: string }) {
  const ds = useDs();
  const skipped = row.kind === 'skip';
  const amount = row.amount ? amountText(row.amount, typedUnit(row.pick.name, row.unit, getPreferredUnit())) : row.unit === 'top' ? 'Top' : '';
  const marked = !skipped && (row.kind === 'finish' || !!row.house);
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Caption tone="muted" style={styles.source} numberOfLines={1}>{row.source}</Caption>
      {skipped ? null : (
        <View style={styles.line}>
          <Body style={styles.amount}>{amount}</Body>
          <Body style={styles.flex} numberOfLines={2}>{row.pick.name}</Body>
        </View>
      )}
      <View style={[styles.tag, { backgroundColor: marked ? ds.accentFill.fill : ds.c.raised }]}>
        <Caption style={{ color: marked ? ds.accentFill.text : ds.c.muted }}>{tag}</Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.lg, padding: space.lg, borderRadius: radius.control },
  read: { gap: space.xs },
  row: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  source: { fontFamily: fontFamilies.mono },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  amount: { width: 72, fontFamily: fontFamilies.mono },
  flex: { flex: 1 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: space.xs / 2, borderRadius: radius.pill },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
