import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, DrinkImage, PressableScale, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { topDrinkCaption, type BarTopDrink } from '@/lib/barTopDrinks';

interface RankPickSheetProps {
  visible: boolean;
  barName: string;
  drinks: BarTopDrink[];
  onPick: (drink: BarTopDrink) => void;
  onClose: () => void;
  /** iOS: once the sheet has gone, so the rank sheet can open (two modals can't present at once). */
  onDismiss?: () => void;
}

/** "Rank a drink" on a bar's page: which of the bar's drinks did you have? Picking one opens the comparison sheet. */
export function RankPickSheet({ visible, onClose, onDismiss, ...rest }: RankPickSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      <BackbarTheme>
        <Sheet onClose={onClose} {...rest} />
      </BackbarTheme>
    </Modal>
  );
}

function Sheet({ barName, drinks, onPick, onClose }: Omit<RankPickSheetProps, 'visible' | 'onDismiss'>) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  return (
    <Pressable accessibilityLabel="Close" style={[styles.scrim, { backgroundColor: ds.c.scrim }]} onPress={onClose}>
      <Pressable
        role="dialog"
        aria-label="Rank a drink"
        style={[styles.sheet, { backgroundColor: ds.c.ground, paddingBottom: insets.bottom + space.lg }]}
        onPress={(e) => e.stopPropagation()}
      >
        <ScrollView contentContainerStyle={styles.body}>
          <Title>Rank a drink</Title>
          <Body tone="muted">{`What did you have at ${barName}?`}</Body>
          <View role="list">
            {drinks.map((d) => {
              const caption = topDrinkCaption(d);
              return (
                <PressableScale
                  key={d.item_id}
                  role="button"
                  accessibilityLabel={`Rank ${d.name}${caption ? `, ${caption}` : ''}`}
                  onPress={() => onPick(d)}
                  style={[styles.row, { borderBottomColor: ds.c.line }]}
                >
                  <View style={styles.thumb}>
                    <DrinkImage source={d.image_url} generated={!!d.image_is_generated} glass={null} itemId={d.item_id} accessibilityLabel={d.name} radius="control" hideTag />
                  </View>
                  <View style={styles.text}>
                    <Body numberOfLines={2}>{d.name}</Body>
                    {caption ? <Caption tone="muted">{caption}</Caption> : null}
                  </View>
                </PressableScale>
              );
            })}
          </View>
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '85%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous' },
  body: { padding: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 44 },
  text: { flex: 1, minWidth: 0 },
});
