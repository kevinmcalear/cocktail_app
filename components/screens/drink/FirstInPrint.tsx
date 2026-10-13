import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, Headline, PressableScale, Spec, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { leadRecord, readUrl, RELATION_LABEL, RIGHTS_LABEL, sourceByline, throughTheYears, type PrintedRecipe } from '@/lib/drinkHistory';
import { barMl, formatAmount } from '@/lib/drinkMath';
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
  // Whose printing it is comes first: a borrowed one must never be cut off. Then who printed it, where (board prep-hist-first-print).
  const detail = borrowed ? `for the ${borrowed}` : null;
  const byline = sourceByline(lead.source);
  const label = RELATION_LABEL[lead.relation];

  return (
    <FactRow
      label={label}
      mark={lead.source.year ? String(lead.source.year) : null}
      accessibilityLabel={[`${label}${lead.source.year ? `, ${lead.source.year}` : ''}`, lead.source.title, byline, detail].filter(Boolean).join('. ')}
      more={
        <>
          {lead.quote ? (
            <DsText variant="title" italic style={[styles.quote, { borderLeftColor: ds.accentText }]}>
              {`"${lead.quote}"`}
            </DsText>
          ) : (
            // Facts, never wording, from a book still in copyright: its lines, without the conversions Then and now gives.
            <PrintedLines record={lead} />
          )}
          {lead.method && !lead.quote ? <Body tone="muted">{lead.method}</Body> : null}
          <View style={styles.links}>
            <Caption tone="muted">{[lead.page_label ? `Page ${lead.page_label}` : null, RIGHTS_LABEL[lead.source.rights].toLowerCase()].filter(Boolean).join(' · ')}</Caption>
            {url ? <SmallLink label={lead.page_url ? 'See the page ›' : 'Read the book ›'} onPress={() => void Linking.openURL(url)} /> : null}
            <SmallLink label="About the book ›" onPress={() => router.push(bookHref(lead.source.key))} />
          </View>
          <ThenAndNow record={lead} lines={lines} />
          <View role="list" accessibilityLabel="Through the years" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
            <Headline role="heading">Through the years</Headline>
            {years.map((y, i) => (
              <View key={y.key} role="listitem" style={[styles.row, i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
                <Spec style={[styles.year, { color: ds.accentText }]}>{y.year}</Spec>
                <Body style={styles.flex}>{y.line}</Body>
              </View>
            ))}
            {borrowed ? null : (
              <PressableScale role="link" accessibilityLabel="Now: on bar menus here. Open its rankings" onPress={() => router.push(`/rankings/${itemId}` as Href)} style={[styles.row, { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Spec style={[styles.year, { color: ds.accentText }]}>Now</Spec>
                <Body style={styles.flex}>{'On bar menus here ›'}</Body>
              </PressableScale>
            )}
          </View>
          {rest.length && !later ? <SmallLink tone="muted" label={`${rest.length} later ${rest.length === 1 ? 'printing' : 'printings'} ›`} onPress={() => setLater(true)} /> : null}
          {rest.length && later ? (
            <View role="list" accessibilityLabel="Later printings">
              {rest.map((r) => (
                <PressableScale
                  key={r.id}
                  role="link"
                  accessibilityLabel={`${r.source.year ?? ''} ${r.source.title}. ${RELATION_LABEL[r.relation]}. Open the book`}
                  onPress={() => router.push(bookHref(r.source.key))}
                  style={[styles.row, { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth }]}
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
        {byline || detail ? <Body tone="muted">{` · ${[detail, byline].filter(Boolean).join(' · ')}`}</Body> : null}
      </Body>
    </FactRow>
  );
}

/** A small link in a caption row ("See the page ›"), accent unless it's a quiet "2 later printings ›". */
function SmallLink({ label, onPress, tone = 'accent' }: { label: string; onPress: () => void; tone?: 'accent' | 'muted' }) {
  return (
    <PressableScale role="link" accessibilityLabel={label.replace(' ›', '')} onPress={onPress} style={styles.small}>
      <Caption tone={tone}>{label}</Caption>
    </PressableScale>
  );
}

/** The ingredients as printed. */
function PrintedLines({ record }: { record: PrintedRecipe }) {
  const ds = useDs();
  if (!record.lines.length) return null;
  return (
    <View role="list" accessibilityLabel="As printed">
      {record.lines.map((l) => (
        <View key={l.sort_order} role="listitem" style={[styles.line, { borderTopColor: ds.c.line }]}>
          <Body style={styles.flex}>{l.ingredient_text}</Body>
          {l.amount_text ? <Spec tone="muted">{l.amount_text}</Spec> : null}
        </View>
      ))}
    </View>
  );
}

const FRACTIONS: Record<string, string> = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/8': '⅛' };
/** "2/3" as the book's ⅔. */
const fraction = (t: string) => t.replace(/\b([123])\/([2348])\b/g, (m) => FRACTIONS[m] ?? m);

/** The printed measures beside this page's, in ml. Nothing without amounts on both sides. */
function ThenAndNow({ record, lines }: { record: PrintedRecipe; lines: SpecLine[] }) {
  const ds = useDs();
  const rows = thenAndNow(record.lines, lines);
  if (!rows.length) return null;
  const year = record.source.year ? String(record.source.year) : 'Then';
  const equal = stillEqual(rows);
  const now = (ml: number | null) => (ml == null ? '–' : formatAmount(barMl(ml), 'ml'));
  return (
    <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <Headline role="heading">Then and now</Headline>
      <View role="table" accessibilityLabel="Then and now">
        <View role="row" style={styles.tr}>
          <Caption style={styles.flex} />
          <Caption tone="muted" style={[styles.th, styles.td]}>{year.toUpperCase()}</Caption>
          <Caption tone="muted" style={[styles.th, styles.td]}>NOW</Caption>
        </View>
        {rows.map((r) => (
          <View key={r.name} role="row" style={[styles.tr, styles.rowLine, { borderTopColor: ds.c.line }]} accessible accessibilityLabel={`${r.name}: ${r.then} in ${year}, ${r.now == null ? 'not on this page' : now(r.now)} now`}>
            <Body style={styles.flex} numberOfLines={2}>{r.name}</Body>
            <Spec style={styles.td} numberOfLines={1}>{fraction(r.then)}</Spec>
            <Spec style={styles.td} numberOfLines={1}>{now(r.now)}</Spec>
          </View>
        ))}
      </View>
      {equal ? <Caption tone="muted">{equal}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The display face's italic, at headline size, with the accent rule at its left: a printed recipe, not a title.
  quote: { fontSize: type.headline.fontSize, lineHeight: type.headline.lineHeight + 1, borderLeftWidth: 2, paddingLeft: space.md },
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.lg, rowGap: space.xs },
  small: { minHeight: layout.minTapTarget - space.lg, justifyContent: 'center' },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.md,
    minHeight: layout.minTapTarget - 8,
    borderTopWidth: 1,
    paddingTop: space.sm,
  },
  card: { gap: space.xs, paddingVertical: space.md + 2, paddingHorizontal: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    minHeight: layout.minTapTarget,
    paddingVertical: space.sm + 2,
  },
  year: { width: space.xxxl + space.xs },
  flex: { flex: 1, minWidth: 0 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  th: { fontFamily: fontFamilies.monoMedium, letterSpacing: 1.2 },
  td: { minWidth: space.xxxl + space.lg, textAlign: 'right' },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth },
});
