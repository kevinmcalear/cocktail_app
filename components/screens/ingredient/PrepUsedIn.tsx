import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, RowScore, scoreWords, Spec, TextLink, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useDrinkSources } from '@/hooks/useDrinkSources';
import { useItemScores } from '@/hooks/useFlavor';
import type { PrepUsedIn as UsedIn } from '@/hooks/usePrepCard';
import { poursPerBatch } from '@/lib/prepParts';
import { formatQuantity, toQuantity } from '@/lib/quantity';

interface PrepUsedInProps {
  name: string;
  drinks: { id: string; name: string }[];
  used: UsedIn | undefined;
  yieldAmount: number | null;
  yieldUnit: string | null;
  /** A bottle's page doesn't list the preps it goes into (prep-ing-campari); a prep's does. */
  isPrep: boolean;
  /** Wide rows put who made it at the right, before the score (prep-prep-desktop). */
  wide: boolean;
}

const FIRST = 4;

/** The drinks a prep goes in, with each one's pour, and the preps it goes into. */
export function PrepUsedIn({ name, drinks, used, yieldAmount, yieldUnit, isPrep, wide }: PrepUsedInProps) {
  const [all, setAll] = useState(false);
  const pours = used?.pours ?? {};
  const preps = isPrep ? (used?.preps ?? []) : [];
  const shown = all ? drinks : drinks.slice(0, FIRST);
  // Who made each and its score (b02), for the rows on screen.
  const { data: sources } = useDrinkSources(shown.map((d) => d.id));
  const { data: scores } = useItemScores(shown.map((d) => d.id));
  if (!drinks.length && !preps.length) return null;
  const reach = poursPerBatch(yieldAmount, yieldUnit, Object.values(pours));

  return (
    <View style={styles.section}>
      {drinks.length ? (
        <View style={styles.group}>
          <View style={styles.head}>
            <Headline role="heading">{`In ${drinks.length} ${drinks.length === 1 ? 'drink' : 'drinks'}`}</Headline>
            {drinks.length > FIRST ? <TextLink label={all ? 'Show fewer' : `See all ${drinks.length}`} onPress={() => setAll(!all)} /> : null}
          </View>
          {reach ? <Caption tone="muted">{reach}</Caption> : null}
          <View role="list" aria-label={`Drinks with ${name}`}>
            {shown.map((d) => {
              const q = toQuantity(pours[d.id]?.amount, pours[d.id]?.unit);
              // ½ oz reads as 15 ml, not 14.8.
              const pour = q && q.kind === 'ml' && q.value >= 5 ? { ...q, value: Math.round(q.value) } : q;
              return <Row key={d.id} id={d.id} kind="cocktail" name={d.name} amount={pour ? formatQuantity(pour) : ''} source={sources?.[d.id]?.by ?? undefined} score={scores?.[d.id]} wide={wide} />;
            })}
          </View>
        </View>
      ) : null}
      {preps.length ? (
        <View style={styles.group}>
          <Headline role="heading">Goes into</Headline>
          <Caption tone="muted">Other things made in-house with this one.</Caption>
          <View role="list">
            {preps.map((p) => {
              // "Made in-house · 100 ml in a batch", or "to taste" with no amount (prep-prep-phone).
              const q = toQuantity(p.amount, p.unit);
              return <Row key={p.id} id={p.id} kind="ingredient" name={p.name} source={`Made in-house · ${q ? `${formatQuantity(q)} in a batch` : 'to taste'}`} chevron />;
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Row({ id, kind, name, amount, source, score, wide, chevron }: { id: string; kind: 'cocktail' | 'ingredient'; name: string; amount?: string; source?: string; score?: number; wide?: boolean; chevron?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[name, amount, source, scoreWords(score)].filter(Boolean).join(', ')}
      onPress={() => router.push(`/${kind}/${id}` as never)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      {amount !== undefined ? (
        <Spec tone="accent" style={styles.amount}>
          {amount}
        </Spec>
      ) : null}
      <View style={styles.name}>
        <Body numberOfLines={1}>{name}</Body>
        {source && !wide ? (
          <Caption tone="muted" numberOfLines={1}>
            {source}
          </Caption>
        ) : null}
      </View>
      {source && wide ? (
        <Caption tone="muted" numberOfLines={1}>
          {source}
        </Caption>
      ) : null}
      <RowScore score={score} />
      {chevron ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xl },
  group: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 4, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 64 },
  name: { flex: 1, minWidth: 0 },
});
