import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';

import { SketchHeader } from './SketchHeader';

// The paper band's View as pill reads the signed-in person's prefs; off here.
jest.mock('@/components/ViewAsBanner', () => ({ ViewAsPill: () => null }));
jest.mock('@/components/ds/SketchDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SketchDrawing: () => <View testID="drawing" /> };
});
jest.mock('@/components/ds/AnimatedSketch', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { AnimatedSketch: ({ play }: { play: number }) => <View testID={`animated-${play}`} /> };
});

const header = (draft: WizardDraft, folded = false, step: WizardStep = 'name') => (
  <SketchHeader draft={draft} step={step} onBack={jest.fn()} top={0} side={0} rounded={false} folded={folded} />
);

describe('SketchHeader', () => {
  // Reanimated's exiting animations crashed iOS release builds here: each
  // keystroke swapped the drawing while the keyboard folded the band.
  test('a new drawing fades in over the last one, which stays under it as a layer', async () => {
    const glass = (name: string) => ({ ...EMPTY_DRAFT, name: 'N', glass: { id: null, name } });
    const view = await renderWithTamagui(header(glass('Rocks')));
    expect(screen.getAllByTestId('drawing')).toHaveLength(1);

    // A keystroke that doesn't change the drawing doesn't redraw it.
    await view.rerender(header({ ...glass('Rocks'), name: 'Ne' }));
    expect(screen.getAllByTestId('drawing')).toHaveLength(1);

    await view.rerender(header(glass('Coupe')));
    expect(screen.getAllByTestId('drawing')).toHaveLength(2);
    await view.rerender(header(glass('Highball'), true));
    await view.rerender(header(glass('Flute')));
    expect(screen.getAllByTestId('drawing')).toHaveLength(2);
  });

  test('the review step draws the drink again, and a tap draws it once more', async () => {
    await renderWithTamagui(header({ ...EMPTY_DRAFT, name: 'Negroni' }, false, 'review'));
    // The finished drawing, fading away over the animated one before it starts.
    expect(screen.getAllByTestId('drawing')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('animated-0'));
    expect(await screen.findByTestId('animated-1')).toBeTruthy();
    expect(screen.getAllByTestId('drawing')).toHaveLength(1);
    expect(screen.getByText('Tap to draw it again')).toBeTruthy();
  });

  test('Colour on the band, from the first step, picks the drawing’s watercolour or Auto', async () => {
    const onTint = jest.fn();
    await renderWithTamagui(<SketchHeader draft={{ ...EMPTY_DRAFT, name: 'Fig Leaf Spritz' }} step="name" onBack={jest.fn()} top={0} side={0} rounded={false} onTint={onTint} />);
    await fireEvent.press(screen.getByLabelText('Sketch colour, Fig Leaf Spritz'));
    await fireEvent.press(await screen.findByLabelText('Blush'));
    expect(onTint).toHaveBeenLastCalledWith('#efb7ae');
    await fireEvent.press(screen.getByLabelText('Auto, from the spec'));
    expect(onTint).toHaveBeenLastCalledWith(null);
  });

  test('no Colour without a way to keep it', async () => {
    await renderWithTamagui(header({ ...EMPTY_DRAFT, name: 'Negroni' }));
    expect(screen.queryByLabelText('Sketch colour, Negroni')).toBeNull();
  });

  // Canvas Create, Q17 D: a phone's typing steps get a thumbnail beside the progress; the drawing steps keep it full.
  test('compact on the steps where you type, with the drawing a tap away; full on glass', async () => {
    const view = await renderWithTamagui(header({ ...EMPTY_DRAFT, name: 'Ash Garden' }, false, 'ingredients'));
    expect(screen.queryByText('Updates as you go')).toBeNull();
    await fireEvent.press(await screen.findByLabelText(/^Show the drawing full size/));
    expect(await screen.findByText('Updates as you go')).toBeTruthy();

    await view.rerender(header({ ...EMPTY_DRAFT, name: 'Ash Garden' }, false, 'glass'));
    expect(screen.queryByLabelText(/^Show the drawing full size/)).toBeNull();
    expect(screen.getByText('Updates as you go')).toBeTruthy();
  });
});
