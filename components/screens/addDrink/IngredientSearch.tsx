import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { NearPicks } from '@/components/search/NearPicks';
import { useIngredientUse } from '@/hooks/useIngredientUse';
import { useNearIngredients } from '@/hooks/useNearIngredients';
import { typedUnit, type WizardPick } from '@/lib/drinkWizard';
import { bottlesOfKind, closestIngredients, nearIngredient, sameIngredient, searchIngredients, type IngredientAlias } from '@/lib/ingredientNames';
import { readHouse, type HouseReading } from '@/lib/makeItHouse';
import { typedPour, type TypedPour } from '@/lib/paste';
import { guessKind, PREP_KINDS } from '@/lib/prepKinds';
import { looksMadeInHouse } from '@/lib/techniques/makeIt';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { KindResults } from './KindResults';
import { TypedLineCard } from './TypedLineCard';

// The pill's accent border shows focus. Chrome draws `outline-style: auto` at any width, so it's switched off (as SearchField does).
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

// The generated view types call `images` a list; it's one row per link.
export type CatalogIngredient = {
  id: string;
  name: string | null;
  bar_id?: string | null;
  hide_from_search?: boolean | null;
  generic_id?: string | null;
  ingredient_role?: string | null;
  brand_maker?: string | null;
  item_images?: unknown;
};

export interface IngredientSearchProps {
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  coreIds?: ReadonlySet<string>;
  /** Holds off offering a new one until the list is in, so a known bottle isn't added twice. */
  loading?: boolean;
  /** With `amounts`, the pour typed before the name ("30 pommeau"). `named`: picked as "Just add the name", so its line doesn't ask what it is. */
  onPick: (pick: WizardPick, pour?: TypedPour, named?: boolean) => void;
  label: string;
  /** The field's hint, when it says more than its label. */
  placeholder?: string;
  /** Reads a pour typed before the name ("30 pommeau", "1/2 oz lemon"): it searches the name and hands on the pour. */
  amounts?: boolean;
  autoFocus?: boolean;
  /** Shows a close button: leaving a swap without changing anything. */
  onCancel?: () => void;
  /** Called with whether something is typed, so the step can hide its suggestions meanwhile. */
  onTyping?: (typing: boolean) => void;
  /** Off: only existing ingredients can be picked (a kind of must exist). */
  allowNew?: boolean;
  /** Offers to make it in house, with its own recipe: a new name, or your own version of one that exists. */
  onMake?: (name: string, pour?: TypedPour) => void;
  /** "Add “X”, a bottle you buy": the desktop page opens its card under its line (what it is, who brings it, its pack). */
  onBottle?: (name: string, pour?: TypedPour) => void;
  /** "Just add the name" for a prep: its recipe is written later, and the save reminds you. */
  onLater?: (name: string, pour?: TypedPour) => void;
  /** A name that sounds made (an oil, a cordial) offers making it before any bottle. Off `ownVersion` (the ingredient wizard can't share a name): Make only for a new name. */
  makeFirst?: boolean;
  ownVersion?: boolean;
  /** Under "A bottle you buy", when it isn't filled in under the line (the editor's ingredient wizard). */ bottleHint?: string;
  /** Under each found ingredient: "On your shelf" (these ids), else "In 14 drinks". Off by default (it asks the server). */
  captions?: boolean;
  shelf?: ReadonlySet<string>;
  /** At a venue: what's on its back bar (hooks/useBackBar useBackBarIds). Its bottles lead "Pick a brand" and say so. */
  backBar?: ReadonlySet<string>;
  /** A kind typed in full (mezcal) shows the plain one first, then its bottles under "Pick a brand". For a drink's lines. */
  brands?: boolean;
  /** "60 ml coconut fat-washed bacardi": says what it read, then adds the bottle to make house (check: ask how first). */
  onHouse?: (bottle: WizardPick, reading: HouseReading<CatalogIngredient>, check: boolean, pour?: TypedPour) => void;
}

/**
 * Find an ingredient, or add a new one. A name that is already an
 * ingredient, by another spelling or alias, offers that one and not a copy;
 * a likely misspelling asks "Did you mean…?" first, and a name nothing
 * matches shows the closest ones. Making it in house is always offered,
 * under the bottles that match (your own version when the name exists),
 * and steps into the house prep steps. Return takes the top hit; it adds nothing new while it asks.
 */
export function IngredientSearch(props: IngredientSearchProps) {
  const { ingredients, aliases = [], coreIds, loading, onPick, label, placeholder, amounts, autoFocus, onCancel, onTyping, allowNew = true, onMake, onBottle, onLater, makeFirst, captions, shelf, backBar, brands, onHouse, ownVersion = true, bottleHint } = props;
  const ds = useDs();
  const [text, setQueryState] = useState('');
  // The whole pill rings in the accent while it has focus (no browser focus box inside it).
  const [focused, setFocused] = useState(false);
  const setQuery = (q: string) => {
    setQueryState(q);
    onTyping?.(!!q.trim());
  };
  // "30 pommeau": the pour, then the name to look for. A name that is itself an ingredient ("7 Up") stays a name.
  const pour = amounts && !sameIngredient(text, ingredients, aliases) ? typedPour(text) : null;
  const query = pour ? pour.name : text;
  const q = query.trim();
  const results = searchIngredients(query, ingredients, { aliases, coreIds });
  const exact = !!sameIngredient(query, ingredients, aliases) || results.some((r) => (r.name ?? '').trim().toLowerCase() === q.toLowerCase());
  const have = backBar ?? shelf;
  // "chartruse": Green Chartreuse, the ones you have first; under "Did you mean", or last when something matched (NearPicks).
  const near = useNearIngredients(query, ingredients, { skip: exact || !q, shown: results, first: exact ? null : nearIngredient(query, ingredients, aliases) }).sort((a, b) => Number(!!have?.has(b.id)) - Number(!!have?.has(a.id)));
  const closest = results.length || near.length || exact || loading ? [] : closestIngredients(query, ingredients, { coreIds });
  // A kind with bottles (mezcal): the plain one, then its brands; other names with the word in them come after both.
  const typed = brands && q ? sameIngredient(query, ingredients, aliases) : null;
  const bottles = typed ? bottlesOfKind(typed, ingredients, have) : [];
  const kindView = typed && bottles.length ? typed : null;
  const listed = kindView ? results.filter((r) => r.id !== kindView.id && !bottles.includes(r)) : results;
  // A bottle you have, made house ("coconut fat-washed bacardi"): what it read sits over the catalog's own matches.
  const reading = onHouse && q && !loading ? readHouse(query, ingredients, { aliases, coreIds, have }) : null;

  // Any new name can be made in house; one that sounds like a prep (a shrub, a cordial, a clarified juice), not a bought bottle, offers it first.
  const prepLike = looksMadeInHouse(query);
  const kind = PREP_KINDS.find((k) => k.id === guessKind(query) && k.id !== 'other')?.name.toLowerCase() ?? null;
  const done = () => setQuery('');
  const makeRow = onMake && (ownVersion || !exact) ? (
    <ResultRow
      label={`Make “${q.charAt(0).toUpperCase()}${q.slice(1)}” in-house`}
      sub={exact ? 'Your own version: steps into its recipe, then back here' : 'A recipe of your own: steps into it, then back here'}
      icon="make"
      onPress={() => {
        onMake(q, pour ?? undefined);
        done();
      }}
    />
  ) : null;
  const Name = `${q.charAt(0).toUpperCase()}${q.slice(1)}`;
  const bottleRow = onBottle ? (
    <ResultRow
      label="A bottle you buy"
      a11y={`Add “${Name}”, a bottle you buy`}
      sub={bottleHint ?? `Add “${Name}” as a bottle, right here under the line`}
      icon="make"
      onPress={() => {
        onBottle(Name, pour ?? undefined);
        done();
      }}
    />
  ) : null;
  const later = !!onLater && prepLike;
  const newRow = (
    <ResultRow
      label="Just add the name"
      a11y={`Just add the name “${q}”`}
      sub={later ? 'Write the recipe later. We’ll remind you.' : 'Added as new when you save.'}
      icon="new"
      onPress={() => {
        if (later) onLater?.(q, pour ?? undefined);
        else onPick({ id: null, name: q }, pour ?? undefined, true);
        done();
      }}
    />
  );

  const lead = makeFirst && prepLike && !exact && !loading;

  const pick = (p: WizardPick) => {
    onPick(p, pour ?? undefined);
    done();
  };
  const found = (r: CatalogIngredient, text?: string, tap = false) => (
    <ResultRow
      key={r.id}
      id={r.id}
      label={text ?? r.name ?? ''}
      caption={captions || tap ? <UseCaption id={captions ? r.id : null} have={have?.has(r.id) ? (backBar ? 'On your back bar' : 'On your shelf') : null} tap={tap} /> : null}
      onPress={() => pick({ id: r.id, name: r.name ?? query })}
    />
  );

  return (
    <View style={styles.stack}>
      <View style={[styles.field, { backgroundColor: ds.c.surface, borderColor: focused ? ds.accentText : ds.c.line }]}>
        <IconSymbol name={q || onCancel || !allowNew ? 'magnifyingglass' : 'plus'} size={18} color={ds.c.muted} />
        <TextInput
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          value={text}
          onChangeText={setQuery}
          placeholder={placeholder ?? label}
          placeholderTextColor={ds.c.muted}
          aria-label={label}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="done"
          maxLength={80}
          onSubmitEditing={() => {
            // Return does what the reading says it will (Looks right), not the catalog's top hit.
            if (reading) {
              onHouse?.({ id: reading.bottles[0].id, name: reading.bottles[0].name ?? reading.base }, reading, false, pour ?? undefined);
              done();
            } else if (results[0]) pick({ id: results[0].id, name: results[0].name ?? query });
            else if (allowNew && q && !loading && !near.length && onBottle && !prepLike) {
              onBottle(Name, pour ?? undefined);
              done();
            } else if (allowNew && q && !loading && !near.length) pick({ id: null, name: q });
          }}
          style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }, NO_OUTLINE]}
        />
        {onCancel ? (
          <PressableScale onPress={onCancel} role="button" accessibilityLabel="Keep it as it was" style={styles.cancel}>
            <IconSymbol name="xmark" size={16} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>

      {pour && q && !reading ? <Caption tone="muted">{`${pour.amount} ${typedUnit(q, pour.unit, getPreferredUnit())} of the one you pick`}</Caption> : null}
      {reading ? (
        <TypedLineCard
          reading={reading}
          pour={pour}
          onAdd={(bottle, check) => {
            onHouse?.(bottle, reading, check, pour ?? undefined);
            done();
          }}
        />
      ) : null}
      {q && kindView ? <KindResults key={kindView.id} kind={kindView} bottles={bottles} have={have} haveLabel={backBar ? 'On your back bar' : 'On your shelf'} onPick={pick} /> : null}
      {q && (!kindView || listed.length || loading || makeRow) ? (
        <View role="list" style={[styles.results, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
          {kindView && listed.length ? (
            <Caption tone="muted" style={styles.label}>
              {`More with “${q}” in the name`}
            </Caption>
          ) : null}
          {closest.length ? (
            <Caption tone="muted" style={styles.label}>
              Nothing called that yet. Closest:
            </Caption>
          ) : !results.length && !near.length && !exact && !loading && allowNew ? (
            <Caption tone="muted" style={styles.label}>
              No bottle by that name.
            </Caption>
          ) : null}
          {closest.map((r) => found(r))}
          {lead ? makeRow : null}
          {listed.map((r) => found(r))}
          {loading ? (
            <Body tone="muted" style={styles.loading}>
              Loading ingredients…
            </Body>
          ) : exact ? (
            makeRow
          ) : (
            <NearPicks found={listed.length > 0} near={near} render={(r) => found(r, undefined, true)} labelStyle={styles.label}>
              {/* Making it in house, under the bottles that match, then a bottle you buy, then the name alone (make-anything-steps-1, step 3). */}
              {allowNew && !lead ? makeRow : null}
              {allowNew ? bottleRow : null}
              {allowNew ? newRow : null}
            </NearPicks>
          )}
        </View>
      ) : null}
      {q && exact && makeRow && !loading ? (
        <Caption tone="muted">{`Return takes the top one. Make is still here: ${kind ? `a ${kind}` : 'one'} of your own is saved as yours, next to the one you have.`}</Caption>
      ) : null}
    </View>
  );
}

/** "On your shelf" (or back bar), else how many drinks use it; a close name adds "tap to use it" (canvas 2A). */
function UseCaption({ id, have, tap }: { id: string | null; have: string | null; tap: boolean }) {
  const { data: n } = useIngredientUse(have ? null : id);
  const text = [have ?? (n ? `In ${n} ${n === 1 ? 'drink' : 'drinks'}` : null), tap ? 'tap to use it' : null].filter(Boolean).join(' · ');
  return text ? <Caption tone="muted">{text.charAt(0).toUpperCase() + text.slice(1)}</Caption> : null;
}

/** A found ingredient with its drawing, or an action row with its tile: make it in house (+, and on to the builder), or just the name (lines). */
function ResultRow({ id, label, a11y, sub, caption, icon, onPress }: { id?: string; label: string; a11y?: string; sub?: string; caption?: ReactNode; icon?: 'make' | 'new'; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={a11y ?? label} accessibilityHint={sub} style={[styles.result, { borderBottomColor: ds.c.line }]}>
      {icon ? (
        <View style={[styles.tile, { backgroundColor: icon === 'make' ? ds.accentFill.fill : ds.c.raised }]}>
          <IconSymbol name={icon === 'make' ? 'plus' : 'text.alignleft'} size={16} color={icon === 'make' ? ds.accentFill.text : ds.c.muted} />
        </View>
      ) : (
        <IngredientThumb id={id} name={label} size={36} />
      )}
      <View style={styles.flex}>
        <Body numberOfLines={icon ? 2 : 1}>{label}</Body>
        {sub ? <Caption tone="muted">{sub}</Caption> : caption}
      </View>
      {icon === 'make' ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingLeft: space.lg, paddingRight: space.xs },
  input: { flex: 1, minHeight: layout.minTapTarget },
  cancel: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  results: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  label: { paddingHorizontal: space.md, paddingTop: space.md },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 4, paddingHorizontal: space.md, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  tile: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  loading: { padding: space.md },
});
