// Serves a web export the way Vercel does: clean URLs, plus vercel.json's
// rewrites for dynamic routes (/d/:id to /d/[id].html). Local only.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

/** Starts a server for `dist` on a free localhost port. Resolves to { url, close }. */
export async function serve(dist) {
  const root = resolve(dist);
  const rewrites = (JSON.parse(readFileSync('vercel.json', 'utf8')).rewrites ?? []).map((r) => ({
    test: new RegExp(`^${r.source.replace(/:[a-zA-Z]+\*/g, '.*').replace(/:[a-zA-Z]+/g, '[^/]+')}$`),
    to: r.destination,
  }));
  const file = (url) => {
    const path = decodeURIComponent(new URL(url, 'http://x').pathname);
    const tries = [path, `${path}.html`, join(path, 'index.html')];
    for (const r of rewrites) if (r.test.test(path)) tries.push(r.to, `${r.to}.html`);
    for (const t of tries) {
      const f = join(root, t);
      if (f.startsWith(root + sep) && existsSync(f) && statSync(f).isFile()) return f;
    }
    return null;
  };
  const server = createServer((req, res) => {
    const f = file(req.url ?? '/');
    res.writeHead(f ? 200 : 404, { 'content-type': TYPES[extname(f ?? '.html')] ?? 'application/octet-stream' });
    res.end(readFileSync(f ?? join(root, '+not-found.html')));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((done) => server.close(done)) };
}
