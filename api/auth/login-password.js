const { setSessionCookie } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    // Si la contraseña de administrador no está configurada, desactivamos este método por seguridad
    if (!adminPassword || adminPassword.trim() === '') {
        return res.status(403).json({ 
            error: 'La autenticación por contraseña de respaldo está desactivada. Configura ADMIN_PASSWORD en tu archivo .env' 
        });
    }

    try {
        if (password === adminPassword) {
            // Generar sesión de administrador válida
            setSessionCookie(res, { role: 'admin', user_id: 'admin-password' });
            return res.status(200).json({ verified: true });
        } else {
            return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
        }
    } catch (error) {
        console.error('Password login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
