const { setSessionCookie } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { username, password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Falta ingresar el usuario autorizado.' });
    }

    // Si la contraseña de administrador no está configurada, desactivamos este método por seguridad
    if (!adminPassword || adminPassword.trim() === '') {
        return res.status(403).json({ 
            error: 'La autenticación por contraseña de respaldo está desactivada. Configura ADMIN_PASSWORD en tu archivo .env' 
        });
    }

    try {
        // 1. Verificar si el usuario está en la lista de autorizados de la empresa
        const { data: authUser, error: authError } = await supabaseAdmin
            .from('authorized_users')
            .select('*')
            .eq('user_id', username)
            .limit(1);

        if (authError || !authUser || authUser.length === 0) {
            return res.status(403).json({ error: 'No autorizado. Tu usuario o correo no ha sido registrado como administrador en la plataforma.' });
        }

        // 2. Verificar la contraseña maestra
        if (password === adminPassword) {
            // Generar sesión de administrador válida asociada a ese usuario específico
            setSessionCookie(res, { role: 'admin', user_id: username });
            return res.status(200).json({ verified: true });
        } else {
            return res.status(401).json({ error: 'Contraseña de administrador incorrecta' });
        }
    } catch (error) {
        console.error('Password login error:', error);
        return res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
};
