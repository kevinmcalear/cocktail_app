import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Button, Caption, Field, Segmented } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { SetupFooter, SetupPage } from '@/components/screens/onboarding/SetupPage';
import { InvitePreview } from '@/components/screens/team/InvitePreview';
import { space } from '@/constants/tokens';
import { useSetMemberRole } from '@/hooks/useBarDetail';
import { useSaveWelcomeMessage, useSenderName, useSendInviteEmail, useWelcomeMessage } from '@/hooks/useBarInvites';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { plainDbMessage } from '@/lib/dbError';
import { roleLabel } from '@/lib/roles';
import { INVITE_ROLES, WELCOME_MAX, welcomeSuggestion } from '@/lib/team';
import { inviteRowError, sendInvitesLabel } from '@/lib/venueSetup';

import { blankPerson, firstName, TeamPerson, type Person } from './TeamPerson';

/**
 * Your team, the last row of the checklist (invite-team-last, step 3): one
 * welcome message for everyone, kept on the venue for later invites and
 * filled in with a suggestion until it's first saved (call 3), then each
 * person with an optional note. Each one is saved (add_user_to_bar_by_email)
 * and emailed (send-bar-invite), like the invite sheet on My team. On wide
 * web the email shows beside the form as you type; on a phone, behind
 * Preview. While the claim waits they're held: they join once it's approved.
 */
export function TeamStep({ barId, name, pending, onDone }: { barId: string; name: string; pending: boolean; onDone: (sent: string[]) => void }) {
  const wide = useIsWideWeb();
  const add = useSetMemberRole(barId);
  const send = useSendInviteEmail(barId);
  const saved = useWelcomeMessage(barId);
  const saveWelcome = useSaveWelcomeMessage(barId);
  const sender = useSenderName();
  const [people, setPeople] = useState<Person[]>([blankPerson(1)]);
  // Null until they type: the saved message, else the suggestion.
  const [edited, setEdited] = useState<string | null>(null);
  const welcome = edited ?? saved.data ?? welcomeSuggestion(name);
  const [picking, setPicking] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const filled = people.filter((p) => p.email.trim() || p.name.trim());
  const set = (key: number, change: Partial<Person>) => setPeople((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));
  // Return moves on: name to email, email to the next person's name (E13).
  const inputs = useRef(new Map<string, ComponentRef<typeof TextInput>>());
  const hold = (id: string) => (el: ComponentRef<typeof TextInput> | null) => {
    if (el) inputs.current.set(id, el);
    else inputs.current.delete(id);
  };
  // Wide web shows one person's email beside the form: the one picked, else the first.
  const shown = people.find((p) => p.key === previewing) ?? people[0];

  const sendAll = async () => {
    setTried(true);
    if (!filled.length || filled.some((p) => inviteRowError(p))) return;
    setBusy(true);
    setProblem(null);
    // The welcome goes on the venue first, so every email (and the next invite) carries it.
    if (saved.data !== welcome.trim()) {
      try {
        await saveWelcome.mutateAsync(welcome);
      } catch (e) {
        setBusy(false);
        return setProblem(`Welcome message: ${plainDbMessage(e) ?? 'Couldn’t save it.'}`);
      }
    }
    const sent: string[] = [];
    const sentKeys: number[] = [];
    for (const p of filled) {
      const email = p.email.trim().toLowerCase();
      try {
        const invited = await add.mutateAsync({ email, roleLevel: p.role, name: p.name, note: p.note });
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

  const preview = (p: Person) => <InvitePreview barId={barId} barName={name} roleLevel={p.role} sender={sender} welcome={welcome} note={p.noting ? p.note : undefined} />;
  const form = (
    <View style={styles.form}>
      {saved.isLoading ? null : (
        <Field
          label="Welcome message, to everyone"
          value={welcome}
          onChangeText={setEdited}
          minLines={4}
          maxLength={WELCOME_MAX}
          hint={`${sender ? `Signed ${sender}. ` : ''}Kept for later invites; change it any time in My team.`}
        />
      )}
      {people.map((p, i) => (
        <TeamPerson
          key={p.key}
          person={p}
          n={i + 1}
          hold={hold}
          nextName={!!people[i + 1]}
          error={tried && (p.email.trim() || p.name.trim()) ? (inviteRowError(p) ?? undefined) : undefined}
          onChange={(change) => set(p.key, change)}
          onRemove={() => setPeople((list) => (list.length > 1 ? list.filter((x) => x.key !== p.key) : [blankPerson(p.key + 1)]))}
          onPickRole={() => setPicking(p.key)}
          onSubmitName={() => inputs.current.get(`${p.key}-email`)?.focus()}
          onSubmitEmail={() => (people[i + 1] ? inputs.current.get(`${people[i + 1].key}-name`)?.focus() : undefined)}
        />
      ))}
      <View style={styles.buttons}>
        <Button label="Add another" icon="plus" variant="secondary" onPress={() => setPeople((list) => [...list, blankPerson(Math.max(...list.map((x) => x.key)) + 1)])} />
        {wide ? null : <Button label={`Preview ${firstName(shown)}’s email`} icon="envelope" variant="ghost" onPress={() => setPreviewing(shown.key)} />}
      </View>
      {problem ? (
        <Caption tone="accent" role="alert">
          {problem}
        </Caption>
      ) : null}
      <Caption tone="muted">
        {`Admin is everything, including the team. Change anyone’s role later in My team.${pending ? ` Invites go out now; they join ${name} once your claim is approved.` : ''}`}
      </Caption>
    </View>
  );

  return (
    <SetupPage footer={<SetupFooter label={busy ? 'Sending…' : sendInvitesLabel(filled.length)} disabled={busy || !filled.length} onPress={() => void sendAll()} skipLabel="Skip for now" onSkip={() => onDone([])} />}>
      {wide ? (
        <View style={styles.split}>
          {form}
          <View style={styles.aside}>
            {people.length > 1 ? (
              <Segmented
                variant="pill"
                choice
                accessibilityLabel="Whose email"
                options={people.map((p, i) => ({ value: String(p.key), label: `${p.name.trim() ? firstName(p) : `Person ${i + 1}`}’s email` }))}
                value={String(shown.key)}
                onChange={(v) => setPreviewing(Number(v))}
              />
            ) : null}
            {preview(shown)}
            {shown.noting && shown.note.trim() ? null : <Caption tone="muted">{`No note for ${firstName(shown)}, so the note box isn’t there.`}</Caption>}
          </View>
        </View>
      ) : (
        form
      )}
      <MenuSheet visible={!wide && previewing !== null} onClose={() => setPreviewing(null)} title={`${firstName(shown)}’s email`}>
        {preview(shown)}
      </MenuSheet>
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
  form: { flex: 1, minWidth: 0, maxWidth: 560, gap: space.lg },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  aside: { flex: 1, minWidth: 0, maxWidth: 520, gap: space.md },
  choices: { gap: space.sm },
});
