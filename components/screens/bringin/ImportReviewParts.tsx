import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';
import { countWords, reviewCount, whenWords, type DrinkMark, type ReviewCount } from '@/lib/importReview';
import type { ReadFile } from '@/lib/readAnything';
import { useBringIn } from '@/store/useBringIn';
import { useImportReview, useWaitingReviews, type ImportReview } from '@/store/useImportReview';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';

import { MonoLabel } from './CheckParts';
import { PagePicture } from './PagePicture';
import { amountShown } from './RecipeDrink';

/** The bar across the top: checked out of total, and (on a laptop) approved and skipped. */
export function ReviewBar({ count, form = 'full' }: { count: ReviewCount; form?: 'full' | 'checked' | 'short' }) {
  const ds = useDs();
  const words = countWords(count, form);
  return (
    <View style={styles.bar}>
      <View role="progressbar" aria-label={countWords(count)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={count.percent} style={[styles.track, { backgroundColor: ds.c.raised }]}>
        <View style={[styles.fill, { width: `${count.percent}%`, backgroundColor: ds.accentText }]} />
      </View>
      <Caption tone="muted" style={styles.mono} numberOfLines={1}>
        {words}
      </Caption>
    </View>
  );
}

const MARK_WORD: Record<DrinkMark, string | null> = { waiting: null, approved: 'Approved', skipped: 'Skipped', edited: 'Edited' };

function MarkIcon({ mark }: { mark: DrinkMark }) {
  const ds = useDs();
  const good = readableAccent(STATUS.success, ds.c.ground);
  if (mark === 'approved' || mark === 'edited') return <IconSymbol name="checkmark" size={14} color={good} />;
  if (mark === 'skipped') return <View style={[styles.dash, { backgroundColor: ds.c.muted }]} />;
  return <View style={[styles.ring, { borderColor: ds.c.lineStrong }]} />;
}

/** The drinks down the left, each with where it stands; one tap opens it. */
export function DrinkList({ review, onPick }: { review: ImportReview; onPick: (at: number) => void }) {
  const ds = useDs();
  const good = readableAccent(STATUS.success, ds.c.ground);
  return (
    <ScrollView style={[styles.list, { borderRightColor: ds.c.line }]} contentContainerStyle={styles.listBody}>
      <MonoLabel style={styles.listLabel}>{`${review.recipes.length} DRINKS`}</MonoLabel>
      <View role="navigation" aria-label="Drinks in this file">
        {review.recipes.map((r, i) => {
          const mark = review.marks[i];
          const word = MARK_WORD[mark];
          const current = i === review.at;
          return (
            <PressableScale
              key={i}
              role="button"
              aria-current={current ? 'true' : undefined}
              accessibilityLabel={[review.choices[i]?.name || r.name, word].filter(Boolean).join(', ')}
              onPress={() => onPick(i)}
              style={[styles.item, current && { backgroundColor: ds.c.raised }]}
            >
              <View style={styles.icon}>
                <MarkIcon mark={mark} />
              </View>
              <Body numberOfLines={1} style={styles.flex}>
                {review.choices[i]?.name || r.name}
              </Body>
              {word ? <Caption color={mark === 'skipped' ? ds.c.muted : good}>{word}</Caption> : null}
            </PressableScale>
          );
        })}
      </View>
    </ScrollView>
  );
}

/**
 * The bit of the file a drink was read from, down the right: the page with
 * the drink boxed when it's a photo, else the words read as the page set
 * them (a PDF can't be drawn here, and a page kept from an earlier visit
 * may be gone from this device).
 */
export function FileColumn({ recipe, files }: { recipe: RecipeReading; files: ReadFile[] }) {
  const ds = useDs();
  const file = recipe.at ? (files[recipe.at.page] ?? null) : null;
  const page = recipe.at && files.length > 1 ? ` · PAGE ${recipe.at.page + 1}` : '';
  // A photo kept from an earlier visit may be gone from this device: the words read stand in.
  const [goneUri, setGoneUri] = useState<string | null>(null);
  const photo = !!file && file.mimeType.startsWith('image/') && goneUri !== file.uri;
  return (
    <ScrollView role="complementary" aria-label="From your file" style={[styles.file, { borderLeftColor: ds.c.line }]} contentContainerStyle={styles.fileBody}>
      <MonoLabel>{`FROM YOUR FILE${page}`}</MonoLabel>
      {photo && recipe.at ? (
        <PagePicture file={file} width={320} maxHeight={520} marks={[{ box: recipe.at.box, dashed: false }]} style={styles.start} onGone={() => setGoneUri(file.uri)} />
      ) : (
        <View role="img" aria-label={`The ${recipe.name} part of your file`} style={[styles.paper, { backgroundColor: ds.c.paper }]}>
          <DsText variant="caption" color={ds.c.sketchInk} style={styles.semibold}>
            {recipe.name}
          </DsText>
          {recipe.lines.map((l, i) => (
            <DsText key={i} variant="caption" color={ds.c.sketchInk}>
              {`${amountShown(l, l.unit ?? 'ml')} ${l.ingredient}`.trim()}
            </DsText>
          ))}
          {recipe.method ? (
            <DsText variant="caption" color={ds.c.sketchInk}>
              {recipe.method}
            </DsText>
          ) : null}
        </View>
      )}
      <Caption tone="muted">Check any number against the page. The file is never used as the drink’s photo.</Caption>
    </ScrollView>
  );
}

/** Where a big import waits (top of the Library, and Bring in): its name, how far, Carry on or Later. */
export function CarryOnCard({ review, onCarryOn, onLater }: { review: ImportReview; onCarryOn: () => void; onLater: () => void }) {
  const ds = useDs();
  const count = reviewCount(review.marks);
  return (
    <View role="group" aria-label={`${review.title}, waiting to be checked`} style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.cardHead}>
        <Body style={[styles.semibold, styles.flex]} numberOfLines={1}>
          {review.title}
        </Body>
        <Caption tone="muted">{whenWords(review.updatedAt)}</Caption>
      </View>
      <ReviewBar count={count} form="checked" />
      <View style={styles.cardButtons}>
        <Button label="Carry on" size="lg" onPress={onCarryOn} style={styles.flex} />
        <Button label="Later" size="lg" variant="secondary" onPress={onLater} />
      </View>
    </View>
  );
}

/** Big imports waiting here (a venue, or home), each as a card to carry on. Nothing when none wait. */
export function WaitingImports({ barId }: { barId: string | null }) {
  const router = useRouter();
  const waiting = useWaitingReviews(barId);
  if (!waiting.length) return null;
  return (
    <View style={styles.cards}>
      {waiting.map((r) => (
        <CarryOnCard key={r.id} review={r} onCarryOn={() => {
            useBringIn.getState().closeSheet();
            router.push(`/bring-in?review=${r.id}` as Href);
          }} onLater={() => useImportReview.getState().putOff(r.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Card-sized beside a wide Library, as the board draws it.
  cards: { gap: space.sm, maxWidth: 560 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  track: { flex: 1, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.mono },
  list: { width: 280, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth },
  listBody: { paddingVertical: space.md, paddingHorizontal: space.md, gap: 2 },
  listLabel: { paddingHorizontal: space.sm + 2, paddingBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, minHeight: 40, paddingHorizontal: space.sm + 2, borderRadius: radius.control - 2 },
  icon: { width: 16, alignItems: 'center' },
  dash: { width: 10, height: 2 },
  ring: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: 1.5 },
  file: { width: 360, flexGrow: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  fileBody: { paddingVertical: space.xl - 2, paddingHorizontal: space.lg + 4, gap: space.sm + 2 },
  paper: { borderRadius: radius.control, padding: space.lg, gap: 2 },
  start: { alignSelf: 'flex-start' },
  semibold: { fontFamily: fontFamilies.bodySemiBold },
  card: { borderRadius: radius.control + 6, borderWidth: 1, paddingVertical: space.md + 2, paddingHorizontal: space.lg, gap: space.sm + 2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  cardButtons: { flexDirection: 'row', gap: space.sm + 2 },
  flex: { flex: 1, minWidth: 0 },
});
