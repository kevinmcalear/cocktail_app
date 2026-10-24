import { useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BackbarTheme, Body, Button, Caption, Field, GlassButton } from '@/components/ds';
import { space } from '@/constants/tokens';
import { savedLine } from '@/lib/menus';
import type { MenuSummary } from '@/types/menus';

import { HomeNightFields } from './HomeNight';
import { CAMERA, MenuPhotos, useAddMenuPhotos } from './MenuPhotos';
import { Choice, MenuSheet } from './MenuSheet';
import { DraftCard, NameIdeas, StepTrack, VenueDatesFields } from './NewMenuParts';
import { StartTiles, WhichMenu, type StartKind } from './NewMenuStart';
import { NewMenuDesk } from './NewMenuDesk';
import { MonoLabel } from './ReviewParts';
import { useNewMenu } from './useNewMenu';

type Step = 'start' | 'which' | 'name' | 'when';

interface NewMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The venue's menus, to copy one. */
  menus: MenuSummary[];
  now: number;
}

/** New menu: one page on the web at 900 px and up (NewMenuDesk), steps on narrower screens and phones. */
export function NewMenuSheet(props: NewMenuSheetProps) {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;
  return wide ? <NewMenuDesk onClose={props.onClose} menus={props.menus} now={props.now} /> : <NewMenuSteps {...props} />;
}

/**
 * A new menu on a phone (venue-menus-new P1 to P5): how it starts (a tap goes
 * on), its name with ideas, then when it goes on. A photo skips the name, as
 * the printed title can give it: its pages, an optional name and the dates
 * share one step. The little guest card fills in as you answer.
 */
function NewMenuSteps({ visible, onClose, menus, now }: NewMenuSheetProps) {
  const m = useNewMenu({ menus, now, onClose });
  const [step, setStep] = useState<Step>('start');
  const addPhotos = useAddMenuPhotos({ photos: m.photos, onChange: m.setPhotos, onError: m.setError });
  const photo = m.start.kind === 'photo';
  const of = photo ? 2 : 3;
  const at = step === 'start' || step === 'which' ? 0 : step === 'name' ? 1 : of - 1;
  const saved = [...m.copyable, ...m.layouts];

  const go = (next: Step) => {
    m.setError(null);
    setStep(next);
  };
  const pick = (kind: StartKind) => {
    if (kind === 'saved') return go('which');
    const photos = kind === 'photo' || kind === 'library';
    m.setStart({ kind: photos ? 'photo' : kind });
    go(photos ? 'when' : 'name');
    // Snap the menu opens the camera at once, From your photos the library.
    if (photos && !m.photos.length) void addPhotos(kind === 'photo' ? 'snap' : 'pick');
  };
  const submit = async () => {
    if (!(await m.submit()) && !m.name.trim() && !photo) setStep('name');
  };
  const back = () => go(step === 'when' && !photo ? 'name' : 'start');

  const pictures = m.copied?.pictures ?? [];
  const label = m.pending ? 'Making the draft…' : photo ? 'Read the menu' : 'Create draft';

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title="New menu"
      footer={
        step === 'start' || step === 'which' ? undefined : (
          <View style={styles.foot}>
            {photo ? (
              <Caption tone="muted" align="center">
                You check every drink before anything is made.
              </Caption>
            ) : null}
            <View style={styles.footer}>
              <Button label="Back" variant="secondary" size="lg" onPress={back} />
              <Button label={step === 'name' ? 'Next: when' : label} size="lg" onPress={step === 'name' ? () => go('when') : submit} disabled={m.pending} style={styles.flex} />
            </View>
          </View>
        )
      }
    >
      <View style={styles.track}>
        {step === 'which' ? <GlassButton icon="chevron.left" accessibilityLabel="Back" onPress={() => go('start')} /> : null}
        <View style={styles.flex}>
          <StepTrack at={at} of={of} />
        </View>
      </View>
      {step === 'which' ? null : photo && step === 'when' ? (
        <MenuPhotos photos={m.photos} onChange={m.setPhotos} onError={m.setError} />
      ) : (
        <BackbarTheme scheme="light">
          <DraftCard name={m.name.trim() || null} when={m.when} pictures={pictures} />
        </BackbarTheme>
      )}

      {step === 'start' ? (
        <>
          <MonoLabel>How does it start?</MonoLabel>
          <StartTiles saved={saved.length ? savedLine(saved.map((s) => s.name), true) : null} camera={CAMERA} onPick={pick} />
          <Caption tone="muted" align="center">
            Tap one to go on.
          </Caption>
        </>
      ) : null}

      {step === 'which' ? (
        <>
          <MonoLabel>Which menu?</MonoLabel>
          <WhichMenu
            menus={m.copyable.slice(0, 6)}
            layouts={m.layouts}
            now={now}
            onPick={(start) => {
              m.setStart(start);
              go('name');
            }}
          />
        </>
      ) : null}

      {step === 'name' || (photo && step === 'when') ? (
        <>
          <MonoLabel>{photo ? 'Name' : 'What’s it called?'}</MonoLabel>
          <Field
            label="Name"
            hideLabel
            value={m.name}
            onChangeText={m.setName}
            placeholder={photo ? 'From the photo' : m.home ? 'Friday at ours' : (m.ideas[0] ?? 'Winter menu')}
            hint={photo ? 'Leave it empty to use the name printed on it.' : undefined}
            // On a phone the keyboard would cover the ideas, the quick way to name it.
            autoFocus={!photo && Platform.OS === 'web'}
            onSubmitEditing={photo ? undefined : () => go('when')}
          />
          {photo ? null : <NameIdeas ideas={m.ideas} name={m.name} onPick={m.setName} />}
          {!photo && m.buildable.length > 1 ? (
            <>
              <MonoLabel>For</MonoLabel>
              <View role="radiogroup" accessibilityLabel="Who the menu is for" style={styles.wrap}>
                {m.buildable.map((v) => (
                  <Choice key={v.id} label={v.name} selected={m.barId === v.id} onPress={() => m.pickVenue(v.id)} />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {step === 'when' ? (
        <>
          <MonoLabel>{m.home ? 'When is it?' : 'When does it go on?'}</MonoLabel>
          {m.home ? <HomeNightFields value={m.night} onChange={m.setNight} /> : <VenueDatesFields value={m.plan} onChange={m.setPlan} now={now} />}
        </>
      ) : null}
      {m.error ? <Body tone="accent">{m.error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  foot: { gap: space.sm + 2 },
  footer: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
