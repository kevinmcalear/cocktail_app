/**
 * The web never draws Android's Add FAB (the + is in the header), so the tabs'
 * stack layout imports nothing here. Importing AddButton would put the New
 * sheet in the layout's chunk, a second copy beside the one in each tab's first page.
 */
export function AddFab() {
  return null;
}
