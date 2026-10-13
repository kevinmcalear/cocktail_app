import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useLoveBar, useLovedBars, useSetLoveAlerts, type LoveAlerts } from '@/hooks/useKept';

/** What a bar you love may tell you about (board week-love-alerts). */
export const ALERT_CHOICES: { value: LoveAlerts; label: string; detail: string }[] = [
  { value: 'everything', label: 'Everything', detail: 'Events, new menus, new drinks' },
  { value: 'events', label: 'Events only', detail: 'Takeovers, guest shifts, tastings' },
  { value: 'menus', label: 'Menus and drinks only', detail: 'A new menu goes on, a drink is added' },
  { value: 'none', label: 'No alerts', detail: 'Still in This week and your Collection' },
];

const choiceLabel = (v: LoveAlerts) => ALERT_CHOICES.find((c) => c.value === v)?.label ?? 'Everything';

/**
 * After loving a bar (or tapping Loved): what it may tell you about, at most
 * one alert a day, Done, and Stop loving. The bar stays in This week either way.
 */
export function LoveAlertsSheet({ visible, profileId, name, onClose }: { visible: boolean; profileId: string; name: string; onClose: () => void }) {
  const love = useLoveBar();
  const setAlerts = useSetLoveAlerts();
  const loved = useLovedBars().data?.find((b) => b.id === profileId);
  const current = (setAlerts.isPending && setAlerts.variables?.alerts) || loved?.alerts || 'everything';
  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={`You love ${name}`}
      footer={
        <View style={styles.footer}>
          <Button label="Done" size="lg" onPress={onClose} />
          <Button
            label={`Stop loving ${name}`}
            variant="ghost"
            onPress={() => {
              love.mutate({ profileId, love: false });
              onClose();
            }}
          />
        </View>
      }
    >
      <AlertChoices name={name} value={current} onChange={(alerts) => setAlerts.mutate({ profileId, alerts })} />
    </MenuSheet>
  );
}

function AlertChoices({ name, value, onChange }: { name: string; value: LoveAlerts; onChange: (v: LoveAlerts) => void }) {
  return (
    <View style={styles.body}>
      <Body tone="muted">It’s in This week either way. Choose what it can tell you about.</Body>
      <View role="radiogroup" accessibilityLabel={`What ${name} can tell you about`} style={styles.choices}>
        {ALERT_CHOICES.map((c) => (
          <Choice key={c.value} label={c.label} detail={c.detail} selected={value === c.value} onPress={() => onChange(c.value)} />
        ))}
      </View>
      <Caption tone="muted">At most one alert a day from each bar. Turn them all off in Settings.</Caption>
    </View>
  );
}

/**
 * Choose what each bar tells you (This week at home): the bars you love with
 * what each may tell you about; tap one to change it.
 */
export function EachBarAlertsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const ds = useDs();
  const bars = useLovedBars().data ?? [];
  const setAlerts = useSetLoveAlerts();
  const [open, setOpen] = useState<string | null>(null);
  const bar = bars.find((b) => b.id === open);
  return (
    <MenuSheet visible={visible} onClose={onClose} title={bar ? `You love ${bar.name}` : 'What each bar tells you'}>
      {bar ? (
        <>
          <AlertChoices name={bar.name} value={bar.alerts} onChange={(alerts) => setAlerts.mutate({ profileId: bar.id, alerts })} />
          <Button label="All your bars" variant="secondary" onPress={() => setOpen(null)} />
        </>
      ) : bars.length ? (
        bars.map((b) => (
          <PressableScale key={b.id} role="button" accessibilityLabel={`${b.name}: ${choiceLabel(b.alerts)}. Change`} onPress={() => setOpen(b.id)} style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <View style={styles.flex}>
              <Body>{b.name}</Body>
              <Caption tone="muted">{choiceLabel(b.alerts)}</Caption>
            </View>
            <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
          </PressableScale>
        ))
      ) : (
        <Body tone="muted">Love a bar from its page and choose here what it tells you about.</Body>
      )}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  choices: { gap: space.sm },
  footer: { gap: space.xs },
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.mark },
});
