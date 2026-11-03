import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/jest.setup';
import type { SketchInputs } from '@/lib/sketch/types';

import { DraftDrawing } from './DraftDrawing';

// The drawing is decorative (aria-hidden), so queries look inside hidden elements.
const HIDDEN = { includeHiddenElements: true };
const MockText = Text;
jest.mock('@/components/ds/AnimatedSketchLazy', () => ({
  AnimatedSketch: ({ play, pencil }: { play: number; pencil?: boolean }) => <MockText testID="staged">{`${play}|${pencil ? 'pencil' : ''}`}</MockText>,
}));

const look = (glass: SketchInputs['glass']): SketchInputs => ({
  v: 2, glass, ice: 'large', method: 'stir', liquid: { hex: '#a01c26', alpha: 0.95 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: 'orange_peel', from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1, variant: null,
});

test('the draft draws its pencil drawing when it opens; an edit shows it still; a tap draws the new one', async () => {
  const { rerender } = await renderWithProviders(<DraftDrawing inputs={look('rocks')} seed="d1" size={200} />);
  expect(screen.getByTestId('staged', HIDDEN).props.children).toBe('0|pencil');
  await rerender(<DraftDrawing inputs={look('coupe')} seed="d1" size={200} />);
  expect(screen.queryByTestId('staged', HIDDEN)).toBeNull();
  await fireEvent.press(screen.getByTestId('draft-drawing', HIDDEN));
  expect(screen.getByTestId('staged', HIDDEN).props.children).toBe('1|pencil');
});
