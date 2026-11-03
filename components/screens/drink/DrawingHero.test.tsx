import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/jest.setup';
import type { SketchInputs } from '@/lib/sketch/types';

import { DrinkArt } from './DrawingHero';

// The staged drawing (search, glass, liquid, ice, foam, fizz, garnish, finish), stubbed to what it was asked to play.
const MockText = Text;
jest.mock('@/components/ds/AnimatedSketchLazy', () => ({
  AnimatedSketch: ({ seed, play, glow }: { seed: string; play: number; glow?: boolean }) => <MockText testID="staged">{`${seed}|${play}|${glow ? 'glow' : ''}`}</MockText>,
}));
let mockReduced = false;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));

const sketch: SketchInputs = {
  v: 1, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#a01c26', alpha: 0.95 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: 'orange_peel', from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1, variant: null,
};

beforeEach(() => {
  mockReduced = false;
});

test('the drink page hero draws the whole drawing in front of you, and again on each play', async () => {
  const { rerender } = await renderWithProviders(<DrinkArt itemId="drink-1" sketch={sketch} label="Drawing of a Negroni" size={280} play={0} />);
  expect(screen.getByTestId('staged').props.children).toBe('drink-1|0|glow');
  expect(screen.getByLabelText('Drawing of a Negroni')).toBeTruthy();
  await rerender(<DrinkArt itemId="drink-1" sketch={sketch} label="Drawing of a Negroni" size={280} play={1} />);
  expect(screen.getByTestId('staged').props.children).toBe('drink-1|1|glow');
});

test('with Reduce Motion the hero is the still drawing', async () => {
  mockReduced = true;
  await renderWithProviders(<DrinkArt itemId="drink-1" sketch={sketch} label="Drawing of a Negroni" size={280} play={0} />);
  expect(screen.queryByTestId('staged')).toBeNull();
  expect(screen.getByLabelText('Drawing of a Negroni')).toBeTruthy();
});
