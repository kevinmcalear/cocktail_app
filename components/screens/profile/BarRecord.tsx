import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Tag, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useMenuEditions, useProfileAccolades } from '@/hooks/useProfiles';
import { groupAccolades, menuDate, type MenuEdition } from '@/lib/accolades';

const FIRST_MENUS = 6;

/**
 * A bar's accolades, one row per award: its placings as year chips
 * ("2025 · No. 1") and named awards as lines under them. Nothing when it has none.
 */
export function Accolades({ profileId }: { profileId: string }) {
  const ds = useDs();
  const { data = [] } = useProfileAccolades(profileId);
  const groups = groupAccolades(data);
  if (!groups.length) return null;
  return (
    <View style={styles.section}>
      <Caption tone="muted" style={styles.cap}>
        Accolades
      </Caption>
      <View role="list">
        {groups.map((g) => {
          const placings = g.entries.filter((e) => e.label.startsWith('No. '));
          const awards = g.entries.filter((e) => !e.label.startsWith('No. '));
          const summary = g.entries.map((e) => `${e.year} ${e.label}`).join(', ');
          return (
            <View key={g.award} role="listitem" accessible accessibilityLabel={`${g.award}: ${summary}`} style={[styles.award, { borderBottomColor: ds.c.line }]}>
              <View style={styles.awardHead}>
                <DsText variant="headline" style={styles.flex}>
                  {g.award}
                </DsText>
                {g.best !== null ? <Caption tone="muted">{`Best: No. ${g.best}`}</Caption> : null}
              </View>
              {placings.length ? (
                <View style={styles.chips}>
                  {placings.map((e) => (
                    <Tag key={e.key} label={`${e.year} · ${e.label}`} tone={e.label === 'No. 1' ? 'accent' : 'default'} />
                  ))}
                </View>
              ) : null}
              {awards.map((e) => (
                <Caption key={e.key}>{`${e.year} · ${e.label}`}</Caption>
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Every cocktail menu the bar has put out, newest first, with the month and year it launched. */
export function MenuHistory({ profileId, name }: { profileId: string; name: string }) {
  const { data = [], isLoading } = useMenuEditions(profileId);
  const [all, setAll] = useState(false);
  if (isLoading) return <Caption tone="muted">Loading menus…</Caption>;
  if (!data.length) return <Body tone="muted">{`No menus from ${name} here yet.`}</Body>;
  const shown = all ? data : data.slice(0, FIRST_MENUS);
  return (
    <View style={styles.section}>
      <View role="list">
        {shown.map((m, i) => (
          <EditionRow key={m.id} edition={m} current={i === 0} />
        ))}
      </View>
      {data.length > FIRST_MENUS && !all ? (
        <Button label={`Show all ${data.length} menus`} variant="secondary" onPress={() => setAll(true)} />
      ) : null}
    </View>
  );
}

function EditionRow({ edition: m, current }: { edition: MenuEdition; current: boolean }) {
  const ds = useDs();
  const when = menuDate(m);
  const source = m.source_url;
  return (
    <View role="listitem" style={[styles.edition, { borderBottomColor: ds.c.line }]}>
      <View accessible accessibilityLabel={[`${m.name}, ${current ? 'latest menu, ' : ''}from ${when}`, m.theme, m.drinks.length ? `Drinks: ${m.drinks.join(', ')}` : null].filter(Boolean).join('. ')} style={styles.editionText}>
        <View style={styles.awardHead}>
          <DsText variant="headline" style={styles.flex}>
            {m.name}
          </DsText>
          <Caption tone={current ? 'ink' : 'muted'}>{when}</Caption>
        </View>
        {m.theme ? <Body tone="muted">{m.theme}</Body> : null}
        {m.drinks.length ? <Caption tone="muted">{m.drinks.join(' · ')}</Caption> : null}
      </View>
      {source ? (
        <DsText variant="caption" tone="muted" role="link" accessibilityLabel={`Source for ${m.name}`} style={styles.link} onPress={() => Linking.openURL(source)}>
          {`Source: ${source.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0]}`}
        </DsText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.sm },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  award: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  awardHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  edition: { gap: space.xs, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  editionText: { gap: space.xs },
  link: { textDecorationLine: 'underline', alignSelf: 'flex-start' },
});
