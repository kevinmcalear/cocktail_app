import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, DrinkImage, Headline, IngredientThumb, PressableScale, Sheet, SheetScrollView, Title, useDs, useSheetClose } from '@/components/ds';
import { MenuDrinkRow, SectionHead } from '@/components/screens/menus/MenuSections';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { displayFaces, layout, radius, space } from '@/constants/tokens';
import { plural } from '@/lib/menus';
import { OLD_FASHIONED_SKETCH, oldFashionedLine, SAMPLE_BOTTLES, SAMPLE_MENU, toggleBottle, TRY_IT_COPY, type TryItKey } from '@/lib/tryItSamples';
import { VENUE_FEATURES } from '@/lib/venueFeatures';

interface TryItSheetProps {
  /** The feature to try; null while closed (the last one stays shown as it animates out). */
  feature: TryItKey | null;
  venueName: string;
  /** Already on: nothing to turn on, just a look. */
  on: boolean;
  onTurnOn: (feature: TryItKey) => void;
  onClose: () => void;
}

/**
 * Try it (canvas first-round-and-features): a feature's sample, bundled in
 * the app and never saved, then Turn on for the venue or Not yet. Only
 * Tonight and Back bar have one (`tryIt` in lib/venueFeatures.ts).
 */
export function TryItSheet({ feature, venueName, on, onTurnOn, onClose }: TryItSheetProps) {
  // The last feature shown, so the sheet keeps its content while it animates out.
  const [shown, setShown] = useState<TryItKey>('tonight');
  if (feature && feature !== shown) setShown(feature);
  const label = VENUE_FEATURES.find((f) => f.key === shown)?.label ?? '';
  return (
    <Sheet visible={!!feature} onClose={onClose} accessibilityLabel={`Try ${label}`}>
      <TryItBody feature={shown} label={label} venueName={venueName} on={on} onTurnOn={onTurnOn} />
    </Sheet>
  );
}

function TryItBody({ feature, label, venueName, on, onTurnOn }: { feature: TryItKey; label: string; venueName: string; on: boolean; onTurnOn: (feature: TryItKey) => void }) {
  const insets = useSafeAreaInsets();
  const close = useSheetClose();
  const copy = TRY_IT_COPY[feature];
  return (
    <SheetScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.head}>
        <Caption tone="muted">{copy.eyebrow}</Caption>
        <Title>{label}</Title>
        <Body tone="muted">{copy.line}</Body>
      </View>
      {feature === 'backBar' ? <BackBarSample /> : <TonightSample />}
      <View style={styles.buttons}>
        {on ? (
          <Button label="Close" size="lg" variant="secondary" onPress={close} />
        ) : (
          <>
            <Button
              label={`Turn on for ${venueName}`}
              size="lg"
              onPress={() => {
                onTurnOn(feature);
                close();
              }}
            />
            <Button label="Not yet" variant="ghost" onPress={close} />
          </>
        )}
      </View>
    </SheetScrollView>
  );
}

/** Six sample bottles to tick, and the Old Fashioned line that follows the ticks. */
function BackBarSample() {
  const ds = useDs();
  const [ticked, setTicked] = useState(() => SAMPLE_BOTTLES.filter((b) => b.have).map((b) => b.id));
  return (
    <View style={styles.sample}>
      <View>
        {SAMPLE_BOTTLES.map((b) => {
          const has = ticked.includes(b.id);
          return (
            <PressableScale
              key={b.id}
              role="checkbox"
              aria-checked={has}
              accessibilityLabel={`${b.name}, ${b.kind}`}
              onPress={() => setTicked((t) => toggleBottle(t, b.id))}
              style={[styles.bottle, { borderBottomColor: ds.c.line }]}
            >
              <IngredientThumb name={b.kind} size={44} />
              <View style={styles.fill}>
                <Body>{b.name}</Body>
                <Caption tone="muted">{b.kind}</Caption>
              </View>
              <View style={[styles.box, has ? { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong }]}>
                {has ? <IconSymbol name="checkmark" size={16} color={ds.accentFill.text} /> : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
      <View role="status" aria-live="polite" style={[styles.stock, { backgroundColor: ds.c.raised }]}>
        <DrinkImage thumb sketchDetail="thumb" sketch={OLD_FASHIONED_SKETCH} itemId="old-fashioned-sample" accessibilityLabel="Old Fashioned" radius="mark" style={styles.stockPicture} />
        <Body style={styles.fill}>{oldFashionedLine(ticked)}</Body>
      </View>
    </View>
  );
}

/** What the Tonight tab shows, from a bundled menu: its name, a section and its rows, still. */
function TonightSample() {
  const ds = useDs();
  const { name, section, drinks } = SAMPLE_MENU;
  return (
    <View style={styles.sample}>
      <View>
        <Headline role="heading" style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </Headline>
        <Caption tone="muted">{`${plural(drinks.length, 'drink')}, in running order`}</Caption>
      </View>
      <View>
        <SectionHead name={section} count={drinks.length} />
        {drinks.map((d) => (
          <MenuDrinkRow key={d.id} drink={d} href={null} isNew={d.isNew} sketch={d.sketch} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.lg },
  head: { gap: space.xs },
  sample: { gap: space.md },
  bottle: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, paddingVertical: space.xs + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  fill: { flex: 1 },
  box: { width: 22, height: 22, borderRadius: radius.mark, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stock: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.control + 4 },
  stockPicture: { width: 36, height: 36 },
  buttons: { gap: space.xs, marginTop: space.sm },
});
