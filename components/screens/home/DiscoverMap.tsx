// Fallback used by type checking and Jest. The app loads DiscoverMap.native.tsx
// (Apple Maps on iOS, Google Maps on Android, through expo-maps) or
// DiscoverMap.web.tsx (MapLibre GL with OpenFreeMap tiles) instead; keep the
// props in sync.
import type { StyleProp, ViewStyle } from 'react-native';

import type { Camera, MapPin, Viewport } from '@/lib/discoverMap';

export interface DiscoverMapProps {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Where the map is looking, after the person moves it. */
  onViewportChange: (viewport: Viewport) => void;
  /** Where to put the camera; a new object moves it there. */
  camera: Camera | null;
  scheme: 'light' | 'dark';
  /** The pin colour: the venue accent, contrast-checked. */
  accent: { fill: string; text: string };
  /** Phones: no zoom buttons (pinch instead), and the credit goes in the sheet (MapCredit). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Whether this build can draw a map (Android needs a Google Maps key). */
export const mapAvailable: boolean = false;

export function DiscoverMap(_props: DiscoverMapProps) {
  return null;
}

/** The map data credit, where the map itself can't show it (web phones). Native maps carry their own. */
export function MapCredit() {
  return null;
}
