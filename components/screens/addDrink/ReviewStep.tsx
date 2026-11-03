import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { notesArePrivate, type WizardDraft } from '@/lib/drinkWizard';
import { notesLevelLabel } from '@/lib/notesReaders';
import { capitalizeFirst } from '@/lib/stringUtils';
import { isRiff } from '@/lib/lineage';


export function credits(d: WizardDraft, hasProfile: boolean, aliases: readonly string[] | undefined): string {
  const by = d.creator === 'nobody' ? '' : typeof d.creator === 'object' && d.creator ? `By ${d.creator.name}` : hasProfile ? 'By you' : '';
  const withThem = d.coCreators.length ? `with ${d.coCreators.map((c) => c.name).join(', ')}` : '';
  // The bar's own Americano is a version of it, not a riff (dec-21). Yours when you're the one credited.
  const version = by === 'By you' && !withThem ? 'your version' : 'a version';
  const riff = d.riffOf ? (isRiff(d, { name: d.riffOf.name, aliases }) ? `riff on ${d.riffOf.name}` : `${version} of the ${d.riffOf.name}`) : '';
  const where = [d.place ? `first made at ${d.place.name}` : '', d.originYear ? `in ${d.originYear}` : ''].filter(Boolean).join(' ');
  return capitalizeFirst([[by, withThem].filter(Boolean).join(' '), where, riff].filter(Boolean).join(', '));
}

/** The notes as Review says them, with who reads them when that isn't everyone (E29). */
export function notesLine(draft: WizardDraft, barId: string | null): string {
  const notes = draft.notes.trim();
  if (!notes) return '';
  if (notesArePrivate(draft, barId)) return `Just me: ${notes}`;
  return barId && draft.notesLevel ? `${notesLevelLabel(draft.notesLevel)}: ${notes}` : notes;
}

/** Every answer on one screen; tap a row to go back and change it. */
export function ReviewList({ rows, onJump, after }: { rows: { key: string; label: string; value: string; note?: string | null }[]; onJump: (key: string) => void; after?: string }) {
  return (
    <View role="list">
      {rows.map((r) => (
        <AnswerRow key={r.key} label={r.label} value={r.value} note={r.note} onPress={() => onJump(r.key)} />
      ))}
      {after ? (
        <Caption tone="muted" style={styles.after}>
          {after}
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * One answer on a review step: its label and value, with a pencil; a tap goes
 * back to change it. With no `onPress` it's just the answer, to read.
 */
export function AnswerRow({
  label,
  value,
  note,
  onPress,
  hint = 'Goes back to change it',
  opens = false,
}: {
  label: string;
  value: string;
  /** Under the value with a clock: something still to happen ("We'll ask Sam first."). */
  note?: string | null;
  onPress?: () => void;
  hint?: string;
  /** It goes somewhere rather than changing the answer: a chevron, not a pencil. */
  opens?: boolean;
}) {
  const ds = useDs();
  if (!onPress) {
    return (
      <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
        <View style={styles.text}>
          <Caption tone="muted">{label}</Caption>
          <Body selectable>{value}</Body>
        </View>
      </View>
    );
  }
  return (
    <PressableScale
      role="button"
      accessibilityLabel={`${label}: ${value || 'not added'}${note ? `. ${note}` : ''}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.text}>
        <Caption tone="muted">{label}</Caption>
        <Body tone={value ? 'ink' : 'muted'}>{value || 'Not added'}</Body>
        {note ? (
          <View style={styles.note}>
            <IconSymbol name="clock" size={14} color={ds.c.muted} />
            <Caption tone="muted">{note}</Caption>
          </View>
        ) : null}
      </View>
      <IconSymbol name={opens ? 'chevron.right' : 'pencil'} size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  review: { gap: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  after: { marginTop: space.lg },
  cost: { marginTop: space.xl, gap: space.lg },
});
