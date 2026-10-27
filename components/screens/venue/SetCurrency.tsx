import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, Surface } from '@/components/ds';
import { CurrencyPicker } from '@/components/screens/venueSetup/CurrencyPicker';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useSetBarCurrency, useShownCurrency } from '@/hooks/usePricing';
import { useEffectiveRole } from '@/hooks/useViewAs';

/** bars_update needs an Admin (level 40). */
const ADMIN = 40;

/**
 * Costing with no currency yet: an Admin picks it right here (the country's
 * first, already chosen) and the costs follow; everyone else is told who
 * can, with Pricing a tap away. Tax and targets stay in Pricing.
 */
export function SetCurrency({ barId, what }: { barId: string; what: string }) {
  const router = useRouter();
  const venueName = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'the venue';
  const canEdit = useEffectiveRole(barId) >= ADMIN;
  const guess = useShownCurrency(barId);
  const [picked, setPicked] = useState<string | null>(null);
  const currency = picked ?? guess;
  const save = useSetBarCurrency();
  const openPricing = () => router.push(`/settings/bar/${barId}/pricing` as Href);

  return (
    <Surface style={styles.card}>
      <Headline>{canEdit ? `What currency does ${venueName} use?` : `${venueName} has no currency yet`}</Headline>
      <Body tone="muted">
        {canEdit ? `${what} needs it to count costs, prices and GP. You only set it once.` : `${what} needs it to count costs, prices and GP. An Admin sets it in Pricing.`}
      </Body>
      {canEdit ? <CurrencyPicker value={currency} first={guess} onPick={setPicked} /> : null}
      <View style={styles.actions}>
        {canEdit ? (
          <Button
            label={save.isPending ? 'Saving…' : currency ? `Use ${currency}` : 'Pick a currency'}
            disabled={!currency || save.isPending}
            onPress={() => currency && save.mutate({ barId, currency })}
          />
        ) : null}
        <Button label={canEdit ? 'Tax and targets' : 'Open Pricing'} variant={canEdit ? 'ghost' : 'secondary'} onPress={openPricing} />
      </View>
      {save.error ? (
        <Caption tone="accent" role="alert">
          Couldn’t save. Check your connection and try again.
        </Caption>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
