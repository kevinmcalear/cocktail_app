import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, GlassButton, Sheet, Tag, Title, useDs } from '@/components/ds';
import { STATUS } from '@/constants/palette';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import type { BarFacts } from '@/hooks/useBarFacts';
import { hoursSource, hoursStatus, weekRows } from '@/lib/barHours';
import { readableAccent } from '@/lib/color';

import { ReportSheet } from '../safety/ReportSheet';

/**
 * This week's hours (ppl-bar-hours-sheet): open now or not, each day with
 * today marked, where the hours come from, and "Wrong? Tell us".
 */
export function HoursSheet({ visible, facts, onClose }: { visible: boolean; facts: BarFacts; onClose: () => void }) {
  const ds = useDs();
  const signedIn = useSignedIn();
  const [report, setReport] = useState(false);
  if (!facts.hours) return null;
  const now = new Date();
  const status = hoursStatus(facts.hours, now, facts.timezone);
  const rows = weekRows(facts.hours, now, facts.timezone);
  const header = (
    <View style={styles.head}>
      <View style={styles.flex}>
        <Title role="heading">Hours</Title>
        {status ? (
          <DsText variant="body">
            <DsText variant="body" color={status.open ? readableAccent(STATUS.success, ds.c.ground) : ds.c.ink} style={styles.strong}>
              {status.state}
            </DsText>
            {status.detail ? <DsText variant="body" tone="muted">{` · ${status.detail}`}</DsText> : null}
          </DsText>
        ) : null}
      </View>
      <GlassButton icon="xmark" accessibilityLabel="Close" onPress={onClose} />
    </View>
  );
  return (
    <>
      <Sheet visible={visible && !report} onClose={onClose} accessibilityLabel={`${facts.display_name} hours`} header={header}>
        <View role="list" aria-label={`${facts.display_name} hours this week`}>
          {rows.map((r, i) => (
            <View
              key={r.day}
              role="listitem"
              aria-current={r.today ? 'date' : undefined}
              style={[styles.row, i > 0 && !r.today ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null, r.today ? { backgroundColor: ds.c.raised } : null, r.today ? styles.today : null]}
            >
              <View style={[styles.flex, styles.day]}>
                <DsText variant="body" style={r.today ? styles.strong : null}>
                  {r.day}
                </DsText>
                {r.today ? <Tag label="Today" /> : null}
              </View>
              <DsText variant="body" tone={r.closed ? 'muted' : 'ink'} style={r.today ? styles.strong : null}>
                {r.text}
              </DsText>
            </View>
          ))}
        </View>
        <View style={styles.notes}>
          <Caption tone="muted">Hours may differ on public holidays.</Caption>
          <Caption tone="muted">{hoursSource(facts.is_claimed, facts.hours_updated_at, now)}</Caption>
        </View>
        {signedIn ? (
          <View style={styles.start}>
            <Button label="Wrong? Tell us" icon="flag" variant="secondary" onPress={() => setReport(true)} />
          </View>
        ) : null}
      </Sheet>
      {report ? (
        <ReportSheet
          subject={`${facts.display_name}'s hours`}
          targets={[{ label: facts.display_name, target: { kind: 'profile', profileId: facts.id } }]}
          onClose={() => setReport(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget + space.sm },
  today: { borderRadius: radius.control, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  day: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  notes: { gap: space.xs, paddingTop: space.lg },
  start: { alignItems: 'flex-start', paddingTop: space.md },
});
