import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Caption, DrinkImage, DsText, Headline, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useAnswerCredit, useCreditsToCheck, type CreditToCheck } from '@/hooks/useCreditsToCheck';
import { itemHref, type ItemCategory } from '@/lib/itemRoutes';

import { useClaimNews } from './YourBarCard';

/** On You: the first two inline, then All N for the rest (board w3-credits-to-check, A). */
const INLINE = 2;

export const CREDITS_LEAD = 'People say you made these with them. Nothing shows on your page until you say yes.';
/** Just after your claim was approved, with credits named before it (board w3-credits-to-check, after the claim). */
const WAITED_LEAD = 'It waited on your page for you. Nothing shows until you say yes.';

/**
 * Credits to check, a card at the top of You where Jobs waiting sits: drinks
 * someone named you on as a co-creator, each with Accept and Not me. Gone
 * when nothing waits.
 */
export function CreditsToCheckCard() {
  const ds = useDs();
  const router = useRouter();
  const credits = useCreditsToCheck().data ?? [];
  const claim = useClaimNews();
  if (!credits.length) return null;
  const waited = !!claim && credits.some((c) => Date.parse(c.named_at) <= Date.parse(claim.created_at));

  return (
    <Surface style={styles.card}>
      <View style={styles.head}>
        <Headline role="heading" style={styles.flex}>
          Credits to check
        </Headline>
        <DsText variant="headline" tone="muted" aria-label={`${credits.length} waiting`}>
          {String(credits.length)}
        </DsText>
      </View>
      <Caption tone="muted">{waited ? WAITED_LEAD : CREDITS_LEAD}</Caption>
      <CreditRows credits={credits.slice(0, INLINE)} />
      {credits.length > INLINE ? (
        <Pressable role="link" onPress={() => router.push('/credits-to-check' as Href)} style={[styles.all, { borderTopColor: ds.c.line }]}>
          <DsText variant="label">{`All ${credits.length}`}</DsText>
          <IconSymbol name="chevron.right" size={14} color={ds.c.muted} />
        </Pressable>
      ) : null}
    </Surface>
  );
}

/** One row a credit: the drink, who named you and where, Accept and Not me. The name opens the drink. */
export function CreditRows({ credits }: { credits: CreditToCheck[] }) {
  const ds = useDs();
  const router = useRouter();
  const answer = useAnswerCredit();

  return (
    <View role="list" aria-label="Credits to check">
      {credits.map((c, i) => (
        <View key={c.item_id} role="listitem" style={[styles.row, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
          <DrinkImage itemId={c.item_id} accessibilityLabel={c.name} thumb sketchDetail="thumb" radius="control" style={styles.thumb} />
          <View style={styles.flex}>
            <DsText variant="headline" role="link" numberOfLines={2} onPress={() => router.push(drinkHref(c) as Href)}>
              {c.name}
            </DsText>
            <Caption>{`${c.creator_name ?? 'Someone'} named you as a co-creator`}</Caption>
            {c.bar_name ? <Caption tone="muted">{c.bar_name}</Caption> : null}
            <View style={styles.actions}>
              <Button label="Accept" size="sm" disabled={answer.isPending} accessibilityLabel={`Accept ${c.name}`} onPress={() => answer.mutate({ itemId: c.item_id, accept: true })} />
              <Button label="Not me" size="sm" variant="secondary" disabled={answer.isPending} accessibilityLabel={`Not me, ${c.name}`} onPress={() => answer.mutate({ itemId: c.item_id, accept: false })} />
            </View>
            {answer.error && answer.variables?.itemId === c.item_id ? (
              <Caption tone="accent" role="alert">
                {answer.error.message}
              </Caption>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const CATEGORY: Partial<Record<CreditToCheck['item_type'], ItemCategory>> = { beer: 'Beer', wine: 'Wine', ingredient: 'Ingredient' };

function drinkHref(c: CreditToCheck): string {
  return itemHref(CATEGORY[c.item_type], c.item_id);
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  thumb: { width: 52, height: 52 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  all: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44 },
});
