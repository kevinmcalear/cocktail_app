import { screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { BackbarTheme } from '@/components/ds';
import { renderWithProviders } from '@/jest.setup';

import { ItemMoreMenu, type ItemActions } from './ItemMoreMenu';

jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'user-1' } })));

const moreLabel = async (props: ItemActions) => {
  await renderWithProviders(
    <BackbarTheme>
      <ItemMoreMenu name="The Pearl Diver" report={{ itemId: 'pearl-diver' }} {...props} />
    </BackbarTheme>
  );
  return screen.queryByRole('button')?.props.accessibilityLabel ?? null;
};

const save = { saved: false, onToggle: () => {}, label: ['Add to To make', 'Remove from To make'] as [string, string] };

test('a guest gets Save, Share and Report under the one button', async () => {
  expect(await moreLabel({ save, onShare: () => {} })).toBe('More: add to to make, share, report the pearl diver');
});

test("a catalog admin on someone else's drink gets Fix as admin", async () => {
  expect(await moreLabel({ adminFix: () => {} })).toBe('More: report the pearl diver, fix as admin');
});

test("the drink's own people get Edit there too, and no Report", async () => {
  expect(await moreLabel({ onEdit: () => {}, editLabel: 'Edit drink', onShare: () => {} })).toBe('More: edit drink, share');
});

test('nothing to hold, no button', async () => {
  expect(await moreLabel({ report: null })).toBeNull();
});

test("an ingredient with pairings has its flavor map there, not in the bar (Kevin's C12)", async () => {
  expect(await moreLabel({ save, onShare: () => {}, flavorMap: () => {} })).toBe('More: add to to make, share, flavor map, report the pearl diver');
});
