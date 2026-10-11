import { useBars } from '@/hooks/useBars';

/**
 * Your real role at a venue (before View as), or null when you're not on its
 * team: a home user on a bar's drink. Staff-only rows hide for them (decision b49).
 */
export function useTeamRole(barId: string | null | undefined): number | null {
  const { data: bars } = useBars();
  if (!barId) return null;
  return (bars?.find((b) => b.bar_id === barId)?.role_level as number | undefined) ?? null;
}
