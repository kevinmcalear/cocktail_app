import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, DrinkImage, Field, PressableScale, TextLink, useDs } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { DrinkList } from '@/hooks/useDiscover';
import { useCreateMenu } from '@/hooks/useMenuMutations';
import { useVenuePage } from '@/hooks/useVenueSetup';
import { useAddClassics, useBarClassics, useTopClassics } from '@/hooks/useWhatNext';
import { blankSection } from '@/lib/menuLayout';
import { isSouthern, menuNameIdeas } from '@/lib/menus';
import { CLASSIC_COUNT, classicsToAdd } from '@/lib/whatNext';

import { StepFooter } from './GlassesStep';

const FIRST = 6;

/** One classic, ticked to add; one the bar already has shows a fixed tick and says so. */
function ClassicRow({ classic, ticked, have, onToggle }: { classic: DrinkList; ticked: boolean; have: boolean; onToggle: () => void }) {
  const ds = useDs();
  const on = ticked || have;
  return (
    <PressableScale
      role="checkbox"
      aria-checked={on}
      aria-disabled={have}
      disabled={have}
      accessibilityLabel={have ? `${classic.name}, already in your Library` : classic.name}
      onPress={onToggle}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <DrinkImage itemId={classic.id} accessibilityLabel={classic.name} radius="control" thumb sketchDetail="thumb" style={styles.drawing} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{classic.name}</Body>
        {have ? <Caption tone="muted">In your Library</Caption> : null}
      </View>
      <View style={[styles.box, on ? { backgroundColor: have ? ds.c.lineStrong : ds.accentFill.fill } : { borderColor: ds.c.lineStrong, borderWidth: 2 }]}>
        {on ? <IconSymbol name="checkmark" size={14} color={have ? ds.c.ink : ds.accentFill.text} /> : null}
      </View>
    </PressableScale>
  );
}

type Way = 'own' | 'bring' | 'classics';

/** One way to start, as a choice: its title, the line under it, and what opens under it when picked. */
function WayCard({ title, line, on, onPress, children }: { title: string; line: string; on: boolean; onPress: () => void; children?: ReactNode }) {
  const ds = useDs();
  return (
    <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: on ? ds.accentText : ds.c.lineStrong }]}>
      <PressableScale role="radio" aria-checked={on} accessibilityLabel={`${title}. ${line}`} onPress={onPress} style={styles.way}>
        <View style={styles.flex}>
          <Body style={styles.strong}>{title}</Body>
          <Caption tone="muted">{line}</Caption>
        </View>
        <View style={[styles.dot, { borderColor: on ? ds.accentText : ds.c.lineStrong }]}>{on ? <View style={[styles.dotOn, { backgroundColor: ds.accentText }]} /> : null}</View>
      </PressableScale>
      {on ? children : null}
    </View>
  );
}

/**
 * Step 3, your first menu (owner setup step 9): start our own (a named,
 * empty draft that opens in the builder), bring in what's on now (Bring in),
 * or start from the 20 most ranked classics as the bar's own copies, each
 * one untickable. A classic the bar already has is shown as in, and never
 * added twice.
 */
export function MenuStep({
  barId,
  step,
  onBack,
  onDone,
  onSkip,
  onBringIn,
  onMade,
}: {
  barId: string;
  step: string;
  onBack: () => void;
  onDone: () => void;
  onSkip: () => void;
  onBringIn: () => void;
  /** Our own menu was made: open it. */
  onMade: (menuId: string) => void;
}) {
  const chrome = useSetupChrome();
  const [way, setWay] = useState<Way>('own');
  const { classics, isLoading, error } = useTopClassics();
  const library = useBarClassics(barId, classics);
  const have = new Set(library.data ?? []);
  const add = useAddClassics(barId);
  const create = useCreateMenu();
  const page = useVenuePage(barId).data;
  const ideas = menuNameIdeas({ at: new Date(), southern: isSouthern(page?.latitude, page?.timezone) });
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [all, setAll] = useState(false);
  const adding = classicsToAdd(classics, unticked, have);
  const toggle = (id: string) =>
    setUnticked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const makeOwn = () => {
    if (!name.trim()) return setNameError('Give the menu a name.');
    setNameError(null);
    create.mutate({ barId, layout: { name: name.trim(), coverUrl: null, coverPosition: 50, sections: [blankSection()] } }, { onSuccess: onMade });
  };
  const label =
    way === 'own'
      ? create.isPending
        ? 'Starting…'
        : 'Start our own menu'
      : way === 'bring'
        ? 'Bring in a menu'
        : add.isPending
          ? `Adding… ${add.done} of ${add.variables?.length ?? 0}`
          : adding.length
            ? `Add ${adding.length === 1 ? 'one classic' : `${adding.length} classics`}`
            : 'Next';
  const go = () => {
    if (way === 'own') return makeOwn();
    if (way === 'bring') return onBringIn();
    if (adding.length) add.mutate(adding, { onSuccess: onDone });
    else onDone();
  };

  return (
    <SetupChromeProvider value={{ ...chrome, title: 'Your first menu', intro: 'How do you want to start?', mark: undefined, eyebrow: null, progress: null, topLabel: step, noBack: false, onBack }}>
      <SetupPage footer={<StepFooter skip="Skip" onSkip={onSkip} label={label} disabled={create.isPending || add.isPending || (way === 'classics' && (isLoading || library.isFetching))} onPress={go} />}>
        <View role="radiogroup" aria-label="How to start your first menu" style={styles.ways}>
          <WayCard title="Start our own menu" line="Name it, then add your drinks. Nothing to bring in." on={way === 'own'} onPress={() => setWay('own')}>
            <Field label="Name" value={name} onChangeText={(t) => (setName(t), setNameError(null))} placeholder={ideas[0]} error={nameError ?? undefined} onSubmitEditing={makeOwn} returnKeyType="go" />
            <View role="group" aria-label="Name ideas" style={styles.wrap}>
              {ideas.map((idea) => (
                <Chip key={idea} label={idea} selected={name === idea} onPress={() => (setName(idea), setNameError(null))} />
              ))}
            </View>
          </WayCard>
          <WayCard title="Bring in a menu" line="A photo, a PDF or a link. We read it, you check it." on={way === 'bring'} onPress={() => setWay('bring')} />
          <WayCard title="Start from classics" line={`The ${CLASSIC_COUNT} most ranked, your own copies, ready to change.`} on={way === 'classics'} onPress={() => setWay('classics')}>
            <Caption tone="muted">Untick any you don’t make.</Caption>
            {isLoading ? <Caption tone="muted">Loading…</Caption> : null}
            {error ? <Caption tone="muted">Couldn’t load the classics. Check your connection and try again.</Caption> : null}
            <View>
              {(all ? classics : classics.slice(0, FIRST)).map((c) => (
                <ClassicRow key={c.id} classic={c} have={have.has(c.id)} ticked={!unticked.has(c.id)} onToggle={() => toggle(c.id)} />
              ))}
            </View>
            {classics.length > FIRST ? <TextLink label={all ? 'Show fewer' : `See all ${classics.length}`} onPress={() => setAll((a) => !a)} /> : null}
          </WayCard>
        </View>
        {create.error ? (
          <Caption tone="accent" role="alert">
            Couldn’t start the menu. Check your connection and try again.
          </Caption>
        ) : null}
        {add.error ? (
          <Caption tone="accent" role="alert">
            {add.done ? `${add.done} added. The rest didn’t go in: check your connection and try again.` : 'Couldn’t add the classics. Check your connection and try again.'}
          </Caption>
        ) : null}
      </SetupPage>
    </SetupChromeProvider>
  );
}

const styles = StyleSheet.create({
  ways: { gap: space.sm },
  card: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  way: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  dot: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotOn: { width: 10, height: 10, borderRadius: radius.pill },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  drawing: { width: 40, height: 40 },
  flex: { flex: 1, minWidth: 0 },
  box: { width: 24, height: 24, borderRadius: radius.mark, alignItems: 'center', justifyContent: 'center' },
});
