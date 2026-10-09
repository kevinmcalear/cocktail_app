import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { GradeTag } from '@/components/techniques/bits';
import { layout, radius, space } from '@/constants/tokens';
import { useKit } from '@/hooks/useKit';
import { guessKind, PREP_KINDS, type PrepDraft, type PrepKindId } from '@/lib/prepKinds';
import { missingKit } from '@/lib/techniques';
import { waysToMake } from '@/lib/techniques/makeIt';

interface PrepKindStepProps {
  name: string;
  draft: PrepDraft;
  onKind: (kind: PrepKindId, hot?: boolean) => void;
  onTechnique: (id: string) => void;
}

/**
 * New prep, first step: what kind it is (each with its ratio), the one its
 * name suggests marked, and for a shrub, cold or hot. A name a library
 * technique makes ("Clarified grapefruit") lists those ways too.
 */
export function PrepKindStep({ name, draft, onKind, onTechnique }: PrepKindStepProps) {
  const ds = useDs();
  const { kit } = useKit();
  const columns = useBreakpoint() === 'phone' ? 2 : 3;
  const guess = guessKind(name);
  const ways = waysToMake(name);
  const picked = draft.technique ? null : draft.kind;

  return (
    <View style={styles.stack}>
      <View role="radiogroup" accessibilityLabel="Kind of prep" style={styles.grid}>
        {PREP_KINDS.map((k) => {
          const on = k.id === picked;
          return (
            <PressableScale
              key={k.id}
              role="radio"
              aria-checked={on}
              accessibilityLabel={`${k.name}, ${k.ratio}${k.id === guess ? ', from the name' : ''}`}
              onPress={() => onKind(k.id)}
              style={[styles.kind, { width: `${100 / columns - 2}%`, backgroundColor: ds.c.surface, borderColor: on ? ds.accentText : 'transparent' }]}
            >
              <View style={styles.row}>
                <Body>{k.name}</Body>
                {k.id === guess ? <Caption tone="accent">from the name</Caption> : null}
              </View>
              <Caption tone="muted">{k.ratio}</Caption>
            </PressableScale>
          );
        })}
      </View>

      {picked === 'shrub' ? (
        <View style={styles.stack}>
          <Caption tone="muted">How?</Caption>
          <View role="radiogroup" accessibilityLabel="Cold or hot" style={styles.row}>
            {[
              { hot: false, label: 'Cold', sub: '3 days · brighter fruit' },
              { hot: true, label: 'Hot', sub: 'An hour · jammier' },
            ].map((o) => {
              const on = !!draft.hot === o.hot;
              return (
                <PressableScale
                  key={o.label}
                  role="radio"
                  aria-checked={on}
                  accessibilityLabel={`${o.label}, ${o.sub}`}
                  onPress={() => onKind('shrub', o.hot)}
                  style={[styles.kind, styles.flex, { backgroundColor: ds.c.surface, borderColor: on ? ds.accentText : 'transparent' }]}
                >
                  <Body>{o.label}</Body>
                  <Caption tone="muted">{o.sub}</Caption>
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}

      {ways.length ? (
        <View style={styles.stack}>
          <Caption tone="muted">Or one of the techniques that makes it</Caption>
          <View role="radiogroup" accessibilityLabel="Technique">
            {ways.map((t) => {
              const missing = kit.size ? missingKit(t, kit) : [];
              const on = draft.technique === t.id;
              return (
                <PressableScale
                  key={t.id}
                  role="radio"
                  aria-checked={on}
                  accessibilityLabel={`${t.name}. ${t.summary} ${t.time}`}
                  onPress={() => onTechnique(t.id)}
                  style={[styles.way, { borderBottomColor: ds.c.line, backgroundColor: on ? ds.c.raised : 'transparent' }]}
                >
                  <View style={styles.flex}>
                    <Body>{t.name}</Body>
                    <Caption tone={missing.length ? 'accent' : 'muted'}>{[t.time, missing.length ? `Needs ${missing.join(', ')}` : null].filter(Boolean).join(' · ')}</Caption>
                  </View>
                  <GradeTag grade={t.grade} />
                </PressableScale>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  kind: { minHeight: layout.minTapTarget + space.lg, borderRadius: radius.control, borderWidth: 2, paddingHorizontal: space.md, paddingVertical: space.sm, justifyContent: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
  way: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.md, paddingHorizontal: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
