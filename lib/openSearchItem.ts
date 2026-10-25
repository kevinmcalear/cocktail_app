import { draftHref } from '@/lib/draftList';
import { itemHref } from '@/lib/itemRoutes';
import type { SearchItem } from '@/types/search';

const DRAFT_TYPE: Partial<Record<NonNullable<SearchItem['category']>, string>> = {
  Menu: 'menu',
  Beer: 'beer',
  Wine: 'wine',
  Ingredient: 'ingredient',
};

/** Where a search result opens: a draft in its editor (or Drafts, when no editor opens it), a menu in the menu editor, anything else on its page. */
export function searchItemHref(item: SearchItem): string {
  if (item.isDraft) {
    const draftId = item.id.replace(/^(beer|wine|menu)-/, '');
    const entityType = (item.category && DRAFT_TYPE[item.category]) || 'cocktail';
    return draftHref({ id: draftId, entity_type: entityType }) ?? '/drafts';
  }
  if (item.category === 'Menu') return `/menus/${encodeURIComponent(item.id.replace('menu-', ''))}`;
  return itemHref(item.category === 'Category' ? undefined : item.category, item.id);
}

/** Open a search result where searchItemHref says. */
export function openSearchItem(item: SearchItem, push: (href: string) => void) {
  push(searchItemHref(item));
}
