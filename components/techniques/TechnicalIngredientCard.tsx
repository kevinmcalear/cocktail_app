import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, PressableScale, Spec, Surface, Tag, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { doseLine } from '@/lib/doseLine';
import { technicalIngredientFor, techniqueById } from '@/lib/techniques';

import { BuyList, GradeTag } from './bits';

/**
 * On a technical ingredient's page (xanthan, agar, lecithin...): what it does,
 * how much for each job worked out for a litre, how to mix it in, and the
 * techniques that use it. It sits straight under the title; Where to buy is
 * its own section after it. Nothing shows for an ordinary ingredient.
 */
export function TechnicalIngredientCard({ name }: { name: string }) {
  const ds = useDs();
  const router = useRouter();
  const t = technicalIngredientFor(name);
  if (!t) return null;
  const facts = [t.vegan ? 'Vegan' : 'Not vegan', t.alcohol, ...(t.allergens ?? [])].filter((f): f is string => !!f);
  const perLitre = doseLine(t.jobs.map((j) => j.dose));

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
      <Headline>How much, by job</Headline>
      <View role="list">
        {t.jobs.map((j) => (
          // The dose and its grade inline at the right; the job wraps (prep-ing-xanthan).
          <View key={j.job} role="listitem" style={[styles.job, { borderBottomColor: ds.c.line }]}>
            <Body style={styles.flex}>{j.job}</Body>
            <View style={styles.dose}>
              <Spec>{j.dose}</Spec>
              <GradeTag grade={j.grade} />
            </View>
          </View>
        ))}
      </View>
      {perLitre || t.perTsp ? <Caption tone="muted">{[perLitre, t.perTsp ? `No fine scale? A level 5 ml teaspoon is roughly ${t.perTsp} g.` : null].filter(Boolean).join(' ')}</Caption> : null}
      <View style={styles.block}>
        <Headline>Mix it in</Headline>
        <Body>{t.mix}</Body>
      </View>
      {t.watch?.map((w) => (
        <Caption key={w} tone="muted">
          {w}
        </Caption>
      ))}
      <View style={styles.tags}>
        {t.techniques.map((id) => {
          const tech = techniqueById(id);
          return tech ? (
            <PressableScale key={id} role="link" accessibilityLabel={`How to: ${tech.name}`} onPress={() => router.push(`/techniques/${id}` as never)} style={[styles.link, { backgroundColor: ds.c.raised }]}>
              <Body numberOfLines={1} style={styles.chip}>{tech.name}</Body>
            </PressableScale>
          ) : null;
        })}
      </View>
    </Surface>
  );
}

/** Where to buy a technical ingredient: its own section, after How to use it. */
export function WhereToBuy({ name }: { name: string }) {
  const t = technicalIngredientFor(name);
  if (!t?.buy?.length) return null;
  return (
    <View style={styles.block}>
      <Headline role="heading">Where to buy</Headline>
      <BuyList links={t.buy} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  job: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  dose: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: space.xs, maxWidth: '62%' },
  chip: { fontFamily: fontFamilies.bodyMedium },
  block: { gap: space.xs },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.control, maxWidth: '100%' },
  flex: { flex: 1, minWidth: 0 },
});
