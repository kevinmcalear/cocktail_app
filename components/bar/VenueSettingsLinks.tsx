import { useRouter, type Href } from 'expo-router';

import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useBarMembers } from '@/hooks/useBarDetail';
import { usePricingSettings } from '@/hooks/usePricing';
import { useBarPublishing } from '@/hooks/usePublishing';
import { useRoleMatrix } from '@/hooks/useVenueRoles';
import { PAGE_COPY } from '@/lib/pageVisibility';
import { canManageTeam } from '@/lib/team';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "USD · 22% GP", or whichever half is set. */
function pricingValue(p: { currency: string | null; target_gp: number | null } | null | undefined): string | undefined {
  if (!p) return undefined;
  const parts = [p.currency, p.target_gp != null ? `${p.target_gp}% GP` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * Team and roles: links to My team and Roles and access with what's there
 * (decided on the canvas: link, don't repeat the roster here).
 */
export function VenueTeamLinks({ barId, barName, role }: { barId: string; barName: string; role: number }) {
  const router = useRouter();
  const members = useBarMembers(barId).data;
  const invites = useBarInvites(barId, canManageTeam(role)).data ?? [];
  const own = (useRoleMatrix(barId).data ?? []).filter((r) => r.role_id).length;
  const team = members ? [plural(members.length, 'person', 'people'), invites.length ? `${invites.length} invited` : null].filter(Boolean).join(' · ') : undefined;
  return (
    <SettingsSection title="Team and roles">
      <SettingsRow icon="person.2.fill" label="My team" detail={team} onPress={() => router.push('/team' as Href)} />
      <RowDivider />
      <SettingsRow
        icon="lock.shield.fill"
        label="Roles and access"
        detail={`5 base levels${own ? ` and ${own} of ${barName}’s own` : ''}`}
        onPress={() => router.push(`/settings/bar/${barId}/roles` as Href)}
      />
    </SettingsSection>
  );
}

/** The venue settings that have screens of their own: publishing, dilution and pricing, with their current values. */
export function VenueSettingsLinks({ barId }: { barId: string }) {
  const router = useRouter();
  const publishing = useBarPublishing(barId).data;
  const pricing = usePricingSettings(barId).data;
  const go = (page: string) => () => router.push(`/settings/bar/${barId}/${page}` as Href);
  return (
    <SettingsSection title="More settings">
      <SettingsRow
        icon="globe"
        label="Publishing"
        detail="Who outside the venue sees your drinks"
        value={publishing ? PAGE_COPY[publishing.pageVisibility]?.label : undefined}
        onPress={go('publishing')}
      />
      <RowDivider />
      <SettingsRow icon="drop.fill" label="Dilution" detail="How much water each method adds" onPress={go('dilution')} />
      <RowDivider />
      <SettingsRow icon="dollarsign.circle.fill" label="Pricing" detail="Currency, tax and target GP" value={pricingValue(pricing)} onPress={go('pricing')} />
    </SettingsSection>
  );
}
