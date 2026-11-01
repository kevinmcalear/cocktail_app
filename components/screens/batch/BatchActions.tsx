import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSaveBatchAsPrep, type BatchPrep } from '@/hooks/useBatchPrep';
import { shareText } from '@/lib/shareLink';

interface BatchActionsProps {
  name: string;
  /** A venue batch: Save as house-made and Make now; at home, Share and Make it, tick as I go. */
  barId: string | null;
  /** May make a house prep at the venue (house_made). */
  canPrep: boolean;
  making: boolean;
  onMake: () => void;
  /** Left out while the sheet shows only the simple batch. */
  onDilution?: () => void;
  /** For the prep cards: each container's name, recipe, yield and how long it keeps (one for a drink in one part). */
  preps: BatchPrep[];
  /** The batch as text, to share. */
  text: string;
  onSaved: () => void;
}

/**
 * The batch sheet's footer (boards drink-sheet-batch-venue and -home): a
 * venue saves the bottle as a prep card or makes it now; at home you share it
 * or make it, ticking each line off. Making turns the lines into a checklist.
 */
export function BatchActions({ name, barId, canPrep, making, onMake, onDilution, preps, text, onSaved }: BatchActionsProps) {
  const router = useRouter();
  const save = useSaveBatchAsPrep(barId);
  const make = making ? 'Done making' : barId ? 'Make now' : 'Make it, tick as I go';
  return (
    <View style={styles.block}>
      {onDilution ? <TextLink label="Dilution calculator ›" onPress={onDilution} /> : null}
      {save.error ? <Caption tone="accent">{save.error.message || "Couldn't save it as house-made. Check your connection and try again."}</Caption> : null}
      <View style={styles.row}>
        {barId ? (
          canPrep ? (
            <Button
              label={save.isPending ? 'Saving…' : 'Save as house-made'}
              variant="secondary"
              disabled={save.isPending}
              onPress={() =>
                save.mutateAsync(preps).then(([id]) => {
                  onSaved();
                  if (id) router.push(`/ingredient/${id}` as Href);
                }, () => {})
              }
              style={styles.flex}
            />
          ) : null
        ) : (
          <Button label="Share" variant="secondary" onPress={() => void shareText(text, `${name} batch`)} style={styles.share} />
        )}
        {/* At home, Make it takes the room Share leaves, so its label never clips in a dialog (board drink-sheet-batch-home). */}
        <Button label={make} variant={making ? 'secondary' : 'primary'} onPress={onMake} style={[styles.flex, styles.tight]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  share: { flexShrink: 0, paddingHorizontal: space.lg },
  tight: { paddingHorizontal: space.md },
});
