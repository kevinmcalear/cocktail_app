import { StyleSheet } from 'react-native';

import { Surface } from '@/components/ds';
import { SettingsRow } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import type { useHandover } from '@/hooks/useHandover';
import { names, summary, type HandoverNote } from '@/lib/handover';

import { Prompt, TonightSection } from './TonightParts';

type Handover = ReturnType<typeof useHandover>;

const first = (h: Handover, note: HandoverNote) => names(note.writers.map((w) => h.nameOf(w.user_id).split(' ')[0]));

/** The last close's note, on top of Tonight until you've read it (Loop-handover). */
export function HandoverCard({ h, onRead }: { h: Handover; onRead: () => void }) {
  if (!h.last || !h.unread) return null;
  return <Prompt icon="bubble.left" title={`Handover from ${first(h, h.last)}`} body={summary(h.last)} action="Read it" onPress={onRead} />;
}

/** Once read, and during service, the note sits at the end: "From Ana · Read by you and Theo". */
export function HandoverSection({ h, onOpen }: { h: Handover; onOpen: () => void }) {
  if (h.isError)
    return (
      <TonightSection title="Handover">
        <Surface style={styles.card}>
          <SettingsRow icon="exclamationmark.triangle" label="The handover didn’t load" detail="Try again" onPress={() => void h.refetch()} />
        </Surface>
      </TonightSection>
    );
  if (!h.last || h.unread) return null;
  return (
    <TonightSection title="Handover">
      <Surface style={styles.card}>
        <SettingsRow icon="bubble.left" label={`From ${first(h, h.last)}`} detail={h.readBy ?? 'Nobody else has read it yet'} onPress={onOpen} />
      </Surface>
    </TonightSection>
  );
}

/** After close: leave a note for whoever opens next ("Leave the handover"). */
export function LeaveHandover({ h, night, onWrite }: { h: Handover; night: string; onWrite: () => void }) {
  const mine = h.tonightNote?.writers.some((w) => w.user_id === h.me);
  if (mine) return <Prompt icon="bubble.left" title="Handover left" body={`For whoever opens ${night}. It sits on top of Tonight until they’ve read it.`} action="Change it" onPress={onWrite} />;
  return <Prompt icon="bubble.left" title="Leave the handover" body={`One note for whoever opens ${night}: what ran out, what to prep, anything broken.`} action="Write it" onPress={onWrite} />;
}

const styles = StyleSheet.create({
  card: { paddingVertical: space.xs, paddingHorizontal: space.lg, overflow: 'hidden' },
});
