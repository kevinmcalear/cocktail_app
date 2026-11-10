// First, so gesture-handler's mocks are in place before anything imports it.
import 'react-native-gesture-handler/jestSetup';
// The technique library is a lazy chunk in the app (lib/techniques); tests have it from the start.
import '@/lib/techniques/testing';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// These call into native modules on import; each ships its own Jest mock.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
// The mock lacks useReducedMotion, which PressableScale (every ds button) calls.
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
// Ships untranspiled ESM over a native module, and every share button reaches it through lib/shareLink.
jest.mock('burnt', () => ({ toast: jest.fn(), alert: jest.fn() }));
// Gives useSafeAreaInsets() zero insets without a SafeAreaProvider (expo-router adds one in the app).
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default
);
// The venue feature switches (hooks/useVenueFeatures.ts) read Supabase through a query, and most
// screen tests render without a QueryClient: every section shows, as on main before a bar picks,
// except Advanced options (off by default) and the back bar map (parked, lib/backBar.ts).
// hooks/useVenueFeatures.test.tsx tests the real hook; a test can mock it again to switch some off.
jest.mock('@/hooks/useVenueFeatures', () => {
  const has = (key: string) => key !== 'advanced' && key !== 'backBar';
  return {
    venueFeaturesKey: (barId: string | null) => ['venue-features', barId],
    useVenueFeatures: () => ({ ready: true, on: [], has, home: '/' }),
    useVenueFeature: has,
  };
});
jest.mock('@/hooks/useBackBarShown', () => ({ useBackBarShown: () => false }));
jest.mock('@/hooks/useBarFeature', () => {
  const has = (key: string) => key !== 'advanced' && key !== 'backBar';
  return { useBarFeature: (_barId: unknown, key: string) => has(key), useBarFeatures: () => has };
});
jest.mock('@/hooks/useSetVenueFeature', () => ({ useSetVenueFeature: () => ({ features: [], set: jest.fn(), error: null }) }));

// Gesture-handler's root view, as app/_layout.tsx has it: gesture-handler 3
// requires one around every GestureDetector (edit mode's drag handles).
function Providers({ children }: { children: ReactNode }) {
  return <GestureHandlerRootView>{children}</GestureHandlerRootView>;
}

export const renderWithProviders = (ui: ReactElement) => render(ui, { wrapper: Providers });
