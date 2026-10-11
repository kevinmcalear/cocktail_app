import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, DsText, Field, GlassButton, Headline, Sheet } from '@/components/ds';
import { space } from '@/constants/tokens';
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

/**
 * Add an award (ppl-award-add): who gave it, the title as the award writes
 * it, the year, won or finalist, the bar you were at, and where it was
 * published. It goes to a moderator, and says Not confirmed yet until then.
 * ponytail: the bar is one of your own jobs; searching any bar can follow
 * when someone needs an award from a bar they never listed.
 */
export function AddAwardSheet({ visible, profileId, onClose }: { visible: boolean; profileId: string; onClose: () => void }) {
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
      keyboard
      header={
        <View style={styles.head}>
          <View style={styles.flex}>
            <Headline role="heading">Add an award</Headline>
            <Caption tone="muted">One you won, or were a finalist for.</Caption>
          </View>
          <GlassButton accessibilityLabel="Close" icon="xmark" onPress={close} />
        </View>
      }
    >
      <View style={styles.form}>
        <View style={styles.group}>
          <DsText variant="headline">Who gave it</DsText>
          <View role="radiogroup" accessibilityLabel="Who gave it" style={styles.wrap}>
            {BODIES.map((b) => (
              <Chip key={b.award} label={b.label} selected={body === b.award} onPress={() => setBody(b.award)} />
            ))}
            <Chip label="Other" selected={body === OTHER} onPress={() => setBody(OTHER)} />
          </View>
          {body === OTHER ? <Field label="Name of the award" value={other} onChangeText={setOther} placeholder="For example, Australian Bar Awards" maxLength={80} /> : null}
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} hint="As the award writes it." maxLength={80} />
        <View style={styles.pair}>
          <View style={styles.year}>
            <Field label="Year" value={year} onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" maxLength={4} />
          </View>
          <View style={[styles.group, styles.flex]}>
            <DsText variant="headline">Result</DsText>
            <View role="radiogroup" accessibilityLabel="Result" style={styles.wrap}>
              <Chip label="Won" selected={!finalist} onPress={() => setFinalist(false)} />
              <Chip label="Finalist" selected={finalist} onPress={() => setFinalist(true)} />
            </View>
          </View>
        </View>
        {bars.length ? (
          <View style={styles.group}>
            <DsText variant="headline">The bar you were at (optional)</DsText>
            <View role="radiogroup" accessibilityLabel="The bar you were at" style={styles.wrap}>
              <Chip label="None" selected={!barId} onPress={() => setBarId(null)} />
              {bars.map((b) => (
                <Chip key={b.id} label={b.display_name} selected={barId === b.id} onPress={() => setBarId(b.id)} />
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
        <Body tone="muted">We check it against the source before it shows on your page. Until then it says Not confirmed yet.</Body>
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
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  form: { gap: space.lg, paddingBottom: space.lg },
  group: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  year: { width: 96 },
});
