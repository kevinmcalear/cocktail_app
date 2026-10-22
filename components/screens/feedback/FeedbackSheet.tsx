import Constants from 'expo-constants';
import { usePathname } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button, Caption, Field, useDs } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BRAND } from '@/constants/brand';
import { radius, space } from '@/constants/tokens';
import { useSendFeedback } from '@/hooks/useFeedback';
import { canSend, deviceLine, FEEDBACK_MAX, feedbackEmail, feedbackRow, PROBLEM_KINDS, sentWithLine, type FeedbackKind, type FeedbackPlace } from '@/lib/feedback';
import { toastDone } from '@/lib/toast';

interface FeedbackSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 'different': what do you do differently (Tell us). 'problem': Report a problem. */
  mode: 'different' | 'problem';
  /** Where it was opened: shown as "Sent with", and stored with the note. */
  place: FeedbackPlace;
}

/**
 * The one sheet for telling us something (wave 2 board, fix 16): "Doing
 * something different? Tell us" under the ice, method and technique lists,
 * and Report a problem. It says what goes with the note (the screen, the
 * drink, the bar), stores it in the feedback table for the Cocktail team, and
 * offers an email only if that fails.
 */
export function FeedbackSheet({ visible, onClose, mode, place }: FeedbackSheetProps) {
  const route = usePathname();
  const send = useSendFeedback();
  const [kind, setKind] = useState<FeedbackKind | null>(mode === 'different' ? 'different' : null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const different = mode === 'different';
  const device = deviceLine(Constants.expoConfig?.version, Platform.OS, Platform.Version);

  const close = () => {
    setKind(different ? 'different' : null);
    setBody('');
    setError(null);
    send.reset();
    onClose();
  };

  const submit = () => {
    if (!kind || !canSend(kind, body)) return;
    setError(null);
    send.mutate(feedbackRow(kind, body, place, route, device), {
      onSuccess: () => {
        close();
        toastDone('Sent. Thank you', different ? 'We’ll tell you when it’s in.' : 'A person reads every one.');
      },
      onError: (e) => setError(e.message),
    });
  };

  const email = () => {
    const { subject, body: text } = feedbackEmail(BRAND.productName, kind ?? 'other', body, place, device);
    void Linking.openURL(`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`).catch(() =>
      setError(`No email app opened. Email ${BRAND.supportEmail} and tell us what happened.`)
    );
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={close}
      eyebrow={different ? 'Tell us' : undefined}
      title={different ? 'What do you do differently?' : 'Report a problem'}
      footer={
        <View style={styles.footer}>
          {error ? (
            <Caption tone="accent" role="alert">
              {error}
            </Caption>
          ) : null}
          <Button label={send.isPending ? 'Sending…' : 'Send'} disabled={!canSend(kind, body) || send.isPending} onPress={submit} />
          {/* ponytail: the email only once storing the note has failed; the table is the way in. */}
          {error ? <Button label="Email us instead" variant="ghost" icon="envelope" onPress={email} /> : null}
        </View>
      }
    >
      {different ? (
        <SentWith line={sentWithLine(place)} />
      ) : (
        <View role="radiogroup" aria-label="What kind of problem" style={styles.kinds}>
          {PROBLEM_KINDS.map((k) => (
            <Choice key={k.id} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
          ))}
        </View>
      )}
      <Field
        label={different ? 'What you do' : 'What happened (optional)'}
        placeholder={different ? 'We cut graduated blocks that stack in a column to fit the glass.' : undefined}
        value={body}
        onChangeText={setBody}
        multiline
        minLines={different ? 4 : 3}
        maxLength={FEEDBACK_MAX}
      />
      {different ? <Caption tone="muted">Only the Cocktail team sees this. We’ll tell you when it’s in.</Caption> : <Caption tone="muted">{`Sent with: ${sentWithLine(place, true)}`}</Caption>}
    </MenuSheet>
  );
}

/** "Sent with: Adding a drink › Ice · Ash Garden · Little Rye", on a raised strip. */
function SentWith({ line }: { line: string }) {
  const ds = useDs();
  return (
    <View style={[styles.sentWith, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="bubble.left" size={16} color={ds.c.muted} />
      <Caption tone="muted" style={styles.flex}>{`Sent with: ${line}`}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sentWith: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingVertical: space.sm + 2, paddingHorizontal: space.md + 2, borderRadius: radius.control, borderCurve: 'continuous' },
  flex: { flex: 1 },
});
