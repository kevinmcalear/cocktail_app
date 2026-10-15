import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { TryItSheet } from '@/components/bar/TryItSheet';
import { Body, Caption, DsText, PressableScale, Surface, Switch, useDs } from '@/components/ds';
import { RowDivider, SectionHeading, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useSetVenueFeature } from '@/hooks/useVenueFeatures';
import type { TryItKey } from '@/lib/tryItSamples';
import { VENUE_FEATURES } from '@/lib/venueFeatures';

type Feature = (typeof VENUE_FEATURES)[number];

/**
 * Features, in a venue's settings, for its Admins (canvas
 * first-round-and-features): what's always on, then a switch for each extra,
 * Tonight and Back bar with a Try it under them. Each switch saves as it's
 * flipped, and the tabs and links follow for the whole team. On wide web the
 * switches are cards, two across.
 */
export function VenueFeatures({ barId, venueName }: { barId: string; venueName: string }) {
  const { features, set, error } = useSetVenueFeature(barId);
  const wide = useIsWideWeb();
  // Which sample is open, and whether it was on when it opened (so Turn on doesn't swap the buttons as the sheet leaves).
  const [trying, setTrying] = useState<{ key: TryItKey; on: boolean } | null>(null);
  const intro = `Start small. Switch the rest on when your team is ready. Everyone at ${venueName} sees what’s on.`;

  const control = (f: Feature) => ({ value: features.includes(f.key), onValueChange: (on: boolean) => set(f.key, on) });
  const tryIt = (f: Feature) => ('tryIt' in f && f.tryIt ? <TryItPill label={f.label} time={f.tryIt} onPress={() => setTrying({ key: f.key as TryItKey, on: features.includes(f.key) })} /> : null);

  return (
    <View style={styles.section}>
      <SectionHeading>Features</SectionHeading>
      <DsText variant="label" tone="muted" style={styles.inset}>
        {wide ? `${intro} Library, Menus and Discover are always on.` : intro}
      </DsText>
      {wide ? (
        <View style={styles.grid}>
          {VENUE_FEATURES.map((f) => (
            <FeatureCard key={f.key} feature={f} {...control(f)}>
              {tryIt(f)}
            </FeatureCard>
          ))}
        </View>
      ) : (
        <Surface style={styles.card}>
          <AlwaysOnRow />
          {VENUE_FEATURES.map((f) => (
            <View key={f.key}>
              <RowDivider />
              <SwitchRow label={f.label} detail={f.detail} {...control(f)} />
              {'tryIt' in f ? <View style={styles.under}>{tryIt(f)}</View> : null}
            </View>
          ))}
        </Surface>
      )}
      {error ? (
        <Caption tone="accent" role="alert" style={styles.inset}>
          {error}
        </Caption>
      ) : null}
      <Caption tone="muted" style={styles.inset}>
        {wide
          ? 'Always there: Batch on every drink page, My team, and Roles and access.'
          : 'Always there: Batch on every drink page, My team, and Roles and access, which sets who sees specs and prep notes.'}
      </Caption>
      <TryItSheet
        feature={trying?.key ?? null}
        venueName={venueName}
        on={!!trying?.on}
        onTurnOn={(key) => set(key, true)}
        onClose={() => setTrying(null)}
      />
    </View>
  );
}

/** The first row: what every venue has, with a check instead of a switch. */
function AlwaysOnRow() {
  const ds = useDs();
  return (
    <View accessible accessibilityLabel="Library, Menus and Discover: always on, for everyone here" style={styles.row}>
      <View style={styles.fill}>
        <Body>Library, Menus and Discover</Body>
        <Caption tone="muted">Always on, for everyone here</Caption>
      </View>
      <IconSymbol name="checkmark" size={20} color={ds.c.muted} />
    </View>
  );
}

/** A feature on wide web: its name and detail, its switch, and Try it under them. */
function FeatureCard({ feature, value, onValueChange, children }: { feature: Feature; value: boolean; onValueChange: (on: boolean) => void; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.featureCard, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.cardHead}>
        <View style={styles.fill}>
          <Body role="heading" aria-level={3} style={styles.cardTitle}>
            {feature.label}
          </Body>
          <Caption tone="muted">{feature.detail}</Caption>
        </View>
        <Switch value={value} onValueChange={onValueChange} label={feature.label} />
      </View>
      {children}
    </View>
  );
}

/** "Try it" and about how long it takes, under a feature that has a sample. */
function TryItPill({ label, time, onPress }: { label: string; time: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`Try ${label}, ${time}`} onPress={onPress} style={[styles.pill, { borderColor: ds.c.lineStrong }]}>
      <DsText variant="label" style={styles.pillLabel}>
        Try it
      </DsText>
      <Caption tone="muted">{time}</Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  inset: { paddingHorizontal: space.lg },
  card: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingVertical: space.sm },
  fill: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  featureCard: { flexGrow: 1, flexBasis: 320, padding: space.lg, gap: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  cardTitle: { fontFamily: fontFamilies.bodySemiBold },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: layout.minTapTarget, paddingHorizontal: space.md + 2, borderRadius: radius.pill, borderWidth: 1 },
  under: { paddingBottom: space.md },
  pillLabel: { fontFamily: fontFamilies.bodyMedium },
});
