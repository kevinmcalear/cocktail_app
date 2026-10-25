import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, Sheet, Surface, TextLink, Title, useDs } from '@/components/ds';
import { Eyebrow } from '@/components/screens/addDrink/WizardChrome';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { fontFamilies, space } from '@/constants/tokens';
import type { TechniqueDrink } from '@/hooks/useTechniqueDrinks';
import { itemHref } from '@/lib/itemRoutes';
import { keepsFor } from '@/lib/myBarText';
import { groupById, type Technique } from '@/lib/techniques';
import type { AwayProject, Project } from '@/lib/techniques/projects';

import { CheckList } from './CheckList';

/** Drinks named on a card before "and N more". */
const NAMED = 3;

interface ProjectsProps {
  ready: Project[];
  away: AwayProject[];
  /** The drinks each technique goes into, by technique id, once loaded. */
  drinks?: Record<string, TechniqueDrink[]>;
  /** Tick a piece of kit you turn out to have. */
  onKit: (id: string) => void;
  /** Open Add to your bar on the lab shelf. */
  onLab: () => void;
}

const article = (name: string) => (/^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`);
const drinksWord = (n: number) => `${n} ${n === 1 ? 'drink' : 'drinks'}`;

/** "10 min · use within 2 days": the technique's time, and how long what it makes keeps. */
function timeLine(t: Technique): string {
  return [t.time, t.keepsHours ? `keeps ${keepsFor(t.keepsHours)}` : null].filter(Boolean).join(' · ');
}

/**
 * What to make, as projects: techniques your kit and lab shelf allow, each
 * with what of yours it uses, the drinks it goes into, its method and those
 * drinks; then each technique one piece away, with what it needs. One row of
 * My Bar's list: there are a few dozen techniques at most.
 */
export function Projects({ ready, away, drinks, onKit, onLab }: ProjectsProps) {
  const ds = useDs();
  const router = useRouter();
  const [showing, setShowing] = useState<Technique | null>(null);
  // One row per technique, the ones that go into the most drinks first.
  const nearly = away
    .flatMap(({ missing, techniques }) => techniques.map((t) => ({ t, missing })))
    .sort((a, b) => (drinks?.[b.t.id]?.length ?? 0) - (drinks?.[a.t.id]?.length ?? 0));
  const kitOnly = nearly.every((n) => n.missing.kind === 'kit');
  return (
    <View style={styles.list}>
      <Caption tone="muted">Techniques your shelf and kit allow, with the method and the drinks that use them. Plan these a day ahead.</Caption>
      {ready.map(({ technique: t, uses }) => {
        const list = drinks?.[t.id] ?? [];
        const named = list.slice(0, NAMED).map((d) => d.name);
        const more = list.length - named.length;
        return (
          <Surface key={t.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Eyebrow>{groupById(t.group)?.name ?? ''}</Eyebrow>
              <Title>{t.name}</Title>
              <Caption tone="muted">{timeLine(t)}</Caption>
            </View>
            <CheckList names={uses} chips />
            {list.length ? (
              <Body>
                <Body style={styles.strong}>{`${drinksWord(list.length)}: `}</Body>
                <Body tone="muted">{more > 0 ? `${named.join(', ')} and ${more} more` : named.join(', ')}</Body>
              </Body>
            ) : null}
            <View style={styles.actions}>
              <Button label="Method" variant="ink" onPress={() => router.push(`/techniques/${t.id}` as never)} style={styles.flex} />
              {list.length ? <Button label="The drinks" variant="secondary" accessibilityLabel={`The drinks with ${t.name}`} onPress={() => setShowing(t)} style={styles.flex} /> : null}
            </View>
          </Surface>
        );
      })}
      {nearly.length ? (
        <View style={styles.away}>
          <Eyebrow>{kitOnly ? 'One piece of kit away' : 'One thing away'}</Eyebrow>
          {nearly.map(({ t, missing }) => {
            const n = drinks?.[t.id]?.length ?? 0;
            return (
              <View key={`${t.id}:${missing.id}`} style={[styles.row, { borderBottomColor: ds.c.line }]}>
                <View style={styles.flex}>
                  <Headline>{t.name}</Headline>
                  <Caption tone="muted">{[n ? drinksWord(n) : null, `needs ${article(missing.name)}`].filter(Boolean).join(' · ')}</Caption>
                </View>
                {missing.kind === 'kit' ? (
                  <Button label="Add to kit" variant="secondary" accessibilityLabel={`Add ${missing.name} to your kit`} onPress={() => onKit(missing.id)} />
                ) : (
                  <Button label="Add to lab" variant="secondary" accessibilityLabel={`Add ${missing.name} to your lab shelf`} onPress={onLab} />
                )}
              </View>
            );
          })}
        </View>
      ) : null}
      <TextLink label="All techniques" onPress={() => router.push('/techniques' as never)} />
      <Sheet visible={!!showing} onClose={() => setShowing(null)} accessibilityLabel={showing ? `The drinks with ${showing.name}` : 'The drinks'}>
        <ScrollView contentContainerStyle={styles.sheet}>
          <Title>{showing?.name ?? ''}</Title>
          <Caption tone="muted">Drinks with something made in-house this way.</Caption>
          {(showing ? (drinks?.[showing.id] ?? []) : []).map((d) => (
            <DrinkRow key={d.id} name={d.name} itemId={d.id} imageUrl={d.imageUrl} glass={null} href={itemHref('Cocktail', d.id)} />
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, paddingTop: space.md },
  card: { gap: space.md },
  cardHead: { gap: 2 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  actions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  away: { gap: space.xs, paddingTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  sheet: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.sm },
});
