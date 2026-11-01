import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BlockLabel, ScoreRow } from '@/components/screens/rankings/ScoreRows';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useBarScore } from '@/hooks/useScores';
import { drinkPageHref } from '@/lib/itemRoutes';
import { formatScore } from '@/lib/ranking';
import { barScoreLine, bestPlaceLine, num } from '@/lib/scores';

import { ScoreLine } from './ScoreParts';

/**
 * A bar's score on its page (Kept-score "barscore", A): "8.9 for its drinks"
 * from its drinks once 50 ranks are in, then its best drinks with where each
 * sits in the city. The bar's Admins open what guests say from the score.
 * Nothing until there's a score or a scored drink.
 */
export function BarScore({ profileId, barId, name }: { profileId: string; barId: string | null; name: string }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const { data: s } = useBarScore(profileId);
  const { data: caps = [] } = useCapabilities(barId);
  if (!s) return null;
  const score = num(s.score);
  const admin = !!barId && caps.includes('staff');
  if (score == null && !s.best.length) return null;
  return (
    <View style={styles.block}>
      {score != null ? <ScoreLine title={`${formatScore(score)} for its drinks`} sub={barScoreLine(s)} onPress={admin ? () => router.push({ pathname: '/guests/room/[barId]', params: { barId, name } }) : undefined} /> : null}
      {s.best.length ? (
        <View>
          <BlockLabel>Its best</BlockLabel>
          {s.best.map((d, i) => (
            <ScoreRow
              key={d.item_id}
              position={i + 1}
              itemId={d.item_id}
              pictureUrl={d.image_url}
              pictureIsSketch={!!d.image_is_generated}
              title={d.name}
              sub={bestPlaceLine(d)}
              score={Number(d.score)}
              onPress={() => router.push(drinkPageHref(d.item_id, signedIn) as Href)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
});
