import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, DrinkImage, PressableScale, Sheet, Title, useDs, useSheetClose } from '@/components/ds';
import { space } from '@/constants/tokens';
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
    <BackbarTheme>
      <Sheet visible={visible} onClose={onClose} onDismiss={onDismiss} accessibilityLabel="Rank a drink" style={styles.sheet}>
        <Picks {...rest} />
      </Sheet>
    </BackbarTheme>
  );
}

function Picks({ barName, drinks, onPick }: Omit<RankPickSheetProps, 'visible' | 'onDismiss' | 'onClose'>) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const close = useSheetClose();
  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.lg }]}>
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
                <DrinkImage thumb sketchDetail="thumb" source={d.image_url} generated={!!d.image_is_generated} glass={null} itemId={d.item_id} accessibilityLabel={d.name} radius="control" />
              </View>
              <View style={styles.text}>
                <Body numberOfLines={2}>{d.name}</Body>
                {caption ? <Caption tone="muted">{caption}</Caption> : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
      <Button label="Cancel" variant="ghost" onPress={close} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '85%' },
  body: { padding: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 52 },
  text: { flex: 1, minWidth: 0 },
});
