import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useItemPublishing, useSetPublish } from '@/hooks/usePublishing';
import { describePublish, PUBLISH_COPY } from '@/lib/publishing';

import { PublishChoice } from './PublishChoice';

/**
 * "Who can see it" on a drink or ingredient page: what the public sees and
 * where that comes from, and the drink's own override. For people who can
 * publish at its venue, or the creator of a personal drink.
 */
export function PublishSection({ itemId, barId, noun = 'drink' }: { itemId: string; barId: string | null; noun?: string }) {
  const router = useRouter();
  const userId = useAuth().user?.id ?? null;
  const { data: caps = [] } = useCapabilities(barId);
  const { data } = useItemPublishing(itemId, barId);
  const set = useSetPublish(barId);
  const [open, setOpen] = useState(false);

  if (!data || !(barId ? caps.includes('publish') : !!userId && data.createdBy === userId)) return null;
  return (
    <View style={styles.section}>
      <Headline role="heading">Who can see it</Headline>
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
      <View style={styles.actions}>
        <Button label={open ? 'Done' : 'Change'} variant="secondary" onPress={() => setOpen(!open)} />
        {barId ? <Button label="Venue settings" variant="ghost" onPress={() => router.push(`/settings/bar/${barId}/publishing`)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
