import { fireEvent, screen } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { renderWithProviders } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft, type WizardLine } from '@/lib/drinkWizard';

import { useMakePrep } from './useMakePrep';

// A bottle line made in house (Make it house), inside the drink: it can be backed out to the bottle (review of #1187).
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({ ...jest.requireActual('@/hooks/usePrepCard'), useCatalogRecipe: () => ({ data: null }) }));
jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: true }) }));
jest.mock('@/hooks/useSameNamePrep', () => ({ ...jest.requireActual('@/hooks/useSameNamePrep'), useSameNamePrep: () => ({ data: null, checking: false }) }));

const gin: WizardLine = { key: 'g', id: 'gin-1', name: 'London dry gin', amount: '50', unit: 'ml' };
// A line by its name alone, not one of yours yet: the draft's "Make Pine syrup here" (Add-inside, 1).
const pine: WizardLine = { key: 'p', id: null, name: 'Pine syrup', amount: '15', unit: 'ml' };
const drafts: WizardDraft[] = [];
const latest = () => drafts.at(-1)!;

function Harness({ onDraft, lines = [gin] }: { onDraft: (d: WizardDraft) => void; lines?: WizardLine[] }) {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Pine Fizz', lines });
  useEffect(() => onDraft(draft), [draft, onDraft]);
  const set = (c: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...c }));
  const change = (key: string, c: Partial<WizardLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) }));
  const prep = useMakePrep({ draft, set, ingredients: [], aliases: [], add: jest.fn(), change });
  return (
    <>
      <Pressable role="button" aria-label="Make it house" onPress={() => prep.house(draft.lines[0], 'Pine gin', 'infused-oil')} />
      <Pressable role="button" aria-label="Make Pine syrup here" onPress={() => prep.make('Pine syrup', 'p')} />
      {prep.builder}
    </>
  );
}

test('Make it house, a change kept, then Don’t keep it: the line is the bottle again', async () => {
  await renderWithProviders(<Harness onDraft={(d) => void drafts.push(d)} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make it house' }));
  await fireEvent(screen.getByTestId('part-page'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
  await fireEvent.changeText(screen.getByLabelText('Add an ingredient'), 'Spruce tips');
  await fireEvent.press(screen.getByRole('button', { name: /^Add “Spruce tips”$/ }));
  // The kept change makes the line a house-made, the bottle no more.
  expect(latest().lines[0].id).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Back to Pine Fizz/ }));
  expect(screen.getByText('Leave it for now?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Don’t keep it' }));
  expect(latest().lines).toEqual([gin]);
});

// Android's back goes to the page's Modal (walk 9 Nov: it closed with no card and left the line New).
const hardwareBack = () => fireEvent(screen.getByTestId('part-page'), 'requestClose');

test('Android back before Done, nothing changed yet: Leave it for now? asks, and Leave keeps the recipe the page showed', async () => {
  await renderWithProviders(<Harness onDraft={(d) => void drafts.push(d)} lines={[pine]} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make Pine syrup here' }));
  await fireEvent(screen.getByTestId('part-page'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
  await hardwareBack();
  expect(screen.getByText('Leave it for now?')).toBeTruthy();
  // Back on the card is Keep going.
  await hardwareBack();
  expect(screen.queryByText('Leave it for now?')).toBeNull();
  expect(screen.getByTestId('part-page')).toBeTruthy();
  await hardwareBack();
  await fireEvent.press(screen.getByRole('button', { name: 'Leave it for now' }));
  expect(screen.queryByTestId('part-page')).toBeNull();
  // The line is Recipe to finish, with the recipe it was opened with.
  const line = latest().lines[0];
  expect(line.prep?.at).toBeTruthy();
  expect(line.prep?.kind).toBe('syrup');
  expect(line.later).toBeUndefined();
});

test('Back before Done, then Don’t keep it: the line is as it was', async () => {
  await renderWithProviders(<Harness onDraft={(d) => void drafts.push(d)} lines={[pine]} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Make Pine syrup here' }));
  await fireEvent(screen.getByTestId('part-page'), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
  await fireEvent.press(screen.getByRole('button', { name: /^Back to Pine Fizz/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Don’t keep it' }));
  expect(latest().lines).toEqual([pine]);
});
