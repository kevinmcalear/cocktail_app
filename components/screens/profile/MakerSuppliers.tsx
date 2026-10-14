import { StyleSheet, View } from 'react-native';

import { Caption, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useMakerSuppliers } from '@/hooks/useSuppliers';
import { suppliesLine } from '@/lib/suppliers';

import { RegionLines } from './RegionLines';

/**
 * On a maker's page: the suppliers that carry its brands, by where they
 * deliver ("In Victoria", ppl-maker). Nothing when none do.
 */
export function MakerSuppliers({ profileId, name }: { profileId: string; name: string }) {
  const { data: lines = [] } = useMakerSuppliers(profileId);
  if (!lines.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.title}>
        <Headline role="heading">Where bars order it</Headline>
        <Caption tone="muted">{`Suppliers that carry ${name}, by where they deliver.`}</Caption>
      </View>
      <RegionLines lines={lines} detail={suppliesLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  title: { gap: space.xs },
});
