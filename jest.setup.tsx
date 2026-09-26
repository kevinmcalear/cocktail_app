// First, so gesture-handler's mocks are in place before anything imports it.
import 'react-native-gesture-handler/jestSetup';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TamaguiProvider } from 'tamagui';

import tamaguiConfig from '@/tamagui.config';

// These call into native modules on import; each ships its own Jest mock.
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

// The same providers app/_layout.tsx wraps the app in: Tamagui, so $tokens and
// themes resolve, and gesture-handler's root view, which gesture-handler 3
// requires around every GestureDetector (edit mode's drag handles).
function TamaguiWrapper({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        {children}
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}

export const renderWithTamagui = (ui: ReactElement) => render(ui, { wrapper: TamaguiWrapper });
