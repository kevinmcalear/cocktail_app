import * as Device from 'expo-device';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, Headline, PressableScale } from '@/components/ds';
import { pickDrinkPhotos, takeDrinkPhoto } from '@/components/drink/drinkImages';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useDeleteDrinkPhoto, useDrinkPhotos, type DrinkPhoto } from '@/hooks/useDrinkPhotos';
import { confirmAsync, showMessage } from '@/lib/dialogs';
import { photoCredit } from '@/lib/drinkPhotos';

import { useAgeGate } from '../safety/AgeGate';
import { ReportAction } from '../safety/ReportSheet';
import { AddDrinkPhotoSheet } from './AddDrinkPhotoSheet';
import { PhotoViewer } from './PhotoViewer';

/**
 * People's photos of the drink, each credited ("Photo by Jo · ranked it
 * 8.4"), and a way to add yours. Signed-in only, like rankings. Open one to
 * see it full screen, delete yours or report someone else's.
 */
export function PeoplePhotos({ itemId, name, glass, wide }: { itemId: string; name: string; glass: string | null; wide: boolean }) {
  const signedIn = useSignedIn();
  const { data: photos = [] } = useDrinkPhotos(itemId);
  const ageGate = useAgeGate();
  const remove = useDeleteDrinkPhoto(itemId);
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState<DrinkPhoto | null>(null);
  if (!signedIn) return null;
  // The native picker throws, killing the app, where there's no camera (simulators).
  const camera = Platform.OS !== 'web' && Device.isDevice;

  const choose = (shoot: boolean) =>
    ageGate.gate(async () => {
      try {
        const uri = shoot ? await takeDrinkPhoto() : (await pickDrinkPhotos())[0];
        if (uri) setPicked(uri);
      } catch {
        showMessage(shoot ? "Couldn't open the camera" : "Couldn't open your photos", 'Try again, or choose a photo from your library.');
      }
    });

  const deleteOpen = async (photo: DrinkPhoto) => {
    const sure = await confirmAsync({ title: 'Delete your photo?', message: `It comes off ${name} for everyone.`, confirmText: 'Delete', destructive: true });
    if (sure) remove.mutate(photo.id, { onSuccess: () => setOpen(null) });
  };

  return (
    <View style={styles.section}>
      <Headline role="heading">Photos</Headline>
      {photos.length ? (
        <View style={styles.grid} role="list">
          {photos.map((p) => (
            <PressableScale
              key={p.id}
              role="button"
              accessibilityLabel={`${photoCredit(p)}. Open full screen`}
              onPress={() => setOpen(p)}
              style={[styles.tile, { width: wide ? '23%' : '48%' }]}
            >
              <DrinkImage source={p.imageUrl} glass={glass} accessibilityLabel={`${name}, ${photoCredit(p)}`} aspectRatio={4 / 5} radius="control" />
              <Caption tone="muted">{photoCredit(p)}</Caption>
            </PressableScale>
          ))}
        </View>
      ) : (
        <Body tone="muted">Had this one? Add your photo of it.</Body>
      )}
      {ageGate.underAge ? null : (
        <View style={styles.actions}>
          <Button label="Add a photo" icon="photo" variant="secondary" onPress={() => choose(false)} />
          {camera ? <Button label="Take one" icon="camera.fill" variant="ghost" onPress={() => choose(true)} /> : null}
        </View>
      )}
      <PhotoViewer
        photo={open ? { url: open.imageUrl, title: photoCredit(open) } : null}
        name={name}
        onClose={() => setOpen(null)}
        actions={
          open?.isMine ? (
            <Button label="Delete photo" icon="trash" variant="secondary" disabled={remove.isPending} onPress={() => void deleteOpen(open)} />
          ) : open ? (
            <ReportAction subject={`this photo of ${name}`} targets={[{ label: 'this photo', target: { kind: 'photo', photoId: open.id, itemId } }]} onMedia />
          ) : null
        }
      />
      {picked ? <AddDrinkPhotoSheet itemId={itemId} name={name} uri={picked} onClose={() => setPicked(null)} /> : null}
      {ageGate.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
