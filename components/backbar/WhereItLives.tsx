import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, LockedSection, Spec, Surface, TextLink, useDs } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarZones, useItemLocations } from '@/hooks/useBackBar';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useMode } from '@/hooks/useMode';
import { useStockOnHand } from '@/hooks/useStockCounts';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { formatPar, locationLine } from '@/lib/backBar';
import { withAlpha } from '@/lib/color';
import { roleLabel } from '@/lib/roles';

import { BackBarPlan } from './BackBarPlan';

interface WhereItLivesProps {
  itemId: string;
  itemName: string;
  /** Inside the Where it lives sheet: no card or eyebrow, the sheet has its own title. */
  bare?: boolean;
  /** A house prep's Recipe button (prep-ing-where): back to its recipe. */
  onRecipe?: () => void;
}

/**
 * "Where it lives" on an ingredient's page: a small plan of the active venue
 * with its zone lit, then the shelf, container and par for each place it's
 * kept. The first time a new barback opens Fridge 2, they know what to look for.
 * It only reads: giving it a spot is in Edit (ingredient-edit-proposal).
 */
export function WhereItLives(props: WhereItLivesProps) {
  return (
    <VenueBrandProvider>
      <WhereItLivesCard {...props} />
    </VenueBrandProvider>
  );
}

/**
 * Where an item lives at the active venue, for the For the bar row and the
 * sheet: whether there's anything to show, the venue, and the first spot.
 */
export function useWhereItLives(itemId: string) {
  const { active } = useActiveVenue();
  // Home mode has no venue, even for staff: useActiveVenue falls back to their first one.
  const home = useMode().mode === 'home';
  // A venue that hasn't switched the back bar on has no map to point at.
  const backBar = useVenueFeature('backBar');
  const barId = home || !backBar ? null : (active?.id ?? null);
  const caps = useCapabilities(barId);
  const capabilities = Array.isArray(caps.data) ? caps.data : null;
  const canRead = !!capabilities?.includes('locations');
  const { data: zones = [] } = useBarZones(canRead ? barId : null);
  const { data: locations = [] } = useItemLocations(canRead ? barId : null);
  const here = locations.filter((l) => l.item_id === itemId);
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? null;
  const lines = here.map((l) => locationLine(zoneName(l.zone_id), l.shelf));
  // Home mode, no venue, or a venue without the back bar yet: nothing to say.
  const shown = !home && backBar && !!active && !caps.error && !!capabilities;
  return { shown, active, barId, capabilities, canRead, zones, here, lines };
}

function WhereItLivesCard({ itemId, itemName, bare, onRecipe }: WhereItLivesProps) {
  const ds = useDs();
  const router = useRouter();
  const { shown, active, barId, canRead, zones, here, lines } = useWhereItLives(itemId);
  const { data: opensAt } = useCapabilityOpensAt(barId, 'locations');
  const { data: onHand = [] } = useStockOnHand(canRead && here.length ? barId : null);

  if (!shown || !active) return null;
  if (!canRead) {
    return (
      <LockedSection title="Where it lives" unlocked={false} opensAt={opensAt ? roleLabel(opensAt) : 'a higher role'}>
        {null}
      </LockedSection>
    );
  }

  const Frame = bare ? View : Surface;
  return (
    <Frame style={styles.card}>
      {bare ? null : (
        <Caption tone="muted" role="heading" style={styles.eyebrow}>
          WHERE IT LIVES · {active.name.toUpperCase()}
        </Caption>
      )}
      {here.length ? (
        <>
          <BackBarPlan
            zones={zones}
            highlightIds={here.map((l) => l.zone_id)}
            labels="highlighted"
            accessibilityLabel={`${active.name} back bar plan, showing ${lines.join(' and ')}`}
          />
          {here.map((l, i) => {
            // Par, and what the last count found there. Made and Use by stay off until there's a batch log (b33).
            const counted = onHand.find((r) => r.item_id === itemId && r.location_id === l.id);
            // Under par shows in the accent (prep-ing-where).
            const low = !!counted && l.par_amount != null && counted.unit === l.par_unit && Number(counted.amount) < Number(l.par_amount);
            const stats = [
              { label: 'Par', value: formatPar(l.par_amount, l.par_unit), low: false },
              { label: 'On hand', value: counted ? formatPar(counted.amount, counted.unit) : null, low },
            ].filter((t): t is { label: string; value: string; low: boolean } => !!t.value);
            return (
              <View key={l.id} style={styles.place}>
                <Spec color={ds.accentText}>{lines[i]}</Spec>
                {l.container ? <Body tone="muted">{l.container}</Body> : null}
                {stats.length ? (
                  <View style={styles.stats}>
                    {stats.map((t) => (
                      <View key={t.label} style={[styles.stat, { backgroundColor: t.low ? withAlpha(ds.accentText, 0.18) : ds.c.raised }]}>
                        <Caption tone="muted">{t.label}</Caption>
                        <Spec color={t.low ? ds.accentText : undefined}>{t.value}</Spec>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : (
        <Body tone="muted">
          {itemName} doesn’t have a spot at {active.name} yet.
        </Body>
      )}
      {here.length ? (
        // Placed: Recipe is the one button in the sheet, the back bar a link (prep-ing-where); a bottle's card opens the back bar (prep-ing-campari).
        <View style={styles.stack}>
          {onRecipe ? <Button label="Recipe" size="lg" onPress={onRecipe} /> : null}
          {bare ? <View style={styles.center}><TextLink label="Open the back bar" onPress={() => router.push('/back-bar' as never)} /></View> : <Button label="Open the back bar" variant="secondary" onPress={() => router.push('/back-bar' as never)} />}
        </View>
      ) : (
        <View style={styles.actions}>
          {onRecipe ? <Button label="Recipe" variant="secondary" onPress={onRecipe} /> : null}
          <Button label="Open the back bar" variant="secondary" onPress={() => router.push('/back-bar' as never)} />
        </View>
      )}
    </Frame>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2 },
  place: { gap: space.xs },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  stat: { flex: 1, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.control },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stack: { gap: space.sm },
  center: { alignSelf: 'center' },
});
