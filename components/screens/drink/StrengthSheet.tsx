import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Field, Headline, Spec, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useSetDilution } from '@/hooks/useDrinkMath';
import type { BatchMethod } from '@/lib/batch';
import { DEFAULT_DILUTION, formatAbv, formatAmount, type Strength } from '@/lib/drinkMath';

interface StrengthSheetProps {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  name: string;
  strength: Strength;
  method: BatchMethod;
  /** The drink's own measured dilution, if any. */
  dilutionPct: number | null;
  /** The viewer can set the drink's dilution. */
  canEdit: boolean;
  /** Where the venue's house defaults live, for admins. */
  defaultsHref: Href | null;
  accent?: string;
}

const trim = (n: number) => String(Number(n.toFixed(1)));

/**
 * How strong the drink is, line by line: each ingredient's ethanol, the ABV
 * before and after dilution, and the dilution used. Editors set a measured
 * dilution here; the server recalculates and every role sees the result.
 */
export function StrengthSheet(props: StrengthSheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <BackbarTheme>
        <BrandProvider accent={props.accent}>
          <Sheet {...props} />
        </BrandProvider>
      </BackbarTheme>
    </Modal>
  );
}

function Sheet({ onClose, itemId, name, strength, method, dilutionPct, canEdit, defaultsHref }: StrengthSheetProps) {
  const ds = useDs();
  const router = useRouter();
  const set = useSetDilution(itemId);
  const [draft, setDraft] = useState(dilutionPct === null ? '' : String(dilutionPct));
  const value = Number(draft);
  const valid = draft.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 100;
  // With no ABV on any line the strength isn't known; the server leaves it empty too.
  const known = strength.unknownAbv < strength.lines.length;
  const source =
    dilutionPct !== null
      ? 'measured for this drink'
      : strength.preDiluted
        ? 'water is already in the spec'
        : method === 'unknown'
          ? 'no method set'
          : strength.dilutionPct === DEFAULT_DILUTION[method]
            ? `the house rule for a ${method} drink`
            : `${name.includes(' ') ? 'the venue' : 'the venue'}'s figure for a ${method} drink`;

  return (
    <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
      <View style={styles.avoider} pointerEvents="box-none">
        <Pressable style={[styles.sheet, { backgroundColor: ds.c.ground }]} onPress={(e) => e.stopPropagation()}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Caption tone="muted">Strength</Caption>
            <Title>{name}</Title>
            <View>
              {strength.lines.map((l) => (
                <View key={l.key} accessible accessibilityLabel={`${l.ingredient}, ${formatAmount(l.ml, 'ml')}, ${trim(l.ethanolMl)} ml ethanol`} style={[styles.row, { borderBottomColor: ds.c.line }]}>
                  <Body style={styles.name}>{l.ingredient}</Body>
                  <Spec tone="muted">{formatAmount(l.ml, 'ml')}</Spec>
                  <Spec tone="accent" style={styles.ethanol}>
                    {l.abvUnknown ? 'no ABV' : `${trim(l.ethanolMl)} ml`}
                  </Spec>
                </View>
              ))}
              <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
                <Body style={styles.name}>Before dilution</Body>
                <Spec tone="muted">{formatAmount(strength.totalMl, 'ml')}</Spec>
                <Spec tone="accent" style={styles.ethanol}>
                  {known ? formatAbv(strength.abv) : 'no ABV'}
                </Spec>
              </View>
              <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
                <Body style={styles.name}>In the glass</Body>
                <Spec tone="muted">{formatAmount(strength.serveMl, 'ml')}</Spec>
                <Spec tone="accent" style={styles.ethanol}>
                  {known ? formatAbv(strength.serveAbv) : 'no ABV'}
                </Spec>
              </View>
            </View>
            <Body tone="muted">
              {trim(strength.ethanolMl)} ml of ethanol, {trim(strength.unitsUk)} UK units. Dilution {trim(strength.dilutionPct)}%: {source}.
              {strength.unknownAbv ? ` ${strength.unknownAbv === 1 ? '1 ingredient has' : `${strength.unknownAbv} ingredients have`} no ABV on file and counted as 0%.` : ''}
            </Body>
            {canEdit ? (
              <View style={styles.edit}>
                <Headline>Measured dilution</Headline>
                <Field label="Percent of the drink, weighed before and after" value={draft} onChangeText={setDraft} placeholder={String(strength.dilutionPct)} keyboardType="decimal-pad" hint="Leave blank to use the house default." />
                <View style={styles.actions}>
                  <Button label={set.isPending ? 'Saving…' : 'Save'} disabled={set.isPending || (draft.trim() !== '' && !valid)} onPress={() => set.mutate(draft.trim() === '' ? null : value)} />
                  {defaultsHref ? <Button label="House defaults" variant="secondary" onPress={() => router.push(defaultsHref)} /> : null}
                </View>
                {set.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
                {set.isSuccess ? <Caption tone="muted">Saved. The figures update once the server has recalculated.</Caption> : null}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  avoider: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous', maxHeight: '90%' },
  body: { padding: space.xl, paddingBottom: space.xxxl, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1 },
  ethanol: { width: 84, textAlign: 'right' },
  edit: { gap: space.sm, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
