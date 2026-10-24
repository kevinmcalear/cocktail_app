import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Display, Headline, PressableScale, Surface, Tag, useBreakpoint, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useCollection, type CollectedDrink } from '@/hooks/useCollection';
import { usePublicDrinkMore } from '@/hooks/usePublicDrink';
import { usePublishedDrink, type BarCredit } from '@/hooks/usePublished';
import { hadOnLine } from '@/lib/collection';
import type { ItemPicture } from '@/lib/itemImages';
import { createdByLine, drinkKicker } from '@/lib/publicDrink';

import { RankFlow } from '../rank/RankActions';
import { useAgeGate } from '../safety/AgeGate';
import { ReportAction } from '../safety/ReportSheet';
import { CollectButton } from './CollectButton';
import { MemorySheet } from './MemorySheet';
import { Kicker, PublicPage, SignInBand } from './PublicChrome';
import { PublicFamilyTree } from './PublicFamilyTree';
import { loadFailure, PublicMissing, PublicPicture } from './PublicShell';
import { PublicSpec } from './PublicSpec';
import { PublicWhereToDrink } from './PublicWhereToDrink';

/** The bar a public page is credited to, opening its profile. */
export function BarLink({ bar }: { bar: BarCredit | null }) {
  const router = useRouter();
  if (!bar) return null;
  return (
    <PressableScale role="link" accessibilityLabel={`${bar.name}, open the bar`} onPress={() => router.push(`/p/${bar.handle}`)} style={styles.bar}>
      <Tag label={bar.name} tone="accent" />
    </PressableScale>
  );
}

/** What you wrote about a drink you collected, with a way to change it. */
export function MemoryCard({ memory, onEdit }: { memory: CollectedDrink; onEdit: () => void }) {
  const [now] = useState(() => Date.now());
  const had = hadOnLine(memory.hadOn, now);
  return (
    <Surface style={styles.memory}>
      <Headline role="heading">Your memory</Headline>
      {had ? <Body>{had}</Body> : null}
      {memory.note ? <Body tone="muted">{memory.note}</Body> : null}
      {!had && !memory.note ? <Body tone="muted">When did you have it? Add the day and a note, just for you.</Body> : null}
      <Button label={had || memory.note ? 'Edit' : 'Add the day and a note'} icon="pencil" variant="ghost" onPress={onEdit} style={styles.edit} />
    </Surface>
  );
}

/** "To make" and "Had it? Rank it". Signed out, each asks you to sign in. */
function PublicActions({ id, name, barId, picture, releaseId }: { id: string; name: string; barId: string | null; picture: ItemPicture | null; releaseId?: string | null }) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const ageGate = useAgeGate();
  const [ranking, setRanking] = useState(false);
  return (
    <View style={styles.actions}>
      <CollectButton target={{ kind: 'drink', itemId: id, releaseId }} name={name} quiet labels={['To make', 'To make']} style={styles.action} />
      <Button
        label="Had it? Rank it"
        icon="star"
        variant="secondary"
        style={styles.action}
        accessibilityHint={`Ranks ${name} against others you've had`}
        onPress={() => (signedIn ? ageGate.gate(() => setRanking(true)) : router.push('/auth/login'))}
      />
      {ranking ? <RankFlow item={{ id, name, bar_id: barId }} picture={picture} onClose={() => setRanking(false)} /> : null}
      {ageGate.sheet}
    </View>
  );
}

/**
 * A published drink as anyone sees it (ppl-pub-drink-desktop, -phone,
 * -phone-teaser): the picture with To make and Had it? Rank it; the kicker,
 * name, credit, description and family tree; Where to drink it and the spec.
 * Signed out the spec shows its ingredient names, the rest behind Sign in.
 */
export function PublishedDrinkScreen({ id, releaseId }: { /** The drink's id, or its slug (/d/penicillin). */ id: string; releaseId?: string | null }) {
  const bp = useBreakpoint();
  const wide = bp !== 'phone';
  const signedIn = useSignedIn();
  const query = usePublishedDrink(id);
  const { data, isPending } = query;
  const { data: more } = usePublicDrinkMore(data?.drink);
  const { data: collection } = useCollection();
  const [editing, setEditing] = useState(false);
  if (!data) return <PublicMissing loading={isPending} what="drink" failed={loadFailure(query)} />;

  const { drink, bar } = data;
  const mine = collection?.drinks.find((d) => d.itemId === drink.id);
  const picture = drink.imageUrl
    ? {
        url: drink.imageUrl,
        isSketch: drink.imageIsGenerated,
        isOutdated: false,
        credit: null,
        sourceUrl: null,
      }
    : null;
  const venue = more?.venue ?? null;
  const barName = bar?.name ?? venue?.display_name ?? null;
  const credit = createdByLine(more?.creator ?? null, barName ? { name: barName, place: venue?.locality ?? venue?.city } : null, drink.creditStatus);
  const shared = drink.publishMode === 'spec' && data.recipes.length > 0;
  const classic = !drink.barId && /^(modern )?classic$/i.test(drink.origin?.trim() ?? '');
  // Signed out with a spec behind Sign in, the spec card holds the page's one gold button.
  const specTeaser = !signedIn && (shared || classic);

  const pictureColumn = (
    <View style={[styles.pictureColumn, wide && styles.pictureWide]}>
      <PublicPicture name={drink.name} imageUrl={drink.imageUrl} generated={drink.imageIsGenerated} itemId={drink.id} glass={data.glass?.iconKey ?? data.glass?.name} />
      {wide ? <PublicActions id={drink.id} name={drink.name} barId={drink.barId} picture={picture} releaseId={releaseId} /> : null}
    </View>
  );
  const main = (
    <View style={[styles.main, wide && styles.mainWide]}>
      <Kicker>
        {drinkKicker(
          {
            origin: drink.origin,
            originYear: drink.originYear,
            riffOfId: drink.riffOfId,
          },
          barName,
        )}
      </Kicker>
      <Display>{drink.name}</Display>
      {credit ? <CreditCard line={credit} who={more?.creator ?? venue} /> : null}
      {drink.description ? (
        <Body tone="muted" style={styles.description}>
          {drink.description}
        </Body>
      ) : null}
      {wide ? null : <PublicActions id={drink.id} name={drink.name} barId={drink.barId} picture={picture} releaseId={releaseId} />}
      {mine ? <MemoryCard memory={mine} onEdit={() => setEditing(true)} /> : null}
      {more ? <PublicFamilyTree drink={drink} more={more} /> : null}
    </View>
  );
  const aside = (
    <View style={[styles.aside, wide && styles.asideWide]}>
      {more ? <PublicWhereToDrink rankedAs={more.rankedAs} venue={venue} /> : null}
      <PublicSpec page={data} barClaimed={!!venue?.is_claimed} classic={classic} />
    </View>
  );

  return (
    <PublicPage title={drink.name} quietCta={specTeaser}>
      <View style={wide ? styles.columns : styles.stack}>
        {pictureColumn}
        {main}
        {aside}
      </View>
      {!signedIn && !shared && !classic ? <SignInBand text="Sign in to save it, rank it, and see your score beside the city’s." /> : null}
      <View style={styles.report}>
        <ReportAction subject={drink.name} targets={[{ label: drink.name, target: { kind: 'item', itemId: drink.id } }]} />
      </View>
      {editing && mine ? <MemorySheet memory={mine} onClose={() => setEditing(false)} /> : null}
    </PublicPage>
  );
}

/** "Created by Sam Ross at Milk & Honey, New York · Verified", with the maker's picture, opening their page. */
function CreditCard({
  line,
  who,
}: {
  line: string;
  who: {
    handle: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}) {
  const ds = useDs();
  const router = useRouter();
  const inner = (
    <>
      <View aria-hidden>
        <UserAvatar uri={who?.avatar_url} name={who?.display_name} size={40} />
      </View>
      <Body style={styles.flex}>{line}</Body>
    </>
  );
  const frame = [styles.credit, { backgroundColor: ds.c.surface }];
  if (!who) return <View style={frame}>{inner}</View>;
  return (
    <PressableScale role="link" accessibilityLabel={`${line}. Open ${who.display_name}`} onPress={() => router.push(`/p/${who.handle}`)} style={frame}>
      {inner}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bar: { alignSelf: 'flex-start' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  // Both fit side by side under the 320 picture (ppl-pub-drink-desktop).
  action: { paddingHorizontal: space.lg },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: space.xxl + space.xs,
  },
  stack: { gap: space.xl },
  pictureColumn: { gap: space.lg },
  pictureWide: { flexGrow: 1, flexShrink: 1, flexBasis: 280, maxWidth: 320 },
  main: { gap: space.lg },
  mainWide: { flexGrow: 2, flexShrink: 1, flexBasis: 440, minWidth: 0 },
  aside: { gap: space.xl },
  asideWide: { flexGrow: 1, flexShrink: 1, flexBasis: 280, maxWidth: 340 },
  description: { maxWidth: 560 },
  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
    borderRadius: radius.card,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  memory: { gap: space.xs, padding: space.lg },
  edit: { alignSelf: 'flex-start', marginTop: space.xs },
  report: { alignItems: 'flex-start' },
});
