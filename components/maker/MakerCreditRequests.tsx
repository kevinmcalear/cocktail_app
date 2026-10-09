import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Headline, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAnswerMakerCredit, useMakerCreditRequests } from '@/hooks/useMakers';

const WHAT = { ice: 'the ice', glassware: 'the glass' } as const;

/**
 * Drinks that credit this venue's maker page (its ice or its glass), waiting
 * for its team's yes. On the Team screen for whoever can publish for the
 * venue. Nothing when none wait.
 */
export function MakerCreditRequests({ venueId }: { venueId: string }) {
  const ds = useDs();
  const { data: requests = [] } = useMakerCreditRequests(venueId);
  const answer = useAnswerMakerCredit(venueId);
  if (!requests.length) return null;
  const busy = answer.isPending;

  return (
    <View style={styles.section}>
      <Headline role="heading">Credits to confirm</Headline>
      <Caption tone="muted">Bars that say you made their drink’s ice or glass. Confirmed ones show on your page and the drink’s.</Caption>
      <View role="list" aria-label="Credits to confirm">
        {requests.map((r) => (
          <View key={`${r.item_id}-${r.makes}`} role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <DsText variant="headline" numberOfLines={1}>
              {r.drink_name}
            </DsText>
            <Caption tone="muted">{[r.credited_by, `credits you for ${WHAT[r.makes]}`].filter(Boolean).join(' ')}</Caption>
            <View style={styles.actions}>
              <Button label="Confirm" disabled={busy} onPress={() => answer.mutate({ request: r, yes: true })} />
              <Button label="Not ours" variant="ghost" disabled={busy} onPress={() => answer.mutate({ request: r, yes: false })} />
            </View>
          </View>
        ))}
      </View>
      {answer.error ? (
        <Caption tone="accent" role="alert">
          Couldn’t save that. Check your connection and try again.
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  row: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
});
