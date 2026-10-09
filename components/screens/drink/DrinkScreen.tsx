import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Button, Caption, Display, GlassButton, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDilutionDefaults } from '@/hooks/useDrinkMath';
import { useDrinkPhotos } from '@/hooks/useDrinkPhotos';
import { useMode } from '@/hooks/useMode';
import { useDrinkMenuRuns } from '@/hooks/useProfiles';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { useSpecLock } from '@/hooks/useSpecLock';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { heroPictures } from '@/lib/drinkPhotos';
import { orderedPictures, type ItemImageLink } from '@/lib/itemImages';
import { withPastMenuTag } from '@/lib/menuEditions';
import { pageShowsDescriptions, specLockNote } from '@/lib/pageVisibility';
import { specLines, type PresentationRecipe, type SpecLevels } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import { BatchSheet } from '../batch/BatchSheet';
import { PublishSection } from '../publishing/PublishSection';
import { RankActions } from '../rank/RankActions';
import { useAgeGate } from '../safety/AgeGate';
import { ReportAction } from '../safety/ReportSheet';
import { DrinkControls } from './DrinkControls';
import { DrinkFacts, DrinkTags } from './DrinkFacts';
import { DrinkHero } from './DrinkHero';
import type { ShownPicture } from './PictureViewer';
import { AllergensSection } from './AllergensSection';
import { ClassicLink } from './ClassicLink';
import { ClassicNote } from './ClassicNote';
import { CostSection } from './CostSection';
import { FamilyTree } from './FamilyTree';
import { FlavorSection } from './FlavorSection';
import { ServiceSection } from './ServiceSection';
import { SpecLockPanel } from './SpecLockPanel';
import { SpecSection } from './SpecSection';
import { GlassSheet } from './GlassSheet';
import { HistorySection } from './HistorySection';
import { MenuRuns } from './MenuRuns';
import { PeoplePhotos } from './PeoplePhotos';
import { StrengthSheet } from './StrengthSheet';
import { useDrinkFacts } from './useDrinkFacts';

export interface DrinkScreenProps {
  item: DatabaseItem;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  inStudyPile: boolean;
  onToggleStudyPile: () => void;
  canEdit: boolean;
  onEdit: () => void;
  /** Shown as a modal. An iOS page sheet starts below the status bar, but the insets still count it. */
  sheet?: boolean;
  /** Open with the Batch sheet up (/cocktail/[id]/batch links here). */
  openBatch?: boolean;
  /** /dev/drink only: a bundled hero image and a simulated role. */
  preview?: { heroSource?: number | null; role: number; levels: SpecLevels };
}

/**
 * The redesigned drink page (read view). Editing still uses the existing
 * editor: onEdit hands over to it. The drink's own venue brands the page.
 */
export function DrinkScreen(props: DrinkScreenProps) {
  const { venues } = useActiveVenue();
  const venue = venues.find((v) => v.id === props.item.bar_id);
  return (
    <BackbarTheme>
      <BrandProvider accent={venue?.accent ?? undefined}>
        <DrinkPage {...props} />
      </BrandProvider>
    </BackbarTheme>
  );
}

export { DrinkLoading } from './DrinkLoading';

function DrinkPage({ item, isFavorite, onToggleFavorite, inStudyPile, onToggleStudyPile, canEdit, onEdit, sheet, openBatch, preview }: DrinkScreenProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = sheet && Platform.OS === 'ios' ? space.sm : insets.top;
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { width, height } = useWindowDimensions();
  const home = useMode().mode === 'home';
  const { access } = useSpecAccess(item.id, item.bar_id, preview);
  // A bar's drink whose page keeps the spec back: no spec, method or notes, just why (and on a Locked page, no description).
  const lock = useSpecLock(preview ? null : item).data;
  // Saving to your Collection (home mode) needs a confirmed age.
  const ageGate = useAgeGate();
  const toggleFavorite = () => (home && !isFavorite ? ageGate.gate(onToggleFavorite) : onToggleFavorite());
  const lines = specLines(item.recipes as PresentationRecipe[] | undefined);
  // Both modes: a party batch at home, a prep bottle at the bar.
  const canBatch = !lock && access.amounts && lines.some((l) => l.value !== null);
  const [batchOpen, setBatchOpen] = useState(!!openBatch);
  const [strengthOpen, setStrengthOpen] = useState(false);
  const [glassOpen, setGlassOpen] = useState(false);
  const role = useEffectiveRole(item.bar_id);
  const { data: dilutionDefaults } = useDilutionDefaults(preview ? null : item.bar_id);
  const venue = useActiveVenue().venues.find((v) => v.id === item.bar_id);
  // A bar's drink: when it was on the bar's menus. Ranking and collecting stay open either way.
  const { data: menuRuns = [] } = useDrinkMenuRuns(preview || item.bar_id ? null : item.id);

  const { facts, tags, glass, ice, method, methods, strength } = useDrinkFacts(item, {
    lines,
    amounts: access.amounts && !preview,
    dilutionDefaults,
    openStrength: () => setStrengthOpen(true),
    openGlass: preview ? undefined : () => setGlassOpen(true),
    specLocked: !!lock,
    measures: access.amounts && !lock,
  });
  const links = item.item_images as ItemImageLink[] | undefined;
  // No photo of its own: the newest one someone posted leads, credited under the name.
  const shown = heroPictures(orderedPictures(links), useDrinkPhotos(preview ? null : item.id).data);
  const heroPic = shown.pictures[0] ?? null;
  const pictures: ShownPicture[] = preview ? (preview.heroSource ? [{ url: preview.heroSource, isSketch: false, isOutdated: false }] : []) : shown.pictures;
  const heroHeight = wide ? height - top : Math.min(width, height * 0.42);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const body = (
    <View style={[styles.body, { paddingHorizontal: gutter }]}>
      <DrinkTags tags={withPastMenuTag(tags, menuRuns)} />
      <Display>{item.name}</Display>
      {item.description && pageShowsDescriptions(lock?.bar.visibility) ? <Body tone="muted">{item.description}</Body> : null}
      {!preview && shown.credit ? (
        <Caption
          tone="muted"
          role={heroPic?.sourceUrl ? 'link' : undefined}
          onPress={heroPic?.sourceUrl ? () => void Linking.openURL(heroPic.sourceUrl!) : undefined}
        >
          {shown.credit}
        </Caption>
      ) : null}
      <MenuRuns runs={menuRuns} />
      <View style={styles.actions}>
        {canBatch ? (
          <GlassButton
            accessibilityLabel="Batch: scale this drink into a bottle"
            label="Batch"
            icon="flask"
            onPress={() => setBatchOpen(true)}
          />
        ) : null}
        {preview ? null : <RankActions item={item} picture={heroPic} />}
        {preview || canEdit ? null : <ReportAction subject={item.name} targets={[{ label: item.name, target: { kind: 'item', itemId: item.id } }]} />}
      </View>
      <DrinkFacts facts={facts} columns={wide ? 4 : 2} />
      <AllergensSection itemId={item.id} barId={item.bar_id} preview={!!preview} />
      {home && !preview ? <FlavorSection itemId={item.id} /> : null}
      {preview ? null : <ClassicNote itemId={item.id} />}
      {lock ? (
        <SpecLockPanel
          note={specLockNote(lock.bar.name, !lock.bar.isClaimed, true)}
          action={
            <Button
              label={lock.bar.isClaimed ? `See ${lock.bar.name}` : 'Work here? Claim this page'}
              variant="secondary"
              onPress={() => router.push(`/p/${lock.bar.handle}` as Href)}
            />
          }
        />
      ) : (
        <SpecSection itemId={item.id} barId={item.bar_id} recipes={item.recipes as PresentationRecipe[] | undefined} preview={preview} />
      )}
      {item.notes && !lock ? (
        <View style={styles.notes}>
          <Headline role="heading">Bartender notes</Headline>
          <Body>{item.notes}</Body>
        </View>
      ) : null}
      {preview ? null : <PeoplePhotos itemId={item.id} name={item.name} glass={glass?.icon_key || glass?.name || null} wide={wide} />}
      {home ? null : (
        <ServiceSection
          itemId={item.id}
          barId={item.bar_id}
          name={item.name}
          links={links}
          canEdit={canEdit}
          glass={glass?.icon_key || glass?.name || null}
          wide={wide}
          lines={access.names ? lines : []}
          showLines={access.amounts}
          serviceStyle={item.service_style}
          preview={preview}
        />
      )}
      {preview ? null : <CostSection itemId={item.id} barId={item.bar_id} priceMinor={item.price_minor} canEdit={canEdit} />}
      {preview ? null : <HistorySection itemId={item.id} barId={item.bar_id} canEdit={canEdit} />}
      {preview ? null : <FamilyTree itemId={item.id} />}
      {preview || !canEdit ? null : <ClassicLink item={item} />}
      {preview ? null : <PublishSection itemId={item.id} barId={item.bar_id} />}
    </View>
  );

  const hero = <DrinkHero name={item.name} pictures={pictures} glass={glass?.icon_key || glass?.name || null} itemId={item.id} height={heroHeight} fade={!wide} />;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <View style={styles.row}>
          <View style={styles.heroColumn}>{hero}</View>
          <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: top + layout.minTapTarget + space.xl, paddingBottom: space.xxxl }}>
            <View style={styles.readable}>{body}</View>
          </ScrollView>
        </View>
      ) : (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
          {hero}
          <View style={{ marginTop: -space.xxl }}>{body}</View>
        </Animated.ScrollView>
      )}
      <DrinkControls
        media={pictures[0] && !pictures[0].isSketch ? 'photo' : 'paper'}
        top={top}
        heroHeight={heroHeight}
        scrollY={scrollY}
        wide={wide}
        isFavorite={isFavorite} onToggleFavorite={toggleFavorite}
        inStudyPile={inStudyPile} onToggleStudyPile={onToggleStudyPile}
        canEdit={canEdit} onEdit={onEdit}
      />
      {ageGate.sheet}
      {glassOpen ? (
        <GlassSheet
          visible
          onClose={() => setGlassOpen(false)}
          itemId={item.id}
          name={item.name}
          glass={glass}
          iceName={ice?.name ?? null}
          serveMl={item.serve_ml ?? null}
          icePerServeG={item.ice_per_serve_g ?? null}
          canEditDrink={canEdit}
          accent={venue?.accent ?? undefined}
        />
      ) : null}
      {canBatch && batchOpen ? (
        <BatchSheet
          visible
          onClose={() => setBatchOpen(false)}
          name={item.name}
          lines={lines}
          methodNames={methods}
          lockedUntil={null}
          dilutionPct={strength?.dilutionPct ?? null}
          abv={strength?.abv ?? null}
          serviceStyle={item.service_style ?? null}
          canEdit={canEdit}
          accent={venue?.accent ?? undefined}
        />
      ) : null}
      {strength ? (
        <StrengthSheet
          visible={strengthOpen}
          onClose={() => setStrengthOpen(false)}
          itemId={item.id}
          name={item.name}
          strength={strength}
          method={method}
          dilutionPct={item.dilution_pct ?? null}
          canEdit={canEdit}
          defaultsHref={item.bar_id && role >= 40 ? (`/settings/bar/${item.bar_id}/dilution` as Href) : null}
          accent={venue?.accent ?? undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  heroColumn: { width: '42%' },
  readable: { maxWidth: 720, width: '100%' },
  body: { gap: space.lg },
  notes: { gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
