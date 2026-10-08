import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Caption, DrinkImage } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { SwitchRow } from '@/components/screens/settings/SettingsParts';
import { useAddDrinkPhoto } from '@/hooks/useDrinkPhotos';
import { useMyHadDrinks } from '@/hooks/useRankings';
import { formatScore } from '@/lib/ranking';

/**
 * Posting a photo you picked: a look at it, and, when you've ranked this
 * drink, whether your score shows with it (on by default; it's yours to
 * share). Everyone who can see the drink sees the photo, credited to you.
 */
export function AddDrinkPhotoSheet({ itemId, name, uri, onClose }: { itemId: string; name: string; uri: string; onClose: () => void }) {
  const { data: had } = useMyHadDrinks();
  // Ranked more than once (at two bars, say): the best of them.
  const ranked = (had ?? []).filter((d) => d.itemId === itemId).sort((a, b) => b.score - a.score)[0] ?? null;
  const [showScore, setShowScore] = useState(true);
  const add = useAddDrinkPhoto(itemId);
  const post = () => add.mutate({ uri, rankEntryId: ranked && showScore ? ranked.id : null }, { onSuccess: onClose });

  return (
    <MenuSheet
      visible
      onClose={onClose}
      title="Add your photo"
      subtitle={name}
      footer={<Button label={add.isPending ? 'Posting…' : 'Post photo'} icon="photo" disabled={add.isPending} onPress={post} />}
    >
      <DrinkImage source={uri} accessibilityLabel={`Your photo of ${name}`} aspectRatio={4 / 5} radius="control" hideTag style={styles.preview} />
      {ranked ? (
        <SwitchRow label="Show my score with it" detail={`You ranked it ${formatScore(ranked.score)}`} value={showScore} onValueChange={setShowScore} />
      ) : (
        <Caption tone="muted">Rank it too, and your score can show with your photo.</Caption>
      )}
      <Caption tone="muted">Anyone who can see this drink sees your photo, with your name on it. You can delete it any time.</Caption>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', maxWidth: 360, alignSelf: 'center' },
});
