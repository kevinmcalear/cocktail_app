import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Headline, LockedSection, Spec, Tag, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useDrinkCost, useSetDrinkPrice } from '@/hooks/useDrinkCost';
import { usePricingSettings } from '@/hooks/usePricing';
import { withAlpha } from '@/lib/color';
import { formatPct, margin, priceForTarget, targetsLine, targetStatus, type Margin, type Targets } from '@/lib/costing';
import { formatPrice } from '@/lib/menus';
import { formatMoney, priceMinor, priceText } from '@/lib/money';
import { roleLabel } from '@/lib/roles';

interface CostSectionProps {
  itemId: string;
  barId: string | null;
  /** The drink's one price, as typed ("19.50", "MP"); every menu with it shows it. */
  price: string | null | undefined;
  /** The viewer can edit the drink (its price). */
  canEdit: boolean;
}

/**
 * Cost and margin: cost per serve through every sub-recipe at today's pack
 * prices, the drink's price with and without tax, profit, GP and pour cost.
 * Under the venue's targets (a GP, and the least a drink should make) it
 * says so with the price that clears them, and editors can use it
 * (drink-cost-floor). Locked until the costs capability; the server returns
 * nothing below it either.
 */
export function CostSection({ itemId, barId, price, canEdit }: CostSectionProps) {
  const { data: capabilities } = useCapabilities(barId);
  const { data: opensAtLevel } = useCapabilityOpensAt(barId, 'costs');
  const unlocked = !!barId && !!capabilities?.includes('costs');
  const { data: settings } = usePricingSettings(unlocked ? barId : null);
  const { data: cost, isPending, error } = useDrinkCost(itemId, barId, unlocked);
  if (!barId) return null;
  return (
    <LockedSection title="Cost and margin" unlocked={unlocked} opensAt={opensAtLevel ? roleLabel(opensAtLevel) : 'Drink Creator'}>
      {error ? <Body tone="muted">Couldn’t work out the cost. Check your connection and try again.</Body> : null}
      {isPending && !error ? <Caption tone="muted">Adding it up…</Caption> : null}
      {cost && settings ? <Costed itemId={itemId} barId={barId} cost={cost} price={formatPrice(price)} canEdit={canEdit} currency={settings.currency} taxRate={settings.tax_rate} pricesIncludeTax={settings.prices_include_tax} targets={{ gp: settings.target_gp, minProfitMinor: settings.min_profit_minor }} /> : null}
    </LockedSection>
  );
}

interface CostedProps {
  itemId: string;
  barId: string;
  cost: NonNullable<ReturnType<typeof useDrinkCost>['data']>;
  price: string | null;
  canEdit: boolean;
  currency: string | null;
  taxRate: number;
  pricesIncludeTax: boolean;
  targets: Targets;
}

function Costed({ itemId, barId, cost, price, canEdit, currency, taxRate, pricesIncludeTax, targets }: CostedProps) {
  const ds = useDs();
  const router = useRouter();
  const tax = { taxRate, pricesIncludeTax };
  const money = (minor: number | null | undefined) => formatMoney(minor, currency) ?? (minor == null ? 'no price' : String(minor));
  // Every line unpriced: no cost yet, so no margin either.
  const known = !(cost.total_minor === 0 && cost.missing > 0);
  // The number in the typed price; MP and the like have none, so no margin.
  const priceMinorValue = currency ? priceMinor(price, currency) : null;
  const m = known ? margin(cost.total_minor, priceMinorValue, tax) : null;
  const target = known ? targetStatus(cost.total_minor, priceMinorValue, targets, tax) : null;
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'The venue';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(price ?? '');
  const [ask, setAsk] = useState(targets.gp == null ? '' : String(targets.gp));
  const setPrice = useSetDrinkPrice(itemId);
  const askN = Number(ask);
  const askPrice = known && ask.trim() && Number.isFinite(askN) ? priceForTarget(cost.total_minor, askN, tax) : null;

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
          {known ? money(cost.total_minor) : 'No cost yet'}
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
        <Fact label="Price" value={priceMinorValue != null ? money(priceMinorValue) : (price ?? 'None')} sub={m ? (pricesIncludeTax ? `${money(Math.round(m.exTaxMinor))} without tax` : 'tax added at the till') : price ? 'no number in it: no margin worked out' : 'add one to see the margin'} />
        <Fact label="Profit" value={m ? money(Math.round(m.profitMinor)) : '–'} sub={m ? 'after tax and ingredients' : 'set a price'} />
        <Fact label="GP" value={m ? formatPct(m.gp) : '–'} sub={m ? `pour cost ${formatPct(m.pourCost)}` : 'set a price'} />
      </View>
      {target?.onTarget ? <Body tone="muted">{`On ${venueName}’s target: ${targetsLine(targets, money)}.`}</Body> : null}
      {target && !target.onTarget ? (
        <UnderTarget
          venueName={venueName}
          wants={targetsLine(targets, money) ?? ''}
          margin={m}
          price={money(target.priceMinor)}
          both={targets.gp != null && targets.minProfitMinor != null}
          money={money}
          onUse={canEdit ? () => setPrice.mutate(priceText(target.priceMinor, currency)) : undefined}
          busy={setPrice.isPending}
          onPricing={() => router.push(`/settings/bar/${barId}/pricing` as Href)}
        />
      ) : null}
      {setPrice.error && !editing ? <Caption tone="accent" role="alert">{"Couldn't save the price. Check your connection and try again."}</Caption> : null}
      {canEdit ? (
        editing ? (
          <View style={styles.edit}>
            <Field label={`Price (${currency})`} value={draft} onChangeText={setDraft} placeholder="12.00 or MP" hint="As the menu prints it. Every menu with this drink shows it; blank clears it." />
            <View style={styles.actions}>
              <Button label={setPrice.isPending ? 'Saving…' : 'Save price'} disabled={setPrice.isPending} onPress={() => setPrice.mutateAsync(draft).then(() => setEditing(false), () => {})} />
              <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} />
            </View>
            {setPrice.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
          </View>
        ) : (
          <Button label={price == null ? 'Add a price' : 'Change price'} variant="secondary" onPress={() => setEditing(true)} style={styles.button} />
        )
      ) : null}
      <View style={styles.calc}>
        <Field label="Price for a GP of (percent)" value={ask} onChangeText={setAsk} placeholder="80" keyboardType="decimal-pad" />
        <Caption tone="muted">{askPrice == null ? 'Enter a GP under 100 to see the menu price it needs.' : `${money(askPrice)} on the menu${pricesIncludeTax ? `, with ${taxRate}% tax in it` : ''}.`}</Caption>
      </View>
    </View>
  );
}

/** Under the venue's targets: what it wants, what this drink makes, and the price that clears it (drink-cost-floor). */
function UnderTarget({ venueName, wants, margin: m, price, both, money, onUse, busy, onPricing }: {
  venueName: string;
  wants: string;
  margin: Margin | null;
  price: string;
  both: boolean;
  money: (minor: number) => string;
  onUse?: () => void;
  busy: boolean;
  onPricing: () => void;
}) {
  const ds = useDs();
  const makes = m ? `This one makes ${formatPct(m.gp)} and ${money(Math.round(m.profitMinor))}.` : 'It has no price yet.';
  return (
    <View role="status" style={[styles.under, { borderColor: withAlpha(ds.accentText, 0.45), backgroundColor: withAlpha(ds.accentText, 0.1) }]}>
      <View style={styles.underHead}>
        <IconSymbol name="exclamationmark.triangle" size={18} color={ds.accentText} />
        <Headline>{`Under ${venueName}’s target`}</Headline>
      </View>
      <Body>{`${venueName} wants ${wants}. ${makes} ${price} on the menu clears ${both ? 'both' : 'it'}.`}</Body>
      <View style={styles.actions}>
        {onUse ? <Button label={busy ? 'Saving…' : `Use ${price}`} disabled={busy} onPress={onUse} /> : null}
        <Button label="Pricing" variant="secondary" onPress={onPricing} />
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
  under: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  underHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
