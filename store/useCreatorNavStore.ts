import type { SelectedDraftNode } from '@/components/DraftFolderTree';
import { recentEntry } from '@/hooks/useTrackRecent';
import { buildNodeFromItem } from '@/lib/creatorWorkspaceUtils';
import { RecentKind, useRecentActivityStore } from '@/store/useRecentActivityStore';
import { create } from 'zustand';

export type MenuCreateAttach = {
  menuDraftId?: string;
  menuSectionId?: string;
};

type PendingCreate = {
  type: 'cocktail' | 'beer' | 'wine' | 'ingredient' | 'menu';
  barId: string;
  name?: string;
  menuDraftId?: string;
  menuSectionId?: string;
};

type PendingMenuDrink = { sectionId: string; drinkId: string; replaceId?: string };

type CreatorNavState = {
  selectedNode: SelectedDraftNode | null;
  pendingCreate: PendingCreate | null;
  /** Drink created from a menu picker — host consumes into selections. */
  pendingMenuDrink: PendingMenuDrink | null;
  setSelectedNode: (node: SelectedDraftNode | null) => void;
  requestCreate: (
    type: PendingCreate['type'],
    barId: string,
    name?: string,
    attach?: MenuCreateAttach
  ) => void;
  clearPendingCreate: () => void;
  deliverMenuDrink: (sectionId: string, drinkId: string, replaceId?: string) => void;
  consumeMenuDrink: () => PendingMenuDrink | null;
};

/** ponytail: web sidebar ↔ Creator Hub; URL carries selection so refresh restores the editor */
export const useCreatorNavStore = create<CreatorNavState>((set, get) => ({
  selectedNode: null,
  pendingCreate: null,
  pendingMenuDrink: null,
  // create vs select are mutually exclusive — leaving the other set lets edit-mode's
  // storeNode effect reopen the previous menu over a fresh Add Beer/Cocktail/etc.
  setSelectedNode: (node) => set({ selectedNode: node, pendingCreate: null }),
  requestCreate: (type, barId, name, attach) =>
    set({
      pendingCreate: {
        type,
        barId,
        name: name?.trim() || undefined,
        menuDraftId: attach?.menuDraftId,
        menuSectionId: attach?.menuSectionId,
      },
      selectedNode: null,
    }),
  clearPendingCreate: () => set({ pendingCreate: null }),
  deliverMenuDrink: (sectionId, drinkId, replaceId) =>
    set({ pendingMenuDrink: { sectionId, drinkId, replaceId } }),
  consumeMenuDrink: () => {
    const pending = get().pendingMenuDrink;
    if (pending) set({ pendingMenuDrink: null });
    return pending;
  },
}));

export function creatorNodeHref(node: Pick<SelectedDraftNode, 'type' | 'id'>): string {
  return `/edit-mode?type=${encodeURIComponent(node.type)}&id=${encodeURIComponent(node.id)}`;
}

export function creatorCreateHref(
  type: PendingCreate['type'],
  barId: string,
  name?: string,
  attach?: MenuCreateAttach
): string {
  let url = `/edit-mode?create=${encodeURIComponent(type)}&barId=${encodeURIComponent(barId)}`;
  const trimmed = name?.trim();
  if (trimmed) url += `&name=${encodeURIComponent(trimmed)}`;
  if (attach?.menuDraftId) url += `&menuDraftId=${encodeURIComponent(attach.menuDraftId)}`;
  if (attach?.menuSectionId) url += `&menuSectionId=${encodeURIComponent(attach.menuSectionId)}`;
  return url;
}

/** Record a Creator tree/hub selection in Jump Back In. */
export function trackCreatorNode(
  node: SelectedDraftNode,
  opts?: { entityType?: string; barId?: string | null; imageUrl?: string | null }
) {
  if (node.type === 'bar' || node.id === '__new__') return;
  const entity = opts?.entityType;
  const kind: RecentKind | null =
    node.type === 'menu_draft' || node.type === 'published_menu'
      ? 'menu'
      : node.type === 'ingredient_draft' || node.type === 'published_ingredient'
        ? 'ingredient'
        : entity === 'beer' || entity === 'wine' || entity === 'cocktail'
          ? entity
          : node.type === 'drink_draft' || node.type === 'published_drink'
            ? 'cocktail'
            : null;
  if (!kind) return;
  const isDraft = node.type.includes('draft');
  useRecentActivityStore.getState().push(
    recentEntry(kind, node.id.replace(/^(beer|wine)-/, ''), node.name, {
      isDraft: isDraft || undefined,
      barId: opts?.barId,
      imageUrl: opts?.imageUrl,
    })
  );
}

/** Same path as the sidebar tree: select node, then land on Creator Hub. */
export function openInCreator(
  node: SelectedDraftNode,
  push: (href: string) => void,
  opts?: { entityType?: string; barId?: string | null; imageUrl?: string | null }
) {
  useCreatorNavStore.getState().setSelectedNode(node);
  trackCreatorNode(node, opts);
  push(creatorNodeHref(node));
}

export function openDraftInCreator(
  draft: { id: string; entity_type: string; bar_id?: string | null; draft_data?: any },
  push: (href: string) => void
) {
  openInCreator(buildNodeFromItem({ ...draft, isPublished: false }), push, {
    entityType: draft.entity_type,
    barId: draft.bar_id ?? null,
    imageUrl: draft.draft_data?.localImages?.[0]?.url || draft.draft_data?.coverUrl || null,
  });
}
