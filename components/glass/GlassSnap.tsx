import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useSnapGlass, type GlassModel } from '@/hooks/useGlassModels';
import { takeGlassPhoto } from '@/lib/identifyGlassware';
import { GLASS_TYPE_LABEL } from '@/lib/glassware';

import { GlassModelRow } from './GlassModelPicker';

/**
 * "Snap the glass" in Which glass is it? (Open decisions d10, 25 Oct 2026):
 * a photo of the glass, read by AI (one unit of the person's daily limit),
 * and the three makers' glasses closest to it. Searching stays below.
 */
export function GlassSnap({ onPick }: { onPick: (model: GlassModel) => void }) {
  const ds = useDs();
  const snap = useSnapGlass();
  const read = snap.data;
  // The camera's own refusal (no permission); the read's errors are the mutation's.
  const [cameraError, setCameraError] = useState<string | null>(null);
  const error = cameraError ?? snap.error?.message ?? null;

  const take = async () => {
    setCameraError(null);
    try {
      const photo = await takeGlassPhoto();
      if (photo) snap.mutate(photo);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Couldn’t open the camera.');
    }
  };

  const what = read ? [read.glass ? GLASS_TYPE_LABEL[read.glass] : null, read.makerMark ? `marked “${read.makerMark}”` : null, read.capacityMl ? `about ${Math.round(read.capacityMl)} ml` : null].filter(Boolean).join(', ') : '';

  return (
    <View style={styles.stack}>
      <Button
        label={snap.isPending ? 'Reading the glass…' : read ? 'Snap it again' : 'Snap the glass'}
        icon="camera.fill"
        variant="secondary"
        disabled={snap.isPending}
        onPress={take}
        style={styles.start}
      />
      {error ? <Body tone="muted">{error}</Body> : null}
      {read ? (
        read.models.length ? (
          <View style={styles.stack}>
            <Caption tone="muted">{`Looks like${what ? `: ${what}` : ''}`}</Caption>
            <View role="list" aria-label="Glasses it could be" style={[styles.list, { backgroundColor: ds.c.surface }]}>
              {read.models.map((m, i) => (
                <GlassModelRow key={m.id} model={m} first={i === 0} onPress={() => onPick(m)} />
              ))}
            </View>
          </View>
        ) : (
          <Body tone="muted">{`No maker lists a glass like that${what ? ` (${what})` : ''} yet. Search for it below.`}</Body>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  list: { borderRadius: radius.card, borderCurve: 'continuous', paddingHorizontal: space.md },
  start: { alignSelf: 'flex-start' },
});
