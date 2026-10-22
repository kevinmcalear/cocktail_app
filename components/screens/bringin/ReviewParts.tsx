import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, palateHues, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { DrinkMark, Tally } from '@/lib/importReview';
import type { ReadFile } from '@/lib/readAnything';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';

import { MonoLabel } from './CheckParts';
import { SourceCrop } from './PagePicture';
import { amountShown } from './RecipeSpec';

/** The bar that counts checked out of total, and the words beside it. */
export function ProgressLine({ t, words }: { t: Tally; words: string }) {
  const ds = useDs();
  const share = t.total ? Math.round((t.checked / t.total) * 100) : 0;
  return (
    <View style={styles.progress}>
      <View role="progressbar" aria-label={words} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} style={[styles.track, { backgroundColor: withAlpha(ds.c.ink, 0.12) }]}>
        <View style={[styles.fill, { width: `${share}%`, backgroundColor: ds.accentText }]} />
      </View>
      <Caption tone="muted" numberOfLines={1} style={styles.mono}>
        {words}
      </Caption>
    </View>
  );
}

/** "Edit this drink": a plain ink link, as the board sets it. */
export function EditLink({ onPress }: { onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="Edit this drink" onPress={onPress} style={styles.edit}>
      <DsText variant="label" color={ds.c.ink} style={styles.bold}>
        Edit this drink
      </DsText>
    </PressableScale>
  );
}

// The board's green for Approved: the palate's green, which holds contrast in both themes.
const useGreen = () => palateHues[useDs().scheme].green;

/** A drink in the desktop list: approved (a green tick), skipped (a dash), or still to check (an empty ring). */
export function DrinkListRow({ name, mark, current, onPress }: { name: string; mark: DrinkMark; current: boolean; onPress: () => void }) {
  const ds = useDs();
  const green = useGreen();
  const done = mark === 'approved' || mark === 'saving';
  const word = done ? 'Approved' : mark === 'skipped' ? 'Skipped' : null;
  return (
    <PressableScale role="button" aria-current={current || undefined} accessibilityLabel={word ? `${name}, ${word.toLowerCase()}` : name} onPress={onPress} style={[styles.listRow, current ? { backgroundColor: ds.c.raised } : null]}>
      <View style={styles.listMark} aria-hidden>
        {done ? <IconSymbol name="checkmark" size={14} color={green} /> : mark === 'skipped' ? <View style={[styles.dash, { backgroundColor: ds.c.muted }]} /> : <View style={[styles.ring, { borderColor: ds.c.lineStrong }]} />}
      </View>
      <DsText variant="label" color={ds.c.ink} numberOfLines={1} style={styles.flex}>
        {name}
      </DsText>
      {word ? <Caption color={done ? green : ds.c.muted}>{word}</Caption> : null}
    </PressableScale>
  );
}

/**
 * "From your file · page 2": the bit of the file the drink was read from, so
 * any number can be checked against it. A photo shows its crop (tap for the
 * whole page); a PDF, text, or a page this device no longer has shows the
 * words read, on paper.
 */
export function FilePart({ recipe, files, usual, onLook }: { recipe: RecipeReading; files: ReadFile[]; usual: string; onLook: () => void }) {
  const ds = useDs();
  const file = recipe.at ? (files[recipe.at.page] ?? null) : null;
  const photo = !!file?.uri && file.mimeType.startsWith('image/') && !!recipe.at;
  const page = recipe.at && files.length > 1 ? ` · PAGE ${recipe.at.page + 1}` : '';
  const words = [...recipe.lines.map((l) => `${amountShown(l, l.unit ?? usual)} ${l.ingredient}`.trim()), recipe.method].filter((w): w is string => !!w);
  return (
    <View style={styles.file}>
      <MonoLabel>{`FROM YOUR FILE${page}`}</MonoLabel>
      {photo ? (
        <PressableScale role="button" accessibilityLabel="The page this drink came from. See it bigger" onPress={onLook}>
          <SourceCrop file={file} box={recipe.at!.box} words={recipe.name} width={318} height={200} />
        </PressableScale>
      ) : (
        <View role="img" aria-label={`The ${recipe.name} part of your file`} style={[styles.paper, { backgroundColor: ds.c.paper }]}>
          <DsText variant="caption" color={ds.c.sketchInk} style={styles.bold}>
            {recipe.name}
          </DsText>
          {words.map((w, i) => (
            <DsText key={i} variant="caption" color={ds.c.sketchInk}>
              {w}
            </DsText>
          ))}
        </View>
      )}
      <Caption tone="muted">Check any number against the page. The file is never used as the drink’s photo.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { flex: 1, height: 6, borderRadius: radius.mark, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.mark },
  mono: { fontFamily: fontFamilies.mono },
  edit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  bold: { fontFamily: fontFamilies.bodySemiBold },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: 40, paddingHorizontal: space.sm + 2, borderRadius: radius.control - 2 },
  listMark: { width: 16, alignItems: 'center' },
  dash: { width: 10, height: 2 },
  ring: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: 1.5 },
  flex: { flex: 1 },
  file: { gap: space.sm + 2 },
  paper: { borderRadius: radius.control, padding: space.lg, gap: 1 },
});
