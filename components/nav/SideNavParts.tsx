import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CurrentUserAvatar, useUserDisplayName } from '@/components/ui/UserAvatar';
import { font, radius, space, STATUS } from '@/constants/tokens';
import type { Venue } from '@/hooks/useActiveVenue';
import { useShelf } from '@/hooks/useHomeBar';
import { currentProps } from '@/lib/a11yState';
import { readableAccent, withAlpha } from '@/lib/color';
import { roleLabel } from '@/lib/roles';
import { footerLine, shortPersonName } from '@/lib/shellNav';

import { useVenueMenu } from './VenueSwitcher';

/** A keyboard hint at the end of a row: ⌘K, N. */
export function Kbd({ children }: { children: string }) {
  const ds = useDs();
  return (
    <DsText variant="caption" style={[styles.kbd, { backgroundColor: withAlpha(ds.c.ink, 0.1) }]}>
      {children}
    </DsText>
  );
}

/** One sidebar row: icon and label, lit when it's the page you're on. `look` gives Search its fill and New its outline. */
export function NavRow({ label, icon, current, hint, badge, note, warn, role = 'link', look, onPress }: {
  label: string;
  icon: IconName;
  current: boolean;
  hint?: string;
  /** "3 of 6" in the accent: how far "Set up <bar>" has got. */
  badge?: string;
  /** What the board puts at a row's right in muted text: "on now", "23". `warn` makes it amber ("1 low"). */
  note?: string;
  warn?: boolean;
  role?: 'link' | 'button';
  look?: 'filled' | 'outlined';
  onPress: () => void;
}) {
  const ds = useDs();
  return (
    <PressableScale
      role={role}
      {...currentProps(current)}
      accessibilityLabel={[label, badge ? `${badge} done` : null, note ?? null].filter(Boolean).join(', ')}
      onPress={onPress}
      style={[
        styles.row,
        look === 'filled' && { backgroundColor: withAlpha(ds.c.ink, 0.06), marginBottom: space.sm },
        look === 'outlined' && { borderWidth: StyleSheet.hairlineWidth, borderColor: ds.c.lineStrong, marginTop: space.sm },
        current && { backgroundColor: withAlpha(ds.accentText, 0.16) },
      ]}
    >
      <IconSymbol name={icon} size={18} color={current ? ds.accentText : look === 'outlined' ? ds.c.ink : ds.c.muted} />
      <DsText color={current || look === 'outlined' ? ds.c.ink : ds.c.muted} numberOfLines={1} style={[styles.label, current && styles.strong]}>
        {label}
      </DsText>
      {hint ? <Kbd>{hint}</Kbd> : null}
      {note ? (
        <Caption color={warn ? readableAccent(STATUS.warning, ds.c.ground) : ds.c.muted} style={font.medium}>
          {note}
        </Caption>
      ) : null}
      {badge ? <Caption color={ds.accentText} style={[styles.badge, { backgroundColor: withAlpha(ds.accentText, 0.14) }]}>{badge}</Caption> : null}
    </PressableScale>
  );
}

/**
 * A sidebar group's heading, with the board's small mark (a letter on a tint): the bar's name, or Home. It is also
 * where you switch place (board C7/C8): tapping it hangs the places menu from the mark, as the phone's logo does.
 */
export function PlaceHeading({ children, mark }: { children: ReactNode; mark: string }) {
  const ds = useDs();
  const { button, open, expanded, menu } = useVenueMenu();
  return (
    <>
      <View ref={button} collapsable={false}>
        <PressableScale role="button" aria-expanded={expanded} accessibilityLabel={`${children}. Switch place`} onPress={open} style={styles.headingRow}>
          <View style={[styles.headingMark, { backgroundColor: withAlpha(ds.accentText, 0.2) }]}>
            <DsText variant="caption" color={ds.accentText} aria-hidden>
              {mark.charAt(0).toUpperCase()}
            </DsText>
          </View>
          <DsText variant="caption" tone="muted" role="heading" numberOfLines={1} style={styles.heading}>
            {children}
          </DsText>
          <IconSymbol name="chevron.down" size={10} color={ds.c.muted} />
        </PressableScale>
      </View>
      {menu}
    </>
  );
}

/** The foot of the sidebar: you, with your role here or your shelf at home. Opens You. */
export function YouFooter({ venue }: { venue: Venue | null }) {
  const ds = useDs();
  const router = useRouter();
  const name = shortPersonName(useUserDisplayName());
  // The shelf is the line at home: a small list of ids, the same one My Bar keeps.
  const shelf = useShelf();
  const line = footerLine(venue ? { name: venue.name, role: roleLabel(venue.roleLevel) } : null, venue ? null : (shelf.data?.length ?? null));
  return (
    <PressableScale
      role="link"
      accessibilityLabel={`You: ${name}, ${line}`}
      onPress={() => router.navigate('/you')}
      style={[styles.footer, { borderTopColor: ds.c.line }]}
    >
      <CurrentUserAvatar size={32} />
      <View style={styles.footerText}>
        <DsText numberOfLines={1} style={styles.strong}>
          {name}
        </DsText>
        <Caption tone="muted" numberOfLines={1}>
          {line}
        </Caption>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: space.sm, borderRadius: radius.pill, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.control },
  label: { flex: 1 },
  strong: { ...font.semiBold },
  kbd: { ...font.figuresMedium, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.mark, overflow: 'hidden' },
  headingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36, gap: space.sm, marginTop: space.lg, marginBottom: space.xs, marginHorizontal: space.md },
  headingMark: { width: 20, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  heading: { ...font.medium, flexShrink: 1 },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, paddingHorizontal: space.sm, paddingBottom: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
  footerText: { flex: 1, minWidth: 0 },
});
