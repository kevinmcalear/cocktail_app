import { useRouter, type Href } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Spec, TextLink, useDs } from '@/components/ds';
import { layout, space, type } from '@/constants/tokens';
import { leadRecord, readUrl, RELATION_LABEL, RIGHTS_LABEL, sourceByline, type PrintedRecipe } from '@/lib/drinkHistory';

import { FactRow } from './FactRow';

const bookHref = (key: string) => `/book/${key}` as Href;

/**
 * A drink's first printed recipe as one fact: the year, the book and what it
 * was printed as. Opens in place to the recipe as printed (word for word only
 * from public-domain books), the page to read it on, and the later printings
 * that changed something. `records` may be its nearest classic's, named in
 * `borrowed`.
 */
export function FirstInPrint({ records, borrowed }: { records: PrintedRecipe[]; borrowed: string | null }) {
  const ds = useDs();
  const router = useRouter();
  const lead = leadRecord(records);
  if (!lead) return null;
  const rest = records.filter((r) => r.id !== lead.id);
  const url = readUrl(lead);
  const detail = [lead.source.author, lead.printed_name ? `as "${lead.printed_name}"` : null, borrowed ? `for the ${borrowed}` : null].filter(Boolean).join(' · ');
  const label = RELATION_LABEL[lead.relation];

  return (
    <FactRow
      label={label}
      mark={lead.source.year ? String(lead.source.year) : null}
      accessibilityLabel={[`${label}${lead.source.year ? `, ${lead.source.year}` : ''}`, lead.source.title, detail].filter(Boolean).join('. ')}
      more={
        <>
          {lead.quote ? (
            <DsText variant="title" italic style={styles.quote}>
              {`"${lead.quote}"`}
            </DsText>
          ) : null}
          <PrintedLines record={lead} />
          {lead.method && !lead.quote ? <Body tone="muted">{lead.method}</Body> : null}
          <Caption tone="muted">
            {[sourceByline(lead.source), lead.page_label ? `page ${lead.page_label}` : null, RIGHTS_LABEL[lead.source.rights]].filter(Boolean).join(' · ')}
          </Caption>
          <View style={styles.links}>
            {url ? <TextLink label={lead.page_url ? 'See the page' : 'Read the book'} onPress={() => void Linking.openURL(url)} /> : null}
            <TextLink label="About the book" onPress={() => router.push(bookHref(lead.source.key))} />
          </View>
          {rest.length ? (
            <View role="list" accessibilityLabel="Later printings">
              {rest.map((r) => (
                <PressableScale
                  key={r.id}
                  role="link"
                  accessibilityLabel={`${r.source.year ?? ''} ${r.source.title}. ${RELATION_LABEL[r.relation]}. Open the book`}
                  onPress={() => router.push(bookHref(r.source.key))}
                  style={[styles.row, { borderTopColor: ds.c.line }]}
                >
                  <Spec style={[styles.year, { color: ds.accentText }]}>{r.source.year ? String(r.source.year) : ''}</Spec>
                  <View style={styles.flex}>
                    <Body numberOfLines={2}>{r.source.title}</Body>
                    <Caption tone="muted" numberOfLines={2}>
                      {[RELATION_LABEL[r.relation], r.source.author, r.notes].filter(Boolean).join(' · ')}
                    </Caption>
                  </View>
                </PressableScale>
              ))}
            </View>
          ) : null}
        </>
      }
    >
      <Body numberOfLines={2}>
        {lead.source.title}
        {detail ? <Body tone="muted">{` · ${detail}`}</Body> : null}
      </Body>
    </FactRow>
  );
}

/** The ingredients as printed, with ml where the measure is clear. */
function PrintedLines({ record }: { record: PrintedRecipe }) {
  const ds = useDs();
  if (!record.lines.length) return null;
  return (
    <View role="list" accessibilityLabel="As printed">
      {record.lines.map((l) => (
        <View key={l.sort_order} role="listitem" style={[styles.line, { borderTopColor: ds.c.line }]}>
          <Body style={styles.flex}>{l.ingredient_text}</Body>
          <Spec tone="muted">{[l.amount_text, l.amount_ml != null ? `${l.amount_ml} ml` : null].filter(Boolean).join(' · ')}</Spec>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The display face's italic, at headline size: a printed recipe, not a title.
  quote: { fontSize: type.headline.fontSize, lineHeight: type.headline.lineHeight + 2 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.md,
    minHeight: layout.minTapTarget - 8,
    borderTopWidth: 1,
    paddingTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    minHeight: layout.minTapTarget,
    paddingVertical: space.sm,
    borderTopWidth: 1,
  },
  year: { width: space.xxxl + space.sm },
  flex: { flex: 1, minWidth: 0 },
});
