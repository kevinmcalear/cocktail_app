import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, LockedSection, Spec, Tag, useDs } from '@/components/ds';
import { SetCurrency } from '@/components/screens/venue/SetCurrency';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useDrinkCost } from '@/hooks/useDrinkCost';
import { usePricingSettings } from '@/hooks/usePricing';
import { withAlpha } from '@/lib/color';
import { formatPct, margin, targetsLine, targetStatus, type Margin, type Targets } from '@/lib/costing';
import { formatPrice } from '@/lib/menus';
import { formatMoney, priceMinor } from '@/lib/money';
import { roleLabel } from '@/lib/roles';

interface CostSectionProps {
  itemId: string;
  barId: string | null;
  /** The drink's one price, as typed ("19.50", "MP"); every menu with it shows it. */
  price: string | null | undefined;
  /** The menu on now with the drink, when it prints its own price for it: "$22.00 on Winter menu". */
  onMenu?: { name: string; price?: string | null } | null;
}

/**
 * Cost and margin: cost per serve through every sub-recipe at today's pack
 * prices, the drink's price with and without tax, profit, GP and pour cost.
 * Under the venue's targets (a GP, and the least a drink should make) it
 * says so with the price that clears them (drink-cost-floor). Read only: the
 * price and the GP helper are in the editor's Price (EditPrice). Locked until the costs capability; the server returns
 * nothing below it either.
 */
export function CostSection({ itemId, barId, price, onMenu }: CostSectionProps) {
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
      {cost && settings ? <Costed barId={barId} cost={cost} price={formatPrice(price)} onMenu={onMenu?.price ? { name: onMenu.name, price: onMenu.price } : null} currency={settings.currency} taxRate={settings.tax_rate} pricesIncludeTax={settings.prices_include_tax} targets={{ gp: settings.target_gp, minProfitMinor: settings.min_profit_minor }} /> : null}
    </LockedSection>
  );
}

interface CostedProps {
  barId: string;
  cost: NonNullable<ReturnType<typeof useDrinkCost>['data']>;
  price: string | null;
  onMenu: { name: string; price: string } | null;
  currency: string | null;
  taxRate: number;
  pricesIncludeTax: boolean;
  targets: Targets;
}

function Costed({ barId, cost, price, onMenu, currency, taxRate, pricesIncludeTax, targets }: CostedProps) {
  const ds = useDs();
  const router = useRouter();
  const tax = { taxRate, pricesIncludeTax };
  const money = (minor: number | null | undefined) => formatMoney(minor, currency) ?? (minor == null ? 'no price' : String(minor));
  // Every line unpriced: no cost yet, so no margin either.
  const known = !(cost.total_minor === 0 && cost.missing > 0);
  // The number in the typed price; MP and the like have none, so no margin.
  const priceMinorValue = currency ? priceMinor(price, currency) : null;
  // A menu's own price, as money when it has a number ("$22.00"), else as typed ("MP").
  const menuPrice = (typed: string) => {
    const minor = currency ? priceMinor(typed, currency) : null;
    return minor != null ? money(minor) : typed;
  };
  const m = known ? margin(cost.total_minor, priceMinorValue, tax) : null;
  const target = known ? targetStatus(cost.total_minor, priceMinorValue, targets, tax) : null;
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'The venue';

  if (!currency) return <SetCurrency barId={barId} what="Cost and margin" />;

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
        <Fact label="Price" value={priceMinorValue != null ? money(priceMinorValue) : (price ?? 'None')} sub={[m ? (pricesIncludeTax ? `${money(Math.round(m.exTaxMinor))} without tax` : 'tax added at the till') : price ? 'no number in it: no margin worked out' : 'add one to see the margin', onMenu && onMenu.price !== price ? `${menuPrice(onMenu.price)} on ${onMenu.name}` : null].filter(Boolean).join('; ')} />
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
          onPricing={() => router.push(`/settings/bar/${barId}/pricing` as Href)}
        />
      ) : null}
    </View>
  );
}

/** Under the venue's targets: what it wants, what this drink makes, and the price that clears it (drink-cost-floor). */
function UnderTarget({ venueName, wants, margin: m, price, both, money, onPricing }: {
  venueName: string;
  wants: string;
  margin: Margin | null;
  price: string;
  both: boolean;
  money: (minor: number) => string;
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
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  under: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  underHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
