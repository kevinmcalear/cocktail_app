import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Display, DsText, GlassButton, PencilState, SpecRow, useDs, useGutter } from '@/components/ds';
// By path, not the ds barrel (DrawingHero does the same): its Reanimated pour stays off the web's every-page chunk.
import { DrinkDrawingFor } from '@/components/ds/DrinkDrawing';
import { DrinkSky, useSkyColour } from '@/components/screens/drink/DrawingHero';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCocktail } from '@/hooks/useCocktails';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { useStaffRound } from '@/hooks/useStaffRound';
import { specLines, type PresentationRecipe } from '@/lib/spec';
import { scaledAmount } from '@/lib/specView';
import { useSettingsStore } from '@/store/useSettingsStore';

import { RoundNote } from './StepGroup';

/**
 * One drink at a time (board Kept-onboard, 4): tonight's drink on its own
 * colour, what's in it, the spec, the bar's note on it, and Got it, which
 * marks it read and opens the next one; after the last, Ready. The drink's
 * own page has the rest (Make, batch, history); this is for learning the list.
 */
export function RoundDrinkScreen({ id }: { id: string }) {
  return (
    <BackbarTheme>
      <OneDrink id={id} />
    </BackbarTheme>
  );
}

function OneDrink({ id }: { id: string }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const barId = useActiveVenue().active?.id ?? null;
  const r = useStaffRound(barId);
  const item = useCocktail(id).data;
  const { access } = useSpecAccess(id, barId);
  const unit = useSettingsStore((s) => s.specUnit);
  const liquid = useSkyColour(id);
  const at = r.ids.indexOf(id);
  const drink = r.drinks[at] ?? null;
  const name = drink?.name ?? item?.name ?? '';
  const lines = specLines(item?.recipes as PresentationRecipe[] | undefined);
  const measured = access.amounts && lines.some((l) => l.value !== null);
  // The note the server reads for your role (app_item_presentation.notes).
  const note = typeof item?.notes === 'string' && item.notes.trim() ? item.notes.trim() : null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/first-round' as Href));
  // The next one still to read after this, from here on, then from the top.
  const after = [...r.ids.slice(at + 1), ...r.ids.slice(0, Math.max(at, 0))].find((d) => d !== id && !r.round?.read?.includes(d)) ?? null;
  const gotIt = () => {
    r.readDrink(id);
    router.replace((after ? `/first-round/drink?id=${after}` : '/first-round/ready') as Href);
  };

  return (
    <View style={[styles.fill, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{name || 'Tonight’s menu'}</title>
      </WebHead>
      <DrinkSky liquid={liquid} />
      <View style={[styles.top, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} />
        {at >= 0 ? (
          <DsText variant="label" role="status" style={styles.count}>
            {`${at + 1} of ${r.ids.length}`}
          </DsText>
        ) : null}
        <View style={styles.side} />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.column}>
          <View style={styles.hero}>
            <DrinkDrawingFor itemId={id} size="hero" staff label={name} />
          </View>
          <View style={styles.head}>
            {r.menuName ? (
              <Caption tone="muted" style={styles.caps}>
                {drink?.isNew ? `New on ${r.menuName}` : `On ${r.menuName}`}
              </Caption>
            ) : null}
            <Display>{name}</Display>
            {drink?.line ? <Body tone="muted">{drink.line}</Body> : null}
          </View>
          {item ? (
            <View>
              {lines.map((l) => (
                <SpecRow
                  key={l.key}
                  amount={measured ? (scaledAmount(l, 1, unit) ?? '') : ''}
                  alignAmount={measured}
                  dense
                  ingredient={l.ingredient ?? 'Ingredient'}
                  ingredientId={l.ingredient ? l.ingredientId : undefined}
                  optional={l.optional}
                  floated={l.float}
                  houseMade={l.houseMade}
                  note={access.prep ? (l.note ?? undefined) : undefined}
                />
              ))}
            </View>
          ) : (
            <PencilState kind="loading" title="Getting the spec" compact />
          )}
          {note ? <RoundNote icon="bubble.left" text={note} /> : null}
          <Button label={after ? 'Got it, next drink' : 'Got it'} variant="ink" size="lg" disabled={r.isLoading} onPress={gotIt} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.sm, zIndex: 1 },
  count: { flex: 1, textAlign: 'center' },
  side: { width: 44 },
  scroll: { flexGrow: 1, paddingTop: space.lg },
  column: { width: '100%', maxWidth: 560, gap: space.lg },
  hero: { alignItems: 'center' },
  head: { gap: space.xs },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
