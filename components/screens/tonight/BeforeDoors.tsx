import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, Surface, useDs } from '@/components/ds';
import { RowDivider, SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { LogBatchButton } from '@/components/screens/prep/LogBatchButton';
import { categoryOf } from '@/hooks/useTonight';
import { itemHref } from '@/lib/itemRoutes';
import { withAlpha } from '@/lib/color';
import { plural } from '@/lib/menus';
import { prepLine } from '@/lib/tonight';

import { TonightSection } from './TonightParts';
import type { useStaffTonight } from './useStaffTonight';

type Staff = ReturnType<typeof useStaffTonight>;

/**
 * Before doors (Prod-today-staff): house-made that's low for tonight with
 * Log batch (LogBatchButton), what's counted or logged and enough, then
 * what's off tonight.
 */
export function BeforeDoors({ t, barId }: { t: Staff; barId: string }) {
  const router = useRouter();
  const go = (href: string) => () => router.push(href as Href);
  const make = t.canPrep ? (t.make ?? []).slice(0, 3) : [];
  const enough = t.canPrep ? t.enough.slice(0, 3) : [];
  const rows = [
    ...make.map((line) => (
      <SettingsRow
        key={line.id}
        icon="drop.fill"
        label={line.name}
        detail={prepLine(line)}
        onPress={go(itemHref('Ingredient', line.id))}
        trailing={<LogBatchButton barId={barId} id={line.id} name={line.name} batch={t.batchOf(line.id)} />}
      />
    )),
    ...enough.map((row) => <SettingsRow key={row.id} icon="drop.fill" label={row.name} detail={row.sub} onPress={go(itemHref('Ingredient', row.id))} />),
    ...t.off.slice(0, 2).map((d) => <SettingsRow key={`off-${d.id}`} icon="exclamationmark.triangle" label="Off tonight" value={d.name} onPress={go(itemHref(categoryOf(d.kind), d.id))} />),
  ];
  if (!rows.length) return null;
  return (
    <TonightSection title="Before doors">
      <Surface style={styles.card}>
        {rows.map((row, i) => (
          <View key={row.key}>
            {i ? <RowDivider /> : null}
            {row}
          </View>
        ))}
      </Surface>
    </TonightSection>
  );
}

/** Needs you (admins): credits to check, the next list and its unpriced drinks, and how often the bar's links were opened this week. */
export function NeedsYou({ t }: { t: Staff }) {
  const ds = useDs();
  const router = useRouter();
  const go = (href: string) => () => router.push(href as Href);
  if (!t.admin) return null;
  const rows = [
    t.credits ? <SettingsRow key="credits" icon="person.2.fill" label="Credits to check" value={String(t.credits)} onPress={go('/credits-to-check')} /> : null,
    t.next ? (
      <SettingsRow
        key="next"
        icon="doc.text"
        label={`${t.next.name} goes on ${t.next.startsAt ? new Date(t.next.startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'soon'}`}
        trailing={
          t.nextUnpriced ? (
            <View style={styles.end}>
              <Caption color={ds.accentText}>{`${plural(t.nextUnpriced, 'drink')} ${t.nextUnpriced === 1 ? 'has' : 'have'} no price`}</Caption>
              <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
            </View>
          ) : undefined
        }
        value={t.nextUnpriced ? undefined : plural(t.next.itemIds.length, 'drink')}
        onPress={go(`/menus/${t.next.id}`)}
      />
    ) : null,
    t.shares != null ? <SettingsRow key="shares" icon="square.and.arrow.up" label="Shared links this week" value={String(t.shares)} onPress={go('/menus/all')} /> : null,
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <TonightSection title="Needs you">
      <Surface style={styles.card}>
        {rows.map((row, i) => (
          <View key={i}>
            {i ? <RowDivider /> : null}
            {row}
          </View>
        ))}
      </Surface>
    </TonightSection>
  );
}

/**
 * On shift: who's on tonight, who opens and closes, from the rota. Opens the
 * rota. With nobody on, someone who writes the rota still gets the way in.
 */
export function OnShift({ t }: { t: Staff }) {
  const ds = useDs();
  const router = useRouter();
  if (!t.onShift && !t.writesRota) return null;
  const go = () => router.push('/team/rota' as Href);
  const names = t.onShift?.names ?? 'Nobody’s on tonight yet';
  const sub = t.onShift ? t.onShift.sub : 'Set the rota';
  return (
    <TonightSection title="On shift" aside="Rota" onAside={go}>
      <PressableScale role="link" accessibilityLabel={[names, sub].filter(Boolean).join('. ')} onPress={go} style={[styles.shift, { backgroundColor: withAlpha(ds.c.ink, 0.06) }]}>
        <View style={[styles.mark, { backgroundColor: ds.c.raised }]}>
          {t.onShift ? <DsText variant="headline">{names.charAt(0)}</DsText> : <IconSymbol name="calendar" size={20} color={ds.c.muted} />}
        </View>
        <View style={styles.flex}>
          <DsText variant="body">{names}</DsText>
          {sub ? <Caption tone="muted">{sub}</Caption> : null}
        </View>
        <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
      </PressableScale>
    </TonightSection>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: space.xs, paddingHorizontal: space.lg, overflow: 'hidden' },
  end: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  shift: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 2, marginHorizontal: -(space.sm + 2), borderRadius: radius.control + 4 },
  mark: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
});
