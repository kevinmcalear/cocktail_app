import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { NEVER_GUESSES, readSize, TRACE_FAIL, type SizeBy } from '@/lib/drawGlass';
import { pickGlassPhoto, readGlassPhoto, type GlassPhoto } from '@/lib/glassPhoto';
import { holdsMl, resizeOutline, traceGlass, type TraceFail, type TracedGlass, type TraceSize } from '@/lib/glassTrace';
import type { GlassOutline } from '@/lib/sketch/outline';
import type { SketchGlass } from '@/lib/sketch/types';

import type { KitQuestion } from '../KitAddSheet';
import { CompareStep, PhotoChip, PhotoDrop, PhotoTips, SizeStep, TracingStep, type SizeValue } from './DrawSteps';

/** What Draw my glass hands back on Looks right. */
export interface DrawnGlass {
  glass: SketchGlass;
  name: string;
  maker: string;
  outline: GlassOutline;
  /** The capacity typed; null when the height was. */
  capacity_ml: number | null;
  /** A new photo to keep; null keeps the one the glass has. */
  photo: GlassPhoto | null;
}

/** Where it opens: the photo (a new glass, Redraw) or the number (Fix the height), and what it knows already. */
export interface DrawStart {
  start: 'photo' | 'size';
  initial: { glass: SketchGlass; name: string; maker: string; outline?: GlassOutline | null; capacity_ml?: number | null };
}

export interface DrawGlassOptions {
  /** Opened straight on Draw my glass (Redraw, Fix the height); else begin() starts it. */
  first?: DrawStart | null;
  home: boolean;
  /** The photo the glass was traced from before, shown until a new one is taken. */
  photoUrl?: string | null;
  /** Back from the first step: to the search, or closed. */
  onBack: () => void;
  onDone: (glass: DrawnGlass) => void;
}

type Step = 'photo' | 'size' | 'tracing' | 'failed' | 'compare';

const sizeOf = ({ initial }: DrawStart): SizeValue => ({
  glass: initial.glass,
  name: initial.name,
  maker: initial.maker,
  by: initial.capacity_ml ? 'capacity' : 'height',
  number: initial.capacity_ml ? String(initial.capacity_ml) : initial.outline ? String(Math.round(initial.outline.height_mm)) : '',
});

const NEW: DrawStart = { start: 'photo', initial: { glass: 'coupe', name: '', maker: '' } };

/**
 * Draw my glass (Venue tools board, x 3520 y 20300) as question 1 of Add a
 * glass: photograph it, give one number, the tracer draws it (no AI), check
 * it beside the photo, and Looks right hands it back to be saved.
 */
export function useDrawGlass({ first, home, photoUrl, onBack, onDone }: DrawGlassOptions): { question: KitQuestion; begin: (from: DrawStart) => void } {
  const ds = useDs();
  const wide = useIsWideWeb();
  const [from, setFrom] = useState<DrawStart>(first ?? NEW);
  const { start, initial } = from;
  const [step, setStep] = useState<Step>(from.start);
  const [photo, setPhoto] = useState<GlassPhoto | null>(null);
  const [size, setSize] = useState<SizeValue>(() => sizeOf(from));
  const [traced, setTraced] = useState<TracedGlass | null>(null);
  const [outline, setOutline] = useState<GlassOutline | null>(null);
  const [why, setWhy] = useState<TraceFail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The tracing in flight: Cancel, or a newer photo, leaves an older one's result unused.
  const run = useRef(0);
  const begin = (next: DrawStart) => {
    run.current++;
    setFrom(next);
    setStep(next.start);
    setPhoto(null);
    setSize(sizeOf(next));
    setTraced(null);
    setOutline(null);
    setWhy(null);
    setError(null);
  };
  const uri = photo?.uri ?? (initial.outline ? photoUrl : null) ?? null;
  const n = readSize(size.by, size.number);
  const sizeTo = (by: SizeBy, v: number): TraceSize => (by === 'height' ? { height_mm: v } : { capacity_ml: v });

  const draw = (p: GlassPhoto | null, value = n) => {
    if (!value) return setStep('size');
    if (!p) {
      // Fix the number: the same traced shape, sized again.
      if (!initial.outline) return setStep('photo');
      setTraced(null);
      setOutline(resizeOutline(initial.outline, sizeTo(size.by, value)));
      return setStep('compare');
    }
    setStep('tracing');
    const token = ++run.current;
    // A beat so the steps show before the tracer takes the thread; it's done in well under a second.
    setTimeout(() => {
      if (token !== run.current) return;
      const r = traceGlass(p.pixels, sizeTo(size.by, value));
      if (r.ok) {
        setTraced(r.glass);
        setOutline(r.glass.outline);
        setStep('compare');
      } else {
        setWhy(r.why);
        setStep('failed');
      }
    }, 600);
  };

  const take = async (from: 'camera' | 'library') => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const p = await pickGlassPhoto(from);
      if (!p) return;
      setPhoto(p);
      // A retake with the number already in: straight to tracing.
      if (n && step !== 'photo') draw(p);
      else setStep('size');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t open that photo. Try another.');
    } finally {
      setBusy(false);
    }
  };

  const dropped = (uri: string) => {
    setError(null);
    readGlassPhoto(uri).then(
      (p) => {
        setPhoto(p);
        setStep('size');
      },
      (e: unknown) => setError(e instanceof Error ? e.message : 'Couldn’t open that photo. Try another.'),
    );
  };

  const errorLine = error ? (
    <Caption tone="accent" role="alert">
      {error}
    </Caption>
  ) : null;
  const camera = Platform.OS !== 'web';
  const retake = () => void take(camera ? 'camera' : 'library');
  const note = 'Draw my glass';

  let question: KitQuestion;
  if (step === 'photo') {
    question = {
      note,
      title: 'Photograph your glass',
      intro: 'On a plain background, side on. One glass, nothing in it.',
      body: (
        <View style={styles.stack}>
          {wide ? <PhotoDrop onPhoto={dropped} /> : null}
          <PhotoTips />
          {camera ? <TextLink label="Choose from your photos" onPress={() => void take('library')} /> : null}
          {errorLine}
        </View>
      ),
      next: busy ? 'Opening…' : camera ? 'Take a photo' : 'Choose a photo',
      canNext: !busy,
      onNext: retake,
      secondary: { label: 'Back', onPress: onBack },
    };
  } else if (step === 'size') {
    question = {
      note,
      title: 'One number sets its size',
      intro: 'The photo gives the shape. Height or capacity gives the size.',
      body: (
        <View style={styles.stack}>
          <PhotoChip uri={uri} onRetake={retake} />
          <SizeStep value={size} onChange={setSize} home={home} />
          {errorLine}
        </View>
      ),
      next: 'Draw it',
      canNext: !!n && (!!photo || !!initial.outline),
      onNext: () => draw(photo),
      secondary: { label: 'Back', onPress: () => (photo || start === 'photo' ? setStep('photo') : onBack()) },
    };
  } else if (step === 'tracing') {
    question = {
      note,
      title: 'Drawing your glass',
      intro: 'The same tracer that drew the catalog’s glasses, run on your photo. Nothing is made up: it only follows the edge it can see.',
      body: <TracingStep uri={uri} sizeTo={n ? `${n} ${size.by === 'height' ? 'mm' : 'ml'}` : ''} />,
      next: 'Drawing…',
      canNext: false,
      secondary: {
        label: 'Cancel',
        onPress: () => {
          run.current++;
          setStep('size');
        },
      },
    };
  } else if (step === 'failed' && why) {
    question = {
      note,
      title: TRACE_FAIL[why].title,
      body: (
        <View style={styles.stack}>
          <Body>{TRACE_FAIL[why].body}</Body>
          {uri ? <Image source={{ uri }} style={[styles.photo, { backgroundColor: ds.c.surface }]} contentFit="contain" accessibilityLabel="Your photo" /> : null}
          <Caption tone="muted">{NEVER_GUESSES}</Caption>
          {errorLine}
        </View>
      ),
      next: busy ? 'Opening…' : 'Retake the photo',
      canNext: !busy,
      onNext: retake,
      secondary: { label: 'Choose another photo', onPress: () => void take('library') },
    };
  } else {
    // Compare: Looks right hands it back.
    const shape = outline ?? initial.outline!;
    question = {
      note,
      title: 'Does it look like your glass?',
      intro: 'Side by side at the same size. If the shape is off, retake the photo. If the size is off, fix the number.',
      body: (
        <View style={styles.stack}>
          <CompareStep
            uri={uri}
            photoSize={photo ? { width: photo.width, height: photo.height } : null}
            glass={size.glass}
            traced={traced}
            outline={shape}
            by={size.by}
            capacity={size.by === 'capacity' && n ? n : holdsMl(shape)}
            onRetake={retake}
            onFix={() => setStep('size')}
          />
          {errorLine}
        </View>
      ),
      next: 'Looks right',
      onNext: () => onDone({ glass: size.glass, name: size.name, maker: size.maker, outline: shape, capacity_ml: size.by === 'capacity' ? n : null, photo }),
    };
  }
  return { question, begin };
}

const styles = StyleSheet.create({ stack: { gap: space.md }, photo: { width: '100%', height: 220, borderRadius: radius.card } });
