import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { GlassForm } from './GlassForm';

jest.mock('@/components/ds/GlassVariantPicker', () => ({ GlassVariantPicker: () => null }));
jest.mock('@/components/maker/MakerPicker', () => ({
  MakerPicker: ({ onPick }: { onPick: (m: { id: string; display_name: string }) => void }) => {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <Pressable role="button" onPress={() => onPick({ id: 'kimura', display_name: 'Kimura Glass' })}>
        <Text>Pick Kimura</Text>
      </Pressable>
    );
  },
}));

const glass = {
  id: 'g1', glass: 'coupe' as const, variant: null, name: 'House coupe', maker: 'A potter', maker_profile_id: null, maker_page: null,
  designer: null, series: null, shape_note: null, source_urls: [], is_default: false, bar_name: 'Bar',
};

test('adding a glass picks its maker page, keeps the name as written, and trims empty fields to null', async () => {
  const onSave = jest.fn();
  await renderWithTamagui(<GlassForm glass={null} saving={false} onSave={onSave} onCancel={() => {}} />);
  await fireEvent.press(screen.getByText('Rocks'));
  await fireEvent.changeText(screen.getByLabelText('Name'), '  Old fashioned  ');
  await fireEvent.press(screen.getByText('Find its maker’s page'));
  await fireEvent.press(screen.getByText('Pick Kimura'));
  expect(screen.getByText('Maker’s page: Kimura Glass')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenCalledWith({
    id: undefined, glass: 'rocks', variant: null, name: 'Old fashioned', maker: 'Kimura Glass', maker_profile_id: 'kimura',
    designer: null, series: null, shape_note: null, is_default: true,
  });
});

test('changing a glass keeps its id and refuses a name over the limit', async () => {
  const onSave = jest.fn();
  await renderWithTamagui(<GlassForm glass={glass} saving={false} onSave={onSave} onCancel={() => {}} onDelete={() => {}} />);
  expect(screen.getByText('Remove glass')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'x'.repeat(81));
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Coupe no. 2');
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1', name: 'Coupe no. 2', maker: 'A potter', maker_profile_id: null, is_default: false }));
});
