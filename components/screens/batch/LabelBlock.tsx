import { StyleSheet, View } from 'react-native';

import { TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';

import { LabelCard, useLabelPrint, type BatchLabel } from '../make/MakeLabel';

/** The label for a container while it's made, drawn as it prints, with Print or share label. Loaded only when a container is ticked (BatchContainers). */
export function LabelBlock({ label }: { label: BatchLabel }) {
  const printing = useLabelPrint();
  return (
    <View style={styles.label}>
      <LabelCard label={label} pageRef={printing.ref} onPainted={printing.onPainted} />
      <TextLink label="Print or share label ›" disabled={!printing.painted} onPress={() => void printing.print(label)} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { gap: space.sm, paddingTop: space.md },
});
