import assert from 'node:assert/strict';

// ponytail: mirrors useCreatorNavStore create↔select mutual exclusion + href helpers
type Attach = { menuDraftId?: string; menuSectionId?: string };
type State = {
  selectedNode: { id: string } | null;
  pendingCreate: {
    type: string;
    barId: string;
    name?: string;
    menuDraftId?: string;
    menuSectionId?: string;
  } | null;
};

function setSelectedNode(state: State, node: { id: string } | null): State {
  return { ...state, selectedNode: node, pendingCreate: null };
}

function requestCreate(
  state: State,
  type: string,
  barId: string,
  name?: string,
  attach?: Attach
): State {
  return {
    ...state,
    pendingCreate: {
      type,
      barId,
      name: name?.trim() || undefined,
      menuDraftId: attach?.menuDraftId,
      menuSectionId: attach?.menuSectionId,
    },
    selectedNode: null,
  };
}

function creatorNodeHref(node: { type: string; id: string }): string {
  return `/edit-mode?type=${encodeURIComponent(node.type)}&id=${encodeURIComponent(node.id)}`;
}

function creatorCreateHref(type: string, barId: string, name?: string, attach?: Attach): string {
  let url = `/edit-mode?create=${encodeURIComponent(type)}&barId=${encodeURIComponent(barId)}`;
  const trimmed = name?.trim();
  if (trimmed) url += `&name=${encodeURIComponent(trimmed)}`;
  if (attach?.menuDraftId) url += `&menuDraftId=${encodeURIComponent(attach.menuDraftId)}`;
  if (attach?.menuSectionId) url += `&menuSectionId=${encodeURIComponent(attach.menuSectionId)}`;
  return url;
}

let s: State = { selectedNode: { id: 'menu-1' }, pendingCreate: null };
s = requestCreate(s, 'beer', 'bar-1');
assert.equal(s.selectedNode, null);
assert.deepEqual(s.pendingCreate, {
  type: 'beer',
  barId: 'bar-1',
  name: undefined,
  menuDraftId: undefined,
  menuSectionId: undefined,
});

s = requestCreate(s, 'cocktail', 'bar-1', '  Paper Plane  ', {
  menuSectionId: 'sec-1',
  menuDraftId: 'draft-1',
});
assert.deepEqual(s.pendingCreate, {
  type: 'cocktail',
  barId: 'bar-1',
  name: 'Paper Plane',
  menuDraftId: 'draft-1',
  menuSectionId: 'sec-1',
});

s = setSelectedNode(s, { id: 'menu-2' });
assert.deepEqual(s.selectedNode, { id: 'menu-2' });
assert.equal(s.pendingCreate, null);

assert.equal(
  creatorNodeHref({ type: 'menu_draft', id: 'abc/def' }),
  '/edit-mode?type=menu_draft&id=abc%2Fdef'
);
assert.equal(creatorCreateHref('menu', 'personal'), '/edit-mode?create=menu&barId=personal');
assert.equal(
  creatorCreateHref('beer', 'bar-1', 'Hazy IPA'),
  '/edit-mode?create=beer&barId=bar-1&name=Hazy%20IPA'
);
assert.equal(
  creatorCreateHref('cocktail', 'bar-1', 'Negroni', { menuSectionId: 'sec-9' }),
  '/edit-mode?create=cocktail&barId=bar-1&name=Negroni&menuSectionId=sec-9'
);

console.log('useCreatorNavStore.check: ok');
