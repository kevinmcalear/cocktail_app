// The unit picked on a spec line sticks for the next drink, per bar (Kevin, 12 Nov).
import { rememberLineUnit } from './rememberLineUnit';
import { getLineUnit, useSettingsStore } from './useSettingsStore';

const at = (barId: string, barUnit: string) => {
  useSettingsStore.getState().setBarUnit(barUnit);
  useSettingsStore.getState().setBarId(barId);
};

test('ml or oz picked on a line is where the next drink starts, at each bar', () => {
  // An ml bar: oz picked on a line is where the next drink's lines start.
  at('rye', 'ml');
  expect(getLineUnit()).toBe('ml');
  rememberLineUnit('oz');
  expect(getLineUnit()).toBe('oz');

  // At an oz bar the same person picks ml there...
  at('moth', 'oz');
  rememberLineUnit('ml');
  expect(getLineUnit()).toBe('ml');

  // ...and back at the first bar, its oz is still theirs.
  at('rye', 'ml');
  expect(getLineUnit()).toBe('oz');

  // A dash or a tbsp is for that line only.
  rememberLineUnit('tbsp');
  expect(getLineUnit()).toBe('oz');
  expect(useSettingsStore.getState().lineUnits).toEqual({ rye: 'oz', moth: 'ml' });
});

test('a pick that is already the start unit still holds that bar', () => {
  useSettingsStore.setState({ units: 'oz', lineUnits: {} });
  at('rye', 'ml');
  rememberLineUnit('oz'); // already oz: kept for rye all the same
  at('moth', 'oz');
  rememberLineUnit('ml');
  at('rye', 'ml');
  expect(getLineUnit()).toBe('oz');
});
