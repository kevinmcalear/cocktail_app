import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, RowScore, scoreWords, Spec, TextLink, useDs } from '@/components/ds';
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
}

const FIRST = 4;

/** The drinks a prep goes in, with each one's pour, and the preps it goes into. */
export function PrepUsedIn({ name, drinks, used, yieldAmount, yieldUnit }: PrepUsedInProps) {
  const [all, setAll] = useState(false);
  const pours = used?.pours ?? {};
  const preps = used?.preps ?? [];
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
          <Headline role="heading">{`In ${drinks.length} ${drinks.length === 1 ? 'drink' : 'drinks'}`}</Headline>
          {reach ? <Caption tone="muted">{reach}</Caption> : null}
          <View role="list" aria-label={`Drinks with ${name}`}>
            {shown.map((d) => {
              const q = toQuantity(pours[d.id]?.amount, pours[d.id]?.unit);
              // ½ oz reads as 15 ml, not 14.8.
              const pour = q && q.kind === 'ml' && q.value >= 5 ? { ...q, value: Math.round(q.value) } : q;
              return <Row key={d.id} id={d.id} kind="cocktail" name={d.name} amount={pour ? formatQuantity(pour) : ''} source={sources?.[d.id]?.by ?? undefined} score={scores?.[d.id]} />;
            })}
          </View>
          {drinks.length > FIRST ? <TextLink label={all ? 'Show fewer' : `See all ${drinks.length}`} onPress={() => setAll(!all)} /> : null}
        </View>
      ) : null}
      {preps.length ? (
        <View style={styles.group}>
          <Headline role="heading">Goes into</Headline>
          <View role="list">
            {preps.map((p) => (
              <Row key={p.id} id={p.id} kind="ingredient" name={p.name} amount="" />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Row({ id, kind, name, amount, source, score }: { id: string; kind: 'cocktail' | 'ingredient'; name: string; amount: string; source?: string; score?: number }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={[name, amount, source, scoreWords(score)].filter(Boolean).join(', ')}
      onPress={() => router.push(`/${kind}/${id}` as never)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <Spec tone="accent" style={styles.amount}>
        {amount}
      </Spec>
      <View style={styles.name}>
        <Body numberOfLines={1}>{name}</Body>
        {source ? (
          <Caption tone="muted" numberOfLines={1}>
            {source}
          </Caption>
        ) : null}
      </View>
      <RowScore score={score} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xl },
  group: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 4, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 72 },
  name: { flex: 1, minWidth: 0 },
});
