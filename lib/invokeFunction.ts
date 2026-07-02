import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

async function readFunctionError(error: FunctionsHttpError): Promise<string> {
    try {
        const payload = await error.context.json();
        if (typeof payload?.error === 'string') return payload.error;
    } catch {
        // ponytail: fall back to generic message
    }
    return error.message || 'Request failed';
}

export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke(name, { body });

    if (error) {
        if (error instanceof FunctionsHttpError) {
            throw new Error(await readFunctionError(error));
        }
        throw new Error(error.message || 'Request failed');
    }

    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
        throw new Error(data.error);
    }

    return data as T;
}
