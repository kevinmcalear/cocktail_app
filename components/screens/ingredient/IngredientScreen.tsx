import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AllergenSection } from '@/components/allergens/AllergenSection';
import { WhereItLives } from '@/components/backbar/WhereItLives';
import { PriceSection } from '@/components/costs/PriceSection';
import { BackbarTheme, Body, BrandProvider, Button, Display, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { IngredientFacts } from '@/components/ingredient/IngredientFacts';
import { PrepEditSheet } from '@/components/prep/PrepEditSheet';
import { PairsWith } from '@/components/screens/pairings/PairsWith';
import { PublishSection } from '@/components/screens/publishing/PublishSection';
import { ToolsSheet } from '@/components/tools/ToolsSheet';
import { layout, radius, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import type { IngredientBottle } from '@/hooks/useIngredients';
import { useMode } from '@/hooks/useMode';
import { useItemPrep, usePrepUsedIn } from '@/hooks/usePrepCard';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { toQuantity } from '@/lib/quantity';
import { readNoteRecipe } from '@/lib/noteRecipe';
import { leadTimeLabel } from '@/lib/scale';

import { DrinkControls } from '../drink/DrinkControls';
import { DrinkFacts } from '../drink/DrinkFacts';
import type { ShownPicture } from '../drink/PictureViewer';
import { IngredientHero, IngredientTags, MakeBar, prepFacts } from './IngredientBits';
import { NoteRecipe } from './NoteRecipe';
import { PrepMethod } from './PrepMethod';
import { PrepRecipe, type PrepLine } from './PrepRecipe';
import { PrepUsedIn } from './PrepUsedIn';
import { PrepVersionSheet } from './PrepVersionSheet';

type Link = { id: string; name: string };

export interface IngredientScreenProps {
  ingredient: {
    id: string;
    name: string;
    description: string | null;
    bar_id: string | null;
    created_by?: string | null;
    ingredient_role?: string | null;
    brand_maker?: string | null;
    abv?: number | null;
    origin?: string | null;
    generic?: Link | null;
    madeFrom?: Link | null;
  };
  lines: PrepLine[];
  drinks: { id: string; name: string }[];
  bottles: IngredientBottle[];
  pictures: ShownPicture[];
  isFavorite: boolean;
  onToggleFavorite: () => void;
  inStudyPile: boolean;
  onToggleStudyPile: () => void;
  canEdit: boolean;
  onEdit: () => void;
}

/**
 * An ingredient's page, shaped like a drink's. A house prep leads with its
 * recipe, method and the drinks it goes in, with Make pinned underneath; a
 * bottle or a style shows what it is and the bottles of it.
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

function IngredientPage({ ingredient, lines, drinks, bottles, pictures, isFavorite, onToggleFavorite, inStudyPile, onToggleStudyPile, canEdit, onEdit, venueName }: IngredientScreenProps & { venueName: string | null }) {
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
  const [factor, setFactor] = useState(1);
  const make = (mode?: 'have') => router.push(`/ingredient/${ingredient.id}/make?factor=${factor}${mode ? `&mode=${mode}` : ''}` as never);
  const [editingPrep, setEditingPrep] = useState(false);
  // Before changing a prep other drinks use, or to make your own: 'edit' or 'copy'.
  const [version, setVersion] = useState<'edit' | 'copy' | null>(null);
  const { active } = useActiveVenue();
  const home = useMode().mode === 'home';
  const [proofing, setProofing] = useState(false);

  const prep = card?.prep ?? null;
  const steps = card?.steps ?? [];
  // A recipe still written as a note: it's a prep, and whoever can edit it can turn it into lines.
  const noteRead = lines.length ? null : readNoteRecipe(ingredient.description);
  const isPrep = lines.length > 0 || ingredient.ingredient_role === 'prep' || !!prep || steps.length > 0 || !!noteRead;
  const showRecipe = canViewDetails && lines.length > 0;
  const facts = canViewDetails ? prepFacts(prep) : [];
  const yieldQ = toQuantity(prep?.yield_amount, prep?.yield_unit);

  const heroHeight = wide ? height - top : Math.min(width * 0.9, height * 0.36);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const phoneScroll = useAnimatedRef<Animated.ScrollView>();
  const wideScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const drinksY = useRef(0);
  const toDrinks = () => {
    // The body starts where the hero ends, pulled up over its foot on phones.
    const y = wide ? drinksY.current : heroHeight - space.xxl + drinksY.current;
    (wide ? wideScroll.current : phoneScroll.current)?.scrollTo({ y: Math.max(0, y - top - layout.minTapTarget - space.lg), animated: true });
  };
  const pinned = showRecipe && !wide;

  const body = (
    <View style={[styles.body, { paddingHorizontal: gutter }]}>
      <IngredientTags isPrep={isPrep} actions={prep?.actions ?? []} venueName={venueName} shared={!ingredient.bar_id} mine={!!userId && ingredient.created_by === userId} role={ingredient.ingredient_role ?? null} />
      <Display>{ingredient.name}</Display>
      {noteRead && canEditPrep && canViewDetails && ingredient.description ? (
        <NoteRecipe itemId={ingredient.id} barId={ingredient.bar_id} note={ingredient.description} read={noteRead} card={card} />
      ) : ingredient.description ? (
        <Body tone="muted">{ingredient.description}</Body>
      ) : null}
      <View style={styles.actions}>
        {showRecipe && wide ? <Button label="Make" icon="flask" onPress={() => make()} /> : null}
        {isPrep && canViewDetails ? <GlassButton accessibilityLabel="Proof: work out the strength" label="Proof" icon="percent" onPress={() => setProofing(true)} /> : null}
        {showRecipe && userId && !canEdit ? <GlassButton accessibilityLabel="Make your own version of this prep" label="Make your own" icon="plus.square" onPress={() => setVersion('copy')} /> : null}
      </View>
      <DrinkFacts facts={facts} columns={wide ? 4 : 2} />
      {showRecipe ? <PrepRecipe lines={lines} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} onFactor={setFactor} onFromWhatIHave={() => make('have')} /> : null}
      {isPrep && canViewDetails ? (
        <PrepMethod steps={steps} takes={leadTimeLabel(prep?.lead_time_minutes ?? null, prep?.lead_time_note ?? null)} onEdit={canEditPrep ? () => setEditingPrep(true) : undefined} />
      ) : null}
      <View onLayout={(e) => (drinksY.current = e.nativeEvent.layout.y)}>
        <PrepUsedIn name={ingredient.name} drinks={drinks} used={used} yieldAmount={prep?.yield_amount ?? null} yieldUnit={prep?.yield_unit ?? null} />
      </View>
      <IngredientFacts ingredient={ingredient} bottles={bottles} hideRole={isPrep} />
      <PairsWith itemId={ingredient.id} name={ingredient.name} />
      <WhereItLives itemId={ingredient.id} itemName={ingredient.name} />
      <PriceSection itemId={ingredient.id} />
      <AllergenSection itemId={ingredient.id} houseMade={lines.length > 0} canEditItem={canEdit} />
      <PublishSection itemId={ingredient.id} barId={ingredient.bar_id} noun="ingredient" />
    </View>
  );

  const hero = <IngredientHero id={ingredient.id} name={ingredient.name} pictures={pictures} height={heroHeight} fade={!wide} />;
  const bottomRoom = insets.bottom + space.xxxl + (pinned ? layout.minTapTarget + space.xl : 0);

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {wide ? (
        <View style={styles.row}>
          <View style={styles.heroColumn}>{hero}</View>
          <ScrollView ref={wideScroll} style={styles.flex} contentContainerStyle={{ paddingTop: top + layout.minTapTarget + space.xl, paddingBottom: space.xxxl }}>
            <View style={styles.readable}>{body}</View>
          </ScrollView>
        </View>
      ) : (
        <Animated.ScrollView ref={phoneScroll} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: bottomRoom }}>
          {hero}
          <View style={[styles.sheet, { backgroundColor: ds.c.ground }]}>{body}</View>
        </Animated.ScrollView>
      )}
      <DrinkControls
        media={pictures[0] && !pictures[0].isSketch ? 'photo' : 'paper'}
        top={top}
        heroHeight={heroHeight}
        scrollY={scrollY}
        wide={wide}
        isFavorite={isFavorite} onToggleFavorite={onToggleFavorite}
        inStudyPile={inStudyPile} onToggleStudyPile={onToggleStudyPile}
        canEdit={canEdit} onEdit={isPrep && drinks.length > 1 ? () => setVersion('edit') : onEdit} editLabel="Edit ingredient"
      />
      {pinned ? <MakeBar bottom={insets.bottom} onMake={() => make()} drinks={drinks.length} onDrinks={toDrinks} /> : null}
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
      {proofing ? <ToolsSheet visible onClose={() => setProofing(false)} tool="proof" volumeMl={yieldQ?.kind === 'ml' ? yieldQ.value : null} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  heroColumn: { width: '42%' },
  readable: { maxWidth: 720, width: '100%' },
  // Rounded over the foot of the drawing, as the drink page's body fades over its photo.
  sheet: { marginTop: -space.xxl, paddingTop: space.lg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  body: { gap: space.xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
