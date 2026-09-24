import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Alert } from 'react-native';

import { imageExtFromUri, uriToBase64 } from '@/lib/imageBase64';
import { supabase } from '@/lib/supabase';

/** Asks for photo access and lets the user pick photos; returns their local URIs. */
export async function pickDrinkPhotos(): Promise<string[]> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'We need access to your photos.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 5],
    quality: 0.8,
  });
  return result.canceled ? [] : result.assets.map((asset) => asset.uri);
}

/** Uploads a local photo to the drinks bucket at `folder/`; returns its new `images` row id. */
export async function uploadDrinkPhoto(uri: string, folder: string): Promise<{ id: string; url: string } | null> {
  const ext = imageExtFromUri(uri);
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
  const arrayBuffer = decode(await uriToBase64(uri));

  const { error: uploadError } = await supabase.storage.from('drinks').upload(fileName, arrayBuffer, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: false,
  });
  if (uploadError) return null;

  const { data: publicUrlData } = supabase.storage.from('drinks').getPublicUrl(fileName);
  const { data: imgData, error: imgError } = await supabase
    .from('images')
    .insert({ url: publicUrlData.publicUrl })
    .select()
    .single();
  if (imgError || !imgData) return null;
  return { id: imgData.id, url: publicUrlData.publicUrl };
}

/**
 * The `images` row id for a photo being saved: an already-hosted URL is
 * looked up (or recorded), and a local file is uploaded to `folder/`.
 */
export async function imageIdFor(uri: string, folder: string): Promise<string | null> {
  try {
    if (uri.startsWith('http')) {
      const { data: existing } = await supabase.from('images').select('id').eq('url', uri).limit(1).maybeSingle();
      if (existing) return existing.id;
      const { data: created, error } = await supabase.from('images').insert({ url: uri }).select().single();
      return !error && created ? created.id : null;
    }
    return (await uploadDrinkPhoto(uri, folder))?.id ?? null;
  } catch (error) {
    console.error('Image upload flow exception:', error);
    return null;
  }
}

/** Replaces an item's photo links with `imageIds`, in order. */
export async function setItemImages(itemId: string, imageIds: string[], { replace }: { replace: boolean }) {
  if (replace) {
    // Remove the old links first, so the new order applies and nothing duplicates.
    const { error } = await supabase.from('item_images').delete().eq('item_id', itemId);
    if (error) throw error;
  }
  if (imageIds.length === 0) return;
  const { error } = await supabase
    .from('item_images')
    .insert(imageIds.map((imageId, index) => ({ item_id: itemId, image_id: imageId, sort_order: index })));
  if (error) throw error;
}
