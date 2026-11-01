import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { SetupChecklist } from './SetupChecklist';

const [mockPush, mockSkip] = [jest.fn(), jest.fn()];
let mockRun: { finished: boolean; done: string[] } | undefined = { finished: true, done: [] };
let mockLooks = false;
let mockLoading = false;
const DONE = { claim: true, menu: true, where: true, glassware: false, team: false, visibility: false, theme: false, calendars: false };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn() }) }));
// The theme, opened from Theme or from Your team: a setup page whose footer saves and goes on.
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
    lines: { menu: 'Winter · 4 drinks', visibility: 'Menu, for now', claim: null, where: null },
    menuId: 'm1',
    looks: mockLooks,
    loading: mockLoading,
    skip: mockSkip,
  }),
}));
jest.mock('./SetupChecklistParts', () => {
  const { Text } = jest.requireActual('react-native');
  return { LookFirstNote: () => <Text>Your team’s invite wears this</Text> };
});
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
jest.mock('./MenuStep', () => ({ MenuStep: () => null }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }) }));
jest.mock('@/hooks/useKitFromDrinks', () => ({ useKitFromDrinks: () => null }));
jest.mock('./FromDrinksStep', () => ({ FromDrinksStep: () => null, fromDrinksCount: () => null }));
jest.mock('./TeamStep', () => {
  const { Text } = jest.requireActual('react-native');
  return { TeamStep: () => <Text>Team step</Text> };
});

const row = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });

beforeEach(() => {
  mockRun = { finished: true, done: [] };
  mockLooks = false;
  mockLoading = false;
  for (const m of [mockPush, mockSkip]) m.mockReset();
});

test('the eight rows as drawn, three done; the glassware opens in place and comes back here', async () => {
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.getByText('Set up Little Rye')).toBeTruthy();
  expect(screen.getByText('OWNER · 3 OF 8 DONE')).toBeTruthy();
  expect(screen.getByText('The rest can wait. Do them when you have a minute.')).toBeTruthy();
  expect(row('Claim it').props.accessibilityLabel).toBe('Claim it, Done');
  expect(row('Tonight’s menu').props.accessibilityLabel).toBe('Tonight’s menu, Winter · 4 drinks, Done');
  expect(row('Where and when').props.accessibilityLabel).toBe('Where and when, Done');
  for (const [title, line] of [
    ['Glassware from your drinks', '2 minutes'],
    ['Invite your team', 'One link for everyone'],
    ['Who sees your page', 'Menu, for now'],
    ['Theme', 'Your colour and your type'],
    ['Calendars', 'Optional'],
  ]) expect(row(title).props.accessibilityLabel).toBe(`${title}, ${line}`);
  await fireEvent.press(row('Glassware from your drinks'));
  expect(screen.getByText('Set up Little Rye · Glassware from your drinks')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockSkip).not.toHaveBeenCalled();
  // Done with no glasses leaves the row for later, and comes back here too.
  await fireEvent.press(row('Glassware from your drinks'));
  await fireEvent.press(screen.getByRole('button', { name: 'Done, back to setup' }));
  expect(mockSkip).toHaveBeenCalledWith('glassware');
  expect(row('Glassware from your drinks')).toBeTruthy();
});

test('the pages each row opens', async () => {
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(row('Claim it'));
  expect(mockPush).toHaveBeenLastCalledWith('/venue-setup?bar=b1&step=claim');
  await fireEvent.press(row('Tonight’s menu'));
  expect(mockPush).toHaveBeenLastCalledWith('/menus/m1/edit');
  await fireEvent.press(row('Where and when'));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1');
  await fireEvent.press(row('Who sees your page'));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1/publishing');
  await fireEvent.press(row('Calendars'));
  expect(mockPush).toHaveBeenLastCalledWith('/settings/bar/b1/calendars');
});

test('setup not through yet: Where and when picks venue setup up', async () => {
  mockRun = { finished: false, done: ['find', 'place'] };
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(row('Where and when'));
  expect(mockPush).toHaveBeenLastCalledWith('/venue-setup?bar=b1');
});

test('Theme opens the look here, and Done comes back to the list', async () => {
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(row('Theme'));
  expect(screen.queryByText('Your team’s invite wears this')).toBeNull();
  await fireEvent.press(screen.getByText('Done'));
  expect(screen.getByText('OWNER · 3 OF 8 DONE')).toBeTruthy();
});

test('Your team waits for the theme: it opens the look first, then the team', async () => {
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(row('Invite your team'));
  expect(screen.getByText('Your team’s invite wears this')).toBeTruthy();
  expect(screen.getByText('How Little Rye looks')).toBeTruthy();
  await fireEvent.press(screen.getByText('Done, on to your team'));
  expect(screen.getByText('Team step')).toBeTruthy();
});

test('with a look set, Your team goes straight to the invites', async () => {
  mockLooks = true;
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  await fireEvent.press(row('Invite your team'));
  expect(screen.getByText('Team step')).toBeTruthy();
});

test('the rows wait for the bar to load, so Your team can\'t skip the gate', async () => {
  mockLoading = true;
  await renderWithProviders(<SetupChecklist barId="b1" name="Little Rye" />);
  expect(screen.getByText('Loading…')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Invite your team/ })).toBeNull();
});
