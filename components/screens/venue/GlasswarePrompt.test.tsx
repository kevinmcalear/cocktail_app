import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { GlassStep } from '@/components/screens/addDrink/GlassStep';
import type { BarGlass } from '@/hooks/useBarGlassware';
import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';
import { useSettingsStore } from '@/store/useSettingsStore';

// Add opens Kit's Add a glass sheet (components/screens/kit/GlassSheet.tsx, tested there): what it's opened with is under test.
const mockSheet = jest.fn();
jest.mock('@/components/screens/kit/GlassSheet', () => ({ GlassSheet: (props: unknown) => (mockSheet(props), null) }));
let mockCaps: string[] = [];
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: mockCaps }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [{ id: 'bar-1', name: 'Little Rye' }] }) }));
const mockRocks ={ id: 'bg', glass: 'rocks', variant: null, is_default: true, bar_name: 'Little Rye' } as unknown as BarGlass;
jest.mock('@/hooks/useBarGlassware', () => ({
  useBarGlassware: () => ({ data: [mockRocks] }),
  useBarPageId: () => ({ data: 'page-1' }),
  barGlassFor: (rows: BarGlass[] | undefined, glass: string) => rows?.find((r) => r.glass === glass && r.is_default) ?? null,
}));

const options = ['Coupe', 'Nick & Nora', 'Martini', 'Rocks', 'Highball'].map((name) => ({ id: null, name }));

function Step() {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Paloma' });
  return <GlassStep draft={draft} set={(c) => setDraft((d) => ({ ...d, ...c }))} options={options} barId="bar-1" barGlasses={[mockRocks]} barVariants={[]} />;
}

beforeEach(() => {
  mockSheet.mockReset();
  mockPush.mockReset();
  mockCaps = ['prep'];
  useSettingsStore.setState({ glassesNotNow: [] });
});

const asked = () => screen.queryByText('Is this one of your glasses?');

describe('Is this one of your glasses?', () => {
  test('the venue’s glasses lead the list', async () => {
    await renderWithTamagui(<Step />);
    expect(screen.getByText('YOUR GLASSES')).toBeTruthy();
    expect(screen.getByText('OTHER GLASSES')).toBeTruthy();
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual(['Rocks', 'Coupe', 'Nick & Nora', 'Martini', 'Highball']);
  });

  test('a glass it has asks nothing; one it lacks opens the Add sheet on that shape, from the drink', async () => {
    await renderWithTamagui(<Step />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Rocks' }));
    expect(asked()).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Coupe' }));
    expect(asked()).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to our glassware' }));
    const props = mockSheet.mock.calls.at(-1)[0];
    expect(props).toMatchObject({ visible: true, barId: 'bar-1', pageId: 'page-1', initial: { glass: 'coupe', variant: null, name: null }, from: 'From the Paloma' });
    await act(() => props.onSaved());
    expect(screen.getByText('Coupe is in your glassware.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Your glassware' }));
    expect(mockPush).toHaveBeenCalledWith('/settings/bar/bar-1/glassware');
  });

  test('Not now is kept on this device for that glass', async () => {
    await renderWithTamagui(<Step />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Nick & Nora' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(asked()).toBeNull();
    expect(useSettingsStore.getState().glassesNotNow).toEqual(['bar-1:nick:']);
    // Another glass still asks.
    await fireEvent.press(screen.getByRole('radio', { name: 'Martini' }));
    expect(asked()).toBeTruthy();
  });

  test('only someone who may change the glassware is asked', async () => {
    mockCaps = ['specs'];
    await renderWithTamagui(<Step />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Coupe' }));
    expect(asked()).toBeNull();
  });
});
