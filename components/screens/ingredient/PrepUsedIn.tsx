import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, Spec, TextLink, useDs } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
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
  if (!drinks.length && !preps.length) return null;
  const shown = all ? drinks : drinks.slice(0, FIRST);
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
              return <Row key={d.id} id={d.id} kind="cocktail" name={d.name} amount={q ? formatQuantity(q) : ''} />;
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

function Row({ id, kind, name, amount }: { id: string; kind: 'cocktail' | 'ingredient'; name: string; amount: string }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      role="link"
      accessibilityLabel={amount ? `${name}, ${amount}` : name}
      onPress={() => router.push(`/${kind}/${id}` as never)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <Spec tone="accent" style={styles.amount}>
        {amount}
      </Spec>
      <Body numberOfLines={1} style={styles.name}>
        {name}
      </Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xl },
  group: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 4, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 72 },
  name: { flex: 1 },
});
