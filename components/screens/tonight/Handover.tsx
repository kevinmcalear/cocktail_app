import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, GlassButton, Surface, Title, useDs, useToast, type IconName } from '@/components/ds';
import { useLogBatchNow } from '@/components/screens/prep/LogBatchButton';
import { SettingsRow } from '@/components/screens/settings/SettingsParts';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space } from '@/constants/tokens';
import type { HandoverWrite } from '@/hooks/barWrites';
import { useHandover, useSaveHandover } from '@/hooks/useHandover';
import { useSpecBook } from '@/hooks/useSpecBook';
import { names, ranOutLine, summary, type HandoverNote } from '@/lib/handover';
import { nextNight } from '@/lib/nightPhase';
import { recipeNames } from '@/lib/tonight';

import { HandoverSheet, HandoverView, HandoverWriteSheet } from './HandoverLazy';
import type { HandoverState } from './NightHandover';
import { TonightSection } from './TonightParts';

// The handover's parts on Tonight (Loop-handover). NightHandover.tsx holds the
// note and what's open; these render it, and on the web load only when there
// is something to show (HandoverPartsLazy.web.tsx).

type Handover = ReturnType<typeof useHandover>;
type Words = NonNullable<HandoverWrite['words']>;

const first = (h: Handover, note: HandoverNote) => names(note.writers.map((w) => h.nameOf(w.user_id).split(' ')[0]));
const weekday = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long' });

/** The note, for a part (the rows query is shared, so each part reading it costs nothing). */
const useNote = (s: HandoverState) => useHandover(s.barId, s.t.date);

/** Who a close's note is for: tonight's is for whoever opens tomorrow; the last close's was for whoever opens today. */
const nightOf = ({ t }: HandoverState, h: Handover, close: string) => (t.date ? (close === h.tonight ? nextNight(t.date) : weekday(t.date)) : 'the next shift');

/** A note card: an icon, a title and a line under it, and its button (the board's prompt). */
function Prompt({ icon, title, body, action, onPress }: { icon: IconName; title: string; body: string; action: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <View role="region" accessibilityLabel={title} style={[styles.prompt, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.promptHead}>
        <IconSymbol name={icon} size={20} color={ds.accentText} />
        <View style={styles.flex}>
          <DsText variant="label" style={font.semiBold}>
            {title}
          </DsText>
          {body ? <Caption tone="muted">{body}</Caption> : null}
        </View>
      </View>
      <View style={styles.promptActs}>
        <Button label={action} size="sm" onPress={onPress} />
      </View>
    </View>
  );
}

/** The last close's note, on top of Tonight until you've read it (Loop-handover). */
function HandoverCard({ s }: { s: HandoverState }) {
  const h = useNote(s);
  if (!h.last || !h.unread) return null;
  return <Prompt icon="bubble.left" title={`Handover from ${first(h, h.last)}`} body={summary(h.last)} action="Read it" onPress={() => s.setReading(true)} />;
}

/** Once read, and during service, the note sits at the end: "From Ana · Read by you and Theo". */
function HandoverSection({ s }: { s: HandoverState }) {
  const h = useNote(s);
  if (h.isError)
    return (
      <TonightSection title="Handover">
        <Surface style={styles.card}>
          <SettingsRow icon="exclamationmark.triangle" label="The handover didn’t load" detail="Try again" onPress={() => void h.refetch()} />
        </Surface>
      </TonightSection>
    );
  if (!h.last || h.unread) return null;
  return (
    <TonightSection title="Handover">
      <Surface style={styles.card}>
        <SettingsRow icon="bubble.left" label={`From ${first(h, h.last)}`} detail={h.readBy ?? 'Nobody else has read it yet'} onPress={() => s.setReading(true)} />
      </Surface>
    </TonightSection>
  );
}

/** After close: leave a note for whoever opens next ("Leave the handover"). */
function LeaveHandover({ s }: { s: HandoverState }) {
  const h = useNote(s);
  const tonight = h.tonight;
  if (!tonight) return null;
  const night = nightOf(s, h, tonight);
  const write = () => s.setWriting(tonight);
  const mine = h.tonightNote?.writers.some((w) => w.user_id === h.me);
  if (mine) return <Prompt icon="bubble.left" title="Handover left" body={`For whoever opens ${night}. It sits on top of Tonight until they’ve read it.`} action="Change it" onPress={write} />;
  return <Prompt icon="bubble.left" title="Leave the handover" body={`One note for whoever opens ${night}: what ran out, what to prep, anything broken.`} action="Write it" onPress={write} />;
}

/** The open note's props: Got it, Add to it, Log batch and what ran out against tonight's lists. */
function useView(s: HandoverState, h: Handover) {
  const { t, barId, wide } = s;
  const save = useSaveHandover(barId);
  const logNow = useLogBatchNow(barId);
  const logBatch = (name: string) => {
    const id = t.houseMadeIds.find((i) => t.lineName(i)?.toLowerCase() === name.trim().toLowerCase());
    return id ? logNow(id, name, t.batchOf(id)) : null;
  };
  const onGotIt = () => {
    if (h.last && h.me) save.mutate({ barId, closeDate: h.last.closeDate, userId: h.me, readAt: new Date().toISOString() });
    s.setReading(false);
  };
  const onAdd = () => {
    if (!h.last) return;
    s.setReading(false);
    if (Platform.OS === 'ios' && !wide) s.setNext(h.last.closeDate);
    else s.setWriting(h.last.closeDate);
  };
  // What ran out, against tonight's lists: "Last Word is off until it comes". The spec book is on the phone already.
  const book = useSpecBook(h.last ? barId : null).data;
  const onTonight = useMemo(() => {
    const ids = new Set(t.blocks.flatMap((b) => b.sections.flatMap((x) => x.drinks.map((d) => d.id))));
    return (book?.items ?? []).filter((i) => ids.has(i.id)).map((i) => ({ name: i.name, uses: recipeNames(i.recipes).flatMap((l) => (l.ingredient ? [l.ingredient] : [])) }));
  }, [book, t.blocks]);
  return { h, onGotIt, onAdd, logBatch, ranOutSub: (item: string) => ranOutLine(item, onTonight), forNight: h.last ? nightOf(s, h, h.last.closeDate) : undefined };
}

/** Wide web: the note open beside Tonight (Loop-tonight-desk). */
function HandoverPane({ s }: { s: HandoverState }) {
  const h = useNote(s);
  const view = useView(s, h);
  if (!h.last) return null;
  return (
    <View role="region" aria-label="Handover" style={styles.pane}>
      <View style={styles.head}>
        <Title role="heading" style={styles.flex}>
          Handover
        </Title>
        <GlassButton accessibilityLabel="Close" icon="xmark" onPress={() => s.setReading(false)} />
      </View>
      <HandoverView {...view} />
    </View>
  );
}

/** The note's sheet (phones) and the sheet for writing your part. */
function HandoverSheets({ s }: { s: HandoverState }) {
  const { barId, writing } = s;
  const h = useNote(s);
  const view = useView(s, h);
  const save = useSaveHandover(barId);
  const toast = useToast();
  // Saved here, not in the writing sheet: the sheet closes at once, and a failed send still needs somewhere to say so.
  const leaveWords = (closeDate: string, words: Words) => {
    if (!h.me) return;
    save.mutate({ barId, closeDate, userId: h.me, readAt: words.writtenAt, words }, { onError: (e) => toast.show({ title: 'The handover didn’t save', detail: e.message }) });
    toast.show({ title: `Handover left for ${nightOf(s, h, closeDate)}` });
  };
  return (
    <>
      <HandoverSheet
        visible={s.reading && !s.wide}
        onClose={() => s.setReading(false)}
        onDismiss={() => {
          if (s.next) s.setWriting(s.next);
          s.setNext(null);
        }}
        {...view}
      />
      {writing ? <HandoverWriteSheet h={h} barId={barId} closeDate={writing} night={nightOf(s, h, writing)} houseMade={s.t.houseMadeIds.flatMap((id) => s.t.lineName(id) ?? [])} onLeave={(words) => leaveWords(writing, words)} onClose={() => s.setWriting(null)} /> : null}
    </>
  );
}

const PARTS = { card: HandoverCard, section: HandoverSection, leave: LeaveHandover, pane: HandoverPane, sheets: HandoverSheets };
export type HandoverPartName = keyof typeof PARTS;

/** One part by name: what NightHandover places (through HandoverPartsLazy, which loads this file on the web). */
export function HandoverPart({ which, s }: { which: HandoverPartName; s: HandoverState }) {
  const Part = PARTS[which];
  return <Part s={s} />;
}

const styles = StyleSheet.create({
  prompt: { gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  promptHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  promptActs: { flexDirection: 'row', paddingLeft: space.xl + space.md },
  card: { paddingVertical: space.xs, paddingHorizontal: space.lg, overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0 },
  pane: { gap: space.lg, paddingTop: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
