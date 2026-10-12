import { screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';
import { paintSketch } from '@/lib/sketch/paint';
import type { SketchInputs } from '@/lib/sketch/types';

import { SceneSvg } from './SketchDrawing';

const MockView = View;
jest.mock('expo-image', () => ({ Image: (props: object) => <MockView testID="drawing" {...props} /> }));

const inputs: SketchInputs = {
  v: 1, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#a01c26', alpha: 0.95 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: 'orange_peel', from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1, variant: null,
};

test('on native a drawing is one image: the whole scene as an SVG document', async () => {
  const scene = paintSketch(inputs, { seed: 'drink-1', detail: 'thumb' });
  await renderWithTamagui(<SceneSvg scene={scene} />);
  const uri = (screen.getByTestId('drawing').props as { source: { uri: string } }).source.uri;
  expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true);
  const doc = atob(uri.slice(uri.indexOf(',') + 1));
  expect(doc.startsWith('<svg')).toBe(true);
  // Every shape is in the picture, not a native view of its own.
  expect(doc.split('<path').length - 1).toBeGreaterThan(20);
});
