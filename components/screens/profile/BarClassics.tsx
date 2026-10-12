import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale } from '@/components/ds';
import { space } from '@/constants/tokens';
import { usePublicClassics, type PublicClassic } from '@/hooks/useStaffList';
import { patronGroups } from '@/lib/staffList';

/**
 * On a bar's public page: the classics they can make off the menu, with the
 * ones they'd pour first called out. A failed load looks like no list.
 */
export function BarClassics({ barId }: { barId: string | null }) {
  const classics = usePublicClassics(barId);
  // Under Originals the list starts at its top ten, with the rest a tap away (ppl-bar-originals).
  const [all, setAll] = useState(false);
  if (!barId || classics.isLoading || classics.error || !classics.data?.length) return null;
  const groups = patronGroups(classics.data);
  const first = groups.top10.length ? groups.top10 : groups.top50.length ? groups.top50 : groups.also;
  const more = classics.data.length - first.length;
  if (!all && more > 0) {
    return (
      <View style={styles.block}>
        <Group title={groups.top10.length ? 'Classics they pour · Top 10' : 'Classics they pour'} hint="The classic spec, with their bottles" rows={first} />
        <Button label={`All ${classics.data.length} classics`} variant="secondary" onPress={() => setAll(true)} style={styles.start} />
      </View>
    );
  }
  return (
    <View style={styles.block}>
      <Group title="Top 10" hint="The ones to ask for first" rows={groups.top10} />
      <Group title={groups.top10.length ? 'The rest of the top 50' : 'Top 50'} hint="More they do well" rows={groups.top50} />
      <Group title="We also make" hint="Other classics, if you ask" rows={groups.also} />
    </View>
  );
}

function Group({ title, hint, rows }: { title: string; hint: string; rows: PublicClassic[] }) {
  const router = useRouter();
  if (!rows.length) return null;
  return (
    <View style={styles.group}>
      <Headline role="heading">{title}</Headline>
      <Caption tone="muted">{hint}</Caption>
      <View role="list">
        {rows.map((row) => {
          const label = row.classicName ? `${row.name}, a ${row.classicName}` : row.name;
          const text = (
            <>
              <Body>{row.name}</Body>
              {row.classicName ? <Caption tone="muted">{row.classicName}</Caption> : null}
            </>
          );
          return row.openId ? (
            <PressableScale
              key={row.name + String(row.rank)}
              role="link"
              accessibilityLabel={label}
              onPress={() => router.push(`/d/${row.openId}` as Href)}
              style={styles.row}
            >
              {text}
            </PressableScale>
          ) : (
            <View key={row.name + String(row.rank)} style={styles.row}>
              {text}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xl },
  group: { gap: space.sm },
  row: { gap: space.xs, paddingVertical: space.xs },
  start: { alignSelf: 'flex-start' },
});
