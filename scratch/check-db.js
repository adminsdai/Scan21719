const { supabaseAdmin } = require('../lib/supabase');

async function check() {
    try {
        const { data, error } = await supabaseAdmin
            .from('passkey_credentials')
            .select('*');
        
        if (error) {
            console.error('Supabase query error:', error);
            return;
        }

        console.log('PASSKEY CREDENTIALS:', JSON.stringify(data, null, 2));
        
        const { data: authUsers, error: authError } = await supabaseAdmin
            .from('authorized_users')
            .select('*');
            
        if (authError) {
            console.error('Supabase auth users query error:', authError);
            return;
        }
        
        console.log('AUTHORIZED USERS:', JSON.stringify(authUsers, null, 2));
    } catch (e) {
        console.error('Runtime error:', e);
    }
}

check();
