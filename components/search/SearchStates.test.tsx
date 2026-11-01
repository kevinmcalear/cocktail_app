import type { ReactElement } from 'react';

import { ResultGroup } from './ResultRows';
import { drawnGroups } from './SearchStates';

const group = (key: string, label: string, items: string[] = ['a']) => <ResultGroup key={key} label={label} items={items} render={() => null} />;
const heads = (groups: readonly unknown[]) => groups.map((g) => (g as ReactElement<{ label: string }>).props.label);

const home = [group('yours', 'Your drinks'), group('bars', 'Bars'), group('people', 'People'), group('Drinks at bars', 'Drinks at bars'), group('classics', 'Classics'), group('ingredients', 'Ingredients')];

test('Android reads as one Drinks group, then Bottles, then Bars', () => {
  expect(heads(drawnGroups(home, false))).toEqual(['Drinks', '', '', 'Bottles', 'Bars', 'People']);
});

test('the first group with something in it takes the Drinks heading', () => {
  const empty = [group('yours', 'Your drinks', []), group('classics', 'Classics')];
  expect(heads(drawnGroups(empty, false))).toEqual(['Your drinks', 'Drinks']);
});

test('a bar named what is typed comes right after your own drinks', () => {
  expect(heads(drawnGroups(home, true))).toEqual(['Drinks', 'Bars', '', '', 'Bottles', 'People']);
});
