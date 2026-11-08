import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { layout, space } from '@/constants/tokens';

import { DragGrip, DragList } from '../DragList';
import { Body, Caption } from '../Text';
import { useDs } from '../theme';

const LINES = [
  { key: 'a', name: 'Tempus Fugit Crème de Cacao', pour: '22.5 ml' },
  { key: 'b', name: 'Blended Scotch', pour: '60 ml' },
  { key: 'c', name: 'Lemon', pour: '22.5 ml' },
  { key: 'd', name: 'Honey ginger syrup', pour: '22.5 ml' },
  { key: 'e', name: 'Islay Scotch', pour: '7.5 ml' },
];

/** DragList with the one grip (Add-drag): hold a line and move it; on the web the arrow keys, or Space then the arrows, move a focused grip. */
export function DragDemo() {
  const ds = useDs();
  const [lines, setLines] = useState(LINES);
  return (
    <View>
      <DragList
        label="Sample spec"
        data={lines}
        keyOf={(l) => l.key}
        onReorder={setLines}
        renderRow={(l, { lifted, grip, move }) => (
          <View style={[styles.row, { borderBottomColor: lifted ? 'transparent' : ds.c.line }]}>
            {grip(<DragGrip name={l.name} onMove={move} lifted={lifted} />)}
            <Body style={styles.name} numberOfLines={1}>
              {l.name}
            </Body>
            <Caption tone="muted">{l.pour}</Caption>
          </View>
        )}
      />
      <Caption tone="muted" style={styles.note}>
        Hold a line to lift it; the others ease aside, and near the edge the page scrolls.
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingHorizontal: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1 },
  note: { paddingTop: space.sm },
});
