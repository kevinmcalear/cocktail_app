import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline, PressableScale, Sheet, SheetScrollView, Spec, useDs } from '@/components/ds';
import { Choice } from '@/components/screens/batch/BatchParts';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkCost } from '@/hooks/useDrinkCost';
import { useMode } from '@/hooks/useMode';
import { usePricingSettings } from '@/hooks/usePricing';
import { formatMoney } from '@/lib/money';
import { KEEPS_UNITS, prepCardInput, STORAGE_PICKS, YIELD_UNITS, type PrepFields } from '@/lib/prepCardForm';
import { formatQuantity, toQuantity } from '@/lib/quantity';
import { leadTimeLabel, PREP_ACTIONS, shelfLifeLabel } from '@/lib/scale';

export type KeepsField = 'makes' | 'keeps' | 'store' | 'takes' | 'how';

/** "750 ml", "4 weeks", "Fridge", "20 min": what each How it keeps row says now. */
export function keepsValues(f: PrepFields): Record<KeepsField, string | null> {
  const p = prepCardInput(f).input.prep;
  const y = toQuantity(p.yield_amount, p.yield_unit);
  return {
    makes: y ? formatQuantity(y) : null,
    keeps: shelfLifeLabel(p.shelf_life_hours),
    store: p.storage,
    takes: leadTimeLabel(p.lead_time_minutes, p.lead_time_note),
    how: p.actions.length ? p.actions.join(', ') : null,
  };
}

const LABELS: Record<KeepsField, string> = { makes: 'Makes', keeps: 'Keeps', store: 'Store', takes: 'Takes', how: 'How it’s made' };

/**
 * How it keeps, in Edit: Makes, Keeps, Store and Takes, each opening a small
 * sheet. Phones list them as rows under a heading; wide screens set them as
 * tiles in the aside, where the read view keeps its facts.
 */
export function KeepsRows({ fields, wide, onOpen }: { fields: PrepFields; wide: boolean; onOpen: (f: KeepsField) => void }) {
  const ds = useDs();
  const values = keepsValues(fields);
  const keys = Object.keys(LABELS) as KeepsField[];
  if (wide) {
    return (
      <View style={styles.tiles}>
        {keys.map((k) => (
          <PressableScale key={k} role="button" accessibilityLabel={`${LABELS[k]}: ${values[k] ?? 'not set'}. Change it`} onPress={() => onOpen(k)} style={[styles.tile, k === 'how' && styles.full, { backgroundColor: ds.c.raised }]}>
            <Caption tone="muted">{LABELS[k]}</Caption>
            <View style={styles.tileValue}>
              <Spec numberOfLines={1} color={values[k] ? undefined : ds.c.muted} style={styles.flex}>
                {values[k] ?? 'Add'}
              </Spec>
              <IconSymbol name="chevron.down" size={12} color={ds.c.muted} />
            </View>
          </PressableScale>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <Headline role="heading">How it keeps</Headline>
      <View>
        {keys.map((k, i) => (
          <View key={k}>
            {i > 0 ? <RowDivider /> : null}
            <SettingsRow label={LABELS[k]} value={values[k] ?? 'Add'} onPress={() => onOpen(k)} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** One of How it keeps' small sheets. Changes land as they're made (and undo); Done closes it. */
export function KeepsSheet({ field, fields, set, onClose, units = YIELD_UNITS }: { field: KeepsField; fields: PrepFields; set: (patch: Partial<PrepFields>) => void; onClose: () => void; /** What Makes offers (ice: pieces or kg). */ units?: readonly string[] }) {
  const toggle = (a: string) => set({ actions: fields.actions.includes(a) ? fields.actions.filter((x) => x !== a) : [...fields.actions, a] });
  return (
    <Sheet visible onClose={onClose} accessibilityLabel={LABELS[field]} keyboard style={styles.sheetPad} header={<Headline role="heading">{LABELS[field]}</Headline>}>
      <SheetScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        {field === 'makes' ? (
          <>
            <Field label="One batch makes" value={fields.yieldAmount} onChangeText={(yieldAmount) => set({ yieldAmount })} placeholder="750" keyboardType="decimal-pad" />
            <Choice label="Unit" options={units.map((u) => ({ value: u, label: u }))} value={fields.yieldUnit} onChange={(yieldUnit) => set({ yieldUnit })} />
          </>
        ) : field === 'keeps' ? (
          <>
            <Field label="Keeps for" value={fields.keeps} onChangeText={(keeps) => set({ keeps })} placeholder="4" keyboardType="decimal-pad" />
            <Choice label="Unit" options={KEEPS_UNITS.map((u) => ({ value: u.value, label: u.value }))} value={fields.keepsUnit} onChange={(keepsUnit) => set({ keepsUnit })} />
          </>
        ) : field === 'store' ? (
          <>
            <View role="radiogroup" accessibilityLabel="Where it's stored" style={styles.chips}>
              {STORAGE_PICKS.map((s) => (
                <Chip key={s} label={s} selected={fields.storage === s} onPress={() => set({ storage: fields.storage === s ? '' : s })} />
              ))}
            </View>
            <Field label="Or say how" value={fields.storage} onChangeText={(storage) => set({ storage })} placeholder="Fridge, sealed bottle" maxLength={60} />
          </>
        ) : field === 'takes' ? (
          <>
            <Field label="Minutes" value={fields.takes} onChangeText={(takes) => set({ takes })} placeholder="20" keyboardType="number-pad" hint="Hands-off time before it's ready, so the prep list can say when to start." />
            <Field label="Or say it" value={fields.takesNote} onChangeText={(takesNote) => set({ takesNote })} placeholder="24 h drip" maxLength={60} />
          </>
        ) : (
          <View role="group" accessibilityLabel="How it's made" style={styles.chips}>
            {PREP_ACTIONS.map((a) => (
              <Chip key={a} label={a} selected={fields.actions.includes(a)} multi onPress={() => toggle(a)} />
            ))}
          </View>
        )}
        <Button label="Done" onPress={onClose} />
      </SheetScrollView>
    </Sheet>
  );
}

/**
 * A house prep's Cost, worked out from its parts at the venue you're at:
 * a batch, a 30 ml pour when the batch is measured in ml, and each part.
 * Only for whoever sees costs there. The parts' prices change on their own
 * pages, so this reads the saved recipe.
 */
export function PrepCost({ itemId, fields, lines }: { itemId: string; fields: PrepFields; lines: { name: string; amount: string; unit: string }[] }) {
  const ds = useDs();
  const { active } = useActiveVenue();
  const barId = useMode().mode === 'home' ? null : (active?.id ?? null);
  const { data: caps } = useCapabilities(barId);
  const canCost = !!caps?.includes('costs');
  const { data: settings } = usePricingSettings(canCost ? barId : null);
  const { data: cost } = useDrinkCost(itemId, barId, canCost);
  if (!canCost || !cost || !settings?.currency) return null;

  const money = (minor: number | null) => formatMoney(minor, settings.currency) ?? 'No price';
  const y = toQuantity(prepCardInput(fields).input.prep.yield_amount, fields.yieldUnit);
  const pour = y?.kind === 'ml' && cost.total_minor ? Math.round((cost.total_minor / y.value) * 30) : null;
  const firstPriced = cost.lines.find((l) => l.minor)?.ingredient;
  return (
    <View style={styles.section}>
      <Headline role="heading">Cost</Headline>
      <View style={styles.costRow}>
        <Spec color={ds.accentText}>{`${money(cost.total_minor)} a batch`}</Spec>
        {pour !== null ? <Caption tone="muted">{`${money(pour)} a 30 ml pour`}</Caption> : null}
      </View>
      <Caption tone="muted">{`Worked out from its parts.${firstPriced ? ` Change a price on ${firstPriced} and this follows.` : ''}${cost.missing ? ` ${cost.missing} ${cost.missing === 1 ? 'part has' : 'parts have'} no price yet.` : ''}`}</Caption>
      <View>
        {cost.lines.map((l, i) => {
          const line = lines.find((r) => r.name === l.ingredient);
          const amount = line?.amount ? `, ${line.amount} ${line.unit}`.trimEnd() : '';
          return (
            <View key={`${l.ingredient}-${i}`} style={[styles.part, { borderBottomColor: ds.c.line }]}>
              <Body style={styles.flex} numberOfLines={1}>{`${l.ingredient}${amount}`}</Body>
              <Body tone={l.minor === null ? 'muted' : undefined}>{money(l.minor)}</Body>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 2, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.control },
  full: { flexBasis: '100%' },
  tileValue: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  sheetPad: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  sheet: { gap: space.md, paddingTop: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  costRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, flexWrap: 'wrap' },
  part: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth },
});
