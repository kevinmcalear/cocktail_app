import { Linking } from 'react-native';

import { DsText } from '@/components/ds';

/**
 * OpenStreetMap asks for a visible credit. The map shows it itself when it has
 * room; on phones it sits in the results sheet instead (DiscoverMapPane).
 */
export function MapCredit() {
  return (
    <DsText variant="caption" tone="muted" role="link" onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}>
      Map by OpenFreeMap · © OpenMapTiles · data © OpenStreetMap contributors
    </DsText>
  );
}
