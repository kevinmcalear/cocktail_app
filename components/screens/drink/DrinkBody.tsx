import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, Headline } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useClassicCopy } from '@/hooks/useClassicCopy';
import { useDrinkOnMenu } from '@/hooks/useDrinkOnMenu';
import { useDrinkMenuRuns } from '@/hooks/useProfiles';
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
  /** Wide screens: the action buttons, in a row under the method. */
  inlineActions?: ReactNode;
}

/**
 * The drink page's sections, in the order the boards draw them: venue mode
 * (drink-phone-venue, -floor) puts the floor's talking points and the spec
 * first and the staff rows last; home mode (drink-phone-home, -classic) leads
 * with you and this drink and checks the spec against your shelf.
 */
export function DrinkBody(p: DrinkBodyProps) {
  const { item, preview, home, staff, lock, access, lines } = p;
  const router = useRouter();
  const signedIn = useSignedIn();
  const live = !preview;
  const { data: menuRuns = [] } = useDrinkMenuRuns(live ? item.id : null);
  const { data: onMenu } = useDrinkOnMenu(live ? item.id : null, item.bar_id);
  // A bar's exact copy of a classic: its bottles in the spec, the classic's backstory.
  const copy = useClassicCopy(live && item.bar_id ? item.id : null);
  const tags = [...withPastMenuTag(p.tags, menuRuns), ...(onMenu && !home ? ["On tonight's menu"] : [])];
  const recipes = item.recipes as PresentationRecipe[] | undefined;
  const names = lines.map((l) => l.ingredient);
  const description = item.description && pageShowsDescriptions(lock?.bar.visibility) ? <Body tone="muted">{item.description}</Body> : null;
  const method = item.notes && !lock ? item.notes : null;

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

  return (
    <View style={styles.body}>
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
      {home && signedIn && live ? (
        <JourneyStrip
          itemId={item.id}
          name={item.name}
          saved={p.toMake.saved}
          onToggleSaved={p.toMake.toggle}
          onRank={p.actions.rank}
          onMade={p.actions.made}
          madeTimes={p.actions.madeTimes}
          lines={lines}
        />
      ) : null}
      {home && onMenu ? (
        <MenuCard title="On the menu now" detail={[onMenu.name, p.venueName].filter(Boolean).join(' at ')} onPress={() => router.push(`/menus/${onMenu.menuId}` as Href)} />
      ) : null}
      <MenuRuns runs={menuRuns} />
      {live ? <VersionBanner itemId={item.id} /> : null}
      {description}
      {staff && item.bar_id && live ? <ForTheFloor itemId={item.id} barId={item.bar_id} name={item.name} ingredients={names} canEdit={p.canEdit} /> : null}
      <DrinkFacts facts={p.facts} columns={p.wide ? 4 : 2} />
      <AllergensSection itemId={item.id} barId={item.bar_id} preview={!!preview} />
      {live ? <FlavorSection itemId={item.id} name={item.name} /> : null}
      {spec}
      {live ? <ServedAt itemId={item.id} /> : null}
      {method && !home ? (
        <View style={styles.method}>
          <Headline role="heading">Method</Headline>
          <Body>{method}</Body>
        </View>
      ) : null}
      {p.inlineActions}
      {live && !home ? <PeoplePhotos itemId={item.id} name={item.name} glass={p.glass} wide={p.wide} /> : null}
      {staff ? (
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
      ) : null}
      {staff && live ? <HistorySection itemId={item.id} barId={item.bar_id} canEdit={p.canEdit} /> : null}
      {staff && live ? <CostSection itemId={item.id} barId={item.bar_id} priceMinor={item.price_minor} canEdit={p.canEdit} /> : null}
      {live ? <Backstory itemId={copy?.classicId ?? item.id} lines={lines} classicName={copy?.classicName} onRiff={p.onRiff} /> : null}
      {live && home ? <PeoplePhotos itemId={item.id} name={item.name} glass={p.glass} wide={p.wide} /> : null}
      {live && p.canEdit ? <ClassicLink item={item} /> : null}
      {live && (staff || !item.bar_id) ? <PublishSection itemId={item.id} barId={item.bar_id} showLocked={staff} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
  header: { gap: space.md },
  method: { gap: space.sm },
});
