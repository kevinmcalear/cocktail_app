import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Headline, PressableScale, RowScore, Tag, scoreWords, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';

interface ShowRowProps {
  /** The picture: a drink thumb, a bar's logo. */
  lead: ReactNode;
  title: string;
  detail?: string | null;
  score?: number | null;
  /** Off your profile: greyed out, with Only you. */
  hidden: boolean;
  /** The eye. Without it the row has no switch (you have no public profile yet). */
  onToggle?: () => void;
  onPress?: () => void;
  /** Extra marks under the detail: Finalist, Not confirmed yet. */
  children?: ReactNode;
}

/**
 * A row on You, which is its own preview (ppl-you): the picture, name, where,
 * score, and an eye to show or hide it on your profile. A hidden row greys to
 * half and says Only you; it still counts in your rankings.
 */
export function ShowRow({ lead, title, detail, score, hidden, onToggle, onPress, children }: ShowRowProps) {
  const ds = useDs();
  const said = [title, detail, scoreWords(score), hidden ? 'only you' : null].filter(Boolean).join('. ');
  return (
    <View role="listitem" style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <PressableScale role={onPress ? 'link' : undefined} accessibilityLabel={said} onPress={onPress} disabled={!onPress} style={[styles.main, hidden && styles.hidden]}>
        <View style={styles.lead}>{lead}</View>
        <View style={styles.text}>
          <Headline numberOfLines={1}>{title}</Headline>
          {detail ? (
            <Caption tone="muted" numberOfLines={1}>
              {detail}
            </Caption>
          ) : null}
          {children}
        </View>
        {hidden ? <Tag label="Only you" /> : null}
        <RowScore score={score} />
      </PressableScale>
      {onToggle ? (
        <PressableScale
          role="button"
          accessibilityLabel={hidden ? `Show ${title} on your profile` : `Hide ${title} from your profile`}
          aria-pressed={!hidden}
          onPress={onToggle}
          style={styles.eye}
        >
          <IconSymbol name={hidden ? 'eye.slash' : 'eye'} size={20} color={hidden ? ds.c.muted : ds.c.ink} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  hidden: { opacity: 0.5 },
  lead: { width: 52 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  eye: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
