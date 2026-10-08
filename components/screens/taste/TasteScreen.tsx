import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, Headline, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useAuthIdentity } from '@/ctx/AuthContext';
import { useMyTaste, useSaveTasteAnswers } from '@/hooks/useFlavor';
import { blendTaste, COLD_START_DRINKS, QUESTIONS, rankingsDrift, tasteHeadline, tasteSource, type Taste } from '@/lib/flavor';

import { FlavorBars } from './FlavorBars';
import { TasteAnswers } from './TasteAnswers';

const same = (a: Taste, b: Taste) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

/**
 * Your taste (palate): what it is now, where it comes from, and your answers,
 * which you can change. The bars move as you change an answer, blended with
 * your rankings the way For you and match scores use it (blendTaste).
 */
export function TasteScreen() {
  return (
    <BackbarTheme>
      <TastePage />
    </BackbarTheme>
  );
}

function TastePage() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const { userId, loading } = useAuthIdentity();
  const { data: me, error } = useMyTaste();
  const save = useSaveTasteAnswers();
  const [draft, setDraft] = useState<Taste | null>(null);
  const [saved, setSaved] = useState(false);

  const answers = draft ?? me?.answers ?? {};
  const dirty = !!me && draft !== null && !same(draft, me.answers ?? {});
  const hasAnswers = Object.keys(answers).length > 0;
  const preview = me ? blendTaste(me.rankedTaste, me.rankedDrinks, answers).taste : {};
  const headline = tasteHeadline(preview);
  const toGo = me ? COLD_START_DRINKS - me.rankedDrinks : 0;
  const drift = me && !dirty ? rankingsDrift(me.rankedTaste, me.answers) : null;

  const body = !me ? (
    <Body tone="muted">
      {!userId && !loading ? 'Sign in to see your taste.' : error ? 'Couldn’t load your taste. Check your connection and try again.' : 'Loading your taste…'}
    </Body>
  ) : (
    <>
      <View style={styles.section}>
        <Headline>{headline ?? 'Nothing stands out yet.'}</Headline>
        <Caption tone="muted">{tasteSource(me.rankedDrinks, hasAnswers)}</Caption>
        <FlavorBars values={preview} />
        {drift ? <Body>{drift}</Body> : null}
        {toGo > 0 ? (
          <View style={styles.section}>
            <Caption tone="muted">{`Rank ${toGo} more drink${toGo === 1 ? '' : 's'} you've had to see match scores on drinks.`}</Caption>
            <Button label="Find a drink" icon="magnifyingglass" variant="secondary" onPress={() => router.navigate('/search')} style={styles.start} />
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Headline role="heading">What you like</Headline>
        <Caption tone="muted">Change an answer and your taste moves with it. Tap an answer again to leave that one to your rankings.</Caption>
        <TasteAnswers
          questions={QUESTIONS}
          value={answers}
          onChange={(next) => {
            setDraft(next);
            setSaved(false);
          }}
        />
        {save.error ? <Caption tone="accent">{`Couldn't save: ${save.error.message}`}</Caption> : null}
        <Button
          label={save.isPending ? 'Saving…' : 'Save'}
          disabled={!dirty || save.isPending}
          onPress={() =>
            save.mutate(answers, {
              onSuccess: () => {
                setDraft(null);
                setSaved(true);
              },
              onError: () => {},
            })
          }
          style={styles.start}
        />
        {saved ? <Caption tone="muted">Saved. For you and match scores use it now.</Caption> : null}
      </View>
    </>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Your taste</title>
      </WebHead>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}>
        <View style={styles.body}>
          <Title role="heading">Your taste</Title>
          {body}
        </View>
      </ScrollView>
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { gap: space.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  section: { gap: space.sm },
  controls: { position: 'absolute' },
  start: { alignSelf: 'flex-start' },
});
