import { useRouter, type Href } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, PressableScale, Spec, Surface, Tag, useDs } from '@/components/ds';
import { layout, space, type } from '@/constants/tokens';
import { useDrinkHistory } from '@/hooks/useDrinkHistory';
import { historyFor, leadRecord, readUrl, RELATION_LABEL, RIGHTS_LABEL, sourceByline, type PrintedRecipe } from '@/lib/drinkHistory';

const bookHref = (key: string) => `/book/${key}` as Href;

/**
 * Where a drink came from: its first printed recipe, as printed (word for
 * word only from public-domain books), with the page to read it on, then the
 * printings after it that changed something. A drink with none of its own
 * shows its nearest classic's (`family`, nearest first, with names).
 */
export function FromTheBooks({ family }: { family: { id: string; name: string }[] }) {
  const ds = useDs();
  const router = useRouter();
  const { data = [] } = useDrinkHistory(family.map((f) => f.id));
  const found = historyFor(
    data,
    family.map((f) => f.id)
  );
  if (!found) return null;
  const lead = leadRecord(found.records)!;
  const rest = found.records.filter((r) => r.id !== lead.id);
  const borrowed = found.itemId !== family[0]?.id ? family.find((f) => f.id === found.itemId)?.name : null;
  const url = readUrl(lead);

  return (
    <View style={styles.section}>
      <Headline role="heading">From the books</Headline>
      {borrowed ? <Caption tone="muted">{`From the family: the ${borrowed}.`}</Caption> : null}
      <Surface style={styles.card}>
        <Caption tone="muted" style={styles.eyebrow}>
          {[RELATION_LABEL[lead.relation], lead.source.year].filter(Boolean).join(' · ').toUpperCase()}
        </Caption>
        <PressableScale role="link" accessibilityLabel={`${lead.source.title}. Open the book`} onPress={() => router.push(bookHref(lead.source.key))}>
          <Headline>{lead.source.title}</Headline>
        </PressableScale>
        <Caption tone="muted">{[sourceByline(lead.source), lead.page_label ? `page ${lead.page_label}` : null].filter(Boolean).join(' · ')}</Caption>
        <View style={styles.tags}>
          <Tag label={RIGHTS_LABEL[lead.source.rights]} />
          {lead.printed_name ? <Tag label={`Printed as "${lead.printed_name}"`} /> : null}
        </View>
        {lead.quote ? (
          <View style={[styles.quote, { borderLeftColor: ds.accentText }]}>
            <DsText variant="title" italic style={styles.quoteText}>{`"${lead.quote}"`}</DsText>
          </View>
        ) : null}
        <PrintedLines record={lead} />
        {lead.method && !lead.quote ? <Body tone="muted">{lead.method}</Body> : null}
        {url ? (
          <Button
            label={lead.page_url ? 'See the page in the book' : 'Read the book'}
            variant="secondary"
            icon="book"
            onPress={() => void Linking.openURL(url)}
          />
        ) : null}
      </Surface>
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
    </View>
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
  section: { gap: space.md },
  card: { gap: space.md },
  eyebrow: { letterSpacing: 1.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  quote: { borderLeftWidth: 2, paddingLeft: space.md },
  // The display face's italic, at headline size: a printed recipe, not a title.
  quoteText: { fontSize: type.headline.fontSize, lineHeight: type.headline.lineHeight + 2 },
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
