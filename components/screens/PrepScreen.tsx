import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Display, Headline, Surface, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { space } from '@/constants/tokens';

const COMING = [
  { title: 'Start today', body: 'House-made ingredients with long lead times, like a milk punch that needs a day to drip, with when to start them.' },
  { title: 'On the day', body: 'Syrups, juices and batches for tonight’s menu or an event, scaled to the covers you expect.' },
  { title: 'To order', body: 'Everything the bar buys rather than makes, tied to the drinks that need it.' },
];

/**
 * Prep: the prep list worked back from the menu and events. The data behind it
 * (yields, shelf life, lead times, par levels) arrives with step 4, so this
 * says what's coming rather than showing an empty list.
 */
export function PrepScreen() {
  const ds = useDs();
  const gutter = useGutter();
  return (
    <ScrollView style={{ backgroundColor: ds.c.ground }} contentContainerStyle={{ paddingBottom: space.xxxl }}>
      <ScreenHeader />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <Display>Prep</Display>
        <Body tone="muted">Your prep list is on its way. Here’s what it will hold.</Body>
        {COMING.map((c) => (
          <Surface key={c.title} style={styles.card}>
            <Headline>{c.title}</Headline>
            <Body tone="muted">{c.body}</Body>
          </Surface>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, maxWidth: 760 },
  card: { gap: space.xs },
});
