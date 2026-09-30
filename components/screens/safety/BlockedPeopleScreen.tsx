import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, useDs } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import { useMyBlocks, useSetBlocked, type BlockedPerson } from '@/hooks/useSafety';
import { confirmAsync } from '@/lib/dialogs';

import { BLOCK_EFFECT } from './ProfileSafety';
import { SafetyPage } from './SafetyPage';

/** Settings › Blocked people: everyone I've blocked, and unblock. */
export function BlockedPeopleScreen() {
  const { data: blocks, isLoading, error } = useMyBlocks();
  return (
    <SafetyPage title="Blocked people" intro={BLOCK_EFFECT}>
      {error ? (
        <Body tone="muted">Couldn’t load the people you’ve blocked. Check your connection and try again.</Body>
      ) : isLoading ? (
        <Caption tone="muted">Loading…</Caption>
      ) : blocks?.length ? (
        <View role="list" aria-label="Blocked people">
          {blocks.map((b) => (
            <BlockedRow key={b.blocked_id} person={b} />
          ))}
        </View>
      ) : (
        <Body tone="muted">You haven’t blocked anyone. To block someone, open their profile and tap More.</Body>
      )}
    </SafetyPage>
  );
}

const DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function BlockedRow({ person }: { person: BlockedPerson }) {
  const ds = useDs();
  const setBlocked = useSetBlocked();
  const name = person.display_name ?? 'Someone with a private profile';
  const unblock = async () => {
    const ok = await confirmAsync({
      title: `Unblock ${person.handle ? `@${person.handle}` : 'them'}?`,
      message: "You'll see each other's drinks, rankings and profile again. They aren't told.",
      confirmText: 'Unblock',
    });
    if (ok) setBlocked.mutate({ userId: person.blocked_id, blocked: false });
  };
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <UserAvatar uri={person.avatar_url} name={name} size={40} />
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{name}</Headline>
        <Caption tone="muted">
          {[person.handle ? `@${person.handle}` : null, `Blocked ${DAY.format(new Date(person.blocked_at))}`].filter(Boolean).join(' · ')}
        </Caption>
        {setBlocked.error ? (
          <Caption tone="accent" role="alert">
            Couldn’t unblock. Try again.
          </Caption>
        ) : null}
      </View>
      <Button label={setBlocked.isPending ? 'Unblocking…' : 'Unblock'} variant="secondary" disabled={setBlocked.isPending} onPress={() => void unblock()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
});
