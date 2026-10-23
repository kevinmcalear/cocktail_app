import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Headline, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkCost } from '@/hooks/useDrinkCost';
import { usePricingSettings } from '@/hooks/usePricing';
import { formatPct, margin, priceForTarget } from '@/lib/costing';
import { formatMoney, priceMinor, priceText } from '@/lib/money';

interface EditPriceProps {
  itemId: string;
  barId: string;
  /** The price as typed, saved with Done. */
  value: string;
  onChange: (price: string) => void;
}

/**
 * The editor's Price (board drink-read-and-edit): the drink's one price as the
 * menu prints it, what it makes at today's costs, and the price a GP needs,
 * with Use to put it in the box. The drink page's Cost and margin only reads.
 * Opens with the costs capability, as that section does.
 */
export function EditPrice({ itemId, barId, value, onChange }: EditPriceProps) {
  const ds = useDs();
  const { data: caps } = useCapabilities(barId);
  const unlocked = !!caps?.includes('costs');
  const { data: settings } = usePricingSettings(unlocked ? barId : null);
  const { data: cost } = useDrinkCost(itemId, barId, unlocked);
  const [ask, setAsk] = useState<string | null>(null);
  if (!unlocked || !settings?.currency) return null;

  const currency = settings.currency;
  const tax = { taxRate: settings.tax_rate, pricesIncludeTax: settings.prices_include_tax };
  const money = (minor: number) => formatMoney(minor, currency) ?? String(minor);
  // Every line unpriced: no cost yet, so no margin either (as Cost and margin).
  const known = !!cost && !(cost.total_minor === 0 && cost.missing > 0);
  const m = cost && known ? margin(cost.total_minor, priceMinor(value, currency), tax) : null;
  const gp = ask ?? (settings.target_gp == null ? '' : String(settings.target_gp));
  const gpN = Number(gp);
  const forGp = cost && known && gp.trim() && Number.isFinite(gpN) ? priceForTarget(cost.total_minor, gpN, tax) : null;
  const makes = cost && known ? [`Cost ${money(cost.total_minor)} a serve`, m && `profit ${money(Math.round(m.profitMinor))}`, m && `GP ${formatPct(m.gp)}`].filter(Boolean).join(' · ') : 'No cost yet: some lines have no price.';

  return (
    <View style={styles.section}>
      <Headline role="heading">Price</Headline>
      <Field label={`Price (${currency})`} value={value} onChangeText={onChange} placeholder="12.00 or MP" hint="As the menu prints it. Every menu with this drink shows it; blank clears it." />
      <Caption tone="muted">{makes}</Caption>
      {known ? (
        <View style={[styles.calc, { backgroundColor: ds.c.surface }]}>
          <Field label="Price for a GP of (percent)" value={gp} onChangeText={setAsk} placeholder="80" keyboardType="decimal-pad" />
          <View style={styles.row}>
            <Body style={styles.flex}>{forGp == null ? 'Enter a GP under 100.' : `${money(forGp)} on the menu`}</Body>
            {forGp != null ? <Button label="Use" variant="secondary" size="sm" accessibilityHint="Puts this price in the box" onPress={() => onChange(priceText(forGp, currency))} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  calc: { gap: space.sm, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
