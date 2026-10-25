import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, Surface, Title, useDs } from '@/components/ds';
import { SectionHeading } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { confirmAsync } from '@/lib/dialogs';

/** A fact on the page: "Where it comes from · Bought from Harbour Supply". Change opens the Add sheet at its question. */
export interface KitFact {
  label: string;
  value: string;
  onChange?: () => void;
}

export interface KitItemPageProps {
  /** "Glassware", "Ice", "Tools". */
  kind: string;
  name: string;
  /** The drawing, large. */
  thumb: ReactNode;
  facts: KitFact[];
  /** How it connects: an ice's recipe, a glass's drinks, what needs a tool. */
  children?: ReactNode;
  /** Opens the Add sheet from its first question. */
  onEdit?: () => void;
  /** Takes it off the kit, after a confirm. */
  onRemove?: () => void;
  removing?: boolean;
  /** A save or remove that failed, in words. */
  error?: string | null;
  /** On a phone the page head already says the name. */
  showTitle?: boolean;
}

/**
 * One thing in the kit, opened (Kit and ice, step 2): the same page for a
 * glass, an ice or a tool. The drawing, a few facts you can change, how it
 * connects, and Remove from Kit.
 */
export function KitItemPage({ kind, name, thumb, facts, children, onEdit, onRemove, removing, error, showTitle }: KitItemPageProps) {
  const ds = useDs();
  const remove = async () => {
    if (await confirmAsync({ title: `Remove ${name}?`, message: 'It comes off the venue’s kit.', confirmText: 'Remove', destructive: true })) onRemove?.();
  };
  return (
    <View style={styles.page}>
      <View style={styles.head}>
        {thumb}
        <View style={styles.flex}>
          <Caption tone="muted">{kind}</Caption>
          {showTitle ? <Title role="heading">{name}</Title> : null}
        </View>
        {onEdit ? <Button label="Edit" variant="ghost" size="sm" accessibilityLabel={`Edit ${name}`} onPress={onEdit} /> : null}
      </View>
      {facts.length ? (
        <Surface style={styles.card}>
          <View role="list">
            {facts.map((f, i) => {
              const body = (
                <>
                  <View style={styles.flex}>
                    <Caption tone="muted">{f.label}</Caption>
                    <Body>{f.value}</Body>
                  </View>
                  {f.onChange ? <Caption color={ds.accentText}>Change</Caption> : null}
                </>
              );
              return (
                <View key={f.label} role="listitem" style={i ? { borderTopColor: ds.c.line, borderTopWidth: StyleSheet.hairlineWidth } : null}>
                  {f.onChange ? (
                    <PressableScale role="button" accessibilityLabel={`${f.label}. ${f.value}. Change`} onPress={f.onChange} style={styles.fact}>
                      {body}
                    </PressableScale>
                  ) : (
                    <View style={styles.fact}>{body}</View>
                  )}
                </View>
              );
            })}
          </View>
        </Surface>
      ) : null}
      {children}
      {error ? (
        <Caption tone="accent" role="alert">
          {error}
        </Caption>
      ) : null}
      {onRemove ? <Button label={removing ? 'Removing…' : 'Remove from Kit'} variant="ghost" disabled={removing} onPress={() => void remove()} style={styles.start} /> : null}
    </View>
  );
}

/** A titled part of the page: "How it’s made", "In 111 drinks". */
export function KitItemSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeading>{title}</SectionHeading>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
  card: { paddingVertical: space.xs },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, paddingHorizontal: space.xs },
  section: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
});
