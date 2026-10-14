import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/** A maker's or supplier's page, as a row on the other's page. */
export interface LinePage {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  /** A maker's makes, or a supplier's supplies. */
  what: string[];
}

export interface SupplierLine {
  id: string;
  /** "AU" or "AU-VIC" (supplier_lines.region). */
  region: string;
  page: LinePage;
}

// Lines are public, like the pages on both ends: signed out too.

type Row = { id: string; region: string; page: (Omit<LinePage, 'what'> & { makes?: string[]; supplies?: string[] }) | null };
const toLines = (rows: Row[]): SupplierLine[] =>
  rows
    .filter((r) => r.page)
    .map((r) => {
      const { makes, supplies, ...page } = r.page!;
      return { id: r.id, region: r.region, page: { ...page, what: makes ?? supplies ?? [] } };
    })
    .sort((a, b) => a.page.display_name.localeCompare(b.page.display_name));

/** The makers whose brands a supplier carries, each with where. */
export function useSupplierLines(supplierId: string | null | undefined) {
  return useQuery({
    queryKey: ['supplier-lines', supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<SupplierLine[]> => {
      const { data, error } = await supabase
        .from('supplier_lines')
        .select('id, region, page:profiles!supplier_lines_maker_profile_id_fkey(id, handle, display_name, avatar_url, makes)')
        .eq('supplier_profile_id', supplierId!)
        .limit(1000);
      if (error) throw error;
      return toLines((data ?? []) as unknown as Row[]);
    },
  });
}

/** The suppliers that carry a maker's brands, each with where. */
export function useMakerSuppliers(makerId: string | null | undefined) {
  return useQuery({
    queryKey: ['maker-suppliers', makerId],
    enabled: !!makerId,
    queryFn: async (): Promise<SupplierLine[]> => {
      const { data, error } = await supabase
        .from('supplier_lines')
        .select('id, region, page:profiles!supplier_lines_supplier_profile_id_fkey(id, handle, display_name, avatar_url, supplies)')
        .eq('maker_profile_id', makerId!)
        .limit(200);
      if (error) throw error;
      return toLines((data ?? []) as unknown as Row[]);
    },
  });
}
