import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import type { AgeCheck } from '@/lib/safety';
import { supabase } from '@/lib/supabase';

const key = (userId: string | undefined) => ['age-check', userId];

/**
 * Whether the signed-in person has passed the age check: 'confirmed',
 * 'under_age' or 'unknown'. Undefined while it loads or signed out.
 */
export function useAgeCheck() {
  const { user } = useAuth();
  return useQuery({
    queryKey: key(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<AgeCheck> => {
      const { data, error } = await supabase.rpc('get_my_age_check');
      if (error) throw error;
      return data === 'confirmed' || data === 'under_age' ? data : 'unknown';
    },
  });
}

/**
 * Checks a birth date against the country's drinking age. The server keeps
 * only the outcome, never the date, and an under-age answer is final.
 */
export function useConfirmAge() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ birthDate, country }: { birthDate: string; country: string }): Promise<AgeCheck> => {
      const { data, error } = await supabase.rpc('confirm_age', { p_birth_date: birthDate, p_country_code: country });
      if (error) {
        // A second try after an under-age answer is refused: that's the answer.
        if (/can't use home mode/i.test(error.message)) return 'under_age';
        throw error;
      }
      return data == null ? 'under_age' : 'confirmed';
    },
    onSuccess: (outcome) => qc.setQueryData(key(user?.id), outcome),
    // Shown inline by the form.
    onError: () => {},
  });
}
