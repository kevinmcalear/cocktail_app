import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { SKETCH_SAMPLES } from '@/constants/sketch';
import { drawing, space } from '@/constants/tokens';
import { CHALK, mapScene, pencilOnly } from '@/lib/sketch/passes';
import type { Scene } from '@/lib/sketch/scene';
import { sceneToSvg } from '@/lib/sketch/svg';
import { readSketchInputs, type SketchInputs } from '@/lib/sketch/types';

import { Button } from './Button';
import { Pulse } from './Pulse';
import { Body, Caption, Headline } from './Text';
import { sceneFor } from './SketchDrawing';
import { useDs } from './theme';

export type PencilStateKind = 'empty' | 'loading' | 'error' | 'offline';

// An empty coupe: what an empty shelf or menu draws when the caller has nothing of its own.
const EMPTY_GLASS = readSketchInputs({ v: 2, glass: 'coupe', ice: 'none', method: 'stir', liquid: { hex: SKETCH_SAMPLES.martini, alpha: 0.2 } }) as SketchInputs;

const pencils = new WeakMap<Scene, Map<string, Scene>>();
/** A scene in pencil only (no colour yet), chalk at night: the draft's drawing, still or drawn as you watch (AnimatedSketch `pencil`). */
export function pencilScene(scene: Scene, night: boolean): Scene {
  let byMode = pencils.get(scene);
  if (!byMode) pencils.set(scene, (byMode = new Map()));
  const key = night ? 'night' : 'day';
  let out = byMode.get(key);
  if (!out) {
    const pencil = pencilOnly(scene);
    // At night the pencil is chalk.
    byMode.set(key, (out = night ? mapScene(pencil, (el) => (el.k === 'stroke' ? { ...el, color: CHALK } : el)) : pencil));
  }
  return out;
}

const pictures = new WeakMap<Scene, string>();
function pencilUri(scene: Scene, night: boolean): string {
  const shown = pencilScene(scene, night);
  let out = pictures.get(shown);
  if (!out) pictures.set(shown, (out = `data:image/svg+xml;base64,${btoa(sceneToSvg(shown))}`));
  return out;
}

export interface PencilStateProps {
  kind: PencilStateKind;
  /** One line: "No drinks on this menu yet", "Couldn't load the menu". */
  title: string;
  /** What to do about it, or why: "Add one from the + above." Offline defaults to "Saved on this phone". */
  detail?: string;
  /** The one action: Add a drink, Try again. Loading never has one. */
  action?: { label: string; onPress: () => void };
  /** The drink or glass to draw in pencil; an empty coupe otherwise. */
  inputs?: SketchInputs;
  seed?: string;
  /** Inside a list or card: the row-sized drawing, side by side with the words. */
  compact?: boolean;
}

/**
 * Empty, loading, error and offline, drawn in pencil (decision state-design):
 * the glass before any colour, one line, and one action. Loading draws the
 * outline and breathes (still with Reduce Motion); error says what went wrong
 * and offers Try again; offline shows what's on the phone. Every screen's
 * empty, loading and offline states use this.
 */
export function PencilState({ kind, title, detail, action, inputs = EMPTY_GLASS, seed = 'pencil-state', compact }: PencilStateProps) {
  const ds = useDs();
  // Loading breathes (Pulse holds still with Reduce Motion, and is CSS on the web).
  const Drawing = kind === 'loading' ? Pulse : View;
  const px = compact ? drawing.row : drawing.tile;
  const uri = pencilUri(sceneFor(inputs, seed, compact ? 'thumb' : 'full'), ds.scheme === 'dark');
  const words = detail ?? (kind === 'offline' ? 'Saved on this phone' : undefined);
  const Heading = compact ? Body : Headline;
  return (
    <View
      style={compact ? styles.row : styles.column}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
    >
      <Drawing aria-hidden style={{ width: px, height: px }}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory" accessible={false} />
      </Drawing>
      <View style={compact ? styles.wordsRow : styles.words}>
        <Heading style={compact ? null : styles.centre}>{title}</Heading>
        {words ? (
          <Caption tone="muted" style={compact ? null : styles.centre}>
            {words}
          </Caption>
        ) : null}
        {action && kind !== 'loading' ? (
          <View style={styles.action}>
            <Button label={action.label} onPress={action.onPress} variant={kind === 'error' ? 'secondary' : 'primary'} size="sm" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A drink drawn in pencil only (the draft page's hero): its glass, ice and garnish, no colour yet. */
export function PencilDrawing({ inputs, seed, size }: { inputs: SketchInputs; seed: string; size: number }) {
  const ds = useDs();
  const uri = pencilUri(sceneFor(inputs, seed, 'full'), ds.scheme === 'dark');
  return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" cachePolicy="memory" accessible={false} aria-hidden />;
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  words: { alignItems: 'center', gap: space.xs, maxWidth: 320 },
  wordsRow: { flex: 1, gap: 2 },
  centre: { textAlign: 'center' },
  action: { paddingTop: space.sm },
});
