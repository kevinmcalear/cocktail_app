import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { WhereItLives } from '@/components/backbar/WhereItLives';
import { BackbarTheme, Body, BrandProvider, Button, IngredientDrawing } from '@/components/ds';
import { AroundIt, useBottleTiles } from '@/components/ingredient/IngredientFacts';
import { PairsWith } from '@/components/screens/pairings/PairsWith';
import { TechnicalIngredientCard, WhereToBuy } from '@/components/techniques/TechnicalIngredientCard';
import { drawing, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useShelf, useShelfEdit } from '@/hooks/useHomeBar';
import type { IngredientBottle } from '@/hooks/useIngredients';
import { useMode } from '@/hooks/useMode';
import { useItemPrep, usePrepSources, usePrepUsedIn } from '@/hooks/usePrepCard';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { ingredientHeroPictures, shownIngredientPicture, type IngredientPicture } from '@/lib/ingredientPicture';
import { readNoteRecipe } from '@/lib/noteRecipe';
import { leadTimeLabel, scaledYield } from '@/lib/scale';
import { ingredientUrl, shareOrCopy } from '@/lib/shareLink';
import { technicalIngredientFor } from '@/lib/techniques';

import { DrinkHero } from '../drink/DrinkHero';
import { ItemShell } from '../drink/ItemShell';
import { ItemTitle } from '../drink/ItemTitle';
import type { ShownPicture } from '../drink/PictureViewer';
import { FactRows } from '../drink/RowGroup';
import { ForTheBar } from './ForTheBar';
import { prepFacts } from './IngredientBits';
import { NoteBar, NoteRecipe, useNoteChoice } from './NoteRecipe';
import { PrepMethod } from './PrepMethod';
import { PrepRecipe, type PrepLine } from './PrepRecipe';
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
 * A bottle's or a house-made ingredient's page (canvas GWBCX, Item-page):
 * the drink page's layout, in the same fixed order. What it tastes like, the
 * facts as ruled rows, the recipe for whoever may read it (Drink Creator and
 * up at a bar) with Log batch the one action, then the bar's own rows: where
 * it lives, its bottles and the drinks it goes in.
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
        <IngredientPage {...props} venueName={own?.name ?? null} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function IngredientPage({ ingredient, lines, drinks, bottles, pictures: batchPictures, canEdit, onEdit, venueName }: IngredientScreenProps & { venueName: string | null }) {
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
  const [size, setSize] = useState<{ factor: number; makes: string | null } | null>(null);
  const factor = size?.factor ?? 1;
  const make = (mode?: 'have') => router.push(`/ingredient/${ingredient.id}/make?factor=${factor}${mode ? `&mode=${mode}` : ''}` as never);
  const { data: shelf } = useShelf();
  const shelfEdit = useShelfEdit();
  const onShelf = !!shelf?.includes(ingredient.id);
  const toggleShelf = () => (!userId ? router.push('/auth/login') : onShelf ? shelfEdit.remove.mutate(ingredient.id) : shelfEdit.add.mutate(ingredient.id));

  const prep = card?.prep ?? null;
  const steps = card?.steps ?? [];
  // A recipe still written as a note: it's a prep, and whoever can edit it can turn it into lines.
  const noteRead = lines.length ? null : readNoteRecipe(ingredient.description);
  const noteShown = !!noteRead && canEditPrep && canViewDetails && !!ingredient.description;
  const noteChoice = useNoteChoice(noteShown ? noteRead : null);
  const isPrep = lines.length > 0 || ingredient.ingredient_role === 'prep' || !!prep || steps.length > 0 || !!noteRead;
  const showRecipe = canViewDetails && lines.length > 0;
  // A technical ingredient (xanthan) reads like the technique library, with where to buy it.
  const technical = !isPrep && !!technicalIngredientFor(ingredient.name);
  const bottleTiles = useBottleTiles(ingredient);
  const facts = (isPrep ? prepFacts(prep) : bottleTiles).map((f) => ({ label: f.label, value: String(f.value) }));
  const makes = size ? size.makes : scaledYield(prep?.yield_amount ?? null, prep?.yield_unit ?? null, 1);
  // Anyone who can read a prep's recipe can edit it: when other drinks use it, or it isn't
  // theirs to change, the editor asks at Save (prep-prep-edit-shared, AskAtSave).
  const offerEdit = canEdit || (showRecipe && !!userId);

  // Its picture (eddie-oct22-ingredient-picture): a photo leads; else its drawing on the paper.
  const shown = shownIngredientPicture(ingredient.picture, ingredient.picture_url);
  const pictures = ingredientHeroPictures(shown, batchPictures);
  const photo = pictures?.[0] && !pictures[0].isSketch ? pictures : null;
  const whose = isPrep ? (venueName ? `${venueName}'s recipe` : userId && ingredient.created_by === userId ? 'Your recipe' : null) : [ingredient.brand_maker, ingredient.origin].filter(Boolean).join(', ') || null;
  const eyebrow = isPrep ? ['House-made', prep?.actions?.[0]].filter(Boolean).join(' · ') : (ingredient.generic?.name ?? (ingredient.ingredient_role === 'product' ? 'Bottle' : 'Ingredient'));
  // One action at most: Log batch, for whoever can read the recipe.
  const action = showRecipe ? <Button label={makes ? `Log batch · ${makes}` : 'Log batch'} size="lg" onPress={() => make()} /> : null;

  const title = <ItemTitle eyebrow={eyebrow} name={ingredient.name} credit={whose} />;

  const body = (columns: boolean) => (
    <View style={styles.body}>
      {columns ? null : title}
      {noteShown ? <NoteRecipe note={ingredient.description!} read={noteRead!} choice={noteChoice} /> : ingredient.description ? <Body>{ingredient.description}</Body> : null}
      {noteShown ? <NoteBar itemId={ingredient.id} barId={ingredient.bar_id} read={noteRead!} lines={noteChoice.lines} card={card} bottom={0} inline /> : null}
      <FactRows rows={facts} />
      {technical ? <TechnicalIngredientCard name={ingredient.name} /> : null}
      {showRecipe ? <PrepRecipe lines={lines} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} onSize={(f, m) => setSize({ factor: f, makes: m })} onFromWhatIHave={() => make('have')} checkedOn={sources?.filter((s) => s.field === 'recipe').map((s) => s.url)} /> : null}
      {isPrep && canViewDetails ? <PrepMethod steps={steps} takes={leadTimeLabel(prep?.lead_time_minutes ?? null, prep?.lead_time_note ?? null)} /> : null}
      {columns ? null : action}
      {isPrep || technical ? null : <WhereItLives itemId={ingredient.id} itemName={ingredient.name} readOnly={offerEdit} />}
      {technical ? null : <ForTheBar item={ingredient} houseMade={lines.length > 0} canEditItem={canEdit} whereRow={isPrep} editable={offerEdit} />}
      <AroundIt ingredient={ingredient} bottles={bottles} isPrep={isPrep} />
      {/* Goes with: kept and redrawn by the Learning lane (board Kept-pairings). */}
      <PairsWith itemId={ingredient.id} name={ingredient.name} />
      {technical ? <WhereToBuy name={ingredient.name} /> : null}
      <PrepUsedIn name={ingredient.name} drinks={drinks} used={used} isPrep={isPrep} wide={columns} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} />
    </View>
  );

  return (
    <ItemShell
      name={ingredient.name}
      photo={photo ? { url: photo[0].url, hero: (h, fade) => <DrinkHero name={ingredient.name} pictures={photo} glass={null} itemId={null} height={h} fade={fade} /> } : null}
      art={() => (
        <View style={{ width: drawing.heroStaff, height: drawing.heroStaff }} accessibilityLabel={`Drawing of ${ingredient.name}`}>
          <IngredientDrawing id={ingredient.id} name={ingredient.name} drawn bare />
        </View>
      )}
      size={drawing.heroStaff}
      liquid={null}
      title={title}
      action={action}
      body={body}
      controls={{
        save: { saved: onShelf, onToggle: toggleShelf, label: ['Save to your bar', 'Take off your bar'] },
        onShare: () => void shareOrCopy(ingredientUrl(ingredient.id), ingredient.name),
        onEdit: offerEdit ? onEdit : undefined,
        editLabel: `Edit ${ingredient.name}`,
      }}
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
});
