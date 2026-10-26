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

// Its own file: an open Sheet from another test leaves the portal behind, and everything after reads as under a modal.
describe('SketchHeader with a hero photo', () => {
  test('a hero photo takes the band: the drawing goes, Keep it brings it back with its Colour (E26)', async () => {
    const onKeep = jest.fn();
    const band = (keepDrawing?: boolean) => (
      <SketchHeader draft={{ ...EMPTY_DRAFT, name: 'Ash Garden', photos: { hero: 'hero.jpg' }, keepDrawing }} step="name" onBack={jest.fn()} top={0} side={0} rounded={false} onTint={jest.fn()} onKeepDrawing={onKeep} />
    );
    const { rerender } = await renderWithTamagui(band());
    expect(screen.queryByLabelText('Sketch colour, Ash Garden')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Keep the drawing, after the photos' }));
    expect(onKeep).toHaveBeenLastCalledWith(true);

    await rerender(band(true));
    expect(screen.getByLabelText('Sketch colour, Ash Garden')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Remove the drawing: photos only on the drink’s page' }));
    expect(onKeep).toHaveBeenLastCalledWith(false);
  });
});
