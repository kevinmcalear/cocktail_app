import { Pressable, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, useDs } from '@/components/ds';
import { Appear } from '@/components/ds/Appear';
import { radius, space } from '@/constants/tokens';

/**
 * "Leave it for now?" (make-anything-steps-3, step 9), drawn inside the
 * recipe's own screen: the builder is a native Modal, which an alert or a
 * sheet would open behind on the web or stack on on iOS. What's done is
 * kept; a recipe just started can also go.
 */
export function LeaveCard({ where, step, drink, onLeave, onStay, onDrop }: { where: string; step: string; drink: string; onLeave: () => void; onStay: () => void; onDrop?: () => void }) {
  const ds = useDs();
  return (
    <Appear kind="fade" duration={200} style={[styles.overlay, { backgroundColor: ds.c.scrim }]}>
      <Pressable accessibilityLabel="Keep going" style={StyleSheet.absoluteFill} onPress={onStay} />
      <View role="alertdialog" aria-modal aria-label="Leave it for now?" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.lineStrong }]}>
        <Caption tone="muted">{`${where} · ${step}`.toUpperCase()}</Caption>
        <Headline role="heading">Leave it for now?</Headline>
        <Body tone="muted">{`What you’ve done is kept. ${drink} shows it as Recipe to finish, and New lists ${drink} under Drafts, with the way back.`}</Body>
        <View style={styles.buttons}>
          <Button label="Leave it for now" variant="ink" onPress={onLeave} />
          <Button label="Keep going" variant="secondary" onPress={onStay} />
          {onDrop ? <Button label="Don’t keep it" variant="danger" onPress={onDrop} /> : null}
        </View>
      </View>
    </Appear>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, justifyContent: 'flex-end', alignItems: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 440, gap: space.md, padding: space.xl, borderRadius: radius.card, borderWidth: 1 },
  buttons: { gap: space.sm },
});
