import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, LockedSection, Spec, Tag, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useDrinkCost, useSetMenuPrice } from '@/hooks/useDrinkCost';
import { usePricingSettings } from '@/hooks/usePricing';
import { formatPct, margin, priceForTarget, targetStatus } from '@/lib/costing';
import { formatMoney, moneyFieldValue, parseMoney } from '@/lib/money';
import { roleLabel } from '@/lib/roles';

interface CostSectionProps {
  itemId: string;
  barId: string | null;
  priceMinor: number | null | undefined;
  /** The viewer can edit the drink (its menu price). */
  canEdit: boolean;
}

/**
 * Cost and margin: cost per serve through every sub-recipe at today's pack
 * prices, the menu price with and without tax, GP and pour cost, and the
 * price that hits the venue's target. Locked until the costs capability;
 * the server returns nothing below it either.
 */
export function CostSection({ itemId, barId, priceMinor, canEdit }: CostSectionProps) {
  const { data: capabilities } = useCapabilities(barId);
  const { data: opensAtLevel } = useCapabilityOpensAt(barId, 'costs');
  const unlocked = !!barId && !!capabilities?.includes('costs');
  const { data: settings } = usePricingSettings(unlocked ? barId : null);
  const { data: cost, isPending, error } = useDrinkCost(itemId, barId, unlocked);
  if (!barId) return null;
  return (
    <LockedSection title="Cost and margin" unlocked={unlocked} opensAt={opensAtLevel ? roleLabel(opensAtLevel) : 'Admin'}>
      {error ? <Body tone="muted">Couldn’t work out the cost. Check your connection and try again.</Body> : null}
      {isPending && !error ? <Caption tone="muted">Adding it up…</Caption> : null}
      {cost && settings ? <Costed itemId={itemId} barId={barId} cost={cost} priceMinor={priceMinor ?? null} canEdit={canEdit} currency={settings.currency} taxRate={settings.tax_rate} pricesIncludeTax={settings.prices_include_tax} targetGp={settings.target_gp} /> : null}
    </LockedSection>
  );
}

interface CostedProps {
  itemId: string;
  barId: string;
  cost: NonNullable<ReturnType<typeof useDrinkCost>['data']>;
  priceMinor: number | null;
  canEdit: boolean;
  currency: string | null;
  taxRate: number;
  pricesIncludeTax: boolean;
  targetGp: number | null;
}

function Costed({ itemId, barId, cost, priceMinor, canEdit, currency, taxRate, pricesIncludeTax, targetGp }: CostedProps) {
  const ds = useDs();
  const router = useRouter();
  const tax = { taxRate, pricesIncludeTax };
  const money = (minor: number | null | undefined) => formatMoney(minor, currency) ?? (minor == null ? 'no price' : String(minor));
  const m = margin(cost.total_minor, priceMinor, tax);
  const target = targetStatus(cost.total_minor, priceMinor, targetGp, tax);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currency ? moneyFieldValue(priceMinor, currency) : '');
  const [ask, setAsk] = useState(targetGp == null ? '' : String(targetGp));
  const setPrice = useSetMenuPrice(itemId);
  const askN = Number(ask);
  const askPrice = ask.trim() && Number.isFinite(askN) ? priceForTarget(cost.total_minor, askN, tax) : null;
  const draftMinor = currency ? parseMoney(draft, currency) : null;

  if (!currency) {
    return (
      <Body tone="muted">
        Set the venue’s currency in Pricing first.{' '}
        <Body tone="accent" role="link" onPress={() => router.push(`/settings/bar/${barId}/pricing` as Href)}>
          Open Pricing
        </Body>
      </Body>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.headline}>
        <Spec tone="accent" style={styles.big}>
          {money(cost.total_minor)}
        </Spec>
        <Caption tone="muted">cost per serve at today’s prices{cost.missing ? `, ${cost.missing} ${cost.missing === 1 ? 'line' : 'lines'} still without a price` : ''}</Caption>
      </View>
      <View>
        {cost.lines.map((l, i) => (
          <View key={`${l.ingredient}-${i}`} accessible accessibilityLabel={`${l.ingredient}, ${l.minor == null ? 'no price yet' : money(l.minor)}`} style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <Body style={styles.name}>{l.ingredient}</Body>
            {l.garnish ? <Tag label="Garnish" /> : null}
            {l.minor == null ? <Tag label="Needs a price" tone="warning" /> : <Spec tone="muted">{money(l.minor)}</Spec>}
          </View>
        ))}
        {cost.ice_minor ? (
          <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <Body style={styles.name}>Ice</Body>
            <Spec tone="muted">{money(cost.ice_minor)}</Spec>
          </View>
        ) : null}
      </View>
      <View style={styles.facts}>
        <Fact label="Menu price" value={priceMinor == null ? 'Not set' : money(priceMinor)} sub={m ? (pricesIncludeTax ? `${money(Math.round(m.exTaxMinor))} without tax` : 'tax added at the till') : undefined} />
        <Fact label="GP" value={m ? formatPct(m.gp) : '–'} sub={m ? `pour cost ${formatPct(m.pourCost)}` : 'set a price'} />
      </View>
      {target ? (
        <Body>
          Your target is {targetGp}%. {target.onTarget ? 'This drink is on target.' : `${money(target.priceMinor)} gets there.`}
        </Body>
      ) : null}
      {canEdit ? (
        editing ? (
          <View style={styles.edit}>
            <Field label={`Menu price (${currency})`} value={draft} onChangeText={setDraft} placeholder="12.00" keyboardType="decimal-pad" hint="Leave blank to clear it." />
            <View style={styles.actions}>
              <Button label={setPrice.isPending ? 'Saving…' : 'Save price'} disabled={setPrice.isPending || (!!draft.trim() && draftMinor === null)} onPress={() => setPrice.mutateAsync(draft.trim() ? draftMinor : null).then(() => setEditing(false), () => {})} />
              <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
            </View>
            {setPrice.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
          </View>
        ) : (
          <Button label={priceMinor == null ? 'Set price' : 'Change price'} variant="secondary" onPress={() => setEditing(true)} style={styles.button} />
        )
      ) : null}
      <View style={styles.calc}>
        <Field label="Price for a GP of (percent)" value={ask} onChangeText={setAsk} placeholder="80" keyboardType="decimal-pad" />
        <Caption tone="muted">{askPrice == null ? 'Enter a GP under 100 to see the menu price it needs.' : `${money(askPrice)} on the menu${pricesIncludeTax ? `, with ${taxRate}% tax in it` : ''}.`}</Caption>
      </View>
    </View>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const ds = useDs();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`} style={[styles.fact, { backgroundColor: ds.c.raised }]}>
      <Caption tone="muted">{label}</Caption>
      <Spec>{value}</Spec>
      {sub ? <Caption tone="muted">{sub}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  headline: { gap: 2 },
  big: { fontSize: space.xxl, lineHeight: space.xxl + space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fact: { flexGrow: 1, flexBasis: '40%', padding: space.md, borderRadius: space.md, gap: 2 },
  edit: { gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  button: { alignSelf: 'flex-start' },
  calc: { gap: space.xs, marginTop: space.sm },
});
