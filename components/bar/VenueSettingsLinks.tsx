import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LinkRow, RowDivider, SectionTitle } from '@/components/bar/BarParts';
import { Surface } from '@/components/ds';
import { space } from '@/constants/tokens';

/** The venue settings that have their own redesigned screens: publishing, dilution and pricing. */
export function VenueSettingsLinks({ barId }: { barId: string }) {
  const router = useRouter();
  const go = (page: string) => () => router.push(`/settings/bar/${barId}/${page}` as Href);
  return (
    <View style={styles.section}>
      <SectionTitle>More settings</SectionTitle>
      <Surface>
        <LinkRow icon="globe" label="Publishing" detail="Who outside the venue sees your drinks" onPress={go('publishing')} />
        <RowDivider />
        <LinkRow icon="drop.fill" label="Dilution" detail="How much water each method adds" onPress={go('dilution')} />
        <RowDivider />
        <LinkRow icon="dollarsign.circle.fill" label="Pricing" detail="Currency, tax and target GP" onPress={go('pricing')} />
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({ section: { gap: space.sm } });
