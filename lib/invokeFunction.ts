import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

/** The client's own wording ("Edge Function returned a non-2xx status code") means nothing to a person. */
const RAW = /edge function|non-2xx|relay error|failed to send|request failed/i;
const plain = (message: string | undefined) => (!message || RAW.test(message) ? 'Couldn’t reach the server. Try again in a moment.' : message);

async function readFunctionError(error: FunctionsHttpError): Promise<string> {
    try {
        const payload = await error.context.json();
        if (typeof payload?.error === 'string') return payload.error;
    } catch {
        // ponytail: no JSON body (a proxy's page, a missing function): the plain message below
    }
    return plain(error.message);
}

export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke(name, { body });

    if (error) {
        if (error instanceof FunctionsHttpError) {
            throw new Error(await readFunctionError(error));
        }
        throw new Error(plain(error.message));
    }

    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
        throw new Error(data.error);
    }

    return data as T;
}
