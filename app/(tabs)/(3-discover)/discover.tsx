import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DiscoverScreen } from '@/components/screens/home/DiscoverScreen';
import { WantToGoMap } from '@/components/screens/home/WantToGoMap';
import { MountOnFocus } from '@/components/nav/MountOnFocus';
import { useRoundVisit } from '@/hooks/useFirstRound';

/**
 * The Discover tab, in both modes. Collection's "See them on the map" opens it
 * on your Want to go bars alone (/discover?list=want). Once Discover has been
 * open it stays mounted, hidden, so its search, filters and map are as you
 * left them when you come back.
 */
export default function DiscoverTab() {
  useRoundVisit('discover');
  const want = useLocalSearchParams<{ list?: string }>().list === 'want';
  // Discover mounts the first time it's shown, not just to sit under the map.
  const [opened, setOpened] = useState(!want);
  if (!want && !opened) setOpened(true);
  return (
    <MountOnFocus>
      {/* Hidden, not unmounted, while the map is up: out of sight, focus and screen readers. */}
      {opened ? (
        <View style={[styles.fill, want ? styles.hidden : null]}>
          <DiscoverScreen />
        </View>
      ) : null}
      {want ? <WantToGoMap /> : null}
    </MountOnFocus>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 }, hidden: { display: 'none' } });
