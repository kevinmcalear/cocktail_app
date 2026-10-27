import type { ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Button, Caption, DsText, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { roleLabel } from '@/lib/roles';
import { INVITE_ROLES, NOTE_MAX } from '@/lib/team';

export interface Person {
  key: number;
  name: string;
  email: string;
  role: number;
  note: string;
  /** The note field is open ("Add a note for Sam" was tapped, or there's a note). */
  noting: boolean;
}

const BARTENDER = 30;
export const blankPerson = (key: number): Person => ({ key, name: '', email: '', role: BARTENDER, note: '', noting: false });

/** "Sam", or "them" before there's a name. */
export const firstName = (p: Pick<Person, 'name'>) => p.name.trim().split(/\s+/)[0] || 'them';

type Hold = (id: string) => (el: ComponentRef<typeof TextInput> | null) => void;

/** The role button on a person: the role and its line; opens the roles to pick from. */
function RoleButton({ role, onPress }: { role: number; onPress: () => void }) {
  const ds = useDs();
  const line = INVITE_ROLES.find((r) => r.level === role)?.detail ?? '';
  return (
    <PressableScale role="button" aria-haspopup="listbox" accessibilityLabel={`Role: ${roleLabel(role)}. ${line}. Change`} onPress={onPress} style={[styles.role, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <View style={styles.flex}>
        <DsText variant="body">{roleLabel(role)}</DsText>
        <Caption tone="muted">{line}</Caption>
      </View>
      <IconSymbol name="chevron.down" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

/**
 * One person on Your team: name, email and role, then "Add a note for Sam",
 * which opens a field only their email carries (invite-team-last, step 3).
 */
export function TeamPerson({ person: p, n, error, hold, nextName, onChange, onRemove, onPickRole, onSubmitName, onSubmitEmail }: {
  person: Person;
  n: number;
  error?: string;
  hold: Hold;
  /** Return on the email goes to the next person's name, when there is one. */
  nextName: boolean;
  onChange: (change: Partial<Person>) => void;
  onRemove: () => void;
  onPickRole: () => void;
  onSubmitName: () => void;
  onSubmitEmail: () => void;
}) {
  const ds = useDs();
  const first = firstName(p);
  return (
    <View role="group" accessibilityLabel={`Person ${n}`} style={[styles.person, { borderColor: ds.c.line }]}>
      <View style={styles.head}>
        <Caption tone="muted">{`Person ${n}`}</Caption>
        {/* Remove: the last card left is cleared instead (canvas make-venue-team). */}
        <PressableScale role="button" accessibilityLabel={`Remove ${p.name.trim() || `person ${n}`}`} onPress={onRemove} style={styles.remove}>
          <IconSymbol name="xmark" size={16} color={ds.c.muted} />
        </PressableScale>
      </View>
      {/* iOS offers a contact's name and email (textContentType); autoComplete stays off so a browser doesn't fill in your own. */}
      <Field
        ref={hold(`${p.key}-name`)}
        label="Name"
        value={p.name}
        onChangeText={(t) => onChange({ name: t })}
        placeholder="Sam Okafor"
        autoComplete="off"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={onSubmitName}
        maxLength={80}
      />
      <Field
        ref={hold(`${p.key}-email`)}
        label="Email"
        value={p.email}
        onChangeText={(t) => onChange({ email: t })}
        placeholder="sam@example.com"
        autoComplete="off"
        textContentType="emailAddress"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType={nextName ? 'next' : 'done'}
        submitBehavior={nextName ? 'submit' : 'blurAndSubmit'}
        onSubmitEditing={onSubmitEmail}
        error={error}
      />
      <Caption tone="muted">Role</Caption>
      <RoleButton role={p.role} onPress={onPickRole} />
      {p.noting ? (
        <Field
          label={`A note just for ${first} (optional)`}
          value={p.note}
          onChangeText={(t) => onChange({ note: t })}
          placeholder="You’re on Thursday’s opening shift. Read the new menu first."
          minLines={3}
          maxLength={NOTE_MAX}
        />
      ) : (
        <Button label={`Add a note for ${first}`} icon="plus" variant="ghost" size="sm" style={styles.addNote} onPress={() => onChange({ noting: true })} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  person: { gap: space.sm, padding: space.lg, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -space.md },
  role: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderWidth: 1, borderRadius: radius.control },
  flex: { flex: 1, minWidth: 0 },
  addNote: { alignSelf: 'flex-start' },
});
