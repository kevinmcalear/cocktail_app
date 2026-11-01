import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { renderWithProviders } from '@/jest.setup';

import { FlowHead } from './FlowHead';
import { Sheet } from './Sheet';

// SwiftUI's sheet, as far as the flow sees it: content while presented, and the two events it sends.
const sheet: { presented?: boolean; change?: (p: boolean) => void; dismiss?: () => void; modifiers?: unknown[] } = {};
jest.mock('@expo/ui/swift-ui', () => {
  const pass = ({ children }: { children?: ReactNode }) => children;
  return {
    Host: pass,
    RNHostView: pass,
    Group: ({ children, modifiers }: { children?: ReactNode; modifiers?: unknown[] }) => {
      sheet.modifiers = modifiers;
      return children;
    },
    BottomSheet: ({ children, isPresented, onIsPresentedChange, onDismiss }: { children?: ReactNode; isPresented: boolean; onIsPresentedChange: (p: boolean) => void; onDismiss: () => void }) => {
      sheet.presented = isPresented;
      sheet.change = onIsPresentedChange;
      sheet.dismiss = onDismiss;
      return isPresented ? children : null;
    },
  };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  presentationDetents: (detents: unknown, options: { selection: unknown }) => ({ detents, selection: options.selection }),
  presentationDragIndicator: () => ({}),
  presentationBackground: () => ({}),
  preferredColorScheme: () => ({}),
}));

function Flow({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(1);
  return (
    <>
      <Pressable role="button" accessibilityLabel="Save from outside" onPress={() => setOpen(false)} />
      <Sheet
        visible={open}
        kind="flow"
        part={step === 1 ? 0.6 : undefined}
        accessibilityLabel="Rank it"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        header={<FlowHead title={`${step} of 2`} done={step === 2} />}
      >
        <Pressable role="button" accessibilityLabel="Next" onPress={() => setStep(2)}>
          <Text>Step {step}</Text>
        </Pressable>
      </Sheet>
    </>
  );
}

const detents = () => sheet.modifiers?.[0] as { detents: unknown[]; selection: unknown };

test('rests part-way, then grows to full height for the next step', async () => {
  await renderWithProviders(<Flow onClose={() => {}} />);
  expect(detents()).toEqual({ detents: [{ fraction: 0.6 }, 'large'], selection: { fraction: 0.6 } });
  await fireEvent.press(screen.getByLabelText('Next'));
  expect(detents()).toEqual({ detents: ['large'], selection: 'large' });
  expect(screen.getByLabelText('Done')).toBeTruthy();
});

test('its X closes it, and the parent hears once it has gone', async () => {
  const onClose = jest.fn();
  await renderWithProviders(<Flow onClose={onClose} />);
  await fireEvent.press(screen.getByLabelText('Close'));
  expect(sheet.presented).toBe(false);
  expect(onClose).not.toHaveBeenCalled();
  await act(() => sheet.dismiss!());
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a swipe down closes it the same way', async () => {
  const onClose = jest.fn();
  await renderWithProviders(<Flow onClose={onClose} />);
  await act(() => sheet.change!(false));
  await act(() => sheet.dismiss!());
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('closed by its parent (a Save), it goes without calling onClose', async () => {
  const onClose = jest.fn();
  await renderWithProviders(<Flow onClose={onClose} />);
  await fireEvent.press(screen.getByLabelText('Save from outside'));
  expect(sheet.presented).toBe(false);
  // SwiftUI reports the binding change as well; that isn't the person closing it.
  await act(() => sheet.change!(false));
  await act(() => sheet.dismiss!());
  expect(onClose).not.toHaveBeenCalled();
});
