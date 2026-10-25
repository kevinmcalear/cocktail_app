import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { SameNameDrink } from '@/hooks/useSameNameDrink';
import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';
import { nameWaits } from '@/lib/sameName';

import { CreditsStep } from './CreditsStep';
import { NameStepBody } from './NameStepBody';

const mockPush = jest.fn();
const mockStart = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: mockStart, isPending: false }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }) }));
jest.mock('@/components/ds/DrinkImage', () => ({ DrinkImage: () => null }));
jest.mock('@/hooks/useClosestClassic', () => ({ useClosestClassic: () => ({ data: null }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: { id: 'p-me', displayName: 'Jo' } }) }));
jest.mock('@/hooks/useProfiles', () => ({ usePublicPeople: () => ({ data: [] }) }));
jest.mock('@/hooks/useRankings', () => ({ usePublicBars: () => ({ data: [] }) }));
jest.mock('@/hooks/useNearNameDrink', () => ({ useNearNameDrink: () => null }));
jest.mock('@/hooks/useSearchNear', () => ({ useSaveSpelling: () => ({ mutate: jest.fn() }) }));

const negroni: SameNameDrink = {
  id: 'lr-negroni',
  name: 'Negroni',
  barId: 'bar-1',
  line: 'Gin, Campari, sweet vermouth',
  menu: 'Autumn menu',
  imageUrl: null,
  glass: null,
  classic: { id: 'c-negroni', name: 'Negroni' },
  spec: [],
};

// The draft as each change leaves it.
const changed = jest.fn<void, [WizardDraft]>();
const latest = () => changed.mock.calls[changed.mock.calls.length - 1][0];
const update = (patch: Partial<WizardDraft>) => (d: WizardDraft) => {
  const next = { ...d, ...patch };
  changed(next);
  return next;
};

function Name({ match }: { match: SameNameDrink | null }) {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Negroni' });
  const set = (patch: Partial<WizardDraft>) => setDraft(update(patch));
  // The bar's drink only matches while the name is still its name.
  const shown = match && draft.name === match.name ? match : null;
  return <NameStepBody draft={draft} set={set} barId="bar-1" venueName="Little Rye" match={shown} classic={null} resumed={false} onStartOver={() => {}} onDone={() => {}} onStarted={() => {}} />;
}

beforeEach(() => jest.clearAllMocks());

test('the name step says the bar has one, and a version starts from its spec with a word in brackets', async () => {
  mockStart.mockImplementation((_id: string, { onSuccess }: { onSuccess: (c: Partial<WizardDraft>) => void }) => onSuccess({ lines: [], riffOf: { id: 'lr-negroni', name: 'Negroni' } }));
  await renderWithTamagui(<Name match={negroni} />);
  expect(screen.getByText('Little Rye already has a Negroni')).toBeTruthy();
  expect(screen.getByText('Gin, Campari, sweet vermouth · Autumn menu')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Make this a version' })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Make this a version' }));
  expect(mockStart).toHaveBeenCalledWith('lr-negroni', expect.anything());
  // Linked to the classic Little Rye's is a version of, not to Little Rye's itself.
  expect(latest().riffOf).toEqual({ id: 'c-negroni', name: 'Negroni' });
  expect(screen.getByText(/^It starts from Little Rye’s spec: gin, Campari, sweet vermouth\./)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('What’s different about this Negroni'), 'summer');
  expect(latest().name).toBe('Negroni (summer)');
  expect(screen.getByText('Saved as Negroni (summer), next to Little Rye’s Negroni.')).toBeTruthy();
  expect(nameWaits(latest(), null)).toBe(false);

  await fireEvent.press(screen.getByRole('button', { name: 'Not a version' }));
  expect(latest().sameAs).toBeNull();
  // No link to Little Rye's (or its classic) is left for a different drink to carry.
  expect(latest().riffOf).toBeNull();
  expect(screen.getByText('Little Rye already has a Negroni')).toBeTruthy();
});

test("it's a different drink asks for a name that tells it apart; Open it keeps the draft", async () => {
  await renderWithTamagui(<Name match={negroni} />);
  await fireEvent.press(screen.getByRole('button', { name: /^Open Little Rye’s Negroni/ }));
  expect(mockPush).toHaveBeenCalledWith('/cocktail/lr-negroni');

  await fireEvent.press(screen.getByRole('button', { name: 'It’s a different drink' }));
  expect(screen.queryByText('Little Rye already has a Negroni')).toBeNull();
  expect(screen.getByText('Give it a name that tells it apart from Little Rye’s Negroni.')).toBeTruthy();
  expect(nameWaits(latest(), negroni)).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Negroni Bianco');
  expect(nameWaits(latest(), null)).toBe(false);
  expect(latest().riffOf).toBeNull();
});

test('crediting another bar shows its drink, and a version keeps your spec and asks for the word', async () => {
  const plane = { ...negroni, id: 'tvh-plane', name: 'Paper Plane', line: 'Bourbon, Aperol, Amaro Nonino, lemon', menu: null, classic: null };
  const onRename = jest.fn();
  function Credits() {
    const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Paper Plane', place: { id: 'p-tvh', name: 'The Violet Hour' } });
    return <CreditsStep draft={draft} set={(p) => setDraft(update(p))} venueName={null} ingredients={[]} match={draft.sameAs ? null : plane} onRename={onRename} />;
  }
  await renderWithTamagui(<Credits />);
  expect(screen.getByText('The Violet Hour already has a Paper Plane')).toBeTruthy();
  expect(screen.getByText('Open it to save it, rank it or say you made it.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Make this a version' }));
  expect(mockStart).not.toHaveBeenCalled();
  expect(latest().sameAs).toMatchObject({ id: 'tvh-plane', as: 'version', bar: 'The Violet Hour' });
  // No classic behind theirs: linked to their drink (the closest link there is today).
  expect(latest().riffOf).toEqual({ id: 'tvh-plane', name: 'Paper Plane' });
  expect(onRename).toHaveBeenCalled();
});
