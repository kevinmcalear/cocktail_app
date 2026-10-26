import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';

import { SketchHeader } from './SketchHeader';

// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/components/ds/SketchDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SketchDrawing: () => <View testID="drawing" /> };
});

// RNTL 14: await every fireEvent, or an act() left open empties the next test's render.
describe('SketchHeader with a hero photo', () => {
  test('a hero photo takes the band: the drawing goes, Keep it brings it back with its Colour (E26)', async () => {
    const onKeep = jest.fn();
    const band = (keepDrawing?: boolean) => (
      <SketchHeader draft={{ ...EMPTY_DRAFT, name: 'Ash Garden', photos: { hero: 'hero.jpg' }, keepDrawing }} step="glass" onBack={jest.fn()} top={0} side={0} rounded={false} onTint={jest.fn()} onKeepDrawing={onKeep} />
    );
    const { rerender } = await renderWithTamagui(band());
    expect(screen.queryByLabelText('Sketch colour, Ash Garden')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep the drawing, after the photos' }));
    expect(onKeep).toHaveBeenLastCalledWith(true);

    await rerender(band(true));
    expect(screen.getByLabelText('Sketch colour, Ash Garden')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove the drawing: photos only on the drink’s page' }));
    expect(onKeep).toHaveBeenLastCalledWith(false);
  });

  // Last: it opens a Sheet.
  test('on a typing step the band stays compact: the photo is the thumbnail, the pill in its full-size sheet', async () => {
    const onKeep = jest.fn();
    await renderWithTamagui(
      <SketchHeader draft={{ ...EMPTY_DRAFT, name: 'Ash Garden', photos: { hero: 'hero.jpg' } }} step="name" onBack={jest.fn()} top={0} side={0} rounded={false} onTint={jest.fn()} onKeepDrawing={onKeep} />
    );
    expect(screen.queryByRole('button', { name: 'Keep the drawing, after the photos' })).toBeNull();
    expect(screen.queryByLabelText('Sketch colour, Ash Garden')).toBeNull();
    await fireEvent.press(await screen.findByLabelText('Show the photo full size'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Keep the drawing, after the photos' }));
    expect(onKeep).toHaveBeenLastCalledWith(true);
  });
});
