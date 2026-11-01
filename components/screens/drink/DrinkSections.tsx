import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, SpecRow } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { useLineage } from '@/hooks/useLineage';
import { useDrinkMenuRuns } from '@/hooks/useProfiles';
import type { GlassFillResult } from '@/hooks/useGlassFill';
import type { SpecLock } from '@/hooks/useSpecLock';
import { makesIt, namesOnly, onTeam, type DrinkViewer } from '@/lib/drinkViewer';
import { pageShowsDescriptions } from '@/lib/pageVisibility';
import type { SpecLevels, SpecLine } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import { ApprovalNotice } from './ApprovalNotice';
import { BarRows } from './BarRows';
import { Backstory } from './Backstory';
import { DrinkCredit } from './DrinkCredit';
import { ForTheFloor } from './ForTheFloor';
import { ItemTitle } from './ItemTitle';
import { MenuRuns } from './MenuRuns';
import { MyNote } from './MyNote';
import { NamesBlock } from './NamesBlock';
import { SpecCard } from './spec/SpecCard';

export interface DrinkSectionsInput {
  item: DatabaseItem;
  viewer: DrinkViewer;
  preview?: { role: number; levels: SpecLevels };
  /** "Caretaker's · House spec", "Classic", "My bar". */
  eyebrow: string | null;
  barName: string | null;
  lock: SpecLock | null | undefined;
  lines: SpecLine[];
  /** The method as a step's name ("Shake"). */
  verb: string | null;
  /** The glass and ice, for the serve line. */
  serve: (string | null | undefined)[];
  fill: GlassFillResult | null;
  onGlass: () => void;
  onBatch?: () => void;
  onRank?: () => void;
  canEdit: boolean;
  /** "Photo by Jo", when someone's photo leads the hero. */
  photoCredit: string | null;
}

/**
 * Every block of the drink page (canvas GWBCX, Decided "The drink page by who
 * is looking"), built once for the phone column (DrinkBody) and the desktop
 * columns (DrinkDesktop) to arrange. What shows depends on who is looking,
 * never on a switcher, and nothing hints at what's held back.
 */
export function useDrinkSections(p: DrinkSectionsInput) {
  const { item, viewer, preview, lock, lines } = p;
  const router = useRouter();
  const signedIn = useSignedIn();
  const live = !preview;
  // A catalog classic's notes are its story, not a method: Backstory keeps them.
  const catalog = !!useLineage(live ? item.id : null).data?.drink?.is_catalog;
  const names = namesOnly(viewer) || !!lock;
  const { data: runs = [] } = useDrinkMenuRuns(live ? item.id : null);
  const description = item.description && pageShowsDescriptions(lock?.bar.visibility) ? item.description : null;
  // A bar's published drink keeps its spec back: its names alone, as a guest reads them.
  const lockedLines: SpecLine[] | null = lock ? (lock.names ?? []).map((n, i) => ({ ...BLANK, key: `${i}`, ingredient: n.brand ? `${n.brand} ${n.name}` : n.name })) : null;
  const team = onTeam(viewer) && !!item.bar_id && live;

  const title = (
    <ItemTitle eyebrow={p.eyebrow} name={item.name} credit={live ? <DrinkCredit itemId={item.id} italic /> : null}>
      {p.photoCredit ? <Caption tone="muted">{p.photoCredit}</Caption> : null}
      {/* Waiting on a Drink Creator's OK: its team sees it here. */}
      {team ? <ApprovalNotice itemId={item.id} /> : null}
    </ItemTitle>
  );

  const spec = lockedLines ? (
    <View>
      {lockedLines.map((l) => (
        <SpecRow key={l.key} amount="" dense ingredient={l.ingredient ?? ''} />
      ))}
    </View>
  ) : (
    <SpecCard
      itemId={item.id}
      barId={item.bar_id}
      lines={lines}
      maker={makesIt(viewer)}
      verb={p.verb}
      serve={p.serve}
      onBatch={p.onBatch}
      preview={preview}
      goesOut={viewer === 'floor'}
      onLine={live ? (l) => router.push(`/ingredient/${l.ingredientId}` as Href) : undefined}
    />
  );

  // One notes block: the drink's notes as the server reads them for your role, the floor's talking points, and your own.
  const drinkNotes = !names && item.notes && !lock && !catalog ? item.notes : null;
  // Fragments, so an empty part leaves no gap in the column.
  const notes = live ? (
    <>
      {drinkNotes ? <Body>{drinkNotes}</Body> : null}
      {viewer === 'floor' && item.bar_id ? <ForTheFloor itemId={item.id} barId={item.bar_id} ingredients={lines.map((l) => l.ingredient)} /> : null}
      {signedIn ? <MyNote itemId={item.id} name={item.name} /> : null}
    </>
  ) : null;

  return {
    title,
    // Guests and the floor: the allergy line, what it tastes like, how it meets your palate.
    lead: names && live ? <NamesBlock itemId={item.id} name={item.name} guest={viewer === 'guest'} tastes={description} atBar={!!item.bar_id} /> : null,
    spec,
    // The one prominent action: Rank it for a guest. The floor and bartenders have none; Edit is in the toolbar.
    action: viewer === 'guest' && p.onRank ? <Button label="Rank it" size="lg" onPress={p.onRank} accessibilityHint={`Rank ${item.name} against others you've had`} /> : null,
    notes,
    bar:
      team && viewer !== 'floor' && item.bar_id ? (
        <BarRows item={item} barId={item.bar_id} barName={p.barName} lines={lines} fill={p.fill} onGlass={p.onGlass} creator={viewer === 'creator'} canEdit={p.canEdit} />
      ) : null,
    menus: live ? <MenuRuns runs={runs} own={null} /> : null,
    story:
      live && !names ? (
        <View style={styles.block}>
          {description ? (
            <>
              <Headline role="heading" aria-level={2}>
                The story
              </Headline>
              <Body tone="muted">{description}</Body>
            </>
          ) : null}
          <Backstory itemId={item.id} lines={lines} story={catalog ? item.notes : null} title={description ? null : 'The story'} />
        </View>
      ) : null,
  };
}

export type DrinkSections = ReturnType<typeof useDrinkSections>;

const BLANK: Omit<SpecLine, 'key' | 'ingredient'> = { amount: null, ingredientId: null, note: null, optional: false, float: false, ml: null, value: null, unit: null, atService: null, abv: null, density: null };

const styles = StyleSheet.create({
  block: { gap: space.md },
});
