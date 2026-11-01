import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, GlassButton, Sheet, SheetScrollView, Surface, Title, useDs, type IconName } from '@/components/ds';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space } from '@/constants/tokens';
import type { useHandover } from '@/hooks/useHandover';
import { names, summary, type HandoverLine, type HandoverNote, type HandoverRow } from '@/lib/handover';

import { TonightSection } from './TonightParts';

type Handover = ReturnType<typeof useHandover>;

const first = (h: Handover, note: HandoverNote) => names(note.writers.map((w) => h.nameOf(w.user_id).split(' ')[0]));

/** A note card: an icon, a title and a line under it, and its button (the board's prompt). */
function Prompt({ icon, title, body, action, onPress }: { icon: IconName; title: string; body: string; action: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <View role="region" accessibilityLabel={title} style={[styles.prompt, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.promptHead}>
        <IconSymbol name={icon} size={20} color={ds.accentText} />
        <View style={styles.flex}>
          <DsText variant="label" style={font.semiBold}>
            {title}
          </DsText>
          {body ? <Caption tone="muted">{body}</Caption> : null}
        </View>
      </View>
      <View style={styles.promptActs}>
        <Button label={action} size="sm" onPress={onPress} />
      </View>
    </View>
  );
}

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

/** When someone wrote: "Thu 1:24am". */
const when = (iso: string | null) => (iso ? `${new Date(iso).toLocaleDateString(undefined, { weekday: 'short' })} ${new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '').toLowerCase()}` : '');

/** One person's part of the note: their mark, name, when, and their line for the night. */
export function HandoverMessage({ row, name }: { row: HandoverRow; name: string }) {
  const ds = useDs();
  return (
    <View style={[styles.msg, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={[styles.mark, { backgroundColor: ds.c.raised }]}>
        <DsText variant="body">{name.charAt(0)}</DsText>
      </View>
      <View style={styles.flex}>
        <View style={styles.msgHead}>
          <Caption>{name}</Caption>
          <Caption tone="muted">{when(row.written_at)}</Caption>
        </View>
        {row.note ? <Body>{row.note}</Body> : null}
      </View>
    </View>
  );
}

/** A group of the note's lines: an icon, the thing, a line under it, and Log batch where there is one. Not links. */
function Group({ title, icon, rows, action }: { title: string; icon: IconName; rows: HandoverLine[]; action?: (line: HandoverLine) => React.ReactNode }) {
  const ds = useDs();
  if (!rows.length) return null;
  return (
    <TonightSection title={title}>
      <Surface style={styles.card}>
        {rows.map((line, i) => (
          <View key={`${line.name}-${i}`}>
            {i ? <RowDivider /> : null}
            <View style={styles.line}>
              <IconSymbol name={icon} size={20} color={ds.c.ink} />
              <View style={styles.flex}>
                <Body>{line.name}</Body>
                {line.sub ? <Caption tone="muted">{line.sub}</Caption> : null}
              </View>
              {action?.(line)}
            </View>
          </View>
        ))}
      </Surface>
    </TonightSection>
  );
}

/**
 * The note itself (Loop-handover): who closed and their line, then what ran
 * out, what to prep (with Log batch for house-made), anything broken. Got it
 * marks it read; once read, Add to it. In a sheet on phones, beside Tonight
 * on wide web (Loop-tonight-desk).
 */
export function HandoverView({ h, onGotIt, onAdd, logBatch }: { h: Handover; onGotIt: () => void; onAdd: () => void; logBatch?: (name: string) => (() => void) | null }) {
  const note = h.last;
  if (!note) return null;
  return (
    <View style={styles.view}>
      <View style={styles.msgs}>
        {note.writers.map((w) => (
          <HandoverMessage key={w.user_id} row={w} name={h.nameOf(w.user_id)} />
        ))}
      </View>
      <Group title="What ran out" icon="exclamationmark.triangle" rows={note.ranOut.map((name) => ({ name, sub: null }))} />
      <Group
        title="What to prep"
        icon="drop.fill"
        rows={note.prep}
        action={(line) => {
          const log = logBatch?.(line.name);
          return log ? <Button label="Log batch" size="sm" variant="secondary" accessibilityLabel={`Log a batch of ${line.name}`} onPress={log} /> : null;
        }}
      />
      <Group title="Anything broken" icon="exclamationmark.circle" rows={note.broken} />
      <View style={styles.acts}>
        {h.unread ? <Button label="Got it" onPress={onGotIt} expanded /> : <Button label="Add to it" variant="secondary" onPress={onAdd} expanded />}
        {h.readBy ? (
          <Caption tone="muted" align="center">
            {`${h.readBy}.`}
          </Caption>
        ) : null}
      </View>
    </View>
  );
}

/** The note in a sheet (phones; a centred dialog on the web). */
export function HandoverSheet({ visible, onClose, onDismiss, ...view }: { visible: boolean; onClose: () => void; onDismiss?: () => void } & Parameters<typeof HandoverView>[0]) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      accessibilityLabel="Handover"
      header={
        <View style={styles.sheetHead}>
          <Title role="heading" style={styles.flex}>
            Handover
          </Title>
          <GlassButton accessibilityLabel="Close" icon="xmark" onPress={onClose} />
        </View>
      }
    >
      <SheetScrollView>
        <HandoverView {...view} />
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  prompt: { gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  promptHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  promptActs: { flexDirection: 'row', paddingLeft: space.xl + space.md },
  card: { paddingVertical: space.xs, paddingHorizontal: space.lg, overflow: 'hidden' },
  view: { gap: space.xl, paddingBottom: space.xl },
  msgs: { gap: space.sm },
  msg: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  acts: { gap: space.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
