// Keeps personal data out of crash reports, shared by monitoring.native.ts
// and monitoring.web.ts. Reports carry the account id (setMonitoringUser) and
// nothing that names a person or repeats what they typed.

/** The parts of a Sentry breadcrumb we look at. */
export interface Crumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Replaces anything shaped like an email address. */
export function redactEmails(text: string): string {
  return text.replace(EMAIL, '[email]');
}

/**
 * Drops the query string and fragment: Supabase filters (`?name=ilike.*gin*`),
 * search terms and sign-in tokens all travel there.
 */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * Console logs can hold anything (a draft, an error with an email in it), so
 * they're dropped. Request and navigation crumbs keep only the path.
 */
export function scrubBreadcrumb<T extends Crumb>(crumb: T): T | null {
  if (crumb.category === 'console') return null;
  const data = crumb.data ? { ...crumb.data } : undefined;
  if (data) {
    for (const key of ['url', 'from', 'to']) {
      if (typeof data[key] === 'string') data[key] = stripQuery(data[key] as string);
    }
  }
  return {
    ...crumb,
    ...(crumb.message ? { message: redactEmails(crumb.message) } : null),
    ...(data ? { data } : null),
  };
}

/** The parts of a Sentry event we look at. */
export interface ScrubbableEvent {
  message?: string;
  exception?: { values?: { value?: string }[] };
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown; data?: unknown };
  user?: { id?: string | number; email?: string; username?: string; ip_address?: string | null };
}

/** Emails out of error text, request details down to the path, user down to the id. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.message) event.message = redactEmails(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redactEmails(ex.value);
  }
  if (event.request) {
    event.request = { ...(event.request.url ? { url: stripQuery(event.request.url) } : null) };
  }
  if (event.user) event.user = event.user.id != null ? { id: event.user.id } : {};
  return event;
}
