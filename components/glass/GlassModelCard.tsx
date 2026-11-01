import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, Surface, useDs } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { space } from '@/constants/tokens';
import { glassModelFacts, type GlassModel } from '@/hooks/useGlassModels';

// The maker's line stays as tall as the others; its tap reaches 44 pt.
const HIT = { top: 12, bottom: 12, left: 8, right: 8 };

/**
 * A maker's glass, picked (tools-glassware-picked-phone): its drawing, name
 * and facts, then its maker (a link to their page), designer, series and
 * item code, each on its own line.
 */
export function GlassModelCard({ model, variant }: { model: GlassModel; variant: string | null }) {
  const ds = useDs();
  const maker = model.maker;
  const lines = [
    { label: 'Designer', value: model.designer },
    { label: 'Series', value: model.series },
    { label: 'Item', value: model.model_code },
  ].filter((l) => l.value);
  return (
    <Surface style={styles.card}>
      <View style={styles.head}>
        <GlassThumb glass={model.glass} variant={variant} outline={model.outline} size={72} />
        <View style={styles.flex}>
          <Body>{model.name}</Body>
          <Caption tone="muted">{glassModelFacts(model)}</Caption>
        </View>
      </View>
      <View role="list" style={styles.lines}>
        {maker ? (
          <View role="listitem" style={styles.line}>
            <Caption tone="muted" style={styles.label}>
              Maker
            </Caption>
            <PressableScale role="link" accessibilityLabel={`Maker: ${maker.display_name}`} onPress={() => router.push(`/p/${maker.handle}` as Href)} hitSlop={HIT}>
              <Body style={{ color: ds.accentText }}>{maker.display_name}</Body>
            </PressableScale>
          </View>
        ) : null}
        {lines.map((l) => (
          <View key={l.label} role="listitem" style={styles.line}>
            <Caption tone="muted" style={styles.label}>
              {l.label}
            </Caption>
            <Body style={styles.flex}>{l.value}</Body>
          </View>
        ))}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  lines: { gap: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { width: 72 },
});
