// Vercel Routing Middleware (runs before the static site). A shared menu's or
// a public drink's link, fetched by a chat app to build its preview, gets that
// menu's or drink's title, description and picture instead of the app's
// generic tags: the web build is static, so every /m/<id> and /d/<id> page
// carries the same head. People are never touched: anything that isn't a
// link-preview bot goes straight to the page.

import { drinkPreviewMeta, fetchPreviewDrinkCard } from './lib/drinkPreview';
import { fetchPreviewDrinks, fetchSharedMenu, isPreviewBot, isUuid, previewHtml, previewMeta, supabaseFromEnv, type PreviewMeta } from './lib/menuPreview';

export const config = { matcher: ['/m/:id', '/d/:id'] };

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (!isPreviewBot(request.headers.get('user-agent'))) return undefined;
  const url = new URL(request.url);
  const [, kind, id] = url.pathname.split('/');
  const db = supabaseFromEnv(process.env);
  if (!isUuid(id) || !db) return undefined;
  try {
    let meta: PreviewMeta | null = null;
    if (kind === 'm') {
      const menu = await fetchSharedMenu(db, id);
      if (menu) meta = previewMeta(menu, await fetchPreviewDrinks(db, menu.sections.flatMap((s) => s.item_ids).filter(isUuid)), url.origin);
    } else if (kind === 'd') {
      const drink = await fetchPreviewDrinkCard(db, id);
      if (drink) meta = drinkPreviewMeta(drink, url.origin);
    }
    // Not shared or not public (any more): the page's own generic tags, as before.
    if (!meta) return undefined;
    return new Response(previewHtml(meta), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  } catch {
    // A preview is never worth a broken link: fall through to the page.
    return undefined;
  }
}
