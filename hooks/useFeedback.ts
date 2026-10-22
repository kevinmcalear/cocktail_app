import { useMutation } from '@tanstack/react-query';

import { useUserId } from '@/ctx/AuthContext';
import { feedbackError, type FeedbackRow } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';

/**
 * Sends a note to the Cocktail team (the feedback table): Tell us and Report
 * a problem. Errors come back as words (the daily limit, no connection).
 */
export function useSendFeedback() {
  const userId = useUserId();
  return useMutation({
    mutationFn: async (row: FeedbackRow) => {
      if (!userId) throw new Error(feedbackError(null, null));
      const { error } = await supabase.from('feedback').insert(row);
      if (!error) return;
      let today: number | null = null;
      if (error.code === '42501') {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('user_id', userId).gt('created_at', since);
        today = count;
      }
      throw new Error(feedbackError(error, today));
    },
    onError: () => {},
  });
}
