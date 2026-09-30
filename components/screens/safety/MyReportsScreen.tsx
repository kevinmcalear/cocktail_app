import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, Tag, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useMyReports, type MyReport } from '@/hooks/useSafety';
import { reasonLabel, REPORT_KIND_LABEL, reportOutcome, reportSubject } from '@/lib/safety';

import { SafetyPage } from './SafetyPage';

const DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Settings › Your reports: what you've reported and what happened to each. */
export function MyReportsScreen() {
  const { data: reports, isLoading, error } = useMyReports();
  return (
    <SafetyPage title="Your reports" intro="What you’ve reported and what our moderators did. Nobody you report is told it was you.">
      {error ? (
        <Body tone="muted">Couldn’t load your reports. Check your connection and try again.</Body>
      ) : isLoading ? (
        <Caption tone="muted">Loading…</Caption>
      ) : reports?.length ? (
        <View role="list" aria-label="Your reports">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </View>
      ) : (
        <Body tone="muted">You haven’t reported anything. To report something, tap Report on a drink or More on a profile.</Body>
      )}
    </SafetyPage>
  );
}

function ReportRow({ report: r }: { report: MyReport }) {
  const ds = useDs();
  const outcome = reportOutcome(r.status);
  const subject = reportSubject(r.target_kind, { profile: r.profile?.display_name ?? null, item: r.item?.name ?? null, release: r.release?.name ?? null });
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={styles.tags}>
        <Tag label={outcome.label} tone={r.status === 'actioned' ? 'success' : 'default'} />
        <Tag label={REPORT_KIND_LABEL[r.target_kind]} />
      </View>
      <Headline>{subject ?? (r.status === 'actioned' ? 'Taken down' : 'No longer visible to you')}</Headline>
      <Caption tone="muted">{`${reasonLabel(r.reason)} · sent ${DAY.format(new Date(r.created_at))}`}</Caption>
      <Body>{outcome.detail}</Body>
      {r.resolution ? <Body tone="muted">{`From the moderator: ${r.resolution}`}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
