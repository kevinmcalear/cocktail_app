import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDilutionDefaults } from '@/hooks/useDrinkMath';
import { useDrinkPhotos } from '@/hooks/useDrinkPhotos';
import { useDrinkMakerCredits } from '@/hooks/useMakers';
import { useMode } from '@/hooks/useMode';
import { useSearchMine } from '@/hooks/useSearchMine';
import { useShareSlug } from '@/hooks/useShareSlug';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { useSpecLock } from '@/hooks/useSpecLock';
import { useTeamRole } from '@/hooks/useTeamRole';
import { useItemVersions } from '@/hooks/useVersions';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { heroPictures } from '@/lib/drinkPhotos';
import { glassOver, orderedPictures, type ItemImageLink } from '@/lib/itemImages';
import { drinkUrl, shareOrCopy } from '@/lib/shareLink';
import { specLines, type PresentationRecipe, type SpecLevels } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import { BatchSheet } from '../batch/BatchSheet';
import { useCollectToggle } from '../published/useCollectToggle';
import { DrinkActionBar, ACTION_BAR_HEIGHT, type BarAction } from './DrinkActionBar';
import { DrinkBody } from './DrinkBody';
import { useDrinkSections } from './DrinkSections';
import { DrinkControls } from './DrinkControls';
import { DrinkDesktop } from './DrinkDesktop';
import { DrinkHero, phoneHeroHeight } from './DrinkHero';
import { DrinkMoreMenu } from './DrinkMoreMenu';
import { GlassSheet } from './GlassSheet';
import type { ShownPicture } from './PictureViewer';
import { StrengthSheet } from './StrengthSheet';
import { useDrinkActions } from './useDrinkActions';
import { useDrinkFacts } from './useDrinkFacts';

export interface DrinkScreenProps {
  item: DatabaseItem;
  inStudyPile: boolean;
  onToggleStudyPile: () => void;
  /** The drink's own people (its venue's team, its creator): Edit. The page itself stays a read view; changes happen in the editor. */
  canEdit: boolean;
  /** A catalog admin on someone else's drink: a visitor's page with one Fix as admin in More. */
  adminFix?: boolean;
  onEdit: () => void;
  /** Shown as a modal. An iOS page sheet starts below the status bar, but the insets still count it. */
  sheet?: boolean;
  /** Beside a list (the tablet Library): the narrow layout, a short hero, no Back. */
  pane?: boolean;
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
      <BrandProvider accent={venue?.accent ?? undefined} displayFace={venue?.displayFace}>
        <DrinkPage {...props} />
      </BrandProvider>
    </BackbarTheme>
  );
}

export { DrinkLoading } from './DrinkLoading';

function DrinkPage({ item, inStudyPile, onToggleStudyPile, canEdit, adminFix = false, onEdit, sheet, pane, openBatch, preview }: DrinkScreenProps) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // In Library's pane: below an iPad's status bar (0 on the web).
  const top = pane ? insets.top : sheet && Platform.OS === 'ios' ? space.sm : insets.top;
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const wide = breakpoint !== 'phone' && !pane;
  const { width, height } = useWindowDimensions();
  const home = useMode().mode === 'home';
  const signedIn = useSignedIn();
  const { access, amountsOpenAt } = useSpecAccess(item.id, item.bar_id, preview);
  // A bar's drink whose page keeps the spec back: no spec, method or notes, just why (and on a Names page, no description).
  const lock = useSpecLock(preview ? null : item).data;
  // The bookmark: To make in Collection (collected_items).
  const toMake = useCollectToggle({ kind: 'drink', itemId: item.id }, item.name);
  const lines = specLines(item.recipes as PresentationRecipe[] | undefined);
  // Both modes: a party batch at home, a prep bottle at the bar.
  const canBatch = !lock && access.amounts && lines.some((l) => l.value !== null);
  const [batchOpen, setBatchOpen] = useState(!!openBatch);
  const [strengthOpen, setStrengthOpen] = useState(false);
  const [glassOpen, setGlassOpen] = useState(false);
  const role = useEffectiveRole(item.bar_id);
  const teamRole = useTeamRole(preview ? null : item.bar_id);
  // The venue's own team sees its staff rows, in venue mode (decision b49). Viewing as a lower role, the app's
  // banner says so where the board draws it, and Share moves into More (board drink-phone-floor).
  const staff = !home && (teamRole !== null || !!preview);
  const viewingAs = teamRole !== null && role < teamRole;
  const { data: dilutionDefaults } = useDilutionDefaults(preview ? null : item.bar_id);
  // The batch sheet's header names the spec: the house spec and its version at a venue.
  const caps = useCapabilities(staff && !preview ? item.bar_id : null).data ?? [];
  const version = useItemVersions(item.id, caps.includes('specs')).data?.[0]?.version;
  const venue = useActiveVenue().venues.find((v) => v.id === item.bar_id);

  const { make, facts, tags, glass, ice, method, methods, strength } = useDrinkFacts(item, {
    lines,
    amounts: access.amounts && !preview,
    dilutionDefaults,
    openStrength: () => setStrengthOpen(true),
    openGlass: preview ? undefined : () => setGlassOpen(true),
    specLocked: !!lock,
    measures: access.amounts && !lock,
    makers: useDrinkMakerCredits(preview ? null : item.id).data,
  });
  const links = item.item_images as ItemImageLink[] | undefined;
  // No photo of its own: the newest one someone posted leads, credited under the name.
  const shown = heroPictures(orderedPictures(links), useDrinkPhotos(preview ? null : item.id).data);
  const heroPic = shown.pictures[0] ?? null;
  const pictures: ShownPicture[] = preview ? (preview.heroSource ? [{ url: preview.heroSource, isSketch: false, isOutdated: false }] : []) : shown.pictures;
  const heroHeight = pane ? PANE_HERO : wide ? height - top : phoneHeroHeight(width, height, top);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const glassKey = glass?.icon_key || glass?.name || null;
  const actions = useDrinkActions(item, heroPic, lines, venue?.name ?? null);
  // A public drink shares its readable link (/d/penicillin); any other its id link, which asks the rest to sign in.
  const slug = useShareSlug('d', preview ? null : item.id).data;
  const share = () => void shareOrCopy(drinkUrl(slug ?? item.id), item.name);
  // A riff starts where you are: your venue in venue mode, your own at home. Never in the drink's own bar (Kevin, 20 Oct).
  const mine = useSearchMine();
  const onRiff = signedIn && !preview ? () => router.push({ pathname: '/add-cocktail', params: { from: item.id, ...(mine.venueId ? { barId: mine.venueId } : {}) } } as unknown as Href) : null;
  const riffNote = `Starts a new drink ${mine.venueId ? `at ${mine.label}` : 'of your own'} from this spec, credited as a riff on ${item.name}. This one stays as it is.`;

  // Pinned on phones (board drink-phone-venue): Batch, the accent in venue mode; at home the journey strip has I made it.
  const barActions = (
    [
    canBatch ? { key: 'batch', label: 'Batch', icon: 'flask', primary: !home, accessibilityLabel: `Batch: scale this drink ${home ? 'for a party or a bottle' : 'into a bottle'}`, onPress: () => setBatchOpen(true) } : null,
    preview ? null : { key: 'rank', label: 'Rank it', icon: 'list.number', accessibilityLabel: `Rank ${item.name} against others you've had`, onPress: actions.rank },
    preview || lock || (home && signedIn) ? null : { key: 'made', label: actions.madeTimes ? `Made ×${actions.madeTimes}` : 'I made it', icon: 'house', accessibilityLabel: `I made ${item.name}`, onPress: actions.made },
    ] as (BarAction | null)[]
  ).filter((a): a is BarAction => !!a);
  const pinned = !wide && barActions.length > 0;

  const bodyProps = {
    item,
    preview,
    home,
    wide,
    canEdit,
    staff,
    lock,
    access,
    amountsOpenAt,
    lines,
    make,
    facts,
    tags,
    glass: glassKey,
    photoCredit: shown.credit ? { text: shown.credit, url: heroPic?.sourceUrl ?? null } : null,
    toMake,
    actions,
    onRiff,
    riffNote,
    venueName: teamRole !== null ? (venue?.name ?? null) : null,
  };
  const sections = useDrinkSections(bodyProps);
  const hero = (h: number) => <DrinkHero name={item.name} pictures={pictures} glass={glassKey} itemId={item.id} palette={pictures[0]?.palette} height={h} fade={!wide} />;
  const more = preview ? null : <DrinkMoreMenu itemId={item.id} name={item.name} canEdit={canEdit} adminFix={adminFix && !preview} onEdit={onEdit} wide={wide} onShare={viewingAs ? share : undefined} teamRole={teamRole} />;
  const heroScheme = glassOver(pictures[0]);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <DrinkDesktop
          sections={sections}
          hero={hero}
          top={top}
          staff={staff}
          actions={<DrinkActionBar actions={barActions} pinned={false} />}
          heroActions={
            <>
              <GlassButton accessibilityLabel={toMake.saved ? 'Remove from To make' : 'Add to To make'} icon={toMake.saved ? 'bookmark.fill' : 'bookmark'} onMedia onPress={preview ? () => {} : toMake.toggle} />
              {preview || viewingAs ? null : <GlassButton accessibilityLabel="Share" icon="square.and.arrow.up" onMedia onPress={share} />}
              {canEdit ? <GlassButton accessibilityLabel="Edit drink" label="Edit" onMedia onPress={onEdit} /> : null}
              {more}
            </>
          }
        />
      ) : (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + (pinned ? ACTION_BAR_HEIGHT : 0) + space.xxxl }}>
          {hero(heroHeight)}
          <View style={{ marginTop: -space.xxl, paddingHorizontal: gutter }}>
            <DrinkBody sections={sections} home={home} />
          </View>
        </Animated.ScrollView>
      )}
      {pinned ? <DrinkActionBar actions={barActions} pinned /> : null}
      {/* Wide: the sidebar and the hero card's own buttons; no floating back (board drink-desktop). */}
      {wide && breakpoint === 'desktop' ? null : (
      <DrinkControls
        media={heroScheme === 'dark' ? 'photo' : 'paper'}
        top={top}
        heroHeight={heroHeight}
        scrollY={scrollY}
        wide={wide}
        noBack={pane}
        saved={toMake.saved} onToggleSaved={preview ? () => {} : toMake.toggle}
        inStudyPile={inStudyPile} onToggleStudyPile={onToggleStudyPile}
        canEdit={canEdit} onEdit={onEdit}
        onShare={preview || viewingAs ? undefined : share}
        more={more}
        backOnly={wide}
      />
      )}
      {toMake.sheet}
      {actions.sheets}
      {glassOpen ? (
        <GlassSheet visible onClose={() => setGlassOpen(false)} itemId={item.id} name={item.name} glass={glass} iceName={ice?.name ?? null} serveMl={item.serve_ml ?? null} icePerServeG={item.ice_per_serve_g ?? null} editing={false} accent={venue?.accent ?? undefined} />
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
          specLabel={item.bar_id ? `House spec${version ? ` · version ${version}` : ''}` : method === 'stirred' ? 'For the freezer' : item.name}
          barId={staff ? item.bar_id : null}
          canPrep={caps.includes('house_made')}
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

/** The hero's height in the tablet Library's detail pane, as drawn. */
const PANE_HERO = 220;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
});
