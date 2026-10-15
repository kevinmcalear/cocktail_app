import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { useAgeGate } from '@/components/screens/safety/AgeGate';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useMatchSavedPlaces, type ImportBar } from '@/hooks/useGoogleImport';
import { useHiddenBars } from '@/hooks/useHiddenBars';
import { useLoveBar, useLovedBars } from '@/hooks/useKept';
import { readTakeout, type PlaceMatch } from '@/lib/googleTakeout';
import { canPickFiles, pickTakeoutFile, TOO_BIG } from '@/lib/pickTakeoutFile';
import { toastDone } from '@/lib/toast';

export const GOOGLE_IMPORT_TITLE = 'Your Google Maps places';

const bars = (n: number) => `${n} ${n === 1 ? 'bar' : 'bars'}`;

/**
 * Bring the bars someone saved on Google Maps (disc-google-import): they
 * download their places from Google Takeout, pick Saved Places.json or a
 * saved list's .csv, and we read it here on the device, match it to our bars
 * and love the ones they tick. Nothing from the file is kept or sent.
 * The state and actions; GoogleImportBody and GoogleImportFooter draw them,
 * inside whichever sheet asked (Discover's first open, Collection's Bars).
 */
export function useGoogleImport(onDone: () => void) {
  const match = useMatchSavedPlaces();
  const love = useLoveBar();
  const age = useAgeGate();
  const lovedIds = new Set((useLovedBars().data ?? []).map((b) => b.id));
  // A bar they hid stays hidden: it isn't offered (#659, a bar is loved or hidden, not both).
  const hiddenIds = new Set((useHiddenBars().data ?? []).map((b) => b.id));
  const [picking, setPicking] = useState(false);
  const [total, setTotal] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const found = (match.data?.matches ?? []).filter((m) => !hiddenIds.has(m.bar.id));
  const rows = found.filter((m) => !lovedIds.has(m.bar.id));
  const chosen = rows.filter((m) => ticked[m.bar.id]).map((m) => m.bar.id);

  const choose = async () => {
    if (picking) return;
    setProblem(null);
    love.reset();
    let picked: Awaited<ReturnType<typeof pickTakeoutFile>>;
    setPicking(true);
    try {
      picked = await pickTakeoutFile();
    } catch (e) {
      setProblem(e instanceof Error && e.message === TOO_BIG ? TOO_BIG : 'Couldn’t open that file. Try again.');
      return;
    } finally {
      setPicking(false);
    }
    if (!picked) return;
    const read = readTakeout(picked.text);
    match.reset();
    if (!read.ok) return setProblem(read.reason);
    setTotal(read.places.length);
    match.mutate(read.places, { onSuccess: (r) => setTicked(Object.fromEntries(r.matches.map((m) => [m.bar.id, m.sure]))) });
  };

  // mutateAsync, not mutate's callbacks: loving the first bars can unmount whoever opened this (Discover's first open).
  const save = () =>
    age.gate(() =>
      love
        .mutateAsync({ profileId: chosen, love: true })
        .then(() => {
          toastDone(`Loved ${bars(chosen.length)}`);
          onDone();
        })
        .catch(() => {}),
    );

  const toggle = (id: string) => setTicked((t) => ({ ...t, [id]: !t[id] }));
  const already = found.length - rows.length;
  return { choose, save, toggle, rows, ticked, chosen, total, already, problem, matching: match.isPending || picking, looking: match.isPending, matched: match.data?.count, failed: match.isError, saving: love.isPending, saveFailed: love.isError, ageSheet: age.sheet };
}

type GoogleImport = ReturnType<typeof useGoogleImport>;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const ds = useDs();
  return (
    <View role="listitem" style={styles.step}>
      <View aria-hidden style={[styles.num, { backgroundColor: ds.c.raised }]}>
        <DsText variant="spec">{n}</DsText>
      </View>
      <View style={styles.flex}>
        <Headline>{title}</Headline>
        {children}
      </View>
    </View>
  );
}

export function GoogleImportBody({ g }: { g: GoogleImport }) {
  const ds = useDs();
  const status = g.looking
    ? 'Looking for bars we know…'
    : g.failed
      ? 'Couldn’t check the file against our bars. Check your connection and pick it again.'
      : g.matched != null
        ? [`${g.matched} of ${g.total} places ${g.matched === 1 ? 'is a bar' : 'are bars'} we know`, g.already ? `${g.already} you already love` : null].filter(Boolean).join(' · ')
        : null;
  return (
    <>
      <Body tone="muted">Bring the bars you’ve saved on Google Maps. Google lets you download them; we read the file on this device and keep only the bars you pick.</Body>
      <View role="list" style={styles.steps}>
        <Step n={1} title="Download your places">
          <Caption tone="muted">
            {'At '}
            <DsText variant="caption" tone="accent" role="link" onPress={() => void Linking.openURL('https://takeout.google.com/')}>
              takeout.google.com
            </DsText>
            {' pick Maps (your places) and Saved. Google emails a zip.'}
          </Caption>
        </Step>
        <Step n={2} title="Pick the file">
          <Caption tone="muted">Open the zip, then pick Saved Places.json (in Maps (your places)) or a saved list’s .csv (in Saved). Nothing else in the zip is read.</Caption>
        </Step>
      </View>
      {canPickFiles ? (
        <PressableScale role="button" accessibilityLabel="Choose the file" onPress={() => void g.choose()} disabled={g.matching} style={[styles.drop, { borderColor: ds.c.lineStrong }]}>
          <IconSymbol name="square.and.arrow.up" size={18} color={ds.c.ink} />
          <DsText variant="body">{g.matched != null ? 'Choose another file' : 'Choose the file'}</DsText>
        </PressableScale>
      ) : (
        <Caption tone="muted">Update the app from the App Store to pick a file.</Caption>
      )}
      {g.problem ? (
        <Caption tone="accent" role="alert">
          {g.problem}
        </Caption>
      ) : null}
      {status ? (
        <Caption tone={g.failed ? 'accent' : 'muted'} role={g.failed ? 'alert' : undefined}>
          {status}
        </Caption>
      ) : null}
      {g.rows.length ? (
        <View role="group" aria-label="Bars to love">
          {g.rows.map((m) => (
            <MatchRow key={m.bar.id} match={m} on={!!g.ticked[m.bar.id]} onPress={() => g.toggle(m.bar.id)} />
          ))}
        </View>
      ) : null}
    </>
  );
}

function MatchRow({ match, on, onPress }: { match: PlaceMatch<ImportBar>; on: boolean; onPress: () => void }) {
  const ds = useDs();
  const { bar, savedAs } = match;
  const place = [bar.locality, bar.city].filter(Boolean).join(', ');
  const detail = [place, savedAs !== bar.display_name ? `saved as “${savedAs}”` : null].filter(Boolean).join(' · ');
  return (
    <PressableScale role="checkbox" aria-checked={on} accessibilityLabel={`Love ${bar.display_name}${detail ? `. ${detail}` : ''}`} onPress={onPress} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View aria-hidden style={[styles.box, { borderColor: on ? ds.accentText : ds.c.lineStrong, backgroundColor: on ? ds.accentText : 'transparent' }]}>
        {on ? <IconSymbol name="checkmark" size={14} color={ds.c.ground} /> : null}
      </View>
      <BarMark logoUrl={bar.avatar_url} name={bar.display_name} profileId={bar.id} size={36} />
      <View style={styles.flex}>
        <Headline numberOfLines={1}>{bar.display_name}</Headline>
        {detail ? (
          <Caption tone="muted" numberOfLines={1}>
            {detail}
          </Caption>
        ) : null}
      </View>
    </PressableScale>
  );
}

export function GoogleImportFooter({ g, onCancel }: { g: GoogleImport; onCancel: () => void }) {
  return (
    <View style={styles.footer}>
      {g.saveFailed ? (
        <Caption tone="accent" role="alert">
          Couldn’t save your bars. Check your connection and try again.
        </Caption>
      ) : null}
      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
        <Button label={g.saving ? 'Saving…' : `Love ${bars(g.chosen.length)}`} disabled={g.saving || !g.chosen.length} onPress={g.save} />
      </View>
    </View>
  );
}

/** The import in a sheet of its own, from Collection's Bars. */
export function GoogleImportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return visible ? <OpenImport onClose={onClose} /> : null;
}

function OpenImport({ onClose }: { onClose: () => void }) {
  const g = useGoogleImport(onClose);
  return (
    <>
      <MenuSheet visible onClose={onClose} eyebrow="From Google Maps" title={GOOGLE_IMPORT_TITLE} footer={<GoogleImportFooter g={g} onCancel={onClose} />}>
        <GoogleImportBody g={g} />
      </MenuSheet>
      {g.ageSheet}
    </>
  );
}

/** The way in: Discover's first open and Collection's Bars. */
export function GoogleImportEntry({ onPress }: { onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel="From Google Maps. Love the bars you saved there" onPress={onPress} style={[styles.entry, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <IconSymbol name="mappin.and.ellipse" size={20} color={ds.c.ink} />
      <View style={styles.flex}>
        <Headline>From Google Maps</Headline>
        <Caption tone="muted">Love the bars you saved there</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  steps: { gap: space.md, marginVertical: space.md },
  step: { flexDirection: 'row', gap: space.md },
  num: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  drop: { minHeight: 88, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  box: { width: 22, height: 22, borderRadius: radius.mark, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: space.sm },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
});
