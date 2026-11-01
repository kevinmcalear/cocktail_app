// Takeovers (20261204400000_takeovers_and_allergens.sql): guest bartenders
// invited onto a role that ends, a run-sheet link for each party with no
// account, and the run sheet's margin. The list itself is a menu with
// list_type 'takeover' (hooks/useLivingList.ts), its nights are takeover
// events (hooks/useEvents.ts), and its guest bar is its run sheet's guest
// party (hooks/useRunSheet.ts).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/db';

/** Invite a guest bartender onto the takeover's role at the host; they lose access when it ends. */
export function useInviteToRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (p: { email: string; roleId: string; name?: string | null; note?: string | null }) => {
      const { error } = await supabase.rpc('invite_to_role', {
        p_email: p.email,
        p_role_id: p.roleId,
        ...(p.name ? { p_name: p.name } : {}),
        ...(p.note ? { p_note: p.note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['bar-invites'] }),
    onError: () => {},
  });
}

const linkKey = (partyId: string) => ['run-sheet-link', partyId] as const;

/** A party's link token, when it has one (editors only). */
export function useRunSheetLinkToken(partyId: string | null | undefined) {
  return useQuery({
    queryKey: linkKey(partyId ?? ''),
    enabled: !!partyId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('run_sheet_link_token', { p_party_id: partyId! });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}

/** Save the party's list (lib/runSheet.ts partyList, no specs) behind its link; re-save after each change while it's shared. */
export function useSaveRunSheetLink(partyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (list: Json): Promise<string> => {
      const { data, error } = await supabase.rpc('save_run_sheet_link', { p_party_id: partyId, p_list: list });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (token) => client.setQueryData(linkKey(partyId), token),
    onError: () => {},
  });
}

export function useEndRunSheetLink(partyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('end_run_sheet_link', { p_party_id: partyId });
      if (error) throw error;
    },
    onSuccess: () => client.setQueryData(linkKey(partyId), null),
    onError: () => {},
  });
}

export interface PublicRunSheet {
  list: Json;
  saved_at: string;
  menu_name: string;
  party_name: string;
}

/** The party's list behind a link, signed out. Null for a wrong, ended or old link. */
export function usePublicRunSheet(token: string | null | undefined) {
  return useQuery({
    queryKey: ['public-run-sheet', token],
    enabled: !!token,
    queryFn: async (): Promise<PublicRunSheet | null> => {
      const { data, error } = await supabase.rpc('run_sheet_link', { p_token: token! });
      if (error) throw error;
      return (data as unknown as PublicRunSheet | null) ?? null;
    },
  });
}

/** The run sheet's margin on what to buy, in percent (menus.run_margin_pct; 10 by default). */
export function useSetRunMargin(menuId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (pct: number) => {
      const { error } = await supabase.from('menus').update({ run_margin_pct: Math.round(pct) }).eq('id', menuId);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['run-sheet'] }),
    onError: () => {},
  });
}
