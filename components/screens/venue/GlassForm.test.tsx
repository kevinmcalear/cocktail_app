import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { GlassForm } from './GlassForm';

jest.mock('@/components/ds/GlassVariantPicker', () => ({ GlassVariantPicker: () => null }));
jest.mock('@/hooks/useMakers', () => ({
  useMakerSearch: (term: string) => ({ data: term.trim().length >= 2 ? [{ id: 'kimura', handle: 'kimura', display_name: 'Kimura Glass', kind: 'maker' }] : [] }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockFenwick = {
  id: 'm1', maker_profile_id: 'corvid', maker: { handle: 'corvid', display_name: 'Corvid Glass Works' }, shape_item_id: 'coupe-shape', glass: 'coupe' as const,
  variant: 'coupe_wide', name: 'Fenwick coupe', series: 'Fenwick', designer: null, model_code: null, capacity_ml: 190, height_mm: 165, rim_mm: null,
  material: 'crystal', product_url: null,
};
const mockPony = {
  ...mockFenwick, id: 'm2', maker_profile_id: 'nude', maker: { handle: 'nude', display_name: 'Nude' }, glass: 'nick' as const, variant: null,
  name: 'Savage Pony', series: 'Savage', designer: 'Rémy Savage', model_code: 'P67276', capacity_ml: 135, material: 'lead-free crystal',
};
// The makers' glasses: Nude lists the Savage Pony; "Kmart" only finds another maker's glass.
jest.mock('@/hooks/useGlassModels', () => ({
  ...jest.requireActual<typeof import('@/hooks/useGlassModels')>('@/hooks/useGlassModels'),
  useGlassModelSearch: (term: string) => ({ data: term === 'Nude' ? [mockPony] : term === 'Kmart' ? [mockFenwick] : [] }),
}));
const mockPicker = jest.fn();
jest.mock('@/components/glass/GlassModelPicker', () => ({
  GlassThumb: () => null,
  GlassModelPicker: (props: { onPick: (m: import('@/hooks/useGlassModels').GlassModel) => void; onDescribe: () => void; describeLabel?: string }) => {
    mockPicker(props);
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <>
        <Pressable role="button" onPress={() => props.onPick(mockFenwick)}>
          <Text>Pick Fenwick</Text>
        </Pressable>
        <Pressable role="button" onPress={() => props.onPick(mockPony)}>
          <Text>Pick Pony</Text>
        </Pressable>
        <Pressable role="button" onPress={props.onDescribe}>
          <Text>{props.describeLabel ?? 'Describe it'}</Text>
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
  await fireEvent.changeText(screen.getByLabelText('Who makes it'), 'kim');
  await fireEvent.press(screen.getByLabelText('Link Kimura Glass’s page'));
  expect(screen.getByText('Kimura Glass · maker’s page')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenCalledWith({
    id: undefined, glass: 'rocks', variant: null, name: 'Old fashioned', maker: 'Kimura Glass', maker_profile_id: 'kimura',
    designer: null, series: null, shape_note: null, model_id: null, is_default: true,
  });
});

test('a maker\'s model brings its type and drawing and keeps its maker and series; the venue\'s own name wins', async () => {
  const onSave = jest.fn();
  await renderWithTamagui(<GlassForm glass={null} saving={false} onSave={onSave} onCancel={() => {}} />);
  await fireEvent.press(screen.getByText('Pick Fenwick'));
  expect(screen.getByText('190 ml · 165 mm tall · Crystal')).toBeTruthy();
  expect(screen.queryByText('Who makes it')).toBeNull();
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({
    glass: 'coupe', variant: 'coupe_wide', name: 'Fenwick coupe', maker: null, maker_profile_id: null, series: null, designer: null, model_id: 'm1',
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

test('typing over a linked maker unlinks its page and keeps the words', async () => {
  const onSave = jest.fn();
  const linked = { ...glass, maker: 'Kimura Glass', maker_profile_id: 'kimura', maker_page: { handle: 'kimura', display_name: 'Kimura Glass' } };
  await renderWithTamagui(<GlassForm glass={linked} saving={false} onSave={onSave} onCancel={() => {}} />);
  expect(screen.getByText('Kimura Glass · maker’s page')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Who makes it'), 'Kimura, from a market');
  expect(screen.queryByText('Kimura Glass · maker’s page')).toBeNull();
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ maker: 'Kimura, from a market', maker_profile_id: null }));
});

test('a glass described by hand opens on its maker\'s glasses, its own type first, and picking one shows designer and series', async () => {
  const onSave = jest.fn();
  const byHand = { ...glass, glass: 'nick' as const, name: 'Nick & Nora', maker: 'Nude', maker_profile_id: 'nude', maker_page: { handle: 'nude', display_name: 'Nude' } };
  await renderWithTamagui(<GlassForm glass={byHand} saving={false} onSave={onSave} onCancel={() => {}} />);
  expect(screen.getByText('Is it one of these?')).toBeTruthy();
  expect(screen.getByText('Your Nick & Nora by Nude. Pick it and its size, designer and series come with it.')).toBeTruthy();
  expect(mockPicker).toHaveBeenLastCalledWith(expect.objectContaining({ initialTerm: 'Nude', initialGlass: null, preferGlass: 'nick' }));
  await fireEvent.press(screen.getByText('Keep it as I described it'));
  expect(screen.getByLabelText('Who makes it')).toBeTruthy();
  await fireEvent.press(screen.getByText('Find it in the makers’ catalogs'));
  await fireEvent.press(screen.getByText('Pick Pony'));
  expect(screen.getByText('Rémy Savage')).toBeTruthy();
  expect(screen.getByText('Savage')).toBeTruthy();
  expect(screen.getByText('P67276')).toBeTruthy();
  await fireEvent.press(screen.getByText('Save glass'));
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'g1', glass: 'nick', name: 'Nick & Nora', model_id: 'm2', maker: null, maker_profile_id: null }));
});

test('a described glass whose search only finds other makers\' glasses opens on the form', async () => {
  await renderWithTamagui(<GlassForm glass={{ ...glass, maker: 'Kmart' }} saving={false} onSave={() => {}} onCancel={() => {}} />);
  expect(screen.queryByText('Is it one of these?')).toBeNull();
  expect(screen.getByLabelText('Who makes it')).toBeTruthy();
});

test('the catalog starts from the maker and name as typed now, for a new glass too', async () => {
  await renderWithTamagui(<GlassForm glass={null} describe saving={false} onSave={() => {}} onCancel={() => {}} />);
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Little coupe');
  await fireEvent.changeText(screen.getByLabelText('Who makes it'), 'Nude');
  await fireEvent.press(screen.getByText('Find it in the makers’ catalogs'));
  expect(screen.getByText('Your Little coupe by Nude. Pick it and its size, designer and series come with it.')).toBeTruthy();
  expect(mockPicker).toHaveBeenLastCalledWith(expect.objectContaining({ initialTerm: 'Nude', initialGlass: null, preferGlass: 'coupe' }));
});
