import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Chip, Field, GlassButton, Headline, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { usePricingSettings, useSetPricingSettings } from '@/hooks/usePricing';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { COMMON_CURRENCIES, isCurrencyCode } from '@/lib/money';

/** bars_update needs an Admin (level 40). */
const ADMIN = 40;

/**
 * The venue's pricing settings: its one currency, whether menu prices carry
 * the tax, the tax rate, and the gross profit it aims for. Costing, GP and
 * the selling-price calculator all read these. Admins change them.
 */
export function PricingScreen({ barId }: { barId: string }) {
  return (
    <BackbarTheme>
      <PricingPage barId={barId} />
    </BackbarTheme>
  );
}

function PricingPage({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const canEdit = useEffectiveRole(barId) >= ADMIN;
  const { data, isLoading, error } = usePricingSettings(barId);
  const save = useSetPricingSettings(barId);
  // What the person has typed; anything untouched shows the saved figure.
  const [draft, setDraft] = useState<{ currency?: string; tax?: string; gp?: string; included?: boolean }>({});
  const currency = (draft.currency ?? data?.currency ?? '').toUpperCase();
  const tax = draft.tax ?? (data ? String(data.tax_rate) : '');
  const gp = draft.gp ?? (data?.target_gp == null ? '' : String(data.target_gp));
  const included = draft.included ?? data?.prices_include_tax ?? true;
  const taxN = tax.trim() === '' ? 0 : Number(tax);
  const gpN = gp.trim() === '' ? null : Number(gp);
  const problems = {
    currency: currency && !isCurrencyCode(currency) ? 'Three capital letters, like GBP or USD.' : null,
    tax: !Number.isFinite(taxN) || taxN < 0 || taxN > 100 ? 'A percent between 0 and 100.' : null,
    gp: gpN !== null && (!Number.isFinite(gpN) || gpN < 0 || gpN >= 100) ? 'A percent from 0 up to 100.' : null,
  };
  const invalid = Object.values(problems).some(Boolean);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Pricing</title>
      </WebHead>
      <View style={[styles.nav, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'} icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }} keyboardShouldPersistTaps="handled">
        <View style={styles.readable}>
          <Title>Pricing</Title>
          <Body tone="muted">
            The currency {venue?.name ?? 'the venue'} buys and sells in, how its menu prices handle tax, and the gross profit it aims for. Pack prices, cost per
            serve and GP on every drink page follow from these.
          </Body>
          {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
          {error ? <Body tone="muted">Couldn’t load the settings. Check your connection and try again.</Body> : null}
          <View style={styles.group}>
            <Headline>Currency</Headline>
            <View role="radiogroup" accessibilityLabel="Common currencies" style={styles.chips}>
              {COMMON_CURRENCIES.map((c) => (
                <Chip key={c} label={c} selected={currency === c} onPress={() => canEdit && setDraft((d) => ({ ...d, currency: c }))} />
              ))}
            </View>
            <Field label="Currency code (ISO 4217)" value={currency} onChangeText={(t) => setDraft((d) => ({ ...d, currency: t }))} placeholder="GBP" autoCapitalize="characters" editable={canEdit} error={problems.currency ?? undefined} hint="No cost is stored until the bar has one. Changing it later doesn't convert prices already entered." />
          </View>
          <View style={styles.group}>
            <Headline>Tax</Headline>
            <View role="radiogroup" accessibilityLabel="Do menu prices include tax" style={styles.chips}>
              <Chip label="Menu prices include tax" selected={included} onPress={() => canEdit && setDraft((d) => ({ ...d, included: true }))} />
              <Chip label="Tax is added at the till" selected={!included} onPress={() => canEdit && setDraft((d) => ({ ...d, included: false }))} />
            </View>
            <Field label="Tax rate (percent)" value={tax} onChangeText={(t) => setDraft((d) => ({ ...d, tax: t }))} placeholder="20" keyboardType="decimal-pad" editable={canEdit} error={problems.tax ?? undefined} hint={included ? 'GP is taken on the price without the tax.' : 'GP is taken on the menu price as shown.'} />
          </View>
          <View style={styles.group}>
            <Headline>Target GP</Headline>
            <Field label="Gross profit the bar aims for (percent)" value={gp} onChangeText={(t) => setDraft((d) => ({ ...d, gp: t }))} placeholder="80" keyboardType="decimal-pad" editable={canEdit} error={problems.gp ?? undefined} hint="Drinks under it are marked, and each one says the price that gets there." />
          </View>
          {canEdit ? (
            <Button
              label={save.isPending ? 'Saving…' : 'Save pricing'}
              disabled={save.isPending || invalid}
              onPress={() => save.mutate({ currency: currency || null, tax_rate: taxN, prices_include_tax: included, target_gp: gpN })}
              style={styles.save}
            />
          ) : (
            <Caption tone="muted">You can look, but changing these needs an Admin at this venue.</Caption>
          )}
          {save.error ? <Caption tone="accent">{"Couldn't save. Check your connection and try again."}</Caption> : null}
          {save.isSuccess ? <Caption tone="muted">Saved.</Caption> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: { flexDirection: 'row', paddingBottom: space.sm, minHeight: layout.minTapTarget },
  readable: { maxWidth: 560, width: '100%', gap: space.xl, paddingTop: space.md },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  save: { alignSelf: 'flex-start' },
});
