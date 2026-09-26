import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';

import { Caption, Headline } from './Text';
import { useDs } from './theme';

interface LockedSectionProps {
  title: string;
  /** Whether the viewer's role can open this section. */
  unlocked: boolean;
  /** The lowest role that can, e.g. "Maker". Shown when locked. */
  opensAt: string;
  children: ReactNode;
}

/**
 * A section some roles can't open. It stays on the page, collapsed, and says
 * who can open it, so staff see there's more to learn and admins can see what
 * each role gets. The locked content is never rendered.
 */
export function LockedSection({ title, unlocked, opensAt, children }: LockedSectionProps) {
  const ds = useDs();
  return (
    <View style={[styles.section, { borderTopColor: ds.c.line }]}>
      <View
        style={styles.header}
        accessible={!unlocked}
        accessibilityLabel={unlocked ? undefined : `${title}, locked. Opens at ${opensAt}.`}
      >
        <Headline tone={unlocked ? 'ink' : 'muted'} role="heading">
          {title}
        </Headline>
        {unlocked ? null : (
          <View style={styles.lock}>
            <IconSymbol name="lock.fill" size={13} color={ds.c.muted} />
            <Caption tone="muted">Opens at {opensAt}</Caption>
          </View>
        )}
      </View>
      {unlocked ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  lock: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  body: { marginTop: space.md, gap: space.sm },
});
