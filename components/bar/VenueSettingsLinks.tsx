import { useRouter, type Href } from 'expo-router';

import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useBarKit } from '@/hooks/useBarKit';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useCapabilities } from '@/hooks/useCapabilities';
import { usePricingSettings } from '@/hooks/usePricing';
import { useBarPublishing } from '@/hooks/usePublishing';
import { useVenueSuppliers } from '@/hooks/useVenueSuppliers';
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

/**
 * Kit: what drinks here are made with (glassware, ice, tools), with how many
 * of each. Anyone with Prep changes them; the whole team can look.
 */
export function VenueKitLinks({ barId }: { barId: string }) {
  const router = useRouter();
  const glasses = useBarGlassware(barId).data;
  const kit = useBarKit(barId).data;
  const count = (kind: 'ice' | 'tool') => kit?.filter((r) => r.kind === kind).length;
  const ice = count('ice');
  const tools = count('tool');
  const go = (page: string) => () => router.push(`/settings/bar/${barId}/${page}` as Href);
  return (
    <SettingsSection title="Kit" note="What drinks here are made with. Anyone with Prep changes it.">
      <SettingsRow
        icon="wineglass"
        label="Glassware"
        detail="The glasses you pour into, and who makes them"
        value={glasses ? plural(glasses.length, 'glass', 'glasses') : undefined}
        onPress={go('glassware')}
      />
      <RowDivider />
      <SettingsRow icon="snowflake" label="Ice" detail="What goes in the glass, and who brings it" value={ice == null ? undefined : plural(ice, 'kind')} onPress={go('ice')} />
      <RowDivider />
      <SettingsRow icon="hammer.fill" label="Tools" detail="Behind the bar and in the prep kitchen" value={tools == null ? undefined : plural(tools, 'tool')} onPress={go('tools')} />
    </SettingsSection>
  );
}

/**
 * Buying: who the venue orders from and what it costs. Only for people with
 * Prep or Costs, as the database has it for suppliers.
 */
export function VenueBuyingLinks({ barId }: { barId: string }) {
  const router = useRouter();
  const caps = useCapabilities(barId).data ?? [];
  const allowed = caps.includes('prep') || caps.includes('costs');
  const suppliers = useVenueSuppliers(allowed ? barId : null).data;
  const pricing = usePricingSettings(barId).data;
  if (!allowed) return null;
  const go = (page: string) => () => router.push(`/settings/bar/${barId}/${page}` as Href);
  return (
    <SettingsSection title="Buying" note="Who you order from and what it costs. Only people with Prep or Costs see this.">
      <SettingsRow
        icon="building.2.fill"
        label="Suppliers"
        detail="Who you order from, and their cut-offs"
        value={suppliers ? plural(suppliers.length, 'supplier') : undefined}
        onPress={go('suppliers')}
      />
      <RowDivider />
      <SettingsRow icon="dollarsign.circle.fill" label="Pricing" detail="Currency, tax and target GP" value={pricingValue(pricing)} onPress={go('pricing')} />
    </SettingsSection>
  );
}

/** The rest of the venue settings that have screens of their own: publishing, calendars and dilution. */
export function VenueSettingsLinks({ barId }: { barId: string }) {
  const router = useRouter();
  const publishing = useBarPublishing(barId).data;
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
      <SettingsRow icon="calendar" label="Calendars" detail="Calendars that bring events into This week" onPress={go('calendars')} />
      <RowDivider />
      <SettingsRow icon="drop.fill" label="Dilution" detail="How much water each method adds" onPress={go('dilution')} />
    </SettingsSection>
  );
}
