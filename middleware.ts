// Vercel Routing Middleware (runs before the static site). A shared menu's, a
// public drink's or a bar page's link, fetched by a chat app to build its
// preview, gets that menu's, drink's or bar's title, description and picture
// instead of the app's generic tags: the web build is static, so every
// /m/<id>, /d/<id> and /p/<id> page carries the same head. The link's last
// part is the id or the readable slug (/d/penicillin) or handle
// (/p/dante.westvillage). People are never touched: anything that isn't a
// link-preview bot goes straight to the page.

import { barPreviewMeta, fetchPreviewBar, pictureDrinks } from './lib/barPreview';
import { drinkPreviewMeta, fetchPreviewDrinkCard } from './lib/drinkPreview';
import { drawingsKey, fetchPreviewDrinks, fetchSharedMenu, isPreviewBot, isUuid, previewHtml, previewMeta, resolveShareId, supabaseFromEnv, type PreviewMeta } from './lib/menuPreview';

export const config = { matcher: ['/m/:id', '/d/:id', '/p/:id'] };

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (!isPreviewBot(request.headers.get('user-agent'))) return undefined;
  const url = new URL(request.url);
  const [, kind, key] = url.pathname.split('/');
  const db = supabaseFromEnv(process.env);
  if ((kind !== 'm' && kind !== 'd' && kind !== 'p') || !db) return undefined;
  try {
    // A bar's page (a person's page, or a private one, keeps the generic tags).
    if (kind === 'p') {
      const bar = await fetchPreviewBar(db, key);
      if (!bar) return undefined;
      const { key: drawn } = await pictureDrinks(db, bar);
      return new Response(previewHtml(barPreviewMeta(bar, url.origin, key, drawn)), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
      });
    }
    // A slug that isn't public (any more) reads as no match: the page's own generic tags.
    const id = await resolveShareId(db, kind, key);
    if (!id) return undefined;
    let meta: PreviewMeta | null = null;
    if (kind === 'm') {
      const menu = await fetchSharedMenu(db, id);
      if (menu) {
        const ids = menu.sections.flatMap((s) => s.item_ids).filter(isUuid);
        const [drinks, drawn] = await Promise.all([fetchPreviewDrinks(db, ids), drawingsKey(db, ids)]);
        meta = previewMeta(menu, drinks, url.origin, key, drawn);
      }
    } else {
      const [drink, drawn] = await Promise.all([fetchPreviewDrinkCard(db, id), drawingsKey(db, [id])]);
      if (drink) meta = drinkPreviewMeta(drink, url.origin, key, drawn);
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
