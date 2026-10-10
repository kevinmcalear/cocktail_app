import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';

import { Sheet, useSheetClose } from './Sheet';

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
        <Text>Inside</Text>
        <Done />
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
