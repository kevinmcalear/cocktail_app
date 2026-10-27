import { whereFrom } from './ResultRow';

jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [] }) }));

const venues = [{ id: 'bar-1', name: 'Little Rye' }];

// Under a search result, where it's from (board q16-2): what you have first, then the venue's house-made, then the catalog.
test('a found ingredient says where it is from', () => {
  expect(whereFrom({ id: 'a', bar_id: null }, 'On your back bar', venues)).toBe('On your back bar');
  expect(whereFrom({ id: 'b', bar_id: 'bar-1', ingredient_role: 'prep' }, null, venues)).toBe('House-made at Little Rye');
  expect(whereFrom({ id: 'c', bar_id: 'bar-2', ingredient_role: 'prep' }, null, venues)).toBe('House-made');
  expect(whereFrom({ id: 'd', bar_id: null, ingredient_role: 'product' }, null, venues)).toBe('In the catalog');
  expect(whereFrom({ id: 'e', bar_id: 'bar-1', ingredient_role: 'product' }, null, venues)).toBe('Added at Little Rye');
});
