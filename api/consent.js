const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url_scanned, user_agent } = req.body;

        // Extraer IP de los headers de Vercel (o req.socket como fallback)
        let ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        
        // Anonimizar IP (ej. 192.168.1.123 -> 192.168.1.***)
        const ipParts = ip.split('.');
        if (ipParts.length === 4) {
            ipParts[3] = '***';
            ip = ipParts.join('.');
        }

        // Insertar en la BD inmutable usando la key pública (anon_key)
        const { data, error } = await supabase
            .from('consent_logs')
            .insert([
                { 
                    ip_anonymized: ip,
                    user_agent: user_agent || req.headers['user-agent'] || 'unknown',
                    url_scanned: url_scanned || 'unknown',
                    action: 'AGREED_TO_POLICIES'
                }
            ]);

        if (error) {
            console.error('Supabase insert error:', error);
            return res.status(500).json({ error: 'Failed to record consent' });
        }

        return res.status(200).json({ success: true, message: 'Consent recorded successfully' });
    } catch (error) {
        console.error('Consent recording error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
