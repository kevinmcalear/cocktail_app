import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { WhereItLives } from '@/components/backbar/WhereItLives';
import { BackbarTheme, Body, BrandProvider, Button, IngredientDrawing, useIngredientColour, useToast } from '@/components/ds';
import { AroundIt, useBottleTiles } from '@/components/ingredient/IngredientFacts';
import { PairsWith } from '@/components/screens/pairings/PairsWith';
import { TechnicalIngredientCard, WhereToBuy } from '@/components/techniques/TechnicalIngredientCard';
import { drawing, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useLogBatch } from '@/hooks/useBatches';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useShelf, useShelfEdit } from '@/hooks/useHomeBar';
import type { IngredientBottle } from '@/hooks/useIngredients';
import { useMode } from '@/hooks/useMode';
import { useItemPrep, usePrepSources, usePrepUsedIn } from '@/hooks/usePrepCard';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { ingredientHeroPictures, shownIngredientPicture, type IngredientPicture } from '@/lib/ingredientPicture';
import { readNoteRecipe } from '@/lib/noteRecipe';
import { batchSizes } from '@/lib/prepParts';
import { ingredientUrl, shareOrCopy } from '@/lib/shareLink';
import { technicalIngredientFor } from '@/lib/techniques';

import { DrinkHero } from '../drink/DrinkHero';
import { ItemShell } from '../drink/ItemShell';
import { ItemTitle } from '../drink/ItemTitle';
import type { ShownPicture } from '../drink/PictureViewer';
import { FactRows } from '../drink/RowGroup';
import { BehindTheBar } from './BehindTheBar';
import { ForTheBar } from './ForTheBar';
import { HouseMadeRecipe, type PrepLine } from './HouseMadeRecipe';
import { prepFacts } from './IngredientBits';
import { NoteBar, NoteRecipe, useNoteChoice } from './NoteRecipe';
import { PrepUsedIn } from './PrepUsedIn';

type Link = { id: string; name: string };

export interface IngredientScreenProps {
  ingredient: { id: string; name: string; description: string | null; bar_id: string | null; created_by?: string | null; ingredient_role?: string | null; brand_maker?: string | null; abv?: number | null; origin?: string | null; generic?: Link | null; madeFrom?: Link | null; picture?: IngredientPicture | null; picture_url?: string | null };
  lines: PrepLine[];
  drinks: { id: string; name: string }[];
  bottles: IngredientBottle[];
  /** A batch's drink photos: the hero while its picture is Drawing (its own photo replaces them; None shows none). */
  pictures: ShownPicture[];
  canEdit: boolean;
  /** Edit: turns the page into editing in place. */
  onEdit: () => void;
}

/**
 * A bottle's or a house-made ingredient's page (boards Item-page, Desk-page,
 * And-page): the drink page's layout, in the same fixed order. What it tastes
 * like, the facts as ruled rows, the recipe in Ingredients | Steps for
 * whoever may read it (Drink Creator and up at a bar) with Log batch the one
 * action, then for the bar's team the allergen line and Behind the bar (on
 * hand, used in), and the bar's own rows. Its colour paints the sky.
 */
export function IngredientScreen(props: IngredientScreenProps) {
  const { venues, active } = useActiveVenue();
  const home = useMode().mode === 'home';
  const own = venues.find((v) => v.id === props.ingredient.bar_id);
  // A venue's own prep wears its colours; at work, a shared one wears the venue you're at (decided on the canvas).
  const brand = own ?? (home ? null : active);
  return (
    <BackbarTheme>
      <BrandProvider accent={brand?.accent ?? undefined}>
        {/* Log batch writes to the recipe's bar, or for a shared one at work, the bar you're at. */}
        <IngredientPage {...props} venueName={own?.name ?? null} logBar={props.ingredient.bar_id ?? brand?.id ?? null} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function IngredientPage({ ingredient, lines, drinks, bottles, pictures: batchPictures, canEdit, onEdit, venueName, logBar }: IngredientScreenProps & { venueName: string | null; logBar: string | null }) {
  const userId = useUserId();
  const { data: card } = useItemPrep(ingredient.id);
  const { data: used } = usePrepUsedIn(ingredient.id);
  // Shared preps cite their ratio; signed-in readers only, like the sources themselves.
  const { data: sources } = usePrepSources(ingredient.id, !!userId && !ingredient.bar_id);
  const { data: capabilities } = useCapabilities(ingredient.bar_id);
  // A venue's recipe opens at Drink Creator (Item-page, house-made: "as now"); shared ones are open.
  const venueRole = useEffectiveRole(ingredient.bar_id);
  const canViewDetails = !ingredient.bar_id || venueRole > 30;
  const canEditPrep = ingredient.bar_id ? !!capabilities?.includes('prep') || canEdit : canEdit;
  const router = useRouter();
  // Opened from a house-made it goes into: that one leads Used in and the credit (Back is named for it by the stack).
  const from = useLocalSearchParams<{ from?: string }>().from ?? null;
  const toast = useToast();
  // Log batch is for staff who make specs at that bar.
  const { data: logCaps } = useCapabilities(logBar);
  const lastLog = useRef(0);
  const canLog = !!logBar && !!logCaps?.includes('specs');
  const logBatch = useLogBatch(logBar ?? '');
  const [sizeKey, setSizeKey] = useState('batch');
  const { data: shelf } = useShelf();
  const shelfEdit = useShelfEdit();
  const onShelf = !!shelf?.includes(ingredient.id);
  const toggleShelf = () => (!userId ? router.push('/auth/login') : onShelf ? shelfEdit.remove.mutate(ingredient.id) : shelfEdit.add.mutate(ingredient.id));

  const prep = card?.prep ?? null;
  const steps = card?.steps ?? [];
  const sizes = batchSizes(prep?.yield_amount ?? null, prep?.yield_unit ?? null);
  const size = sizes.find((s) => s.key === sizeKey) ?? sizes.find((s) => s.factor === 1)!;
  const make = (mode?: 'have') => router.push(`/ingredient/${ingredient.id}/make?factor=${size.factor}${mode ? `&mode=${mode}` : ''}` as never);
  const log = () => {
    // ponytail: with no bar to log at (home, or no specs there) it opens Make mode, as before; a home log needs a home batches table.
    if (!canLog) return make();
    // A second tap straight after is the same batch, not another.
    if (Date.now() - lastLog.current < 3000) return;
    lastLog.current = Date.now();
    logBatch.mutate({ itemId: ingredient.id, amount: size.amount, unit: size.unit });
    toast.show({ title: `Logged ${size.makes} of ${ingredient.name}` });
  };
  // A recipe still written as a note: it's a prep, and whoever can edit it can turn it into lines.
  const noteRead = lines.length ? null : readNoteRecipe(ingredient.description);
  const noteShown = !!noteRead && canEditPrep && canViewDetails && !!ingredient.description;
  const noteChoice = useNoteChoice(noteShown ? noteRead : null);
  const isPrep = lines.length > 0 || ingredient.ingredient_role === 'prep' || !!prep || steps.length > 0 || !!noteRead;
  const showRecipe = canViewDetails && (lines.length > 0 || steps.length > 0);
  // The bar's team (Employee and up) get the allergen line and Behind the bar; everyone else the lists as before.
  const team = isPrep && !!ingredient.bar_id && venueRole >= 20;
  // A technical ingredient (xanthan) reads like the technique library, with where to buy it.
  const technical = !isPrep && !!technicalIngredientFor(ingredient.name);
  const bottleTiles = useBottleTiles(ingredient);
  const facts = (isPrep ? prepFacts(prep) : bottleTiles).map((f) => ({ label: f.label, value: String(f.value) }));
  // Anyone who can read a prep's recipe can edit it: when other drinks use it, or it isn't
  // theirs to change, the editor asks at Save (prep-prep-edit-shared, AskAtSave).
  const offerEdit = canEdit || (showRecipe && !!userId);

  // Its picture (eddie-oct22-ingredient-picture): a photo leads; else its drawing on the paper.
  const shown = shownIngredientPicture(ingredient.picture, ingredient.picture_url);
  const pictures = ingredientHeroPictures(shown, batchPictures);
  const photo = pictures?.[0] && !pictures[0].isSketch ? pictures : null;
  const owner = isPrep ? (venueName ? `${venueName}'s recipe` : userId && ingredient.created_by === userId ? 'Your recipe' : null) : [ingredient.brand_maker, ingredient.origin].filter(Boolean).join(', ') || null;
  // "Caretaker's recipe · used in Honey-ginger syrup" (Desk-item-ginger): the house-made it goes into, the one you came from first.
  const parent = isPrep ? ((used?.preps ?? []).find((p) => p.id === from) ?? used?.preps[0]) : undefined;
  const whose = [owner, parent ? `used in ${parent.name}` : null].filter(Boolean).join(' · ') || null;
  const sky = useIngredientColour(ingredient.id, ingredient.name);
  const eyebrow = isPrep ? ['House-made', prep?.actions?.[0]].filter(Boolean).join(' · ') : (ingredient.generic?.name ?? (ingredient.ingredient_role === 'product' ? 'Bottle' : 'Ingredient'));
  // One action at most: Log batch, for whoever can read the recipe.
  const logLabel = `Log batch · ${size.makes}`;
  const action = showRecipe ? <Button label={logLabel} size="lg" onPress={log} /> : null;
  // On an Android phone it's the extended FAB (And-item-house-creator-*).
  const fab = showRecipe && Platform.OS === 'android' ? ({ label: 'Log batch', accessibilityLabel: logLabel, icon: 'plus', onPress: log } as const) : null;

  const title = <ItemTitle eyebrow={eyebrow} name={ingredient.name} credit={whose} />;

  const body = (columns: boolean) => (
    <View style={styles.body}>
      {columns ? null : title}
      {noteShown ? <NoteRecipe note={ingredient.description!} read={noteRead!} choice={noteChoice} /> : ingredient.description ? <Body>{ingredient.description}</Body> : null}
      {noteShown ? <NoteBar itemId={ingredient.id} barId={ingredient.bar_id} read={noteRead!} lines={noteChoice.lines} card={card} bottom={0} inline /> : null}
      <FactRows rows={facts} />
      {technical ? <TechnicalIngredientCard name={ingredient.name} /> : null}
      {showRecipe ? <HouseMadeRecipe itemId={ingredient.id} lines={lines} steps={steps} sizes={sizes} size={size} onSize={setSizeKey} onMake={make} checkedOn={sources?.filter((s) => s.field === 'recipe').map((s) => s.url)} /> : null}
      {columns || fab ? null : action}
      {team ? <BehindTheBar item={ingredient} names={lines.map((l) => l.name)} drinks={drinks} used={used} from={from} canEditItem={canEdit} houseMade={lines.length > 0} /> : null}
      {isPrep || technical ? null : <WhereItLives itemId={ingredient.id} itemName={ingredient.name} readOnly={offerEdit} />}
      {technical ? null : <ForTheBar item={ingredient} houseMade={lines.length > 0} canEditItem={canEdit} whereRow={isPrep} editable={offerEdit} allergensRow={!team || !lines.length} />}
      <AroundIt ingredient={ingredient} bottles={bottles} isPrep={isPrep} />
      {/* Goes with: kept and redrawn by the Learning lane (board Kept-pairings). */}
      <PairsWith itemId={ingredient.id} name={ingredient.name} />
      {technical ? <WhereToBuy name={ingredient.name} /> : null}
      {team ? null : <PrepUsedIn name={ingredient.name} drinks={drinks} used={used} isPrep={isPrep} wide={columns} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} />}
    </View>
  );

  return (
    <ItemShell
      name={ingredient.name}
      photo={photo ? { url: photo[0].url, hero: (h, fade) => <DrinkHero name={ingredient.name} pictures={photo} glass={null} itemId={null} height={h} fade={fade} /> } : null}
      art={() => (
        <View style={{ width: drawing.heroStaff, height: drawing.heroStaff }} accessibilityLabel={`Drawing of ${ingredient.name}`}>
          <IngredientDrawing id={ingredient.id} name={ingredient.name} drawn bare night />
        </View>
      )}
      size={drawing.heroStaff}
      liquid={sky}
      title={title}
      action={action}
      body={body}
      fab={fab}
      controls={{
        save: { saved: onShelf, onToggle: toggleShelf, label: ['Save to your bar', 'Take off your bar'] },
        onShare: () => void shareOrCopy(ingredientUrl(ingredient.id), ingredient.name, 'ingredient'),
        onEdit: offerEdit ? onEdit : undefined,
        editLabel: `Edit ${ingredient.name}`,
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
});
