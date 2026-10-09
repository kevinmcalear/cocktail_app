import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { BackbarTheme, Body, Button, Caption, DsText, Field, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCreateMenu, useMenuLayouts } from '@/hooks/useMenuMutations';
import { useMenu } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { withAlpha } from '@/lib/color';
import { blankSection, copySections, type MenuLayout } from '@/lib/menuLayout';
import { groupMenus, homeMenuLine, homeNight, plural } from '@/lib/menus';
import { stageMenuPhotos } from '@/lib/menuPhotoHandoff';
import { focusInModal, MODAL_AUTOFOCUS } from '@/lib/modalAutoFocus';
import type { MenuPhoto } from '@/lib/readMenu';
import type { MenuSummary } from '@/types/menus';

import { Eyebrow } from '../addDrink/WizardChrome';
import { EMPTY_NIGHT, HomeNightFields } from './HomeNight';
import { MenuPhotos } from './MenuPhotos';
import { Choice, MenuSheet } from './MenuSheet';

type Start = { kind: 'copy'; menuId: string } | { kind: 'layout'; layoutId: string } | { kind: 'photo' } | { kind: 'blank' };
type Step = 'name' | 'start' | 'night';

const QUESTION: Record<Step, string> = { name: 'What’s it called?', start: 'What does it start from?', night: 'When is it?' };
const SHORT: Record<Step, string> = { name: 'name', start: 'start from', night: 'night' };

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
 * what it starts from (a copy of another menu, a saved layout, photos of a
 * printed menu, or one empty section), and for a home menu its night. A card
 * on paper fills in as you answer. Photos go to a review of what was read
 * (/menus/from-photo), which makes the menu.
 */
export function NewMenuSheet({ visible, onClose, menus, now }: NewMenuSheetProps) {
  const router = useRouter();
  const { venues, active } = useActiveVenue();
  // Home mode is like another account: a menu made there is always your own.
  const home = useMode().mode === 'home';
  // The venue you're in always counts: its Menus page only opens this when the
  // venue lets you build menus, which it can allow below Drink Creator.
  const buildable = home ? [] : venues.filter((v) => v.id === active?.id || v.roleLevel >= BUILDS_MENUS);
  const steps: Step[] = home ? ['name', 'start', 'night'] : ['name', 'start'];
  const [step, setStep] = useState<Step>('name');
  const at = steps.indexOf(step);
  const [name, setName] = useState('');
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [barId, setBarId] = useState<string | null>(buildable.some((v) => v.id === active?.id) ? active!.id : (buildable[0]?.id ?? null));
  const venueMenus = menus.filter((m) => m.barId === barId);
  const groups = groupMenus(venueMenus, now);
  const copyable = [...groups.on, ...groups.upcoming, ...groups.draft, ...groups.previous].slice(0, 3);
  const [start, setStart] = useState<Start>(copyable[0] ? { kind: 'copy', menuId: copyable[0].id } : { kind: 'blank' });
  const { data: layouts = [] } = useMenuLayouts(barId);
  const { data: source } = useMenu(start.kind === 'copy' ? start.menuId : null);
  const create = useCreateMenu();
  const [photos, setPhotos] = useState<MenuPhoto[]>([]);
  const [night, setNight] = useState(EMPTY_NIGHT);
  const [error, setError] = useState<string | null>(null);

  const pickVenue = (id: string | null) => {
    setBarId(id);
    const first = menus.find((m) => m.barId === id);
    if (start.kind !== 'photo') setStart(first ? { kind: 'copy', menuId: first.id } : { kind: 'blank' });
  };

  const startLabel =
    start.kind === 'copy'
      ? `A copy of ${copyable.find((m) => m.id === start.menuId)?.name ?? 'another menu'}`
      : start.kind === 'layout'
        ? (layouts.find((l) => l.id === start.layoutId)?.name ?? 'A saved layout')
        : start.kind === 'photo'
          ? 'Read from a photo'
          : 'One empty section';
  // For the card only; the night that's saved is worked out when the menu is made.
  const shownNight = home ? homeNight(night, now) : null;
  const nightLine = shownNight && !('error' in shownNight) ? homeMenuLine(shownNight, now) : null;

  const submit = async () => {
    // From photos, the menu's printed title can name it.
    if (!name.trim() && start.kind !== 'photo') {
      setStep('name');
      return setError('Give the menu a name.');
    }
    const when = home ? homeNight(night, Date.now()) : null;
    if (when && 'error' in when) return setError(when.error);
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
      const id = await create.mutateAsync({ barId, layout, night: when ?? undefined });
      onClose();
      router.push(`/menus/${id}/edit`);
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
      <BackbarTheme scheme="light">
        <DraftCard name={name.trim() || (start.kind === 'photo' ? 'From the photo' : 'Your menu')} lines={[at > 0 ? startLabel : null, nightLine]} />
      </BackbarTheme>
      <StepTrack at={at} of={steps.length} />
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
            {copyable.map((m) => (
              <Choice
                key={m.id}
                label={`Copy ${m.name}`}
                detail={`${plural(m.itemIds.length, 'drink')}, same sections. Swap what’s changing.`}
                selected={start.kind === 'copy' && start.menuId === m.id}
                onPress={() => setStart({ kind: 'copy', menuId: m.id })}
              />
            ))}
            {layouts.map((l) => (
              <Choice
                key={l.id}
                label={l.name}
                detail={`A saved layout: ${l.sections.map((s) => s.name).join(', ') || 'no sections'}.`}
                selected={start.kind === 'layout' && start.layoutId === l.id}
                onPress={() => setStart({ kind: 'layout', layoutId: l.id })}
              />
            ))}
            <Choice label="From a photo" detail="Read a printed menu: its sections, drinks and prices." selected={start.kind === 'photo'} onPress={() => setStart({ kind: 'photo' })} />
            <Choice label="Blank" detail="One section. Add more as you go." selected={start.kind === 'blank'} onPress={() => setStart({ kind: 'blank' })} />
          </View>
          {start.kind === 'photo' ? <MenuPhotos photos={photos} onChange={setPhotos} onError={setError} /> : null}
        </>
      ) : null}

      {step === 'night' ? <HomeNightFields value={night} onChange={setNight} /> : null}
      {error ? <Body tone="accent">{error}</Body> : null}
    </MenuSheet>
  );
}

/** The menu being made, on paper: its name, then each answer as it comes. */
function DraftCard({ name, lines }: { name: string; lines: (string | null)[] }) {
  const ds = useDs();
  const shown = lines.filter((l): l is string => !!l);
  return (
    <View style={[styles.card, { backgroundColor: ds.c.paper }]}>
      <DsText variant="title" align="center" numberOfLines={2}>
        {name}
      </DsText>
      <View style={[styles.rule, { backgroundColor: ds.c.lineStrong }]} />
      {shown.length ? (
        shown.map((l) => (
          <Caption key={l} tone="muted" align="center">
            {l}
          </Caption>
        ))
      ) : (
        <Caption tone="muted" align="center">
          Fills in as you go
        </Caption>
      )}
    </View>
  );
}

/** "1 of 3" with a bar, like the add-drink wizard's. */
function StepTrack({ at, of }: { at: number; of: number }) {
  const ds = useDs();
  return (
    <View style={styles.track}>
      <View
        role="progressbar"
        accessibilityLabel="Progress"
        aria-valuemin={0}
        aria-valuemax={of}
        aria-valuenow={at + 1}
        style={[styles.bar, { backgroundColor: withAlpha(ds.c.ink, 0.15) }]}
      >
        <View style={[styles.fill, { backgroundColor: ds.c.ink, width: `${((at + 1) / of) * 100}%` }]} />
      </View>
      <Caption tone="muted" style={styles.mono}>{`${at + 1} of ${of}`}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  list: { gap: space.sm },
  footer: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  card: { borderRadius: radius.card, borderCurve: 'continuous', paddingVertical: space.lg, paddingHorizontal: space.lg, alignItems: 'center', gap: space.xs },
  rule: { width: 40, height: 1, marginVertical: space.xs },
  track: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bar: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.monoMedium },
});
