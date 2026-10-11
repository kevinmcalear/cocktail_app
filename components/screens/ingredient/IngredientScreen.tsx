import { useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WhereItLives } from '@/components/backbar/WhereItLives';
import { BackbarTheme, Body, BrandProvider, Button, Display, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
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
import { useItemPrep, usePrepUsedIn } from '@/hooks/usePrepCard';
import { useEffectiveRole } from '@/hooks/useViewAs';
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
import { PrepVersionSheet } from './PrepVersionSheet';
import { printPrepCard } from './printPrepCard';

type Link = { id: string; name: string };

export interface IngredientScreenProps {
  ingredient: { id: string; name: string; description: string | null; bar_id: string | null; created_by?: string | null; ingredient_role?: string | null; brand_maker?: string | null; abv?: number | null; origin?: string | null; generic?: Link | null; madeFrom?: Link | null };
  lines: PrepLine[];
  drinks: { id: string; name: string }[];
  bottles: IngredientBottle[];
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
  const venue = useActiveVenue().venues.find((v) => v.id === props.ingredient.bar_id);
  return (
    <BackbarTheme>
      <BrandProvider accent={venue?.accent ?? undefined}>
        <IngredientPage {...props} venueName={venue?.name ?? null} />
      </BrandProvider>
    </BackbarTheme>
  );
}

function IngredientPage({ ingredient, lines, drinks, bottles, pictures, inStudyPile, onToggleStudyPile, canEdit, onEdit, venueName }: IngredientScreenProps & { venueName: string | null }) {
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
  // Before changing a prep other drinks use, or to make your own: 'edit' or 'copy'.
  const [version, setVersion] = useState<'edit' | 'copy' | null>(null);
  const { active } = useActiveVenue();
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
  const edit = isPrep && drinks.length > 1 ? () => setVersion('edit') : onEdit;
  const print = () => void printPrepCard({ name: ingredient.name, facts, lines: lines.map((l) => ({ amount: [l.amount, l.unit].filter(Boolean).join(' '), name: l.name })), steps: steps.map((s) => s.body) });
  const more = [
    canEdit ? { label: 'Edit', onPress: edit } : null,
    isPrep && canViewDetails ? { label: 'Proof: work out the strength', onPress: () => setSheet('proof') } : null,
    showRecipe && userId && !canEdit ? { label: 'Make your own version', onPress: () => setVersion('copy') } : null,
    !wide && isPrep && canViewDetails ? { label: 'Print card', onPress: print } : null,
  ].filter((a): a is { label: string; onPress: () => void } => !!a);

  const heroHeight = wide ? 340 : Math.min(width * 0.9, height * 0.36);
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
      {noteShown ? <NoteRecipe note={ingredient.description!} read={noteRead!} choice={noteChoice} /> : ingredient.description ? <Body tone="muted">{ingredient.description}</Body> : null}
      {noteShown && wide ? <NoteBar itemId={ingredient.id} barId={ingredient.bar_id} read={noteRead!} lines={noteChoice.lines} card={card} bottom={0} inline /> : null}
      {wide ? null : <DrinkFacts facts={facts} columns={isPrep ? 4 : 3} />}
      {technical ? <TechnicalIngredientCard name={ingredient.name} /> : null}
      {technical ? <WhereToBuy name={ingredient.name} /> : null}
    </View>
  );
  const recipe = showRecipe ? <PrepRecipe lines={lines} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} onSize={(f, m) => setSize({ factor: f, makes: m })} onFromWhatIHave={() => make('have')} /> : null;
  const method = isPrep && canViewDetails ? <PrepMethod steps={steps} takes={leadTimeLabel(prep?.lead_time_minutes ?? null, prep?.lead_time_note ?? null)} onEdit={canEditPrep ? () => setEditingPrep(true) : undefined} /> : null;
  const around = <AroundIt ingredient={ingredient} bottles={bottles} isPrep={isPrep} />;
  const pairs = <PairsWith itemId={ingredient.id} name={ingredient.name} />;
  const inDrinks = (
    <View onLayout={(e) => (drinksY.current = e.nativeEvent.layout.y)}>
      <PrepUsedIn name={ingredient.name} drinks={drinks} used={used} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} />
    </View>
  );
  const forBar = (
    <View style={styles.stack}>
      {isPrep ? null : <WhereItLives itemId={ingredient.id} itemName={ingredient.name} />}
      <ForTheBar item={ingredient} houseMade={lines.length > 0} canEditItem={canEdit} whereRow={isPrep} />
    </View>
  );
  // In the canvas's order; wide screens set them side by side in these pairs.
  const sections: [ReactNode, ReactNode][] = [
    [recipe, method],
    [around, pairs],
    [inDrinks, forBar],
  ];

  const body = (
    <View style={styles.body}>
      {wide ? null : head}
      {sections.map(([a, b], i) =>
        wide ? (
          <View key={i} style={styles.pair}>
            <View style={styles.flex}>{a}</View>
            <View style={styles.flex}>{b}</View>
          </View>
        ) : (
          <View key={i} style={styles.body}>
            {a}
            {b}
          </View>
        ),
      )}
    </View>
  );

  const hero = <IngredientHero id={ingredient.id} name={ingredient.name} pictures={pictures} height={heroHeight} fade={!wide} />;
  const bottomRoom = insets.bottom + space.xxxl + (pinned ? layout.minTapTarget + space.xl : 0);
  const trail: Crumb[] = home ? [{ label: 'My Bar', href: '/bar' }] : [{ label: 'Library', href: '/library' }, { label: isPrep ? 'Preps' : 'Ingredients', href: '/library' }];

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: top + space.lg, paddingBottom: space.xxxl, gap: space.lg }}>
          <Crumbs trail={trail} />
          <View style={styles.wideRow}>
            <View style={styles.aside}>
              <View style={styles.drawing}>{hero}</View>
              <DrinkFacts facts={facts} columns={2} />
              {showRecipe ? <Button label={makes ? `Make ${makes}` : 'Make'} icon="play.fill" size="lg" onPress={() => make()} /> : null}
              <View style={styles.actions}>
                {canEdit ? <Button label="Edit" variant="secondary" onPress={edit} /> : null}
                {isPrep && canViewDetails ? <Button label="Print card" variant="secondary" onPress={print} /> : null}
                <GlassButton accessibilityLabel={onShelf ? 'Take off your bar' : 'Save to your bar'} icon={onShelf ? 'bookmark.fill' : 'bookmark'} onPress={toggleShelf} />
                {more.length > (canEdit ? 1 : 0) ? <GlassButton accessibilityLabel="More: proof, make your own" icon="ellipsis" onPress={() => setSheet('more')} /> : null}
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
          media={pictures[0] && !pictures[0].isSketch ? 'photo' : 'paper'}
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
      {version ? (
        <PrepVersionSheet
          visible
          onClose={() => setVersion(null)}
          source={{ id: ingredient.id, name: ingredient.name, description: ingredient.description, abv: ingredient.abv, lines, card }}
          drinks={drinks.length}
          venue={!home && active ? { id: active.id, name: active.name } : null}
          onEditAll={version === 'edit' ? onEdit : undefined}
        />
      ) : null}
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
