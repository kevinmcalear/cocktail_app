import { useRouter, type Href } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, type GestureResponderEvent } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import type { CreditProfile } from '@/lib/lineage';

/**
 * "by Ash Okafor · 2024": who made a drink, each name a link to their page
 * (find-yourself: every credit is a link to that person). Sits inside a row
 * that opens the drink, so a name's press stays its own.
 */
export function CreditLinks({ people, after }: { people: readonly CreditProfile[]; after?: string | null }) {
  const ds = useDs();
  const router = useRouter();
  if (!people.length) return after ? <Caption tone="muted">{after}</Caption> : null;
  const open = (p: CreditProfile) => (e: GestureResponderEvent) => {
    // On the web the press would also reach the row around it.
    e?.stopPropagation?.();
    router.push(`/p/${p.handle || p.id}` as Href);
  };
  return (
    <Caption tone="muted">
      {'by '}
      {people.map((p, i) => (
        <Fragment key={p.id}>
          {i ? (i === people.length - 1 ? ' and ' : ', ') : null}
          <Caption role="link" accessibilityLabel={`${p.display_name}'s page`} onPress={open(p)} style={[styles.name, { color: ds.c.ink }]}>
            {p.display_name}
          </Caption>
        </Fragment>
      ))}
      {after ? ` · ${after}` : null}
    </Caption>
  );
}

const styles = StyleSheet.create({
  name: { textDecorationLine: 'underline' },
});
