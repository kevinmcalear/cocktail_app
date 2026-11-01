import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';

import type { AuthBrand } from '@/components/auth/AuthShell';
import { DoorPage } from '@/components/auth/StaffJoinDoor';
import { Button } from '@/components/ds';
import { useAuth } from '@/ctx/AuthContext';
import { useJoinByStaffLink, useMyJoinRequest, useStaffLinkDoor, useTakeBackJoinRequest } from '@/hooks/useJoinRequests';
import { doorLines, doorState } from '@/lib/staffDoor';

/**
 * The staff link opened by someone signed in who isn't on the team (boards
 * Miss-door, Miss-door-desk). The link's settings decide the door: Ask to
 * join (an Admin approves each one), Asked (with Take back your ask), Join
 * as <role> straight in when nobody approves, or This link is off. Joining
 * calls onJoined, which opens the menu on now.
 */
export function StaffLinkDoor({ slug, barId, brand, onJoined, fallback }: { slug: string; barId: string; brand: AuthBrand; onJoined: () => void; fallback: ReactNode }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const door = useStaffLinkDoor(slug, true);
  const mine = useMyJoinRequest(barId);
  const join = useJoinByStaffLink(slug, onJoined);
  const takeBack = useTakeBackJoinRequest();
  const [now] = useState(Date.now);
  const done = () => router.replace('/');

  const d = door.data;
  // Nothing to show until both are read; a failed read says so, with Try again.
  if (door.isPending || mine.isPending) return fallback;
  if (door.isError || mine.isError) {
    return (
      <DoorPage brand={brand} title="Couldn’t open this link" body="Check your connection and try again.">
        <Button label="Try again" variant="ink" size="lg" onPress={() => void Promise.all([door.refetch(), mine.refetch()])} />
      </DoorPage>
    );
  }
  // The slug changed between reading the bar and reading its door.
  if (!d) {
    return (
      <DoorPage brand={brand} title="Link not found" body="This staff link doesn't match a venue. Ask your manager for a new one.">
        <Button label="Done" variant="secondary" size="lg" onPress={done} />
      </DoorPage>
    );
  }

  const ask = mine.data && !mine.data.declined_at ? mine.data : null;
  const state = doorState({ linkOn: d.link_on, approve: d.approve, asked: !!ask });
  const lines = doorLines(state, { bar: brand.name, me: d.me, admin: d.admin_name, admins: d.admin_count ?? 0, role: d.join_role, askedAt: ask?.created_at ?? null, now });
  const busy = join.isPending || takeBack.isPending;
  const asking = state === 'ask' || state === 'join';

  const primary = asking ? () => join.mutate() : done;
  const secondary = state === 'asked' ? () => takeBack.mutate(barId) : () => void signOut();

  return (
    <DoorPage
      brand={brand}
      title={lines.title}
      body={lines.body}
      // Only the error of what this door offers: an old one doesn't follow them to the next state.
      alert={(asking ? join.error?.message : state === 'asked' ? takeBack.error?.message : null) ?? null}
      note={lines.note ? { icon: lines.noteIcon, text: lines.note } : null}
    >
      {asking ? (
        <Button label={lines.primary} icon="person.badge.plus" variant="ink" size="lg" disabled={busy} onPress={primary} />
      ) : (
        <Button label={lines.primary} variant="secondary" size="lg" onPress={primary} />
      )}
      {lines.secondary ? <Button label={lines.secondary} variant="plain" disabled={busy} onPress={secondary} /> : null}
    </DoorPage>
  );
}
