import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { SketchHeader } from './SketchHeader';

jest.mock('@/components/ds/SketchDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SketchDrawing: () => <View testID="drawing" /> };
});

const header = (draft: WizardDraft, folded = false) => (
  <SketchHeader draft={draft} step="name" onBack={jest.fn()} top={0} side={0} rounded={false} folded={folded} />
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
});
