import { useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, BrandProvider } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSignedIn, useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDilutionDefaults } from '@/hooks/useDrinkMath';
import { useDrinkPhotos } from '@/hooks/useDrinkPhotos';
import { useItemGlassFill } from '@/hooks/useGlassFill';
import { useLineage } from '@/hooks/useLineage';
import { useMode } from '@/hooks/useMode';
import { useBarProfile } from '@/hooks/useRankings';
import { useShareSlug } from '@/hooks/useShareSlug';
import { useSpecAccess } from '@/hooks/useSpecAccess';
import { useSpecLock, type SpecLock } from '@/hooks/useSpecLock';
import { useTeamRole } from '@/hooks/useTeamRole';
import { useItemVersions } from '@/hooks/useVersions';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { makingParts } from '@/lib/drinkParts';
import { heroPictures } from '@/lib/drinkPhotos';
import { drinkViewer, makesIt, onTeam } from '@/lib/drinkViewer';
import { glassOver, orderedPictures, type ItemImageLink, type ItemPicture } from '@/lib/itemImages';
import { drinkUrl, shareOrCopy } from '@/lib/shareLink';
import { specLines, type PresentationRecipe, type SpecLevels } from '@/lib/spec';
import { methodVerb } from '@/lib/specView';
import type { SketchInputs } from '@/lib/sketch/types';
import type { DatabaseItem } from '@/types/types';

import { BatchSheet } from '../batch/BatchSheet';
import { useCollectToggle } from '../published/useCollectToggle';
import { DrinkBody } from './DrinkBody';
import { DrinkHero } from './DrinkHero';
import { DrinkMoreMenu } from './DrinkMoreMenu';
import { useDrinkSections } from './DrinkSections';
import { DrinkArt, drawingSize, useSkyColour } from './DrawingHero';
import { GlassSheet } from './GlassSheet';
import { ItemShell } from './ItemShell';
import type { ShownPicture } from './PictureViewer';
import { useDrinkActions } from './useDrinkActions';
import { useDrinkFacts } from './useDrinkFacts';

export interface DrinkScreenProps {
  item: DatabaseItem;
  /** The drink's own people (its venue's team, its creator): Edit. The page itself stays a read view; changes happen in the editor. */
  canEdit: boolean;
  /** A catalog admin on someone else's drink: a visitor's page with one Fix as admin in More. */
  adminFix?: boolean;
  onEdit: () => void;
  /** Shown as a modal. An iOS page sheet starts below the status bar, but the insets still count it. */
  sheet?: boolean;
  /** Beside a list or in the editor's preview: nothing to go back to. */
  pane?: boolean;
  /** Open with the Batch sheet up (/cocktail/[id]/batch links here). */
  openBatch?: boolean;
  /** A bar's published drink read from its public page (VisitorDrink): the spec it keeps back. */
  visitorLock?: SpecLock | null;
  /** /dev/drink and the editor's preview: a hero picture, a drawing for a drink not yet saved, and a simulated role. */
  preview?: { heroSource?: number | string | null; sketch?: SketchInputs | null; role: number; levels: SpecLevels };
}

/**
 * The drink page (canvas GWBCX, Decided): a photo full bleed that decides
 * light or dark, or the drawing on a soft sky of the drink's own colour that
 * docks into the bar on scroll; then what this person may see, by who they
 * are (lib/drinkViewer). Its venue brands it.
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

function DrinkPage(props: DrinkScreenProps) {
  const { item, preview } = props;
  const links = item.item_images as ItemImageLink[] | undefined;
  // No photo of its own: the newest one someone posted leads, credited under the name.
  const shown = heroPictures(orderedPictures(links, item.show_sketch !== false), useDrinkPhotos(preview ? null : item.id).data);
  const pictures: ShownPicture[] = preview ? (preview.heroSource ? [{ url: preview.heroSource, isSketch: false, isOutdated: false }] : []) : shown.pictures;
  const photo = pictures[0] && !pictures[0].isSketch ? pictures : null;
  // A photo decides light or dark for the whole page; the system mode only changes the controls (29 Oct).
  return (
    <BackbarTheme scheme={photo ? glassOver(photo[0]) : undefined}>
      <Page {...props} photos={photo} photoCredit={shown.credit} heroPic={shown.pictures[0] ?? null} />
    </BackbarTheme>
  );
}

function Page({ item, canEdit, adminFix = false, onEdit, sheet, pane, openBatch, visitorLock, preview, photos, photoCredit, heroPic }: DrinkScreenProps & { photos: ShownPicture[] | null; photoCredit: string | null; heroPic: ItemPicture | null }) {
  const insets = useSafeAreaInsets();
  const top = pane ? insets.top : sheet && Platform.OS === 'ios' ? space.sm : insets.top;
  const home = useMode().mode === 'home';
  const signedIn = useSignedIn();
  const userId = useUserId();
  const { access } = useSpecAccess(item.id, item.bar_id, preview);
  const lock = useSpecLock(preview ? null : item).data ?? visitorLock;
  const lines = specLines(item.recipes as PresentationRecipe[] | undefined);
  const realTeam = useTeamRole(preview ? null : item.bar_id);
  const role = useEffectiveRole(item.bar_id);
  const teamRole = preview ? (preview.role >= 20 ? preview.role : null) : !home && realTeam !== null ? role : null;
  const viewer = drinkViewer({ home: home && !item.bar_id, own: !!userId && item.created_by === userId, teamRole, canEdit, amounts: access.amounts && !lock });
  const viewingAs = realTeam !== null && role < realTeam;
  const [batchOpen, setBatchOpen] = useState(!!openBatch);
  const [glassOpen, setGlassOpen] = useState(false);
  const caps = useCapabilities(onTeam(viewer) && !preview ? item.bar_id : null).data ?? [];
  const version = useItemVersions(item.id, caps.includes('specs')).data?.[0]?.version;
  const venue = useActiveVenue().venues.find((v) => v.id === item.bar_id);
  const profile = useBarProfile(preview || venue ? null : item.bar_id).data;
  const barName = lock?.bar.name ?? venue?.name ?? profile?.display_name ?? null;
  const catalog = !!useLineage(preview ? null : item.id).data?.drink?.is_catalog;
  const { data: dilutionDefaults } = useDilutionDefaults(preview ? null : item.bar_id);
  const { glass, ice, method, methods, strength } = useDrinkFacts(item, { lines, amounts: access.amounts && !preview, dilutionDefaults, openStrength: () => {}, specLocked: !!lock, measures: access.amounts && !lock });
  // How full the venue's glass comes, for whoever makes it there (QA Q38).
  const fill = useItemGlassFill(makesIt(viewer) && onTeam(viewer) && !preview ? item : null, lines);
  const canBatch = !lock && access.amounts && lines.some((l) => l.value !== null);
  const actions = useDrinkActions(item, heroPic, lines, venue?.name ?? null, !preview);
  // To make: a bookmark for people who don't make it at a bar.
  const bookmark = !preview && signedIn && !onTeam(viewer);
  const toMake = useCollectToggle({ kind: 'drink', itemId: item.id }, bookmark);
  const slug = useShareSlug('d', preview ? null : item.id).data;
  const share = preview || viewingAs ? undefined : () => void shareOrCopy(drinkUrl(slug ?? item.id), item.name);
  const liquid = useSkyColour(photos ? null : item.id, preview?.sketch);
  const eyebrow = viewer === 'home' ? 'My bar' : catalog ? 'Classic' : item.bar_id && barName ? `${barName} · House spec` : null;

  const sections = useDrinkSections({
    item,
    viewer,
    preview,
    eyebrow,
    barName,
    lock,
    lines,
    verb: methodVerb(methods),
    serve: [glass?.name, ice?.name],
    fill,
    onGlass: () => setGlassOpen(true),
    onBatch: canBatch ? () => setBatchOpen(true) : undefined,
    onRank: preview ? undefined : actions.rank,
    canEdit,
    photoCredit,
  });

  const size = drawingSize(makesIt(viewer));
  const more = preview ? null : <DrinkMoreMenu itemId={item.id} name={item.name} canEdit={canEdit} adminFix={adminFix} onEdit={onEdit} />;

  return (
    <ItemShell
      name={item.name}
      top={top}
      pane={pane}
      inTabs
      photo={photos ? { url: photos[0].url, hero: (h, fade) => <DrinkHero name={item.name} pictures={photos} glass={glass?.icon_key || glass?.name || null} itemId={item.id} palette={photos[0].palette} height={h} fade={fade} /> } : null}
      art={<DrinkArt itemId={item.id} sketch={preview?.sketch} label={`Drawing of ${item.name}`} size={size} />}
      size={size}
      liquid={liquid}
      title={sections.title}
      action={sections.action}
      body={(columns) => <DrinkBody sections={{ ...sections, action: columns ? null : sections.action }} title={!columns} />}
      controls={{
        save: bookmark ? { saved: toMake.saved, onToggle: toMake.toggle, label: ['Add to To make', 'Remove from To make'] } : null,
        onShare: share,
        onEdit: canEdit && !preview ? onEdit : undefined,
        editLabel: 'Edit drink',
        more,
      }}
    >
      {toMake.sheet}
      {actions.sheets}
      {glassOpen ? (
        <GlassSheet visible onClose={() => setGlassOpen(false)} itemId={item.id} name={item.name} glass={glass} iceName={ice?.name ?? null} serveMl={item.serve_ml ?? null} icePerServeG={item.ice_per_serve_g ?? null} editing={false} fill={fill} accent={venue?.accent ?? undefined} />
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
          barId={onTeam(viewer) ? item.bar_id : null}
          canPrep={caps.includes('house_made')}
          parts={makingParts(item.madeInParts, item.item_methods)}
          itemId={item.id}
        />
      ) : null}
    </ItemShell>
  );
}
