import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { TamaguiProvider } from 'tamagui';

import tamaguiConfig from '@/tamagui.config';

// These call into native modules on import; each ships its own Jest mock.
import 'react-native-gesture-handler/jestSetup';
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
// ponytail: Reanimated 4.7.0 registers a CSS event handler at startup, which its
// JS-only module (the one Jest gets) throws on. Make that call a no-op; delete
// this once a Reanimated release stops throwing there.
jest.mock('react-native-reanimated/src/css/native/proxy', () => ({
  ...jest.requireActual('react-native-reanimated/src/css/native/proxy'),
  setCSSEventHandler: () => {},
}));
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
