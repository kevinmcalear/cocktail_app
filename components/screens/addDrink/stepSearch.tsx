import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Field } from '@/components/ds';
import { space } from '@/constants/tokens';

import { useWizardTakeover } from './WizardFrame';

/**
 * A step with several searches (Credits: who, where, which classic), each
 * taking a phone's screen while it's in use, as the ingredient search does
 * (Q16): the rest of the step goes to null in place, so the field keeps its
 * focus and its results run down to the keyboard, not under the footer.
 * Off a phone (no takeover) nothing hides.
 */
export interface StepSearch {
  /** Something else is searching: this piece hides. */
  hidden: (key: string) => boolean;
  /** This search has the screen. */
  over: (key: string) => boolean;
  focus: (key: string) => void;
  done: () => void;
}

export function useStepSearch(): StepSearch {
  const takeover = useWizardTakeover();
  const [active, setActive] = useState<string | null>(null);
  const on = !!takeover?.on;
  return {
    hidden: (key) => on && active !== key,
    over: (key) => on && active === key,
    focus: (key) => {
      setActive(key);
      takeover?.set(true);
    },
    done: () => takeover?.set(false),
  };
}

/** The step's Field, with Cancel beside it while it has the screen. Cancel empties it. */
export function StepSearchField({ search, id, ...field }: ComponentProps<typeof Field> & { search: StepSearch; id: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Field {...field} onFocus={() => search.focus(id)} />
      </View>
      {search.over(id) ? (
        <Button
          label="Cancel"
          variant="ghost"
          accessibilityLabel="Cancel the search"
          onPress={() => {
            field.onChangeText?.('');
            search.done();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
