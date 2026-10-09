import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { TechnicalIngredientCard } from './TechnicalIngredientCard';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

test('a technical ingredient shows its doses by job and links to the techniques that use it', async () => {
  await renderWithTamagui(<TechnicalIngredientCard name="Xanthan Gum" />);
  expect(screen.getByText('Body in a no-alcohol drink')).toBeTruthy();
  expect(screen.getByText('0.05 to 0.1%')).toBeTruthy();
  // A number nobody has tested says so.
  expect(screen.getAllByText('Starting point').length).toBeGreaterThan(0);
  fireEvent.press(screen.getByLabelText('How to: Suspended garnish'));
  expect(mockPush).toHaveBeenCalledWith('/techniques/suspension');
});

test('an ordinary ingredient shows nothing', async () => {
  await renderWithTamagui(<TechnicalIngredientCard name="Lime juice" />);
  expect(screen.queryByText('HOW TO USE IT')).toBeNull();
});
