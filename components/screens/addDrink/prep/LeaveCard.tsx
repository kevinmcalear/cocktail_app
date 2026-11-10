import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, useDs } from '@/components/ds';
import { Appear } from '@/components/ds/Appear';
import { radius, space } from '@/constants/tokens';

/**
 * "Leave it for now?" (make-anything-steps-3, step 9), drawn inside the
 * recipe's own screen: the builder is a native Modal, which an alert or a
 * sheet would open behind on the web or stack on on iOS. What's done is
 * kept; a recipe just started can also go. On the web it sits in a Modal of
 * its own, over the wizard and the web's dialog alike: its focus trap takes
 * focus to the card's first button, Tab stays in the card and Enter never
 * reaches the step behind it; Escape is Keep going.
 */
export function LeaveCard({ where, step, drink, body, onLeave, onStay, onDrop }: { /** Where it was left, over the title ('Penicillin batch · 2 of 3'); none on a flat page (Add-inside). */ where?: string; step?: string; drink: string; /** Where it's kept, said for something that isn't inside a drink (a beer, a wine). */ body?: string; onLeave: () => void; onStay: () => void; onDrop?: () => void }) {
  const ds = useDs();
  const card = (
    <Appear kind="fade" duration={200} style={[styles.overlay, { backgroundColor: ds.c.scrim }]}>
      {Platform.OS === 'web' ? (
        // A plain view on the web, not a button: the Modal's focus trap lands on the first thing that takes focus, the card's main button.
        <View aria-hidden style={StyleSheet.absoluteFill} onClick={onStay} />
      ) : (
        <Pressable accessibilityLabel="Keep going" style={StyleSheet.absoluteFill} onPress={onStay} />
      )}
      <View role="alertdialog" aria-modal aria-label="Leave it for now?" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
        {where && step ? <Caption tone="muted">{`${where} · ${step}`.toUpperCase()}</Caption> : null}
        <Headline role="heading">Leave it for now?</Headline>
        <Body tone="muted">{body ?? `What you’ve done is kept. ${drink} shows it as Recipe to finish, and New lists ${drink} under Drafts, with the way back.`}</Body>
        <View style={styles.buttons}>
          <Button label="Leave it for now" variant="ink" onPress={onLeave} />
          <Button label="Keep going" variant="secondary" onPress={onStay} />
          {onDrop ? <Button label="Don’t keep it" variant="danger" onPress={onDrop} /> : null}
        </View>
      </View>
    </Appear>
  );
  if (Platform.OS !== 'web') return card;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onStay}>
      {card}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, justifyContent: 'flex-end', alignItems: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 440, gap: space.md, padding: space.xl, borderRadius: radius.card, borderWidth: 1 },
  buttons: { gap: space.sm },
});
