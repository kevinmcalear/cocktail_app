import { act, fireEvent, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, type AlertButton } from 'react-native';

import { renderWithProviders } from '@/jest.setup';

import type { BrandLook } from '../BrandPreview';
import { ThemeAndroid } from './ThemeAndroid.android';
import { ThemePreview } from './ThemePreview';
import type { ThemePartProps } from './ThemeSections';
import { TypeSheet } from './TypeSheet';

// SwiftUI's sheet, as far as the flow sees it: content while presented, and a dismiss once it has gone.
jest.mock('@expo/ui/swift-ui', () => {
  const { useEffect, useRef } = jest.requireActual<typeof import('react')>('react');
  const pass = ({ children }: { children?: ReactNode }) => children;
  return {
    Host: pass,
    RNHostView: pass,
    Group: pass,
    BottomSheet: ({ children, isPresented, onDismiss }: { children?: ReactNode; isPresented: boolean; onDismiss: () => void }) => {
      const was = useRef(isPresented);
      useEffect(() => {
        if (was.current && !isPresented) onDismiss();
        was.current = isPresented;
      }, [isPresented, onDismiss]);
      return isPresented ? children : null;
    },
  };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  presentationDetents: () => ({}),
  presentationDragIndicator: () => ({}),
  presentationBackground: () => ({}),
  preferredColorScheme: () => ({}),
  interactiveDismissDisabled: () => ({}),
}));
jest.mock('@/hooks/useVenueBrand', () => ({ pickPhotoColours: jest.fn() }));
jest.mock('@/hooks/useLogoColours', () => ({ useLogoColours: (_url: string | null, known: string[]) => ({ colours: known, pins: [], aspect: 1 }) }));

const LOOK: BrandLook = { id: 'b1', name: 'Little Rye', logoUrl: null, iconUrl: null, shortName: 'Rye', accent: '#D0643B', displayFace: 'instrument', groundTint: null };

function answer(alert: jest.SpyInstance, text: 'Discard' | 'Cancel') {
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2] as AlertButton[];
  return act(async () => buttons.find((b) => b.text === text)?.onPress?.());
}

describe('Type picker', () => {
  const open = (onClose = jest.fn(), onUse = jest.fn()) => renderWithProviders(<TypeSheet visible look={LOOK} value="instrument" onClose={onClose} onUse={onUse} />);

  test('Done keeps the face picked', async () => {
    const onUse = jest.fn();
    await open(jest.fn(), onUse);
    await fireEvent.press(screen.getByRole('radio', { name: 'Book, Newsreader' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onUse).toHaveBeenCalledWith('newsreader');
  });

  test('closing with a new face asks "Discard changes?" first', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    await open(onClose);
    await fireEvent.press(screen.getByRole('radio', { name: 'Deco, Imbue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(alert.mock.calls[0][0]).toBe('Discard changes?');
    expect(onClose).not.toHaveBeenCalled();
    await answer(alert, 'Discard');
    expect(onClose).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  test('closing with nothing changed just closes', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onClose = jest.fn();
    await open(onClose);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(alert).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});

describe('A preview full size', () => {
  test('opens as a guest sees the page, switches to staff, and Done closes it', async () => {
    const onClose = jest.fn();
    const onScheme = jest.fn();
    await renderWithProviders(<ThemePreview page="drawn" look={LOOK} scheme="light" onScheme={onScheme} onClose={onClose} />);
    expect(screen.getByRole('radio', { name: 'Guest', checked: true })).toBeTruthy();
    expect(screen.getByText('Rank it')).toBeTruthy();
    expect(screen.getByText('Little Rye house spec')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Staff' }));
    expect(screen.getByRole('radio', { name: 'Staff', checked: true })).toBeTruthy();
    expect(screen.getByText('On shift')).toBeTruthy();
    expect(screen.queryByText('Rank it')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(onScheme).toHaveBeenCalledWith('dark');

    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('each page opens: the menu, the bar page, the photo', async () => {
    const view = await renderWithProviders(<ThemePreview page="menu" look={LOOK} scheme="light" onScheme={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Four drinks for the cold coming in')).toBeTruthy();
    await view.rerender(<ThemePreview page="bar" look={LOOK} scheme="dark" onScheme={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('See the menu')).toBeTruthy();
    expect(screen.getByText('Who makes the drinks')).toBeTruthy();
    await view.rerender(<ThemePreview page="photo" look={LOOK} scheme="light" onScheme={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByText('Rank it')).toBeTruthy();
  });

  test('Back on the page closes it too', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<ThemePreview page="drawn" look={LOOK} scheme="light" onScheme={jest.fn()} onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Theme' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Theme on Android', () => {
  const parts = (): ThemePartProps => ({
    row: { id: 'b1', name: 'Little Rye', slug: 'little-rye', logo_url: null, primary_color: '#D0643B', secondary_color: null, display_face: 'instrument', ground_tint: null, short_name: 'Rye', icon_url: null, icon_background: null },
    draft: { logoUrl: null, iconUrl: null, accent: '#D0643B', face: 'instrument', tint: '', shortName: 'Rye', iconBackground: null },
    set: () => () => {},
    suggested: [],
    busy: null,
    problems: {},
    onUpload: jest.fn(),
    onRemoveBackground: jest.fn(),
    look: LOOK,
  });

  test('draws the full-screen dialog: Light and Dark, the pages, Colour, Type for names, Logo', async () => {
    const onScheme = jest.fn();
    const onOpen = jest.fn();
    await renderWithProviders(<ThemeAndroid parts={parts()} canEdit bar={null} onClose={jest.fn()} scheme="light" onScheme={onScheme} onOpen={onOpen} message={null} />);
    expect(screen.getByText('Type for names')).toBeTruthy();
    expect(screen.getByText('Colours come from it')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Neutral' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(onScheme).toHaveBeenCalledWith('dark');
    await fireEvent.press(screen.getByRole('button', { name: 'Drink, drawn at Little Rye, light mode' }));
    expect(onOpen).toHaveBeenCalledWith('drawn');
  });
});
