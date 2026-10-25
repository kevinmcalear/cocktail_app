import * as Clipboard from 'expo-clipboard';
import { useRouter, type Href } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DrinkImage, DsText, IngredientThumb, PressableScale, Sheet, Tag, Title, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { BarItem } from '@/hooks/useHomeBar';
import { itemHref } from '@/lib/itemRoutes';
import { plural } from '@/lib/menus';
import type { ShoppingRow } from '@/lib/shoppingList';

/**
 * Share the list (shopping B4): the text they get, sent as a message or
 * copied. Shopping together is drawn as Later.
 */
export function ShareShoppingSheet({ text, visible, onClose }: { text: string; visible: boolean; onClose: () => void }) {
  const ds = useDs();
  const send = async () => {
    try {
      await Share.share({ message: text });
    } catch {
      // No share sheet (a desktop browser): copying does the same job.
      await Clipboard.setStringAsync(text);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Share the list">
      <View style={styles.body}>
        <Title>Share the list</Title>
        <View style={[styles.preview, { backgroundColor: ds.c.raised }]}>
          <Caption tone="muted">What they get</Caption>
          <Body selectable>{text}</Body>
        </View>
        <Button label="Send as a message" icon="square.and.arrow.up" onPress={() => void send()} />
        <Button label="Copy as text" variant="secondary" onPress={() => void Clipboard.setStringAsync(text).then(onClose)} />
        <View style={[styles.later, { borderTopColor: ds.c.line }]}>
          <View style={styles.grow}>
            <View style={styles.laterHead}>
              <DsText variant="body">Shop together</DsText>
              <Tag label="Later" tone="outline" />
            </View>
            <Caption tone="muted">Someone you live with sees the list and ticks things off. What they tick lands on your shelf.</Caption>
          </View>
          <Button label="Invite" size="sm" variant="secondary" disabled onPress={() => {}} />
        </View>
      </View>
    </Sheet>
  );
}

/**
 * Back from the shop (shopping B3): everything ticked, it's on your shelf,
 * and the drinks it made ready. Make one opens the first.
 */
export function ShoppingDoneSheet({ got, ready, visible, onClose }: { got: ShoppingRow[]; ready: BarItem[]; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const low = got.filter((r) => r.source === 'running_low').map((r) => r.name);
  const open = (d: BarItem) => {
    onClose();
    router.push(itemHref('Cocktail', d.id) as Href);
  };
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="On your shelf">
      <View style={styles.body}>
        <View style={styles.head}>
          <Title>On your shelf</Title>
          <Body tone="muted">
            {`You got ${plural(got.length, 'thing')}. They’re on My Bar now${low.length ? `, and ${low.join(' and ')} ${low.length === 1 ? 'isn’t' : 'aren’t'} running low any more` : ''}.`}
          </Body>
        </View>
        <View style={styles.thumbs} aria-hidden>
          {got.slice(0, 4).map((r) => (
            <IngredientThumb key={r.id} id={r.itemId} name={r.name} size={64} />
          ))}
        </View>
        {ready.length ? (
          <View>
            <DsText variant="body" role="heading">{`Ready now · ${ready.length} new`}</DsText>
            {ready.slice(0, 3).map((d) => (
              <PressableScale key={d.id} role="link" accessibilityLabel={d.name} onPress={() => open(d)} style={styles.drink}>
                <View style={styles.drinkThumb}>
                  <DrinkImage thumb source={d.imageUrl} glass={d.glass} itemId={d.id} accessibilityLabel={d.name} radius="control" />
                </View>
                <DsText variant="headline" numberOfLines={1} style={styles.grow}>
                  {d.name}
                </DsText>
              </PressableScale>
            ))}
          </View>
        ) : null}
        <View style={styles.buttons}>
          {ready.length ? <Button label="Make one" onPress={() => open(ready[0])} style={styles.grow} /> : null}
          <Button
            label="Back to My Bar"
            variant="secondary"
            onPress={() => {
              onClose();
              router.navigate('/bar' as Href);
            }}
            style={styles.grow}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, padding: space.xl, paddingTop: space.md, paddingBottom: space.xxl },
  head: { gap: space.xs },
  preview: { gap: space.sm, padding: space.lg, borderRadius: radius.control },
  later: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  laterHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1, minWidth: 0 },
  thumbs: { flexDirection: 'row', gap: space.sm },
  drink: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60 },
  drinkThumb: { width: 44 },
  buttons: { flexDirection: 'row', gap: space.sm },
});
