import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, Field, PressableScale, Switch, useDs } from '@/components/ds';
import { ListGroup, ListNote, ListRow, SectionLabel } from '@/components/ds/ListGroup';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useInviteProfile, useSendInviteEmail } from '@/hooks/useBarInvites';
import { usePublicPeople } from '@/hooks/useProfiles';
import { useInviteToRole } from '@/hooks/useTakeover';
import { useMakeTakeoverRole } from '@/hooks/useTakeoverPage';
import { useSetRoleCapability } from '@/hooks/useVenueRoles';
import { ROLE_PRESETS } from '@/lib/roleMatrix';
import { saveErrorWords } from '@/lib/saveErrorWords';
import { accessEnds, defaultAccessEnd, firstName, refusalWords } from '@/lib/takeover';
import { looksLikeEmail } from '@/lib/team';

import type { TakeoverModel } from './useTakeoverModel';

/**
 * Add a guest bartender (Keep-phone addguest): their name, the bar they're
 * from, when their access ends, what they see, and Send (the round check).
 * A name finds people already on the app, as the team's Invite does
 * (usePublicPeople, invite_profile_to_bar: the sender never sees an email);
 * only when it finds nobody is an email asked for. They join the
 * takeover's own role at the host, which ends by itself (invite_to_role); the
 * first one made sets that role up from the Takeover bartender preset. What
 * they see is that role's permissions, so it's the same for every guest on it.
 */
const TAKEOVER_LEVEL = ROLE_PRESETS.find((p) => p.id === 'takeover')!.base_level;
type Seen = 'locations' | 'specs';
const SEEN: Seen[] = ['locations', 'specs'];
const NEW_ROLE: Record<Seen, boolean> = { locations: true, specs: false };

export function AddGuestSheet({ m, visible, onClose, onSent }: { m: TakeoverModel; visible: boolean; onClose: () => void; onSent: (text: string) => void }) {
  const ds = useDs();
  const head = m.head;
  const barId = m.barId;
  const makeRole = useMakeTakeoverRole(head?.id ?? '', barId);
  const invite = useInviteToRole();
  const send = useSendInviteEmail(barId ?? '');
  const addPerson = useInviteProfile(barId ?? '');
  const flip = useSetRoleCapability(barId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);
  const [elsewhere, setElsewhere] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // What they'll see is chosen here and saved at Send (never at the tap): only the switches turned.
  const [draft, setDraft] = useState<Partial<Record<Seen, boolean>>>({});
  // A role already made keeps its own end; only a new one takes the default.
  const ends = m.role?.ends_at ?? (head?.roleId ? null : defaultAccessEnd(head?.startsAt, head?.endsAt));
  const typed = name.trim();
  // One letter isn't a name yet ("I's email"): the lookup starts at two.
  const first = person ? firstName(person.name) : typed.length >= 2 ? firstName(typed) : '';
  // People already on the app by that name (an account each); none asks for an email.
  const search = usePublicPeople(typed && !person ? typed : '');
  const found = (search.data ?? []).filter((p) => p.is_claimed).slice(0, 5);
  const searching = typed.length >= 2 && !person && search.isFetching;
  const askEmail = typed.length >= 2 && !person && !searching && (elsewhere || found.length === 0);
  // The role's own setting once it's read, else a new role's (as drawn: where things live on, the host's specs off).
  const current = (c: Seen) => (m.role ? m.role.capabilities.includes(c) : head?.roleId ? null : NEW_ROLE[c]);
  const sees = (c: Seen) => draft[c] ?? current(c) ?? NEW_ROLE[c];
  const setSees = (c: Seen, on: boolean) => setDraft((d) => ({ ...d, [c]: on }));
  const busy = makeRole.isPending || invite.isPending || addPerson.isPending || send.isPending;

  const close = () => {
    setName('');
    setEmail('');
    setPerson(null);
    setElsewhere(false);
    setDraft({});
    setProblem(null);
    onClose();
  };

  const submit = async () => {
    const to = email.trim().toLowerCase();
    const label = person?.name ?? typed;
    if (typed.length < 2) return setProblem('Add their name.');
    if (searching) return setProblem('Still looking for them on the app. One moment.');
    if (!person && !looksLikeEmail(to)) {
      setElsewhere(true);
      return setProblem(`Add ${first}’s email, for the invite.`);
    }
    if (!head || !barId) return;
    setProblem(null);
    try {
      const made = !head.roleId;
      const roleId = head.roleId ?? (await makeRole.mutateAsync({ endsAt: ends ?? defaultAccessEnd(head.startsAt, head.endsAt), matrix: m.matrix, startsAt: head.startsAt, guestName: m.guestName }));
      // Save the switches: a new role (made with the preset's menu, specs and where things live) takes what they say; a role already made only what was turned.
      for (const c of SEEN) {
        const want = made ? sees(c) : draft[c];
        const had = made ? true : current(c);
        if (want !== undefined && want !== had) await flip.mutateAsync({ roleId, level: m.role?.base_level ?? TAKEOVER_LEVEL, capability: c, on: want });
      }
      const note = m.guestName ? `From ${m.guestName}` : null;
      // Someone already on the host's team is refused by invite_to_role ("They're already on your team"), so nobody's own role is swapped for this one.
      if (person) await addPerson.mutateAsync({ profileId: person.id, roleLevel: TAKEOVER_LEVEL, roleId, note });
      else await invite.mutateAsync({ email: to, roleId, name: typed, note });
    } catch (e) {
      return setProblem(refusalWords(e, saveErrorWords));
    }
    try {
      await send.mutateAsync(person ? { profileId: person.id } : to);
      onSent(ends ? `Invite emailed to ${label}. Access ends ${accessEnds(ends)}.` : `Invite emailed to ${label}.`);
    } catch {
      onSent(`${label} is added, but the email didn’t send. They can still join from your staff link.`);
    }
    close();
  };

  return (
    <MenuSheet visible={visible} onClose={close} title="Add a guest bartender" check={{ label: busy ? 'Sending' : 'Send', onPress: () => void submit(), disabled: busy || searching }}>
      <Field
        label="Name"
        hideLabel
        icon="person"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setPerson(null);
          setElsewhere(false);
        }}
        placeholder="Their name"
        autoComplete="off"
        autoCapitalize="words"
        maxLength={80}
      />
      {person ? (
        <View style={styles.picked}>
          <Body style={styles.grow}>{person.name} is on the app, so the invite also waits for them there.</Body>
          <PressableScale role="button" accessibilityLabel={`Not ${person.name}`} onPress={() => setPerson(null)} style={styles.tap}>
            <Caption tone="accent">Change</Caption>
          </PressableScale>
        </View>
      ) : found.length ? (
        <View role="group" accessibilityLabel="On the app" style={styles.found}>
          <Caption tone="muted">On the app</Caption>
          <View style={styles.chips}>
            {found.map((p) => (
              <Chip key={p.id} selected={false} label={p.current_bar ? `${p.display_name}, ${p.current_bar}` : p.display_name} onPress={() => setPerson({ id: p.id, name: p.display_name })} />
            ))}
          </View>
          {elsewhere ? null : (
            <PressableScale role="button" accessibilityLabel="None of these" onPress={() => setElsewhere(true)} style={styles.tap}>
              <Caption tone="accent">None of these? Use their email</Caption>
            </PressableScale>
          )}
        </View>
      ) : null}
      {askEmail ? (
        <Field label={`${first}’s email`} value={email} onChangeText={setEmail} placeholder="name@example.com" autoComplete="off" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={120} />
      ) : null}
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
  found: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  tap: { minHeight: 44, justifyContent: 'center' },
});
