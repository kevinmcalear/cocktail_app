import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { VenueBuyingLinks, VenueKitLinks } from './VenueSettingsLinks';

let mockGlasses: unknown[] | undefined;
let mockKit: unknown[] | undefined;
let mockIce: unknown[] | undefined;
let mockCaps: string[] = [];
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/usePricing', () => ({ usePricingSettings: () => ({ data: undefined }) }));
jest.mock('@/hooks/useBarGlassware', () => ({ useBarGlassware: () => ({ data: mockGlasses }) }));
jest.mock('@/hooks/useBarKit', () => ({ useBarKit: () => ({ data: mockKit }) }));
jest.mock('@/hooks/useVenueIce', () => ({ useVenueIce: () => ({ data: mockIce }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: mockCaps }) }));
jest.mock('@/hooks/useVenueSuppliers', () => ({ useVenueSuppliers: (barId: string | null) => ({ data: barId ? [{}, {}] : undefined }) }));

test('the Glassware row says how many glasses the venue has', async () => {
  mockGlasses = [{}, {}, {}, {}];
  await renderWithTamagui(<VenueKitLinks barId="b" />);
  expect(screen.getByText('4 glasses')).toBeTruthy();
});

test('one glass is singular, and nothing shows until the glasses load', async () => {
  mockGlasses = [{}];
  const { unmount } = await renderWithTamagui(<VenueKitLinks barId="b" />);
  expect(screen.getByText('1 glass')).toBeTruthy();
  await unmount();
  mockGlasses = undefined;
  await renderWithTamagui(<VenueKitLinks barId="b" />);
  expect(screen.queryByText(/glass(es)?$/)).toBeNull();
});

test('Kit counts the ice and the tools', async () => {
  mockGlasses = [];
  mockIce = [{}];
  mockKit = [{}, {}];
  await renderWithTamagui(<VenueKitLinks barId="b" />);
  expect(screen.getByText('1 kind')).toBeTruthy();
  expect(screen.getByText('2 tools')).toBeTruthy();
});

test('Buying is only for people with Prep or Costs', async () => {
  mockCaps = ['menu', 'specs'];
  const { unmount } = await renderWithTamagui(<VenueBuyingLinks barId="b" />);
  expect(screen.queryByText('Suppliers')).toBeNull();
  await unmount();
  mockCaps = ['costs'];
  await renderWithTamagui(<VenueBuyingLinks barId="b" />);
  expect(screen.getByText('Suppliers')).toBeTruthy();
  expect(screen.getByText('2 suppliers')).toBeTruthy();
});
