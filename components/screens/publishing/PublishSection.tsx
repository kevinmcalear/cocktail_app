import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline, LockedSection } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useItemPublishing, useSetPublish } from '@/hooks/usePublishing';
import { describePublish, PUBLISH_COPY } from '@/lib/publishing';
import { roleLabel } from '@/lib/roles';

import { PublishChoice } from './PublishChoice';

/**
 * "Who can see it" on a drink or ingredient page: what the public sees and
 * where that comes from, and the drink's own override. For people who can
 * publish at its venue, or the creator of a personal drink. With `showLocked`
 * (the venue's own team on a drink page), everyone else sees it as a locked
 * "Publishing" row that says who opens it. A drink page reads it (`read`: no
 * Change) and its editor sets it (`edit`: the choice open, board drink-read-and-edit).
 */
export function PublishSection({ itemId, barId, noun = 'drink', showLocked, mode }: { itemId: string; barId: string | null; noun?: string; showLocked?: boolean; mode?: 'read' | 'edit' }) {
  const router = useRouter();
  const userId = useUserId();
  const { data: caps = [], isSuccess: capsLoaded } = useCapabilities(barId);
  const { data } = useItemPublishing(itemId, barId);
  const set = useSetPublish(barId);
  const [opened, setOpen] = useState(false);
  const open = mode === 'edit' || opened;
  const { data: opensAt } = useCapabilityOpensAt(showLocked ? barId : null, 'publish');

  if (showLocked && barId && capsLoaded && !caps.includes('publish')) {
    return (
      <LockedSection title="Publishing" unlocked={false} opensAt={opensAt ? roleLabel(opensAt) : 'Admin'}>
        {null}
      </LockedSection>
    );
  }
  if (!data || !(barId ? caps.includes('publish') : !!userId && data.createdBy === userId)) return null;
  return (
    <View style={styles.section}>
      {mode === 'edit' ? null : <Headline role="heading">Who can see it</Headline>}
      <Body tone="muted">
        {describePublish(data.mode, data.source)}. {PUBLISH_COPY[data.mode].detail}
      </Body>
      {open ? (
        <PublishChoice
          label={`Who can see this ${noun}`}
          // A personal drink has nothing to follow: no setting is private.
          value={barId ? data.own : (data.own ?? 'private')}
          inherited={barId ? data.inherited : undefined}
          disabled={set.isPending}
          error={set.error?.message}
          onChange={(mode) => set.mutate({ level: 'item', id: itemId, mode })}
        />
      ) : null}
      {mode === 'read' ? null : (
        <View style={styles.actions}>
          {mode === 'edit' ? null : <Button label={open ? 'Done' : 'Change'} variant="secondary" onPress={() => setOpen(!open)} />}
          {barId ? <Button label="Venue settings" variant="ghost" onPress={() => router.push(`/settings/bar/${barId}/publishing`)} /> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
