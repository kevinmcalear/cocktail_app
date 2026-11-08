import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';

import { Button } from '../Button';
import { Field } from '../Field';
import { FlowHead } from '../FlowHead';
import { Sheet, useSheetClose } from '../Sheet';
import { Body, Caption, Title } from '../Text';
import { SheetScrollView } from '../useSheetDrag';

type Frame = { x: number; y: number; width: number; height: number };

/** The gallery's sheets: a short one with a field (rubber band, keyboard), a long scrolling one (scroll hands over to the drag), and one that grows out of its button as Add does. */
export function SheetDemo() {
  const [open, setOpen] = useState<'short' | 'long' | 'flow' | 'grow' | null>(null);
  const [from, setFrom] = useState<Frame | null>(null);
  const growButton = useRef<ComponentRef<typeof View>>(null);
  const [step, setStep] = useState(1);
  const close = () => setOpen(null);
  return (
    <View style={styles.row}>
      <Button label="Short sheet" variant="secondary" onPress={() => setOpen('short')} />
      <Button label="Long sheet" variant="secondary" onPress={() => setOpen('long')} />
      <View ref={growButton} collapsable={false}>
        <Button
          label="Grows from here"
          variant="secondary"
          onPress={() =>
            growButton.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
              setFrom({ x, y, width, height });
              setOpen('grow');
            })
          }
        />
      </View>
      <Button label="Whole flow" variant="secondary" onPress={() => {
          setStep(1);
          setOpen('flow');
        }}
      />
      {/* kind="flow": the system's sheet on phones (Add, Rank it, Theme); small sheets stay ours. */}
      <Sheet
        visible={open === 'flow'}
        onClose={close}
        accessibilityLabel="Whole flow"
        kind="flow"
        part={step === 1 ? 0.5 : undefined}
        header={<FlowHead title={`${step} of 2`} done={step === 2} />}
      >
        <View style={styles.body}>
          <Title>{step === 1 ? 'Part-way' : 'Full height'}</Title>
          <Body tone="muted">kind=&quot;flow&quot;: SwiftUI&apos;s sheet on iOS, resting part-way with part and growing for the next step; Android&apos;s full-screen dialog; the same centred dialog on the web, a little wider.</Body>
          {step === 1 ? <Button label="Next step" onPress={() => setStep(2)} /> : <Done />}
        </View>
      </Sheet>
      <Sheet visible={open === 'short'} onClose={close} accessibilityLabel="Short sheet" keyboard>
        <View style={styles.body}>
          <Title>Short sheet</Title>
          <Body tone="muted">Drag down anywhere to close it; pull it up and it gives a little.</Body>
          <Field label="A field" placeholder="Opens the keyboard" />
          <Done />
        </View>
      </Sheet>
      {/* from: a phone's sheet grows out of the button (Prod-motion-sheet), as Add does from the +. */}
      <Sheet visible={open === 'grow'} onClose={close} accessibilityLabel="Grows from here" from={from} floating keyboard>
        <View style={styles.body}>
          <Title>Grows from here</Title>
          <Body tone="muted">The sheet itself grows out of the button and settles, as Add does from the +. Its words never squash.</Body>
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
