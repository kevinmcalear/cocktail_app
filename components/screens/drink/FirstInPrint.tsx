import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Spec, TextLink, useDs } from '@/components/ds';
import { layout, radius, space, type } from '@/constants/tokens';
import { leadRecord, readUrl, RELATION_LABEL, RIGHTS_LABEL, sourceByline, throughTheYears, type PrintedRecipe } from '@/lib/drinkHistory';
import { formatAmount } from '@/lib/drinkMath';
import type { SpecLine } from '@/lib/spec';
import { stillEqual, thenAndNow } from '@/lib/thenAndNow';

import { FactRow } from './FactRow';

const bookHref = (key: string) => `/book/${key}` as Href;

/**
 * A drink's first printed recipe as one fact: the year, the book and what it
 * was printed as. Opens in place to the recipe as printed (word for word only
 * from public-domain books), the page to read it on, and the later printings
 * that changed something, and Then and now: each printed line beside this
 * page's ml (board drink-phone-classic). `records` may be its nearest
 * classic's, named in `borrowed`.
 */
export function FirstInPrint({ records, borrowed, itemId, lines = [] }: { records: PrintedRecipe[]; borrowed: string | null; itemId: string; lines?: SpecLine[] }) {
  const ds = useDs();
  const router = useRouter();
  const [later, setLater] = useState(false);
  const lead = leadRecord(records);
  if (!lead) return null;
  const years = throughTheYears(records);
  const rest = records.filter((r) => r.id !== lead.id);
  const url = readUrl(lead);
  // Whose printing it is comes first: a borrowed one must never be cut off.
  const detail = [borrowed ? `for the ${borrowed}` : null, lead.printed_name ? `as "${lead.printed_name}"` : null].filter(Boolean).join(' · ');
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
          <ThenAndNow record={lead} lines={lines} />
          <View style={styles.links}>
            {url ? <TextLink label={lead.page_url ? 'See the page' : 'Read the book'} onPress={() => void Linking.openURL(url)} /> : null}
            <TextLink label="About the book" onPress={() => router.push(bookHref(lead.source.key))} />
          </View>
          <Caption tone="muted" role="heading" style={styles.eyebrow}>
            THROUGH THE YEARS
          </Caption>
          <View role="list" accessibilityLabel="Through the years">
            {years.map((y) => (
              <View key={y.key} role="listitem" style={[styles.row, { borderTopColor: ds.c.line }]}>
                <Spec style={[styles.year, { color: ds.accentText }]}>{y.year}</Spec>
                <Body style={styles.flex}>{y.line}</Body>
              </View>
            ))}
            {borrowed ? null : (
              <PressableScale role="link" accessibilityLabel="Now: on bar menus here. Open its rankings" onPress={() => router.push(`/rankings/${itemId}` as Href)} style={[styles.row, { borderTopColor: ds.c.line }]}>
                <Spec style={[styles.year, { color: ds.accentText }]}>Now</Spec>
                <Body style={styles.flex}>{'On bar menus here ›'}</Body>
              </PressableScale>
            )}
          </View>
          {rest.length && !later ? <TextLink label={`${rest.length} later ${rest.length === 1 ? 'printing' : 'printings'} ›`} onPress={() => setLater(true)} /> : null}
          {rest.length && later ? (
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
      <Body numberOfLines={3}>
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

/** The printed measures beside this page's, in ml. Nothing without amounts on both sides. */
function ThenAndNow({ record, lines }: { record: PrintedRecipe; lines: SpecLine[] }) {
  const ds = useDs();
  const rows = thenAndNow(record.lines, lines);
  if (!rows.length) return null;
  const year = record.source.year ? String(record.source.year) : 'Then';
  const equal = stillEqual(rows);
  return (
    <View style={[styles.table, { backgroundColor: ds.c.surface }]}>
      <Caption tone="muted">Then and now</Caption>
      <View role="table" accessibilityLabel="Then and now">
        <View role="row" style={styles.tr}>
          <Caption style={styles.flex} />
          <Caption tone="muted" style={styles.td}>{year}</Caption>
          <Caption tone="muted" style={styles.td}>Now</Caption>
        </View>
        {rows.map((r) => (
          <View key={r.name} role="row" style={[styles.tr, styles.rowLine, { borderTopColor: ds.c.line }]} accessible accessibilityLabel={`${r.name}: ${r.then} in ${year}, ${r.now == null ? 'not on this page' : formatAmount(r.now, 'ml')} now`}>
            <Body style={styles.flex} numberOfLines={1}>{r.name}</Body>
            <Spec tone="muted" style={styles.td}>{r.then}</Spec>
            <Spec style={styles.td}>{r.now == null ? '–' : String(r.now)}</Spec>
          </View>
        ))}
      </View>
      <Caption tone="muted">{`${equal ? `${equal} ` : ''}Now is this page's spec, in ml.`}</Caption>
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
  eyebrow: { letterSpacing: 1, paddingTop: space.sm },
  flex: { flex: 1, minWidth: 0 },
  table: { gap: space.sm, padding: space.md, borderRadius: radius.control },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  td: { width: space.xxxl + space.lg, textAlign: 'right' },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth },
});
