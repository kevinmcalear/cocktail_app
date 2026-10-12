import * as Device from 'expo-device';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, DrinkImage, GlassButton, Headline, PressableScale, Title, useDs, useGutter } from '@/components/ds';
import { pickDrinkPhotos, takeDrinkPhoto } from '@/components/drink/drinkImages';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useAddServicePhoto } from '@/hooks/useServicePhotos';
import { showMessage } from '@/lib/dialogs';
import type { ImageAngle, ItemImageLink } from '@/lib/itemImages';
import { roleLabel } from '@/lib/roles';
import { photoShots, photosTaken, type PhotoShot } from '@/lib/servicePhotos';
import type { DatabaseItem } from '@/types/types';

/** What the selected slot says about itself, in words. */
function slotNote(shot: PhotoShot): { lead: string; rest: string } {
  const what = shot.label.toLowerCase();
  if (shot.status === 'photo') return { lead: 'Photographed.', rest: 'A new photo replaces it.' };
  if (shot.status === 'outdated') return { lead: 'May be out of date.', rest: 'The spec changed after it was taken. An editor confirms it; photos are never swapped silently.' };
  return { lead: `No ${what} photo yet.`, rest: 'The drawing is made from the spec. It stands in until someone photographs the real thing.' };
}

/**
 * A drink's photos and shot list (board drink-phone-shotlist): the hero and
 * the four service angles in a strip, the selected one large, a way to take or
 * choose its photo, and every slot's status (to do, done, out of date).
 */
export function PhotosScreen({ item, angle }: { item: DatabaseItem; angle?: string }) {
  const venue = useActiveVenue().venues.find((v) => v.id === item.bar_id);
  return (
    <BackbarTheme>
      <BrandProvider accent={venue?.accent ?? undefined}>
        <Photos item={item} start={angle} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function Photos({ item, start }: { item: DatabaseItem; start?: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { width, height } = useWindowDimensions();
  const shots = photoShots(item.item_images as ItemImageLink[] | undefined);
  const [angle, setAngle] = useState<ImageAngle>(shots.some((s) => s.angle === start) ? (start as ImageAngle) : (shots.find((s) => s.status !== 'photo')?.angle ?? 'hero'));
  const shot = shots.find((s) => s.angle === angle)!;
  const { data: caps } = useCapabilities(item.bar_id);
  const { data: opensAt } = useCapabilityOpensAt(item.bar_id, 'photos');
  const canAdd = !item.bar_id || !!caps?.includes('photos');
  const add = useAddServicePhoto(item.id);
  const camera = Platform.OS !== 'web' && Device.isDevice;
  const previewHeight = Math.min(width, height * 0.42);
  const note = slotNote(shot);
  const choose = async (shoot: boolean) => {
    try {
      const uri = shoot ? await takeDrinkPhoto() : (await pickDrinkPhotos())[0];
      if (uri) add.mutate({ angle: shot.angle as 'hero', uri, replaces: shot.photoLinkIds });
    } catch {
      showMessage(shoot ? "Couldn't open the camera" : "Couldn't open your photos", 'Try again, or choose a photo from your library.');
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
        <View style={{ height: previewHeight, backgroundColor: ds.c.paper }}>
          <DrinkImage source={shot.picture?.url ?? null} generated={shot.picture?.isSketch} itemId={shot.picture ? undefined : item.id} accessibilityLabel={`${item.name}, ${shot.label}`} radius={0} style={StyleSheet.flatten([styles.fill, { height: previewHeight, aspectRatio: undefined }])} />
        </View>
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <View>
            <Caption tone="muted">{`Photos · ${photosTaken(shots)} of ${shots.length}`}</Caption>
            <Title>{item.name}</Title>
          </View>
          <View role="radiogroup" accessibilityLabel="Angles" style={styles.strip}>
            {shots.map((s) => {
              const on = s.angle === angle;
              return (
                <PressableScale key={s.angle} role="radio" aria-checked={on} accessibilityLabel={`${s.label}, ${s.status === 'photo' ? 'photo' : s.status === 'outdated' ? 'photo, may be out of date' : 'no photo yet'}`} onPress={() => setAngle(s.angle)} style={styles.slot}>
                  <View style={[styles.thumb, { borderColor: on ? ds.accentText : 'transparent' }]}>
                    <DrinkImage source={s.picture?.url ?? null} generated={s.picture?.isSketch} itemId={s.picture ? undefined : item.id} accessibilityLabel="" aspectRatio={1} radius="control" />
                  </View>
                  <Caption tone={on ? 'ink' : 'muted'}>{s.label}</Caption>
                </PressableScale>
              );
            })}
          </View>
          <Body>
            {note.lead} <Body tone="muted">{note.rest}</Body>
          </Body>
          {canAdd ? (
            <View style={styles.actions}>
              {camera ? <Button label="Take photo" icon="camera.fill" disabled={add.isPending} onPress={() => void choose(true)} /> : null}
              <Button label={add.isPending ? 'Uploading…' : 'Choose from library'} icon="photo" variant={camera ? 'secondary' : 'primary'} disabled={add.isPending} onPress={() => void choose(false)} />
            </View>
          ) : (
            <Caption tone="muted">{`Adding photos opens at ${opensAt ? roleLabel(opensAt) : 'Bartender'}.`}</Caption>
          )}
          <View style={styles.list}>
            <Headline role="heading">Shot list</Headline>
            {shots.map((s) => (
              <View key={s.angle} accessible accessibilityLabel={`${s.label}, ${s.brief}. ${s.status === 'photo' ? 'Done' : s.status === 'outdated' ? 'May be out of date' : 'To do'}`} style={[styles.row, { borderBottomColor: ds.c.line }]}>
                <Mark status={s.status} />
                <View style={styles.flex}>
                  <Body>{`${s.label}, ${s.brief.toLowerCase()}`}</Body>
                  {s.status === 'outdated' ? <Caption tone="muted">May be out of date</Caption> : null}
                </View>
              </View>
            ))}
            {shots.some((s) => s.status === 'outdated') ? <Caption tone="muted">The spec changed after a photo was taken. An editor confirms it; photos are never swapped silently.</Caption> : null}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.controls, { top: (Platform.OS === 'ios' ? space.sm : insets.top) + space.sm, left: gutter }]}>
        <GlassButton accessibilityLabel="Back" icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} scheme={shot.picture && !shot.picture.isSketch ? 'dark' : 'light'} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/cocktail/${item.id}` as Href))} />
      </View>
    </View>
  );
}

/** To do, done, or out of date: a mark and the words beside it, never colour alone. */
function Mark({ status }: { status: PhotoShot['status'] }) {
  const ds = useDs();
  if (status === 'photo') {
    return (
      <View style={[styles.mark, { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill }]} aria-hidden>
        <IconSymbol name="checkmark" size={14} color={ds.accentFill.text} />
      </View>
    );
  }
  return <View style={[styles.mark, { borderColor: status === 'outdated' ? ds.accentText : ds.c.lineStrong, borderStyle: status === 'outdated' ? 'dashed' : 'solid' }]} aria-hidden />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%' },
  body: { gap: space.lg, paddingTop: space.xl },
  strip: { flexDirection: 'row', gap: space.sm },
  slot: { flex: 1, alignItems: 'center', gap: space.xs },
  thumb: { width: '100%', borderWidth: 2, borderRadius: radius.control + 2, overflow: 'hidden' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  mark: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute' },
});
