import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Display, DsText, GlassButton, PressableScale, Tag, useDs, type TagTone } from '@/components/ds';
import { DrinkHero } from '@/components/screens/drink/DrinkHero';
import { font, radius, space } from '@/constants/tokens';

import { MenuSky, MenuTrio } from './MenuBand';
import type { MenuInk } from './MenuDrawing';

const HERO_H = 300;
const TONE: Record<'green' | 'amber' | 'quiet', TagTone> = { green: 'success', amber: 'warning', quiet: 'default' };

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
  /** A glass pencil, when Edit isn't the page's one action (a draft, a home menu). */
  onEdit?: (() => void) | null;
  /** The one prominent action at the top: Edit, or Share on a home menu. */
  pill: { label: string; onPress: () => void } | null;
  /** The page's side margin: the hero runs out to the edges. */
  bleed: number;
  /** The status bar's height: the sky runs up under it. */
  top?: number;
  children?: ReactNode;
}

/**
 * The top of every menu page: its drinks drawn together on their sky (or the
 * cover photo, or nothing yet), glass Back and Share, then the tag and
 * eyebrow, the name and its line (Menu-page).
 */
export function MenuPageHead({ heroIds, coverUrl, name, ink, quiet, tag, eyebrow, description, onBack, onShare, onEdit, pill, bleed, top = 0, children }: MenuPageHeadProps) {
  const ds = useDs();
  const photo = !!coverUrl && ink === 'colour';
  const drawn = !photo && heroIds.length > 0;
  return (
    <View>
      {photo ? (
        <View style={{ marginHorizontal: -bleed }}>
          <DrinkHero name={name} pictures={[{ url: coverUrl, isSketch: false, isOutdated: false }]} glass={null} height={420} fade />
        </View>
      ) : drawn ? (
        <View style={{ height: HERO_H + top, marginHorizontal: -bleed, overflow: 'hidden' }}>
          {quiet ? null : <MenuSky ids={heroIds} fade />}
          <MenuTrio ids={heroIds} ink={ink} top={64 + top} />
        </View>
      ) : (
        <View style={{ height: 112 + top }} />
      )}
      <View style={[styles.bar, { top: top + space.lg }]}>
        {onBack ? <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={onBack} onMedia={photo} /> : <View />}
        <View style={styles.barEnd}>
          {onEdit ? <GlassButton icon="pencil" accessibilityLabel="Edit" onPress={onEdit} onMedia={photo} /> : null}
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
  bar: { position: 'absolute', top: space.lg, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barEnd: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  pill: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { gap: space.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  caps: { letterSpacing: 1.2, ...font.medium },
  eyebrow: { flexShrink: 1 },
});
