import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { GlassStep } from '@/components/screens/addDrink/GlassStep';
import type { BarGlass } from '@/hooks/useBarGlassware';
import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';
import { useSettingsStore } from '@/store/useSettingsStore';

const mockSave = jest.fn();
let mockCaps: string[] = [];
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: mockCaps }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [{ id: 'bar-1', name: 'Little Rye' }] }) }));
const mockRocks ={ id: 'bg', glass: 'rocks', variant: null, is_default: true, bar_name: 'Little Rye' } as unknown as BarGlass;
jest.mock('@/hooks/useBarGlassware', () => ({
  useBarGlassware: () => ({ data: [mockRocks] }),
  useBarPageId: () => ({ data: 'page-1' }),
  useSaveBarGlass: () => ({ mutate: mockSave, isPending: false, error: null }),
  barGlassFor: (rows: BarGlass[] | undefined, glass: string) => rows?.find((r) => r.glass === glass && r.is_default) ?? null,
}));

const options = ['Coupe', 'Nick & Nora', 'Martini', 'Rocks', 'Highball'].map((name) => ({ id: null, name }));

function Step() {
  const [draft, setDraft] = useState<WizardDraft>({ ...EMPTY_DRAFT, name: 'Paloma' });
  return <GlassStep draft={draft} set={(c) => setDraft((d) => ({ ...d, ...c }))} options={options} barId="bar-1" barGlasses={[mockRocks]} barVariants={[]} />;
}

beforeEach(() => {
  mockSave.mockReset();
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

  test('a glass it has asks nothing; one it lacks is added in one tap', async () => {
    await renderWithTamagui(<Step />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Rocks' }));
    expect(asked()).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Coupe' }));
    expect(asked()).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to our glassware' }));
    expect(mockSave.mock.calls[0][0]).toMatchObject({ glass: 'coupe', variant: null, name: null, is_default: true });
    await act(() => mockSave.mock.calls[0][1].onSuccess());
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
