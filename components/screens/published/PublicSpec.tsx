import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, SpecRow, Surface, useBreakpoint, useDs } from '@/components/ds';
import { DrinkFacts, type Fact } from '@/components/screens/drink/DrinkFacts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import type { PublishedDrinkPage } from '@/hooks/usePublished';
import { specLines } from '@/lib/spec';

import { Kicker } from './PublicChrome';
import { PublicSpecChanges } from './PublicSpecChanges';

/**
 * "The spec" on the public drink page (b30 teaser). Signed in: the facts and
 * the spec as the bar shares it. Signed out: the ingredient names only, the
 * amounts as blanks, and one "Sign in to see the full spec". A drink whose
 * bar keeps its spec (Locked or Names only) says so either way.
 */
export function PublicSpec({
  page,
  barClaimed,
  classic,
}: {
  page: PublishedDrinkPage;
  barClaimed: boolean;
  /** A catalog classic: its spec is everyone's, so signing in opens it. */ classic: boolean;
}) {
  const router = useRouter();
  const signedIn = useSignedIn();
  const { drink, bar } = page;
  const lines = specLines(page.recipes);
  const shared = drink.publishMode === 'spec' && lines.length > 0;
  const who = bar?.name ?? 'The bar';

  if (!shared && classic) {
    // ponytail: classics are listed without their spec rows, so signed out there are no names to show yet (needs a listing change, see the PR).
    if (!signedIn) return <Teaser names={[]} />;
    return (
      <View style={styles.section}>
        <Kicker>The spec</Kicker>
        <Body tone="muted">A classic: the spec is open to everyone.</Body>
        <Button label="Open the full spec" variant="secondary" onPress={() => router.push(`/cocktail/${drink.id}`)} style={styles.start} />
      </View>
    );
  }

  if (!shared) {
    const note = !bar
      ? 'Its spec isn’t shared.'
      : barClaimed
        ? `You can rank and save this drink. ${who} shares this drink’s menu description, not its spec.`
        : `You can rank and save this drink. Its spec shows once ${who} claims its page and chooses to share it.`;
    // The names without amounts, where the listing gives them (ppl-pub-drink-phone).
    const names = [...new Set(lines.flatMap((l) => (l.ingredient ? [l.ingredient] : [])))];
    return (
      <Surface style={styles.locked}>
        <LockedHeading />
        <Body tone="muted">{note}</Body>
        {names.length ? <Body>{names.map((n, i) => (i ? n.toLowerCase() : n)).join(', ')}</Body> : null}
        {signedIn ? <Facts page={page} columns={2} /> : null}
      </Surface>
    );
  }

  if (!signedIn) return <Teaser names={lines.map((l) => l.ingredient ?? 'House ingredient')} />;

  const measured = lines.some((l) => l.amount);
  return (
    <View style={styles.section}>
      <Kicker>The spec</Kicker>
      <Facts page={page} columns={2} />
      <Caption tone="muted">{`As ${who} shares it: the ingredients, not the brands.`}</Caption>
      <View>
        {lines.map((l) => (
          <SpecRow
            key={l.key}
            amount={l.amount ?? ''}
            alignAmount={measured}
            ingredient={l.ingredient ?? 'House ingredient'}
            ingredientId={l.ingredient ? l.ingredientId : undefined}
            optional={l.optional}
          />
        ))}
      </View>
      <PublicSpecChanges itemId={drink.id} who={who} />
    </View>
  );
}

function Facts({ page, columns }: { page: PublishedDrinkPage; columns: number }) {
  const facts: Fact[] = [
    page.glass && { label: 'Glass', value: page.glass.name },
    page.ice && { label: 'Ice', value: page.ice },
    page.family && { label: 'Family', value: page.family },
    page.drink.abv ? { label: 'ABV', value: `${page.drink.abv}%` } : null,
  ].filter((f): f is Fact => !!f);
  return <DrinkFacts facts={facts} columns={columns} />;
}

function LockedHeading() {
  const ds = useDs();
  return (
    <View style={styles.lockedHeading}>
      <IconSymbol name="lock.fill" size={18} color={ds.c.muted} />
      <Headline role="heading">The spec</Headline>
    </View>
  );
}

/**
 * Signed out: names, blanks where the amounts go, and the way in. "The spec"
 * is a heading on a phone and the small capitals kicker beside the page on
 * wide screens (ppl-pub-drink-phone-teaser, -desktop).
 */
function Teaser({ names }: { names: string[] }) {
  const ds = useDs();
  const router = useRouter();
  const wide = useBreakpoint() !== 'phone';
  return (
    <View style={styles.section}>
      {wide ? <Kicker>The spec</Kicker> : <Headline role="heading">The spec</Headline>}
      {names.length ? (
        <View role="list" aria-label="Ingredients. Amounts show when you sign in.">
          {names.map((name, i) => (
            <View key={`${name}-${i}`} role="listitem" style={[styles.line, { borderBottomColor: ds.c.line }]}>
              <Body style={styles.flex}>{name}</Body>
              <View aria-hidden style={[styles.blank, { backgroundColor: ds.c.lineStrong }]} />
            </View>
          ))}
        </View>
      ) : null}
      <Surface style={styles.lock}>
        <View style={styles.lockText}>
          <IconSymbol name="lock.fill" size={18} color={ds.c.muted} />
          <Body tone="muted" style={styles.flex}>
            The spec shows when you sign in. It’s free, and it saves the drink and your ranks too.
          </Body>
        </View>
        <Button label="Sign in to see the full spec" size="lg" onPress={() => router.push('/auth/login')} />
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  start: { alignSelf: 'flex-start' },
  section: { gap: space.sm },
  lockedHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  blank: { width: 64, height: 14, borderRadius: radius.mark },
  lock: { gap: space.md, padding: space.lg, marginTop: space.sm },
  locked: { gap: space.sm, padding: space.lg },
  lockText: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
