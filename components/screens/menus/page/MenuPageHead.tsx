import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Display, DsText, GlassButton, PressableScale, Tag, useDs, type TagTone } from '@/components/ds';
import { DrinkHero } from '@/components/screens/drink/DrinkHero';
import { drawing, font, radius, space } from '@/constants/tokens';
import { useItemSketch } from '@/hooks/useItemSketch';
import { withAlpha } from '@/lib/color';
import { liquidOf } from '@/lib/sketch/types';

import { MenuDrawing, type MenuInk } from './MenuDrawing';

const HERO_H = 300;
const TONE: Record<'green' | 'amber' | 'quiet', TagTone> = { green: 'success', amber: 'warning', quiet: 'default' };

/** The menu's sky: each of its first three drinks' own wash across the top, gone by the title (Menu-page, A). */
function Sky({ ids, quiet }: { ids: string[]; quiet: boolean }) {
  const ds = useDs();
  const a = useItemSketch(ids[0]).data;
  const b = useItemSketch(ids[1]).data;
  const c = useItemSketch(ids[2]).data;
  if (quiet) return null;
  const alpha = ds.scheme === 'dark' ? 0.3 : 0.24;
  const wash = [a, b, c].filter(Boolean).map((i) => withAlpha(liquidOf(i!).hex, alpha));
  if (wash.length < 2) return null;
  return (
    <View style={StyleSheet.absoluteFill} aria-hidden>
      <LinearGradient colors={wash as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[withAlpha(ds.c.ground, 0), ds.c.ground]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** Up to three drawings together, overlapping, the middle one of three higher and in front. */
function Trio({ ids, ink }: { ids: string[]; ink: MenuInk }) {
  const raised = (i: number) => ids.length === 3 && i === 1;
  return (
    <View style={styles.trio} aria-hidden>
      {ids.map((id, i) => (
        <View key={id} style={[styles.drawn, { zIndex: raised(i) ? 1 : 0, marginTop: raised(i) ? 0 : space.xxl }]}>
          <MenuDrawing itemId={id} size="hero" ink={ink} />
        </View>
      ))}
    </View>
  );
}

interface MenuPageHeadProps {
  /** The drinks drawn at the top: the menu's first three. */
  heroIds: string[];
  coverUrl: string | null;
  name: string;
  ink: MenuInk;
  /** Drafts, past menus: no sky. */
  quiet: boolean;
  /** "On now", "Draft", "Past menu": staff see it before the eyebrow. */
  tag: { label: string; tone: 'green' | 'amber' | 'quiet' } | null;
  eyebrow: string;
  description: string | null;
  /** Back is hidden on the wide web, where the sidebar is the way around. */
  onBack: (() => void) | null;
  onShare: (() => void) | null;
  /** The one prominent action at the top: Edit, or Share on a home menu. */
  pill: { label: string; onPress: () => void } | null;
  width: number;
  children?: ReactNode;
}

/**
 * The top of every menu page: its drinks drawn together on their sky (or the
 * cover photo, or nothing yet), glass Back and Share, then the tag and
 * eyebrow, the name and its line (Menu-page).
 */
export function MenuPageHead({ heroIds, coverUrl, name, ink, quiet, tag, eyebrow, description, onBack, onShare, pill, width, children }: MenuPageHeadProps) {
  const ds = useDs();
  const photo = !!coverUrl && ink === 'colour';
  const drawn = !photo && heroIds.length > 0;
  return (
    <View>
      {photo ? (
        <DrinkHero name={name} pictures={[{ url: coverUrl, isSketch: false, isOutdated: false }]} glass={null} height={420} fade />
      ) : drawn ? (
        <View style={{ height: HERO_H, width }}>
          <Sky ids={heroIds} quiet={quiet} />
          <Trio ids={heroIds} ink={ink} />
        </View>
      ) : (
        <View style={{ height: 112 }} />
      )}
      <View style={styles.bar}>
        {onBack ? <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={onBack} onMedia={photo} /> : <View />}
        <View style={styles.barEnd}>
          {onShare ? <GlassButton icon="square.and.arrow.up" accessibilityLabel="Share" onPress={onShare} onMedia={photo} /> : null}
          {pill ? (
            <PressableScale role="button" accessibilityLabel={pill.label} onPress={pill.onPress} style={[styles.pill, { backgroundColor: ds.c.ink }]}>
              <DsText variant="label" color={ds.c.ground} style={font.semiBold}>
                {pill.label}
              </DsText>
            </PressableScale>
          ) : null}
        </View>
      </View>
      <View style={[styles.title, photo && { marginTop: -space.xxxl }]}>
        <View style={styles.eyebrowRow}>
          {tag ? <Tag label={tag.label} tone={TONE[tag.tone]} /> : null}
          <Caption tone="muted" style={[styles.caps, styles.eyebrow]} numberOfLines={2}>
            {eyebrow.toUpperCase()}
          </Caption>
        </View>
        <Display>{name}</Display>
        {description ? (
          <DsText variant="headline" italic tone="muted">
            {description}
          </DsText>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trio: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 64 },
  drawn: { marginHorizontal: -drawing.heroStaff / 6 },
  bar: { position: 'absolute', top: space.lg, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barEnd: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  pill: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { gap: space.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  caps: { letterSpacing: 1.2, ...font.medium },
  eyebrow: { flexShrink: 1 },
});
