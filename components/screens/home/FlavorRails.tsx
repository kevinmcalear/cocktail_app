import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Caption, DrinkImage, Headline, PressableScale, Title } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useFlavorCatalog, useMyRankedIds, useMyTaste } from '@/hooks/useFlavor';
import { COLD_START_DRINKS, forYou } from '@/lib/flavor';
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
}

/** One drink in a rail: picture, name, and a line on why it's here. */
export function RailCard({ id, name, imageUrl, badge, reason, href }: RailCardProps) {
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`${name}. ${badge}. ${reason}`}
      onPress={() => router.push((href ?? itemHref('Cocktail', id)) as never)}
      style={styles.card}
    >
      <DrinkImage source={imageUrl} itemId={id} accessibilityLabel={name} hideTag />
      <Headline numberOfLines={1}>{name}</Headline>
      <Caption>{badge}</Caption>
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
 * ranked. With fewer than COLD_START_DRINKS ranked, it asks a few quick
 * questions first and shows picks without a match percentage.
 */
export function ForYou() {
  const { data: me, isLoading } = useMyTaste();
  const catalog = useFlavorCatalog();
  const ranked = useMyRankedIds();
  const [asking, setAsking] = useState(false);
  if (isLoading || !me || !catalog.data) return null;

  const cold = me.rankedDrinks < COLD_START_DRINKS;
  if (cold && (asking || !me.answers)) {
    return (
      <View style={styles.section}>
        <Title role="heading">For you</Title>
        <TasteQuestions initial={me.answers} rankedDrinks={me.rankedDrinks} onDone={() => setAsking(false)} />
      </View>
    );
  }

  const picks = forYou(catalog.data, me.taste, me.basis, ranked.data ?? []);
  if (!picks.length) return null;
  const toGo = COLD_START_DRINKS - me.rankedDrinks;
  const note = cold
    ? `From your answers. Rank ${toGo} more drink${toGo === 1 ? '' : 's'} you've had to see match scores.`
    : `Matched to the ${me.rankedDrinks} drinks you've ranked.`;
  return (
    <View style={styles.section}>
      <Rail title="For you" note={note}>
        {picks.map((p) => (
          <View role="listitem" key={p.id}>
            <RailCard id={p.id} name={p.name} imageUrl={p.imageUrl} badge={p.match === null ? 'Your style' : `${p.match}% match`} reason={p.reason} />
          </View>
        ))}
      </Rail>
      {cold ? <Button label="Change my answers" variant="ghost" onPress={() => setAsking(true)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  rail: { flexDirection: 'row', gap: space.md, paddingVertical: space.xs },
  card: { width: CARD_WIDTH, gap: space.xs },
});
