import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, TextLink, TimeField } from '@/components/ds';
import { RowDivider, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { STATUS } from '@/constants/palette';
import { space } from '@/constants/tokens';
import { useBarFacts, useSaveBarFacts, type BarFacts } from '@/hooks/useBarFacts';
import { useVenueProfileId } from '@/hooks/useVenueRoles';
import { WEEK_DAYS, type HoursRange, type WeekDay, type WeekHours } from '@/lib/barHours';

const DAY_NAMES: Record<WeekDay, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const NEW_RANGE: HoursRange = ['17:00', '01:00'];

/** The device's zone, saved with the hours the first time so "Open now" runs on the bar's clock. */
function deviceZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/**
 * Location and hours on venue settings (canvas tools-venue-settings-desktop,
 * decided b22: typed by the venue, nothing from Google): opening hours per
 * day with up to two ranges, phone and website. Saved as you go, onto the
 * venue's bar page (hooks/useBarFacts), which the bar page, Discover and the
 * map read.
 */
export function VenueHoursEditor({ barId, canEdit }: { barId: string; canEdit: boolean }) {
  const router = useRouter();
  const profileId = useVenueProfileId(barId).data;
  const facts = useBarFacts(profileId).data;
  if (!profileId) {
    // No page yet: set up and kept private, so this is where to prove it's yours later (eddie-oct22-wave1).
    return (
      <SettingsSection title="Location and hours">
        <View style={styles.pad}>
          <Body tone="muted">Hours, phone and website go on your bar page once we’ve checked it’s yours.</Body>
          {canEdit ? <TextLink label="Prove it’s yours" onPress={() => router.push(`/venue-setup?bar=${barId}&step=claim` as Href)} /> : null}
        </View>
      </SettingsSection>
    );
  }
  if (!facts) return null;
  return <HoursForm key={facts.id} facts={facts} canEdit={canEdit} />;
}

function HoursForm({ facts, canEdit }: { facts: BarFacts; canEdit: boolean }) {
  const save = useSaveBarFacts(facts.id);
  const [hours, setHours] = useState<WeekHours>(facts.hours ?? {});
  const [phone, setPhone] = useState(facts.phone ?? '');
  const [website, setWebsite] = useState(facts.website ?? '');
  const timezone = facts.timezone ?? deviceZone();

  const saveHours = (next: WeekHours) => {
    setHours(next);
    save.mutate({ hours: next, ...(facts.timezone ? null : { timezone }) });
  };
  const setDay = (day: WeekDay, ranges: HoursRange[]) => saveHours({ ...hours, [day]: ranges });
  const setTime = (day: WeekDay, i: number, end: 0 | 1, time: string) => {
    const ranges = (hours[day] ?? []).map((r, j) => (j === i ? (end === 0 ? [time, r[1]] : [r[0], time]) : r) as HoursRange);
    setDay(day, ranges);
  };

  return (
    <SettingsSection title="Location and hours" note="Saved as you go. These show on your bar page, in Discover and on the map.">
      <View style={styles.pad} pointerEvents={canEdit ? 'auto' : 'none'} aria-disabled={!canEdit}>
        <Body>Hours</Body>
        <Caption tone="muted">Past midnight counts as the night before: Fri 4pm to 1am.</Caption>
      </View>
      {WEEK_DAYS.map((day) => {
        const ranges = hours[day] ?? [];
        const closed = ranges.length === 0;
        return (
          <View key={day}>
            <RowDivider />
            <View style={styles.day} pointerEvents={canEdit ? 'auto' : 'none'}>
              <View style={styles.dayHead}>
                <Body style={styles.dayName}>{DAY_NAMES[day]}</Body>
                {closed ? <Caption tone="muted" style={styles.flex}>Closed all day</Caption> : <View style={styles.flex} />}
                <Chip label="Closed" multi accessibilityLabel={`${DAY_NAMES[day]} closed`} selected={closed} onPress={() => setDay(day, closed ? [NEW_RANGE] : [])} />
              </View>
              {ranges.map((r, i) => (
                <View key={i} style={styles.range}>
                  <View style={styles.time}>
                    <TimeField label={`${DAY_NAMES[day]} opens`} value={r[0]} onChange={(t) => setTime(day, i, 0, t)} />
                  </View>
                  <View style={styles.time}>
                    <TimeField label={`${DAY_NAMES[day]} closes`} value={r[1]} onChange={(t) => setTime(day, i, 1, t)} />
                  </View>
                  {i > 0 ? (
                    <Button label="Remove" variant="ghost" accessibilityLabel={`Remove ${DAY_NAMES[day]}'s second time`} onPress={() => setDay(day, ranges.slice(0, 1))} />
                  ) : null}
                </View>
              ))}
              {ranges.length === 1 ? (
                <Button label="Add a second time" variant="ghost" icon="plus" onPress={() => setDay(day, [...ranges, ['12:00', '15:00']])} style={styles.start} />
              ) : null}
            </View>
          </View>
        );
      })}
      <RowDivider />
      <View style={styles.pad} pointerEvents={canEdit ? 'auto' : 'none'}>
        <Field label="Phone" value={phone} onChangeText={setPhone} onBlur={() => phone !== (facts.phone ?? '') && save.mutate({ phone })} keyboardType="phone-pad" autoComplete="tel" placeholder="+1 512 555 0100" />
        <Field
          label="Website"
          value={website}
          onChangeText={setWebsite}
          onBlur={() => website !== (facts.website ?? '') && save.mutate({ website })}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://"
        />
        {save.error ? (
          <Caption color={STATUS.danger} role="alert">
            {save.error.message}
          </Caption>
        ) : save.isSuccess ? (
          <Caption tone="muted" role="status">Saved.</Caption>
        ) : null}
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  pad: { gap: space.sm, paddingVertical: space.sm },
  flex: { flex: 1 },
  day: { gap: space.sm, paddingVertical: space.sm },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dayName: { width: 48 },
  range: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: space.sm },
  time: { flexGrow: 1, flexBasis: 140 },
  start: { alignSelf: 'flex-start' },
});
