import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth, useUserId } from '@/ctx/AuthContext';
import { useMyProfile } from '@/hooks/useMyProfile';
import { track } from '@/lib/analytics';
import { getAuthSite } from '@/lib/authRedirect';
import { invokeFunction } from '@/lib/invokeFunction';
import { supabase } from '@/lib/supabase';

/** Someone invited to a venue who hasn't accepted yet (bar_invites). */
export interface BarInvite {
  id: string;
  bar_id: string;
  email: string;
  role_level: number;
  /** The bar's own role it invites onto (venue_roles.id), when it isn't one of the built-in levels. */
  venue_role_id: string | null;
  /** What the admin called them, if anything. */
  name: string | null;
  /** A line just for them, under the welcome message in their email. */
  note: string | null;
  created_at: string;
}

const COLUMNS = 'id, bar_id, email, role_level, venue_role_id, name, note, created_at';

/** One of the signed-in person's own invites, with the venue it's for (my_bar_invites). */
export interface MyInvite {
  id: string;
  bar_id: string;
  bar_name: string;
  bar_slug: string | null;
  bar_logo_url: string | null;
  bar_color: string | null;
  bar_display_face: string | null;
  bar_ground_tint: string | null;
  /** The venue's public bar profile, when it has one: where their job goes. */
  bar_profile_id: string | null;
  role_level: number;
  name: string | null;
  /** The Admin who sent it, by the name they go by. */
  invited_by_name: string | null;
  /** They said yes; they join once the venue's claim is approved. */
  held?: boolean;
  /** The venue's welcome message, signed by whoever invited them (invite-team-last, call 4). */
  welcome_message?: string | null;
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
      await queryClient.invalidateQueries({ queryKey: ['my-invites'] });
    },
    onError: () => {},
  });
}

/**
 * Joins the venue at the invited role (accept_bar_invite checks the email).
 * A venue still waiting on its claim holds them instead: `held` comes back
 * true and they join once the claim is approved.
 */
export function useAcceptInvite(barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ held: boolean }> => {
      const { data, error } = await supabase.rpc('accept_bar_invite', { p_bar_id: barId });
      if (error) throw error;
      return { held: !(data as { user_id?: string | null } | null)?.user_id };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bars'] });
      await queryClient.invalidateQueries({ queryKey: ['my-invites'] });
    },
    onError: () => {},
  });
}

/** Every venue that has invited the signed-in person and is still waiting. */
export function useMyInvites(enabled = true) {
  const userId = useUserId();
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
 * A venue's welcome message: null until an Admin first saves it, when the
 * app offers welcomeSuggestion (lib/team). Every invite email carries it.
 */
export function useWelcomeMessage(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['welcome-message', barId],
    enabled: !!barId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('bars').select('welcome_message').eq('id', barId!).single();
      if (error) throw error;
      return data.welcome_message;
    },
  });
}

/**
 * The name an invite is signed with: your profile's name, else the name you
 * signed up with, as send-bar-invite and my_bar_invites read it.
 */
export function useSenderName(): string | null {
  const profile = useMyProfile().data;
  const meta = useAuth().user?.user_metadata?.full_name;
  return profile?.displayName?.trim() || (typeof meta === 'string' ? meta.trim() : '') || null;
}

/** Saves the welcome message. Admins only (bars_update); an empty box saves as no message. */
export function useSaveWelcomeMessage(barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase.from('bars').update({ welcome_message: message.trim() }).eq('id', barId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['welcome-message', barId] }),
    onError: () => {},
  });
}

/** Who an invite email goes to: an email, or a person's page when they were found by name (their email stays on the server). */
export type InviteTarget = string | { profileId: string };

/**
 * Emails an invite that already exists (send-bar-invite): one email in the
 * venue's look with its welcome message and the person's note, account or not.
 */
export function useSendInviteEmail(barId: string) {
  return useMutation({
    mutationFn: (to: InviteTarget) =>
      invokeFunction<{ sent: boolean }>('send-bar-invite', {
        bar_id: barId,
        ...(typeof to === 'string' ? { email: to.trim().toLowerCase() } : { profile_id: to.profileId }),
        site: getAuthSite(),
      }),
    onSuccess: () => track('invite_sent'),
    onError: () => {},
  });
}

/**
 * Invites a person found by name (invite_profile_to_bar): the database looks
 * up their email, so the sender never has it. Resolves to true when it made an
 * invite, false when they were already on the team and just got the new
 * built-in role. `roleId` puts them on one of the bar's own roles.
 */
export function useInviteProfile(barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: { profileId: string; roleLevel: number; roleId?: string | null }): Promise<boolean> => {
      const { data, error } = await supabase.rpc('invite_profile_to_bar', {
        p_profile_id: p.profileId,
        p_bar_id: barId,
        p_role_level: p.roleLevel,
        ...(p.roleId ? { p_role_id: p.roleId } : {}),
      });
      if (error) throw error;
      return data === true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bar', barId] });
      await queryClient.invalidateQueries({ queryKey: ['bar-members', barId] });
      await queryClient.invalidateQueries({ queryKey: ['bar-invites', barId] });
    },
    onError: () => {},
  });
}
