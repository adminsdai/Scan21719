const { generateRegistrationOptions } = require('@simplewebauthn/server');
const { rpName, rpID, setChallengeCookie } = require('../../lib/auth');
const { supabaseAdmin } = require('../../lib/supabase');

module.exports = async (req, res) => {
    const { username } = req.query;

    if (!username || username.trim() === '') {
        return res.status(400).json({ error: 'Se requiere especificar un correo o usuario autorizado.' });
    }

    try {
        // 1. Verificar si el usuario está en la lista de autorizados de SDAI Chile
        const { data: authUser, error: authError } = await supabaseAdmin
            .from('authorized_users')
            .select('*')
            .eq('user_id', username)
            .limit(1);

        if (authError || !authUser || authUser.length === 0) {
            return res.status(403).json({ error: 'No autorizado. Tu usuario o correo no ha sido registrado como administrador en la plataforma.' });
        }

        // 2. Verificar si este usuario en particular ya tiene una llave registrada
        const { data: existingKeys, error: keyError } = await supabaseAdmin
            .from('passkey_credentials')
            .select('id')
            .eq('user_id', username)
            .limit(1);

        if (keyError) {
            return res.status(500).json({ error: 'Database check error' });
        }

        if (existingKeys && existingKeys.length > 0) {
            return res.status(403).json({ error: 'Este usuario ya cuenta con un acceso biométrico registrado y activo.' });
        }

        // 3. Generar opciones de WebAuthn dinámicas
        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userID: username,
            userName: username,
            attestationType: 'none',
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'preferred',
            },
        });

        setChallengeCookie(res, options.challenge);
        return res.status(200).json(options);

    } catch (error) {
        console.error('Register options generation error:', error);
        return res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
};
