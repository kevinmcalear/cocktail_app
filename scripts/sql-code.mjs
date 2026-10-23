// Tells SQL code apart from the text inside it: string literals (standard,
// E'' with backslash escapes, $tag$ dollar quotes), quoted identifiers and
// comments (nested /* */ too). Used by scripts/migration-rules.mjs and
// scripts/db-health.mjs, which match regexes against the code only.
//
// ponytail: a scanner, not a parser. It assumes standard_conforming_strings
// is on (Supabase's default), so a backslash in a plain '' string is just a
// character.

const IDENT_CHAR = /[\w$\u0080-\uffff]/;
const DOLLAR_TAG = /\$(?:[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*)?\$/y;

/**
 * The SQL with comments and string literals blanked to spaces (newlines
 * kept), so every index still lines up with the original. Quoted identifiers
 * stay as they are, and so do comments with comments: 'keep'.
 * `unterminated` says a literal, identifier or comment never closed
 * (everything after it is blanked).
 *
 * dollar: 'text' blanks every dollar-quoted body. 'code' reads a body that
 * scans as complete SQL (a function or DO block) as code, masked the same
 * way, and blanks one that doesn't (prose with an apostrophe, say).
 */
export function maskSql(sql, { dollar = 'text', comments = 'blank' } = {}) {
  const out = sql.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  const afterIdent = (i) => i > 0 && IDENT_CHAR.test(sql[i - 1]);
  let unterminated = false;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      if (comments !== 'keep') blank(i, stop);
      i = stop;
    } else if (sql.startsWith('/*', i)) {
      let depth = 1;
      let j = i + 2;
      while (j < sql.length && depth) {
        if (sql.startsWith('/*', j) || sql.startsWith('*/', j)) {
          depth += sql[j] === '/' ? 1 : -1;
          j += 2;
        } else j++;
      }
      if (depth) unterminated = true;
      if (comments !== 'keep') blank(i, j);
      i = j;
    } else if (c === "'" || ((c === 'e' || c === 'E') && sql[i + 1] === "'" && !afterIdent(i))) {
      const escapes = c !== "'";
      let j = escapes ? i + 2 : i + 1;
      let closed = false;
      while (j < sql.length) {
        if (escapes && sql[j] === '\\') j += 2;
        else if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") {
          closed = true;
          j++;
          break;
        } else j++;
      }
      if (!closed) unterminated = true;
      j = Math.min(j, sql.length);
      blank(i, j);
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      let closed = false;
      while (j < sql.length) {
        if (sql[j] === '"' && sql[j + 1] === '"') j += 2;
        else if (sql[j] === '"') {
          closed = true;
          j++;
          break;
        } else j++;
      }
      if (!closed) unterminated = true;
      i = Math.min(j, sql.length);
    } else if (c === '$' && !afterIdent(i)) {
      DOLLAR_TAG.lastIndex = i;
      const tag = DOLLAR_TAG.exec(sql)?.[0];
      if (!tag) {
        i++;
        continue;
      }
      const start = i + tag.length;
      const end = sql.indexOf(tag, start);
      if (end === -1) {
        unterminated = true;
        blank(i, sql.length);
        break;
      }
      blank(i, start);
      blank(end, end + tag.length);
      const inner = dollar === 'code' ? maskSql(sql.slice(start, end), { dollar, comments }) : null;
      if (inner && !inner.unterminated) for (let k = 0; k < inner.code.length; k++) out[start + k] = inner.code[k];
      else blank(start, end);
      i = end + tag.length;
    } else {
      i++;
    }
  }
  return { code: out.join(''), unterminated };
}
