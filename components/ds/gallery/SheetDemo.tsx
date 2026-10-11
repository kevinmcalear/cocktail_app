import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';

import { Button } from '../Button';
import { Field } from '../Field';
import { Sheet, useSheetClose } from '../Sheet';
import { Body, Caption, Title } from '../Text';
import { SheetScrollView } from '../useSheetDrag';

/** The gallery's sheets: a short one with a field (rubber band, keyboard) and a long scrolling one (scroll hands over to the drag). */
export function SheetDemo() {
  const [open, setOpen] = useState<'short' | 'long' | null>(null);
  const close = () => setOpen(null);
  return (
    <View style={styles.row}>
      <Button label="Short sheet" variant="secondary" onPress={() => setOpen('short')} />
      <Button label="Long sheet" variant="secondary" onPress={() => setOpen('long')} />
      <Sheet visible={open === 'short'} onClose={close} accessibilityLabel="Short sheet" keyboard>
        <View style={styles.body}>
          <Title>Short sheet</Title>
          <Body tone="muted">Drag down anywhere to close it; pull it up and it gives a little.</Body>
          <Field label="A field" placeholder="Opens the keyboard" />
          <Done />
        </View>
      </Sheet>
      <Sheet visible={open === 'long'} onClose={close} accessibilityLabel="Long sheet" header={<Title style={styles.head}>Long sheet</Title>}>
        <SheetScrollView contentContainerStyle={styles.body}>
          {Array.from({ length: 40 }, (_, i) => (
            <Caption key={i}>Row {i + 1}: scroll down, then pull back past the top to close.</Caption>
          ))}
        </SheetScrollView>
      </Sheet>
    </View>
  );
}

function Done() {
  const close = useSheetClose();
  return <Button label="Done" onPress={close} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  head: { paddingHorizontal: space.lg, paddingVertical: space.md },
  body: { padding: space.lg, paddingBottom: space.xxxl, gap: space.md },
});
