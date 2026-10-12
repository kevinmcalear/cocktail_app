import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { space } from '@/constants/tokens';
import type { BarMember } from '@/hooks/useBarDetail';
import type { MemberRoleChoice, RoleMatrixRow } from '@/hooks/useVenueRoles';
import { endsLabel, roleSummary } from '@/lib/roleMatrix';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';
import { INVITE_ROLES, memberSinceLine, personName } from '@/lib/team';

/** What each role can do, for the role list. Guest isn't an invite role, so it's here. */
function roleDetail(level: number): string {
  return INVITE_ROLES.find((r) => r.level === level)?.detail ?? 'Sees the menu only';
}

/** "From Bartender, no photos. Ends Mon 12 Oct" */
function venueRoleDetail(role: RoleMatrixRow): string {
  const ends = endsLabel(role.ends_at);
  return ends ? `${roleSummary(role)}. Ends ${ends}` : roleSummary(role);
}

/**
 * One teammate, for an Admin: who they are, their role (a base level or one
 * of the venue's own), and removing them. A new role saves as soon as it's
 * picked; Remove sits apart at the bottom.
 */
export function MemberSheet({ member, barName, ceiling, venueRoles, busy, onClose, onRole, onRemove }: {
  member: BarMember | null;
  barName: string;
  /** The Admin's own role: nobody is moved above it. */
  ceiling: number;
  /** The venue's own roles (matrix rows with a role_id). */
  venueRoles: RoleMatrixRow[];
  busy: boolean;
  onClose: () => void;
  onRole: (member: BarMember, choice: MemberRoleChoice, label: string, level: number) => void;
  onRemove: (member: BarMember) => void;
}) {
  const name = member ? personName(member) : '';
  const joined = member ? memberSinceLine(member) : null;
  const own = venueRoles.filter((r) => r.role_id && r.base_level <= ceiling);
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
          <View role="radiogroup" accessibilityLabel={`Role for ${name}`} style={styles.list}>
            <Caption tone="muted" role="heading">ROLE</Caption>
            {ROLE_LEVELS.filter((r) => r.level <= ceiling).map((r) => {
              const selected = !member.venue_role_id && member.role_level === r.level;
              return (
                <Choice
                  key={r.level}
                  label={roleLabel(r.level)}
                  detail={roleDetail(r.level)}
                  selected={selected}
                  disabled={busy}
                  onPress={() => {
                    if (!selected) onRole(member, { level: r.level }, roleLabel(r.level), r.level);
                  }}
                />
              );
            })}
            {own.length ? <Caption tone="muted" role="heading" style={styles.group}>{`${barName.toUpperCase()}’S ROLES`}</Caption> : null}
            {own.map((r) => {
              const selected = member.venue_role_id === r.role_id;
              return (
                <Choice
                  key={r.role_id}
                  label={r.name ?? ''}
                  detail={venueRoleDetail(r)}
                  selected={selected}
                  disabled={busy}
                  onPress={() => {
                    if (!selected && r.role_id) onRole(member, { venueRoleId: r.role_id }, r.name ?? '', r.base_level);
                  }}
                />
              );
            })}
          </View>
          <Caption tone="muted">A new role saves as soon as you pick it.</Caption>
        </>
      ) : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  list: { gap: space.sm },
  group: { marginTop: space.md },
});
