import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Update } from '@/types/db';

/** The venue's staff link and its settings (Kept-team, Invite). */
export interface StaffLink {
  slug: string;
  on: boolean;
  /** The role new people join as. */
  role: number;
  approve: boolean;
}

export type StaffLinkPatch = Partial<Pick<StaffLink, 'on' | 'role' | 'approve'>>;

const key = (barId: string | null | undefined) => ['staff-link', barId];

export function useStaffLink(barId: string | null | undefined) {
  return useQuery({
    queryKey: key(barId),
    enabled: !!barId,
    queryFn: async (): Promise<StaffLink | null> => {
      const { data, error } = await supabase.from('bars').select('slug, staff_link_on, staff_link_role, staff_link_approve').eq('id', barId!).maybeSingle();
      if (error) throw error;
      return data ? { slug: data.slug, on: data.staff_link_on, role: data.staff_link_role, approve: data.staff_link_approve } : null;
    },
  });
}

/** Saves one setting at the tap and puts it back if the database says no. */
export function useSaveStaffLink(barId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: StaffLinkPatch) => {
      const row: Update<'bars'> = {};
      if (patch.on !== undefined) row.staff_link_on = patch.on;
      if (patch.role !== undefined) row.staff_link_role = patch.role;
      if (patch.approve !== undefined) row.staff_link_approve = patch.approve;
      // RLS hides a row it won't update, which isn't an error: count what changed.
      const { data, error } = await supabase.from('bars').update(row).eq('id', barId!).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('You can’t change the staff link.');
    },
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: key(barId) });
      const before = client.getQueryData<StaffLink | null>(key(barId));
      if (before) client.setQueryData<StaffLink>(key(barId), { ...before, ...patch });
      return { before };
    },
    // Only this save's settings go back: a save made after it keeps its own.
    onError: (_e, patch, context) => {
      const before = context?.before;
      if (!before) return;
      const back: StaffLinkPatch = {};
      if (patch.on !== undefined) back.on = before.on;
      if (patch.role !== undefined) back.role = before.role;
      if (patch.approve !== undefined) back.approve = before.approve;
      client.setQueryData<StaffLink | null>(key(barId), (now) => (now ? { ...now, ...back } : now));
    },
    onSettled: () => client.invalidateQueries({ queryKey: key(barId) }),
  });
}
