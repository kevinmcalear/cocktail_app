import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider, Button, GlassButton, Headline, PencilState, PressableScale, TextLink, useDs, useGutter } from '@/components/ds';
import { copyForTape, LabelCard, useLabelPrint } from '@/components/screens/make/MakeLabel';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDrinkAllergens } from '@/hooks/useAllergens';
import { useBatch, useMakerNames } from '@/hooks/useBatches';
import { useIngredient } from '@/hooks/useIngredients';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useItemPrep } from '@/hooks/usePrepCard';
import { allergenLabel } from '@/lib/allergens';
import { batchPageUrl } from '@/lib/itemRoutes';
import { labelFromBatch, type BatchLabel } from '@/lib/paper/label';
import { siteOrigin } from '@/lib/venueLink';

/** What `/label?batch=<batch id>` was opened with: labelHref's facts, when the batch was just logged. */
export interface LabelParams {
  id: string;
  item?: string;
  amount?: string;
  unit?: string;
  made?: string;
}

/**
 * Made. Label it. (Bet-labels): the label for a batch of house-made, drawn as
 * it prints, with Print or share label and Copy for tape. Opened by Log batch
 * with the batch's own facts (so it draws before the batch has sent), or by a
 * batch id alone, which reads the batch.
 */
export function LabelScreen(params: LabelParams) {
  const fresh = !!(params.item && params.amount && params.unit && params.made);
  const batch = useBatch(fresh ? null : params.id);
  const itemId = params.item ?? batch.data?.itemId ?? null;
  const it = useLabel(params, fresh, batch.data ?? null, itemId);
  const { venues } = useActiveVenue();
  const venue = venues.find((v) => v.id === it.barId);

  let body: ReactNode;
  if (batch.isError || it.failed) {
    const retry = () => (batch.isError ? void batch.refetch() : it.retry());
    body = <PencilState kind="error" title="Couldn’t draw the label" detail="Check your connection and try again." action={{ label: 'Try again', onPress: retry }} />;
  } else if ((!fresh && batch.isSuccess && !batch.data) || it.missing) body = <PencilState kind="empty" title="This batch isn’t there any more, or it isn’t yours to see." />;
  else if (!it.label) body = <PencilState kind="loading" title="Drawing the label…" />;
  else body = <Label label={it.label} />;
  return (
    <BackbarTheme>
      <BrandProvider accent={venue?.accent ?? undefined}>
        <Frame>{body}</Frame>
      </BrandProvider>
    </BackbarTheme>
  );
}

/**
 * The label's facts: the batch, its house-made's name, keeping and storage,
 * its allergens, and who made it. It waits for the allergens: a food label
 * never prints without them while they're on their way.
 */
function useLabel(params: LabelParams, fresh: boolean, batch: { barId: string; amount: number; unit: string; madeAt: string; madeBy: string | null } | null, itemId: string | null) {
  const item = useIngredient(itemId ?? undefined);
  const prep = useItemPrep(itemId);
  const allergens = useDrinkAllergens(itemId);
  const me = useMyProfile().data;
  // The batch's bar, not the house-made's: a shared recipe has none.
  const names = useMakerNames(batch?.barId);
  const ingredient = item.data?.ingredient ?? null;
  const failed = !!item.error || !!prep.error;
  const missing = !!itemId && item.isSuccess && !ingredient;
  const retry = () => {
    void item.refetch();
    void prep.refetch();
  };
  const facts = fresh ? { amount: Number(params.amount), unit: params.unit!, madeAt: params.made!, madeBy: null } : batch;
  const waiting = !facts || !itemId || !ingredient || !prep.data || (allergens.isPending && !allergens.error);
  if (waiting) return { label: null, barId: ingredient?.bar_id ?? null, failed, missing, retry };
  const found = allergens.data;
  // Just logged: it's yours. Read back: whoever on the team made it.
  const maker = fresh ? (me?.displayName ?? null) : facts.madeBy ? (names[facts.madeBy] ?? null) : null;
  const label = labelFromBatch({
    name: ingredient.name,
    madeAt: facts.madeAt,
    amount: facts.amount,
    unit: facts.unit,
    shelfLifeHours: prep.data.prep?.shelf_life_hours ?? null,
    storage: prep.data.prep?.storage ?? null,
    allergens: found ? (found.allergens.length ? found.allergens.map((a) => allergenLabel(a.allergen)).join(', ') : 'No allergens') : '',
    maker,
    url: batchPageUrl(siteOrigin(), itemId, params.id),
  });
  return { label, barId: ingredient.bar_id, failed, missing, retry };
}

function Frame({ children }: { children: ReactNode }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm }]}>
      <View style={[styles.head, { paddingHorizontal: gutter }]}>
        <GlassButton icon="xmark" accessibilityLabel="Close" onPress={close} />
        <Headline role="heading" style={styles.title}>
          Made. Label it.
        </Headline>
        <PressableScale accessibilityLabel="Done" onPress={close} style={[styles.done, { backgroundColor: ds.accentFill.fill }]}>
          <IconSymbol name="checkmark" size={18} color={ds.accentFill.text} />
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }]}>{children}</ScrollView>
    </View>
  );
}

function Label({ label }: { label: BatchLabel }) {
  const printing = useLabelPrint();
  const [copied, setCopied] = useState(false);
  return (
    <View style={styles.stack}>
      <LabelCard label={label} pageRef={printing.ref} onPainted={printing.onPainted} />
      <Button label="Print or share label" variant="ink" size="lg" disabled={!printing.painted} onPress={() => void printing.print(label)} />
      <View style={styles.tape}>
        <TextLink label={copied ? 'Copied' : 'Copy for tape'} onPress={() => void copyForTape(label).then(setCopied)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center' },
  done: { width: layout.minTapTarget, height: layout.minTapTarget, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: space.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  stack: { gap: space.lg },
  tape: { alignSelf: 'center' },
});
