import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, Surface, Tag } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useMode } from '@/hooks/useMode';
import { useItemPurchase, usePricingSettings } from '@/hooks/usePricing';
import { formatMoney } from '@/lib/money';
import { roleLabel } from '@/lib/roles';

/**
 * How the venue buys an ingredient: the pack, who sells it, and what a pack
 * costs. Pack and supplier open with prep or costs; the price only with
 * costs, which is also what the database enforces. It only reads: a bottle's
 * price and size change in Edit (ingredient-edit-proposal), and the Library's
 * "Needs a price" filter lists what's left.
 */
export function PriceSection({ itemId }: { itemId: string }) {
  const { active } = useActiveVenue();
  const barId = useMode().mode === 'home' ? null : (active?.id ?? null);
  if (!barId) return null;
  return (
    <VenueBrandProvider>
      <Surface style={styles.card}>
        <Caption tone="muted" role="heading" style={styles.eyebrow}>
          PRICE AT {(active?.name ?? 'THE VENUE').toUpperCase()}
        </Caption>
        <PriceBody itemId={itemId} barId={barId} />
      </Surface>
    </VenueBrandProvider>
  );
}

function PriceBody({ itemId, barId }: { itemId: string; barId: string }) {
  const router = useRouter();
  const { data: capabilities } = useCapabilities(barId);
  const { data: costsOpenAt } = useCapabilityOpensAt(barId, 'costs');
  const canCost = !!capabilities?.includes('costs');
  const canPack = canCost || !!capabilities?.includes('prep');
  const { data: settings } = usePricingSettings(barId);
  const { data, isPending } = useItemPurchase(canPack ? itemId : null, barId);
  const currency = settings?.currency ?? null;

  if (!canPack) return <Caption tone="muted">Pack and price open at {costsOpenAt ? roleLabel(costsOpenAt) : 'Admin'}.</Caption>;
  if (isPending || !data) return <Caption tone="muted">Loading.</Caption>;

  const pack = data.pack?.pack_size_amount ? `${data.pack.pack_size_amount} ${data.pack.pack_size_unit}` : null;
  const supplier = data.suppliers.find((s) => s.id === data.pack?.supplier_id)?.name ?? null;
  const price = formatMoney(data.cost?.pack_cost_minor, currency);
  const line = [pack ? `Pack of ${pack}` : null, supplier, price ? `${price} a pack` : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.list}>
      {canCost && !price ? <Tag label="Needs a price" tone="warning" /> : null}
      <Caption tone="muted">{line || (canCost ? 'No pack, supplier or price yet.' : 'No pack or supplier yet.')}</Caption>
      {canCost && !currency ? (
        <Caption tone="accent" role="link" onPress={() => router.push(`/settings/bar/${barId}/pricing` as Href)}>
          Set the venue’s currency in Pricing before adding prices.
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  eyebrow: { letterSpacing: 1 },
  list: { gap: space.sm },
});
