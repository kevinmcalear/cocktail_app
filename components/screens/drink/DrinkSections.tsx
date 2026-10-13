import { useRouter, type Href } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useClassicCopy } from '@/hooks/useClassicCopy';
import { useDrinkOnMenu } from '@/hooks/useDrinkOnMenu';
import { useLineage } from '@/hooks/useLineage';
import { useDrinkMenuRuns } from '@/hooks/useProfiles';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { ItemImageLink } from '@/lib/itemImages';
import { withPastMenuTag } from '@/lib/menuEditions';
import { pageShowsDescriptions, specLockNote } from '@/lib/pageVisibility';
import type { SpecAccess, SpecLevels, SpecLine, PresentationRecipe } from '@/lib/spec';
import type { SpecLock } from '@/hooks/useSpecLock';
import type { DatabaseItem } from '@/types/types';

import { PublishSection } from '../publishing/PublishSection';
import { AllergensSection } from './AllergensSection';
import { AtHomeSpec } from './AtHomeSpec';
import { Backstory } from './Backstory';
import { ClassicLink } from './ClassicLink';
import { CostSection } from './CostSection';
import { DrinkCredit } from './DrinkCredit';
import { DrinkFacts, DrinkTags, type Fact } from './DrinkFacts';
import { FlavorSection } from './FlavorSection';
import { ForTheFloor } from './ForTheFloor';
import { HistorySection } from './HistorySection';
import { JourneyStrip } from './JourneyStrip';
import { MenuCard, MenuRuns } from './MenuRuns';
import { PeoplePhotos } from './PeoplePhotos';
import { ScoreCaption } from './ScoreCaption';
import { ServedAt } from './ServedAt';
import { ServiceSection } from './ServiceSection';
import { SpecLockPanel } from './SpecLockPanel';
import { SpecSection } from './SpecSection';
import type { DrinkActions } from './useDrinkActions';
import { VersionBanner } from './VersionBanner';

export interface DrinkBodyProps {
  item: DatabaseItem;
  preview?: { role: number; levels: SpecLevels };
  /** Home mode: the journey strip, the spec against your shelf, no staff rows. */
  home: boolean;
  wide: boolean;
  canEdit: boolean;
  /** On this drink's venue team, in venue mode: the staff rows show (decision b49). */
  staff: boolean;
  lock: SpecLock | null | undefined;
  access: SpecAccess;
  amountsOpenAt: string;
  lines: SpecLine[];
  facts: Fact[];
  tags: string[];
  glass: string | null;
  /** "Photo by Jo", when someone's photo leads the hero. */
  photoCredit: { text: string; url: string | null } | null;
  toMake: { saved: boolean; toggle: () => void };
  actions: DrinkActions;
  onRiff: (() => void) | null;
  /** The drink's venue, when you're on its team: "Autumn menu at Little Rye". */
  venueName: string | null;
}

/**
 * Every section of the drink page, built once from the page's data, for the
 * phone column (DrinkBody) and the desktop tabs (DrinkDesktop) to arrange.
 * Staff rows come only for the venue's own team in venue mode (decision b49).
 */
export function useDrinkSections(p: DrinkBodyProps) {
  const { item, preview, home, staff, lock, access, lines } = p;
  const router = useRouter();
  const signedIn = useSignedIn();
  const live = !preview;
  const barName = useActiveVenue().venues.find((v) => v.id === item.bar_id)?.name ?? null;
  const effective = useEffectiveRole(item.bar_id);
  const role = preview ? preview.role : effective;
  const { data: menuRuns = [] } = useDrinkMenuRuns(live ? item.id : null);
  const { data: onMenu } = useDrinkOnMenu(live ? item.id : null, item.bar_id);
  // A bar's exact copy of a classic: its bottles in the spec, the classic's backstory.
  const copy = useClassicCopy(live && item.bar_id ? item.id : null);
  const tags = [...withPastMenuTag(p.tags, menuRuns), ...(onMenu && !home ? ["On tonight's menu"] : [])];
  const recipes = item.recipes as PresentationRecipe[] | undefined;
  const names = lines.map((l) => l.ingredient);
  const description = item.description && pageShowsDescriptions(lock?.bar.visibility) ? <Body tone="muted">{item.description}</Body> : null;
  // A catalog classic's notes are its story, not a method (board drink-phone-classic draws a short method line): Backstory keeps them.
  const catalog = !!useLineage(live ? item.id : null).data?.drink?.is_catalog;
  const method = item.notes && !lock && !catalog ? item.notes : null;

  const spec = lock ? (
    <SpecLockPanel
      note={specLockNote(lock.bar.name, !lock.bar.isClaimed, true)}
      action={<Button label={lock.bar.isClaimed ? `See ${lock.bar.name}` : 'Work here? Claim this page'} variant="secondary" onPress={() => router.push(`/p/${lock.bar.handle}` as Href)} />}
    />
  ) : home && signedIn && live ? (
    <AtHomeSpec item={item} lines={lines} recipes={recipes} method={method} onSwap={p.actions.made} />
  ) : (
    <SpecSection itemId={item.id} barId={item.bar_id} recipes={recipes} preview={preview} caption={copy?.barName ? `With ${copy.barName}'s bottles` : null}>
      {home && method ? <Body>{method}</Body> : null}
    </SpecSection>
  );

  const header = (
    <View style={styles.header}>
      <DrinkTags tags={tags} />
      <Display>{item.name}</Display>
      {live ? <DrinkCredit itemId={item.id} /> : null}
      {live ? <ScoreCaption itemId={item.id} name={item.name} /> : null}
      {live && p.photoCredit ? (
        <Caption tone="muted" role={p.photoCredit.url ? 'link' : undefined} onPress={p.photoCredit.url ? () => void Linking.openURL(p.photoCredit!.url!) : undefined}>
          {p.photoCredit.text}
        </Caption>
      ) : null}
    </View>
  );
  return {
    header,
    journey:
      home && signedIn && live ? (
        <JourneyStrip itemId={item.id} name={item.name} saved={p.toMake.saved} onToggleSaved={p.toMake.toggle} onRank={p.actions.rank} onMade={p.actions.made} madeTimes={p.actions.madeTimes} lines={lines} />
      ) : null,
    menus: (
      <>
        {home && onMenu ? (
          <MenuCard title="On the menu now" detail={[onMenu.name, p.venueName].filter(Boolean).join(' at ')} onPress={() => router.push(`/menus/${onMenu.menuId}` as Href)} />
        ) : null}
        <MenuRuns runs={menuRuns} />
      </>
    ),
    banner: live ? <VersionBanner itemId={item.id} inline={p.wide} venueName={barName} /> : null,
    description,
    // The floor's talking points: for floor roles below Bartender, and editors who write them. A Bartender has the spec (board drink-phone-venue).
    floor: staff && item.bar_id && live && (role < 30 || p.canEdit) ? <ForTheFloor itemId={item.id} barId={item.bar_id} name={item.name} ingredients={names} canEdit={p.canEdit} /> : null,
    facts: <DrinkFacts facts={p.facts} columns={2} />,
    allergens: <AllergensSection itemId={item.id} barId={item.bar_id} preview={!!preview} />,
    flavor: live ? <FlavorSection itemId={item.id} name={item.name} /> : null,
    spec,
    servedAt: live ? <ServedAt itemId={item.id} /> : null,
    method:
      method && !home ? (
        <View style={styles.method}>
          <Headline role="heading">Method</Headline>
          <Body>{method}</Body>
        </View>
      ) : null,
    photos: live ? <PeoplePhotos itemId={item.id} name={item.name} glass={p.glass} wide={p.wide} /> : null,
    service: staff ? (
      <ServiceSection
        itemId={item.id}
        barId={item.bar_id}
        name={item.name}
        links={item.item_images as ItemImageLink[] | undefined}
        canEdit={p.canEdit}
        glass={p.glass}
        lines={access.names ? lines : []}
        showLines={access.amounts}
        splitOpensAt={p.amountsOpenAt}
        serviceStyle={item.service_style}
        preview={preview}
      />
    ) : null,
    history: staff && live ? <HistorySection itemId={item.id} barId={item.bar_id} canEdit={p.canEdit} compact={p.wide} /> : null,
    cost: staff && live ? <CostSection itemId={item.id} barId={item.bar_id} priceMinor={item.price_minor} canEdit={p.canEdit} /> : null,
    backstory: live ? <Backstory itemId={copy?.classicId ?? item.id} lines={lines} classicName={copy?.classicName} onRiff={p.onRiff} story={catalog && !lock ? item.notes : null} /> : null,
    classicLink: live && p.canEdit ? <ClassicLink item={item} /> : null,
    publish: live && (staff || !item.bar_id) ? <PublishSection itemId={item.id} barId={item.bar_id} showLocked={staff} /> : null,
  };
}

export type DrinkSections = ReturnType<typeof useDrinkSections>;

const styles = StyleSheet.create({
  header: { gap: space.md },
  method: { gap: space.sm },
});
