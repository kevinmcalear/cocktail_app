import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { radius, space } from '@/constants/tokens';

/**
 * A person in a list (People, Find people): their picture, name and one line,
 * and at the end Follow, Follow back or Following, or a chevron when the row
 * just opens them. `selected` marks the person open beside the list on the web.
 */
export function PersonRow({ name, avatarUrl, sub, end, onPress, selected, first }: { name: string; avatarUrl: string | null; sub: string | null; end?: ReactNode; onPress?: () => void; selected?: boolean; first?: boolean }) {
  const ds = useDs();
  const body = (
    <>
      <UserAvatar uri={avatarUrl} name={name} size={40} />
      <View style={styles.flex}>
        <Body numberOfLines={1}>{name}</Body>
        {sub ? (
          <Caption tone="muted" numberOfLines={1}>
            {sub}
          </Caption>
        ) : null}
      </View>
    </>
  );
  return (
    <View role="listitem" style={[styles.row, { borderTopColor: first ? 'transparent' : ds.c.line }, selected ? [styles.selected, { backgroundColor: ds.c.raised }] : null]}>
      {onPress ? (
        <PressableScale role="link" accessibilityLabel={[name, sub].filter(Boolean).join('. ')} aria-current={selected ? 'page' : undefined} onPress={onPress} style={styles.main}>
          {body}
          {end ? null : <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />}
        </PressableScale>
      ) : (
        <View style={styles.main}>{body}</View>
      )}
      {end}
    </View>
  );
}

/** Nobody here yet: what following does, and Find people (Kept-people, nobody yet). */
export function PeopleEmpty({ title, text, onFind }: { title: string; text: string; onFind: () => void }) {
  const ds = useDs();
  return (
    <View style={styles.empty}>
      <IconSymbol name="person.badge.plus" size={96} color={ds.c.muted} />
      <Title align="center">{title}</Title>
      <Body tone="muted" align="center">
        {text}
      </Body>
      <Button label="Find people" icon="magnifyingglass" variant="ink" size="lg" onPress={onFind} style={styles.stretch} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minWidth: 0 },
  selected: { borderRadius: radius.card, paddingHorizontal: space.sm, marginHorizontal: -space.sm, borderTopColor: 'transparent' },
  flex: { flex: 1, minWidth: 0 },
  empty: { alignItems: 'center', gap: space.md, paddingTop: space.xl },
  stretch: { alignSelf: 'stretch', marginTop: space.md },
});
