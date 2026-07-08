const { generateAuthenticationOptions } = require('@simplewebauthn/server');
const { rpID, setChallengeCookie } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    const { username } = req.query;

    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Se requiere ingresar un usuario o correo autorizado.' });
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

        // 2. Buscar las llaves públicas de este usuario en particular
        const { data: credentials, error: credError } = await supabaseAdmin
            .from('passkey_credentials')
            .select('credential_id, transports')
            .eq('user_id', username);

        if (credError || !credentials || credentials.length === 0) {
            return res.status(404).json({ error: 'Este usuario no tiene un acceso biométrico configurado. Por favor realiza la configuración primero.' });
        }

        const allowCredentials = credentials.map(cred => ({
            id: cred.credential_id, // Pasar la cadena Base64URL directamente para compatibilidad con SimpleWebAuthn v13+
            type: 'public-key'
        }));

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials,
            userVerification: 'preferred',
        });

        setChallengeCookie(res, options.challenge);
        return res.status(200).json(options);

    } catch (error) {
        console.error('Login options generation error:', error);
        return res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
};
