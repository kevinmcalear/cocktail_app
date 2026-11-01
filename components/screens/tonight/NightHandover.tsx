import { useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { GlassButton, Title, useToast } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { HandoverWrite } from '@/hooks/barWrites';
import { useHandover, useSaveHandover } from '@/hooks/useHandover';
import { useSpecBook } from '@/hooks/useSpecBook';
import { ranOutLine } from '@/lib/handover';
import { nextNight } from '@/lib/nightPhase';
import { recipeNames } from '@/lib/tonight';

import { useLogNow } from './BeforeDoors';
import { HandoverCard, HandoverSection, LeaveHandover } from './Handover';
import { HandoverSheet, HandoverView, HandoverWriteSheet } from './HandoverLazy';
import type { useStaffTonight } from './useStaffTonight';

type Staff = ReturnType<typeof useStaffTonight>;
type Words = NonNullable<HandoverWrite['words']>;

export interface NightHandover {
  /** On top of Tonight until read. */
  card: ReactNode;
  /** At the end once read, and during service. */
  section: ReactNode;
  /** After close, leading: Leave the handover. */
  leave: ReactNode;
  /** Wide web: the note beside Tonight while it's open (Loop-tonight-desk), else null. */
  pane: ReactNode;
  /** The sheets: the note (phones), and writing your part. */
  sheets: ReactNode;
}

const weekday = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long' });

/**
 * Tonight's handover (Loop-handover): the note from the last close on top
 * until read, Got it, Add to it, and Leave the handover after close. On
 * phones the note opens in a sheet; wide, beside Tonight (Loop-tonight-desk).
 */
export function useNightHandover(t: Staff, barId: string, wide: boolean): NightHandover {
  const h = useHandover(barId, t.date);
  const save = useSaveHandover(barId);
  const toast = useToast();
  const logNow = useLogNow(t, barId);
  const [reading, setReading] = useState(false);
  const [writing, setWriting] = useState<string | null>(null);
  // iOS shows one sheet at a time: the writing sheet waits for the note's to go.
  const [next, setNext] = useState<string | null>(null);

  const logBatch = (name: string) => {
    const id = t.houseMadeId(name);
    return id ? logNow(id, name) : null;
  };
  // Tonight's close is for whoever opens tomorrow; the last close's was for whoever opens today.
  const night = (close: string) => (t.date ? (close === h.tonight ? nextNight(t.date) : weekday(t.date)) : 'the next shift');
  // Saved here, not in the writing sheet: the sheet closes at once, and a failed send still needs somewhere to say so.
  const leaveWords = (closeDate: string, words: Words) => {
    if (!h.me) return;
    save.mutate({ barId, closeDate, userId: h.me, readAt: words.writtenAt, words }, { onError: (e) => toast.show({ title: 'The handover didn’t save', detail: e.message }) });
    toast.show({ title: `Handover left for ${night(closeDate)}` });
  };
  const gotIt = () => {
    if (h.last && h.me) save.mutate({ barId, closeDate: h.last.closeDate, userId: h.me, readAt: new Date().toISOString() });
    setReading(false);
  };
  const add = () => {
    if (!h.last) return;
    setReading(false);
    if (Platform.OS === 'ios' && !wide) setNext(h.last.closeDate);
    else setWriting(h.last.closeDate);
  };
  // What ran out, against tonight's lists: "Last Word is off until it comes". The spec book is on the phone already.
  const book = useSpecBook(h.last ? barId : null).data;
  const onTonight = useMemo(() => {
    const ids = new Set(t.blocks.flatMap((b) => b.sections.flatMap((s) => s.drinks.map((d) => d.id))));
    return (book?.items ?? []).filter((i) => ids.has(i.id)).map((i) => ({ name: i.name, uses: recipeNames(i.recipes).flatMap((l) => (l.ingredient ? [l.ingredient] : [])) }));
  }, [book, t.blocks]);
  const view = { h, onGotIt: gotIt, onAdd: add, logBatch, ranOutSub: (item: string) => ranOutLine(item, onTonight), forNight: h.last ? night(h.last.closeDate) : undefined };

  return {
    // Wide, the note open beside Tonight replaces its card.
    card: wide && reading ? null : <HandoverCard h={h} onRead={() => setReading(true)} />,
    section: <HandoverSection h={h} onOpen={() => setReading(true)} />,
    // Not while loading: the sheet starts from what you left, so it waits for it.
    leave: h.tonight && !h.isLoading ? <LeaveHandover h={h} night={night(h.tonight)} onWrite={() => setWriting(h.tonight)} /> : null,
    pane:
      wide && reading && h.last ? (
        <View role="region" aria-label="Handover" style={styles.pane}>
          <View style={styles.head}>
            <Title role="heading" style={styles.flex}>
              Handover
            </Title>
            <GlassButton accessibilityLabel="Close" icon="xmark" onPress={() => setReading(false)} />
          </View>
          <HandoverView {...view} />
        </View>
      ) : null,
    sheets: (
      <>
        <HandoverSheet
          visible={reading && !wide}
          onClose={() => setReading(false)}
          onDismiss={() => {
            if (next) setWriting(next);
            setNext(null);
          }}
          {...view}
        />
        {writing ? <HandoverWriteSheet h={h} barId={barId} closeDate={writing} night={night(writing)} houseMade={t.houseMadeNames} onLeave={(words) => leaveWords(writing, words)} onClose={() => setWriting(null)} /> : null}
      </>
    ),
  };
}

const styles = StyleSheet.create({
  pane: { gap: space.lg, paddingTop: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
