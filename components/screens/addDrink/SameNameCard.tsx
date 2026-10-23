import { useRouter, type Href } from 'expo-router';
import { Alert, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, Caption, DrinkImage, DsText, Surface, useDs } from '@/components/ds';
import { displayFaces, fontFamilies, radius, space, type } from '@/constants/tokens';
import type { SameNameDrink } from '@/hooks/useSameNameDrink';
import { useStartFromClassic } from '@/hooks/useStartFromClassic';
import type { WizardDraft } from '@/lib/drinkWizard';
import { withArticle } from '@/lib/closestClassic';
import { versionName } from '@/lib/sameName';

// The box is the field: no browser focus ring on the word (as BigName).
const NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

interface CardProps {
  /** Whose drink it is ("Little Rye"). */
  bar: string;
  drink: SameNameDrink;
  /** Under the choices: what a version is, or what Open it is for. */
  caption: string;
  /** Desktop: the drink beside the heading and the three choices in a row. */
  wide?: boolean;
  busy?: boolean;
  onOpen: () => void;
  onVersion: () => void;
  onDifferent: () => void;
}

/**
 * "Little Rye already has a Negroni" (board dup-drink-warning): the drink it
 * has, then Open it, Make this a version or It's a different drink. Whatever
 * it sits on waits until one is picked.
 */
export function SameNameCard({ bar, drink, caption, wide, busy, onOpen, onVersion, onDifferent }: CardProps) {
  const ds = useDs();
  const title = `${bar} already has ${withArticle(drink.name)}`;
  const line = [drink.line, drink.menu].filter(Boolean).join(' · ');
  const thumb = <DrinkImage source={drink.imageUrl} itemId={drink.id} glass={drink.glass} thumb sketchDetail="thumb" radius="control" accessibilityLabel={drink.name} style={wide ? styles.thumbWide : styles.thumb} />;
  return (
    <Surface raised>
      <View role="group" aria-label={title} style={styles.card}>
        {wide ? (
          <View style={styles.drinkRow}>
            {thumb}
            <View style={styles.flex}>
              <DsText variant="body" color={ds.c.ink} style={styles.bold}>
                {title}
              </DsText>
              {line ? <Caption tone="muted">{line}</Caption> : null}
            </View>
          </View>
        ) : (
          <>
            <DsText variant="body" color={ds.c.ink} style={styles.bold}>
              {title}
            </DsText>
            <View style={[styles.drinkRow, styles.drink, { backgroundColor: ds.c.surface }]}>
              {thumb}
              <View style={styles.flex}>
                <DsText variant="label" color={ds.c.ink} style={styles.bold} numberOfLines={1}>
                  {drink.name}
                </DsText>
                {line ? <Caption tone="muted">{line}</Caption> : null}
              </View>
            </View>
          </>
        )}
        <View style={styles.choices}>
          <Button label="Open it" size="sm" onPress={onOpen} disabled={busy} accessibilityLabel={`Open ${bar}’s ${drink.name}. Your draft is kept`} />
          <Button label={busy ? 'Loading…' : 'Make this a version'} size="sm" variant="secondary" onPress={onVersion} disabled={busy} />
          <Button label="It’s a different drink" size="sm" variant="secondary" onPress={onDifferent} disabled={busy} />
        </View>
        <Caption tone="muted">{caption}</Caption>
      </View>
    </Surface>
  );
}

/** "Negroni ( summer )": the word in brackets after a version's name. */
export function BracketField({ name, value, onChange, label, autoFocus }: { name?: string; value: string; onChange: (word: string) => void; label: string; autoFocus?: boolean }) {
  const ds = useDs();
  const face = { fontFamily: name ? displayFaces[ds.displayFace].regular : fontFamilies.body };
  const text = name ? type.headline : type.body;
  return (
    <View style={[styles.bracket, { borderColor: ds.c.ink }]}>
      <DsText variant={name ? 'headline' : 'body'} color={ds.c.muted} style={face} aria-hidden>
        {name ? `${name} (` : '('}
      </DsText>
      <TextInput
        value={value}
        onChangeText={onChange}
        aria-label={label}
        autoFocus={autoFocus}
        maxLength={30}
        autoCorrect={false}
        style={[styles.word, text, face, { color: ds.c.ink }, NO_OUTLINE]}
      />
      <DsText variant={name ? 'headline' : 'body'} color={ds.c.muted} style={face} aria-hidden>
        )
      </DsText>
    </View>
  );
}

/**
 * What the three choices do to a draft. Open it goes to the bar's drink
 * (the draft is kept, as closing the wizard keeps it). A version links to
 * the classic the bar's drink is a version of, else the bar's drink, and from
 * the name step starts from the bar's spec. A different drink keeps no link
 * and asks for a name.
 * ponytail: the database reads a name with a word in brackets as a riff
 * (private.drink_name_key) and a link to a bar's drink as a riff too, so a
 * version isn't marked a variation yet; that needs a migration (board
 * dup-drink-warning, "Later steps").
 */
export function useSameNamePicks(set: (change: Partial<WizardDraft>) => void) {
  const router = useRouter();
  const start = useStartFromClassic();
  const open = (drink: SameNameDrink) => router.push(`/cocktail/${drink.id}` as Href);
  const version = (drink: SameNameDrink, bar: string, withSpec: boolean, then?: () => void) => {
    const riffOf = drink.classic ?? { id: drink.id, name: drink.name };
    const sameAs = { id: drink.id, name: drink.name, bar, as: 'version' as const, word: '' };
    if (!withSpec) {
      set({ riffOf, sameAs, name: drink.name });
      return then?.();
    }
    start.mutate(drink.id, {
      onSuccess: (change) => {
        set({ ...change, riffOf, name: drink.name, sameAs: { ...sameAs, started: drink.line.replace(/^./, (c) => c.toLowerCase()) || null } });
        then?.();
      },
      onError: (e) => Alert.alert('Couldn’t load that spec', e.message),
    });
  };
  const different = (drink: SameNameDrink, bar: string, then?: () => void) => {
    set({ sameAs: { id: drink.id, name: drink.name, bar, as: 'different' } });
    then?.();
  };
  /** The word typed: the name follows it ("Negroni (summer)"). */
  const word = (draft: WizardDraft, typed: string) => draft.sameAs && set({ sameAs: { ...draft.sameAs, word: typed }, name: versionName(draft.sameAs.name, typed) });
  /** Not a version after all: back to the bar's drink and its three choices, with no link to it (or its classic) left behind. */
  const undo = (draft: WizardDraft) => draft.sameAs && set({ sameAs: null, name: draft.sameAs.name, riffOf: null });
  return { open, version, different, word, undo, busy: start.isPending };
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  drinkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  drink: { padding: space.sm, borderRadius: radius.control },
  thumb: { width: 44, height: 44 },
  thumbWide: { width: 56, height: 56 },
  flex: { flex: 1, gap: 2 },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  bracket: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: 48 },
  word: { flex: 1, paddingVertical: space.sm },
});
