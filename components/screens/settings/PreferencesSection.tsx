import { StyleSheet } from 'react-native';

import { Caption } from '@/components/ds';
import { ChoiceChips, ControlRow, RowDivider, SelectRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { space } from '@/constants/tokens';
import { useMaxRealRole, useViewAs } from '@/hooks/useViewAs';
import { roleLabel, viewAsOptions } from '@/lib/roles';
import { DEFAULT_UNIT_OPTIONS, THEME_MODES, useSettingsStore } from '@/store/useSettingsStore';

/** How the app looks and behaves on this device. Everything saves as it changes. */
export function PreferencesSection() {
  const { themeMode, setThemeMode, defaultUnit, setDefaultUnit } = useSettingsStore();
  const { viewAsRoleLevel, setViewAsRoleLevel, isSaving: viewAsSaving } = useViewAs();
  const maxRealRole = useMaxRealRole();
  const viewAsChoices = viewAsOptions(maxRealRole);

  return (
    <SettingsSection title="Preferences">
      <ControlRow label="Appearance">
        <ChoiceChips label="Appearance" options={THEME_MODES} value={themeMode} onChange={setThemeMode} />
      </ControlRow>
      <RowDivider />
      <ControlRow label="Units" detail="Specs on drink pages, and new recipe lines">
        <ChoiceChips label="Units" options={DEFAULT_UNIT_OPTIONS} value={defaultUnit} onChange={setDefaultUnit} />
      </ControlRow>
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
      <Caption tone="muted" style={styles.note}>Saved on this device as you change them.</Caption>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  note: { paddingVertical: space.sm },
});
