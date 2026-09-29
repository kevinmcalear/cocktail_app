import { useState } from 'react';
import { Button, Card, Input, Text, XStack, YStack } from 'tamagui';

import { useAuth } from '@/ctx/AuthContext';
import { useSetMemberRole, type BarMember } from '@/hooks/useBarDetail';
import { pressedProps } from '@/lib/a11yState';
import { confirmAsync } from '@/lib/dialogs';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';

const ADMIN = 40;

/** add_user_to_bar_by_email's errors in words. Its own messages (P0001) are written for people. */
function roleError(error: unknown): string | null {
  if (!error) return null;
  const e = error as { code?: string; message?: string };
  if (e.code === 'P0001' && e.message) return e.message;
  return "Couldn't save that. Check your connection and try again.";
}

function RolePills({ label, value, choices, disabled, onPick }: {
  label: string;
  value: number;
  choices: readonly { level: number; label: string }[];
  disabled: boolean;
  onPick: (level: number) => void;
}) {
  return (
    <XStack gap="$2" flexWrap="wrap" role="group" aria-label={label}>
      {choices.map((r) => {
        const on = r.level === value;
        return (
          <Button
            key={r.level}
            size="$2"
            borderRadius="$10"
            borderWidth={1}
            disabled={disabled}
            backgroundColor={on ? '$color8' : '$background'}
            borderColor={on ? '$color8' : '$borderColor'}
            onPress={() => !on && onPick(r.level)}
            {...pressedProps(on)}
          >
            <Text color={on ? '$backgroundStrong' : '$color'} fontWeight={on ? 'bold' : 'normal'}>
              {r.label}
            </Text>
          </Button>
        );
      })}
    </XStack>
  );
}

/**
 * The venue's team. Admins add people by email and change roles; everyone else
 * sees a read-only list. The RPC decides who may (real Admins only), so this
 * only reflects it: no controls on your own row, so you can't demote yourself
 * out of the venue, and no role above your own.
 */
export function TeamMembers({ barId, members, myRole }: { barId: string; members: BarMember[]; myRole: number }) {
  const myId = useAuth().user?.id;
  const change = useSetMemberRole(barId);
  const add = useSetMemberRole(barId);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState(10);
  const canManage = myRole >= ADMIN;
  const choices = ROLE_LEVELS.filter((r) => r.level <= myRole);
  const busy = change.isPending || add.isPending;

  // Admin hands over the keys, so it asks first.
  const confirmRole = (who: string, level: number) =>
    level !== ADMIN ||
    confirmAsync({
      title: `Make ${who} an Admin?`,
      message: 'Admins can change the venue and everyone’s role, including yours.',
      confirmText: 'Make Admin',
    });

  return (
    <YStack gap="$3">
      <Text fontSize="$3" fontWeight="bold" color="$color11" textTransform="uppercase" letterSpacing={0.5}>
        Members ({members.length})
      </Text>
      {canManage ? (
        <Card padding="$3" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
          <Text fontSize="$3" fontWeight="600" color="$color">Add someone</Text>
          <Text fontSize="$2" color="$color11">Use the email they signed up with.</Text>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            aria-label="Email of the person to add"
            autoCapitalize="none"
            keyboardType="email-address"
            textAlign="left"
            backgroundColor="$background"
            borderColor="$borderColor"
          />
          <RolePills label="Role for the new member" value={newRole} choices={choices} disabled={busy} onPick={setNewRole} />
          {add.error ? <Text fontSize="$2" color="$red10" role="alert">{roleError(add.error)}</Text> : null}
          <Button
            size="$3"
            backgroundColor="$color8"
            disabled={busy || !email.trim()}
            opacity={busy || !email.trim() ? 0.5 : 1}
            onPress={async () => {
              if (!(await confirmRole(email.trim(), newRole))) return;
              add.mutate({ email, roleLevel: newRole }, { onSuccess: () => setEmail('') });
            }}
          >
            <Text color="$backgroundStrong" fontWeight="bold">Add to team</Text>
          </Button>
        </Card>
      ) : null}
      {change.error ? <Text fontSize="$2" color="$red10" role="alert">{roleError(change.error)}</Text> : null}
      {members.length === 0 ? <Text color="$color11" fontStyle="italic" fontSize="$2">No members found.</Text> : null}
      {members.map((m) => {
        const me = m.user_id === myId;
        // Emails are only returned to venue admins (and your own row).
        const who = m.email ?? 'Team member';
        const editable = canManage && !me && !!m.email && m.role_level <= myRole;
        return (
          <Card key={m.user_id} padding="$3" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
            <XStack justifyContent="space-between" alignItems="center" gap="$2">
              <Text flexShrink={1} fontSize="$3" fontWeight="600" color="$color">{me ? `${who} (you)` : who}</Text>
              {editable ? null : <Text fontSize="$2" color="$color11">{roleLabel(m.role_level)}</Text>}
            </XStack>
            {editable ? (
              <RolePills
                label={`Role for ${who}`}
                value={m.role_level}
                choices={choices}
                disabled={busy}
                onPick={async (level) => {
                  if (await confirmRole(who, level)) change.mutate({ email: m.email!, roleLevel: level });
                }}
              />
            ) : null}
          </Card>
        );
      })}
    </YStack>
  );
}
