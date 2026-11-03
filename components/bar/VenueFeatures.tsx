import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, Surface, Switch, useDs } from '@/components/ds';
import { RowDivider, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useSetVenueFeature } from '@/hooks/useSetVenueFeature';
import { SWITCHES } from '@/lib/venueFeatureList';

type Feature = (typeof SWITCHES)[number];

/**
 * Features, on a venue's Features page, for its Admins (as before #1033:
 * canvas first-round-and-features, venue-menu proposal): what's always on,
 * then a switch for each section. Each switch saves as it's flipped, and the
 * tabs and links follow for the whole team. On wide web the switches are
 * cards, two across.
 */
export function VenueFeatures({ barId, venueName }: { barId: string; venueName: string }) {
  const { features, set, error } = useSetVenueFeature(barId);
  const wide = useIsWideWeb();
  // Lined up with the card's rows on phones; on wide web, with the page title over the cards.
  const inset = wide ? null : styles.inset;
  const intro = `Start small. Switch the rest on when your team is ready. Everyone at ${venueName} sees what’s on.`;
  const control = (f: Feature) => ({ value: features.includes(f.key), onValueChange: (on: boolean) => set(f.key, on) });

  return (
    <View style={styles.section}>
      <DsText variant="label" tone="muted" style={inset}>
        {wide ? `${intro} Drinks, Menus, Discover and You are always on.` : intro}
      </DsText>
      {wide ? (
        <View style={styles.grid}>
          {SWITCHES.map((f) => (
            <FeatureCard key={f.key} feature={f} {...control(f)} />
          ))}
        </View>
      ) : (
        <Surface style={styles.card}>
          <AlwaysOnRow />
          {SWITCHES.map((f) => (
            <View key={f.key}>
              <RowDivider />
              <SwitchRow label={f.label} detail={f.detail} {...control(f)} />
            </View>
          ))}
        </Surface>
      )}
      {error ? (
        <Caption tone="accent" role="alert" style={inset}>
          {error}
        </Caption>
      ) : null}
      <Caption tone="muted" style={inset}>
        Always there: Batch on every drink page, My team, and Roles and access, which sets who sees specs and prep notes.
      </Caption>
    </View>
  );
}

/** The first row: what every venue has, with a check instead of a switch. */
function AlwaysOnRow() {
  const ds = useDs();
  return (
    <View accessible accessibilityLabel="Drinks, Menus, Discover and You: always on, for everyone here" style={styles.row}>
      <View style={styles.fill}>
        <Body>Drinks, Menus, Discover and You</Body>
        <Caption tone="muted">Always on, for everyone here</Caption>
      </View>
      <IconSymbol name="checkmark" size={20} color={ds.c.muted} />
    </View>
  );
}

/** A feature on wide web: its name and detail, and its switch. */
function FeatureCard({ feature, value, onValueChange, children }: { feature: Feature; value: boolean; onValueChange: (on: boolean) => void; children?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.featureCard, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.cardHead}>
        <View style={styles.fill}>
          <Headline role="heading" aria-level={3}>{feature.label}</Headline>
          <Caption tone="muted">{feature.detail}</Caption>
        </View>
        <Switch value={value} onValueChange={onValueChange} label={feature.label} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  inset: { paddingHorizontal: space.lg },
  card: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingVertical: space.sm, paddingHorizontal: space.lg },
  fill: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  featureCard: { flexGrow: 1, flexBasis: 320, padding: space.lg, gap: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
