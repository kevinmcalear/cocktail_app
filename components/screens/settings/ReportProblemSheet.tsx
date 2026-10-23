import { Linking } from 'react-native';

import { NoteSheet, REPORT_KINDS, type ReportKind } from '@/components/feedback/NoteSheet';
import { BRAND } from '@/constants/brand';
import { appAndDevice } from '@/hooks/useSendNote';

/** The email for Email us instead: what happened, plus the app version and device so it can be found. */
export function problemEmail(kind: ReportKind, details: string): { subject: string; body: string } {
  const label = REPORT_KINDS.find((k) => k.id === kind)?.label ?? 'A problem';
  const { app_version, device } = appAndDevice();
  const body = [details.trim() || '(No details)', '', '---', `App ${app_version} on ${device}`].join('\n');
  return { subject: `${BRAND.productName}: ${label}`, body };
}

const ABOUT = { screen: 'Settings › Report a problem' };

/**
 * Report a problem, under Help and support: what kind, what happened, and
 * Send stores it for the Cocktail team with the app version and device, on
 * the same sheet and store as Tell us (Eddie wave 2, fix 16). Email us
 * instead opens an email with the same things filled in.
 */
export function ReportProblemSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // Resolves to what to say when no email app opened, else null.
  const onEmail = async (kind: ReportKind, details: string) => {
    const { subject, body } = problemEmail(kind, details);
    const url = `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
      return null;
    } catch {
      return `No email app opened. Email ${BRAND.supportEmail} and tell us what happened.`;
    }
  };
  return <NoteSheet visible={visible} onClose={onClose} about={ABOUT} report={{ onEmail }} />;
}
