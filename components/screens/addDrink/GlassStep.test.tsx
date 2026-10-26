import { fireEvent, screen } from '@testing-library/react-native';

import type { BarGlass } from '@/hooks/useBarGlassware';
import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';

import { GlassStep } from './GlassStep';

// "Is this one of your glasses?" reads the venue's glassware and this device's answers; not under test here.
jest.mock('@/components/screens/venue/GlasswarePrompt', () => ({ GlasswarePrompt: () => null }));

const glass = (g: Partial<BarGlass>): BarGlass => ({
  id: 'g', glass: 'coupe', variant: null, name: null, maker: null, maker_profile_id: null, maker_page: null, designer: null, series: null,
  shape_note: null, source_urls: [], model_id: null, model: null, is_default: false, source: null, supplier_id: null, supplier_name: null, count: null, outline: null, capacity_ml: null, photo_path: null,
  bar_name: 'Little Rye', ...g,
});
const BAR = [
  glass({ id: 'fenwick', name: 'Fenwick coupe', variant: 'coupe_wide', model_id: 'm-fenwick', model: { glass: 'coupe' } as BarGlass['model'], is_default: true }),
  glass({ id: 'saucer', name: 'Saucer coupe', variant: 'coupe_saucer' }),
  // The venue's coupe matched to a glass the catalog files as a Nick & Nora: the drink stays a coupe, so it doesn't name it.
  glass({ id: 'pony', name: 'Pony', variant: 'coupe_deep', model_id: 'm-pony', model: { glass: 'nick' } as BarGlass['model'] }),
];
const OPTIONS = [{ id: 'coupe', name: 'Coupe' }, { id: 'rocks', name: 'Rocks' }];
const draft: WizardDraft = { ...EMPTY_DRAFT, name: 'Ash Garden', glass: { id: 'coupe', name: 'Coupe' } };
const last = (set: jest.Mock) => set.mock.calls.at(-1)[0];

test("a shape that is one of the bar's real glasses saves that glass; another shape lets it go", async () => {
  const set = jest.fn();
  await renderWithTamagui(<GlassStep draft={draft} set={set} options={OPTIONS} barId="bar" barGlasses={BAR} barVariants={['coupe_wide']} />);
  await fireEvent.press(screen.getByRole('radio', { name: /Fenwick coupe/ }));
  expect(last(set)).toEqual({ glassVariant: 'coupe_wide', glassModelId: 'm-fenwick' });
  await fireEvent.press(screen.getByRole('radio', { name: /Saucer coupe/ }));
  expect(last(set)).toEqual({ glassVariant: 'coupe_saucer', glassModelId: null });
  await fireEvent.press(screen.getByRole('radio', { name: /Pony/ }));
  expect(last(set)).toEqual({ glassVariant: 'coupe_deep', glassModelId: null });
});
