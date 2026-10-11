import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { renderWithTamagui } from '@/jest.setup';

import { Sheet, useSheetClose } from './Sheet';
import { SheetScrollView } from './useSheetDrag';

// Reanimated's mock finishes every animation at once, so "after it has gone" is right away here.
function Done() {
  const close = useSheetClose();
  return (
    <Pressable role="button" accessibilityLabel="Done" onPress={close}>
      <Text>Done</Text>
    </Pressable>
  );
}

function Host({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Pressable role="button" accessibilityLabel="Open" onPress={() => setOpen(true)} />
      <Pressable role="button" accessibilityLabel="Hide" onPress={() => setOpen(false)} />
      <Sheet
        visible={open}
        accessibilityLabel="Test sheet"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <SheetScrollView>
          <Text>Inside</Text>
          <Done />
        </SheetScrollView>
      </Sheet>
    </>
  );
}

test('the backdrop closes the sheet, after it has animated out', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<Host onClose={onClose} />);
  expect(screen.getByText('Inside')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Close'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Inside')).toBeNull();
});

test('a button inside closes it the same way', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<Host onClose={onClose} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Inside')).toBeNull();
});

test('the parent can hide it and open it again', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<Host onClose={onClose} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Hide' }));
  expect(screen.queryByText('Inside')).toBeNull();
  expect(onClose).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByText('Inside')).toBeTruthy();
});

// A pull on the sheet, as gesture-handler reports it: down by `y`, let go moving at `velocity`.
async function pull(y: number, velocity: number) {
  // The sheet is 800 tall, so a quarter is 200.
  await fireEvent(screen.getByLabelText('Test sheet'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } });
  await act(async () =>
    fireGestureHandler(getByGestureTestId('sheet-drag'), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: 6 },
      { translationY: y / 2 },
      { translationY: y },
      { state: State.END, translationY: y, velocityY: velocity },
    ]),
  );
}

test('a pull down past a quarter of the sheet closes it', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<Host onClose={onClose} />);
  await pull(300, 0);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Inside')).toBeNull();
});

test('a short pull springs back and stays open', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<Host onClose={onClose} />);
  await pull(100, 0);
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByText('Inside')).toBeTruthy();
});

test('a flick down closes it from a short pull', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<Host onClose={onClose} />);
  await pull(60, 1500);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('a long pull flicked back up stays open', async () => {
  const onClose = jest.fn();
  await renderWithTamagui(<Host onClose={onClose} />);
  await pull(400, -800);
  expect(onClose).not.toHaveBeenCalled();
});

test('outside a sheet, SheetScrollView is a plain scroll view', async () => {
  await renderWithTamagui(
    <SheetScrollView>
      <Text>Loose</Text>
    </SheetScrollView>,
  );
  expect(screen.getByText('Loose')).toBeTruthy();
});
