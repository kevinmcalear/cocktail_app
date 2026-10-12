// Google Doc, Google Sheet and Airtable share links for Bring in: public
// "anyone with the link" shares only, no sign-in. A link is a share link only
// when its host is exactly docs.google.com or airtable.com (https, no port, no
// login). Every hop, redirects included, is checked against that service's
// hosts as well as linkRead's public-address checks: Google's only extra host is
// its own export download host (doc-...-docs.googleusercontent.com), which
// docs.google.com redirects to; Airtable has none. Size (3 MB a hop) and time
// (10 s a hop, 20 s for the whole share) are capped.
// Plain TypeScript: fetch and DNS are passed in, so scripts/shareLinks.check.ts
// runs it under Node with fakes.

import { fetchLink, LinkError, type LinkContent, type LinkDeps } from "./linkRead.ts";

const MAX_TEXT = 20_000;
const MAX_ROWS = 400;
/** The whole share read, every hop and the Airtable data request included. */
const SHARE_BUDGET_MS = 20_000;

export type ShareKind = "google-doc" | "google-sheet" | "airtable";

export interface ShareLink {
  kind: ShareKind;
  /** What to fetch first. */
  url: string;
  /** The hosts every hop may go to. */
  hosts: (host: string) => boolean;
}

const googleHosts = (host: string) => host === "docs.google.com" || /^doc-[a-z0-9-]+-(?:docs|sheets)\.googleusercontent\.com$/.test(host);
const airtableHosts = (host: string) => host === "airtable.com";

/** A Google Doc, Google Sheet or Airtable share link, else null (an ordinary link). The host must match exactly. */
export function shareLink(raw: string): ShareLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (host === "docs.google.com") {
    const doc = url.pathname.match(/^\/document\/d\/([A-Za-z0-9_-]{10,100})(?:\/|$)/);
    if (doc) return { kind: "google-doc", url: `https://docs.google.com/document/d/${doc[1]}/export?format=txt`, hosts: googleHosts };
    const sheet = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,100})(?:\/|$)/);
    if (sheet) {
      const gid = (url.searchParams.get("gid") ?? url.hash.match(/gid=(\d+)/)?.[1] ?? "").replace(/\D/g, "");
      return { kind: "google-sheet", url: `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`, hosts: googleHosts };
    }
    return null;
  }
  if (airtableHosts(host)) {
    // airtable.com/shrXXXX, airtable.com/appXXXX/shrXXXX(/tblXXXX...)
    const share = url.pathname.match(/^\/(?:(app[A-Za-z0-9]{14})\/)?(shr[A-Za-z0-9]{14})(?:\/|$)/);
    if (share) return { kind: "airtable", url: `https://airtable.com/${share[1] ? `${share[1]}/` : ""}${share[2]}`, hosts: airtableHosts };
  }
  return null;
}

/** linkRead's fetch, refusing any hop off the share's own hosts or past the share's time budget. */
function pinned(deps: LinkDeps, hosts: (host: string) => boolean): LinkDeps {
  const deadline = Date.now() + SHARE_BUDGET_MS;
  return {
    resolve: deps.resolve,
    fetch: (target, init) => {
      const left = deadline - Date.now();
      if (left <= 0) throw new LinkError("That share link took too long to open.");
      const host = new URL(target).hostname.toLowerCase();
      if (!hosts(host)) {
        // Google sends private docs to its sign-in page.
        if (host === "accounts.google.com") throw new LinkError("That doc isn't shared with anyone who has the link. In Google, Share, then General access: Anyone with the link.");
        throw new LinkError("That link can't be read.");
      }
      const budget = AbortSignal.timeout(left);
      return deps.fetch(target, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, budget]) : budget });
    },
  };
}

type Json = Record<string, unknown>;

/** The data request a shared Airtable view makes for itself, from its page. Null when the page has none. */
export function airtableDataPath(html: string): { path: string; appId: string | null } | null {
  const unescaped = html.replace(/\\u002[Ff]/g, "/").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  const found = unescaped.match(/(\/v0\.3\/(?:view\/viw[A-Za-z0-9]{14}\/readSharedViewData|application\/app[A-Za-z0-9]{14}\/read)\?[^"'\s<>\\]+)/);
  if (!found) return null;
  const appId = unescaped.match(/"applicationId"\s*:\s*"(app[A-Za-z0-9]{14})"/)?.[1] ?? found[1].match(/(app[A-Za-z0-9]{14})/)?.[1] ?? null;
  // JSON, not msgpack, so it can be read here.
  const path = found[1].replace(/allowMsgpackOfResult%22%3Atrue/gi, "allowMsgpackOfResult%22%3Afalse").replace(/"allowMsgpackOfResult":true/g, '"allowMsgpackOfResult":false');
  return { path, appId };
}

/** One cell as text: strings, numbers, choices by name, linked records by their name. */
function cellText(value: unknown, choices: Record<string, string>): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return choices[value] ?? value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => cellText(v, choices)).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const v = value as Json;
    const name = v.foreignRowDisplayName ?? v.name ?? v.displayName ?? v.text;
    return typeof name === "string" ? name : "";
  }
  return "";
}

/** A shared view's rows as text, one record a block of "Column: value" lines. */
export function airtableText(payload: unknown): string {
  const data = ((payload as Json)?.data ?? payload) as Json;
  const table = (data?.table ?? (Array.isArray(data?.tableDatas) ? (data.tableDatas as Json[])[0] : null) ?? data) as Json;
  const schema = (Array.isArray(data?.tableSchemas) ? (data.tableSchemas as Json[])[0] : table) as Json;
  const columns = (Array.isArray(schema?.columns) ? schema.columns : Array.isArray(table?.columns) ? table.columns : []) as Json[];
  const rows = (Array.isArray(table?.rows) ? table.rows : []) as Json[];
  if (!columns.length || !rows.length) return "";
  const names: Record<string, string> = {};
  const choices: Record<string, string> = {};
  for (const col of columns) {
    if (typeof col.id === "string" && typeof col.name === "string") names[col.id] = col.name;
    const options = (col.typeOptions as Json | undefined)?.choices as Record<string, Json> | undefined;
    for (const [id, choice] of Object.entries(options ?? {})) if (typeof choice?.name === "string") choices[id] = choice.name;
  }
  const blocks: string[] = [];
  let size = 0;
  for (const row of rows.slice(0, MAX_ROWS)) {
    const cells = (row.cellValuesByColumnId ?? {}) as Json;
    const lines = Object.entries(names)
      .map(([id, name]) => [name, cellText(cells[id], choices).trim()] as const)
      .filter(([, text]) => text)
      .map(([name, text]) => `${name}: ${text}`);
    if (!lines.length) continue;
    const block = lines.join("\n");
    size += block.length + 2;
    if (size > MAX_TEXT) break;
    blocks.push(block);
  }
  return blocks.join("\n\n");
}

const notShared = "That share link didn't open. Check it's shared with anyone who has the link, or download it as a file and drop that in.";

/** Reads a Google Doc, Google Sheet or Airtable share link as text for the reader. */
export async function readShareLink(share: ShareLink, deps: LinkDeps): Promise<LinkContent> {
  const safe = pinned(deps, share.hosts);
  if (share.kind !== "airtable") {
    const content = await fetchLink(share.url, safe, { plain: true });
    if (!("text" in content) || !content.text.trim()) throw new LinkError(notShared);
    // A sign-in page that came back as a page, not a redirect.
    if (/<html|accounts\.google\.com/i.test(content.text.slice(0, 2_000))) throw new LinkError(notShared);
    const label = share.kind === "google-doc" ? "A Google Doc" : "A Google Sheet, as CSV";
    return { text: `${label}:\n\n${content.text.slice(0, MAX_TEXT)}` };
  }
  const page = await fetchLink(share.url, safe, { plain: true });
  if (!("text" in page)) throw new LinkError(notShared);
  const found = airtableDataPath(page.text);
  if (!found) throw new LinkError("Couldn't read that Airtable view. In Airtable, Download CSV, then drop the file in.");
  const data = await fetchLink(`https://airtable.com${found.path}`, safe, {
    plain: true,
    headers: {
      Accept: "application/json",
      "x-requested-with": "XMLHttpRequest",
      "x-time-zone": "UTC",
      "x-user-locale": "en",
      ...(found.appId ? { "x-airtable-application-id": found.appId } : {}),
    },
  });
  let payload: unknown = null;
  try {
    payload = "text" in data ? JSON.parse(data.text) : null;
  } catch {
    payload = null;
  }
  const text = airtableText(payload);
  if (!text) throw new LinkError("Couldn't read that Airtable view. In Airtable, Download CSV, then drop the file in.");
  return { text: `An Airtable view, one record a block:\n\n${text}` };
}
