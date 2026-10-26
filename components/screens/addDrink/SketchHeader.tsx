import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Caption, Headline, PressableScale, Sheet, useDs } from '@/components/ds';
import { AnimatedSketch } from '@/components/ds/AnimatedSketch';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, fontFamilies, layout, radius, space } from '@/constants/tokens';
import { COUNTED_STEPS, sketchLook, WIZARD_STEPS, type WizardDraft, type WizardStep } from '@/lib/drinkWizard';
import { draftSketchInputs, type DraftLook } from '@/lib/sketch/draft';
import type { SketchInputs } from '@/lib/sketch/types';

import type { TrailItem } from './Trail';
import { DraftColourSheet } from './DraftColourSheet';
import { PaperBand } from './PaperBand';

/** The seed only moves the pencil's wobble; a fixed one keeps the drawing steady while the drink changes. */
const SEED = 'new-drink';
/** On review, how long the finished drawing takes to fade before it's drawn again. */
const FADE_FIRST_MS = 450;
/**
 * The steps where you type or pick from a list: on a phone the band is one
 * row with the drawing as a thumbnail, so the step gets the room (canvas
 * Create, Q17 D). Glass, ice, garnish and review, where the drawing is the
 * point, keep it full.
 */
const COMPACT_STEPS: readonly WizardStep[] = ['name', 'ingredients', 'method', 'credits', 'notes', 'publish'];

// The last drawing's inputs, so a keystroke that doesn't change the drink
// hands SketchDrawing the same object (it caches the painted scene by it).
let last: { key: string; inputs: SketchInputs } | null = null;
export function inputsFor(look: DraftLook): SketchInputs {
  const key = JSON.stringify(look);
  if (last?.key !== key) last = { key, inputs: draftSketchInputs(look) };
  return last.inputs;
}

interface SketchHeaderProps {
  draft: WizardDraft;
  step: WizardStep;
  onBack: () => void;
  /** Space above the controls (the status bar on a phone). */
  top: number;
  side: number;
  /** In a centred column (wide screens): rounded, not edge to edge. */
  rounded: boolean;
  /** Just the controls, while the keyboard is up on a phone. */
  folded?: boolean;
  /** The bar's glasses' drawings (bar_glassware), drawn when no shape is picked. */
  barVariants?: readonly string[];
  /** The venue's ice kinds, drawn in place of a guessed ice. */
  barIce?: readonly string[];
  /** The drawing's side; by default 200 in a column and 152 in a phone's band. */
  size?: number;
  /** Picks the drawing's colour (Auto is null): a Colour button on the band, from the first step. */
  onTint?: (tint: string | null) => void;
  /** With a hero photo, the band shows it and offers to keep the drawing after the photos (E26, draft.keepDrawing). */
  onKeepDrawing?: (keep: boolean) => void;
  /** Where the drink is, from the menu down (make-anything-steps-1, step 3): "Halloween party › Salty Boy". */
  trail?: readonly TrailItem[];
  /** The menu it's made for: the band says "For Halloween party". */
  forMenu?: string | null;
}

/**
 * The add-drink wizard's paper band, with the drink drawn as it's being
 * added. Every step redraws it (glass, ice, method, colour, garnish) with the
 * rules the saved drink is drawn with.
 */
export function SketchHeader({ draft, step, barVariants, barIce, onTint, onKeepDrawing, forMenu, ...band }: SketchHeaderProps) {
  const look = sketchLook(draft, barVariants, barIce);
  // Nothing in it yet: a coupe waiting to be filled, as the canvas draws the first step.
  const empty = !look.glass && !look.lines.length && !look.methods?.length;
  const inputs = inputsFor(empty ? { ...look, glass: 'Coupe' } : look);
  const at = WIZARD_STEPS.indexOf(step);
  const counted = Math.min(at + 1, COUNTED_STEPS);
  // The review step draws the finished drink again from a blank page; a tap replays it.
  const reviewing = step === 'review';
  const [play, setPlay] = useState(0);
  const [colouring, setColouring] = useState(false);
  const [showing, setShowing] = useState(false);
  const compact = !band.rounded && COMPACT_STEPS.includes(step);
  const name = draft.name.trim() || 'New drink';
  // The draft's id once it has one: the saved drink is drawn with its id, so it keeps this drawing.
  const seed = draft.id ?? SEED;
  // A hero photo takes the band (board w2-wizard-finish, E26 B): the drawing goes unless kept, and its colour only matters then.
  // The full band shows the photo with the Drawing pill; the compact one has it as the thumbnail, and the pill in its full-size sheet.
  const photo = onKeepDrawing ? (draft.photos?.hero ?? null) : null;
  const kept = !!draft.keepDrawing;
  const colour = onTint && (!photo || kept) ? <ColourButton name={name} iconOnly={compact} onPhoto={!!photo && !compact} onPress={() => setColouring(true)} /> : null;
  const pill = photo ? <DrawingPill kept={kept} onChange={onKeepDrawing!} /> : null;
  return (
    <>
      <PaperBand
        {...band}
        compact={compact}
        photo={photo}
        onShowArt={() => setShowing(true)}
        action={
          pill && !compact ? (
            <View style={styles.photoActions}>
              {pill}
              {colour}
            </View>
          ) : (
            colour
          )
        }
        first={at === 0}
        progress={{ now: counted, of: COUNTED_STEPS, label: step === 'review' ? 'Review' : `${counted} of ${COUNTED_STEPS}` }}
        art={
          reviewing ? (
            // A toy, not a control: the band's label already names the drawing.
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPlay((n) => n + 1)} accessible={false}>
              <AnimatedSketch inputs={inputs} seed={seed} play={play} delay={FADE_FIRST_MS} />
              {/* The finished drawing fades away first, then the pencil starts on blank paper. */}
              <FadeAway key={`fade-${play}`} inputs={inputs} seed={seed} />
            </Pressable>
          ) : (
            <SketchDrawing inputs={inputs} seed={seed} detail="full" />
          )
        }
        artKey={`${reviewing ? 'review:' : ''}${JSON.stringify(inputs)}`}
        tag={photo ? undefined : 'Drink'}
        note={photo ? '' : reviewing ? 'Tap to draw it again' : forMenu ? `For ${forMenu}` : 'Updates as you go'}
        artLabel="Sketch of the drink so far"
      />
      {compact ? (
        <Sheet style={styles.sheet} visible={showing} onClose={() => setShowing(false)} accessibilityLabel={photo ? `Photo of ${name}` : `Sketch of ${name} so far`} header={<Headline role="heading">{name}</Headline>}>
          <View style={styles.full}>
            {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <SketchDrawing inputs={inputs} seed={seed} detail="full" />}
          </View>
          {pill ? (
            <View style={styles.fullPill}>{pill}</View>
          ) : (
            <Caption tone="muted" style={styles.fullNote}>
              Updates as you go
            </Caption>
          )}
        </Sheet>
      ) : null}
      {onTint ? <DraftColourSheet visible={colouring} onClose={() => setColouring(false)} name={name} inputs={inputs} seed={seed} value={draft.tint ?? null} onChange={onTint} photo={draft.photos?.hero ?? null} /> : null}
    </>
  );
}

/**
 * The band's Colour pill, styled like its back button. Not a GlassButton: the
 * band folds while the keyboard is up, and removing a glass view mid-fold
 * tripped Reanimated's layout bookkeeping in iOS debug builds.
 */
function ColourButton({ name, iconOnly, onPhoto, onPress }: { name: string; iconOnly?: boolean; onPhoto?: boolean; onPress: () => void }) {
  const ds = useDs();
  const ink = onPhoto ? backbar.dark.ink : ds.c.sketchInk;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`Sketch colour, ${name}`} style={[styles.colour, iconOnly && styles.colourIcon, { backgroundColor: onPhoto ? backbar.dark.glass : backbar.light.glass }]}>
      <IconSymbol name="paintpalette.fill" size={16} color={ink} />
      {iconOnly ? null : (
        <Caption color={ink} style={styles.colourLabel}>
          Colour
        </Caption>
      )}
    </PressableScale>
  );
}

/**
 * Over a hero photo: whether the drawing stays on the drink's page after the
 * photos. Removed to start (Kevin's call B, 26 Oct), Keep it in one tap.
 */
function DrawingPill({ kept, onChange }: { kept: boolean; onChange: (keep: boolean) => void }) {
  const ink = backbar.dark.ink;
  return (
    <View style={[styles.pill, { backgroundColor: backbar.dark.glass }]}>
      <IconSymbol name="pencil" size={16} color={ink} />
      <Caption color={ink} style={styles.colourLabel}>
        {kept ? 'Drawing: after the photos' : 'Drawing removed'}
      </Caption>
      <PressableScale
        role="button"
        onPress={() => onChange(!kept)}
        accessibilityLabel={kept ? 'Remove the drawing: photos only on the drink’s page' : 'Keep the drawing, after the photos'}
        style={[styles.pillButton, { backgroundColor: backbar.dark.glassBorder }]}
      >
        <Caption color={ink} style={styles.colourLabel}>
          {kept ? 'Remove' : 'Keep it'}
        </Caption>
      </PressableScale>
    </View>
  );
}

/** The finished drawing, fading out once when it mounts; taps pass through to the drawing under it. */
function FadeAway({ inputs, seed }: { inputs: SketchInputs; seed: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withTiming(0, { duration: FADE_FIRST_MS }));
  }, [opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.passThrough, fade]}>
      <SketchDrawing inputs={inputs} seed={seed} detail="full" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
  colour: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget, paddingHorizontal: space.md, borderRadius: radius.pill },
  colourLabel: { fontFamily: fontFamilies.bodySemiBold },
  // The compact band's Colour: a round button like Back.
  colourIcon: { width: layout.minTapTarget, paddingHorizontal: 0, justifyContent: 'center' },
  full: { width: '100%', maxWidth: 320, aspectRatio: 1, alignSelf: 'center', borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  sheet: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  fullNote: { alignSelf: 'center', marginTop: space.md },
  fullPill: { alignSelf: 'center', marginTop: space.md },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: layout.minTapTarget, paddingLeft: space.md, paddingRight: space.xs, borderRadius: radius.pill, flexShrink: 1 },
  pillButton: { minHeight: layout.minTapTarget - space.sm, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill },
});
