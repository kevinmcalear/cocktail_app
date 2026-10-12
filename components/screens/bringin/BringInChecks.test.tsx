import { fireEvent, screen } from '@testing-library/react-native';

import { BackbarTheme } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';
import type { MatchData } from '@/lib/bringInMatch';
import type { CatalogItem } from '@/lib/match';

import { BottlesCheck } from './BottlesCheck';
import { RecipeCheck } from './RecipeCheck';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useBulk', () => ({ useSpecCatalog: () => ({ catalog: [], aliases: [], methods: [{ id: 'm1', name: 'Shaken' }], glasses: [], isLoading: false }) }));
jest.mock('@/hooks/useDropdowns', () => ({ useDropdowns: () => ({ data: { iceTypes: [] } }) }));

const item = (id: string, name: string, genericId: string | null = null, barId: string | null = null): CatalogItem => ({ id, name, genericId, barId });
const data = (over: Partial<MatchData> = {}): MatchData => ({
  catalog: [item('calv', 'Calvados'), item('lemon', 'Lemon Juice'), item('camp', 'Campari'), item('chart', 'Chartreuse'), item('cg', 'Green Chartreuse', 'chart'), item('cy', 'Yellow Chartreuse', 'chart'), item('soda', 'Soda Water')],
  aliases: [],
  venueId: null,
  library: [],
  shelf: ['camp'],
  ...over,
});

const ui = (node: React.ReactNode) => renderWithTamagui(<BackbarTheme>{node}</BackbarTheme>);

test('the recipe check shows every line in your unit, flags the hard one, and saves through the wizard draft', async () => {
  const onSave = jest.fn();
  await ui(
    <RecipeCheck
      recipes={[
        {
          name: 'Orchard Fizz',
          by: 'Little Rye',
          lines: [
            { amount: 1.5, unit: 'oz', ingredient: 'Calvados', unsure: false },
            { amount: 0.75, unit: 'oz', ingredient: 'Lemon Juice', unsure: true, doubt: '¾ or ½?' },
            { amount: 0.5, unit: 'oz', ingredient: 'Fig Syrup', unsure: false },
          ],
          method: 'Shaken',
          glass: 'Collins',
          ice: null,
          garnish: null,
          notes: null,
        },
      ]}
      files={[]}
      from="From pasted text"
      data={data()}
      saving={false}
      error={null}
      onCancel={jest.fn()}
      onSave={onSave}
      onEditAll={jest.fn()}
    />
  );
  expect(screen.getByText('45 ml')).toBeTruthy();
  expect(screen.getByText('oz on the page · showing ml')).toBeTruthy();
  expect(screen.getByText('Check this: ¾ or ½? Look at the page')).toBeTruthy();
  expect(screen.getByText('New prep')).toBeTruthy();
  expect(screen.getByDisplayValue('Little Rye')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save drink' }));
  const [[drinks]] = onSave.mock.calls;
  expect(drinks).toHaveLength(1);
  expect(drinks[0].draft.lines.map((l: { id: string | null }) => l.id)).toEqual(['calv', 'lemon', null]);
  expect(drinks[0].draft.methods).toEqual([{ id: 'm1', name: 'Shaken' }]);
  expect(drinks[0].prepNames).toEqual(['Fig Syrup']);
});

test('the bottles check counts what it found, and an open pick still lands as the plain kind', async () => {
  const onSave = jest.fn();
  await ui(
    <BottlesCheck
      reading={{
        kind: 'bottles',
        menu: null,
        recipes: [],
        bottles: [
          { brand: 'Campari', name: 'Campari', kind: 'Bitter', abv: 25 },
          { brand: null, name: 'Chartreuse Liqueur', kind: 'Herbal liqueur', abv: null, doubt: 'Can’t see the label colour' },
          { brand: null, name: 'Calvados', kind: 'Apple brandy', abv: 40 },
        ],
        unreadable: [{ at: null }],
      }}
      files={[]}
      data={data()}
      where="My Bar"
      saving={false}
      error={null}
      onCancel={jest.fn()}
      onRetake={jest.fn()}
      onSave={onSave}
    />
  );
  expect(screen.getByText('4 bottles')).toBeTruthy();
  expect(screen.getByText('Couldn’t read this one')).toBeTruthy();
  expect(screen.getByText('Already on your shelf')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^Add \d to My Bar$/ }));
  const [[saved]] = onSave.mock.calls;
  expect(saved.shelf).toContain('calv');
  expect(saved.had).toBe(1);
});
