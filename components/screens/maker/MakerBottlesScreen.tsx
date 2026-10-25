import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, Chip, Display, DsText, GlassButton, PressableScale, Surface, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { NoteSheet } from '@/components/feedback/NoteSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WebHead } from '@/components/WebHead';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useMakerBottles, type MakerBottle } from '@/hooks/useMakers';
import { useBottleUses, useMakerBottlePhotos, useOnMakerTeam } from '@/hooks/useMakerPhotos';
import { usePhotoFolder } from '@/hooks/usePhotoFolder';
import { useProfile } from '@/hooks/useProfiles';
import { pickPhotoFolder } from '@/lib/photoFolder';

import { BottlePhotoSheet } from './BottlePhotoSheet';
import { FolderTray } from './FolderTray';
import { MakerBottleRow } from './MakerBottleRow';

type Filter = 'all' | 'need' | 'have';

/**
 * Your bottles (ppl-maker board, step 2): every catalogue bottle that names
 * this maker, each with its drawing or its photo, for the maker's own team.
 * `welcome` is the claim's hand-off: the page has just become theirs.
 * ponytail: one page of the maker's bottles (useMakerBottles caps at 200).
 */
export function MakerBottlesScreen({ profileRef, welcome }: { profileRef: string; welcome: boolean }) {
  return (
    <BackbarTheme>
      <Page profileRef={profileRef} welcome={welcome} />
    </BackbarTheme>
  );
}

function Page({ profileRef, welcome }: { profileRef: string; welcome: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { data: profile, isLoading } = useProfile(profileRef);
  const { onTeam, loading: teamLoading } = useOnMakerTeam(profile?.bar_id);
  const { data: bottles = [], isLoading: bottlesLoading } = useMakerBottles(profile?.id);
  const { data: photos = {} } = useMakerBottlePhotos(profile?.id, onTeam);
  const { data: uses = {} } = useBottleUses(bottles.map((b) => b.id));
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<MakerBottle | null>(null);
  const [tellUs, setTellUs] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const folder = usePhotoFolder(profile?.id ?? '', bottles);
  const wide = useBreakpoint() !== 'phone';

  const withPhoto = bottles.filter((b) => photos[b.id]).length;
  const shown = bottles.filter((b) => (filter === 'all' ? true : filter === 'have' ? !!photos[b.id] : !photos[b.id]));
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/p/${profileRef}` as Href));

  const body = (() => {
    if (isLoading || teamLoading) return <Caption tone="muted">Loading…</Caption>;
    if (!profile || profile.kind !== 'maker') return <Body tone="muted">There’s no maker page here.</Body>;
    if (!onTeam) return <Body tone="muted">{`Only ${profile.display_name}’s own team can add photos of its bottles.`}</Body>;
    if (folder.photos.length) return <FolderTray folder={folder} bottles={bottles} photos={photos} maker={profile.display_name} />;
    const addMany = (
      <Button
        label={wide ? 'Add a folder of photos' : 'Add photos'}
        icon={wide ? 'folder.fill' : 'photo'}
        variant="secondary"
        style={wide ? null : styles.addMany}
        onPress={() => {
          setPickError(null);
          void pickPhotoFolder().then(folder.add, (e: Error) => setPickError(e.message));
        }}
      />
    );
    return (
      <View style={styles.page}>
        {welcome ? <Welcome name={profile.display_name} /> : null}
        <View style={wide ? styles.headRow : null}>
          <View style={styles.head}>
            <Display role="heading">Your bottles</Display>
            <Caption tone="muted">
              {bottlesLoading ? 'Loading bottles…' : `${bottles.length} ${bottles.length === 1 ? 'bottle' : 'bottles'} in the catalogue · ${withPhoto} with a photo`}
            </Caption>
          </View>
          {bottles.length ? addMany : null}
        </View>
        {pickError ? <Caption tone="accent" role="alert">{pickError}</Caption> : null}
        {bottles.length ? (
          <View role="radiogroup" aria-label="Show" style={styles.chips}>
            <Chip label="All" count={bottles.length} selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Need a photo" count={bottles.length - withPhoto} selected={filter === 'need'} onPress={() => setFilter('need')} />
            <Chip label="Have a photo" count={withPhoto} selected={filter === 'have'} onPress={() => setFilter('have')} />
          </View>
        ) : bottlesLoading ? null : (
          <Body tone="muted">{`No catalogue bottles name ${profile.display_name} yet.`}</Body>
        )}
        <View role="list">
          {shown.map((b) => (
            <MakerBottleRow key={b.id} bottle={b} photo={photos[b.id] ?? null} uses={uses[b.id] ?? 0} onPicture={() => setOpen(b)} />
          ))}
        </View>
        <PressableScale role="button" accessibilityLabel="A bottle missing or wrong? Tell us" onPress={() => setTellUs(true)} style={styles.tellUs}>
          <IconSymbol name="flag" size={16} color={ds.accentText} />
          <DsText variant="label" color={ds.accentText}>A bottle missing or wrong? Tell us</DsText>
        </PressableScale>
        {tellUs ? (
          <NoteSheet
            visible
            onClose={() => setTellUs(false)}
            about={{ screen: 'Your bottles', barId: profile.bar_id, barName: profile.display_name }}
            ask={{ title: 'What’s missing or wrong?', field: 'Which bottle, and what to fix' }}
          />
        ) : null}
        {open ? <BottlePhotoSheet profileId={profile.id} bottle={open} current={photos[open.id] ?? null} onClose={() => setOpen(null)} /> : null}
      </View>
    );
  })();

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{profile ? `Your bottles · ${profile.display_name}` : 'Your bottles'}</title>
      </WebHead>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.readable}>{body}</View>
      </ScrollView>
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton accessibilityLabel={profile ? `Back to ${profile.display_name}` : 'Back'} icon="chevron.left" onPress={back} />
      </View>
    </View>
  );
}

/** The claim's hand-off: the page is theirs, and what to do first. */
function Welcome({ name }: { name: string }) {
  const ds = useDs();
  return (
    <Surface style={[styles.welcome, { borderColor: ds.accentText }]}>
      <View style={[styles.tick, { backgroundColor: ds.accentFill.fill }]} aria-hidden>
        <IconSymbol name="checkmark" size={18} color={ds.accentFill.text} />
      </View>
      <View role="status" style={styles.flex}>
        <Body style={styles.bold}>{`${name} is yours`}</Body>
        <Caption tone="muted">Add photos of your bottles. Until then bars see our drawings.</Caption>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  controls: { position: 'absolute' },
  page: { gap: space.lg },
  head: { flex: 1, minWidth: 0, gap: space.xs },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  addMany: { alignSelf: 'flex-start', marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.card },
  tick: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  tellUs: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.sm, minHeight: layout.minTapTarget },
  bold: { fontFamily: fontFamilies.bodySemiBold },
});
