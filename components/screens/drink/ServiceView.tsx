import { useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Caption, DrinkImage, DsText, GlassButton, LockedSection, Segmented, Spec, Tag, Title, useDs, useGutter } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useServiceNotes } from '@/hooks/useServiceNotes';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { ItemImageLink } from '@/lib/itemImages';
import { roleLabel } from '@/lib/roles';
import { serviceSpec, serviceStyleLabel } from '@/lib/service';
import { EMPTY_SERVICE_NOTES } from '@/lib/serviceNotes';
import { photoShots, photosTaken, SERVICE_OPENS_AT, type ServiceAngle } from '@/lib/servicePhotos';
import { specLines, type PresentationRecipe } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

const ANGLES: ServiceAngle[] = ['side', 'top', 'garnish', 'handoff'];

/**
 * The full-screen service view (board drink-phone-service): the drink from
 * each service angle, a sketch until someone photographs it, then how the
 * garnish goes on, the hand-off and what's poured at the station. Opens at
 * Employee on a venue drink; the station split opens with the amounts.
 */
export function ServiceView({ item, angle }: { item: DatabaseItem; angle?: string }) {
  const venue = useActiveVenue().venues.find((v) => v.id === item.bar_id);
  return (
    <BackbarTheme>
      <BrandProvider accent={venue?.accent ?? undefined} displayFace={venue?.displayFace}>
        <View style={styles.flex}>
          <Service item={item} start={ANGLES.includes(angle as ServiceAngle) ? (angle as ServiceAngle) : 'side'} venueName={venue?.name ?? null} />
        </View>
      </BrandProvider>
    </BackbarTheme>
  );
}

function Service({ item, start, venueName }: { item: DatabaseItem; start: ServiceAngle; venueName: string | null }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { width, height } = useWindowDimensions();
  const [angle, setAngle] = useState<ServiceAngle>(start);
  const role = useEffectiveRole(item.bar_id);
  const unlocked = !item.bar_id || role >= SERVICE_OPENS_AT;
  const { access, amountsOpenAt } = useSpecAccess(item.id, item.bar_id);
  const { data: notes = EMPTY_SERVICE_NOTES } = useServiceNotes(item.id, item.bar_id, unlocked);
  const shots = photoShots(item.item_images as ItemImageLink[] | undefined);
  const shot = shots.find((s) => s.angle === angle)!;
  const lines = specLines(item.recipes as PresentationRecipe[] | undefined);
  const spec = serviceSpec(lines);
  const style = serviceStyleLabel(item.service_style);
  // Glass takes the picture's colours: dark on a photo, light on the drawing's paper.
  const glass = shot.picture && !shot.picture.isSketch ? 'dark' : 'light';
  const heroHeight = Math.min(Math.max(width * 0.9, 320), height * 0.5);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/cocktail/${item.id}` as Href));

  return (
    <View style={[styles.flex, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
        <View style={{ height: heroHeight, backgroundColor: ds.c.paper }}>
          <DrinkImage
            source={shot.picture?.url ?? null}
            generated={shot.picture?.isSketch}
            itemId={shot.picture ? undefined : item.id}
            accessibilityLabel={`${item.name}, ${shot.label}${shot.picture && !shot.picture.isSketch ? '' : ', sketch, no photo yet'}`}
            radius={0}
            style={StyleSheet.flatten([styles.fill, { height: heroHeight, aspectRatio: undefined }])}
          />
        </View>
        {/* The angles as a full-width control under the picture (board drink-phone-service). */}
        <View style={[styles.angles, { paddingHorizontal: gutter }]}>
          <Segmented
            accessibilityLabel="Angle"
            options={shots.slice(1).map((s) => ({ value: s.angle as ServiceAngle, label: s.label }))}
            value={angle}
            onChange={setAngle}
            variant="pill"
            stretch
          />
        </View>
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <View>
            <Caption tone="muted">{['Service', venueName].filter(Boolean).join(' · ')}</Caption>
            <Title>{item.name}</Title>
          </View>
          {unlocked ? null : (
            <LockedSection title="Service" unlocked={false} opensAt={roleLabel(SERVICE_OPENS_AT)}>
              {null}
            </LockedSection>
          )}
          {unlocked ? (
            <>
            {notes.garnish ? <Group title="GARNISH"><Body>{notes.garnish}</Body></Group> : null}
            {notes.handoff.length ? (
              <Group title="HAND-OFF">
                <View role="list">
                  {notes.handoff.map((step, i) => (
                    <View key={`${i}-${step}`} role="listitem" style={[styles.step, { borderBottomColor: ds.c.line }]}>
                      <View style={[styles.bullet, { backgroundColor: ds.accentText }]} />
                      <Body style={styles.flex}>{step}</Body>
                    </View>
                  ))}
                </View>
              </Group>
            ) : null}
            {!notes.garnish && !notes.handoff.length ? <Body tone="muted">No garnish or hand-off notes yet. Editors add them on the drink page.</Body> : null}
            {access.amounts && lines.length ? (
              <Group title="AT THE STATION" tag={style}>
                {spec.pour ? <Line amount={spec.pour} name={`${item.name} base, from the bottle`} /> : null}
                {spec.station.map((l) => (
                  <Line key={l.key} amount={l.amount ?? ''} name={l.ingredient} />
                ))}
                {!spec.pour && !spec.station.length ? <Caption tone="muted">Nothing at the station. Pour and serve.</Caption> : null}
              </Group>
            ) : lines.length ? (
              <View style={styles.lock}>
                <IconSymbol name="lock.fill" size={13} color={ds.c.muted} />
                <Caption tone="muted">The station split opens at {amountsOpenAt}</Caption>
              </View>
            ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.controls, { top: (Platform.OS === 'ios' ? space.sm : insets.top) + space.sm, left: gutter, right: gutter }]}>
        <GlassButton accessibilityLabel="Back to the drink" icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} scheme={glass} onPress={back} />
        <GlassButton
          accessibilityLabel={`Photos, ${photosTaken(shots)} of ${shots.length}. Open the shot list`}
          label={`Photos ${photosTaken(shots)} of ${shots.length}`}
          scheme={glass}
          onPress={() => router.push({ pathname: '/cocktail/[id]/photos', params: { id: item.id, angle } } as unknown as Href)}
        />
      </View>
    </View>
  );
}

function Group({ title, tag, children }: { title: string; tag?: string | null; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Caption tone="muted" style={styles.eyebrow}>
          {title}
        </Caption>
        {tag ? <Tag label={tag} /> : null}
      </View>
      {children}
    </View>
  );
}

function Line({ amount, name }: { amount: string; name: string }) {
  const ds = useDs();
  return (
    <View accessible accessibilityLabel={`${amount} ${name}`} style={[styles.line, { borderBottomColor: ds.c.line }]}>
      <Spec tone="accent" style={styles.amount}>
        {amount}
      </Spec>
      <DsText style={styles.flex}>{name}</DsText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%' },
  angles: { paddingTop: space.lg },
  body: { gap: space.lg, paddingTop: space.xl },
  group: { gap: space.xs },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, borderBottomWidth: StyleSheet.hairlineWidth },
  bullet: { width: 6, height: 6, borderRadius: radius.pill },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, borderBottomWidth: StyleSheet.hairlineWidth },
  amount: { width: 96 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
});
