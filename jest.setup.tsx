import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import tamaguiConfig from '@/tamagui.config';

// These call into native modules on import; each ships its own Jest mock.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
// Gives useSafeAreaInsets() zero insets without a SafeAreaProvider (expo-router adds one in the app).
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default
);

// Same provider app/_layout.tsx wraps the app in, so $tokens and themes resolve.
function TamaguiWrapper({ children }: { children: ReactNode }) {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      {children}
    </TamaguiProvider>
  );
}

export const renderWithTamagui = (ui: ReactElement) => render(ui, { wrapper: TamaguiWrapper });
