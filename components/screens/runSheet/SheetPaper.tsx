import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { DsText, type DsTextProps } from '@/components/ds';
import { fontFamilies, printPaper as P, radius, space } from '@/constants/tokens';
import { needGroups, type RunSheet, type SheetPart } from '@/lib/runSheet';
import { needAmount, needName, sheetHead, thingCount } from '@/lib/runSheetText';

const T = ({ style, ...props }: DsTextProps) => <DsText color={P.ink} {...props} style={style} />;
const Muted = (props: DsTextProps) => <T variant="caption" color={P.muted} {...props} />;
const mono = { fontFamily: fontFamilies.mono };
const semi = { fontFamily: fontFamilies.bodySemiBold };

/** A drink made in parts: the part's number and name over its lines, as the drink page has them. */
function PartHead({ part }: { part: SheetPart }) {
  return (
    <View style={styles.partHead}>
      <View style={[styles.partNo, { backgroundColor: P.ink }]}>
        <T variant="caption" color={P.paper} style={semi}>{String(part.n)}</T>
      </View>
      <T variant="label" style={[semi, styles.cell]}>{part.name}</T>
      {part.joins ? <Muted>{part.joins}</Muted> : null}
    </View>
  );
}

/**
 * The run sheet on paper, black on white in both themes (board "Sheet", A4):
 * who brings what, by party and group, then each drink as swapped for this
 * menu. `full` is a phone's full-size look (the PDF and the web's print page
 * are lib/runSheetHtml.ts), `compact` the desktop's live preview, `mini` the
 * phone's Sheet step.
 */
export function SheetPaper({ sheet, menu, variant = 'full', printedOn }: {
  sheet: RunSheet;
  menu: { name: string; startsAt: string | null; endsAt: string | null };
  variant?: 'full' | 'compact' | 'mini';
  printedOn?: Date;
}) {
  const head = sheetHead(sheet, menu);
  const parties = sheet.parties.filter((p) => p.needs.length);
  const drinks = sheet.drinks.filter((d) => d.serves > 0);
  const full = variant === 'full';
  return (
    <View style={[styles.paper, full ? styles.fullPad : styles.smallPad]}>
      <View style={[styles.header, { borderBottomColor: P.ink }]}>
        <Muted style={[semi, styles.eyebrow]}>RUN SHEET</Muted>
        <T variant={full ? 'title' : 'headline'} style={{ fontFamily: fontFamilies.instrument }}>{head.name}</T>
        <T variant={full ? 'body' : 'caption'}>{head.when || 'No date yet'}</T>
        <Muted>{head.who}</Muted>
        {head.extra && variant !== 'mini' ? <Muted>{head.extra}</Muted> : null}
      </View>

      <View style={{ gap: space.md }}>
        <T variant={full ? 'headline' : 'label'} style={semi}>Who brings what</T>
        {!parties.length ? <Muted>Set some serves and the list fills in.</Muted> : null}
        {variant === 'mini'
          ? parties.map((p) => (
              <View key={p.id ?? 'host'} style={styles.miniRow}>
                <T variant="caption">{p.name}</T>
                <Muted>{thingCount(p.needs.length)}</Muted>
              </View>
            ))
          : parties.map((p) => (
              <View key={p.id ?? 'host'} style={[styles.box, { borderColor: P.rule }]}>
                <View style={[styles.boxHead, { borderBottomColor: P.rule }]}>
                  <T variant={full ? 'body' : 'caption'} style={semi}>{p.name}</T>
                  <Muted>{p.role}</Muted>
                </View>
                {full ? (
                  needGroups(p.needs).map((g) => (
                    <Fragment key={g.key}>
                      <Muted style={[semi, styles.groupTitle]}>{g.title.toUpperCase()}</Muted>
                      {g.needs.map((n) => (
                        <View key={n.key} style={[styles.tr, { borderBottomColor: P.hairline }]}>
                          <T variant="label" style={styles.cell}>{n.name}</T>
                          <T variant="label" style={[mono, styles.amount]}>{needAmount(n)}</T>
                        </View>
                      ))}
                    </Fragment>
                  ))
                ) : (
                  <Muted color={P.ink}>{p.needs.map((n) => `${needName(n)} ${n.amount}`).join(', ')}</Muted>
                )}
              </View>
            ))}
      </View>

      {variant === 'compact' ? null : (
        <View style={{ gap: space.md }}>
          <T variant={full ? 'headline' : 'label'} style={semi}>The drinks</T>
          {(full ? drinks : drinks.slice(0, 3)).map((d) =>
            full ? (
              <View key={d.id} style={[styles.drink, { borderBottomColor: P.rule }]}>
                <View style={styles.drinkHead}>
                  <T variant="title" style={{ fontFamily: fontFamilies.instrument }}>{d.name}</T>
                  <T variant="body" style={mono}>× {d.serves.toLocaleString('en-GB')}</T>
                </View>
                {d.serve ? <Muted>{d.serve}</Muted> : null}
                <View style={[styles.tr, { borderBottomColor: P.ink }]}>
                  <Muted style={[semi, { flex: 1 }]}>Ingredient</Muted>
                  <Muted style={[semi, styles.num]}>Per drink</Muted>
                  <Muted style={[semi, styles.num]}>For {d.serves.toLocaleString('en-GB')}</Muted>
                </View>
                {(d.parts ?? [null]).map((part) => (
                  <Fragment key={part?.n ?? 0}>
                    {part ? <PartHead part={part} /> : null}
                    {(part?.lines ?? d.lines).filter((l) => !l.garnish).map((l, i) => (
                      <View key={`${l.ingredientId}-${i}`} style={[styles.tr, { borderBottomColor: P.hairline }]}>
                        <T variant="label" style={{ flex: 1 }}>{l.name}</T>
                        <T variant="label" style={[mono, styles.num]}>{l.per}</T>
                        <T variant="label" style={[mono, styles.num]}>{l.total ?? ''}</T>
                      </View>
                    ))}
                  </Fragment>
                ))}
              </View>
            ) : (
              <View key={d.id} style={styles.miniRow}>
                <T variant="caption" style={{ fontFamily: fontFamilies.instrument }}>{d.name}</T>
                <Muted style={mono}>× {d.serves.toLocaleString('en-GB')}</Muted>
              </View>
            ),
          )}
        </View>
      )}
      {full ? (
        <Muted>
          Printed {(printedOn ?? new Date()).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} from the {menu.name} menu. Specs as swapped for this menu.
        </Muted>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: P.paper, gap: space.xl },
  fullPad: { padding: space.xxxl },
  smallPad: { padding: space.xl, gap: space.md, borderRadius: radius.mark },
  header: { gap: space.xs + 2, borderBottomWidth: 2, paddingBottom: space.lg },
  eyebrow: { letterSpacing: 1 },
  groupTitle: { letterSpacing: 1, paddingTop: space.sm },
  box: { borderWidth: 1, borderRadius: radius.mark, paddingHorizontal: space.lg, paddingVertical: space.md },
  boxHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: space.xs + 2, borderBottomWidth: 1, marginBottom: space.xs },
  tr: { flexDirection: 'row', gap: space.md, paddingVertical: space.xs + 1, borderBottomWidth: 1 },
  num: { width: 96, textAlign: 'right' },
  cell: { flex: 1, minWidth: 0 },
  amount: { flexShrink: 0, maxWidth: '62%', textAlign: 'right' },
  drink: { gap: space.xs + 2, paddingBottom: space.md, borderBottomWidth: 1 },
  drinkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  partHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm, paddingBottom: space.xs },
  partNo: { width: 20, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  miniRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
});
