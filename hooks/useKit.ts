import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { supabase } from '@/lib/supabase';
import { useKitStore } from '@/store/useKitStore';

const KIT_KEY = ['kit'];

/**
 * The equipment you have (lib/techniques/equipment.ts ids), for My Bar and
 * the technique library. Signed in, it's on your account (home_kit_items),
 * so it follows you to every device; the first time, whatever this device
 * had is moved up. Signed out, or on a database without the table, it's this
 * device's list (store/useKitStore.ts), as before.
 */
export function useKit(): { owned: string[]; kit: ReadonlySet<string>; toggle: (id: string) => void } {
  const client = useQueryClient();
  const { session } = useAuth();
  const local = useKitStore((s) => s.owned);
  const toggleLocal = useKitStore((s) => s.toggle);

  const remote = useQuery({
    queryKey: KIT_KEY,
    enabled: !!session,
    // null: no table yet (an app ahead of its database), so the device's list stays in charge.
    queryFn: async (): Promise<string[] | null> => {
      const { data, error } = await supabase.from('home_kit_items').select('equipment_id').order('added_at');
      // ponytail: drop the missing-table case once 20261010410000 is in production.
      if (error?.code === 'PGRST205' || error?.code === '42P01') return null;
      if (error) throw error;
      const ids = (data ?? []).map((r: { equipment_id: string }) => r.equipment_id);
      // Move this device's kit up once; after that the account's list rules.
      const device = useKitStore.getState().owned.filter((id) => !ids.includes(id));
      if (device.length) {
        const { error: upError } = await supabase.from('home_kit_items').upsert(device.map((equipment_id) => ({ equipment_id })), { onConflict: 'user_id,equipment_id', ignoreDuplicates: true });
        if (upError) throw upError;
      }
      useKitStore.getState().clear();
      return [...ids, ...device];
    },
  });
  const onServer = !!session && Array.isArray(remote.data);

  const edit = useMutation({
    mutationFn: async ({ id, have }: { id: string; have: boolean }) => {
      const { error } = have
        ? await supabase.from('home_kit_items').upsert({ equipment_id: id }, { onConflict: 'user_id,equipment_id', ignoreDuplicates: true })
        : await supabase.from('home_kit_items').delete().eq('equipment_id', id);
      if (error) throw error;
    },
    onMutate: ({ id, have }) => {
      const before = client.getQueryData<string[] | null>(KIT_KEY);
      client.setQueryData<string[] | null>(KIT_KEY, (ids) => [...(ids ?? []).filter((i) => i !== id), ...(have ? [id] : [])]);
      return { before };
    },
    onError: (_e, _v, ctx) => client.setQueryData(KIT_KEY, ctx?.before),
    onSettled: () => client.invalidateQueries({ queryKey: KIT_KEY }),
  });

  // While the account's list loads, the device's stands in, so nothing flickers empty.
  const owned = onServer ? remote.data! : local;
  return {
    owned,
    kit: new Set(owned),
    toggle: (id) => (onServer ? edit.mutate({ id, have: !owned.includes(id) }) : toggleLocal(id)),
  };
}
