import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider, Caption, GlassButton, Surface, useDs, useGutter } from '@/components/ds';
import { PencilState } from '@/components/ds/PencilState';
import { ItemTitle } from '@/components/screens/drink/ItemTitle';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { dayHues, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useFridge, useMakerNames } from '@/hooks/useBatches';
import { labelDate } from '@/lib/makeSteps';
import { fridgeRows, type FridgeRow } from '@/lib/paper/label';

const DOT = 14;

/**
 * In the fridge (Bet-labels): the bar's house-made, each by its latest batch,
 * newest made first, with the day's colour its label wears and which to use
 * today. A row opens the house-made's page as scanned from that batch's label.
 */
export function FridgeScreen() {
  const { active } = useActiveVenue();
  return (
    <BackbarTheme>
      <BrandProvider accent={active?.accent ?? undefined}>
        <Fridge bar={active ? { id: active.id, name: active.name } : null} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function Fridge({ bar }: { bar: { id: string; name: string } | null }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const fridge = useFridge(bar?.id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));
  let body;
  if (!bar) body = <PencilState kind="empty" title="In the fridge is for a bar’s house-made." />;
  else if (fridge.isError) body = <PencilState kind="error" title="Couldn’t load the fridge" detail="Check your connection and try again." action={{ label: 'Try again', onPress: () => void fridge.refetch() }} />;
  else if (!fridge.data) body = <PencilState kind="loading" title="Opening the fridge…" />;
  else body = <FridgeRows barId={bar.id} rows={fridgeRows(fridge.data, new Date())} />;
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: insets.top + space.sm }]}>
      <View style={{ paddingHorizontal: gutter }}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={back} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }]}>
        <ItemTitle eyebrow={bar ? `${bar.name}’s · by day made` : null} name="In the fridge" />
        {body}
      </ScrollView>
    </View>
  );
}

/** The fridge's rows, for any page that lists a bar's batches (the Drinks lane's House-made can use them). */
export function FridgeRows({ barId, rows }: { barId: string; rows: FridgeRow[] }) {
  const ds = useDs();
  const router = useRouter();
  const makers = useMakerNames(barId);
  if (!rows.length) return <PencilState kind="empty" title="Nothing logged in the last two weeks." detail="Log batch on a house-made adds it here, with its label." />;
  return (
    <Surface style={styles.card}>
      {rows.map((r, i) => {
        const by = r.batch.madeBy ? makers[r.batch.madeBy] : undefined;
        const use = r.use === 'today' ? 'Use today' : r.use === 'past' ? 'Past its use-by' : null;
        return (
          <View key={r.batch.id}>
            {i ? <RowDivider /> : null}
            <SettingsRow
              leading={<View style={[styles.dot, { backgroundColor: dayHues[r.made.getDay()], borderColor: ds.c.lineStrong }]} aria-label={`Made ${r.made.toLocaleDateString('en-GB', { weekday: 'long' })}`} />}
              label={r.batch.name}
              detail={`${labelDate(r.made)}${by ? ` · ${by}` : ''}`}
              onPress={() => router.push(`/ingredient/${r.batch.itemId}?batch=${r.batch.id}` as Href)}
              trailing={
                <View style={styles.trail}>
                  {use ? <Caption color={ds.accentText}>{use}</Caption> : null}
                  <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
                </View>
              }
            />
          </View>
        );
      })}
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingTop: space.lg, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { padding: 0, overflow: 'hidden' },
  // The ring keeps Sunday's near-black dot visible in dark mode.
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: StyleSheet.hairlineWidth },
  trail: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
