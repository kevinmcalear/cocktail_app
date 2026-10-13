import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, PressableScale, RowScore, useDs } from '@/components/ds';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import type { SharedMade } from '@/hooks/useMade';
import { hasDates, sortHad, whereLine, type BarTally, type HadDrink, type HadSort } from '@/lib/hadDrinks';
import { itemHref } from '@/lib/itemRoutes';
import { withMade } from '@/lib/madeIt';
import { plural } from '@/lib/menus';
import { dayOf, formatScore } from '@/lib/ranking';

import { RankRow } from '../rankings/RankingLists';

const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
const href = (d: { itemId: string }) => itemHref('Cocktail', d.itemId);

/** On your own profile: takes one made drink off it. */
function HideMade({ name, onPress }: { name: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`Hide ${name} from your profile`} onPress={onPress} style={styles.eye}>
      <IconSymbol name="eye" size={20} color={ds.c.ink} />
    </PressableScale>
  );
}

/** The drinks someone made at home and shows, not ranked at home: "Made at home", the photo and the note. */
function MadeRows({ made, onHide }: { made: SharedMade[]; onHide?: (id: string) => void }) {
  return made.map((m) => {
    const name = m.name;
    const caption = ['Made at home', m.madeOn ? MONTH_YEAR.format(dayOf(m.madeOn)) : null].filter(Boolean).join(' · ');
    return (
      <View role="listitem" key={m.id}>
        <DrinkRow
          name={name}
          href={href(m)}
          itemId={m.itemId}
          imageUrl={m.imageUrl}
          glass={null}
          caption={caption}
          note={m.note ?? undefined}
          label={[name, caption, m.note].filter(Boolean).join('. ')}
          trailing={onHide ? <HideMade name={name} onPress={() => onHide(m.id)} /> : undefined}
        />
      </View>
    );
  });
}

const SORTS: { value: HadSort; label: string }[] = [
  { value: 'score', label: 'Top scored' },
  { value: 'recent', label: 'Latest' },
];

/**
 * Every drink they've had, each with its score: best first, or latest first.
 * Then the drinks they made at home and show (`made`): one they also ranked
 * at home shows their photo and note on that row. `onHideMade` (your own
 * profile) puts an eye on those to take one off.
 */
export function HadList({ drinks, made = [], onHideMade }: { drinks: HadDrink[]; made?: SharedMade[]; onHideMade?: (id: string) => void }) {
  const [sort, setSort] = useState<HadSort>('score');
  const shown = withMade(sortHad(drinks, sort), made);
  return (
    <View style={styles.section}>
      {/* Nothing to order by when they don't show when they had them. */}
      {hasDates(drinks) ? (
        <View role="radiogroup" accessibilityLabel="Order" style={styles.chips}>
          {SORTS.map((s) => (
            <Chip key={s.value} label={s.label} selected={sort === s.value} onPress={() => setSort(s.value)} />
          ))}
        </View>
      ) : null}
      <View role="list">
        {shown.drinks.map((d) => {
          const where = d.made ? 'Made at home' : whereLine(d);
          const caption = [d.listName, where, d.hadOn ? MONTH_YEAR.format(dayOf(d.hadOn)) : null].filter(Boolean).join(' · ');
          const made = d.made;
          return (
            <View role="listitem" key={d.id}>
              <DrinkRow
                name={d.name}
                href={href(d)}
                itemId={d.itemId}
                imageUrl={d.imageUrl}
                glass={null}
                caption={caption}
                note={made?.note ?? undefined}
                label={[`${d.name}. ${caption}. Score ${formatScore(d.score)}`, made?.note].filter(Boolean).join('. ')}
                trailing={
                  made && onHideMade ? (
                    <View style={styles.trail}>
                      <RowScore score={d.score} />
                      <HideMade name={d.name} onPress={() => onHideMade(made.id)} />
                    </View>
                  ) : (
                    <RowScore score={d.score} />
                  )
                }
              />
            </View>
          );
        })}
        <MadeRows made={shown.extra} onHide={onHideMade} />
      </View>
    </View>
  );
}

/** Each bar they've had drinks at, with the average of their scores there. Best first. */
export function BarTallies({ bars, whose }: { bars: BarTally[]; whose: string }) {
  const router = useRouter();
  return (
    <View style={styles.section}>
      <Caption tone="muted">{`${whose} average across the drinks had at each bar.`}</Caption>
      <View>
        {bars.map((b, i) => {
          const venue = b.venue;
          return (
            <RankRow
              key={b.key}
              position={i + 1}
              title={venue?.name ?? 'At home'}
              detail={b.best ? `${plural(b.drinks, 'drink')} · best: ${b.best.name}` : plural(b.drinks, 'drink')}
              score={b.average}
              scoreDetail={b.drinks > 1 ? 'average' : undefined}
              logo={venue?.avatarUrl ?? null}
              onPress={venue ? () => router.push(`/p/${venue.handle || venue.id}` as Href) : undefined}
            />
          );
        })}
      </View>
    </View>
  );
}

interface SharedDrinksProps {
  /** Whose profile: "Jo". */
  name: string;
  tab: 'had' | 'bars';
  /** They've chosen to show this tab. When they haven't, only they get it. */
  shared: boolean;
  signedIn: boolean;
  drinks: HadDrink[] | undefined;
  bars: BarTally[] | undefined;
  failed: boolean;
  /** The drinks they made at home and show, in Had. Signed out too. */
  made?: SharedMade[];
  /** Your own profile: take a made drink off it. */
  onHideMade?: (id: string) => void;
}

const KEPT: Record<SharedDrinksProps['tab'], string> = {
  had: 'Only you can see the drinks you’ve had. You can show them here, with your scores, from your profile settings.',
  bars: 'Only you can see the bars you’ve had drinks at. You can show them here, with your average at each, from your profile settings.',
};

/** The Had and Bars tabs on a person's public profile: what they show, or (to them) a line saying why not. */
export function SharedDrinks({ name, tab, shared, signedIn, drinks, bars, failed, made = [], onHideMade }: SharedDrinksProps) {
  const router = useRouter();
  if (!shared) {
    return (
      <View style={styles.section}>
        <Body tone="muted">{KEPT[tab]}</Body>
        <View style={styles.chips}>
          <Button label="See them on You" variant="secondary" onPress={() => router.push('/you')} />
          <Button label="Profile settings" variant="ghost" onPress={() => router.push('/settings/profile')} />
        </View>
      </View>
    );
  }
  const signIn = <Body tone="muted">{`Sign in to see ${tab === 'had' ? 'the drinks' : 'the bars'} ${name} has had.`}</Body>;
  if (!signedIn) {
    // Signed out, the drinks they made at home and show, then the rest behind sign-in.
    if (tab !== 'had' || !made.length) return signIn;
    return (
      <View style={styles.section}>
        <View role="list">
          <MadeRows made={made} />
        </View>
        {signIn}
      </View>
    );
  }
  if (failed) return <Body tone="muted">Couldn’t load them. Check your connection and try again.</Body>;
  if (tab === 'had') {
    if (!drinks) return <Caption tone="muted">Loading drinks…</Caption>;
    if (!drinks.length && !made.length) return <Body tone="muted">{`${name} hasn’t ranked a drink yet.`}</Body>;
    return <HadList drinks={drinks} made={made} onHideMade={onHideMade} />;
  }
  if (!bars) return <Caption tone="muted">Loading bars…</Caption>;
  if (!bars.length) return <Body tone="muted">{`${name} hasn’t ranked a drink at a bar yet.`}</Body>;
  return <BarTallies bars={bars} whose="Their" />;
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  trail: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  eye: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
