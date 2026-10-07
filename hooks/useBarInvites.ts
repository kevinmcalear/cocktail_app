import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { getAuthSite } from '@/lib/authRedirect';
import { invokeFunction } from '@/lib/invokeFunction';
import { supabase } from '@/lib/supabase';

/** Someone invited to a venue who hasn't accepted yet (bar_invites). */
export interface BarInvite {
  id: string;
  bar_id: string;
  email: string;
  role_level: number;
  /** What the admin called them, if anything. */
  name: string | null;
  created_at: string;
}

const COLUMNS = 'id, bar_id, email, role_level, name, created_at';

/** One of the signed-in person's own invites, with the venue it's for (my_bar_invites). */
export interface MyInvite {
  id: string;
  bar_id: string;
  bar_name: string;
  bar_slug: string | null;
  /** The venue's public bar profile, when it has one: where their job goes. */
  bar_profile_id: string | null;
  role_level: number;
  name: string | null;
}

/** A venue's open invites. RLS shows them to the venue's admins only. */
export function useBarInvites(barId: string, enabled = true) {
  return useQuery({
    queryKey: ['bar-invites', barId],
    enabled: !!barId && enabled,
    staleTime: 0,
    queryFn: async (): Promise<BarInvite[]> => {
      const { data, error } = await supabase.from('bar_invites').select(COLUMNS).eq('bar_id', barId).order('created_at');
      if (error) throw error;
      return (data ?? []) as BarInvite[];
    },
  });
}

/** An admin cancels an invite, or the invitee declines it. */
export function useRemoveInvite(barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from('bar_invites').delete().eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bar-invites', barId] });
      await queryClient.invalidateQueries({ queryKey: ['my-bar-invite', barId] });
      await queryClient.invalidateQueries({ queryKey: ['my-invites'] });
    },
    onError: () => {},
  });
}

/** The signed-in person's own invite to this venue, if any (RLS matches their email). */
export function useMyBarInvite(barId: string | null) {
  const user = useAuth().user;
  const email = user?.email?.toLowerCase() ?? null;
  return useQuery({
    queryKey: ['my-bar-invite', barId, user?.id],
    enabled: !!barId && !!email,
    staleTime: 0,
    queryFn: async (): Promise<BarInvite | null> => {
      const { data, error } = await supabase.from('bar_invites').select(COLUMNS).eq('bar_id', barId!).eq('email', email!).maybeSingle();
      if (error) throw error;
      return (data as BarInvite | null) ?? null;
    },
  });
}

/** Joins the venue at the invited role (accept_bar_invite checks the email). */
export function useAcceptInvite(barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('accept_bar_invite', { p_bar_id: barId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bars'] });
      await queryClient.invalidateQueries({ queryKey: ['my-bar-invite', barId] });
      await queryClient.invalidateQueries({ queryKey: ['my-invites'] });
    },
    onError: () => {},
  });
}

/** Every venue that has invited the signed-in person and is still waiting. */
export function useMyInvites(enabled = true) {
  const userId = useAuth().user?.id ?? null;
  return useQuery({
    queryKey: ['my-invites', userId],
    enabled: !!userId && enabled,
    staleTime: 0,
    queryFn: async (): Promise<MyInvite[]> => {
      const { data, error } = await supabase.rpc('my_bar_invites');
      if (error) throw error;
      return (data ?? []) as MyInvite[];
    },
  });
}

/**
 * Emails an invite that already exists (send-bar-invite): a new account gets
 * the invite email, an existing one a sign-in link to the staff link.
 */
export function useSendInviteEmail(barId: string) {
  return useMutation({
    mutationFn: (email: string) =>
      invokeFunction<{ sent: boolean }>('send-bar-invite', { bar_id: barId, email: email.trim().toLowerCase(), site: getAuthSite() }),
    onError: () => {},
  });
}
