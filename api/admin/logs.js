const { verifySession } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Proteger endpoint con JWT de la cookie (generada tras Login con Passkey)
    const session = verifySession(req);
    if (!session || session.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized. Valid Passkey session required.' });
    }

    try {
        // Consultar los registros inmutables ordenados por fecha descendente
        // Usamos supabaseAdmin (Service Role) porque la RLS está activa
        const { data, error } = await supabaseAdmin
            .from('consent_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Supabase query error:', error);
            return res.status(500).json({ error: 'Failed to retrieve logs' });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Logs retrieval error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
