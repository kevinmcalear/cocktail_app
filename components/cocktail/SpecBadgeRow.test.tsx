import { fireEvent, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { SpecBadgeRow } from '@/components/cocktail/SpecBadgeRow';
import { renderWithTamagui } from '@/jest.setup';

type Editor = NonNullable<ComponentProps<typeof SpecBadgeRow>['editor']>;

const names = (els: { props: { accessibilityLabel?: string; 'aria-label'?: string } }[]) =>
  els.map((el) => el.props.accessibilityLabel ?? el.props['aria-label']);

// Only the fields SpecBadgeRow reads.
function makeEditor(): Editor {
  const ids: Record<string, string | null> = { method: 'm1', glassware: 'g1', family: null, ice: null };
  return {
    methods: [{ id: 'm1', name: 'Shaken' }, { id: 'm2', name: 'Stirred' }],
    glassware: [{ id: 'g1', name: 'Coupe', icon_key: 'coupe', icon_url: null }],
    families: [{ id: 'f1', name: 'Sour' }],
    iceTypes: [{ id: 'i1', name: 'Cubed' }],
    origin: 'Original',
    getSpecId: (key: string) => ids[key],
    setSpecId: jest.fn(),
    setOrigin: jest.fn(),
    handleDeletePill: jest.fn(),
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
