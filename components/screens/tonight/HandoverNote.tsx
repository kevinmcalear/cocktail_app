import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, GlassButton, Sheet, SheetScrollView, Surface, Title, useDs, type IconName } from '@/components/ds';
import { RowDivider } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import type { useHandover } from '@/hooks/useHandover';
import { useHandoverPhoto } from '@/hooks/useHandoverPhoto';
import type { HandoverLine, HandoverRow } from '@/lib/handover';

import { TonightSection } from './TonightParts';

type Handover = ReturnType<typeof useHandover>;

// The note itself and its sheet. On the web they load when first opened
// (HandoverLazy.web.tsx), so Tonight's first load carries only the card.

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
function Group({ title, icon, rows, action, children }: { title: string; icon: IconName; rows: HandoverLine[]; action?: (line: HandoverLine) => React.ReactNode; children?: React.ReactNode }) {
  const ds = useDs();
  if (!rows.length && !children) return null;
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
      {children}
    </TonightSection>
  );
}

/**
 * The note itself (Loop-handover): who closed and their line, then what ran
 * out, what to prep (with Log batch for house-made), anything broken. Got it
 * marks it read; once read, Add to it. In a sheet on phones, beside Tonight
 * on wide web (Loop-tonight-desk).
 */
export function HandoverView({ h, onGotIt, onAdd, logBatch, ranOutSub, forNight }: { h: Handover; onGotIt: () => void; onAdd: () => void; logBatch?: (name: string) => (() => void) | null; ranOutSub?: (item: string) => string | null; forNight?: string }) {
  const note = h.last;
  if (!note) return null;
  return (
    <View style={styles.view}>
      <View style={styles.msgs}>
        {note.writers.map((w) => (
          <HandoverMessage key={w.user_id} row={w} name={h.nameOf(w.user_id)} />
        ))}
      </View>
      <Group title="What ran out" icon="exclamationmark.triangle" rows={note.ranOut.map((name) => ({ name, sub: ranOutSub?.(name) ?? null }))} />
      <Group
        title="What to prep"
        icon="drop.fill"
        rows={note.prep.map((line) => ({ ...line, sub: [line.sub, forNight && `for ${forNight}`].filter(Boolean).join(', ') || null }))}
        action={(line) => {
          const log = logBatch?.(line.name);
          return log ? <Button label="Log batch" size="sm" variant="secondary" accessibilityLabel={`Log a batch of ${line.name}`} onPress={log} /> : null;
        }}
      />
      <Group title="Anything broken" icon="exclamationmark.circle" rows={note.broken}>
        {note.photos.length ? note.photos.map((p) => <HandoverPhoto key={p} path={p} />) : null}
      </Group>
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

/** A photo of what's broken, from the private handover bucket. */
export function HandoverPhoto({ path }: { path: string }) {
  const ds = useDs();
  const url = useHandoverPhoto(path).data;
  return (
    <View role="img" aria-label="Photo of what's broken" style={[styles.photo, { backgroundColor: ds.c.raised }]}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
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
  card: { paddingVertical: space.xs, paddingHorizontal: space.lg, overflow: 'hidden' },
  view: { gap: space.xl, paddingBottom: space.xl },
  msgs: { gap: space.sm },
  msg: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  msgHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  acts: { gap: space.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  photo: { width: '100%', maxWidth: 360, aspectRatio: 4 / 3, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0 },
});
