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
const drafts: WizardDraft[] = [];
const latest = () => drafts.at(-1)!;

function Harness({ onDraft }: { onDraft: (d: WizardDraft) => void }) {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Pine Fizz', lines: [gin] });
  useEffect(() => onDraft(draft), [draft, onDraft]);
  const set = (c: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...c }));
  const change = (key: string, c: Partial<WizardLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) }));
  const prep = useMakePrep({ draft, set, ingredients: [], aliases: [], add: jest.fn(), change });
  return (
    <>
      <Pressable role="button" aria-label="Make it house" onPress={() => prep.house(draft.lines[0], 'Pine gin', 'infused-oil')} />
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
