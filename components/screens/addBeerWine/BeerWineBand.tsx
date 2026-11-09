import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, GlassButton, sheetIsDialog } from '@/components/ds';
import { useInSheet } from '@/components/ds/sheetClose';
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
 * A bottle you buy (Add-bottle) wears it too, with its bottle as `art`;
 * Something you make (Add-house) with none, as drawn.
 * In the web's dialog (Add-bottle and Add-beer, Web) the X is top right and
 * there is no title: the back arrow has the left to itself.
 */
export function BeerWineBand({ place, title, inputs, seed, art, artLabel, onClose, onBack }: { place: BandPlace; title: string; onClose: () => void; onBack?: () => void } & ({ inputs: SketchInputs; seed: string; art?: undefined; artLabel?: undefined } | { art: ReactNode; artLabel: string; inputs?: undefined; seed?: undefined } | { inputs?: undefined; seed?: undefined; art?: undefined; artLabel?: undefined })) {
  const dialog = useInSheet() && sheetIsDialog;
  const close = <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onClose} />;
  const back = onBack ? <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={onBack} /> : null;
  return (
    <View style={[styles.band, { paddingTop: place.top, paddingHorizontal: place.side }]}>
      {dialog ? (
        <View style={[styles.top, styles.dialogTop]}>
          {back ?? <View />}
          {close}
        </View>
      ) : (
        <View style={styles.top}>
          {/* The X where the board draws it, on every step; Kevin, 8 Nov: a back arrow beside it after the first. */}
          <View style={styles.side}>
            {close}
            {back}
          </View>
          <DsText variant="body" tone="muted" role="heading" style={styles.title}>
            {title}
          </DsText>
          <View style={styles.side} />
        </View>
      )}
      {place.folded || (!inputs && !art) ? null : (
        <View style={styles.art} aria-label={artLabel ?? `Drawing of the ${title.toLowerCase()} so far`}>
          {inputs ? <SketchDrawing inputs={inputs} seed={seed} detail="full" /> : art}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { alignItems: 'center', paddingBottom: space.sm },
  top: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  dialogTop: { justifyContent: 'space-between' },
  title: { flex: 1, textAlign: 'center', ...font.semiBold },
  // Room for the X and the back arrow on both sides, so the title sits in the middle and stays put.
  side: { width: layout.minTapTarget * 2 + space.xs, flexDirection: 'row', gap: space.xs },
  art: { width: ART, height: ART, marginTop: space.sm },
});
