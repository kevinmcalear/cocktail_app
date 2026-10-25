import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { NearNameDrink } from '@/hooks/useNearNameDrink';
import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { NearNameCard } from './NearNameCard';

// "Salty Boy" is spelled close to Pale Moth's Salti Boi (whole-app canvas, Search page, 3A).
const mockPush = jest.fn();
const mockSave = jest.fn();
const mockStart = jest.fn();
const saltiBoi: NearNameDrink = {
  drink: { id: 'pm-salti', name: 'Salti Boi', barId: 'bar-pm', line: '', menu: null, imageUrl: null, glass: null, classic: { id: 'c-marg', name: 'Margarita' }, spec: [] },
  bar: 'Pale Moth',
  place: 'Pale Moth · Collingwood',
};
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/ds/DrinkImage', () => ({ DrinkImage: () => null }));
jest.mock('@/hooks/useStartFromClassic', () => ({ useStartFromClassic: () => ({ mutate: mockStart, isPending: false }) }));
jest.mock('@/hooks/useSearchNear', () => ({ useSaveSpelling: () => ({ mutate: mockSave }) }));
jest.mock('@/hooks/useNearNameDrink', () => ({
  useNearNameDrink: ({ name, enabled }: { name: string; enabled: boolean }) => (enabled && name === 'Salty Boy' ? saltiBoi : null),
}));

const changed = jest.fn<void, [WizardDraft]>();
function Card({ hidden = false }: { hidden?: boolean }) {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Salty Boy' });
  const set = (patch: Partial<WizardDraft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      changed(next);
      return next;
    });
  return <NearNameCard draft={draft} set={set} barId="bar-lr" venueName="Little Rye" hidden={hidden} />;
}

beforeEach(() => jest.clearAllMocks());

test('asks "Is it the Salti Boi from Pale Moth?"; Yes opens it and keeps the spelling', async () => {
  await renderWithTamagui(<Card />);
  expect(screen.getByText('Is it the Salti Boi from Pale Moth?')).toBeTruthy();
  expect(screen.getByText('Pale Moth · Collingwood · Riff on a Margarita')).toBeTruthy();
  expect(screen.getByText('Spelled close to yours. A different drink keeps your name as you typed it.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^Open Pale Moth’s Salti Boi/ }));
  expect(mockSave).toHaveBeenCalledWith({ itemId: 'pm-salti', typed: 'Salty Boy' });
  expect(mockPush).toHaveBeenCalledWith('/cocktail/pm-salti');
});

test('No, a different drink keeps the name as typed and stops asking', async () => {
  await renderWithTamagui(<Card />);
  await fireEvent.press(screen.getByRole('button', { name: 'No, a different drink' }));
  expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Salty Boy', sameAs: { id: 'pm-salti', name: 'Salti Boi', bar: 'Pale Moth', as: 'different' } }));
  expect(screen.queryByText('Is it the Salti Boi from Pale Moth?')).toBeNull();
});

test('stays out of the way when the same name or a classic is already shown', async () => {
  await renderWithTamagui(<Card hidden />);
  expect(screen.queryByText('Is it the Salti Boi from Pale Moth?')).toBeNull();
});
