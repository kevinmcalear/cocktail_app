import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { useSignedIn } from '@/ctx/AuthContext';
import { useHomeGlassware, useHomeIce } from '@/hooks/useHomeKit';

/**
 * Under My Bar's tools (Kit and ice, step 13): your glassware and ice at
 * home, both optional. Quiet: a row each, never a prompt.
 */
export function HomeKitLinks() {
  const router = useRouter();
  const glasses = useHomeGlassware().data?.length;
  const ice = useHomeIce().data?.length;
  // On your account only: signed out there's nowhere to keep them.
  if (!useSignedIn()) return null;
  return (
    <View role="group" aria-label="Glassware and ice">
      <SettingsRow icon="wineglass" label="Glassware" detail="Optional · the glasses you have" value={glasses ? String(glasses) : undefined} onPress={() => router.push('/kit/glassware' as Href)} />
      <RowDivider />
      <SettingsRow icon="snowflake" label="Ice" detail="Optional · the ice you make or buy" value={ice ? String(ice) : undefined} onPress={() => router.push('/kit/ice' as Href)} />
    </View>
  );
}
