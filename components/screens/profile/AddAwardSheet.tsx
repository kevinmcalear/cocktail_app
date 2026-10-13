import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, GlassButton, Segmented, Sheet, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { useAddAward, useProfilePositions } from '@/hooks/useProfiles';
import { awardDraftProblem } from '@/lib/awards';

/** The bodies most bartenders' awards come from, as profile_awards names them. */
const BODIES = [
  { label: 'Spirited Awards', award: 'Tales of the Cocktail Spirited Awards' },
  { label: 'CLASS', award: 'CLASS Bar Awards' },
  { label: 'James Beard', award: 'James Beard Awards' },
  { label: 'World’s 50 Best', award: "The World's 50 Best Bars" },
  { label: 'Asia’s 50 Best', award: "Asia's 50 Best Bars" },
  { label: 'North America’s 50 Best', award: "North America's 50 Best Bars" },
] as const;
const OTHER = 'other';
const RESULTS = [
  { value: 'won', label: 'Won' },
  { value: 'finalist', label: 'Finalist' },
] as const;

/**
 * Add an award (ppl-award-add): who gave it, the title as the award writes
 * it, the year, won or finalist, the bar you were at, and where it was
 * published. It goes to a moderator, and says Not confirmed yet until then.
 * ponytail: the bar is one of your own jobs; searching any bar can follow
 * when someone needs an award from a bar they never listed.
 */
export function AddAwardSheet({ visible, profileId, onClose }: { visible: boolean; profileId: string; onClose: () => void }) {
  const ds = useDs();
  const add = useAddAward();
  const jobs = (useProfilePositions({ id: profileId, kind: 'person' }).data ?? []).filter((p) => p.person_accepted);
  const bars = [...new Map(jobs.map((j) => [j.bar.id, j.bar])).values()];
  const [body, setBody] = useState<string>(BODIES[0].award);
  const [other, setOther] = useState('');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [finalist, setFinalist] = useState(false);
  const [barId, setBarId] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [tried, setTried] = useState(false);
  const award = body === OTHER ? other : body;
  const problem = awardDraftProblem({ award, title, year, source });

  const close = () => {
    add.reset();
    setTried(false);
    onClose();
  };
  const send = () => {
    setTried(true);
    if (problem) return;
    add.mutate({ profileId, award, title, year: Number(year), isFinalist: finalist, barProfileId: barId, sourceUrl: source }, { onSuccess: close });
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      accessibilityLabel="Add an award"
      style={styles.panel}
      keyboard
      header={
        <View style={styles.head}>
          <View style={styles.flex}>
            <Title role="heading">Add an award</Title>
            <Body tone="muted">One you won, or were a finalist for.</Body>
          </View>
          <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} />
        </View>
      }
    >
      <View style={styles.form}>
        <View style={styles.group}>
          <Caption tone="muted">Who gave it</Caption>
          <View role="radiogroup" accessibilityLabel="Who gave it" style={styles.wrap}>
            {BODIES.map((b) => (
              <Chip key={b.award} quiet label={b.label} selected={body === b.award} onPress={() => setBody(b.award)} />
            ))}
            <Chip quiet label="Other" selected={body === OTHER} onPress={() => setBody(OTHER)} />
          </View>
          {body === OTHER ? <Field label="Name of the award" value={other} onChangeText={setOther} placeholder="For example, Australian Bar Awards" maxLength={80} /> : null}
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} hint="As the award writes it." maxLength={80} />
        <View style={styles.pair}>
          <View style={styles.year}>
            <Field label="Year" value={year} onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} />
          </View>
          <View style={[styles.group, styles.flex]}>
            <Caption tone="muted">Result</Caption>
            <Segmented variant="ink" stretch choice onSurface accessibilityLabel="Result" options={RESULTS} value={finalist ? 'finalist' : 'won'} onChange={(v) => setFinalist(v === 'finalist')} />
          </View>
        </View>
        {bars.length ? (
          <View style={styles.group}>
            <Caption tone="muted">The bar you were at (optional)</Caption>
            <View role="radiogroup" accessibilityLabel="The bar you were at" style={styles.wrap}>
              <Chip quiet label="None" selected={!barId} onPress={() => setBarId(null)} />
              {bars.map((b) => (
                <Chip key={b.id} quiet label={b.display_name} selected={barId === b.id} onPress={() => setBarId(b.id)} />
              ))}
            </View>
            <Caption tone="muted">{barId ? `Shows as “at ${bars.find((b) => b.id === barId)?.display_name}”.` : 'Picks from your jobs.'}</Caption>
          </View>
        ) : null}
        <Field
          label="Source link (required)"
          value={source}
          onChangeText={setSource}
          placeholder="https://"
          hint="Where the winners or finalists were published: the award’s own page or a news story."
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          error={tried ? (problem ?? undefined) : undefined}
        />
        <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="clock" size={20} color={ds.c.muted} />
          <Body style={styles.flex}>We check it against the source before it shows on your page. Until then it says Not confirmed yet.</Body>
        </View>
        {add.error ? (
          <Caption tone="accent" role="alert">
            {add.error.message}
          </Caption>
        ) : null}
        <Button label="Send for checking" size="lg" onPress={send} disabled={add.isPending} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  panel: { maxWidth: 520, padding: space.xl, paddingTop: space.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingBottom: space.md },
  flex: { flex: 1, minWidth: 0 },
  form: { gap: space.lg, paddingBottom: space.lg },
  group: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md, alignItems: 'flex-end' },
  year: { width: 104 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
});
