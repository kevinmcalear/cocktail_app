import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { PUBLISH_COPY, type PublishMode, type PublishSource } from '@/lib/publishing';

import { Choice } from '../menus/MenuSheet';

const MODES: PublishMode[] = ['private', 'description', 'spec'];
const FROM: Record<PublishSource, string> = { drink: 'this drink', menu: 'its menus', bar: 'the bar', none: 'the default' };

interface PublishChoiceProps {
  label: string;
  /** The level's own setting; null follows the level above. */
  value: PublishMode | null;
  onChange: (mode: PublishMode | null) => void;
  /** Offer "Same as ..." (null) and say what it resolves to. Leave out for the bar's default. */
  inherited?: { mode: PublishMode; source: PublishSource };
  /** Pills without the explanation, for a list of menus. */
  compact?: boolean;
  disabled?: boolean;
  error?: string | null;
}

/** Who outside the venue can see something: private, the menu card, or the full spec. */
export function PublishChoice({ label, value, onChange, inherited, compact, disabled, error }: PublishChoiceProps) {
  const same = inherited ? `Same as ${FROM[inherited.source]}` : '';
  return (
    <View style={styles.wrap}>
      <View role="radiogroup" accessibilityLabel={label} style={compact ? styles.pills : styles.rows}>
        {inherited ? (
          <Choice
            label={compact ? `${same} (${PUBLISH_COPY[inherited.mode].label.toLowerCase()})` : same}
            detail={compact ? undefined : `${PUBLISH_COPY[inherited.mode].label} right now.`}
            selected={value === null}
            disabled={disabled}
            onPress={() => onChange(null)}
          />
        ) : null}
        {MODES.map((m) => (
          <Choice
            key={m}
            label={PUBLISH_COPY[m].label}
            detail={compact ? undefined : PUBLISH_COPY[m].detail}
            selected={value === m}
            disabled={disabled}
            onPress={() => onChange(m)}
          />
        ))}
      </View>
      {error ? (
        <Caption tone="accent" role="alert">
          {error}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  rows: { gap: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
