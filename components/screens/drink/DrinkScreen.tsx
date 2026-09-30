import { useKeepAwake } from 'expo-keep-awake';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Caption, Display, GlassButton, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDilutionDefaults } from '@/hooks/useDrinkMath';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useMode } from '@/hooks/useMode';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { classifyMethod } from '@/lib/batch';
import { drinkStrength, formatAbv, formatAmount } from '@/lib/drinkMath';
import { orderedPictures, type ItemImageLink } from '@/lib/itemImages';
import { specLines, type PresentationRecipe, type SpecLevels } from '@/lib/spec';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { DatabaseItem } from '@/types/types';

import { PublishSection } from '../publishing/PublishSection';
import { RankActions } from '../rank/RankActions';
import { useAgeGate } from '../safety/AgeGate';
import { ReportAction } from '../safety/ReportSheet';
import { DrinkFacts, DrinkTags, type Fact } from './DrinkFacts';
import { DrinkHero } from './DrinkHero';
import type { ShownPicture } from './PictureViewer';
import { ClassicLink } from './ClassicLink';
import { FamilyTree } from './FamilyTree';
import { FloorSection } from './FloorSection';
import { FlavorSection } from './FlavorSection';
import { ServiceSection } from './ServiceSection';
import { SpecSection } from './SpecSection';
import { StrengthSheet } from './StrengthSheet';

export interface DrinkScreenProps {
  item: DatabaseItem;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  inStudyPile: boolean;
  onToggleStudyPile: () => void;
  canEdit: boolean;
  onEdit: () => void;
  /** /dev/drink only: a bundled hero image, a simulated role, and where Batch goes. */
  preview?: { heroSource?: number | null; role: number; levels: SpecLevels; onBatch?: () => void };
}

interface Named {
  id: string;
  name: string;
  icon_key?: string | null;
}

// Stored spelling in older rows; shown correctly.
const ORIGIN_LABEL: Record<string, string> = { Varient: 'Variant' };

function KeepAwake() {
  useKeepAwake();
  return null;
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

/** While the drink loads: the page's own ground, so there's no flash of the old theme. */
export function DrinkLoading() {
  return (
    <BackbarTheme>
      <LoadingGround />
    </BackbarTheme>
  );
}

function LoadingGround() {
  const ds = useDs();
  return <View style={[styles.screen, { backgroundColor: ds.c.ground }]} accessibilityLabel="Loading drink" />;
}

function DrinkPage({ item, isFavorite, onToggleFavorite, inStudyPile, onToggleStudyPile, canEdit, onEdit, preview }: DrinkScreenProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { width, height } = useWindowDimensions();
  const serviceMode = useSettingsStore((s) => s.serviceMode);
  const toggleServiceMode = useSettingsStore((s) => s.toggleServiceMode);
  const { data: dropdowns } = useDropdowns();
  const home = useMode().mode === 'home';
  const { access } = useSpecAccess(item.id, item.bar_id, preview);
  // Saving to your Collection (home mode) needs a confirmed age.
  const ageGate = useAgeGate();
  const toggleFavorite = () => (home && !isFavorite ? ageGate.gate(onToggleFavorite) : onToggleFavorite());
  const lines = specLines(item.recipes as PresentationRecipe[] | undefined);
  const canBatch = access.amounts && lines.some((l) => l.value !== null);
  const [strengthOpen, setStrengthOpen] = useState(false);
  const role = useEffectiveRole(item.bar_id);
  const { data: dilutionDefaults } = useDilutionDefaults(preview ? null : item.bar_id);
  const venue = useActiveVenue().venues.find((v) => v.id === item.bar_id);

  const find = (list: Named[] | undefined, id: string | null | undefined) => (id ? list?.find((x) => x.id === id) : undefined);
  const glass = find(dropdowns?.glassware as Named[], item.glassware_id);
  const methods = (item.item_methods ?? [])
    .map((m) => find(dropdowns?.methods as Named[], m.method_item_id)?.name)
    .filter((n): n is string => !!n);
  // Strength: the server's figures for every role; the line-by-line sheet
  // needs the amounts, so it only opens for roles that see them.
  const method = classifyMethod(methods);
  const strength = access.amounts && !preview ? drinkStrength(lines, method, { dilutionPct: item.dilution_pct, defaults: dilutionDefaults }) : null;
  const abv = formatAbv(item.abv);
  const openStrength = strength ? () => setStrengthOpen(true) : undefined;
  const strengthHint = strength ? 'Opens the ethanol in each line and the dilution' : undefined;
  const facts: Fact[] = ([
    glass && { label: 'Glass', value: glass.name },
    find(dropdowns?.iceTypes as Named[], item.ice_id) && { label: 'Ice', value: find(dropdowns?.iceTypes as Named[], item.ice_id)!.name },
    find(dropdowns?.families as Named[], item.family_id) && { label: 'Family', value: find(dropdowns?.families as Named[], item.family_id)!.name },
    abv ? { label: 'ABV', value: abv, sub: item.abv_source === 'calculated' ? 'from the spec' : 'typed in', onPress: openStrength, accessibilityHint: strengthHint } : null,
    item.serve_ml != null
      ? { label: 'Serve', value: formatAmount(item.serve_ml, 'ml'), sub: strength ? `after ${Number(strength.dilutionPct.toFixed(1))}% water` : 'after dilution', onPress: openStrength, accessibilityHint: strengthHint }
      : null,
    item.serve_abv != null ? { label: 'Serve ABV', value: formatAbv(item.serve_abv)!, sub: 'in the glass', onPress: openStrength, accessibilityHint: strengthHint } : null,
  ] as (Fact | null | undefined)[]).filter((f): f is Fact => !!f);
  const tags = [item.origin ? (ORIGIN_LABEL[item.origin] ?? item.origin) : null, ...methods].filter((t): t is string => !!t);
  const links = item.item_images as ItemImageLink[] | undefined;
  const itemPictures = orderedPictures(links);
  // The hero (first) picture's credit shows under the name.
  const heroPic = itemPictures[0] ?? null;
  const pictures: ShownPicture[] = preview ? (preview.heroSource ? [{ url: preview.heroSource, isSketch: false, isOutdated: false }] : []) : itemPictures;
  const heroHeight = wide ? height - insets.top : Math.min(width, height * 0.42);

  // Controls over the photo use dark glass and light ink; on wide screens the
  // right-hand ones sit over the page instead.
  const onPhoto = pictures.length > 0;
  const controls = (
    <View style={[styles.controls, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
      <GlassButton
        accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
        icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
        onMedia={onPhoto}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <View style={styles.controlsRight}>
        <GlassButton accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'} icon={isFavorite ? 'heart.fill' : 'heart'} onMedia={onPhoto && !wide} onPress={toggleFavorite} />
        <GlassButton accessibilityLabel={inStudyPile ? 'Remove from study pile' : 'Add to study pile'} icon={inStudyPile ? 'book.fill' : 'book'} onMedia={onPhoto && !wide} onPress={() => onToggleStudyPile()} />
        {canEdit ? <GlassButton accessibilityLabel="Edit drink" icon="pencil" onMedia={onPhoto && !wide} onPress={onEdit} /> : null}
      </View>
    </View>
  );

  const body = (
    <View style={[styles.body, { paddingHorizontal: gutter }]}>
      <DrinkTags tags={tags} />
      <Display>{item.name}</Display>
      {item.description ? <Body tone="muted">{item.description}</Body> : null}
      {!preview && heroPic?.credit ? (
        <Caption
          tone="muted"
          role={heroPic.sourceUrl ? 'link' : undefined}
          onPress={heroPic.sourceUrl ? () => void Linking.openURL(heroPic.sourceUrl!) : undefined}
        >
          Photo: {heroPic.credit}
        </Caption>
      ) : null}
      <View style={styles.actions}>
        <GlassButton
          accessibilityLabel={serviceMode ? 'Service mode on. Turn off' : 'Service mode: keep the screen on and make the spec bigger'}
          label={serviceMode ? 'Service mode on' : 'Service mode'}
          icon="sun.max.fill"
          onPress={toggleServiceMode}
        />
        {canBatch ? (
          <GlassButton
            accessibilityLabel="Batch: scale this drink for prep"
            label="Batch"
            icon="flask"
            onPress={() => (preview ? preview.onBatch?.() : router.push(`/cocktail/${item.id}/batch`))}
          />
        ) : null}
        {preview ? null : <RankActions item={item} picture={itemPictures[0] ?? null} />}
        {preview || canEdit ? null : <ReportAction subject={item.name} targets={[{ label: item.name, target: { kind: 'item', itemId: item.id } }]} />}
      </View>
      <DrinkFacts facts={facts} columns={wide ? 4 : 2} />
      <FloorSection itemId={item.id} barId={item.bar_id} preview={!!preview} />
      {home && !preview ? <FlavorSection itemId={item.id} /> : null}
      <SpecSection itemId={item.id} barId={item.bar_id} recipes={item.recipes as PresentationRecipe[] | undefined} scale={serviceMode ? 1.25 : 1} preview={preview} />
      {item.notes ? (
        <View style={styles.notes}>
          <Headline role="heading">Bartender notes</Headline>
          <Body>{item.notes}</Body>
        </View>
      ) : null}
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
      {preview ? null : <FamilyTree itemId={item.id} />}
      {preview || !canEdit ? null : <ClassicLink item={item} />}
      {preview ? null : <PublishSection itemId={item.id} barId={item.bar_id} />}
    </View>
  );

  const hero = (
    <DrinkHero name={item.name} pictures={pictures} glass={glass?.icon_key || glass?.name || null} height={heroHeight} fade={!wide} />
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {serviceMode ? <KeepAwake /> : null}
      {wide ? (
        <View style={styles.row}>
          <View style={styles.heroColumn}>{hero}</View>
          <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: space.xxxl }}>
            <View style={styles.readable}>{body}</View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
          {hero}
          <View style={{ marginTop: -space.xxl }}>{body}</View>
        </ScrollView>
      )}
      {controls}
      {ageGate.sheet}
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
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  controlsRight: { flexDirection: 'row', gap: space.sm },
});
