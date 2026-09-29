import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, GlassButton, Headline } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useFileReport, useMyOpenReport } from '@/hooks/useSafety';
import { REPORT_REASONS, type ReportReason, type ReportTarget } from '@/lib/safety';

export interface ReportChoice {
  label: string;
  target: ReportTarget;
}

interface ReportSheetProps {
  onClose: () => void;
  /** What's reported, in words: "@jo", "Owl Sour", "Night Owl's martini". */
  subject: string;
  /** One target, or a few to pick from first (a bar on a ranking list). */
  targets: ReportChoice[];
}

const DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' });

/**
 * Report something: which one (when there's a choice), why, optional
 * details, then a confirmation. Only moderators and the reporter see a
 * report; the person reported is never told who sent it.
 */
export function ReportSheet({ onClose, subject, targets }: ReportSheetProps) {
  const [picked, setPicked] = useState<ReportChoice | null>(targets.length === 1 ? targets[0] : null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const file = useFileReport();
  const { data: existing, isLoading } = useMyOpenReport(picked?.target ?? null);
  const title = picked ? `Report ${picked.label}` : `Report ${subject}`;

  let body;
  let footer;
  if (file.isSuccess) {
    body = (
      <>
        <Headline role="heading">Thanks. Your report is in.</Headline>
        <Body>A moderator will look at it. We won’t tell anyone you reported it. You can see what happened in Settings, under Your reports.</Body>
        <Body tone="muted">If you don’t want to see them again, you can also block a person from their profile.</Body>
      </>
    );
    footer = <Button label="Done" onPress={onClose} />;
  } else if (!picked) {
    body = (
      <>
        <Body>Which one are you reporting?</Body>
        <View role="radiogroup" aria-label="What to report" style={styles.list}>
          {targets.map((t) => (
            <Choice key={t.label} label={t.label} selected={false} onPress={() => setPicked(t)} />
          ))}
        </View>
      </>
    );
  } else if (isLoading) {
    body = <Caption tone="muted">Checking…</Caption>;
  } else if (existing) {
    body = (
      <>
        <Headline role="heading">You’ve already reported this</Headline>
        <Body>{`You sent a report on ${DAY.format(new Date(existing.created_at))}. A moderator will look at it; there's no need to send another.`}</Body>
      </>
    );
    footer = <Button label="Close" variant="secondary" onPress={onClose} />;
  } else {
    body = (
      <>
        <Body>Why are you reporting it? Only our moderators see reports. The person you report isn’t told who sent it.</Body>
        <View role="radiogroup" aria-label="Reason" style={styles.list}>
          {REPORT_REASONS.map((r) => (
            <Choice key={r.value} label={r.label} detail={r.detail} selected={reason === r.value} onPress={() => setReason(r.value)} />
          ))}
        </View>
        <Field
          label="Details (optional)"
          hint="Anything that helps a moderator understand what's wrong."
          value={details}
          onChangeText={setDetails}
          multiline
          maxLength={1000}
        />
      </>
    );
    footer = (
      <>
        {file.error ? (
          <Caption tone="accent" role="alert">
            {file.error.message}
          </Caption>
        ) : null}
        <Button
          label={file.isPending ? 'Sending…' : 'Send report'}
          disabled={!reason || file.isPending}
          accessibilityHint={reason ? undefined : 'Pick a reason first'}
          onPress={() => reason && file.mutate({ target: picked.target, reason, details })}
        />
      </>
    );
  }

  return (
    <MenuSheet visible onClose={onClose} title={title} footer={footer}>
      {body}
    </MenuSheet>
  );
}

/** A "Report" pill that opens the sheet. Signed in only: reports need an account. */
export function ReportAction({ subject, targets, onMedia }: { subject: string; targets: ReportChoice[]; onMedia?: boolean }) {
  const signedIn = !!useAuth().user;
  const [open, setOpen] = useState(false);
  if (!signedIn || !targets.length) return null;
  return (
    <>
      <GlassButton accessibilityLabel={`Report ${subject}`} label="Report" icon="flag" onMedia={onMedia} onPress={() => setOpen(true)} />
      {open ? <ReportSheet subject={subject} targets={targets} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
