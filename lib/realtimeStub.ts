/**
 * Stands in for @supabase/realtime-js in the web bundle (metro.config.js).
 * The app never opens a Realtime channel, but supabase-js builds a Realtime
 * client in createClient, which put the client and its Phoenix socket (about
 * 60 KB) in every web page's first load. This keeps what createClient and
 * auth changes call (setAuth) and fails loudly if a channel is ever asked for.
 *
 * ponytail: the ceiling is "no Realtime on the web". When a screen needs live
 * updates, delete the alias in metro.config.js and this file.
 * Checked by lib/realtimeStub.check.ts.
 */
export class RealtimeClient {
  setAuth(_token?: string | null): Promise<void> {
    return Promise.resolve();
  }

  channel(_name: string, _opts?: unknown): never {
    throw new Error('Realtime is not in the web bundle (lib/realtimeStub.ts): remove the alias in metro.config.js to use it.');
  }

  getChannels(): never[] {
    return [];
  }

  removeChannel(_channel: unknown): Promise<'ok'> {
    return Promise.resolve('ok');
  }

  removeAllChannels(): Promise<'ok'[]> {
    return Promise.resolve([]);
  }

  disconnect(): void {}
}
