import { useDs } from '@/components/ds';
import { mix } from '@/lib/color';

/**
 * Android's Material roles in our colours, never the wallpaper (Prod-phone's
 * `A`, Kevin's pick): the nav bar, the search bar and the selected tab's pill,
 * built from the page's ground, ink and accent so a bar's colours reach them.
 * The amounts land on the boards' tones with the default colours.
 */
export function useMaterialRoles() {
  const ds = useDs();
  const dark = ds.scheme === 'dark';
  const nav = mix(ds.c.ground, ds.c.ink, dark ? 0.06 : 0.07);
  return {
    nav,
    search: mix(ds.c.ground, ds.c.ink, dark ? 0.09 : 0.08),
    indicator: mix(nav, ds.accentFill.fill, dark ? 0.26 : 0.4),
    onIndicator: ds.c.ink,
  };
}
