import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, GlassButton, Headline } from '@/components/ds';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import type { Profile } from '@/hooks/useProfiles';
import { useMyBlocks, useProfileUserId, useSetBlocked } from '@/hooks/useSafety';
import { parseProfileRef } from '@/lib/profiles';

import { ReportSheet } from './ReportSheet';

export const BLOCK_EFFECT = "You won't see each other's drinks, rankings or profile. They aren't told you blocked them.";

/**
 * "More" on someone else's profile: report it, and for a person, block
 * them. Signed in only. Bars can be reported but not blocked: blocks are
 * between people.
 */
export function ProfileSafety({ profile }: { profile: Profile }) {
  const { user } = useAuth();
  const { data: userId } = useProfileUserId(profile.kind === 'person' ? profile.id : null);
  const [sheet, setSheet] = useState<'menu' | 'report' | 'block' | null>(null);
  const setBlocked = useSetBlocked();
  // Not on my own profile, or on a private one (only its owners see those).
  if (!user || userId === user.id || !profile.is_public) return null;
  const name = `@${profile.handle}`;
  const canBlock = profile.kind === 'person' && !!userId;

  return (
    <>
      <GlassButton accessibilityLabel={`More for ${name}: report or block`} icon="ellipsis" onPress={() => setSheet('menu')} />
      {sheet === 'menu' ? (
        <MenuSheet visible onClose={() => setSheet(null)} title={profile.display_name} subtitle={name}>
          <Button label={`Report ${name}`} icon="flag" variant="secondary" onPress={() => setSheet('report')} />
          {canBlock ? <Button label={`Block ${name}`} variant="secondary" onPress={() => setSheet('block')} /> : null}
        </MenuSheet>
      ) : null}
      {sheet === 'report' ? (
        <ReportSheet subject={name} targets={[{ label: name, target: { kind: 'profile', profileId: profile.id } }]} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'block' && userId ? (
        <MenuSheet
          visible
          onClose={() => setSheet(null)}
          title={`Block ${name}?`}
          footer={
            <>
              {setBlocked.error ? (
                <Caption tone="accent" role="alert">
                  Couldn’t block them. Check your connection and try again.
                </Caption>
              ) : null}
              <Button
                label={setBlocked.isPending ? 'Blocking…' : `Block ${name}`}
                disabled={setBlocked.isPending}
                onPress={() => setBlocked.mutate({ userId, blocked: true }, { onSuccess: () => setSheet(null) })}
              />
            </>
          }
        >
          <Body>{BLOCK_EFFECT}</Body>
          <Body tone="muted">You can unblock them any time from Settings, under Blocked people.</Body>
        </MenuSheet>
      ) : null}
    </>
  );
}

/**
 * Shown on a profile link to someone I've blocked (their profile is hidden
 * from me), so it doesn't look like it vanished, and it can be undone here.
 * Anyone else's missing profile shows `children`.
 */
export function BlockedProfileNote({ profileRef, children }: { profileRef: string | string[] | undefined; children: ReactNode }) {
  const router = useRouter();
  const ref = parseProfileRef(profileRef);
  const { data: blocks } = useMyBlocks();
  const setBlocked = useSetBlocked();
  const blocked = ref && blocks?.find((b) => ('id' in ref ? b.profile_id === ref.id : b.handle === ref.handle));
  if (!blocked) return <>{children}</>;
  const name = blocked.handle ? `@${blocked.handle}` : 'this person';
  return (
    <View style={styles.note} role="status">
      <Headline role="heading">{`You blocked ${name}`}</Headline>
      <Body>{BLOCK_EFFECT}</Body>
      {setBlocked.error ? (
        <Caption tone="accent" role="alert">
          Couldn’t unblock them. Check your connection and try again.
        </Caption>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={setBlocked.isPending ? 'Unblocking…' : `Unblock ${name}`}
          variant="secondary"
          disabled={setBlocked.isPending}
          onPress={() => setBlocked.mutate({ userId: blocked.blocked_id, blocked: false })}
        />
        <Button label="Blocked people" variant="ghost" onPress={() => router.push('/settings/blocked')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { gap: space.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
