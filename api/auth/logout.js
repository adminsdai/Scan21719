const { clearSessionCookie } = require('../../lib/auth');

module.exports = async (req, res) => {
    // Permitimos POST para cerrar sesión de manera segura
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        clearSessionCookie(res);
        return res.status(200).json({ success: true, message: 'Sesión cerrada correctamente' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
