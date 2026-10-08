import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import type { BarMember } from '@/hooks/useBarDetail';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';
import { INVITE_ROLES, joinedLabel, personName } from '@/lib/team';

/** What each role can do, for the role list. Guest isn't an invite role, so it's here. */
function roleDetail(level: number): string {
  return INVITE_ROLES.find((r) => r.level === level)?.detail ?? 'Sees the menu only';
}

/**
 * One teammate, for an Admin: who they are, their role, and removing them.
 * A new role saves as soon as it's picked; Remove sits apart at the bottom.
 */
export function MemberSheet({ member, barName, ceiling, busy, onClose, onRole, onRemove }: {
  member: BarMember | null;
  barName: string;
  /** The Admin's own role: nobody is moved above it. */
  ceiling: number;
  busy: boolean;
  onClose: () => void;
  onRole: (member: BarMember, level: number) => void;
  onRemove: (member: BarMember) => void;
}) {
  const name = member ? personName(member) : '';
  const joined = joinedLabel(member?.joined_at);
  return (
    <MenuSheet
      visible={!!member}
      onClose={onClose}
      title={name}
      footer={
        member ? (
          <Button
            label={`Remove from ${barName}`}
            variant="danger"
            icon="person.badge.minus"
            disabled={busy}
            onPress={() => onRemove(member)}
          />
        ) : null
      }
    >
      {member ? (
        <>
          <View style={styles.who}>
            <UserAvatar uri={member.avatar_url} name={name} email={member.email} size={56} />
            <View style={styles.flex}>
              {member.email ? <Body>{member.email}</Body> : null}
              {joined ? <Caption tone="muted">{joined}</Caption> : null}
            </View>
          </View>
          <Caption tone="muted">Role</Caption>
          <View role="radiogroup" accessibilityLabel={`Role for ${name}`} style={styles.list}>
            {ROLE_LEVELS.filter((r) => r.level <= ceiling).map((r) => (
              <Choice
                key={r.level}
                label={roleLabel(r.level)}
                detail={roleDetail(r.level)}
                selected={member.role_level === r.level}
                disabled={busy}
                onPress={() => {
                  if (r.level !== member.role_level) onRole(member, r.level);
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  list: { gap: space.sm },
});
