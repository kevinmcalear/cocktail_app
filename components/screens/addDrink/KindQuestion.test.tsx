import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { AddLayerSheet } from './AddLayerSheet';
import { GlassStep } from './GlassStep';

// "Is this one of your glasses?" reads the venue's glassware and this device's answers; not under test here.
jest.mock('@/components/screens/venue/GlasswarePrompt', () => ({ GlasswarePrompt: () => null }));

const OPTIONS = [{ id: 'coupe', name: 'Coupe' }, { id: 'custom', name: 'Custom', kind: 'tiki' }];
const draft: WizardDraft = { ...EMPTY_DRAFT, name: 'Ash Garden' };
const QUESTION = 'What kind of glass is it?';

async function typeGlass(name: string) {
  const set = jest.fn();
  await renderWithTamagui(<GlassStep draft={draft} set={set} options={OPTIONS} barVariants={[]} />);
  await fireEvent.changeText(screen.getByLabelText('Another glass'), name);
  return set;
}
const addedGlass = async (set: jest.Mock) => {
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  return set.mock.calls.at(-1)[0].glass;
};

test('a new glass asks what kind it is, the guess from its name picked to start', async () => {
  const set = await typeGlass('Tiki bowl');
  expect(screen.getByText(QUESTION)).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Tiki mug', checked: true })).toBeTruthy();
  expect(screen.getByText('Picked from the name. Every drink in a Tiki bowl is drawn this way.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Collins' }));
  expect(screen.getByText('Every drink with it is drawn this way.')).toBeTruthy();
  expect(await addedGlass(set)).toEqual({ id: null, name: 'Tiki bowl', kind: 'collins' });
  expect(screen.queryByText(QUESTION)).toBeNull();
});

test('an existing glass asks nothing and keeps its own kind', async () => {
  const set = await typeGlass('custom');
  expect(screen.queryByText(QUESTION)).toBeNull();
  expect(await addedGlass(set)).toEqual({ id: 'custom', name: 'Custom', kind: 'tiki' });
});

test('Not sure saves no kind', async () => {
  const set = await typeGlass('Grandma');
  expect(screen.getByRole('radio', { name: 'Not sure', checked: true })).toBeTruthy();
  expect(screen.getByText('Each drink in it is drawn from its own shape pick.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Rocks' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Not sure' }));
  expect(await addedGlass(set)).toEqual({ id: null, name: 'Grandma', kind: null });
});

test('Other ice asks how it looks in the glass', async () => {
  const onAdd = jest.fn();
  await renderWithTamagui(<AddLayerSheet visible onClose={jest.fn()} onAdd={onAdd} options={[{ id: 'cubes', name: 'Cubes' }]} />);
  await fireEvent.changeText(screen.getByLabelText('Other ice'), 'Hosh');
  expect(screen.getByText('How does it look in the glass?')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Cubes', checked: true })).toBeTruthy();
  expect(screen.getByText('Picked from the name. Every drink with it is drawn this way.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Sphere' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add on top' }));
  // A sphere is one piece, not three cubes.
  expect(onAdd).toHaveBeenCalledWith({ ice: { id: null, name: 'Hosh', kind: 'sphere' }, n: 1 });
});
