import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, LockedSection, PressableScale, Tag, TextLink, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useItemComments, useItemVersions, useRestoreVersion, type ItemVersion } from '@/hooks/useVersions';
import { roleLabel } from '@/lib/roles';
import { specDiff, versionLine } from '@/lib/specDiff';

import { TeamNotes } from './TeamNotes';

interface HistorySectionProps {
  itemId: string;
  barId: string | null;
  canEdit: boolean;
  /** Desktop: folded to one row, "Version 3 · 2 Oct · Kevin M. ›", until opened (board drink-desktop). */
  compact?: boolean;
}

/**
 * Spec changes: every save of the spec as a version with what changed in
 * plain words, who and when, with restore for editors, and the team's notes
 * underneath. Versions open with the specs capability (a snapshot holds the
 * amounts); notes with talking points, so the floor can read them. Folded to
 * the latest version and the latest note (board drink-phone-venue) until
 * someone opens the rest. Guests see what changed on the public drink page,
 * when the bar shows it (PublicSpecChanges).
 */
export function HistorySection({ itemId, barId, canEdit, compact = false }: HistorySectionProps) {
  const ds = useDs();
  const { data: capabilities } = useCapabilities(barId);
  const { data: opensAtLevel } = useCapabilityOpensAt(barId, 'specs');
  const unlocked = barId ? !!capabilities?.includes('specs') : canEdit;
  const { data: versions, isPending } = useItemVersions(itemId, unlocked);
  const { data: notes = [] } = useItemComments(itemId, barId, unlocked && !!capabilities?.includes('talking_points'));
  const [open, setOpen] = useState(false);
  if (!barId && !canEdit) return null;
  const latest = versions?.[0];
  const note = notes[notes.length - 1];
  // Versions before the current one; none (not -1) when nothing is saved yet.
  const earlier = Math.max(0, (versions?.length ?? 0) - 1);
  const changes = latest ? specDiff(versions?.[1]?.snapshot ?? null, latest.snapshot) : [];
  const more = [earlier ? `${earlier} earlier version${earlier === 1 ? '' : 's'}` : null, notes.length > 1 ? `${notes.length - 1} more note${notes.length === 2 ? '' : 's'}` : null]
    .filter(Boolean)
    .join(' and ');
  if (compact && unlocked && latest && !open) {
    const summary = `Version ${latest.version} · ${versionLine(latest.created_at, latest.created_by_name)} ›`;
    return (
      <PressableScale role="button" aria-expanded={false} accessibilityLabel={`Spec changes. ${summary.replace(' ›', '')}. Open`} onPress={() => setOpen(true)} style={[styles.row, { borderTopColor: ds.c.line }]}>
        <Headline role="heading">Spec changes</Headline>
        <Caption tone="muted">{summary}</Caption>
      </PressableScale>
    );
  }
  return (
    <LockedSection title="Spec changes" unlocked={unlocked} opensAt={opensAtLevel ? roleLabel(opensAtLevel) : 'Bartender'}>
      {isPending ? <Caption tone="muted">Loading…</Caption> : null}
      {versions && versions.length === 0 ? <Body tone="muted">No changes saved yet. Each save of the spec shows here.</Body> : null}
      {open && versions?.length ? <Versions itemId={itemId} versions={versions} canEdit={canEdit} /> : null}
      {open && barId ? <TeamNotes itemId={itemId} barId={barId} currentVersion={latest?.version ?? null} /> : null}
      {!open && latest ? (
        <View accessible style={[styles.version, { borderLeftColor: ds.accentText }]}>
          <View style={styles.head}>
            <Headline>Version {latest.version}</Headline>
            <Tag label="Current" tone="accent" />
          </View>
          <Caption tone="muted">{versionLine(latest.created_at, latest.created_by_name)}</Caption>
          {/* What changed, as small chips (board drink-phone-venue); the first version has nothing before it. */}
          {versions?.[1] && changes.length ? (
            <View style={styles.changes}>
              {changes.map((c) => (
                <Caption key={c} style={[styles.change, { backgroundColor: ds.c.raised }]}>
                  {c}
                </Caption>
              ))}
            </View>
          ) : (
            <Caption tone="muted">{latest.note || (versions?.[1] ? 'No changes recorded' : 'The first saved spec.')}</Caption>
          )}
        </View>
      ) : null}
      {!open && note ? (
        <View accessible style={styles.note}>
          <Caption tone="muted">{`Team notes · ${note.author_name ?? 'Someone'}${note.version ? ` · v${note.version}` : ''}`}</Caption>
          <Body numberOfLines={3}>{note.body}</Body>
        </View>
      ) : null}
      {!open && (more || barId) && versions ? <TextLink label={more ? `${more} ›` : 'Add a team note ›'} onPress={() => setOpen(true)} /> : null}
    </LockedSection>
  );
}

export function Versions({ itemId, versions, canEdit }: { itemId: string; versions: ItemVersion[]; canEdit: boolean }) {
  const ds = useDs();
  const restore = useRestoreVersion(itemId);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? versions : versions.slice(0, 5);
  return (
    <View style={styles.list}>
      {shown.map((v, i) => {
        const prev = versions[versions.indexOf(v) + 1] ?? null;
        const changes = specDiff(prev?.snapshot ?? null, v.snapshot);
        const latest = i === 0 && versions[0] === v;
        return (
          <View key={v.version} accessible accessibilityLabel={`Version ${v.version}, ${versionLine(v.created_at, v.created_by_name)}${v.note ? `, ${v.note}` : ''}. ${changes.join('. ') || 'No changes recorded'}`} style={[styles.version, { borderLeftColor: latest ? ds.accentText : ds.c.lineStrong }]}>
            <View style={styles.head}>
              <Headline>Version {v.version}</Headline>
              {latest ? <Tag label="Current" tone="accent" /> : null}
            </View>
            <Caption tone="muted">{versionLine(v.created_at, v.created_by_name)}</Caption>
            {v.note ? <Body>{v.note}</Body> : null}
            {changes.length ? (
              <View style={styles.changes}>
                {changes.map((c) => (
                  <Caption key={c} style={[styles.change, { backgroundColor: ds.c.raised }]}>
                    {c}
                  </Caption>
                ))}
              </View>
            ) : prev ? (
              <Caption tone="muted">Same spec as version {prev.version}.</Caption>
            ) : null}
            {canEdit && !latest ? (
              confirm === v.version ? (
                <View style={styles.actions}>
                  <Button label={restore.isPending ? 'Restoring…' : `Restore as version ${versions[0].version + 1}`} disabled={restore.isPending} onPress={() => restore.mutateAsync(v.version).then(() => setConfirm(null), () => {})} />
                  <Button label="Keep the current one" variant="ghost" onPress={() => setConfirm(null)} />
                </View>
              ) : (
                <Button label="Restore" variant="secondary" onPress={() => setConfirm(v.version)} style={styles.restore} />
              )
            ) : null}
          </View>
        );
      })}
      {restore.error ? <Caption tone="accent">{"Couldn't restore. Check your connection and try again."}</Caption> : null}
      {versions.length > 5 && !showAll ? <Button label={`Show all ${versions.length} versions`} variant="ghost" onPress={() => setShowAll(true)} style={styles.restore} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingVertical: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  version: { borderLeftWidth: 2, paddingLeft: space.md, gap: space.xs },
  note: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  changes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  change: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: space.xs, overflow: 'hidden' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  restore: { alignSelf: 'flex-start', marginTop: space.xs },
});
