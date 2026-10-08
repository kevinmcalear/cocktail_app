import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useBeerWineWizardStore } from '@/store/useBeerWineWizardStore';

import { AddBeerWineWizard } from './AddBeerWineWizard';

const mockCreate = jest.fn();
const mockSaved = jest.fn();
const PUNK = { id: 'b-punk', name: 'BrewDog Punk IPA', brand_maker: 'BrewDog', abv: 5.4, description: 'Scottish IPA.', origin: 'UK', categories: ['IPA'] };

jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/hooks/useCreateBeerWine', () => ({
  useCreateBeerWine: () => ({ mutate: mockCreate, isPending: false }),
  useCatalogBottles: (_kind: string, name: string) => ({ data: name.toLowerCase().includes('punk') ? [PUNK] : [] }),
}));
jest.mock('@/hooks/useReadLabel', () => ({ useReadLabel: () => ({ mutate: jest.fn(), isPending: false }) }));
jest.mock('@/components/ds/SketchDrawing', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SketchDrawing: () => <View testID="drawing" /> };
});

beforeEach(() => {
  mockCreate.mockReset();
  mockSaved.mockReset();
  useBeerWineWizardStore.setState({ kept: {} });
});

const laidOut = (id: string) => fireEvent(screen.getByTestId(id), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } } });
const next = () => fireEvent.press(screen.getByRole('button', { name: /^Next: / }));

describe('AddBeerWineWizard', () => {
  test('a catalog beer fills in everything and goes straight to the review', async () => {
    await renderWithTamagui(<AddBeerWineWizard kind="beer" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-beer');
    expect(screen.getByText('What’s the beer?')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'punk');
    await fireEvent.press(screen.getByRole('button', { name: /^BrewDog Punk IPA/ }));

    expect(screen.getByText('Look right?')).toBeTruthy();
    expect(screen.getByText('BrewDog')).toBeTruthy();
    expect(screen.getByText('5.4% ABV')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save beer' }));
    const input = mockCreate.mock.calls[0][0];
    expect(input).toMatchObject({ kind: 'beer', barId: null });
    expect(input.draft).toMatchObject({ name: 'BrewDog Punk IPA', maker: 'BrewDog', abv: '5.4', style: 'IPA', origin: 'UK' });

    await act(() => mockCreate.mock.calls[0][1].onSuccess({ id: 'new-beer', warnings: [] }));
    expect(mockSaved).toHaveBeenCalledWith('new-beer');
    expect(useBeerWineWizardStore.getState().kept['beer:home']).toBeUndefined();
  });

  test('step by step at a venue: kind, strength from the style, tasting words and a price', async () => {
    await renderWithTamagui(<AddBeerWineWizard kind="wine" barId="bar-1" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-wine');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'house red');
    await next();
    await fireEvent.changeText(screen.getByLabelText('Producer'), 'Tempier');
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: 'Red' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'France' }));
    await next();

    // The style's usual strength is offered first; − and + walk tenths from it.
    expect(screen.getByRole('radio', { name: '13.5%, suggested' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Stronger' }));
    expect(screen.getByLabelText('Strength, percent ABV').props.value).toBe('13.5');
    await fireEvent.press(screen.getByRole('button', { name: 'Stronger' }));
    expect(screen.getByLabelText('Strength, percent ABV').props.value).toBe('13.6');
    await next();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Bold' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Earthy' }));
    expect(screen.getByText('Reads: Bold and earthy.')).toBeTruthy();
    await next();
    expect(screen.getByText('What does it cost?')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Price'), '14');
    await next();

    expect(screen.getByText('Red, France')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save wine' }));
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      kind: 'wine',
      barId: 'bar-1',
      draft: { name: 'House Red', maker: 'Tempier', style: 'Red', region: 'France', abv: '13.6', tasting: ['Bold', 'Earthy'], price: '14' },
    });
  });

  test('at home there is no price step', async () => {
    useBeerWineWizardStore.getState().patch('beer:home', { name: 'Pils' });
    useBeerWineWizardStore.getState().setStep('beer:home', 'notes');
    await renderWithTamagui(<AddBeerWineWizard kind="beer" onClose={jest.fn()} onSaved={mockSaved} />);
    await laidOut('add-beer');
    expect(screen.getByRole('button', { name: 'Next: review' })).toBeTruthy();
  });
});
