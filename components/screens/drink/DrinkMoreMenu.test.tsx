import { fireEvent, screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { BackbarTheme } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';

import { DrinkMoreMenu } from './DrinkMoreMenu';

jest.mock('@/ctx/AuthContext', () => jest.requireActual('@/jest.authMock').mockAuthContext(() => ({ user: { id: 'user-1' } })));
jest.mock('@/hooks/useViewAs', () => ({ useViewAs: () => ({ viewAsRoleLevel: null, setViewAsRoleLevel: jest.fn() }) }));

const moreLabel = async (props: { canEdit: boolean; adminFix?: boolean; wide?: boolean; onDelete?: () => void }) => {
  await renderWithTamagui(
    <BackbarTheme>
      <DrinkMoreMenu itemId="pearl-diver" name="The Pearl Diver" onEdit={() => {}} wide={props.wide ?? true} teamRole={null} {...props} />
    </BackbarTheme>
  );
  return screen.getByRole('button').props.accessibilityLabel;
};

test('a catalog admin on someone else\'s drink gets Fix as admin, at every width', async () => {
  expect(await moreLabel({ canEdit: false, adminFix: true })).toBe('More: report, fix as admin');
  expect(await moreLabel({ canEdit: false, adminFix: true, wide: false })).toBe('More: report, fix as admin');
});

test('a visitor gets Report only; the drink\'s own people get Edit on phones', async () => {
  expect(await moreLabel({ canEdit: false })).toBe('More: report');
  expect(await moreLabel({ canEdit: true, wide: false })).toBe('More: edit');
});

test('the drink\'s own people get Delete drink, at every width', async () => {
  expect(await moreLabel({ canEdit: true, wide: true, onDelete: () => {} })).toBe('More: delete');
  expect(await moreLabel({ canEdit: true, wide: false, onDelete: () => {} })).toBe('More: edit, delete');
});

test('View as is one row of role chips and one line on what the picked role sees', async () => {
  await renderWithTamagui(
    <BackbarTheme>
      <DrinkMoreMenu itemId="pearl-diver" name="The Pearl Diver" canEdit onEdit={() => {}} wide teamRole={40} />
    </BackbarTheme>
  );
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(['Guest', 'Employee', 'Bartender', 'Drink Creator', 'Admin (you)']);
  expect(screen.getByText('Admin sees everything, including publishing. Pick a role to see the page as they do.')).toBeTruthy();
  expect(screen.getByLabelText('Who sees what')).toBeTruthy();
});
