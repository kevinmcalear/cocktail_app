import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useAnswerCredit } from '@/hooks/useCreditsToCheck';
import { useMyProfile } from '@/hooks/useMyProfile';
import type { CreditProfile, LineageDrink } from '@/lib/lineage';

/**
 * Under a drink's credit: co-creators who haven't said yes (Q34, board
 * w3-credits-to-check). The person named gets Accept and Not me, as on You,
 * and can take back a no. The drink's editors get "With Kevin McAlear ·
 * waiting for a yes" or "Kevin McAlear said Not me". Nobody else is sent
 * these rows (item_co_creators RLS), so they see only who said yes.
 */
export function CoCreatorAnswers({ drink }: { drink: Pick<LineageDrink, 'id' | 'creator' | 'origin_bar' | 'co_creators'> }) {
  const ds = useDs();
  const meId = useMyProfile().data?.id ?? null;
  const answer = useAnswerCredit();
  const open = (drink.co_creators ?? []).filter((c): c is { status: 'pending' | 'declined'; profile: CreditProfile } => !!c.profile && (c.status === 'pending' || c.status === 'declined'));
  if (!open.length) return null;
  const by = drink.creator ?? drink.origin_bar;
  const first = drink.creator?.display_name.split(' ')[0];
  const ask = (accept: boolean) => answer.mutate({ itemId: drink.id, accept });

  return (
    <View style={styles.list}>
      {open.map((c) =>
        c.profile.id === meId ? (
          <View key={c.profile.id} style={[styles.ask, { borderColor: ds.c.lineStrong }]}>
            <Body>
              {c.status === 'pending'
                ? `${by?.display_name ?? 'Someone'} named you as a co-creator. ${first ? `Did you make it with ${first}?` : 'Did you make it?'}`
                : 'You said Not me. Made it after all?'}
            </Body>
            <View style={styles.actions}>
              <Button label="Accept" size="sm" disabled={answer.isPending} onPress={() => ask(true)} />
              {c.status === 'pending' ? <Button label="Not me" size="sm" variant="secondary" disabled={answer.isPending} onPress={() => ask(false)} /> : null}
            </View>
            {answer.error ? (
              <Caption tone="accent" role="alert">
                {answer.error.message}
              </Caption>
            ) : null}
          </View>
        ) : (
          <View key={c.profile.id} style={styles.note}>
            <IconSymbol name={c.status === 'pending' ? 'clock' : 'xmark'} size={16} color={ds.c.muted} />
            <Caption tone="muted" style={styles.flex}>
              {c.status === 'pending' ? `With ${c.profile.display_name} · waiting for a yes` : `${c.profile.display_name} said Not me`}
            </Caption>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  ask: { gap: space.sm, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
