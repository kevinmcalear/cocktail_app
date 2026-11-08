import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { SameNameDrink } from '@/hooks/useSameNameDrink';
import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';

import { AddBeerWineWizard } from './AddBeerWineWizard';

const mockCreate = jest.fn();
const mockSaved = jest.fn();
const mockReplace = jest.fn();
let mockTaken: SameNameDrink | null = null;
let mockConnected: boolean | null = true;
let mockWaiting = false;
const PUNK = { id: 'b-punk', name: 'BrewDog Punk IPA', brand_maker: 'BrewDog', abv: 5.4, description: 'Scottish IPA.', origin: 'UK', categories: ['IPA'] };

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('@react-native-community/netinfo', () => ({ useNetInfo: () => ({ isConnected: mockConnected }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/hooks/useCreateBeerWine', () => ({
  useCreateBeerWine: () => ({ mutate: mockCreate, isPending: false }),
  useBeerWineWaiting: () => mockWaiting,
  useCatalogBottles: (_kind: string, name: string) => ({ data: name.toLowerCase().includes('punk') ? [PUNK] : [] }),
}));
jest.mock('@/hooks/useSameNameDrink', () => ({ useSameNameDrink: () => ({ data: mockTaken, checking: false }) }));
jest.mock('@/hooks/useReadLabel', () => ({ useReadLabel: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/components/ds/SketchDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SketchDrawing: () => <View testID="drawing" /> };
});

beforeEach(() => {
  mockCreate.mockReset();
  mockSaved.mockReset();
  mockReplace.mockReset();
  mockTaken = null;
  mockConnected = true;
  mockWaiting = false;
  useBeerWineWizardStore.setState({ kept: {} });
});

const laidOut = (id: string) => fireEvent(screen.getByTestId(id), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const next = () => fireEvent.press(screen.getByRole('button', { name: /^Next: / }));

describe('AddBeerWineWizard', () => {
  test('a catalog beer fills in everything and goes straight to the review', async () => {
    await renderWithProviders(<AddBeerWineWizard kind="beer" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-beer');
    expect(screen.getByText('What’s the beer?')).toBeTruthy();
    expect(screen.getByText('BEER · 1 OF 6')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'punk');
    await fireEvent.press(screen.getByRole('button', { name: /^Use BrewDog Punk IPA/ }));

    expect(screen.getByText('Look right?')).toBeTruthy();
    expect(screen.getByText('BrewDog')).toBeTruthy();
    expect(screen.getByText('5.4%')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save beer' }));
    const input = mockCreate.mock.calls[0][0];
    expect(input).toMatchObject({ kind: 'beer', barId: null, queued: false });
    expect(input.draft).toMatchObject({ name: 'BrewDog Punk IPA', maker: 'BrewDog', abv: '5.4', style: 'IPA', origin: 'UK' });

    await act(() => mockCreate.mock.calls[0][1].onSuccess({ id: 'new-beer', warnings: [] }));
    expect(mockSaved).toHaveBeenCalledWith('new-beer');
  });

  test('step by step at a venue: one button a step, region with the producer, strength from the style, a price in words', async () => {
    await renderWithProviders(<AddBeerWineWizard kind="wine" barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-wine');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'house red');
    // Kevin, 8 Nov: the main button alone, no Later.
    expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    // Step 1 has only the X; later steps add a back arrow (Kevin, 8 Nov) that keeps what was typed.
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    await next();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Name').props.value).toBe('House Red');
    await next();
    await fireEvent.changeText(screen.getByLabelText('Producer'), 'Tempier');
    await fireEvent.press(screen.getByRole('radio', { name: 'France' }));
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: 'Red' }));
    expect(screen.getByText('Red draws its colour in the glass and picks the usual glass.')).toBeTruthy();
    await next();

    // The style's usual strength sits between Less strong and Stronger, which walk tenths from it.
    await fireEvent.press(screen.getByRole('radio', { name: '13.5% · usual for Red' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stronger' }));
    expect(screen.getByLabelText('Strength, percent ABV').props.value).toBe('13.6');
    await next();
    expect(screen.getByRole('radio', { name: 'Bordeaux · usual' })).toBeTruthy();
    await next();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Dry' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Earthy' }));
    await next();
    expect(screen.getByText('What does it cost?')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Price'), '18 a glass · 72 a bottle');
    await next();

    expect(screen.getByText('WINE · REVIEW')).toBeTruthy();
    expect(screen.getByText('Dry, Earthy')).toBeTruthy();
    expect(screen.getByText('18 a glass · 72 a bottle')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save wine' }));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      kind: 'wine',
      barId: 'bar-1',
      draft: { name: 'House Red', maker: 'Tempier', style: 'Red', region: 'France', abv: '13.6', tasting: ['Dry', 'Earthy'], price: '18 a glass · 72 a bottle' },
    });
  });

  test('at home there is no price step', async () => {
    useBeerWineWizardStore.getState().patch('beer:home', { name: 'Pils' });
    useBeerWineWizardStore.getState().setStep('beer:home', 'notes');
    await renderWithProviders(<AddBeerWineWizard kind="beer" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-beer');
    expect(screen.getByRole('button', { name: 'Next: review' })).toBeTruthy();
  });

  test('a name already on the list stops Next until it is opened or said to be a different one', async () => {
    mockTaken = { id: 'pils-1', name: 'Pilsner Urquell', barId: 'bar-1', line: '', menu: 'Autumn', imageUrl: null, glass: null, savedAt: '2026-09-14T12:00:00Z', classic: null, spec: [] };
    await renderWithProviders(<AddBeerWineWizard kind="beer" barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-beer');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Pilsner Urquell');
    expect(screen.getByText('Pilsner Urquell is already on the list')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next: brewery' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'It’s a different one' }));
    expect(screen.queryByText('Pilsner Urquell is already on the list')).toBeNull();
    expect(screen.getByRole('button', { name: 'Next: brewery' })).toBeEnabled();
  });

  test('opening the one that exists drops a draft that was only its name', async () => {
    mockTaken = { id: 'pils-1', name: 'Pilsner Urquell', barId: 'bar-1', line: '', menu: 'Autumn', imageUrl: null, glass: null, savedAt: '2026-09-14T12:00:00Z', classic: null, spec: [] };
    await renderWithProviders(<AddBeerWineWizard kind="beer" barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-beer');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Pilsner Urquell');
    await fireEvent.press(screen.getByRole('button', { name: 'Open Pilsner Urquell' }));
    expect(mockReplace).toHaveBeenCalledWith('/beer/pils-1');
    expect(useBeerWineWizardStore.getState().kept['beer:bar-1']).toBeUndefined();
  });

  test('closing with anything typed asks first and keeps the draft', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<AddBeerWineWizard kind="beer" onClose={onClose} onSaved={mockSaved} />);
    await laidOut('add-beer');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockReset();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Guinness');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Leave it for now?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Leave it for now' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useBeerWineWizardStore.getState().kept['beer:home']?.draft.name).toBe('Guinness');
  });

  test('offline, the review saves on this phone and closes', async () => {
    mockConnected = false;
    const onClose = jest.fn();
    useBeerWineWizardStore.getState().patch('beer:home', { name: 'Guinness' });
    useBeerWineWizardStore.getState().setStep('beer:home', 'review');
    await renderWithProviders(<AddBeerWineWizard kind="beer" onClose={onClose} onSaved={mockSaved} />);
    await laidOut('add-beer');
    expect(screen.getByText('You’re offline. Your draft is kept on this phone and saves when you’re back.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save on this phone' }));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ queued: true });
    expect(onClose).toHaveBeenCalled();
  });

  test('reopened while its save waits for signal, it can’t be saved twice', async () => {
    mockWaiting = true;
    useBeerWineWizardStore.getState().patch('beer:home', { name: 'Guinness' });
    useBeerWineWizardStore.getState().setStep('beer:home', 'review');
    await renderWithProviders(<AddBeerWineWizard kind="beer" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-beer');
    await fireEvent.press(screen.getByRole('button', { name: 'Saves when you’re back' }));
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
