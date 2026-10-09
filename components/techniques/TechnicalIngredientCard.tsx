import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, Spec, Surface, Tag, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { technicalIngredientFor, techniqueById } from '@/lib/techniques';

import { BuyList, GradeTag } from './bits';

/**
 * On a technical ingredient's page (xanthan, agar, lecithin...): what it does,
 * how much for each job, how to mix it in, and the techniques that use it.
 * Nothing shows for an ordinary ingredient.
 */
export function TechnicalIngredientCard({ name }: { name: string }) {
  const ds = useDs();
  const router = useRouter();
  const t = technicalIngredientFor(name);
  if (!t) return null;
  const facts = [t.vegan ? 'Vegan' : 'Not vegan', t.alcohol, ...(t.allergens ?? [])].filter((f): f is string => !!f);

  return (
    <Surface style={styles.card}>
      <Caption tone="muted" role="heading" style={styles.eyebrow}>
        HOW TO USE IT
      </Caption>
      <Body>{t.what}</Body>
      <View style={styles.tags}>
        {facts.map((f) => (
          <Tag key={f} label={f} />
        ))}
      </View>
      <View role="list">
        {t.jobs.map((j) => (
          <View key={j.job} role="listitem" style={[styles.job, { borderBottomColor: ds.c.line }]}>
            <Body style={styles.flex}>{j.job}</Body>
            <Spec>{j.dose}</Spec>
            <GradeTag grade={j.grade} />
          </View>
        ))}
      </View>
      <View style={styles.block}>
        <Headline>Mix it in</Headline>
        <Body>{t.mix}</Body>
        {t.perTsp ? <Caption tone="muted">{`No fine scale? A level 5 ml teaspoon is roughly ${t.perTsp} g.`}</Caption> : null}
      </View>
      {t.watch?.map((w) => (
        <Caption key={w} tone="muted">
          {w}
        </Caption>
      ))}
      {t.buy?.length ? (
        <View style={styles.block}>
          <Headline>Where to buy</Headline>
          <BuyList links={t.buy} />
        </View>
      ) : null}
      <View style={styles.tags}>
        {t.techniques.map((id) => {
          const tech = techniqueById(id);
          return tech ? (
            <PressableScale key={id} role="link" accessibilityLabel={`How to: ${tech.name}`} onPress={() => router.push(`/techniques/${id}` as never)} style={[styles.link, { backgroundColor: ds.c.raised }]}>
              <Body>{tech.name}</Body>
            </PressableScale>
          ) : null;
        })}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  eyebrow: { letterSpacing: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  job: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  block: { gap: space.xs },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill },
  flex: { flex: 1, minWidth: 160 },
});
