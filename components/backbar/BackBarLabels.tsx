import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DsText, GlassButton, Title, useDs, useGutter } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarZones, useItemLocations } from '@/hooks/useBackBar';
import { useCapabilities } from '@/hooks/useCapabilities';

/**
 * Labels for the back bar (canvas: Print labels beside Edit the plan): a card
 * per zone, its name big and what lives there by shelf, on paper. Prints from
 * the web; on a phone the same page shows, to print from a computer.
 *
 * ponytail: plain cards. QR codes on labels (b44) add a code per card later.
 */
export function BackBarLabels() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const web = Platform.OS === 'web';
  const { active } = useActiveVenue();
  const barId = active?.id ?? null;
  const canRead = (useCapabilities(barId).data ?? []).includes('locations');
  const zones = useBarZones(canRead ? barId : null).data ?? [];
  const locations = useItemLocations(canRead ? barId : null).data ?? [];

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.paper }]}>
      {web ? <style>{'@media print { #labels-controls { display: none !important; } }'}</style> : null}
      <View nativeID="labels-controls" style={[styles.controls, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]}>
        <GlassButton icon="chevron.left" accessibilityLabel="Back to the back bar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/back-bar'))} />
        {web ? <Button label="Print" icon="doc.text" onPress={() => window.print()} /> : null}
      </View>
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxl }]}>
        <Title color={ds.c.sketchInk}>{`${active?.name ?? 'Back bar'} labels`}</Title>
        {web ? null : <Caption color={ds.c.sketchInk}>Open this page on a computer to print it.</Caption>}
        {!canRead ? <Body color={ds.c.sketchInk}>Where things live opens at a higher role.</Body> : null}
        <View style={styles.grid}>
          {zones.map((z) => {
            const items = locations.filter((l) => l.zone_id === z.id);
            return (
              <View key={z.id} style={[styles.label, { borderColor: ds.c.sketchInk }]}>
                <DsText variant="headline" color={ds.c.sketchInk} style={styles.zoneName}>
                  {z.name.toUpperCase()}
                </DsText>
                {items.map((l) => (
                  <Caption key={l.id} color={ds.c.sketchInk} numberOfLines={1}>
                    {[l.shelf, l.item?.name].filter(Boolean).join(' · ')}
                  </Caption>
                ))}
                {items.length ? null : <Caption color={ds.c.sketchInk}>Empty</Caption>}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.sm },
  page: { gap: space.lg, paddingTop: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  label: { width: 240, minHeight: 120, padding: space.md, gap: 2, borderWidth: 1.5, borderRadius: radius.control, borderStyle: 'dashed' },
  zoneName: { fontFamily: fontFamilies.monoMedium, letterSpacing: 1 },
});
