import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Field, Switch, useDs } from '@/components/ds';
import { ListGroup, ListNote, ListRow, SectionLabel } from '@/components/ds/ListGroup';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useSendInviteEmail } from '@/hooks/useBarInvites';
import { useInviteToRole } from '@/hooks/useTakeover';
import { useMakeTakeoverRole } from '@/hooks/useTakeoverPage';
import { useSetRoleCapability } from '@/hooks/useVenueRoles';
import { plainDbMessage } from '@/lib/dbError';
import { ROLE_PRESETS } from '@/lib/roleMatrix';
import { accessEnds, defaultAccessEnd, firstName } from '@/lib/takeover';
import { looksLikeEmail } from '@/lib/team';

import type { TakeoverModel } from './useTakeoverModel';

/**
 * Add a guest bartender (Keep-phone addguest): their name, the bar they're
 * from, when their access ends, what they see, and Send. They join the
 * takeover's own role at the host, which ends by itself (invite_to_role); the
 * first one made sets that role up from the Takeover bartender preset. What
 * they see is that role's permissions, so it's the same for every guest on it.
 */
const TAKEOVER_LEVEL = ROLE_PRESETS.find((p) => p.id === 'takeover')!.base_level;

export function AddGuestSheet({ m, visible, onClose, onSent }: { m: TakeoverModel; visible: boolean; onClose: () => void; onSent: (text: string) => void }) {
  const ds = useDs();
  const head = m.head;
  const barId = m.barId;
  const makeRole = useMakeTakeoverRole(head?.id ?? '', barId);
  const invite = useInviteToRole();
  const send = useSendInviteEmail(barId ?? '');
  const flip = useSetRoleCapability(barId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  // Before the role exists, what they'll see is chosen here and saved with it.
  const [draft, setDraft] = useState({ locations: true, specs: true });
  // A role already made keeps its own end; only a new one takes the default.
  const ends = m.role?.ends_at ?? (head?.roleId ? null : defaultAccessEnd(head?.startsAt, head?.endsAt));
  const first = firstName(name);
  const sees = (c: 'locations' | 'specs') => (m.role ? m.role.capabilities.includes(c) : draft[c]);
  const setSees = (c: 'locations' | 'specs', on: boolean) => {
    if (m.role) flip.mutate({ roleId: m.role.role_id, level: m.role.base_level, capability: c, on });
    else setDraft((d) => ({ ...d, [c]: on }));
  };
  const busy = makeRole.isPending || invite.isPending || send.isPending;

  const close = () => {
    setName('');
    setEmail('');
    setProblem(null);
    onClose();
  };

  const submit = async () => {
    const to = email.trim().toLowerCase();
    if (!name.trim()) return setProblem('Add their name.');
    if (!looksLikeEmail(to)) return setProblem(`Add ${firstName(name)}’s email, for the invite.`);
    if (!head || !barId) return;
    setProblem(null);
    try {
      const roleId = head.roleId ?? (await makeRole.mutateAsync({ endsAt: ends ?? defaultAccessEnd(head.startsAt, head.endsAt), matrix: m.matrix }));
      // The switches were the draft until the role was read back: save what they say (a retry included).
      if (!m.role) {
        for (const c of ['locations', 'specs'] as const) {
          if (!draft[c]) await flip.mutateAsync({ roleId, level: TAKEOVER_LEVEL, capability: c, on: false });
        }
      }
      await invite.mutateAsync({ email: to, roleId, name: name.trim(), note: m.guestName ? `From ${m.guestName}` : null });
    } catch (e) {
      return setProblem(plainDbMessage(e) ?? 'Couldn’t add them. Check your connection and try again.');
    }
    try {
      await send.mutateAsync(to);
      onSent(ends ? `Invite emailed to ${name.trim()}. Access ends ${accessEnds(ends)}.` : `Invite emailed to ${name.trim()}.`);
    } catch {
      onSent(`${name.trim()} is added, but the email didn’t send. They can still join from your staff link.`);
    }
    close();
  };

  return (
    <MenuSheet visible={visible} onClose={close} title="Add a guest bartender" save={{ label: busy ? 'Sending…' : 'Send', onPress: () => void submit(), disabled: busy }}>
      <Field label="Name" hideLabel icon="person" value={name} onChangeText={setName} placeholder="Their name" autoCapitalize="words" maxLength={80} />
      <Field label={first ? `${first}’s email` : 'Email'} value={email} onChangeText={setEmail} placeholder="name@example.com" autoComplete="off" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={120} />
      <ListGroup>
        <ListRow first title="From" value={m.guestName ?? 'Their bar'} />
        <ListRow title="Access ends" value={accessEnds(ends) ?? 'With the takeover'} />
      </ListGroup>
      <View style={styles.label}>
        <SectionLabel title={first ? `${first} sees` : 'They see'} />
      </View>
      <ListGroup>
        <ListRow first title="This takeover’s lists and specs" end={<Switch label="This takeover’s lists and specs" value onValueChange={() => {}} disabled />} />
        <ListRow title="Where things live" end={<Switch label="Where things live" value={sees('locations')} onValueChange={(on) => setSees('locations', on)} />} />
        <ListRow title={`${m.hostName}’s own specs`} end={<Switch label={`${m.hostName}’s own specs`} value={sees('specs')} onValueChange={(on) => setSees('specs', on)} />} />
      </ListGroup>
      {problem ? (
        <Caption color={ds.accentText} role="alert">
          {problem}
        </Caption>
      ) : null}
      <ListNote icon="clock" text={`Access ends by itself. ${first ? `${first}’s drinks stay credited to ${first}` : 'Their drinks stay credited to them'}.`} />
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  label: { paddingTop: space.sm },
});
