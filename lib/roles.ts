export const ROLE_LEVELS = [
  { level: 10, label: 'Guest' },
  { level: 20, label: 'Employee' },
  { level: 30, label: 'Bartender' },
  { level: 35, label: 'Drink Creator' },
  { level: 40, label: 'Admin' },
] as const;

export type RoleLevel = (typeof ROLE_LEVELS)[number]['level'];

export function roleLabel(level: number): string {
  return ROLE_LEVELS.find((r) => r.level === level)?.label ?? `Level ${level}`;
}

/** Cap real membership at an optional view-as ceiling (never elevates). */
export function effectiveRole(realRole: number, viewAs: number | null | undefined): number {
  const real = realRole || 10;
  return Math.min(real, viewAs ?? real);
}

/** Roles strictly below the user's highest real membership. */
export function viewAsOptions(maxRealRole: number) {
  return ROLE_LEVELS.filter((r) => r.level < maxRealRole);
}
