// The bar's pricing settings read on its own, so a page that only reads them
// (a menu's cost column) doesn't carry the rest of hooks/usePricing.
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface PricingSettings {
  currency: string | null;
  tax_rate: number;
  prices_include_tax: boolean;
  target_gp: number | null;
  /** The least a drink should make after tax and ingredients, in minor units. */
  min_profit_minor: number | null;
}

const SETTINGS_COLUMNS = 'currency, tax_rate, prices_include_tax, target_gp, min_profit_minor';

/** The bar's currency, tax and targets (bars.*); readable by its members. */
export function usePricingSettings(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['pricing-settings', barId],
    enabled: !!barId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PricingSettings | null> => {
      const { data, error } = await supabase.from('bars').select(SETTINGS_COLUMNS).eq('id', barId!).maybeSingle();
      if (error) throw error;
      return (data as PricingSettings | null) ?? null;
    },
  });
}
