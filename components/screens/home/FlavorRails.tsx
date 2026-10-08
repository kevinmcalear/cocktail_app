import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Caption, DrinkImage, Headline, PalateFlower, PressableScale, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useFlavorBaseline, useForYouDrinks, useMyTaste } from '@/hooks/useFlavor';
import { COLD_START_DRINKS, forYou, type Profile } from '@/lib/flavor';
import { itemHref } from '@/lib/itemRoutes';

import { TasteQuestions } from './TasteQuestions';

const CARD_WIDTH = 168;

interface RailCardProps {
  id: string;
  name: string;
  imageUrl: string | null;
  badge: string;
  reason: string;
  /** Where it opens: the drink page unless it says otherwise. */
  href?: string;
  /** Its flavor, drawn small beside the badge. */
  profile?: Profile;
}

/** One drink in a rail: picture, name, and a line on why it's here. */
export function RailCard({ id, name, imageUrl, badge, reason, href, profile }: RailCardProps) {
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${name}. ${badge}. ${reason}`}
      onPress={() => router.push((href ?? itemHref('Cocktail', id)) as never)}
      style={styles.card}
    >
      <DrinkImage thumb source={imageUrl} itemId={id} accessibilityLabel={name} hideTag />
      <Headline numberOfLines={1}>{name}</Headline>
      <View style={styles.badge}>
        {profile ? <PalateFlower values={profile} size={28} rings={false} /> : null}
        <Caption>{badge}</Caption>
      </View>
      <Caption tone="muted" numberOfLines={4}>
        {reason}
      </Caption>
    </PressableScale>
  );
}

export function Rail({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Title role="heading">{title}</Title>
      <Caption tone="muted">{note}</Caption>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View role="list" style={styles.rail}>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * "For you": drinks that fit your taste, best first, leaving out ones you've
 * ranked. With no taste yet, it asks a few quick questions first; with fewer
 * than COLD_START_DRINKS ranked, picks show without a match percentage.
 */
export function ForYou() {
  const router = useRouter();
  const { data: me, isLoading } = useMyTaste();
  // The nearest drinks come from the server, which leaves out what you've ranked.
  const nearest = useForYouDrinks(me?.taste);
  const baseline = useFlavorBaseline();
  if (isLoading || !me || !nearest.data) return null;

  const cold = me.rankedDrinks < COLD_START_DRINKS;
  if (cold && !me.answers) {
    return (
      <View style={styles.section}>
        <Title role="heading">For you</Title>
        <TasteQuestions rankedDrinks={me.rankedDrinks} />
      </View>
    );
  }

  const picks = forYou(nearest.data, me.taste, me.basis, [], 10, baseline.data ?? null);
  if (!picks.length) return null;
  const toGo = COLD_START_DRINKS - me.rankedDrinks;
  const note = cold
    ? `From your answers. Rank ${toGo} more drink${toGo === 1 ? '' : 's'} you've had to see match scores.`
    : `Matched to your taste, from the ${me.rankedDrinks} drinks you've ranked${me.answers ? ' and your answers' : ''}.`;
  return (
    <View style={styles.section}>
      <Rail title="For you" note={note}>
        {picks.map((p) => (
          <View role="listitem" key={p.id}>
            <RailCard id={p.id} name={p.name} imageUrl={p.imageUrl} badge={p.match === null ? 'Your style' : `${p.match}% match`} reason={p.reason} profile={p.profile} />
          </View>
        ))}
      </Rail>
      <Button label="Your taste" variant="ghost" onPress={() => router.push('/taste')} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  rail: { flexDirection: 'row', gap: space.md, paddingVertical: space.xs },
  card: { width: CARD_WIDTH, gap: space.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
