import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, DsText, GlassButton, Segmented, Spec, Tag, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { isUnclaimed, useMenuCredits, useProfile, useProfileOriginals, type Profile } from '@/hooks/useProfiles';
import { barsCrediting } from '@/lib/profiles';

import { ClaimProfile } from './ClaimProfile';
import { ComingSoon, MenuCredits, OriginalsGrid } from './ProfileSections';

type Tab = 'originals' | 'rankings' | 'shelf';
const TABS = [
  { value: 'originals', label: 'Originals' },
  { value: 'rankings', label: 'Rankings' },
  { value: 'shelf', label: 'Shelf' },
] as const;

/**
 * A public profile: a person or a bar, the same kind of page. Who they are,
 * the drinks credited to them, and the bars that put those drinks on a menu
 * (the credit that matters most). Rankings and the shelf come later.
 */
export function ProfileScreen({ profileRef }: { profileRef: string | string[] | undefined }) {
  return (
    <BackbarTheme>
      <ProfilePage profileRef={profileRef} />
    </BackbarTheme>
  );
}

/**
 * For routes with no old screen: shown while the redesign flag is off (or
 * still loading from PostHog), instead of redirecting away and losing the link.
 */
export function NotInPreview() {
  return (
    <BackbarTheme>
      <PreviewOnlyNote />
    </BackbarTheme>
  );
}

function PreviewOnlyNote() {
  const ds = useDs();
  const gutter = useGutter();
  return (
    <View style={[styles.screen, styles.center, { backgroundColor: ds.c.ground, padding: gutter }]}>
      <Body tone="muted" align="center">
        Profiles are part of the new design, which isn’t switched on for you yet.
      </Body>
    </View>
  );
}

function ProfilePage({ profileRef }: { profileRef: string | string[] | undefined }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const { data: profile, isLoading, error } = useProfile(profileRef);

  const back = (
    <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
      <GlassButton
        accessibilityLabel="Back"
        icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </View>
  );

  let body;
  if (profile) body = <ProfileBody profile={profile} columns={breakpoint === 'phone' ? 2 : breakpoint === 'tablet' ? 3 : 4} />;
  else if (isLoading) body = <Caption tone="muted" accessibilityLabel="Loading profile">Loading…</Caption>;
  else body = <Body tone="muted">{error ? "Couldn't load this profile. Check your connection and try again." : "There's no public profile here. It may be private or the link may be wrong."}</Body>;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.readable}>{body}</View>
      </ScrollView>
      {back}
    </View>
  );
}

const KIND: Record<Profile['kind'], string> = { person: 'Bartender', bar: 'Bar' };

function ProfileBody({ profile, columns }: { profile: Profile; columns: number }) {
  const [tab, setTab] = useState<Tab>('originals');
  const { data: originals = [], isLoading } = useProfileOriginals(profile.id);
  const { data: credits = [] } = useMenuCredits(originals.map((d) => d.id));
  const names = new Map(originals.map((d) => [d.id, d.name]));
  const onMenus = barsCrediting(credits);
  const unclaimed = isUnclaimed(profile);
  const place = [profile.locality, profile.city].filter(Boolean).join(', ');
  const website = profile.website && /^https?:\/\//i.test(profile.website) ? profile.website : null;

  return (
    <View style={styles.body}>
      <WebHead>
        <title>{`${profile.display_name} (@${profile.handle})`}</title>
      </WebHead>
      <View style={styles.header}>
        <UserAvatar uri={profile.avatar_url} name={profile.display_name} size={88} />
        <Title align="center">{profile.display_name}</Title>
        <Caption tone="muted" align="center">
          {[`@${profile.handle}`, KIND[profile.kind], place].filter(Boolean).join(' · ')}
        </Caption>
        <View style={styles.chips}>
          {originals.length > 0 && profile.kind === 'person' ? <Tag label="Creator" /> : null}
          {onMenus ? <Tag label={`Credited on ${onMenus} bar ${onMenus === 1 ? 'menu' : 'menus'}`} /> : null}
          {unclaimed ? <Tag label="Not claimed yet" /> : null}
          {profile.is_public ? null : <Tag label="Private" />}
        </View>
        {profile.bio ? <Body align="center">{profile.bio}</Body> : null}
        {website ? (
          <DsText variant="caption" role="link" style={styles.link} onPress={() => Linking.openURL(website)}>
            {website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
          </DsText>
        ) : null}
      </View>

      <View style={styles.stats} role="list">
        <Stat value={originals.length} label={originals.length === 1 ? 'original' : 'originals'} />
        <Stat value={onMenus} label={onMenus === 1 ? 'bar menu' : 'bar menus'} />
      </View>

      {unclaimed ? <ClaimProfile profile={profile} /> : null}

      <MenuCredits credits={credits} names={names} />

      <Segmented accessibilityLabel="Profile sections" options={TABS} value={tab} onChange={setTab} />
      {tab === 'originals' ? (
        isLoading ? (
          <Caption tone="muted">Loading drinks…</Caption>
        ) : (
          <OriginalsGrid
            originals={originals}
            selfId={profile.id}
            columns={columns}
            emptyText={profile.kind === 'bar' ? 'No drinks credited to this bar yet.' : 'No drinks credited to them yet.'}
          />
        )
      ) : tab === 'rankings' ? (
        <ComingSoon text={`${profile.display_name}'s rankings will show here once ranking opens.`} />
      ) : (
        <ComingSoon text={profile.kind === 'bar' ? "What's on the back bar will show here." : "What's on their shelf will show here."} />
      )}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View role="listitem" accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Spec align="center">{value}</Spec>
      <Caption tone="muted" align="center">
        {label}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  readable: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  controls: { position: 'absolute' },
  body: { gap: space.xl },
  header: { alignItems: 'center', gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  link: { textDecorationLine: 'underline' },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: space.xxxl },
  stat: { alignItems: 'center', minWidth: 88 },
});
