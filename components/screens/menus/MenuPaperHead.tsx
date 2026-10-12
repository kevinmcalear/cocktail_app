import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Caption, DrinkImage, Title, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { MenuPicture } from '@/types/menus';

interface MenuPaperHeadProps {
  name: string;
  /** "Saturday, October 17": the night, over the name. None while it has no date. */
  when: string | null;
  pictures: MenuPicture[];
}

/**
 * The top of a home menu's page: a small paper menu card like the one in
 * Collection > Menus (the night, the name in italic, a rule, the drinks'
 * drawings), not the whole printed card. The drinks themselves are the rows
 * under it. Always on paper, in the light theme.
 */
export function MenuPaperHead(props: MenuPaperHeadProps) {
  return (
    <BackbarTheme scheme="light">
      <Paper {...props} />
    </BackbarTheme>
  );
}

function Paper({ name, when, pictures }: MenuPaperHeadProps) {
  const ds = useDs();
  const ink = ds.c.sketchInk;
  const rule = withAlpha(ink, 0.35);
  const shown = pictures.slice(0, 4);
  return (
    <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
      <View style={[styles.frame, { borderColor: rule }]}>
        <Caption color={ink} align="center" style={styles.when}>
          {(when ?? 'No date yet').toUpperCase()}
        </Caption>
        <Title italic color={ink} align="center">
          {name}
        </Title>
        <View style={[styles.rule, { backgroundColor: rule }]} />
        {shown.length ? (
          <View style={styles.pics} aria-hidden>
            {shown.map((p) => (
              <View key={p.id} style={styles.pic}>
                <DrinkImage thumb sketchDetail="thumb" source={p.imageUrl} generated={p.isSketch} glass={null} itemId={p.id} accessibilityLabel={p.name} radius={0} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { borderRadius: radius.control, borderCurve: 'continuous', padding: space.sm },
  frame: { borderWidth: 1, borderRadius: radius.mark, paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: 'center', gap: space.sm },
  when: { fontFamily: fontFamilies.mono, letterSpacing: 1.5 },
  rule: { width: 64, height: 1, marginVertical: space.xs },
  pics: { flexDirection: 'row', justifyContent: 'center', gap: space.md, marginTop: space.sm },
  pic: { width: 64, height: 64 },
});
