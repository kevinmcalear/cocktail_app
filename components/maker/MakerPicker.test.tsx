import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { MakerPicker } from './MakerPicker';

// "steelite utpia" matches nothing as typed; the database says it's close to Steelite-Utopia (marked near).
jest.mock('@/hooks/useMakers', () => ({
  useMakerSearch: (term: string) => ({ data: term === 'steelite utpia' ? [{ id: 'm-steelite', handle: 'steelite', display_name: 'Steelite-Utopia', kind: 'maker', near: true }] : [], isFetching: false }),
}));

test('a close spelling asks Did you mean, and tapping it picks that maker', async () => {
  const onPick = jest.fn();
  await renderWithTamagui(<MakerPicker label="Who makes it?" onPick={onPick} />);
  await fireEvent.changeText(screen.getByLabelText('Who makes it?'), 'steelite utpia');
  expect(screen.getByText('Did you mean')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Pick Steelite-Utopia' }));
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-steelite' }));
});
