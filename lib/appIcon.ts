import { requireOptionalNativeModule } from 'expo';

import appIcons from '@/constants/appIcons.json';

/** The native side of expo-alternate-app-icons, as its own build/index.js calls it. */
type AppIconModule = {
  supportsAlternateIcons: boolean;
  getAppIconName: () => string | null;
  setAlternateAppIcon: (name: string | null) => Promise<string | null>;
};

export const DEFAULT_APP_ICON = 'default';

/**
 * The icons this device can switch to (dec-28), Default first, or null where
 * it can't: web, and store builds made before expo-alternate-app-icons (they
 * get this JS by update). The package's own JS calls requireNativeModule on
 * load and would throw there, so this asks for the native module optionally
 * and never imports the package. Icons whose art is still a placeholder show
 * only in dev builds (constants/appIcons.json).
 */
function iconModule(): AppIconModule | null {
  const native = requireOptionalNativeModule<AppIconModule>('ExpoAlternateAppIcons');
  return native?.supportsAlternateIcons ? native : null;
}

export function appIconChoices(): { id: string; label: string }[] | null {
  if (!iconModule()) return null;
  const icons = appIcons.icons.filter((icon) => icon.ready || __DEV__);
  return icons.length ? [{ id: DEFAULT_APP_ICON, label: 'Default' }, ...icons.map(({ name, label }) => ({ id: name, label }))] : null;
}

export function currentAppIcon(): string {
  try {
    return iconModule()?.getAppIconName() ?? DEFAULT_APP_ICON;
  } catch {
    return DEFAULT_APP_ICON;
  }
}

/** Switches the home screen icon. iOS shows its own "You have changed the icon" alert. */
export async function setAppIcon(id: string): Promise<void> {
  await iconModule()?.setAlternateAppIcon(id === DEFAULT_APP_ICON ? null : id);
}
