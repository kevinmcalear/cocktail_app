import { usePathname, useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { NavRow } from '@/components/nav/SideNavParts';
import { font, layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useSetupChecklist } from '@/hooks/useSetupChecklist';

/*
 * The two places "Set up <bar>" shows its progress: the card at the top of
 * Library on a phone and the first row of the desktop sidebar. They read the
 * whole checklist (useSetupChecklist), so the web loads this file only for a
 * venue with a setup run (SetupChecklistNavLazy.web.tsx).
 */

const checklistHref = (barId: string) => `/settings/bar/${barId}/what-next` as Href;

/** The Library card: "Set up <bar> · 3 of 8 done · Next: ..." and Continue. */
export function ChecklistCard({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const name = useActiveVenue().venues.find((v) => v.id === barId)?.name ?? 'your bar';
  const { list, loading } = useSetupChecklist(barId);
  if (loading) return null;
  if (list.finished) return null;
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

/** The sidebar row: "Set up <bar> · 3 of 8". */
export function SetupNavRow({ barId, name }: { barId: string; name: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { list, loading } = useSetupChecklist(barId);
  if (loading || list.finished) return null;
  return <NavRow label={`Set up ${name}`} icon="list.bullet" badge={`${list.done} of ${list.total}`} current={pathname === `/settings/bar/${barId}/what-next`} onPress={() => router.push(checklistHref(barId))} />;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.lg, paddingLeft: space.lg, paddingRight: space.sm, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  see: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  strong: { ...font.semiBold },
});
