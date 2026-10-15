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

const mockFenwick = {
  id: 'm1', maker_profile_id: 'corvid', maker: { handle: 'corvid', display_name: 'Corvid Glass Works' }, shape_item_id: 'coupe-shape', glass: 'coupe' as const,
  variant: 'coupe_wide', name: 'Fenwick coupe', series: 'Fenwick', designer: null, model_code: null, capacity_ml: 190, height_mm: 165, rim_mm: null,
  material: 'crystal', product_url: null,
};
jest.mock('@/components/glass/GlassModelPicker', () => ({
  GlassThumb: () => null,
  GlassModelPicker: ({ onPick, onDescribe }: { onPick: (m: typeof mockFenwick) => void; onDescribe: () => void }) => {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <>
        <Pressable role="button" onPress={() => onPick(mockFenwick)}>
          <Text>Pick Fenwick</Text>
        </Pressable>
        <Pressable role="button" onPress={onDescribe}>
          <Text>Describe it</Text>
        </Pressable>
      </>
    );
  },
}));

const glass = {
  id: 'g1', glass: 'coupe' as const, variant: null, name: 'House coupe', maker: 'A potter', maker_profile_id: null, maker_page: null,
  designer: null, series: null, shape_note: null, source_urls: [], is_default: false, bar_name: 'Bar', model_id: null, model: null,
};

test('adding a glass picks its maker page, keeps the name as written, and trims empty fields to null', async () => {
  const onSave = jest.fn();
  await renderWithTamagui(<GlassForm glass={null} saving={false} onSave={onSave} onCancel={() => {}} />);
  expect(screen.getByText('Which glass is it?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Describe it'));
  await fireEvent.press(screen.getByText('Rocks'));
  await fireEvent.changeText(screen.getByLabelText('Name'), '  Old fashioned  ');
  await fireEvent.press(screen.getByText('Find its maker’s page'));
  await fireEvent.press(screen.getByText('Pick Kimura'));
  expect(screen.getByText('Maker’s page: Kimura Glass')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenCalledWith({
    id: undefined, glass: 'rocks', variant: null, name: 'Old fashioned', maker: 'Kimura Glass', maker_profile_id: 'kimura',
    designer: null, series: null, shape_note: null, model_id: null, is_default: true,
  });
});

test('a maker\'s model brings its type, drawing, maker and series; the venue\'s own name wins', async () => {
  const onSave = jest.fn();
  await renderWithTamagui(<GlassForm glass={null} saving={false} onSave={onSave} onCancel={() => {}} />);
  await fireEvent.press(screen.getByText('Pick Fenwick'));
  expect(screen.getByText('190 ml · 165 mm tall · Crystal')).toBeTruthy();
  expect(screen.queryByText('Who makes it')).toBeNull();
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({
    glass: 'coupe', variant: 'coupe_wide', name: 'Fenwick coupe', maker: 'Corvid Glass Works', maker_profile_id: 'corvid', series: 'Fenwick', model_id: 'm1',
  }));
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Our coupe');
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Our coupe', model_id: 'm1' }));
  await fireEvent.press(screen.getByText('Not this one'));
  expect(screen.getByText('Who makes it')).toBeTruthy();
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

test('another model replaces a name the last model filled in, but not one the venue typed', async () => {
  const onSave = jest.fn();
  const sour = { ...mockFenwick, id: 'm0', name: 'Sour Glass', maker: { handle: 'riedel', display_name: 'Riedel' } };
  const saved = { ...glass, name: 'Sour Glass', model_id: 'm0', model: sour };
  await renderWithTamagui(<GlassForm glass={saved} saving={false} onSave={onSave} onCancel={() => {}} />);
  await fireEvent.press(screen.getByText('Another glass'));
  await fireEvent.press(screen.getByText('Pick Fenwick'));
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'g1', name: 'Fenwick coupe', model_id: 'm1' }));
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Our coupe');
  await fireEvent.press(screen.getByText('Another glass'));
  await fireEvent.press(screen.getByText('Pick Fenwick'));
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Our coupe' }));
});
