import type { EmailOtpType, Session } from '@supabase/supabase-js';

import { parseAuthParams } from '@/lib/parseAuthParams';
import { supabase } from '@/lib/supabase';

/** Exchange a deep-link / email redirect URL for a Supabase session. */
export async function createSessionFromUrl(url: string): Promise<Session | null> {
  const params = parseAuthParams(url);
  if (params.error_description || params.error) {
    throw new Error(params.error_description || params.error);
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return data.session;
  }

  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return data.session;
  }

  if (params.token_hash && params.type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as EmailOtpType,
    });
    if (error) throw error;
    return data.session;
  }

  return null;
}
