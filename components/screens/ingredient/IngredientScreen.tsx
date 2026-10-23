import { useRouter } from 'expo-router';
import { Fragment, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WhereItLives } from '@/components/backbar/WhereItLives';
import { BackbarTheme, Body, BrandProvider, Button, Caption, Display, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { AroundIt, useBottleTiles } from '@/components/ingredient/IngredientFacts';
import { Crumbs, type Crumb } from '@/components/nav/PageFrame';
import { PrepEditSheet } from '@/components/prep/PrepEditSheet';
import { PairsWith } from '@/components/screens/pairings/PairsWith';
import { TechnicalIngredientCard, WhereToBuy } from '@/components/techniques/TechnicalIngredientCard';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { layout, radius, space } from '@/constants/tokens';
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
import { toQuantity } from '@/lib/quantity';
import { leadTimeLabel, scaledYield } from '@/lib/scale';
import { technicalIngredientFor } from '@/lib/techniques';

import { DrinkControls } from '../drink/DrinkControls';
import { DrinkFacts } from '../drink/DrinkFacts';
import type { ShownPicture } from '../drink/PictureViewer';
import { ForTheBar } from './ForTheBar';
import { IngredientHero, IngredientTags, MakeBar, MoreSheet, prepFacts } from './IngredientBits';
import { NoteBar, NoteRecipe, useNoteChoice } from './NoteRecipe';
import { PrepMethod } from './PrepMethod';
import { PrepRecipe, type PrepLine } from './PrepRecipe';
import { PrepUsedIn } from './PrepUsedIn';
import { printPrepCard } from './printPrepCard';

type Link = { id: string; name: string };

export interface IngredientScreenProps {
  ingredient: { id: string; name: string; description: string | null; bar_id: string | null; created_by?: string | null; ingredient_role?: string | null; brand_maker?: string | null; abv?: number | null; origin?: string | null; generic?: Link | null; madeFrom?: Link | null; picture?: IngredientPicture | null; picture_url?: string | null };
  lines: PrepLine[];
  drinks: { id: string; name: string }[];
  bottles: IngredientBottle[];
  /** A batch's drink photos: the hero while its picture is Drawing (its own photo replaces them; None shows none). */
  pictures: ShownPicture[];
  inStudyPile: boolean;
  onToggleStudyPile: () => void;
  canEdit: boolean;
  onEdit: () => void;
}

/**
 * An ingredient's page, as the canvas draws it (prep-prep-phone, -desktop,
 * prep-ing-campari, prep-ing-xanthan). A house prep: facts, Recipe, Method,
 * Around it, Pairs with, the drinks it goes in, For the bar, with Make pinned.
 * A bottle: its fact tiles, Around it, Pairs with, drinks, Where it lives.
 * Wide screens sit left with crumbs: an aside (drawing, facts, Make, Edit,
 * Print card, Save) beside the sections in pairs.
 */
export function IngredientScreen(props: IngredientScreenProps) {
  const { venues, active } = useActiveVenue();
  const home = useMode().mode === 'home';
  const own = venues.find((v) => v.id === props.ingredient.bar_id);
  // A venue's own prep wears its colours; at work, a shared one wears the venue you're at (decided on the canvas).
  const brand = own ?? (home ? null : active);
  // A technical ingredient reads like the technique library: light (prep-ing-xanthan).
  const light = !props.lines.length && props.ingredient.ingredient_role !== 'prep' && !!technicalIngredientFor(props.ingredient.name);
  return (
    <BackbarTheme scheme={light ? 'light' : undefined}>
      <BrandProvider accent={brand?.accent ?? undefined}>
        <IngredientPage {...props} venueName={own?.name ?? null} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function IngredientPage({ ingredient, lines, drinks, bottles, pictures: batchPictures, inStudyPile, onToggleStudyPile, canEdit, onEdit, venueName }: IngredientScreenProps & { venueName: string | null }) {
  const ds = useDs();
  const userId = useUserId();
  const insets = useSafeAreaInsets();
  // A modal: an iOS page sheet starts below the status bar, but the insets still count it.
  const top = Platform.OS === 'ios' ? space.sm : insets.top;
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const { width, height } = useWindowDimensions();
  const { data: card } = useItemPrep(ingredient.id);
  const { data: used } = usePrepUsedIn(ingredient.id);
  // Shared preps cite their ratio; signed-in readers only, like the sources themselves.
  const { data: sources } = usePrepSources(ingredient.id, !!userId && !ingredient.bar_id);
  const { data: capabilities } = useCapabilities(ingredient.bar_id);
  // A venue's recipe is for its Drink Creators and up; shared ones are open.
  const venueRole = useEffectiveRole(ingredient.bar_id);
  const canViewDetails = !ingredient.bar_id || venueRole > 30;
  const canEditPrep = ingredient.bar_id ? !!capabilities?.includes('prep') || canEdit : canEdit;
  const router = useRouter();
  const [size, setSize] = useState<{ factor: number; makes: string | null } | null>(null);
  const factor = size?.factor ?? 1;
  const make = (mode?: 'have') => router.push(`/ingredient/${ingredient.id}/make?factor=${factor}${mode ? `&mode=${mode}` : ''}` as never);
  const [editingPrep, setEditingPrep] = useState(false);
  const home = useMode().mode === 'home';
  const [sheet, setSheet] = useState<'proof' | 'more' | null>(null);
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
  const technical = !isPrep && !!technicalIngredientFor(ingredient.name);
  const showRecipe = canViewDetails && lines.length > 0;
  const bottleTiles = useBottleTiles(ingredient);
  const facts = isPrep ? (canViewDetails ? prepFacts(prep) : []) : bottleTiles;
  const yieldQ = toQuantity(prep?.yield_amount, prep?.yield_unit);
  const makes = size ? size.makes : scaledYield(prep?.yield_amount ?? null, prep?.yield_unit ?? null, 1);
  // Anyone who can read a prep's recipe can edit it: when other drinks use it, or it isn't
  // theirs to change, the editor asks at Save (prep-prep-edit-shared, AskAtSave).
  const offerEdit = canEdit || (showRecipe && !!userId);
  const print = () => void printPrepCard({ name: ingredient.name, facts, lines: lines.map((l) => ({ amount: [l.amount, l.unit].filter(Boolean).join(' '), name: l.name })), steps: steps.map((s) => s.body) });
  const more = [
    offerEdit ? { label: 'Edit', onPress: onEdit } : null,
    isPrep && canViewDetails ? { label: 'Proof: work out the strength', onPress: () => setSheet('proof') } : null,
    !wide && isPrep && canViewDetails ? { label: 'Print card', onPress: print } : null,
  ].filter((a): a is { label: string; onPress: () => void } => !!a);

  // Its picture (eddie-oct22-ingredient-picture): null is None, and the page starts with its name.
  const shown = shownIngredientPicture(ingredient.picture, ingredient.picture_url);
  const pictures = ingredientHeroPictures(shown, batchPictures);
  const photoBy = shown.kind !== 'photo' ? null : ingredient.bar_id ? venueName : userId && ingredient.created_by === userId ? 'you' : null;
  // With None, only room for the controls (and the body's pull-up over a hero's foot).
  const heroHeight = !pictures ? top + layout.minTapTarget + space.lg + space.xxl : wide ? 340 : Math.min(width * 0.9, height * 0.36);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const phoneScroll = useAnimatedRef<Animated.ScrollView>();
  const drinksY = useRef(0);
  // The body starts where the hero ends, pulled up over its foot.
  const toDrinks = () => phoneScroll.current?.scrollTo({ y: Math.max(0, heroHeight - space.xxl + drinksY.current - top - layout.minTapTarget - space.lg), animated: true });
  const pinned = !wide && (showRecipe || noteShown);

  const head = (
    <View style={styles.stack}>
      <IngredientTags isPrep={isPrep} actions={prep?.actions ?? []} venueName={venueName} shared={!ingredient.bar_id} mine={!!userId && ingredient.created_by === userId} role={ingredient.ingredient_role ?? null} technical={technical} />
      <Display>{ingredient.name}</Display>
      {photoBy ? <Caption tone="muted">{`Photo by ${photoBy}`}</Caption> : null}
      {noteShown ? <NoteRecipe note={ingredient.description!} read={noteRead!} choice={noteChoice} /> : ingredient.description ? <Body tone="muted">{ingredient.description}</Body> : null}
      {noteShown && wide ? <NoteBar itemId={ingredient.id} barId={ingredient.bar_id} read={noteRead!} lines={noteChoice.lines} card={card} bottom={0} inline /> : null}
      {wide ? null : <DrinkFacts facts={facts} columns={isPrep ? 4 : 3} compact />}
      {technical ? <TechnicalIngredientCard name={ingredient.name} /> : null}
      {technical ? <WhereToBuy name={ingredient.name} /> : null}
    </View>
  );
  const recipe = showRecipe ? <PrepRecipe lines={lines} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} onSize={(f, m) => setSize({ factor: f, makes: m })} onFromWhatIHave={() => make('have')} checkedOn={sources?.filter((s) => s.field === 'recipe').map((s) => s.url)} /> : null;
  const method = isPrep && canViewDetails ? <PrepMethod steps={steps} takes={leadTimeLabel(prep?.lead_time_minutes ?? null, prep?.lead_time_note ?? null)} onEdit={canEditPrep ? () => setEditingPrep(true) : undefined} /> : null;
  const around = <AroundIt ingredient={ingredient} bottles={bottles} isPrep={isPrep} />;
  const pairs = <PairsWith itemId={ingredient.id} name={ingredient.name} />;
  const inDrinks = (
    <View onLayout={(e) => (drinksY.current = e.nativeEvent.layout.y)}>
      <PrepUsedIn name={ingredient.name} drinks={drinks} used={used} isPrep={isPrep} wide={wide} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} />
    </View>
  );
  // A technical ingredient's page ends with Where to buy and its drinks (prep-ing-xanthan).
  const forBar = technical ? null : (
    <View style={styles.stack}>
      {isPrep ? null : <WhereItLives itemId={ingredient.id} itemName={ingredient.name} />}
      <ForTheBar item={ingredient} houseMade={lines.length > 0} canEditItem={canEdit} whereRow={isPrep} />
    </View>
  );
  // In the canvas's order; wide screens set them in two columns that each run on, so a
  // long Pairs with never leaves a gap beside Around it (prep-prep-desktop).
  const sections: [ReactNode, ReactNode][] = [
    [recipe, method],
    [around, pairs],
    [inDrinks, forBar],
  ];

  const body = (
    <View style={styles.body}>
      {wide ? null : head}
      {wide ? (
        <View style={styles.pair}>
          {[0, 1].map((col) => (
            <View key={col} style={[styles.flex, styles.body]}>
              {sections.map((s, i) => <Fragment key={i}>{s[col]}</Fragment>)}
            </View>
          ))}
        </View>
      ) : (
        sections.flat().map((n, i) => <Fragment key={i}>{n}</Fragment>)
      )}
    </View>
  );

  const hero = pictures ? <IngredientHero id={ingredient.id} name={ingredient.name} pictures={pictures} height={heroHeight} fade={!wide} /> : <View style={{ height: heroHeight }} />;
  const bottomRoom = insets.bottom + space.xxxl + (pinned ? layout.minTapTarget + space.xl : 0);
  const trail: Crumb[] = home ? [{ label: 'My Bar', href: '/bar' }] : [{ label: 'Library', href: '/library' }, { label: isPrep ? 'Preps' : 'Ingredients', href: '/library' }];

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: top + space.lg, paddingBottom: space.xxxl, gap: space.lg }}>
          <Crumbs trail={trail} />
          <View style={styles.wideRow}>
            <View style={styles.aside}>
              {pictures ? <View style={styles.drawing}>{hero}</View> : null}
              <DrinkFacts facts={facts} columns={2} compact />
              {showRecipe ? <Button label={makes ? `Make ${makes}` : 'Make'} icon="play.fill" size="lg" onPress={() => make()} /> : null}
              <View style={styles.actions}>
                {offerEdit ? <Button label="Edit" variant="secondary" onPress={onEdit} /> : null}
                {isPrep && canViewDetails ? <Button label="Print card" variant="secondary" onPress={print} /> : null}
                <GlassButton accessibilityLabel={onShelf ? 'Take off your bar' : 'Save to your bar'} icon={onShelf ? 'bookmark.fill' : 'bookmark'} onPress={toggleShelf} />
                {more.length > (offerEdit ? 1 : 0) ? <GlassButton accessibilityLabel="More: proof, make your own" icon="ellipsis" onPress={() => setSheet('more')} /> : null}
              </View>
            </View>
            <View style={styles.main}>
              {head}
              {body}
            </View>
          </View>
        </ScrollView>
      ) : (
        <Animated.ScrollView ref={phoneScroll} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: bottomRoom }}>
          {hero}
          <View style={[styles.sheet, { backgroundColor: ds.c.ground, paddingHorizontal: gutter }]}>{body}</View>
        </Animated.ScrollView>
      )}
      {wide ? null : (
        <DrinkControls
          // With None the controls sit on the page's ground, not on paper.
          media={pictures ? (pictures[0] && !pictures[0].isSketch ? 'photo' : 'paper') : ds.scheme === 'dark' ? 'photo' : 'paper'}
          top={top}
          heroHeight={heroHeight}
          scrollY={scrollY}
          wide={false}
          saved={onShelf} onToggleSaved={toggleShelf} saveAs="bar"
          inStudyPile={inStudyPile} onToggleStudyPile={onToggleStudyPile}
          canEdit={more.length > 0} onEdit={() => setSheet('more')} editLabel="More: edit, proof, make your own" editIcon="ellipsis"
        />
      )}
      {pinned && showRecipe ? <MakeBar bottom={insets.bottom} onMake={() => make()} makes={makes} drinks={drinks.length} onDrinks={toDrinks} /> : null}
      {pinned && noteShown ? <NoteBar itemId={ingredient.id} barId={ingredient.bar_id} read={noteRead!} lines={noteChoice.lines} card={card} bottom={insets.bottom} /> : null}
      {sheet === 'more' ? <MoreSheet name={ingredient.name} actions={wide ? more.filter((a) => a.label !== 'Edit') : more} onClose={() => setSheet(null)} /> : null}
      {editingPrep && card ? <PrepEditSheet visible onClose={() => setEditingPrep(false)} itemId={ingredient.id} itemName={ingredient.name} current={card} /> : null}
      {sheet === 'proof' ? <ToolsSheet visible onClose={() => setSheet(null)} tool="proof" volumeMl={yieldQ?.kind === 'ml' ? yieldQ.value : null} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  stack: { gap: space.lg },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  aside: { width: 340, gap: space.md },
  drawing: { borderRadius: radius.card, overflow: 'hidden' },
  main: { flex: 1, minWidth: 0, maxWidth: layout.page.wide, gap: space.xl },
  pair: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl },
  // Rounded over the foot of the drawing, as the drink page's body fades over its photo.
  sheet: { marginTop: -space.xxl, paddingTop: space.lg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  body: { gap: space.xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
