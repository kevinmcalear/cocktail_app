import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { Alert } from 'react-native';

import { SpecPickerSheet } from '@/components/cocktail/SpecPickerSheet';
import { renderWithTamagui } from '@/jest.setup';

jest.mock('@/lib/aiConsent', () => ({ ensureAiConsent: jest.fn(async () => true) }));
jest.mock('@/lib/imageBase64', () => ({ uriToBase64: jest.fn(async () => 'BASE64') }));
jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///glass.jpg', mimeType: 'image/jpg' }],
  })),
}));

type Props = ComponentProps<typeof SpecPickerSheet>;

async function renderSheet(props: Partial<Props> = {}) {
  const all: Props = {
    visible: true,
    title: 'Method',
    category: 'method',
    options: [
      { id: 'm1', name: 'Shaken' },
      { id: 'm2', name: 'Stirred' },
    ],
    selectedId: 'm1',
    onSelect: jest.fn(),
    onClose: jest.fn(),
    ...props,
  };
  await renderWithTamagui(<SpecPickerSheet {...all} />);
  return all;
}

beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test('tapping an option selects it and closes the sheet', async () => {
  const { onSelect, onClose } = await renderSheet();

  await fireEvent.press(screen.getByText('Stirred'));
  expect(onSelect).toHaveBeenCalledWith('m2');
  expect(onClose).toHaveBeenCalled();
});

test('tapping the selected option clears it only when deselect is allowed', async () => {
  const kept = await renderSheet();
  await fireEvent.press(screen.getByText('Shaken'));
  expect(kept.onSelect).toHaveBeenCalledWith('m1');
  await screen.unmount();

  const cleared = await renderSheet({ allowDeselect: true });
  await fireEvent.press(screen.getByText('Shaken'));
  expect(cleared.onSelect).toHaveBeenCalledWith(null);
});

test('long-pressing an option offers to delete it', async () => {
  const onDelete = jest.fn();
  await renderSheet({ onDelete });

  await fireEvent(screen.getByText('Stirred'), 'longPress');
  expect(onDelete).toHaveBeenCalledWith({ id: 'm2', name: 'Stirred' });
});

test('adding an option saves the trimmed name, selects it and closes', async () => {
  const onAdd = jest.fn(async () => 'm3');
  const { onSelect, onClose } = await renderSheet({ onAdd });

  await fireEvent.press(screen.getByText('+ Add'));
  await fireEvent.changeText(screen.getByPlaceholderText('New method'), '  Thrown ');
  await fireEvent.press(screen.getByText('Add'));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(onAdd).toHaveBeenCalledWith('Thrown');
  expect(onSelect).toHaveBeenCalledWith('m3');
});

test('a failed add shows the error and keeps the sheet open', async () => {
  const onAdd = jest.fn(async () => {
    throw new Error('That method already exists.');
  });
  const { onSelect, onClose } = await renderSheet({ onAdd });

  await fireEvent.press(screen.getByText('+ Add'));
  await fireEvent.changeText(screen.getByPlaceholderText('New method'), 'Shaken');
  await fireEvent.press(screen.getByText('Add'));

  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'That method already exists.'));
  expect(onSelect).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText('New method')).toBeTruthy();
});

test('only the glassware sheet offers photo identification', async () => {
  await renderSheet({ onIdentifyGlassware: jest.fn() });
  expect(screen.queryByText('Identify from photo')).toBeNull();
});

test('identifying glassware from a photo adds and selects the matched glass', async () => {
  const onIdentifyGlassware = jest.fn(async () => ({ suggestedName: 'Coupe', matchedIcon: 'coupe', iconUrl: null }));
  const onAddGlassware = jest.fn(async () => 'g9');
  const { onSelect, onClose } = await renderSheet({
    title: 'Glassware',
    category: 'glassware',
    options: [],
    selectedId: null,
    onIdentifyGlassware,
    onAddGlassware,
  });

  await fireEvent.press(screen.getByText('Identify from photo'));
  await fireEvent.press(await screen.findByText('Use this glass'));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  // The picker's "image/jpg" is normalised to a real MIME type.
  expect(onIdentifyGlassware).toHaveBeenCalledWith('BASE64', 'image/jpeg');
  expect(onAddGlassware).toHaveBeenCalledWith({ name: 'Coupe', iconKey: 'coupe', iconUrl: null });
  expect(onSelect).toHaveBeenCalledWith('g9');
});

test('a glass with no icon is reported and not added', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const onAddGlassware = jest.fn();
  await renderSheet({
    title: 'Glassware',
    category: 'glassware',
    options: [],
    selectedId: null,
    onIdentifyGlassware: jest.fn(async () => ({ suggestedName: 'Vase', matchedIcon: null, iconUrl: null })),
    onAddGlassware,
  });

  await fireEvent.press(screen.getByText('Identify from photo'));

  await waitFor(() =>
    expect(Alert.alert).toHaveBeenCalledWith(
      'Could not identify glass',
      'Could not match or generate an icon for this glass.'
    )
  );
  expect(screen.queryByText('Use this glass')).toBeNull();
  expect(onAddGlassware).not.toHaveBeenCalled();
});
