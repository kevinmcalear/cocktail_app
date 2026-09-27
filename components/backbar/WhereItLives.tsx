import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, LockedSection, Spec, Surface, useDs } from '@/components/ds';
import { VenueBrandProvider } from '@/components/nav/VenueBrandProvider';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarZones, useItemLocations } from '@/hooks/useBackBar';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { formatPar, locationLine } from '@/lib/backBar';
import { roleLabel } from '@/lib/roles';

import { BackBarPlan } from './BackBarPlan';

interface WhereItLivesProps {
  itemId: string;
  itemName: string;
}

/**
 * "Where it lives" on an ingredient's page: a small plan of the active venue
 * with its zone lit, then the shelf, container and par for each place it's
 * kept. The first time a new barback opens Fridge 2, they know what to look for.
 */
export function WhereItLives(props: WhereItLivesProps) {
  return (
    <VenueBrandProvider>
      <WhereItLivesCard {...props} />
    </VenueBrandProvider>
  );
}

function WhereItLivesCard({ itemId, itemName }: WhereItLivesProps) {
  const ds = useDs();
  const router = useRouter();
  const { active } = useActiveVenue();
  const barId = active?.id ?? null;
  const caps = useCapabilities(barId);
  const capabilities = Array.isArray(caps.data) ? caps.data : null;
  const canRead = !!capabilities?.includes('locations');
  const canPlace = !!capabilities?.some((c) => c === 'edit_drinks' || c === 'prep');
  const { data: opensAt } = useCapabilityOpensAt(barId, 'locations');
  const { data: zones = [] } = useBarZones(canRead ? barId : null);
  const { data: locations = [] } = useItemLocations(canRead ? barId : null);

  // No venue, or a venue without the back bar yet: nothing to say.
  if (!active || caps.error || !capabilities) return null;
  if (!canRead) {
    return (
      <LockedSection title="Where it lives" unlocked={false} opensAt={opensAt ? roleLabel(opensAt) : 'a higher role'}>
        {null}
      </LockedSection>
    );
  }

  const here = locations.filter((l) => l.item_id === itemId);
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? null;
  const lines = here.map((l) => locationLine(zoneName(l.zone_id), l.shelf));

  return (
    <Surface style={styles.card}>
      <Caption tone="muted" role="heading" style={styles.eyebrow}>
        WHERE IT LIVES · {active.name.toUpperCase()}
      </Caption>
      {here.length ? (
        <>
          <BackBarPlan
            zones={zones}
            highlightIds={here.map((l) => l.zone_id)}
            labels="highlighted"
            accessibilityLabel={`${active.name} back bar plan, showing ${lines.join(' and ')}`}
          />
          {here.map((l, i) => {
            const par = formatPar(l.par_amount, l.par_unit);
            return (
              <View key={l.id} style={styles.place}>
                <Spec color={ds.accentText}>{lines[i]}</Spec>
                {l.container ? <Body tone="muted">{l.container}</Body> : null}
                {par ? (
                  <View style={[styles.stat, { backgroundColor: ds.c.raised }]}>
                    <Caption tone="muted">Par</Caption>
                    <Spec>{par}</Spec>
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
      <View style={styles.actions}>
        {!here.length && canPlace ? (
          <Button
            label="Give it a spot"
            icon="map.fill"
            onPress={() => router.push({ pathname: '/back-bar', params: { place: itemId, name: itemName } } as never)}
          />
        ) : null}
        <Button label="Open the back bar" variant="secondary" onPress={() => router.push('/back-bar' as never)} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  eyebrow: { letterSpacing: 1.2 },
  place: { gap: space.xs },
  stat: { alignSelf: 'flex-start', marginTop: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.control },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
