import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, PalateFlower, Surface, Title, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, palateHues, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useMyTaste, useSaveTasteAnswers } from '@/hooks/useFlavor';
import { blendTaste, COLD_START_DRINKS, rankingsDrift, tasteHeadline, tasteSource, type Taste } from '@/lib/flavor';
import { palateByMonth, shapedBy } from '@/lib/palate';

import { PalateLegend } from './PalateParts';
import { OverTime, SaidAnswers, ShapedBy } from './TasteSections';

const same = (a: Taste, b: Taste) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const MAX_WIDTH = 640;

/**
 * Your taste (palate), as the palate flower: what it is now, what shaped it,
 * how it has moved, and what you said, which you can change. The flower moves
 * as you change an answer, blended with your rankings the way For you and
 * match scores use it. Design: lib/palate.ts.
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
  const { width } = useWindowDimensions();
  const { user, loading } = useAuth();
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
  // Once rankings move you, what you said shows as a dashed line beside your palate.
  const showSaid = !!me && me.rankedDrinks > 0 && hasAnswers;
  const flower = Math.min(width, MAX_WIDTH) - gutter * 2;

  const body = !me ? (
    <Body tone="muted">
      {!user && !loading ? 'Sign in to see your taste.' : error ? 'Couldn’t load your taste. Check your connection and try again.' : 'Loading your taste…'}
    </Body>
  ) : (
    <>
      <View style={styles.section}>
        <Title role="heading">{headline ? `${headline}.` : 'Nothing stands out yet.'}</Title>
        <View style={styles.center}>
          <PalateFlower values={preview} said={showSaid ? answers : null} size={Math.min(flower, 420)} labels />
        </View>
        <PalateLegend items={showSaid ? ['palate', 'said'] : ['palate']} />
        <Caption tone="muted">{tasteSource(me.rankedDrinks, hasAnswers)}</Caption>
        {drift ? (
          <Surface style={styles.drift}>
            <View style={[styles.dot, { backgroundColor: palateHues[ds.scheme].fire }]} />
            <Body style={styles.flex}>{drift}</Body>
          </Surface>
        ) : null}
        {toGo > 0 ? (
          <View style={styles.section}>
            <Caption tone="muted">{`Rank ${toGo} more drink${toGo === 1 ? '' : 's'} you've had to see match scores on drinks.`}</Caption>
            <Button label="Find a drink" icon="magnifyingglass" variant="secondary" onPress={() => router.navigate('/search')} style={styles.start} />
          </View>
        ) : null}
      </View>

      <ShapedBy shapers={shapedBy(me.entries, me.baseline)} />
      <OverTime months={palateByMonth(me.entries, me.baseline, me.answers)} />

      <View style={styles.section}>
        <SaidAnswers
          value={answers}
          onChange={(next) => {
            setDraft(next);
            setSaved(false);
          }}
        />
        {save.error ? <Caption tone="accent">{`Couldn't save: ${save.error.message}`}</Caption> : null}
        {dirty || save.isPending ? (
          <Button
            label={save.isPending ? 'Saving…' : 'Save'}
            disabled={save.isPending}
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
        ) : null}
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
          <Caption tone="muted" style={styles.kicker}>
            YOUR TASTE
          </Caption>
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
  body: { gap: space.xxl, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  section: { gap: space.md },
  center: { alignItems: 'center', paddingVertical: space.sm },
  kicker: { letterSpacing: 1.4, marginBottom: -space.lg },
  drift: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: radius.pill, marginTop: 7 },
  flex: { flex: 1 },
  controls: { position: 'absolute' },
  start: { alignSelf: 'flex-start' },
});
