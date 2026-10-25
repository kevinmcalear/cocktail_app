import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { useHomeGlassware, useHomeIce } from '@/hooks/useHomeKit';

/**
 * Under My Bar's tools (Kit and ice, step 13): your glassware and ice at
 * home, both optional. Quiet: a row each, never a prompt.
 */
export function HomeKitLinks() {
  const router = useRouter();
  const glasses = useHomeGlassware().data?.length;
  const ice = useHomeIce().data?.length;
  return (
    <View role="group" aria-label="Glassware and ice">
      <SettingsRow icon="wineglass" label="Glassware" detail="Optional · drinks drawn in your glasses" value={glasses ? String(glasses) : undefined} onPress={() => router.push('/kit/glassware' as Href)} />
      <RowDivider />
      <SettingsRow icon="snowflake" label="Ice" detail="Optional · drinks drawn with your ice" value={ice ? String(ice) : undefined} onPress={() => router.push('/kit/ice' as Href)} />
    </View>
  );
}
