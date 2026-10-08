// Where links to the old Creator Hub (/edit-mode) and the old menu creator
// (/menus/create, /menus/create-template) go now. Bookmarks, recents saved on
// a device and shared links still use them.

const ADD: Record<string, string> = {
  cocktail: '/add-cocktail',
  beer: '/add-beer',
  wine: '/add-wine',
  ingredient: '/add-ingredient',
};

const query = (params: Record<string, string | undefined>) => {
  const q = Object.entries(params)
    .filter((e): e is [string, string] => !!e[1])
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

/** /edit-mode?create=… opens that adder, ?type=published_…&id=… that page; everything else is Drafts. */
export function editModeRedirect(p: { create?: string; barId?: string; name?: string; type?: string; id?: string }): string {
  if (p.create === 'menu') return '/menus/all?new=1';
  const add = p.create ? ADD[p.create] : undefined;
  if (add) return add + query({ barId: p.barId === 'personal' ? undefined : p.barId, name: p.name });
  if (p.id) {
    if (p.type === 'published_menu') return `/menus/${encodeURIComponent(p.id)}`;
    if (p.type === 'published_ingredient') return `/ingredient/${encodeURIComponent(p.id)}`;
    if (p.type === 'published_drink') {
      const kind = p.id.startsWith('beer-') ? 'beer' : p.id.startsWith('wine-') ? 'wine' : 'cocktail';
      return `/${kind}/${encodeURIComponent(p.id)}`;
    }
  }
  return '/drafts';
}

/** /menus/create?menuId=… edits that menu; a draft goes to Drafts; otherwise a new menu. */
export function menuCreateRedirect(p: { menuId?: string; draftId?: string }): string {
  if (p.menuId) return `/menus/${encodeURIComponent(p.menuId)}/edit`;
  return p.draftId ? '/drafts' : '/menus/all?new=1';
}
