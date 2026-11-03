import { lazy, Suspense, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Display, DsText, GlassButton, PressableScale, Tag, useBreakpoint, useDs, type TagTone } from '@/components/ds';
import { ItemMoreMenu } from '@/components/screens/drink/ItemMoreMenu';
import { font, menuCover, radius, space } from '@/constants/tokens';

import { MenuSky, MenuTrio } from './MenuBandLazy';
import type { MenuInk } from './MenuDrawing';

// The drink page's hero and its viewer load only for a menu with a cover: a home menu never has one.
const MenuCover = lazy(() => import('./MenuCover'));

const HERO_H = 300;
/** A cover photo runs 470 down from the top of the screen, the name under it (Menu-g-photo-dark). */
const PHOTO_H = menuCover.height;
const TONE: Record<'green' | 'amber' | 'quiet', TagTone> = { green: 'success', amber: 'warning', quiet: 'default' };

interface MenuPageHeadProps {
  /** The drinks drawn at the top: the menu's first three. */
  heroIds: string[];
  /** A menu that's on or coming up, at a bar, with a cover: the photo leads, and decides light or dark (MenuScreen). */
  coverUrl: string | null;
  /** Who took the cover photo: "Photo: Jess Rowe" under it on phones, on it on the wide web (Miss-cover-credit). */
  coverCredit?: string | null;
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
  /** Share and Edit sit in the page's one …, never beside it (Kevin's C12, 3 Nov: "All into the dot menu"). */
  onShare: (() => void) | null;
  onEdit?: (() => void) | null;
  /** In Back's place on a page with no way back (a friend's shared menu): it goes home. */
  label?: { text: string; onPress: () => void };
  /** The page's side margin: the hero runs out to the edges. */
  bleed: number;
  /** The status bar's height: the sky runs up under it. */
  top?: number;
  children?: ReactNode;
}

/**
 * The top of every menu page: its drinks drawn together on their sky (or the
 * cover photo, or nothing yet), glass Back and the one … (Edit, Share), then the tag and
 * eyebrow, the name and its line (Menu-page).
 */
export function MenuPageHead({ heroIds, coverUrl, coverCredit, name, ink, quiet, tag, eyebrow, description, onBack, onShare, onEdit, label, bleed, top = 0, children }: MenuPageHeadProps) {
  const ds = useDs();
  const wide = useBreakpoint() !== 'phone';
  const photo = !!coverUrl;
  const drawn = !photo && heroIds.length > 0;
  return (
    <View>
      {photo ? (
        <Suspense fallback={<View style={{ height: PHOTO_H }} />}>
          <MenuCover url={coverUrl} name={name} height={PHOTO_H} bleed={bleed} />
          {coverCredit ? (
            <View style={[styles.credit, wide && [styles.creditOn, { backgroundColor: ds.c.scrim }]]}>
              <Caption tone="muted" numberOfLines={1}>{`Photo: ${coverCredit}`}</Caption>
            </View>
          ) : null}
        </Suspense>
      ) : drawn ? (
        <View style={{ height: HERO_H + top, marginHorizontal: -bleed, overflow: 'hidden' }}>
          {quiet ? null : <MenuSky ids={heroIds} fade />}
          <MenuTrio ids={heroIds} ink={ink} top={42 + top} />
        </View>
      ) : (
        <View style={{ height: 112 + top }} />
      )}
      <View style={[styles.bar, { top: top + space.lg }]}>
        {onBack ? <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={onBack} onMedia={photo && ds.scheme === 'dark'} /> : label ? (
          <PressableScale role="link" accessibilityLabel={label.text} onPress={label.onPress}>
            <Caption tone="muted" style={styles.caps}>
              {label.text.toUpperCase()}
            </Caption>
          </PressableScale>
        ) : (
          <View />
        )}
        <ItemMoreMenu name={name} onEdit={onEdit ?? undefined} editLabel={`Edit ${name}`} onShare={onShare ?? undefined} scheme={photo && ds.scheme === 'dark' ? 'dark' : undefined} />
      </View>
      <View style={[styles.title, photo && { marginTop: space.lg }]}>
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
  credit: { position: 'absolute', top: PHOTO_H - space.xl, right: 0, maxWidth: '60%' },
  creditOn: { top: PHOTO_H - space.xxxl - space.lg, paddingHorizontal: space.sm, paddingVertical: space.xs / 2, borderRadius: radius.control },
  bar: { position: 'absolute', top: space.lg, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { gap: space.xs },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  caps: { letterSpacing: 1.2, ...font.medium },
  eyebrow: { flexShrink: 1 },
});
