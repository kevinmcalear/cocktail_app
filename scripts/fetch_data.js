const { createClient } = require('@supabase/supabase-js');
const supabase = createClient("https://uzrqriixgxbvhunwrwkn.supabase.co", "sb_publishable_eBcdRyGaFo_43iZEZ7djWA_-XnGqC0y");

async function run() {
    const { data: methods } = await supabase.from('methods').select('name');
    const { data: glassware } = await supabase.from('glassware').select('name');
    const { data: families } = await supabase.from('families').select('name');
    const { data: ice } = await supabase.from('ice').select('name');
    
    // Also let's check unique origins and garnishes just in case
    const { data: cocktails } = await supabase.from('cocktails').select('origin');
    const origins = [...new Set(cocktails?.map(c => c.origin).filter(Boolean))];

    console.log('=== Methods ===\n', methods?.map(d => d.name).join(', '));
    console.log('\n=== Glassware ===\n', glassware?.map(d => d.name).join(', '));
    console.log('\n=== Families ===\n', families?.map(d => d.name).join(', '));
    console.log('\n=== Ice ===\n', ice?.map(d => d.name).join(', '));
    console.log('\n=== Origins ===\n', origins.join(', '));
}
run();
