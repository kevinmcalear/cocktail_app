import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { groupById } from '@/lib/techniques';
import type { AwayProject, Project } from '@/lib/techniques/projects';

interface ProjectsProps {
  ready: Project[];
  away: AwayProject[];
  /** Tick a piece of kit you turn out to have. */
  onKit: (id: string) => void;
  /** Open Add to your bar on the lab shelf. */
  onLab: () => void;
}

/**
 * What to make, as projects: techniques your kit and lab shelf allow, each
 * opening its method, then what one more piece of kit or one lab ingredient
 * would open. One row of My Bar's list: there are a few dozen techniques at most.
 */
export function Projects({ ready, away, onKit, onLab }: ProjectsProps) {
  const ds = useDs();
  const router = useRouter();
  return (
    <View style={styles.list}>
      <Caption tone="muted">Techniques your kit and shelf allow. Plan these a day ahead.</Caption>
      {ready.map(({ technique: t, uses }) => (
        <Surface key={t.id} style={styles.card}>
          <View>
            <Caption tone="muted">{groupById(t.group)?.name ?? ''}</Caption>
            <Headline role="heading">{t.name}</Headline>
            <Caption tone="muted">{t.time}</Caption>
          </View>
          <Body tone="muted">{t.summary}</Body>
          {uses.length ? (
            <View style={styles.uses}>
              <IconSymbol name="checkmark" size={14} color={ds.accentText} />
              <Caption style={styles.flex}>{`Uses your ${uses.join(', ')}`}</Caption>
            </View>
          ) : null}
          <Button label="Method" variant="secondary" onPress={() => router.push(`/techniques/${t.id}` as never)} />
        </Surface>
      ))}
      {away.length ? (
        <View style={styles.away}>
          <Headline role="heading">One piece away</Headline>
          {away.map(({ missing, techniques }) => (
            <View key={`${missing.kind}:${missing.id}`} style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <View style={styles.flex}>
                <Body>{missing.name}</Body>
                <Caption tone="muted">
                  <Caption tone="accent">{`Opens ${techniques.length}: `}</Caption>
                  {techniques.map((t) => t.name).join(', ')}
                </Caption>
              </View>
              {missing.kind === 'kit' ? (
                <Button label="I have it" variant="secondary" accessibilityLabel={`I have ${missing.name}`} onPress={() => onKit(missing.id)} />
              ) : (
                <Button label="Add" icon="plus" variant="secondary" accessibilityLabel={`Add ${missing.name}`} onPress={onLab} />
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md, paddingTop: space.md },
  card: { gap: space.md },
  uses: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  flex: { flex: 1 },
  away: { gap: space.xs, paddingTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
