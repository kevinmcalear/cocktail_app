import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { ChoiceChips, ControlRow, RowDivider, SelectRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
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
    // The note sits under the card (tools-settings-phone); while View as is on, it says what View as does.
    <SettingsSection
      title="Preferences"
      note={viewAsRoleLevel != null ? 'View as never raises what you can see, only lowers it. The banner stays until you exit, on every screen.' : viewAsChoices.length > 0 ? 'Saved as you change them. View as is saved to your account, the rest on this device.' : 'Saved on this device as you change them.'}
    >
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
        </>
      ) : null}
    </SettingsSection>
  );
}

/**
 * Layouts we're trying side by side before picking one (Kevin and Eddie, 13 Oct).
 * Phones only: wide web keeps its sidebar and ⌘K. Saved on this device.
 */
export function TryItSection() {
  const { bottomBar, setBottomBar } = useSettingsStore();
  return (
    <SettingsSection title="Try it" note="Ideas we're testing. Turn them off to go back to how the app is now.">
      <SwitchRow
        label="Search and New at the bottom"
        detail="Search opens at the bottom, over the keyboard, and New moves from the top into the tab bar."
        value={bottomBar}
        onValueChange={setBottomBar}
      />
    </SettingsSection>
  );
}
