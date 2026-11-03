import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { SetupChecklist } from './SetupChecklist';

const [mockPush, mockSkip, mockEnter] = [jest.fn(), jest.fn(), jest.fn()];
let mockRun: { finished: boolean; done: string[] } | undefined = { finished: true, done: [] };
let mockLooks = false;
let mockLoading = false;
const DONE = { claim: true, menu: true, place: true, glass: false, team: false, visibility: false, theme: false, calendars: false };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('@/store/useAppMode', () => ({ useAppMode: (pick: (s: { enterVenue: typeof mockEnter }) => unknown) => pick({ enterVenue: mockEnter }) }));
// How it looks, opened from Your team: a setup page whose footer saves and goes on.
jest.mock('@/components/screens/venue/BrandScreen', () => {
  const { SetupPage } = jest.requireActual('@/components/screens/onboarding/SetupPage');
  return {
    BrandSetup: ({ setup }: { setup: { footer: (s: { save: (then: () => void) => void; saving: boolean; ok: boolean }) => unknown } }) => (
      <SetupPage footer={setup.footer({ save: (then) => then(), saving: false, ok: true })}>{null}</SetupPage>
    ),
  };
});
jest.mock('@/hooks/useBarGlassware', () => ({ useBarPageId: () => ({ data: 'page' }), useFlushHeldGlasses: () => {} }));
jest.mock('@/hooks/useSetupChecklist', () => ({
  useSetupChecklist: () => ({
    run: mockRun,
    list: jest.requireActual('@/lib/setupChecklist').checklist(DONE),
    notes: { menu: 'Winter · 4 drinks' },
    looks: mockLooks,
    loading: mockLoading,
    skip: mockSkip,
  }),
}));
// The steps it opens in place: each hands back with Done or Back.
jest.mock('./KitStep', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    KitStep: ({ step, onBack, onDone }: { step: string; onBack: () => void; onDone: () => void }) => (
      <>
        <Text>{step}</Text>
        <Pressable role="button" accessibilityLabel="Back" onPress={onBack} />
        <Pressable role="button" accessibilityLabel="Done, back to setup" onPress={onDone} />
      </>
    ),
  };
});
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }) }));
jest.mock('@/hooks/useKitFromDrinks', () => ({ useKitFromDrinks: () => null }));
jest.mock('./FromDrinksStep', () => ({ FromDrinksStep: () => null, fromDrinksCount: () => null }));
jest.mock('./TeamStep', () => {
  const { Text } = jest.requireActual('react-native');
  return { TeamStep: () => <Text>Team step</Text> };
});

beforeEach(() => {
  mockRun = { finished: true, done: [] };
  mockLooks = false;
  mockLoading = false;
  for (const m of [mockPush, mockSkip, mockEnter]) m.mockReset();
});

test('as drawn: Owner · 3 of 8 done, the title, the rest can wait, eight rows', async () => {
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.getByText('OWNER · 3 OF 8 DONE')).toBeTruthy();
  expect(screen.getByText('Set up Little Rye')).toBeTruthy();
  expect(screen.getByText('The rest can wait. Do them when you have a minute.')).toBeTruthy();
  for (const row of [
    'Claim it, Done',
    'Tonight’s menu, Winter · 4 drinks, Done',
    'Where and when, Done',
    'Glassware from your drinks, 2 minutes',
    'Invite your team, One link for everyone',
    'Who sees your page, Menu, for now',
    'Theme, Your colour and your type',
    'Calendars, Optional',
  ])
    expect(screen.getByRole('button', { name: row })).toBeTruthy();
});

test('each row opens its screen', async () => {
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  const open = async (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  await open('Claim it, Done');
  expect(mockPush).toHaveBeenLastCalledWith('/venue-setup?bar=b1&step=claim');
  await open('Tonight’s menu, Winter · 4 drinks, Done');
  expect(mockEnter).toHaveBeenCalledWith('b1');
  expect(mockPush).toHaveBeenLastCalledWith(`/bring-in?step=${encodeURIComponent('Set up Little Rye · Tonight’s menu')}`);
  await open('Where and when, Done');
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1');
  await open('Who sees your page, Menu, for now');
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1/publishing');
  await open('Theme, Your colour and your type');
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1/theme');
  await open('Calendars, Optional');
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1/calendars');
});

test('Where and when not done yet on this device: venue setup picks it up', async () => {
  mockRun = { finished: false, done: ['find'] };
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Where and when, Done' }));
  expect(mockPush).toHaveBeenLastCalledWith('/venue-setup?bar=b1');
});

test('Glassware opens the Kit in place; Done with nothing leaves it for later', async () => {
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Glassware from your drinks, 2 minutes' }));
  expect(screen.getByText('Set up Little Rye · Glassware from your drinks')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Done, back to setup' }));
  expect(mockSkip).toHaveBeenCalledWith('glass');
  expect(screen.getByText('Set up Little Rye')).toBeTruthy();
});

test('Your team waits for the look: it opens How it looks first, then the team', async () => {
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite your team, One link for everyone' }));
  expect(screen.getByText('Your team’s invite wears this: the logo, colour and font go into every email.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Done, on to your team'));
  expect(screen.getByText('Team step')).toBeTruthy();
});

test('with a look set, Your team goes straight to the invites', async () => {
  mockLooks = true;
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Invite your team, One link for everyone' }));
  expect(screen.getByText('Team step')).toBeTruthy();
});

test('the rows wait for the data, so Your team can’t skip the gate', async () => {
  mockLoading = true;
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.queryByRole('button', { name: 'Invite your team, One link for everyone' })).toBeNull();
});
