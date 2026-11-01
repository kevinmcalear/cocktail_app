import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { space } from '@/constants/tokens';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkGuestSays } from '@/hooks/useScores';
import { useDrinkCost } from '@/hooks/useDrinkCost';
import { useDrinkOnMenu } from '@/hooks/useDrinkOnMenu';
import type { GlassFillResult } from '@/hooks/useGlassFill';
import { usePricingSettings } from '@/hooks/usePricing';
import { useItemVersions } from '@/hooks/useVersions';
import { formatPct, margin } from '@/lib/costing';
import { fillWords } from '@/lib/glassFill';
import { formatMoney, priceMinor } from '@/lib/money';
import type { SpecLine } from '@/lib/spec';
import { versionLine } from '@/lib/specDiff';
import type { DatabaseItem } from '@/types/types';

import { MenuSheet } from '../menus/MenuSheet';
import { CostSection } from './CostSection';
import { HistorySection } from './HistorySection';
import { RowGroup, type GroupRow } from './RowGroup';

interface BarRowsProps {
  item: DatabaseItem;
  barId: string;
  barName: string | null;
  lines: SpecLine[];
  /** How full the bar's glass comes (QA Q38); null without a wash line. */
  fill: GlassFillResult | null;
  onGlass: () => void;
  /** Drink Creator and Admin: cost and menus. */
  creator: boolean;
  canEdit: boolean;
}

/**
 * The bar's own rows under the spec (boards Draw-scroll, Desk-page): Behind
 * the bar for whoever makes it (its house-made parts, the fill line, spec
 * changes), and for Drink Creator and Admin, cost and the menus it's on.
 * Rows, never buttons; each opens what it names.
 */
export function BarRows({ item, barId, barName, lines, fill, onGlass, creator, canEdit }: BarRowsProps) {
  const router = useRouter();
  const [open, setOpen] = useState<'history' | 'cost' | null>(null);
  const caps = useCapabilities(barId).data ?? [];
  const latest = useItemVersions(item.id, caps.includes('specs')).data?.[0];
  const costs = creator && caps.includes('costs');
  const { data: cost } = useDrinkCost(item.id, barId, costs);
  const { data: pricing } = usePricingSettings(costs ? barId : null);
  const { data: onMenu } = useDrinkOnMenu(item.id, barId);
  const now = useDrinkGuestSays(creator && caps.includes('edit_drinks') ? item.id : null).data?.versions[0];
  const guestsLine = now ? (now.liked != null ? `${now.liked} liked` : `${now.rankers} ${now.rankers === 1 ? 'rank' : 'ranks'}`) : null;

  const behind: GroupRow[] = [
    ...lines
      .filter((l) => l.houseMade && l.ingredientId)
      .map((l) => ({ key: `prep-${l.key}`, label: l.ingredient ?? 'House-made', value: 'House-made', onPress: () => router.push(`/ingredient/${l.ingredientId}` as Href) })),
    ...(fill ? [{ key: 'fill', label: 'Fill line', value: fillWords(fill.fill), onPress: onGlass }] : []),
    ...(latest ? [{ key: 'changes', label: 'Spec changes', value: `Version ${latest.version} · ${versionLine(latest.created_at, latest.created_by_name)}`, onPress: () => setOpen('history') }] : []),
  ];

  const money = cost && pricing?.currency ? formatMoney(cost.total_minor, pricing.currency) : null;
  const m = cost && pricing?.currency ? margin(cost.total_minor, priceMinor(onMenu?.price ?? item.price, pricing.currency), { taxRate: pricing.tax_rate, pricesIncludeTax: pricing.prices_include_tax }) : null;
  const atBar: GroupRow[] = creator
    ? [
        ...(costs ? [{ key: 'cost', label: 'Cost', value: money ? [money, m ? `${formatPct(m.gp)} GP` : null].filter(Boolean).join(' · ') : null, onPress: () => setOpen('cost') }] : []),
        ...(onMenu ? [{ key: 'menu', label: 'On menus', value: onMenu.name, onPress: () => router.push(`/menus/${onMenu.menuId}` as Href) }] : []),
        // Loop-reasons: liked, fine and not for me, and why, version by version.
        ...(caps.includes('edit_drinks')
          ? [{ key: 'guests', label: 'What guests say', value: guestsLine, onPress: () => router.push({ pathname: '/guests/[itemId]', params: { itemId: item.id, name: item.name, ...(barName ? { bar: barName } : {}) } }) }]
          : []),
      ]
    : [];

  return (
    <View style={{ gap: space.xl }}>
      <RowGroup title="Behind the bar" rows={behind} />
      <RowGroup title={barName ? `At ${barName}` : 'At the bar'} rows={atBar} />
      {open === 'history' ? (
        <MenuSheet visible onClose={() => setOpen(null)} title="Spec changes" subtitle={item.name}>
          <HistorySection itemId={item.id} barId={barId} canEdit={canEdit} />
        </MenuSheet>
      ) : null}
      {open === 'cost' ? (
        <MenuSheet visible onClose={() => setOpen(null)} title="Cost and margin" subtitle={item.name}>
          <CostSection itemId={item.id} barId={barId} price={item.price} onMenu={onMenu} />
        </MenuSheet>
      ) : null}
    </View>
  );
}
