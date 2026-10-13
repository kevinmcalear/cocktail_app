import { StyleSheet, View } from 'react-native';

import { Caption, DrinkImage, Headline, PressableScale, useDs } from '@/components/ds';
import { displayFaces, space } from '@/constants/tokens';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, type ItemCategory } from '@/lib/itemRoutes';
import { pourSketch } from '@/lib/sketch/pour';
import type { SearchItem } from '@/types/search';

/**
 * One drink, prep or bottle in Library's grid: its picture (a photo, else its
 * drawing; beer and wine are drawn poured), its name in the venue's display
 * face, and a line under it ("Stirred · Coupe", "Cordial · 1 L · keeps 2 weeks").
 */
export function LibraryTile({ item, line, glassName, width, onPress, onPressIn }: {
  item: SearchItem;
  line: string | null;
  /** Beer and wine: the glass it's drawn in. */
  glassName?: string | null;
  width: `${number}%`;
  onPress: () => void;
  onPressIn?: () => void;
}) {
  const ds = useDs();
  const category = item.category as ItemCategory;
  const poured = category === 'Beer' || category === 'Wine' ? pourSketch(category, item.name, glassName) : null;
  return (
    <PressableScale accessibilityLabel={`${[item.name, line].filter(Boolean).join(', ')}, open`} onPressIn={onPressIn} onPress={onPress} style={[styles.tile, { maxWidth: width }]}>
      <DrinkImage
        thumb
        itemId={item.id}
        source={heroPicture(item.item_images)?.url ?? null}
        ingredient={category === 'Ingredient' ? { id: item.id, name: item.name } : null}
        glass={fallbackGlass(category)}
        sketch={poured}
        accessibilityLabel={item.name}
      />
      <View style={styles.text}>
        <Headline numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {item.name}
        </Headline>
        {line ? (
          <Caption tone="muted" numberOfLines={2}>
            {line}
          </Caption>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: space.sm },
  text: { gap: 2 },
});
