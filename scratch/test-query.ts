import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
    console.log("Checking Supabase connection with fallback...");
    
    const menusQuery = async () => {
        const res = await supabase
            .from('menus')
            .select('id, name, template_id, bar_id, created_at')
            .eq('is_active', true)
            .order('created_at');
        if (res.error) {
            console.warn("Failed to fetch menus with bar_id, attempting fallback:", res.error.message);
            const fallbackRes = await supabase
                .from('menus')
                .select('id, name, template_id, created_at')
                .eq('is_active', true)
                .order('created_at');
            if (fallbackRes.error) throw fallbackRes.error;
            return fallbackRes.data ? fallbackRes.data.map(m => ({ ...m, bar_id: null })) : [];
        }
        return res.data || [];
    };

    try {
        const menus = await menusQuery();
        console.log("Successfully retrieved menus with fallback. Count:", menus.length);
        console.log("Menus:", menus);
    } catch (err) {
        console.error("Menus query failed completely:", err);
    }
}

checkDatabase();
