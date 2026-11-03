const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only real item ids can be asked of item_sketches.item_id (a uuid column): one
 * other id in an `in (...)` ("beer-…" for beer and wine) makes Postgres reject
 * the whole batch, and every drawing in it stays blank.
 */
export const askableIds = (ids: readonly string[]): string[] => ids.filter((id) => UUID.test(id));
