import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { BackHandler, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { BackbarTheme, BrandProvider, Caption, useDs } from '@/components/ds';
import { SetupPage } from '@/components/screens/onboarding/SetupPage';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { VenueBrandRow } from '@/hooks/useVenueBrand';
import { normalizeHex } from '@/lib/brand';

import { ColoursPart, type BrandDraftState } from './BrandForm';
import { MiniScreen, SCHEMES, SchemeChip, type BrandLook } from './BrandPreview';
import { FaceChoices, LogoRow } from './BrandSections';

/** The three parts, in order: Logo first, since palettes come from it; Colour holds the background too (Kevin, 28 Oct). */
const PARTS = ['Logo', 'Colour', 'Font'] as const;

/** Where the look pager is, for the step's buttons: Next names the part after this one; null on the last. */
export interface LookPage {
  at: number;
  next: string | null;
  onNext: () => void;
  onBack: () => void;
}

interface Props {
  row: VenueBrandRow;
  look: BrandLook;
  draft: BrandDraftState;
  set: <K extends keyof BrandDraftState>(key: K) => (value: BrandDraftState[K]) => void;
  suggested: string[];
  busy: 'logo' | 'icon' | 'background' | null;
  problems: Partial<Record<'accent' | 'groundTint' | 'shortName', string>>;
  message: string | null;
  onUpload: () => void;
  onRemoveBackground: () => void;
  footer: (page: LookPage) => ReactNode;
}

/**
 * Venue setup's How it looks on a phone (board w2-venue-setup, E34, call A):
 * the top of Tonight pinned as a preview, and under it one part at a time,
 * Logo, Colour, Font, walked with Next and Back or a swipe.
 * The same parts and save as the brand editor; wide screens keep the
 * preview beside every part (BrandScreen).
 */
export function SetupLook({ row, look, draft, set, suggested, busy, problems, message, onUpload, onRemoveBackground, footer }: Props) {
  const ds = useDs();
  const reduceMotion = useReducedMotion();
  const [at, setAt] = useState(0);
  const [scheme, setScheme] = useState<'dark' | 'light'>('dark');
  const [width, setWidth] = useState(0);
  // Each part's own height: the pager is as tall as the part showing, so a short one leaves no gap.
  const [heights, setHeights] = useState<number[]>([]);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  // The part the scroll position shows, so a part reached by swiping isn't scrolled to again.
  const shown = useRef(0);

  useEffect(() => {
    if (!width || shown.current === at) return;
    shown.current = at;
    pager.current?.scrollTo({ x: at * width, animated: !reduceMotion });
  }, [at, width, reduceMotion]);

  // Android's back goes to the part before, not out of the step.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (at === 0) return false;
      setAt(at - 1);
      return true;
    });
    return () => sub.remove();
  }, [at]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const x = e.nativeEvent.contentOffset.x;
    const page = Math.min(PARTS.length - 1, Math.max(0, Math.round(x / width)));
    // Only once it settles: the parts passed on the way aren't choices.
    if (Math.abs(x - page * width) > 2 || page === shown.current) return;
    shown.current = page;
    setAt(page);
  };

  const accent = normalizeHex(draft.accent);
  const brand = { accent: look.accent ?? undefined, displayFace: look.displayFace, groundTint: look.groundTint ?? undefined };

  const parts: ReactNode[] = [
    <View key="logo" style={styles.part}>
      <LogoRow
        venue={{ id: row.id, name: row.name, accent }}
        logoUrl={draft.logoUrl}
        busy={busy}
        onPick={onUpload}
        onRemoveBackground={onRemoveBackground}
        onRemove={() => set('logoUrl')(null)}
        onUseOriginal={set('logoUrl')}
      />
      <Caption tone="muted">A photo, a PNG or an SVG. We suggest colours from it.</Caption>
    </View>,
    <View key="colour" style={styles.part}>
      <ColoursPart {...{ row, draft, set, suggested, problems }} />
    </View>,
    <View key="font" style={styles.part}>
      <FaceChoices setup list name={row.name} value={draft.face} onChange={set('face')} />
      <Caption tone="muted">For drink names, menu names and big titles like Tonight. Body text, specs and numbers stay fixed.</Caption>
    </View>,
  ];
  const hint = [at < PARTS.length - 1 ? `Swipe for ${PARTS[at + 1]}` : null, at > 0 ? `${at < PARTS.length - 1 ? 'or back' : 'Swipe back'} to ${PARTS[at - 1]}` : null].filter(Boolean).join(', ');

  return (
    <SetupPage footer={footer({ at, next: PARTS[at + 1] ?? null, onNext: () => setAt(Math.min(at + 1, PARTS.length - 1)), onBack: () => setAt(Math.max(at - 1, 0)) })}>
      <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        <View style={styles.head}>
          <SectionHeading>Preview</SectionHeading>
          <View role="radiogroup" accessibilityLabel="Preview scheme" style={styles.chips}>
            {SCHEMES.map((o) => (
              <SchemeChip key={o.value} label={o.label} selected={scheme === o.value} onPress={() => setScheme(o.value)} />
            ))}
          </View>
        </View>
        <BackbarTheme scheme={scheme}>
          <BrandProvider {...brand}>
            <View role="img" aria-label={`Tonight at ${look.name} in ${scheme} mode, with the new brand`}>
              <MiniScreen look={look} compact />
            </View>
          </BrandProvider>
        </BackbarTheme>
      </View>

      <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        <View style={styles.head}>
          <SectionHeading>{`${at + 1} of ${PARTS.length} · ${PARTS[at]}`}</SectionHeading>
          <View style={styles.dots} aria-hidden>
            {PARTS.map((p, i) => (
              <View key={p} style={[styles.dot, { backgroundColor: i === at ? ds.accentText : ds.c.lineStrong }, i === at && styles.dotOn]} />
            ))}
          </View>
        </View>
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width ? (
            <ScrollView
              ref={pager}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              onMomentumScrollEnd={onScroll}
              scrollEventThrottle={32}
              accessibilityLabel={`${PARTS[at]}, ${at + 1} of ${PARTS.length}`}
              style={heights[at] ? { height: heights[at] } : null}
              contentContainerStyle={styles.track}
            >
              {parts.map((part, i) => (
                // Parts off screen are hidden from screen readers; Next and Back move between them.
                <View
                  key={i}
                  style={{ width }}
                  aria-hidden={i !== at}
                  importantForAccessibility={i === at ? 'auto' : 'no-hide-descendants'}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    setHeights((list) => (list[i] === h ? list : Object.assign([...list], { [i]: h })));
                  }}
                >
                  {part}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
        <View style={styles.hint}>
          <IconSymbol name="arrow.left.and.right" size={12} color={ds.c.muted} />
          <Caption tone="muted">{hint}</Caption>
        </View>
      </View>
      {message ? <Caption role="status">{message}</Caption> : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md, borderWidth: 1, borderRadius: radius.card, borderCurve: 'continuous' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  chips: { flexDirection: 'row', gap: space.xs },
  track: { alignItems: 'flex-start' },
  part: { gap: space.md },
  dots: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  dotOn: { width: 16 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
