import { searchBarLabel } from '@/lib/tabs';

test("Android's search bar says what search starts on from each page (Prod-and)", () => {
  expect(searchBarLabel(['(tabs)', '(1-tonight)'])).toBe('Search or add anything');
  expect(searchBarLabel(['(tabs)', '(2-drinks)', 'drinks'])).toBe('Search your drinks');
  expect(searchBarLabel(['shelf'])).toBe('Search your drinks');
  expect(searchBarLabel(['(tabs)', '(3-discover)', 'discover'])).toBe('Search bars, drinks, bottles');
});
