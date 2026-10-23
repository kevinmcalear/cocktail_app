import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkCost } from '@/hooks/useDrinkCost';
import { usePricingSettings } from '@/hooks/usePricing';
import { targetsLine, targetStatus } from '@/lib/costing';
import { formatMoney, priceText } from '@/lib/money';

export interface SuggestedPrice {
  /** As the drink's price would be typed: "24.50". */
  text: string;
  /** "$24.50". */
  money: string;
  /** "$4.90". */
  cost: string;
  /** "78% GP and at least $11.00 a drink". */
  wants: string;
}

/**
 * The price that clears the bar's targets for a drink with a cost and no
 * price (canvas "Every drink has one price", step 6): the same price menu
 * costing shows under Hits target at. Never stored; the bar taps it to use
 * it. Null without the costs capability, a currency, a target, or a full
 * cost (a line with no price would make it too low).
 */
export function useSuggestedPrice(itemId: string, barId: string | null | undefined, enabled: boolean): SuggestedPrice | null {
  const { data: caps } = useCapabilities(enabled ? barId : null);
  const unlocked = enabled && !!caps?.includes('costs');
  const { data: settings } = usePricingSettings(unlocked ? barId : null);
  const { data: cost } = useDrinkCost(itemId, barId, unlocked);
  const currency = settings?.currency;
  if (!unlocked || !settings || !currency || !cost || cost.missing > 0 || cost.total_minor <= 0) return null;
  const targets = { gp: settings.target_gp, minProfitMinor: settings.min_profit_minor };
  const status = targetStatus(cost.total_minor, null, targets, { taxRate: settings.tax_rate ?? 0, pricesIncludeTax: settings.prices_include_tax ?? true });
  const money = (minor: number) => formatMoney(minor, currency) ?? '';
  const wants = targetsLine(targets, money);
  if (!status || status.onTarget || !wants) return null;
  return { text: priceText(status.priceMinor, currency), money: money(status.priceMinor), cost: money(cost.total_minor), wants };
}
