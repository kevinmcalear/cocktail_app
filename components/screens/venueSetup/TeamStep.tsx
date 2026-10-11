import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Field, GlassButton, PressableScale, useDs } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useSetMemberRole } from '@/hooks/useBarDetail';
import { useSendInviteEmail } from '@/hooks/useBarInvites';
import { plainDbMessage } from '@/lib/dbError';
import { roleLabel } from '@/lib/roles';
import { INVITE_ROLES } from '@/lib/team';
import { inviteRowError, sendInvitesLabel } from '@/lib/venueSetup';

interface Person {
  key: number;
  name: string;
  email: string;
  role: number;
}

const BARTENDER = 30;
const blank = (key: number): Person => ({ key, name: '', email: '', role: BARTENDER });

/** The role button on a person: the role and its line; opens the roles to pick from. */
function RoleButton({ role, onPress }: { role: number; onPress: () => void }) {
  const ds = useDs();
  const line = INVITE_ROLES.find((r) => r.level === role)?.detail ?? '';
  return (
    <PressableScale role="button" aria-haspopup="listbox" accessibilityLabel={`Role: ${roleLabel(role)}. ${line}. Change`} onPress={onPress} style={[styles.role, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <View style={styles.flex}>
        <DsText variant="headline">{roleLabel(role)}</DsText>
        <Caption tone="muted">{line}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * Step 8: invite several people at once (name, email, role each). Each one is
 * saved (add_user_to_bar_by_email) and emailed (send-bar-invite), like the
 * invite sheet on My team. While the claim waits they're held: they join once
 * it's approved.
 */
export function TeamStep({ barId, name, pending, onDone }: { barId: string; name: string; pending: boolean; onDone: (sent: string[]) => void }) {
  const ds = useDs();
  const add = useSetMemberRole(barId);
  const send = useSendInviteEmail(barId);
  const [people, setPeople] = useState<Person[]>([blank(1)]);
  const [picking, setPicking] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const filled = people.filter((p) => p.email.trim() || p.name.trim());
  const set = (key: number, change: Partial<Person>) => setPeople((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const sendAll = async () => {
    setTried(true);
    if (!filled.length || filled.some((p) => inviteRowError(p))) return;
    setBusy(true);
    setProblem(null);
    const sent: string[] = [];
    const sentKeys: number[] = [];
    for (const p of filled) {
      const email = p.email.trim().toLowerCase();
      try {
        const invited = await add.mutateAsync({ email, roleLevel: p.role, name: p.name });
        if (invited) await send.mutateAsync(email).catch(() => undefined);
        sent.push(p.name.trim().split(/\s+/)[0] || email);
        sentKeys.push(p.key);
      } catch (e) {
        setProblem(`${p.name.trim() || email}: ${plainDbMessage(e) ?? 'Couldn’t save that invite.'}`);
        break;
      }
    }
    setBusy(false);
    if (sent.length === filled.length) onDone(sent);
    // The ones that went are off the list; what's left is the one to fix.
    else setPeople((list) => list.filter((p) => !sentKeys.includes(p.key)));
  };

  return (
    <SetupPage footer={<SetupFooter label={busy ? 'Sending…' : sendInvitesLabel(filled.length)} disabled={busy || !filled.length} onPress={() => void sendAll()} skipLabel="Skip for now" onSkip={() => onDone([])} />}>
      {people.map((p, i) => (
        <View key={p.key} role="group" accessibilityLabel={`Person ${i + 1}`} style={[styles.person, { borderColor: ds.c.line }]}>
          <View style={styles.head}>
            <Caption tone="muted">{`Person ${i + 1}`}</Caption>
            {people.length > 1 ? <GlassButton accessibilityLabel={`Remove ${p.name.trim() || `person ${i + 1}`}`} icon="xmark" onPress={() => setPeople((list) => list.filter((x) => x.key !== p.key))} /> : null}
          </View>
          <Field label="Name" value={p.name} onChangeText={(t) => set(p.key, { name: t })} placeholder="Sam Okafor" autoComplete="off" maxLength={80} />
          <Field
            label="Email"
            value={p.email}
            onChangeText={(t) => set(p.key, { email: t })}
            placeholder="sam@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            error={tried && (p.email.trim() || p.name.trim()) ? (inviteRowError(p) ?? undefined) : undefined}
          />
          <Caption tone="muted">Role</Caption>
          <RoleButton role={p.role} onPress={() => setPicking(p.key)} />
        </View>
      ))}
      <Button label="Add another" icon="plus" variant="secondary" onPress={() => setPeople((list) => [...list, blank(Math.max(...list.map((x) => x.key)) + 1)])} />
      {problem ? (
        <Caption tone="accent" role="alert">
          {problem}
        </Caption>
      ) : null}
      <Caption tone="muted">
        {`Admin is everything, including the team. Change anyone’s role later in My team.${pending ? ` Invites go out now; they join ${name} once your claim is approved.` : ''}`}
      </Caption>
      <MenuSheet visible={picking !== null} onClose={() => setPicking(null)} title="Their role">
        <View role="radiogroup" accessibilityLabel="Their role" style={styles.choices}>
          {INVITE_ROLES.map((r) => (
            <Choice
              key={r.level}
              label={roleLabel(r.level)}
              detail={r.detail}
              selected={people.find((p) => p.key === picking)?.role === r.level}
              onPress={() => {
                if (picking !== null) set(picking, { role: r.level });
                setPicking(null);
              }}
            />
          ))}
        </View>
      </MenuSheet>
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  person: { gap: space.sm, padding: space.lg, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  role: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderWidth: 1, borderRadius: radius.control },
  flex: { flex: 1, minWidth: 0 },
  choices: { gap: space.sm },
});
