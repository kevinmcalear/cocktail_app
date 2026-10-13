import { View } from 'react-native';

import { Caption } from '@/components/ds';
import { RowDivider, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { useSetVenueFeature } from '@/hooks/useVenueFeatures';
import { VENUE_FEATURES } from '@/lib/venueFeatures';

/**
 * Features, in a venue's settings, for its Admins: a switch for each extra
 * past Discover, Library and Menus. Each saves as it's flipped, and the tabs
 * and links follow for the whole team.
 */
export function VenueFeatures({ barId }: { barId: string }) {
  const { features, set, error } = useSetVenueFeature(barId);
  return (
    <View>
      <SettingsSection title="Features" note="Your team starts with Discover, Library and Menus. Switch on what else the venue uses.">
        {VENUE_FEATURES.map((f, i) => (
          <View key={f.key}>
            {i > 0 ? <RowDivider /> : null}
            <SwitchRow label={f.label} detail={f.detail} value={features.includes(f.key)} onValueChange={(on) => set(f.key, on)} />
          </View>
        ))}
      </SettingsSection>
      {error ? (
        <Caption tone="accent" role="alert">
          Couldn’t save that. Check your connection and try again.
        </Caption>
      ) : null}
    </View>
  );
}
