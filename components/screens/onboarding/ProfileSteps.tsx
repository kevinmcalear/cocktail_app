import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, DsText, Field, PalateFlower, PressableScale, Surface, Title, useDs } from '@/components/ds';
import { TasteAnswers } from '@/components/screens/taste/TasteAnswers';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useSaveTasteAnswers } from '@/hooks/useFlavor';
import { useVenueSpecUnit } from '@/hooks/useOnboarding';
import { QUICK_QUESTIONS, tasteHeadline, type Taste } from '@/lib/flavor';
import { MEASURE_UNITS, handleError, nameError, type MeasureUnit } from '@/lib/onboarding';
import { convertPour } from '@/lib/drinkWizard';
import { handleFromName } from '@/lib/profiles';
import { useSettingsStore } from '@/store/useSettingsStore';

import { SetupFooter, SetupPage } from './SetupPage';

/** Their name (and handle, if theirs was taken). */
export function NameStep({
  initialName,
  forceHandle,
  pendingFinish,
  invited,
  job,
  onSaved,
  onSkip,
}: {
  initialName: string;
  forceHandle: boolean;
  pendingFinish: boolean;
  /** Joined through a venue's invite: other devices sign in by code, and setup can't be skipped. */
  invited?: boolean;
  /** Invited to a venue with a bar page: the job saved for them there. */
  job?: { bar: string; title: string } | null;
  onSaved: (name: string, handle: string) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [handle, setHandle] = useState<string | null>(forceHandle ? handleFromName(initialName) : null);
  const [tried, setTried] = useState(false);
  const chosen = handle ?? handleFromName(name);
  const problem = tried ? nameError(name) : null;
  const handleProblem = tried && handle !== null ? handleError(handle) : undefined;

  const submit = () => {
    setTried(true);
    if (nameError(name) || (handle !== null && handleError(handle))) return;
    onSaved(name.trim(), chosen);
  };

  return (
    <SetupPage footer={<SetupFooter onPress={submit} disabled={pendingFinish} onSkip={invited ? undefined : onSkip} />}>
      <Field label="Name" value={name} onChangeText={setName} error={problem ?? undefined} autoComplete="name" maxLength={80} />
      {handle === null && name.trim() && !invited ? <Caption tone="muted" style={styles.strong}>{`Your handle is @${chosen}. You can change it on You.`}</Caption> : null}
      {handle !== null ? (
        <Field
          label="Handle"
          value={handle}
          onChangeText={setHandle}
          error={handleProblem}
          hint="Letters, numbers, dots and underscores. Yours was taken."
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={31}
        />
      ) : null}
      {invited ? <Caption tone="muted">On your other devices, sign in with this email and we’ll send a code. No password to remember.</Caption> : null}
      {job ? <Caption tone="muted">{`Your job at ${job.bar} is saved for you as ${job.title}. Change it on your profile.`}</Caption> : null}
    </SetupPage>
  );
}

/**
 * A few quick taste questions, with the palate flower growing as they're
 * answered. Skippable; a failed save doesn't hold up setup (Discover asks again).
 */
export function TasteStep({ onDone }: { onDone: () => void }) {
  const [answers, setAnswers] = useState<Taste>({});
  const save = useSaveTasteAnswers();
  const answered = Object.keys(answers).length > 0;
  const headline = tasteHeadline(answers);
  return (
    <SetupPage
      footer={<SetupFooter pending={save.isPending} disabled={!answered} onPress={() => save.mutate(answers, { onSuccess: onDone, onError: () => {} })} onSkip={onDone} />}
    >
      <View style={styles.flower}>
        <PalateFlower values={answers} size={188} />
        <Title italic align="center">
          {headline ? `${headline}.` : answered ? 'Nothing stands out yet.' : 'Tap an answer to start.'}
        </Title>
      </View>
      <TasteAnswers questions={QUICK_QUESTIONS} value={answers} onChange={setAnswers} />
      <Caption tone="muted">Change them any time on You. Every drink you rank sharpens it.</Caption>
      {save.error ? <Caption tone="accent">{"Couldn't save your answers. Try again, or skip and answer later on You."}</Caption> : null}
    </SetupPage>
  );
}

/** The spec the units step shows, in whichever unit is picked. */
const PREVIEW = [
  { ml: 45, name: 'Mezcal' },
  { ml: 22.5, name: 'Lime juice' },
];

/** One unit as a big tile in mono, the chosen one ringed in the accent (canvas make-onboarding-units). */
function UnitTile({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.tile, { borderColor: selected ? ds.accentText : ds.c.line, backgroundColor: selected ? ds.c.raised : ds.c.surface }]}
    >
      <DsText variant="headline" style={styles.mono}>
        {label}
      </DsText>
    </PressableScale>
  );
}

/**
 * ml, oz or g for new specs and reading. Joined from an invite, it's the last
 * step before the app, starting on the venue's own unit (canvas make-onboarding-invite-units).
 */
export function UnitsStep({ onDone, pending, error, joined = null }: { onDone: () => void; pending: boolean; error?: string; joined?: { barId: string; name: string } | null }) {
  const specUnit = useSettingsStore((s) => s.specUnit);
  const setSpecUnit = useSettingsStore((s) => s.setSpecUnit);
  const setDefaultUnit = useSettingsStore((s) => s.setDefaultUnit);
  const venueUnit = useVenueSpecUnit(joined?.barId ?? null).data ?? null;
  const [picked, setUnit] = useState<MeasureUnit | null>(null);
  const unit = picked ?? (joined && venueUnit ? venueUnit : specUnit);

  const save = () => {
    setSpecUnit(unit);
    setDefaultUnit(unit);
    onDone();
  };

  return (
    <SetupPage footer={<SetupFooter label={joined ? 'Have a look around' : 'Continue'} pending={pending} onPress={save} />}>
      <View role="radiogroup" accessibilityLabel="How do you measure?" style={styles.tiles}>
        {MEASURE_UNITS.map((u) => (
          <UnitTile key={u.id} label={u.label} selected={unit === u.id} onPress={() => setUnit(u.id)} />
        ))}
      </View>
      {joined && venueUnit ? (
        <Caption tone="muted">{`${joined.name} writes its specs in ${venueUnit}. You can still read them in ${venueUnit === 'oz' ? 'ml' : 'oz'} any time.`}</Caption>
      ) : null}
      {joined ? null : (
        <>
          <Surface style={styles.preview}>
            <Caption tone="muted">{`A spec in ${unit}`}</Caption>
            {PREVIEW.map((line) => {
              // Grams read the same as millilitres for a spirit or a juice: near enough to show the idea.
              const pour = unit === 'g' ? { amount: String(line.ml), unit: 'g' } : convertPour(line.ml, 'ml', unit);
              return (
                <View key={line.name} style={styles.line}>
                  <DsText variant="spec" style={styles.amount}>{`${pour.amount} ${pour.unit}`}</DsText>
                  <DsText variant="body">{line.name}</DsText>
                </View>
              );
            })}
          </Surface>
          <Caption tone="muted">Centilitres are in Settings.</Caption>
        </>
      )}
      {error ? <Caption tone="accent">{error}</Caption> : null}
    </SetupPage>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, minHeight: 64, borderRadius: radius.control, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: fontFamilies.monoMedium },
  flower: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  preview: { gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  amount: { minWidth: 72 },
});
