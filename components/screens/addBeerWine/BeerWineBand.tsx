import { StyleSheet, View } from 'react-native';

import { DsText, GlassButton } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { font, layout, space } from '@/constants/tokens';
import type { SketchInputs } from '@/lib/sketch/types';

import type { BandPlace } from '../addDrink/WizardFrame';

/** The glass's height: small enough that the question and its answers lead (Add-beer). */
const ART = 120;

/**
 * The top of a beer or wine being added (boards Add-beer, Add-wine): X to
 * close (and a back arrow beside it after the first step), its kind as the title, and its glass, drawn grey when empty, filling
 * and recolouring as the steps are answered. While typing on a phone it
 * folds to the X and the title, so the field and the keyboard both fit.
 */
export function BeerWineBand({ place, title, inputs, seed, onClose, onBack }: { place: BandPlace; title: string; inputs: SketchInputs; seed: string; onClose: () => void; onBack?: () => void }) {
  return (
    <View style={[styles.band, { paddingTop: place.top, paddingHorizontal: place.side }]}>
      <View style={styles.top}>
        {/* The X where the board draws it, on every step; Kevin, 8 Nov: a back arrow beside it after the first. */}
        <View style={styles.side}>
          <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onClose} />
          {onBack ? <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={onBack} /> : null}
        </View>
        <DsText variant="body" tone="muted" role="heading" style={styles.title}>
          {title}
        </DsText>
        <View style={styles.side} />
      </View>
      {place.folded ? null : (
        <View style={styles.art} aria-label={`Drawing of the ${title.toLowerCase()} so far`}>
          <SketchDrawing inputs={inputs} seed={seed} detail="full" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { alignItems: 'center', paddingBottom: space.sm },
  top: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', ...font.semiBold },
  // Room for the X and the back arrow on both sides, so the title sits in the middle and stays put.
  side: { width: layout.minTapTarget * 2 + space.xs, flexDirection: 'row', gap: space.xs },
  art: { width: ART, height: ART, marginTop: space.sm },
});
