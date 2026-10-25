import { useRouter, type Href } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, useDs } from '@/components/ds';
import { fontFamilies, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useClassicCopy } from '@/hooks/useClassicCopy';
import { useDrinkOnMenu } from '@/hooks/useDrinkOnMenu';
import { useLineage } from '@/hooks/useLineage';
import { useMode } from '@/hooks/useMode';
import { useDrinkMenuRuns } from '@/hooks/useProfiles';
import { useEffectiveRole } from '@/hooks/useViewAs';
import type { ItemImageLink } from '@/lib/itemImages';
import { withPastMenuTag } from '@/lib/menuEditions';
import { pageShowsDescriptions, specLockNote } from '@/lib/pageVisibility';
import { ingredientsLine } from '@/lib/publicDrink';
import type { SpecAccess, SpecLevels, SpecLine, PresentationRecipe } from '@/lib/spec';
import type { SpecLock } from '@/hooks/useSpecLock';
import type { DatabaseItem } from '@/types/types';

import { PublishSection } from '../publishing/PublishSection';
import { MyNote } from './MyNote';
import { AllergensSection } from './AllergensSection';
import { AtHomeSpec } from './AtHomeSpec';
import { Backstory } from './Backstory';
import { CostSection } from './CostSection';
import { DrinkCredit } from './DrinkCredit';
import { DrinkFacts, DrinkTags, type Fact } from './DrinkFacts';
import { FlavorSection } from './FlavorSection';
import { ForTheFloor } from './ForTheFloor';
import { HistorySection } from './HistorySection';
import { JourneyStrip } from './JourneyStrip';
import { KitCheckSection } from './KitCheckSection';
import { MakeLine } from './MakeLine';
import { MenuRuns } from './MenuRuns';
import { PeoplePhotos } from './PeoplePhotos';
import { ScoreCaption, ScoreMark } from './ScoreCaption';
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
  /** Method, glass, ice, garnish: under the spec. */
  make: Fact[];
  /** Strength, serve, family: under More. */
  facts: Fact[];
  tags: string[];
  glass: string | null;
  /** "Photo by Jo", when someone's photo leads the hero. */
  photoCredit: { text: string; url: string | null } | null;
  toMake: { saved: boolean; toggle: () => void };
  actions: DrinkActions;
  onRiff: (() => void) | null;
  /** Under Make a riff: where the riff starts and what it's credited as. */
  riffNote: string;
  /** The drink's venue, when you're on its team: "Autumn menu at Little Rye". */
  venueName: string | null;
}

/** A description this short follows the spec; a longer one waits under More. */
const SHORT_DESCRIPTION = 160;

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
  const { venues, active } = useActiveVenue();
  const barName = venues.find((v) => v.id === item.bar_id)?.name ?? null;
  // The kit check is the venue you're working at, for its drinks and the catalog's alike.
  const kitBar = useMode().mode === 'venue' && active && (!item.bar_id || item.bar_id === active.id) ? active.id : null;
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
  const short = !!item.description && item.description.length <= SHORT_DESCRIPTION;
  // A catalog classic's notes are its story, not a method (board drink-phone-classic draws a short method line): Backstory keeps them.
  const catalog = !!useLineage(live ? item.id : null).data?.drink?.is_catalog;
  const method = item.notes && !lock && !catalog ? item.notes : null;

  // The spec, then method, glass, ice and garnish, then the steps: one recipe, read top to bottom.
  const make = <MakeLine facts={p.make} />;
  const spec = lock ? (
    <View style={styles.make}>
      <SpecLockPanel
        note={specLockNote(lock.bar.name, !lock.bar.isClaimed, true)}
        ingredients={ingredientsLine(lock.names ?? [])}
        action={<Button label={lock.bar.isClaimed ? `See ${lock.bar.name}` : 'Work here? Claim this page'} variant="secondary" onPress={() => router.push(`/p/${lock.bar.handle}` as Href)} />}
      />
      {make}
    </View>
  ) : home && signedIn && live ? (
    <AtHomeSpec item={item} lines={lines} recipes={recipes} method={method} make={make} onSwap={p.actions.made} />
  ) : (
    <SpecSection itemId={item.id} barId={item.bar_id} recipes={recipes} preview={preview} caption={copy?.barName ? `With ${copy.barName}'s bottles` : null} make={make} riff={p.onRiff ? { onPress: p.onRiff, note: p.riffNote } : null}>
      {method ? <Body>{method}</Body> : null}
    </SpecSection>
  );

  // Just the name, who made it and its score over the spec; the tags and the rank caption wait under More.
  const header = (
    <View style={styles.header}>
      <Display>{item.name}</Display>
      {live ? (
        <View style={styles.credit}>
          <View style={styles.flex}>
            <DrinkCredit itemId={item.id} />
          </View>
          <ScoreMark itemId={item.id} name={item.name} />
        </View>
      ) : null}
      {live && p.photoCredit ? (
        <Caption tone="muted" role={p.photoCredit.url ? 'link' : undefined} onPress={p.photoCredit.url ? () => void Linking.openURL(p.photoCredit!.url!) : undefined}>
          {p.photoCredit.text}
        </Caption>
      ) : null}
    </View>
  );
  return {
    header,
    intro: short ? description : null,
    spec,
    moreHeading: <MoreHeading />,
    standing:
      tags.length || live ? (
        <View style={styles.standing}>
          {live ? <ScoreCaption itemId={item.id} name={item.name} /> : null}
          <DrinkTags tags={tags} />
        </View>
      ) : null,
    myNote: live && signedIn ? <MyNote itemId={item.id} name={item.name} /> : null,
    kit: live && kitBar ? <KitCheckSection itemId={item.id} barId={kitBar} drink={item.name} /> : null,
    journey:
      home && signedIn && live ? (
        <JourneyStrip itemId={item.id} name={item.name} saved={p.toMake.saved} onToggleSaved={p.toMake.toggle} onRank={p.actions.rank} onMade={p.actions.made} madeTimes={p.actions.madeTimes} lines={lines} />
      ) : null,
    menus: <MenuRuns runs={menuRuns} own={home && onMenu ? { menuId: onMenu.menuId, name: onMenu.name, venueName: p.venueName ?? null, price: onMenu.price ?? null } : null} />,
    banner: live ? <VersionBanner itemId={item.id} inline={p.wide} venueName={barName} /> : null,
    description: short ? null : description,
    // The floor's talking points: for floor roles below Bartender, and editors who write them. A Bartender has the spec (board drink-phone-venue).
    floor: staff && item.bar_id && live && (role < 30 || p.canEdit) ? <ForTheFloor itemId={item.id} barId={item.bar_id} ingredients={names} /> : null,
    facts: <DrinkFacts facts={p.facts} columns={2} />,
    allergens: <AllergensSection itemId={item.id} barId={item.bar_id} preview={!!preview} />,
    flavor: live ? <FlavorSection itemId={item.id} name={item.name} /> : null,
    servedAt: live ? <ServedAt itemId={item.id} /> : null,
    photos: live ? <PeoplePhotos itemId={item.id} name={item.name} glass={p.glass} wide={p.wide} /> : null,
    service: staff ? (
      <ServiceSection
        itemId={item.id}
        barId={item.bar_id}
        name={item.name}
        links={item.item_images as ItemImageLink[] | undefined}
        glass={p.glass}
        lines={access.names ? lines : []}
        showLines={access.amounts}
        splitOpensAt={p.amountsOpenAt}
        serviceStyle={item.service_style}
        preview={preview}
      />
    ) : null,
    history: staff && live ? <HistorySection itemId={item.id} barId={item.bar_id} canEdit={p.canEdit} compact={p.wide} /> : null,
    cost: staff && live ? <CostSection itemId={item.id} barId={item.bar_id} price={item.price} onMenu={onMenu} /> : null,
    backstory: live ? <Backstory itemId={copy?.classicId ?? item.id} lines={lines} classicName={copy?.classicName} onRiff={p.onRiff} story={catalog && !lock ? item.notes : null} /> : null,
    publish: live && (staff || !item.bar_id) ? <PublishSection itemId={item.id} barId={item.bar_id} showLocked={staff} mode="read" /> : null,
  };
}

export type DrinkSections = ReturnType<typeof useDrinkSections>;

/** Where the make-it part ends: everything under it is for when you want to know more. */
function MoreHeading() {
  const ds = useDs();
  return (
    <View style={[styles.more, { borderTopColor: ds.c.line }]}>
      <Caption tone="muted" role="heading" aria-level={2} style={styles.moreLabel}>
        More about this drink
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  make: { gap: space.md },
  credit: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  standing: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  more: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.xl },
  moreLabel: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
});
