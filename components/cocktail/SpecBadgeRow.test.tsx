import { fireEvent, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { SpecBadgeRow } from '@/components/cocktail/SpecBadgeRow';
import { renderWithTamagui } from '@/jest.setup';

type Editor = NonNullable<ComponentProps<typeof SpecBadgeRow>['editor']>;

const names = (els: { props: { accessibilityLabel?: string; 'aria-label'?: string } }[]) =>
  els.map((el) => el.props.accessibilityLabel ?? el.props['aria-label']);

// Only the fields SpecBadgeRow reads.
function makeEditor(methodIds = ['m1']): Editor {
  const ids: Record<string, string | null> = { method: methodIds[0] ?? null, glassware: 'g1', family: null, ice: null };
  return {
    methodIds,
    toggleMethod: jest.fn(),
    methods: [{ id: 'm1', name: 'Shaken' }, { id: 'm2', name: 'Stirred' }],
    glassware: [{ id: 'g1', name: 'Coupe', icon_key: 'coupe', icon_url: null }],
    families: [{ id: 'f1', name: 'Sour' }],
    iceTypes: [{ id: 'i1', name: 'Cubed' }],
    origin: 'Original',
    getSpecId: (key: string) => ids[key],
    setSpecId: jest.fn(),
    setOrigin: jest.fn(),
    handleAddPill: jest.fn(),
    handleAddGlassware: jest.fn(),
    identifyGlassware: jest.fn(),
  } as unknown as Editor;
}

const viewSpec = { method: 'Built', glassware: 'Rocks', family: null, ice: '', origin: 'Classic' };

test('view mode shows only the specs that are set, in order, read-only', async () => {
  await renderWithTamagui(<SpecBadgeRow isEditing={false} viewSpec={viewSpec} editor={makeEditor()} />);

  expect(names(screen.getAllByRole('group'))).toEqual(['Method: Built', 'Glassware: Rocks', 'Origin: Classic']);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

test('edit mode shows every spec as a button named from the editor, not the saved spec', async () => {
  await renderWithTamagui(<SpecBadgeRow isEditing viewSpec={viewSpec} editor={makeEditor()} />);

  expect(names(screen.getAllByRole('button'))).toEqual([
    'Method: Shaken',
    'Glassware: Coupe',
    'Family, not set',
    'Ice, not set',
    'Origin: Original',
  ]);
});

test('picking an option in a badge\'s sheet sets that spec', async () => {
  const editor = makeEditor();
  await renderWithTamagui(<SpecBadgeRow isEditing viewSpec={viewSpec} editor={editor} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Ice, not set' }));
  await fireEvent.press(screen.getByText('Cubed'));
  expect(editor.setSpecId).toHaveBeenCalledWith('ice', 'i1');
  expect(screen.queryByText('Cubed')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Origin: Original' }));
  await fireEvent.press(screen.getByText('Classic'));
  expect(editor.setOrigin).toHaveBeenCalledWith('Classic');
});

test('a drink holds several methods; the sheet adds or takes one off this drink and stays open', async () => {
  const editor = makeEditor(['m1', 'm2']);
  await renderWithTamagui(<SpecBadgeRow isEditing viewSpec={viewSpec} editor={editor} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Method: Shaken, Stirred' }));
  await fireEvent.press(screen.getByText('Stirred'));
  expect(editor.toggleMethod).toHaveBeenCalledWith('m2');
  expect(editor.setSpecId).not.toHaveBeenCalled();
  expect(screen.getByText('Done')).toBeTruthy();

  // Long-pressing a shared method does nothing: no delete from every drink.
  await fireEvent(screen.getByText('Shaken'), 'longPress');
  expect(editor.toggleMethod).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByText('Done'));
  expect(screen.queryByText('Stirred')).toBeNull();
});

test('tapping the chosen glass takes it off this drink', async () => {
  const editor = makeEditor();
  await renderWithTamagui(<SpecBadgeRow isEditing viewSpec={viewSpec} editor={editor} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Glassware: Coupe' }));
  await fireEvent.press(screen.getAllByText('Coupe').at(-1)!);
  expect(editor.setSpecId).toHaveBeenCalledWith('glassware', null);
});
