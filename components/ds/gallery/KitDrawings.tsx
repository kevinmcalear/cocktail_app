import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/tokens';
import { kitArt } from '@/lib/sketch/kit';
import { EQUIPMENT } from '@/lib/techniques/equipment';

import { EquipmentDrawing } from '../EquipmentDrawing';
import { EquipmentThumb } from '../EquipmentThumb';
import { Caption } from '../Text';

/** Every piece of bar kit, drawn at tile size (full detail) and as a 44 px thumb, with the drawing it maps to. */
export function KitDrawings() {
  return (
    <View style={styles.wrap}>
      {EQUIPMENT.map((e) => {
        const art = kitArt(e.id);
        return (
          <View key={e.id} style={styles.tile}>
            <View style={styles.square}>
              <EquipmentDrawing id={e.id} />
            </View>
            <View style={styles.row}>
              <EquipmentThumb id={e.id} name={e.name} size={44} />
              <View style={styles.text}>
                <Caption numberOfLines={2}>{e.name}</Caption>
                <Caption tone="muted" numberOfLines={1}>
                  {art.variant ? `${art.kind} · ${art.variant}` : art.kind}
                </Caption>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: 150, gap: space.xs },
  square: { width: 110, height: 110, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  text: { flex: 1 },
});
