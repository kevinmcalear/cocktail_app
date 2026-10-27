import { useEffect, useRef, useState, type ComponentProps } from 'react';
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

/** The step's Field, with Cancel beside it while it has the screen. Cancel empties it, and so does closing it from outside (Android's back), so no results are left under the footer. */
export function StepSearchField({ search, id, ...field }: ComponentProps<typeof Field> & { search: StepSearch; id: string }) {
  const over = search.over(id);
  const wasOver = useRef(over);
  const clear = field.onChangeText;
  useEffect(() => {
    if (wasOver.current && !over) clear?.('');
    wasOver.current = over;
  }, [over, clear]);
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Field
          {...field}
          onFocus={(e) => {
            field.onFocus?.(e);
            search.focus(id);
          }}
        />
      </View>
      {over ? (
        <Button
          label="Cancel"
          variant="ghost"
          accessibilityLabel="Cancel the search"
          onPress={search.done}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
});
