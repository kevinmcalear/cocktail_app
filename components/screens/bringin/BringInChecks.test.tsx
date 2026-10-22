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
jest.mock('@/hooks/useBarGlassware', () => ({ ...jest.requireActual('@/hooks/useBarGlassware'), useBarGlassware: () => ({ data: [] }) }));

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
      recipe={
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
        }
      }
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
  const [[drink]] = onSave.mock.calls;
  expect(drink.draft.lines.map((l: { id: string | null }) => l.id)).toEqual(['calv', 'lemon', null]);
  expect(drink.draft.methods).toEqual([{ id: 'm1', name: 'Shaken' }]);
  expect(drink.prepNames).toEqual(['Fig Syrup']);
});

test('a drink read from a photo starts as its drawing; the page stays small, to look at bigger', async () => {
  const onSave = jest.fn();
  const recipe = {
    name: 'Orchard Fizz',
    by: null,
    lines: [{ amount: 45, unit: 'ml', ingredient: 'Calvados', unsure: false }],
    method: null,
    glass: null,
    ice: null,
    garnish: null,
    notes: null,
    at: { page: 1, box: [200, 40, 360, 960] as [number, number, number, number] },
  };
  const page = (name: string, mimeType: string) => ({ uri: `file:///${name}`, mimeType, name });
  await ui(
    <RecipeCheck
      recipe={recipe}
      files={[page('one.jpg', 'image/jpeg'), page('two.jpg', 'image/jpeg')]}
      from="From 2 photos"
      data={data()}
      saving={false}
      error={null}
      onCancel={jest.fn()}
      onSave={onSave}
      onEditAll={jest.fn()}
    />
  );
  expect(screen.getByLabelText('Drawing of Orchard Fizz, drawn from the spec')).toBeTruthy();
  expect(screen.getByText('Drawn from the spec')).toBeTruthy();
  expect(screen.getByText('Page 2 · tap to see it bigger')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'From your file. See it bigger' }));
  expect(screen.getByText('On the page')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save drink' }));
  const [[drink]] = onSave.mock.calls;
  // Nothing from the file goes on the drink as a photo.
  expect(Object.keys(drink.draft.photos ?? {})).toHaveLength(0);
  // It keeps the drawing it was checked with.
  expect(drink.sketch).toBeTruthy();
});

test('a drink read from a PDF names the file instead of offering a bigger look', async () => {
  await ui(
    <RecipeCheck
      recipe={{ name: 'Low Tide', by: null, lines: [], method: null, glass: null, ice: null, garnish: null, notes: null, at: { page: 0, box: [500, 40, 590, 960] } }}
      files={[{ uri: 'file:///specs.pdf', mimeType: 'application/pdf', name: 'specs.pdf' }]}
      from="From a PDF"
      data={data()}
      saving={false}
      error={null}
      onCancel={jest.fn()}
      onSave={jest.fn()}
      onEditAll={jest.fn()}
    />
  );
  expect(screen.getByText('From your file')).toBeTruthy();
  expect(screen.getByText('specs.pdf')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'From your file. See it bigger' })).toBeNull();
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
