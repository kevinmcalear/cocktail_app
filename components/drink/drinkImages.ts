import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Alert } from 'react-native';

import { imageExtFromUri, uriToBase64 } from '@/lib/imageBase64';
import { isHeroLink } from '@/lib/itemImages';
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

/** Asks for camera access and takes one photo; returns its local URI, or null if cancelled. */
export async function takeDrinkPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Camera access needed', 'Allow camera access in Settings to take drink photos.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 5], quality: 0.8 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
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

/**
 * Sets an item's hero picture links to `imageIds`, in order. With `replace`,
 * hero links not in the list are removed. Links that stay are updated in place
 * rather than deleted and re-created, so what the server knows about each one
 * (whether a photo may be out of date) survives the save. Service photos (side,
 * top, garnish, hand-off) belong to the drink page's Service section and are
 * never touched here.
 */
export async function setItemImages(itemId: string, imageIds: string[], { replace }: { replace: boolean }) {
  const { data: links, error } = await supabase
    .from('item_images')
    .select('id, image_id, sort_order, angle')
    .eq('item_id', itemId);
  if (error) throw error;
  const existing = (links ?? []).filter(isHeroLink);
  const servicePhotos = new Set((links ?? []).filter((link) => !isHeroLink(link)).map((link) => link.image_id));
  const linkByImage = new Map(existing.map((link) => [link.image_id, link]));
  const heroIds = imageIds.filter((id) => !servicePhotos.has(id));

  if (replace) {
    const keep = new Set(heroIds);
    const removed = existing.filter((link) => !keep.has(link.image_id)).map((link) => link.id);
    if (removed.length) {
      const { error: deleteError } = await supabase.from('item_images').delete().in('id', removed);
      if (deleteError) throw deleteError;
    }
  }

  const added: { item_id: string; image_id: string; sort_order: number }[] = [];
  for (const [index, imageId] of heroIds.entries()) {
    const link = linkByImage.get(imageId);
    if (!link) {
      added.push({ item_id: itemId, image_id: imageId, sort_order: index });
    } else if (Number(link.sort_order) !== index) {
      const { error: updateError } = await supabase.from('item_images').update({ sort_order: index }).eq('id', link.id);
      if (updateError) throw updateError;
    }
  }
  if (added.length) {
    const { error: insertError } = await supabase.from('item_images').insert(added);
    if (insertError) throw insertError;
  }
}
