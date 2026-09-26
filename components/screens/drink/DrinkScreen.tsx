import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, BrandProvider, Display, GlassButton, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { specLines, type PresentationRecipe, type SpecLevels } from '@/lib/spec';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { DatabaseItem } from '@/types/types';

import { DrinkFacts, DrinkTags, type Fact } from './DrinkFacts';
import { DrinkHero } from './DrinkHero';
import { SpecSection } from './SpecSection';

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
  const { access } = useSpecAccess(item.id, item.bar_id, preview);
  const canBatch = access.amounts && specLines(item.recipes as PresentationRecipe[] | undefined).some((l) => l.value !== null);

  const find = (list: Named[] | undefined, id: string | null | undefined) => (id ? list?.find((x) => x.id === id) : undefined);
  const glass = find(dropdowns?.glassware as Named[], item.glassware_id);
  const methods = (item.item_methods ?? [])
    .map((m) => find(dropdowns?.methods as Named[], m.method_item_id)?.name)
    .filter((n): n is string => !!n);
  const facts: Fact[] = [
    glass && { label: 'Glass', value: glass.name },
    find(dropdowns?.iceTypes as Named[], item.ice_id) && { label: 'Ice', value: find(dropdowns?.iceTypes as Named[], item.ice_id)!.name },
    find(dropdowns?.families as Named[], item.family_id) && { label: 'Family', value: find(dropdowns?.families as Named[], item.family_id)!.name },
    item.abv ? { label: 'ABV', value: `${item.abv}%` } : null,
  ].filter((f): f is Fact => !!f);
  const tags = [item.origin ? (ORIGIN_LABEL[item.origin] ?? item.origin) : null, ...methods].filter((t): t is string => !!t);
  const imageUrl = preview?.heroSource ?? item.item_images?.[0]?.images?.url ?? null;
  const heroHeight = wide ? height - insets.top : Math.min(width, height * 0.42);

  // Controls over the photo use dark glass and light ink; on wide screens the
  // right-hand ones sit over the page instead.
  const onPhoto = !!imageUrl;
  const controls = (
    <View style={[styles.controls, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
      <GlassButton
        accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
        icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
        onMedia={onPhoto}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <View style={styles.controlsRight}>
        <GlassButton accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Add to favourites'} icon={isFavorite ? 'heart.fill' : 'heart'} onMedia={onPhoto && !wide} onPress={() => onToggleFavorite()} />
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
      </View>
      <DrinkFacts facts={facts} columns={wide ? 4 : 2} />
      <SpecSection itemId={item.id} barId={item.bar_id} recipes={item.recipes as PresentationRecipe[] | undefined} scale={serviceMode ? 1.25 : 1} preview={preview} />
      {item.notes ? (
        <View style={styles.notes}>
          <Headline role="heading">Bartender notes</Headline>
          <Body>{item.notes}</Body>
        </View>
      ) : null}
    </View>
  );

  const hero = (
    <DrinkHero name={item.name} imageUrl={imageUrl} glass={glass?.icon_key || glass?.name || null} height={heroHeight} fade={!wide} />
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
