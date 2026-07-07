const { verifySession } = require('../../lib/auth');

module.exports = async (req, res) => {
    // Solo permitimos peticiones GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const session = verifySession(req);
        if (!session || session.role !== 'admin') {
            return res.status(200).json({ authenticated: false });
        }

        return res.status(200).json({ 
            authenticated: true, 
            role: session.role, 
            user_id: session.user_id 
        });
    } catch (error) {
        console.error('Session check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
