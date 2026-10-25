import { useRouter, type Href } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Surface, Title, useDs, useGutter } from '@/components/ds';
import { IngredientPhoto } from '@/components/ds/IngredientDrawing';
import { WebHead } from '@/components/WebHead';
import { layout, radius, space } from '@/constants/tokens';
import { useCheckMakerPhoto, useMakerPhotosWaiting, type WaitingMakerPhoto } from '@/hooks/useMakerPhotos';
import { itemHref } from '@/lib/itemRoutes';

/**
 * Moderators' list of bottle photos waiting for a check: a maker team's
 * first photos (ppl-maker board, Kevin's call of 25 Oct). Keep shows it and
 * lets that maker's next photos show at once; Take it off puts the bottle
 * back to its drawing.
 * ponytail: a plain list, like Profile claims; no reasons or history yet.
 */
export function MakerPhotosReview() {
  return (
    <BackbarTheme>
      <Page />
    </BackbarTheme>
  );
}

function Page() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { data: photos, isLoading, error } = useMakerPhotosWaiting();
  const check = useCheckMakerPhoto();

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Bottle photos</title>
      </WebHead>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.readable}>
          <Title>Bottle photos</Title>
          <Body tone="muted">A brand’s first photos wait here. Check it’s their bottle, front on, with the label as it is. Once you keep one, that brand’s next photos show straight away.</Body>
          {check.error ? <Caption tone="accent" role="alert">{check.error.message}</Caption> : null}
          {isLoading ? <Caption tone="muted">Loading photos…</Caption> : null}
          {error ? <Body tone="muted">Couldn’t load photos. Check your connection and try again.</Body> : null}
          {photos && !photos.length ? <Body tone="muted">No photos waiting. Only moderators see them here.</Body> : null}
          <View role="list" style={styles.list}>
            {photos?.map((p) => (
              <PhotoCard
                key={p.item_id}
                photo={p}
                busy={check.isPending}
                onBottle={() => router.push(itemHref('Ingredient', p.item_id) as Href)}
                onMaker={() => router.push(`/p/${p.maker_handle}` as Href)}
                onCheck={(keep) => check.mutate({ itemId: p.item_id, keep })}
              />
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton accessibilityLabel="Back" icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </View>
  );
}

function PhotoCard({ photo, busy, onBottle, onMaker, onCheck }: { photo: WaitingMakerPhoto; busy: boolean; onBottle: () => void; onMaker: () => void; onCheck: (keep: boolean) => void }) {
  const ds = useDs();
  return (
    <Surface style={styles.card}>
      <View role="listitem" style={styles.row}>
        <View style={[styles.photo, { backgroundColor: ds.c.paper }]}>
          <IngredientPhoto url={photo.url} />
        </View>
        <View style={styles.words}>
          <Caption tone="muted">{new Date(photo.added_at).toLocaleDateString()}</Caption>
          <Button label={photo.name} variant="ghost" size="sm" accessibilityHint="Opens the bottle" onPress={onBottle} />
          <Button label={`From ${photo.maker_name}`} variant="ghost" size="sm" accessibilityHint="Opens the maker's page" onPress={onMaker} />
          <View style={styles.actions}>
            <Button label="Keep" disabled={busy} accessibilityHint={`Shows it on ${photo.name}`} onPress={() => onCheck(true)} />
            <Button label="Take it off" variant="secondary" disabled={busy} accessibilityHint="The bottle goes back to its drawing" onPress={() => onCheck(false)} />
          </View>
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 960, alignSelf: 'center', gap: space.md },
  controls: { position: 'absolute' },
  list: { gap: space.md, marginTop: space.md },
  card: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  photo: { width: 160, height: 160, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
  words: { flex: 1, minWidth: 200, gap: space.xs, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.sm },
});
