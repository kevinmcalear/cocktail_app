import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, useBreakpoint, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { Crumbs } from '@/components/nav/PageFrame';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarMembers, type BarMember } from '@/hooks/useBarDetail';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useMode } from '@/hooks/useMode';
import { useVenueBrand } from '@/hooks/useVenueBrand';
import { useRoleMatrix } from '@/hooks/useVenueRoles';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { lookSet } from '@/lib/setupChecklist';
import { reachCeiling } from '@/lib/roleMatrix';
import { canOpenMember, canSeeTeam, personName, TEAM_MANAGE } from '@/lib/team';
import { useVenueSetup } from '@/store/useVenueSetup';

import { InviteSheet, type InviteNote } from './InviteSheet';
import { MemberPage } from './MemberPage';
import { TeamRoster } from './TeamRoster';

/** The board's widths on the web at 1440 (Kept-team-desk): the list, and the person beside it. */
const LIST = 520;
const PERSON = 560;

/**
 * Team, for the venue in the sidebar (Kept-team): Employee and above see who
 * is on it; whoever manages the team also invites people and opens a person
 * to change their role or remove them. On a phone a person opens as their own
 * page; on a desktop they open beside the list (Kept-team-desk). `?invite=1`
 * opens straight on Invite. Invite waits for How it looks, as the checklist's
 * Invite your team does, so every email wears the venue's logo, colour and
 * font (invite-team-last, call 2): until then it opens Brand.
 */
export function TeamScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const column = usePageColumn();
  const breakpoint = useBreakpoint();
  const desk = Platform.OS === 'web' && breakpoint === 'desktop';
  const myId = useUserId();
  const home = useMode().mode === 'home';
  const { active } = useActiveVenue();
  const role = useEffectiveRole(active?.id ?? null);
  const visible = !home && !!active && canSeeTeam(role);
  const manage = useCanManageStaff(active?.id);
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const brand = useVenueBrand(visible && manage ? active?.id : null);
  const run = useVenueSetup((s) => (active ? s.runs[active.id] : undefined));
  const roster = useBarMembers(visible ? active!.id : null);
  const members = roster.data ?? [];
  // Invite waits for the brand; if it fails to load, the gate steps aside.
  const looks = brand.data ? lookSet(brand.data, run) : !!brand.error || !(visible && manage);
  const [asked, setInviting] = useState(invite === '1');
  const [note, setNote] = useState<InviteNote | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const inviting = asked && looks;
  const startInvite = () => {
    if (looks) setInviting(true);
    else if (brand.data) router.push(`/settings/bar/${active!.id}/brand` as Href);
  };
  // On a desktop someone is always open beside the list: the one picked, else the first the manager can open.
  const admin = role >= TEAM_MANAGE;
  const person = desk && manage ? (members.find((m) => m.user_id === picked) ?? members.filter((m) => canOpenMember(m, myId, role)).sort((a, b) => b.role_level - a.role_level)[0] ?? null) : null;
  // The invite never hands out more than the manager can do themselves.
  const matrix = useRoleMatrix(visible && manage ? active!.id : null).data ?? [];
  const myCaps = useCapabilities(visible && manage ? active!.id : null).data;
  const ceiling = reachCeiling(matrix, admin ? null : (myCaps ?? []), role);
  const open = (m: BarMember) => (desk ? setPicked(m.user_id) : router.push(`/team/${m.user_id}` as Href));

  const count = roster.data ? ` · ${members.length} ${members.length === 1 ? 'person' : 'people'}` : '';
  const eyebrow = active && visible ? `${active.name}${count}` : null;
  const action = visible && manage ? <Button label="Invite" accessibilityLabel="Invite someone" icon="person.badge.plus" variant="secondary" onPress={startInvite} /> : null;
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  let body: ReactNode;
  if (home || !active) body = <Body tone="muted">Team is part of a venue. Switch to your bar to see it.</Body>;
  else if (!visible) body = <Body tone="muted">Team opens at Employee.</Body>;
  else body = <TeamRoster barId={active.id} barName={active.name} role={role} note={note} onNote={setNote} selectedId={person?.user_id} onOpen={open} />;

  const head = (
    <>
      <PageHeader
        title="Team"
        display
        onBack={desk ? undefined : back}
        actionOnTop
        action={desk ? null : action}
        above={eyebrow ? <Caption tone="muted" style={styles.caps}>{eyebrow}</Caption> : null}
      />
      {visible && manage && brand.data && !looks ? <Caption tone="muted">{`Set how ${active?.name} looks first: the invite wears its logo, colour and font.`}</Caption> : null}
    </>
  );
  const sheet = visible && manage && active ? (
    <InviteSheet visible={inviting} onClose={() => setInviting(false)} barId={active.id} barName={active.name} ceiling={ceiling} admin={admin} onDone={setNote} />
  ) : null;

  if (desk && visible && manage && active) {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <View style={[styles.deskBar, { borderBottomColor: ds.c.line }]}>
          <Crumbs trail={[{ label: active.name, href: '/' as Href }, { label: 'Team', href: '/team' as Href }, ...(person ? [{ label: personName(person), href: '/team' as Href }] : [])]} />
          {action}
        </View>
        <View style={styles.split}>
          <ScrollView style={[styles.list, { borderRightColor: ds.c.line }]} contentContainerStyle={styles.listContent}>
            {head}
            {body}
          </ScrollView>
          <ScrollView style={styles.screen} contentContainerStyle={styles.beside}>
            <View style={styles.person}>
              {person ? (
                <MemberPage key={person.user_id} barId={active.id} barName={active.name} member={person} role={role} onRemoved={() => setPicked(null)} />
              ) : (
                <Body tone="muted">Pick someone to see them here.</Body>
              )}
            </View>
          </ScrollView>
        </View>
        {sheet}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        {head}
        {body}
      </ScrollView>
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
  deskBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.xxl, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  split: { flex: 1, flexDirection: 'row' },
  list: { width: LIST, flexGrow: 0, flexShrink: 0, borderRightWidth: StyleSheet.hairlineWidth },
  listContent: { gap: space.xl, padding: space.xxl },
  beside: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl },
  person: { width: '100%', maxWidth: PERSON },
});
