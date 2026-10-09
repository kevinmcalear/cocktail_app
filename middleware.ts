// Vercel Routing Middleware (runs before the static site). A shared menu's
// link, fetched by a chat app to build its preview, gets that menu's title,
// description and picture instead of the app's generic tags: the web build is
// static, so every /m/<id> page carries the same head. People are never
// touched: anything that isn't a link-preview bot goes straight to the page.

import { fetchPreviewDrinks, fetchSharedMenu, isPreviewBot, isUuid, previewHtml, previewMeta, supabaseFromEnv } from './lib/menuPreview';

export const config = { matcher: '/m/:id' };

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (!isPreviewBot(request.headers.get('user-agent'))) return undefined;
  const url = new URL(request.url);
  const id = url.pathname.split('/')[2];
  const db = supabaseFromEnv(process.env);
  if (!isUuid(id) || !db) return undefined;
  try {
    const menu = await fetchSharedMenu(db, id);
    // Not shared (any more): the page's own generic tags, as before.
    if (!menu) return undefined;
    const drinks = await fetchPreviewDrinks(db, menu.sections.flatMap((s) => s.item_ids).filter(isUuid));
    return new Response(previewHtml(previewMeta(menu, drinks, url.origin)), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  } catch {
    // A preview is never worth a broken link: fall through to the page.
    return undefined;
  }
}
