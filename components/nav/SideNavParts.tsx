import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { CurrentUserAvatar, useUserDisplayName } from '@/components/ui/UserAvatar';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue, type Venue } from '@/hooks/useActiveVenue';
import { useShelf } from '@/hooks/useHomeBar';
import { useMode } from '@/hooks/useMode';
import { currentProps } from '@/lib/a11yState';
import { withAlpha } from '@/lib/color';
import { roleLabel } from '@/lib/roles';
import { footerLine, shortPersonName } from '@/lib/shellNav';

import { HomeMark, useSwitchTo, VenueMark } from './VenueMarks';
import { TabIcon } from './WebTabBar';

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
export function NavRow({ label, icon, current, hint, role = 'link', look, onPress }: {
  label: string;
  icon: IconName;
  current: boolean;
  hint?: string;
  role?: 'link' | 'button';
  look?: 'filled' | 'outlined';
  onPress: () => void;
}) {
  const ds = useDs();
  return (
    <PressableScale
      role={role}
      {...currentProps(current)}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.row,
        look === 'filled' && { backgroundColor: withAlpha(ds.c.ink, 0.06), marginBottom: space.sm },
        look === 'outlined' && { borderWidth: StyleSheet.hairlineWidth, borderColor: ds.c.lineStrong, marginTop: space.sm },
        current && { backgroundColor: withAlpha(ds.accentText, 0.16) },
      ]}
    >
      <TabIcon name={icon} size={18} color={current ? ds.accentText : look === 'outlined' ? ds.c.ink : ds.c.muted} />
      <DsText color={current || look === 'outlined' ? ds.c.ink : ds.c.muted} numberOfLines={1} style={[styles.label, current && styles.strong]}>
        {label}
      </DsText>
      {hint ? <Kbd>{hint}</Kbd> : null}
    </PressableScale>
  );
}

/** A sidebar section's heading, like "Venue". */
export function NavHeading({ children }: { children: ReactNode }) {
  return (
    <DsText variant="caption" tone="muted" role="heading" style={styles.heading}>
      {children}
    </DsText>
  );
}

function Mark({ selected, label, onPress, children }: { selected: boolean; label: string; onPress: () => void; children: ReactNode }) {
  const ds = useDs();
  return (
    <PressableScale role="radio" aria-checked={selected} accessibilityLabel={label} onPress={onPress} style={styles.markButton}>
      <View style={[styles.ring, { borderColor: selected ? ds.accentText : 'transparent' }]}>{children}</View>
    </PressableScale>
  );
}

/**
 * The top of the sidebar: a mark for home and each venue, the one you're in
 * ringed, each switching in one click. Its name and your role are its label.
 */
export function MarksRow() {
  const { venues, active } = useActiveVenue();
  const home = useMode().mode === 'home';
  const switchTo = useSwitchTo();
  return (
    <View role="radiogroup" accessibilityLabel="Where you are" style={styles.marks}>
      <Mark selected={home} label="Home bar" onPress={() => switchTo('home')}>
        <HomeMark />
      </Mark>
      {venues.map((v) => (
        <Mark key={v.id} selected={!home && v.id === active?.id} label={`${v.name}, ${roleLabel(v.roleLevel)}`} onPress={() => switchTo(v)}>
          <VenueMark venue={v} />
        </Mark>
      ))}
    </View>
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
      // Home mode has You as a tab; venue mode opens it over the page.
      onPress={() => (venue ? router.push('/you') : router.navigate('/profile'))}
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

const MARK = 32;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.control },
  label: { flex: 1 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  kbd: { fontFamily: fontFamilies.monoMedium, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.mark, overflow: 'hidden' },
  heading: { fontFamily: fontFamilies.monoMedium, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.lg, marginBottom: space.xs, marginHorizontal: space.md },
  marks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, paddingBottom: space.sm },
  markButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ring: { padding: 2, borderWidth: 2, borderRadius: MARK * 0.28 + 4 },
  footer: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, paddingHorizontal: space.sm, paddingBottom: space.xs, borderTopWidth: StyleSheet.hairlineWidth },
  footerText: { flex: 1, minWidth: 0 },
});
