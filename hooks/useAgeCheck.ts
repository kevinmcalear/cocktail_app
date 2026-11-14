import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { track } from '@/lib/analytics';
import type { AgeCheck } from '@/lib/safety';
import { supabase } from '@/lib/supabase';
import { settlePendingWants } from '@/lib/swipes';

const key = (userId: string | null) => ['age-check', userId];

/**
 * Whether the signed-in person has passed the age check: 'confirmed',
 * 'under_age' or 'unknown'. Undefined while it loads or signed out.
 */
export function useAgeCheck() {
  const qc = useQueryClient();
  const userId = useUserId();
  return useQuery({
    queryKey: key(userId),
    enabled: !!userId,
    queryFn: async (): Promise<AgeCheck> => {
      const { data, error } = await supabase.rpc('get_my_age_check');
      if (error) throw error;
      const age = data === 'confirmed' || data === 'under_age' ? data : 'unknown';
      // First run's Wants held for this answer (confirmed elsewhere, or a save that failed before).
      void settled(qc, age);
      return age;
    },
  });
}

/** Settles first run's held Wants by the age answer (lib/swipes settlePendingWants), and shows any it saved. */
async function settled(qc: ReturnType<typeof useQueryClient>, age: AgeCheck) {
  if (await settlePendingWants(age)) void qc.invalidateQueries({ queryKey: ['collection'] });
}

/**
 * Checks a birth date against the country's drinking age. The server keeps
 * only the outcome, never the date, and an under-age answer is final.
 */
export function useConfirmAge() {
  const qc = useQueryClient();
  const userId = useUserId();
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
    onSuccess: async (outcome) => {
      qc.setQueryData(key(userId), outcome);
      if (outcome === 'confirmed') track('age_check_passed');
      // First run's Wants held for this answer: saved once it's yes, dropped if it's no.
      await settled(qc, outcome);
    },
    // Shown inline by the form.
    onError: () => {},
  });
}
