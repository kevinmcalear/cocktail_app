/**
 * The routes that sit over the page they were opened from: the create
 * wizards, a dialog over the page on a wide web window (Add-entry, Web;
 * Add-bottle, Web; Add-beer, Web; Add-house, Web). On the web the root stack presents them
 * see-through (app/_layout.tsx), and the tab under them stays mounted and
 * showing (MountOnFocus). Phones present them as modals.
 */
export const SEE_THROUGH_ROUTES = ['add-ingredient', 'add-beer', 'add-wine', 'make-recipe'] as const;

/** A root-stack route that leaves the page under it showing. */
export const isSeeThrough = (name: string | undefined) => !!name && (SEE_THROUGH_ROUTES as readonly string[]).includes(name);
