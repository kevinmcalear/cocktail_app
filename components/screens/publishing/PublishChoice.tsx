import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { PUBLISH_COPY, type PublishMode, type PublishSource } from '@/lib/publishing';

import { Choice } from '../menus/MenuSheet';
import { RadioCard, RadioPill } from './RadioCard';

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
  /** Publishing's own look: radio cards, and small outlined pills for a menu. */
  radios?: boolean;
}

/** Who outside the venue can see something: private, the menu card, or the full spec. */
export function PublishChoice({ label, value, onChange, inherited, compact, disabled, error, radios }: PublishChoiceProps) {
  const same = inherited ? `Same as ${FROM[inherited.source]}` : '';
  if (radios) {
    const options = [
      ...(inherited ? [{ mode: null, label: compact ? `${same} (${PUBLISH_COPY[inherited.mode].label.toLowerCase()})` : same, detail: `${PUBLISH_COPY[inherited.mode].label} right now.` }] : []),
      ...MODES.map((m) => ({ mode: m, label: PUBLISH_COPY[m].label, detail: PUBLISH_COPY[m].detail })),
    ];
    return (
      <View style={styles.wrap}>
        <View role="radiogroup" accessibilityLabel={label} style={compact ? styles.pills : styles.rows}>
          {options.map((o) =>
            compact ? (
              <RadioPill key={o.mode ?? 'same'} label={o.label} selected={value === o.mode} disabled={disabled} onPress={() => onChange(o.mode)} />
            ) : (
              <RadioCard key={o.mode ?? 'same'} label={o.label} detail={o.detail} selected={value === o.mode} disabled={disabled} onPress={() => onChange(o.mode)} />
            ),
          )}
        </View>
        {error ? (
          <Caption tone="accent" role="alert">
            {error}
          </Caption>
        ) : null}
      </View>
    );
  }
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
