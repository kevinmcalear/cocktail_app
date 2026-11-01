import { screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { BackbarTheme } from '@/components/ds';
import { renderWithProviders } from '@/jest.setup';

import { DrinkMoreMenu } from './DrinkMoreMenu';

jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'user-1' } })));

const moreLabel = async (props: { canEdit: boolean; adminFix?: boolean }) => {
  await renderWithProviders(
    <BackbarTheme>
      <DrinkMoreMenu itemId="pearl-diver" name="The Pearl Diver" onEdit={() => {}} {...props} />
    </BackbarTheme>
  );
  return screen.queryByRole('button')?.props.accessibilityLabel ?? null;
};

test("a catalog admin on someone else's drink gets Fix as admin", async () => {
  expect(await moreLabel({ canEdit: false, adminFix: true })).toBe('More: report, fix as admin');
});

test('a visitor gets Report only', async () => {
  expect(await moreLabel({ canEdit: false })).toBe('More: report');
});

test("the drink's own people have nothing here: Edit has its own button, and no View as on the page", async () => {
  expect(await moreLabel({ canEdit: true })).toBeNull();
});
