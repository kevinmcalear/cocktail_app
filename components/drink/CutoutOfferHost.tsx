import { useEffect, useId, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Button, Caption, DrinkImage, useSheetClose } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { backbar, space } from '@/constants/tokens';
import { cutoutAvailable } from '@/modules/subject-cutout';
import { registerCutoutHost, useCutoutOffer } from '@/store/useCutoutOffer';

/**
 * "Remove the background?" after a venue picks a drink photo (offerCutout):
 * the cut-out on the drawn-drink paper, as tiles and the drink page show it,
 * and on the dark ground, as the full-screen viewer does. Closing it any way
 * but "Use this" keeps the original. Put one on every screen or sheet that
 * picks drink photos with `cutout` (see useCutoutOffer for why); it renders
 * nothing where cut-outs aren't possible (web, older binaries).
 */
export function CutoutOfferHost() {
  const id = useId();
  useEffect(() => (cutoutAvailable ? registerCutoutHost(id) : undefined), [id]);
  const offer = useCutoutOffer((s) => (s.hosts.at(-1) === id ? s.offer : null));
  // What to keep once the sheet has slid away; the sheet closes first, then onClose reads it.
  const chosen = useRef<string | null>(null);
  if (!offer) return null;
  const done = () => {
    offer.choose(chosen.current ?? offer.original);
    chosen.current = null;
  };
  return (
    <BackbarTheme>
      <MenuSheet
        visible
        onClose={done}
        title="Remove the background?"
        footer={
          <Choices
            onUse={() => {
              chosen.current = offer.cutout;
            }}
          />
        }
      >
        <View style={styles.pair}>
          <View style={styles.tile}>
            <DrinkImage source={offer.cutout} accessibilityLabel="The drink on paper, without its background" aspectRatio={4 / 5} radius="control" />
            <Caption tone="muted">On paper</Caption>
          </View>
          <View style={styles.tile}>
            <DrinkImage source={offer.cutout} accessibilityLabel="The drink on a dark ground, without its background" aspectRatio={4 / 5} radius="control" style={styles.dark} />
            <Caption tone="muted">On dark</Caption>
          </View>
        </View>
        <Caption tone="muted">Done on this phone. The original stays in your photos either way.</Caption>
      </MenuSheet>
    </BackbarTheme>
  );
}

/** Use this, or keep the original: both slide the sheet away first. */
function Choices({ onUse }: { onUse: () => void }) {
  const close = useSheetClose();
  return (
    <View style={styles.actions}>
      <Button label="Keep original" variant="secondary" onPress={close} style={styles.action} />
      <Button
        label="Use this"
        onPress={() => {
          onUse();
          close();
        }}
        style={styles.action}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: space.xs },
  dark: { backgroundColor: backbar.dark.ground },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
