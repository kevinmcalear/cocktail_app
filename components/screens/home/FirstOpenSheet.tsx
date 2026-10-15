import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, GlassButton, Headline, useDs } from '@/components/ds';
import { BarMark } from '@/components/screens/home/BarMark';
import { GOOGLE_IMPORT_TITLE, GoogleImportBody, GoogleImportEntry, GoogleImportFooter, useGoogleImport } from '@/components/screens/home/GoogleImport';
import { placeOf } from '@/components/screens/rankings/RankingLists';
import { useAgeGate } from '@/components/screens/safety/AgeGate';
import { MenuSheet } from '@/components/screens/menus/MenuSheet';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useTopBars } from '@/hooks/useDiscover';
import { useHiddenBars, useHideBar } from '@/hooks/useHiddenBars';
import { useLoveBar, useLovedBars } from '@/hooks/useKept';
import { useMode } from '@/hooks/useMode';
import { areaLabel, type Area, type DiscoverRow } from '@/lib/nearMe';
import { useFirstOpen } from '@/store/useFirstOpen';

type Pick = 'love' | 'hide';
const FIRST = 8;
const MORE = 12;
/** Fewer bars than this near you and there is nothing worth asking about. */
const AT_LEAST = 3;
/**
 * iOS drops a modal presented while another is still closing, which is how
 * people often arrive (Home bar, picked in the venue sheet, then Discover).
 * ponytail: a short settle after mount; present on the sheet's onDismiss if
 * it ever proves too short.
 */
const SETTLE_MS = 700;

const plural = (n: number, word: string) => `${n} ${word}`;

/**
 * Discover's first open (disc-first-open, jam 13 Oct: "are any of these your
 * favourites? Any you don't want to see?"). Once per person on a device, at
 * home, signed in, before they've loved or hidden any bar: the top bars in
 * their area, each with a heart and a hide. Done saves the picks; Skip asks
 * nothing again.
 */
export function FirstOpenSheet({ area }: { area: Area }) {
  const userId = useUserId();
  const home = useMode().mode === 'home';
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(t);
  }, []);
  // Who has been asked is read from storage: wait for it, or someone who answered sees it flash.
  const [hydrated, setHydrated] = useState(() => useFirstOpen.persist.hasHydrated());
  useEffect(() => useFirstOpen.persist.onFinishHydration(() => setHydrated(true)), []);
  const asked = useFirstOpen((s) => (userId ? s.asked.includes(userId) : true));
  const loved = useLovedBars().data;
  const hidden = useHiddenBars().data;
  const fresh = !!userId && home && !asked && loved?.length === 0 && hidden?.length === 0;
  const { data } = useTopBars(area, fresh);
  const rows = data ? [...data.ranked, ...data.early] : [];
  if (!fresh || !settled || !hydrated || rows.length < AT_LEAST) return null;
  return <Ask userId={userId} rows={rows} where={areaLabel(area)} />;
}

function Ask({ userId, rows, where }: { userId: string; rows: DiscoverRow[]; where: string }) {
  const markAsked = useFirstOpen((s) => s.markAsked);
  const [picks, setPicks] = useState<Record<string, Pick | undefined>>({});
  const [shown, setShown] = useState(FIRST);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const love = useLoveBar();
  const hide = useHideBar();
  const age = useAgeGate();
  const toggle = (id: string, pick: Pick) => setPicks((p) => ({ ...p, [id]: p[id] === pick ? undefined : pick }));
  const chosen = Object.entries(picks).filter(([, p]) => p);
  const loves = chosen.filter(([, p]) => p === 'love').length;
  const hides = chosen.length - loves;
  const close = () => markAsked(userId);
  const [google, setGoogle] = useState(false);
  const g = useGoogleImport(close);
  const save = async () => {
    setSaving(true);
    setFailed(false);
    const results = await Promise.allSettled(chosen.map(([profileId, p]) => (p === 'love' ? love.mutateAsync({ profileId, love: true }) : hide.mutateAsync({ profileId, hide: true }))));
    // Keep what didn't save on screen to try again; ask nothing more once all of it has.
    const left = chosen.filter((_, i) => results[i].status === 'rejected');
    setSaving(false);
    if (!left.length) return close();
    setPicks(Object.fromEntries(left));
    setFailed(true);
  };
  // Loving needs a confirmed age, like the hearts everywhere else; hiding doesn't.
  const done = () => (loves ? age.gate(() => void save()) : void save());
  const summary = chosen.length ? [loves ? plural(loves, 'loved') : null, hides ? plural(hides, 'hidden') : null].filter(Boolean).join(' · ') : 'Nothing picked yet';

  // One sheet whose contents change, so nothing opens over a closing sheet on iOS.
  const footer = google ? (
    <GoogleImportFooter g={g} onCancel={() => setGoogle(false)} />
  ) : (
    <View style={styles.footer}>
      <Caption tone={failed ? 'accent' : 'muted'} role={failed ? 'alert' : undefined}>
        {failed ? `Couldn’t save ${summary}. Check your connection and try again.` : summary}
      </Caption>
      <View style={styles.actions}>
        <Button label="Skip for now" variant="secondary" onPress={close} />
        <Button label={saving ? 'Saving…' : 'Done'} disabled={saving || !chosen.length} onPress={done} />
      </View>
    </View>
  );
  return (
    <>
      <MenuSheet
        visible
        onClose={close}
        eyebrow={google ? 'From Google Maps' : 'Make Discover yours'}
        title={google ? GOOGLE_IMPORT_TITLE : where === 'anywhere' ? 'Any favourites?' : `Any favourites ${where}?`}
        footer={footer}
      >
        {google ? (
          <GoogleImportBody g={g} />
        ) : (
          <>
            <Body tone="muted">Love the bars you go to and they lead Discover. Hide any you never want to see. You can change either later.</Body>
            <View style={styles.google}>
              <GoogleImportEntry onPress={() => setGoogle(true)} />
            </View>
            <Caption tone="muted" style={styles.lead}>
              {`Top bars ${where}, best first`}
            </Caption>
            <View role="list" aria-label="Bars near you">
              {rows.slice(0, shown).map((r) => (
                <BarRow key={r.venue_profile_id} row={r} pick={picks[r.venue_profile_id]} onPick={(p) => toggle(r.venue_profile_id, p)} />
              ))}
            </View>
            {rows.length > shown ? <Button label={`Show ${Math.min(MORE, rows.length - shown)} more`} variant="ghost" onPress={() => setShown((n) => n + MORE)} style={styles.more} /> : null}
          </>
        )}
      </MenuSheet>
      {age.sheet}
      {g.ageSheet}
    </>
  );
}

function BarRow({ row, pick, onPick }: { row: DiscoverRow; pick: Pick | undefined; onPick: (p: Pick) => void }) {
  const ds = useDs();
  const name = row.display_name;
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <View style={[styles.bar, pick === 'hide' && styles.dim]}>
        <BarMark logoUrl={row.avatar_url} name={name} profileId={row.venue_profile_id} size={40} />
        <View style={styles.flex}>
          <Headline numberOfLines={1}>{name}</Headline>
          <Caption tone="muted" numberOfLines={1}>
            {pick === 'hide' ? 'Hidden from Discover' : placeOf(row)}
          </Caption>
        </View>
      </View>
      <GlassButton accessibilityLabel={pick === 'love' ? `You love ${name}: undo` : `Love ${name}`} icon={pick === 'love' ? 'heart.fill' : 'heart'} color={pick === 'love' ? ds.accentText : undefined} onPress={() => onPick('love')} />
      <GlassButton accessibilityLabel={pick === 'hide' ? `${name} is hidden: undo` : `Hide ${name} from Discover`} icon={pick === 'hide' ? 'eye' : 'eye.slash'} onPress={() => onPick('hide')} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  lead: { marginTop: space.md },
  google: { marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 64, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  bar: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  dim: { opacity: 0.45 },
  more: { alignSelf: 'flex-start' },
});
