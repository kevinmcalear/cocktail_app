import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { VenueSettingsLinks } from './VenueSettingsLinks';

let mockGlasses: unknown[] | undefined;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useBarGlassware', () => ({ useBarGlassware: () => ({ data: mockGlasses }) }));

test('the Glassware row says how many glasses the venue has', async () => {
  mockGlasses = [{}, {}, {}, {}];
  await renderWithTamagui(<VenueSettingsLinks barId="b" />);
  expect(screen.getByText('4 glasses')).toBeTruthy();
});

test('one glass is singular, and nothing shows until the glasses load', async () => {
  mockGlasses = [{}];
  const { unmount } = await renderWithTamagui(<VenueSettingsLinks barId="b" />);
  expect(screen.getByText('1 glass')).toBeTruthy();
  unmount();
  mockGlasses = undefined;
  await renderWithTamagui(<VenueSettingsLinks barId="b" />);
  expect(screen.queryByText(/glass(es)?$/)).toBeNull();
});
