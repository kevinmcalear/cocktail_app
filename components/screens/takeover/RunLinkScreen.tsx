import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Title, useDs, useGutter } from '@/components/ds';
import { ListGroup, ListRow, SectionLabel } from '@/components/ds/ListGroup';
import { layout, space } from '@/constants/tokens';
import { usePublicRunSheet } from '@/hooks/useTakeover';
import type { PartyList } from '@/lib/runSheetText';
import { needAmount, needName } from '@/lib/runSheetText';

import { Marks } from './parts';

/**
 * A party's run-sheet link on the web, no account (Keep-phone runlink): the
 * two bars, "Your run sheet", what they bring, and their list for the night.
 * Read only: the board's Got it, We'll do it, Add a count and Something we
 * can't do wait on a table for their answers.
 */
export function RunLinkScreen({ token }: { token: string }) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { data, isLoading } = usePublicRunSheet(token);
  const list = (data?.list ?? null) as unknown as PartyList | null;
  const host = list?.from.replace(/^From /, '') ?? '';
  const party = list?.party.name ?? data?.party_name ?? '';

  return (
    <ScrollView style={{ backgroundColor: ds.c.ground }} contentContainerStyle={[styles.body, { paddingTop: insets.top + 60, paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl }]}>
      <View style={styles.column}>
        {!data || !list ? (
          <Body tone="muted">{isLoading ? 'Opening your run sheet…' : 'This link has ended, or isn’t right. Ask the bar for a new one.'}</Body>
        ) : (
          <>
            <Marks marks={[{ name: party }, ...(host ? [{ name: host }] : [])]} size={48} />
            <View style={styles.head}>
              <Caption tone="muted" style={styles.caps}>
                {[`${party}${host ? ` at ${host}` : ''}`, list.when.split(' · ')[0]].filter(Boolean).join(' · ')}
              </Caption>
              <Title aria-level={1}>Your run sheet</Title>
              <Body tone="muted">{`${list.from}. No account needed.`}</Body>
            </View>
            {list.needs.length ? (
              <>
                <SectionLabel title={list.ask === 'Please have ready' ? `${party} has ready` : `${party} brings`} />
                <ListGroup>
                  {list.needs.map((n, i) => (
                    <ListRow key={n.key} first={i === 0} title={needName(n)} detail={needAmount(n)} />
                  ))}
                </ListGroup>
              </>
            ) : null}
            {list.drinks.length ? (
              <>
                <SectionLabel title="Your list for the night" />
                <ListGroup>
                  {list.drinks.map((d, i) => (
                    <ListRow key={d.name} first={i === 0} title={d.name} detail={`${d.serves.toLocaleString('en-GB')} serves${d.makes.length ? ` · you make ${d.makes.join(', ')}` : ''}`} />
                  ))}
                </ListGroup>
              </>
            ) : null}
            {list.extra ? <Caption tone="muted">{list.extra}</Caption> : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.page.text, gap: space.md + 2 },
  head: { gap: space.xs + 2, marginBottom: space.sm },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
