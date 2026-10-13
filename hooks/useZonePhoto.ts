import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { uriToBase64 } from '@/lib/imageBase64';
import { supabase, UPLOAD_CACHE_SECONDS } from '@/lib/supabase';

/**
 * "Add a photo of this fridge" (tools-backbar-desktop): pick a photo, store it
 * in the drinks bucket under backbar/<bar id>/ (the storage policy allows that
 * folder, with the daily upload limit), then set it as the zone's photo. The
 * bar_zones update policy decides who may. Resolves false when the person cancels.
 */
export function useZonePhoto(barId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (zoneId: string): Promise<boolean> => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') throw new Error('Allow access to your photos to add one.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.85 });
      if (result.canceled || !result.assets?.length) return false;
      const uri = result.assets[0].uri;
      const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const path = `backbar/${barId}/${zoneId}-${Date.now()}.${safeExt}`;
      const { error: upload } = await supabase.storage.from('drinks').upload(path, decode(await uriToBase64(uri)), {
        contentType: `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`,
        upsert: false,
        cacheControl: UPLOAD_CACHE_SECONDS,
      });
      if (upload) throw upload;
      const url = supabase.storage.from('drinks').getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.from('bar_zones').update({ photo_url: url }).eq('id', zoneId).eq('bar_id', barId!);
      if (error) throw error;
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bar-zones', barId] }),
  });
}
