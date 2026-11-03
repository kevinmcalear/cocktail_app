import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, radius, space, STATUS } from '@/constants/tokens';
import { readableAccent, withAlpha } from '@/lib/color';

export interface PromptAction {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

interface PromptProps {
  title: string;
  body?: string;
  icon?: IconName;
  /** Amber, for a gap in the spec ("Sour with nothing sweet"). */
  warn?: boolean;
  /** The first is the tinted one, the rest plain. */
  actions?: readonly PromptAction[];
  /** "+ Simple syrup": one tap adds it. */
  chips?: readonly PromptAction[];
  /** An X that puts it away for this draft. */
  onDismiss?: () => void;
  children?: ReactNode;
}

/**
 * A helper on the draft page (Kept-add-helpers): what the wizard used to ask
 * on its own screen, said once where the gap is. Icon, a line, a reason,
 * then one-tap answers. Any of them can be put away.
 */
export function Prompt({ title, body, icon = 'sparkles', warn, actions = [], chips = [], onDismiss, children }: PromptProps) {
  const ds = useDs();
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  const ink = warn ? amber : ds.accentText;
  return (
    <View role="note" aria-label={title} style={[styles.card, warn ? { backgroundColor: withAlpha(STATUS.warning, 0.16) } : { backgroundColor: ds.c.surface, borderColor: ds.c.line, borderWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.head}>
        <IconSymbol name={icon} size={20} color={ink} />
        <View style={styles.words}>
          <Body style={styles.title}>{title}</Body>
          {body ? <Caption tone="muted">{body}</Caption> : null}
        </View>
        {onDismiss ? (
          <PressableScale role="button" accessibilityLabel="Not now" onPress={onDismiss} hitSlop={8} style={[styles.x, { backgroundColor: ds.c.raised }]}>
            <IconSymbol name="xmark" size={12} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>
      {chips.length ? (
        <View role="group" aria-label={title} style={styles.row}>
          {chips.map((c) => (
            <PressableScale key={c.label} role="button" accessibilityLabel={c.accessibilityLabel ?? `Add ${c.label}`} onPress={c.onPress} style={[styles.chip, { borderColor: ds.c.lineStrong, backgroundColor: ds.c.ground }]}>
              <IconSymbol name="plus" size={14} color={ds.accentText} />
              <DsText variant="label" style={{ ...font.medium }}>
                {c.label}
              </DsText>
            </PressableScale>
          ))}
        </View>
      ) : null}
      {actions.length ? (
        <View style={styles.row}>
          {actions.map((a, i) => (
            <PressableScale
              key={a.label}
              role="button"
              accessibilityLabel={a.accessibilityLabel ?? a.label}
              disabled={a.disabled}
              onPress={a.onPress}
              style={[styles.act, { backgroundColor: i ? ds.c.raised : ds.accentFill.fill, opacity: a.disabled ? 0.5 : 1 }]}
            >
              <DsText variant="label" color={i ? ds.c.ink : ds.accentFill.text} style={styles.actLabel}>
                {a.label}
              </DsText>
            </PressableScale>
          ))}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card - 2, borderCurve: 'continuous', paddingVertical: space.md + 2, paddingLeft: space.lg, paddingRight: space.md + 2, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  words: { flex: 1, minWidth: 0, gap: space.xs },
  title: { ...font.semiBold },
  x: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  // Under the words, past the icon.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingLeft: 20 + space.md },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: 36, paddingHorizontal: space.md + 1, borderRadius: radius.pill, borderWidth: 1 },
  act: { minHeight: 38, borderRadius: radius.pill, paddingHorizontal: space.lg - 1, alignItems: 'center', justifyContent: 'center' },
  actLabel: { ...font.semiBold },
});
