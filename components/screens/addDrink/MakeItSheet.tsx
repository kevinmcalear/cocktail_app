import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, PressableScale, useDs } from '@/components/ds';
import { GradeTag } from '@/components/techniques/bits';
import { TechniqueSheet } from '@/components/techniques/TechniqueSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { missingKit, type Technique } from '@/lib/techniques';
import { waysToMake } from '@/lib/techniques/makeIt';
import { useKit } from '@/store/useKitStore';

interface Props {
  /** The typed name ("Clarified grapefruit"); null when closed. */
  name: string | null;
  onClose: () => void;
  /** Adds it as a house prep made this way. */
  onChoose: (t: Technique) => void;
  /** Adds it as a plain new ingredient. */
  onPlain: () => void;
}

/** "Make it in house": the ways to make a prep the shelf doesn't have, each with its time and kit. */
export function MakeItSheet({ name, onClose, onChoose, onPlain }: Props) {
  const ds = useDs();
  const kit = useKit();
  const ways = name ? waysToMake(name) : [];
  return (
    <TechniqueSheet visible={!!name} onClose={onClose} eyebrow="New house prep" title={name ?? ''}>
      <Body tone="muted">Pick how you make it. It joins the spec as a house prep with the steps on its prep card.</Body>
      <View role="list">
        {ways.map((t) => {
          const missing = kit.size ? missingKit(t, kit) : [];
          const detail = [t.time, missing.length ? `Needs ${missing.join(', ')}` : null].filter(Boolean).join(' · ');
          return (
            <PressableScale key={t.id} role="button" accessibilityLabel={`Make it by ${t.name}. ${t.summary} ${detail}`} onPress={() => onChoose(t)} style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <View style={styles.flex}>
                <Headline>{t.name}</Headline>
                <Body tone="muted">{t.summary}</Body>
                <View style={styles.meta}>
                  <Caption tone={missing.length ? 'accent' : 'muted'}>{detail}</Caption>
                  <GradeTag grade={t.grade} />
                </View>
              </View>
              <IconSymbol name="plus" size={18} color={ds.c.ink} />
            </PressableScale>
          );
        })}
      </View>
      <Button label="Add it without a method" variant="ghost" onPress={onPlain} />
    </TechniqueSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingTop: space.xs },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
