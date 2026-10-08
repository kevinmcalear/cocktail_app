import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MountOnFocus } from '@/components/nav/MountOnFocus';

let mockFocused = false;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));

test('a tab mounts on its first focus and stays mounted after', async () => {
  mockFocused = false;
  const tab = () => (
    <MountOnFocus>
      <Text>Library</Text>
    </MountOnFocus>
  );
  const { rerender } = await render(tab());
  expect(screen.queryByText('Library')).toBeNull();

  mockFocused = true;
  await rerender(tab());
  expect(screen.getByText('Library')).toBeTruthy();

  mockFocused = false;
  await rerender(tab());
  expect(screen.getByText('Library')).toBeTruthy();
});
