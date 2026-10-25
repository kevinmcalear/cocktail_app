import { usePathname, useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { NavRow } from '@/components/nav/SideNavParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useSetupChecklist, useSetupRun } from '@/hooks/useSetupChecklist';
import { useVenueFeatures } from '@/hooks/useVenueFeatures';
import { useVenueClaim, useVenuePage } from '@/hooks/useVenueSetup';
import { onItsWay } from '@/lib/venueSetup';
import { useVenueSetup } from '@/store/useVenueSetup';

/**
 * "Setup: 3 things on their way · See": the banner on Tonight (or Library,
 * with Tonight off) until venue setup is finished (b03). Kept private, it stays to offer proving it's yours (prove).
 */
export function SetupBanner({ count, prove, onPress }: { count: number; prove?: boolean; onPress?: () => void }) {
  const ds = useDs();
  const what = prove
    ? 'prove it’s yours when you’re ready'
    : count === 0
      ? 'pick up where you left off'
      : `${count} ${count === 1 ? 'thing' : 'things'} on ${count === 1 ? 'its' : 'their'} way`;
  const body = (
    <>
      <IconSymbol name="clock" size={16} color={ds.c.muted} />
      <Body style={styles.flex} numberOfLines={1}>
        <Body style={styles.strong}>Setup:</Body>
        {` ${what}`}
      </Body>
      <View style={[styles.see, { borderColor: ds.c.lineStrong }]}>
        <Caption style={styles.strong}>See</Caption>
      </View>
    </>
  );
  const style = [styles.banner, { backgroundColor: ds.c.surface, borderColor: ds.c.line }];
  if (!onPress) return <View role="img" aria-label={`The banner shown until setup is finished: Setup, ${what}`} style={style}>{body}</View>;
  return (
    <PressableScale role="button" accessibilityLabel={`Setup: ${what}. See`} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  );
}

/**
 * The Setup banner for a venue set up on this device, on its first tab
 * (Tonight, or Library for the many venues with Tonight off): while setup isn't
 * finished it opens where it left off; finished but kept private (no claim,
 * no page), it opens the claim.
 */
export function TonightSetupBanner({ barId }: { barId: string }) {
  const router = useRouter();
  const run = useVenueSetup((s) => s.runs[barId]);
  const open = !!run && !run.finished;
  // Finished with the claim sent: nothing left to offer, so nothing to look up.
  const proving = !!run?.finished && !run.done.includes('claim');
  const claim = useVenueClaim(open || proving ? barId : null);
  const page = useVenuePage(proving ? barId : null);
  const invites = useBarInvites(barId, open).data ?? [];
  if (!run || (!open && !proving)) return null;
  if (!open) {
    const status = claim.data?.status;
    const unproved = claim.isSuccess && page.isSuccess && !page.data && status !== 'pending' && status !== 'approved';
    return unproved ? <SetupBanner count={0} prove onPress={() => router.push(`/venue-setup?bar=${barId}&step=claim` as Href)} /> : null;
  }
  const count = onItsWay({ claim: claim.data?.status === 'pending' ? 'pending' : 'none', invites: invites.length });
  return <SetupBanner count={count} onPress={() => router.push(`/venue-setup?bar=${barId}` as Href)} />;
}

/** The same banner at the top of Library, for a venue with Tonight off (new venues start with it off). */
export function LibrarySetupBanner({ barId }: { barId: string }) {
  const { ready, has } = useVenueFeatures();
  return ready && !has('tonight') ? <TonightSetupBanner barId={barId} /> : null;
}

const checklistHref = (barId: string) => `/settings/bar/${barId}/what-next` as Href;

/**
 * The top of Library: on a phone, "Set up <bar>" while its checklist isn't
 * done (owner-setup call 6; the sidebar has it on a desktop), else the Setup banner.
 */
export function LibrarySetup({ barId }: { barId: string }) {
  const run = useSetupRun(barId);
  const wide = useIsWideWeb();
  const banner = <LibrarySetupBanner barId={barId} />;
  return run && !wide ? <ChecklistCard barId={barId} fallback={banner} /> : banner;
}

function ChecklistCard({ barId, fallback }: { barId: string; fallback: ReactNode }) {
  const ds = useDs();
  const router = useRouter();
  const name = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'your bar';
  const { list, loading } = useSetupChecklist(barId);
  if (loading) return null;
  if (list.finished) return fallback;
  const next = list.rows.find((r) => r.key === list.next)?.title;
  const line = `${list.done} of ${list.total} done${next ? ` · Next: ${next.toLowerCase()}` : ''}`;
  return (
    <PressableScale role="button" accessibilityLabel={`Set up ${name}. ${line}. Continue`} onPress={() => router.push(checklistHref(barId))} style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Body style={styles.strong} numberOfLines={1}>{`Set up ${name}`}</Body>
        <Caption tone="muted">{line}</Caption>
      </View>
      <View style={[styles.see, { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill }]}>
        <Caption color={ds.accentFill.text} style={styles.strong}>Continue</Caption>
      </View>
    </PressableScale>
  );
}

/** "Set up <bar> · 3 of 6": the first row of the desktop sidebar while its checklist isn't done (owner-setup call 6). */
export function SetupNav() {
  const { active } = useActiveVenue();
  const run = useSetupRun(active?.id);
  return active && run ? <SetupNavRow barId={active.id} name={active.name} /> : null;
}

function SetupNavRow({ barId, name }: { barId: string; name: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { list, loading } = useSetupChecklist(barId);
  if (loading || list.finished) return null;
  return <NavRow label={`Set up ${name}`} icon="list.bullet" badge={`${list.done} of ${list.total}`} current={pathname === `/settings/bar/${barId}/what-next`} onPress={() => router.push(checklistHref(barId))} />;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.lg, paddingLeft: space.lg, paddingRight: space.sm, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget + space.md, paddingLeft: space.lg, paddingRight: space.sm, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  see: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
