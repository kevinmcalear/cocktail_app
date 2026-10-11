import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { BackbarTheme, Body, Button, Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateMenu, useMenuLayouts } from '@/hooks/useMenuMutations';
import { useMenu } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { blankSection, copySections, type MenuLayout } from '@/lib/menuLayout';
import { cardWhen, EMPTY_PLAN, groupMenus, homeMenuLine, homeNight, venuePlan } from '@/lib/menus';
import { stageMenuPhotos } from '@/lib/menuPhotoHandoff';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import type { MenuPhoto } from '@/lib/readMenu';
import type { MenuSummary } from '@/types/menus';

import { Eyebrow } from '../addDrink/WizardChrome';
import { EMPTY_NIGHT, HomeNightFields } from './HomeNight';
import { MenuPhotos } from './MenuPhotos';
import { Choice, MenuSheet } from './MenuSheet';
import { DraftCard, StepTrack, VenueDatesFields } from './NewMenuParts';

type Start = { kind: 'copy'; menuId: string } | { kind: 'layout'; layoutId: string } | { kind: 'photo' } | { kind: 'paste' } | { kind: 'blank' };
type Step = 'name' | 'start' | 'night' | 'dates';

const QUESTION: Record<Step, string> = { name: 'What’s it called?', start: 'What does it start from?', night: 'When is it?', dates: 'When does it go on?' };
const SHORT: Record<Step, string> = { name: 'name', start: 'start from', night: 'night', dates: 'dates' };

interface NewMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The venue's menus, to copy one. */
  menus: MenuSummary[];
  now: number;
}

// Drink Creator and up build a venue's menus (private.can_write).
const BUILDS_MENUS = 35;

/**
 * A new menu, a short wizard like adding a drink: its name (and whose it is),
 * what it starts from (blank, a menu you saved or a saved layout, photos of a
 * printed menu, or a pasted list), then its dates: a venue's run or one night
 * (a plan; it stays a draft), or a home menu's night. A small paper menu fills
 * in as you answer. Photos go to a review of what was read (/menus/from-photo),
 * which makes the menu; a pasted list opens the builder on Paste a list.
 */
export function NewMenuSheet({ visible, onClose, menus, now }: NewMenuSheetProps) {
  const router = useRouter();
  const { venues, active } = useActiveVenue();
  // Home mode is like another account: a menu made there is always your own.
  const home = useMode().mode === 'home';
  // The venue you're in always counts: its Menus page only opens this when the
  // venue lets you build menus, which it can allow below Drink Creator.
  const buildable = home ? [] : venues.filter((v) => v.id === active?.id || v.roleLevel >= BUILDS_MENUS);
  const steps: Step[] = home ? ['name', 'start', 'night'] : ['name', 'start', 'dates'];
  const [step, setStep] = useState<Step>('name');
  const at = steps.indexOf(step);
  const [name, setName] = useState('');
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [barId, setBarId] = useState<string | null>(buildable.some((v) => v.id === active?.id) ? active!.id : (buildable[0]?.id ?? null));
  const venueMenus = menus.filter((m) => m.barId === barId);
  const groups = groupMenus(venueMenus, now);
  const copyable = [...groups.on, ...groups.upcoming, ...groups.draft, ...groups.previous].slice(0, 3);
  const [start, setStart] = useState<Start>({ kind: 'blank' });
  const { data: layouts = [] } = useMenuLayouts(barId);
  // "A menu you saved": the venue's latest menus, then its saved layouts, as pills.
  const saved = [
    ...copyable.map((m) => ({ key: m.id, name: m.name.replace(/ menu$/i, ''), start: { kind: 'copy', menuId: m.id } as Start })),
    ...layouts.map((l) => ({ key: l.id, name: l.name, start: { kind: 'layout', layoutId: l.id } as Start })),
  ];
  const { data: source } = useMenu(start.kind === 'copy' ? start.menuId : null);
  const create = useCreateMenu();
  const [photos, setPhotos] = useState<MenuPhoto[]>([]);
  const [night, setNight] = useState(EMPTY_NIGHT);
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [error, setError] = useState<string | null>(null);

  const pickVenue = (id: string | null) => {
    setBarId(id);
    if (start.kind === 'copy' || start.kind === 'layout') setStart({ kind: 'blank' });
  };

  const startLabel =
    start.kind === 'copy'
      ? `A copy of ${copyable.find((m) => m.id === start.menuId)?.name ?? 'another menu'}`
      : start.kind === 'layout'
        ? (layouts.find((l) => l.id === start.layoutId)?.name ?? 'A saved layout')
        : start.kind === 'photo'
          ? 'Read from a photo'
          : start.kind === 'paste'
            ? 'From a pasted list'
            : 'One empty section';
  // For the card only; the night that's saved is worked out when the menu is made.
  const shownNight = home ? homeNight(night, now) : null;
  const shownPlan = home ? null : venuePlan(plan);
  const nightLine =
    shownNight && !('error' in shownNight)
      ? homeMenuLine(shownNight, now)
      : shownPlan && !('error' in shownPlan)
        ? cardWhen({ startsAt: null, endsAt: null, menuDate: null, ...shownPlan })
        : null;

  const submit = async () => {
    // From photos, the menu's printed title can name it.
    if (!name.trim() && start.kind !== 'photo') {
      setStep('name');
      return setError('Give the menu a name.');
    }
    const when = home ? homeNight(night, Date.now()) : null;
    if (when && 'error' in when) return setError(when.error);
    const planned = home ? null : venuePlan(plan);
    if (planned && 'error' in planned) return setError(planned.error);
    let layout: MenuLayout = { name, coverUrl: null, coverPosition: 50, sections: [blankSection()] };
    if (start.kind === 'photo') {
      if (!photos.length) {
        setStep('start');
        return setError('Add a photo of the menu first.');
      }
      stageMenuPhotos({ photos, barId, name: name.trim(), night: when ?? undefined });
      onClose();
      return router.push('/menus/from-photo');
    }
    if (start.kind === 'copy') {
      if (!source) return setError('Still loading that menu. Try again in a moment.');
      layout = { name, coverUrl: source.coverUrl, coverPosition: source.coverPosition, sections: copySections(source.sections, true) };
    } else if (start.kind === 'layout') {
      const chosen = layouts.find((l) => l.id === start.layoutId);
      if (chosen?.sections.length) layout = { ...layout, sections: copySections(chosen.sections, false) };
    }
    setError(null);
    try {
      const id = await create.mutateAsync({ barId, layout, night: when ?? undefined, plan: planned ?? undefined });
      onClose();
      router.push(`/menus/${id}/edit${start.kind === 'paste' ? '?paste=1' : ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t make the menu. Try again.');
    }
  };

  const last = at === steps.length - 1;
  // An empty name can still go on: a photo can name the menu. It's checked when the menu is made.
  const next = () => {
    setError(null);
    setStep(steps[at + 1]);
  };
  const doneLabel = create.isPending ? 'Making the draft…' : start.kind === 'photo' ? 'Read the menu' : 'Create draft';

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title="New menu"
      subtitle={home ? 'Only you see it. Share it with your guests when it’s ready.' : 'It starts as a draft. Nobody sees it until it goes on.'}
      onShow={MODAL_AUTOFOCUS ? undefined : () => focusInModal(nameRef)}
      footer={
        <View style={styles.footer}>
          {at > 0 ? <Button label="Back" variant="secondary" size="lg" onPress={() => setStep(steps[at - 1])} /> : null}
          <Button
            label={last ? doneLabel : `Next: ${SHORT[steps[at + 1]]}`}
            size="lg"
            onPress={last ? submit : next}
            disabled={create.isPending}
            style={styles.flex}
          />
        </View>
      }
    >
      <StepTrack at={at} of={steps.length} />
      <BackbarTheme scheme="light">
        <DraftCard name={name.trim() || (start.kind === 'photo' ? 'From the photo' : 'Your menu')} lines={[at > 0 ? startLabel : null, nightLine]} />
      </BackbarTheme>
      <Eyebrow>{QUESTION[step]}</Eyebrow>

      {step === 'name' ? (
        <>
          <Field
            ref={nameRef}
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder={home ? 'Friday at ours' : 'Winter menu'}
            hint="Starting from a photo? You can use the name printed on it."
            autoFocus={MODAL_AUTOFOCUS}
            onSubmitEditing={next}
          />
          {buildable.length > 1 ? (
            <>
              <Caption tone="muted">For</Caption>
              <View role="radiogroup" accessibilityLabel="Who the menu is for" style={styles.wrap}>
                {buildable.map((v) => (
                  <Choice key={v.id} label={v.name} selected={barId === v.id} onPress={() => pickVenue(v.id)} />
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {step === 'start' ? (
        <>
          <View role="radiogroup" accessibilityLabel="Start from" style={styles.list}>
            <Choice label="Blank" detail="One section. Add more as you go." icon="plus" selected={start.kind === 'blank'} onPress={() => setStart({ kind: 'blank' })} />
            {saved.length ? (
              <Choice
                label="A menu you saved"
                detail="Its sections, and a menu's drinks. Swap what's changing."
                icon="doc.on.doc"
                selected={start.kind === 'copy' || start.kind === 'layout'}
                onPress={() => (start.kind === 'copy' || start.kind === 'layout' ? null : setStart(saved[0].start))}
              />
            ) : null}
            {start.kind === 'copy' || start.kind === 'layout' ? (
              <View role="radiogroup" accessibilityLabel="Which one" style={[styles.wrap, styles.indent]}>
                {saved.map((m) => (
                  <Choice key={m.key} label={m.name} selected={m.key === (start.kind === 'copy' ? start.menuId : start.layoutId)} onPress={() => setStart(m.start)} />
                ))}
              </View>
            ) : null}
            <Choice label="From a photo" detail="Read a printed menu: its sections, drinks and prices." icon="camera.fill" selected={start.kind === 'photo'} onPress={() => setStart({ kind: 'photo' })} />
            <Choice label="Paste a list" detail="Drink names, one a line. We match your drinks." icon="list.bullet" selected={start.kind === 'paste'} onPress={() => setStart({ kind: 'paste' })} />
          </View>
          {start.kind === 'photo' ? <MenuPhotos photos={photos} onChange={setPhotos} onError={setError} /> : null}
        </>
      ) : null}

      {step === 'night' ? <HomeNightFields value={night} onChange={setNight} /> : null}
      {step === 'dates' ? <VenueDatesFields value={plan} onChange={setPlan} min={new Date(now).toISOString().slice(0, 10)} /> : null}
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.sm },
  footer: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  indent: { paddingLeft: space.lg },
});
