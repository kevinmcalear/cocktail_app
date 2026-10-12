import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { BRAND } from '@/constants/brand';
import { space } from '@/constants/tokens';

const KINDS = [
  { id: 'broken', label: 'Something’s broken', detail: 'A button does nothing, an error, a crash' },
  { id: 'wrong', label: 'Something looks wrong', detail: 'Cut-off words, wrong colours, a jumbled screen' },
  { id: 'slow', label: 'It’s slow', detail: 'Screens that take a long time to load' },
  { id: 'data', label: 'Wrong information', detail: 'A drink, bar or spec that isn’t right' },
  { id: 'other', label: 'Something else', detail: 'Tell us in the details' },
] as const;

type Kind = (typeof KINDS)[number]['id'];

/** The email that goes to support: what happened, plus the app version and device so it can be found. */
export function problemEmail(kind: Kind, details: string): { subject: string; body: string } {
  const label = KINDS.find((k) => k.id === kind)?.label ?? 'A problem';
  const version = Constants.expoConfig?.version ?? 'unknown';
  const body = [details.trim() || '(No details)', '', '---', `App ${version} on ${Platform.OS} ${String(Platform.Version ?? '')}`.trim()].join('\n');
  return { subject: `${BRAND.productName}: ${label}`, body };
}

/**
 * Report a problem with the app (decided 10 Oct, b64), under Help and
 * support: what kind, what happened, then it opens an email to support with
 * the app version and device filled in. Nothing is sent until the person
 * sends that email.
 *
 * ponytail: email, not a table. Upgrade path: a problem_reports table (a
 * gated migration) with a moderator inbox beside Reports, when email stops
 * being enough.
 */
export function ReportProblemSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [details, setDetails] = useState('');
  const [failed, setFailed] = useState(false);

  const close = () => {
    setKind(null);
    setDetails('');
    setFailed(false);
    onClose();
  };

  const send = async () => {
    if (!kind) return;
    const { subject, body } = problemEmail(kind, details);
    const url = `mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
      close();
    } catch {
      setFailed(true);
    }
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={close}
      title="Report a problem"
      footer={
        <View style={styles.footer}>
          {failed ? (
            <Caption tone="accent" role="alert">{`No email app opened. Email ${BRAND.supportEmail} and tell us what happened.`}</Caption>
          ) : null}
          <Button label="Write the email" icon="envelope" disabled={!kind} onPress={() => void send()} />
          <Caption tone="muted" align="center">{kind ? 'It opens your email app with this filled in. A person reads every one.' : 'Pick what kind of problem first.'}</Caption>
        </View>
      }
    >
      <Body>What went wrong? It helps us find it and fix it.</Body>
      <View role="radiogroup" aria-label="What kind of problem" style={styles.list}>
        {KINDS.map((k) => (
          <Choice key={k.id} label={k.label} detail={k.detail} selected={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </View>
      <Field
        label="What happened (optional)"
        hint="Which screen, what you tapped, what you expected. The app version and device are added for you."
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={2000}
      />
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  footer: { gap: space.sm },
});
