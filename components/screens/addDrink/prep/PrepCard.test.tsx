import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { PrepDraft } from '@/lib/prepKinds';

import { PrepCard } from './PrepCard';

jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/hooks/useNearIngredients', () => ({ useNearIngredients: () => [], useNearIngredientsChecked: () => ({ near: [], checking: false }) }));
jest.mock('@/hooks/useKit', () => ({ useKit: () => ({ owned: [], kit: new Set(), toggle: jest.fn() }) }));
jest.mock('@/hooks/useBarKit', () => ({ useMakingKit: () => ({ kit: new Set(), where: 'My Bar', add: jest.fn() }) }));
jest.mock('@/hooks/usePrepCard', () => ({
  ...jest.requireActual('@/hooks/usePrepCard'),
  useCatalogRecipe: () => ({ data: null }),
}));

const page = (name: string) => renderWithProviders(<PrepCard page name={name} venueName={null} drinkName="Pine Old Fashioned" ingredients={[]} onDone={jest.fn()} onLater={jest.fn()} onClose={jest.fn()} />);

// Kevin, 1 Nov (pick 5): the nested page starts on the lines when the name says what it is.
test('a name that says the kind starts on the lines, with what it is as a row to change', async () => {
  await page('Pine syrup');
  expect(screen.getByText('HOUSE-MADE · DRAFT, INSIDE THE DRINK')).toBeTruthy();
  expect(screen.queryByText('WHAT IS IT')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'What it is: Syrup. Change' }));
  expect(screen.getByText('WHAT IS IT')).toBeTruthy();
});

test('a name that says nothing asks what it is first', async () => {
  await page('Grandma’s secret');
  expect(screen.getByText('WHAT IS IT')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^What it is:/ })).toBeNull();
});

test('typing the name never moves the field: the page stays as it opened', async () => {
  await page('Grandma’s secret');
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Pine syrup');
  expect(screen.getByText('WHAT IS IT')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^What it is:/ })).toBeNull();
});

test('two lines combined, or a typed line to check, open on what it is even when the name says', async () => {
  await renderWithProviders(<PrepCard page first name="Pine syrup" venueName={null} drinkName="Pine Old Fashioned" ingredients={[]} onDone={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByText('WHAT IS IT')).toBeTruthy();
});

describe('Back on the nested page keeps what’s done', () => {
  const back = () => fireEvent.press(screen.getByRole('button', { name: /^Back to Pine Old Fashioned/ }));
  const finished = { kind: 'syrup', lines: [{ key: 'a', id: null, name: 'Sugar', parts: 1, unit: 'g', amount: '' }], steps: [], allergens: [] } as unknown as PrepDraft;

  test('a recipe to write goes on the line to finish', async () => {
    const onLater = jest.fn();
    const onClose = jest.fn();
    await renderWithProviders(<PrepCard page name="Pine syrup" venueName={null} drinkName="Pine Old Fashioned" ingredients={[]} onDone={jest.fn()} onLater={onLater} onClose={onClose} />);
    await back();
    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('a finished recipe opened again and changed keeps the change', async () => {
    const onDone = jest.fn();
    const onClose = jest.fn();
    await renderWithProviders(<PrepCard page initial={finished} name="Pine syrup" venueName={null} drinkName="Pine Old Fashioned" ingredients={[]} onDone={onDone} onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: /^What it is:/ }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Pine needle syrup');
    await back();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][1]).toBe('Pine needle syrup');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('opened and left alone, it stays as it was', async () => {
    const onDone = jest.fn();
    const onClose = jest.fn();
    await renderWithProviders(<PrepCard page initial={finished} name="Pine syrup" venueName={null} drinkName="Pine Old Fashioned" ingredients={[]} onDone={onDone} onClose={onClose} />);
    await back();
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
