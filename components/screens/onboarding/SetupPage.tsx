import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ds';
import { space } from '@/constants/tokens';
import { SafetyPage, type SafetyPageProps } from '@/components/screens/safety/SafetyPage';

/** What the screen running a setup gives each step: its title, intro, Back and progress bar. */
export type SetupChrome = Omit<SafetyPageProps, 'children' | 'footer'>;

const Chrome = createContext<SetupChrome | null>(null);

/** The screen running a setup (onboarding, venue setup) wraps the current step in this. */
export const SetupChromeProvider = Chrome.Provider;

/**
 * A setup step's page: the screen's chrome around the step's own fields, with
 * the step's buttons pinned at the bottom (b28). Outside a setup (a step
 * reused inside another page, like Add a job on your profile) it's just the
 * fields with the buttons under them.
 */
export function SetupPage({ footer, topRight, children }: { footer?: ReactNode; topRight?: ReactNode; children: ReactNode }) {
  const chrome = useContext(Chrome);
  if (!chrome) {
    return (
      <View style={styles.inline}>
        {children}
        {footer}
      </View>
    );
  }
  return (
    <SafetyPage {...chrome} topRight={topRight ?? chrome.topRight} footer={footer}>
      {children}
    </SafetyPage>
  );
}

/** Continue, with a quiet Not now under it: the pinned bottom of a setup step. */
export function SetupFooter({
  label = 'Continue',
  onPress,
  disabled,
  pending,
  skipLabel = 'Not now',
  onSkip,
}: {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  /** Saving: the button says so and both are off. */
  pending?: boolean;
  skipLabel?: string;
  /** Leave out for a step that can't be skipped. */
  onSkip?: () => void;
}) {
  return (
    <>
      <Button label={pending ? 'Saving…' : label} size="lg" onPress={onPress} disabled={disabled || pending} />
      {onSkip ? <Button label={skipLabel} variant="ghost" onPress={onSkip} disabled={pending} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  inline: { gap: space.md },
});
