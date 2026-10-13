import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { Caption } from '@/components/ds';
import { ChoiceChips, ControlRow, RowDivider, SelectRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { hasAiConsent, setAiConsent } from '@/lib/aiConsent';
import { useMaxRealRole, useViewAs } from '@/hooks/useViewAs';
import { roleLabel, viewAsOptions } from '@/lib/roles';
import type { MapsApp } from '@/lib/directions';
import { DEFAULT_UNIT_OPTIONS, THEME_MODES, useSettingsStore } from '@/store/useSettingsStore';

const DIRECTIONS_OPTIONS = [
  { id: 'ask', label: 'Ask each time' },
  { id: 'apple', label: 'Apple Maps' },
  { id: 'google', label: 'Google Maps' },
  { id: 'waze', label: 'Waze' },
];

/** How the app looks and behaves. Everything saves as it changes: View as to the account, the rest to this device. */
export function PreferencesSection() {
  const { themeMode, setThemeMode, defaultUnit, setDefaultUnit, directionsApp, setDirectionsApp } = useSettingsStore();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving: viewAsSaving } = useViewAs();
  const maxRealRole = useMaxRealRole();
  const viewAsChoices = viewAsOptions(maxRealRole);
  // "We ask once. Change it any time in Settings." (Bring in's AI OK.)
  const [ai, setAi] = useState(false);
  useEffect(() => {
    void hasAiConsent().then(setAi);
  }, []);

  return (
    <SettingsSection title="Preferences">
      <ControlRow label="Appearance">
        <ChoiceChips label="Appearance" options={THEME_MODES} value={themeMode} onChange={setThemeMode} />
      </ControlRow>
      <RowDivider />
      <ControlRow label="Units" detail="Specs on drink pages, and new recipe lines">
        <ChoiceChips label="Units" options={DEFAULT_UNIT_OPTIONS} value={defaultUnit} onChange={setDefaultUnit} />
      </ControlRow>
      <RowDivider />
      <SwitchRow
        label="Read with AI"
        detail="Photos, PDFs and links you bring in are read by Google’s Gemini. Off, we ask again before the next one."
        value={ai}
        onValueChange={(on) => {
          setAi(on);
          void setAiConsent(on);
        }}
      />
      {Platform.OS === 'ios' ? (
        <>
          <RowDivider />
          <SelectRow
            label="Directions"
            detail="The maps app a bar's Directions opens"
            options={DIRECTIONS_OPTIONS}
            value={directionsApp ?? 'ask'}
            onChange={(id) => setDirectionsApp(id === 'ask' ? null : (id as MapsApp))}
          />
        </>
      ) : null}
      {viewAsChoices.length > 0 ? (
        <>
          <RowDivider />
          <SelectRow
            label="View as"
            detail="Preview menus and recipes as a lower role"
            disabled={viewAsSaving}
            options={[{ id: 'off', label: `Off (${roleLabel(maxRealRole)})` }, ...viewAsChoices.map(({ level, label }) => ({ id: String(level), label }))]}
            value={viewAsRoleLevel == null ? 'off' : String(viewAsRoleLevel)}
            onChange={(id) => void setViewAsRoleLevel(id === 'off' ? null : Number(id))}
          />
          <Caption tone="muted" style={styles.note}>
            View as never raises what you can see, only lowers it. The banner stays until you exit, on every screen.
          </Caption>
        </>
      ) : null}
      <RowDivider />
      <Caption tone="muted" style={styles.note}>
        {viewAsChoices.length > 0 ? 'Saved as you change them. View as is saved to your account, the rest on this device.' : 'Saved on this device as you change them.'}
      </Caption>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  note: { paddingVertical: space.sm },
});
