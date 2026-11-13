import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Text } from 'react-native';

import { SwipeDrag } from './SwipeDrag.web';

// The drag's chunk never arrives here: the card waits as it does on a slow phone.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  lazy: () => () => {
    throw new Promise(() => {});
  },
}));

// Second look 12 Nov: the web's swipe was removed to pass the budget. It loads lazily instead (Jest here
// can't run a dynamic import, so the second half reads the file), and the card shows before it's in.
test('the web shows the card at once and loads its drag lazily, with no Gesture Handler', async () => {
  await render(
    <SwipeDrag onSwipe={jest.fn()} tag={null} label="Alaska" style={null}>
      <Text>card</Text>
    </SwipeDrag>
  );
  expect(screen.getByLabelText('Alaska')).toBeTruthy();
  expect(screen.getByText('card')).toBeTruthy();
  const web = readFileSync(join(__dirname, 'SwipeDrag.web.tsx'), 'utf8');
  expect(web).toMatch(/lazy\(\(\) => import\('\.\/SwipeDragPan'\)/);
  const drag = readFileSync(join(__dirname, 'SwipeDragPan.tsx'), 'utf8');
  for (const f of [web, drag]) expect(f).not.toMatch(/^import .*react-native-(gesture-handler|reanimated|worklets)/m);
});
