import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import type { BarMember } from '@/hooks/useBarDetail';
import type { MemberRoleChoice, RoleMatrixRow } from '@/hooks/useVenueRoles';
import { endsLabel, roleSummary } from '@/lib/roleMatrix';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';
import { INVITE_ROLES, personName } from '@/lib/team';

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
 * A teammate's role, from their page's Role row (Kept-team, A person): a
 * built-in role or one of the venue's own. A new role saves as soon as it's
 * picked.
 */
export function MemberRoleSheet({ member, barName, visible, ceiling, venueRoles, busy, onClose, onRole }: {
  member: BarMember;
  barName: string;
  visible: boolean;
  /** The manager's own role: nobody is moved above it. */
  ceiling: number;
  /** The venue's own roles (matrix rows with a role_id). */
  venueRoles: RoleMatrixRow[];
  busy: boolean;
  onClose: () => void;
  onRole: (choice: MemberRoleChoice, label: string, level: number) => void;
}) {
  const name = personName(member);
  const own = venueRoles.filter((r) => r.role_id && r.base_level <= ceiling);
  return (
    <MenuSheet visible={visible} onClose={onClose} title={`${name}’s role`}>
      <View role="radiogroup" accessibilityLabel={`Role for ${name}`} style={styles.list}>
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
                if (!selected) onRole({ level: r.level }, roleLabel(r.level), r.level);
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
                if (!selected && r.role_id) onRole({ venueRoleId: r.role_id }, r.name ?? '', r.base_level);
              }}
            />
          );
        })}
      </View>
      <Caption tone="muted">A new role saves as soon as you pick it.</Caption>
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  group: { marginTop: space.md },
});
