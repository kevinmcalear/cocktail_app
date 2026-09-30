import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useAddComment, useDeleteComment, useItemComments } from '@/hooks/useVersions';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { plainDbMessage } from '@/lib/dbError';

import { ReportAction } from '../safety/ReportSheet';

interface TeamNotesProps {
  itemId: string;
  barId: string;
  /** The version a new note is written about. */
  currentVersion: number | null;
}

/** bars' Admin level: deletes anyone's note. */
const ADMIN = 40;

/**
 * The team's thread on a drink: R&D notes tied to the version they were
 * written about. Venue-only, for Employee and up; you delete your own, an
 * Admin deletes any, and anyone can report one. The content filter screens
 * the text on the server.
 */
export function TeamNotes({ itemId, barId, currentVersion }: TeamNotesProps) {
  const ds = useDs();
  const userId = useAuth().user?.id ?? null;
  const role = useEffectiveRole(barId);
  const { data: capabilities } = useCapabilities(barId);
  const canRead = !!capabilities?.includes('talking_points');
  const { data: notes, isPending } = useItemComments(itemId, barId, canRead);
  const add = useAddComment(itemId, barId);
  const remove = useDeleteComment(itemId);
  const [draft, setDraft] = useState('');
  if (!canRead) return null;
  const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  return (
    <View style={styles.block}>
      <Headline>Team notes</Headline>
      {isPending ? <Caption tone="muted">Loading…</Caption> : null}
      {notes && notes.length === 0 ? <Body tone="muted">Nothing yet. What did the team learn from this spec?</Body> : null}
      {notes?.map((n) => (
        <View key={n.id} style={[styles.note, { borderBottomColor: ds.c.line }]}>
          <View style={styles.noteHead}>
            <Caption>
              {n.author_name ?? 'Someone'}
              <Caption tone="muted">
                {' '}
                {n.version ? `v${n.version} · ` : ''}
                {when(n.created_at)}
                {n.updated_at ? ' · edited' : ''}
              </Caption>
            </Caption>
            {n.author_id === userId || role >= ADMIN ? (
              <PressableScale accessibilityLabel="Delete this note" onPress={() => remove.mutate(n.id)} style={styles.delete}>
                <IconSymbol name="trash" size={16} color={ds.c.muted} />
              </PressableScale>
            ) : (
              <ReportAction subject="this note" targets={[{ label: `Note by ${n.author_name ?? 'someone'}`, target: { kind: 'comment', commentId: n.id } }]} />
            )}
          </View>
          <Body>{n.body}</Body>
        </View>
      ))}
      <Field label={currentVersion ? `Add a note about version ${currentVersion}` : 'Add a note'} value={draft} onChangeText={setDraft} placeholder="Saline fixed the flat finish." multiline maxLength={2000} />
      {add.error ? <Caption tone="accent">{plainDbMessage(add.error) ?? "Couldn't post the note. Check your connection and try again."}</Caption> : null}
      <Button
        label={add.isPending ? 'Posting…' : 'Add a note'}
        variant="secondary"
        disabled={add.isPending || !draft.trim()}
        onPress={() => add.mutateAsync({ body: draft, version: currentVersion }).then(() => setDraft(''), () => {})}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm, marginTop: space.lg },
  note: { gap: space.xs, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  noteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  delete: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  button: { alignSelf: 'flex-start' },
});
