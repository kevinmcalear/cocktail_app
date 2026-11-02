import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, GlassButton, PressableScale, Sheet, SheetScrollView, Switch, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space, STATUS } from '@/constants/tokens';
import { useAllergenCheck, useCheckDrinkAllergens, useLineChecks } from '@/hooks/useAllergenCheckSheet';
import { useBarMembers } from '@/hooks/useBarDetail';
import { withAlpha } from '@/lib/color';
import { allergenLabel, type DrinkAllergens } from '@/lib/allergens';
import { dayLine, staleNote } from '@/lib/allergenWords';
import type { SpecLine } from '@/lib/spec';

import { AllergenSection } from './AllergenSection';

interface AllergenCheckSheetProps {
  itemId: string;
  name: string;
  barId: string;
  barName: string | null;
  data: DrinkAllergens;
  lines: SpecLine[];
  onClose: () => void;
}

/**
 * The bar checks a drink's allergens (board Loop-allergy, "The bar checks"
 * and "A changed spec clears it"): each line and what it contains, Add an
 * allergen on an ingredient, and "I checked these against the bottles",
 * which puts the bar's name and the date on the drink for guests. The server
 * stamps who and when, and any change to the spec clears it.
 */
export function AllergenCheckSheet({ itemId, name, barId, barName, data, lines, onClose }: AllergenCheckSheetProps) {
  const ds = useDs();
  const check = useCheckDrinkAllergens(itemId);
  const [tick, setTick] = useState<{ on: boolean; against: string | null } | null>(null);
  // A tick counts only against the check it was made on: when a change clears the check the switch goes off with it, so Save can't re-stamp a list nobody looked at again.
  const on = tick && tick.against === (data.checked ?? null) ? tick.on : !!data.checked;
  const [adding, setAdding] = useState<string | null | false>(false);
  const addingLine = lines.find((l) => l.key === adding);
  const byLine = useLineChecks(itemId, barId);
  const record = useAllergenCheck(itemId, !!data.stale).data;
  const checkerId = record?.by;
  const checker = useBarMembers(data.checked && checkerId ? barId : null).data?.find((m) => m.user_id === checkerId)?.display_name;
  const changed = on !== !!data.checked;
  const amber = ds.scheme === 'dark' ? STATUS.warning : ds.c.ink;

  const save = () => {
    if (!changed) return onClose();
    check.mutate(on, { onSuccess: onClose });
  };
  const when = data.checked ? (new Date(data.checked).toDateString() === new Date().toDateString() ? 'today' : dayLine(data.checked)) : null;

  return (
    <Sheet
      visible
      onClose={onClose}
      accessibilityLabel={`Allergens of ${name}`}
      style={styles.panel}
      header={
        <View style={styles.top}>
          <GlassButton accessibilityLabel="Close" icon="xmark" onPress={onClose} />
          <DsText variant="label" style={styles.sheetTitle}>
            Allergens
          </DsText>
          <Button label={check.isPending ? 'Saving…' : changed ? 'Save' : 'Done'} size="sm" disabled={check.isPending} onPress={save} />
        </View>
      }
    >
      <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.title}>
          {barName ? <Caption tone="muted">{barName}</Caption> : null}
          <Title role="heading">{name}</Title>
        </View>
        {data.stale ? (
          <View role="note" style={[styles.note, { backgroundColor: withAlpha(STATUS.warning, 0.14) }]}>
            <IconSymbol name="exclamationmark.triangle" size={16} color={amber} />
            <Caption color={amber} style={styles.flex}>
              {staleNote(record?.specChanged ?? null)}
            </Caption>
          </View>
        ) : null}

        <View role="table" aria-label="Each ingredient and what it contains" style={[styles.table, { borderColor: ds.c.line }]}>
          <View role="row" style={[styles.tr, { backgroundColor: ds.c.raised }]}>
            <Caption tone="muted" role="columnheader" style={styles.flex}>
              Ingredient
            </Caption>
            <Caption tone="muted" role="columnheader" style={styles.contains}>
              Contains
            </Caption>
          </View>
          {lines.map((l) => {
            // What's on the page, so the table can't read differently from what guests read.
            const contains = data.allergens.filter((x) => x.via.some((path) => path[0] === l.ingredient)).map((x) => allergenLabel(x.allergen));
            const listed = !!byLine.data?.[l.key]?.listed;
            const loading = !byLine.data && byLine.isPending;
            const short = !listed && !loading;
            const value = contains.length ? `${contains.join(', ')}${short ? ', rest not listed' : ''}` : loading ? '…' : listed ? 'Nothing' : 'Not listed';
            return (
              <View key={l.key} role="row" style={[styles.tr, { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Body role="cell" style={styles.flex}>
                  {l.ingredient ?? ''}
                </Body>
                <Body role="cell" tone={listed && !contains.length ? 'muted' : undefined} color={short ? amber : undefined} style={[styles.contains, short ? font.semiBold : null]}>
                  {value}
                </Body>
              </View>
            );
          })}
        </View>
        {byLine.isError ? <Caption tone="accent">{"Couldn't load each ingredient's list. Check your connection and try again."}</Caption> : null}

        {adding === false ? (
          <PressableScale role="button" accessibilityLabel="Add an allergen" onPress={() => setAdding(null)} style={[styles.add, { backgroundColor: ds.c.raised }]}>
            <IconSymbol name="plus" size={16} color={ds.c.muted} />
            <Body style={styles.flex}>Add an allergen</Body>
          </PressableScale>
        ) : (
          <View style={styles.adding}>
            <Caption tone="muted">Which ingredient?</Caption>
            <View role="radiogroup" accessibilityLabel="Which ingredient" style={styles.wrap}>
              {lines
                .filter((l) => l.ingredientId)
                .map((l) => (
                  <Chip key={l.key} quiet label={l.ingredient ?? ''} selected={adding === l.key} onPress={() => setAdding(l.key)} />
                ))}
            </View>
            {addingLine?.ingredientId ? <AllergenSection itemId={addingLine.ingredientId} houseMade={!!byLine.data?.[addingLine.key]?.houseMade} canEditItem={false} barId={barId} barName={barName} /> : null}
          </View>
        )}

        <View style={[styles.switchRow, { backgroundColor: ds.c.raised }]}>
          <View style={styles.flex}>
            <Body style={font.semiBold}>I checked these against the bottles</Body>
            <Caption tone="muted">{data.checked && !changed ? `Checked by ${checker ?? 'your team'}, ${when}` : 'Your name and the date go on the drink'}</Caption>
          </View>
          <Switch label="I checked these against the bottles" value={on} onValueChange={(next) => setTick({ on: next, against: data.checked ?? null })} disabled={check.isPending} />
        </View>
        {check.error ? (
          <Caption tone="accent" role="alert">
            {"Couldn't save the check. Only someone who edits drinks here can check one; otherwise check your connection and try again."}
          </Caption>
        ) : null}
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  panel: { maxWidth: 560, paddingHorizontal: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheetTitle: { flex: 1, textAlign: 'center', ...font.semiBold },
  body: { gap: space.lg, paddingBottom: space.xxl },
  title: { gap: space.xs },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md, borderRadius: radius.control },
  flex: { flex: 1, minWidth: 0 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: space.md },
  contains: { width: 120 },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.control },
  adding: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.control },
});
