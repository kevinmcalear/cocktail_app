import { decode } from 'base64-arraybuffer';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/ctx/AuthContext';
import { supabase, UPLOAD_CACHE_SECONDS } from '@/lib/supabase';

/**
 * Saves a picked photo as your account picture: uploads it to your own folder
 * in the avatars bucket (the only place get_bar_members trusts), then points
 * your account at it, and your public profile too unless you hide it there.
 */
export function useSaveProfilePhoto() {
  const { user, updateProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ uri, base64 }: { uri: string; base64: string }) => {
      if (!user) throw new Error('Sign in first.');
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpeg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, decode(base64), { contentType: `image/${ext}`, upsert: false, cacheControl: UPLOAD_CACHE_SECONDS });
      if (uploadError) throw uploadError;
      const { publicUrl } = supabase.storage.from('avatars').getPublicUrl(path).data;
      const { error } = await updateProfile({ avatarUrl: publicUrl });
      if (error) throw error;
      // The profile's copy follows the account photo (and shows_photo) in a trigger.
      const refreshed = await supabase.rpc('refresh_my_profile_photo');
      if (refreshed.error) throw refreshed.error;
    },
    // Your page under any link it was opened by.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
    onError: () => {},
  });
}
