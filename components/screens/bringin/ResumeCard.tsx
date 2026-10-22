import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { useUserId } from '@/ctx/AuthContext';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { fileTitle, tally, waitingFor, whenWords } from '@/lib/importReview';
import { useBringIn } from '@/store/useBringIn';

import { ProgressLine } from './ReviewParts';

/**
 * Where you pick a big import up (board eddie-oct22-wave2, Fix 11, top of the
 * Library): the file, when you were last at it, how far you got, Carry on and
 * Later. Only the person who started it, at the place it comes into, sees it.
 * `here` is Bring in itself, already on screen.
 */
export function ResumeCard({ barId, here }: { barId: string | null; here?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const userId = useUserId();
  const review = useBringIn((s) => waitingFor(s.reviews, userId, barId));
  const later = useBringIn((s) => s.later);
  const [now] = useState(Date.now);
  if (!review || later.includes(review.id)) return null;
  const t = tally(review);
  const title = fileTitle(review.name);
  const carryOn = () => {
    useBringIn.getState().setReviewing(review.id);
    if (!here) router.push('/bring-in' as Href);
  };
  return (
    <View role="region" aria-label={`${title}: ${t.checked} of ${t.total} checked`} style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.top}>
        <Body numberOfLines={1} style={styles.title}>
          {title}
        </Body>
        <Caption tone="muted">{whenWords(review.updatedAt, now)}</Caption>
      </View>
      <ProgressLine t={t} words={`${t.checked} of ${t.total} checked`} />
      <View style={styles.buttons}>
        <Button label="Carry on" size="lg" onPress={carryOn} style={styles.flex} />
        <Button label="Later" size="lg" variant="secondary" accessibilityLabel="Later. Hide this until the app next opens" onPress={() => useBringIn.getState().putOff(review.id)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 560, borderRadius: radius.card - 4, borderWidth: 1, paddingVertical: space.md + 2, paddingHorizontal: space.lg, gap: space.sm + 2 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  title: { flex: 1, fontFamily: fontFamilies.bodySemiBold },
  buttons: { flexDirection: 'row', gap: space.sm + 2 },
  flex: { flex: 1 },
});
