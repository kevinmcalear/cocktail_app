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
import { offAtLine, prepLine } from '@/lib/tonight';

import { TonightSection } from './TonightParts';
import type { useStaffTonight } from './useStaffTonight';
import { dayMonth } from '@/lib/dayMonth';

type Staff = ReturnType<typeof useStaffTonight>;

/**
 * Before doors (Prod-today-staff, Loop-tonight): house-made that's low for
 * tonight with Log batch (LogBatchButton), then what's counted or logged and
 * enough; only once the bar counts. After close it's Before doors tomorrow.
 */
export function BeforeDoors({ t, barId, title = 'Before doors' }: { t: Staff; barId: string; title?: string }) {
  const router = useRouter();
  const go = (href: string) => () => router.push(href as Href);
  const shown = t.canPrep && t.counted;
  const make = shown ? (t.make ?? []).slice(0, 3) : [];
  const enough = shown ? t.enough.slice(0, 3) : [];
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
  ];
  if (!rows.length) return null;
  return (
    <TonightSection title={title}>
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

/** Off tonight (Loop-tonight): drinks on the lists that come off before the night is out, and when. */
export function OffTonight({ t }: { t: Staff }) {
  const router = useRouter();
  if (!t.off.length) return null;
  return (
    <TonightSection title="Off tonight">
      <Surface style={styles.card}>
        {t.off.map((d, i) => (
          <View key={d.id}>
            {i ? <RowDivider /> : null}
            <SettingsRow icon="exclamationmark.triangle" label={d.name} detail={offAtLine(d.offAt)} onPress={() => router.push(itemHref(categoryOf(d.kind), d.id) as Href)} />
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
        label={`${t.next.name} goes on ${t.next.startsAt ? dayMonth(new Date(t.next.startsAt), { month: 'short' }) : 'soon'}`}
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
 * After close, `title` names tomorrow's night.
 */
export function OnShift({ t, title = 'On shift' }: { t: Staff; title?: string }) {
  const ds = useDs();
  const router = useRouter();
  if (!t.onShift && !t.writesRota) return null;
  const go = () => router.push('/team/rota' as Href);
  const names = t.onShift?.names ?? (title === 'On shift' ? 'Nobody’s on tonight yet' : 'Nobody’s on yet');
  const sub = t.onShift ? t.onShift.sub : 'Set the rota';
  return (
    <TonightSection title={title} aside="Rota" onAside={go}>
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
